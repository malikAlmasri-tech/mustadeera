-- ═══════════════════════════════════════════════════════════════════════════
--  28 — «عادةً يردّ خلال ن دقيقة»: قياسُ الانتظار الذي كان بلا رقم
--
--  العطل — وهو في المنتج لا في الواجهة
--  ───────────────────────────────────
--  الحجز **طلبٌ ينتظر ردًّا**، وهذا قرارٌ مكتوب في كل مكان من المشروع (م5:
--  لا «حجز فوري»). لكنّ اللاعب الذي يرسل طلبًا لمباراة الليلة لا يعرف إن كان
--  الجواب بعد دقيقتين أم بعد الغد. وعندنا لوح متابعة وعدّاد مهلة وإشعار —
--  وكلّها تقول **«ننتظر»**، ولا شيء يقول **كم**.
--
--  والرقم موجود في البيانات أصلًا: الزمن بين وصول الطلب وأوّل ردٍّ عليه.
--  فهو **قياسٌ لا اختراع** ⇒ يمرّ من م5 بلا تحفّظ — بشرط ألّا يُعرَض قبل
--  أن يوجد. ولذلك عتبة `n >= 7` مكتوبة **داخل العرض نفسه** لا في الواجهة:
--  ما لا يُقاس لا يخرج من القاعدة أصلًا، فلا يبقى على أحدٍ أن يتذكّر شرطًا.
--
--  🔴 والانقضاء التلقائي مستثنًى — وهو أهمّ سطرٍ في الملفّ
--  ────────────────────────────────────────────────────
--  `expire_stale_bookings()` (ترحيل 15) تكتب `rejected` + `cancel_kind='expired'`
--  على الطلبات التي **لم يردّ عليها أحد**. وهي ليست ردًّا: إدخالها يقلب
--  المقياس رأسًا على عقب — كلّما أهمل المالك أكثر امتلأ عمودُه بصفوفٍ زمنها
--  «24 ساعة بالضبط» فيبدو **منضبطًا**، والأسوأ أنّ المالك الذي يردّ على
--  النصف ويترك النصف يُقاس بنصفٍ واحد وينجو من الآخر.
--  الاستثناء في موضعين معًا: في المُشغِّل (فلا يُكتب الطابع أصلًا) وفي العرض
--  (فلا يدخل صفٌّ قديم كُتب قبل هذا الترحيل).
--
--  🔒 ولا شيء في العرض غير الرقم: `place_id` · `median_minutes` · `n`.
--     لا اسم، ولا هاتف، ولا معرّف حجز — والعرض عامّ للقراءة (‏`anon`)
--     لأنه يُعرَض للاعبٍ لم يسجّل بعد، فما ليس مكتوبًا فيه لا يخرج منه
--     مهما كان الاستعلام (نفس مبدأ `open_games` في 22).
--
--  ⚠️ ونافذة **90 يومًا**: ملعبٌ كان يردّ في خمس دقائق العام الماضي وصار
--     يهمل اليوم يبقى «سريعًا» إلى الأبد لو كان المتوسّط على كلّ التاريخ.
--     والوسيط لا المتوسّط: ردٌّ واحد متأخّر ثلاثة أيام يسحب المتوسّط وحده.
--
--  ⚠️ **بعد 15** (‏`cancel_kind`). آمن لإعادة التشغيل.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) العمود — يكتبه الخادم وحده
-- ───────────────────────────────────────────────────────────────────────────
alter table public.bookings add column if not exists replied_at timestamptz;

comment on column public.bookings.replied_at is
  'لحظة أوّل خروجٍ من pending بفعل إنسان. يكتبها المُشغِّل وحده — وقيمةٌ قادمة في الطلب تُتجاهَل. والانقضاء التلقائي (cancel_kind=expired) لا يكتبها: ليس ردًّا.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2) المُشغِّل — **أوّل** خروجٍ من pending، ومرّةً واحدة
--
--    ⚠️ `replied_at is null` شرطٌ لا زينة: المالك قد يؤكّد ثمّ يلغي، والثاني
--       ليس «ردًّا ثانيًا» — زمن الردّ هو زمن الجواب الأوّل الذي ينتظره اللاعب.
--    ⚠️ وإسنادٌ صامت للقديم لا خطأ يُرفَع: لا قرار للمستخدم هنا أصلًا، فلا
--       شيء يُقال له. (نفس تمييز 24 بين حارسٍ يرفع اسمًا وإسنادٍ صامت.)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_booking_replied_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- لا يكتبه العميل بحال: الجديد يبدأ دائمًا من القديم
  new.replied_at := old.replied_at;

  if old.status = 'pending'
     and new.status is distinct from 'pending'
     and coalesce(new.cancel_kind, '') <> 'expired'   -- 🔴 الانقضاء ليس ردًّا
     -- 🔴 ولا إلغاءُ اللاعب نفسه: من سحب طلبه لم يتلقَّ ردًّا، وعدُّه ردًّا
     --    يعطي المُهمِلَ رقمًا جميلًا كلّما يئس منه لاعبٌ وألغى.
     --    (‏`t_booking_cancel_fields` في 24 تُعيد الصفّ كلّه قديمًا في هذا
     --     المسار فتمحو الطابع على أي حال — والشرط هنا كي لا يعتمد صدقُ
     --     المقياس على حارسٍ كُتب لغرضٍ آخر.)
     and (auth.uid() is null or auth.uid() is distinct from old.player_id)
     and old.replied_at is null then
    new.replied_at := now();
  end if;

  return new;
end $$;

drop trigger if exists t_booking_replied_at on public.bookings;
-- ⚠️ الاسم يبدأ بـ`a_` عمدًا: مُشغِّلات `before` تُطلَق بترتيب **أسمائها**،
--    وهذا يجب أن يقرأ `new.status` قبل أن يعدّله حارسٌ آخر (مزلق مسجَّل في 24).
create trigger a_booking_replied_at
  before update on public.bookings
  for each row execute function public.fn_booking_replied_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 3) تعبئة رجعية — **اختيارية ومحروسة**
--    `audit_log` يحمل كل تغيير حالة منذ اليوم الأوّل، فالماضي قابل للقياس.
--    ومحروسة بـ`to_regclass` لأن قاعدةً اختبارية قد لا تحمله، وبـ`is null`
--    فلا تدهس ما كتبه المُشغِّل.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.audit_log') is not null then
    update public.bookings b
       set replied_at = f.at
      from (
        select a.entity_id,
               min(a.at) as at
          from public.audit_log a
         where a.entity = 'bookings'
           and a.action = 'update'
           and a.before->>'status' = 'pending'
           and coalesce(a.after->>'status','') <> 'pending'
           and coalesce(a.after->>'cancel_kind','') <> 'expired'
           -- ونفس استثناء المُشغِّل: من ألغى طلبه بنفسه لم يتلقَّ ردًّا
           and (a.actor_id is null or a.actor_id::text is distinct from a.before->>'player_id')
         group by a.entity_id
      ) f
     where b.id::text = f.entity_id
       and b.replied_at is null
       and b.status <> 'pending';
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) العرض العامّ — ثلاثة أعمدة، وعتبةٌ داخله
--
--    ⚠️ `security_invoker` **غير مطلوب هنا**: العرض لا يكشف صفوفًا، بل رقمًا
--       مجمَّعًا عن مكانٍ **معروضٍ للعامّة أصلًا**. ولو كان `invoker` لقرأ
--       اللاعبُ العادي من `bookings` عبر RLS ⇒ لا شيء (سياسته تحصره في
--       حجوزاته) فيرى كل مكانٍ «بلا بيانات». المطلوب عكس ذلك بالضبط.
-- ───────────────────────────────────────────────────────────────────────────
drop view if exists public.place_reply_speed;
create view public.place_reply_speed as
  select b.place_id,
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (b.replied_at - b.created_at)) / 60.0
           )::numeric, 0
         )::int as median_minutes,
         count(*)::int as n
    from public.bookings b
   where b.replied_at is not null
     and b.replied_at >= b.created_at                 -- حارس ضدّ صفٍّ معطوب
     and coalesce(b.cancel_kind, '') <> 'expired'     -- 🔴 والعرض يستثنيه كذلك
     and b.created_at >= now() - interval '90 days'   -- ما يصف الملعب **اليوم**
   group by b.place_id
  having count(*) >= 7;                               -- ما لا يُقاس لا يخرج

grant select on public.place_reply_speed to anon, authenticated;

commit;

-- ─── تحقّق بعد التشغيل (بالمفتاح العام، بلا تسجيل دخول) ────────────────────
-- ① العرض يقرأ ويعطي ثلاثة أعمدة لا أكثر (المتوقّع 200):
--      GET /rest/v1/place_reply_speed?select=place_id,median_minutes,n
--
-- ② ولا يحمل عمودًا يُعرِّف أحدًا — المتوقّع **400** في كلٍّ منها:
--      GET /rest/v1/place_reply_speed?select=customer_phone
--      GET /rest/v1/place_reply_speed?select=player_id
--      GET /rest/v1/place_reply_speed?select=*&order=customer_phone.desc
--
-- ③ والعتبة داخل العرض لا في الواجهة — كل صفٍّ يخرج عنده 7 فأكثر:
--      GET /rest/v1/place_reply_speed?select=place_id,n&n=lt.7      ⇒ []
--
-- ④ والمُشغِّل يكتب مرّةً واحدة (بتوكن مالك، على حجزٍ معلّق):
--      PATCH /rest/v1/bookings?id=eq.<uuid>  {"status":"confirmed"}
--      GET   /rest/v1/bookings?select=replied_at&id=eq.<uuid>   ⇒ ليس null
--      PATCH /rest/v1/bookings?id=eq.<uuid>  {"status":"cancelled"}
--      GET   /rest/v1/bookings?select=replied_at&id=eq.<uuid>   ⇒ **نفس القيمة**
--
-- ⑤ وقيمةٌ قادمة في الطلب تُتجاهَل:
--      PATCH /rest/v1/bookings?id=eq.<uuid>  {"replied_at":"2020-01-01T00:00:00Z"}
--      GET   /rest/v1/bookings?select=replied_at&id=eq.<uuid>   ⇒ لم تتغيّر
--
-- ⑥ والانقضاء لا يُحسَب ردًّا:
--      select public.expire_stale_bookings();
--      select count(*) from public.bookings
--       where cancel_kind = 'expired' and replied_at is not null;   ⇒ 0
