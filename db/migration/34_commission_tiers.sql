-- ═══════════════════════════════════════════════════════════════════════════
--  ٣٤) العمولة المتدرّجة — نسبتان وسقفٌ شهريّ لكلّ ملعبٍ فرعيّ
--  قرار المالك 2026-08-31، ونُفِّذ 2026-09-03.
--  آمنٌ لإعادة التشغيل.
--
--  النموذج:
--    • حجز ١–٣٠ في الشهر لكلّ ملعبٍ فرعيّ  ⇒  ١٠٪
--    • حجز ٣١ فأكثر                        ⇒  ٤٪
--    • سقفٌ صلب                            ⇒  ١٦٠ د.أ/شهر/ملعب فرعيّ
--    • أوّل شهرٍ ميلاديّ للملعب             ⇒  مجّانيّ بالكامل
--
--  🔴 القرار المعماري الذي يحكم الملفّ كلَّه: **العمولة تُحسَب لكلّ حجزٍ على
--     حدة**، لا لكلّ شهر. والسبب أنّ النموذج تراكميّ شهريًّا (شريحتان وسقف)،
--     ولو حُسب على مستوى الشهر وحده لاستحال أن يبقى `admin_daily` صادقًا —
--     يومٌ واحد لا يعرف موضعه من شهره. وبحساب الحجزة الواحدة يصير **كلّ**
--     تجميع (يوميّ · شهريّ · لكلّ مكان · لكلّ ملعب) مجموعَ عمودٍ واحد، فلا
--     رقمان لنفس الحقيقة ولا صيغة أسبقية مكرَّرة. وهو نفس مبدأ `resolve_field_price`
--     في الترحيل ١٨: **الحسم في موضعٍ واحد ينادِيه الجميع.**
--
--  ⚠️ الشيت يقرّب بمتوسّط سعر (‏`MIN(n,n1)·p·r1 + MAX(0,n−n1)·p·r2`)، وهذا
--     الملفّ **يحسب بسعر كلّ حجزةٍ على حدة** — الحجوزات ليست بسعرٍ واحد.
--     فالرقم هنا أدقّ من الشيت لا مخالفٌ له، والفرق يظهر حيث تتفاوت الأسعار.
--
--  ⚠️ **ماذا يُعَدّ حجزًا؟** المؤكّد (`confirmed`) وغير اليدوي
--     (`source <> 'owner_manual'`) وحده. الأوّل لأنّ العمولة تُستحقّ على ما
--     وقع (‏و«لم يحضر» يبقى مؤكّدًا — المادّة ٩)، والثاني لأنّ حجز المالك
--     بيده ليس بيعًا جاءه منّا. **وهذا يصحّح عطلًا قائمًا**: التطبيق كان
--     يستثني اليدويّ من العمولة (`app.4-owner.js`) و`admin_daily` كان يحسبه
--     ⇒ رقمان مختلفان لنفس الشهر بلا خطأٍ يصرخ.
--
--  ⚠️ **الترتيب داخل الشهر** زمنيّ (`booking_date, hour, created_at, id`) —
--     ولا بدّ منه: «أوّل ثلاثين حجزة» تحتاج تعريفًا حاسمًا، و`id` آخرَ فاصلٍ
--     كي لا يتغيّر الناتج بين استعلامين على نفس البيانات.
--
--  ⚠️ **الشهر المجّانيّ يُشتقّ من البيانات** — `fields` لا تحمل عمود انضمام،
--     فأوّل شهرٍ فيه حجزٌ محتسَبٌ لذلك الملعب هو شهرُه الأوّل. وأثرُه رجعيّ:
--     تقاريرُ الأشهر القديمة تُظهر أوّل شهرٍ لكلّ ملعبٍ بصفر عمولة. وهذا
--     مقصودٌ ومعلَن (النموذج «يُطبَّق على كلّ الملاعب — لا grandfathering»)،
--     ومن أرادَ إلغاءه: `commission_free_months = 0`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1) الشروط الخمسة — في `booking_rules` لا في الكود
--    ⇒ تعديلُ نسبةٍ أو سقفٍ لا يحتاج نشرَ نسخةٍ من التطبيق ولا بناءَ الموقع.
-- ───────────────────────────────────────────────────────────────────────────
insert into public.booking_rules(key, num_value, note) values
  ('commission_rate_tier1', 0.10,
   'نسبة الشريحة الأولى. تطابق CONFIG.COMMISSION_TIER1_RATE في app/src/app.js و RATE_TIER1 في site/admin.html'),
  ('commission_tier1_bookings', 30,
   'عدد حجوزات الشريحة الأولى لكلّ ملعبٍ فرعيّ في الشهر الميلادي. العدّاد يصفّر أوّل كلّ شهر'),
  ('commission_rate_tier2', 0.04,
   'نسبة ما بعد الشريحة الأولى — من الحجزة ٣١ فصاعدًا في الشهر نفسه'),
  ('commission_cap_monthly', 160,
   'أقصى عمولة شهرية لكلّ ملعبٍ فرعيّ بالدينار. صفر = بلا سقف'),
  ('commission_free_months', 1,
   'عدد الأشهر الميلادية المجّانية عند انضمام الملعب. صفر = لا شهر مجّانيّ')
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) قارئ الشروط — قيمةٌ من الجدول، وإلّا الافتراضُ المكتوب هنا
--    ⚠️ `stable` لا `immutable`: يقرأ جدولًا، والوسم الخاطئ يجعل المخطِّط
--       يخبّئ القيمة عبر الاستعلامات فلا يرى تعديلَ المالك.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.commission_rule(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select num_value from public.booking_rules where key = p_key), p_default)
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) العرض الجذر — عمولة كلّ حجزةٍ على حدة
--    ومنه وحده تُشتقّ كلّ الأرقام الأخرى في هذا الملفّ.
--    🔒 محصورٌ بالمالك والأدمن **داخل العرض**: `security_invoker` وحده يترك
--       اللاعب يقرأ عمولة حجزه هو (‏`bookings_read` تسمح له بصفّه)، وبنية
--       تسعيرنا ليست من شأنه. نفس حصر `place_slot_demand` في الترحيل ٣٢.
-- ───────────────────────────────────────────────────────────────────────────
drop view if exists public.admin_month_commission cascade;
drop view if exists public.place_month_commission cascade;
drop view if exists public.field_month_commission cascade;
drop view if exists public.booking_commission cascade;

create view public.booking_commission with (security_invoker = on) as
with p as (
  select public.commission_rule('commission_rate_tier1',     0.10) as r1,
         public.commission_rule('commission_tier1_bookings',  30)  as n1,
         public.commission_rule('commission_rate_tier2',      0.04) as r2,
         public.commission_rule('commission_cap_monthly',     160)  as cap,
         public.commission_rule('commission_free_months',       1)  as free_months
),
billable as (
  select b.id, b.field_id, f.place_id, b.booking_date, b.price,
         date_trunc('month', b.booking_date)::date as month,
         row_number() over (
           partition by b.field_id, date_trunc('month', b.booking_date)
           order by b.booking_date, b.hour, b.created_at, b.id
         ) as rn
  from public.bookings b
  join public.fields f on f.id = b.field_id
  where b.status = 'confirmed'
    and coalesce(b.source, '') <> 'owner_manual'
    and (public.is_admin() or public.owns_place(f.place_id))
),
rated as (
  select bl.*, p.cap, p.free_months,
         bl.price * (case when bl.rn <= p.n1 then p.r1 else p.r2 end) as raw_amount
  from billable bl cross join p
),
running as (
  select r.*,
         -- مجموع ما قبل هذه الحجزة في نفس (الملعب × الشهر) — به يُقصّ السقف
         coalesce(sum(r.raw_amount) over (
           partition by r.field_id, r.month order by r.rn
           rows between unbounded preceding and 1 preceding
         ), 0) as before_amount,
         min(r.month) over (partition by r.field_id) as first_month
  from rated r
)
select id           as booking_id,
       field_id,
       place_id,
       booking_date,
       month,
       price,
       rn           as month_rank,
       round(
         case
           -- ① شهر الانضمام: مجّانيّ بالكامل
           when free_months > 0
                and month < (first_month + (free_months || ' month')::interval)::date
             then 0
           -- ② السقف الشهري: ما بقي منه لهذه الحجزة، ولا سالب
           when cap > 0
             then greatest(0, least(raw_amount, cap - before_amount))
           -- ③ بلا سقف
           else raw_amount
         end, 2) as commission
from running;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) التجميعات — كلُّها مجموعُ العمود الواحد أعلاه، فلا صيغة ثانية تنحرف
-- ───────────────────────────────────────────────────────────────────────────
create view public.field_month_commission with (security_invoker = on) as
  select field_id, place_id, month,
         count(*)                    as bookings,
         round(sum(price), 2)        as gross,
         round(sum(commission), 2)   as commission
  from public.booking_commission
  group by field_id, place_id, month;

create view public.place_month_commission with (security_invoker = on) as
  select place_id, month,
         count(distinct field_id)    as sub_fields,
         count(*)                    as bookings,
         round(sum(price), 2)        as gross,
         round(sum(commission), 2)   as commission
  from public.booking_commission
  group by place_id, month;

create view public.admin_month_commission with (security_invoker = on) as
  select month,
         count(distinct place_id)    as places,
         count(distinct field_id)    as sub_fields,
         count(*)                    as bookings,
         round(sum(price), 2)        as gross,
         round(sum(commission), 2)   as commission
  from public.booking_commission
  group by month;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) `admin_daily` يُعاد بناؤه على العمود نفسه
--    ⚠️ نفس أسماء الأعمدة وترتيبها وأنواعها — `create or replace view` يرفض
--       غيرها، ولوحة `/admin` تقرأ `commission` منه في جدول الأشهر.
--    ⚠️ والفرق الحقيقي: كان `revenue * 0.10` على **كلّ** مؤكَّد بما فيه حجز
--       المالك اليدويّ. صار مجموعَ عمولةٍ حقيقية، متدرّجةً ومسقوفةً وبلا يدويّ.
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.admin_daily with (security_invoker = on) as
with com as (
  select booking_date, sum(commission) as commission
  from public.booking_commission group by booking_date
)
select b.booking_date,
       count(*)                                                       as bookings,
       count(*) filter (where b.status = 'confirmed')                 as confirmed,
       count(*) filter (where b.status in ('cancelled','rejected'))   as lost,
       coalesce(sum(b.price) filter (where b.status = 'confirmed'), 0) as revenue,
       round(coalesce(max(c.commission), 0), 2)                       as commission
from public.bookings b
left join com c on c.booking_date = b.booking_date
group by b.booking_date
order by b.booking_date desc;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) المنح — المنحُ يفتح الباب وRLS تقول من يعبره، ويلزمان معًا
--    ولا `anon`: هذه أرقام أعمالٍ لا بيانات تصفّح.
-- ───────────────────────────────────────────────────────────────────────────
grant select on public.booking_commission     to authenticated;
grant select on public.field_month_commission to authenticated;
grant select on public.place_month_commission to authenticated;
grant select on public.admin_month_commission to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 7) فحصٌ سريع بعد التشغيل (اختياري — الصقه وحده)
-- ───────────────────────────────────────────────────────────────────────────
-- select * from public.booking_rules where key like 'commission%' order by key;
-- select * from public.admin_month_commission order by month desc limit 6;
-- -- النسبة الفعلية: تنزل عن ١٠٪ كلّما اقترب ملعبٌ من سقفه
-- select month, gross, commission, round(commission / nullif(gross,0) * 100, 2) as pct
--   from public.admin_month_commission order by month desc limit 6;
