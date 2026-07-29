-- ═══════════════════════════════════════════════════════════════════════════
--  إصلاح حرج: **كل المستخدمين المستورَدين لا يستطيعون تسجيل الدخول**
--  يُشغَّل مرّة واحدة: SQL Editor ← امسح النافذة ← الصق هذا كاملًا ← Run
--  آمن التكرار: كل جملة فيه idempotent (تشغيله مرّتين لا يضرّ ولا يفشل).
--
--  ─── التشخيص (مقيس حيًّا لا مُخمَّن) ────────────────────────────────────
--  حساب أنشأته الواجهة عبر الـAPI  ⇒ الدخول ينجح.
--  حساب أدخله الاستيراد بـSQL      ⇒ الدخول يفشل بـHTTP 500
--                                    «Database error querying schema»
--                                    **بكلمة السرّ الصحيحة والخاطئة معًا** ⇒
--                                    العطل يقع **قبل** مقارنة كلمة السرّ.
--
--  السبب: خدمة المصادقة مكتوبة بـGo وتقرأ ثمانية أعمدة توكن في `auth.users`
--  داخل حقول نصّية **لا تقبل NULL**. الاستيراد لم يذكر هذه الأعمدة فبقيت NULL
--  (لا قيمة افتراضية لها) ⇒ تنهار قراءة الصفّ كلّه.
--
--  ⚠️ لهذا بدا العطل وكأنه «كلمة السرّ قصيرة» وهو ليس كذلك إطلاقًا:
--     طول كلمة السرّ لا علاقة له بالدخول — الحدّ الأدنى (6) يُطبَّق على
--     **إنشاء حساب جديد فقط**. كلمات السرّ من 3-4 أرقام ستعمل بعد هذا الإصلاح.
--
--  (والمولّد `build_import.mjs` أُصلح أيضًا كي لا يعود العطل عند أي استيراد قادم.)
-- ═══════════════════════════════════════════════════════════════════════════
begin;

-- ① الإصلاح الفعلي: NULL ⇒ '' في أعمدة التوكن الثمانية
update auth.users set
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, ''),
  reauthentication_token      = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0)
where confirmation_token is null or recovery_token is null
   or email_change is null or email_change_token_new is null
   or email_change_token_current is null or phone_change is null
   or phone_change_token is null or reauthentication_token is null
   or email_change_confirm_status is null;

-- ② حسابات يتيمة: مستخدم في auth بلا صفّ في profiles.
--    كيف تنشأ: تسجيل جرى **قبل** تعطيل «Confirm email» — الحساب أُنشئ لكن
--    الواجهة لم تنل جلسة فلم تستطع كتابة الملفّ. النتيجة حساب **موجود وغير
--    قابل للاستعمال**: إعادة التسجيل تقول «الرقم عنده حساب»، والدخول يفشل
--    لأن الواجهة لا تجد ملفًّا. هذه الجملة تُكمل الناقص.
insert into public.profiles (id, role, name, phone, active)
select u.id, 'player',
       coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), 'مستخدم'),
       coalesce(nullif(trim(u.raw_user_meta_data->>'phone'), ''), split_part(u.email, '@', 1)),
       true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict do nothing;

-- ③ السياستان — بصيغة لا تفشل عند إعادة التشغيل.
--    (خطأ 42710 «policy already exists» الذي ظهر لك سببه تشغيل 04 مرّتين:
--     الأولى نجحت فعلًا. مُتحقَّق حيًّا: إدراج ملفّ جديد يمرّ عبر RLS بنجاح.)
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert with check (
    rating between 1 and 5
    and exists (select 1 from public.places p where p.id = place_id and p.active)
  );

-- ④ تنظيف: حساب اختبار أنشأتُه أثناء التشخيص (الرقم 962790000001).
delete from auth.users where email = '962790000001@mustadeera.app';

commit;

-- ═══ تحقّق ذاتي — يجب أن تكون الثلاثة أصفارًا ═══
select
  (select count(*) from auth.users
     where confirmation_token is null or recovery_token is null
        or email_change is null or reauthentication_token is null)      as "أعمدة_NULL_متبقية",
  (select count(*) from auth.users u
     left join public.profiles p on p.id = u.id where p.id is null)     as "حسابات_بلا_ملف",
  (select count(*) from auth.users where email = '962790000001@mustadeera.app') as "حساب_الاختبار",
  (select count(*) from auth.users)                                     as "إجمالي_الحسابات",
  (select count(*) from public.profiles)                                as "إجمالي_الملفات";
