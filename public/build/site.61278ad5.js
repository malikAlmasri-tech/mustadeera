/* =============================================================
   المستديرة · الموقع الرسمي — السلوك كلّه في ملفّ واحد
   ---------------------------------------------------------------
   يُخدَم مبصومًا (/build/site.<hash>.js) بـdefer. بلا مكتبات.

   قواعد ملزمة هنا:
   · المحتوى يعمل بلا هذا الملفّ. كل ما فيه تحسين، لا شرط عرض.
     (سكربت <head> يضع .has-js ويزيلها إن لم يصل هذا الملفّ خلال 2ث.)
   · كل مستمع تمرير/مؤشّر يمرّ عبر requestAnimationFrame — لا عمل
     في المستمع نفسه.
   · كل حركة تُقاس بـprefers-reduced-motion قبل تشغيلها.
   · كل انتظار لـtransitionend/animation معه مؤقّت أمان: مقيس في هذا
     المشروع أن الحدث قد لا يصل أبدًا (نافذة معاينة مجمّدة مثلًا).
   ============================================================= */
(function () {
  'use strict';

  /* يخبر سكربت <head> أن الملفّ وصل، فلا يُلغى إخفاء عناصر الكشف */
  window.__mstd = 1;

  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return mqReduce.matches; }

  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ===========================================================
     1 · الكشف عند التمرير
     IntersectionObserver لا animation-timeline: الأخير في Chromium
     وحده، ومستخدم Safari/Firefox كان يرى الصفحة بلا حركة إطلاقًا.
     العناصر تُكشف مرّة واحدة ثم تُترك — لا حركة عند الرجوع للأعلى.
     =========================================================== */
  (function reveal() {
    var items = $$('.rv');
    if (!items.length) return;

    // ترقيم داخل كل مجموعة شقيقة ⇒ التدرّج الزمني يمشي مع الصفّ لا مع الصفحة
    var seen = new Map();
    items.forEach(function (el) {
      var p = el.parentElement;
      var n = seen.get(p) || 0;
      seen.set(p, n + 1);
      el.style.setProperty('--i', String(Math.min(n, 6)));
    });

    if (!('IntersectionObserver' in window) || reduced()) {
      items.forEach(function (el) { el.classList.add('rv-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('rv-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ===========================================================
     2 · حالة التمرير: ظلّ الهيدر · زرّ العودة · شريط التقدّم
     شريط التقدّم يُترك للـCSS حيث يُدعم scroll() — يمشي خارج الخيط
     الرئيسي فلا يهتزّ. وإلّا يحدّثه هذا القسم بـrAF.
     =========================================================== */
  (function scrollState() {
    var cssTimeline = false;
    try {
      cssTimeline = window.CSS && CSS.supports('animation-timeline', 'scroll()') && !reduced();
    } catch (e) { cssTimeline = false; }
    if (cssTimeline) root.classList.add('css-scroll-tl');

    var ticking = false;
    function read() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      root.classList.toggle('is-scrolled', y > 8);
      root.classList.toggle('is-deep', y > 700);
      if (cssTimeline) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty('--p', max > 0 ? String(Math.min(1, y / max)) : '0');
    }
    function tick() { if (!ticking) { ticking = true; requestAnimationFrame(read); } }

    on(window, 'scroll', tick, { passive: true });
    on(window, 'resize', tick, { passive: true });
    read();
  })();

  /* ===========================================================
     3 · درج الجوّال
     التنقّل كان يختفي كليًّا تحت 900px — لا رابط إلى المُلّاك أو
     «من نحن» إلّا من التذييل. هذا الدرج هو ذلك التنقّل.
     =========================================================== */
  (function mobileNav() {
    var burger = $('.burger');
    var panel = $('.mnav');
    if (!burger || !panel) return;
    var veil = $('.mnav-veil');
    var closeBtn = $('.mnav-close');
    var lastFocus = null;

    function setOpen(open) {
      root.classList.toggle('mnav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      // قفل تمرير الصفحة خلف الدرج بلا قفزة: overflow وحده يكفي هنا
      // لأن الدرج نفسه هو ما يُمرَّر (overscroll-behavior:contain).
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        lastFocus = document.activeElement;
        var first = $('a,button', panel);
        if (first) setTimeout(function () { first.focus(); }, 180);
      } else if (lastFocus && lastFocus.focus) {
        lastFocus.focus();
      }
    }

    on(burger, 'click', function () { setOpen(!root.classList.contains('mnav-open')); });
    on(closeBtn, 'click', function () { setOpen(false); });
    on(veil, 'click', function () { setOpen(false); });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('mnav-open')) setOpen(false);
    });
    // رابط داخل الدرج ⇒ الصفحة تتغيّر؛ أغلقه كي لا يعود مفتوحًا مع زر الرجوع
    $$('a', panel).forEach(function (a) {
      on(a, 'click', function () { setOpen(false); });
    });
    // اتّساع الشاشة فوق نقطة القطع يُظهر التنقّل الأفقي ⇒ الدرج بلا معنى
    var mqWide = window.matchMedia('(min-width: 900px)');
    var onWide = function (e) { if (e.matches) setOpen(false); };
    if (mqWide.addEventListener) mqWide.addEventListener('change', onWide);

    setOpen(false);
  })();

  /* ===========================================================
     4 · تبديل الثيم
     ثلاث درجات، والأدنى منها يعمل دائمًا:
     ① View Transitions ⇒ قصّ دائري ينبسط من الزرّ نفسه.
     ② بلا دعم ⇒ فئة مؤقّتة تمرّر الألوان 420ms.
     ③ تقليل الحركة أو خطأ ⇒ تبديل فوري.
     الثيم يُطبَّق في كل الحالات قبل أي حركة: لو تجمّدت الحركة
     فالصفحة مبدَّلة أصلًا، لا نصف حالة.
     =========================================================== */
  (function theme() {
    var K = 'mustadaira:theme';
    var MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z';
    var SUN = 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4';

    function paint() {
      var dark = root.classList.contains('dark');
      // رسم واحد يبدّل السمة d — لا عنصران متراكبان (درس «الشمسين» في التطبيق)
      $$('.thm-p').forEach(function (p) { p.setAttribute('d', dark ? SUN : MOON); });
    }

    function apply() {
      root.classList.toggle('dark');
      try { localStorage.setItem(K, root.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {}
      paint();
    }

    function fade() {
      root.classList.add('theme-fade');
      setTimeout(function () { root.classList.remove('theme-fade'); }, 460);
    }

    function spin(btn) {
      if (!btn) return;
      btn.classList.add('spun');
      setTimeout(function () { btn.classList.remove('spun'); }, 620);
    }

    on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!btn) return;
      spin(btn);

      if (reduced() || typeof document.startViewTransition !== 'function') {
        if (!reduced()) fade();
        apply();
        return;
      }

      var r = btn.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

      root.classList.add('vt-theme');
      var vt;
      try { vt = document.startViewTransition(apply); }
      catch (err) { root.classList.remove('vt-theme'); apply(); return; }

      // مؤقّت أمان: الفئة تُزال حتمًا حتى لو لم تُحسم أي وعود
      var cleared = false;
      var clear = function () { if (cleared) return; cleared = true; root.classList.remove('vt-theme'); };
      setTimeout(clear, 1200);

      vt.ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + far + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
      vt.finished.then(clear).catch(clear);
    });

    paint();
  })();

  /* ===========================================================
     5 · تموّج الأزرار
     الموضع يُقاس بـgetBoundingClientRect — فيزيائي، فيصحّ في
     العربية والإنجليزية بلا فرع (transform فيزيائي أيضًا).
     =========================================================== */
  (function ripple() {
    on(document, 'pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.btn');
      if (!b || reduced()) return;
      var r = b.getBoundingClientRect();
      b.style.setProperty('--rx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--ry', (e.clientY - r.top) + 'px');
      b.classList.remove('rippling');
      // قراءة إجبارية تُعيد تشغيل الحركة من أوّلها عند النقر المتتابع
      void b.offsetWidth;
      b.classList.add('rippling');
      setTimeout(function () { b.classList.remove('rippling'); }, 640);
    }, { passive: true });
  })();

  /* ===========================================================
     6 · بقعة الضوء تحت المؤشّر
     مستمع واحد على المستند، لا واحد لكل بطاقة، ومقيّد بأجهزة
     المؤشّر الدقيق (نفس شرط الـCSS) كي لا يعمل شيء على اللمس.
     =========================================================== */
  (function spotlight() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var SEL = '.bt,.note-card,.ct-card,.pl-card,.stat';
    var pending = null, raf = 0;

    on(document, 'pointermove', function (e) {
      var card = e.target.closest && e.target.closest(SEL);
      if (!card) return;
      pending = { card: card, x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!pending) return;
        var r = pending.card.getBoundingClientRect();
        pending.card.style.setProperty('--mx', (pending.x - r.left) + 'px');
        pending.card.style.setProperty('--my', (pending.y - r.top) + 'px');
        pending = null;
      });
    }, { passive: true });
  })();

  /* ===========================================================
     7 · ميلان جهاز الهيرو مع المؤشّر
     أرقام صغيرة عمدًا (±6 درجات): الميلة توحي بالعمق، والمبالغة
     فيها تجعل اللوح يبدو معطوبًا لا حيًّا.
     =========================================================== */
  (function tilt() {
    var hero = $('.hero');
    var phone = $('.hero .phone');
    if (!hero || !phone || reduced()) return;
    if (!window.matchMedia('(min-width: 920px) and (pointer: fine)').matches) return;

    var raf = 0, px = 0, py = 0;
    on(hero, 'pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        phone.style.setProperty('--ty', String(-9 + px * 12));
        phone.style.setProperty('--tx', String(3 - py * 10));
      });
    }, { passive: true });
    on(hero, 'pointerleave', function () {
      phone.style.setProperty('--ty', '-9');
      phone.style.setProperty('--tx', '3');
    });
  })();

  /* ===========================================================
     8 · عدّادات الأرقام
     الرقم النهائي مكتوب في الوسم (data-count) وهو ما يراه من لا
     يعمل عنده هذا الملفّ ومن أطفأ الحركة — العدّ زينة لا مصدر.
     =========================================================== */
  (function counters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;
    if (reduced() || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (!isFinite(target) || target <= 0) return;
        var dur = 1100, t0 = 0;
        el.textContent = '0';
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 4);
          el.textContent = String(Math.round(target * eased));
          if (k < 1) requestAnimationFrame(step);
          else el.textContent = String(target);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });

    nums.forEach(function (n) { io.observe(n); });
  })();

  /* ===========================================================
     9 · أكورديون الأسئلة
     المتصفّح يخفي محتوى <details> لحظة إزالة open، فالإغلاق بلا
     JS يقع فجأة. هنا نؤخّر الإزالة حتى تنتهي حركة الارتفاع —
     ومعها مؤقّت أمان لأن transitionend قد لا يصل.
     =========================================================== */
  (function faq() {
    var list = $$('.faq');
    if (!list.length) return;

    list.forEach(function (d) {
      var q = $('.faq-q', d);
      var a = $('.faq-a', d);
      if (!q || !a) return;

      on(q, 'click', function (e) {
        if (!d.open || reduced()) return;   // الفتح: CSS يتكفّل به
        e.preventDefault();
        d.classList.add('is-closing');
        var done = false;
        var finish = function () {
          if (done) return;
          done = true;
          d.classList.remove('is-closing');
          d.open = false;
        };
        a.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 520);
      });
    });
  })();

  /* ===========================================================
     10 · تصفية دليل الملاعب
     البطاقات مولَّدة وقت البناء وموجودة كلّها في الصفحة؛ هذا
     يُخفي ما لا يطابق فقط. بلا بحث، بلا شبكة، ويعمل بلا اتّصال.
     =========================================================== */
  (function placesFilter() {
    var box = $('.pl-tools');
    var grid = $('.pl-grid');
    if (!box || !grid) return;

    var input = $('.pl-search input', box);
    var chips = $$('.pl-chip', box);
    var count = $('.pl-count');
    var empty = $('.pl-empty');
    var cards = $$('.pl-card', grid);
    var area = '';
    var term = '';

    function norm(s) {
      return (s || '')
        .toLowerCase()
        // توحيد الألف والياء والتاء المربوطة: من يكتب «ابو» يجب أن يجد «أبو»
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        // إزالة التشكيل
        .replace(/[ً-ْ]/g, '')
        .trim();
    }

    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var okArea = !area || c.getAttribute('data-area') === area;
        var okTerm = !term || norm(c.getAttribute('data-q')).indexOf(term) !== -1;
        var ok = okArea && okTerm;
        if (ok) shown++;
        c.classList.toggle('is-out', !ok);
      });
      // الإخفاء من التخطيط يأتي بعد انتهاء الانكماش كي تُرى الحركة
      setTimeout(function () {
        cards.forEach(function (c) { c.classList.toggle('is-gone', c.classList.contains('is-out')); });
      }, reduced() ? 0 : 200);

      var tpl = count && count.getAttribute('data-tpl');
      if (tpl) count.textContent = tpl.replace('{n}', String(shown));
      if (empty) empty.classList.toggle('on', shown === 0);
    }

    on(input, 'input', function () { term = norm(input.value); apply(); });
    chips.forEach(function (ch) {
      on(ch, 'click', function () {
        var v = ch.getAttribute('data-area') || '';
        // الضغط على شريحة مفعّلة يلغيها — لا حاجة إلى شريحة «الكلّ»
        var already = ch.getAttribute('aria-pressed') === 'true';
        chips.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        area = already ? '' : v;
        if (!already) ch.setAttribute('aria-pressed', 'true');
        apply();
      });
    });

    apply();
  })();

  /* ===========================================================
     11 · العودة إلى الأعلى
     =========================================================== */
  (function toTop() {
    var b = $('.top');
    on(b, 'click', function () {
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    });
  })();

  /* لا service worker — المشروع له وجهان فقط: هذا الموقع، والتطبيق.
     وإن كان مسجَّلًا من زيارة سابقة فلا بدّ من إلغائه، وإلّا بقي يخدم
     نسخة قديمة من الصفحات إلى الأبد على أجهزة من زاروا قبل اليوم. */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
    if (window.caches && caches.keys) {
      caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
    }
  }
})();
