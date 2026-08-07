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
  var StatusBar = P.StatusBar, App = P.App, Haptics = P.Haptics, Notif = P.LocalNotifications;

  document.body.classList.add('native');

  /* ---- إشعارات الجهاز ----
     الجسر الوحيد بين app.js وشريط إشعارات النظام. app.js يقرأ صفوف الإشعارات
     من القاعدة (‏migration/14) ويكتب نصوصها بلغة المستخدم الحالية، ثمّ يسلّمها
     هنا لتُعرَض. لا نصّ عربي واحد في هذا الملفّ.

     ⚠️ ما لا يفعله: **لا يوقظ هاتفًا والتطبيق مغلق.** هذه إشعارات محلّية
     (‏Local Notifications) لا دفع (Push): تُعرَض والتطبيق يعمل أو حين يُفتَح،
     وإيقاظ الجهاز يتطلّب FCM ومشروع Firebase — بنية تحتية عند المالك.
     ولذلك الصفّ في القاعدة هو الحقيقة، وهذه إظهارٌ لها لا مصدرها: ما لم
     يُعرَض إشعارًا يبقى في مركز الإشعارات داخل التطبيق ولا يضيع.

     ⚠️ وأندرويد 13+ يطلب إذن POST_NOTIFICATIONS صراحةً. لا نطلبه عند الإقلاع
     (‏نافذةُ إذنٍ قبل أن يفهم المستخدم لِمَ يُسأل = رفضٌ دائم يصعب التراجع عنه)
     — يطلبه app.js عند أوّل حدث يستحقّه: أوّل حجز يرسله اللاعب. */
  if (Notif) {
    window.__notify = {
      /* يُعيد وعدًا بـtrue/false. لا يرمي أبدًا: غياب الإذن ليس عطلًا في التطبيق. */
      ensure: function(ask){
        return Notif.checkPermissions().then(function(p){
          if (p && p.display === 'granted') return true;
          if (!ask || (p && p.display === 'denied')) return false;   // رُفض سابقًا ⇒ لا نلحّ
          return Notif.requestPermissions().then(function(r){ return !!r && r.display === 'granted'; });
        }).catch(function(){ return false; });
      },
      /* items: [{id, title, body}] — المعرّف عدد صحيح موجب مشتقّ في app.js من
         معرّف الصفّ، فإعادة عرض نفس الإشعار تستبدله ولا تكوّمه. */
      show: function(items){
        if (!items || !items.length) return Promise.resolve(false);
        return Notif.schedule({
          notifications: items.map(function(n){
            return {
              id: n.id, title: n.title, body: n.body,
              // silhouette drawable, not the launcher icon: Android keeps only the
              // alpha channel, so a full-colour icon flattens to a white square.
              smallIcon: 'ic_stat_notify',
              extra: { nid: n.nid || '' },
              // بلا `schedule.at`: العرض فوري. والجدولة المستقبلية غير مستعملة هنا
              // لأن مصدر الحقيقة صفٌّ في القاعدة قد يتغيّر قبل موعده.
              autoCancel: true
            };
          })
        }).then(function(){ return true; }).catch(function(){ return false; });
      }
    };
    /* نقر الإشعار ⇒ حدثٌ يلتقطه app.js فيفتح الصفحة المعنيّة. */
    try{
      Notif.addListener('localNotificationActionPerformed', function(ev){
        var nid = ev && ev.notification && ev.notification.extra && ev.notification.extra.nid;
        document.dispatchEvent(new CustomEvent('app:notification-tap', { detail: { nid: nid || '' } }));
      });
    }catch(_){}
  }

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
