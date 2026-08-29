-- ═══════════════════════════════════════════════════════════════════════════
--  المستديرة — مخطّط قاعدة البيانات (Postgres / Supabase)
--  يُشغَّل مرّة واحدة: لوحة Supabase ← SQL Editor ← لصق ← Run
--  مبنيّ على أعمدة الشيت الفعلية في Code.gs (Places/Fields/Bookings/Reviews/Owners/Players)
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) الهويّات — profiles مرتبط بـauth.users (كلمة السر تُخزَّن مُجزَّأة داخل auth، لا هنا)
--    الدور يحدّد ما يراه: player / owner / admin
-- ───────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'player' check (role in ('player','owner','admin')),
  name        text not null default '',
  phone       text not null unique,
  active      boolean not null default true,
  legacy_id   text unique,                    -- player_id/owner_id القديم — للربط أثناء الاستيراد
  created_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) الأماكن والملاعب
-- ───────────────────────────────────────────────────────────────────────────
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,                    -- place_id القديم
  name        text not null,
  city        text not null default '',
  region      text not null default 'all',
  type        text not null default 'عشب صناعي',
  color       text not null default '#15803d',
  phone       text not null default '',
  map_link    text default '',
  -- المرافق تبقى نصًّا كما في الشيت (قد تحمل وصفًا لا مجرّد نعم/لا — راجع getAmenityValue)
  amenity_water text, amenity_vests text, amenity_ball text,
  amenity_bathrooms text, amenity_parking text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ملكية المكان: جدول وصل (يسمح بمالكين لمكان، ومكان لكل مالك — أعمّ من عمود place_id القديم)
create table public.place_owners (
  place_id   uuid references public.places(id)   on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  primary key (place_id, profile_id)
);

create table public.fields (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  text unique,                      -- field_id القديم
  place_id   uuid not null references public.places(id) on delete cascade,
  name       text not null default 'ملعب',
  size       text not null default '5×5',
  price      numeric(10,2) not null default 0 check (price >= 0),
  slots      jsonb not null default '[]'::jsonb,   -- [{"h":20,"label":"8 مساءً"}, …]
  image_url  text default '',
  active     boolean not null default true
);
create index fields_place_idx on public.fields(place_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3) الحجوزات
-- ───────────────────────────────────────────────────────────────────────────
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     text unique,                   -- booking_id القديم
  created_at    timestamptz not null default now(),
  player_id     uuid references public.profiles(id) on delete set null,  -- فارغ = حجز يدوي أدخله المالك
  place_id      uuid not null references public.places(id) on delete restrict,
  field_id      uuid not null references public.fields(id) on delete restrict,
  booking_date  date not null,
  hour          smallint not null check (hour between 0 and 23),
  time_label    text not null default '',
  customer_name  text not null default '',
  customer_phone text not null default '',
  players_size  text default '',
  price         numeric(10,2) not null default 0,   -- لقطة السعر وقت الحجز (السعر قد يتغيّر لاحقًا)
  source        text not null default 'direct',
  status        text not null default 'pending'
                check (status in ('pending','confirmed','cancelled','rejected')),
  cancel_reason text default ''
);

-- ★★ الحجز المزدوج يصير مستحيلًا على مستوى القاعدة — لا يعتمد على قفل ولا على منطق تطبيقي.
--    طلبان متزامنان على نفس الخانة ⇒ أحدهما يفشل بخطأ قيد فريد، مهما كان التزامن.
create unique index bookings_no_double_idx
  on public.bookings (field_id, booking_date, hour)
  where status in ('pending','confirmed');

create index bookings_place_date_idx on public.bookings (place_id, booking_date);
create index bookings_player_idx     on public.bookings (player_id);
create index bookings_created_idx    on public.bookings (created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 4) التقييمات
-- ───────────────────────────────────────────────────────────────────────────
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique,
  created_at  timestamptz not null default now(),
  place_id    uuid not null references public.places(id) on delete cascade,
  field_id    uuid references public.fields(id) on delete set null,
  author_name text default '',
  phone       text default '',
  rating      smallint not null check (rating between 1 and 5),
  comment     text default ''
);
create index reviews_place_idx on public.reviews(place_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 5) سجلّ التدقيق — «كل المدخلات والمخرجات أمامك»
--    يُكتب بـtrigger داخل القاعدة ⇒ يستحيل على أي عميل أن يتجاوزه أو يزوّره.
-- ───────────────────────────────────────────────────────────────────────────
create table public.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_role text,
  action     text not null,          -- insert / update / delete
  entity     text not null,          -- bookings / reviews / fields / places / profiles
  entity_id  text,
  before     jsonb,
  after      jsonb
);
create index audit_at_idx     on public.audit_log(at desc);
create index audit_entity_idx on public.audit_log(entity, at desc);

create or replace function public.fn_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(actor_id, actor_role, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    (select role from public.profiles where id = auth.uid()),
    lower(tg_op), tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger t_audit_bookings after insert or update or delete on public.bookings
  for each row execute function public.fn_audit();
create trigger t_audit_reviews  after insert or update or delete on public.reviews
  for each row execute function public.fn_audit();
create trigger t_audit_fields   after insert or update or delete on public.fields
  for each row execute function public.fn_audit();
create trigger t_audit_places   after insert or update or delete on public.places
  for each row execute function public.fn_audit();
create trigger t_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.fn_audit();

-- ───────────────────────────────────────────────────────────────────────────
-- 6) دوالّ صلاحيات مساعدة
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.owns_place(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.place_owners where place_id = p and profile_id = auth.uid())
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7) RLS — «من يرى ماذا» يُفرَض داخل القاعدة لا في كود الواجهة
--    ⇒ حتى لو تسرّب مفتاح anon (وهو عام أصلًا) لا يستطيع أحد قراءة بيانات غيره.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.places       enable row level security;
alter table public.place_owners enable row level security;
alter table public.fields       enable row level security;
alter table public.bookings     enable row level security;
alter table public.reviews      enable row level security;
alter table public.audit_log    enable row level security;

-- الأماكن والملاعب: القراءة عامة للنشِط (صفحة التصفّح تعمل بلا تسجيل دخول)
create policy places_read on public.places for select
  using (active or public.is_admin() or public.owns_place(id));
create policy places_write_admin on public.places for all
  using (public.is_admin()) with check (public.is_admin());

create policy fields_read on public.fields for select
  using (active or public.is_admin() or public.owns_place(place_id));
create policy fields_owner_write on public.fields for all
  using (public.owns_place(place_id) or public.is_admin())
  with check (public.owns_place(place_id) or public.is_admin());

create policy po_read on public.place_owners for select
  using (profile_id = auth.uid() or public.is_admin());

-- الملفّات الشخصية: كلٌّ يرى نفسه، والأدمن يرى الكل
create policy profiles_self on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- الحجوزات: اللاعب حجوزاته · المالك حجوزات مكانه · الأدمن الكل
create policy bookings_read on public.bookings for select
  using (player_id = auth.uid() or public.owns_place(place_id) or public.is_admin());
create policy bookings_insert_player on public.bookings for insert
  with check (player_id = auth.uid() or public.owns_place(place_id) or public.is_admin());
-- اللاعب يلغي حجزه فقط · المالك يغيّر حالة حجوزات مكانه
create policy bookings_update on public.bookings for update
  using (
    (player_id = auth.uid() and status in ('pending','confirmed'))
    or public.owns_place(place_id) or public.is_admin()
  )
  with check (
    (player_id = auth.uid() and status = 'cancelled')
    or public.owns_place(place_id) or public.is_admin()
  );

-- التقييمات: القراءة عامة · الكتابة لمن سجّل دخوله
create policy reviews_read   on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert with check (auth.uid() is not null);

-- سجلّ التدقيق: للأدمن حصرًا
create policy audit_admin on public.audit_log for select using (public.is_admin());

-- ───────────────────────────────────────────────────────────────────────────
-- 8) عروض (views) تُبقي شكل استجابة الواجهة كما هو ⇒ تغيير أقلّ في app.js
-- ───────────────────────────────────────────────────────────────────────────

-- ★ التوفّر العام: خانات محجوزة **بلا أي بيانات شخصية** — يقرأها الزائر بلا تسجيل دخول.
--   عرض عادي (security definer) عمدًا ليتجاوز RLS، لأنه لا يكشف شيئًا شخصيًّا.
create view public.booked_slots as
  select field_id, booking_date, hour
  from public.bookings
  where status in ('pending','confirmed');
grant select on public.booked_slots to anon, authenticated;

-- ★ إحصاء التقييمات لكل مكان (المتوسّط + التوزيع [1★..5★] الذي تستعمله الأشرطة)
create view public.place_stats as
  select place_id,
         round(avg(rating)::numeric, 1) as rating,
         count(*)                       as reviews_count,
         array[ count(*) filter (where rating = 1), count(*) filter (where rating = 2),
                count(*) filter (where rating = 3), count(*) filter (where rating = 4),
                count(*) filter (where rating = 5) ] as reviews_dist
  from public.reviews group by place_id;
grant select on public.place_stats to anon, authenticated;

-- ★ الحجز بأسماء المكان/الملعب/المدينة (نفس مفاتيح الاستجابة القديمة)
create view public.bookings_full with (security_invoker = on) as
  select b.*, p.name as place_name, p.city, f.name as field_name
  from public.bookings b
  join public.places p on p.id = b.place_id
  join public.fields f on f.id = b.field_id;

-- ───────────────────────────────────────────────────────────────────────────
-- 9) عروض لوحة المالك العام (الأدمن) — الحساب في القاعدة لا في المتصفّح
-- ───────────────────────────────────────────────────────────────────────────
create view public.admin_daily with (security_invoker = on) as
  select booking_date,
         count(*)                                            as bookings,
         count(*) filter (where status = 'confirmed')         as confirmed,
         count(*) filter (where status in ('cancelled','rejected')) as lost,
         coalesce(sum(price) filter (where status = 'confirmed'), 0)        as revenue,
         round(coalesce(sum(price) filter (where status = 'confirmed'), 0) * 0.10, 2) as commission
  from public.bookings group by booking_date order by booking_date desc;

create view public.admin_places with (security_invoker = on) as
  select p.id, p.name, p.city, p.active,
         count(b.id)                                    as bookings,
         count(b.id) filter (where b.status='confirmed') as confirmed,
         coalesce(sum(b.price) filter (where b.status='confirmed'), 0) as revenue,
         (select rating from public.place_stats s where s.place_id = p.id) as rating
  from public.places p left join public.bookings b on b.place_id = p.id
  group by p.id, p.name, p.city, p.active order by revenue desc;
