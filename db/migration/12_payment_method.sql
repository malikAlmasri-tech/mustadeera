-- ═══════════════════════════════════════════════════════════════════════════
--  12 — وسيلة الدفع على الحجز (تمهيد للبطاقة، والنقد هو العامل اليوم)
--
--  ما الذي يفعله هذا الملفّ فعلًا؟
--  ─────────────────────────────
--  يجعل مسار المال **مكتوبًا** بدل أن يكون مفهومًا ضمنًا. اليوم كل حجز يُدفع
--  نقدًا في الملعب، وهذه الحقيقة لم تكن مسجّلة في أي عمود — فلا اللوحة تستطيع
--  التفريق، ولا يستطيع أحد لاحقًا أن يعرف أيّ الحجوزات القديمة دُفعت بالبطاقة.
--
--  ⚠️ التطبيق لا يعتمد على هذا الملفّ إطلاقًا
--  ─────────────────────────────────────────
--  لا يرسل التطبيق `payment_method` في إنشاء الحجز — القيمة الافتراضية `'cash'`
--  تكفي. فلو لم يُشغَّل هذا الترحيل أبدًا، **الحجز يعمل كما هو**. وهذا مقصود:
--  ترحيلٌ معلَّق يجب ألّا يكسر البيع.
--
--  🔒 ولماذا مُشغِّل وليس قيد `check` فقط؟
--  ──────────────────────────────────────
--  سياسة `bookings_insert_player` تسمح للاعب بإدراج صفّه، والسياسة تحكم الصفوف
--  لا الأعمدة (نفس درس الترحيل 09). فقيدٌ مثل «البطاقة تستلزم مرجع دفع» يتجاوزه
--  اللاعب بكتابة مرجع مخترَع. المُشغِّل أدناه يفرض الحقيقة: **من ليس أدمن ولا
--  `service_role` لا يكتب حقول الدفع إطلاقًا** — تُفرَض `cash/unpaid` عند
--  الإدراج، وتبقى كما هي عند التحديث. من يؤكّد الدفع هو خطّاف البوّابة وحده.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bookings
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_ref    text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_payment_method_chk') then
    alter table public.bookings add constraint bookings_payment_method_chk
      check (payment_method in ('cash','card'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_payment_status_chk') then
    alter table public.bookings add constraint bookings_payment_status_chk
      check (payment_status in ('unpaid','paid','refunded'));
  end if;
  -- البطاقة بلا مرجع من البوّابة ليست دفعة، إنّما ادّعاء دفعة.
  if not exists (select 1 from pg_constraint where conname = 'bookings_card_needs_ref_chk') then
    alter table public.bookings add constraint bookings_card_needs_ref_chk
      check (payment_method <> 'card' or coalesce(payment_ref,'') <> '');
  end if;
end $$;

comment on column public.bookings.payment_method is
  'cash = نقدًا في الملعب (الوحيد العامل اليوم) · card = بطاقة عبر بوّابة دفع';
comment on column public.bookings.payment_ref is
  'مرجع العملية عند بوّابة الدفع. ⚠️ لا يُخزَّن هنا رقم بطاقة ولا CVV ولا تاريخ انتهاء — أبدًا. البطاقة تُدخَل عند البوّابة وحدها (PCI-DSS)، ولا يصلنا منها إلا هذا المرجع وآخر أربعة أرقام.';

-- ───────────────────────────────────────────────────────────────────────────
--  الحارس
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.tg_bookings_payment_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- البوّابة (service_role) والأدمن وحدهما يكتبان حقول الدفع
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.payment_method := 'cash';
    new.payment_status := 'unpaid';
    new.payment_ref    := null;
  else
    -- تحديثٌ من لاعب (إلغاء) أو مالك (تأكيد/رفض): حقول الدفع لا تتحرّك.
    -- ⚠️ إسنادُ القديم لا فرضُ 'cash': حجزٌ دُفع بالبطاقة ثمّ أُلغي يبقى مدفوعًا
    --    حتى تُسجَّل إعادته — وإلّا ضاع أثر المال عند أوّل إلغاء.
    new.payment_method := old.payment_method;
    new.payment_status := old.payment_status;
    new.payment_ref    := old.payment_ref;
  end if;
  return new;
end;
$$;

drop trigger if exists t_bookings_payment_guard on public.bookings;
create trigger t_bookings_payment_guard
  before insert or update on public.bookings
  for each row execute function public.tg_bookings_payment_guard();

-- ═══════════════════════════════════════════════════════════════════════════
--  🔴 ما يلزم قبل تشغيل «فيزا» في التطبيق (كلّه على المالك)
--
--  ① حساب تاجر عند بوّابة تعمل في الأردن (HyperPay · MEPS · Network International…).
--  ② صفحة دفع **مستضافة عندها** أو إطار توكنة منها. ولا يُكتب في تطبيقنا حقلُ
--     رقم بطاقة مهما بدا سهلًا: استقبال الرقم يُدخل المنصّة كلّها في نطاق
--     PCI-DSS، ويجعل أيّ تسريب تسريبَ بطاقات لا تسريبَ أسماء.
--  ③ خطّاف (webhook) يستقبل نتيجة العملية بمفتاح `service_role` ويكتب
--     `payment_status='paid'` و`payment_ref`. وهو المسار الوحيد الذي يمرّ من
--     حارس الأعلى.
--  ④ قرار تشغيلي لم يُتّخذ بعد: متى يُقبض المال؟ الحجز اليوم **طلبٌ ينتظر تأكيد
--     المالك**، فالسحب قبل التأكيد يعني ردَّ مبلغٍ عند كل رفض. الأرجح: حجزٌ
--     للمبلغ (authorization) عند الطلب، وقبضٌ (capture) عند التأكيد.
--
--  حتى ذلك الحين، التطبيق يعرض «فيزا» مُعطَّلة بشارة «قريبًا» ولا يعِد بها.
-- ═══════════════════════════════════════════════════════════════════════════
