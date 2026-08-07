-- ═══════════════════════════════════════════════════════════════════════════
--  13 — الرياضة على الملعب، ومواصفاته الخاصّة بها
--
--  ما الذي يفعله هذا الملفّ فعلًا؟
--  ─────────────────────────────
--  يفتح المنتج على رياضاته الخمس **في البيانات** لا في النصّ وحده. حتى الآن
--  كان التطبيق يعرض خمس رياضات ويكتب «قريبًا» على أربع منها بقيمة مكتوبة في
--  الكود (`SPORTS[].ready`)، ولا سبيل لتسجيل ملعب بادل أصلًا: لا عمود يقول
--  «هذا الملعب بادل». بعد هذا الترحيل تُسجَّل الرياضة على الملعب، و**التطبيق
--  يشتقّ حالة كل رياضة من القاعدة**: رياضةٌ لها ملعبٌ نشط واحد تُفتَح للحجز،
--  وما لا ملعب له يبقى «قريبًا». فلا يعود أحد يكتب «متاح» بيده.
--
--  🔹 لماذا على `fields` لا على `places`؟
--  ─────────────────────────────────────
--  الوحدة القابلة للحجز هي **الملعب** لا المكان. ومجمّعٌ رياضي واحد قد يضمّ
--  ملعب كرة قدم وملعبَي بادل — لو كانت الرياضة على المكان لاستحال تسجيله
--  إلّا بتمزيقه إلى مكانين بنفس العنوان ونفس الهاتف. والمكان يُشتقّ منه:
--  «رياضات هذا المكان» = القيم المميّزة في ملاعبه.
--
--  🔹 `attrs` — المواصفات التي تختلف باختلاف الرياضة
--  ───────────────────────────────────────────────
--  لا يصحّ عمودٌ لكل مواصفة: «نوع الجدران» لا معنى له في كرة القدم، و«ارتفاع
--  الشبكة» لا معنى له في السلة. فهي `jsonb` بمفردات **مغلقة** تعرفها الواجهة:
--
--    مشتركة:   enclosure = outdoor|indoor|covered   ·  lights = yes|no
--              seating   = yes|no
--    football: surface   = grass_synthetic|grass_natural|rubber|sand
--    padel:    court     = double|single   ·  walls = glass|mesh|mixed
--              panoramic = yes|no          ·  rackets = free|paid|no
--    basket:   court     = full|half       ·  surface = parquet|pu|asphalt|rubber
--              hoop      = standard|adjustable
--    tennis:   surface   = hard|clay|grass|carpet  ·  court = single|double
--    volley:   surface   = indoor_court|beach_sand|grass
--              net       = men|women|mixed|youth
--
--  ⚠️ **القاعدة لا تفرض هذه المفردات، والواجهة تفرضها بطريقتها:** التطبيق
--  **لا يعرض مفتاحًا ولا قيمةً لا يملك لها ترجمة في اللغتين**. وهذا مقصود
--  ومقيس: عمود المرافق النصّي الحرّ أنتج قيمًا («بأجرة» · «حتى 20 سيارة»)
--  تُعرَض بالعربية وحدها لمستخدم الإنجليزية. فما لا يُترجَم لا يُعرَض،
--  ولا يُخترَع له نصّ (م5). ولوحة `/admin` تُدخِلها **قوائم مغلقة** أصلًا.
--
--  🔹 `size` يبقى محايد اللغة
--  ─────────────────────────
--  العمود `fields.size` كان أحجام كرة القدم (5×5 … 11×11) وصار يحمل أبعاد كل
--  رياضة بالأرقام (بادل 20×10 · سلة 28×15 · تنس 23.8×11 · طائرة 18×9). أرقامٌ
--  لا كلمات، لأن التطبيق يعرضه **حرفيًّا** ويبني منه شرائح التصفية: «مزدوج»
--  كانت ستُقرأ عربيةً في الواجهة الإنجليزية. أمّا المعنى (مزدوج/فردي ·
--  كامل/نصف) فمحلّه `attrs.court` وله ترجمة في اللغتين.
--
--  ⚠️ التطبيق يعمل بلا هذا الترحيل
--  ──────────────────────────────
--  الأعمدة لها قيم افتراضية (`sport='football'` · `attrs='{}'`)، والواجهة
--  تقرؤهما بـ`coalesce` محلّي: ملعبٌ بلا عمود `sport` يُقرأ كرة قدم، وبلا
--  `attrs` لا تُعرَض له مواصفات. فقبل تشغيله **يبقى كل شيء كما هو اليوم**،
--  وبعده وحده يستطيع الأدمن تسجيل ملعب بادل أو تنس.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.fields
  add column if not exists sport text  not null default 'football',
  add column if not exists attrs jsonb not null default '{}'::jsonb;

do $$
begin
  -- المفردات مغلقة على مستوى القاعدة: `SPORTS` في app.js هو مصدر الحقيقة،
  -- وهذه نسخته. رياضة سادسة تعني تعديل الاثنين معًا — وهذا مقصود: قيمةٌ
  -- تدخل القاعدة ولا تعرفها الواجهة تُعرَض «قريبًا» أبدًا وملعبها لا يُحجَز.
  if not exists (select 1 from pg_constraint where conname = 'fields_sport_chk') then
    alter table public.fields add constraint fields_sport_chk
      check (sport in ('football','padel','basket','tennis','volley'));
  end if;

  -- `attrs` كائن لا مصفوفة ولا رقم — الواجهة تقرأ منه بالمفتاح.
  if not exists (select 1 from pg_constraint where conname = 'fields_attrs_obj_chk') then
    alter table public.fields add constraint fields_attrs_obj_chk
      check (jsonb_typeof(attrs) = 'object');
  end if;
end $$;

create index if not exists fields_sport_idx on public.fields(sport) where active;

-- ───────────────────────────────────────────────────────────────────────────
-- عرضٌ واحد يجيب سؤال «أيّ رياضة مفتوحة فعلًا؟»
--
-- يقرؤه **الوجهان**: التطبيق ليشتقّ `ready` لكل رياضة، وبناء الموقع ليكتب
-- «متاح للحجز» / «قريبًا» في قسم الرياضات. مصدرٌ واحد ⇒ يستحيل أن يَعِد
-- الموقع بما لا يعطيه التطبيق (قرار ٧).
--
-- الشرط `p.active and f.active` هو نفسه شرط `sbGetInitialData` حرفيًّا:
-- ملعبٌ موقوف أو في مكان موقوف لا يراه أحد، فلا يفتح رياضةً على لا شيء.
-- ⚠️ ولا يُحسَب المكان الذي لا يملك ملعبًا — الانضمام نفسه يُسقطه، وهو
-- نفس ما يفعله التطبيق (`filter(p => p.fields.length > 0)`).
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.sport_availability as
  select f.sport,
         count(*)                     as fields,
         count(distinct f.place_id)   as places,
         min(f.price)                 as min_price,
         max(f.price)                 as max_price
  from public.fields f
  join public.places p on p.id = f.place_id
  where f.active and p.active
  group by f.sport;

grant select on public.sport_availability to anon, authenticated;
