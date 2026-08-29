-- ═══════════════════════════════════════════════════════════════════════════
--  23 — 🔴 إصلاح: `app_settings` كان اسمًا لجدولين مختلفين
--
--  ما الذي حدث؟
--  ────────────
--  الترحيل `11` (تأكيد الهاتف) ينشئ:
--      app_settings(key text, value text, updated_at)      ← **بلا أي سياسة RLS**
--  والترحيل `15` (ساعة الخانة) أنشأ باسمٍ **مطابق**:
--      app_settings(key text, num_value numeric, note, updated_at)  ← قراءة عامّة
--
--  و`create table if not exists` تعني أن **الأسبق يفوز والثاني يفشل صامتًا في
--  الإنشاء ثمّ يصطدم عند الإدراج**. من شغّل `15` قبل `11` يرى بالضبط:
--      ERROR 42703: column "value" of relation "app_settings" does not exist
--  وهذا خطأٌ في `15` لا في `11`: الاسم كان محجوزًا في ملفٍّ أسبق منه رقمًا،
--  ولم أفحص الترحيلات **المعلَّقة** قبل أن أختاره — فحصتُ القاعدة الحيّة وحدها،
--  وهي لا تحوي ما لم يُشغَّل بعد.
--
--  🔴 والأخطر ليس التصادم، بل **انقلاب سياسة الأمان**
--  ─────────────────────────────────────────────────
--  `11` يترك جدوله **بلا سياسة واحدة** عمدًا (سطرٌ مكتوب فيه: «محجوب عن الجميع»)
--  لأنه يحمل إعدادات مزوّد الرسائل. و`15` أضاف على **نفس الاسم**:
--      create policy settings_read … using (true);
--      grant select on public.app_settings to anon;
--  فلو شُغّل `11` بعده لبقيت سياستي فوق جدوله ⇒ **`sms_provider` و`sms_sender`
--  مقروءان بالمفتاح العام لأيّ أحد**. القيمتان فارغتان اليوم فلم يتسرّب شيء،
--  لكنّ أوّل يوم يملأ فيه المالك المزوّد كان سينشرهما.
--
--  الحلّ: **إعداداتي تنتقل، والاسم يعود لصاحبه.**
--  ──────────────────────────────────────────────
--  حاجتا الجدولين متعاكستان ولا يجوز أن يتشاركا واحدًا:
--    • `11` سرّي بحت — لا أحد يقرؤه.
--    • وإعداداتي **عامّة بالتصميم**: اللاعب يقرأ «٦ ساعات» على شاشته.
--  فصارت في `booking_rules`، و`app_settings` رجع كما صمّمه `11` حرفًا بحرف.
--
--  ✅ آمنٌ في الحالتين ولأي ترتيب: يفحص أيّ نسخةٍ من الجدول موجودة ويتصرّف.
--     ولا يحذف جدولًا ولا صفًّا لأحد — ينقل صفوفي ثمّ يمسحها من مكانها القديم.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
--  ⚠️ **شغّله قبل `11`** إن كنت قد شغّلت `15` بالفعل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
--  1) الوجهة الجديدة — قواعد الحجز، عامّة القراءة
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_rules (
  key        text primary key,
  num_value  numeric not null,
  note       text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.booking_rules(key, num_value, note) values
  ('player_cancel_window_hours', 6,
   'اللاعب يلغي حتى هذا العدد من الساعات قبل بدء الخانة. يطابق CONFIG.CANCEL_WINDOW_H في app/src/app.js'),
  ('owner_reply_deadline_hours', 24,
   'مهلة ردّ المالك على الطلب من لحظة وصوله. ولا تتجاوز بدء الخانة نفسها مهما كانت'),
  ('expiry_sweep_min_seconds', 60,
   'أقلّ فاصل بين كنستين لانقضاء المهلة — يمنع تكرار الكنس مع كل تحديث لوحة')
on conflict (key) do nothing;

alter table public.booking_rules enable row level security;

drop policy if exists br_read        on public.booking_rules;
drop policy if exists br_write_admin on public.booking_rules;

-- عامّة عمدًا: التطبيق يعرض المهلة للاعب، والقيمة ليست سرًّا.
create policy br_read on public.booking_rules for select using (true);
create policy br_write_admin on public.booking_rules for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.booking_rules to anon, authenticated;
grant insert, update on public.booking_rules to authenticated;   -- وRLS تقصرها على الأدمن

-- ───────────────────────────────────────────────────────────────────────────
--  2) نقل ما كتبه `15` (إن وُجد) ثمّ إعادة `app_settings` إلى شكل `11`
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  has_tbl  boolean := to_regclass('public.app_settings') is not null;
  has_num  boolean := false;
  has_val  boolean := false;
begin
  if not has_tbl then
    raise notice 'app_settings غير موجود — لا شيء يُنقَل. شغّل 11 حين تشاء وسيُنشئه بشكله الصحيح.';
    return;
  end if;

  select
    bool_or(column_name = 'num_value'),
    bool_or(column_name = 'value')
    into has_num, has_val
    from information_schema.columns
   where table_schema = 'public' and table_name = 'app_settings';

  if has_num then
    -- نسخة `15`: انقل القيم الفعلية (قد يكون المالك غيّرها) ثمّ امسح صفوفي.
    insert into public.booking_rules(key, num_value, note, updated_at)
    select s.key, s.num_value, coalesce(s.note,''), s.updated_at
      from public.app_settings s
     where s.key in ('player_cancel_window_hours','owner_reply_deadline_hours',
                     'expiry_sweep_min_seconds','expiry_last_sweep_epoch')
    on conflict (key) do update
      set num_value = excluded.num_value, updated_at = excluded.updated_at;

    delete from public.app_settings
     where key in ('player_cancel_window_hours','owner_reply_deadline_hours',
                   'expiry_sweep_min_seconds','expiry_last_sweep_epoch');

    alter table public.app_settings drop column if exists num_value;
    alter table public.app_settings drop column if exists note;
    raise notice 'نُقلت إعدادات 15 إلى booking_rules، وأُزيلت أعمدتها من app_settings.';
  end if;

  -- عمود `11` — يُضاف إن كان الجدول قد أُنشئ بنسخة `15`
  if not has_val then
    alter table public.app_settings add column value text not null default '';
    raise notice 'أُضيف العمود value ليعمل الترحيل 11.';
  end if;

  -- 🔴 والأهمّ: إعادة «بلا أي سياسة» — كما صمّمه 11 وكما يجب أن يكون
  execute 'drop policy if exists settings_read        on public.app_settings';
  execute 'drop policy if exists settings_write_admin on public.app_settings';
  execute 'revoke all on public.app_settings from anon';
  execute 'revoke all on public.app_settings from authenticated';
  execute 'alter table public.app_settings enable row level security';
end $$;

-- ───────────────────────────────────────────────────────────────────────────
--  3) `setting_num` تقرأ من الوجهة الجديدة
--     الاسم لم يتغيّر ⇒ كل دالّة في 15 تستعملها تعمل بلا تعديل.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select num_value from public.booking_rules where key = p_key), p_default)
$$;

-- والكنس يكتب طابعه في الوجهة الجديدة كذلك.
create or replace function public.expire_stale_bookings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  gap      numeric := public.setting_num('expiry_sweep_min_seconds', 60);
  last_ep  numeric := public.setting_num('expiry_last_sweep_epoch', 0);
  n        integer := 0;
begin
  if extract(epoch from now()) - last_ep < gap then
    return jsonb_build_object('success', true, 'expired', 0, 'skipped', true);
  end if;

  insert into public.booking_rules(key, num_value, note)
  values ('expiry_last_sweep_epoch', extract(epoch from now()), 'آخر كنسة — تُكتب آليًّا')
  on conflict (key) do update set num_value = excluded.num_value, updated_at = now();

  with due as (
    select id from public.bookings
     where status = 'pending'
       and public.booking_reply_deadline(created_at, booking_date, hour) <= public.amman_now()
     for update skip locked
  )
  update public.bookings b
     set status      = 'rejected',
         cancel_kind = 'expired'
    from due
   where b.id = due.id;
  get diagnostics n = row_count;

  return jsonb_build_object('success', true, 'expired', n);
end $$;

revoke all on function public.expire_stale_bookings() from public, anon;
grant execute on function public.expire_stale_bookings() to authenticated;

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① الإعدادات انتقلت:
--      select key, num_value from public.booking_rules order by key;
--    المتوقّع الثلاثة (‏+ `expiry_last_sweep_epoch` إن سبق أن كُنس).
--
-- ② و`app_settings` عاد كما يريده 11 — **بلا سياسة واحدة**:
--      select policyname from pg_policies where tablename = 'app_settings';
--    المتوقّع **صفر صفوف**. ولو ظهر `settings_read` فالإصلاح لم يمرّ.
--
-- ③ وأعمدته صارت أعمدة 11:
--      select column_name from information_schema.columns
--       where table_name = 'app_settings' order by 1;
--    المتوقّع: key · updated_at · value  (لا `num_value` ولا `note`).
--
-- ④ ثمّ **شغّل `11_phone_verification.sql`** — يمرّ الآن بلا خطأ.
--
-- ⑤ 🔴 وبعد `11`، بالمفتاح العام من نافذة خاصّة بلا تسجيل دخول:
--      GET /rest/v1/app_settings?select=*          ⇒ المتوقّع 401/403 لا 200
--      GET /rest/v1/booking_rules?select=*         ⇒ المتوقّع 200 (عامّ بالتصميم)
--    الأوّل هو الفحص الذي يثبت أن انقلاب السياسة أُصلح فعلًا.
--
-- ⑥ والمهلة ما زالت مفروضة (لم ينكسر شيء من 15):
--      select public.setting_num('player_cancel_window_hours', 0);   ⇒ 6
--      select public.expire_stale_bookings();                        ⇒ success
