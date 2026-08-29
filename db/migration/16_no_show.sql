-- ═══════════════════════════════════════════════════════════════════════════
--  16 — التخلّف عن الحضور (no-show)
--
--  بندٌ في الاتفاقية بلا آليّة
--  ──────────────────────────
--  المادّة ٩ في اتفاقية الملاعب تقول حرفيًّا: «إذا لم يحضر المستخدم دون
--  إلغاء، يبقى الحجز **مكتملًا** وتستحقّ عليه العمولة». والمنتج — حتى هذا
--  الملفّ — لا يملك وسيلةً لتسجيل ذلك أصلًا: بندٌ موقَّعٌ بلا زرّ ينفّذه.
--  والأثر ليس ورقيًّا: الحجز الذي لم يحضر صاحبه يُقرأ اليوم `confirmed`
--  عاديًّا، فيدخل الإيراد ويدخل الإشغال ولا يعرف أحدٌ أن الملعب بقي فارغًا.
--
--  ما هو no-show بالضبط؟ **حجزٌ بيع ولم يُستهلَك.**
--  ───────────────────────────────────────────────
--  ولذلك هو **ليس** «ضائعًا» (الخانة بيعت والعمولة مستحقّة) و**ليس** إيرادًا
--  عاديًّا (الملعب بقي فارغًا وصاحبه قد لا يحصّل). حقيقةٌ ثالثة، ولها في
--  التقارير صفّها الخاصّ — لا تُجمَع في أيٍّ من الاثنين.
--
--  🔒 من يستطيع تسجيله؟ **مالك ذلك المكان أو الأدمن، وبعد انتهاء الخانة.**
--  ────────────────────────────────────────────────────────────────────
--  لا اللاعب (سيسجّله على نفسه؟)، ولا مالك مكانٍ آخر، ولا أحدٌ قبل أن يمرّ
--  الموعد أصلًا — «لم يحضر» عن مباراةٍ لم تبدأ بعدُ ادّعاءٌ لا ملاحظة.
--  وكلّ هذا **في القاعدة**: `bookings_update` تسمح للمالك بتحديث أي عمود
--  في صفوف مكانه (السياسة تحكم الصفوف لا الأعمدة)، فالحارس مُشغِّل.
--
--  ↩️ وقابلٌ للرجوع
--  ───────────────
--  المالك سيضغط خطأً — وعلامةٌ لا تُرفَع تجعله يتجنّب الزرّ كلّه فيموت
--  المقياس. الرفع والخفض يمرّان بنفس الحارس ويُسجَّلان في `audit_log`.
--
--  🚫 وما لا يفعله هذا الملفّ
--  ─────────────────────────
--  **لا يبني سمعةً للاعبين.** لا عدّاد على ملفّ لاعب، ولا رؤية للاعبٍ في
--  سجلّ لاعبٍ آخر، ولا سياسة قراءة تسمح بذلك. نظام السمعة قرارٌ منتَجيّ
--  كامل (تظلّم · تقادم · عتبة) وتنفيذه سيّئًا أسوأ من عدمه.
--  ولا يحصّل مالًا ولا يفرض غرامة: التحصيل بين المالك والّلاعب وفق سياسة
--  الملعب المعلَنة، والتطبيق يسجّل الواقعة فقط.
--
--  ⏱️ مدّة الخانة ساعتان — وهي الرقم نفسه الذي يستعمله التطبيق
--  (‏`isFinished` في `app/src/app.js`). لو تغيّرت هناك تُغيَّر هنا.
--
--  مستقلّ تمامًا: لا يعتمد على 15 ولا على 14 ولا على أيّ ترحيل معلَّق.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.bookings
  add column if not exists no_show    boolean not null default false,
  add column if not exists no_show_at timestamptz,
  add column if not exists no_show_by uuid references public.profiles(id) on delete set null;

-- التقارير تسأل «كم؟» و«لأي مكان؟» ⇒ فهرس جزئي على المعلَّمة وحدها.
create index if not exists bookings_no_show_idx
  on public.bookings(place_id, booking_date) where no_show;

-- ───────────────────────────────────────────────────────────────────────────
--  الحارس
--
--  ⚠️ ولماذا لا يُترك الفحص للتطبيق؟ لأن `bookings_update` تعطي المالك
--     تحديثًا كاملًا على صفوف مكانه، فأيّ أداة REST تكتب `no_show=true`
--     على حجزٍ لم يبدأ — أو على حجزٍ ملغى — بلا مرورٍ بأيّ شاشة.
--     والشرط الزمني بالذات لا يمكن أن يعيش في الواجهة: ساعة الجهاز يملكها
--     صاحبه.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_booking_no_show_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  slot_end timestamp;
begin
  if new.no_show is not distinct from old.no_show then
    -- لم تتغيّر العلامة ⇒ لا شأن لنا بهذا التحديث. لكنّ الطوابع تتبعها دائمًا:
    -- تحديثٌ آخر لا يجوز أن يمسح «من علّم ومتى».
    new.no_show_at := old.no_show_at;
    new.no_show_by := old.no_show_by;
    return new;
  end if;

  if not (public.is_admin() or public.owns_place(new.place_id)) then
    raise exception 'no_show_forbidden' using errcode = 'P0001';
  end if;

  if new.status <> 'confirmed' then
    raise exception 'no_show_not_confirmed' using errcode = 'P0001';
  end if;

  -- الخانة انتهت فعلًا — بتوقيت عمّان. (‏`current_date` هنا كانت ستسمح
  -- بالتعليم قبل ثلاث ساعات من انتهاء الخانة بين منتصف الليل والفجر.)
  slot_end := (new.booking_date::timestamp + make_interval(hours => new.hour)) + interval '2 hours';
  if (now() at time zone 'Asia/Amman')::timestamp < slot_end then
    raise exception 'no_show_too_early' using errcode = 'P0001';
  end if;

  -- الطوابع يكتبها الخادم لا العميل: قيمةٌ قادمة في الطلب تُتجاهَل.
  if new.no_show then
    new.no_show_at := now();
    new.no_show_by := auth.uid();
  else
    new.no_show_at := null;
    new.no_show_by := null;
  end if;

  return new;
end $$;

drop trigger if exists t_booking_no_show on public.bookings;
create trigger t_booking_no_show before update on public.bookings
  for each row execute function public.fn_booking_no_show_guard();

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① الأعمدة الثلاثة:
--      select column_name from information_schema.columns
--       where table_name='bookings' and column_name like 'no_show%';
--
-- ② بتوكن **مالك** على حجز مؤكّد **انتهى وقته** — المتوقّع 200:
--      PATCH /rest/v1/bookings?id=eq.<uuid>   {"no_show":true}
--
-- ③ نفس الطلب على حجز **لم يبدأ** — المتوقّع 400 "no_show_too_early".
-- ④ نفس الطلب بتوكن **لاعب** (على حجزه هو) — المتوقّع رفض:
--    إمّا 400 "no_show_forbidden" وإمّا صفّ فارغ (‏`with check` تردّه أوّلًا).
-- ⑤ الرجوع يعمل ويمسح الطوابع:
--      PATCH … {"no_show":false}  ثمّ
--      select no_show, no_show_at, no_show_by from public.bookings where id = '<uuid>';
--
-- ⑥ الطوابع لا تُزوَّر من العميل: أرسل {"no_show":true,"no_show_by":"<uuid آخر>"}
--    والمتوقّع أن يُكتب `auth.uid()` لا ما أُرسل.
