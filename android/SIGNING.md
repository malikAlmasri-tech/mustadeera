# توقيع نسخة الإصدار (release) — مرّة واحدة

نسخة الـdebug الحالية موقّعة بمفتاح تلقائي يولّده أندرويد ستوديو. هذا يكفي للتجربة،
لكنه **لا يصلح للتوزيع**: مفتاح الـdebug مشترك ومعروف، ومتجر Play يرفضه، وأي تحديث
لاحق بمفتاح مختلف يفشل تثبيته فوق النسخة القديمة.

> ⚠️ **المفتاح لا يُستبدَل أبدًا.** هوية التطبيق على جهاز كل مستخدم مربوطة به. إن ضاع،
> لا تستطيع إصدار أي تحديث لمن ثبّتوا التطبيق — يجب أن يحذفوه ويثبّتوا نسخة جديدة
> بمعرّف مختلف. **احتفظ بنسخة من `mustadeera-release.jks` في مكانين على الأقلّ.**

---

## الخطوة 1 — أنشئ المفتاح

من مجلّد `android/` شغّل هذا الأمر. سيسألك عن كلمة سرّ **تكتبها أنت** (6 محارف فأكثر)،
ثم عن اسمك والمدينة والدولة — أجب بما تشاء، لا يظهر للمستخدمين.

```bash
keytool -genkeypair -v -keystore mustadeera-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mustadeera
```

> `-validity 10000` ≈ 27 سنة. متجر Play يشترط صلاحية تتجاوز 2033، وهذا يحقّقها.
> إن لم يُعرف الأمر `keytool`، فهو داخل حزمة Java: جرّبه من
> `"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"`.

**احفظ كلمة السرّ في مدير كلمات السرّ فورًا** مع اسم واضح («مفتاح توقيع تطبيق المستديرة»).

## الخطوة 2 — عرّف الـgradle بمكانه

أنشئ ملفًّا اسمه `android/keystore.properties` بهذا المحتوى، وضع كلمة سرّك مكان
`YOUR_PASSWORD` (نفسها في السطرين إن لم تُعطِ كلمة سرّ منفصلة للمفتاح):

```properties
storeFile=mustadeera-release.jks
storePassword=YOUR_PASSWORD
keyAlias=mustadeera
keyPassword=YOUR_PASSWORD
```

> 🔒 هذا الملفّ و`*.jks` **مستثنيان في `.gitignore`** فلا يُرفعان إلى GitHub.
> تحقّق بنفسك قبل أي دفعة: `git status --short` — يجب ألّا يظهر أيّ منهما.

## الخطوة 3 — ابنِ

```bash
cd android && ./gradlew.bat assembleRelease
```

المخرَج: `android/app/build/outputs/apk/release/app-release.apk`

للنشر على متجر Play يُطلب **AAB** لا APK:

```bash
cd android && ./gradlew.bat bundleRelease
```

المخرَج: `android/app/build/outputs/bundle/release/app-release.aab`

## الخطوة 4 — تحقّق أن التوقيع فعلًا مطبَّق

```bash
cd android && ./gradlew.bat signingReport
```

ابحث عن `Variant: release` — يجب أن يظهر تحته مسار `mustadeera-release.jks` لا
`debug.keystore`. إن ظهر debug فمعناه أن `keystore.properties` لم يُقرأ (خطأ في اسمه
أو مكانه: يجب أن يكون داخل `android/` مباشرةً).

---

## عند التثبيت على الجهاز

نسخة release **لن تُثبَّت فوق** نسخة debug المثبّتة الآن — التوقيعان مختلفان وأندرويد
يرفض. احذف التطبيق القديم من الجهاز أولًا، ثم ثبّت الجديد.

بعد هذه المرّة الأولى، كل تحديث لاحق يُثبَّت فوق سابقه بلا حذف، ما دام المفتاح نفسه.

## رفع رقم الإصدار قبل كل نشر

في [`app/build.gradle`](app/build.gradle):

```gradle
versionCode 1        // ارفعه بواحد في كل نشر — Play يرفض إعادة استعمال رقم
versionName "1.0"    // ما يراه المستخدم
```
