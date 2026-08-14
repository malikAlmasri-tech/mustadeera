/* =============================================================
   المستديرة · app.js
   المعمارية: وحدة واحدة مغلّفة (IIFE) — صفر متغيرات عامة في window.
   الأقسام: Config → DOM utils → Utils → Session → API → State
            → UI(toast/loading) → Modal(+swipe) → Render → Actions → Router → Init
   مبادئ:
   • بناء DOM آمن عبر h() باستخدام textContent (يمنع XSS) — لا نمرّر بيانات
     المستخدم عبر innerHTML إطلاقاً (innerHTML مسموح فقط لأيقونات SVG ثابتة موثوقة).
   • كل التعامل مع الأحداث عبر تفويض (event delegation) و data-attributes.
   • الحركات تعتمد transform/opacity فقط (60fps).
   ============================================================= */
(() => {
"use strict";

/* ===================== CONFIG ===================== */
const CONFIG = {
  /* ⚠️ `API_URL` (رابط Apps Script) حُذف في 2026-08-09. كان مذكورًا هنا مرّةً
     واحدة ولا يُنادى من سطر واحد منذ انتقال الـAI إلى دالّة الحافّة
     (2026-08-06)، ومعه سطران في `connect-src` بالـCSP. سطحُ هجومٍ بلا مقابل،
     ورابطٌ حيّ في مستودع عامّ وفي كل APK يُنزَّل. */
  /* رقم بناء هذه النسخة — **مرآةُ `versionCode` في `android/app/build.gradle`**،
     يقارنهما `tools/check-mirrors.js`. تقرأ القاعدةُ منه أدنى إصدار مقبول
     (‏`min_app_version` في `booking_rules`، ترحيل 27) فيعرف صاحب الهاتف أنّ
     نسخته تخلّفت — وبدونه لا يعرف: التوزيع بـAPK مباشر بلا متجر يدفع تحديثًا. */
  APP_BUILD: 1,
  CACHE_KEY: "mustadaira:places_cache_v8",
  CACHE_MS: 10 * 60 * 1000,
  AUTO_REFRESH_MS: 90 * 1000,
  SEARCH_DEBOUNCE: 300,
  COMMISSION: 0.10,
  /* مهلة إلغاء اللاعب — بالساعات قبل بدء الخانة.
     ⚠️ **مصدر واحد**: لا يُكتب الرقم في أي موضع آخر من الواجهة. ونظيرُه في
     القاعدة صفٌّ في `booking_rules` (‏`player_cancel_window_hours`) يفرضه
     مُشغِّلُ `t_booking_cancel_window` — الواجهة تُخفي الزرّ، والقاعدة تردّ
     الطلب. ولو اختلف الرقمان يومًا فالخادم هو الحكم، ورسالة الرفض تحمل
     رقمه هو لا رقمنا (‏`cancel_window_closed:<n>`). */
  CANCEL_WINDOW_H: 6,
  /* مهلة ردّ المالك على الطلب — نظيرها في القاعدة `owner_reply_deadline_hours`،
     وتفرضها `expire_stale_bookings()`. والقيمة هنا **للعرض وحده** (العدّاد على
     البطاقة)؛ من يُلغي فعلًا هو الخادم. و`REPLY_WARN_H` عتبة اللون البرتقالي. */
  REPLY_DEADLINE_H: 24,
  REPLY_WARN_H: 6,
  API_TIMEOUT: 14000,   // مهلة الطلبات (14ث) قبل الإلغاء التلقائي
  AI_TIMEOUT: 45000,    // مهلة طلبات AI (نموذج + طقس عبر الخادم — أبطأ من الطلبات العادية)
};

/* الأوقات الافتراضية — بيانات محايدة لغوياً: hour (مطابقة الحجز/الخادم) + startHour/endHour
   لتوليد التسمية حسب اللغة. الحقل label هو القيمة الكنسية المُرسلة للخادم (بروتوكول حجز،
   يطابقه الباكند العربي) فيبقى ثابتاً؛ العرض الإنجليزي يُولَّد من الساعات عبر slotDisplay(). */
const DEFAULT_SLOTS = [
  /* ⚠️ العاشرة صباحًا تحمل «ص» صراحةً، وهي الخانة الوحيدة التي تحتاجها:
     بدونها تطابق تسميتُها تسميةَ العاشرة ليلًا (`hour:22`) **حرفًا بحرف**،
     فيُقرأ الحجز في «حجوزاتي» وفي نافذة المراجعة وفي نصّ الإشعار وفي رسالة
     الواتساب بلا ما يميّز صباحًا من ليل. والهوية بـ`hour` فالبيانات سليمة —
     المعروضُ وحده كان ملتبسًا. و`enSlotLabel` تفعلها صحيحةً في الإنجليزية
     منذ البداية (‏10:00 AM - 12:00 PM مقابل 10:00 PM - 12:00 AM)، أي أن
     **اللغة الأساسية كانت المعطوبة وحدها**. */
  {label:'8:00 - 10:00 ص',hour:8,startHour:8,endHour:10},{label:'10:00 ص - 12:00 م',hour:10,startHour:10,endHour:12},{label:'12:00 - 2:00 م',hour:12,startHour:12,endHour:14},
  {label:'2:00 - 4:00 م',hour:14,startHour:14,endHour:16},{label:'4:00 - 6:00 م',hour:16,startHour:16,endHour:18},{label:'6:00 - 8:00 م',hour:18,startHour:18,endHour:20},
  {label:'8:00 - 10:00 م',hour:20,startHour:20,endHour:22},{label:'10:00 - 12:00 م',hour:22,startHour:22,endHour:24}
];

/* خريطة المرافق (أيقونة SVG + مفتاح ترجمة) — مصدر واحد للبطاقة والتفاصيل والفلاتر.
   icon = اسم أيقونة في ICON. كل التسميات الظاهرة تأتي من I18N عبر labelKey. */
const AMENITY = {
  water:{icon:'drop', labelKey:'amenity_water'}, parking:{icon:'parking', labelKey:'amenity_parking'}, ball:{icon:'ball', labelKey:'amenity_ball'},
  vests:{icon:'vest', labelKey:'amenity_vests'}, bathrooms:{icon:'bath', labelKey:'amenity_bathrooms'}
};

/* ===================== I18N (عربي / إنجليزي) ===================== */
const I18N = {
  ar: {
    brandTag:'ملعبك على بُعد ثوانٍ', nav_features:'المميزات', nav_how:'كيف يعمل', nav_stats:'الأرقام',
    login:'تسجيل الدخول', register:'إنشاء حساب', startNow:'ابدأ الآن', browseFields:'تصفّح الملاعب',
    heroBadge:'منصّة حجز الملاعب الرياضية', heroTitlePre:'احجز ملعبك بلا مكالمات مع',
    heroSearchPh:'ابحث عن ملعب أو منطقة…', heroSearchBtn:'ابحث',
    /* النائب المتحرّك: بادئة ثابتة تُثبّت العين + كلمات متبدّلة (مصفوفة — t() تمرّرها كما هي) */
    heroSearchPrefix:'ابحث عن',
    heroSearchWords:['ملعب قريب','منطقة','وقت متاح','ملعب خماسي','ملعب سباعي'],
    heroSub:'شوف الفاضي والسعر، وابعث طلبك، وتابع الردّ من حسابك.',
    ownerLink:'تملك ملعباً؟ لوحة تحكّمك جاهزة من هنا', statPlaces:'ملعب متاح لك', statEasy:'سهل', statEasyLbl:'حجز بلا اتصالات ولا عناء',
    statAnytime:'تصفّح في أي وقت', statFree:'مجاني', statFreeLbl:'بلا رسوم تصفّح',
    featuresEyebrow:'المميزات', featuresTitlePre:'لماذا', featuresTitleBrand:'المستديرة؟',
    featuresSub:'كل ما تحتاجه لحجز ملعبك بسهولة — وكل ما يحتاجه المالك لإدارة ملاعبه باحتراف.',
    feat1Title:'من التصفّح إلى الطلب في دقيقة', feat1Text:'شوف الفاضي، اختر يومك ووقتك، وابعث طلبك.',
    feat2Title:'اعرف الملعب قبل الذهاب', feat2Text:'الموقع والسعر والمرافق ونوع الأرضية وتقييمات اللاعبين — كل المعلومات أمامك قبل أن تقرر.',
    feat3Title:'متابعة واضحة للحجز', feat3Text:'من حسابك تتابع حالة الحجز وردّ إدارة الملعب، وتتواصل معهم عند توفر وسيلة التواصل.',
    howEyebrow:'كيف يعمل', howTitlePre:'3 خطوات وتكون', howTitleHi:'جاهزاً للعب',
    tickerNoCall:'احجز بدون مكالمات', tickerClear:'أوقات وأسعار واضحة', tickerFollow:'تابع حجزك خطوة بخطوة', tickerNoAccount:'تصفّح بدون حساب',
    chartsTitle:'رسوم بيانية', chartRevenue:'الإيراد اليومي (مؤكّد)', chartOccupancy:'الإشغال', chartHours:'حسب الساعة', last7short:'آخر 7 أيام',
    step1Title:'تصفّح واختر', step1Text:'افتح قائمة الملاعب وقارن حسب المنطقة والسعر والتقييم — ثم اختر ملعبك.',
    step2Title:'حدّد الموعد', step2Text:'اختر اليوم والوقت المتاح الذي يناسبك من جدول الأوقات.',
    step3Title:'أرسل وتابع', step3Text:'أرسل طلب الحجز وتابع تأكيده مع إدارة الملعب — واستعدّ للمباراة!',
    calloutTitle:'جاهز لحجز ملعبك القادم؟', calloutSub:'ابدأ بلا حساب، أو سجّل دخولك لتتابع حجوزاتك.',
    startFree:'ابدأ مجاناً', haveField:'أملك ملعباً', footerLogin:'تسجيل الدخول', footerOwner:'دخول المالك',
    footerCopy:'© 2026 المستديرة — جميع الحقوق محفوظة.',
    loginTitle:'دخول اللاعب', loginSubtitle:'سجّل دخولك لعرض حجوزاتك ومتابعتها', phone:'رقم الهاتف', password:'كلمة السر',
    enter:'دخول', browseNoAccount:'أريد التصفّح بلا حساب', haveAccount:'لديّ حساب', name:'الاسم',
    regTitle:'إنشاء حساب', regSubtitle:'احفظ حجوزاتك وتابعها في أي وقت', createAccount:'إنشاء الحساب',
    ownerLoginTitle:'دخول المالك', ownerLoginSubtitle:'لوحة تحكم الملاعب والحجوزات', back:'رجوع',
    searchPh:'اكتب اسم المكان أو المنطقة…', search:'ابحث', availableFields:'الملاعب المتاحة', refresh:'تحديث',
    filters:'الفلاتر', sortLabel:'الترتيب', sportLbl:'الرياضة', all:'الكل', allRegions:'كل المناطق', priceJod:'السعر (دينار)',
    from:'من', to:'إلى', fieldSize:'حجم الملعب', type:'النوع', rating:'التقييم', availableToday:'المتاح اليوم فقط',
    amenities:'المرافق', apply:'تطبيق', clearAll:'مسح الكل', noData:'لا توجد بيانات',
    sortDefault:'الافتراضي', sortPriceAsc:'الأقل سعراً', sortPriceDesc:'الأعلى سعراً', sortRating:'الأعلى تقييماً', sortReviews:'الأكثر مراجعات', sortSoonest:'الأقرب وقتاً',
    availToday:'متاح اليوم', availLater:'متاح لاحقاً', availFull:'مكتمل اليوم', availNone:'لا توجد أوقات',
    unavailableBadge:'غير متاح', priceFrom:'يبدأ من', priceRange:'حسب الملعب',
    viewModeAria:'طريقة العرض', viewGrid:'عرض شبكي', viewList:'عرض قائمة',
    viewTimes:'عرض الأوقات', chooseField:'اختر الملعب', oneField:'ملعب واحد', fieldsCount:'{n} ملاعب',
    bookCta:'احجز الآن',
    fieldExtrasTitle:'المواصفات والصور', fieldPhotos:'صور الملعب',  lbOpen:'تكبير الصورة {i}', lbPrev:'الصورة السابقة', lbNext:'الصورة التالية', lbClose:'إغلاق',
    sportsAria:'اختر الرياضة', sportFootball:'كرة القدم', sportPadel:'بادل', sportBasket:'كرة السلة', sportTennis:'تنس', sportVolley:'كرة الطائرة', soonBadge:'قريباً',
    comingSoonTitle:'قريباً!', comingSoonSub:'ملاعب {sport} تُحمّي في غرفة الملابس — وستنزل أرض الملعب قريباً.', backToFootball:'عرض ملاعب كرة القدم',
    sportsHint:'المفتوح هو ما سُجّلت ملاعبه فعلاً، و«قريباً» ينتظر ملعبه الأوّل.',
    backToSport:'اعرض ملاعب {sport}',
    /* ── مواصفات الملعب (تختلف باختلاف الرياضة) ──
       كل مفتاح هنا يقابل مفتاحاً في `FIELD_SPECS`، وكل قيمة تقابل خياراً فيه.
       ⚠️ ما لا ترجمة له **لا يُعرَض إطلاقاً** — لا يُكتب حرفياً ولا يُخترع له
       نصّ (م5، ودرسُ المرافق: قيمة عربية حرّة تُقرأ عربيةً في الواجهة الإنجليزية). */
    specsTitle:'مواصفات الملعب',
    specL_enclosure:'الموقع', spec_enclosure_outdoor:'مكشوف', spec_enclosure_indoor:'صالة مغلقة', spec_enclosure_covered:'مسقوف',
    specL_lights:'إضاءة', spec_lights_yes:'إضاءة ليلية',
    specL_seating:'جلسات', spec_seating_yes:'مدرّج للمشاهدين',
    specL_surface:'الأرضية',
    spec_surface_grass_synthetic:'عشب صناعي', spec_surface_grass_natural:'عشب طبيعي',
    spec_surface_rubber:'مطّاطية', spec_surface_sand:'رملية',
    spec_surface_parquet:'باركيه', spec_surface_pu:'بولي يوريثان', spec_surface_asphalt:'أسفلت',
    spec_surface_hard:'صلبة (Hard)', spec_surface_clay:'ترابية (Clay)', spec_surface_grass:'عشب',
    spec_surface_carpet:'سجّاد', spec_surface_indoor_court:'أرضية صالة', spec_surface_beach_sand:'رمل شاطئي',
    specL_court:'نوع الملعب',
    spec_court_double:'زوجي', spec_court_single:'فردي',
    spec_court_full:'ملعب كامل', spec_court_half:'نصف ملعب',
    specL_walls:'الجدران', spec_walls_glass:'زجاج', spec_walls_mesh:'شبك', spec_walls_mixed:'زجاج وشبك',
    specL_panoramic:'الرؤية', spec_panoramic_yes:'بانورامي',
    specL_rackets:'المضارب', spec_rackets_free:'مضارب مجاناً', spec_rackets_paid:'مضارب برسوم',
    specL_hoop:'السلة', spec_hoop_standard:'ارتفاع نظامي (3.05م)', spec_hoop_adjustable:'ارتفاع قابل للتعديل',
    specL_net:'الشبكة', spec_net_men:'شبكة رجال (2.43م)', spec_net_women:'شبكة سيدات (2.24م)',
    spec_net_mixed:'شبكة مختلطة', spec_net_youth:'شبكة ناشئين',
    /* ── الإشعارات ──
       العنوان والنصّ يُكتبان **هنا** لا في القاعدة: الصفّ يحمل `kind` ومعطياته
       فقط، لأن نصًّا مخزَّناً يُجمَّد على لغة لحظة كتابته — فمن بدّل لغته يقرأ
       إشعاراته القديمة بلغته السابقة إلى الأبد. */
    notifsTitle:'الإشعارات', notifsAria:'الإشعارات', notifsEmpty:'لا إشعارات بعد',
    notifsEmptySub:'هنا يصلك ردّ الملعب على طلبك، وتصل صاحبَ الملعب طلباتُ الحجز الجديدة.',
    notifsMarkAll:'علّم الكل كمقروء', notifsNew:'جديد',
    notifsOff:'تابع طلبك من «حجوزاتي»',
    notifsOffSub:'الإشعارات لسّه ما اشتغلت عنّا. حالة كل طلب وردّ الملعب بتلاقيها محدّثة في «حجوزاتي».',
    notifsPermTitle:'تفعيل الإشعارات', notifsPermAsk:'نُعلمك فور ردّ الملعب على طلبك.',
    /* عناوين التجميع: الوقت النسبي وحده يجعل عشرين إشعارًا كتلةً واحدة */
    ntfGroupYesterday:'أمس', ntfGroupOlder:'أقدم',
    ntfNewTitle:'طلب حجز جديد', ntfNewBody:'{name} — {field} · {day} {time}',
    ntfConfirmedTitle:'تأكّد حجزك', ntfConfirmedBody:'{place} — {field} · {day} {time}',
    ntfRejectedTitle:'اعتذر الملعب عن طلبك', ntfRejectedBody:'{place} — {day} {time}',
    ntfCancelledTitle:'أُلغي حجزك', ntfCancelledBody:'{place} — {day} {time}',
    ntfMovedTitle:'نُقل موعد حجز', ntfMovedBody:'{name} — {field} · صار {day} {time}',
    // انقضاء المهلة (ترحيل 15) — ليس رفضًا، والنصّ يقول ذلك
    ntfExpiredTitle:'انقضت مهلة طلبك', ntfExpiredBody:'{place} — {day} {time} · ما وصل ردّ من الملعب، والخانة صارت متاحة لغيرك',
    // تحرّرت خانة كنت تنتظرها (ترحيل 20)
    ntfSlotFreeTitle:'فضيت الخانة اللي كنت مستنيها', ntfSlotFreeBody:'{place} — {day} {time} · احجزها قبل غيرك',
    ntfReason:'السبب: {r}',
    /* ── لوح متابعة الحجز على الرئيسية ── */
    trkPending:'بانتظار ردّ الملعب', trkConfirmed:'حجزك مؤكّد', trkTitle:'حجزك القادم',
    trkStarts:'يبدأ بعد', trkNow:'بدأت المباراة', trkSoon:'يبدأ الآن',
    trkD:'{n} يوم', trkH:'{n} ساعة', trkM:'{n} دقيقة',
    trkOpen:'تفاصيل الحجز', trkPendingHint:'أرسلنا طلبك؛ يظهر التأكيد هنا فور ردّ الملعب.',
    trkConfirmedHint:'خانتك محجوزة — احضر قبل الموعد بقليل.',
    servicesTitle:'الخدمات والمرافق', chooseFieldH:'اختر الملعب', chooseDay:'اختر اليوم', chooseTime:'اختر الوقت',
    available:'متوفرة', noServices:'لم تُضف معلومات عن الخدمات بعد.', noTimesDay:'اكتمل جدول هذا اليوم بالكامل — جرّب يوماً آخر قريباً منه.',
    /* حالة اليوم على زرّه. ⚠️ «باقي {n}» لا «{n} أوقات»: العدد يأتي **بعد** الاسم
       فلا يقع في مسألة المعدود العربي أصلًا (١ · ٢ · ٣-١٠ جمع · ١١+ مفرد منصوب)،
       ويصحّ مع أي رقم. والنصّ قصير لأن الزرّ 74px لا أكثر. */
    /* عنوان بطاقة الجلسة في «حسابي». ⚠️ لا بطاقة «دعم»: لا رقم دعم في التطبيق،
       واختراع واحد ممنوع (م5) — البطاقات الأربع كلّها أقسام موجودة فعلًا. */
    secSession:'الجلسة',
    dayFull:'ممتلئ', dayLeft:'باقي {n}',
    dayFullAria:'ممتلئ بالكامل', dayLeftAria:'باقي {n} من الأوقات',
    /* البديل الذكي حين يمتلئ اليوم — كلّه مشتقّ من نفس البيانات المعروضة */
    altTitle:'أقرب وقت متاح', altSameField:'في {field} يوم {day} الساعة {time}',
    altOtherField:'في {field} اليوم نفسه الساعة {time}',
    altGo:'انقلني إليه', altNone:'لا وقت متاح في هذا المكان خلال الأسبوع القادم.',
    locationBtn:'الموقع', callBtn:'اتصال', rateThisPlace:'قيّم هذا المكان', continueBooking:'متابعة الحجز', perTwoHours:'/ ساعتين', operatingHours:'الدوام:',
    reviewTitle:'مراجعة الطلب', stepField:'الملعب', stepDate:'اليوم', stepTime:'الوقت', stepConfirm:'التأكيد',
    rvDay:'اليوم', rvTime:'الوقت', rvDuration:'المدة', rvPrice:'السعر النهائي', rvName:'الاسم', rvPhone:'الهاتف', rvStatus:'الحالة', rvHost:'المضيف',
    rvSize:'حجم الملعب', rvTotal:'الإجمالي', rvWhen:'اليوم والوقت', rvField:'الملعب', rvYourInfo:'بياناتك', rvReadyNote:'جاهز للإرسال — سيُرسَل طلب الحجز عند التأكيد.',
    twoHours:'ساعتان', statusGuest:'ضيف', statusPlayer:'حساب لاعب مسجّل',
    bkNote:'الطلب يصل إدارة الملعب، ويتأكّد بعد موافقتهم. تابعه من «حجوزاتي».', confirmBooking:'أرسل الطلب', changeTime:'تغيير الموعد',
    authTitle:'خطوة أخيرة ويكتمل حجزك', authDesc:'سجّل دخولك أو أنشئ حساباً — اختيارك (الملعب واليوم والوقت) محفوظ وسنكمل من النقطة نفسها.',
    authBackEdit:'عودة لتعديل الموعد',
    navHome:'الرئيسية', navFav:'المفضّلة', navBookings:'حجوزاتي', navAccount:'حسابي', navOwner:'لوحتي',
    accountTitle:'حسابي', accountSub:'بيانات حساب اللاعب', saveEdit:'حفظ التعديل', logout:'تسجيل الخروج', rememberMe:'تذكّرني على هذا الجهاز',
    bookingsTitle:'حجوزاتي', bookingsSub:'كل حجوزاتك في مكان واحد',
    grpUpcoming:'الحجوزات القادمة', grpPending:'بانتظار التأكيد', grpPast:'الحجوزات السابقة', grpCancelled:'ملغاة / مرفوضة',
    otabToday:'اليوم', otabBookings:'الحجوزات', otabCalendar:'التقويم', otabFields:'الملاعب', otabReports:'التقارير',
    bkViewList:'قائمة', bkViewAria:'شكل عرض الحجوزات',
    reportsEntrySub:'الأرباح · الإشغال · الرسوم البيانية · المساعد الذكيّ', backToToday:'رجوع إلى اليوم',
    chooseFirst:'اختر الملعب أولاً.', chooseDayMsg:'اختر اليوم المناسب.', chooseTimeMsg:'اختر وقتاً متاحاً للمتابعة.',
    bookingConflict:'سبقك إليه فريق آخر قبل لحظات! اختر وقتاً آخر — ولا تتردد هذه المرة.',
    bookingSent:'وصل طلبك! الحجز الآن بانتظار تأكيد إدارة الملعب.', langSwitch:'EN', today:'اليوم', tomorrow:'غداً',
    noResultsTitle:'لا توجد نتائج مطابقة', noResultsSub:'حتى أفضل المهاجمين تفوتهم تسديدة — غيّر المنطقة أو السعر، أو امسح الفلاتر وحاول مجدداً.', noResultsSubPlain:'ما في ملاعب معروضة هلّق. اسحب الشاشة لتحديثها، أو جرّب رياضة ثانية.', clearFiltersBtn:'مسح كل الفلاتر',
    regionLbl:'المنطقة', filtersTitle:'الفلاتر والترتيب', filtersSub:'ضيّق نتائجك: المنطقة، السعر، الحجم، نوع الأرضية، أو التقييم.', addManual:'إضافة حجز خارجي', externalBooking:'حجز خارجي',
    apiTimeout:'استغرق الاتصال وقتاً أطول من المعتاد. حاول مرة أخرى.', apiError:'حدث خطأ في الاتصال، حاول مرة أخرى.', apiCached:'نعرض بيانات محفوظة مؤقتاً — قد تحتاج الأوقات إلى تحديث.', timesUpdateFail:'تعذّر تحديث الأوقات حالياً.',
    statusConfirmed:'مؤكد', statusPending:'قيد المعالجة', statusCancelled:'ملغى', statusRejected:'مرفوض', statusInProgress:'المباراة جارية الآن',
    ownerTitle:'لوحة المالك', exit:'خروج',
    otTodayLbl:'حجوزات اليوم', otPendingLbl:'بانتظار ردّك', otRevenueLbl:'إيراد اليوم المتوقّع', otFreeLbl:'أوقات متاحة اليوم',
    hintByPlayDate:'حسب تاريخ اللعب', hintTodayReq:'طلبات اليوم', hintConfToday:'المؤكد اليوم', hintBookable:'قابلة للحجز',
    externalDesc:'حجوزات واتساب أو الهاتف — أضفها هنا لإغلاق الوقت أمام اللاعبين.', todayRequests:'طلبات وحجوزات اليوم',
    filterBookings:'فلترة الحجوزات', searchNamePhone:'ابحث بالاسم أو رقم الهاتف…', allStatuses:'كل الحالات', allFields:'كل الملاعب',
    optPending:'بانتظار التأكيد', optConfirmed:'مؤكدة', optCancelled:'ملغاة', optRejected:'مرفوضة',
    bookingsWord:'الحجوزات', fullHistory:'عرض السجل الكامل', hideOld:'إخفاء القديمة', clearFilter:'مسح الفلتر',
    manageFields:'إدارة الملاعب', addFieldBtn:'إضافة ملعب',
    allBookings:'كل الحجوزات', hintAllReq:'كل الطلبات', confirmedLbl:'مؤكدة', hintInRevenue:'تدخل في الإيراد', pendingConfirm:'بانتظار التأكيد', hintNeedFollow:'تحتاج متابعة',
    revenueSummary:'ملخّص الإيراد', siteRevenue:'إيراد الموقع', platformProfit:'ربح المنصة', ownerNet:'صافي المالك',
    perfTitle:'مؤشّرات الأداء', confirmRate:'نسبة التأكيد', topField:'الملعب الأكثر حجزاً', topSource:'أفضل مصدر للحجوزات',
    econTitle:'الإحصائيات الاقتصادية', smartDecisions:'قرارات ذكية', occupancy:'معدّل الإشغال', hintBookedAvail:'المحجوز ÷ المتاح', lostRevenue:'إيراد ضائع', hintEmptyPrice:'الأوقات الفارغة × السعر', cancelRateLbl:'إلغاء / رفض', hintLessBetter:'كلما قلّت كان أفضل', bestTime:'الوقت الأكثر طلباً', hintForPricing:'مفيد للتسعير', siteShare:'حجوزات الموقع', hintDirectVsExt:'مباشر مقابل خارجي', returnRate:'معدّل العودة', hintSameNumber:'الرقم نفسه أكثر من مرة',
    pendingReply:'بانتظار ردّك', restToday:'بقية حجوزات اليوم', noBookingsToday:'لا حجوزات اليوم', noBookingsTodaySub:'لا حجوزات أو طلبات اليوم — استمتع بيومك، أو أضف حجزاً خارجياً عند الحاجة.', noBookingsDay:'لا حجوزات في هذا اليوم',
    actConfirm:'أكّد', actReject:'رفض', actCancel:'إلغاء', actWhatsapp:'واتساب', edit:'تعديل',
    actApprove:'قبول الطلب', actDecline:'رفض',
    fieldActive:'مُفعّل', fieldInactive:'موقوف', fieldEnabled:'تم تفعيل الملعب للاعبين', fieldDisabled:'تم إيقاف الملعب — لن يظهر للاعبين',
    dtabBook:'احجز', dtabAbout:'عن الملعب', dtabAmenities:'المرافق', dtabReviews:'التقييمات', ariaDetailTabs:'أقسام الملعب',
    noReviewsYet:'لا تقييمات بعد — كن أول من يقيّم', ratingsCount:'{n} تقييم',
    replySpeed:'عادةً يردّ خلال {t}',
    chartAria:'الأعلى {lbl} بـ{top}، والمتوسّط {avg}',
    pwTitle:'تغيير كلمة السر', pwSub:'لازم تكتب كلمة السر الحالية — هيك ما حدا يقدر يغيّرها لو وصل لهاتفك.',
    pwCur:'كلمة السر الحالية', pwNew:'كلمة السر الجديدة', pwNew2:'أعِد كلمة السر الجديدة', pwSave:'تغيير كلمة السر',
    pwNeedCur:'اكتب كلمة السر الحالية أول', pwTooShort:'كلمة السر الجديدة لازم 6 خانات على الأقل',
    pwMismatch:'الكلمتان مش نفسهن — تأكّد من الإعادة', pwSame:'الجديدة نفس القديمة — غيّرها',
    pwOk:'تم تغيير كلمة السر', pwFail:'ما قدرنا نغيّر كلمة السر، جرّب كمان مرة',
    confirmBookingTitle:'تأكيد الحجز', confirmBookingMsg:'هل تريد تأكيد هذا الحجز؟ سيصل اللاعب إشعار عبر واتساب.', reasonRequired:'السبب إلزامي — اكتب سبباً واضحاً للاعب',
    cancelReasonTitle:'سبب إلغاء الحجز', rejectReasonTitle:'سبب رفض الحجز', reasonHint:'اكتب السبب الذي سيظهر للاعب، وسيُجهَّز في رسالة واتساب (إلزامي).', confirmWord:'تأكيد',
    last7:'آخر 7 أيام', unknownPlace:'مكان غير معروف', loadingWord:'لحظة من فضلك…', loadingFields:'نجلب تفاصيل الملاعب…',
    tlCards:'بطاقات', tlTimeline:'مخطّط', tlViewAria:'شكل عرض اليوم', tlField:'الملعب',
    genderLbl:'لمن الملعب', gender_men:'رجال', gender_women:'سيدات', gender_mixed:'مشترك',
    tlFree:'فاضي', tlClosed:'مغلق', tlPast:'راح',
    tlPrevDay:'اليوم السابق', tlNextDay:'اليوم التالي', tlBackToday:'رجّعني لليوم',
    tlNoHours:'ما في أوقات معرّفة', tlNoHoursSub:'حدّد أوقات ملاعبك من تبويب «الملاعب» عشان يظهر المخطّط.',
    bpConfirmed:'{n} مؤكّدة من {all}',
    repByPlace:'كل مكان لحاله', repByPlaceSub:'المكان المعروض بالأعلى بس هو اللي بتشوف تفاصيله؛ هاي مقارنة سريعة بين أماكنك.',
    ownPlacesTitle:'أماكنك', ownPlacesSub:'اللوحة كلها بتتغيّر على المكان اللي بتختاره.',
    ownPlacesAria:'المكان المعروض — عندك {n}، اضغط للتبديل',
    vName:'يرجى كتابة اسمك', vPhone:'رقم الهاتف غير صحيح', vPhoneEmpty:'اكتب رقم هاتف صحيحاً', vPass:'اكتب كلمة السر', vNameAcc:'اكتب الاسم',
    loginNeed:'أدخل رقمك وكلمة السر', loginFailRetry:'تعذّر تسجيل الدخول، حاول مرة أخرى', loginBadData:'تأكد من الرقم وكلمة السر ثم حاول مجدداً', regFailRetry:'تعذّر إنشاء الحساب، حاول مرة أخرى', regFail:'تعذّر إنشاء الحساب', connLag:'تأخر الاتصال قليلاً، حاول مرة أخرى',
    accSaved:'تم حفظ تعديلات حسابك بنجاح.', saveErr:'حدث خطأ أثناء الحفظ',
    cancelOk:'تم إلغاء الحجز', cancelFail:'تعذّر الإلغاء', cancelErr:'حدث خطأ أثناء الإلغاء',
    updateFail:'تعذّر التحديث', updateErr:'حدث خطأ أثناء تحديث الحجز',
    manualNeed:'اختر الملعب واليوم والوقت', manualName:'اكتب اسم صاحب الحجز', manualPrice:'اكتب سعراً صحيحاً', manualOk:'تمت إضافة الحجز الخارجي', manualFail:'تعذّرت إضافة الحجز', manualErr:'حدث خطأ أثناء إضافة الحجز الخارجي', noFieldsAdded:'لا توجد ملاعب مضافة',
    fieldNeed:'أكمل بيانات الملعب', fieldOk:'تم حفظ الملعب', fieldFail:'تعذّر الحفظ', fieldErr:'حدث خطأ أثناء حفظ الملعب',
    reviewNeed:'اختر عدد النجوم أولاً', reviewOk:'شكراً لك، وصل تقييمك.', reviewFail:'تعذّر إرسال التقييم', reviewErr:'حدث خطأ أثناء إرسال التقييم',
    bookingFailRetry:'تعذّر إتمام الحجز، حاول مرة أخرى', bookingConnLag:'تأخر الاتصال قليلاً، حاول مرة أخرى.',
    welcomeHi:'أهلاً', welcomeYou:'بك',
    greetMorning:'صباح الخير', greetAfternoon:'مساء الخير', greetEvening:'مساء الخير',
    onbTitle:'احجز ملعبك بلا مكالمات', onbSub:'خمس رياضات في تطبيق واحد. ملاعب كرة القدم مفتوحة الآن، وبقيّتها قريباً.',
    onbAsPlayer:'لاعب', onbAsOwner:'صاحب ملعب', onbBrowse:'تصفّح الملاعب', onbHaveAccount:'لديّ حساب',
    onbCreateAccount:'إنشاء حساب جديد', onbOwnerEnter:'دخول لوحة المالك',
    onbOwnerNote:'أدِر ملاعبك وحجوزاتك وأسعارك من مكان واحد.', onbTerms:'بالمتابعة أنت توافق على الشروط وسياسة الخصوصية.',
    onbEyebrow:'حجز الملاعب الرياضية', introTag:'احجز ملعبك',
    /* شاشات الترحيب — أوّل تشغيل فقط. لا رقم ولا وعد.
       ⚠️ **الترتيب قصّة لا قائمة حقائق.** كان: فائدة ⇒ قيد ⇒ فائدة، فيقع
          «الحجز طلب ينتظر» في منتصف القمع مطبًّا بين بشارتين — وكانت الأولى
          والثالثة تقولان الشيء نفسه («شوف الفاضي والسعر») مرّتين. الآن ثلاث
          خطوات متتابعة: **تصفَّح ⇒ ابعث ⇒ يوصلك الردّ**. ولا حقيقة سقطت:
          «الحجز طلب يوافق عليه الملعب» ما زالت مكتوبةً بالحرف — لكنّها صارت
          **خاتمة المسار** لا عقبةً في وسطه: الردّ يصلك، لا أنت تنتظره. */
    onbS3T:'الملعب يوافق، وبنعلمك',
    onbS3B:'أوّل ما يردّوا بيوصلك خبر، وحالة طلبك دايماً في «حجوزاتي».',
    onbS4T:'ناقصك لاعبين؟',
    onbS4B:'انشر مقاعدك بعد تأكيد الملعب، واللي بالتطبيق بينضمّ.',
    onbSkip:'تخطٍّ', onbNext:'التالي', onbStart:'يلا نبلّش',
    onbDotsAria:'شاشات الترحيب', onbDotAria:'الشاشة {i} من {n}',
    moreAria:'خيارات أخرى', themeDarkVal:'ليلي', themeLightVal:'نهاري',
    repGroupOverview:'نظرة عامّة', repGroupPerf:'الأداء', repGroupInsights:'الاتجاه والتحليل',
    repRangeAria:'نطاق التقارير', repRangeAll:'الكل', repRange30:'آخر ٣٠ يوم', repRange90:'آخر ٩٠ يوم',
    successDone:'تمام!', successOkBtn:'تمام',
    noBookingsYet:'لا حجوزات لديك بعد', noBookingsYetSub:'ملعبك الأول بانتظارك، والشباك تنتظر أهدافك — ابدأ التصفّح!',
    loginToSee:'سجّل دخولك أولاً', loginToSeeSub:'يلزم تسجيل الدخول لعرض حجوزاتك ومتابعتها.', connProblem:'مشكلة في الاتصال', connProblemSub:'تعذّر جلب الحجوزات. تأكد من اتصالك بالإنترنت وحاول مجدداً.',
    noFieldsTitle:'لا توجد ملاعب', noFieldsSub:'أضف ملعبك الأول وابدأ باستقبال الحجوزات.', noMatchBookings:'لا حجوزات بهذه المواصفات', noMatchBookingsSub:'غيّر الفلتر أو التاريخ لعرض حجوزات أخرى.', fetchFail:'تعذّر جلب البيانات', fetchFailSub:'تأكد من اتصالك وحاول مجدداً.',
    manualTitle:'إضافة حجز خارجي', manualSub:'يُضاف مؤكداً مباشرة ويُغلق الوقت أمام اللاعبين.', fieldLbl:'الملعب', dayLbl:'اليوم', timeLbl:'الوقت', ownerNameLbl:'اسم صاحب الحجز', priceLbl:'السعر', saveBookingBtn:'حفظ الحجز',
    editFieldTitle:'تعديل ملعب', addFieldTitle:'إضافة ملعب جديد', fieldNameLbl:'اسم الملعب', sizeLbl:'الحجم', slotsLbl:'الأوقات', activeLbl:'نشط', saveBtn:'حفظ', slotFull:'Full — كل اليوم', slotMorning:'Morning — صباحي', slotEvening:'Evening — مسائي',
    cancelBookingBtn:'إلغاء الحجز', reasonPrefix:'السبب: ', reasonPlaceholder:'مثلاً: الوقت غير متاح أو لدينا صيانة…', reasonTitleDefault:'سبب التحديث', cancelWord:'إلغاء', backWord:'رجوع',
    rateModalTitle:'قيّم المكان', yourNamePh:'اسمك', phonePh:'رقم الهاتف', commentPh:'تعليق اختياري', submitReviewBtn:'إرسال التقييم',
    stAvailable:'متاح', stSelected:'مختار', stTaken:'محجوز', bookedTag:'محجوز',
    showPass:'إظهار كلمة السر', hidePass:'إخفاء كلمة السر', clearSearchAria:'مسح البحث',
    tmMorning:'صباحاً', tmNoon:'ظهراً', tmEvening:'مساءً',
    bookingSuccessTitle:'رائع! وصل طلب حجزك', statusPendingVenue:'بانتظار تأكيد الملعب', nextStepNote:'سنعلمك فور تأكيد إدارة الملعب لحجزك.',
    editProfile:'تعديل البيانات', prefsTitle:'التفضيلات', darkModeLbl:'الوضع الليلي', languageLbl:'اللغة',
    regionsEyebrow:'المناطق', regionsTitle:'المناطق المتوفّرة', regionsSub:'اختر منطقتك وابدأ التصفّح مباشرة.', regionsOne:'ملعب', regionsMany:'ملعب',
    reviewsEyebrow:'آراء', reviewsTitle:'ماذا يقول مستخدمونا',
    review1:'أسهل بكثير من الاتصالات — أرى الأوقات المتاحة وأرسل طلب الحجز خلال ثوانٍ.', review1by:'لاعب',
    review2:'نظّمتُ حجوزات ملاعبي وقلّ ضغط الرد على الاتصالات.', review2by:'صاحب ملعب',
    review3:'الواجهة واضحة، وأعرف تفاصيل الملعب وسعره قبل الاختيار.', review3by:'لاعب',
    ownersEyebrow:'لأصحاب الملاعب', ownersTitle:'أدِر ملاعبك باحتراف', ownersSub:'لوحة تحكم متكاملة لاستقبال الحجوزات وتنظيمها ومتابعة أداء ملاعبك.',
    ownersB1:'كل حجوزاتك في لوحة واحدة', ownersB2:'تأكيد أو رفض بضغطة واحدة مع إشعار واتساب', ownersB3:'تقارير إيراد وإشغال تساعدك على القرار', ownerCtaBtn:'دخول المالك',
    // ---- دفعة إكمال التوطين (نصوص ديناميكية + قوالب + وصولية) ----
    bkFetchFail:'تعذّر جلب الحجوزات', tryAgain:'حاول مرة أخرى.', noBookingsToShow:'لا توجد حجوزات لعرضها حالياً.',
    playerCancelTitle:'إلغاء الحجز', playerCancelHint:'{label} — اكتب سبب الإلغاء (اختياري)', confirmCancelBtn:'تأكيد الإلغاء', playerCancelledDefault:'ألغى اللاعب الحجز',
    loadingBookings:'نجلب الحجوزات…', sessionExpired:'انتهت جلستك، سجّل دخولك من جديد', dashRenderErr:'حدث خطأ أثناء عرض اللوحة',
    econMore:'كلما زادت البيانات أصبحت قراراتك أدق.', econLow:'الإشغال أقل من 40%: ركّز على التسويق والعروض.', econGood:'الإشغال بين 60% و80%: الوضع جيد، ثبّت السعر وراقب أوقات الذروة.', econHigh:'الإشغال فوق 85%: يمكنك رفع السعر، خصوصاً في أوقات الطلب المرتفع.',
    srcPrefix:'مصدر: ', cancelReasonPrefix:'سبب الإلغاء/الرفض: ',
    ownerActiveUpcoming:'الحجوزات الحالية والقادمة', noActiveUpcoming:'لا حجوزات حالية أو قادمة', ownerFinished:'الحجوزات المنتهية',
    completeSelection:'أكمل اختيار الموعد أولاً.', loginToSeeBookings:'سجّل دخولك لعرض حجوزاتك', avatarFallback:'م',
    amenFree:'مجاناً', amenPaid:'برسوم', amenNotAvail:'غير متوفرة',
    kwFull:'كل اليوم', kwMorning:'صباحي', kwEvening:'مسائي',
    amenity_water:'مياه', amenity_parking:'مواقف', amenity_ball:'كرة', amenity_vests:'فيزتات', amenity_bathrooms:'حمامات',
    waRejectedDefault:'نعتذر منك، هذا الوقت غير متاح حالياً.', waCancelledDefault:'أُلغي الحجز من إدارة الملعب.',
    waConfirmed:'مرحباً {name} ⚽\n\nتم تأكيد حجزك ✅\n\n🏟️ المكان: {place}\n🥅 الملعب: {field}\n📅 التاريخ: {date}\n⏰ الوقت: {time}\n📐 الحجم: {size}\n💰 السعر: {price}\n\nبانتظارك!',
    waRejected:'مرحباً {name} ⚽\n\nنعتذر، رُفض طلب الحجز ❌\n\n🏟️ {place} - {field}\n📅 {date} ⏰ {time}\n\nالسبب:\n{reason}',
    waCancelled:'مرحباً {name} ⚽\n\nأُلغي الحجز ❌\n\n🏟️ {place} - {field}\n📅 {date} ⏰ {time}\n\nالسبب:\n{reason}',
    docTitle:'المستديرة - احجز ملعبك', ariaBrand:'المستديرة', ariaPageLinks:'روابط الصفحة', ariaFooterLinks:'روابط أسفل الصفحة', ariaToggleTheme:'تبديل الوضع', ariaHome:'الصفحة الرئيسية',
    ariaChooseDate:'اختيار الموعد', ariaOwnerTabs:'أقسام لوحة المالك', ariaSearchBookings:'بحث في الحجوزات', ariaFilterDate:'فلترة بالتاريخ', ariaFilterField:'فلترة بالملعب', ariaFilterStatus:'فلترة بالحالة',
    calPrevAria:'الشهر السابق', calNextAria:'الشهر التالي', ariaBookingSteps:'خطوات الحجز', ariaRateLegend:'قيّم المكان من 1 إلى 5 نجوم',
    star1:'نجمة واحدة', star2:'نجمتان', star3:'3 نجوم', star4:'4 نجوم', star5:'5 نجوم',
    phRegName:'محمد أحمد', phRegPass:'6 خانات على الأقل', phAccName:'اسم اللاعب', phManualName:'أبو أحمد', phFieldName:'ملعب 1',
    placeStatsTitle:'إحصائيات الملعب',
    skipLink:'تخطَّ إلى المحتوى الرئيسي', offSiteBadge:'من خارج الموقع', welcomeGuest:'أهلاً بك',
    brandName:'المستديرة',
    addToCalendar:'أضِف إلى التقويم',
    favTab:'المفضّلة', favAdd:'أضِف إلى المفضّلة', favRemove:'أزل من المفضّلة',
    noFavsTitle:'لا ملاعب في المفضّلة بعد', noFavsSub:'لم يفز ملعبٌ بقلبك حتى الآن؟ اضغط رمز القلب على أي ملعب وسيحجز مكانه هنا.',
    repeatWeeksLbl:'كرّر أسبوعياً', repeatNone:'بلا تكرار (مرة واحدة)', repeatFor:'لمدة {n} أسابيع (نفس اليوم والوقت)',
    repeatSummary:'أُضيف {added} من الحجوزات، وتُخطّي {skipped} (وقت محجوز أو تعذّرت إضافته).',
    // ---- 🤖 ميزات الذكاء الاصطناعي (لوحة المالك) ----
    aiAdvisorTitle:'المستشار الذكي', aiBadge:'ذكاء اصطناعي', aiAdvisorSub:'تحليل لحجوزاتك وإشغالك وأسعارك يقترح خطوات عملية لزيادة أرباحك.',
    aiReviewTitle:'ملخّص التقييمات', aiReviewSub:'قراءة ذكية لتقييمات اللاعبين: ما الذي يعجبهم وما الذي يشتكون منه.',
    aiRegenerate:'تحديث التحليل', aiWeatherTitle:'تنبيه الطقس والتسعير',
    aiFail:'تعذّر توليد التحليل حالياً — جرّب «تحديث التحليل» بعد قليل.',
    aiNotConfigured:'المساعد الذكي لسّه ما اشتغل — والتوصيات تحت محسوبة من أرقامك أنت.',
    aiNotDeployed:'المساعد الذكي لسّه ما اشتغل — والتوصيات تحت محسوبة من أرقامك أنت.',
    aiNeedHistory:'عندك {n} من الأيام فيها حجوزات، والحدّ سبعة — أقلّ من ذلك صدفة لا نمط.',
    aiNoPlace:'حسابك غير مربوط بمكان بعد — لا أرقام تُحلَّل.',
    aiComputedLbl:'تحليل محسوب من أرقامك (بلا ذكاء اصطناعي)',
    /* جُمل التحليل المحسوب — كلٌّ منها من رقم مقيس، ولا واحدة منها تُنشَر
       بلا الرقم الذي يسندها. والعدد **بعد** الاسم فيصحّ مع أي رقم عربي. */
    ciOccT:'الإشغال', ciOccA:'إشغالك {occ}٪ من طاقتك في آخر ٣٠ يوماً. كل نقطة مئوية تساوي نحو {jod} د.أ شهرياً بمتوسّط سعرك الحالي.',
    ciCancelT:'الإلغاء مرتفع', ciCancelA:'{p}٪ من الطلبات انتهت إلغاءً أو رفضاً ({n} منها). راجع أوقاتاً تعرضها وهي غير متاحة فعلاً.',
    ciWeekT:'يومك الأضعف', ciWeekA:'{lo} أضعف أيامك ({a} من الحجوزات) مقابل {hi} ({b}). خصمٌ على اليوم الضعيف يملأ خانات لا تُباع أصلاً.',
    ciStaleT:'طلبات فات موعدها', ciStaleA:'{n} من الطلبات ما زالت معلّقة وقد مضى موعدها. الطلب المعلّق يحجز خانته ويمنع غيره ثم يضيع.',
    ciRetT:'العملاء العائدون', ciRetA:'{p}٪ من عملائك حجزوا أكثر من مرّة ({n} من {u}). العائد أرخص من الجديد بمراحل.',
    ciFreeT:'الأسبوع القادم', ciFreeA:'{n} من الخانات ما زالت فارغة في الأيام السبعة القادمة — وهي وحدها ما يمكن بيعه الآن.',
    wxT_danger:'أمطار متوقعة في الأيام القادمة', wxT_warn:'تقلبات جوية قادمة', wxT_info:'الأجواء مناسبة للعب',
    wxA_danger:'احتمال مطر مرتفع — ذكّر أصحاب الحجوزات، واعرض تغيير الموعد بدل الإلغاء.',
    wxA_warn:'احتمال مطر أو حرارة مرتفعة — تابع الطلبات المعلّقة مبكراً وأبقِ اللاعبين على اطلاع.',
    wxA_info:'الأجواء ممتازة خلال ٣ أيام — خصم بسيط على الخانات الفارغة قد يملؤها.',
    aiNoInsights:'لا توصيات بعد — كلما زادت الحجوزات صارت التوصيات أدق.',
    aiNoReviews:'لا تقييمات بعد — عندما يقيّم اللاعبون مكانك سيظهر الملخّص هنا.',
    aiPraises:'ما يمدحه اللاعبون', aiComplaints:'ما يشتكون منه',
    aiSentiment_positive:'انطباع إيجابي', aiSentiment_mixed:'انطباع متفاوت', aiSentiment_negative:'انطباع سلبي',
    aiReviewsCount:'{n} تقييم · متوسط {avg}★', aiUpdatedAt:'آخر تحديث: {time}',
    aiWeatherFail:'تعذّر جلب توقّعات الطقس.', aiRetry:'إعادة المحاولة',
    aiAutoAdvice:'نصيحة تلقائية', aiRainShort:'أمطار {n}%',
    // ---- تحسينات UX (السعر الدائم · عمر الطلب · أكّد+واتساب · شارة الجديد) ----
    chooseDayTimeHint:'اختر اليوم والوقت', actConfirmWa:'أكّد + واتساب',
    ageNow:'وصل الآن', ageMin:'منذ {n} د', ageHr:'منذ {n} س', ageDay:'منذ {n} يوم',
    newPendingToast:'🔔 وصل {n} طلب حجز جديد',
    // ---- (١) تعديل موعد الحجز — للحجوزات التي ما زالت بانتظار التأكيد ----
    rsBtn:'تعديل', rsTitle:'تعديل موعد الحجز',
    rsSub:'اختر يوماً ووقتاً جديدين. يبقى الحجز بانتظار تأكيد إدارة الملعب كما هو.',
    rsCurrentLbl:'موعدك الحالي', rsCurrentTag:'الحالي',
    rsSave:'حفظ الموعد الجديد', rsPickTime:'اختر وقتاً جديداً أولاً',
    rsOk:'تم تعديل موعد حجزك', rsFail:'تعذّر تعديل الموعد', rsErr:'حدث خطأ أثناء تعديل الموعد',
    rsNoField:'تعذّر جلب أوقات هذا الملعب — لا يمكن تعديل الموعد الآن.',
    rsNotReady:'تغيير الموعد من التطبيق لسّه ما اشتغل. كلّم إدارة الملعب وبيعدّلوه إلك.',
    // ---- (٢) ندرة الأوقات — تظهر فقط حين يبقى وقت أو وقتان فعلاً ----
    scarce1:'ما بقي إلا وقت واحد في هذا اليوم!', scarce2:'ما بقي إلا وقتان في هذا اليوم!',
    // ---- (٣) حذف الحساب ----
    dangerZone:'منطقة الخطر', delAccount:'حذف الحساب', delAccTitle:'حذف حسابك نهائياً؟',
    delAccMsg:'بيتسكّر حسابك ومرّة ثانية ما بتقدر تدخل فيه. ألغِ حجوزاتك القائمة قبل ما تكمّل — ما في تراجع.',
    delAccConfirm:'نعم، احذف حسابي', delAccOk:'تم حذف حسابك. نأسف لذهابك!',
    delAccFail:'تعذّر حذف الحساب', delAccErr:'حدث خطأ أثناء حذف الحساب',
    // ---- (٤) انقطاع الاتصال ----
    offTitle:'توقّفت الصافرة مؤقتاً', offSub:'يرجى التحقق من اتصالك بالإنترنت — نكمل المباراة فور عودته.',
    offDismiss:'تصفّح ما هو محمّل', onlineBack:'عاد الاتصال — أكمل اللعب!',
    // ---- (٥) تعديلات لم تُحفظ ----
    unsavedTitle:'تعديلات لم تُحفظ', unsavedMsg:'أدخلت بيانات لم تُحفظ بعد. تغلق النافذة وتتجاهلها؟',
    unsavedDiscard:'تجاهل وأغلق', unsavedKeep:'أكمل التعديل',
    // ---- (٦) السحب للتحديث ----
    ptrPull:'اسحب للتحديث', ptrRelease:'أفلت للتحديث', ptrLoading:'يجري التحديث…', ptrDone:'تم التحديث',
    // ---- (٧) شرائح التصفية اللاصقة ----
    fchipsAria:'الفلاتر المفعّلة', fchipRegion:'المنطقة: {v}', fchipPriceMin:'من {v}', fchipPriceMax:'إلى {v}',
    fchipSize:'الحجم: {v}', fchipType:'النوع: {v}', fchipRating:'{v}★ فأعلى', fchipRemove:'أزل {v}',
    // ---- (٨) شاشتا الدخول والتسجيل: شروط كلمة السرّ مكتوبة قبل أن تُخالَف ----
    loginEyebrow:'حسابك في المستديرة', regEyebrow:'حساب جديد',
    loginWelcome:'أهلاً بعودتك', regWelcome:'صار لك مكان بيننا',
    pwRulesTitle:'كلمة السر لازم تكون:',
    pwRuleLen:'6 خانات على الأقل', pwRuleLetter:'فيها حرف', pwRuleDigit:'فيها رقم',
    pwStrength:'قوّتها', pwLvl1:'ضعيفة', pwLvl2:'مقبولة', pwLvl3:'جيّدة', pwLvl4:'قويّة',
    pwShort6:'كلمة السر لازم 6 خانات على الأقل', pwNeedMix:'كلمة السر لازم يكون فيها حرف ورقم',
    phoneHint:'رقم أردني يبدأ بـ 07', capsOn:'مفتاح الحروف الكبيرة مفعّل',
    // ---- (٩) تأكيد رقم الهاتف ----
    vfTitle:'أكّد رقمك', vfEyebrow:'خطوة أخيرة',
    vfSub:'كتبنا كوداً من ست خانات وأرسلناه إلى {phone}. اكتبه هنا.',
    vfCodeAria:'كود التحقق — ست خانات', vfDigitAria:'الخانة {n}',
    vfVerify:'أكّد الرقم', vfResend:'أرسل الكود مرّة ثانية',
    // {rel} يأتي من Intl.RelativeTimeFormat ⇒ «بعد ثانيتين» و«بعد ٣ ثوانٍ» تصحّان معًا
    vfResendIn:'إعادة الإرسال {rel}', vfSending:'نرسل الكود…',
    vfSkip:'أكمل، وأكّد لاحقاً', vfNeedAll:'اكتب الخانات الستّ كلّها',
    vfOk:'تم تأكيد رقمك ✅', vfFail:'تعذّر التأكيد، جرّب كمان مرة',
    vfWhyTitle:'ليش نأكّد الرقم؟',
    vfWhy:'إدارة الملعب تتصل بك على هذا الرقم لتأكيد حجزك. رقمٌ بخانة غلط = حجز ما حدا يقدر يأكّده.',
    // الحالة الصادقة: لا مزوّد رسائل بعد ⇒ لا كود يصل، ولا نتظاهر بإرساله
    vfNoProviderTitle:'إرسال الأكواد غير مُفعّل بعد',
    vfNoProvider:'خدمة الرسائل لسا ما اتوصّلت. حسابك شغّال وبتقدر تحجز عادي.',
    vfNotReady:'تأكيد الرقم لسّه ما اشتغل — وما بيوقّفك: حسابك شغّال وتقدر تحجز عادي.',
    vfAlready:'رقمك مؤكَّد من قبل',
    vfContinue:'أكمل', vfTooSoon:'استنّى شوي قبل ما تطلب كود جديد',
    // شارة الحالة في «حسابي»
    accPhoneVerified:'رقم مؤكَّد', accPhoneUnverified:'رقم غير مؤكَّد', accVerifyNow:'أكّده الآن',
    // ---- (١٠) وسيلة الدفع ----
    payTitle:'طريقة الدفع', payMethodLbl:'الدفع', payWhyLink:'ليش ما في بطاقة؟',
    stepMinus:'أنقص', stepPlus:'زد',
    payCash:'نقداً في الملعب', payCashSub:'تدفع لإدارة الملعب لمّا توصل.',
    payCard:'بطاقة فيزا أو ماستركارد', payCardSoon:'قريباً',
    payCardSub:'الدفع بالبطاقة لسا ما اشتغل — بنشغّله أول ما تجهز بوّابة الدفع.',
    payCardWhy:'ولمّا يشتغل، الرقم بينكتب عند بوّابة الدفع — التطبيق ما بيشوفه ولا بيخزّنه.',
    payCardsTitle:'بطاقاتي', payNoCards:'ما في بطاقة محفوظة — الدفع كلّه نقداً في الملعب اليوم.',
    // ---- (١١أ) مهلة إلغاء اللاعب ----
    // القاعدة تُقال **في جملة التأكيد نفسها** لا في حاشية: من يقرأ حاشيةً بعد
    // أن ضغط «تأكيد» لم يعد أمامه قرار. و{h} من CONFIG.CANCEL_WINDOW_H وحده.
    cancelWindowHint:'بتقدر تلغي لحدّ {h} قبل بدء الموعد، وحجزك لسا داخل المهلة.',
    /* رموز حرّاس القاعدة (24 و25) — الجملة هنا لا في الصفّ */
    priceFromAria:'أقل سعر بالدينار', priceToAria:'أعلى سعر بالدينار',
    verOld:'في نسخة أحدث من التطبيق — نزّلها عشان كل الميزات تشتغل.', verCta:'نزّل', verClose:'إخفاء',
    errDatePast:'ما بنفع تحجز بتاريخ راح.', errFieldPlace:'هذا الملعب مش تابع لهذا المكان.',
    errHourSlot:'هذا الوقت مش من أوقات هذا الملعب.', errSlotClosed:'الملعب مسكّر هذا الوقت — اختار وقت ثاني.',
    errRvDup:'سبق وقيّمت هذا المكان اليوم.', errRvRate:'تقييمات كثيرة من هذا الرقم اليوم.',
    errRvPhone:'التقييم بدّه رقم هاتف.', errRvNoBooking:'ما بيقيّم المكان إلا اللي لعب فيه.',
    cancelTooLateTitle:'ما عاد ينفع تلغي من التطبيق',
    cancelTooLateSub:'باقي أقلّ من {h} على موعدك. إذا صار طارئ، احكِ مع الملعب مباشرة.',
    cancelTooLateNoPhone:'باقي أقلّ من {h} على موعدك. ما عنّا رقم هذا الملعب — لاقيه على صفحته.',
    cancelWindowServer:'ما عاد ينفع تلغي هذا الحجز: باقي أقلّ من {h} على موعده. احكِ مع الملعب مباشرة.',
    callVenue:'اتصل بالملعب', waVenue:'واتساب الملعب',
    // ---- (١١ب) انقضاء مهلة ردّ المالك ----
    expiredReason:'ما وصل ردّ من الملعب خلال المهلة، فانلغى الطلب وصارت الخانة متاحة لغيرك.',
    statusExpired:'انقضت المهلة',
    // {rel} من Intl.RelativeTimeFormat ⇒ «خلال ساعتين» و«خلال ٣ ساعات» تصحّان معاً
    deadlineLeft:'مهلة الردّ {rel}',
    deadlineOver:'فاتت مهلة الردّ',
    otSoonestFirst:'الأقرب لانقضاء مهلته أوّلاً',
    expirySweepNote:'الطلب اللي بتفوت مهلته بينلغي عند أوّل فتح للوحة — مش لحظة بلحظة — وبترجع خانته متاحة.',
    expirySweepOff:'ما في انتهاء تلقائي للطلبات — بتضلّ معلّقة لحدّ ما تردّ. وردّك السريع بيفضّي الخانة لغيره.',
    // ---- (١١ج) لم يحضر ----
    noShowBtn:'لم يحضر', noShowUndoBtn:'تراجع عن «لم يحضر»',
    noShowBadge:'لم يحضر',
    noShowAskTitle:'تسجيل عدم الحضور',
    noShowAskMsg:'بنسجّل إنّه ما حضر. الحجز بيضلّ مؤكّداً، والتحصيل بينك وبين اللاعب. وبتقدر تتراجع.',
    noShowUndoAskTitle:'تراجع عن «لم يحضر»',
    noShowUndoAskMsg:'رح نشيل علامة «لم يحضر» عن هذا الحجز، وبيرجع يُقرأ حضوراً عادياً في تقاريرك.',
    noShowOk:'تم التسجيل', noShowUndone:'تم التراجع',
    noShowTooEarly:'ما فينا نسجّل «لم يحضر» قبل ما ينتهي وقت الخانة.',
    noShowForbidden:'هذا الحجز مش تبع ملعبك.',
    noShowNotReady:'تسجيل «ما حضر» لسّه ما اشتغل عنّا. الحجز بيضلّ مؤكّداً، والتحصيل بينك وبين اللاعب.',
    noShowFail:'تعذّر الحفظ، جرّب كمان مرة',
    econNoShow:'لم يحضروا', econNoShowSub:'خانة انباعت وما انلعبت — لا هي ضائعة ولا هي إيراد عادي',
    // ---- (١٢أ) إغلاق يوم — ما يراه اللاعب ----
    dayClosed:'مغلق', dayClosedAria:'هذا اليوم مغلق',
    dayClosedTitle:'الملعب مغلق هذا اليوم',
    closedBecause:'السبب: {r}',
    closedNoReason:'إدارة الملعب أغلقته ولم تكتب سبباً.',
    stClosed:'مغلق', closedTag:'مغلق',
    slotClosedNow:'انسكّر هذا الوقت هلّق. اختار وقت ثاني.',
    // ---- (١٢أ) إغلاق يوم — لوحة المالك ----
    closeDayTitle:'إغلاق يوم', closeDayBtn:'أغلِق',
    closeFieldLbl:'الملعب', closeScopeLbl:'المدى',
    closeWholeDay:'اليوم كلّه', closeSomeHours:'ساعات منه',
    closeFromLbl:'من الساعة', closeToLbl:'حتى الساعة',
    closeReasonLbl:'السبب — يقرؤه اللاعبون', closeReasonPh:'صيانة الأرضية',
    closeReasonWhy:'يوم مظلم بلا سبب يُقرأ عطلاً في التطبيق. اكتب سبباً قصيراً.',
    closeOpenBtn:'أغلِق يوماً', closeReopenBtn:'أعِد فتحه',
    closeStateOpen:'هذا اليوم مفتوح',
    closeStateClosed:'مغلق — {r}', closeStateClosedNoReason:'مغلق بلا سبب مكتوب',
    closeStateHours:'مغلق {from} – {to}',
    closeOk:'تم الإغلاق', closeReopened:'رجع اليوم مفتوحاً',
    closeConflictTitle:'ما بنفع تسكّر — في حجوزات مؤكّدة',
    closeConflictSub:'ألغِهم أوّلاً (بيوصلهم إشعار) بعدين سكّر اليوم.',
    closePendingWarn:'وفي طلبات معلّقة على هذا اليوم — ردّ عليها.',
    closeForbidden:'هذا الملعب مش تابع لحسابك.',
    closePast:'ما بتقدر تسكّر يوماً راح.',
    closeNotReady:'إغلاق الأيام لسّه ما اشتغل عنّا. لأي ظرف طارئ، تواصل مع أصحاب الحجوزات مباشرة.',
    closeFail:'تعذّر الحفظ، جرّب كمان مرة',
    closeNeedHours:'اختار ساعة البداية والنهاية.',
    // ---- (١٢ب) التسعير ----
    pricingTitle:'تسعير الساعات', pricingBtn:'التسعير',
    priceRuleNote:'هذا سعر هذا الوقت تحديداً. السعر الأساسي للملعب {base}.',
    priceChanged:'تغيّر السعر بين ما فتحت الشاشة وما بعت الطلب: كان {from} وصار {to}. الرقم المسجَّل هو الثاني.',
    ruleDaysLbl:'الأيام — بلا اختيار = كل الأيام',
    ruleFromLbl:'من الساعة', ruleToLbl:'حتى الساعة',
    rulePriceLbl:'السعر', rulePriorityLbl:'الأولوية',
    ruleAddBtn:'أضِف القاعدة', ruleDelBtn:'احذف',
    ruleNone:'ما في قواعد. كل الساعات بالسعر الأساسي.',
    ruleAllDays:'كل الأيام', ruleAllHours:'كل الساعات',
    ruleNeedPrice:'اكتب سعراً.', ruleNeedHours:'اختار ساعة البداية والنهاية، أو خلّيهما فاضيتين للكل.',
    ruleAdded:'تمت إضافة القاعدة', ruleDeleted:'تم حذف القاعدة',
    ruleFail:'تعذّر الحفظ، جرّب كمان مرة',
    pricingNotReady:'التسعير بالساعة لسّه ما اشتغل عنّا — وسعر ملعبك الأساسي شغّال على كل الساعات عادي.',
    priceGridTitle:'النتيجة — سبعة أيام',
    priceGridSub:'هذا ما سيراه اللاعب فعلاً. الفارغ = السعر الأساسي للملعب.',
    priceGridBase:'الأساسي {v}',
    closeWord:'إغلاق',
    // ---- (١٣) بدائل خانة محجوزة ----
    altAskTitle:'هذا الوقت محجوز',
    altAskSub:'كنت تدوّر على {day} الساعة {time}. هاي أقرب البدائل الموجودة فعلاً:',
    altSheetNone:'ما في بديل قريب لهذا الوقت. جرّب وقتاً أو مكاناً ثانياً.',
    altKindField:'نفس الوقت — على {f}',
    altKindHour:'نفس اليوم — أقرب وقت فاضي',
    altKindDay:'نفس الوقت — يوم {d}',
    altKindPlace:'نفس الوقت — في {p}',
    watchBtn:'نبّهني إذا فضيت',
    watchDone:'رح ننبّهك',
    watchOk:'سجّلنا طلبك. إذا انلغى هذا الحجز بنبعثلك إشعار.',
    watchFail:'تعذّر التسجيل، جرّب كمان مرة',
    watchNotReady:'التنبيه لسّه ما اشتغل عنّا. تابع أوقات هذا الملعب من صفحته — بتتحدّث أوّل بأوّل.',
    // ---- (١٤) المباريات المفتوحة ----
    modeAria:'ملاعب أو مباريات', modeVenues:'ملاعب', modeGames:'مباريات',
    modeGamesTitle:'مباريات ناقصها لاعبين',
    gmPickTitle:'نوع المباراة',
    gmPrivate:'مباراة خاصّة', gmPrivateSub:'شبابك معك، وما حدا بيشوف الحجز.',
    gmOpen:'مباراة مفتوحة', gmOpenSub:'ناقصك لاعبين؟ انشر مقاعدك للي بالتطبيق.',
    oeTitle:'ناقصك لاعبين؟', oeSub:'مقاعدك بتتعرض بعد ما يأكّد الملعب.',
    guestNeedAcct:'بتحتاج حساب لإرسال الطلب',
    gmNeeded:'العدد المطلوب', gmBrought:'كم لاعب معك الآن (بما فيك)',
    gmLiveBad:'اكتب عدداً صحيحاً: المطلوب اثنان فأكثر، واللي معك ما بيزيد عنه.',
    gmLiveSeats:'بتنشر {noun}.',
    // ⚠️ «تقديرية» و«لإدارة الملعب» كلمتان لا تُحذفان: التطبيق لا يقبض ولا يضمن
    gmLiveShare:'حصّة الواحد تقديرياً {v} — تتدفع في الملعب لإدارته.',
    gmShareTag:'تقديري',
    /* شرط الرقم يُقال معه لا تحته: الحصّة = السعر ÷ العدد المطلوب، وهي صحيحة
       **فقط إذا امتلأت المقاعد**. ومن انضمّ إليه ثلاثة من ثمانية يدفع الباقي،
       وهو يقرّر على أساس الرقم الصغير. سطران لا فقرة تحذير. */
    gmShareCond:'الحصّة محسوبة إذا اكتمل العدد. ما ينقص بتدفعه إنت.',
    gmBadgeLive:'مباراة مفتوحة', gmBadgeWaiting:'مفتوحة — بعد التأكيد',
    gmCardLive:'منشورة · نشرتَ {n} مقعد. افتح «إدارة المباراة» تشوف مين انضمّ.',
    gmCardWaiting:'ما انعرض ولا مقعد. المقاعد بتنشر لحظة ما يأكّد الملعب.',
    gmManage:'إدارة المباراة',
    matchManageTitle:'مباراتك المفتوحة', matchPlayers:'اللي انضمّوا',
    matchCloseSeats:'العدد اكتمل — سكّر المقاعد', matchMakePrivate:'رجّعها مباراة خاصّة',
    gmSeatsState:'باقي {noun} · انضمّ {joined}',
    gmNoPlayersYet:'ما انضمّ حدا بعد.',
    gmRemove:'أخرِجه', gmRemoveTitle:'إخراج لاعب',
    gmRemoveMsg:'رح نشيل {n} وبيوصله إشعار، وبيرجع مقعده متاح.',
    gmRemoved:'تم إخراجه', gmSaved:'تم الحفظ',
    gmSeatsClosed:'سكّرنا المقاعد. المباراة ما عادت تظهر لغيرك.',
    gmNowPrivate:'رجعت مباراة خاصّة.',
    gmHostIs:'المضيف: {n}', gmHostUnknown:'لاعب',
    gmJoinBtn:'انضمّ', gmYouIn:'إنت داخل هالمباراة', gmYouParticipant:'مشارك',
    grpJoined:'مباريات انضممت لها',
    gmLeaveBtn:'انسحب', gmLeaveTitle:'تنسحب من المباراة؟',
    gmLeaveMsg:'بيرجع مقعدك متاح وبيوصل المضيف إشعار. وإذا المباراة قريبة، صعب يلاقوا بديل.',
    gmLeft:'انسحبت من المباراة', gmJoined:'انضممت! نشوفك بالملعب.',
    gmNoneTitle:'ما في مباريات مفتوحة هلّق',
    gmNoneSub:'لمّا يحجز حدا وينقصه لاعبين بتلاقي مباراته هون. وإنت كمان بتقدر تفتح وحدة وقت ما تحجز.',
    gmNoneCta:'تصفّح الملاعب',
    gmLoadFail:'تعذّر جلب المباريات',
    joinTitle:'تنضمّ لهذه المباراة؟', joinConfirm:'انضمّ',
    joinTermShare:'حصّتك التقديرية {v} — تدفعها في الملعب.',
    joinTermPay:'التطبيق ما بيقبض ولا بيحوّل ولا بيضمن. الحساب بينكم.',
    joinTermLate:'ما بتقدر تيجي؟ انسحب بدري — مقعدك بيضلّ فاضي عليهم.',
    joinTermNames:'أسماء أولى بس. ما في أرقام ولا محادثة داخل التطبيق.',
    joinTermOff:'إذا ألغى المضيف أو رفض الملعب، بتنتهي قبل ما تبلّش وبيوصلك إشعار — وما دفعت إشي.',
    joinTermLeave:'بتقدر تنسحب بأي وقت من «حجوزاتي» — ومقعدك بيرجع فوراً.',
    gmOwnerUpTo:'حتى {n} من اللاعبين', gmOwnerNote:'مسؤوليتك ما تغيّرت: حجز واحد وصاحب حجز واحد، وهو اللي بيدفع. وترتيب اللاعبين بينهم.',
    gmNotReady:'المباريات المفتوحة لسّه ما فتحت عنّا. احجز ملعبك عادي، ولمّا تفتح رح تلاقيها هون.',
    gmErrGeneric:'صار خطأ، حاول كمان مرة',
    gmErrAuth:'سجّل دخولك أول', gmErrMissing:'ما لقينا هالمباراة',
    gmErrNotOpen:'هالمباراة ما عادت مفتوحة', gmErrPast:'موعد المباراة راح',
    gmErrHost:'إنت صاحب هالحجز', gmErrFull:'المقاعد اكتملت — سبقك غيرك',
    gmErrForbidden:'هالمباراة مش تبعك', gmErrCounts:'الأعداد ناقصة',
    gmErrInactive:'حسابك موقوف — تواصل معنا', gmErrClash:'عندك مباراة ثانية بنفس الوقت',
    gmErrBelow:'ما بتقدر تنزّل العدد تحت اللي انضمّوا. انضمّ {n}، وأقلّ عدد مسموح {min}.',
    gmErrHasPlayers:'ما بتقدر ترجّعها خاصّة وفي {n} انضمّوا. أخرِجهم أوّلاً أو خلّيها مفتوحة.',
    // ---- إشعارات المباريات (ترحيل 22) ----
    ntfGameJoinedTitle:'انضمّ لاعب لمباراتك', ntfGameJoinedBody:'{who} · {place} — {day} {time} · باقي {seats}',
    ntfGameLeftTitle:'انسحب لاعب من مباراتك', ntfGameLeftBody:'{who} · {place} — {day} {time} · باقي {seats}',
    ntfGameFullTitle:'اكتمل عدد مباراتك', ntfGameFullBody:'{place} — {day} {time} · ما عاد في مقاعد',
    ntfGameOffTitle:'مباراة كنت داخلها انلغت', ntfGameOffBody:'{place} — {day} {time}',
  },
  en: {
    brandTag:'Your field, seconds away', nav_features:'Features', nav_how:'How it works', nav_stats:'Stats',
    login:'Log in', register:'Create account', startNow:'Get started', browseFields:'Browse fields',
    heroBadge:'Sports venue booking platform', heroTitlePre:'Skip the calls — book your venue with',
    heroSearchPh:'Search for a field or area…', heroSearchBtn:'Search',
    heroSearchPrefix:'Search for',
    heroSearchWords:['a nearby field','an area','an available time','a 5-a-side field','a 7-a-side field'],
    heroSub:'See what is free and what it costs, send your request, and follow the reply.',
    ownerLink:'Own a field? Your dashboard is ready here', statPlaces:'Available fields', statEasy:'Easy', statEasyLbl:'No phone calls',
    statAnytime:'Browse anytime', statFree:'Free', statFreeLbl:'No browsing fees',
    featuresEyebrow:'Features', featuresTitlePre:'Why', featuresTitleBrand:'Al-Mostadeera?',
    featuresSub:'Everything you need to book easily — and everything an owner needs to manage fields professionally.',
    feat1Title:'From browsing to booking in a minute', feat1Text:'See what is free, pick your day and time, send your request.',
    feat2Title:'Know the field before you go', feat2Text:'Location, price, amenities, surface type and player ratings — clear info before you choose.',
    feat3Title:'Clear booking follow-up', feat3Text:'From your account, track the booking status and the field’s confirmation, and contact them when a channel is available.',
    howEyebrow:'How it works', howTitlePre:'3 steps and you are', howTitleHi:'ready to play',
    tickerNoCall:'Book without phone calls', tickerClear:'Clear times & prices', tickerFollow:'Track your booking step by step', tickerNoAccount:'Browse without an account',
    chartsTitle:'Charts', chartRevenue:'Daily revenue (confirmed)', chartOccupancy:'Occupancy', chartHours:'By hour', last7short:'Last 7 days',
    step1Title:'Browse & choose', step1Text:'Open the fields list and compare by area, price and rating — then pick your field.',
    step2Title:'Pick the time', step2Text:'Choose the day and available time that suits you from the times table.',
    step3Title:'Send & follow up', step3Text:'Send the booking request and follow up its confirmation with the field — ready to play!',
    calloutTitle:'Ready to book your next field?', calloutSub:'Start without an account, or sign in to follow your bookings.',
    startFree:'Start free', haveField:'I own a field', footerLogin:'Log in', footerOwner:'Owner login',
    footerCopy:'© 2026 Al-Mostadeera — All rights reserved.',
    loginTitle:'Player login', loginSubtitle:'Log in to see and track your bookings', phone:'Phone number', password:'Password',
    enter:'Log in', browseNoAccount:'Browse without an account', haveAccount:'I have an account', name:'Name',
    regTitle:'Create account', regSubtitle:'Save your bookings and track them anytime', createAccount:'Create account',
    ownerLoginTitle:'Owner login', ownerLoginSubtitle:'Fields and bookings dashboard', back:'Back',
    searchPh:'Type a place or area name…', search:'Search', availableFields:'Available fields', refresh:'Refresh',
    filters:'Filters', sortLabel:'Sort', sportLbl:'Sport', all:'All', allRegions:'All regions', priceJod:'Price (JOD)',
    from:'From', to:'To', fieldSize:'Field size', type:'Type', rating:'Rating', availableToday:'Available today only',
    amenities:'Amenities', apply:'Apply', clearAll:'Clear all', noData:'No data',
    sortDefault:'Default', sortPriceAsc:'Lowest price', sortPriceDesc:'Highest price', sortRating:'Top rated', sortReviews:'Most reviews', sortSoonest:'Soonest time',
    availToday:'Available today', availLater:'Available later', availFull:'Fully booked today', availNone:'No times',
    unavailableBadge:'Unavailable', priceFrom:'From', priceRange:'By field',
    viewModeAria:'View mode', viewGrid:'Grid view', viewList:'List view',
    viewTimes:'View times', chooseField:'Choose field', oneField:'One field', fieldsCount:'{n} fields',
    bookCta:'Book now',
    fieldExtrasTitle:'Specs and photos', fieldPhotos:'Field photos',  lbOpen:'Enlarge photo {i}', lbPrev:'Previous photo', lbNext:'Next photo', lbClose:'Close',
    sportsAria:'Choose a sport', sportFootball:'Football', sportPadel:'Padel', sportBasket:'Basketball', sportTennis:'Tennis', sportVolley:'Volleyball', soonBadge:'Soon',
    comingSoonTitle:'Coming soon!', comingSoonSub:'{sport} venues are warming up in the locker room — hitting the pitch soon.', backToFootball:'Show football fields',
    sportsHint:'What is open is what has registered pitches; “soon” is waiting for its first one.',
    backToSport:'Show {sport} venues',
    specsTitle:'Field specs',
    specL_enclosure:'Setting', spec_enclosure_outdoor:'Outdoor', spec_enclosure_indoor:'Indoor hall', spec_enclosure_covered:'Covered',
    specL_lights:'Lighting', spec_lights_yes:'Floodlights',
    specL_seating:'Seating', spec_seating_yes:'Spectator seating',
    specL_surface:'Surface',
    spec_surface_grass_synthetic:'Synthetic grass', spec_surface_grass_natural:'Natural grass',
    spec_surface_rubber:'Rubber', spec_surface_sand:'Sand',
    spec_surface_parquet:'Parquet', spec_surface_pu:'Polyurethane', spec_surface_asphalt:'Asphalt',
    spec_surface_hard:'Hard court', spec_surface_clay:'Clay', spec_surface_grass:'Grass',
    spec_surface_carpet:'Carpet', spec_surface_indoor_court:'Indoor court floor', spec_surface_beach_sand:'Beach sand',
    specL_court:'Court type',
    spec_court_double:'Doubles', spec_court_single:'Singles',
    spec_court_full:'Full court', spec_court_half:'Half court',
    specL_walls:'Walls', spec_walls_glass:'Glass', spec_walls_mesh:'Mesh', spec_walls_mixed:'Glass & mesh',
    specL_panoramic:'View', spec_panoramic_yes:'Panoramic',
    specL_rackets:'Rackets', spec_rackets_free:'Rackets included', spec_rackets_paid:'Rackets for a fee',
    specL_hoop:'Hoop', spec_hoop_standard:'Regulation height (3.05m)', spec_hoop_adjustable:'Adjustable height',
    specL_net:'Net', spec_net_men:'Men’s net (2.43m)', spec_net_women:'Women’s net (2.24m)',
    spec_net_mixed:'Mixed net', spec_net_youth:'Youth net',
    notifsTitle:'Notifications', notifsAria:'Notifications', notifsEmpty:'No notifications yet',
    notifsEmptySub:'The venue’s reply to your request lands here — and new booking requests land with the venue owner.',
    notifsMarkAll:'Mark all as read', notifsNew:'New',
    notifsOff:'Follow your request under “My bookings”',
    notifsOffSub:'Notifications are not running yet. Every request and every venue reply stays up to date under “My bookings”.',
    notifsPermTitle:'Turn on notifications', notifsPermAsk:'We’ll tell you the moment the venue replies to your request.',
    ntfGroupYesterday:'Yesterday', ntfGroupOlder:'Earlier',
    ntfNewTitle:'New booking request', ntfNewBody:'{name} — {field} · {day} {time}',
    ntfConfirmedTitle:'Your booking is confirmed', ntfConfirmedBody:'{place} — {field} · {day} {time}',
    ntfRejectedTitle:'The venue declined your request', ntfRejectedBody:'{place} — {day} {time}',
    ntfCancelledTitle:'Your booking was cancelled', ntfCancelledBody:'{place} — {day} {time}',
    ntfMovedTitle:'A booking was moved', ntfMovedBody:'{name} — {field} · now {day} {time}',
    ntfExpiredTitle:'Your request timed out', ntfExpiredBody:'{place} — {day} {time} · the venue did not reply, and the slot is open again',
    ntfSlotFreeTitle:'A slot you were waiting for is free', ntfSlotFreeBody:'{place} — {day} {time} · book it before someone else does',
    ntfReason:'Reason: {r}',
    trkPending:'Awaiting the venue’s reply', trkConfirmed:'Booking confirmed', trkTitle:'Your next booking',
    trkStarts:'Starts in', trkNow:'Kick-off has passed', trkSoon:'Starting now',
    trkD:'{n}d', trkH:'{n}h', trkM:'{n}m',
    trkOpen:'Booking details', trkPendingHint:'Your request was sent; the confirmation shows up here as soon as the venue replies.',
    trkConfirmedHint:'Your slot is held — get there a little early.',
    servicesTitle:'Services & Amenities', chooseFieldH:'Choose the field', chooseDay:'Choose the day', chooseTime:'Choose the time',
    available:'Available', noServices:'No services information has been added yet.', noTimesDay:'This day is fully booked — try another one nearby.',
    secSession:'Session',
    dayFull:'Full', dayLeft:'{n} left',
    dayFullAria:'fully booked', dayLeftAria:'{n} times left',
    altTitle:'Nearest free time', altSameField:'On {field}, {day} at {time}',
    altOtherField:'On {field}, same day at {time}',
    altGo:'Take me there', altNone:'No time is free at this venue in the next week.',
    locationBtn:'Location', callBtn:'Call', rateThisPlace:'Rate this place', continueBooking:'Continue booking', perTwoHours:'/ 2 hours', operatingHours:'Hours:',
    reviewTitle:'Review request', stepField:'Field', stepDate:'Day', stepTime:'Time', stepConfirm:'Confirm',
    rvDay:'Day', rvTime:'Time', rvDuration:'Duration', rvPrice:'Final price', rvName:'Name', rvPhone:'Phone', rvStatus:'Status', rvHost:'Host',
    rvSize:'Field size', rvTotal:'Total', rvWhen:'Day & time', rvField:'Field', rvYourInfo:'Your details', rvReadyNote:'Ready to submit — your booking request will be sent when you confirm.',
    twoHours:'2 hours', statusGuest:'Guest', statusPlayer:'Registered player',
    bkNote:'Your request reaches the venue and is confirmed once they approve. Follow it under “My bookings”.', confirmBooking:'Send request', changeTime:'Change time',
    authTitle:'One last step to finish booking', authDesc:'Log in or create an account — your selection (field, day and time) is saved and we’ll continue from the same point.',
    authBackEdit:'Back to edit time',
    navHome:'Home', navFav:'Favorites', navBookings:'Bookings', navAccount:'Account', navOwner:'Dashboard',
    accountTitle:'My account', accountSub:'Player account details', saveEdit:'Save changes', logout:'Log out', rememberMe:'Remember me on this device',
    bookingsTitle:'My bookings', bookingsSub:'All your bookings in one place',
    grpUpcoming:'Upcoming bookings', grpPending:'Awaiting confirmation', grpPast:'Past bookings', grpCancelled:'Cancelled / Rejected',
    otabToday:'Today', otabBookings:'Bookings', otabCalendar:'Calendar', otabFields:'Fields', otabReports:'Reports',
    bkViewList:'List', bkViewAria:'Bookings view',
    reportsEntrySub:'Profit · occupancy · charts · AI advisor', backToToday:'Back to Today',
    chooseFirst:'Choose the field first.', chooseDayMsg:'Choose a suitable day.', chooseTimeMsg:'Choose an available time to continue.',
    bookingConflict:'Another team beat you to it moments ago! Pick another time — and don’t hesitate twice.',
    bookingSent:'Your request was sent! It awaits the field’s confirmation.', langSwitch:'العربية', today:'Today', tomorrow:'Tomorrow',
    noResultsTitle:'No matching fields', noResultsSub:'Even the best strikers miss a shot — change the area or price, or clear the filters and try again.', noResultsSubPlain:'Nothing on show right now. Pull to refresh, or try another sport.', clearFiltersBtn:'Clear all filters',
    regionLbl:'Region', filtersTitle:'Filters & sorting', filtersSub:'Narrow your results: region, price, size, surface type, or rating.', addManual:'Add external booking', externalBooking:'External booking',
    apiTimeout:'The connection took longer than expected. Please try again.', apiError:'A connection error occurred, please try again.', apiCached:'Showing temporarily cached data; times may need refreshing.', timesUpdateFail:'Couldn’t update the times right now.',
    statusConfirmed:'Confirmed', statusPending:'Processing', statusCancelled:'Cancelled', statusRejected:'Rejected', statusInProgress:'Playing now',
    ownerTitle:'Owner dashboard', exit:'Exit',
    otTodayLbl:'Today’s bookings', otPendingLbl:'Awaiting your reply', otRevenueLbl:'Expected revenue today', otFreeLbl:'Free slots today',
    hintByPlayDate:'By play date', hintTodayReq:'Today’s requests', hintConfToday:'Confirmed today', hintBookable:'Bookable',
    externalDesc:'WhatsApp or phone bookings — add them here to block the time for players.', todayRequests:'Today’s requests & bookings',
    filterBookings:'Filter bookings', searchNamePhone:'Search by name or phone...', allStatuses:'All statuses', allFields:'All fields',
    optPending:'Awaiting confirmation', optConfirmed:'Confirmed', optCancelled:'Cancelled', optRejected:'Rejected',
    bookingsWord:'Bookings', fullHistory:'Show full history', hideOld:'Hide old bookings', clearFilter:'Clear filter',
    manageFields:'Manage fields', addFieldBtn:'Add field',
    allBookings:'All bookings', hintAllReq:'All requests', confirmedLbl:'Confirmed', hintInRevenue:'Counted in revenue', pendingConfirm:'Awaiting confirmation', hintNeedFollow:'Need follow-up',
    revenueSummary:'Revenue summary', siteRevenue:'Site revenue', platformProfit:'Platform profit', ownerNet:'Owner net',
    perfTitle:'Performance', confirmRate:'Confirmation rate', topField:'Most booked field', topSource:'Top booking source',
    econTitle:'Economic stats', smartDecisions:'Smart decisions', occupancy:'Occupancy', hintBookedAvail:'Booked ÷ available', lostRevenue:'Lost revenue', hintEmptyPrice:'Empty slots × price', cancelRateLbl:'Cancel / reject', hintLessBetter:'The lower the better', bestTime:'Peak time', hintForPricing:'Useful for pricing', siteShare:'Site bookings', hintDirectVsExt:'Direct vs external', returnRate:'Return rate', hintSameNumber:'Same number more than once',
    pendingReply:'Awaiting your reply', restToday:'Rest of today’s bookings', noBookingsToday:'No bookings today', noBookingsTodaySub:'No bookings or requests for today. Enjoy your day or add an external booking.', noBookingsDay:'No bookings on this day',
    actConfirm:'Confirm', actReject:'Reject', actCancel:'Cancel', actWhatsapp:'WhatsApp', edit:'Edit',
    actApprove:'Approve', actDecline:'Decline',
    fieldActive:'Active', fieldInactive:'Off', fieldEnabled:'Field is now visible to players', fieldDisabled:'Field turned off — hidden from players',
    dtabBook:'Book', dtabAbout:'About', dtabAmenities:'Facilities', dtabReviews:'Reviews', ariaDetailTabs:'Venue sections',
    noReviewsYet:'No reviews yet — be the first to rate', ratingsCount:'{n} reviews',
    replySpeed:'Usually replies within {t}',
    chartAria:'Highest {lbl} at {top}, average {avg}',
    pwTitle:'Change password', pwSub:'Your current password is required — so nobody can change it just by picking up your phone.',
    pwCur:'Current password', pwNew:'New password', pwNew2:'Repeat new password', pwSave:'Change password',
    pwNeedCur:'Enter your current password first', pwTooShort:'New password must be at least 6 characters',
    pwMismatch:'The two entries do not match', pwSame:'New password is the same as the old one',
    pwOk:'Password changed', pwFail:"Couldn't change the password — please try again",
    confirmBookingTitle:'Confirm booking', confirmBookingMsg:'Confirm this booking? The player will get a WhatsApp notification.', reasonRequired:'A reason is required — write a clear reason for the player',
    cancelReasonTitle:'Cancellation reason', rejectReasonTitle:'Rejection reason', reasonHint:'Write the reason shown to the player (prepared as a WhatsApp message, required).', confirmWord:'Confirm',
    last7:'Last 7 days', unknownPlace:'Unknown place', loadingWord:'Loading...', loadingFields:'Loading field details...',
    tlCards:'Cards', tlTimeline:'Timeline', tlViewAria:'Today view mode', tlField:'Field',
    genderLbl:'Who it is for', gender_men:'Men', gender_women:'Women', gender_mixed:'Mixed',
    tlFree:'Free', tlClosed:'Closed', tlPast:'Past',
    tlPrevDay:'Previous day', tlNextDay:'Next day', tlBackToday:'Back to today',
    tlNoHours:'No hours defined', tlNoHoursSub:'Set your field hours from the “Fields” tab and the timeline will appear.',
    bpConfirmed:'{n} confirmed of {all}',
    repByPlace:'Venue by venue', repByPlaceSub:'The venue picked above is the one you see in detail; this is a quick comparison across yours.',
    ownPlacesTitle:'Your venues', ownPlacesSub:'The whole dashboard follows the venue you pick.',
    ownPlacesAria:'Shown venue — you have {n}, tap to switch',
    vName:'Enter your name', vPhone:'Invalid phone number', vPhoneEmpty:'Enter a valid phone number', vPass:'Enter your password', vNameAcc:'Enter the name',
    loginNeed:'Enter your phone and password', loginFailRetry:'Login failed, please try again', loginBadData:'Incorrect login details', regFailRetry:'Couldn’t create the account', regFail:'Couldn’t create the account', connLag:'The connection lagged, please try again',
    accSaved:'Done, your account changes are saved.', saveErr:'A saving error occurred',
    cancelOk:'Done, the booking was cancelled', cancelFail:'Cancellation failed', cancelErr:'A cancellation error occurred',
    updateFail:'Update failed', updateErr:'A booking update error occurred',
    manualNeed:'Choose the field, day and time', manualName:'Enter the booker’s name', manualPrice:'Enter a valid price', manualOk:'Done, the external booking was added', manualFail:'Couldn’t add the booking', manualErr:'An error occurred adding the external booking', noFieldsAdded:'No fields added',
    fieldNeed:'Complete the field details', fieldOk:'Done, the field was saved', fieldFail:'Saving failed', fieldErr:'An error occurred while saving the field',
    reviewNeed:'Choose the number of stars first', reviewOk:'Thanks, your review was sent.', reviewFail:'Couldn’t send the review', reviewErr:'An error occurred sending the review',
    bookingFailRetry:'Booking failed, please try again', bookingConnLag:'The connection to the sheet lagged, please try again.',
    welcomeHi:'Hi', welcomeYou:'there',
    greetMorning:'Good morning', greetAfternoon:'Good afternoon', greetEvening:'Good evening',
    onbTitle:'Book your venue, no calls', onbSub:'Five sports in one app. Football pitches are open now, the rest are coming.',
    onbAsPlayer:'Player', onbAsOwner:'Venue owner', onbBrowse:'Browse venues', onbHaveAccount:'I have an account',
    onbCreateAccount:'Create new account', onbOwnerEnter:'Owner dashboard login',
    onbOwnerNote:'Manage your venues, bookings and prices in one place.', onbTerms:'By continuing you agree to the Terms and Privacy Policy.',
    onbEyebrow:'Sports venue booking', introTag:'Book your venue',
    onbS3T:'The venue approves, and we tell you',
    onbS3B:'You hear the moment they reply, and your request is always under “My bookings”.',
    onbS4T:'Short on players?',
    onbS4B:'Publish your seats once the venue confirms, and players here join.',
    onbSkip:'Skip', onbNext:'Next', onbStart:'Get started',
    onbDotsAria:'Welcome screens', onbDotAria:'Screen {i} of {n}',
    moreAria:'More options', themeDarkVal:'Dark', themeLightVal:'Light',
    repGroupOverview:'Overview', repGroupPerf:'Performance', repGroupInsights:'Insights',
    repRangeAria:'Report range', repRangeAll:'All', repRange30:'Last 30 days', repRange90:'Last 90 days',
    successDone:'Done!', successOkBtn:'OK',
    noBookingsYet:'No bookings yet', noBookingsYetSub:'Your first field is waiting — and so is the net. Start browsing!',
    loginToSee:'Log in', loginToSeeSub:'You need to log in to see and track your bookings.', connProblem:'Connection problem', connProblemSub:'Couldn’t fetch the bookings. Check your network and try again.',
    noFieldsTitle:'No fields', noFieldsSub:'Add your first field to start receiving bookings.', noMatchBookings:'No matching bookings', noMatchBookingsSub:'Try changing the filter or date to view other bookings.', fetchFail:'Couldn’t fetch the data', fetchFailSub:'Check your connection and try again.',
    manualTitle:'Add external booking', manualSub:'Added as confirmed directly and blocks the time for players.', fieldLbl:'Field', dayLbl:'Day', timeLbl:'Time', ownerNameLbl:'Booker’s name', priceLbl:'Price', saveBookingBtn:'Save booking',
    editFieldTitle:'Edit field', addFieldTitle:'Add new field', fieldNameLbl:'Field name', sizeLbl:'Size', slotsLbl:'Times', activeLbl:'Active', saveBtn:'Save', slotFull:'Full — all day', slotMorning:'Morning', slotEvening:'Evening',
    cancelBookingBtn:'Cancel booking', reasonPrefix:'Reason: ', reasonPlaceholder:'e.g., the time isn’t available or there is maintenance...', reasonTitleDefault:'Update reason', cancelWord:'Cancel', backWord:'Back',
    rateModalTitle:'Rate this place', yourNamePh:'Your name', phonePh:'Phone number', commentPh:'Optional comment', submitReviewBtn:'Send review',
    stAvailable:'Available', stSelected:'Selected', stTaken:'Booked', bookedTag:'Booked',
    showPass:'Show password', hidePass:'Hide password', clearSearchAria:'Clear search',
    tmMorning:'Morning', tmNoon:'Noon', tmEvening:'Evening',
    bookingSuccessTitle:'Booking request sent', statusPendingVenue:'Awaiting venue confirmation', nextStepNote:'We’ll notify you as soon as the venue confirms.',
    editProfile:'Edit details', prefsTitle:'Preferences', darkModeLbl:'Dark mode', languageLbl:'Language',
    regionsEyebrow:'Regions', regionsTitle:'Available regions', regionsSub:'Pick your area and start browsing right away.', regionsOne:'field', regionsMany:'fields',
    reviewsEyebrow:'Reviews', reviewsTitle:'What users say',
    review1:'Way easier than phone calls — I see the free slots and send my request in seconds.', review1by:'Player',
    review2:'It organized my field bookings and cut the back-and-forth calls.', review2by:'Field owner',
    review3:'The interface is clear — I see the field details and price before I choose.', review3by:'Player',
    ownersEyebrow:'For field owners', ownersTitle:'Manage your fields professionally', ownersSub:'A complete dashboard to receive bookings, organize them, and track your fields’ performance.',
    ownersB1:'All your bookings in one board', ownersB2:'Confirm or reject in a tap with a WhatsApp notice', ownersB3:'Revenue & occupancy reports to guide decisions', ownerCtaBtn:'Owner login',
    // ---- Localization completion batch (dynamic text + templates + a11y) ----
    bkFetchFail:'Couldn’t fetch the bookings', tryAgain:'Please try again.', noBookingsToShow:'No bookings to show right now.',
    playerCancelTitle:'Cancel booking', playerCancelHint:'{label} — write the cancellation reason (optional)', confirmCancelBtn:'Confirm cancellation', playerCancelledDefault:'The player cancelled the booking',
    loadingBookings:'Loading bookings...', sessionExpired:'Your session expired, please log in again', dashRenderErr:'An error occurred displaying the dashboard',
    econMore:'The more data, the more accurate the decisions.', econLow:'Occupancy below 40%: best to focus on marketing and offers.', econGood:'Occupancy between 60% and 80%: looking good — keep the price and watch peak times.', econHigh:'Occupancy above 85%: there’s room to raise the price, especially at peak demand.',
    srcPrefix:'Source: ', cancelReasonPrefix:'Cancellation/Rejection reason: ',
    ownerActiveUpcoming:'Current & upcoming bookings', noActiveUpcoming:'No current or upcoming bookings', ownerFinished:'Past bookings',
    completeSelection:'Complete your selection first.', loginToSeeBookings:'Log in to see your bookings', avatarFallback:'M',
    amenFree:'Free', amenPaid:'Paid', amenNotAvail:'Not available',
    kwFull:'All day', kwMorning:'Morning', kwEvening:'Evening',
    amenity_water:'Water', amenity_parking:'Parking', amenity_ball:'Ball', amenity_vests:'Vests', amenity_bathrooms:'Restrooms',
    waRejectedDefault:'Sorry, this time slot is currently unavailable.', waCancelledDefault:'The booking was cancelled by the venue management.',
    waConfirmed:'Hi {name} ⚽\n\nYour booking is confirmed ✅\n\n🏟️ Venue: {place}\n🥅 Field: {field}\n📅 Date: {date}\n⏰ Time: {time}\n📐 Size: {size}\n💰 Price: {price}\n\nSee you there!',
    waRejected:'Hi {name} ⚽\n\nYour booking request was declined ❌\n\n🏟️ {place} - {field}\n📅 {date} ⏰ {time}\n\nReason:\n{reason}',
    waCancelled:'Hi {name} ⚽\n\nYour booking was cancelled ❌\n\n🏟️ {place} - {field}\n📅 {date} ⏰ {time}\n\nReason:\n{reason}',
    docTitle:'Al-Mostadeera - Book your field', ariaBrand:'Al-Mostadeera', ariaPageLinks:'Page links', ariaFooterLinks:'Footer links', ariaToggleTheme:'Toggle theme', ariaHome:'Home',
    ariaChooseDate:'Choose the time', ariaOwnerTabs:'Owner dashboard sections', ariaSearchBookings:'Search bookings', ariaFilterDate:'Filter by date', ariaFilterField:'Filter by field', ariaFilterStatus:'Filter by status',
    calPrevAria:'Previous month', calNextAria:'Next month', ariaBookingSteps:'Booking steps', ariaRateLegend:'Rate this place from 1 to 5 stars',
    star1:'One star', star2:'Two stars', star3:'3 stars', star4:'4 stars', star5:'5 stars',
    phRegName:'John Smith', phRegPass:'At least 6 characters', phAccName:'Player name', phManualName:'Booker name', phFieldName:'Field 1',
    placeStatsTitle:'Field stats',
    skipLink:'Skip to main content', offSiteBadge:'Off-site', welcomeGuest:'Welcome',
    brandName:'Al-Mostadeera',
    addToCalendar:'Add to calendar',
    favTab:'Favorites', favAdd:'Add to favorites', favRemove:'Remove from favorites',
    noFavsTitle:'No favorite fields yet', noFavsSub:'No field has won your heart yet? Tap the heart icon on any field and it will save its spot here.',
    repeatWeeksLbl:'Repeat weekly', repeatNone:'No repeat (one time)', repeatFor:'For {n} weeks (same day & time)',
    repeatSummary:'Added {added} bookings, skipped {skipped} (time taken or failed).',
    // ---- 🤖 AI features (owner dashboard) ----
    aiAdvisorTitle:'AI Business Advisor', aiBadge:'AI', aiAdvisorSub:'Analyzes your bookings, occupancy and prices, then suggests practical steps to grow your profit.',
    aiReviewTitle:'AI Review Summary', aiReviewSub:'A smart read of player reviews: what they love and what they complain about.',
    aiRegenerate:'Refresh analysis', aiWeatherTitle:'Weather & Pricing Alert',
    aiFail:'Couldn’t generate the analysis right now — try “Refresh analysis” in a bit.',
    aiNotConfigured:'The smart assistant is not live yet - the tips below are computed from your own numbers.',
    aiNotDeployed:'The smart assistant is not live yet - the tips below are computed from your own numbers.',
    aiNeedHistory:'You have {n} days with bookings; seven is the floor - less than that is chance, not a pattern.',
    aiNoPlace:'Your account isn’t linked to a venue yet — there are no numbers to analyse.',
    aiComputedLbl:'Computed from your own numbers (no AI)',
    ciOccT:'Occupancy', ciOccA:'You are at {occ}% of capacity over the last 30 days. Each percentage point is worth about {jod} JOD a month at your current average price.',
    ciCancelT:'Cancellations are high', ciCancelA:'{p}% of requests ended cancelled or rejected ({n} of them). Check for times you advertise but cannot actually give.',
    ciWeekT:'Your weakest day', ciWeekA:'{lo} is your weakest day ({a} bookings) against {hi} ({b}). A discount on the weak day fills slots that go unsold anyway.',
    ciStaleT:'Requests past their date', ciStaleA:'{n} requests are still pending after their play date passed. A pending request holds its slot, blocks others, then expires.',
    ciRetT:'Returning customers', ciRetA:'{p}% of your customers booked more than once ({n} of {u}). A returning one costs far less than a new one.',
    ciFreeT:'The week ahead', ciFreeA:'{n} slots are still free across the next seven days — and they are the only thing you can sell right now.',
    wxT_danger:'Rain expected in the coming days', wxT_warn:'Changing weather ahead', wxT_info:'Good playing weather',
    wxA_danger:'High chance of rain - remind those with bookings and offer a reschedule instead of a cancellation.',
    wxA_warn:'Possible rain or high heat — follow up on pending requests early and keep players informed.',
    wxA_info:'Excellent weather for the next 3 days — a small discount on empty slots could fill them.',
    aiNoInsights:'No recommendations yet — the more bookings, the sharper the advice.',
    aiNoReviews:'No reviews yet — once players rate your venue, the summary appears here.',
    aiPraises:'What players praise', aiComplaints:'What they complain about',
    aiSentiment_positive:'Positive sentiment', aiSentiment_mixed:'Mixed sentiment', aiSentiment_negative:'Negative sentiment',
    aiReviewsCount:'{n} reviews · {avg}★ average', aiUpdatedAt:'Last updated: {time}',
    aiWeatherFail:'Couldn’t fetch the weather forecast.', aiRetry:'Retry',
    aiAutoAdvice:'Automatic advice', aiRainShort:'Rain {n}%',
    // ---- UX polish (always-price · request age · confirm+WA · new badge) ----
    chooseDayTimeHint:'Pick a day & time', actConfirmWa:'Confirm + WhatsApp',
    ageNow:'just now', ageMin:'{n}m ago', ageHr:'{n}h ago', ageDay:'{n}d ago',
    newPendingToast:'🔔 {n} new booking request(s)',
    // ---- (1) Rescheduling — pending bookings only ----
    rsBtn:'Modify', rsTitle:'Change booking time',
    rsSub:'Pick a new day and time. The booking stays pending the venue’s confirmation.',
    rsCurrentLbl:'Your current time', rsCurrentTag:'current',
    rsSave:'Save new time', rsPickTime:'Pick a new time first',
    rsOk:'Your booking time was changed', rsFail:'Couldn’t change the time', rsErr:'An error occurred while changing the time',
    rsNoField:'Couldn’t load this field’s schedule — rescheduling isn’t possible right now.',
    rsNotReady:'Rescheduling from the app is not live yet. Call the venue and they will move it for you.',
    // ---- (2) Slot scarcity — shown only when 1 or 2 slots are genuinely free ----
    scarce1:'Only one slot left on this day!', scarce2:'Only two slots left on this day!',
    // ---- (3) Delete account ----
    dangerZone:'Danger zone', delAccount:'Delete account', delAccTitle:'Delete your account?',
    delAccMsg:'Your account closes and this number cannot sign in again. Cancel any bookings you do not want first - there is no undo.',
    delAccConfirm:'Yes, delete my account', delAccOk:'Your account was deleted. Sorry to see you go!',
    delAccFail:'Couldn’t delete the account', delAccErr:'An error occurred while deleting the account',
    // ---- (4) Offline ----
    offTitle:'The whistle paused', offSub:'Check your internet connection — we’ll resume the match as soon as it’s back.',
    offDismiss:'Browse what’s loaded', onlineBack:'You’re back online — play on!',
    // ---- (5) Unsaved changes ----
    unsavedTitle:'Unsaved changes', unsavedMsg:'You have input that hasn’t been saved. Close and discard it?',
    unsavedDiscard:'Discard & close', unsavedKeep:'Keep editing',
    // ---- (6) Pull to refresh ----
    ptrPull:'Pull to refresh', ptrRelease:'Release to refresh', ptrLoading:'Refreshing…', ptrDone:'Updated',
    // ---- (7) Sticky filter chips ----
    fchipsAria:'Active filters', fchipRegion:'Region: {v}', fchipPriceMin:'From {v}', fchipPriceMax:'Up to {v}',
    fchipSize:'Size: {v}', fchipType:'Type: {v}', fchipRating:'{v}★ & up', fchipRemove:'Remove {v}',
    // ---- (8) Login & register: password rules stated before they can be broken ----
    loginEyebrow:'Your AL-Mustadira account', regEyebrow:'New account',
    loginWelcome:'Welcome back', regWelcome:'Let’s get you on the pitch',
    pwRulesTitle:'Your password needs:',
    pwRuleLen:'At least 6 characters', pwRuleLetter:'A letter', pwRuleDigit:'A number',
    pwStrength:'Strength', pwLvl1:'Weak', pwLvl2:'Fair', pwLvl3:'Good', pwLvl4:'Strong',
    pwShort6:'Password must be at least 6 characters', pwNeedMix:'Password needs at least one letter and one number',
    phoneHint:'A Jordanian number starting with 07', capsOn:'Caps Lock is on',
    // ---- (9) Phone verification ----
    vfTitle:'Confirm your number', vfEyebrow:'One last step',
    vfSub:'We sent a six-digit code to {phone}. Type it below.',
    vfCodeAria:'Verification code — six digits', vfDigitAria:'Digit {n}',
    vfVerify:'Confirm number', vfResend:'Send the code again',
    vfResendIn:'Resend {rel}', vfSending:'Sending the code…',
    vfSkip:'Continue, confirm later', vfNeedAll:'Enter all six digits',
    vfOk:'Your number is confirmed ✅', vfFail:'Couldn’t confirm — please try again',
    vfWhyTitle:'Why confirm?',
    vfWhy:'The venue calls this number to confirm your booking. One wrong digit means a booking nobody can confirm.',
    vfNoProviderTitle:'Code sending isn’t switched on yet',
    vfNoProvider:'The SMS service is not connected yet. Your account works and you can book normally.',
    vfNotReady:'Number confirmation is not live yet - and it does not hold you up: your account works and you can book as normal.',
    vfAlready:'Your number is already confirmed',
    vfContinue:'Continue', vfTooSoon:'Please wait a moment before asking for a new code',
    accPhoneVerified:'Number confirmed', accPhoneUnverified:'Number not confirmed', accVerifyNow:'Confirm now',
    // ---- (10) Payment method ----
    payTitle:'Payment method', payMethodLbl:'Payment', payWhyLink:'Why no card?',
    stepMinus:'Decrease', stepPlus:'Increase',
    payCash:'Cash at the venue', payCashSub:'You pay the venue when you arrive.',
    payCard:'Visa or Mastercard', payCardSoon:'Soon',
    payCardSub:'Card payment isn’t live yet — it opens as soon as the payment gateway is ready.',
    payCardWhy:'When it does, the number is typed at the payment gateway - the app never sees or stores it.',
    payCardsTitle:'My cards', payNoCards:'No saved card — every booking is paid in cash at the venue today.',
    // ---- (11a) Player cancellation window ----
    cancelWindowHint:'You can cancel up to {h} before kick-off. This booking is still inside that window.',
    /* DB guard codes (24, 25) - the sentence lives here, not in the row */
    priceFromAria:'Minimum price in JOD', priceToAria:'Maximum price in JOD',
    verOld:'A newer version of the app is available — update to get every feature.', verCta:'Update', verClose:'Dismiss',
    errDatePast:'You can’t book a date that has already passed.', errFieldPlace:'That field doesn’t belong to this venue.',
    errHourSlot:'This time isn’t one of this field’s slots.', errSlotClosed:'The venue has closed this time — pick another.',
    errRvDup:'You’ve already reviewed this venue today.', errRvRate:'Too many reviews from this number today.',
    errRvPhone:'A review needs a phone number.', errRvNoBooking:'Only someone who has played here can review it.',
    cancelTooLateTitle:'Too late to cancel from the app',
    cancelTooLateSub:'Less than {h} to your slot. If something urgent came up, call the venue directly.',
    cancelTooLateNoPhone:'Less than {h} to your slot. We do not have this venue\'s number - find it on its page.',
    cancelWindowServer:'This booking can no longer be cancelled: less than {h} to its slot. Please call the venue directly.',
    callVenue:'Call the venue', waVenue:'WhatsApp the venue',
    // ---- (11b) Owner reply deadline ----
    expiredReason:'The venue did not reply within the deadline, so the request was cancelled and the slot is open again.',
    statusExpired:'Deadline passed',
    deadlineLeft:'Reply due {rel}',
    deadlineOver:'Reply deadline passed',
    otSoonestFirst:'Closest to expiring first',
    expirySweepNote:'A request past its deadline is cancelled when the dashboard is next opened — not minute by minute — and its slot opens up again.',
    expirySweepOff:'There is no automatic expiry - requests stay pending until you answer. A quick reply frees the slot for someone else.',
    // ---- (11c) No-show ----
    noShowBtn:'No-show', noShowUndoBtn:'Undo no-show',
    noShowBadge:'No-show',
    noShowAskTitle:'Record a no-show',
    noShowAskMsg:'We will record that they did not show. The booking stays confirmed, and collecting is between you and the player. You can undo this.',
    noShowUndoAskTitle:'Undo no-show',
    noShowUndoAskMsg:'We will remove the no-show mark from this booking, and it will read as a normal attendance in your reports again.',
    noShowOk:'Recorded', noShowUndone:'Undone',
    noShowTooEarly:'A no-show cannot be recorded before the slot has ended.',
    noShowForbidden:'This booking does not belong to your venue.',
    noShowNotReady:'No-show recording is not live yet. The booking stays confirmed, and collecting is between you and the player.',
    noShowFail:'Couldn’t save, please try again',
    econNoShow:'No-shows', econNoShowSub:'Sold but not played — neither lost nor plain revenue',
    // ---- (12a) Closing a day — what the player sees ----
    dayClosed:'Closed', dayClosedAria:'This day is closed',
    dayClosedTitle:'The venue is closed on this day',
    closedBecause:'Reason: {r}',
    closedNoReason:'The venue closed it and did not give a reason.',
    stClosed:'Closed', closedTag:'Closed',
    slotClosedNow:'That time was just closed. Please pick another.',
    // ---- (12a) Closing a day — owner dashboard ----
    closeDayTitle:'Close a day', closeDayBtn:'Close it',
    closeFieldLbl:'Field', closeScopeLbl:'Scope',
    closeWholeDay:'The whole day', closeSomeHours:'Some hours',
    closeFromLbl:'From', closeToLbl:'Until',
    closeReasonLbl:'Reason — players will read it', closeReasonPh:'Pitch maintenance',
    closeReasonWhy:'A dark day with no reason reads as a broken app. Write a short reason.',
    closeOpenBtn:'Close a day', closeReopenBtn:'Reopen it',
    closeStateOpen:'This day is open',
    closeStateClosed:'Closed — {r}', closeStateClosedNoReason:'Closed, no reason given',
    closeStateHours:'Closed {from} – {to}',
    closeOk:'Closed', closeReopened:'The day is open again',
    closeConflictTitle:'Can’t close — there are confirmed bookings',
    closeConflictSub:'Cancel them first (they get a notification), then close the day.',
    closePendingWarn:'And there are pending requests on this day — answer them.',
    closeForbidden:'This field does not belong to your venue.',
    closePast:'You cannot close a day that has passed.',
    closeNotReady:'Closing days is not live yet. For anything urgent, contact the players who booked directly.',
    closeFail:'Couldn’t save, please try again',
    closeNeedHours:'Pick a start hour and an end hour.',
    // ---- (12b) Pricing ----
    pricingTitle:'Hourly pricing', pricingBtn:'Pricing',
    priceRuleNote:'This is the price for this slot specifically. The field’s base price is {base}.',
    priceChanged:'The price changed between opening this screen and sending: it was {from} and is now {to}. The recorded figure is the second one.',
    ruleDaysLbl:'Days — none selected = every day',
    ruleFromLbl:'From', ruleToLbl:'Until',
    rulePriceLbl:'Price', rulePriorityLbl:'Priority',
    ruleAddBtn:'Add rule', ruleDelBtn:'Delete',
    ruleNone:'No rules. Every hour is at the base price.',
    ruleAllDays:'Every day', ruleAllHours:'All hours',
    ruleNeedPrice:'Enter a price.', ruleNeedHours:'Pick a start and an end hour, or leave both empty for all hours.',
    ruleAdded:'Rule added', ruleDeleted:'Rule deleted',
    ruleFail:'Couldn’t save, please try again',
    pricingNotReady:'Hourly pricing is not live yet - your base price applies to every hour as usual.',
    priceGridTitle:'The result — seven days',
    priceGridSub:'This is what the player will actually see. Blank = the field’s base price.',
    priceGridBase:'Base {v}',
    closeWord:'Close',
    // ---- (13) Alternatives for a booked slot ----
    altAskTitle:'That time is booked',
    altAskSub:'You were after {day} at {time}. Here are the closest alternatives that actually exist:',
    altSheetNone:'No close alternative for this time. Try another time or another venue.',
    altKindField:'Same time — on {f}',
    altKindHour:'Same day — nearest free time',
    altKindDay:'Same time — {d}',
    altKindPlace:'Same time — at {p}',
    watchBtn:'Tell me if it frees up',
    watchDone:'We’ll tell you',
    watchOk:'Noted. If this booking is cancelled we will send you a notification.',
    watchFail:'Couldn’t save, please try again',
    watchNotReady:'Slot alerts are not live yet. Keep an eye on this venue’s page - times refresh as they change.',
    // ---- (14) Open matches ----
    modeAria:'Venues or matches', modeVenues:'Venues', modeGames:'Matches',
    modeGamesTitle:'Matches short of players',
    gmPickTitle:'Match type',
    gmPrivate:'Private match', gmPrivateSub:'Your own crew. Nobody sees the booking.',
    gmOpen:'Open match', gmOpenSub:'Short of players? Publish your spare seats.',
    oeTitle:'Short on players?', oeSub:'Your seats appear once the venue confirms.',
    guestNeedAcct:'You will need an account to send the request',
    gmNeeded:'Players needed', gmBrought:'How many are with you now (including you)',
    gmLiveBad:'Enter valid numbers: at least two needed, and no more than that with you.',
    gmLiveSeats:'You’ll publish {noun}.',
    gmLiveShare:'Estimated share per person {v} — paid at the venue, to its operator.',
    gmShareTag:'estimate',
    gmShareCond:'The share assumes the match fills up. Whatever is missing is on you.',
    gmBadgeLive:'Open match', gmBadgeWaiting:'Open — once confirmed',
    gmCardLive:'Published · {n} seats offered. Open “Manage the match” to see who joined.',
    gmCardWaiting:'No seat shown yet. Seats go live the moment the venue confirms.',
    gmManage:'Manage the match',
    matchManageTitle:'Your open match', matchPlayers:'Who joined',
    matchCloseSeats:'We’re full — close the seats', matchMakePrivate:'Make it private again',
    gmSeatsState:'{noun} left · {joined} joined',
    gmNoPlayersYet:'Nobody has joined yet.',
    gmRemove:'Remove', gmRemoveTitle:'Remove a player',
    gmRemoveMsg:'We’ll remove {n}, notify them, and free their seat.',
    gmRemoved:'Removed', gmSaved:'Saved',
    gmSeatsClosed:'Seats closed. The match no longer appears to anyone else.',
    gmNowPrivate:'It is a private match again.',
    gmHostIs:'Host: {n}', gmHostUnknown:'a player',
    gmJoinBtn:'Join', gmYouIn:'You’re in this match', gmYouParticipant:'Participant',
    grpJoined:'Matches you joined',
    gmLeaveBtn:'Leave', gmLeaveTitle:'Leave the match?',
    gmLeaveMsg:'Your seat frees up and the host is notified. If the match is close, a replacement is hard to find.',
    gmLeft:'You left the match', gmJoined:'You’re in. See you at the pitch.',
    gmNoneTitle:'No open matches right now',
    gmNoneSub:'When someone books and is short of players, their match shows up here. You can open one when you book.',
    gmNoneCta:'Browse venues',
    gmLoadFail:'Couldn’t load the matches',
    joinTitle:'Join this match?', joinConfirm:'Join',
    joinTermShare:'Your estimated share is {v} — paid at the venue.',
    joinTermPay:'The app does not collect, transfer or guarantee. The settlement is between you.',
    joinTermLate:'Can’t make it? Leave early — your seat just stays empty for them.',
    joinTermNames:'First names only. No phone numbers, and no chat inside the app.',
    joinTermOff:'If the host cancels or the venue declines, it ends before it starts and you are notified - and you paid nothing.',
    joinTermLeave:'You can withdraw any time from “My bookings” - your seat returns immediately.',
    gmOwnerUpTo:'up to {n} players', gmOwnerNote:'Nothing changes for you: one booking, one holder, and they pay. The players sort themselves out.',
    gmNotReady:'Open matches are not live yet. Book your venue as usual - when they open, you will find them here.',
    gmErrGeneric:'Something went wrong, please try again',
    gmErrAuth:'Please log in first', gmErrMissing:'We couldn’t find that match',
    gmErrNotOpen:'That match is no longer open', gmErrPast:'That match has already started',
    gmErrHost:'This is your own booking', gmErrFull:'The seats filled up — someone got there first',
    gmErrForbidden:'That match isn’t yours', gmErrCounts:'The numbers are missing',
    gmErrInactive:'Your account is suspended — contact us', gmErrClash:'You are already in another match at that time',
    gmErrBelow:'You can’t drop the total below the number who joined. {n} joined, so the minimum is {min}.',
    gmErrHasPlayers:'You can’t make it private with {n} already joined. Remove them first, or keep it open.',
    // ---- Open-match notifications (migration 22) ----
    ntfGameJoinedTitle:'Someone joined your match', ntfGameJoinedBody:'{who} · {place} — {day} {time} · {seats} left',
    ntfGameLeftTitle:'Someone left your match', ntfGameLeftBody:'{who} · {place} — {day} {time} · {seats} left',
    ntfGameFullTitle:'Your match is full', ntfGameFullBody:'{place} — {day} {time} · no seats left',
    ntfGameOffTitle:'A match you joined is off', ntfGameOffBody:'{place} — {day} {time}',
  }
};
function t(key, params){
  const lang = State.lang || 'ar';
  let s = (I18N[lang] && I18N[lang][key]);
  if(s==null) s = (I18N.ar && I18N.ar[key]);
  if(s==null){ if(location.hostname==='localhost') console.warn('[i18n] missing key:', key); return key; }
  // استبدال {var} آمن: نص فقط (لا HTML/لا eval)، يحفظ الصفر، ويبقي المتغيّر الناقص كما هو.
  if(params) s = String(s).replace(/\{(\w+)\}/g, (m,k)=> (params[k]!==undefined && params[k]!==null) ? String(params[k]) : m);
  return s;
}
/* تسمية المرفق من القاموس (labelKey) مع تراجع آمن لمفتاح المرفق نفسه */
const amenityLabel = (a) => a && a.labelKey ? t(a.labelKey) : (a && a.key) || '';
/* تسمية وقت إنجليزية مولّدة من الساعات (12 ساعة + AM/PM) */
function enSlotLabel(s, e){
  const f=(x)=>{ const hh=((Number(x)%24)+24)%24; const mer=hh<12?'AM':'PM'; let h=hh%12; if(h===0)h=12; return {h,mer}; };
  const a=f(s), b=f(e);
  return a.mer===b.mer ? `${a.h}:00 - ${b.h}:00 ${b.mer}` : `${a.h}:00 ${a.mer} - ${b.h}:00 ${b.mer}`;
}
/* عرض الوقت حسب اللغة — العربية تستخدم القيمة الكنسية (label) كما تُرسل للخادم؛
   الإنجليزية تُولَّد من startHour/endHour. الأوقات المقروءة من الشيت (بلا ساعات) تعرض label. */
function slotDisplay(slot){
  if(!slot) return '';
  if(State.lang==='en'){
    // الساعات هي المصدر المحايد لغوياً (كل الفترات ساعتان). label يبقى القيمة الكنسية.
    const s = slot.startHour!=null ? slot.startHour : slot.hour;
    const e = slot.endHour!=null ? slot.endHour : (slot.hour!=null ? Number(slot.hour)+2 : null);
    if(s!=null && e!=null) return enSlotLabel(s, e);
  }
  return slot.label || '';
}
/* ترجمة رسائل الخادم المعروفة (لا نغيّر رسائل Apps Script — نترجمها بالواجهة فقط) */
const API_MESSAGE_MAP = {
  'وصل طلبك، بنأكدلك قريب':'Your request was sent. The field owner will confirm it soon.',
  'وصل طلبك! الحجز بانتظار تأكيد إدارة الملعب.':'Your request was sent! It awaits the field’s confirmation.',
  'بيانات الدخول غير صحيحة':'Incorrect login details.',
  'الوقت محجوز':'This time is already booked.',
  'هذا الوقت غير متاح':'This time is not available.',
  'رقم الهاتف مستخدم':'This phone number is already in use.',
  'تم بنجاح':'Done successfully.',
  'بيانات الحجز ناقصة':'Booking data is incomplete.',
  'ما بنفع تحجز بتاريخ قديم':'You can’t book a past date.',
  'هذا الملعب مش تابع لهذا المكان':'This field doesn’t belong to this place.',
  'هذا الوقت مش متاح لهذا الملعب':'This time isn’t available for this field.',
  'ما لقينا المكان':'Place not found.',
  'هذا الوقت راح، اختار وقت ثاني':'This time is gone, choose another one.',
  'صار خطأ بالخادم، حاول مرة ثانية':'A server error occurred, please try again.',
  /* رسائل دالّة تعديل الموعد (player_reschedule_booking) — تُكتب بالعربية في القاعدة وتُترجم هنا */
  'ما لقينا الحجز':'Booking not found.',
  'هذا الحجز مش تبعك':'This booking isn’t yours.',
  'ما بتقدر تعدّل إلا الحجز اللي لسا بانتظار التأكيد':'Only a booking still awaiting confirmation can be changed.',
  'هذا نفس موعد حجزك':'That’s the same time as your booking.',
  'ما بنفع تنقل الحجز لوقت راح':'You can’t move a booking to a time that has already passed.',
  'تم تعديل موعد حجزك':'Your booking time was changed.',
  'ما بتقدر تحذف هذا الحساب':'You can’t delete this account.',
  'تم حذف حسابك':'Your account was deleted.',
  /* ⚠️ الاثنتان والعشرون التالية كانت **تصل مستخدم الإنجليزية بالعربية**.
     و`check-i18n-parity.js` كان يمرّ ٩٣٩/٩٣٩ وهو محقّ: هذه النصوص لا تمرّ
     بـ`I18N` أصلًا، فالحارس أعمى عن الصنف كلّه. واختبارٌ يمرّ دائمًا أخطر من
     غياب اختبار — يشتري ثقةً بلا تغطية. الحارس صار يقارن هذه الخريطة بكل
     `message:'…'` في الملفّ (‏`tools/check-api-messages.js`). */
  'الرقم أو كلمة السر غلط، حاول مرة ثانية':'Wrong number or password — please try again.',
  'الرقم عنده حساب، ادخل من هون':'This number already has an account — sign in instead.',
  'انتهت جلستك، ادخل من جديد':'Your session expired — please sign in again.',
  'سجّل دخولك أول':'Please sign in first.',
  'أهلاً، تفضل':'Welcome back.',
  'تمام، حسابك جاهز':'All set — your account is ready.',
  'تم حفظ الحجز':'Booking saved.',
  'تم حفظ التعديلات':'Your changes were saved.',
  'تم التحديث':'Updated.',
  'تم تغيير كلمة السر':'Your password was changed.',
  'شكراً، تقييمك وصل':'Thanks — your review was received.',
  'تمت إضافة الملعب':'The field was added.',
  'كلمة السر الحالية غلط':'Your current password is incorrect.',
  'كلمة السر لازم 6 حروف أو أرقام على الأقل':'The password must be at least 6 characters.',
  'كمّل البيانات كلها عشان نكمل':'Please fill in every field to continue.',
  'ما حطيت اسمك':'Please enter your name.',
  'في شي ناقص بالتقييم':'Something’s missing in the review.',
  'ما بتقدر تعدّل حالة الحجز':'You can’t change this booking’s status.',
  'ما لقينا المكان تبعك':'We couldn’t find your venue.',
  'هذا الملعب مش تابع لحسابك':'This field doesn’t belong to your account.',
  'تعذّر جلب البيانات':'Couldn’t load the data.',
  'صار خطأ، حاول كمان مرة':'Something went wrong — please try again.',
};
/* رموز حرّاس الترحيلين 24 و25: القاعدة ترفع **اسمًا آليًّا** لا جملة، تمامًا
   كـ`cancel_window_closed` في 15 وكأنواع الإشعارات في 14 — فالجملة تُكتب هنا
   بلغة المستخدم **الحالية**، ولا نصَّ عربيًّا يُخزَّن ثمّ يُترجَم.
   ولذلك مفاتيح `I18N` لا `API_MESSAGE_MAP`: هذه الأخيرة تترجم عربيًّا إلى
   إنجليزي، وهذه الرموز ليست عربية أصلًا. وبكونها في `I18N` يغطّيها
   `check-i18n-parity.js` القائم بلا سطر جديد فيه.
   والقائمة **مغلقة**: ما ليس فيها يقع على الرسالة العامّة بدل نصٍّ مخترَع. */
const DB_ERROR_KEY = {
  booking_date_past:  'errDatePast',
  field_not_in_place: 'errFieldPlace',
  hour_not_in_slots:  'errHourSlot',
  slot_closed:        'errSlotClosed',
  rv_duplicate:       'errRvDup',
  rv_rate_phone:      'errRvRate',
  rv_phone_required:  'errRvPhone',
  rv_no_booking:      'errRvNoBooking',
};
function dbErrorMessage(raw){
  const s = String(raw||'');
  const code = Object.keys(DB_ERROR_KEY).find(c => s.includes(c));
  return code ? t(DB_ERROR_KEY[code]) : '';
}
const apiMsg = (msg) => (State.lang==='en' && msg && API_MESSAGE_MAP[msg]) ? API_MESSAGE_MAP[msg] : msg;

/* أيقونات SVG ثابتة موثوقة (تُحقن كـ innerHTML بأمان لأنها ليست بيانات مستخدم) */
const ICON = {
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  resize:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  money:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M9 10h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>',
  person:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884Z"/></svg>',
  /* أيقونات المرافق (موحّدة: نفس الـ stroke والحواف) */
  drop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z"/></svg>',
  parking:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 17V8h3.5a2.5 2.5 0 0 1 0 5H9"/></svg>',
  ball:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m12 7.6 3.7 2.7-1.4 4.4H9.7L8.3 10.3 12 7.6Z" fill="currentColor" stroke="none"/><path d="M12 3v4.6M8.3 10.3 4 8.9M15.7 10.3 20 8.9M9.7 14.7 7.2 18.6M14.3 14.7l2.5 3.9"/></svg>',
  /* أيقونات الرياضات (نفس أسلوب الـstroke) */
  padel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6c4.1 0 6.9 3 6.9 7s-2.8 7-6.9 7-6.9-3-6.9-7 2.8-7 6.9-7Z"/><circle cx="9.6" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="11.6" r=".9" fill="currentColor" stroke="none"/><path d="M12 16.6V21"/><path d="M10.4 21h3.2"/></svg>',
  basket:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5.6 5.6c3.6 3.6 3.6 9.2 0 12.8M18.4 5.6c-3.6 3.6-3.6 9.2 0 12.8"/></svg>',
  tennis:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="10.2" cy="8.4" rx="5.6" ry="6.6" transform="rotate(38 10.2 8.4)"/><path d="M6.6 4.6 13 12M13.6 4.9 7.3 11.7"/><path d="m13.6 13.3 2.2 2.6a2 2 0 0 1-.2 2.7l-.6.6a2 2 0 0 1-2.8-.1l-2.2-2.6"/></svg>',
  volley:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 0-4.6 17.2"/><path d="M20.6 9.3A15 15 0 0 0 3.5 14"/><path d="M15.4 20.6A15 15 0 0 0 9.9 3.3"/></svg>',
  vest:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 6v14h16V6l-4-3-4 3-4-3Z"/><path d="M12 6v14"/></svg>',
  bath:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z"/><path d="M6 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2"/><path d="M6 19v2M18 19v2"/></svg>',
  dot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  /* الجرس: **نفس مسار جرس الرأس حرفيًّا** في app.html لا رسمٌ ثانٍ — شكلان
     لمعنًى واحد ينحرفان، وهذا هو احتياطيّ الإشعارات التي لا نوع لها. */
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* مخطّطات الملاعب — تُعرَض في حالة «قريباً» بدل الرمز التعبيري ⏳.
   السبب: الساعة الرملية تقول «انتظر» ولا تقول **ماذا** تنتظر؛ ومخطّط الملعب
   يُري المستخدم الرياضةَ نفسها فيفهم أن التطبيق ليس تطبيق كرة قدم.
   ⚠️ مخطّط لا صورة: لا نملك صور بادل/سلة/تنس واختراعها ممنوع (م5). وهذا
   رسم هندسي لأبعاد منشورة، لا ادّعاء بأن عندنا ملعبًا كهذا — والشارة
   النصّية «قريباً» فوقه تبقى هي التي تقول الحالة.
   كل ملعب بنسبته الحقيقية داخل لوح 160×100 واحد، فالأشكال تخرج مختلفة
   فعلًا. نسخة طبق الأصل ممّا في قسم «الرياضات» بالموقع — الوجهان يقولان
   الشيء نفسه بالرسم نفسه. */
const COURT = {
  football:'<rect x="15" y="8" width="130" height="84" rx="1"/><path d="M80 8v84"/><circle cx="80" cy="50" r="13"/><circle cx="80" cy="50" r="1.6" fill="currentColor" stroke="none"/><path d="M15 25h20v50H15M15 38.5h7v23h-7M145 25h-20v50h20M145 38.5h-7v23h7"/>',
  padel:'<rect x="10" y="15" width="140" height="70" rx="1"/><path d="M80 15v70M31.4 15v70M128.6 15v70M31.4 50h97.2"/>',
  basket:'<rect x="10" y="12.5" width="140" height="75" rx="1"/><path d="M80 12.5v75"/><circle cx="80" cy="50" r="9"/><path d="M10 37.75h29v24.5H10M150 37.75h-29v24.5h29"/><circle cx="39" cy="50" r="9"/><circle cx="121" cy="50" r="9"/><path d="M10 17h12a33.75 33.75 0 0 1 0 66H10M150 17h-12a33.75 33.75 0 0 0 0 66h12"/>',
  tennis:'<rect x="10" y="17.5" width="140" height="65" rx="1"/><path d="M80 17.5v65M10 25.6h140M10 74.4h140M42.3 25.6v48.8M117.7 25.6v48.8M42.3 50h75.4"/>',
  volley:'<rect x="10" y="15" width="140" height="70" rx="1"/><path d="M80 15v70M56.7 15v70M103.3 15v70"/>',
};
const courtSvg = (key) => COURT[key]
  ? '<svg class="court-svg" viewBox="0 0 160 100" aria-hidden="true">'+COURT[key]+'</svg>'
  : '';

/* ═══════════════════════════════════════════════════════════════════════════
   مواصفات الملعب — ما يختلف باختلاف الرياضة

   ⚑ **هذا الجدول هو مصدر الحقيقة**، ونسخته في `site/admin.html` مرآةٌ له
     (نفس المفاتيح ونفس الخيارات بنفس الترتيب). لماذا نسخة لا استيراد: اللوحة
     صفحة مستقلّة لا تقرأ من `app/` — وهي القاعدة المعمارية للمستودع نفسها
     (‏`README.md`: «لا يقرأ أحدهما من الآخر»). ونفس ما يجري لـ`COURT`.
     ⚠️ فأيّ خيار يُضاف هنا يُضاف هناك، وإلّا كتبته اللوحة ولم يعرضه التطبيق.

   ⚑ **المفردات مغلقة عمداً.** ولا يُعرَض مفتاحٌ ولا قيمةٌ بلا ترجمة في
     اللغتين — لأن التطبيق ثنائي اللغة، ودرسُ عمود المرافق النصّي الحرّ مقيس:
     «بأجرة» و«حتى 20 سيارة» دخلتا القاعدة فصار مستخدم الإنجليزية يقرؤهما
     بالعربية. ما لا يُترجَم لا يُعرَض، ولا يُخترَع له نصّ (م5).

   ⚑ `hideWhen`: قيمةٌ لا يستحقّ ذكرها. «بلا إضاءة» ليست معلومة يبحث عنها
     أحد — هي غيابُ معلومة، وعرضها يزحم أربع شرائح تهمّ فعلاً. أمّا المفاتيح
     بلا `hideWhen` (الأرضية · نوع الملعب) فكل قيمها تفيد.
   ═══════════════════════════════════════════════════════════════════════════ */
const SPORT_KEYS = ['football','padel','basket','tennis','volley'];
const FIELD_SPECS = {
  football: [ { key:'surface', opts:['grass_synthetic','grass_natural','rubber','sand'] } ],
  padel:    [ { key:'court',   opts:['double','single'] },
              { key:'walls',   opts:['glass','mesh','mixed'] },
              { key:'panoramic', opts:['yes','no'], hideWhen:'no' },
              { key:'rackets', opts:['free','paid','no'], hideWhen:'no' } ],
  basket:   [ { key:'court',   opts:['full','half'] },
              { key:'surface', opts:['parquet','pu','asphalt','rubber'] },
              { key:'hoop',    opts:['standard','adjustable'] } ],
  tennis:   [ { key:'surface', opts:['hard','clay','grass','carpet'] },
              { key:'court',   opts:['single','double'] } ],
  volley:   [ { key:'surface', opts:['indoor_court','beach_sand','grass'] },
              { key:'net',     opts:['men','women','mixed','youth'] } ],
};
/* مشتركة بين الرياضات الخمس — تأتي بعد الخاصّة بالرياضة في العرض */
const FIELD_SPECS_COMMON = [
  { key:'enclosure', opts:['outdoor','indoor','covered'] },
  { key:'lights',    opts:['yes','no'], hideWhen:'no' },
  { key:'seating',   opts:['yes','no'], hideWhen:'no' },
];
const specsFor = (sport) => [...(FIELD_SPECS[sport] || FIELD_SPECS.football), ...FIELD_SPECS_COMMON];
const fieldSport = (f) => SPORT_KEYS.includes(f && f.sport) ? f.sport : 'football';

/* ── لمن الملعب (ترحيل 29) ──
   مفردات **مغلقة**، ونسختها قيدٌ في القاعدة (`fields_gender_chk`) — قيمةٌ رابعة
   تعني تعديل الاثنين معًا. وهذه الأربعة هي كل ما تعرفه الواجهة عن الجنس.

   🔴 **والغياب غيابٌ لا «مشترك».** عمودٌ `null` — أو ترحيلٌ لم يُشغَّل فالعمود
      `undefined` أصلًا — يُقرأ `''`: لا شارة تُعرَض، ولا يدخل الملعبُ نتيجةَ
      تصفيةٍ بجنسٍ بعينه. افتراضُ «مشترك» على صفٍّ لم يقل عنه أحدٌ شيئًا يُرسل
      لاعبةً إلى ملعبٍ للرجال على وعدٍ لم يقطعه أحد (م5).

   ⚠️ و`genderDeclared` تُبنى من `State.places` لا `allPlaces` — نفس أساس
      `distinctSizes`/`distinctTypes` بالضبط: الورقة تصفّي **المعروض** بعد قصّ
      الرياضة، فمرشِّحٌ مبنيٌّ على ملاعبٍ مقصوصة يعرض خيارًا لا يطابق شيئًا. */
const GENDERS = ['men','women','mixed'];
const fieldGender = (f) => GENDERS.includes(f && f.gender) ? f.gender : '';
const genderLabel = (g) => t('gender_' + g);
const genderDeclared = () => State.places.some(p => (p.fields||[]).some(f => fieldGender(f)));

/* الشرائح المعروضة لملعب واحد: قيمة معروفة + ترجمة موجودة + ليست المخفيّة.
   تُعيد [{key,label,text}] — والواجهة لا تعرف بمفتاح لم يمرّ من هنا. */
function fieldSpecChips(f){
  const attrs = (f && f.attrs && typeof f.attrs === 'object' && !Array.isArray(f.attrs)) ? f.attrs : {};
  const out = [];
  specsFor(fieldSport(f)).forEach(spec => {
    const v = String(attrs[spec.key] == null ? '' : attrs[spec.key]).trim();
    if (!v || v === spec.hideWhen) return;
    if (!spec.opts.includes(v)) return;                       // قيمة خارج المفردات ⇒ تُتجاهَل
    const tk = 'spec_' + spec.key + '_' + v, lk = 'specL_' + spec.key;
    if (!I18N.ar[tk] || !I18N.en[tk] || !I18N.ar[lk] || !I18N.en[lk]) return;   // بلا ترجمة ⇒ لا تُعرَض
    out.push({ key: spec.key, label: t(lk), text: t(tk) });
  });
  return out;
}

