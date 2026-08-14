# تشغيل إشعارات الدفع — ثلاث خطوات عليك

> **الكود كلُّه مبنيّ ومدفوع.** ما يلي ثلاثة أشياء لا يستطيعها إلّا صاحب
> الحساب: مشروع Firebase، ومفتاح حساب خدمة، وسرٌّ في Supabase.
> **وحتى تُنجزها لا شيء ينكسر**: الصفوف تُكتب، ومركز الإشعارات يعرضها،
> والإشعار المحلّي يظهر عند فتح التطبيق — كما هو اليوم بالضبط.

---

## لماذا هذه الخطوة تحديدًا

الحجز **طلبٌ ينتظر ردًّا**. وصفُّ الإشعار يُكتب في القاعدة منذ ترحيل 14
**داخل معاملة الحجز نفسها** — أي أنّ الخبر جاهزٌ في اللحظة الصحيحة. والناقص
قطعةٌ واحدة: **لا شيء يوصّله إلى هاتفٍ مغلق.**

فالمالك لا يعرف أنّ طلبًا وصل حتى يفتح التطبيق، واللاعب الذي ينتظر يأخذ
ملعبًا آخر بمكالمة. وميزةٌ كاملة معطَّلة بهذا وحده: **«نبّهني إذا فضيت»**
(ترحيل 20) وعدُها كلُّه «سنُشعرك».

---

## ① مشروع Firebase (‏٥ دقائق · مجّاني)

1. افتح `console.firebase.google.com` ⇐ **Add project** ⇐ سمِّه `mustadeera`.
   (يمكنك إيقاف Google Analytics — لا نستعمله.)
2. داخل المشروع: **Add app** ⇐ أيقونة أندرويد. في خانة package name اكتب
   **بالضبط**:

```
com.almustadira.app
```

3. نزّل `google-services.json` وضعه في:

```
C:\Users\malik\OneDrive\Desktop\koora\android\app\google-services.json
```

⚠️ **ولا تفعّل Authentication في Firebase** — الهويّة تبقى على Supabase.
FCM خدمةٌ منفصلة تمامًا ولا تلمسها.
✅ **ولا تعديل على gradle**: القالب يطبّق الملحق تلقائيًّا حين يجد الملفّ
(‏`android/app/build.gradle` سطر ٧٠)، والـclasspath موجود أصلًا. مقيس: البناء
ينجح مع الملفّ وبدونه.

---

## ② مفتاح حساب الخدمة ⇒ سرّ Supabase

الخادم يحتاج أن يوقّع طلباته إلى FCM. (‏«مفتاح الخادم» القديم أُوقف؛ الواجهة
الحالية تتطلّب توكن OAuth2 يُوقَّع بمفتاح حساب خدمة.)

1. في Firebase: **⚙️ Project settings** ⇐ **Service accounts** ⇐
   **Generate new private key** ⇒ ينزّل ملفّ JSON.
2. ارفعه سرًّا في Supabase — **سطر واحد**:

```bash
supabase secrets set FCM_SERVICE_ACCOUNT="$(Get-Content -Raw 'C:\path\to\service-account.json')" --project-ref nxqddfuwtrsabprxcfez
```

⚠️ **احذف ملفّ الـJSON من جهازك بعدها** — هو مفتاح إرسالٍ باسم مشروعك،
ولا يُوضع في المستودع أبدًا (المستودع عامّ).
⚠️ وتحقّق بلا كشف السرّ: `supabase secrets list` يُرجع **بصمة sha256** لكل
قيمة، فاحسب بصمة الملفّ محلّيًّا وقارنها.

---

## ③ نشر الدالّة وربطها بالقاعدة

```bash
supabase functions deploy push --project-ref nxqddfuwtrsabprxcfez --use-api
```

ثمّ **شغّل ترحيل 31** من محرّر SQL في لوحة Supabase
(‏[`migration/31_push_tokens.sql`](../../migration/31_push_tokens.sql))، ثمّ
املأ المفتاحين — سطران في نفس المحرّر:

```sql
update public.app_settings set value = 'https://nxqddfuwtrsabprxcfez.functions.supabase.co/push' where key = 'push_fn_url';
update public.app_settings set value = '<المفتاح العام anon>' where key = 'push_fn_key';
```

⚠️ **و`app_settings` بلا سياسة قراءةٍ لأحد** (ترحيل 23 فصله عن جدول 11 لهذا
السبب) ⇒ لا يخرج المفتاح إلى عميل.

---

## ثمّ: أعِد بناء الـAPK وثبّته

```bash
powershell -ExecutionPolicy Bypass -File build.ps1; npx.cmd cap sync android; cd android; .\gradlew.bat assembleRelease
```

⚠️ **واحذف النسخة القديمة من الجهاز قبل التثبيت** إن كانت debug — توقيعان
متعارضان لا يُثبَّت أحدهما فوق الآخر.

---

## كيف تعرف أنها تعمل

1. افتح التطبيق وسجّل دخولك، واقبل إذن الإشعارات حين يُطلب (بعد أوّل حجز،
   أو عند دخول المالك).
2. في محرّر SQL:

```sql
select id, phone, (fcm_token is not null) as has_token, fcm_at, lang from public.profiles where fcm_token is not null;
```

   صفٌّ واحد على الأقلّ ⇒ **الرمز وصل**.
3. أغلق التطبيق تمامًا، ثمّ أرسل حجزًا من حسابٍ آخر ⇒ يجب أن يرنّ هاتف المالك.
4. وإن لم يرنّ، السبب مكتوبٌ في ردّ الدالّة:

```sql
select created, (content::jsonb) from net._http_response order by created desc limit 5;
```

| ما تقرؤه | معناه |
|---|---|
| `no_service_account` | الخطوة ② لم تقع |
| `no_token` | التطبيق لم يسجّل الرمز — الإذن مرفوض أو الخطوة ① ناقصة |
| `token_dropped` | الجهاز أُلغي تثبيته؛ نُظّف الرمز تلقائيًّا (سليم) |
| `unknown_kind:<x>` | نوعُ إشعارٍ بلا نصّ في الدالّة |
| `sent:true` | أُرسل فعلًا — فالعطل بعده (إذن الجهاز · القناة) |

---

## ما بُني ولا يحتاجك

| | |
|---|---|
| ترحيل `31` | `fcm_token` · `fcm_at` · `lang` + مُشغِّل `t_push_notify` **غير حاجز** (‏`pg_net`) — بطءُ FCM لا يُبطئ إدراج الحجز |
| `supabase/functions/push` | يبني الجملة **بلغة المستخدم** لا يقرؤها من الصفّ (نصٌّ مخزَّن يُجمَّد على لغة لحظة كتابته) · ويوقّع OAuth2 · ويخزّن التوكن حتى انتهائه · **وينظّف الرمز الميّت** عند `UNREGISTERED` |
| `native.js` | تسجيل الرمز · **إنشاء القناة `mustadeera`** (بدونها يسقط الإشعار صامتًا على أندرويد ٨+) · ونقرةُ الدفع تُطلق **نفس حدث** الإشعار المحلّي فلا مسارَين |
| `app.js` | يحفظ الرمز **عند تغيّره فقط**، ولا يسجّل لضيف، ويصمت عند الفشل — المستخدم لم يطلب هذا ولا يملك إصلاحه |

⚠️ **ولم يُختبر على جهاز** — لا يمكن اختباره قبل أن يوجد مشروع Firebase.
