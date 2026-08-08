-- ═══════════════════════════════════════════════════════════════════════════
--  18 — التسعير بالساعة والموسم: قاعدةٌ تعلو على السعر الأساسي
--
--  اللوحة كانت تنصح ولا تُمكِّن
--  ──────────────────────────
--  «أكثر وقت طلب — مفيد للتسعير» مكتوبةٌ في لوحة المالك منذ دفعات، وليس
--  عنده وسيلةٌ يفعل بها شيئًا: السعر عمودٌ واحد على `fields`. والواقع أن
--  الثامنة مساءً ليست الحادية عشرة صباحًا، وأن الشتاء ليس الصيف.
--
--  🎯 والحلّ **قواعد** لا عمودٌ ثانٍ
--  ───────────────────────────────
--  `fields.price` يبقى كما هو: **السعر الأساسي**، وهو الرقم الذي يظهر في
--  الدليل وفي `/places` وفي بطاقة المكان — لأن الدليل يعرض «من كم يبدأ»
--  لا سعر ساعةٍ بعينها. والقواعد تعلو عليه عند خانةٍ بذاتها.
--
--  📍 والحسم في **مكان واحد**: دالّة في القاعدة
--  ──────────────────────────────────────────
--  لو كُتب منطق الأسبقية في `app.js` ثمّ في `admin.html` لانحرفا — وهذا
--  بالضبط ما حدث لـ`FIELD_SPECS` حتى لزمه حارسُ مرآة. هنا: التطبيق
--  واللوحة ينادِيان `field_price_grid()` ولا يحسب أيٌّ منهما شيئًا.
--
--  🔒 و`bookings.price` **لقطة** لا مرجع
--  ────────────────────────────────────
--  العمود موجود منذ 01 ومكتوبٌ عنده «لقطة السعر وقت الحجز». تغييرُ قاعدةٍ
--  اليوم لا يمسّ دينارًا واحدًا من حجزٍ مضى — وهذا شرطٌ لا تحسين: سعرٌ
--  يتغيّر بعد الاتفاق ليس تسعيرًا بل نقضٌ له.
--
--  ⚖️ الأسبقية: `priority` تنازليًّا، ثمّ الأحدث إنشاءً
--  ──────────────────────────────────────────────────
--  اخترتُ رقمًا صريحًا لا «الأكثر تحديدًا يفوز»: الثاني يبدو ذكيًّا حتى
--  يتساوى نطاقان في التحديد، فيصير الفائز مصادفةً لا قرارًا — ولا يستطيع
--  المالك أن يشرح لنفسه لماذا خرج هذا السعر. الرقم يُقرأ ويُغيَّر.
--
--  مستقلّ تمامًا: لا يعتمد على أيّ ترحيل معلَّق.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.field_price_rules (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  field_id   uuid not null references public.fields(id) on delete cascade,
  -- كل مُرشِّح فارغ = «لا يقيّد». قاعدةٌ بكل المُرشِّحات فارغة تسري دائمًا.
  weekdays   smallint[],            -- 0=الأحد … 6=السبت (نفس ترقيم extract(dow) وJS)
  from_hour  smallint check (from_hour between 0 and 24),
  to_hour    smallint check (to_hour   between 0 and 24),
  date_from  date,
  date_to    date,
  price      numeric(10,2) not null check (price >= 0),
  priority   smallint not null default 0,
  active     boolean not null default true,
  label      text not null default ''
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fpr_hours_chk') then
    alter table public.field_price_rules add constraint fpr_hours_chk
      check ( (from_hour is null and to_hour is null)
              or (from_hour is not null and to_hour is not null and to_hour > from_hour) );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fpr_dates_chk') then
    alter table public.field_price_rules add constraint fpr_dates_chk
      check (date_from is null or date_to is null or date_to >= date_from);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fpr_weekdays_chk') then
    alter table public.field_price_rules add constraint fpr_weekdays_chk
      -- قائمة أيام فارغة تعني «لا يوم» ⇒ قاعدة لا تسري أبدًا: خطأٌ صامت
      -- يقضي ساعةً في تفسيره. `null` هو ما يعني «كل الأيام».
      check (weekdays is null or (array_length(weekdays,1) > 0
             and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]));
  end if;
end $$;

create index if not exists fpr_field_idx on public.field_price_rules(field_id) where active;

-- ───────────────────────────────────────────────────────────────────────────
--  RLS — القراءة عامّة (السعر ليس سرًّا) والكتابة لمالك المكان أو الأدمن
-- ───────────────────────────────────────────────────────────────────────────
alter table public.field_price_rules enable row level security;

drop policy if exists fpr_read  on public.field_price_rules;
drop policy if exists fpr_write on public.field_price_rules;

create policy fpr_read on public.field_price_rules for select using (true);
create policy fpr_write on public.field_price_rules for all
  using (
    public.is_admin()
    or exists (select 1 from public.fields f
                where f.id = field_id and public.owns_place(f.place_id))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.fields f
                where f.id = field_id and public.owns_place(f.place_id))
  );

grant select on public.field_price_rules to anon, authenticated;
grant insert, update, delete on public.field_price_rules to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  الحسم — مصدر الحقيقة الوحيد لسعر خانة بعينها
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_field_price(
  p_field uuid, p_date date, p_hour smallint
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.price
       from public.field_price_rules r
      where r.field_id = p_field
        and r.active
        and (r.weekdays  is null or extract(dow from p_date)::smallint = any(r.weekdays))
        and (r.from_hour is null or (p_hour < r.to_hour and p_hour + 2 > r.from_hour))
        and (r.date_from is null or p_date >= r.date_from)
        and (r.date_to   is null or p_date <= r.date_to)
      order by r.priority desc, r.created_at desc
      limit 1),
    (select f.price from public.fields f where f.id = p_field),
    0
  )
$$;

/*  الشبكة — نداءٌ واحد لكل ما تعرضه شاشة الحجز.
    نداء `resolve_field_price` لكل زرّ يعني 7 أيام × 8 خانات × عدد الملاعب
    من الرحلات؛ وهذه تُرجع الشبكة كلّها مرّةً واحدة.
    ⚠️ ولا تُرجع إلّا الخانات التي **تختلف** عن السعر الأساسي: الشبكة الكاملة
       تُرسل مئات الصفوف أغلبها يكرّر رقمًا يعرفه التطبيق أصلًا من `fields.price`.
       الغياب هنا معناه محدَّد: «السعر الأساسي». */
create or replace function public.place_price_grid(
  p_place uuid, p_from date, p_days int default 7
) returns table (field_id uuid, d date, hour smallint, price numeric)
language sql stable security definer set search_path = public as $$
  -- generate_series على أعداد صحيحة لا على تواريخ: الصيغة الزمنية تُرجع
  -- `timestamp` فيلزم قصّه، وهذه تُرجع `date` مباشرةً (‏date + int = date).
  with cells as (
    select f.id as fid, f.price as base, (p_from + g.n) as dd, (e->>'h')::smallint as hh
      from public.fields f
      cross join generate_series(0, greatest(least(p_days, 31), 1) - 1) as g(n)
      cross join lateral jsonb_array_elements(f.slots) as e
     where f.place_id = p_place and f.active
  )
  select fid, dd, hh, p
    from (select fid, dd, hh, base, public.resolve_field_price(fid, dd, hh) as p from cells) x
   where p is distinct from base
$$;

grant execute on function public.resolve_field_price(uuid, date, smallint) to anon, authenticated;
grant execute on function public.place_price_grid(uuid, date, int)         to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  سلطة السعر: الخادم يكتبه، لا العميل
--
--  ⚠️ من غير هذا القسم يكون كلّ ما سبق **زينة**. `bookings_insert_player`
--     تسمح للاعب بإدراج صفّه، والسياسة تحكم الصفوف لا الأعمدة ⇒ عميلٌ معدَّل
--     يُدرِج حجزًا بـ`price: 0` اليوم، ونظامُ التسعير لا يمنعه. «الحسم في مكان
--     واحد» لا تصحّ ما دام العميل يستطيع تجاوز ذلك المكان.
--
--  🔓 والمالك والأدمن مستثنيان عمدًا: الحجز اليدوي سعرُه متّفَقٌ عليه خارج
--     التطبيق (اشتراك · صفقة · نصف ساعة)، وفرضُ الجدول عليه يجعل الرقم كذبًا.
--
--  🕒 والتحديث لا يُعاد تسعيره: `bookings.price` **لقطة**، ونقلُ الموعد
--     (ترحيل 09) لا يغيّرها — وهذا مقصود، فالسعر جزء من الاتفاق المنعقد.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_booking_price_authority()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or public.owns_place(new.place_id) then
    return new;
  end if;
  new.price := public.resolve_field_price(new.field_id, new.booking_date, new.hour);
  return new;
end $$;

drop trigger if exists t_booking_price on public.bookings;
create trigger t_booking_price before insert on public.bookings
  for each row execute function public.fn_booking_price_authority();

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① السعر الأساسي يعود حين لا قاعدة (استبدل المعرّف والتاريخ):
--      select public.resolve_field_price('<field>', current_date, 20::smallint);
--    المتوقّع = `fields.price` نفسه.
--
-- ② قاعدة الخميس مساءً (‏4 = الخميس في ترقيم dow):
--      insert into public.field_price_rules(field_id, weekdays, from_hour, to_hour, price, priority, label)
--      values ('<field>', array[4]::smallint[], 20, 22, 55, 10, 'ذروة الخميس');
--    ثمّ استعلم عن خميسٍ قادم عند الساعة 20 ⇒ 55، وعند 16 ⇒ السعر الأساسي.
--
-- ③ الشبكة تُرجع المختلف وحده:
--      select * from public.place_price_grid('<place>', current_date, 7);
--    المتوقّع صفوف الخميس 20 فقط، لا 7×8 صفًّا.
--
-- ④ القراءة عامّة والكتابة ليست كذلك (بالمفتاح العام بلا تسجيل دخول):
--      GET  /rest/v1/field_price_rules?select=*        ⇒ 200
--      POST /rest/v1/field_price_rules {...}           ⇒ 401/403
--
-- ⑤ حجزٌ قائم لا يتغيّر سعره بعد إضافة القاعدة:
--      select price from public.bookings where id = '<حجز على تلك الخانة>';
--    المتوقّع الرقم القديم كما هو — `bookings.price` لقطة لا مرجع.
--
-- ⑥ **سلطة السعر**: بتوكن لاعب، أدرِج حجزًا على خانةٍ لها قاعدة 55 وأرسل
--    `"price": 0` — المتوقّع أن يعود الصفّ بـ`price: 55` لا 0:
--      POST /rest/v1/bookings   (‏Prefer: return=representation)
--    وبتوكن **مالك** على مكانه، `price: 0` يمرّ كما هو (الحجز اليدوي متّفَق عليه).
