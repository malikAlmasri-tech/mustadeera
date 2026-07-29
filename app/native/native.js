/* ============================================================
   NATIVE LAYER — JS  (نسخة تطبيق الهاتف فقط)
   يُحقَن هذا الملف فقط داخل www/index.html عبر build.ps1.
   خامل تمامًا على المتصفح: يخرج فورًا إن لم يكن Capacitor موجودًا.
   يعتمد على جسر window.__native الذي يُنشئه app.js داخل التطبيق.
   ============================================================ */
(function(){
  var Cap = window.Capacitor;
  if(!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return; // متصفح ⇒ لا شيء
  var P = Cap.Plugins || {};
  var StatusBar = P.StatusBar, App = P.App, Haptics = P.Haptics;

  document.body.classList.add('native');

  /* ---- تغذية لمسية أصلية ----
     `navigator.vibrate` يشغّل محرّك الاهتزاز الخام: نبضة واحدة بنفس الإحساس مهما
     كان السياق، وتحتاج إذن VIBRATE، وعلى iOS لا تعمل إطلاقًا. أمّا `Haptics`
     فيمرّ على محرّك التغذية اللمسية في النظام ⇒ نقرة قصيرة مضبوطة تُقرأ كاستجابة
     لا كرنين. نكشفه لـapp.js عبر جسر واحد؛ وإن غاب البلَغن بقي `navigator.vibrate`.
     الشدّة تُشتقّ من نفس الأرقام المستعملة أصلًا (ms) فلا تتغيّر أي نقطة نداء. */
  if(Haptics && Haptics.impact){
    window.__haptic = function(ms){
      var style = ms <= 10 ? 'LIGHT' : (ms <= 25 ? 'MEDIUM' : 'HEAVY');
      try{ Haptics.impact({ style: style }); }catch(_){}
    };
  }

  /* ---- شريط الحالة: يطابق ما تحته بالضبط (الرؤوس صارت بيضاء بعد إعادة الهيكلة) ----
     • شاشة الترحيب: هيرو Teal داكن ⇒ خلفية Teal + أيقونات فاتحة.
     • بقية الصفحات: رأس أبيض ⇒ خلفية بيضاء + أيقونات داكنة (LIGHT = نص داكن).
     • الثيم الليلي: سطح شبه أسود + أيقونات فاتحة.
     يتزامن مع تبديل الثيم (MutationObserver) ومع تغيير الصفحة (حدث app:page من app.js). */
  function syncStatusBar(){
    if(!StatusBar) return;
    var dark = document.body.classList.contains('dark');
    var onboarding = !!document.querySelector('#page-welcome.active');
    var lightIcons = dark || onboarding;                  // خلفية داكنة ⇒ أيقونات فاتحة
    var bg = onboarding ? '#0F4B53' : (dark ? '#0A0E11' : '#FFFFFF');
    try{
      StatusBar.setOverlaysWebView({ overlay: false });   // المحتوى تحت الشريط لا خلفه
      StatusBar.setStyle({ style: lightIcons ? 'DARK' : 'LIGHT' });  // DARK = أيقونات فاتحة · LIGHT = داكنة
      StatusBar.setBackgroundColor({ color: bg });
    }catch(_){}
  }
  syncStatusBar();
  try{ new MutationObserver(syncStatusBar).observe(document.body, { attributes:true, attributeFilter:['class'] }); }catch(_){}
  document.addEventListener('app:page', syncStatusBar);

  /* ---- زر الرجوع الفيزيائي (Android) ---- */
  if(App && App.addListener){
    App.addListener('backButton', function(){
      // 1) نافذة/شاشة نجاح مفتوحة ⇒ أغلقها أولًا (Escape مُلتقَط في app.js)
      if(document.body.classList.contains('modal-open') ||
         document.querySelector('.modal-overlay.show, .success-overlay.show')){
        document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
        return;
      }
      // 2) رجوع داخلي عبر مكدّس التنقّل (NavStack) في app.js
      var br = window.__native;
      var page = (br && br.page) ? br.page() : null;
      if(page && page !== 'home' && page !== 'welcome'){
        if(br && br.back) br.back('home');
        return;
      }
      // 3) على الصفحة الجذر ⇒ اخرج من التطبيق
      try{ App.exitApp(); }catch(_){}
    });
  }
})();
