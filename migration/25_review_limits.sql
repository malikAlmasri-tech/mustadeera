-- ═══════════════════════════════════════════════════════════════════════════
--  25 — التقييمات: سقفُ طول، وحدُّ معدّل، ومفتاحٌ يشترط حجزًا سابقًا
--
--  لماذا هذا الجدول بالذات؟
--  ────────────────────────
--  قارِن ما تحرسه الجداول الثلاثة المفتوحة لـ`anon`:
--
--    | الجدول                | سقف طول | حدّ معدّل | تطهير خادم |
--    | `place_applications`  |    ✅   |    ✅     |     ✅      |
--    | `events`              |    ✅   |    ❌     |     ✅      |
--    | **`reviews`**         |  **❌** |  **❌**   |   **❌**    |
--
--  فالجدول الذي يستقبل بيانات مالكِ ملعبٍ حقيقي محروسٌ من ثلاث جهات، **والجدول
--  الذي يحدّد سمعة كل مكان مكشوف**: `reviews_insert` تفحص `rating between 1
--  and 5` ومكانًا نشطًا — لا أكثر. لا سقف على `comment` ولا على `author_name`،
--  ولا شيء يمنع ألف صفٍّ في الدقيقة.
--
--  🔴 والمقايضة المذكورة في تعليق الترحيل 04 صارت أغلى ممّا كانت. يومَ كُتبت،
--     كان `rating_seed` عمودًا في `places` يحمل تقييمًا مستوردًا، فالتقييمات
--     طبقةٌ فوق أساس. وبعد `06_drop_rating_seed.sql` صار `reviews` **المصدر
--     الوحيد** للنجوم في التطبيق وفي `/places` وفي `place_stats` ⇒ سكربتٌ من
--     عشرة أسطر يهدم تقييم كل مكان أو يرفعه.
--
--  🔑 وثلاث طبقات لا واحدة، لأن ثلاثة أشياء مختلفة تُحرَس:
--     ① **الطول** — قيدُ `check`: يمنع صفًّا بميغابايتٍ من النصّ يكسر كل قارئ.
--     ② **المعدّل** — مُشغِّل: يمنع التكرار الآلي.
--     ③ **الاستحقاق** — مفتاحٌ في `booking_rules` (مطفأ افتراضًا): «لا يقيّم
--        إلّا من لعب». وهو **قرار منتَج لا أمن**، فلا يُفرَض هنا بلا إذن:
--        تشغيله اليوم — والقاعدة فيها ستّة أماكن — قد يترك أغلبها بلا نجمة.
--        و«بلا نجمة» حالةٌ صادقة يعرضها التطبيق أصلًا (‏`hasRating`)، لكنّ
--        اختيارَها قرارُ صاحب المنصّة لا قرارُ ملفّ ترحيل.
--
--  ⚠️ ولماذا الحدّ في **مُشغِّل** لا في `with check`؟ نفس درس 19 حرفيًّا:
--     تعبيرُ السياسة يُنفَّذ بصلاحية المستخدم، و`reviews` **له سياسة قراءة
--     عامّة** — فالاستعلام الفرعي هنا *كان* سيرى الصفوف فعلًا (بخلاف 19)،
--     لكنّ الردّ يبقى «صفًّا فارغًا مع 200» بلا سببٍ يُقال. والمُشغِّل يرفع
--     رمزًا له اسم يترجمه التطبيق.
--
--  ⚠️ **بعد 15 و24**: يقرأ المفتاح من `booking_rules` بـ`setting_num` (‏15)،
--     ويقارن التاريخ بـ`amman_date()` (‏24، ونسختها نفسها في 17). ولا يُخفى
--     ذلك بحيلة: الاعتماد يُذكَر ولا يُلتَفّ عليه بـ`to_regclass` تجعل الحدّ
--     يمرّ صامتًا حين يغيب ما يحرسه.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
--  1) سقف الطول — قيدٌ في القاعدة، لأن الصفحة تُتجاوَز بـcurl
--
--  والقيم ليست عشوائية: `author_name` بنفس سقف `contact_name` في 19 (‏80)،
--  و`comment` بنفس سقف `notes` هناك (‏1000). تعليقٌ أطول من ألف محرف ليس
--  تقييمًا، وعرضُه في بطاقة يكسرها على أي حال.
--
--  ⚠️ والصفوف القائمة تُفحَص أوّلًا: قيدٌ يفشل عند الإضافة يُوقف الملفّ كلّه.
--     `not valid` تعني «احرس الجديد ولا تعِد فحص القديم» — ثمّ نتحقّق يدويًّا
--     بالاستعلام في الذيل ونُصادق عليه إن كان نظيفًا.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_len_chk') then
    alter table public.reviews add constraint reviews_len_chk
      check (length(coalesce(author_name, '')) <= 80
         and length(coalesce(comment, ''))     <= 1000
         and length(coalesce(phone, ''))       <= 20)
      not valid;
  end if;
end $$;

create index if not exists reviews_phone_time_idx on public.reviews(phone, created_at desc);
create index if not exists reviews_time_idx       on public.reviews(created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
--  2) الحدّ والتطهير
--
--  والرقم يُوحَّد بنفس منطق `sbPhone` في التطبيق قبل أن يُقاس عليه الحدّ —
--  وإلّا هرب منه صاحبُه بكتابة الرقم نفسه بصيغة أخرى (‏07… · +9627… · 009627…)،
--  وهو أرخص تحايل ممكن. (نفس ما يفعله `fn_pa_guard` في 19، حرفًا بحرف.)
--
--  🕒 والطابع يكتبه الخادم: `created_at` قادمةً في الطلب كانت تُخرج الصفَّ من
--     كل نافذة زمنية بتاريخٍ مخترَع.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  need_booking boolean;
  same_place   int;
  same_phone   int;
  all_1h       int;
  played       int;
begin
  new.created_at  := now();
  new.author_name := btrim(coalesce(new.author_name, ''));
  new.comment     := btrim(coalesce(new.comment, ''));

  new.phone := regexp_replace(coalesce(new.phone, ''), '\s', '', 'g');
  new.phone := regexp_replace(new.phone, '^\+', '');
  if left(new.phone, 5) = '00962' then new.phone := '962' || substr(new.phone, 6); end if;
  if left(new.phone, 2) = '07'    then new.phone := '962' || substr(new.phone, 2); end if;

  -- تقييمٌ بلا رقم لا يُحَدّ ولا يُتتبَّع — وهو ما يجعل كلّ ما تحته بلا معنى.
  -- والتطبيق يرسله دائمًا (نافذة التقييم تطلب الاسم والرقم).
  if length(new.phone) < 7 then
    raise exception 'rv_phone_required' using errcode = 'P0001';
  end if;

  -- ① رأيٌ واحد لكل رقم في كل مكان. تغييرُ الرأي مسموح — بعد يوم، لا بعد ثانية.
  select count(*) into same_place from public.reviews
   where phone = new.phone and place_id = new.place_id
     and created_at > now() - interval '24 hours';
  if same_place > 0 then
    raise exception 'rv_duplicate' using errcode = 'P0001';
  end if;

  -- ② والرقم الواحد لا يقيّم القاعدة كلّها في جلسة: ستّة أماكن اليوم، والحدّ
  --    خمسة — فمن يقيّم الجميع في ساعة ليس عميلًا.
  select count(*) into same_phone from public.reviews
   where phone = new.phone and created_at > now() - interval '24 hours';
  if same_phone >= 5 then
    raise exception 'rv_rate_phone' using errcode = 'P0001';
  end if;

  -- ③ سقفٌ عامّ يمنع الإغراق من أرقام مولَّدة. رقمٌ كبير عمدًا: لا يمسّ
  --    استعمالًا حقيقيًّا بأي حال، ويقطع السكربت.
  select count(*) into all_1h from public.reviews
   where created_at > now() - interval '1 hour';
  if all_1h >= 60 then
    raise exception 'rv_rate_global' using errcode = 'P0001';
  end if;

  -- ④ الاستحقاق — مطفأ افتراضًا (انظر رأس الملفّ). والمطابقة **بالرقم** لا
  --    بالحساب: التقييم مفتوح للضيف منذ 04، ومن حجز كضيف لا يملك `auth.uid()`
  --    أصلًا. `customer_phone` مُوحَّد بنفس الصيغة عند الحجز (`sbPhone`).
  need_booking := public.setting_num('reviews_require_booking', 0) >= 1;
  if need_booking then
    select count(*) into played from public.bookings
     where place_id = new.place_id
       and customer_phone = new.phone
       and status = 'confirmed'
       and booking_date <= public.amman_date();
    if played = 0 then
      raise exception 'rv_no_booking' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists t_reviews_guard on public.reviews;
create trigger t_reviews_guard before insert on public.reviews
  for each row execute function public.fn_reviews_guard();

-- المفتاح موجود دائمًا كي يظهر في `booking_rules` فيعرف المالك أنه يملكه.
-- ‏0 = مطفأ · 1 = مشتعل. ولا حاجة إلى ترحيل لتبديله.
insert into public.booking_rules(key, num_value, note) values
  ('reviews_require_booking', 0,
   '1 = لا يقيّم المكانَ إلّا رقمٌ له حجز مؤكّد سابق فيه. قرار منتَج: تشغيله قد يترك أماكن بلا نجوم — وهي حالة صادقة، لكنّها قرار صاحب المنصّة')
on conflict (key) do nothing;

-- ولا تُمنَح `update`/`delete` لأحد: التقييم يُكتب مرّة، ولا يُعدَّل ولا يُمحى
-- إلّا من محرّر SQL. سياسة تحرير كانت ستجعل «راجعتُ رأيي» بابًا لتزوير التاريخ.
revoke update, delete on public.reviews from anon, authenticated;

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① الصفوف القائمة نظيفة؟ (المتوقّع صفر) — ثمّ صادِق القيد:
--      select count(*) from public.reviews
--       where length(coalesce(author_name,'')) > 80
--          or length(coalesce(comment,''))     > 1000;
--      alter table public.reviews validate constraint reviews_len_chk;
--
-- ② تعليقٌ بألفَي محرف يُردّ بـ400 (‏`reviews_len_chk`) — بالمفتاح العام:
--      POST /rest/v1/reviews {"place_id":"…","rating":5,"comment":"<2000 محرف>","phone":"0790000000"}
--
-- ③ تقييمان لنفس الرقم على نفس المكان: الأوّل 201، والثاني 400 `rv_duplicate`.
--
-- ④ والصيغة الأخرى للرقم نفسه لا تهرب من الحدّ — `+962790000000` بعد
--    `0790000000` المتوقّع `rv_duplicate` كذلك، لا 201.
--
-- ⑤ بلا رقم ⇒ `rv_phone_required`:
--      POST /rest/v1/reviews {"place_id":"…","rating":5}
--
-- ⑥ والقراءة العامّة ما زالت كما هي (‏07 لم يُمَسّ) — المتوقّع 200 للأعمدة
--    العامّة و401 لـ`phone`:
--      GET /rest/v1/reviews?select=id,place_id,author_name,rating,comment
--      GET /rest/v1/reviews?select=phone
--
-- ⑦ تشغيل الاستحقاق (وإطفاؤه) بلا ترحيل، من محرّر SQL أو بتوكن أدمن:
--      update public.booking_rules set num_value = 1 where key = 'reviews_require_booking';
--    ثمّ تقييمٌ برقمٍ بلا حجز مؤكّد ⇒ 400 `rv_no_booking`.
