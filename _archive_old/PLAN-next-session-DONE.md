# 📋 ✅ مُنفّذ (2026-07-25) — 6 تعديلات على التطبيق

> **✅ الحالة: كل التعديلات الستّة نُفّذت ومُحقَّقة حيًّا ومبنيّة في APK جديد (7.07MB).**
> الملف مُبقى كسجلّ للتقنيات والمصادر. خلاصة ما نُفّذ فعلًا + الأرقام المقيسة + المزالق
> المكتشفة أثناء التنفيذ في **`CLAUDE.md` قسم «🚦 آخر حالة (2026-07-25)»**.
> فروق عن المخطّط أدناه تستحقّ الانتباه:
> • **التعديل 1:** `.onb-seg{gap:0}` كانت ضرورية (مع gap تحتاج الإزاحة تصحيحًا بمقدار الفجوة).
> • **التعديل 2:** لم يكفِ تقوية الحجاب — **الشارة احتاجت قاعدة داكنة خاصّة بها** (كانت 3.06:1).
> • **التعديل 3:** الأرقام الحقيقية كانت 40+18=58.8px لا 42+18=60px، فصارت الحشوة 7px لا 8px.
> • **التعديل 5:** التبديل يقع **عند اكتمال الدائرة** لا «فورًا تحت الغطاء» كما اقترح المخطّط.

> **مخطّط الجلسة الأصلي (مرجع تاريخي):** عندما يقول المستخدم «كمّل شغل عالتطبيق» ابدأ من هنا مباشرةً. كل تعديل مكتوب بملفّه وأسطره وتقنيته الجاهزة (بحث الإنترنت/يوتيوب **أُنجز مسبقًا** ونتائجه مبثوثة أدناه — لا تُعد البحث إلا عند الحاجة، توفيرًا لرصيد المستخدم). التطوير حصريًّا على ثلاثي `app/native/app.{html,css,js}`. الموقع مُجمّد.

## سير العمل الثابت (بعد كل تعديل)
1. `node --check app/native/app.js` (إن لُمس JS).
2. بناء: `powershell -ExecutionPolicy Bypass -File app\build.ps1` — **يجب أن يبقى «بناء الموقع = 638,160 محرفًا» ثابتًا** (دليل صفر أثر على الموقع).
3. معاينة حيّة: خادم `koora-app` على `localhost:8012/_preview_app.html` (فيه `body.native`).
   - **بذر البيانات** (الـAPI بطيء ~5-9s): احقن كاش قبل reload:
     `localStorage.setItem('mustadaira:places_cache_v8', JSON.stringify({time:Date.now(),places:[...]}))` — أو انتظر تحميل الـAPI الحقيقي (6 ملاعب).
   - نهاري: `localStorage.setItem('mustadaira:theme','light')` ثم reload (المتصفّح يبدأ داكنًا).
4. تحقّق: كونسول نظيف · صفر overflow (`documentElement.scrollWidth==innerWidth`) على 320/360/390 × ثيمين × لغتين.
5. عند الانتهاء من الكل: `npx cap sync android` ⇒ `.\android\gradlew.bat -p android assembleDebug` ⇒ انسخ الـAPK إلى `Desktop\المستديرة-التطبيق.apk`.

> **مزالق معاينة:** المُصيّر يجمّد الأنيميشن عند `currentTime:0` (تحقّق من الأنيميشن بقراءة `getComputedStyle().animationName/Duration/Delay` لا باللقطة) · اللقطات تفشل أحيانًا («pane not displayed») فاعتمد قياس DOM · `$` غير معرّف بنطاق الكونسول (استخدم `document.querySelector`).

---

## ✅ التعديل 1 — أنيميشن فخم لمبدّل «لاعب/صاحب ملعب» + تثبيت الارتفاع
**الملفات:** `app.css` (السطور 2208-2213 و2437-2440) · `app.js` (`onbRole` سطر ~2790) · `app.html` (لوح `.onb-sheet`).

**المشكلة الحالية:** `.onb-seg-btn.active` يبدّل الخلفية فورًا (بلا انزلاق)، و`.onb-panel[hidden]` يبدّل بين لوحين مختلفَي الارتفاع (لاعب = 3 أزرار · مالك = زر + ملاحظة) ⇒ **اللوح يقفز**.

**التقنية (من البحث — sliding pill / segmented control):** حبّة منزلقة بمؤشّر فيزيائي:
- في `.onb-seg` أضف عنصر مؤشّر `<span class="onb-seg-thumb" aria-hidden="true"></span>` (أول ابن)، `position:absolute` بعرض 50% وارتفاع كامل ناقص الحشوة، خلفية `var(--surface)` + `box-shadow:var(--shadow-sm)`.
- المؤشّر يتحرّك بـ`transform:translateX(calc(var(--seg-i,0) * 100%))` والاتجاه يتبع RTL عبر `--nav-dir` (موجود: rtl=-1/ltr=1) ⇒ `translateX(calc(var(--seg-i) * var(--nav-dir) * 100%))`.
- الانتقال بنابض موجود: `transition:transform .42s var(--sp-snap)` (لا تخترع منحنى — `--sp-snap` جاهز).
- الأزرار تصبح شفّافة دائمًا (يزول `background`/`box-shadow` من `.active`)، ويبقى فقط تغيّر لون النص `color` بانتقال ناعم.
- `onbRole` في JS: بدل toggle للـ`.active`+`hidden`، اضبط `document.querySelector('.onb-seg').style.setProperty('--seg-i', role==='player'?0:1)` + حدّث `aria-selected` + نبضة `buzz(6)`.

**تثبيت الارتفاع (مهم):** غلّف اللوحين في `.onb-panels{display:grid}` واجعل كليهما في نفس الخلية `grid-area:1/1`، وبدّل بـ`opacity`/`visibility`/`transform` **لا بـ`hidden`** ⇒ ارتفاع الحاوية = أطول لوح دائمًا (لا قفز). كروسفيد فخم: اللوح الخارج `opacity:0;transform:translateY(6px);pointer-events:none`، الداخل `opacity:1;transform:none`، بانتقال `.32s var(--ease-out)`. عدّل `onbRole` ليضيف/يزيل صنف `.on` على اللوحين بدل `hidden`.
- **احذر:** لا تترك `[hidden]` على اللوح المخفي (يصفّر الارتفاع). استبدله بصنف `.onb-panel.off{opacity:0;visibility:hidden}`.

**تحقّق:** قِس `.onb-sheet` height قبل/بعد التبديل — **يجب أن يتساوى** · المؤشّر ينزلق (اقرأ `transform` بعد تعطيل الانتقال مؤقتًا) · RTL وLTR الاتجاه صحيح · ثيمين.

**مصادر:** [Motion smooth tabs](https://motion.dev/examples/react-smooth-tabs) · [Pure CSS segmented control](https://www.cssscript.com/segmented-control-anchor-positioning/) · [webdevtrick sliding](https://webdevtrick.com/css-animated-segmented-control/)

---

## ✅ التعديل 2 — صورة صفحة البداية: لاعبون يلعبون
**الملفات:** `app.css` (متغيّر `--onb-photo` + `.onb-photo` background-position + `.onb-hero-bg` scrim).

**الصورة جاهزة ومُتحقَّقة** (نزّلتها ومعاينتها في الجلسة السابقة): `assets/onb/players-3148452.jpg` (لقطة أكشن ديناميكية: مهاجم يراوغ + عدّة لاعبين، Pexels رخصة مجانية). بديل: `assets/onb/players-16588259.jpg` (لاعب يُسدّد).

**التنفيذ:**
1. `powershell -ExecutionPolicy Bypass -File app\native\embed-onb-photo.ps1 -Src "assets\onb\players-3148452.jpg"` (يستبدل سطر `--onb-photo` base64، قابل لإعادة التشغيل).
2. **عدّل `background-position`:** الصورة الحالية `center 66%` (لأن الغروب كان أعلاها). صورة اللاعبين موضوعها بالمنتصف ⇒ جرّب `center 46%` كي يظهر اللاعبون في نافذة البورتريه. (`.onb-photo` في الجزء 19.)
3. **أعد ضبط الحجاب:** الصورة نهارية ساطعة ⇒ قد تحتاج درعًا أعلى أقوى. **قِس التباين فعليًا** (لا تخمّن) بنفس طريقة الجلسة السابقة:
   - ارسم الصورة في canvas بنفس هندسة `cover`+`center 46%`، ركّب ألفا طبقات `.onb-hero-bg` (الدرع الأعلى + التدرّج السفلي) بكسلًا بكسل، احسب لمعان كل نطاق نصّي (`.onb-brandname/.onb-eyebrow/.onb-title/.onb-sub`) والتباين مقابل الأبيض. **الهدف ≥4.5:1 لكل نطاق** (اسم العلامة كان الأصعب). كود القياس الكامل محفوظ في سجل الجلسة السابقة — أعِد استخدامه.

**تحقّق:** الصورة محمّلة (data-URI) · تباين كل النصوص ≥4.5:1 مقيس بالـcanvas · صفر overflow · بناء الموقع ثابت.

**مصدر الصورة:** [Pexels 3148452](https://www.pexels.com/photo/men-playing-football-3148452/) · بديل [Pexels 16588259](https://www.pexels.com/photo/soccer-players-in-action-during-a-match-on-a-field-16588259/)

---

## ✅ التعديل 3 — إعادة تصميم شريط التصفّح (فلاتر/مناطق/رياضات) أوسع وأسهل
**الملفات:** `app.html` (سطور 195-212) · `app.css` (`.browse-sticky` 863 · `.browse-rail` 869 · `.filter-btn` 882/1928 · `.region-tabs` 348/1931 · `.sport-dd` 2007).

**المطلوب:** الصفّ ضيّق ومزعج ⇒ أوسع وأسهل **دون مساحة رأسية زيادة** · احذف كلمة «الفلاتر» وأبقِ الرمز فقط.

**التنفيذ:**
1. **زر الفلاتر أيقونة فقط:** في `app.html` سطر 199 احذف `<span data-i18n="filters">الفلاتر</span>` (أبقِ الـsvg + `.filter-count`). اجعل `.filter-btn` مربّعًا دائريًا 44×44 (`padding:0;width:44px;justify-content:center`) — يوفّر عرضًا للمناطق. أبقِ `aria-label` (أضف `data-i18n-aria="filters"` للوصولية بدل النص المرئي).
2. **حبوب المناطق أوسع وأسهل لمسًا** (بلا زيادة ارتفاع): زد الحشوة الأفقية `.region-tabs .rtab`/الحبوب (padding-inline من ~14 إلى ~18px)، زد الخط قليلًا (12.5→13px)، حدّ أوضح، وحالة نشطة أوضح (صبغة Teal soft نهاري / Lime خافت ليلي كما في نمط الهوية). **أبقِ `min-height:42px`** ثابتًا فلا يزيد الارتفاع.
3. **قلّل التكدّس:** أزل قناع التلاشي المزعج (`.filter-btn::after` fade) إن قصّ الحبّة النشطة، ووسّع `gap` من 7-8 إلى 10px لسهولة اللمس. الصفّ يبقى **سطرًا أفقيًا واحدًا ينزلق** (صفر ارتفاع إضافي).
4. **راجع تموضع `.sport-dd`:** بعد تصغير زر الفلاتر لأيقونة، وازن الصفّ: [أيقونة فلتر] [منسدلة رياضة] │ [مناطق تنزلق]. تأكّد أن الحبّة النشطة تحاذي `var(--s-5)`.

**تحقّق:** ارتفاع `.browse-sticky` **لم يزد** (قِس قبل/بعد) · زر الفلاتر بلا نص، أيقونة واضحة، `aria-label` سليم · حبوب أكبر لمسًا (≥44px مساحة فعلية) · صفر overflow · اللغتان.

**مصدر النمط:** أشرطة تصفية Booking/Airbnb — صفّ أفقي واحد، زر فلتر أيقوني، حبوب متنفّسة.

---

## ✅ التعديل 4 — تجميل أنيميشن الدخول (INTRO)
**الملفات:** `app.css` (الجزء 18، `--sp-mark` والـkeyframes) · `app.html` (بنية `#intro` إن لزم عنصر جديد) · `app.js` (مؤقّت الحذف سطر ~2400، حاليًا 1520ms).

**الحالي:** شعار يكبر بنابض ⇒ اسم يصعد ⇒ خطّ Lime `scaleX` ⇒ شطر يصعد ⇒ لوح يرتفع ويتلاشى. جيّد لكن المستخدم يريد **أجمل**.

**ترقيات مقترحة (من اتجاهات splash/onboarding 2026 — طبّق 2-3 لا الكل):**
- **لمعان قطري يمرّ على الشعار** (`conic-gradient` أو شريط ضوء يجتاز `.intro-mark`) بعد الـpop — إحساس زجاجي راقٍ.
- **كشف الاسم بقناع (mask wipe)** بدل الصعود البسيط: `clip-path:inset(0 100% 0 0)` ⇒ `inset(0 0 0 0)` يتبع الاتجاه (RTL).
- **خطّ منتصف الملعب + دائرة** يُرسمان خلف الشعار (SVG `stroke-dashoffset` أو `scaleX`/`scale`) بلون Lime خافت — يربط الهوية بكرة القدم («المستديرة» = الدائرة/الكرة).
- **خروج بارالاكس متّصل:** بما أن `.onb-photo` تحت الـintro تُكبَّر عند الدخول (`onbPhotoIn`)، اجعل خروج الintro **تكبيرًا لأعلى + تلاشيًا** بحيث يبدو أننا «نمرّ عبر» الشعار إلى صفحة البداية (زووم متّصل). زد المدّة قليلًا (~1.7-1.9s إجمالي) وحدّث مؤقّت الحذف في `app.js`.
- احترم `prefers-reduced-motion` (لوح ساكن ~500ms موجود).

**تحقّق:** اقرأ `animationName/Duration/Delay` لكل عنصر (مطابقة للتصميم) · العنصر يُحذف من DOM بعد المدّة الجديدة (`!document.getElementById('intro')`) · صفر أخطاء · reduced-motion يعمل.

**مصادر:** ابحث عند الحاجة «app splash screen animation 2026 css» / «logo reveal clip-path mask» على يوتيوب — لكن التقنيات أعلاه كافية.

---

## ✅ التعديل 5 — أنيميشن تبديل الثيم (نهاري↔ليلي) فخم
**الملفات:** `app.js` (`toggleTheme` سطر 2723 · `applyTheme` 2717 · الموزّع يمرّر `fn(act,e)` سطر 2805 ⇒ **`toggleTheme(btn,e)` يصله الزر والحدث جاهزَين**) · `app.css` (قواعد الكشف).

**الحالي:** `applyTheme` يبدّل صنف `.dark` فقط + انتقال لون 0.45s — مسطّح.

**التقنية (من البحث — الكشف الدائري الشهير):** دائرة تتمدّد من نقطة زر التبديل تكشف الثيم الجديد.
- **الطريقة الآمنة لكل WebView (موصى بها كأساس):** لا تعتمد على View Transitions API (دعمها في WebView أندرويد متفاوت). بدلًا:
  1. في `toggleTheme(btn,e)`: احسب مركز الزر `const r=btn.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;`
  2. نصف القطر الأقصى: `const R=Math.hypot(Math.max(x,innerWidth-x), Math.max(y,innerHeight-y));`
  3. أنشئ `<div>` غطاء `position:fixed;inset:0;z-index:9998` مطليًّا بلون خلفية **الثيم الجديد** (`--bg-primary` للوجهة)، بـ`clip-path:circle(0px at Xpx Ypx)`.
  4. بدّل صنف `.dark` **فورًا تحت الغطاء** (`applyTheme`)، ثم `overlay.animate({clipPath:[circle(0...),circle(R...)]},{duration:500,easing:'ease-in-out'})`، واحذف الغطاء عند `onfinish`.
  - هذا يعطي «فقاعة» تتفتّح من الإصبع في **كل** WebView.
- **تحسين تدريجي (اختياري):** إن توفّر `document.startViewTransition` استعمله بكود البحث (Math.hypot + `clipPath circle 0→R` + `pseudoElement:'::view-transition-new(root)'`) وإلا اسقط للطريقة أعلاه.
- **حارس:** `prefers-reduced-motion` أو غياب `getBoundingClientRect` صالح ⇒ تبديل فوري (سلوك حالي).
- **ملاحظة:** `toggleTheme` مستدعى من عدّة أزرار (`onb-tool`، رؤوس compact). كلها تمرّر `btn` صحيحًا ⇒ الفقاعة تنطلق من الزر المضغوط فعليًّا. حدّث تعريف `toggleTheme` ليقبل `(btn,e)`.

**تحقّق:** التبديل يعمل من كل زر ثيم · الفقاعة تنطلق من نقطة الزر (اقرأ `clip-path` أثناء الأنيميشن أو تحقّق من إنشاء/حذف الغطاء) · لا وميض للثيم القديم · reduced-motion فوري · شريط الحالة (`native.js` `syncStatusBar`) يتزامن.

**مصادر:** [كود View Transitions الكامل — Akash](https://akashhamirwasia.com/blog/full-page-theme-toggle-animation-with-view-transitions-api/) · [theme-toggle.rdsx.dev حيّ](https://theme-toggle.rdsx.dev/) · [Animbits circular](https://www.animbits.dev/docs/transitions/theme-toggle-circular)

---

## ✅ التعديل 6 — الاستعانة بالإنترنت/يوتيوب
**أُنجز مسبقًا** — نتائج البحث مبثوثة في كل تعديل أعلاه مع الروابط. لا حاجة لإعادة بحث إلا لو طلب المستخدم عمقًا أكثر في تقنية بعينها (حينها WebFetch الرابط المذكور).

---

## ملخّص الملفات المتأثّرة
| الملف | التعديلات |
|------|-----------|
| `app/native/app.html` | 1 (مؤشّر seg + غلاف panels) · 3 (حذف نص الفلاتر) · 4 (بنية intro إن لزم) |
| `app/native/app.css` | 1 · 2 (photo/scrim) · 3 (browse bar) · 4 (intro) · 5 (قواعد كشف الثيم) |
| `app/native/app.js` | 1 (`onbRole`) · 4 (مؤقّت الحذف) · 5 (`toggleTheme`/`applyTheme`) |
| `assets/onb/players-3148452.jpg` | جاهزة (التعديل 2) |
| **لا يُلمس** | ثلاثي الموقع، `Code.gs`، `native.css/js` (إلا تزامن شريط الحالة موجود) |

## بعد إنجاز الكل
بناء APK جديد ونسخه للسطح، وتحديث `CLAUDE.md` (قسم «آخر حالة») + ذاكرة `project_native_redesign_2026-07-24` بالدفعة الرابعة، واحذف هذا الملف أو ذيّله بـ«✅ مُنفّذ».
