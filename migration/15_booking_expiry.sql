-- ═══════════════════════════════════════════════════════════════════════════
--  15 — ساعةُ الخانة: مهلةُ إلغاء اللاعب، ومهلةُ ردّ المالك
--
--  ملفٌّ واحد لقاعدتين لأنهما حقيقةٌ واحدة
--  ────────────────────────────────────────
--  الخانة مورد مؤقّت: تُباع مرّة، وتموت في موعدها. وكلّ ما في هذا الملفّ
--  يحمي هذا المورد من طرفَين مختلفين:
--    ① **اللاعب** كان يستطيع الإلغاء قبل خمس دقائق من صافرة البداية، فتموت
--       الخانة بلا مشترٍ ولا وقتٍ لبيعها. الآن: قبل المهلة يُلغي كما كان،
--       وبعدها لا يُلغي من التطبيق (يتّصل بالملعب).
--    ② **المالك** كان يستطيع ألّا يردّ إطلاقًا. والطلب المعلّق **يحجز خانته**
--       (‏`bookings_no_double_idx` يشمل `pending`) ⇒ طلبٌ لا يُردّ عليه يمنع
--       غيره ثمّ يضيع. الآن: ينقضي بعد المهلة فيصير `rejected` بسبب آلي
--       مميَّز، وتعود الخانة قابلة للحجز.
--  والقاعدتان تتشاركان جدول الإعدادات ودوالّ توقيت عمّان، فصلُهما كان
--  سيجعل الملفّ الثاني معلَّقًا على الأوّل بلا داعٍ.
--
--  🕒 توقيت عمّان لا UTC
--  ───────────────────
--  القاعدة تعمل بـUTC، وهي تسبق الأردن ثلاث ساعات: `current_date` فيها
--  يقبل موعدًا ماضيًا بين منتصف الليل والثالثة فجرًا. كلّ مقارنة زمنية
--  هنا تمرّ بـ`amman_now()` — لا `now()` عارية ولا `current_date`.
--
--  🔗 علاقته بترحيل 14 (الإشعارات) — **اختيارية ومحروسة**
--  ─────────────────────────────────────────────────────
--  إذا كان 14 مُشغَّلًا: يُضاف النوع `booking_expired` إلى قائمة الأنواع،
--  ويُستبدَل مُشغِّل الإشعارات بنسخة تميّز «انقضت المهلة» عن «رفض المالك».
--  وإذا لم يكن مُشغَّلًا: يتخطّى الملفّ هذا القسم كلّه بلا خطأ، وكلّ ما
--  عداه يعمل. ⚠️ **الترتيب يهمّ**: شغِّل 14 ثمّ 15. لو عكستَ، أعِد تشغيل
--  15 بعد 14 (آمن للتكرار) وإلّا بقي المُشغِّل بنسخته القديمة.
--
--  ⏰ ولا cron في الخطّة المجانية
--  ─────────────────────────────
--  لذلك `expire_stale_bookings()` **تُستدعى عند القراءة**: لوحة المالك
--  في التطبيق و`/admin` تناديانها انتهازيًّا قبل الجلب. وفيها خانق
--  (‏`expiry_sweep_min_seconds`) يمنع تكرار الكنس مع كل تحديث لوحة.
--  ⇒ الحجز ينقضي عند أوّل نظرة، لا في اللحظة نفسها. وهذا **مذكور صراحةً**
--     في نصّ اللوحة بدل الإيحاء بأن هناك خادمًا يراقب على مدار الساعة.
--  ⚠️ وأثرٌ جانبي مقصود في سجلّ التدقيق: `t_audit_bookings` يسجّل `actor_id`
--     = **من فتح اللوحة**، لا «النظام». وهذا صادق تقنيًّا (هو من نفّذ المعاملة)
--     وقد يُقرأ خطأً كأنه من رفض الطلب. الفارق يظهر في `after->>'cancel_kind'`
--     = `expired` — فمن يقرأ السجلّ يميّزه، ولا حاجة إلى حساب نظامٍ وهمي.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
--  0) الإعدادات — قيمٌ يغيّرها المالك بـUPDATE لا بنشر نسخة جديدة
--
--  لماذا جدول لا ثابت في الكود؟ لأن «٦ ساعات» قرارٌ تجاري يتغيّر بالتجربة،
--  وتغييرُه اليوم يعني تعديل SQL ونشر APK معًا. والقيم ليست أسرارًا —
--  اللاعب يقرأ المهلة على الشاشة — فالقراءة عامّة والكتابة للأدمن وحده.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  num_value  numeric not null,
  note       text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.app_settings(key, num_value, note) values
  ('player_cancel_window_hours', 6,
   'اللاعب يلغي حتى هذا العدد من الساعات قبل بدء الخانة. يطابق CONFIG.CANCEL_WINDOW_H في app/src/app.js'),
  ('owner_reply_deadline_hours', 24,
   'مهلة ردّ المالك على الطلب من لحظة وصوله. ولا تتجاوز بدء الخانة نفسها مهما كانت'),
  ('expiry_sweep_min_seconds', 60,
   'أقلّ فاصل بين كنستين لانقضاء المهلة — يمنع تكرار الكنس مع كل تحديث لوحة')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists settings_read       on public.app_settings;
drop policy if exists settings_write_admin on public.app_settings;

-- القراءة عامّة: التطبيق يعرض المهلة للاعب، والقيمة ليست سرًّا.
create policy settings_read on public.app_settings for select using (true);
create policy settings_write_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- المنح والسياسة **حارسان مستقلّان** ويلزمان معًا: المنح يفتح الباب، والسياسة
-- تقول من يعبره. بلا سطر الكتابة كانت `settings_write_admin` سياسةً على بابٍ مقفل.
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;   -- وRLS تقصرها على الأدمن

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select num_value from public.app_settings where key = p_key), p_default)
$$;

-- ───────────────────────────────────────────────────────────────────────────
--  1) توقيت عمّان — دالّتان تُستعملان في كل مقارنة زمنية بعدهما
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.amman_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Asia/Amman')::timestamp $$;

-- بدء الخانة كوقت حائط في عمّان. الحجز يحمل تاريخًا وساعةً صحيحة، لا لحظةً
-- بتوقيت عالمي — فتحويله إلى timestamptz كان سيغيّر معناه.
create or replace function public.slot_start_amman(p_date date, p_hour smallint)
returns timestamp language sql immutable as $$
  select p_date::timestamp + make_interval(hours => p_hour)
$$;

-- ───────────────────────────────────────────────────────────────────────────
--  2) `cancel_kind` — السبب الآلي، منفصلًا عن السبب المكتوب بيد
--
--  ⚠️ لماذا لا يكفي `cancel_reason`؟ لأنه نصّ حرّ يكتبه المالك أو اللاعب،
--     وأيّ تقرير يبنيه على مطابقة نصّية يكسره حرفٌ واحد. والفرق بين
--     «المالك قال لا» و«لم يردّ أحد» **حقيقتان تجاريتان مختلفتان**:
--     الأولى قرار، والثانية إهمالٌ يُقاس. دمجهما يُتلف المقياس.
--  والقائمة **مغلقة**: ما لا يُكتب لا يُقبَل.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.bookings add column if not exists cancel_kind text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_cancel_kind_chk') then
    alter table public.bookings add constraint bookings_cancel_kind_chk
      check (cancel_kind in ('', 'expired'));
  end if;
end $$;

-- التقارير تسأل «كم انقضى؟» فقط ⇒ فهرس جزئي صغير لا فهرس على العمود كلّه.
create index if not exists bookings_expired_idx
  on public.bookings(booking_date) where cancel_kind = 'expired';

-- ───────────────────────────────────────────────────────────────────────────
--  3) مهلة إلغاء اللاعب (١.١) — مُشغِّل لا توسيع سياسة
--
--  ⚠️ لماذا مُشغِّل؟ **سياسة RLS تحكم الصفوف لا الأعمدة، ولا تعرف الزمن
--     بالسهولة نفسها.** و`with check` على `bookings_update` مكتوبة اليوم:
--         (player_id = auth.uid() and status = 'cancelled') or …
--     وحشرُ شرطٍ زمني فيها يخلط قاعدتين في تعبير واحد يصعب قراءته، ويجعل
--     الخرق يظهر للعميل «صفًّا فارغًا مع 200» — وهو أسوأ ردّ ممكن: العملية
--     «نجحت» ولم يحدث شيء. المُشغِّل يرفع خطأً **له اسم**، فتقرؤه الواجهة
--     وتقول للّاعب ما جرى بالضبط.
--
--  🔓 والمالك والأدمن لا يمسّهما هذا القيد: الاتفاقية تلزم المالك بالإلغاء
--     عند العطل القاهر مهما قرب الموعد، ومنعُه من ذلك يترك ملعبًا معطوبًا
--     محجوزًا. المهلة قيدٌ على من يستطيع أن يقرّر مبكّرًا، لا على من يفاجئه العطل.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_booking_cancel_window()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  win      numeric;
  deadline timestamp;
begin
  -- المالك/الأدمن خارج القيد (انظر التعليق أعلاه)
  if public.is_admin() or public.owns_place(new.place_id) then
    return new;
  end if;
  -- من ليس صاحب الحجز لا يصل أصلًا (‏`bookings_update` تردّه)؛ السطر احتياط.
  if new.player_id is distinct from auth.uid() then
    return new;
  end if;

  win := public.setting_num('player_cancel_window_hours', 6);
  deadline := public.slot_start_amman(new.booking_date, new.hour)
              - (round(win * 60)::int * interval '1 minute');

  if public.amman_now() >= deadline then
    -- رمزٌ آلي لا جملة: الواجهة ثنائية اللغة وتكتب الجملة بلغة المستخدم
    -- **الحالية**، تمامًا كما لا تُخزَّن نصوص الإشعارات (ترحيل 14).
    raise exception 'cancel_window_closed:%', win using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists t_booking_cancel_window on public.bookings;
create trigger t_booking_cancel_window before update on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.fn_booking_cancel_window();

-- ───────────────────────────────────────────────────────────────────────────
--  4) انقضاء مهلة ردّ المالك (١.٢)
--
--  الموعد النهائي = **الأقرب** من اثنين:
--    • وصول الطلب + مهلة الردّ (٢٤ ساعة افتراضًا)
--    • بدء الخانة نفسها
--  والثاني ليس تفصيلًا: طلبٌ لمباراة الليلة لا يملك حتى الغد ليُردّ عليه.
--  بدونه كان الطلب يبقى معلّقًا **بعد** أن يمرّ موعده، حاجزًا خانةً مضت.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.booking_reply_deadline(p_created timestamptz, p_date date, p_hour smallint)
returns timestamp language sql stable security definer set search_path = public as $$
  select least(
    (p_created at time zone 'Asia/Amman')
      + make_interval(mins => round(public.setting_num('owner_reply_deadline_hours', 24) * 60)::int),
    public.slot_start_amman(p_date, p_hour)
  )
$$;

create or replace function public.expire_stale_bookings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  gap      numeric := public.setting_num('expiry_sweep_min_seconds', 60);
  last_ep  numeric := public.setting_num('expiry_last_sweep_epoch', 0);
  dl_mins  integer := round(public.setting_num('owner_reply_deadline_hours', 24) * 60)::int;
  now_amm  timestamp := public.amman_now();
  n        integer := 0;
begin
  -- خانق: كل تحديث لوحة كان سيكنس الجدول كلّه. الكنس رخيص، لكنّه يكتب في
  -- `audit_log` عند كل صفّ يتغيّر — والتكرار بلا فائدة ضجيجٌ في السجلّ.
  if extract(epoch from now()) - last_ep < gap then
    return jsonb_build_object('success', true, 'expired', 0, 'skipped', true);
  end if;

  insert into public.app_settings(key, num_value, note)
  values ('expiry_last_sweep_epoch', extract(epoch from now()), 'آخر كنسة — تُكتب آليًّا')
  on conflict (key) do update set num_value = excluded.num_value, updated_at = now();

  /* ⚠️ المهلة تُقرَأ **مرّة واحدة** في متغيّر، والمقارنة مكتوبة هنا صراحةً بدل
     نداء `booking_reply_deadline()` لكل صفّ. الدالّة تستعلم من `app_settings`
     في كل نداء، ووضعُها في `where` يجعل ذلك استعلامًا لكل صفّ من الجدول كلّه
     إن قرّر المخطِّط تقييمها قبل `status = 'pending'`. والنتيجة **مطابقة**
     للدالّة حرفيًّا (`least` نفسه)، والدالّة تبقى للواجهة والتحقّق اليدوي. */
  with due as (
    select id from public.bookings
     where status = 'pending'
       and least((created_at at time zone 'Asia/Amman') + (dl_mins * interval '1 minute'),
                 public.slot_start_amman(booking_date, hour)) <= now_amm
     for update skip locked
  )
  update public.bookings b
     set status      = 'rejected',
         cancel_kind = 'expired'
    from due
   where b.id = due.id;
  get diagnostics n = row_count;

  -- ⚠️ `cancel_reason` تبقى فارغة عمدًا: الجملة تُكتب في الواجهة بلغة
  --    المستخدم من `cancel_kind`. نصٌّ مخزَّن يُجمَّد على لغة لحظة كتابته.
  return jsonb_build_object('success', true, 'expired', n);
end $$;

-- أي مستخدم مسجَّل يستطيع نداءها: هي **صيانة** لا قراءة بيانات — لا تردّ
-- صفًّا واحدًا من جدول، ولا تفعل إلّا الانتقال الموصوف أعلاه على صفوف
-- تجاوزت موعدها فعلًا. والخانق يمنع استعمالها إغراقًا.
revoke all on function public.expire_stale_bookings() from public, anon;
grant execute on function public.expire_stale_bookings() to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  5) الإشعار — محروسٌ بوجود ترحيل 14
--
--  «انقضت المهلة» ليست «رفض المالك». اللاعب الذي لم يردّ عليه أحد يستحقّ
--  جملةً تقول ذلك، لا جملةً تُلبس الملعبَ رفضًا لم يقله.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.notifications') is null then
    raise notice '14_notifications.sql غير مُشغَّل ⇒ تُخطّي قسم الإشعارات. شغّل 14 ثمّ أعِد تشغيل 15.';
    return;
  end if;

  -- توسيع قائمة الأنواع المغلقة
  if exists (select 1 from pg_constraint where conname = 'notifications_kind_chk') then
    alter table public.notifications drop constraint notifications_kind_chk;
  end if;
  alter table public.notifications add constraint notifications_kind_chk
    check (kind in ('booking_new','booking_confirmed','booking_rejected',
                    'booking_cancelled','booking_moved','booking_expired'));

  -- نسخة من مُشغِّل 14 تميّز الانقضاء. كل ما عداها كما هو حرفيًّا.
  execute $fn$
    create or replace function public.fn_notify_booking()
    returns trigger language plpgsql security definer set search_path = public as $body$
    declare
      payload jsonb;
      actor   uuid := auth.uid();
    begin
      select jsonb_build_object(
               'place_name',    p.name,
               'field_name',    f.name,
               'sport',         f.sport,
               'booking_date',  new.booking_date,
               'time_label',    new.time_label,
               'hour',          new.hour,
               'price',         new.price,
               'customer_name', new.customer_name,
               'cancel_reason', coalesce(new.cancel_reason, '')
             )
        into payload
        from public.places p, public.fields f
       where p.id = new.place_id and f.id = new.field_id;

      if tg_op = 'INSERT' then
        if new.status = 'pending' then
          insert into public.notifications(profile_id, kind, booking_id, place_id, data)
          select po.profile_id, 'booking_new', new.id, new.place_id, payload
            from public.place_owners po
           where po.place_id = new.place_id
             and po.profile_id is distinct from actor;
        end if;
        return new;
      end if;

      if new.status is distinct from old.status and new.player_id is not null then
        if new.status = 'confirmed' then
          insert into public.notifications(profile_id, kind, booking_id, place_id, data)
          values (new.player_id, 'booking_confirmed', new.id, new.place_id, payload);
        elsif new.status = 'rejected' then
          -- الفرق كلّه في هذا السطر: رفضٌ صريح أم مهلةٌ انقضت؟
          insert into public.notifications(profile_id, kind, booking_id, place_id, data)
          values (new.player_id,
                  case when new.cancel_kind = 'expired' then 'booking_expired' else 'booking_rejected' end,
                  new.id, new.place_id, payload);
        elsif new.status = 'cancelled' and new.player_id is distinct from actor then
          insert into public.notifications(profile_id, kind, booking_id, place_id, data)
          values (new.player_id, 'booking_cancelled', new.id, new.place_id, payload);
        end if;
      end if;

      if (new.booking_date is distinct from old.booking_date
          or new.hour is distinct from old.hour
          or new.field_id is distinct from old.field_id) then
        insert into public.notifications(profile_id, kind, booking_id, place_id, data)
        select po.profile_id, 'booking_moved', new.id, new.place_id,
               payload || jsonb_build_object('from_date', old.booking_date,
                                             'from_time', old.time_label)
          from public.place_owners po
         where po.place_id = new.place_id
           and po.profile_id is distinct from actor;
      end if;

      return new;
    end $body$;
  $fn$;
end $$;

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① الإعدادات الثلاثة موجودة:
--      select key, num_value from public.app_settings order by key;
--
-- ② مهلة الإلغاء تُفرَض في القاعدة لا في الواجهة وحدها. بتوكن لاعب له حجز
--    مؤكّد يبدأ بعد أقلّ من ٦ ساعات:
--      PATCH /rest/v1/bookings?id=eq.<uuid>   {"status":"cancelled"}
--    المتوقّع 400 مع "cancel_window_closed:6" — لا 200.
--    وبحجز بعد ٢٠ ساعة: المتوقّع 200 وصفٌّ مُعاد.
--
-- ③ الكنس:
--      select public.expire_stale_bookings();
--    المتوقّع {"success":true,"expired":n}. ونداؤها ثانيةً خلال دقيقة يردّ
--    {"expired":0,"skipped":true} — هذا الخانق يعمل لا عطل.
--
-- ④ الصفوف المنقضية تُميَّز عن رفض المالك:
--      select status, cancel_kind, count(*) from public.bookings
--       where status = 'rejected' group by 1,2;
--
-- ⑤ (إن كان 14 مُشغَّلًا) الإشعار نوعه `booking_expired` لا `booking_rejected`:
--      select kind, count(*) from public.notifications group by 1;
