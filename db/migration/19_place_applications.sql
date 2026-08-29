-- ═══════════════════════════════════════════════════════════════════════════
--  19 — طلبات انضمام الملاعب: من مكالمةٍ يدوية إلى نموذج
--
--  ما هو المسار اليوم؟
--  ──────────────────
--  الموقع ← `/contact` ← مكالمة ← `/admin` ← «إضافة مكان» ← رفع الدور.
--  صحيحٌ تمامًا عند ستّة ملاعب، ومستحيلٌ عند ستّين. وهذا الملفّ يضيف
--  **صندوق وارد** لا أكثر: الطلب يُسجَّل، والقرار يبقى بشريًّا.
--
--  🔴 والأمان هنا ليس تفصيلًا: **الصفوف تحمل أرقام هواتف حقيقية**
--  ────────────────────────────────────────────────────────────
--  والمفتاح `anon` عامّ بالتصميم. فسياسة قراءةٍ واحدة على هذا الجدول =
--  تسريبُ قاعدةِ بياناتِ أرقامٍ لأي أحد — نفس عطل `reviews.phone` الذي
--  أُغلق في الترحيل 07، وأخطر منه لأن الصفّ يجمع الاسمَ والرقمَ والمنشأة.
--  ولذلك: **لا سياسة `select` إلّا للأدمن.** والإدراج يمرّ ولا يُرجع شيئًا
--  (‏`Prefer: return=minimal`) — والسياسة تمنع الإرجاع أصلًا.
--
--  ⏱️ وحدّ المعدّل **في القاعدة** لا في الصفحة
--  ─────────────────────────────────────────
--  عدّاد الواجهة يُتجاوَز بإعادة تحميل — نفس درس أكواد الهاتف (ترحيل 11).
--  ثلاثة حدود: رقمٌ واحد كل ١٠ دقائق · و٣ في اليوم للرقم نفسه · و٤٠ في
--  الساعة لكل الجدول (كي لا يُغرِق أحدٌ الصندوق بأرقام مختلفة).
--  ⚠️ والحدّ في **مُشغِّل** لا في `with check`: التعبير في السياسة يُنفَّذ
--     بصلاحية المستخدم، والجدول بلا سياسة قراءة ⇒ استعلامٌ فرعي داخلها
--     لا يرى صفًّا واحدًا فيمرّ الحدّ دائمًا. المُشغِّل `security definer` يرى.
--
--  🚫 والرفض **لا يحذف**
--  ────────────────────
--  الصفّ يبقى بحالته وسببه: «قدّمنا ولم يردّ أحد» شكوى لا جواب لها إن
--  كان الصفّ قد مُحي. والحذف النهائي قرارٌ منفصل بيد الأدمن.
--
--  مستقلّ تمامًا: لا يعتمد على أيّ ترحيل معلَّق.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.place_applications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  contact_name text not null,
  phone        text not null,
  venue_name   text not null,
  city         text not null default '',
  region       text not null default '',
  sport        text not null default 'football',
  courts       smallint not null default 1 check (courts between 1 and 50),
  notes        text not null default '',
  status       text not null default 'new' check (status in ('new','approved','rejected')),
  review_note  text not null default '',
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  place_id     uuid references public.places(id) on delete set null   -- يُملأ عند القبول
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pa_sport_chk') then
    -- نفس المفردات المغلقة في التطبيق (`SPORT_KEYS`) وفي `/admin`.
    alter table public.place_applications add constraint pa_sport_chk
      check (sport in ('football','padel','basket','tennis','volley'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pa_len_chk') then
    -- حدودُ طولٍ في القاعدة لا في الصفحة: الصفحة تُتجاوَز بـcurl.
    alter table public.place_applications add constraint pa_len_chk
      check (length(contact_name) between 2 and 80
         and length(phone)        between 7 and 20
         and length(venue_name)   between 2 and 120
         and length(city)         <= 60
         and length(region)       <= 60
         and length(notes)        <= 1000);
  end if;
end $$;

create index if not exists pa_status_idx on public.place_applications(status, created_at desc);
create index if not exists pa_phone_idx  on public.place_applications(phone, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
--  RLS — الإدراج للجميع، والقراءة للأدمن وحده
-- ───────────────────────────────────────────────────────────────────────────
alter table public.place_applications enable row level security;

drop policy if exists pa_insert on public.place_applications;
drop policy if exists pa_admin  on public.place_applications;

-- ⚠️ `with check (true)` مقصودة: الحقول يحرسها القيد والمُشغِّل، والسياسة
--    هنا تقول «للجميع أن يقدّموا» — وهذا هو المطلوب من نموذجٍ عامّ.
create policy pa_insert on public.place_applications for insert
  to anon, authenticated with check (true);

-- ولا سياسة `select` لغير الأدمن ⇒ المفتاح العام لا يقرأ صفًّا واحدًا،
-- ولا حتى الصفّ الذي أدرجه هو قبل ثانية.
create policy pa_admin on public.place_applications for all
  using (public.is_admin()) with check (public.is_admin());

grant insert on public.place_applications to anon, authenticated;
grant select, update on public.place_applications to authenticated;   -- وRLS تقصرها على الأدمن

-- ───────────────────────────────────────────────────────────────────────────
--  حدّ المعدّل + تطهير المُدخَل
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_pa_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  same_phone_10m int;
  same_phone_24h int;
  all_1h         int;
begin
  -- الحقول التي يقرّرها الخادم لا العميل: طلبٌ يصل بـ`status='approved'`
  -- كان سيدخل الصندوق مقبولًا سلفًا.
  new.status      := 'new';
  new.review_note := '';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.place_id    := null;
  new.created_at  := now();

  new.contact_name := btrim(new.contact_name);
  new.venue_name   := btrim(new.venue_name);
  new.city         := btrim(coalesce(new.city, ''));
  new.region       := btrim(coalesce(new.region, ''));
  new.notes        := btrim(coalesce(new.notes, ''));
  -- توحيد الرقم بنفس منطق `sbPhone` في التطبيق، كي لا يهرب الحدّ بصيغةٍ أخرى
  -- للرقم نفسه (‏07… · +9627… · 009627…).
  new.phone := regexp_replace(coalesce(new.phone,''), '\s', '', 'g');
  new.phone := regexp_replace(new.phone, '^\+', '');
  if left(new.phone, 5) = '00962' then new.phone := '962' || substr(new.phone, 6); end if;
  if left(new.phone, 2) = '07'    then new.phone := '962' || substr(new.phone, 2); end if;

  select count(*) into same_phone_10m from public.place_applications
   where phone = new.phone and created_at > now() - interval '10 minutes';
  if same_phone_10m > 0 then
    raise exception 'pa_too_soon' using errcode = 'P0001';
  end if;

  select count(*) into same_phone_24h from public.place_applications
   where phone = new.phone and created_at > now() - interval '24 hours';
  if same_phone_24h >= 3 then
    raise exception 'pa_rate_phone' using errcode = 'P0001';
  end if;

  select count(*) into all_1h from public.place_applications
   where created_at > now() - interval '1 hour';
  if all_1h >= 40 then
    raise exception 'pa_rate_global' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists t_pa_guard on public.place_applications;
create trigger t_pa_guard before insert on public.place_applications
  for each row execute function public.fn_pa_guard();

-- تحديث المراجعة: الطوابع يكتبها الخادم لا اللوحة.
create or replace function public.fn_pa_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
  end if;
  -- ما وصل من المُقدِّم لا يُعدَّل بعد وصوله: الصندوق سجلٌّ لا مسوّدة.
  new.contact_name := old.contact_name;
  new.phone        := old.phone;
  new.venue_name   := old.venue_name;
  new.city         := old.city;
  new.region       := old.region;
  new.sport        := old.sport;
  new.courts       := old.courts;
  new.notes        := old.notes;
  new.created_at   := old.created_at;
  return new;
end $$;

drop trigger if exists t_pa_review on public.place_applications;
create trigger t_pa_review before update on public.place_applications
  for each row execute function public.fn_pa_review();

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ⚠️ ① **الفحص الحاسم — بالمفتاح العام وحده، من نافذة خاصّة، بلا تسجيل دخول.**
--    نفس ما فُحص به تسريب `reviews.phone` في الترحيل 07. المتوقّع 401/403 في
--    الأربعة، لا 200 ولا `[]`:
--      GET /rest/v1/place_applications?select=*
--      GET /rest/v1/place_applications?select=phone
--      GET /rest/v1/place_applications?select=id&order=phone.desc
--      GET /rest/v1/place_applications?select=id&phone=like.*79*
--    (الأخيران قناتان جانبيّتان: الترتيب والترشيح يسرّبان بلا `select`.)
--
-- ② والإدراج يمرّ — المتوقّع 201:
--      POST /rest/v1/place_applications
--      {"contact_name":"أبو أحمد","phone":"0790000000","venue_name":"ملعب تجريبي",
--       "city":"عمّان","region":"الجبيهة","sport":"padel","courts":2}
--
-- ③ وتكراره فورًا يُردّ — المتوقّع 400 مع "pa_too_soon".
--
-- ④ والحقول التي يقرّرها الخادم لا تُزوَّر: أرسل `"status":"approved"` وتحقّق
--    (بحساب أدمن) أن الصفّ `new`.
--
-- ⑤ الأدمن يقرأ:
--      select status, count(*) from public.place_applications group by 1;
