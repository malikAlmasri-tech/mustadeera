-- ═══════════════════════════════════════════════════════════════════════════
--  20 — «نبّهني إذا فضيت»: تسجيل رغبةٍ لم تُلبَّ
--
--  أثمنُ إشارةٍ يملكها هذا المنتج
--  ──────────────────────────────
--  اللاعب الذي أراد الخميس ٨ مساءً فوجدها محجوزة **يغادر بلا أثر**. ولا يعرف
--  أحد أنه جاء: لا المالك (كي يفتح ملعبًا ثانيًا في تلك الساعة) ولا نحن (كي
--  نعرف أيّ ساعةٍ عليها طلبٌ يفوق العرض). هذا الجدول يسجّل تلك الرغبة.
--  وهو مصدرُ «الخانات المطلوبة والمحجوزة» في لوحة `/admin` (ترحيل 21).
--
--  🔒 لا يرى أحدٌ رغبةَ أحد
--  ───────────────────────
--  الصفّ يقول «فلانٌ يريد هذه الخانة»، وهذه معلومة عن **شخص**. فالقراءة
--  مقصورة على صاحب الصفّ والأدمن، والإدراج على المسجَّلين وحدهم — لا `anon`:
--  رغبةٌ بلا صاحب لا يمكن إشعار أحدٍ بها، فتسجيلها جمعُ بياناتٍ بلا فائدة.
--
--  ⚠️ ويعتمد على 14 اعتمادًا **حقيقيًّا** لا اختياريًّا
--  ─────────────────────────────────────────────────
--  الوعد كلّه «سنُشعرك»، والإشعارات هي ترحيل 14. فإن لم يكن مُشغَّلًا فهذا
--  الملفّ **يتوقّف ويقول ذلك** — ولا يُنشئ جدولًا يجمع رغباتٍ لا يستطيع أحد
--  أن يردّ عليها. والتطبيق كذلك: زرّ «نبّهني» **لا يظهر أصلًا** ما لم تكن
--  الإشعارات شغّالة، فلا يقبل نيّةً لا يستطيع الوفاء بها.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception 'يحتاج ترحيل 14 (الإشعارات) أولاً — وبدونه لا وسيلة لإخبار أحد، فلا معنى لتسجيل الرغبة.';
  end if;
end $$;

begin;

create table if not exists public.slot_watch (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  field_id   uuid not null references public.fields(id)   on delete cascade,
  watch_date date not null,
  hour       smallint not null check (hour between 0 and 23),
  notified_at timestamptz
);

-- رغبةٌ واحدة لكل شخصٍ لكل خانة. التكرار يُهمَل بلا خطأ في الواجهة
-- (‏`Prefer: resolution=ignore-duplicates`) — الضغط مرّتين ليس عطلًا يُبلَّغ عنه.
create unique index if not exists slot_watch_uniq
  on public.slot_watch(profile_id, field_id, watch_date, hour);
-- الاستعلام الوحيد الذي يهمّ الخادم: «من ينتظر هذه الخانة ولم يُشعَر بعد؟»
create index if not exists slot_watch_open_idx
  on public.slot_watch(field_id, watch_date, hour) where notified_at is null;

alter table public.slot_watch enable row level security;

drop policy if exists sw_own    on public.slot_watch;
drop policy if exists sw_insert on public.slot_watch;
drop policy if exists sw_admin  on public.slot_watch;

-- صفوفي وحدها — لا أرى من ينتظر معي، ولا يراني أحد.
create policy sw_own on public.slot_watch for select
  using (profile_id = auth.uid());
create policy sw_insert on public.slot_watch for insert
  to authenticated with check (profile_id = auth.uid());
-- والتراجع حقٌّ لصاحبه: من سجّل رغبة يستطيع سحبها.
drop policy if exists sw_del on public.slot_watch;
create policy sw_del on public.slot_watch for delete using (profile_id = auth.uid());
-- الأدمن يقرأ للتحليل (ترحيل 21) — ولا يكتب.
create policy sw_admin on public.slot_watch for select using (public.is_admin());

grant select, insert, delete on public.slot_watch to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  الإشعار عند تحرّر الخانة
--
--  متى تتحرّر؟ حين يخرج حجزٌ من `pending`/`confirmed` — إلغاءً أو رفضًا أو
--  انقضاءَ مهلة (ترحيل 15). و`bookings_no_double_idx` يشمل الحالتين، فهذا
--  بالضبط شرط «صارت الخانة قابلة للحجز».
--
--  ⚠️ ولا يُشعَر من ألغى بنفسه: هو من حرّرها.
--  ⚠️ و`notified_at` تُختم في نفس المعاملة ⇒ لا إشعار مكرّر مهما تكرّر الحدث.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_kind_chk') then
    return;
  end if;
  alter table public.notifications drop constraint notifications_kind_chk;
  alter table public.notifications add constraint notifications_kind_chk
    check (kind in ('booking_new','booking_confirmed','booking_rejected',
                    'booking_cancelled','booking_moved','booking_expired',
                    'slot_free'));
end $$;

create or replace function public.fn_notify_slot_free()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
begin
  -- خرجت الخانة من الحجز فعلًا؟
  if not (old.status in ('pending','confirmed') and new.status not in ('pending','confirmed')) then
    return new;
  end if;

  select jsonb_build_object(
           'place_name', p.name, 'field_name', f.name, 'sport', f.sport,
           'booking_date', old.booking_date, 'time_label', old.time_label, 'hour', old.hour)
    into payload
    from public.places p, public.fields f
   where p.id = old.place_id and f.id = old.field_id;

  with due as (
    select w.id, w.profile_id from public.slot_watch w
     where w.field_id = old.field_id and w.watch_date = old.booking_date and w.hour = old.hour
       and w.notified_at is null
       and w.profile_id is distinct from auth.uid()   -- من حرّرها لا يُبشَّر بها
  ), ins as (
    insert into public.notifications(profile_id, kind, booking_id, place_id, data)
    select profile_id, 'slot_free', null, old.place_id, payload from due
    returning 1
  )
  update public.slot_watch w set notified_at = now()
    from due where w.id = due.id;

  return new;
end $$;

drop trigger if exists t_notify_slot_free on public.bookings;
create trigger t_notify_slot_free after update on public.bookings
  for each row execute function public.fn_notify_slot_free();

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① لا أحد يرى رغبة غيره. بتوكن لاعب A بعد أن يسجّل رغبة، ثمّ بتوكن لاعب B:
--      GET /rest/v1/slot_watch?select=*     ⇒ صفوف A عند A فقط، و[] عند B.
--    وبالمفتاح العام وحده (بلا دخول): المتوقّع [] أو 401 — لا صفوف.
--
-- ② الإدراج باسم غيرك مرفوض:
--      POST /rest/v1/slot_watch {"profile_id":"<uuid آخر>", …}  ⇒ 403.
--
-- ③ التكرار لا يُنشئ صفًّا ثانيًا (القيد الفريد):
--      أعِد نفس الإدراج ⇒ 409، والتطبيق يمرّرها بـ`resolution=ignore-duplicates`.
--
-- ④ الإشعار يصل عند التحرير: سجّل رغبة على خانة محجوزة، ثمّ ألغِ الحجز
--    **من حساب المالك** (لا من حساب صاحب الرغبة):
--      select kind, data->>'time_label' from public.notifications
--       where kind = 'slot_free' order by created_at desc limit 3;
--    ثمّ تأكّد أن `notified_at` امتلأت فلا يتكرّر الإشعار:
--      select notified_at from public.slot_watch where id = '<uuid>';
