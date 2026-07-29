# المستديرة — خريطة المشروع

منصّة حجز ملاعب كرة قدم. **وجهان اثنان لا ثالث لهما:** موقع تسويقي ثابت، وتطبيق أندرويد
مدمج (Capacitor). واجهة ثنائية اللغة (عربي RTL / إنجليزي LTR)، بلا أي مكتبة JS.

> **هذا الملفّ يقول: أين كل شيء وأين أُحرّر.**
> لحالة العمل وما تبقّى ⇐ [`CLAUDE.md`](CLAUDE.md).

---

## ⚡ القاعدة الوحيدة: كلّ منتج في مجلّده

```
app/    ⇒ التطبيق فقط          site/   ⇒ الموقع فقط
```

لا يقرأ أحدهما من الآخر. أُعيد الترتيب هكذا في 2026-07-29 بعد أن تبيّن أن بناء **الموقع**
كان يقرأ شعاراته من `app/` — تبعية مقلوبة كانت ستكسر الموقع صامتًا عند أوّل نقل.

| أريد أن أعدّل… | أحرّر | البناء يكتب |
|---|---|---|
| **التطبيق** | `app/src/app.html` + `app.css` + `app.js` | `app/www/index.html` ⇒ الـAPK |
| **طبقة الهاتف** (اهتزاز · زر الرجوع · شريط الحالة) | `app/src/native.css` + `native.js` | تُحقَن قبل `</body>` — خاملة في المتصفّح |
| **الموقع** | `site/pages/` + `site/partials/` + `site/styles/` | `public/` ⇒ Vercel |
| **نصوص الموقع** | `site/strings/ar.txt` + `en.txt` | — |
| **لوحة الإدارة** | `site/admin.html` | `public/admin/` |

**بعد أي تعديل، أمر واحد يبني الاثنين:**

```bash
powershell -ExecutionPolicy Bypass -File build.ps1
```

---

## 📁 الشجرة

```
koora/
├── build.ps1              ← ⭐ يبني الاثنين. شغّله بعد كل تعديل
├── CLAUDE.md              ← حالة المشروع وما تبقّى. اقرأه أوّلًا في أي جلسة
├── README.md              ← أنت هنا: خريطة الملفّات
│
├── app/                   ← 🔵 التطبيق — كل ما يخصّه
│   ├── src/               ← المصدر: app.html · app.css · app.js
│   │                        + native.css · native.js (طبقة الهاتف)
│   ├── assets/            ← أيقونات أندرويد + صورة شاشة البداية
│   ├── tools/             ← embed-onb-photo.ps1 (حقن صورة base64)
│   └── www/               ← 🤖 مولَّد — webDir لـCapacitor. لا تُحرّره
│
├── site/                  ← 🟠 الموقع — كل ما يخصّه
│   ├── build-site.ps1     ← المولّد (يمسح public/ أوّلًا ثمّ يكتب)
│   ├── pages/ · partials/ · styles/     ← المحتوى والقوالب والتنسيق
│   ├── strings/{ar,en}.txt              ← كل نصوص الموقع
│   ├── static/            ← _headers · _redirects · assets/ (الشعارات + OG)
│   ├── data/places.json   ← كاش الأماكن: يمنع كسر البناء عند انقطاع الشبكة
│   ├── admin.html         ← لوحة الإدارة (صفحة مستقلّة خارج قالب الموقع)
│   ├── release.txt        ← ✍️ يملؤه المالك: إصدار الـAPK وبصمته ورابطه
│   └── contact.txt        ← ✍️ يملؤه المالك: واتساب وبريد
│
├── public/                ← 🤖 مولَّد — مخرَج الموقع، وهو ما ينشره Vercel
│                            ⚠️ متتبَّع في git عمدًا (لا خطوة بناء عند Vercel)
│                            ⚠️ حرّر site/ لا هذا — أي تعديل هنا يضيع
│
├── migration/             ← 🟢 قاعدة البيانات (Supabase/Postgres)
│   ├── 01…08_*.sql        ← تُشغَّل بالترتيب، مرّة واحدة لكلٍّ
│   ├── RECIPES.sql        ← ⭐ وصفات التعديل اليومي — مرجع لا سكربت:
│   │                        انسخ الوصفة وحدها. لا تشغّل الملفّ كاملًا
│   ├── README.md          ← شرح المخطّط والقرارات
│   └── CSV/ · 02 · 03     ← 🔒 بيانات حقيقية — مستثناة من git
│
├── android/               ← 🟣 مشروع أندرويد (Capacitor)
│   └── SIGNING.md         ← ⭐ إنشاء مفتاح التوقيع وبناء نسخة release
│
├── backend/Code.gs        ← ⚠️ Apps Script — لم يبقَ منه إلّا الـAI (اقرأ أدناه)
│
├── docs/                  ← 📚 مراجع لا تُنفَّذ
│   ├── plans/             ← الخطط الثلاث (① التطبيق · ② الموقع · ترحيل القاعدة)
│   ├── design-system/ · مراجع/          ← وثائق ومراجع بصرية
│   └── دليل-نصوص-الكودين-فقط.xlsx      ← 501 نصّ واجهة بمفاتيح I18N
│
├── brand/                 ← صور الهوية الأصلية (مراجع تصميم)
└── .github/workflows/     ← 🟡 نسخة احتياطية يومية + نبضة تمنع إيقاف المشروع
```

---

## 🤖 مولَّد — لا تُحرّره، سيُمحى

| المسار | المصدر |
|---|---|
| `public/**` | `site/` ⇐ `site/build-site.ps1` |
| `app/www/index.html` | `app/src/` ⇐ `build.ps1` |
| `app/src/_preview_app.html` | نفسه + علم `body.native` للمعاينة |
| `android/app/src/main/assets/public/` | `app/www/` ⇐ `npx cap sync` |

---

## 🔧 الأوامر

```bash
powershell -ExecutionPolicy Bypass -File build.ps1
```

```bash
npx cap sync android
```

```bash
cd android && .\gradlew.bat assembleDebug
```

**معاينة محلّية** (خادمان في [`.claude/launch.json`](.claude/launch.json)):
`localhost:8012/_preview_app.html` (تطبيق) · `localhost:8020/` (موقع).

> ⚠️ عند تثبيت APK جديد: **احذف النسخة القديمة أولًا** — توقيعا debug/release متعارضان.
> ⚠️ الموقع الحيّ **لا يُفتح من شبكتك** (`*.vercel.app` محجوب بفلترة SNI) — تحقّق من
> لوحة `vercel.com` أو من المعاينة المحلّية.

---

## ⚠️ حالة `backend/Code.gs`

الباكند القديم (Apps Script + Google Sheets). **كل شيء انتقل إلى Postgres/Supabase**
عدا شيء واحد: **لوحات الذكاء الاصطناعي الثلاث** في لوحة المالك (`aiInsights` ·
`aiReviews` · `aiWeather`) ما زالت تناديه، لأن Gemini يحتاج مفتاحًا على خادم.

**لا تطوّره.** إمّا يبقى خادمَ AI فقط، أو يُنقل الـAI إلى Supabase Edge Function
ويُوقَف نهائيًّا (P5). القرار للمالك.

---

## 🔒 ما لا يُرفع إلى git أبدًا

مضبوط في [`.gitignore`](.gitignore): مفتاح التوقيع (`*.jks`) وكلمات سرّه
(`android/keystore.properties`) · **بيانات العملاء الحقيقية** (`migration/CSV/` و`02` و`03`
— المستودع **عامّ**) · `node_modules/` · مخرَجات البناء عدا `public/`.

**من يملك مفتاح التوقيع يستطيع نشر تحديث يبدو صادرًا عنك على جهاز كل مستخدم.**
تحقّق بـ`git status --short` قبل أي دفعة.
