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
  API_URL: "https://script.google.com/macros/s/AKfycby2x_4M12nac0FIk-kVOsB-lg0cOSI283cvjT5yR5cv0BIqiI2u6Pmuf4XEa4bGy6bl/exec",
  CACHE_KEY: "mustadaira:places_cache_v8",
  CACHE_MS: 10 * 60 * 1000,
  AUTO_REFRESH_MS: 90 * 1000,
  SEARCH_DEBOUNCE: 300,
  COMMISSION: 0.10,
  API_TIMEOUT: 14000,   // مهلة الطلبات (14ث) قبل الإلغاء التلقائي
  AI_TIMEOUT: 45000,    // مهلة طلبات AI (نموذج + طقس عبر الخادم — أبطأ من الطلبات العادية)
};

/* الأوقات الافتراضية — بيانات محايدة لغوياً: hour (مطابقة الحجز/الخادم) + startHour/endHour
   لتوليد التسمية حسب اللغة. الحقل label هو القيمة الكنسية المُرسلة للخادم (بروتوكول حجز،
   يطابقه الباكند العربي) فيبقى ثابتاً؛ العرض الإنجليزي يُولَّد من الساعات عبر slotDisplay(). */
const DEFAULT_SLOTS = [
  {label:'8:00 - 10:00 ص',hour:8,startHour:8,endHour:10},{label:'10:00 - 12:00 م',hour:10,startHour:10,endHour:12},{label:'12:00 - 2:00 م',hour:12,startHour:12,endHour:14},
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
    heroSub:'تصفّح ملاعب منطقتك، قارن الأسعار والأوقات المتاحة، وأرسل طلب حجزك في ثوانٍ — ثم تابع تأكيده خطوة بخطوة من حسابك.',
    ownerLink:'تملك ملعباً؟ لوحة تحكّمك جاهزة من هنا', statPlaces:'ملعب متاح لك', statEasy:'سهل', statEasyLbl:'حجز بلا اتصالات ولا عناء',
    statAnytime:'تصفّح في أي وقت', statFree:'مجاني', statFreeLbl:'بلا رسوم تصفّح',
    featuresEyebrow:'المميزات', featuresTitlePre:'لماذا', featuresTitleBrand:'المستديرة؟',
    featuresSub:'كل ما تحتاجه لحجز ملعبك بسهولة — وكل ما يحتاجه المالك لإدارة ملاعبه باحتراف.',
    feat1Title:'من التصفّح إلى الطلب في دقيقة', feat1Text:'اطّلع على الأوقات المتاحة، اختر اليوم والوقت، وأرسل طلب الحجز — خطوات واضحة ومعدودة بلا مكالمة واحدة.',
    feat2Title:'اعرف الملعب قبل الذهاب', feat2Text:'الموقع والسعر والمرافق ونوع الأرضية وتقييمات اللاعبين — كل المعلومات أمامك قبل أن تقرر.',
    feat3Title:'متابعة واضحة للحجز', feat3Text:'من حسابك تتابع حالة الحجز وردّ إدارة الملعب، وتتواصل معهم عند توفر وسيلة التواصل.',
    howEyebrow:'كيف يعمل', howTitlePre:'3 خطوات وتكون', howTitleHi:'جاهزاً للعب',
    tickerNoCall:'احجز بدون مكالمات', tickerClear:'أوقات وأسعار واضحة', tickerFollow:'تابع حجزك خطوة بخطوة', tickerNoAccount:'تصفّح بدون حساب',
    chartsTitle:'رسوم بيانية', chartRevenue:'الإيراد اليومي (مؤكّد)', chartOccupancy:'الإشغال', chartHours:'حسب الساعة', last7short:'آخر 7 أيام',
    step1Title:'تصفّح واختر', step1Text:'افتح قائمة الملاعب وقارن حسب المنطقة والسعر والتقييم — ثم اختر ملعبك.',
    step2Title:'حدّد الموعد', step2Text:'اختر اليوم والوقت المتاح الذي يناسبك من جدول الأوقات.',
    step3Title:'أرسل وتابع', step3Text:'أرسل طلب الحجز وتابع تأكيده مع إدارة الملعب — واستعدّ للمباراة!',
    calloutTitle:'جاهز لحجز ملعبك القادم؟', calloutSub:'صار حجز الملعب أسهل من تسجيل هدف في مرمى خالٍ. ابدأ بلا حساب، أو سجّل دخولك لتتابع حجوزاتك أولاً بأول.',
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
    fieldPhotos:'صور الملعب', lbOpen:'تكبير الصورة {i}', lbPrev:'الصورة السابقة', lbNext:'الصورة التالية', lbClose:'إغلاق',
    sportsAria:'اختر الرياضة', sportFootball:'كرة القدم', sportPadel:'بادل', sportBasket:'كرة السلة', sportTennis:'تنس', sportVolley:'كرة الطائرة', soonBadge:'قريباً',
    comingSoonTitle:'قريباً!', comingSoonSub:'ملاعب {sport} تُحمّي في غرفة الملابس — وستنزل أرض الملعب قريباً.', backToFootball:'عرض ملاعب كرة القدم',
    sportsHint:'المستديرة تحجز الملاعب الرياضية كلّها. المفتوح للحجز الآن كرة القدم — وباقي الرياضات تُفتح فور تسجيل ملاعبها.',
    servicesTitle:'الخدمات والمرافق', chooseFieldH:'اختر الملعب', chooseDay:'اختر اليوم', chooseTime:'اختر الوقت',
    available:'متوفرة', noServices:'لم تُضف معلومات عن الخدمات بعد.', noTimesDay:'اكتمل جدول هذا اليوم بالكامل — جرّب يوماً آخر قريباً منه.',
    locationBtn:'الموقع', callBtn:'اتصال', rateThisPlace:'قيّم هذا المكان', continueBooking:'متابعة الحجز', perTwoHours:'/ ساعتين', operatingHours:'الدوام:',
    reviewTitle:'مراجعة الحجز', stepField:'الملعب', stepDate:'الموعد', stepConfirm:'التأكيد',
    rvDay:'اليوم', rvTime:'الوقت', rvDuration:'المدة', rvPrice:'السعر النهائي', rvName:'الاسم', rvPhone:'الهاتف', rvStatus:'الحالة',
    rvSize:'حجم الملعب', rvTotal:'الإجمالي', rvReadyNote:'جاهز للإرسال — سيُرسَل طلب الحجز عند التأكيد.',
    twoHours:'ساعتان', statusGuest:'ضيف', statusPlayer:'حساب لاعب مسجّل',
    bkNote:'بعد إرسال الطلب يصل إلى إدارة الملعب — يتأكد الحجز بعد موافقتهم، ويمكنك متابعة حالته من «حجوزاتي».', confirmBooking:'تأكيد الحجز', changeTime:'تغيير الموعد',
    authTitle:'خطوة أخيرة ويكتمل حجزك', authDesc:'سجّل دخولك أو أنشئ حساباً — اختيارك (الملعب واليوم والوقت) محفوظ وسنكمل من النقطة نفسها.',
    authBackEdit:'عودة لتعديل الموعد',
    navHome:'الرئيسية', navBookings:'حجوزاتي', navAccount:'حسابي', navOwner:'لوحتي',
    accountTitle:'حسابي', accountSub:'بيانات حساب اللاعب', saveEdit:'حفظ التعديل', logout:'تسجيل الخروج', rememberMe:'تذكّرني على هذا الجهاز',
    bookingsTitle:'حجوزاتي', bookingsSub:'كل حجوزاتك في مكان واحد',
    grpUpcoming:'الحجوزات القادمة', grpPending:'بانتظار التأكيد', grpPast:'الحجوزات السابقة', grpCancelled:'ملغاة / مرفوضة',
    otabToday:'اليوم', otabBookings:'الحجوزات', otabCalendar:'التقويم', otabFields:'الملاعب', otabReports:'التقارير',
    chooseFirst:'اختر الملعب أولاً.', chooseDayMsg:'اختر اليوم المناسب.', chooseTimeMsg:'اختر وقتاً متاحاً للمتابعة.',
    bookingConflict:'سبقك إليه فريق آخر قبل لحظات! اختر وقتاً آخر — ولا تتردد هذه المرة.',
    bookingSent:'وصل طلبك! الحجز الآن بانتظار تأكيد إدارة الملعب.', langSwitch:'EN', today:'اليوم', tomorrow:'غداً',
    noResultsTitle:'لا توجد نتائج مطابقة', noResultsSub:'حتى أفضل المهاجمين تفوتهم تسديدة — غيّر المنطقة أو السعر، أو امسح الفلاتر وحاول مجدداً.', noResultsSubPlain:'لا توجد ملاعب متاحة حالياً.', clearFiltersBtn:'مسح كل الفلاتر',
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
    revenueSummary:'ملخّص الإيراد', commission10:'عمولة 10%', siteRevenue:'إيراد الموقع', platformProfit:'ربح المنصة', ownerNet:'صافي المالك',
    perfTitle:'مؤشّرات الأداء', confirmRate:'نسبة التأكيد', topField:'الملعب الأكثر حجزاً', topSource:'أفضل مصدر للحجوزات',
    econTitle:'الإحصائيات الاقتصادية', smartDecisions:'قرارات ذكية', occupancy:'معدّل الإشغال', hintBookedAvail:'المحجوز ÷ المتاح', lostRevenue:'إيراد ضائع', hintEmptyPrice:'الأوقات الفارغة × السعر', cancelRateLbl:'إلغاء / رفض', hintLessBetter:'كلما قلّت كان أفضل', bestTime:'الوقت الأكثر طلباً', hintForPricing:'مفيد للتسعير', siteShare:'حجوزات الموقع', hintDirectVsExt:'مباشر مقابل خارجي', returnRate:'معدّل العودة', hintSameNumber:'الرقم نفسه أكثر من مرة',
    pendingReply:'بانتظار ردّك', restToday:'بقية حجوزات اليوم', noBookingsToday:'لا حجوزات اليوم', noBookingsTodaySub:'لا حجوزات أو طلبات اليوم — استمتع بيومك، أو أضف حجزاً خارجياً عند الحاجة.', noBookingsDay:'لا حجوزات في هذا اليوم',
    actConfirm:'أكّد', actReject:'رفض', actCancel:'إلغاء', actWhatsapp:'واتساب', edit:'تعديل',
    actApprove:'قبول الطلب', actDecline:'رفض',
    fieldActive:'مُفعّل', fieldInactive:'موقوف', fieldEnabled:'تم تفعيل الملعب للاعبين', fieldDisabled:'تم إيقاف الملعب — لن يظهر للاعبين',
    dtabBook:'احجز', dtabAmenities:'المرافق', dtabReviews:'التقييمات', dtabLocation:'الموقع', ariaDetailTabs:'أقسام الملعب',
    noReviewsYet:'لا تقييمات بعد — كن أول من يقيّم', ratingsCount:'{n} تقييم',
    pwTitle:'تغيير كلمة السر', pwSub:'لازم تكتب كلمة السر الحالية — هيك ما حدا يقدر يغيّرها لو وصل لهاتفك.',
    pwCur:'كلمة السر الحالية', pwNew:'كلمة السر الجديدة', pwNew2:'أعِد كلمة السر الجديدة', pwSave:'تغيير كلمة السر',
    pwNeedCur:'اكتب كلمة السر الحالية أول', pwTooShort:'كلمة السر الجديدة لازم 6 خانات على الأقل',
    pwMismatch:'الكلمتان مش نفسهن — تأكّد من الإعادة', pwSame:'الجديدة نفس القديمة — غيّرها',
    pwOk:'تم تغيير كلمة السر', pwFail:'ما قدرنا نغيّر كلمة السر، جرّب كمان مرة',
    confirmBookingTitle:'تأكيد الحجز', confirmBookingMsg:'هل تريد تأكيد هذا الحجز؟ سيصل اللاعب إشعار عبر واتساب.', reasonRequired:'السبب إلزامي — اكتب سبباً واضحاً للاعب',
    cancelReasonTitle:'سبب إلغاء الحجز', rejectReasonTitle:'سبب رفض الحجز', reasonHint:'اكتب السبب الذي سيظهر للاعب، وسيُجهَّز في رسالة واتساب (إلزامي).', confirmWord:'تأكيد',
    last7:'آخر 7 أيام', unknownPlace:'مكان غير معروف', loadingWord:'لحظة من فضلك…', loadingFields:'نجلب تفاصيل الملاعب…',
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
    onbTitle:'احجز ملعبك بلا مكالمات', onbSub:'خمس رياضات في تطبيق واحد: تصفّح الملاعب، قارن الأسعار والأوقات، واحجز في ثوانٍ. ملاعب كرة القدم مفتوحة الآن، وبقيّة الرياضات قريباً.',
    onbAsPlayer:'لاعب', onbAsOwner:'صاحب ملعب', onbBrowse:'تصفّح الملاعب', onbHaveAccount:'لديّ حساب',
    onbCreateAccount:'إنشاء حساب جديد', onbOwnerEnter:'دخول لوحة المالك',
    onbOwnerNote:'أدِر ملاعبك وحجوزاتك وأسعارك من مكان واحد.', onbTerms:'بالمتابعة أنت توافق على الشروط وسياسة الخصوصية.',
    onbEyebrow:'حجز الملاعب الرياضية', introTag:'احجز ملعبك',
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
    bookingSuccessTitle:'رائع! وصل طلب حجزك', statusPendingVenue:'بانتظار تأكيد الملعب', bookingNo:'رقم الحجز', nextStepNote:'سنعلمك فور تأكيد إدارة الملعب لحجزك.',
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
    phRegName:'محمد أحمد', phRegPass:'4 خانات على الأقل', phAccName:'اسم اللاعب', phManualName:'أبو أحمد', phFieldName:'ملعب 1',
    placeStatsTitle:'إحصائيات الملعب',
    skipLink:'تخطَّ إلى المحتوى الرئيسي', cityAmman:'عمّان', offSiteBadge:'من خارج الموقع', welcomeGuest:'أهلاً بك',
    brandName:'المستديرة',
    firstVisitWelcome:'أهلاً بك في المستديرة! 👋 اختر الملعب واليوم والوقت، وأرسل طلبك في ثوانٍ — بلا مكالمة واحدة.',
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
    aiNotConfigured:'ميزات الذكاء الاصطناعي غير مفعّلة بعد — أضِف GEMINI_API_KEY (أو OPENAI_API_KEY) في Script Properties على Apps Script.',
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
    rsNotReady:'تعديل الموعد غير مُفعّل على الخادم بعد — تواصل مع إدارة الملعب لتغيير موعدك.',
    // ---- (٢) ندرة الأوقات — تظهر فقط حين يبقى وقت أو وقتان فعلاً ----
    scarce1:'ما بقي إلا وقت واحد في هذا اليوم!', scarce2:'ما بقي إلا وقتان في هذا اليوم!',
    // ---- (٣) حذف الحساب ----
    dangerZone:'منطقة الخطر', delAccount:'حذف الحساب', delAccTitle:'حذف حسابك نهائياً؟',
    delAccMsg:'سيُغلق حسابك ولن تستطيع الدخول به مرة أخرى بهذا الرقم. حجوزاتك القائمة تبقى عند إدارة الملعب كسجل لديها — ألغِ ما لا تريده قبل المتابعة. لا يمكن التراجع عن هذه الخطوة من التطبيق.',
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
  },
  en: {
    brandTag:'Your field, seconds away', nav_features:'Features', nav_how:'How it works', nav_stats:'Stats',
    login:'Log in', register:'Create account', startNow:'Get started', browseFields:'Browse fields',
    heroBadge:'Sports venue booking platform', heroTitlePre:'Skip the calls — book your venue with',
    heroSearchPh:'Search for a field or area…', heroSearchBtn:'Search',
    heroSearchPrefix:'Search for',
    heroSearchWords:['a nearby field','an area','an available time','a 5-a-side field','a 7-a-side field'],
    heroSub:'Browse fields near you, compare prices and open times, and send your booking request in seconds — then track its confirmation step by step from your account.',
    ownerLink:'Own a field? Your dashboard is ready here', statPlaces:'Available fields', statEasy:'Easy', statEasyLbl:'No phone calls',
    statAnytime:'Browse anytime', statFree:'Free', statFreeLbl:'No browsing fees',
    featuresEyebrow:'Features', featuresTitlePre:'Why', featuresTitleBrand:'Al-Mostadeera?',
    featuresSub:'Everything you need to book easily — and everything an owner needs to manage fields professionally.',
    feat1Title:'From browsing to booking in a minute', feat1Text:'See available times, pick the day and time, and send your request — a few clear steps, zero phone calls.',
    feat2Title:'Know the field before you go', feat2Text:'Location, price, amenities, surface type and player ratings — clear info before you choose.',
    feat3Title:'Clear booking follow-up', feat3Text:'From your account, track the booking status and the field’s confirmation, and contact them when a channel is available.',
    howEyebrow:'How it works', howTitlePre:'3 steps and you are', howTitleHi:'ready to play',
    tickerNoCall:'Book without phone calls', tickerClear:'Clear times & prices', tickerFollow:'Track your booking step by step', tickerNoAccount:'Browse without an account',
    chartsTitle:'Charts', chartRevenue:'Daily revenue (confirmed)', chartOccupancy:'Occupancy', chartHours:'By hour', last7short:'Last 7 days',
    step1Title:'Browse & choose', step1Text:'Open the fields list and compare by area, price and rating — then pick your field.',
    step2Title:'Pick the time', step2Text:'Choose the day and available time that suits you from the times table.',
    step3Title:'Send & follow up', step3Text:'Send the booking request and follow up its confirmation with the field — ready to play!',
    calloutTitle:'Ready to book your next field?', calloutSub:'Booking a field is now easier than scoring into an open net. Start without an account, or log in to keep track of your bookings.',
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
    fieldPhotos:'Field photos', lbOpen:'Enlarge photo {i}', lbPrev:'Previous photo', lbNext:'Next photo', lbClose:'Close',
    sportsAria:'Choose a sport', sportFootball:'Football', sportPadel:'Padel', sportBasket:'Basketball', sportTennis:'Tennis', sportVolley:'Volleyball', soonBadge:'Soon',
    comingSoonTitle:'Coming soon!', comingSoonSub:'{sport} venues are warming up in the locker room — hitting the pitch soon.', backToFootball:'Show football fields',
    sportsHint:'AL-Mustadira books sports venues of every kind. Football is what is open for booking now — the other sports open as soon as their venues are registered.',
    servicesTitle:'Services & Amenities', chooseFieldH:'Choose the field', chooseDay:'Choose the day', chooseTime:'Choose the time',
    available:'Available', noServices:'No services information has been added yet.', noTimesDay:'This day is fully booked — try another one nearby.',
    locationBtn:'Location', callBtn:'Call', rateThisPlace:'Rate this place', continueBooking:'Continue booking', perTwoHours:'/ 2 hours', operatingHours:'Hours:',
    reviewTitle:'Review booking', stepField:'Field', stepDate:'Time', stepConfirm:'Confirm',
    rvDay:'Day', rvTime:'Time', rvDuration:'Duration', rvPrice:'Final price', rvName:'Name', rvPhone:'Phone', rvStatus:'Status',
    rvSize:'Field size', rvTotal:'Total', rvReadyNote:'Ready to submit — your booking request will be sent when you confirm.',
    twoHours:'2 hours', statusGuest:'Guest', statusPlayer:'Registered player',
    bkNote:'Once sent, your request goes to the field management — it’s confirmed after their approval, and you can track it under “My bookings”.', confirmBooking:'Confirm booking', changeTime:'Change time',
    authTitle:'One last step to finish booking', authDesc:'Log in or create an account — your selection (field, day and time) is saved and we’ll continue from the same point.',
    authBackEdit:'Back to edit time',
    navHome:'Home', navBookings:'Bookings', navAccount:'Account', navOwner:'Dashboard',
    accountTitle:'My account', accountSub:'Player account details', saveEdit:'Save changes', logout:'Log out', rememberMe:'Remember me on this device',
    bookingsTitle:'My bookings', bookingsSub:'All your bookings in one place',
    grpUpcoming:'Upcoming bookings', grpPending:'Awaiting confirmation', grpPast:'Past bookings', grpCancelled:'Cancelled / Rejected',
    otabToday:'Today', otabBookings:'Bookings', otabCalendar:'Calendar', otabFields:'Fields', otabReports:'Reports',
    chooseFirst:'Choose the field first.', chooseDayMsg:'Choose a suitable day.', chooseTimeMsg:'Choose an available time to continue.',
    bookingConflict:'Another team beat you to it moments ago! Pick another time — and don’t hesitate twice.',
    bookingSent:'Your request was sent! It awaits the field’s confirmation.', langSwitch:'العربية', today:'Today', tomorrow:'Tomorrow',
    noResultsTitle:'No matching fields', noResultsSub:'Even the best strikers miss a shot — change the area or price, or clear the filters and try again.', noResultsSubPlain:'No fields available right now.', clearFiltersBtn:'Clear all filters',
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
    revenueSummary:'Revenue summary', commission10:'10% commission', siteRevenue:'Site revenue', platformProfit:'Platform profit', ownerNet:'Owner net',
    perfTitle:'Performance', confirmRate:'Confirmation rate', topField:'Most booked field', topSource:'Top booking source',
    econTitle:'Economic stats', smartDecisions:'Smart decisions', occupancy:'Occupancy', hintBookedAvail:'Booked ÷ available', lostRevenue:'Lost revenue', hintEmptyPrice:'Empty slots × price', cancelRateLbl:'Cancel / reject', hintLessBetter:'The lower the better', bestTime:'Peak time', hintForPricing:'Useful for pricing', siteShare:'Site bookings', hintDirectVsExt:'Direct vs external', returnRate:'Return rate', hintSameNumber:'Same number more than once',
    pendingReply:'Awaiting your reply', restToday:'Rest of today’s bookings', noBookingsToday:'No bookings today', noBookingsTodaySub:'No bookings or requests for today. Enjoy your day or add an external booking.', noBookingsDay:'No bookings on this day',
    actConfirm:'Confirm', actReject:'Reject', actCancel:'Cancel', actWhatsapp:'WhatsApp', edit:'Edit',
    actApprove:'Approve', actDecline:'Decline',
    fieldActive:'Active', fieldInactive:'Off', fieldEnabled:'Field is now visible to players', fieldDisabled:'Field turned off — hidden from players',
    dtabBook:'Book', dtabAmenities:'Facilities', dtabReviews:'Reviews', dtabLocation:'Location', ariaDetailTabs:'Venue sections',
    noReviewsYet:'No reviews yet — be the first to rate', ratingsCount:'{n} reviews',
    pwTitle:'Change password', pwSub:'Your current password is required — so nobody can change it just by picking up your phone.',
    pwCur:'Current password', pwNew:'New password', pwNew2:'Repeat new password', pwSave:'Change password',
    pwNeedCur:'Enter your current password first', pwTooShort:'New password must be at least 6 characters',
    pwMismatch:'The two entries do not match', pwSame:'New password is the same as the old one',
    pwOk:'Password changed', pwFail:"Couldn't change the password — please try again",
    confirmBookingTitle:'Confirm booking', confirmBookingMsg:'Confirm this booking? The player will get a WhatsApp notification.', reasonRequired:'A reason is required — write a clear reason for the player',
    cancelReasonTitle:'Cancellation reason', rejectReasonTitle:'Rejection reason', reasonHint:'Write the reason shown to the player (prepared as a WhatsApp message, required).', confirmWord:'Confirm',
    last7:'Last 7 days', unknownPlace:'Unknown place', loadingWord:'Loading...', loadingFields:'Loading field details...',
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
    onbTitle:'Book your venue, no calls', onbSub:'Five sports in one app: browse venues, compare prices and times, and book in seconds. Football pitches are open now, the rest are coming.',
    onbAsPlayer:'Player', onbAsOwner:'Venue owner', onbBrowse:'Browse venues', onbHaveAccount:'I have an account',
    onbCreateAccount:'Create new account', onbOwnerEnter:'Owner dashboard login',
    onbOwnerNote:'Manage your venues, bookings and prices in one place.', onbTerms:'By continuing you agree to the Terms and Privacy Policy.',
    onbEyebrow:'Sports venue booking', introTag:'Book your venue',
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
    bookingSuccessTitle:'Booking request sent', statusPendingVenue:'Awaiting venue confirmation', bookingNo:'Booking no.', nextStepNote:'We’ll notify you as soon as the venue confirms.',
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
    phRegName:'John Smith', phRegPass:'At least 4 characters', phAccName:'Player name', phManualName:'Booker name', phFieldName:'Field 1',
    placeStatsTitle:'Field stats',
    skipLink:'Skip to main content', cityAmman:'Amman', offSiteBadge:'Off-site', welcomeGuest:'Welcome',
    brandName:'Al-Mostadeera',
    firstVisitWelcome:'Welcome to Al-Mostadeera! 👋 Pick your field, day and time, and send your request in seconds — not a single phone call.',
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
    aiNotConfigured:'AI features aren’t enabled yet — add GEMINI_API_KEY (or OPENAI_API_KEY) to Script Properties in Apps Script.',
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
    rsNotReady:'Rescheduling isn’t enabled on the server yet — contact the venue to move your booking.',
    // ---- (2) Slot scarcity — shown only when 1 or 2 slots are genuinely free ----
    scarce1:'Only one slot left on this day!', scarce2:'Only two slots left on this day!',
    // ---- (3) Delete account ----
    dangerZone:'Danger zone', delAccount:'Delete account', delAccTitle:'Delete your account?',
    delAccMsg:'Your account will be closed and you won’t be able to log in again with this number. Existing bookings stay on record with the venue — cancel any you don’t want before continuing. This can’t be undone from the app.',
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
};
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
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* ===================== DOM UTILS ===================== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* h(): مُنشئ عناصر آمن. النصوص دائماً textContent ⇒ لا XSS.
   props.html محجوز فقط لسلاسل SVG الثابتة (ICON.*). */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;                 // SVG ثابت فقط
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  appendKids(e, kids);
  return e;
}
function appendKids(e, kids){
  for (const c of kids.flat(3)) {
    if (c == null || c === false || c === '') continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
const ico = (name, cls='svg-sm') => h('span', { class:cls, html:ICON[name], 'aria-hidden':'true', style:{display:'inline-flex'} });
const clear = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); };
const setText = (id, val) => { const el = $('#'+id); if (el) el.textContent = val; };

/* تحية الهوم الأصلية: سطر زمني (صباح/مساء الخير) + اسم مفرد (بدل «أهلاً [الاسم]») */
function updatePlayerGreeting(){
  const h = new Date().getHours();
  const gk = h < 12 ? 'greetMorning' : (h < 18 ? 'greetAfternoon' : 'greetEvening');
  const eb = $('#greetEyebrow');
  if(eb){ eb.textContent = t(gk); eb.setAttribute('data-i18n', gk); }
  const name = Session.player() ? (State.player?.name || t('welcomeYou')) : t('welcomeGuest');
  setText('playerWelcome', name);
}

/* ===================== UTILS ===================== */
function debounce(fn, wait){
  let tm; return function(...a){ clearTimeout(tm); tm = setTimeout(() => fn.apply(this, a), wait); };
}
/* تاريخ محلي YYYY-MM-DD — بديل toISOString (التي ترجع UTC فتُزيح اليوم بين منتصف الليل و3 فجراً بتوقيت الأردن) */
function ymd(d = new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const today = () => ymd();
const dateAfter = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
/* اسم اليوم حسب اللغة (Intl). يبقى الاسم arabicDay للتوافق مع الاستدعاءات. */
const arabicDay = (s) => { try{ return new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar', {weekday:'long'}).format(new Date(s+"T12:00:00")); }catch(_){ return ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"][new Date(s+"T12:00:00").getDay()]; } };
const dayLabel = (s) => { const d=String(s).split('T')[0]; if(d===today()) return t('today'); if(d===dateAfter(1)) return t('tomorrow'); return arabicDay(d); };
const shortDate = (s) => { const d = new Date(s+"T12:00:00"); return `${d.getDate()}/${d.getMonth()+1}`; };
/* تنسيق العملة الموحّد حسب اللغة: د.أ (عربي) / JOD (إنجليزي) */
const formatCurrency = (v) => { const n = (typeof v==='number'&&!Number.isNaN(v)) ? v : parsePrice(v); const a = Math.round(n*100)/100; return (State.lang==='en') ? `${a} JOD` : `${a} د.أ`; };
const formatMoney = formatCurrency;   // توافق مع الاستدعاءات الحالية
const calcPercent = (part, total) => total ? Math.round((part/total)*100) : 0;
function normalizePhone(p){ p = String(p||'').trim().replace(/\s+/g,''); if(p.startsWith('+'))p=p.slice(1); if(p.startsWith('00962'))p='962'+p.slice(5); if(p.startsWith('07'))p='962'+p.slice(1); return p; }
function normalizeText(v){ return String(v||'').trim().toLowerCase().replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'').replace(/\s+/g,''); }
/* تطبيع حجم الملعب للمقارنة: 6×6 و 6x6 و "6 X 6" كلها قيمة واحدة */
const normSize = (v) => String(v||'').trim().toLowerCase().replace(/[×X]/g,'x').replace(/\s+/g,'');
/* صور الملعب: خلية image_url في شيت Fields تقبل عدة روابط مفصولة بفواصل أو أسطر
   (الرابط الأول = الصورة الرئيسية). تُقبل روابط http(s) فقط. */
function fieldImages(f){ return [...new Set(String((f&&f.image_url)||'').split(/[,\n|]+/).map(s=>s.trim()).filter(s=>/^https?:\/\//i.test(s)))]; }
const getSource = () => new URLSearchParams(location.search).get('source') || 'direct';

/* ===================== FAVORITES (محلي فقط — localStorage، بلا باكند) ===================== */
const FAV_KEY = 'mustadaira:favorites';
function favGet(){ try{ const a=JSON.parse(localStorage.getItem(FAV_KEY)||'[]'); return new Set(Array.isArray(a)?a.map(String):[]); }catch(_){ return new Set(); } }
function favHas(id){ return favGet().has(String(id)); }
function favToggle(id){ const s=favGet(); const k=String(id); if(s.has(k)) s.delete(k); else s.add(k); try{ localStorage.setItem(FAV_KEY, JSON.stringify([...s])); }catch(_){} return s.has(k); }

/* أحرف الاسم لأفاتار الأحرف (كلمتان كحدّ أقصى) — يعمل بالعربي والإنجليزي، وبديله '؟' */
function initials(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2);
  return parts.length ? parts.map(w=>[...w][0]).join('') : '؟';
}
function safeRating(v){ const n = Number(v); return (Number.isNaN(n)||n<0||n>5) ? 0 : Math.round(n*10)/10; }
function safeReviews(v){ const n = Number(v); return (Number.isNaN(n)||n<0||n>1e5) ? 0 : Math.round(n); }
// مكان بلا تقييم حقيقي واحد لا تُرسم له شارة نجمة أصلًا — «★ 0 (0)» تُقرأ كتقييم سيّئ لا كغياب تقييم.
function hasRating(place){ return safeReviews(place?.reviews) > 0; }
function ratingText(place){
  const r = Number(String(place?.rating??0).replace(',','.')); const c = Number(String(place?.reviews??0).replace(',','.'));
  const rating = (Number.isFinite(r)&&r>0&&r<=5) ? String(Math.round(r*10)/10).replace('.0','') : '0';
  const reviews = (Number.isFinite(c)&&c>=0) ? Math.round(c) : 0;
  return `${rating} (${reviews})`;
}
function normalizeSlotsKeyword(kw){ kw=String(kw||'').trim().toLowerCase();
  if(kw==='full')return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م|14=2:00 - 4:00 م|16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  if(kw==='morning')return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م";
  if(kw==='evening')return "16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  return kw; }
function slotsToKeyword(s){ s=String(s||'').toLowerCase(); if(s==='full'||s.includes('22=10:00'))return 'full'; if(s==='morning'||s.includes('12=12:00'))return 'morning'; if(s==='evening'||s.includes('16=4:00'))return 'evening'; return 'full'; }
function parseSlots(text){ const clean=normalizeSlotsKeyword(text); if(!clean||!clean.includes('='))return DEFAULT_SLOTS;
  const arr=clean.split('|').map(s=>{const[h,...l]=s.split('=');return{hour:Number(h),label:l.join('=').trim()};}).filter(s=>!Number.isNaN(s.hour)&&s.label);
  return arr.length?arr:DEFAULT_SLOTS; }
const fieldSlots = (f) => parseSlots(f?.slots);

/* قراءة موحّدة لحالة الحجز (تتسامح مع الحالة الفارغة أو بحروف كبيرة من الخادم) */
function normStatus(b){ return String((b && b.status) || 'pending').toLowerCase(); }
const isFinished = (b) => { const h=Number(b.hour); if(!b.date||Number.isNaN(h))return false; const s=new Date(`${b.date}T${String(h).padStart(2,'0')}:00:00`); const e=new Date(s); e.setHours(e.getHours()+2); return new Date()>=e; };
const isOld = (s, keep=14) => { const base=new Date(today()+"T00:00:00"); const d=new Date(String(s||'').split('T')[0]+"T00:00:00"); if(Number.isNaN(d.getTime()))return false; return Math.floor((base-d)/864e5)>keep; };
function splitFinished(list){ const a=[],f=[]; (list||[]).forEach(b=>(isFinished(b)?f:a).push(b)); return {active:a,finished:f}; }
const visibleBookings = (list, keep, all) => all ? list : (list||[]).filter(b=>!isOld(b.date,keep));
function runtimeStatus(b){ const s=normStatus(b); if(s!=='confirmed')return s; const h=Number(b.hour); if(Number.isNaN(h)||!b.date)return s; const st=new Date(`${b.date}T${String(h).padStart(2,'0')}:00:00`); const e=new Date(st); e.setHours(e.getHours()+2); const now=new Date(); return (now>=st&&now<e)?'in_progress':s; }
function statusLabel(s){ const m={confirmed:{t:t('statusConfirmed'),c:'badge-green'},pending:{t:t('statusPending'),c:'badge-yellow'},cancelled:{t:t('statusCancelled'),c:'badge-red'},rejected:{t:t('statusRejected'),c:'badge-red'},in_progress:{t:t('statusInProgress'),c:'badge-blue'}}; return m[String(s||'pending').toLowerCase()]||m.pending; }
const isOwnerManual = (b) => String(b.source||'').trim().toLowerCase()==='owner_manual';
const isWebsite = (b) => !isOwnerManual(b);
function getTopBy(items, keyFn, labelFn){ const m={}; items.forEach(it=>{const k=keyFn(it)||'-'; if(!m[k])m[k]={count:0,label:labelFn?labelFn(it):k}; m[k].count++;}); return Object.values(m).sort((a,b)=>b.count-a.count)[0]||null; }

/* استخراج كل الأرقام السعرية من أي صيغة: رقم، «40 د.أ»، «40-60» (مدى بحقل واحد)،
   أرقام عربية «٤٠». يمنع NaN/Infinity من إفساد بطاقة السعر ويكشف المدى الحقيقي. */
const priceNumbers = (v) => {
  if (v == null) return [];
  const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  return (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(x => x > 0);
};
const parsePrice = (v) => { const a = priceNumbers(v); return a.length ? a[0] : 0; };
const fieldPrices = (p) => (p.fields||[]).flatMap(f => priceNumbers(f.price));
const minPrice = (p) => { const a=fieldPrices(p); return a.length?Math.min(...a):0; };
const maxPrice = (p) => { const a=fieldPrices(p); return a.length?Math.max(...a):0; };
function isFieldAvailable(fid, total){ const fb=State.bookedSlots[fid]||{}; for(let i=0;i<7;i++){const d=dateAfter(i); if((fb[d]||[]).length<total)return true;} return false; }
const isPlaceAvailable = (p) => p.fields.some(f=>isFieldAvailable(f.field_id, fieldSlots(f).length));
const placeLocation = (p) => { const c=String(p?.city||'').trim(), r=String(p?.region||'').trim(); return (c&&r)?`${c} - ${r}`:(c||r||''); };

/* ===================== SESSION (إدارة الجلسات) ===================== */
/* توافق كامل مع النسخة الأصلية المنشورة: التوكنات تُخزَّن بالمفاتيح القديمة
   player_token / owner_token كنص مباشر بلا TTL (حتى لا يُسجَّل خروج المستخدمين
   الحاليين). الثيم/اللغة فقط تحت namespace. لا تغيير لأي شيء في الخادم. */
/* «تذكّرني»: مؤشّر ⇒ التوكن في localStorage (يبقى بعد إغلاق المتصفّح)،
   غير مؤشّر ⇒ في sessionStorage (ينتهي بإغلاق المتصفّح فلا دخول تلقائي دائم).
   القراءة تبدأ من localStorage ⇒ المستخدمون الحاليون يبقون داخلين بلا خروج قسري. */
const Session = (() => {
  const getRaw = (k) => { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch(_){ return ''; } };
  const setRaw = (k,v,remember) => { try {
    localStorage.removeItem(k); sessionStorage.removeItem(k);
    if(v) (remember ? localStorage : sessionStorage).setItem(k,v);
  } catch(_){} };
  const del = (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch(_){} };
  return {
    player:  () => getRaw('player_token'),
    owner:   () => getRaw('owner_token'),
    setPlayer: (t,remember) => { setRaw('player_token', t, remember); del('owner_token'); },   // دخول لاعب ⇒ احذف توكن المالك
    setOwner:  (t,remember) => { setRaw('owner_token', t, remember); del('player_token'); },   // دخول مالك ⇒ احذف توكن اللاعب
    clear:   () => { del('player_token'); del('owner_token'); },
    theme:   () => { try { const v = localStorage.getItem('mustadaira:theme'); if(v==='light'||v==='dark') return v; return (window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches) ? 'dark' : 'light'; } catch(_){ return 'light'; } },
    setTheme:t => { try { localStorage.setItem('mustadaira:theme', t); } catch(_){} },
  };
})();

/* ===================== API (Timeout + AbortController) ===================== */
const requestControllers = {};   // { key: AbortController } — لإلغاء الطلب القديم من نفس النوع
const isAbort = (e) => !!e && (e.name==='AbortError');
const isTimeout = (e) => !!e && (e.name==='TimeoutError');
/* طلب مع مهلة وإلغاء: إن مُرّر key يُلغى الطلب السابق من نفسه (آخر نتيجة تفوز) */
async function fetchWithTimeout(url, options={}, timeoutMs=CONFIG.API_TIMEOUT, key){
  if(key){ const prev=requestControllers[key]; if(prev){ try{ prev.abort(); }catch(_){} } }
  const ctrl = new AbortController();
  if(key) requestControllers[key]=ctrl;
  const timer = setTimeout(()=>{ try{ ctrl.abort(new DOMException('timeout','TimeoutError')); }catch(_){ ctrl.abort(); } }, timeoutMs);
  try{
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    if(key && requestControllers[key]===ctrl) requestControllers[key]=null;
  }
}
/* رسالة خطأ موحّدة: تتجاهل الإلغاء المقصود، وتميّز انتهاء المهلة */
function handleApiError(e, fallbackKey){
  if(isAbort(e)) return;                                  // إلغاء مقصود — بلا رسالة
  if(isTimeout(e)){ toast(t('apiTimeout'),'error'); return; }
  toast(t(fallbackKey||'apiError'),'error');
}
/* ═══════════════════════════════════════════════════════════════════════════
   طبقة البيانات — Supabase (Postgres) بدل Google Apps Script.

   ⚑ **العقد محفوظ حرفيًّا:** كل عملية تُعيد نفس شكل الاستجابة الذي كان يُعيده
     الباكند القديم (`{success,message,...}` وأسماء الحقول ذاتها)، فلم يتغيّر
     أيّ من الـ19 موضع استدعاء في هذا الملفّ. السبب: تغيير الشكل كان سيفرض
     تعديل الواجهة كلّها، وكل تعديل إضافي = سطح خطأ إضافي في تحويل حسّاس أصلًا.

   ⚑ **الجلسة:** التوكن لم يعد `base64(id|phone)` القابل للقراءة والذي لا ينتهي،
     بل JSON يحمل جلسة Supabase (access/refresh) وينتهي ويُجدَّد. يُخزَّن بنفس
     مفاتيح localStorage القديمة ويمرّ عبر نفس `Session`، فالواجهة تعامله
     كنصّ معتم كما كانت — ولذلك لم تتغيّر وحدة `Session` إطلاقًا.

   ⚑ **المعرّفات:** صارت uuid بدل أرقام. لا يهمّ: كل المقارنات في الواجهة
     نصّية (`String(x)===String(y)`) ومفاتيح `bookedSlots` نصّية أيضًا.
   ═══════════════════════════════════════════════════════════════════════════ */
const SB = {
  URL: 'https://nxqddfuwtrsabprxcfez.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cWRkZnV3dHJzYWJwcnhjZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNDkwNDcsImV4cCI6MjEwMDYyNTA0N30.SOL5yoyeDZpJOEneH9rgqGc5P6HswMw5fR9d76Uh0wA',
  MAIL: '@mustadeera.app',   // بريد مشتقّ من الرقم: مصادقة الهاتف بـOTP تتطلّب مزوّد SMS مدفوعًا
};

/* توحيد الرقم — نفس منطق normalizePhone في الباكند القديم حرفيًّا */
function sbPhone(p){
  p = String(p||'').trim().replace(/\s+/g,'');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00962')) p = '962' + p.slice(5);
  if (p.startsWith('07')) p = '962' + p.slice(1);
  return p;
}
const sbMail = (phone) => sbPhone(phone) + SB.MAIL;

/* ── طلب REST/Auth مع نفس المهلة والإلغاء المستعملين سابقًا ── */
async function sbFetch(path, { method='GET', body, token, prefer, key, timeout }={}){
  const headers = { apikey: SB.KEY, Authorization: 'Bearer ' + (token || SB.KEY) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers['Prefer'] = prefer;
  const res = await fetchWithTimeout(SB.URL + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }, timeout || CONFIG.API_TIMEOUT, key);
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch(_){ data = null; }
  return { ok: res.ok, status: res.status, data, raw: text };
}
const sbRest = (path, opts) => sbFetch('/rest/v1' + path, opts);

/* ── الجلسة: قراءة/تجديد التوكن المخزّن ──
   التوكن نصّ JSON. إن قارب على الانتهاء يُجدَّد بـrefresh_token قبل الاستعمال،
   فلا تنقطع جلسة المستخدم فجأة كما كان يحدث لو انتهت صلاحية access وحده. */
function sbParse(tok){ try{ const s = JSON.parse(tok||'null'); return (s && s.at) ? s : null; } catch(_){ return null; } }
async function sbSession(tok, isOwner){
  const s = sbParse(tok);
  if (!s) return null;
  if (s.exp && Date.now() < s.exp - 60000) return s;                       // صالح
  const r = await sbFetch('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token: s.rt } });
  if (!r.ok || !r.data || !r.data.access_token) return null;               // انتهت فعلًا
  const next = { ...s, at:r.data.access_token, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000 };
  const str = JSON.stringify(next);
  try { isOwner ? Session.setOwner(str, true) : Session.setPlayer(str, true); } catch(_){}
  return next;
}

/* ── تحويلات الشكل: من أعمدة القاعدة إلى الحقول التي تتوقّعها الواجهة ── */
// المرافق ⟵ نفس منطق getAmenityValue في الباكند القديم (نصّ "water:Free|vests:Available")
function sbAmenities(p){
  const one = (v, key) => {
    const s = String(v==null?'':v).trim(); if(!s) return '';
    const low = s.toLowerCase();
    if (['false','no','0','غير متوفر'].includes(low)) return '';
    if (['true','yes','1'].includes(low)) return key + ':Available';
    return key + ':' + s;
  };
  return [one(p.amenity_water,'water'), one(p.amenity_vests,'vests'), one(p.amenity_ball,'ball'),
          one(p.amenity_bathrooms,'bathrooms'), one(p.amenity_parking,'parking')].filter(Boolean).join('|');
}
// الأوقات: jsonb [{h,label}] ⟵⟶ النصّ "8=label|10=label" الذي يفهمه parseSlots
const sbSlotsToText = (arr) => Array.isArray(arr) ? arr.map(s => `${s.h}=${s.label}`).join('|') : String(arr||'');
const sbField = (f) => ({
  field_id: String(f.id), place_id: String(f.place_id), field_name: f.name, size: f.size,
  price: Number(f.price||0), slots: sbSlotsToText(f.slots), active: !!f.active, image_url: f.image_url || ''
});
const sbPlace = (p, stat) => ({
  place_id: String(p.id), place_name: p.name, city: p.city, region: p.region, type: p.type,
  color: p.color, phone: p.phone, active: !!p.active, map_link: p.map_link || '',
  amenities: sbAmenities(p),
  // التقييمات الحقيقية فقط — `rating_seed`/`reviews_seed` (أرقام مكتوبة يدويًّا في الشيت القديم)
  // أُسقطا عمدًا: مكان بلا تقييم حقيقي لا يُعرض له تقييم إطلاقًا (لا صفر ولا رقم مُختلق).
  rating:  stat ? Number(stat.rating) : 0,
  reviews: stat ? Number(stat.reviews_count) : 0,
  reviews_dist: stat ? stat.reviews_dist : null,
  fields: []
});
// الحجز: `row_number` كان رقم الصفّ في الشيت وصار **مُعرّف الصفّ (uuid)**.
// الواجهة تُعيده كما هو إلى updateBookingStatus، فيدور دورة كاملة بلا تعديل استدعاء.
const sbBooking = (b) => ({
  row_number: String(b.id), booking_id: String(b.id), timestamp: b.created_at,
  player_id: b.player_id ? String(b.player_id) : '',
  date: String(b.booking_date||'').split('T')[0],
  place_id: String(b.place_id), place_name: b.place_name || '',
  field_id: String(b.field_id), field_name: b.field_name || '',
  city: b.city || '', time: b.time_label || '', hour: Number(b.hour),
  name: b.customer_name || '', phone: b.customer_phone || '', players: b.players_size || '',
  price: Number(b.price||0), source: b.source || 'direct',
  status: String(b.status||'pending').toLowerCase(), cancel_reason: b.cancel_reason || ''
});

/* ── عمليات القراءة العامة (بلا تسجيل دخول) ── */
async function sbGetInitialData(key){
  const [pl, fl, st, bk] = await Promise.all([
    sbRest('/places?select=*&active=is.true&order=name', { key }),
    sbRest('/fields?select=*&active=is.true'),
    sbRest('/place_stats?select=*'),
    sbRest('/booked_slots?select=*'),
  ]);
  if (!pl.ok || !fl.ok) throw new Error('supabase places failed');
  const stats = {}; (st.data||[]).forEach(s => stats[String(s.place_id)] = s);
  const byPlace = {}; (fl.data||[]).forEach(f => (byPlace[String(f.place_id)] ||= []).push(sbField(f)));
  const places = (pl.data||[]).map(p => { const o = sbPlace(p, stats[String(p.id)]); o.fields = byPlace[String(p.id)] || []; return o; })
                              .filter(p => p.fields.length > 0);       // نفس سلوك الباكند القديم
  const bookings = (bk.data||[]).map(b => ({ field_id:String(b.field_id), date:String(b.booking_date||'').split('T')[0], hour:Number(b.hour), status:'confirmed' }));
  return { places, bookings };
}
async function sbGetBookedSlots(key){
  const r = await sbRest('/booked_slots?select=*', { key });
  if (!r.ok) throw new Error('supabase booked_slots failed');
  return (r.data||[]).map(b => ({ field_id:String(b.field_id), date:String(b.booking_date||'').split('T')[0], hour:Number(b.hour), status:'confirmed' }));
}

/* ── المصادقة ── */
async function sbLogin(phone, password, wantRole){
  const r = await sbFetch('/auth/v1/token?grant_type=password', { method:'POST', body:{ email: sbMail(phone), password: String(password||'') } });
  if (!r.ok || !r.data || !r.data.access_token) return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  const at = r.data.access_token, uid = r.data.user && r.data.user.id;
  const pr = await sbRest(`/profiles?select=*&id=eq.${uid}`, { token: at });
  const prof = (pr.data||[])[0];
  if (!prof || !prof.active) return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  if (wantRole === 'owner' && prof.role !== 'owner' && prof.role !== 'admin') return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  let placeId = '';
  if (wantRole === 'owner'){
    const po = await sbRest(`/place_owners?select=place_id&profile_id=eq.${uid}`, { token: at });
    placeId = ((po.data||[])[0]||{}).place_id || '';
  }
  return { success:true, session:{ at, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000,
           uid:String(uid), role:prof.role, name:prof.name||'', phone:prof.phone||'', place_id:String(placeId||'') } };
}

/* ── تغيير كلمة السرّ ──
   ثلاث خطوات مقصودة، والأولى ليست شكليّة:
   ① **إعادة مصادقة بكلمة السرّ الحالية.** توكن الجلسة وحده يكفي تقنيًّا لتغيير
      كلمة السرّ، لكن ذلك يعني أن هاتفًا مسروقًا (والجلسة عليه مفتوحة) يستطيع
      قفل صاحبه خارج حسابه نهائيًّا. اشتراط كلمة السرّ الحالية يمنع ذلك.
   ② التغيير عبر توكن **حديث** من الخطوة ① لا التوكن المخزّن (قد يكون قارب الانتهاء).
   ③ دخول جديد بكلمة السرّ الجديدة ⇒ جلسة مضمونة الصلاحية تُخزَّن مكان القديمة،
      فلا يجد المستخدم نفسه مخرَجًا بعد نجاح العملية. */
async function sbChangePassword(tok, isOwner, currentPassword, newPassword){
  const s = await sbSession(tok, isOwner);
  if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const email = sbMail(s.phone);

  const re = await sbFetch('/auth/v1/token?grant_type=password',
    { method:'POST', body:{ email, password:String(currentPassword||'') } });
  if (!re.ok || !re.data || !re.data.access_token)
    return { success:false, message:'كلمة السر الحالية غلط' };

  const up = await sbFetch('/auth/v1/user',
    { method:'PUT', token:re.data.access_token, body:{ password:String(newPassword||'') } });
  if (!up.ok){
    const m = up.data && (up.data.msg || up.data.error_description || up.data.message);
    // الخادم هو الحكم على السياسة (الطول مثلًا) — ننقل رسالته لا نخترع واحدة
    return { success:false, message: m || 'ما قدرنا نغيّر كلمة السر، جرّب كمان مرة' };
  }

  const fresh = await sbFetch('/auth/v1/token?grant_type=password',
    { method:'POST', body:{ email, password:String(newPassword||'') } });
  const session = (fresh.ok && fresh.data && fresh.data.access_token)
    ? { ...s, at:fresh.data.access_token, rt:fresh.data.refresh_token,
        exp: Date.now() + (fresh.data.expires_in||3600)*1000 }
    : null;
  return { success:true, message:'تم تغيير كلمة السر', session };
}

/* ── الحجوزات ── */
const SB_BK_COLS ='id,created_at,player_id,place_id,field_id,booking_date,hour,time_label,customer_name,customer_phone,players_size,price,source,status,cancel_reason,place_name,field_name,city';

async function sbCreateBooking(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbRest('/bookings', { method:'POST', token: session.at, prefer:'return=representation', body:{
    player_id: session.uid, place_id: d.place_id, field_id: d.field_id,
    booking_date: d.date, hour: Number(d.hour), time_label: d.time || '',
    customer_name: d.name || session.name || '', customer_phone: sbPhone(d.phone || session.phone),
    players_size: d.players || '', price: Number(d.price||0), source: d.source || 'direct', status: 'pending'
  }});
  // 23505 = خرق القيد الفريد ⇒ الخانة حُجزت بين العرض والحفظ. هذا هو الضمان الذي
  // لم يكن موجودًا مع الشيت: التزامن يُحسم في القاعدة لا في منطق التطبيق.
  if (!r.ok) return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت راح، اختار وقت ثاني' : 'صار ضغط على النظام، حاول بعد ثانية' };
  return { success:true, message:'وصل طلبك، بنأكدلك قريب' };
}

async function sbUpdateBookingStatus(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const patch = { status: d.status };
  if (d.cancel_reason !== undefined) patch.cancel_reason = d.cancel_reason || '';
  const r = await sbRest(`/bookings?id=eq.${d.row_number}`, { method:'PATCH', token: session.at, prefer:'return=representation', body: patch });
  if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
  if (!r.data || !r.data.length) return { success:false, message:'ما بتقدر تعدّل حالة الحجز' };   // منعته سياسة RLS
  return { success:true, message:'تم التحديث' };
}

/* تعديل موعد حجز معلّق — عبر **دالّة في القاعدة** لا PATCH مباشر.
   سياسة `bookings_update` تسمح للاعب بالتحديث إلى `cancelled` وحدها
   (`with check … status = 'cancelled'`). توسيعها لتمرير `pending` كان سيفتح
   **كل** الأعمدة أمامه — السعر والملعب واسم صاحب الحجز. الدالّة أضيق:
   تعدّل `booking_date` و`hour` وحدهما بعد التحقّق من الملكية والحالة والتوفّر،
   والقيد الفريد في القاعدة يحسم التزامن كما في الإنشاء.
   ⚠️ تحتاج تشغيل `migration/09_player_reschedule.sql` مرّة واحدة. قبله يردّ
   PostgREST 404/PGRST202 ⇒ نقولها للمستخدم صراحةً بدل «حدث خطأ» مبهم. */
async function sbRescheduleBooking(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbFetch('/rest/v1/rpc/player_reschedule_booking', { method:'POST', token: session.at, body:{
    p_booking: String(d.row_number), p_date: String(d.date), p_hour: Number(d.hour), p_time_label: d.time || ''
  }});
  if (r.status === 404 || (r.raw||'').includes('PGRST202')) return { success:false, message: t('rsNotReady') };
  if (!r.ok) return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت راح، اختار وقت ثاني' : 'صار خطأ، حاول كمان مرة' };
  const out = r.data || {};
  return { success: !!out.success, message: out.message || '' };
}

/* ═══ الموزّع: نفس واجهة API القديمة (get/post) فوق Supabase ═══ */
const API = {
  async get(action, extra={}, key) {
    switch(action){
      case 'getInitialData': return sbGetInitialData(key);
      case 'getBookings':    return sbGetBookedSlots(key);

      case 'playerLogin': {
        const r = await sbLogin(extra.phone, extra.password, 'player');
        if (!r.success) return r;
        return { success:true, message:'أهلاً، تفضل', player_token: JSON.stringify(r.session),
                 player:{ player_id:r.session.uid, name:r.session.name, phone:r.session.phone } };
      }
      case 'ownerLogin': {
        const r = await sbLogin(extra.phone, extra.password, 'owner');
        if (!r.success) return r;
        return { success:true, message:'أهلاً، تفضل', owner_token: JSON.stringify(r.session),
                 owner:{ owner_id:r.session.uid, phone:r.session.phone, place_id:r.session.place_id } };
      }

      case 'getPlayerBookings': {
        const s = await sbSession(extra.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const r = await sbRest(`/bookings_full?select=${SB_BK_COLS}&player_id=eq.${s.uid}&order=booking_date.desc,hour.desc`, { token:s.at, key });
        if (!r.ok) return { success:false, message:'تعذّر جلب البيانات' };
        return { success:true, bookings:(r.data||[]).map(sbBooking) };
      }
      case 'getPlayerProfile': {
        const s = await sbSession(extra.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        return { success:true, player:{ player_id:s.uid, name:s.name, phone:s.phone } };
      }

      case 'getOwnerData': {
        const s = await sbSession(extra.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const [pl, fl, bk, st] = await Promise.all([
          sbRest(`/places?select=*&id=eq.${s.place_id}`, { token:s.at, key }),
          sbRest(`/fields?select=*&place_id=eq.${s.place_id}&order=name`, { token:s.at }),
          sbRest(`/bookings_full?select=${SB_BK_COLS}&place_id=eq.${s.place_id}&order=booking_date.desc,hour.desc`, { token:s.at }),
          sbRest(`/place_stats?select=*&place_id=eq.${s.place_id}`, { token:s.at }),
        ]);
        if (!pl.ok || !(pl.data||[]).length) return { success:false, message:'ما لقينا المكان تبعك' };
        // ملاحظة: المالك يرى ملاعبه **الموقوفة** أيضًا — كان هذا عطلًا في الباكند القديم
        // (getPlaces يُسقط active=false) وصار مضمونًا هنا بسياسة owns_place في RLS.
        const place = sbPlace(pl.data[0], (st.data||[])[0]);
        place.fields = (fl.data||[]).map(sbField);
        return { success:true, place, fields: place.fields, bookings: (bk.data||[]).map(sbBooking) };
      }
      default:
        return { success:false, message:'صار خطأ، حاول كمان مرة' };
    }
  },

  async post(data, key) {
    switch(data.action){
      case 'playerRegister': {
        const phone = sbPhone(data.phone), name = String(data.name||'').trim(), pw = String(data.password||'');
        if (!name || !phone || !pw) return { success:false, message:'كمّل البيانات كلها عشان نكمل' };
        if (pw.length < 6) return { success:false, message:'كلمة السر لازم 6 حروف أو أرقام على الأقل' };
        const r = await sbFetch('/auth/v1/signup', { method:'POST', key, body:{ email: sbMail(phone), password: pw, data:{ name, phone } } });
        if (!r.ok){
          const msg = String(r.raw||'');
          if (msg.includes('already registered') || msg.includes('User already')) return { success:false, message:'الرقم عنده حساب، ادخل من هون' };
          return { success:false, message:'صار خطأ، حاول كمان مرة' };
        }
        // بلا جلسة في الردّ ⇒ «تأكيد البريد» ما زال مفعّلًا في إعدادات المشروع.
        if (!r.data || !r.data.access_token) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        const uid = r.data.user && r.data.user.id, at = r.data.access_token;
        await sbRest('/profiles', { method:'POST', token: at, body:{ id: uid, role:'player', name, phone, active:true } });
        const session = { at, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000,
                          uid:String(uid), role:'player', name, phone, place_id:'' };
        return { success:true, message:'تمام، حسابك جاهز', player_token: JSON.stringify(session),
                 player:{ player_id:String(uid), name, phone } };
      }

      case 'updatePlayerProfile': {
        const s = await sbSession(data.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const name = String(data.name||'').trim();
        if (!name) return { success:false, message:'ما حطيت اسمك' };
        const r = await sbRest(`/profiles?id=eq.${s.uid}`, { method:'PATCH', token:s.at, prefer:'return=representation', body:{ name } });
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تم حفظ التعديلات', player:{ player_id:s.uid, name, phone:s.phone } };
      }

      /* «حذف الحساب» = **إغلاقه** (`profiles.active = false`).
         حذف مستخدم من `auth.users` يحتاج `service_role`، ووضع ذلك المفتاح في
         المتصفّح = تسليم القاعدة كاملةً — نفس سبب رفض «إعادة تعيين كلمة السرّ»
         في `/admin` (قرار ٥). والإغلاق يمنع الدخول فعليًّا لا شكليًّا:
         `sbLogin` يرفض أي حساب `active=false` قبل أن يُصدر جلسة.
         ⚠️ ولذلك نصّ التأكيد يقول ما يحدث بالضبط ولا يَعِد بمحو البيانات. */
      case 'deleteAccount': {
        const s = await sbSession(data.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const r = await sbRest(`/profiles?id=eq.${s.uid}`, { method:'PATCH', token:s.at,
          prefer:'return=representation', body:{ active:false } });
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        // صفّ فارغ مع 200 = منعته RLS. قبول العملية ≠ نجاحها.
        if (!(r.data||[]).length) return { success:false, message:'ما بتقدر تحذف هذا الحساب' };
        return { success:true, message:'تم حذف حسابك' };
      }

      // يخدم اللاعب والمالك معًا — الفرق فقط أيّ توكن أُرسل
      case 'changePassword': {
        const isOwner = !!data.owner_token;
        return sbChangePassword(data.owner_token || data.player_token, isOwner,
                                data.current_password, data.new_password);
      }

      case 'createBooking':
        return sbCreateBooking(data, await sbSession(data.player_token, false));

      case 'ownerCreateManualBooking': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const r = await sbRest('/bookings', { method:'POST', token:s.at, prefer:'return=representation', body:{
          player_id: null, place_id: s.place_id, field_id: data.field_id,
          booking_date: data.date, hour: Number(data.hour), time_label: data.time || '',
          customer_name: String(data.name||'حجز خارجي').trim(), customer_phone: sbPhone(data.phone||''),
          players_size: data.players || '', price: Number(data.price||0),
          source: 'owner_manual', status: 'confirmed', cancel_reason: 'حجز خارجي أدخله المالك'
        }});
        if (!r.ok) return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت محجوز بالفعل' : 'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تم حفظ الحجز' };
      }

      case 'updateBookingStatus': {
        const s = await sbSession(data.owner_token || data.player_token, !!data.owner_token);
        return sbUpdateBookingStatus(data, s);
      }

      case 'playerRescheduleBooking':
        return sbRescheduleBooking(data, await sbSession(data.player_token, false));

      case 'ownerUpdateField': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const body = {};
        if (data.price  !== undefined) body.price  = Number(data.price||0);
        if (data.active !== undefined) body.active = data.active !== false;
        if (data.slots  !== undefined) body.slots  = parseSlots(data.slots).map(x => ({ h:x.hour, label:x.label }));
        const r = await sbRest(`/fields?id=eq.${data.field_id}`, { method:'PATCH', token:s.at, prefer:'return=representation', body });
        if (!r.ok || !(r.data||[]).length) return { success:false, message:'هذا الملعب مش تابع لحسابك' };
        return { success:true, message:'تم حفظ التعديلات' };
      }

      case 'ownerAddField': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const r = await sbRest('/fields', { method:'POST', token:s.at, prefer:'return=representation', body:{
          place_id: s.place_id, name: String(data.field_name||'ملعب').trim(), size: data.size || '5×5',
          price: Number(data.price||0), slots: parseSlots(data.slots).map(x => ({ h:x.hour, label:x.label })),
          image_url: data.image_url || '', active: true
        }});
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تمت إضافة الملعب' };
      }

      case 'createReview': {
        const s = await sbSession(Session.player(), false);
        const r = await sbRest('/reviews', { method:'POST', token: s ? s.at : undefined, body:{
          place_id: data.place_id, field_id: data.field_id || null,
          author_name: data.user_name || '', phone: sbPhone(data.phone||''),
          rating: Math.round(Number(data.rating||0)), comment: data.comment || ''
        }});
        if (!r.ok) return { success:false, message:'في شي ناقص بالتقييم' };
        return { success:true, message:'شكراً، تقييمك وصل' };
      }

      default:
        return { success:false, message:'صار خطأ، حاول كمان مرة' };
    }
  },

  /* طلبات AI ما زالت على Apps Script (لم تُرحَّل — تحتاج مفتاح Gemini على الخادم).
     تفشل بهدوء إن لم يكن منشورًا، والواجهة تعالج الفشل أصلًا. */
  async getAi(action, extra={}, key) {
    const params = new URLSearchParams({ action, ...extra });
    const res = await fetchWithTimeout(`${CONFIG.API_URL}?${params}`, {}, CONFIG.AI_TIMEOUT, key);
    if (!res.ok) throw new Error('API GET failed');
    return res.json();
  }
};

/* ===================== STATE (حالة مغلّفة) ===================== */
const State = {
  places: [], publicBookings: [], bookedSlots: {},
  publicBookingsFetchedAt: 0,                                 // آخر جلب ناجح للحجوزات العامة (كاش قصير)
  favOnly: false,                                             // عرض المفضّلة فقط (محلي)
  sport: 'football',                                          // الرياضة المختارة (كرة القدم متاحة، والبقية قريباً)
  // وضع عرض البطاقات (شبكة/قائمة) — محفوظ ويُستعاد بعد إعادة التحميل
  view: (()=>{ try{ return localStorage.getItem('mustadaira:viewMode')==='list'?'list':'grid'; }catch(_){ return 'grid'; } })(),
  player: null, owner: null, ownerData: null, guest: false,
  filter: 'all',                                              // المنطقة (تبويبات)
  // فلاتر متقدّمة (ورقة الفلاتر) + الترتيب — تعتمد فقط على البيانات الموجودة
  fx: { minPrice:null, maxPrice:null, sizes:[], types:[], minRating:0, availableToday:false, amenities:[] },
  fxDraft: null,                                              // مسودّة أثناء فتح الورقة (تُلتزم عند "تطبيق")
  sort: 'default', sortDraft: 'default',
  showAllPlayer: false, showAllOwner: false,
  editingField: 'edit',
  refreshTimer: null,
  // اختيارات المستخدم (بدل المتغيرات العامة المتفرّقة)
  detail: { place:null, field:null, date: today(), hour:null },
  booking:{ place:null, field:null, date:null, hour:null, editing:true },   // null date ⇒ إفشاء تدريجي
  manual: { fieldId:null, date: today(), hour:null },
  reschedule: { booking:null, field:null, date:null, hour:null },   // تعديل موعد حجز معلّق
  review: { rating:0, placeId:null },
  pendingBooking: null,   // حجز الضيف المحفوظ ريثما يسجّل دخوله ثم يُستأنف
  pageScroll: {},         // موضع التمرير لكل صفحة (الرئيسية تستعيده دائمًا، والرجوع يستعيد صفحته)
  ownerTab: 'today',      // تبويب لوحة المالك النشط
  calMonth: null,         // شهر التقويم المعروض (Date لأول الشهر)
  lang: (()=>{ try{ return localStorage.getItem('mustadaira_language')||'ar'; }catch(_){ return 'ar'; } })(),
};

function normalizePlaces(remote){
  return (remote||[]).map(p => ({
    ...p, place_id:String(p.place_id), rating:safeRating(p.rating), reviews:safeReviews(p.reviews),
    fields:(p.fields||[]).map(f => ({ ...f, field_id:String(f.field_id), place_id:String(f.place_id) }))
  }));
}
function buildBookedSlots(remote){
  State.publicBookings = Array.isArray(remote) ? remote : [];
  State.bookedSlots = {};
  State.places.forEach(p => p.fields.forEach(f => State.bookedSlots[f.field_id] = {}));
  State.publicBookings.forEach(b => {
    const s = normStatus(b); if (s==='cancelled'||s==='rejected') return;
    const fid = String(b.field_id||'').trim(); const hour = Number(b.hour); const date = String(b.date||'').trim().split('T')[0];
    if (!fid||!date||Number.isNaN(hour)) return;
    (State.bookedSlots[fid] ||= {});(State.bookedSlots[fid][date] ||= []);
    if (!State.bookedSlots[fid][date].includes(hour)) State.bookedSlots[fid][date].push(hour);
  });
}
const cacheRead = () => { try { const c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY)||'null'); if(!c||!c.time||!Array.isArray(c.places))return null; if(Date.now()-c.time>CONFIG.CACHE_MS)return null; return c.places; } catch(_){ return null; } };
const cacheSave = (d) => { try { localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ time:Date.now(), places:d })); } catch(_){} };

async function loadInitialData(force=false){
  const r = await API.get('getInitialData', { force:force?'1':'0' }, 'initialData');
  const remote = Array.isArray(r) ? r : (r.places||[]);
  State.places = normalizePlaces(remote);
  if (State.places.length) cacheSave(State.places);
  buildBookedSlots(r.bookings||[]);
  State.publicBookingsFetchedAt = Date.now();                 // بيانات حجوزات طازجة من الخادم
}
async function loadPublicBookings(){
  const r = await API.get('getBookings', {}, 'publicBookings');
  buildBookedSlots(Array.isArray(r) ? r : (r.bookings||[]));
  State.publicBookingsFetchedAt = Date.now();
}
/* كاش قصير: يجلب الحجوزات فقط إذا مرّ أكثر من maxAgeMs منذ آخر جلب ناجح.
   التحقق النهائي قبل الحفظ (confirmBooking/saveManual) يبقى جلباً مباشراً طازجاً. */
async function ensurePublicBookings(maxAgeMs = 45000){
  if (Date.now() - (State.publicBookingsFetchedAt||0) < maxAgeMs) return;
  await loadPublicBookings();
}
async function loadData(opts={}){
  try { await loadInitialData(!!opts.force); renderRegionTabs(); renderLandingRegions(); updateTrust(); return true; }
  catch(e){
    if (isAbort(e)) return false;                          // ألغاه طلب أحدث — تجاهل
    const cached = cacheRead();
    if (cached && cached.length){ State.places = normalizePlaces(cached); buildBookedSlots([]); renderRegionTabs(); renderLandingRegions(); updateTrust(); toast(t('apiCached'),'warn'); return true; }
    return false;
  }
}
/* عدّاد متحرّك (count-up) — يُحترم reduced-motion ويعمل مرة واحدة */
let trustAnimated=false;
function animateCount(el, target, ms=1100){
  if(!el) return;
  if(target<=0 || matchMedia('(prefers-reduced-motion:reduce)').matches){ el.textContent=target+'+'; return; }
  const t0=performance.now();
  (function tick(now){
    const p=Math.min((now-t0)/ms,1), eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*eased)+(p>=1?'+':'');
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}
function updateTrust(){
  const el=$('#trustPlaces'); if(!el || !State.places.length) return;
  const total=State.places.reduce((s,p)=>s+(p.fields||[]).length,0);
  if(trustAnimated){ el.textContent=total+'+'; } else { trustAnimated=true; animateCount(el,total); }
}

/* ===================== UI: TOAST / LOADING ===================== */
function toast(message, type='error', ms=3400){
  const el = $('#toast'); if(!el) return;
  const icons = { success:'✓', error:'✕', warn:'!' };
  clear(el);
  el.append(h('span',{class:'toast-icon'}, icons[type]||'!'), h('span',{}, message));
  el.className = 'toast ' + type;
  clearTimeout(toast._t);
  requestAnimationFrame(() => el.classList.add('show'));
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

/* مؤشّر تحميل على الزر + تعطيله (يمنع النقر المزدوج Double-Submit) */
async function withLoading(btn, fn){
  if (!btn || btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  const original = btn.innerHTML;                 // محتوى الزر نفسه (موثوق) — نعيده لاحقاً
  btn.classList.add('is-loading'); btn.setAttribute('disabled','');
  clear(btn); btn.append(h('span', { class:'spinner' + (btn.classList.contains('cbtn')?' dark':'') }));
  try { return await fn(); }
  finally { btn.classList.remove('is-loading'); btn.removeAttribute('disabled'); btn.innerHTML = original; delete btn.dataset.busy; }
}

/* skeleton placeholders */
function placesSkeleton(){
  // سبينر Dual-Orbit (مدارٌ نُحاسي + نعناعي معاكس + نواة) — وسط منطقة الصورة
  const loader = () => h('div',{class:'place-loader'},
    h('span',{class:'place-loader-orbit o-outer','aria-hidden':'true'}),
    h('span',{class:'place-loader-orbit o-inner','aria-hidden':'true'}),
    h('span',{class:'place-loader-core','aria-hidden':'true'}));
  const one = () => h('div',{class:'skeleton-card', role:'status', 'aria-live':'polite'},
    h('div',{class:'sk-img'}, loader(), h('span',{class:'sr-only'}, t('loadingFields'))),
    h('div',{class:'sk-body'},
      h('div',{class:'sk sk-line w70'}),   // اسم الملعب
      h('div',{class:'sk sk-line w45'}),   // الموقع
      h('div',{class:'sk sk-line w88'}),   // السعر / بيانات
      h('div',{class:'sk sk-cta'})));      // زر الحجز
  const el = $('#placesList'); if(!el) return; clear(el); el.append(one(), one(), one());
}
function timeSkeleton(el, count=6){ if(!el) return; clear(el);
  const wrap = h('div',{class:'time-skeleton', style:{gridColumn:'1/-1'}});
  for(let i=0;i<count;i++) wrap.append(h('span',{class:'sk'}));
  el.append(wrap);
}

/* حالة فراغ جذّابة (Empty State) بدل النص العادي */
function emptyState({icon='🗂️', title, sub, actionLabel, action, secondaryLabel, secondaryAction}){
  const box = h('div',{class:'empty'},
    h('div',{class:'empty-icon'}, icon),
    h('div',{class:'empty-title'}, title),
    sub && h('div',{class:'empty-sub'}, sub)
  );
  if (actionLabel && action) box.append(h('button',{class:'sbtn',onclick:action}, actionLabel));
  if (secondaryLabel && secondaryAction) box.append(h('button',{class:'cbtn empty-2nd',onclick:secondaryAction}, secondaryLabel));
  return box;
}

/* ===================== VALIDATION (أخطاء Inline أسفل الحقل) ===================== */
const digits = (s) => String(s||'').replace(/\D/g,'');
const validPhone = (p) => digits(p).length >= 9;          // متساهل: يقبل صيغ الأردن المختلفة
function setFieldError(id, msg){
  const el=$('#'+id); if(!el) return;
  el.classList.add('input-error'); el.setAttribute('aria-invalid','true');
  let m=el.nextElementSibling;
  if(!(m && m.classList && m.classList.contains('field-err'))){ m=h('div',{class:'field-err'}); el.insertAdjacentElement('afterend', m); }
  m.textContent=msg; el.setAttribute('aria-describedby', (el.id||'')+'-err'); m.id=(el.id||'')+'-err';
  if(!el.dataset.errBound){ el.dataset.errBound='1'; el.addEventListener('input', ()=>clearFieldError(id)); }
}
function clearFieldError(id){
  const el=$('#'+id); if(!el) return;
  el.classList.remove('input-error'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
  const m=el.nextElementSibling; if(m && m.classList && m.classList.contains('field-err')) m.remove();
}
function focusFirstError(scope){ const el=(scope||document).querySelector('.input-error'); if(el){ try{ el.focus({preventScroll:false}); }catch(_){ el.focus(); } el.scrollIntoView({block:'center',behavior:'smooth'}); } }

/* ===================== PENDING BOOKING (استئناف حجز الضيف بعد الدخول) ===================== */
const PENDING_KEY = 'mustadaira:pending';
function savePendingBooking(){
  const d=State.detail; if(!d.place||!d.field) return;   // المصدر الوحيد = State.detail
  State.pendingBooking = { placeId:String(d.place.place_id), fieldId:String(d.field.field_id), date:d.date, hour:d.hour };
  try{ localStorage.setItem(PENDING_KEY, JSON.stringify(State.pendingBooking)); }catch(_){}
}
function loadPendingBooking(){
  if(State.pendingBooking) return State.pendingBooking;
  try{ const p=JSON.parse(localStorage.getItem(PENDING_KEY)||'null'); if(p&&p.placeId) return (State.pendingBooking=p); }catch(_){}
  return null;
}
function clearPendingBooking(){ State.pendingBooking=null; try{ localStorage.removeItem(PENDING_KEY); }catch(_){} }
async function resumePendingBooking(){
  const p=loadPendingBooking(); if(!p) return false;
  if(!State.places.length){ try{ await loadData(); }catch(_){} }
  const place=State.places.find(x=>String(x.place_id)===String(p.placeId));
  if(!place){ clearPendingBooking(); return false; }
  const field=place.fields.find(f=>String(f.field_id)===String(p.fieldId))||place.fields[0];
  await openDetail(place.place_id, {awaitFresh:true});               // يجلب أحدث الحجوزات العامة + يبني التفاصيل
  State.detail.field=field; State.detail.date=p.date; State.detail.hour=p.hour;
  renderSubFields(); renderDetailDays(); renderDetailTimes(); setText('dPrice', formatCurrency(field.price));
  clearPendingBooking();
  // تحقّق أن الوقت ما زال متاحاً قبل فتح المراجعة
  const taken=(State.bookedSlots[field.field_id]?.[p.date])||[];
  if(taken.includes(Number(p.hour))){
    State.detail.hour=null; renderDetailTimes(); renderDetailSticky();
    toast(t('bookingConflict'),'warn');
    scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)');
    return true;
  }
  renderDetailSticky();
  openBookingReview();                                               // الآن مسجّل ⇒ تظهر المراجعة مباشرة
  return true;
}

/* ===================== AUTH CHOICE (للضيف عند التأكيد) ===================== */
function openAuthChoice(){ Modal.open('modal-authchoice'); }

/* ===================== (٥) تعديلات لم تُحفظ =====================
   النوافذ ذات الإدخال تُغلق بأربعة مسارات (زرّ · Escape · نقر خارجها · سحب لأسفل)،
   وكلّها كانت تبتلع ما كتبه المستخدم بصمت. العلَم يُرفع بأي **إدخال أو اختيار** —
   والاختيار هنا ليس حقلًا (أزرار الأيام والأوقات والنجوم) فلا يكفي حدث `input`.
   يُنزَّل عند فتح النافذة (المحتوى يُعاد بناؤه) وعند الحفظ الناجح. */
const DIRTY_MODALS = ['modal-field','modal-review','modal-manual','modal-reschedule'];
const Dirty = {
  _set: new Set(),
  mark(id){ if(DIRTY_MODALS.includes(id)) this._set.add(id); },
  clear(id){ id ? this._set.delete(id) : this._set.clear(); },
  has(id){ return this._set.has(id); },
  init(){
    DIRTY_MODALS.forEach(id=>{
      const o=$('#'+id); if(!o) return;
      const on=()=>Dirty.mark(id);
      o.addEventListener('input', on);
      o.addEventListener('change', on);
      o.addEventListener('click', (e)=>{ if(e.target.closest('.day-btn,.tbtn,.star')) on(); });
    });
  }
};
/* يُستدعى من كل مسارات الإغلاق. ⚠️ فتح نافذة التأكيد يُخفي النافذة القذرة
   (‏`Modal.open` ينادي `closeAll`)، فإن اختار «أكمل التعديل» نعيد إظهارها —
   ومحتواها باقٍ في DOM كما تركه، ولذلك نُبقي العلَم مرفوعًا (keepDirty). */
async function confirmDiscard(id){
  const ok = await askConfirm(t('unsavedTitle'), t('unsavedMsg'), t('unsavedDiscard'), t('unsavedKeep'), true);
  const o=$('#'+id); if(!o) return;
  if(ok){ Dirty.clear(id); o.classList.remove('show'); Modal._afterClose(); }
  else Modal.open(id, true);
}

/* ===================== MODAL (+ swipe to close) ===================== */
const Modal = {
  _last:null,
  open(id, keepDirty){ const o=$('#'+id); if(!o) return; if(!keepDirty) Dirty.clear(id); this.closeAll(o); this._last=document.activeElement; o.classList.add('show'); document.body.classList.add('modal-open');
    const panel=o.querySelector('.modal,.scard'); if(panel){ panel.setAttribute('tabindex','-1'); requestAnimationFrame(()=>{ try{ panel.focus({preventScroll:true}); }catch(_){} }); } },
  /* force=true يتخطّى سؤال «تعديلات لم تُحفظ» — يستعمله مسار الحفظ الناجح وحده */
  close(id, force){
    const o = id ? $('#'+id) : $('.modal-overlay.show');
    if(!o){ this._afterClose(); return; }
    if(!force && Dirty.has(o.id)){ confirmDiscard(o.id); return; }
    Dirty.clear(o.id); o.classList.remove('show'); this._afterClose();
  },
  closeAll(except){ $$('.modal-overlay.show, .success-overlay.show').forEach(o=>{ if(o!==except) o.classList.remove('show'); }); },
  _afterClose(){
    if($$('.modal-overlay.show, .success-overlay.show').length) return;   // ما زالت نافذة مفتوحة
    document.body.classList.remove('modal-open');
    if(this._last && this._last.focus){ try{ this._last.focus({preventScroll:true}); }catch(_){} this._last=null; }
  },
};
/* السحب لأسفل لإغلاق النافذة — transform فقط لضمان 60fps */
function enableSwipe(overlay){
  const modal = $('.modal', overlay); if(!modal) return;
  const grip = $('.modal-grip', modal) || modal;
  let startY = 0, dy = 0, active = false;
  grip.addEventListener('touchstart', e => { startY = e.touches[0].clientY; active = true; dy = 0; modal.classList.add('dragging'); }, { passive:true });
  // النوافذ الحرجة (data-safe-close كنافذة مراجعة الحجز): مقاومة بصرية + مسافة إغلاق أكبر بكثير
  grip.addEventListener('touchmove', e => { if(!active) return; dy = Math.max(0, e.touches[0].clientY - startY); const damp = modal.dataset.safeClose ? 0.45 : 1; modal.style.transform = `translate3d(0,${dy*damp}px,0)`; }, { passive:true });
  // الإغلاق بالسحب يمرّ بـModal.close كي يسأل عن التعديلات غير المحفوظة كبقية المسارات
  const end = () => { if(!active) return; active = false; modal.classList.remove('dragging'); modal.style.transform = ''; const limit = modal.dataset.safeClose ? 250 : 110; if (dy > limit){ Modal.close(overlay.id); } dy = 0; };
  grip.addEventListener('touchend', end); grip.addEventListener('touchcancel', end);
}

/* ===================== RENDER: HOME / PLACES ===================== */
function getRegions(){ const seen=new Set(), out=[]; State.places.forEach(p=>{ const r=String(p.region||'').trim(); if(!r||normalizeText(r)==='all')return; const k=normalizeText(r); if(seen.has(k))return; seen.add(k); out.push(r); }); return out; }
function renderRegionTabs(){
  const el = $('#regionTabs'); if(!el) return;
  const regions = getRegions();
  if (State.filter!=='all' && !regions.some(r=>normalizeText(r)===normalizeText(State.filter))) State.filter='all';
  clear(el);
  el.append(h('button',{class:'ftab'+(State.filter==='all'&&!State.favOnly?' active-tab':''), onclick:()=>{ State.favOnly=false; setFilter('all'); }}, t('all')));
  // تبويب المفضّلة (محلي) — مستقل عن فلتر المنطقة
  el.append(h('button',{class:'ftab ftab-fav'+(State.favOnly?' active-tab':''), 'aria-pressed':State.favOnly?'true':'false',
    onclick:()=>{ State.favOnly=!State.favOnly; renderRegionTabs(); renderPlaces(); }}, ico('heart','svg-sm'), ' '+t('favTab')));
  regions.forEach(r => el.append(h('button',{class:'ftab'+(normalizeText(r)===normalizeText(State.filter)&&!State.favOnly?' active-tab':''), onclick:()=>{ State.favOnly=false; setFilter(r); }}, r)));
}
function setFilter(f){ State.filter=f; renderRegionTabs(); renderPlaces(); }

/* ===================== الرياضات (تقسيمة أعلى الرئيسية) =====================
   كرة القدم هي المتاحة حالياً؛ باقي الرياضات تعرض حالة «سيتم إضافتها قريباً» */
const SPORTS=[
  {key:'football', label:'sportFootball', icon:'ball',   ready:true},
  {key:'padel',    label:'sportPadel',    icon:'padel',  ready:false},
  {key:'basket',   label:'sportBasket',   icon:'basket', ready:false},
  {key:'tennis',   label:'sportTennis',   icon:'tennis', ready:false},
  {key:'volley',   label:'sportVolley',   icon:'volley', ready:false},
];
function renderSportTabs(){
  const el=$('#sportTabs'); if(!el) return; clear(el);
  SPORTS.forEach(s=>{
    const active=State.sport===s.key;
    // حبّة مضغوطة: أيقونة + اسم على سطر واحد، وشارة «قريباً» داخل الحبّة بعد الاسم
    const ic=h('span',{class:'sport-ic', html:ICON[s.icon]||ICON.ball, 'aria-hidden':'true'});
    const b=h('button',{class:'sport-tab'+(active?' active':''), type:'button',
      'aria-pressed':active?'true':'false',
      'aria-label': s.ready ? t(s.label) : t(s.label)+' — '+t('soonBadge')},
      ic,
      h('span',{class:'sport-name'}, t(s.label)));
    if(!s.ready) b.append(h('span',{class:'sport-soon','aria-hidden':'true'}, t('soonBadge')));
    b.addEventListener('click', ()=>setSport(s.key));
    el.append(b);
  });
}
function setSport(k){ if(State.sport===k) return; State.sport=k; renderSportTabs(); renderSportDropdown(); updateSportSections(); renderPlaces(); }
/* قائمة الرياضات المنسدلة في شريط التصفّح (مزامنة مع مبدّل الفلاتر عبر setSport) */
function renderSportDropdown(){
  const cur=SPORTS.find(s=>s.key===State.sport)||SPORTS[0];
  const ic=$('#sportDDIc'); if(ic) ic.innerHTML=ICON[cur.icon]||ICON.ball;   // SVG ثابت موثوق
  setText('sportDDName', t(cur.label));
  const menu=$('#sportDDMenu'); if(!menu) return; clear(menu);
  SPORTS.forEach(s=>{
    const active=State.sport===s.key;
    const item=h('button',{class:'sport-dd-item'+(active?' active':''), type:'button', role:'option', 'aria-selected':active?'true':'false'},
      h('span',{class:'sport-dd-ic', html:ICON[s.icon]||ICON.ball, 'aria-hidden':'true'}),
      h('span',{class:'sport-dd-lbl'}, t(s.label)));
    if(!s.ready) item.append(h('span',{class:'sport-dd-soon'}, t('soonBadge')));
    item.addEventListener('click',()=>{ setSport(s.key); closeSportDD(); });
    menu.append(item);
  });
}
function toggleSportDD(){
  const dd=$('#sportDD'); if(!dd) return;
  const open=dd.classList.toggle('open');
  $('#sportDDMenu').hidden=!open; $('#sportDDBtn')?.setAttribute('aria-expanded', open?'true':'false');
}
function closeSportDD(){
  const dd=$('#sportDD'); if(!dd || !dd.classList.contains('open')) return;
  dd.classList.remove('open'); $('#sportDDMenu').hidden=true; $('#sportDDBtn')?.setAttribute('aria-expanded','false');
}
/* إخفاء أدوات كرة القدم (المناطق/العنوان) عند اختيار رياضة غير متوفرة بعد.
   زرّ الفلاتر يبقى ظاهرًا لأن مُبدِّل الرياضات صار داخل ورقة الفلاتر (وإلا انحبس المستخدم). */
function updateSportSections(){
  const off=State.sport!=='football';
  ['#regionTabs','#page-home .sec-title'].forEach(sel=>{ const n=$(sel); if(n) n.style.display=off?'none':''; });
}

/* قسم «المناطق المتوفّرة» بصفحة الهبوط — مبني من بيانات الملاعب الحقيقية */
function renderLandingRegions(){
  const el=$('#lpRegions'); const sec=$('#lp-regions'); if(!el) return;
  const regions=getRegions();
  if(!regions.length){ if(sec) sec.hidden=true; return; }
  if(sec) sec.hidden=false;
  clear(el);
  regions.forEach(r=>{
    const count=State.places.filter(p=>normalizeText(p.region)===normalizeText(r)).length;
    const card=h('button',{class:'lp-region', type:'button', 'aria-label':r},
      h('span',{class:'lp-region-ic'}, ico('pin','svg-sm')),
      h('span',{class:'lp-region-name'}, r),
      h('span',{class:'lp-region-count'}, `${count} ${count===1?t('regionsOne'):t('regionsMany')}`));
    card.addEventListener('click', ()=>{ State.filter=r; browse(); });
    el.append(card);
  });
}

/* تحليل مركزي للمرافق (يُستخدم في البطاقة والتفاصيل والفلاتر).
   الصيغة: "water|parking|vests:10" — القيمة بعد ':' تمثّل عدداً/تفصيلاً اختيارياً. */
function parseAmenities(text){
  return String(text||'').split('|').map(s=>s.trim()).filter(Boolean).map(item=>{
    const [rawKey,...rest]=item.split(':');
    const key=(rawKey||'').trim(); const value=rest.join(':').trim();
    const meta=AMENITY[key]||{icon:'dot'};
    return { key, icon:meta.icon||'dot', labelKey:meta.labelKey, value };
  });
}
function amenityKeys(p){ return parseAmenities(p?.amenities).map(a=>a.key); }
function amenitiesRow(text, max){
  const items=parseAmenities(text);
  if(!items.length) return null;
  const shown = max ? items.slice(0,max) : items;
  const row=h('div',{class:'amenities-row'});
  shown.forEach(a=> row.append(h('span',{class:'amenity-chip'}, ico(a.icon,'svg-sm'), ' '+amenityLabel(a))));
  if(max && items.length>max) row.append(h('span',{class:'amenity-chip amenity-more'}, `+${items.length-max}`));
  return row;
}
/* تحويل قيمة الخدمة إلى نص واضح حسب اللغة (لا إنجليزية داخل العربية) */
function amenityValueText(value, label){
  const v=String(value||'').trim(); if(!v) return t('available');
  if(/^\d+$/.test(v)) return `${v} ${label}`;                 // عدد: 10 بلوزات / 10 vests
  const map = { free:'amenFree', paid:'amenPaid', available:'available', yes:'available', no:'amenNotAvail', 'true':'available', 'false':'amenNotAvail' };
  const key = map[v.toLowerCase()];
  return key ? t(key) : v;
}
/* قسم "الخدمات والمرافق" الكامل في صفحة التفاصيل (كل الخدمات الفعلية بلا تكرار) */
function renderAmenitiesFull(p){
  const el=$('#detailAmenities'); if(!el) return; clear(el);
  const items=parseAmenities(p?.amenities);
  if(!items.length){ el.append(h('div',{class:'amen-empty'}, t('noServices'))); return; }
  const grid=h('div',{class:'amen-grid'});
  items.forEach(a=>{
    const lbl = amenityLabel(a);
    grid.append(h('div',{class:'amen-item'},
      h('span',{class:'amen-ic'}, ico(a.icon,'svg-sm')),
      h('div',{class:'amen-text'}, h('div',{class:'amen-name'}, lbl), h('div',{class:'amen-val'}, amenityValueText(a.value, lbl)))));
  });
  el.append(grid);
}

/* ===================== AVAILABILITY (حالات دقيقة) + SORT + FILTERS ===================== */
/* حالة المكان: متاح اليوم / متاح لاحقاً / مكتمل اليوم / لا أوقات — بحساب فعلي للخانات */
function placeAvailability(p){
  const td=today(); let todayTotal=0, todayFree=0, weekFree=0;   // td كي لا تُظلَّل دالة الترجمة t()
  (p.fields||[]).forEach(f=>{
    if(f.active===false) return;
    const slots=fieldSlots(f);
    const bToday=(State.bookedSlots[f.field_id]?.[td])||[];
    todayTotal+=slots.length;
    slots.forEach(s=>{ if(!bToday.includes(s.hour)) todayFree++; });
    for(let i=0;i<7;i++){ const d=dateAfter(i); const bk=(State.bookedSlots[f.field_id]?.[d])||[]; slots.forEach(s=>{ if(!bk.includes(s.hour)) weekFree++; }); }
  });
  if(todayFree>0) return {state:'today', label:'متاح اليوم', cls:'avail-yes'};
  if(weekFree>0)  return {state:'later', label:'متاح لاحقاً', cls:'avail-soon'};
  if(todayTotal>0)return {state:'full',  label:'مكتمل اليوم', cls:'avail-no'};
  return {state:'none', label:'لا أوقات', cls:'avail-no'};
}
/* أقرب وقت متاح (طابع زمني) — للترتيب "الأقرب وقتاً" وعرضه على البطاقة */
function soonestSlotTs(p){
  let best=Infinity; const now=Date.now()-90*60*1000;   // تسامح ساعة ونصف للوقت الجاري
  (p.fields||[]).forEach(f=>{
    if(f.active===false) return;
    const slots=fieldSlots(f);
    for(let i=0;i<7;i++){ const d=dateAfter(i); const bk=(State.bookedSlots[f.field_id]?.[d])||[];
      for(const s of slots){ if(!bk.includes(s.hour)){ const ts=new Date(`${d}T${String(s.hour).padStart(2,'0')}:00:00`).getTime(); if(ts>=now && ts<best) best=ts; } }
    }
  });
  return best;
}
function soonestSlotLabel(p){
  const ts=soonestSlotTs(p); if(!isFinite(ts)) return '';
  const d=new Date(ts); const dateStr=ymd(d);
  const day = dayLabel(dateStr);
  const hour=d.getHours(); const en=State.lang==='en';
  const ampm = en ? (hour<12?'AM':'PM') : (hour<12?'ص':'م'); const h12=((hour+11)%12)+1;
  return `${day} ${h12}:00 ${ampm}`;
}
/* تنسيق ساعة بنظام 12 ساعة (ص/م بالعربي · AM/PM بالإنجليزي) */
function fmtHour12(hr){
  const h24=((Number(hr)%24)+24)%24; const en=State.lang==='en';
  const ampm = en ? (h24<12?'AM':'PM') : (h24<12?'ص':'م');
  const h12=((h24+11)%12)+1; return `${h12}:00 ${ampm}`;
}
/* أوقات دوام المكان: من أبكر وقت إلى آخر وقت (+ساعتان) عبر كل ملاعبه — يُحسب من الـslots الفعلية */
function placeHours(p){
  const hrs=(p.fields||[]).flatMap(f=>fieldSlots(f)).map(s=>Number(s.hour)).filter(Number.isFinite);
  if(!hrs.length) return '';
  const start=Math.min(...hrs), end=Math.max(...hrs)+2;
  return `${fmtHour12(start)} - ${fmtHour12(end)}`;
}
/* قيم مميّزة من البيانات الفعلية (بلا اختراع) */
function distinctSizes(){ const seen=new Set(), out=[]; State.places.forEach(p=>(p.fields||[]).forEach(f=>{ const v=String(f.size||'').trim(); if(!v) return; const k=normSize(v); if(seen.has(k)) return; seen.add(k); out.push(v); })); return out; }
function distinctTypes(){ const s=new Set(); State.places.forEach(p=>{const v=String(p.type||'').trim(); if(v)s.add(v);}); return [...s]; }
function distinctAmenities(){ const s=new Set(); State.places.forEach(p=>amenityKeys(p).forEach(k=>s.add(k))); return [...s]; }

function passesFilters(p){
  const fx=State.fx;
  const pmin=minPrice(p), pmax=maxPrice(p);
  if(fx.minPrice!=null && pmax>0 && pmax<fx.minPrice) return false;
  if(fx.maxPrice!=null && pmin>0 && pmin>fx.maxPrice) return false;
  if(fx.sizes.length){ const want=new Set(fx.sizes.map(normSize)); if(!(p.fields||[]).some(f=>want.has(normSize(f.size)))) return false; }
  if(fx.types.length && !fx.types.includes(String(p.type||'').trim())) return false;
  if(fx.minRating>0 && safeRating(p.rating)<fx.minRating) return false;
  if(fx.availableToday && placeAvailability(p).state!=='today') return false;
  if(fx.amenities.length){ const have=new Set(amenityKeys(p)); if(!fx.amenities.every(a=>have.has(a))) return false; }
  return true;
}
function sortPlaces(list){
  const a=[...list];
  switch(State.sort){
    case 'price_asc': a.sort((x,y)=>(minPrice(x)||1e9)-(minPrice(y)||1e9)); break;
    case 'price_desc': a.sort((x,y)=>(maxPrice(y)||0)-(maxPrice(x)||0)); break;
    case 'rating': a.sort((x,y)=>safeRating(y.rating)-safeRating(x.rating)||safeReviews(y.reviews)-safeReviews(x.reviews)); break;
    case 'reviews': a.sort((x,y)=>safeReviews(y.reviews)-safeReviews(x.reviews)); break;
    case 'soonest': a.sort((x,y)=>soonestSlotTs(x)-soonestSlotTs(y)); break;
    default: break;
  }
  return a;
}
function activeFilterCount(){
  const fx=State.fx; let n=0;
  if(fx.minPrice!=null) n++; if(fx.maxPrice!=null) n++;
  n+=fx.sizes.length+fx.types.length+fx.amenities.length;
  if(fx.minRating>0) n++; if(fx.availableToday) n++;
  if(State.sort!=='default') n++;
  return n;
}
function resetAllFilters(){
  State.fx={ minPrice:null,maxPrice:null,sizes:[],types:[],minRating:0,availableToday:false,amenities:[] };
  State.sort='default'; State.filter='all';
  const s=$('#searchInput'); if(s) s.value='';
}
const SORT_LABEL={ default:'sortDefault', price_asc:'sortPriceAsc', price_desc:'sortPriceDesc', rating:'sortRating', reviews:'sortReviews', soonest:'sortSoonest' };
/* وضع عرض البطاقات: السمة data-view على الحاوية + التخزين في localStorage —
   لأن renderPlaces يعيد ضبط السمة كل مرة، يصمد الوضع بعد البحث/الفلترة/الترتيب/التحديث/المفضلة */
function setViewMode(v){
  State.view = v==='list' ? 'list' : 'grid';
  try{ localStorage.setItem('mustadaira:viewMode', State.view); }catch(_){}
  renderPlaces();
}
function updateViewToggle(){
  $$('.vt-btn').forEach(b=>{ const on=b.dataset.view===State.view; b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false'); });
}
function updateFilterBar(){
  const c=$('#filterCount'); const n=activeFilterCount();
  if(c){ c.textContent=n; c.hidden=n===0; }
  const sc=$('#sortCurrent'); if(sc) sc.textContent=t('sortLabel')+': '+t(SORT_LABEL[State.sort]||'sortDefault');
  const fb=$('#filterBtn'); if(fb) fb.classList.toggle('has-filters', n>0);
  renderFilterChips();
}

/* ===================== (٧) شرائح التصفية اللاصقة =====================
   ما هو مفعَّل فعلًا في `State.fx` و`State.filter` — شريحة لكلٍّ، وإزالتها بضغطة.
   قبلها كان عدّاد رقمي على زرّ الفلاتر يقول «٣» بلا أن يقول **أيّ ثلاثة**، فيضطرّ
   المستخدم لفتح الورقة ليعرف لماذا اختفت النتائج.
   ملاحظة: الترتيب ليس فلترًا (لا يُخفي نتيجة) فلا شريحة له، وإن كان يدخل العدّاد. */
function filterChipList(){
  const fx=State.fx, out=[];
  const add=(label, remove)=> out.push({label, remove});
  if(State.favOnly)        add(t('favTab'),                                ()=>{ State.favOnly=false; });
  if(State.filter!=='all') add(t('fchipRegion',{v:State.filter}),          ()=>{ State.filter='all'; });
  if(fx.minPrice!=null)    add(t('fchipPriceMin',{v:formatCurrency(fx.minPrice)}), ()=>{ fx.minPrice=null; });
  if(fx.maxPrice!=null)    add(t('fchipPriceMax',{v:formatCurrency(fx.maxPrice)}), ()=>{ fx.maxPrice=null; });
  fx.sizes.slice().forEach(v => add(t('fchipSize',{v}),  ()=>toggleArr(fx.sizes, v)));
  fx.types.slice().forEach(v => add(t('fchipType',{v}),  ()=>toggleArr(fx.types, v)));
  if(fx.minRating>0)       add(t('fchipRating',{v:fx.minRating}),          ()=>{ fx.minRating=0; });
  if(fx.availableToday)    add(t('availableToday'),                        ()=>{ fx.availableToday=false; });
  fx.amenities.slice().forEach(k => add(amenityLabel(AMENITY[k]) || k, ()=>toggleArr(fx.amenities, k)));
  return out;
}
function renderFilterChips(){
  const bar=$('#fchipsBar'); if(!bar) return;
  const list=filterChipList();
  clear(bar);
  if(!list.length){ bar.hidden=true; return; }   // hidden لا شفافية: صفّ فارغ لاصق كان يأكل ارتفاعًا
  bar.hidden=false;
  const after=()=>{ renderRegionTabs(); renderPlaces(); };   // renderPlaces ينادي updateFilterBar ⇒ الشرائح تُعاد بناؤها
  list.forEach(c=>{
    const b=h('button',{class:'fchip', type:'button', 'aria-label':t('fchipRemove',{v:c.label})},
      h('span',{class:'fchip-lbl'}, c.label), ico('x','fchip-x'));
    b.addEventListener('click', ()=>{ c.remove(); buzz(6); after(); });
    bar.append(b);
  });
  if(list.length>1){
    const clr=h('button',{class:'fchip fchip-clear', type:'button'}, t('clearAll'));
    clr.addEventListener('click', ()=>{ resetAllFilters(); State.favOnly=false; buzz(8); updateSearchClear(); after(); });
    bar.append(clr);
  }
}
function placeCard(p, eager){
  const av = placeAvailability(p);
  const mn=minPrice(p), mx=maxPrice(p);
  const unit = State.lang==='en' ? 'JOD' : 'د.أ';
  const range = mn!==mx;
  const oneField=(p.fields||[]).length===1;
  const img = (p.fields||[]).map(f=>fieldImages(f)[0]).find(Boolean);

  /* الغلاف: صورة نظيفة — لا يعلوها سوى المفضلة وشارة «غير متاح» عند الامتلاء/غياب الأوقات */
  const cover = h('div',{class:'place-cover'});
  // الصورة الأولى الظاهرة (LCP): eager + أولوية عالية؛ الباقي lazy لتسريع التحميل
  if (img) cover.append(h('img',{ src:img, alt:p.place_name||'ملعب', width:'640', height:'360',
    loading: eager?'eager':'lazy', fetchpriority: eager?'high':'auto', decoding:'async' }));
  else cover.append(h('div',{class:'place-cover-emoji', html:ICON.ball, 'aria-hidden':'true'}));
  // زر مفضّلة (قلب) — تخزين محلي فقط
  const isFav=favHas(p.place_id);
  const favB=h('button',{class:'fav-btn'+(isFav?' on':''), type:'button', html:ICON.heart,
    'aria-pressed':isFav?'true':'false', 'aria-label':t(isFav?'favRemove':'favAdd')});
  favB.addEventListener('click',(e)=>{ e.stopPropagation();
    const on=favToggle(p.place_id);
    favB.classList.toggle('on',on); favB.setAttribute('aria-pressed',on?'true':'false'); favB.setAttribute('aria-label',t(on?'favRemove':'favAdd'));
    if(State.favOnly) renderPlaces();
  });
  const unavailable = av.state==='full' || av.state==='none';
  /* شارة التصنيف (م3، نمط المرجع): نوع أرضية الملعب أعلى الصورة — نُقلت من سطر النص السفلي فلا تكرار */
  cover.append(h('div',{class:'place-top-badges'},
    p.type && h('span',{class:'place-cat-badge'}, p.type),
    unavailable && h('span',{class:'avail-badge avail-no'}, t('unavailableBadge')),
    favB));

  /* جسم البطاقة تحت الصورة: الاسم والتقييم ثم الموقع ثم أهم مرفقين ثم النوع وعدد الملاعب */
  const body = h('div',{class:'place-body'},
    h('div',{class:'place-body-head'},
      h('div',{class:'place-name'}, p.place_name),
      hasRating(p) ? h('span',{class:'place-rating'}, h('span',{class:'sr-star'},'★'), ' '+ratingText(p)) : ''),
    h('div',{class:'place-loc'}, ico('pin','svg-sm'), ' '+placeLocation(p)),
    amenitiesRow(p.amenities, 2),
    h('div',{class:'place-sub'},
      h('span',{class:'place-strip-fields'}, oneField?t('oneField'):t('fieldsCount',{n:p.fields.length}))));

  /* صف الإجراء السفلي: السعر مع سياقه + زر الحجز في السطر نفسه */
  const bookBtn = h('button',{class:'place-book-btn', type:'button'}, t('bookCta'));
  bookBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openDetail(p.place_id); });
  // عند تعدّد الأسعار: أظهر المدى الحقيقي «40–60» (أدقّ من «يبدأ من 40» ويطابق واقع المكان)
  const priceLabel = range ? `${mn}–${mx}` : String(mn);
  const action = h('div',{class:'place-action-row'},
    h('div',{class:'place-price'},
      range && h('span',{class:'place-price-from'}, t('priceRange')),
      h('span',{class:'place-price-main'},
        h('span',{class:'place-price-val'}, priceLabel),
        h('span',{class:'place-price-cur'}, unit)),
      h('span',{class:'place-price-ctx'}, t('perTwoHours'))),
    bookBtn);

  const card = h('div',{class:'place-card'}, cover, body, action);
  card.addEventListener('click', ()=>openDetail(p.place_id));
  return card;
}
function setPlacesCount(n){ const el=$('#placesCount'); if(!el) return; if(n>0){ el.textContent=String(n); el.hidden=false; } else { el.hidden=true; } }
function renderPlaces(){
  const el = $('#placesList'); if(!el) return;
  el.dataset.view = State.view; updateViewToggle();
  // رياضة غير متوفرة بعد ⇒ حالة «قريباً» بدل القائمة
  if(State.sport && State.sport!=='football'){
    clear(el); setPlacesCount(0);
    const s=SPORTS.find(x=>x.key===State.sport);
    el.append(emptyState({ icon:'⏳', title:t('comingSoonTitle'), sub:t('comingSoonSub',{sport:t(s?s.label:'sportFootball')}),
      actionLabel:t('backToFootball'), action:()=>setSport('football') }));
    return;
  }
  updateFilterBar();
  const q = normalizeText($('#searchInput')?.value || '');
  const favs = State.favOnly ? favGet() : null;
  let list = State.places.filter(p=>{
    const regionOk = State.filter==='all' || normalizeText(p.region)===normalizeText(State.filter);
    const searchOk = !q || [p.place_name,p.city,p.region,p.type].some(x=>normalizeText(x).includes(q));
    const favOk = !favs || favs.has(String(p.place_id));
    return regionOk && searchOk && favOk && passesFilters(p);
  });
  list = sortPlaces(list);
  setPlacesCount(list.length);   // عدّاد نتائج بجانب عنوان القسم (نمط الأسواق)
  clear(el);
  if (!list.length){
    if (State.favOnly){
      el.append(emptyState({ icon:'🤍', title:t('noFavsTitle'), sub:t('noFavsSub'),
        actionLabel:t('browseFields'), action:()=>{ State.favOnly=false; renderRegionTabs(); renderPlaces(); } }));
      return;
    }
    const hasAny = q || State.filter!=='all' || activeFilterCount()>0;
    el.append(emptyState({ icon:'🔍', title:t('noResultsTitle'),
      sub: hasAny ? t('noResultsSub') : t('noResultsSubPlain'),
      actionLabel: hasAny?t('clearFiltersBtn'):null, action: hasAny?()=>{ resetAllFilters(); renderRegionTabs(); renderPlaces(); }:null }));
    return;
  }
  list.forEach((p,i) => {
    const card = placeCard(p, i===0);   // أول بطاقة eager (LCP)
    card.style.animationDelay = `${i * 0.05}s`;
    el.append(card);
  });
}

/* ===================== FILTERS SHEET (Bottom Sheet) ===================== */
const fxChip = (label, on) => h('button',{class:'fx-chip'+(on?' on':''), type:'button'}, label);
const toggleArr = (arr,v)=>{ const i=arr.indexOf(v); if(i>=0)arr.splice(i,1); else arr.push(v); };
const numOrNull = (v)=>{ const n=Number(v); return (v===''||Number.isNaN(n))?null:n; };
function openFilters(){
  State.fxDraft = JSON.parse(JSON.stringify(State.fx));   // مسودّة معزولة
  State.sortDraft = State.sort;
  renderFiltersSheet();
  Modal.open('modal-filters');
}
/* عدّاد زرّ «تطبيق» — يُقرأ من المسودّة، فيجب أن تكون المسودّة محدَّثة أولاً */
function updateFxApplyCount(){
  const fx=State.fxDraft; if(!fx) return;
  let n=0; if(fx.minPrice!=null)n++; if(fx.maxPrice!=null)n++;
  n+=fx.sizes.length+fx.types.length+fx.amenities.length;
  if(fx.minRating>0)n++; if(fx.availableToday)n++; if(State.sortDraft!=='default')n++;
  setText('fxApplyCount', n? `${t('apply')} (${n})` : t('apply'));
}
/* ⚠️ الحقول الثابتة (السعر · «متاح اليوم») تعيش في HTML ولا يُعاد إنشاؤها، بينما
   كل نقرة على شريحة تُعيد بناء الورقة و**تُعيد كتابة قيمها من المسودّة**. وما دامت
   المسودّة لا تُكتب إلا في applyFilters، كان كل ما كُتب ولم يُطبَّق بعد يُمحى صامتًا.
   الحلّ: يكتب المستخدمُ المسودّةَ فور إدخاله، فتبقى إعادة البناء أمينة.
   (مزامنة DOM⇒مسودّة قبل الرسم كانت ستُحيي نصّ الجلسة السابقة عند أوّل فتح.) */
function syncDraftInputs(){
  const fx=State.fxDraft; if(!fx) return;
  fx.minPrice=numOrNull($('#fxMin').value);
  fx.maxPrice=numOrNull($('#fxMax').value);
  fx.availableToday=$('#fxToday').checked;
  updateFxApplyCount();
}
function renderFiltersSheet(){
  const fx=State.fxDraft;
  // الترتيب
  const sw=$('#fxSort'); clear(sw);
  Object.entries(SORT_LABEL).forEach(([v,k])=>{ const c=fxChip(t(k), State.sortDraft===v); c.addEventListener('click',()=>{ State.sortDraft=v; renderFiltersSheet(); }); sw.append(c); });
  // المنطقة
  const reg=$('#fxRegion'); const cur=reg.value; clear(reg);
  reg.append(h('option',{value:'all'},t('allRegions')));
  getRegions().forEach(r=> reg.append(h('option',{value:r}, r)));
  reg.value = (State.filter!=='all' && getRegions().some(r=>r===State.filter)) ? State.filter : 'all';
  // السعر — إسناد الخاصّية (لا addEventListener) لأنه **متكافئ**: الحقول ثابتة في HTML
  // وإعادة البناء تمرّ هنا عشرات المرّات، فالإضافة كانت ستكدّس مستمعًا في كل مرّة.
  $('#fxMin').value = fx.minPrice ?? ''; $('#fxMax').value = fx.maxPrice ?? '';
  $('#fxMin').oninput = $('#fxMax').oninput = syncDraftInputs;
  // الحجم
  const sz=$('#fxSizes'); clear(sz); const sizes=distinctSizes();
  sizes.length ? sizes.forEach(szv=>{ const c=fxChip(szv, fx.sizes.includes(szv)); c.addEventListener('click',()=>{ toggleArr(fx.sizes,szv); renderFiltersSheet(); }); sz.append(c); })
               : sz.append(h('span',{class:'fx-empty'},t('noData')));
  // النوع (ty — لا تُظلِّل دالة الترجمة t)
  const tp=$('#fxTypes'); clear(tp); const types=distinctTypes();
  types.length ? types.forEach(ty=>{ const c=fxChip(ty, fx.types.includes(ty)); c.addEventListener('click',()=>{ toggleArr(fx.types,ty); renderFiltersSheet(); }); tp.append(c); })
               : tp.append(h('span',{class:'fx-empty'},t('noData')));
  // التقييم
  const rt=$('#fxRating'); clear(rt); [4,3,2].forEach(r=>{ const c=fxChip('★ '+r+'+', fx.minRating===r); c.addEventListener('click',()=>{ fx.minRating = fx.minRating===r?0:r; renderFiltersSheet(); }); rt.append(c); });
  // متاح اليوم — نفس العطل تمامًا: كان يُعاد ضبطه من المسودّة عند كل إعادة بناء
  $('#fxToday').checked = !!fx.availableToday;
  $('#fxToday').onchange = syncDraftInputs;
  // المرافق
  const am=$('#fxAmenities'); clear(am); const ams=distinctAmenities();
  ams.length ? ams.forEach(k=>{ const m=AMENITY[k]; const c=fxChip(m&&m.labelKey?t(m.labelKey):k, fx.amenities.includes(k)); c.addEventListener('click',()=>{ toggleArr(fx.amenities,k); renderFiltersSheet(); }); am.append(c); })
              : am.append(h('span',{class:'fx-empty'},t('noData')));
  // عدّاد المسودّة
  updateFxApplyCount();
}
function applyFilters(){
  const fx=State.fxDraft; if(!fx) return;
  fx.minPrice=numOrNull($('#fxMin').value); fx.maxPrice=numOrNull($('#fxMax').value);
  if(fx.minPrice!=null && fx.maxPrice!=null && fx.minPrice>fx.maxPrice){ const tmp=fx.minPrice; fx.minPrice=fx.maxPrice; fx.maxPrice=tmp; }
  fx.availableToday=$('#fxToday').checked;
  State.fx=fx; State.sort=State.sortDraft; State.fxDraft=null;
  const reg=$('#fxRegion').value; State.filter = reg==='all'?'all':reg;
  Modal.close('modal-filters');
  renderRegionTabs(); renderPlaces();
}
function clearFiltersSheet(){
  State.fxDraft={ minPrice:null,maxPrice:null,sizes:[],types:[],minRating:0,availableToday:false,amenities:[] };
  State.sortDraft='default'; $('#fxRegion').value='all';
  renderFiltersSheet();
}

/* ===================== RENDER: DETAIL ===================== */
/* شارات رأس التفاصيل: النوع + التقييم + الدوام (الدوام يُعرض هنا فقط — أُزيل من البطاقات بطلب المستخدم) */
function renderDetailBadges(place){
  const badges=$('#dBadges'); if(!badges) return; clear(badges);
  badges.append(h('span',{class:'badge badge-green'}, place.type||''));
  if(hasRating(place)) badges.append(h('span',{class:'badge badge-blue'}, h('span',{class:'sr-star'},'★'), ' '+ratingText(place)));
  const dHrs=placeHours(place);
  if(dHrs) badges.append(h('span',{class:'badge badge-blue detail-hours'}, ico('clock','svg-sm'), ' '+t('operatingHours')+' '+dHrs));
}
/* فتح التفاصيل — **تنقّل فوري لا انتظار شبكة**.
   كان: `await loadPublicBookings()` قبل `showPage` ⇒ الضغط على «احجز الآن» يتجمّد
   5-9 ثوانٍ (Apps Script بطيء) والمستخدم يرى سبينر على الزرّ ولا شيء غيره.
   صار: نرسم الصفحة **فورًا** من التوفّر المخزّن (جاء مع التحميل الأولي)، ثم نحدّث
   الحجوزات **بالخلفية** ونعيد رسم الأوقات عند وصولها مع حالة «يُحدَّث» خفيفة.
   آمن لأن التحقّق النهائي قبل الحفظ (confirmBooking) يجلب بيانات طازجة أصلًا،
   فلا يمكن أن يُحجز وقت مأخوذ بناءً على عرض قديم.
   opts.awaitFresh=true ⇒ انتظر الطازج (يستعمله استئناف حجز ضيف معلّق: يقرأ
   `bookedSlots` مباشرة بعد الفتح فيلزمه أن يكون محدّثًا). */
async function openDetail(placeId, opts={}){
  if (!State.places.length){ placesSkeleton(); await loadData(); }
  else if (opts.awaitFresh){ try { await loadPublicBookings(); } catch(e){ if(!isAbort(e)) toast(t('timesUpdateFail'),'warn'); } }
  const place = State.places.find(p=>String(p.place_id)===String(placeId)); if(!place) return;
  State.detail = { place, field: place.fields[0], date: today(), hour: null };

  setText('dName', place.place_name);
  const dCity=$('#dCity'); clear(dCity); dCity.append(ico('pin','svg-sm'), ' '+placeLocation(place));
  setText('dPrice', formatCurrency(place.fields[0].price));

  renderDetailBadges(place);

  // الغلاف + المعرض: صور الملعب المحدَّد (تتبدّل مع تبديل الملعب داخل المكان)
  renderDetailHero();

  const map=$('#mapLink'); map.href = place.map_link || '#';
  const call=$('#callBtn'); if (place.phone){ call.href='tel:+'+normalizePhone(place.phone); call.style.display=''; } else call.style.display='none';
  const locTxt=$('#dLocationText'); if(locTxt){ clear(locTxt); locTxt.append(ico('pin','svg-sm'), ' '+placeLocation(place)); }

  setDetailTab('book');                                   // ابدأ دائماً على تبويب الحجز
  renderAmenitiesFull(place); renderSubFields(); renderDetailDays(); renderDetailTimes(); renderPlaceStats(); renderRatingDist(place); renderDetailSticky();
  showPage('detail');
  if(!opts.awaitFresh) refreshDetailAvailability(placeId);   // تحديث التوفّر بالخلفية (بعد أن ظهرت الصفحة)
}
/* تحديث التوفّر بالخلفية: لا يحجب التنقّل، ويعيد رسم الأوقات فقط إن كان المستخدم
   ما يزال على تفاصيل نفس المكان (وإلّا فالنتيجة قديمة/غير ذات صلة).
   كاش 45s يعني أن الفتحات المتتالية للمكان نفسه لا تكلّف طلبًا أصلًا. */
async function refreshDetailAvailability(placeId){
  const el=$('#detailTimes'); if(el) el.classList.add('times-syncing');
  try{ await ensurePublicBookings(); }
  catch(e){ if(!isAbort(e)) toast(t('timesUpdateFail'),'warn'); }
  finally{
    const still = activePageName()==='detail' && State.detail && String(State.detail.place?.place_id)===String(placeId);
    const now=$('#detailTimes'); if(now) now.classList.remove('times-syncing');
    if(still){
      // لو صار الوقت المختار محجوزًا أثناء الانتظار: أسقط الاختيار وأخبر المستخدم
      const taken=(State.bookedSlots[State.detail.field.field_id]?.[State.detail.date])||[];
      if(State.detail.hour!=null && taken.includes(State.detail.hour)){ State.detail.hour=null; toast(t('bookingConflict'),'warn'); }
      renderDetailTimes();
    }
  }
}
/* تبديل تبويبات صفحة التفاصيل (احجز/المرافق/التقييمات/الموقع) */
function setDetailTab(name){
  State.detailTab=name;
  $$('#detailTabs .dtab-btn').forEach(b=>{ const on=b.dataset.dtab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); });
  $$('#page-detail .dtab-panel').forEach(p=>{ const on=p.dataset.dtabPanel===name; p.hidden=!on; p.classList.toggle('active', on); });
}
/* توزيع تقييمات حقيقي بأشرطة (من place.reviews_dist إن نُشر الباكند)؛ وإلا ملخّص المتوسط؛ و«لا تقييمات» عند 0 */
function renderRatingDist(place){
  const el=$('#ratingDist'); if(!el) return; clear(el);
  const avg=safeRating(place.rating), count=safeReviews(place.reviews);
  const dist=place.reviews_dist;   // مصفوفة/كائن عدد لكل نجمة 1..5 (اختياري — من الباكند)
  if(!count){ el.append(h('div',{class:'rd-empty'}, h('span',{class:'rd-empty-star'},'★'), ' '+t('noReviewsYet'))); return; }
  // رأس: المتوسط الكبير + النجوم (تعكس المتوسط) + العدد
  const filled=Math.max(0,Math.min(5,Math.round(avg)));
  el.append(h('div',{class:'rd-head'},
    h('div',{class:'rd-avg'}, String(avg).replace('.0','')),
    h('div',{class:'rd-avg-side'},
      h('div',{class:'rd-stars'}, '★'.repeat(filled)+'☆'.repeat(5-filled)),
      h('div',{class:'rd-count'}, t('ratingsCount',{n:count})))));
  // أشرطة لكل نجمة إن توفّر التوزيع
  const get=(s)=> dist ? Number((Array.isArray(dist)?dist[s-1]:dist[s]) || 0) : null;
  const total=dist ? [1,2,3,4,5].reduce((a,s)=>a+get(s),0) : 0;
  if(dist && total>0){
    const bars=h('div',{class:'rd-bars'});
    for(let s=5;s>=1;s--){
      const c=get(s), pct=Math.round(c/total*100);
      bars.append(h('div',{class:'rd-row'},
        h('span',{class:'rd-star-lbl'}, s+'★'),
        h('span',{class:'rd-track'}, h('span',{class:'rd-fill', style:{width:pct+'%'}})),
        h('span',{class:'rd-num'}, String(c))));
    }
    el.append(bars);
  }
}
/* غلاف التفاصيل: صور الملعب المحدَّد أولاً (فصل بصري لكل ملعب)؛
   إن لم تكن له صور ⇒ كل صور المكان؛ وإلا ⇒ الأيقونة الاحتياطية */
function renderDetailHero(){
  const place=State.detail.place, field=State.detail.field; if(!place) return;
  const hero=$('#detailHero'); if(!hero) return;
  $$('#detailHero img').forEach(n=>n.remove());
  const emoji=$('#detailEmoji');
  const own=field?fieldImages(field):[];
  const imgs=own.length?own:[...new Set((place.fields||[]).flatMap(f=>fieldImages(f)))];
  if (imgs.length){
    emoji.style.display='none';
    const heroImg=h('img',{id:'detailHeroImg',src:imgs[0],alt:(own.length&&field?field.field_name:place.place_name)||'',decoding:'async',fetchpriority:'high'});
    heroImg.addEventListener('click', ()=>Lightbox.open(imgs,0));
    hero.insertBefore(heroImg, hero.firstChild);
  }
  else { emoji.style.display=''; hero.style.background='var(--forest-2)'; }
  renderDetailThumbs(imgs);
}
/* مصغّرات صور الملعب المحدَّد — تظهر أسفل اختيار الملعب؛ الضغط يفتح المعرض المكبّر */
function renderDetailThumbs(imgs){
  const wrap=$('#fieldPhotos'); const el=$('#detailThumbs'); if(!el) return; clear(el);
  const list=imgs||[];
  if(wrap) wrap.hidden=!list.length;
  if(!list.length) return;
  list.forEach((src,i)=>{
    const th=h('button',{class:'thumb', type:'button', 'aria-label':t('lbOpen',{i:i+1})}, h('img',{src, alt:'', loading:'lazy', decoding:'async'}));
    th.addEventListener('click', ()=>Lightbox.open(list,i));
    el.append(th);
  });
}
/* ===================== LIGHTBOX (تكبير صور الملعب + تنقّل) ===================== */
const Lightbox = {
  imgs:[], idx:0,
  open(imgs, i){ if(!imgs||!imgs.length) return; this.imgs=imgs; this.show(i||0); Modal.open('modal-lightbox'); },
  show(i){
    const n=this.imgs.length; this.idx=((i%n)+n)%n;
    const img=$('#lbImg'); if(img) img.src=this.imgs[this.idx];
    setText('lbCount', (this.idx+1)+' / '+n);
    const multi=n>1;
    const p=$('#lbPrev'), x=$('#lbNext'); if(p) p.hidden=!multi; if(x) x.hidden=!multi;
    // تجهيز الصورتين المجاورتين مسبقاً لتنقّل سلس
    if(multi) [this.idx+1,this.idx-1].forEach(k=>{ const im=new Image(); im.src=this.imgs[((k%n)+n)%n]; });
  },
  nav(d){ if(this.imgs.length>1) this.show(this.idx+d); },
};
/* الملخّص اللاصق أسفل التفاصيل — يظهر دائماً مع السعر (تقليل المفاجآت):
   قبل اكتمال الاختيار: اسم الملعب + «اختر اليوم والوقت» والسعر/ساعتين؛ بعده: الملخّص الكامل */
function renderDetailSticky(){
  const bar=$('#detailSticky'); if(!bar) return;
  const { field, date, hour } = State.detail;
  if(!field){ bar.hidden=true; return; }
  bar.hidden=false;
  const done = hour!=null;
  bar.classList.toggle('incomplete', !done);
  if(done){
    const slot=fieldSlots(field).find(s=>s.hour===hour);
    setText('dstickyLine', `${field.field_name} • ${dayLabel(date)} ${shortDate(date)} • ${slot?slotDisplay(slot):''}`);
  } else {
    setText('dstickyLine', `${field.field_name} • ${t('chooseDayTimeHint')}`);
  }
  setText('dstickyPrice', formatCurrency(field.price));
}
function renderSubFields(){
  const el=$('#subFields'); clear(el);
  State.detail.place.fields.forEach(f=>{
    const active = String(State.detail.field.field_id)===String(f.field_id);
    const fi=fieldImages(f)[0];   // صورة مصغّرة خاصة بكل ملعب — فصل بصري داخل المكان
    const card=h('button',{class:'subfield-card'+(active?' active':''), type:'button', 'aria-pressed':active?'true':'false'},
      fi ? h('img',{class:'subfield-thumb', src:fi, alt:'', loading:'lazy', decoding:'async'})
         : h('span',{class:'subfield-thumb ph', html:ICON.ball, 'aria-hidden':'true'}),
      h('div',{class:'subfield-main'},
        h('div',{class:'subfield-name'}, f.field_name),
        h('div',{class:'subfield-size'}, ico('resize','svg-sm'), ' '+f.size)),
      h('div',{class:'subfield-price'}, formatCurrency(f.price)));
    card.addEventListener('click', ()=>{ State.detail.field=f; State.detail.hour=null; renderSubFields(); renderDetailHero(); renderDetailDays(); renderDetailTimes(); renderPlaceStats(); setText('dPrice', formatCurrency(f.price)); renderDetailSticky(); });
    el.append(card);
  });
}
function dayButton(date, i, active, onClick){
  const label = dayLabel(date);
  const b=h('button',{class:'day-btn'+(active?' active':''), type:'button', 'aria-pressed':active?'true':'false', 'aria-label':label+' '+shortDate(date)},
    h('div',{}, label), h('div',{class:'d-date'}, shortDate(date)));
  b.addEventListener('click', onClick); b.dataset.date=date;
  return b;
}
function renderDetailDays(){
  const el=$('#detailDays'); clear(el);
  for(let i=0;i<7;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.detail.date, async()=>{
      State.detail.date=d; State.detail.hour=null; renderDetailDays(); renderDetailSticky(); timeSkeleton($('#detailTimes'),6);
      try{ await ensurePublicBookings(); }catch(_){}
      renderDetailDays(); renderDetailTimes();
    }));
  }
}
/* opts (اختياري): { cls, tag } — لوسم خانة بحالة خاصّة (مثل «الحالي» في تعديل الموعد)
   بدل «محجوز» المضلّل. الاستدعاءات الثلاثة القديمة تمرّ بلا تغيير. */
function timeButton(slot, taken, selected, onClick, opts){
  const o = opts || {};
  const stateLbl = taken ? (o.tag || t('stTaken')) : (selected ? t('stSelected') : t('stAvailable'));
  const disp = slotDisplay(slot);
  const b=h('button',{class:'tbtn'+(taken?' taken':'')+(selected&&!taken?' sel':'')+(o.cls?' '+o.cls:''), type:'button',
    'aria-pressed': (selected&&!taken)?'true':'false', 'aria-label': disp+' — '+stateLbl}, disp);
  if (taken){ b.setAttribute('disabled',''); b.append(h('span',{class:'t-tag'}, o.tag || t('bookedTag'))); }
  else b.addEventListener('click', onClick);
  return b;
}
/* تقسيم الأوقات لفترات اليوم (صباحاً/ظهراً/مساءً) — وضوح أعلى في تدفّق الحجز */
const TIME_PERIODS=[
  {key:'tmMorning', test:hr=>hr<12},
  {key:'tmNoon',    test:hr=>hr>=12&&hr<17},
  {key:'tmEvening', test:hr=>hr>=17},
];
/* ندرة الأوقات — لافتة تُعرض **فقط** حين يبقى وقت أو وقتان.
   العدد المعروض = عدد الأزرار القابلة للنقر بالضبط (نفس `free` أدناه)، فالمستخدم
   يستطيع عدّها بعينه ⇒ لا استعجال مخترَع (قاعدة الصدق م5). ولا نصّ عامّ لـ«n»
   لأن المعدود العربي يتغيّر مع العدد: نصّان جاهزان للمفرد والمثنّى. */
function scarcityBanner(free){
  if(free!==1 && free!==2) return null;
  return h('div',{class:'scarce', 'data-n':String(free)},
    h('span',{class:'scarce-dot','aria-hidden':'true'}),
    h('span',{class:'scarce-txt'}, t(free===1?'scarce1':'scarce2')));
}
function renderDetailTimes(){
  const el=$('#detailTimes'); clear(el);
  const slots=fieldSlots(State.detail.field);
  const taken=(State.bookedSlots[State.detail.field.field_id]?.[State.detail.date])||[];
  const free=slots.filter(s=>!taken.includes(s.hour)).length;
  const scarce=scarcityBanner(free); if(scarce) el.append(scarce);
  TIME_PERIODS.forEach(p=>{
    const group=slots.filter(s=>p.test(Number(s.hour)));
    if(!group.length) return;
    el.append(h('div',{class:'time-period'}, t(p.key)));
    group.forEach((s,i)=>{ const btn=timeButton(s, taken.includes(s.hour), State.detail.hour===s.hour, ()=>{ State.detail.hour=s.hour; renderDetailTimes(); }); btn.style.animationDelay=`${i*0.04}s`; el.append(btn); });
  });
  if(slots.length && free===0) el.append(h('div',{class:'no-times', style:{gridColumn:'1/-1'}}, t('noTimesDay')));
  renderDetailSticky();
}

/* ===================== RENDER: ECONOMIC (place / player) ===================== */
const bookingsForPlace = (id) => (State.publicBookings||[]).filter(b=>String(b.place_id)===String(id));
const placeWeeklySlots = (p) => (p?.fields||[]).reduce((s,f)=>s+fieldSlots(f).length,0)*7;
function placeTakenThisWeek(p){ const ids=new Set((p?.fields||[]).map(f=>String(f.field_id))); const days=new Set(Array.from({length:7},(_,i)=>dateAfter(i))); return (State.publicBookings||[]).filter(b=>ids.has(String(b.field_id))&&days.has(String(b.date).split('T')[0])&&!['cancelled','rejected'].includes(normStatus(b))).length; }
function econCard(title, badge, items, decision){
  const grid=h('div',{class:'econ-grid'});
  items.forEach(it=> grid.append(h('div',{class:'econ-item'}, h('div',{class:'econ-value'}, it.v), h('div',{class:'econ-label'}, it.l), it.h&&h('div',{class:'econ-hint'}, it.h))));
  return h('div',{class:'card', style:{borderColor:'rgba(216,181,82,.2)',marginBottom:'0'}},
    h('div',{class:'section-title'}, h('span',{}, title), badge&&h('span',{class:'mini-badge'}, badge)),
    grid, decision&&h('div',{class:'econ-decision'}, decision));
}
function renderPlaceStats(){
  const el=$('#placeStats'); if(!el) return; const p=State.detail.place; clear(el);
  const pb=bookingsForPlace(p.place_id); const total=placeWeeklySlots(p); const taken=placeTakenThisWeek(p);
  const availRate=calcPercent(Math.max(total-taken,0), total);
  const confirmed=pb.filter(b=>normStatus(b)==='confirmed').length;
  const confirmRate=calcPercent(confirmed, pb.length);
  const quality = !pb.length ? 'بيانات قليلة' : (confirmRate>=80?'ممتاز':confirmRate>=60?'جيد':'بحاجة متابعة');
  const decision = (confirmRate&&confirmRate<80) ? 'تنبيه: معدل التأكيد أقل من 80%.' : 'المؤشرات تساعدك تعرف إذا الملعب مناسب قبل الحجز.';
  el.append(econCard('📊 مؤشرات قبل الحجز','هذا الأسبوع',[
    {v:availRate+'%',l:'الأوقات المتاحة',h:'كلما قلّت يعني الطلب عالي'},
    {v:confirmRate+'%',l:'معدل التأكيد',h:'أقل من 80% يحتاج انتباه'},
    {v:pb.length,l:'طلبات سابقة',h:'مؤشر نشاط الملعب'},
    {v:quality,l:'نشاط المالك',h:'حسب معدل التأكيد'},
  ], decision));
}
function renderPlayerStats(list){
  const el=$('#playerStats'); if(!el) return; list=list||[]; clear(el);
  const confirmed=list.filter(b=>normStatus(b)==='confirmed');
  const rejected=list.filter(b=>['rejected','cancelled'].includes(normStatus(b)));
  const spent=confirmed.reduce((s,b)=>s+(Number(b.price)||0),0);
  if(!list.length) return;
  el.append(econCard('💸 ملخصك كلاعب', null, [
    {v:confirmed.length,l:'مرات لعبت'},
    {v:formatMoney(spent),l:'إجمالي الصرف'},
    {v:calcPercent(confirmed.length,list.length)+'%',l:'نسبة التأكيد'},
    {v:calcPercent(rejected.length,list.length)+'%',l:'رفض / إلغاء'},
  ], null));
  $('.card', el).style.marginBottom='15px';
}

/* ===================== BOOKING REVIEW (نافذة مراجعة فقط · مصدر حالة واحد = State.detail) =====================
   لا يوجد اختيار يوم/وقت/ملعب داخل النافذة — كله يتم في صفحة التفاصيل (State.detail).
   State.booking مجرّد لقطة من State.detail وقت الفتح حتى لا يختلفا أبداً. */
function detailSelectionComplete(){
  const d=State.detail; return !!(d.place && d.field && d.date && d.hour!=null);
}
function scrollToDetailSection(which, focus){
  if(!$('#page-detail')?.classList.contains('active')) showPage('detail');
  const sel = which==='field' ? '.detail-section[aria-label="اختيار الملعب"]' : '.detail-section[aria-label="اختيار الموعد"]';
  const sec=$(sel);
  requestAnimationFrame(()=>{ if(sec) sec.scrollIntoView({behavior:'smooth', block:'start'}); if(focus){ const f=$(focus); if(f){ try{ f.focus(); }catch(_){} } } });
}
function updateBookingStep(){   // النافذة دائماً عند خطوة المراجعة: 1 و2 مكتملتان، 3 نشطة
  $$('#bkSteps .bk-step').forEach(s=>{ const n=Number(s.dataset.step); s.classList.toggle('done', n<3); s.classList.toggle('active', n===3); s.setAttribute('aria-current', n===3?'step':'false'); });
}
function openBookingReview(){
  const { place, field, date, hour } = State.detail;
  // تحقّق قبل فتح المراجعة (رسالة + تمرير + Focus لأول عنصر ناقص)
  if(!place || !field){ toast(t('chooseFirst'),'warn'); scrollToDetailSection('field','#subFields .subfield-card'); return; }
  if(!date){ toast(t('chooseDayMsg'),'warn'); scrollToDetailSection('time','#detailDays .day-btn'); return; }
  if(hour==null){ toast(t('chooseTimeMsg'),'warn'); scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)'); return; }
  // ضيف؟ احفظ الاختيار وافتح خيار الدخول (تظهر المراجعة بعد الدخول)
  if(!Session.player()){ savePendingBooking(); openAuthChoice(); return; }
  State.booking = { place, field, date, hour };   // لقطة متطابقة مع التفاصيل
  renderReview();
  Modal.open('modal-booking');
}
function renderReview(){
  const { place, field, date, hour } = State.detail;
  const el=$('#bkReview'); if(!el) return; clear(el);
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  const logged = !!Session.player();
  /* إيصال مراجعة حديث: رأس المكان ← شبكة التفاصيل ← بيانات اللاعب ← الإجمالي البارز ← حالة الإرسال */
  const cell=(lbl,val,icon)=> h('div',{class:'rc-cell'},
    h('span',{class:'rc-lbl'}, ico(icon,'svg-sm'), ' '+lbl),
    h('span',{class:'rc-val'}, val));
  el.append(
    h('div',{class:'rc-head'},
      h('div',{class:'rc-place'}, place.place_name),
      h('div',{class:'rc-field'}, field.field_name),
      h('div',{class:'rc-loc'}, ico('pin','svg-sm'), ' '+placeLocation(place))),
    h('div',{class:'rc-grid'},
      cell(t('rvDay'), dayLabel(date)+' '+shortDate(date), 'cal'),
      cell(t('rvTime'), slot?slotDisplay(slot):'', 'clock'),
      cell(t('rvDuration'), t('twoHours'), 'clock'),
      cell(t('rvSize'), field.size||'—', 'resize')),
    h('div',{class:'rc-grid'},
      cell(t('rvName'), State.player?.name||'-', 'person'),
      cell(t('rvPhone'), State.player?.phone||'-', 'phone'),
      cell(t('rvStatus'), logged?t('statusPlayer'):t('statusGuest'), 'person')),
    h('div',{class:'rc-total'},
      h('span',{class:'rc-total-lbl'}, t('rvTotal')),
      h('span',{class:'rc-total-val'}, formatCurrency(field.price)))
  );
  updateBookingStep();
}

/* ===================== SUCCESS SCREEN (عام + حجز) ===================== */
/* يعيد شاشة النجاح لوضعها البسيط (تُستخدم للحساب/التقييم) */
function resetSuccessCard(){
  $('#success')?.classList.remove('success-full');           // ارجع للبطاقة المركزية البسيطة
  const eb=$('#successEyebrow'); if(eb){ eb.hidden=true; eb.textContent=''; }
  const icon=$('#successIcon'); if(icon){ icon.classList.remove('is-check'); icon.textContent='🎉'; }
  const sum=$('#successSummary'); if(sum){ sum.hidden=true; clear(sum); }
  const act=$('#successActions'); if(act){ clear(act); act.append(h('button',{class:'sbtn','data-action':'closeSuccess'}, t('successOkBtn'))); }
}
function showSimpleSuccess(text){
  resetSuccessCard();
  setText('successTitle', t('successDone')); setText('successText', text);
  Modal.open('success');
}
/* توليد ملف تقويم .ics لحدث الحجز (ساعتان، توقيت محلي) — تنزيل عبر Blob بلا أي HTML */
function icsStamp(d){ return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`; }
function downloadBookingIcs({ place, field, date, hour }){
  try{
    const st=new Date(`${date}T${String(hour).padStart(2,'0')}:00:00`); if(Number.isNaN(st.getTime())) return;
    const en=new Date(st); en.setHours(en.getHours()+2);
    const esc=(s)=>String(s||'').replace(/[\\;,]/g, m=>'\\'+m).replace(/\r?\n/g,'\\n');
    const ics=[
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mustadaira//Booking//AR','BEGIN:VEVENT',
      `UID:${Date.now()}-${String(field.field_id||'')}@mustadaira`,
      `DTSTAMP:${icsStamp(new Date())}`,`DTSTART:${icsStamp(st)}`,`DTEND:${icsStamp(en)}`,
      `SUMMARY:${esc(`${place.place_name} - ${field.field_name}`)}`,
      `LOCATION:${esc(placeLocation(place))}`,
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='mustadaira-booking.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }catch(_){}
}
/* شاشة نجاح الحجز: علامة متحركة + ملخّص + حالة + رقم الحجز + إجراءات */
function showBookingSuccess(info, bookingId){
  const { place, field, date, hour } = info;
  resetSuccessCard();                                       // بطاقة مركزية صغيرة (لا شاشة كاملة)
  // reflow يفصل إزالة is-check (في resetSuccessCard) عن إعادتها ⇒ أنيميشن النجاح يعيد التشغيل لكل حجز
  const icon=$('#successIcon'); if(icon){ void icon.offsetWidth; icon.classList.add('is-check'); icon.innerHTML=ICON.check; }
  setText('successTitle', t('bookingSuccessTitle'));
  setText('successText', `${place.place_name} · ${field.field_name}`);
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  // بطاقة الإيصال: حالة «بانتظار التأكيد» ← شبكة (يوم/وقت/مدة/سعر) ← رقم الحجز monospace
  const sum=$('#successSummary'); sum.hidden=false; clear(sum);
  const cell=(lbl,val,icn)=> h('div',{class:'ss-cell'}, h('div',{class:'ss-cell-lbl'}, ico(icn,'svg-sm'), ' '+lbl), h('div',{class:'ss-cell-val'}, val));
  sum.append(h('div',{class:'ss-status'}, ico('clock','svg-sm'), h('span',{}, t('statusPendingVenue'))));
  sum.append(h('div',{class:'ss-grid'},
    cell(t('rvDay'), `${dayLabel(date)} ${shortDate(date)}`, 'cal'),
    cell(t('rvTime'), slot?slotDisplay(slot):'', 'clock'),
    cell(t('rvDuration'), t('twoHours'), 'clock'),
    cell(t('rvPrice'), formatCurrency(field.price), 'money')));
  if(bookingId) sum.append(h('div',{class:'ss-ref'}, h('span',{class:'ss-ref-lbl'}, t('bookingNo')), h('span',{class:'ss-ref-val'}, '#'+bookingId)));
  const act=$('#successActions'); clear(act);
  const goB=h('button',{class:'sbtn'}, t('navBookings')); goB.addEventListener('click',()=>{ Modal.close('success'); showPage('bookings'); });
  const goC=h('button',{class:'cbtn'}, ico('cal','svg-sm'), ' '+t('addToCalendar')); goC.addEventListener('click',()=>downloadBookingIcs(info));
  const goH=h('button',{class:'cbtn'}, t('navHome')); goH.addEventListener('click',()=>{ Modal.close('success'); showPage('home'); renderPlaces(); });
  act.append(goB, goC, goH);
  Modal.open('success');
}

/* ===================== RENDER: PLAYER BOOKINGS ===================== */
function playerBookingCard(b){
  const rt = runtimeStatus(b); const lbl = statusLabel(rt);
  const status = normStatus(b);
  const canCancel = !isFinished(b) && status!=='cancelled' && status!=='rejected' && rt!=='in_progress';
  const card = h('div',{class:'card booking-strip '+status, style:{marginBottom:'14px'}},
    h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px',marginBottom:'8px'}},
      h('div',{style:{fontSize:'14px',fontWeight:'800',color:'var(--ink)'}}, b.place_name+' - '+b.field_name),
      h('span',{class:'badge '+lbl.c}, lbl.t)),
    h('div',{style:{display:'flex',flexDirection:'column',gap:'5px'}},
      h('div',{class:'info-line muted'}, ico('pin','svg-sm'), ' '+b.city),
      h('div',{style:{display:'flex',gap:'14px',flexWrap:'wrap'}},
        h('span',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+b.date),
        h('span',{class:'info-line muted'}, ico('clock','svg-sm'), ' '+b.time)),
      h('div',{style:{display:'flex',gap:'14px',flexWrap:'wrap'}},
        h('span',{class:'info-line muted'}, ico('resize','svg-sm'), ' '+(b.players||'')),
        h('span',{class:'info-line muted'}, ico('money','svg-sm'), ' '+formatCurrency(b.price))))
  );
  if (b.cancel_reason) card.append(h('div',{class:'reason-box'}, t('reasonPrefix')+b.cancel_reason));
  if (canCancel){
    const label = b.place_name+' - '+b.field_name;
    const row = h('div',{class:'bk-actions'});
    // «تعديل» للمعلّق وحده: المؤكّد اتّفق عليه الطرفان ⇒ تغييره من طرف واحد يكسر الاتفاق،
    // وسياسة القاعدة نفسها لا تسمح به (الدالّة ترفض أي حالة غير pending).
    if (status==='pending'){
      const ed=h('button',{class:'cbtn bk-act'}, ico('edit','svg-sm'), ' '+t('rsBtn'));
      ed.addEventListener('click', ()=>openReschedule(b));
      row.append(ed);
    }
    const btn=h('button',{class:'cbtn bk-act danger-outline-btn'}, t('cancelBookingBtn'));
    btn.addEventListener('click', ()=>playerCancelBooking(btn, b.row_number, label));
    row.append(btn);
    card.append(row);
  }
  return card;
}
async function loadPlayerBookings(){
  const list=$('#bookingsList'), stats=$('#playerStats');
  if (!Session.player()){ clear(stats); clear(list); list.append(emptyState({icon:'🔒',title:t('loginToSee'),sub:t('loginToSeeSub'),actionLabel:t('login'),action:()=>showPage('playerLogin')})); return; }
  clear(stats); clear(list); list.append(...[0,1].map(()=>h('div',{class:'skeleton-card'}, h('div',{class:'sk-body'}, h('div',{class:'sk sk-line w70'}), h('div',{class:'sk sk-line w45'})))));
  try{
    const res = await API.get('getPlayerBookings', { player_token: Session.player() }, 'playerBookings');
    if (!res.success){ clear(list); list.append(emptyState({icon:'⚠️',title:t('bkFetchFail'),sub:apiMsg(res.message)||t('tryAgain')})); return; }
    State.player = res.player || State.player;
    renderPlayerStats(res.bookings||[]);
    clear(list);
    if (!res.bookings || !res.bookings.length){ list.append(emptyState({icon:'📭',title:t('noBookingsYet'),sub:t('noBookingsYetSub'),actionLabel:t('browseFields'),action:()=>showPage('home')})); return; }
    // تصنيف لأربع مجموعات: قادمة / بانتظار التأكيد / سابقة / ملغاة-مرفوضة
    const cats = categorizeBookings(res.bookings);
    const recentFin = visibleBookings(cats.finished, 14, State.showAllPlayer);
    const recentCan = visibleBookings(cats.cancelled, 14, State.showAllPlayer);
    const hidden = (cats.finished.length-recentFin.length) + (cats.cancelled.length-recentCan.length);
    const group=(title, arr)=>{ if(!arr.length) return; list.append(sectionTitle(title, arr.length)); arr.forEach(b=>list.append(playerBookingCard(b))); };
    group(t('grpUpcoming'), cats.upcoming);
    group(t('grpPending'), cats.pending);
    group(t('grpPast'), recentFin);
    group(t('grpCancelled'), recentCan);
    if(!cats.upcoming.length && !cats.pending.length && !recentFin.length && !recentCan.length){
      list.append(h('div',{class:'card', style:{textAlign:'center',color:'var(--soft)'}}, t('noBookingsToShow')));
    }
    if (hidden>0 || State.showAllPlayer){
      const toggle=h('button',{class:'cbtn', style:{marginTop:'14px'}}, State.showAllPlayer?t('hideOld'):`${t('fullHistory')} (${hidden})`);
      toggle.addEventListener('click', ()=>{ State.showAllPlayer=!State.showAllPlayer; loadPlayerBookings(); });
      list.append(toggle);
    }
  }catch(e){ if(isAbort(e)) return; clear(list); list.append(emptyState({icon:'📡',title:t('connProblem'),sub:t('connProblemSub')})); }
}
/* تصنيف حجوزات اللاعب لأربع مجموعات واضحة */
function categorizeBookings(list){
  const g={ upcoming:[], pending:[], finished:[], cancelled:[] };
  (list||[]).forEach(b=>{
    const s=normStatus(b);
    if(s==='cancelled'||s==='rejected'){ g.cancelled.push(b); return; }
    if(isFinished(b)){ g.finished.push(b); return; }
    if(s==='pending'){ g.pending.push(b); return; }
    g.upcoming.push(b);   // مؤكّد (وجاري اللعب)
  });
  return g;
}
function sectionTitle(title, count){ return h('div',{class:'sec-title', style:{padding:'8px 0 10px'}}, h('span',{}, title), h('span',{class:'mini-badge'}, String(count))); }

async function playerCancelBooking(btn, rowNumber, label){
  const reason = await askReason(t('playerCancelTitle'), t('playerCancelHint',{label}), t('confirmCancelBtn'));
  if (reason===null) return;
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'updateBookingStatus', player_token:Session.player(), row_number:rowNumber, status:'cancelled', cancel_reason: reason || t('playerCancelledDefault') });
      if (!res.success){ toast(apiMsg(res.message)||t('cancelFail'),'error'); return; }
      toast(t('cancelOk'),'success');
      await loadPlayerBookings(); await loadData();
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ toast(t('cancelErr'),'error'); }
  });
}

/* ===================== تعديل موعد الحجز (اللاعب) =====================
   يعيد استعمال منطق الوقت نفسه الذي تستعمله صفحة التفاصيل والحجز الخارجي:
   fieldSlots للأوقات · State.bookedSlots للمحجوز · dayButton/timeButton للعرض.
   ⚠️ الحفظ يمرّ بدالّة في القاعدة لا بـPATCH مباشر: سياسة RLS تسمح للاعب أن
   يُلغي حجزه فقط (`with check … status = 'cancelled'`)، ولو وُسِّعت لتمرير
   pending لصار بوسعه تعديل **أي** عمود — السعر والملعب واسم صاحب الحجز.
   الدالّة تعدّل التاريخ والساعة وحدهما وتتحقّق من الملكية والحالة والتوفّر. */
function reschedFieldOf(b){
  const place=(State.places||[]).find(p=>String(p.place_id)===String(b.place_id));
  return place ? (place.fields||[]).find(f=>String(f.field_id)===String(b.field_id)) : null;
}
async function openReschedule(b){
  if(!Session.player()){ showPage('playerLogin'); return; }
  if(!State.places.length){ try{ await loadData(); }catch(_){} }
  // بلا كائن الملعب لا نعرف جدول أوقاته ⇒ نقولها صراحةً بدل عرض أوقات مخترَعة
  const field=reschedFieldOf(b);
  if(!field){ toast(t('rsNoField'),'warn'); return; }
  // اليوم المفتوح = يوم الحجز إن كان ضمن الأيام السبعة المعروضة، وإلّا اليوم.
  // (حجز معلّق بتاريخ أبعد من أسبوع أو تاريخ ماضٍ ⇒ لا يطابق أي زرّ يوم فيبقى بلا نشِط)
  const cur=String(b.date).split('T')[0];
  const inWindow=Array.from({length:7},(_,i)=>dateAfter(i)).includes(cur);
  State.reschedule={ booking:b, field, date: inWindow ? cur : today(), hour:null };
  setText('rsCurrent', `${b.place_name} - ${b.field_name} · ${dayLabel(b.date)} ${shortDate(String(b.date).split('T')[0])} · ${b.time}`);
  renderRescheduleDays(); renderRescheduleTimes();
  Modal.open('modal-reschedule');
  try{ await ensurePublicBookings(); }catch(_){}
  renderRescheduleTimes();
}
function renderRescheduleDays(){
  const el=$('#rsDays'); if(!el) return; clear(el);
  for(let i=0;i<7;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.reschedule.date, async()=>{
      State.reschedule.date=d; State.reschedule.hour=null;
      renderRescheduleDays(); timeSkeleton($('#rsTimes'),6);
      try{ await ensurePublicBookings(); }catch(_){}
      renderRescheduleDays(); renderRescheduleTimes();
    }));
  }
}
function renderRescheduleTimes(){
  const el=$('#rsTimes'); const { booking:b, field, date }=State.reschedule; if(!el||!field) return; clear(el);
  const taken=(State.bookedSlots[field.field_id]?.[date])||[];
  const curDate=String(b.date).split('T')[0], curHour=Number(b.hour);
  const slots=fieldSlots(field);
  const free=slots.filter(s=>!taken.includes(s.hour)).length;
  const scarce=scarcityBanner(free); if(scarce) el.append(scarce);
  slots.forEach(s=>{
    // خانة الحجز نفسه تظهر «محجوزة» لأنها فعلاً في booked_slots — تسميتها «الحالي»
    // تقول الحقيقة: هي محجوزة لك أنت، والانتقال إليها بلا معنى (والقاعدة ترفضه).
    const isCur = (date===curDate && Number(s.hour)===curHour);
    el.append(timeButton(s, taken.includes(s.hour), State.reschedule.hour===s.hour,
      ()=>{ State.reschedule.hour=s.hour; renderRescheduleTimes(); },
      isCur ? { cls:'current', tag:t('rsCurrentTag') } : null));
  });
  if(slots.length && free===0) el.append(h('div',{class:'no-times', style:{gridColumn:'1/-1'}}, t('noTimesDay')));
}
async function saveReschedule(btn){
  const { booking:b, field, date, hour }=State.reschedule;
  if(!b||!field){ Modal.close('modal-reschedule'); return; }
  if(hour==null){ toast(t('rsPickTime'),'warn'); return; }
  const slot=fieldSlots(field).find(s=>Number(s.hour)===Number(hour));
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'playerRescheduleBooking', player_token:Session.player(),
        row_number:b.row_number, date, hour, time: slot ? slot.label : '' });
      if(!res.success){ toast(apiMsg(res.message)||t('rsFail'),'error');
        try{ await loadPublicBookings(); }catch(_){}
        renderRescheduleTimes();                       // الوقت راح لغيرك ⇒ أظهره محجوزاً فوراً
        return; }
      Modal.close('modal-reschedule', true);
      buzz(14); toast(t('rsOk'),'success');
      State.reschedule={ booking:null, field:null, date:null, hour:null };
      await loadPlayerBookings();
      try{ await loadPublicBookings(); }catch(_){}
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ toast(t('rsErr'),'error'); }
  });
}

/* ===================== RENDER: OWNER DASHBOARD ===================== */
/* بطاقة حجز هيكلية واحدة (أفاتار + سطران + شريط حالة) — تطابق هيكل بطاقة الحجز الحقيقية */
const skBookingCard = ()=> h('div',{class:'sk-bk'},
  h('span',{class:'sk sk-bk-av'}),
  h('div',{class:'sk-bk-col'}, h('span',{class:'sk'}), h('span',{class:'sk'})),
  h('span',{class:'sk sk-bk-tag'}));
/* هيكل اللوحة أثناء الجلب: يقنّع أصفار بلاطات الإحصاء ويملأ قائمتَي اليوم والحجوزات.
   بديل عن سطر نصّي واحد كان يترك بقية اللوحة تعرض أصفارًا تُقرأ كبيانات حقيقية. */
function renderOwnerSkeleton(){
  const pg=$('#page-owner'); if(pg) pg.classList.add('owner-loading');
  for(const id of ['#ownerToday','#ownerBookings']){
    const box=$(id); if(!box) continue;
    clear(box); for(let i=0;i<3;i++) box.append(skBookingCard());
  }
}
const clearOwnerSkeleton = ()=>{ const pg=$('#page-owner'); if(pg) pg.classList.remove('owner-loading'); };

async function loadOwnerDashboard(){
  if (!Session.owner()){ showPage('ownerLogin'); return; }
  const el=$('#ownerBookings');
  renderOwnerSkeleton();
  // 1) جلب البيانات — فشل الشبكة فقط يُظهر "تعذّر جلب البيانات"
  let res;
  try{
    res = await API.get('getOwnerData', { owner_token: Session.owner() }, 'ownerData');
  }catch(e){
    // إجهاض = طلب أحدث يعمل الآن ⇒ نترك الهيكل له، فرفعه هنا يُومض اللوحة فارغةً
    if(isAbort(e)) return;
    clearOwnerSkeleton();
    clear(el); el.append(emptyState({icon:'📡',title:t('fetchFail'),sub:t('fetchFailSub')}));
    return;
  }
  clearOwnerSkeleton();
  if (!res || !res.success){ toast(apiMsg(res&&res.message)||t('sessionExpired'),'error'); doLogout(); return; }
  // 2) الرسم — خطأ هنا لا يُلبَّس لباس فشل الشبكة، بل يُظهر الرسالة الحقيقية
  State.ownerData = res;
  // مالك مختلف (مكان مختلف) ⇒ تصفير كاش AI للجلسة حتى لا تظهر تحليلات مكان سابق
  const aiPid = res.place ? String(res.place.place_id||'') : '';
  if (aiState().placeId !== aiPid) State.ai = { placeId: aiPid };
  try{
    renderOwnerDashboard();
  }catch(err){
    console.error('renderOwnerDashboard failed:', err);
    clear(el); el.append(emptyState({icon:'⚠️', title:t('dashRenderErr'), sub:String((err&&err.message)||err)}));
  }
}
/* يشغّل خطوة رسم معزولة: خطؤها يُسجَّل ولا يُسقط بقية اللوحة */
function safeRender(label, fn){ try{ fn(); }catch(err){ console.error('owner render ['+label+'] failed:', err); } }
function renderOwnerDashboard(){
  const d=State.ownerData; if(!d) return;
  setText('ownerPlaceTitle', d.place ? d.place.place_name : t('unknownPlace'));
  const bookings = d.bookings || [];
  safeRender('stats', ()=>renderOwnerStats(bookings));
  safeRender('econ', ()=>renderOwnerEcon(bookings));
  safeRender('charts', ()=>renderOwnerCharts(bookings));
  safeRender('fieldFilter', ()=>{
    const sel=$('#ownerFieldFilter'); const old=sel.value||'all';
    clear(sel); sel.append(h('option',{value:'all'},t('allFields')));
    (d.fields||[]).forEach(f=> sel.append(h('option',{value:f.field_id}, f.field_name)));
    sel.value=old;
  });
  safeRender('bookings', renderOwnerBookings);
  safeRender('fields', renderOwnerFields);
  safeRender('today', renderOwnerToday);
  // 🤖 لوحات AI: الطقس فوراً (تبويب اليوم الافتراضي)، والتقارير كسولة عند فتح تبويبها
  safeRender('ai', ()=>{ loadAiWeather(); if((State.ownerTab||'today')==='reports'){ loadAiInsights(); loadAiReviews(); } });
  showOwnerTab(State.ownerTab || 'today');
}
/* ===================== OWNER TABS ===================== */
function showOwnerTab(name){
  State.ownerTab=name;
  $$('#ownerTabs .otab').forEach(b=>{ const on=b.dataset.otab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); b.setAttribute('tabindex', on?'0':'-1'); });
  $$('#page-owner .owner-tab').forEach(p=>{ p.hidden = (p.id !== 'ownerTab-'+name); });
  const fab=$('#ownerAddFab'); if(fab) fab.hidden = (name!=='fields');   // FAB إضافة ملعب — تبويب الملاعب فقط
  if(name==='calendar') renderOwnerCalendar();
  if(name==='today') renderOwnerToday();
  if(name==='reports' && State.ownerData){ loadAiInsights(); loadAiReviews(); }   // 🤖 جلب كسول أول مرة فقط
  if(name==='bookings'){ State.ownerNewCount=0; updateOwnerTabBadge(); }          // فتح التبويب يصفّر شارة الجديد
  window.scrollTo({ top:0, behavior:'instant' });
}
/* ===================== OWNER · TODAY TAB ===================== */
function renderOwnerToday(){
  const el=$('#ownerToday'); if(!el) return;
  const all=State.ownerData?.bookings||[]; const fields=State.ownerData?.fields||[]; const td=today();
  const todayB=all.filter(b=>String(b.date||'').split('T')[0]===td);
  const pend=todayB.filter(b=>normStatus(b)==='pending').sort((a,b)=>Number(a.hour)-Number(b.hour));
  const conf=todayB.filter(b=>normStatus(b)==='confirmed');
  const revenue=conf.reduce((s,b)=>s+(Number(b.price)||0),0);
  // أوقات اليوم الفارغة (من بيانات المالك مباشرة)
  const bookedToday={};
  todayB.forEach(b=>{ const s=normStatus(b); if(s==='cancelled'||s==='rejected') return; const fid=String(b.field_id); const hr=Number(b.hour); if(!Number.isNaN(hr)){ (bookedToday[fid] ||= new Set()).add(hr); } });
  let totalSlots=0, booked=0;
  fields.forEach(f=>{ if(f.active===false) return; const slots=fieldSlots(f); totalSlots+=slots.length; const set=bookedToday[String(f.field_id)]||new Set(); booked+=slots.filter(s=>set.has(s.hour)).length; });
  setText('otToday', todayB.length); setText('otPending', pend.length); setText('otRevenue', formatMoney(revenue)); setText('otFree', Math.max(totalSlots-booked,0));
  // اتجاه آخر 7 أيام على بطاقة «حجوزات اليوم» (بلا الملغاة/المرفوضة)
  setSpark('otToday', [...Array(7)].map((_,i)=>{ const ds=dateAfter(i-6); return all.filter(b=>String(b.date||'').split('T')[0]===ds && !['cancelled','rejected'].includes(normStatus(b))).length; }));
  clear(el);
  if(!todayB.length){ el.append(emptyState({icon:'📅', title:t('noBookingsToday'), sub:t('noBookingsTodaySub')})); return; }
  const rest=todayB.filter(b=>normStatus(b)!=='pending').sort((a,b)=>Number(a.hour)-Number(b.hour));
  if(pend.length){ el.append(sectionTitle(t('pendingReply'), pend.length)); pend.forEach(b=>el.append(ownerBookingCard(b))); }
  if(rest.length){ el.append(sectionTitle(t('restToday'), rest.length)); rest.forEach(b=>el.append(ownerBookingCard(b))); }
}
/* ===================== OWNER · CALENDAR TAB (Vanilla) ===================== */
function ownerBookingsByDate(){
  const m={}; (State.ownerData?.bookings||[]).forEach(b=>{ const d=String(b.date||'').split('T')[0]; if(!d) return; (m[d] ||= []).push(b); }); return m;
}
function renderOwnerCalendar(){
  if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00');
  const month=State.calMonth, y=month.getFullYear(), mo=month.getMonth();
  setText('calTitle', month.toLocaleDateString(State.lang==='en'?'en-GB':'ar', {month:'long', year:'numeric'}));
  const wd=$('#calWeekdays'); clear(wd);
  const wdFmt=new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'});
  for(let i=0;i<7;i++){ wd.append(h('div',{class:'cal-wd'}, wdFmt.format(new Date(2024,8,1+i)))); }   // 2024-09-01 = الأحد
  const grid=$('#calGrid'); clear(grid);
  const startDay=new Date(y,mo,1).getDay();
  const daysInMonth=new Date(y,mo+1,0).getDate();
  const byDate=ownerBookingsByDate(); const td=today();
  for(let i=0;i<startDay;i++) grid.append(h('div',{class:'cal-cell empty'}));
  for(let d=1; d<=daysInMonth; d++){
    const ds=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cnt=(byDate[ds]||[]).filter(b=>!['cancelled','rejected'].includes(normStatus(b))).length;
    const cell=h('button',{class:'cal-cell'+(ds===td?' today':'')+(cnt?' has':''), type:'button', dataset:{date:ds}},
      h('span',{class:'cal-d'}, String(d)), cnt?h('span',{class:'cal-dot'}, String(cnt)):null);
    cell.addEventListener('click', ()=>renderCalDay(ds));
    grid.append(cell);
  }
  // اعرض اليوم افتراضياً إن كان ضمن الشهر، وإلا أول يوم فيه حجوزات
  const def = (td.startsWith(`${y}-${String(mo+1).padStart(2,'0')}`)) ? td : Object.keys(byDate).filter(k=>k.startsWith(`${y}-${String(mo+1).padStart(2,'0')}`)).sort()[0];
  if(def) renderCalDay(def); else clear($('#calDayBookings'));
}
function renderCalDay(ds){
  const el=$('#calDayBookings'); if(!el) return;
  $$('#calGrid .cal-cell').forEach(c=>c.classList.toggle('sel', c.dataset.date===ds));
  const list=(ownerBookingsByDate()[ds]||[]).sort((a,b)=>Number(a.hour)-Number(b.hour));
  clear(el);
  el.append(h('div',{class:'sec-title', style:{padding:'0 0 10px'}}, h('span',{}, `${arabicDay(ds)} ${shortDate(ds)}`), h('span',{class:'mini-badge'}, String(list.length))));
  if(!list.length){ el.append(h('div',{class:'card', style:{textAlign:'center',color:'var(--soft)'}}, t('noBookingsDay'))); return; }
  list.forEach(b=> el.append(ownerBookingCard(b)));
}
/* ===================== SPARKLINES (SVG خفيف — بلا مكتبات) =====================
   منحنى اتجاه صغير أسفل بطاقات الإحصاء. المدخلات تُطهَّر بـNumber (أرقام فقط)
   ⇒ حقن الـSVG كسلسلة آمن تماماً (لا بيانات مستخدم). */
function createSparkline(points, cls){
  const data=(points||[]).map(Number).filter(n=>Number.isFinite(n));
  if(data.length<2 || !data.some(n=>n>0)) return null;      // لا نرسم خطاً مسطّحاً على أصفار
  const W=100,H=26,P=2, max=Math.max(...data), min=Math.min(...data), span=(max-min)||1;
  const step=(W-P*2)/(data.length-1);
  const pts=data.map((v,i)=>[P+i*step, H-P-((v-min)/span)*(H-P*2)]);
  let dPath='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
  for(let i=1;i<pts.length;i++){                            // تنعيم بمنحنيات ربعية عبر نقاط المنتصف
    const mx=((pts[i-1][0]+pts[i][0])/2).toFixed(1), my=((pts[i-1][1]+pts[i][1])/2).toFixed(1);
    dPath+=' Q'+pts[i-1][0].toFixed(1)+','+pts[i-1][1].toFixed(1)+' '+mx+','+my;
  }
  const last=pts[pts.length-1];
  dPath+=' L'+last[0].toFixed(1)+','+last[1].toFixed(1);
  return h('span',{class:'sparkline'+(cls?' '+cls:''), 'aria-hidden':'true',
    html:'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
         '<path class="spark-fill" d="'+dPath+' L'+(W-P)+','+H+' L'+P+','+H+' Z"/>'+
         '<path class="spark-line" d="'+dPath+'"/></svg>'});
}
/* يثبّت سباركلاين أسفل بطاقة .stat-card الحاوية للعنصر المعطى (يستبدل القديم) */
function setSpark(anchorId, points, cls){
  const card=$('#'+anchorId)?.closest('.stat-card'); if(!card) return;
  card.querySelector('.sparkline')?.remove();
  const s=createSparkline(points, cls); if(s) card.append(s);
}
/* ===================== OWNER CHARTS (SVG فانيلا — بلا مكتبات) =====================
   القيم تُطهَّر بـNumber والتسميات مُولّدة داخليًا (أيام/ساعات) ⇒ حقن SVG آمن تماماً. */
function sanTxt(s){ return String(s).replace(/[<>&]/g,''); }
function createBarChart(data, opts){
  opts=opts||{};
  const n=data.length||1, vals=data.map(d=>Number(d.value)||0), max=Math.max(1,...vals);
  const W=Math.max(n*38,220), H=126, padB=22, padT=opts.showVal?18:8, slot=W/n, bw=Math.min(30, slot-12);
  let s='';
  data.forEach((d,i)=>{
    const cx=(i+0.5)*slot, v=Number(d.value)||0, bh=v/max*(H-padB-padT), y=H-padB-bh;
    s+='<rect class="bar-r" x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(bh,2).toFixed(1)+'" rx="4"/>';
    if(opts.showVal && v>0) s+='<text class="bar-v" x="'+cx.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">'+Math.round(v)+'</text>';
    s+='<text class="bar-x" x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+sanTxt(d.label)+'</text>';
  });
  return h('div',{class:'chart-svg', html:'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">'+s+'</svg>'});
}
function createDonut(pct, label){
  pct=Math.max(0,Math.min(100,Math.round(Number(pct)||0)));
  const r=42, c=2*Math.PI*r, off=c*(1-pct/100);
  return h('div',{class:'chart-donut-svg', html:
    '<svg viewBox="0 0 110 110" width="104" height="104" role="img" aria-hidden="true">'+
    '<circle class="donut-bg" cx="55" cy="55" r="'+r+'"/>'+
    '<circle class="donut-fg" cx="55" cy="55" r="'+r+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 55 55)"/>'+
    '<text class="donut-num" x="55" y="53" text-anchor="middle">'+pct+'%</text>'+
    (label?'<text class="donut-lbl" x="55" y="69" text-anchor="middle">'+sanTxt(label)+'</text>':'')+
    '</svg>'});
}
function renderOwnerCharts(bookings){
  const fields=State.ownerData?.fields||[];
  const wd=new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'});
  const days=[...Array(7)].map((_,i)=>dateAfter(i-6));
  // 1) الإيراد اليومي (المؤكّد فقط)
  const revData=days.map(ds=>({ label: wd.format(new Date(ds+'T12:00:00')),
    value: bookings.filter(b=>String(b.date||'').split('T')[0]===ds && normStatus(b)==='confirmed').reduce((s,b)=>s+(Number(b.price)||0),0) }));
  const rc=$('#ownerRevChart'); if(rc){ clear(rc); rc.append( revData.some(d=>d.value>0) ? createBarChart(revData,{showVal:false}) : h('div',{class:'chart-empty'}, t('noData')) ); }
  // 2) إشغال الأسبوع (نفس منطق renderOwnerEcon)
  const dset=new Set(days);
  const confW=bookings.filter(b=>dset.has(String(b.date||'').split('T')[0]) && normStatus(b)==='confirmed');
  const totalSlots=fields.reduce((s,f)=>s+fieldSlots(f).length,0)*7;
  const oc=$('#ownerOccChart'); if(oc){ clear(oc); oc.append(createDonut(calcPercent(confW.length,totalSlots), t('occupancy'))); }
  // 3) التوزيع حسب الساعة (المؤكّد)
  const byHour={}; bookings.filter(b=>normStatus(b)==='confirmed').forEach(b=>{ const hr=Number(b.hour); if(!Number.isNaN(hr)) byHour[hr]=(byHour[hr]||0)+1; });
  const hrs=Object.keys(byHour).map(Number).sort((a,b)=>a-b);
  const hc=$('#ownerHoursChart'); if(hc){ clear(hc); hc.append( hrs.length ? createBarChart(hrs.map(hr=>({label:hr+':00', value:byHour[hr]})),{showVal:true}) : h('div',{class:'chart-empty'}, t('noData')) ); }
}
function renderOwnerStats(bookings){
  const confirmed=bookings.filter(b=>normStatus(b)==='confirmed');
  const fromWeb=confirmed.filter(b=>!isOwnerManual(b)); const manual=confirmed.filter(isOwnerManual);
  const pending=bookings.filter(b=>normStatus(b)==='pending');
  const td=today(), weekStart=dateAfter(-6);
  const todayCount=bookings.filter(b=>String(b.date)===td).length;
  const weekCount=bookings.filter(b=>String(b.date||'')>=weekStart && String(b.date)<=td).length;
  const webRev=fromWeb.reduce((s,b)=>s+(Number(b.price)||0),0);
  const manualRev=manual.reduce((s,b)=>s+(Number(b.price)||0),0);
  const profit=webRev*CONFIG.COMMISSION; const net=webRev-profit+manualRev;
  const rate=bookings.length?Math.round((confirmed.length/bookings.length)*100):0;
  const topField=getTopBy(bookings,b=>String(b.field_id||''),b=>b.field_name||'-');
  const topSource=getTopBy(bookings,b=>String(b.source||'direct').trim()||'direct',b=>String(b.source||'direct').trim()||'direct');
  setText('oTotal',bookings.length); setText('oConfirmed',confirmed.length); setText('oPending',pending.length); setText('oToday',todayCount);
  setText('oWeek',`${t('last7')}: ${weekCount}`); setText('oRevenue',formatMoney(webRev)); setText('oProfit',formatMoney(profit)); setText('oNet',formatMoney(net));
  setText('oRate',rate+'%'); requestAnimationFrame(()=>{ const bar=$('#oRateBar'); if(bar)bar.style.width=Math.min(rate,100)+'%'; });
  setText('oTopField', topField?`${topField.label} (${topField.count})`:'-'); setText('oTopSource', topSource?`${topSource.label} (${topSource.count})`:'-');
  // اتجاه آخر 14 يوماً: كل الطلبات (بطاقة الكل) + المؤكدة (بطاقتها، بلون النعناع)
  const days14=[...Array(14)].map((_,i)=>dateAfter(i-13));
  setSpark('oTotal', days14.map(ds=>bookings.filter(b=>String(b.date)===ds).length));
  setSpark('oConfirmed', days14.map(ds=>confirmed.filter(b=>String(b.date)===ds).length), 'spark-ok');
}
function renderOwnerEcon(bookings){
  const fields=State.ownerData?.fields||[]; const days=new Set(Array.from({length:7},(_,i)=>dateAfter(i)));
  const week=bookings.filter(b=>days.has(String(b.date||'').split('T')[0]));
  const confW=week.filter(b=>normStatus(b)==='confirmed');
  const totalSlots=fields.reduce((s,f)=>s+fieldSlots(f).length,0)*7;
  const occ=calcPercent(confW.length,totalSlots);
  const avgPrice=fields.length?fields.reduce((s,f)=>s+(Number(f.price)||0),0)/fields.length:0;
  const lost=Math.round(Math.max(totalSlots-confW.length,0)*avgPrice);
  const cancelled=bookings.filter(b=>['cancelled','rejected'].includes(normStatus(b)));
  const cancelRate=calcPercent(cancelled.length,bookings.length);
  const confAll=bookings.filter(b=>normStatus(b)==='confirmed');
  const webShare=calcPercent(confAll.filter(isWebsite).length, confAll.length);
  const hourTop=getTopBy(confAll,b=>String(b.hour||''),b=>b.time||((b.hour||'-')+':00'));
  const phones={}; confAll.forEach(b=>{const k=normalizePhone(b.phone||'')||String(b.player_id||''); if(k)phones[k]=(phones[k]||0)+1;});
  const uniq=Object.keys(phones).length; const ret=Object.values(phones).filter(c=>c>1).length;
  const returnRate=calcPercent(ret,uniq);
  let decision=t('econMore');
  if(occ<40)decision=t('econLow');
  else if(occ>=60&&occ<=80)decision=t('econGood');
  else if(occ>=85)decision=t('econHigh');
  setText('oOccupancy',occ+'%'); setText('oLost',formatMoney(lost)); setText('oCancel',cancelRate+'%');
  setText('oBestTime',hourTop?hourTop.label:'-'); setText('oWebShare',webShare+'%'); setText('oReturn',returnRate+'%'); setText('oDecision',decision);
}
/* عمر الطلب المعلّق «منذ …» — لون يشتد مع التأخر لتحفيز سرعة الردّ */
function bookingAge(b){
  if(normStatus(b)!=='pending') return null;
  const d=new Date(String(b.timestamp||'').replace(' ','T'));
  if(Number.isNaN(d.getTime())) return null;
  const mins=Math.max(0, Math.floor((Date.now()-d.getTime())/60000));
  const label = mins<1 ? t('ageNow') : mins<60 ? t('ageMin',{n:mins}) : mins<1440 ? t('ageHr',{n:Math.floor(mins/60)}) : t('ageDay',{n:Math.floor(mins/1440)});
  return { label, cls: mins<15?'age-ok' : mins<60?'age-warn' : 'age-late' };
}
function ownerBookingCard(b){
  const lbl=statusLabel(runtimeStatus(b));
  const age=bookingAge(b);
  const card=h('div',{class:'card booking-strip '+normStatus(b), style:{marginBottom:'14px'}},
    h('div',{style:{display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'flex-start',marginBottom:'9px'}},
      h('div',{class:'owner-bk-head'},
        // أفاتار أحرف العميل (م4، نمط المرجع) — تمييز بصري سريع لصاحب الحجز
        h('span',{class:'owner-bk-av','aria-hidden':'true'}, initials(b.name)),
        h('div',{style:{minWidth:'0'}},
          h('div',{style:{fontSize:'14px',fontWeight:'900',color:'var(--ink)'}}, b.field_name),
          h('div',{style:{display:'flex',gap:'10px',marginTop:'4px',flexWrap:'wrap'}},
            h('span',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+b.date),
            h('span',{class:'info-line muted'}, ico('clock','svg-sm'), ' '+b.time)))),
      h('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'5px'}},
        h('span',{class:'badge '+lbl.c}, lbl.t),
        age && h('span',{class:'age-chip '+age.cls}, '⏱ '+age.label))),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'11px'}},
      h('span',{class:'info-line'}, ico('person','svg-sm'), ' '+(b.name||'-')),
      h('span',{class:'info-line'}, ico('phone','svg-sm'), ' '+(b.phone||'-')),
      h('span',{class:'info-line'}, ico('resize','svg-sm'), ' '+(b.players||'-')),
      h('span',{class:'info-line'}, ico('money','svg-sm'), ' '+formatCurrency(b.price||0)),
      h('span',{class:'info-line', style:{color:isOwnerManual(b)?'#2563eb':'var(--ink-2)'}}, isOwnerManual(b)?t('externalBooking'):t('srcPrefix')+(b.source||'direct')))
  );
  if (b.cancel_reason) card.append(h('div',{class:'reason-box', style:{marginTop:'0',marginBottom:'11px'}}, t('cancelReasonPrefix')+b.cancel_reason));
  const mk=(cls,txt,st)=>{ const x=h('button',{class:'owner-action '+cls}, txt); x.addEventListener('click',()=>updateBookingStatus(x,b.row_number,st)); return x; };
  const waBtn=()=>h('a',{href:'https://wa.me/'+String(b.phone||'').replace(/^0/,'962'),target:'_blank',rel:'noopener',class:'owner-wa-link'}, h('button',{class:'owner-action owner-wa'}, ico('wa','svg-sm'), ' '+t('actWhatsapp')));
  if (normStatus(b)==='pending'){
    // طلب معلّق: قبول/رفض بارزان بعرض كامل (مرجع لوحة المالك) + واتساب ثانوي
    card.append(h('div',{class:'owner-decide'},
      mk('owner-approve','✓ '+t('actApprove'),'confirmed'),
      mk('owner-decline','✕ '+t('actDecline'),'rejected')));
    card.append(h('div',{class:'owner-actions-sec'}, waBtn()));
  } else {
    const actions=h('div',{style:{display:'flex',gap:'7px',flexWrap:'wrap'}});
    actions.append(mk('owner-confirm',t('actConfirmWa'),'confirmed'), mk('owner-reject',t('actReject'),'rejected'), mk('owner-cancel',t('actCancel'),'cancelled'), waBtn());
    card.append(actions);
  }
  return card;
}
function renderOwnerBookings(){
  const d=State.ownerData; if(!d) return;
  let bookings=d.bookings||[];
  const date=$('#ownerDateFilter').value; const fieldId=$('#ownerFieldFilter').value;
  const status=$('#ownerStatusFilter')?.value||'all';
  const raw=($('#ownerSearch')?.value||'').trim(); const q=normalizeText(raw); const qd=raw.replace(/\D/g,'');
  if (!State.showAllOwner) bookings=visibleBookings(bookings,30,false);
  if (date) bookings=bookings.filter(b=>String(b.date)===date);
  if (fieldId&&fieldId!=='all') bookings=bookings.filter(b=>String(b.field_id)===String(fieldId));
  if (status!=='all') bookings=bookings.filter(b=>normStatus(b)===status);
  if (raw) bookings=bookings.filter(b=> normalizeText(b.name).includes(q) || (qd && String(b.phone||'').replace(/\D/g,'').includes(qd)) );
  const tgl=$('#ownerHistoryToggle'); if(tgl) tgl.textContent=State.showAllOwner?t('hideOld'):t('fullHistory');
  const el=$('#ownerBookings'); clear(el);
  if(!bookings.length){
    el.append(emptyState({icon:'🗓️', title:t('noMatchBookings'), sub:t('noMatchBookingsSub'),
      actionLabel:t('clearFilter'), action:()=>Actions.clearFilters(),
      secondaryLabel:State.showAllOwner?null:t('fullHistory'), secondaryAction:()=>{ State.showAllOwner=true; renderOwnerBookings(); }}));
    return;
  }
  const {active,finished}=splitFinished(bookings);
  const grouped=(list)=>{
    const g={}; list.forEach(b=>{(g[String(b.date)] ||= []).push(b);});
    const td=today(), tm=dateAfter(1);
    Object.keys(g).sort().forEach(date=>{
      const dayB=g[date].sort((a,b)=>Number(a.hour)-Number(b.hour));
      const c=dayB.filter(b=>normStatus(b)==='confirmed').length, p=dayB.filter(b=>normStatus(b)==='pending').length, x=dayB.filter(b=>['cancelled','rejected'].includes(normStatus(b))).length;
      const isToday=date===td, isPast=date<td;
      const lbl = date===td?`${t('today')} — ${arabicDay(date)} ${shortDate(date)}` : date===tm?`${t('tomorrow')} — ${arabicDay(date)} ${shortDate(date)}` : `${arabicDay(date)} ${shortDate(date)}`;
      const pills=h('div',{class:'pills'});
      if(c)pills.append(h('span',{},`✓ ${c}`)); if(p)pills.append(h('span',{},`⏳ ${p}`)); if(x)pills.append(h('span',{},`✕ ${x}`));
      const wrap=h('div',{style:{marginBottom:'22px'}},
        h('div',{class:'day-group '+(isToday?'today':isPast?'past':'future')}, h('span',{}, lbl), pills));
      dayB.forEach(b=>wrap.append(ownerBookingCard(b)));
      el.append(wrap);
    });
  };
  if (active.length){ el.append(sectionTitle(t('ownerActiveUpcoming'),active.length)); grouped(active); }
  else el.append(h('div',{class:'card',style:{textAlign:'center',color:'var(--soft)',marginBottom:'11px'}},t('noActiveUpcoming')));
  if (finished.length){ el.append(sectionTitle(t('ownerFinished'),finished.length)); grouped(finished); }
}
function renderOwnerFields(){
  const el=$('#ownerFields'); const fields=State.ownerData.fields||[]; clear(el);
  if(!fields.length){ el.append(emptyState({icon:'🥅',title:t('noFieldsTitle'),sub:t('noFieldsSub'),actionLabel:t('addFieldBtn'),action:openAddField})); return; }
  fields.forEach(f=>{
    const isOn = f.active!==false;
    const edit=h('button',{class:'owner-action owner-edit'}, t('edit')); edit.addEventListener('click',()=>openEditField(f.field_id));
    // مبدّل تشغيل/إيقاف الملعب (مرجع لوحة المالك) — يستدعي ownerUpdateField الموجود
    const sw=h('button',{class:'field-switch'+(isOn?' on':''), type:'button', role:'switch', 'aria-checked':isOn?'true':'false', 'aria-label':t(isOn?'fieldActive':'fieldInactive')}, h('span',{class:'field-switch-knob'}));
    sw.addEventListener('click',()=>toggleFieldActive(f, sw));
    // مصغّرة صورة الملعب (م4، نمط المرجع «إدارة الملاعب») — وإن غابت الصورة فأيقونة كرة
    const thumbSrc=fieldImages(f)[0];
    const thumb=h('div',{class:'field-thumb'}, thumbSrc
      ? h('img',{src:thumbSrc, alt:'', width:'104', height:'104', loading:'lazy', decoding:'async'})
      : h('span',{html:ICON.ball, 'aria-hidden':'true'}));
    el.append(h('div',{class:'card field-card'+(isOn?'':' field-off'), style:{marginBottom:'14px'}},
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}},
        h('div',{class:'field-row-main'},
        thumb,
        h('div',{style:{minWidth:'0'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}},
            h('div',{style:{fontSize:'14px',fontWeight:'900',color:'var(--ink)'}}, f.field_name),
            !isOn && h('span',{class:'field-off-badge'}, t('fieldInactive'))),
          h('div',{style:{display:'flex',gap:'10px',marginTop:'5px'}},
            h('span',{class:'info-line muted'}, ico('resize','svg-sm'), ' '+f.size),
            h('span',{class:'info-line muted'}, ico('money','svg-sm'), ' '+formatCurrency(f.price))),
          h('div',{style:{fontSize:'11px',color:'var(--soft)',marginTop:'3px'}}, t('slotsLbl')+': '+t({full:'kwFull',morning:'kwMorning',evening:'kwEvening'}[slotsToKeyword(f.slots)]||'kwFull')))),
        h('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:'0'}}, sw, edit))));
  });
}
/* تبديل تشغيل/إيقاف ملعب مباشرة (بلا فتح نافذة) عبر ownerUpdateField القائم */
function toggleFieldActive(f, sw){
  const next=!(f.active!==false);
  sw.disabled=true;
  API.post({ action:'ownerUpdateField', owner_token:Session.owner(), field_id:f.field_id, price:f.price, slots:slotsToKeyword(f.slots), active:next })
    .then(res=>{
      if(res && res.success){
        f.active=next; try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){}
        toast(t(next?'fieldEnabled':'fieldDisabled'),'success');
        renderOwnerFields(); loadData({force:true});
      } else { toast(apiMsg(res&&res.message)||t('fieldFail'),'error'); sw.disabled=false; }
    })
    .catch(err=>{ if(!isAbort(err)) toast(t('fieldErr'),'error'); sw.disabled=false; });
}

/* ===================== OWNER · AI (مستشار الأعمال · التقييمات · الطقس) =====================
   ثلاث لوحات تُجلب من الباكند (aiInsights/aiReviews/aiWeather) بكاش خادمي 3-6 ساعات.
   هنا: كاش جلسة حسب اللغة + هيكل تحميل + عزل كامل للأخطاء (فشل AI لا يمسّ بقية اللوحة). */
const AI_TYPE_ICON = { pricing:'💰', marketing:'📣', schedule:'🗓️', warning:'⚠️', opportunity:'✨' };
const WEATHER_EMOJI = { sunny:'☀️', cloudy:'⛅', fog:'🌫️', rain:'🌧️', snow:'❄️', storm:'⛈️' };
function aiState(){ return (State.ai ||= {}); }
function aiSkeleton(n=3){
  const box=h('div',{class:'ai-skel','aria-hidden':'true'}); const w=['w88','w70','w45'];
  for(let i=0;i<n;i++) box.append(h('div',{class:'sk sk-line '+w[i%3]}));
  return box;
}
/* رسالة فشل موحّدة + زر إعادة محاولة (لا زر عند غياب مفتاح الـAPI — الحل عند المالك لا هنا) */
function aiErrorBox(res, retry){
  const code=res&&res.code;
  const msg = code==='ai_not_configured' ? t('aiNotConfigured')
            : code==='weather_failed' ? t('aiWeatherFail')
            : code==='timeout' ? t('apiTimeout') : t('aiFail');
  const box=h('div',{class:'ai-alert'+(code==='ai_not_configured'?' info':'')}, msg);
  if(retry && code!=='ai_not_configured'){
    const l=h('span',{class:'link',role:'button',tabindex:'0'}, t('aiRetry'));
    l.addEventListener('click',retry);
    l.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); retry(); } });
    box.append(l);
  }
  return box;
}
/* جالب موحّد للوحات الثلاث: يتخطّى الجلب إن كانت النتيجة محفوظة بنفس اللغة */
async function loadAi(kind, targetSel, render, force){
  const el=$(targetSel); if(!el || !Session.owner()) return;
  const ai=aiState(), lang=(State.lang==='en'?'en':'ar');
  if(ai[kind] && ai[kind+'Lang']===lang && !force){ render(); return; }
  if(ai[kind+'Loading']) return;
  ai[kind+'Loading']=true;
  clear(el); el.append(kind==='weather' ? h('div',{class:'ai-weather'}, aiSkeleton()) : aiSkeleton());
  try{
    const action = kind==='insights'?'aiInsights' : kind==='reviews'?'aiReviews' : 'aiWeather';
    const res = await API.getAi(action, { owner_token:Session.owner(), lang, force:force?'1':'0' }, 'ai_'+kind);
    ai[kind]=res; ai[kind+'Lang']=lang;
    if(res && !res.success) console.warn('AI ['+kind+'] failed — code:', res.code||'(none)', res.detail?('· detail: '+res.detail):'');
  }catch(e){
    if(isAbort(e)){ ai[kind+'Loading']=false; return; }
    ai[kind]={ success:false, code:isTimeout(e)?'timeout':'network' }; ai[kind+'Lang']=lang;
  }
  ai[kind+'Loading']=false;
  try{ render(); }catch(err){ console.error('ai render ['+kind+'] failed:', err); }
}
const loadAiInsights=(force)=>loadAi('insights','#aiInsights',renderAiInsights,force);
const loadAiReviews=(force)=>loadAi('reviews','#aiReviews',renderAiReviews,force);
const loadAiWeather=(force)=>loadAi('weather','#aiWeatherWrap',renderAiWeather,force);
/* سطر «آخر تحديث» أسفل كل لوحة */
function aiMetaLine(res){
  let s='';
  try{ if(res && res.generated_at) s=t('aiUpdatedAt',{time:new Date(res.generated_at).toLocaleString(State.lang==='en'?'en-GB':'ar',{dateStyle:'short',timeStyle:'short'})}); }catch(_){}
  return s ? h('div',{class:'ai-meta'}, s) : null;
}
function renderAiInsights(){
  const el=$('#aiInsights'); if(!el) return; clear(el);
  const res=aiState().insights; if(!res) return;
  if(!res.success){ el.append(aiErrorBox(res, ()=>loadAiInsights(true))); return; }
  const list=res.insights||[];
  if(!list.length){ el.append(h('div',{class:'ai-alert info'}, t('aiNoInsights'))); return; }
  list.forEach(it=>{
    el.append(h('div',{class:'ai-insight t-'+String(it.type||'opportunity')},
      h('span',{class:'ai-i-ico','aria-hidden':'true'}, AI_TYPE_ICON[it.type]||'🤖'),
      h('div',{},
        h('div',{class:'ai-i-title'}, String(it.title||'')),
        h('div',{class:'ai-i-text'}, String(it.advice||'')))));
  });
  el.append(aiMetaLine(res)||'');
}
function renderAiReviews(){
  const el=$('#aiReviews'); if(!el) return; clear(el);
  const res=aiState().reviews; if(!res) return;
  if(res.empty){ el.append(h('div',{class:'ai-alert info'}, t('aiNoReviews'))); return; }
  if(!res.success){ el.append(aiErrorBox(res, ()=>loadAiReviews(true))); return; }
  const sent=['positive','mixed','negative'].includes(res.sentiment)?res.sentiment:'mixed';
  el.append(h('div',{class:'ai-sentiment '+sent},
    h('span',{}, t('aiSentiment_'+sent)),
    h('span',{'aria-hidden':'true'}, '·'),
    h('span',{}, t('aiReviewsCount',{n:res.total||0, avg:res.avg_rating!=null?String(res.avg_rating):'-'}))));
  if(res.summary) el.append(h('div',{class:'ai-summary'}, String(res.summary)));
  const chips=(arr,cls,lbl)=>{
    if(!Array.isArray(arr)||!arr.length) return;
    el.append(h('div',{class:'ai-chip-lbl'}, lbl));
    const c=h('div',{class:'ai-chips'}); arr.forEach(x=>c.append(h('span',{class:'ai-chip '+cls}, String(x)))); el.append(c);
  };
  chips(res.praises,'good',t('aiPraises'));
  chips(res.complaints,'bad',t('aiComplaints'));
  if(res.alert) el.append(h('div',{class:'ai-alert danger'}, '⚠️ '+String(res.alert)));
  el.append(aiMetaLine(res)||'');
}
function renderAiWeather(){
  const el=$('#aiWeatherWrap'); if(!el) return; clear(el);
  const res=aiState().weather; if(!res) return;
  if(!res.success){ el.append(h('div',{class:'ai-weather'}, aiErrorBox(res, ()=>loadAiWeather(true)))); return; }
  const sev=['warn','danger'].includes(res.severity)?res.severity:'';
  const banner=h('div',{class:('ai-weather '+sev).trim()});
  banner.append(h('div',{class:'ai-w-head'},
    h('span',{class:'ai-w-title'},
      h('span',{class:'ai-w-emoji','aria-hidden':'true'}, sev==='danger'?'🌧️':sev==='warn'?'🌦️':'☀️'),
      h('span',{}, t('aiWeatherTitle'))),
    h('span',{class:'mini-badge ai-badge'}, res.ai===false?t('aiAutoAdvice'):t('aiBadge'))));
  const daysBox=h('div',{class:'ai-w-days'});
  const fmt=new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'});
  (res.days||[]).forEach(d=>{
    let wd=''; try{ wd=fmt.format(new Date(d.date+'T12:00:00')); }catch(_){}
    daysBox.append(h('div',{class:'ai-w-day'},
      h('div',{class:'ai-w-ico','aria-hidden':'true'}, WEATHER_EMOJI[d.category]||'⛅'),
      h('div',{class:'ai-w-t'}, wd+' · '+(d.tmax!=null?d.tmax+'°':'-')),
      h('div',{class:'ai-w-sub'}, t('aiRainShort',{n:d.rain_prob||0}))));
  });
  banner.append(daysBox);
  const adv=h('div',{class:'ai-w-advice'});
  if(res.title) adv.append(h('strong',{}, String(res.title)+' — '));
  adv.append(String(res.advice||''));
  banner.append(adv);
  el.append(banner);
}

/* ===================== ACTIONS (controllers) ===================== */
async function updateBookingStatus(btn, rowNumber, status){
  const booking=(State.ownerData?.bookings||[]).find(b=>Number(b.row_number)===Number(rowNumber));
  let reason='';
  if (status==='confirmed'){
    const info = booking ? `${booking.name||''} — ${booking.field_name||''}\n${booking.date||''}  ${booking.time||''}` : '';
    const ok = await askConfirm(t('confirmBookingTitle'), t('confirmBookingMsg')+'\n\n'+info, t('actConfirm'));
    if(!ok) return;
  }
  if (status==='cancelled'||status==='rejected'){
    const r=await askReason(status==='cancelled'?t('cancelReasonTitle'):t('rejectReasonTitle'), t('reasonHint'), t('confirmWord'), true);
    if (r===null) return; reason=r;
  }
  // فتح تبويب واتساب الآن (ضمن إيماءة المستخدم ⇒ لا يحظره المتصفح) وتوجيهه بعد نجاح التحديث
  const waWin = (booking && normalizePhone(booking.phone)) ? window.open('about:blank','_blank') : null;
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'updateBookingStatus', owner_token:Session.owner(), row_number:rowNumber, status, cancel_reason:reason });
      if (!res.success){ try{ waWin&&waWin.close(); }catch(_){} toast(apiMsg(res.message)||t('updateFail'),'error'); return; }
      if (booking) sendWhatsApp(booking, status, reason, waWin);
      await loadOwnerDashboard(); await loadData();
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ try{ waWin&&waWin.close(); }catch(_){} toast(t('updateErr'),'error'); }
  });
}
function sendWhatsApp(b, status, reason='', win=null){
  const phone=normalizePhone(b.phone);
  if(!phone){ try{ win&&win.close(); }catch(_){} return; }
  const base={ name:b.name||'', place:b.place_name, field:b.field_name, date:b.date, time:b.time, size:b.players, price:formatCurrency(b.price) };
  let msg='';
  if(status==='confirmed') msg = t('waConfirmed', base);
  else if(status==='rejected') msg = t('waRejected', {...base, reason: reason || t('waRejectedDefault')});
  else if(status==='cancelled') msg = t('waCancelled', {...base, reason: reason || t('waCancelledDefault')});
  if(!msg){ try{ win&&win.close(); }catch(_){} return; }
  const url=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  // التبويب المفتوح مسبقاً ضمن الإيماءة أضمن؛ وإلا المحاولة القديمة (تعمل ضمن مهلة سماح المتصفح)
  if(win && !win.closed){ try{ win.location.href=url; return; }catch(_){} }
  setTimeout(()=>window.open(url,'_blank'),500);
}

/* ---- Reason modal as a Promise ---- */
function askReason(title, hint, confirmLabel, required=false){
  return new Promise(resolve=>{
    const input=$('#reasonInput'), ok=$('#reasonConfirm'), no=$('#reasonCancel');
    setText('reasonTitle',title); setText('reasonHint',hint); input.value=''; ok.textContent=confirmLabel||t('confirmWord'); clearFieldError('reasonInput');
    Modal.open('modal-reason'); setTimeout(()=>input.focus(),200);
    const done=(val)=>{ Modal.close('modal-reason'); ok.onclick=null; no.onclick=null; clearFieldError('reasonInput'); resolve(val); };
    ok.onclick=()=>{ const v=input.value.trim(); if(required && !v){ setFieldError('reasonInput',t('reasonRequired')); input.focus(); return; } done(v); };
    no.onclick=()=>done(null);
  });
}
/* تأكيد إجراء (Promise<boolean>).
   `cancelLabel` أُضيف لأن زرّ الرجوع كان نصًّا عربيًّا ثابتًا في HTML بلا `data-i18n`
   ⇒ يبقى «رجوع» في الواجهة الإنجليزية. و`danger` يصبغ زرّ التأكيد أحمر للإجراءات
   التي لا رجعة فيها (حذف الحساب · تجاهل التعديلات). */
function askConfirm(title, message, confirmLabel, cancelLabel, danger){
  return new Promise(resolve=>{
    setText('confirmTitle',title); setText('confirmMessage',message);
    const ok=$('#confirmOk'), no=$('#confirmCancel');
    ok.textContent=confirmLabel||t('confirmWord');
    no.textContent=cancelLabel||t('backWord');
    ok.classList.toggle('danger-solid-btn', !!danger);
    Modal.open('modal-confirm');
    const done=(v)=>{ Modal.close('modal-confirm', true); ok.onclick=null; no.onclick=null; resolve(v); };
    ok.onclick=()=>done(true); no.onclick=()=>done(false);
  });
}

/* ---- Manual booking ---- */
function manualField(){ return (State.ownerData?.fields||[]).find(f=>String(f.field_id)===String(State.manual.fieldId)); }
async function openManual(){
  if (!Session.owner()){ showPage('ownerLogin'); return; }
  if (!State.ownerData) await loadOwnerDashboard();
  const fields=State.ownerData?.fields||[]; if(!fields.length){ toast(t('noFieldsAdded'),'warn'); return; }
  try{ await loadPublicBookings(); }catch(_){}
  State.manual={ fieldId:String(fields[0].field_id), date:today(), hour:null };
  $('#mName').value=''; $('#mPhone').value=''; $('#mPrice').value=fields[0].price||'';
  // خيار التكرار الأسبوعي (تعبئة بترجمة حيّة)
  const rep=$('#mRepeat'); if(rep){ clear(rep); rep.append(h('option',{value:'1'}, t('repeatNone'))); [2,3,4,5,6,8].forEach(n=> rep.append(h('option',{value:String(n)}, t('repeatFor',{n})))); rep.value='1'; }
  const sel=$('#mField'); clear(sel); fields.forEach(f=> sel.append(h('option',{value:f.field_id}, `${f.field_name} — ${f.size} — ${formatCurrency(f.price)}`))); sel.value=State.manual.fieldId;
  sel.onchange=()=>{ State.manual.fieldId=sel.value; State.manual.hour=null; const f=manualField(); if(f)$('#mPrice').value=f.price||''; renderManualTimes(); };
  renderManualDays(); renderManualTimes(); Modal.open('modal-manual');
}
function renderManualDays(){
  const el=$('#mDays'); clear(el);
  for(let i=0;i<14;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.manual.date, async()=>{ State.manual.date=d; State.manual.hour=null; renderManualDays(); timeSkeleton($('#mTimes'),6); try{await ensurePublicBookings();}catch(_){} renderManualDays(); renderManualTimes(); }));
  }
}
function renderManualTimes(){
  const el=$('#mTimes'); const f=manualField(); if(!f||!el) return; clear(el);
  const taken=(State.bookedSlots[f.field_id]?.[State.manual.date])||[];
  fieldSlots(f).forEach(s=> el.append(timeButton(s, taken.includes(s.hour), State.manual.hour===s.hour, ()=>{ State.manual.hour=s.hour; renderManualTimes(); })));
}

/* ---- Fields modal ---- */
function openEditField(fieldId){
  State.editingField='edit';
  const f=(State.ownerData.fields||[]).find(x=>String(x.field_id)===String(fieldId)); if(!f)return;
  setText('fieldTitle',t('editFieldTitle'));
  $('#fieldId').value=f.field_id; $('#fieldName').value=f.field_name; $('#fieldName').disabled=true;
  $('#fieldSize').value=f.size; $('#fieldSize').disabled=true; $('#fieldPrice').value=f.price;
  $('#fieldSlots').value=slotsToKeyword(f.slots); $('#fieldActive').checked=f.active!==false;
  Modal.open('modal-field');
}
function openAddField(){
  State.editingField='add';
  setText('fieldTitle',t('addFieldTitle'));
  $('#fieldId').value=''; $('#fieldName').value=''; $('#fieldName').disabled=false;
  $('#fieldSize').value='6×6'; $('#fieldSize').disabled=false; $('#fieldPrice').value='40';
  $('#fieldSlots').value='full'; $('#fieldActive').checked=true;
  Modal.open('modal-field');
}

/* ---- Review ---- */
function openReview(){
  const p=State.detail.place; if(!p)return;
  State.review={ rating:0, placeId:String(p.place_id) }; setRating(0);
  setText('rvPlace',p.place_name); $('#rvName').value=State.player?.name||''; $('#rvPhone').value=State.player?.phone||'';
  Modal.open('modal-review');
}
function setRating(r){
  State.review.rating=r;
  $$('#starsBox .star').forEach((s,i)=>s.classList.toggle('active', i<r));
  const radios=$$('#starsBox .star-input');
  radios.forEach(i=>{ i.checked = (Number(i.value)===r); });
}

/* ===================== ROUTER ===================== */
const NAV_OF = { home:'player', bookings:'player', account:'player', owner:'owner' };
/* مكدّس تنقّل داخلي: «رجوع» حقيقي داخل التطبيق دون مغادرة الموقع وبلا window.history */
const NavStack = [];
const activePageName = () => { const p=$('.page.active'); return p ? p.id.replace('page-','') : null; };
/* التمرير قد يقع على #app (حاوية overflow) أو على النافذة حسب البيئة — نقرأ ونكتب كليهما */
function pageScrollGet(){ const a=$('#app'); return Math.max(a?a.scrollTop:0, window.scrollY||0); }
function pageScrollSet(y){ const a=$('#app'); if(a) a.scrollTop=y; window.scrollTo({top:y,behavior:'instant'}); }
const navigateTo = (name)=>showPage(name);
function navigateBack(fallback){
  const cur=activePageName();
  let prev=NavStack.pop();
  while(prev && prev===cur) prev=NavStack.pop();     // منع الحلقات: لا رجوع إلى الصفحة نفسها
  showPage(prev || fallback || 'home', {back:true});
}
function showPage(name, opts){
  opts=opts||{};
  const cur=activePageName();
  if(cur) State.pageScroll[cur]=pageScrollGet();     // حفظ موضع الصفحة المغادَرة
  // دفع الصفحة الحالية للمكدّس — إلا عند الرجوع، والتحويل الداخلي، وإعادة عرض الصفحة نفسها (لا تكرار)
  if(cur && cur!==name && !opts.back && !opts.redirect){
    if(NavStack[NavStack.length-1]!==cur) NavStack.push(cur);
    if(NavStack.length>30) NavStack.shift();
  }
  const ds=$('#detailSticky'); if(ds && name!=='detail') ds.hidden=true;   // إخفاء الملخّص اللاصق خارج التفاصيل
  $$('.page').forEach(p=>{ p.classList.remove('active','pg-fwd','pg-back','pg-fade','pg-drag','pg-settle'); p.style.transform=''; });
  const page=$('#page-'+name); if(page) page.classList.add('active');
  /* اتجاه الانتقال (تطبيق): «رجوع» ينزلق من الحافة الابتدائية، و«تقدّم» من النهائية،
     أما التنقّل بين تبويبات الشريط السفلي فتلاشٍ قصير (كالتطبيقات الأصلية — لا انزلاق بين التبويبات). */
  if(page && cur && cur!==name){
    const tabToTab = !!NAV_OF[cur] && !!NAV_OF[name] && NAV_OF[cur]===NAV_OF[name];
    const mode = opts.back ? 'pg-back' : tabToTab ? 'pg-fade' : 'pg-fwd';
    void page.offsetWidth;                 // إعادة تشغيل مضمونة للأنيميشن بعد إزالة الأصناف
    page.classList.add(mode);
  }
  // أشرطة التنقّل
  const nav=NAV_OF[name];
  $('#nav-player').classList.toggle('show', nav==='player');
  $('#nav-owner').classList.toggle('show', nav==='owner');
  $$('#nav-player .nitem').forEach(n=>{ const on=n.dataset.nav===name; n.classList.toggle('active', on); n.setAttribute('aria-current', on?'page':'false'); });
  // خطافات الصفحات — التحويلات الداخلية {redirect:true} كي لا تدخل المكدّس فتصنع حلقة
  if (name==='home') renderPlaces();
  if (name==='bookings'){ if(!Session.player()&&State.guest){ toast(t('loginToSeeBookings'),'warn'); return showPage('playerLogin',{redirect:true}); } loadPlayerBookings(); }
  if (name==='account'){ if(!Session.player()){ return showPage('playerLogin',{redirect:true}); }
    const nm=State.player?.name||'', ph=State.player?.phone||'';
    $('#accName').value=nm; $('#accPhone').value=ph;
    setText('accNameDisplay', nm||t('welcomeYou')); setText('accPhoneDisplay', ph||'—');
    const av=$('#accAvatar'); if(av) av.textContent=(nm.trim().charAt(0))||t('avatarFallback');
  }
  if (name==='owner'){ if(!Session.owner()){ return showPage('ownerLogin',{redirect:true}); } if(State.ownerData) renderOwnerDashboard(); }
  manageAutoRefresh();
  HeroPh.sync();   // يوقف دوران النائب خارج صفحة الهبوط ويستأنفه عند العودة إليها
  // الرئيسية تستعيد موضعها دائمًا؛ الرجوع يستعيد موضع الصفحة السابقة؛ التقدّم يبدأ من الأعلى
  const y = name==='home' ? (State.pageScroll.home||0) : (opts.back ? (State.pageScroll[name]||0) : 0);
  requestAnimationFrame(()=>pageScrollSet(y));
  // إشعار طبقة native (شريط الحالة يتلوّن حسب الصفحة) — خامل تمامًا على المتصفح
  try{ document.dispatchEvent(new CustomEvent('app:page',{detail:name})); }catch(_){}
}

/* جسر التطبيق (Capacitor): خامل تمامًا على المتصفح — يُنشأ فقط داخل التطبيق المُغلَّف.
   يتيح لطبقة native.js تشغيل «الرجوع» الداخلي دون كسر تغليف الوحدة (IIFE). */
try{
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()){
    window.__native = { back: navigateBack, page: activePageName };
  }
}catch(_){}

/* اهتزاز خفيف (نبضة لمس) — يعمل داخل WebView أندرويد، ويُتجاهل بهدوء حيث لا يتوفّر */
// تغذية لمسية: تفضّل محرّك التغذية اللمسية الأصلي (@capacitor/haptics عبر جسر
// `window.__haptic` في native.js) وترجع إلى محرّك الاهتزاز الخام في المتصفّح.
// نقاط النداء لم تتغيّر — نفس `buzz(ms)` في كل مكان.
function buzz(ms){
  try{ if(typeof window.__haptic === 'function'){ window.__haptic(ms); return; } }catch(_){}
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(_){}
}

/* ══════════════════════════════════════════════════════════════════════
   الأنيميشن الترحيبي (INTRO) — يظهر من أول فريم (موجود في HTML فلا وميض)،
   والـCSS يديره كاملًا؛ مهمّة الـJS هنا **إزالته من DOM** بعد انتهائه كي لا
   يبقى حاجزًا فوق الواجهة ولا طبقة GPU. مرّة واحدة لكل إقلاع (لا تنقّل).
   ══════════════════════════════════════════════════════════════════════ */
(function intro(){
  const el=document.getElementById('intro'); if(!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = reduce ? 500 : 1800;          // = آخر تأخير + مدّة introOut في CSS (1240+520)
  setTimeout(()=>{ el.classList.add('gone'); el.remove(); }, total);
})();

/* ══════════════════════════════════════════════════════════════════════
   إيماءة الرجوع من الحافة (تطبيق) — سحب من الحافة الابتدائية ⇒ navigateBack
   • الحافة الابتدائية = اليمين بالعربي · اليسار بالإنجليزي (تتبع dir).
   • الصفحة تتبع الإصبع فريمًا بفريم (transform فقط)، وتُحسم بالمسافة أو السرعة.
   • تُلغى الإيماءة إن بدأت داخل عنصر يتمرّر أفقيًا (أيام/أوقات/شرائح) كي لا نسرق تمريره.
   ══════════════════════════════════════════════════════════════════════ */
(function edgeBackGesture(){
  const EDGE=32;            // عرض منطقة البدء من الحافة (px)
  const LOCK=10;            // إزاحة تحسم أن الإيماءة أفقية
  const TRIG=0.32;          // نسبة العرض التي تُنجز الرجوع
  const VEL=0.5;            // px/ms — سرعة تُنجز الرجوع مهما كانت المسافة
  let sx=0, sy=0, t0=0, dx=0, tracking=false, locked=false, page=null, W=1, rtl=false;

  const backable=()=>{ const p=activePageName(); return !!p && p!=='home' && p!=='welcome'; };
  /* هل نقطة اللمس داخل عنصر يتمرّر أفقيًا؟ (rails الأيام/الأوقات/الرياضات/التقييمات) */
  function inHScroller(el){
    for(let n=el; n && n!==document.body; n=n.parentElement){
      if(n.scrollWidth > n.clientWidth+4){
        const ox=getComputedStyle(n).overflowX;
        if(ox==='auto'||ox==='scroll') return true;
      }
    }
    return false;
  }
  function detach(){ document.removeEventListener('touchmove', onMove, {passive:false}); }
  function reset(){
    if(page){ page.classList.remove('pg-drag','pg-settle'); page.style.transform=''; }
    document.body.classList.remove('dragging-back');
    page=null; tracking=false; locked=false; dx=0; detach();
  }
  /* ⚠️ مستمع غير سلبي (passive:false) يُلزم المتصفّح بانتظار الـJS في كل touchmove، فيقطّع
     التمرير على الأجهزة المتوسطة. لذا يُركَّب فقط عند بدء لمسة مؤهّلة من الحافة، ويُفكّ بعدها. */
  function onMove(e){
    if(!tracking || !page){ detach(); return; }
    const T=e.touches[0];
    const ax = rtl ? (sx-T.clientX) : (T.clientX-sx);   // موجب = سحب نحو الحافة النهائية
    const ay = T.clientY-sy;
    if(!locked){
      if(Math.abs(ay) > Math.abs(ax) && Math.abs(ay) > LOCK){ tracking=false; detach(); return; }  // تمرير عمودي ⇒ اتركه
      if(ax < LOCK) return;
      locked=true;
      page.classList.add('pg-drag');
      document.body.classList.add('dragging-back');
    }
    dx = Math.max(0, Math.min(ax, W));
    e.preventDefault();                                  // بعد الحسم فقط — لا نعطّل التمرير العمودي
    page.style.transform = 'translate3d('+(rtl?-dx:dx)+'px,0,0)';
  }
  document.addEventListener('touchstart', e=>{
    if(e.touches.length!==1 || document.body.classList.contains('modal-open') || !backable()) return;
    const T=e.touches[0];
    rtl = document.documentElement.dir==='rtl';
    W = window.innerWidth||1;
    const atEdge = rtl ? (T.clientX > W-EDGE) : (T.clientX < EDGE);
    if(!atEdge || inHScroller(e.target)) return;
    sx=T.clientX; sy=T.clientY; t0=Date.now(); dx=0; tracking=true; locked=false;
    page=$('.page.active');
    document.addEventListener('touchmove', onMove, {passive:false});
  }, {passive:true});

  const end=()=>{
    if(!tracking || !page){ reset(); return; }
    if(!locked){ reset(); return; }
    const v = dx/Math.max(1, Date.now()-t0);
    // المسافة تحسم، أو السرعة مع مسافة معقولة (12% على الأقل) — كي لا ترجع رفّة إصبع عابرة
    const done = dx > W*TRIG || (v > VEL && dx > W*0.12);
    const el=page;
    if(done){ buzz(8); reset(); navigateBack('home'); return; }
    el.classList.remove('pg-drag'); el.classList.add('pg-settle');
    el.style.transform='';
    const clean=()=>{ el.classList.remove('pg-settle'); el.removeEventListener('transitionend',clean); };
    el.addEventListener('transitionend', clean, {once:true});
    setTimeout(clean, 320);                              // شبكة أمان لو لم يصل transitionend
    document.body.classList.remove('dragging-back');
    page=null; tracking=false; locked=false; dx=0; detach();
  };
  document.addEventListener('touchend', end, {passive:true});
  document.addEventListener('touchcancel', ()=>{ if(page) reset(); else detach(); }, {passive:true});
})();

/* ══════════════════════════════════════════════════════════════════════
   (٤) انقطاع الاتصال — طبقة تحجب التفاعل وتقول ما حدث
   • `navigator.onLine === false` دليل قاطع على الانقطاع؛ و`true` **ليس** دليلًا
     على وجود إنترنت (شبكة بلا بوّابة تُعطيه). لذلك نُظهر الطبقة على `offline`
     وحدها، ولا ندّعي شيئًا عند `online` سوى أن الجهاز عاد متّصلًا.
   • زرّ خروج إجباري: لو أخطأ المتصفّح في التقدير لا يعلق المستخدم أمام حائط.
     والإخفاء يدويًّا لا يمنع ظهورها في الانقطاع التالي.
   ══════════════════════════════════════════════════════════════════════ */
const Offline = {
  el(){ return $('#offlineOverlay'); },
  show(){ const o=this.el(); if(!o||!o.hidden) return; o.hidden=false; requestAnimationFrame(()=>o.classList.add('show')); buzz(18); },
  hide(){ const o=this.el(); if(!o||o.hidden) return; o.classList.remove('show');
    const done=()=>{ if(!o.classList.contains('show')) o.hidden=true; };
    o.addEventListener('transitionend', done, {once:true}); setTimeout(done, 400); },   // شبكة أمان لو لم يصل transitionend
  init(){
    window.addEventListener('offline', ()=>this.show());
    window.addEventListener('online',  ()=>{ this.hide(); toast(t('onlineBack'),'success'); loadData().catch(()=>{}); });
    if(navigator.onLine === false) this.show();          // قد يقلع التطبيق وهو مقطوع أصلًا
  }
};

/* ══════════════════════════════════════════════════════════════════════
   (٦) السحب للتحديث — على الصفحات الثلاث القابلة للتحديث
   • المتمرِّر هو **المستند** لا `#app` (لا `overflow-y` عليه) ⇒ الشرط `scrollY<=0`.
   • المستمع غير السلبي يُركَّب عند لمسة مؤهّلة ويُفكّ فور انتهائها — نفس نمط
     إيماءة الرجوع، فلا يُقطَّع التمرير العادي على الأجهزة المتوسطة.
   • التخميد 0.5 يجعل السحب يُقاوم كالتطبيقات الأصلية، والمؤشّر ثابت خارج
     تدفّق الصفحة فلا يزحزح المحتوى، وحركته transform/opacity وحدهما.
   ══════════════════════════════════════════════════════════════════════ */
const PullRefresh = (()=>{
  const TRIG=72, MAX=110, DAMP=0.5;
  const JOBS = {
    home:     async()=>{ try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){} await loadData({force:true}); renderPlaces(); },
    bookings: async()=>{ await loadPlayerBookings(); },
    owner:    async()=>{ await loadOwnerDashboard(); },
  };
  let sy=0, pull=0, tracking=false, locked=false, busy=false;

  const box=()=>$('#ptr');
  function paint(state){
    const el=box(); if(!el) return;
    el.style.transform = `translate3d(-50%,${pull}px,0)`;
    el.style.opacity = String(Math.min(1, pull/44));
    el.classList.toggle('ready', pull>=TRIG && state!=='loading');
    el.classList.toggle('loading', state==='loading');
    const ring=$('#ptrRing'); if(ring && state!=='loading') ring.style.transform=`rotate(${pull*3}deg)`;
    setText('ptrTxt', state==='loading' ? t('ptrLoading') : (pull>=TRIG ? t('ptrRelease') : t('ptrPull')));
  }
  function reset(){
    pull=0; tracking=false; locked=false;
    const el=box(); if(el){ el.classList.add('snap'); el.classList.remove('ready','loading'); el.style.transform='translate3d(-50%,0,0)'; el.style.opacity='0';
      setTimeout(()=>el.classList.remove('snap'), 260); }
    detach();
  }
  const eligible=()=>{
    if(busy || document.body.classList.contains('modal-open')) return false;
    if(!$('#offlineOverlay')?.hidden) return false;
    const p=activePageName();
    return !!(p && JOBS[p]) && (window.scrollY||document.documentElement.scrollTop||0) <= 0;
  };
  function detach(){ document.removeEventListener('touchmove', onMove, {passive:false}); }
  function onMove(e){
    if(!tracking){ detach(); return; }
    const dy = e.touches[0].clientY - sy;
    if(!locked){
      if(dy < 8) { if(dy < -8){ tracking=false; detach(); } return; }   // تمرير لأعلى ⇒ اتركه
      if((window.scrollY||0) > 0){ tracking=false; detach(); return; }
      locked=true; const el=box(); if(el) el.classList.remove('snap');
    }
    pull = Math.min(MAX, dy*DAMP);
    e.preventDefault();                       // بعد الحسم فقط — يمنع أيضًا تحديث المتصفّح المدمج
    paint();
  }
  async function run(){
    const p=activePageName(); const job=JOBS[p]; if(!job){ reset(); return; }
    busy=true; pull=TRIG; paint('loading'); buzz(10);
    try{ await job(); }catch(_){ /* الوظائف تعالج أخطاءها وتُظهر رسالتها */ }
    finally{ busy=false; setText('ptrTxt', t('ptrDone')); setTimeout(reset, 320); }
  }
  const end=()=>{
    if(!tracking || !locked){ if(tracking) reset(); return; }
    if(pull >= TRIG) run(); else reset();
  };
  return { init(){
    document.addEventListener('touchstart', (e)=>{
      if(e.touches.length!==1 || !eligible()) return;
      sy=e.touches[0].clientY; pull=0; tracking=true; locked=false;
      document.addEventListener('touchmove', onMove, {passive:false});
    }, {passive:true});
    document.addEventListener('touchend', end, {passive:true});
    document.addEventListener('touchcancel', ()=>{ if(tracking) reset(); else detach(); }, {passive:true});
  }};
})();

/* ارتفاع كيبورد الهاتف: نرفع التوست فوقه ونُنزل الشريط السفلي تحته (بدل أن يطفو بمنتصف الشاشة) */
if(window.visualViewport){
  const vv=window.visualViewport;
  const syncKb=()=>{
    const kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const open=kb>80;
    document.documentElement.style.setProperty('--kb', (open?kb:0)+'px');
    document.documentElement.classList.toggle('kb-open', open);
  };
  vv.addEventListener('resize', syncKb);
  vv.addEventListener('scroll', syncKb);
}

/* تحديث تلقائي للأوقات على الصفحات الحيّة فقط (+ لوحة المالك بتحديث صامت) */
function autoRefreshActive(){ return $('#page-home')?.classList.contains('active') || $('#page-detail')?.classList.contains('active') || ($('#page-owner')?.classList.contains('active') && !!Session.owner()); }
async function refreshVisible(){
  if (document.hidden || !autoRefreshActive()) return;
  if (document.body.classList.contains('modal-open')) return;                              // مودال مفتوح — لا تُعد الرسم تحته
  if ($('#page-owner')?.classList.contains('active')){ await refreshOwnerSilent(); return; }
  const onDetail = $('#page-detail')?.classList.contains('active');
  if (onDetail && State.detail.hour != null) return;                                       // المستخدم اختار وقتاً — لا تقاطعه
  await loadData();
  if($('#page-home').classList.contains('active')) renderPlaces();
  if(onDetail && State.detail.field){ renderDetailDays(); renderDetailTimes(); }
}
/* بصمة الحجوزات: أي إضافة أو تغيير حالة يغيّرها ⇒ نعيد الرسم فقط عند تغيّر فعلي */
const bookingsSig = (bs)=> (bs||[]).map(b=>b.row_number+':'+normStatus(b)).join('|');
/* تحديث صامت للوحة المالك: بلا تغيير تبويب ولا تمرير ولا مقاطعة —
   يعيد رسم الأقسام عند تغيّر البيانات فقط + شارة/تنبيه عند وصول طلب معلّق جديد */
async function refreshOwnerSilent(){
  if(!Session.owner() || !State.ownerData) return;
  let res; try{ res = await API.get('getOwnerData', { owner_token:Session.owner() }, 'ownerPoll'); }catch(_){ return; }
  if(!res || !res.success) return;
  const oldB=State.ownerData.bookings||[], newB=res.bookings||[];
  if(bookingsSig(oldB)===bookingsSig(newB)){ State.ownerData=res; return; }
  const known=new Set(oldB.map(b=>Number(b.row_number)));
  const freshPending=newB.filter(b=>!known.has(Number(b.row_number)) && normStatus(b)==='pending').length;
  State.ownerData=res;
  safeRender('stats', ()=>renderOwnerStats(newB));
  safeRender('econ', ()=>renderOwnerEcon(newB));
  safeRender('bookings', renderOwnerBookings);
  safeRender('today', renderOwnerToday);
  if(freshPending>0){
    if(State.ownerTab!=='bookings'){ State.ownerNewCount=(State.ownerNewCount||0)+freshPending; updateOwnerTabBadge(); }
    toast(t('newPendingToast',{n:freshPending}),'success');
  }
}
/* شارة عدّاد الطلبات الجديدة على تبويب «الحجوزات» — تُصفَّر عند فتح التبويب */
function updateOwnerTabBadge(){
  const tab=$('#otab-bookings'); if(!tab) return;
  let bd=tab.querySelector('.tab-badge');
  const n=State.ownerNewCount||0;
  if(!n){ if(bd) bd.remove(); return; }
  if(!bd){ bd=h('span',{class:'tab-badge','aria-hidden':'true'}); tab.append(bd); }
  bd.textContent=String(Math.min(n,99));
}
function manageAutoRefresh(){ const run=autoRefreshActive()&&!document.hidden; if(run&&!State.refreshTimer)State.refreshTimer=setInterval(refreshVisible,CONFIG.AUTO_REFRESH_MS); if(!run&&State.refreshTimer){clearInterval(State.refreshTimer);State.refreshTimer=null;} }

/* ===================== AUTH ===================== */
async function browse(){
  State.guest=true; showPage('home'); placesSkeleton();
  await loadData(); renderPlaces();
}
async function playerLogin(btn){
  clearFieldError('playerPhone'); clearFieldError('playerPassword');
  const phone=$('#playerPhone').value.trim(), password=$('#playerPassword').value.trim();
  let bad=false;
  if(!validPhone(phone)){ setFieldError('playerPhone',t('vPhoneEmpty')); bad=true; }
  if(!password){ setFieldError('playerPassword',t('vPass')); bad=true; }
  if(bad){ focusFirstError($('#page-playerLogin')); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.get('playerLogin',{phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('loginFailRetry'),'error'); setFieldError('playerPassword', apiMsg(res.message)||t('loginBadData')); return; }
      const remember = !!$('#playerRemember')?.checked;
      Session.setOwner('') /* لا مالك */; Session.setPlayer(res.player_token, remember);
      State.player=res.player; State.guest=false;
      updatePlayerGreeting();
      if(!State.places.length){ placesSkeleton(); await loadData(); }
      if(await resumePendingBooking()) return;          // استئناف حجز الضيف إن وُجد
      showPage('home');
    }catch(_){ toast(t('connLag'),'error'); }
  });
}
async function playerRegister(btn){
  clearFieldError('regName'); clearFieldError('regPhone'); clearFieldError('regPass');
  const name=$('#regName').value.trim(), phone=$('#regPhone').value.trim(), password=$('#regPass').value.trim();
  let bad=false;
  if(!name){ setFieldError('regName',t('vName')); bad=true; }
  if(!validPhone(phone)){ setFieldError('regPhone',t('vPhone')); bad=true; }
  if(!password){ setFieldError('regPass',t('vPass')); bad=true; }
  if(bad){ focusFirstError($('#page-playerRegister')); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({action:'playerRegister',name,phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('regFailRetry'),'error'); setFieldError('regPhone', apiMsg(res.message)||t('regFail')); return; }
      Session.setPlayer(res.player_token, !!$('#regRemember')?.checked); State.player=res.player; State.guest=false;
      updatePlayerGreeting();
      if(!State.places.length){ placesSkeleton(); await loadData(); }
      if(await resumePendingBooking()) return;          // استئناف حجز الضيف إن وُجد
      showPage('home');
    }catch(_){ toast(t('connLag'),'error'); }
  });
}
async function ownerLogin(btn){
  const phone=$('#ownerPhone').value.trim(), password=$('#ownerPass').value.trim();
  if(!phone||!password){ toast(t('loginNeed'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.get('ownerLogin',{phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('loginFailRetry'),'error'); return; }
      Session.setOwner(res.owner_token, !!$('#ownerRemember')?.checked); State.player=null;
      showPage('owner'); await loadOwnerDashboard();
    }catch(_){ toast(t('connLag'),'error'); }
  });
}
/* ---- (٣) حذف الحساب ---- */
async function deleteAccount(btn){
  if(!Session.player()){ showPage('playerLogin'); return; }
  const ok = await askConfirm(t('delAccTitle'), t('delAccMsg'), t('delAccConfirm'), t('backWord'), true);
  if(!ok) return;
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'deleteAccount', player_token:Session.player() });
      if(!res.success){ toast(apiMsg(res.message)||t('delAccFail'),'error'); return; }
      doLogout();                                   // يمسح الجلسة ويعود لشاشة الترحيب
      toast(t('delAccOk'),'success', 5200);
    }catch(_){ toast(t('delAccErr'),'error'); }
  });
}
function doLogout(){
  Session.clear(); State.player=null; State.owner=null; State.ownerData=null; State.guest=false;
  $('#nav-player').classList.remove('show'); $('#nav-owner').classList.remove('show');
  showPage('welcome');
}
async function saveAccount(btn){
  if(!Session.player()){ showPage('playerLogin'); return; }
  const name=$('#accName').value.trim(); if(!name){ toast(t('vNameAcc'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({action:'updatePlayerProfile',player_token:Session.player(),name});
      if(!res.success){ toast(apiMsg(res.message)||t('saveErr'),'error'); return; }
      State.player=res.player; updatePlayerGreeting();
      showSimpleSuccess(t('accSaved'));
    }catch(_){ toast(t('saveErr'),'error'); }
  });
}

/* ---- تغيير كلمة السرّ (لاعب أو مالك — أيّهما جلسته مفتوحة) ---- */
async function changePassword(btn){
  const isOwner = !Session.player() && !!Session.owner();
  if(!Session.player() && !Session.owner()){ showPage('playerLogin'); return; }
  const cur=$('#pwCur'), nw=$('#pwNew'), nw2=$('#pwNew2');
  const c=cur.value, n=nw.value, n2=nw2.value;
  if(!c){ toast(t('pwNeedCur'),'warn'); cur.focus(); return; }
  if(n.length < 6){ toast(t('pwTooShort'),'warn'); nw.focus(); return; }
  if(n !== n2){ toast(t('pwMismatch'),'warn'); nw2.focus(); return; }
  if(n === c){ toast(t('pwSame'),'warn'); nw.focus(); return; }
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'changePassword',
        [isOwner?'owner_token':'player_token']: isOwner?Session.owner():Session.player(),
        current_password:c, new_password:n });
      if(!res.success){ toast(apiMsg(res.message)||t('pwFail'),'error'); return; }
      // الجلسة تجدّدت بكلمة السرّ الجديدة ⇒ تُخزَّن نصًّا (نفس شكل sbSession)،
      // فلا يجد المستخدم نفسه مخرَجًا بعد نجاح العملية
      if(res.session){
        const str = JSON.stringify(res.session);
        isOwner ? Session.setOwner(str, true) : Session.setPlayer(str, true);
      }
      cur.value=nw.value=nw2.value='';
      showSimpleSuccess(t('pwOk'));
    }catch(_){ toast(t('pwFail'),'error'); }
  });
}

/* ---- booking confirm (من نافذة المراجعة · المصدر = State.detail) ---- */
async function confirmBooking(btn){
  const { place, field, date, hour } = State.detail;
  if(!place || !field || !date || hour==null){ toast(t('completeSelection'),'warn'); Modal.close('modal-booking'); scrollToDetailSection('time'); return; }
  // ضيف؟ احفظ الاختيار وافتح خيار الدخول (تظهر المراجعة بعد الدخول)
  if(!Session.player()){ savePendingBooking(); openAuthChoice(); return; }
  const name=(State.player?.name||'').trim(), phone=(State.player?.phone||'').trim();
  // فحص محلي فوري بلا انتظار شبكة — الخادم هو الحكم النهائي (LockService) ويردّ برسالة تعارض إن حدث سباق
  const takenNow=(State.bookedSlots[field.field_id]?.[date])||[];
  if(takenNow.includes(Number(hour))){
    Modal.close('modal-booking'); State.detail.hour=null; renderDetailTimes(); renderDetailSticky();
    toast(t('bookingConflict'),'warn');
    scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)'); return;
  }
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'createBooking', player_token:Session.player(), date, place_id:place.place_id, place_name:place.place_name, field_id:field.field_id, field_name:field.field_name, city:place.city, time:slot.label, hour, name, phone, players:field.size, price:field.price, source:getSource() });
      if(!res.success){ toast(apiMsg(res.message)||t('bookingFailRetry'),'error'); await loadData(); return; }
      (State.bookedSlots[field.field_id] ||= {})[date] ||= []; State.bookedSlots[field.field_id][date].push(hour);
      Modal.close('modal-booking'); showBookingSuccess({place,field,date,hour}, res.booking_id);
      if($('#page-detail').classList.contains('active')){ State.detail.hour=null; renderDetailDays(); renderDetailTimes(); renderDetailSticky(); }
    }catch(_){ toast(t('bookingConnLag'),'error'); }
  });
}
async function submitReview(btn){
  if(!State.review.rating){ toast(t('reviewNeed'),'warn'); return; }
  const id=State.review.placeId;
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'createReview', place_id:id, field_id:State.detail.field?.field_id||'', user_name:$('#rvName').value.trim(), phone:$('#rvPhone').value.trim(), rating:State.review.rating, comment:$('#rvComment').value.trim() });
      if(!res.success){ toast(apiMsg(res.message)||t('reviewFail'),'error'); return; }
      Modal.close('modal-review', true); showSimpleSuccess(t('reviewOk'));
      await loadData({force:true});
      const updated=State.places.find(p=>String(p.place_id)===id); if(updated&&State.detail.place){ State.detail.place=updated; if($('#dBadges')&&$('#page-detail').classList.contains('active')){ renderDetailBadges(updated); renderPlaceStats(); } }
    }catch(_){ toast(t('reviewErr'),'error'); }
  });
}
async function saveManual(btn){
  const f=manualField(); const name=$('#mName').value.trim(), phone=$('#mPhone').value.trim(), price=Number($('#mPrice').value||0);
  if(!f||!State.manual.date||State.manual.hour===null){ toast(t('manualNeed'),'warn'); return; }
  if(!name){ toast(t('manualName'),'warn'); return; }
  if(!price||Number.isNaN(price)){ toast(t('manualPrice'),'warn'); return; }
  const slot=fieldSlots(f).find(s=>s.hour===State.manual.hour);
  const weeks=Math.max(1, Math.min(12, Number($('#mRepeat')?.value||1)||1));
  await withLoading(btn, async()=>{
    try{
      if(weeks===1){
        const res=await API.post({ action:'ownerCreateManualBooking', owner_token:Session.owner(), field_id:f.field_id, date:State.manual.date, hour:State.manual.hour, time:slot?slot.label:'', name, phone, players:f.size, price });
        if(!res.success){ toast(apiMsg(res.message)||t('manualFail'),'error'); await loadPublicBookings().catch(()=>{}); renderManualTimes(); return; }
        Modal.close('modal-manual', true); toast(t('manualOk'),'success');
        await loadOwnerDashboard(); await loadData({force:true});
        return;
      }
      // تكرار أسبوعي: تحقّق طازج مرة واحدة، ثم استدعاءات متتابعة بنفس الـAPI مع تخطّي الأوقات المحجوزة
      try{ await loadPublicBookings(); }catch(_){}
      let added=0, skipped=0;
      for(let w=0; w<weeks; w++){
        const d0=new Date(`${State.manual.date}T12:00:00`); d0.setDate(d0.getDate()+7*w); const dt=ymd(d0);
        const takenArr=(State.bookedSlots[f.field_id]?.[dt])||[];
        if(takenArr.includes(Number(State.manual.hour))){ skipped++; continue; }
        try{
          const res=await API.post({ action:'ownerCreateManualBooking', owner_token:Session.owner(), field_id:f.field_id, date:dt, hour:State.manual.hour, time:slot?slot.label:'', name, phone, players:f.size, price });
          if(res.success){ added++; ((State.bookedSlots[f.field_id] ||= {})[dt] ||= []).push(Number(State.manual.hour)); }
          else skipped++;
        }catch(_){ skipped++; }
      }
      Modal.close('modal-manual', true);
      toast(t('repeatSummary',{added, skipped}), added>0?'success':'error', 5200);
      await loadOwnerDashboard(); await loadData({force:true});
    }catch(_){ toast(t('manualErr'),'error'); }
  });
}
async function saveField(btn){
  const field_id=$('#fieldId').value, field_name=$('#fieldName').value.trim(), size=$('#fieldSize').value.trim();
  const price=Number($('#fieldPrice').value), slots=$('#fieldSlots').value, active=$('#fieldActive').checked;
  if(!field_name||!size||!price){ toast(t('fieldNeed'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const payload=State.editingField==='add'
        ? { action:'ownerAddField', owner_token:Session.owner(), field_name, size, price, slots }
        : { action:'ownerUpdateField', owner_token:Session.owner(), field_id, price, slots, active };
      const res=await API.post(payload);
      if(!res.success){ toast(apiMsg(res.message)||t('fieldFail'),'error'); return; }
      Modal.close('modal-field', true); try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){}
      await loadOwnerDashboard(); await loadData({force:true}); toast(t('fieldOk'),'success');
    }catch(_){ toast(t('fieldErr'),'error'); }
  });
}

/* ===================== THEME ===================== */
/* رسم أيقونة الثيم: **مسار واحد** يُبدَّل شكله — لا عنصران متراكبان.
   الشمس مرسومة كاملةً داخل نفس السمة `d` (قرص بقوسين + ثمانية أشعّة). */
const THEME_ICON = {
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  sun :'M12 7.9a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 1 0 0-8.2M12 2.6v2.1M12 19.3v2.1'
      +'M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5'
};
function applyTheme(theme){
  const dark = theme==='dark';
  document.body.classList.toggle('dark', dark);
  const d = dark ? THEME_ICON.sun : THEME_ICON.moon;
  $$('[data-action="toggleTheme"]').forEach(b=>{
    b.classList.toggle('is-dark', dark);
    const p = b.querySelector('.thm-ic-path');
    if(p && p.getAttribute('d') !== d){
      p.setAttribute('d', d);
      // إعادة تشغيل دوران الدخول (بلا الحذف+reflow لا تُعاد الحركة عند تبديلين متتاليين)
      b.classList.remove('thm-pop'); void b.offsetWidth; b.classList.add('thm-pop');
    }
  });
  const meta=$('meta[name="theme-color"]'); if(meta) meta.setAttribute('content', dark?'#081D22':'#FAFAF7');
}
/* ══════════════════════════════════════════════════════════════════════
   تبديل الثيم — كشف دائري من الزرّ المضغوط، بمسارين.

   ① **View Transitions** (الأساسي): المتصفّح يلتقط لقطتَي «قبل» و«بعد»، فنُبقي
      لقطة «قبل» ساكنة تحت ونقصّ لقطة «بعد» بدائرة تكبر من الإصبع. النتيجة أن
      **الواجهة الجديدة بمحتواها الحقيقي** هي ما ينتشر — فلا تُغطّى الشاشة بلون
      مصمت ولا تختفي المحتويات لحظةً. (هذا ما كان ينقص القرص المصمت.)
   ② **قرص مصمت احتياطي** لأي WebView بلا الـAPI — يغطّي لكنه لا يكسر شيئًا.

   ⚠️ لا يُستعمل المحدّد الشامل `*` لإيقاف الانتقالات هنا إطلاقًا: إبطال أنماط
   كل عقدة في الشجرة كان سبب التلعثم سابقًا. الإيقاف محصور بقائمة الوسوم
   الحاملة لانتقال الثيم، ولحظةَ التقاط اللقطة الجديدة فقط.
   ══════════════════════════════════════════════════════════════════════ */
const THEME_BG = { light:'#F4F5F6', dark:'#0A0E11' };   // = --bg-primary في كل ثيم (الجزء 1 من app.css)
let themeBusy = false;
function toggleTheme(btn, e){
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  const commit = ()=>{ Session.setTheme(next); applyTheme(next); };
  let reduce=false; try{ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){}
  const r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : null;
  // حارس: تقليل حركة · بلا زرّ صالح · بلا WAAPI · نقرة أثناء كشف جارٍ ⇒ تبديل فوري
  if(reduce || themeBusy || !r || !r.width || typeof Element.prototype.animate !== 'function'){ commit(); return; }
  const cx = r.left + r.width/2, cy = r.top + r.height/2;

  // ① الكشف الحقيقي للمحتوى
  if(typeof document.startViewTransition === 'function'){
    const root = document.documentElement;
    let vt = null;
    try{
      themeBusy = true;
      // مركز التفتّح = موضع الزرّ (نسبةً لا بكسلًا كي يصمد مع أي مقاس شاشة)
      root.style.setProperty('--vt-ox', (cx/innerWidth*100).toFixed(2)+'%');
      root.style.setProperty('--vt-oy', (cy/innerHeight*100).toFixed(2)+'%');
      root.classList.add('vt-theme');
      vt = document.startViewTransition(()=>{
        // تُلتقط لقطة «بعد» هنا: نوقف انتقالات اللون لحظتَها كي تُلتقط بألوانها
        // النهائية لا في منتصف تحوّل (الإيقاف محصور بقائمة الوسوم).
        root.classList.add('theme-swap');
        commit();
        void document.body.offsetWidth;
        root.classList.remove('theme-swap');
      });
    }catch(_){ root.classList.remove('vt-theme'); themeBusy = false; vt = null; }
    if(vt){
      const done = ()=>{ root.classList.remove('vt-theme'); themeBusy = false; };
      vt.ready.then(()=>{
        // تفتّح ناعم: اللقطة الجديدة تظهر وهي تستقرّ من تكبير طفيف عند الإصبع.
        // `opacity`+`transform` فقط ⇒ الحركة كلّها على الـGPU، صفر رسم في كل فريم.
        // منحنى بلا تسارع في البداية (ease-out خالص) فيُقرأ التبديل فوريًّا ثم يهدأ.
        root.animate({opacity:[0,1], transform:['scale(1.045)','scale(1)']},
          {duration:560, easing:'cubic-bezier(.22,.61,.36,1)',
           pseudoElement:'::view-transition-new(root)'});
      }).catch(()=>{});
      vt.finished.then(done, done);
      // شبكة أمان: لو لم تُحسم وعود الانتقال (بيئة تجمّد الأنيميشن مثلًا)
      // يُحرَّر القفل فلا تُبتلع ضغطة المستخدم التالية.
      setTimeout(done, 950);
      buzz(8);
      return;
    }
  }
  // ② الاحتياطي: قرص مصمت
  themeBusy = true;
  const x = r.left + r.width/2, y = r.top + r.height/2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const wrap = document.createElement('div'); wrap.className = 'theme-reveal';
  const disc = document.createElement('div'); disc.className = 'theme-reveal-disc';
  disc.style.width = disc.style.height = (2*R).toFixed(0)+'px';
  disc.style.left = (x-R).toFixed(1)+'px'; disc.style.top = (y-R).toFixed(1)+'px';
  disc.style.background = THEME_BG[next];
  wrap.appendChild(disc); document.body.appendChild(wrap);
  buzz(8);
  let done = false;
  const finish = ()=>{
    if(done) return; done = true;
    // التبديل والقرص يغطّي الشاشة: نوقف انتقالات اللون لحظةً كي تُكشف الواجهة
    // بثيمها النهائي لا في منتصف تحوّل (الإيقاف محصور بقائمة الوسوم لا بـ`*`).
    document.documentElement.classList.add('theme-swap');
    commit();
    void document.body.offsetWidth;                       // إلزام إعادة تدفّق قبل رفع الإيقاف
    document.documentElement.classList.remove('theme-swap');
    // كشف سريع: القرص بلون خلفية الثيم الجديد أصلًا، فما «يظهر» أثناء التلاشي هو
    // المحتوى فوق خلفية مطابقة — لا شاشة فارغة. 130ms تكفي لتُقرأ كظهور لا كوميض.
    const out = disc.animate([{opacity:1},{opacity:0}],
      {duration:200, easing:'cubic-bezier(.22,.61,.36,1)', fill:'forwards'});
    const drop = ()=>{ wrap.remove(); themeBusy = false; };
    out.onfinish = drop; setTimeout(drop, 380);            // شبكة أمان لو لم يُطلق الحدث
  };
  // منحنى ينهي التغطية بسرعة في آخره ⇒ زمن «الشاشة مغطّاة بالكامل» أقصر ما يمكن.
  // 380ms بدل 340: مع إيقاف انتقالات اللون صارت الواجهة تحته جاهزة فورًا،
  // فالزمن الإضافي يذهب كلّه إلى نعومة الحركة لا إلى انتظار تحوّل الألوان.
  const grow = disc.animate([{transform:'scale(0)'},{transform:'scale(1)'}],
    {duration:380, easing:'cubic-bezier(.32,0,.16,1)', fill:'forwards'});
  grow.onfinish = finish;
  setTimeout(finish, 520);                                 // شبكة أمان: لا يبقى قرص عالقًا أبدًا
}

/* ===================== I18N RUNTIME (تطبيق الترجمة + تبديل اللغة) ===================== */
function applyTranslations(root){
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el=>{ const v=t(el.getAttribute('data-i18n')); if(v!=null) el.textContent=v; });
  r.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  r.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  r.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  r.querySelectorAll('[data-i18n-alt]').forEach(el=>{ el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'))); });
  if(r===document) document.title = t('docTitle');   // عنوان المستند
}
/* مدقّق تكافؤ المفاتيح (وقت التطوير فقط) — يُحذّر بالكونسول دون تعطيل التطبيق */
function validateI18nParity(){
  try{
    const ar=Object.keys(I18N.ar||{}), en=Object.keys(I18N.en||{});
    const setAr=new Set(ar), setEn=new Set(en);
    const missingEn=ar.filter(k=>!setEn.has(k)), missingAr=en.filter(k=>!setAr.has(k));
    if(missingEn.length) console.warn('[i18n] keys missing in EN:', missingEn);
    if(missingAr.length) console.warn('[i18n] keys missing in AR:', missingAr);
  }catch(_){}
}
function setLanguage(lang){
  if(lang!=='ar' && lang!=='en') lang='ar';
  State.lang = lang;
  try{ localStorage.setItem('mustadaira_language', lang); }catch(_){}
  const html=document.documentElement; html.lang=lang; html.dir = lang==='ar'?'rtl':'ltr';
  applyTranslations(document);
  $$('[data-action="toggleLang"]').forEach(b=> b.textContent = t('langSwitch'));
  // أعد رسم المحتوى الديناميكي للصفحة النشطة دون فقد الحالة/الجلسة/الفلاتر
  try{
    renderSportTabs(); renderSportDropdown(); renderRegionTabs(); renderLandingRegions(); updateFilterBar(); updateTrust();
    HeroPh.sync();   // كلمات النائب المتحرّك تتبع اللغة — ويُلغى المؤقّت القديم فلا يتراكم
    // ترجمة سطر الترحيب حسب حالة الجلسة (ضيف/مسجّل) دون كسر التخصيص
    updatePlayerGreeting();
    if($('#page-home')?.classList.contains('active')) renderPlaces();
    if($('#page-detail')?.classList.contains('active') && State.detail.place){ renderDetailBadges(State.detail.place); renderAmenitiesFull(State.detail.place); renderSubFields(); renderDetailHero(); renderDetailDays(); renderDetailTimes(); renderDetailSticky(); if(State.detail.field) setText('dPrice', formatCurrency(State.detail.field.price)); }
    if($('#page-bookings')?.classList.contains('active')) loadPlayerBookings();
    if($('#page-owner')?.classList.contains('active') && State.ownerData) renderOwnerDashboard();
  }catch(_){}
}
function toggleLang(){ setLanguage(State.lang==='ar'?'en':'ar'); }

/* ===================== EVENT DELEGATION ===================== */
const Actions = {
  browse, playerLogin, playerRegister, ownerLogin, logout:doLogout, saveAccount, changePassword, toggleTheme, toggleLang,
  deleteAccount, dismissOffline:()=>Offline.hide(),
  search:()=>renderPlaces(), refreshPlaces:async()=>{ try{localStorage.removeItem(CONFIG.CACHE_KEY);}catch(_){} await loadData({force:true}); renderPlaces(); },
  openFilters, applyFilters, clearFiltersSheet,
  openBooking: openBookingReview,
  changeTime:()=>{ Modal.close('modal-booking'); scrollToDetailSection('time','#detailDays .day-btn'); },
  openReview, confirmBooking, submitReview,
  authLogin:()=>{ Modal.close('modal-authchoice'); showPage('playerLogin'); },
  authRegister:()=>{ Modal.close('modal-authchoice'); showPage('playerRegister'); },
  openManual, saveManual, addField:openAddField, saveField, saveReschedule,
  clearFilters:()=>{ $('#ownerDateFilter').value=''; $('#ownerFieldFilter').value='all'; const st=$('#ownerStatusFilter'); if(st)st.value='all'; const se=$('#ownerSearch'); if(se)se.value=''; renderOwnerBookings(); },
  refreshOwner:loadOwnerDashboard, toggleOwnerHistory:()=>{ State.showAllOwner=!State.showAllOwner; renderOwnerBookings(); },
  refreshAiInsights:()=>loadAiInsights(true), refreshAiReviews:()=>loadAiReviews(true), refreshAiWeather:()=>loadAiWeather(true),
  calPrev:()=>{ if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00'); State.calMonth=new Date(State.calMonth.getFullYear(), State.calMonth.getMonth()-1, 1); renderOwnerCalendar(); },
  calNext:()=>{ if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00'); State.calMonth=new Date(State.calMonth.getFullYear(), State.calMonth.getMonth()+1, 1); renderOwnerCalendar(); },
  closeModal:()=>Modal.close(), closeSuccess:()=>{ Modal.close('success'); renderPlaces(); },
  lbPrev:()=>Lightbox.nav(-1), lbNext:()=>Lightbox.nav(1),
  togglePass:(btn)=>{ const wrap=btn.closest('.input-wrap'); const inp=wrap&&wrap.querySelector('input'); if(!inp) return; const show=inp.type==='password'; inp.type=show?'text':'password'; btn.classList.toggle('is-on',show); btn.setAttribute('aria-label', t(show?'hidePass':'showPass')); inp.focus(); },
  clearSearch:()=>{ const s=$('#searchInput'); if(s){ s.value=''; updateSearchClear(); renderPlaces(); s.focus(); } },
  setView:(btn)=>setViewMode(btn.dataset.view||'grid'),
  setDetailTab:(btn)=>setDetailTab(btn.dataset.dtab||'book'),
  toggleSportDD:()=>toggleSportDD(),
  navBack:(btn)=>navigateBack(btn.dataset.fallback||'home'),
  /* مبدّل لاعب/مالك: المؤشّر ينزلق بـ--seg-i (CSS)، واللوحان يتبادلان بصنف .off لا بـhidden
     (hidden يصفّر ارتفاع الغلاف ⇒ قفزة). الارتفاع يبقى = أطول لوح دائمًا. */
  onbRole:(btn)=>{ const role=btn.dataset.role||'player';
    $$('.onb-seg-btn').forEach(b=>{ const on=b.dataset.role===role; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
    const seg=$('.onb-seg'); if(seg) seg.style.setProperty('--seg-i', role==='player'?'0':'1');
    const p=$('#onbPanelPlayer'), o=$('#onbPanelOwner');
    if(p) p.classList.toggle('off', role!=='player');
    if(o) o.classList.toggle('off', role!=='owner');
    buzz(6);
  },
};
/* موجة ضوء من نقطة الإصبع بالضبط على مبدّل لاعب/مالك (نمط مرجع finance-entry).
   pointerdown مفوّض: نضبط --rx/--ry بإحداثيات اللمسة داخل الزرّ ثم نعيد تشغيل
   الأنيميشن بحذف الصنف + reflow (بدونه لا تعاد الموجة عند نقرتين متتاليتين). */
document.addEventListener('pointerdown', (e)=>{
  const b = e.target.closest && e.target.closest('.onb-seg-btn'); if(!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--rx', (e.clientX - r.left) + 'px');
  b.style.setProperty('--ry', (e.clientY - r.top) + 'px');
  b.classList.remove('rip'); void b.offsetWidth; b.classList.add('rip');
}, {passive:true});

/* إظهار/إخفاء زر مسح البحث حسب وجود نص */
function updateSearchClear(){ const s=$('#searchInput'), c=$('#searchClear'); if(c) c.classList.toggle('show', !!(s&&s.value.trim())); }
document.addEventListener('click', (e)=>{
  const nav=e.target.closest('[data-nav]'); if(nav){ showPage(nav.dataset.nav); return; }
  const otab=e.target.closest('[data-otab]'); if(otab){ showOwnerTab(otab.dataset.otab); return; }
  const go=e.target.closest('[data-go]'); if(go){ if(go.tagName==='A') e.preventDefault(); showPage(go.dataset.go); return; }
  const star=e.target.closest('[data-star]'); if(star){ setRating(Number(star.dataset.star)); return; }
  const act=e.target.closest('[data-action]'); if(!act) return;
  const fn=Actions[act.dataset.action]; if(fn) fn(act, e);
});
/* إغلاق قائمة الرياضات المنسدلة عند النقر خارجها أو بمفتاح Escape */
document.addEventListener('click', (e)=>{ if(!e.target.closest('#sportDD')) closeSportDD(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSportDD(); });
/* بحث الهيرو بصفحة الهبوط — يعبّئ بحث الرئيسية ثم يتصفّح كضيف */
const heroForm=$('#heroSearchForm');
if(heroForm){ heroForm.addEventListener('submit',(e)=>{ e.preventDefault(); const hi=$('#heroSearchInput'); const v=hi?hi.value.trim():''; const s=$('#searchInput'); if(s) s.value=v; updateSearchClear(); browse(); }); }

/* ===================== النائب المتحرّك لبحث الهيرو =====================
   طبقة نصّية فوق الحقل: بادئة ثابتة («ابحث عن») تُثبّت العين + كلمة متبدّلة كل 2.4s
   بانزلاق رأسي وتلاشٍ. مؤقّت واحد فقط، وكل مزامنة تُلغي السابق ⇒ لا تتراكم المؤقّتات
   عند تبديل اللغة أو التنقّل بين الصفحات. */
const HeroPh = (()=>{
  const PERIOD=2400, FADE=350;                 // FADE يطابق مدّة الانتقال في CSS
  let timer=null, fadeTimer=null, idx=0;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion:reduce)') : null;
  const reduced = ()=> !!(mq && mq.matches);
  const input = ()=> $('#heroSearchInput');
  const hint  = ()=> $('#heroSearchHint');
  const word  = ()=> $('#heroSearchWord');
  const words = ()=>{ const w=t('heroSearchWords'); return Array.isArray(w)&&w.length ? w : []; };

  /* الطبقة تظهر فقط إن كان الحقل فارغاً وغير مركَّز */
  const shouldShow = ()=>{ const i=input(); return !!i && !i.value && document.activeElement!==i; };
  function paint(){ const w=hint(); if(w) w.classList.toggle('hide', !shouldShow()); }

  /* شروط التشغيل: حركة مسموحة + تبويب ظاهر + صفحة الهبوط نشطة + الحقل غير مركَّز */
  function canRun(){
    if(reduced() || document.hidden) return false;
    if(!$('#page-welcome')?.classList.contains('active')) return false;
    const i=input(); if(!i || document.activeElement===i) return false;
    return words().length>1;
  }
  function step(){
    const el=word(), list=words(); if(!el || !list.length) return;
    el.classList.add('out');                                 // الكلمة الحالية تصعد وتتلاشى
    fadeTimer=setTimeout(()=>{
      fadeTimer=null;
      idx=(idx+1)%list.length;
      el.style.transition='none';                            // قفزة صامتة إلى موضع البداية (أسفل)
      el.classList.remove('out'); el.classList.add('in');
      el.textContent=list[idx];
      void el.offsetWidth;                                   // reflow يثبّت حالة البداية قبل الانتقال
      el.style.transition='';
      el.classList.remove('in');                             // تنزلق للأعلى وتظهر
    }, FADE);
  }
  function stop(){
    if(timer){ clearInterval(timer); timer=null; }
    if(fadeTimer){ clearTimeout(fadeTimer); fadeTimer=null; }
  }
  /* مزامنة كاملة — تُستدعى عند التهيئة/تبديل اللغة/تبديل الصفحة/التركيز/إخفاء التبويب */
  function sync(){
    const el=word(); if(!el) return;
    stop();
    const list=words(); if(!list.length) return;
    if(idx>=list.length) idx=0;
    el.classList.remove('out','in'); el.style.transition='';
    el.textContent = reduced() ? list[0] : list[idx];         // حركة مخفّضة ⇒ نصّ واحد ثابت
    paint();
    if(canRun()) timer=setInterval(step, PERIOD);
  }
  return { sync, stop, paint };
})();
if(heroForm){
  const hin=$('#heroSearchInput');
  if(hin){
    hin.addEventListener('focus', ()=>HeroPh.sync());   // يُخفي الطبقة ويوقف الحركة أثناء الكتابة
    hin.addEventListener('blur',  ()=>HeroPh.sync());   // تعود إن بقي الحقل فارغاً
    hin.addEventListener('input', ()=>HeroPh.paint());  // إظهار/إخفاء فوري حسب وجود قيمة
  }
}
document.addEventListener('visibilitychange', ()=>HeroPh.sync());   // لا يحرق دورات في الخلفية
// تفعيل عناصر التنقّل غير-الأزرار (مثل الشعار) بلوحة المفاتيح (Enter/Space)
document.addEventListener('keydown', (e)=>{ if(e.key!=='Enter' && e.key!==' ') return; const el=e.target.closest('[data-go],[data-nav]'); if(el && el.getAttribute('role')==='button'){ e.preventDefault(); el.click(); } });
// إغلاق النافذة عند الضغط على الخلفية
/* النقر خارج النافذة و Escape — كلاهما يمرّ بـModal.close كي يسأل عن التعديلات
   غير المحفوظة. (كانا يزيلان `.show` مباشرةً فيتخطّيان أي حارس.) */
document.addEventListener('click', (e)=>{ const o=e.target.closest('.modal-overlay,.success-overlay'); if(o&&e.target===o) Modal.close(o.id); });
// إغلاق بزر Escape (وصولية)
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const o=$('.modal-overlay.show, .success-overlay.show'); if(o) Modal.close(o.id); } });
// تنقّل المعرض المكبّر بأسهم الكيبورد (يحترم اتجاه الصفحة)
document.addEventListener('keydown', (e)=>{
  if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
  const o=$('#modal-lightbox'); if(!o || !o.classList.contains('show')) return;
  e.preventDefault();
  const rtl=document.documentElement.dir==='rtl';
  Lightbox.nav(e.key==='ArrowRight' ? (rtl?-1:1) : (rtl?1:-1));
});
// سحب أفقي على صورة المعرض = تنقّل (اللمس)
(function(){
  const st=$('#lbStage'); if(!st) return;
  let sx=0, sy=0;
  st.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, {passive:true});
  st.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)<50 || Math.abs(dx)<Math.abs(dy)) return;
    const rtl=document.documentElement.dir==='rtl';
    Lightbox.nav(dx<0 ? (rtl?-1:1) : (rtl?1:-1));
  }, {passive:true});
})();
// حصر التركيز داخل النافذة المفتوحة (Focus Trap) — Tab / Shift+Tab
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Tab') return;
  const panel=$('.modal-overlay.show .modal, .success-overlay.show .scard'); if(!panel) return;
  const f=[...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!f.length) return;
  const first=f[0], last=f[f.length-1], a=document.activeElement;
  if(e.shiftKey && (a===first || a===panel)){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && a===last){ e.preventDefault(); first.focus(); }
});
// تقييم النجوم عبر الكيبورد/الراديو (Radio Group)
document.addEventListener('change', (e)=>{ const sr=e.target.closest('.star-input'); if(sr) setRating(Number(sr.value)); });
// أسهم لوحة المفاتيح في تبويبات المالك (←/→/Home/End) — يحترم اتجاه الصفحة
$('#ownerTabs')?.addEventListener('keydown', (e)=>{
  if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
  e.preventDefault();
  const tabs=$$('#ownerTabs .otab'); const cur=tabs.findIndex(t=>t.dataset.otab===State.ownerTab); if(cur<0) return;
  const rtl=document.documentElement.dir==='rtl';
  let i=cur;
  if(e.key==='Home') i=0; else if(e.key==='End') i=tabs.length-1;
  else if(e.key==='ArrowDown') i=(cur+1)%tabs.length;                 // عمودي (Sidebar الكمبيوتر)
  else if(e.key==='ArrowUp') i=(cur-1+tabs.length)%tabs.length;
  else { const fwd=(e.key==='ArrowLeft')===rtl ? 1 : -1; i=(cur+fwd+tabs.length)%tabs.length; }   // أفقي (الجوال)
  const tab=tabs[i]; if(tab){ showOwnerTab(tab.dataset.otab); tab.focus(); }
});
// بحث مع تأخير (Debounce 300ms) + إظهار زر المسح فورياً
$('#searchInput')?.addEventListener('input', updateSearchClear);
$('#searchInput')?.addEventListener('input', debounce(()=>renderPlaces(), CONFIG.SEARCH_DEBOUNCE));
/* قناع رقم الهاتف الأردني (079 123 4567) — لكل type="tel" عبر التفويض.
   تنسيق بصري فقط: normalizePhone/validPhone يتجاهلان الفراغات فلا يتأثر التحقق ولا المُرسَل للخادم.
   يقنّع أرقام 07 المحلية فقط؛ الصيغ الدولية (962…) تبقى أرقاماً متصلة بلا قناع. */
document.addEventListener('input', (e)=>{
  const inp=e.target;
  if(!(inp && inp.tagName==='INPUT' && inp.type==='tel') || inp.disabled) return;
  const caret = inp.selectionStart==null ? inp.value.length : inp.selectionStart;
  let digitsBefore = inp.value.slice(0,caret).replace(/\D/g,'').length;
  let d = inp.value.replace(/\D/g,'');
  // Backspace أزال فراغ القناع فقط (الأرقام كما هي) ⇒ نحذف الرقم الذي قبله ليبقى الحذف طبيعياً
  if(e.inputType==='deleteContentBackward' && inp.dataset.pdg===d && digitsBefore>0){
    d = d.slice(0,digitsBefore-1)+d.slice(digitsBefore); digitsBefore--;
  }
  const isLocal = d.startsWith('07');
  d = d.slice(0, isLocal?10:14);
  const out = !isLocal ? d
    : d.length>6 ? d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6)
    : d.length>3 ? d.slice(0,3)+' '+d.slice(3) : d;
  inp.dataset.pdg = d;
  if(inp.value!==out){
    inp.value = out;
    let ci=0,seen=0; while(ci<out.length && seen<digitsBefore){ if(/\d/.test(out[ci])) seen++; ci++; }
    try{ inp.setSelectionRange(ci,ci); }catch(_){}
  }
});
// الفلاتر في لوحة المالك
$('#ownerDateFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerFieldFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerStatusFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerSearch')?.addEventListener('input', debounce(()=>renderOwnerBookings(), CONFIG.SEARCH_DEBOUNCE));
// تحديث تلقائي عند العودة للتبويب
document.addEventListener('visibilitychange', ()=>{ manageAutoRefresh(); if(!document.hidden&&autoRefreshActive()) refreshVisible(); });
// تفعيل السحب لإغلاق كل النوافذ
$$('.modal-overlay').forEach(enableSwipe);

/* ===================== INIT ===================== */
/* ===================== LANDING SCROLL REVEAL ===================== */
/* كشفٌ تدريجي للأقسام السفلية في صفحة الهبوط — مراقبٌ واحد، لمرّة واحدة لكل عنصر.
   لا يراقب .lp-hero/.lp-stats (هما ضمن كشف الـhero الابتدائي فوق الطيّة). */
function initLandingReveal(){
  const root = $('#page-welcome'); if(!root) return;
  // أسناد التتابع لأبناء المجموعات (لا نراقب الحاوية + الأبناء معًا)
  const groups = ['.lp-features','.lp-steps','.lp-regions','.lp-reviews'];
  groups.forEach(g=>{ const grp=root.querySelector(g); if(!grp) return;
    Array.from(grp.children).forEach((child,i)=>{ child.style.setProperty('--reveal-delay', Math.min(i*80,400)+'ms'); });
  });
  const sel = '.lp-sec-head,.lp-feature,.lp-step,.lp-region,.lp-review,.lp-owners-card,.lp-callout-inner,.lp-footer';
  const els = $$(sel, root);
  if(!els.length) return;
  els.forEach(el=>el.classList.add('scroll-reveal'));
  document.documentElement.classList.add('reveal-ready');   // الآن فقط نسمح بالإخفاء قبل الكشف
  if(!('IntersectionObserver' in window)){ els.forEach(el=>el.classList.add('visible')); return; }
  const obs = new IntersectionObserver((entries, observer)=>{
    entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
  }, { threshold:0.10, rootMargin:'0px 0px -8% 0px' });
  els.forEach(el=>obs.observe(el));
}

/* منع تكرار زرّ «متابعة الحجز»: يُخفى الشريط اللاصق كلما ظهر الزر الداخلي على الشاشة
   (يعمل على الشاشات العريضة حيث يظهر الزرّان؛ على الجوال الزر الداخلي display:none فيبقى اللاصق). */
function initStickyDedup(){
  const inline=document.querySelector('.detail-book-inline'), bar=$('#detailSticky');
  if(!inline || !bar || !('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>bar.classList.toggle('covered-by-inline', e.isIntersecting));
  }, { threshold:0 });
  io.observe(inline);
}

async function init(){
  applyTheme(Session.theme());
  setLanguage(State.lang);   // يضبط lang/dir + يطبّق الترجمة على الواجهة الثابتة
  validateI18nParity();      // تحقّق تكافؤ مفاتيح ar/en (تحذير كونسول فقط)
  Dirty.init();              // مراقبة الإدخال في نوافذ النماذج (تحذير التعديلات غير المحفوظة)
  Offline.init();            // طبقة انقطاع الاتصال + استئناف عند العودة
  PullRefresh.init();        // السحب للتحديث على الرئيسية/الحجوزات/لوحة المالك
  initLandingReveal();       // تجهيز كشف أقسام الهبوط (الـDOM الثابت متاح الآن)
  initStickyDedup();         // منع تكرار زرّ متابعة الحجز (اللاصق × الداخلي)
  loadData().then(updateTrust);
  if (Session.owner()){
    $('#nav-owner').classList.add('show'); showPage('owner'); loadOwnerDashboard(); return;
  }
  if (Session.player()){
    try{
      const res=await API.get('getPlayerBookings',{ player_token:Session.player() }, 'playerBookings');
      if (res.success){ State.player=res.player; State.guest=false; updatePlayerGreeting(); showPage('home'); placesSkeleton(); await loadData(); renderPlaces(); return; }
      Session.clear();
    }catch(_){ /* الإبقاء على شاشة الترحيب عند فشل الشبكة */ }
  }
  showPage('welcome');
  // رسالة ترحيبية لأول زيارة فقط (لا تظهر بعدها)
  try{
    if(!localStorage.getItem('mustadaira:welcomed')){
      localStorage.setItem('mustadaira:welcomed','1');
      setTimeout(()=>toast(t('firstVisitWelcome'),'success',6500), 1100);
    }
  }catch(_){}
}
init();

})();
