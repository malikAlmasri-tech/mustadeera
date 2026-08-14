-- ═══════════════════════════════════════════════════════════════════════════
--  31) إشعارات الدفع — رمز الجهاز، والجسر من القاعدة إلى FCM
--
--  🔴 **العطل الذي يُغلقه هذا الترحيل هو الحلقة المركزية في المنتج.**
--     الحجز **طلبٌ ينتظر ردًّا**، وصفُّ الإشعار يُكتب في القاعدة منذ ترحيل 14
--     داخل **معاملة الحجز نفسها** (‏`t_notify_bookings`) — أي أنّ الخبر موجود
--     في اللحظة الصحيحة. والناقص **قطعةٌ واحدة**: لا شيء يوصّله إلى هاتفٍ
--     مغلق. الموجود `LocalNotifications` وهي تُعرَض **والتطبيق مفتوح** وحده،
--     والتطبيق يستطلع كل ٦٠ ثانية **وهو مفتوح**.
--     فالمالك لا يعرف أنّ طلبًا وصل حتى يفتح التطبيق، واللاعب الذي ينتظر
--     يأخذ ملعبًا آخر بمكالمة. وميزةٌ كاملة معطَّلة بهذا وحده:
--     «نبّهني إذا فضيت» (ترحيل 20) وعدُها كلُّه «سنُشعرك».
--
--  ⚠️ **ولا يعمل هذا الملفّ وحده.** يحتاج ثلاثة أشياء من المالك:
--       ① مشروع Firebase، ومنه `google-services.json` ⇒ `android/app/`
--       ② مفتاح حساب خدمة (JSON) ⇒ سرّ Supabase باسم `FCM_SERVICE_ACCOUNT`
--       ③ نشر الدالّة:  supabase functions deploy push
--     وحتى تكتمل، **كلّ شيء يبقى عاملًا كما هو**: الصفوف تُكتب، والمركز
--     يعرضها، والإشعار المحلّي يظهر عند الفتح. الدفع إضافةٌ لا استبدال.
--
--  ⚠️ **ولا يُخزَّن نصّ الإشعار هنا** — نفس قاعدة 14 حرفيًّا: الصفّ يحمل
--     `kind` ومعطياته، والجملة تُكتب بلغة المستخدم **الحالية**. ونصٌّ مخزَّن
--     يُجمَّد على لغة لحظة كتابته. فالدالّة تبني الجملة وقت الإرسال.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ① رمز الجهاز ───────────────────────────────────────────────────────────
-- على `profiles` لا في جدولٍ مستقلّ: الرمز صفةٌ للحساب، والحساب واحد لكل
-- إنسان في هذا المنتج (الدور هو الفارق لا الجدول — قرارٌ مسجَّل في `/admin`).
alter table public.profiles
  add column if not exists fcm_token   text,
  add column if not exists fcm_at      timestamptz,
  -- لغة الإشعار. لا تُخمَّن من الجهاز — الخادم لا يراه — ولا تُترك للافتراض:
  -- من بدّل التطبيق إلى الإنجليزية يقرأ إشعاراته عربيّةً وهو لم يطلب ذلك.
  -- ⚠️ والافتراضي **`null` لا `'ar'`**: صفوفٌ قائمة لم يُدلِ أصحابها برأي،
  --    والدالّة تقرأ الغياب «العربية» وهي لغة المنتج الأساسية — فرقٌ بين أن
  --    نعرف وأن نفترض، ويظهر يوم نضيف لغةً ثالثة.
  add column if not exists lang        text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_lang_chk') then
    alter table public.profiles add constraint profiles_lang_chk
      check (lang is null or lang in ('ar','en'));
  end if;
end $$;

-- 🔴 **ولا سياسة قراءةٍ لأحد على هذا العمود إطلاقًا.**
--    رمز الجهاز يُعرِّف صاحبه، ومن يقرؤه يستطيع أن يرسل إليه. و`profiles_self`
--    تسمح لصاحب الصفّ بقراءة صفّه — وهو مقبول: يقرأ رمزَ **جهازه هو**.
--    أمّا الأدمن فيقرأ كل الصفوف (‏`is_admin()`)، وهذا قائمٌ من قبل ولا يزيده
--    هذا العمود شيئًا لم يكن.

-- ⚠️ والكتابة **بواسطة صاحب الصفّ وحده**، وهي مغطّاة بـ`profiles_self_update`
--    القائمة. لكنّ ترحيل 24 يجمّد الأعمدة الحسّاسة (‏`role` · `active` باتّجاه)
--    بمُشغِّل، فيجب أن يسمح ذلك المُشغِّل بهذين العمودين — وهو يسمح، لأنه
--    يحرس أعمدةً مسمّاةً بعينها لا يمنع ما عداها.

-- ── ② الجسر: مُشغِّل يستدعي دالّة الحافّة ─────────────────────────────────
-- **على `notifications` لا على `bookings`**: الصفّ مكتوبٌ أصلًا بمنطقٍ مُختبَر
-- (متى نُشعر ومن نُشعر)، وتكرارُ ذلك المنطق هنا يعني مصدرَين للحقيقة يختلفان
-- أوّلَ ما يُضاف نوعُ إشعارٍ جديد.
--
-- ⚠️ ويحتاج `pg_net` (مثبَّت في Supabase). والاستدعاء **غير حاجز**:
--    `net.http_post` يُدرج في طابور ويعود فورًا — ولو كان متزامنًا لصار
--    بطءُ FCM بطءًا في **إدراج الحجز نفسه**، أي عطلٌ في المنتج بسبب إشعار.
create extension if not exists pg_net with schema extensions;

create or replace function public.fn_push_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url  text;
  fn_key  text;
begin
  -- الإعدادات في `app_settings` لا في الكود: تغيير الرابط أو المفتاح لا
  -- يستلزم ترحيلًا جديدًا. وغيابهما ⇒ لا إرسال، بلا خطأ ولا تعطيل للحجز.
  select value into fn_url from public.app_settings where key = 'push_fn_url';
  select value into fn_key from public.app_settings where key = 'push_fn_key';
  if fn_url is null or fn_url = '' or fn_key is null or fn_key = '' then
    return new;
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || fn_key),
    body    := jsonb_build_object('id', new.id),
    timeout_milliseconds := 4000
  );
  return new;
end $$;

-- ⚠️ `after insert` لا `before`: الصفّ يجب أن يكون **موجودًا** حين تقرؤه
--    الدالّة، وهي تُنادى بلا انتظار فقد تصل قبل إتمام معاملةٍ لم تُثبَّت بعد.
drop trigger if exists t_push_notify on public.notifications;
create trigger t_push_notify
  after insert on public.notifications
  for each row execute function public.fn_push_notify();

-- ── ③ مفاتيح الإعداد (فارغة عمدًا) ────────────────────────────────────────
-- ⚠️ **`app_settings` بلا سياسة قراءةٍ لأحد** (ترحيل 23 فصله عن جدول 11 لهذا
--    السبب بالضبط) ⇒ مفتاح الدالّة لا يخرج إلى عميل. والقيمتان تُملآن من
--    محرّر SQL في لوحة Supabase بعد نشر الدالّة:
--      update public.app_settings set value = 'https://<ref>.functions.supabase.co/push' where key = 'push_fn_url';
--      update public.app_settings set value = '<anon key>' where key = 'push_fn_key';
insert into public.app_settings(key, value)
values ('push_fn_url', ''), ('push_fn_key', '')
on conflict (key) do nothing;

-- ── تحقّق بعد التشغيل ──────────────────────────────────────────────────────
--   .../rest/v1/profiles?select=fcm_token&limit=0   ⇒ 401 (محجوب عن anon) أو 200 بجلسة
--   والمُشغِّل: أدرج إشعارًا يدويًّا وراقب `net._http_response`.
