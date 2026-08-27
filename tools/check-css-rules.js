#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   check-css-rules — ثلاث قواعد تصميمٍ كانت تُفرَض بالقراءة، صارت تُفرَض بالبناء

   كل قاعدة هنا مكتوبةٌ في `CLAUDE.md` أو في وثيقة نظام التصميم، وصحيحةٌ، وكلُّها
   كانت تعتمد على أن **يتذكّرها من يكتب السطر التالي**. والملفّ لا يخترع قاعدة:
   يقرأ الثلاث القائمة ويمنع خرقها الجديد.

   ① الخصائص المنطقية — `left/right` الفيزيائية تكسر RTL في اتجاهٍ واحد فقط،
     فتنجو من فحص اللغة الواحدة. **وثلاثة أنماطٍ فيزيائية مشروعة** ولا تُبلَّغ:
       • ضبطُ الطرفين معًا (`left` و`right`) — شريطٌ بعرض الحاوية، بلا اتجاه.
       • `left:50%` مع `translateX(-50%)` أو `margin-left` سالب — مثالُ التوسيط
         الصحيح: **فيزيائيّان معًا فيتعادلان**. والخطأ هو خلطُ منطقيٍّ بفيزيائي
         (‏`inset-inline-start:50%` + `translateX`) — وهو المزلق المسجَّل.
       • ما في `PHYSICAL_OK` أدناه، ولكلٍّ سببه مكتوبًا.

   ② التتبّع (`letter-spacing`) — سالبُه على العربية يلصق الحروف المتّصلة.
     الدفعة ٢١ صفّرته بتوكن، **وقائمة المحدِّدات اليدوية أغفلت ٢٦ محدِّدًا حيًّا**.
     فالقاعدة: كل `letter-spacing` غير صفري يمرّ **بتوكن** أو يُقصَر على الإنجليزية.

   ③ الارتفاع الثابت على عنصر تفاعلي — `height` قاطعة تقصّ النصّ متى كبر
     (خطّ النظام · ترجمة أطول)، و`min-height` تنمو. وهذا هو **العطل الأرجح**
     في مسألة `rem` المعلَّقة: النصّ يكبر والصندوق لا.

   ⚠️ وحدوده مكتوبة كي لا يُقرأ مرورُه ضمانًا ليس فيه: يفحص **ما هو مصرَّح في
      CSS**، ولا يرى ما يُحسَب في JS ولا هدفَ لمسٍ يصنعه `::after`. قياسُ أهداف
      اللمس الحقيقي جرى حيًّا في الدفعة ٢٤ ويبقى هو المرجع.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* استثناءات ①: فيزيائيٌّ مقصود، ولكلٍّ سببه */
const PHYSICAL_OK = [
  ['.nav-pill',        'تُوضَع بـtransform محسوبٍ من getBoundingClientRect — وهو فيزيائي أصلًا فلا إشارة تُعكَس'],
  ['.onb-seg-btn',     'بقعة ضوءٍ عند --rx/--ry، وهما إحداثيّا المؤشّر: بكسل فيزيائي لا جهة'],
  ['.intro-mark',      'لمعةٌ تعبر العلامة — زخرفة غير دلالية تبقى في اتّجاه واحد عمدًا'],
  ['.intro-core',      'left:50% مع margin-left سالب: مثال التوسيط الفيزيائي'],
];
/* استثناءات ②: ليست تتبّعَ نصّ */
const TRACK_OK = [
  ['.rd-stars', 'تباعدُ رموز ★ لا تتبّعُ نصّ — لا لغة له تُصفّره'],
];
/* استثناءات ③: ارتفاعٌ ثابتٌ **مقيسٌ عمدًا** */
const FIXED_H_OK = [
  ['.view-ico',   'حجمٌ بصريّ مقصود، وهدف اللمس عليه شبح 44px (مقيس في الدفعة ٢٤)'],
  ['.tl-',        'خلايا مخطّط المالك — شبكة كثافةٍ لا أهداف لمس'],
];
const INTERACTIVE = /(^|[\s,>+~])(button|a|input|select|summary)\b|\.(btn|[a-z-]*-btn|tab|[a-z-]*tab|chip|[a-z-]*chip|nitem|toggle|[a-z-]*toggle)\b/;

/* ⚠️ كتل `@keyframes` **تُقتطَع قبل المسح**: القيمة داخل إطارٍ مفتاحي حالةٌ عابرة
   (‏`introWipe*` تبدأ عند `opacity:0`) لا قيمةٌ تصميمية مستقرّة، ومعاملتُها كقاعدة
   تُخرج بلاغًا كاذبًا — وواحدٌ يكفي ليُعطَّل الحارس كلُّه. */
function stripKeyframes(css){
  let out = css;
  for (;;){
    const k = out.indexOf('@keyframes');
    if (k < 0) return out;
    let j = out.indexOf('{', k), d = 0;
    for (; j < out.length; j++){
      if (out[j] === '{') d++;
      else if (out[j] === '}' && --d === 0) break;
    }
    out = out.slice(0, k) + out.slice(k, j + 1).replace(/[^\n]/g, ' ') + out.slice(j + 1);
  }
}
function rulesOf(css){
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))){
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').pop().trim();
    if (!sel || sel.startsWith('@')) continue;
    out.push({ sel, body: m[2], line: css.slice(0, m.index).split('\n').length });
  }
  return out;
}
const okBy = (sel, list) => list.find(([frag]) => sel.includes(frag));
const problems = [];
const add = (file, line, check, sel, detail) => problems.push({ file, line, check, sel, detail });

/* ── ④ توكنٌ مُعرَّف مرّتين تحت نفس المحدِّد ─────────────────────────────────
   `--r-lg` كان `14px` في السطر ٦٤ و`12px` في ١٤٧٧، وكلاهما `:root` ⇒ الثانية
   تفوز، فأيّ قراءةٍ لأعلى الملفّ تعطي رقمًا **غير المرسوم**. وبلغ العدد **٤٥
   تصريحًا ميتًا** حين قِيس (2026-08-14) — سجلٌّ جيولوجي لتمريرات تصميمٍ متتالية
   لا نظام تصميم. حُذفت كلُّها بصفر فرقٍ بصري مقيس، وهذا الحارس يمنع عودتها.

   ⚠️ **ويُستثنى صنفان، وكلاهما تكرارٌ مقصود** — وبلا استثنائهما يخرج الحارس
      صاخبًا، وحارسٌ صاخب حارسٌ مُعطَّل:
      ① قاعدةٌ داخل @media/@supports — التجاوز هو الغرض منها أصلًا.
      ② تصريحان **متتاليان** لنفس التوكن في نفس الكتلة — احتياطيّ التحسين
        التدريجي (`--sp-page:cubic-bezier(…)` ثمّ `--sp-page:linear(…)`):
        المتصفّح القديم يتجاهل الثاني ويُبقي الأوّل. */
function dupTokens(file, css){
  // مدى كل @media/@supports كي نعرف ما بداخله
  const at = [];
  for (const m of css.matchAll(/@(?:media|supports|container)[^{]*\{/g)){
    let j = m.index + m[0].length - 1, d = 0;
    for (; j < css.length; j++){
      if (css[j] === '{') d++;
      else if (css[j] === '}' && --d === 0) break;
    }
    at.push([m.index, j]);
  }
  const inAt = (i) => at.some(([a, b]) => i > a && i < b);

  const seen = new Map();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))){
    const sel = m[1].trim().split('\n').pop().trim();
    if (!sel || sel.startsWith('@') || inAt(m.index)) continue;      // ①
    const bodyAt = m.index + m[1].length + 1;
    const local = new Set();
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:/gi)){
      if (local.has(d[1])) continue;                                  // ②
      local.add(d[1]);
      const key = sel + ' || ' + d[1];
      const line = css.slice(0, bodyAt + d.index).split('\n').length;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(line);
    }
  }
  for (const [key, lines] of seen){
    if (lines.length < 2) continue;
    const [sel, tok] = key.split(' || ');
    add(file, lines[lines.length - 1], 'توكن مكرّر', sel,
        `${tok} مُعرَّف ${lines.length} مرّات على نفس المحدِّد (أسطر ${lines.join('، ')}) — الأخير يفوز والبقيّة ميتة`);
  }
}

for (const file of ['app/src/app.css', 'app/src/native.css', 'app/src/web.css']){
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  const css = stripKeyframes(fs.readFileSync(p, 'utf8'));

  /* ⚠️ التعليقات تُجرَّد **مع الحفاظ على أرقام الأسطر**: توكنٌ معلَّق عليه في
     نثرٍ شارح يُقرأ تعريفًا ثانيًا فيخرج بلاغٌ كاذب (قِيس: ٥٦ ⇐ ٤٥ بعد التجريد). */
  dupTokens(file, css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')));

  for (const { sel, body, line } of rulesOf(css)){
    // ① منطقية
    const L = /(^|[;\s])left\s*:\s*([^;]+)/.exec(body);
    const R = /(^|[;\s])right\s*:\s*([^;]+)/.exec(body);
    if (L || R){
      const both = L && R;
      const centred = L && L[2].trim() === '50%' && (/translate/.test(body) || /margin-left\s*:\s*-/.test(body));
      if (!both && !centred && !okBy(sel, PHYSICAL_OK))
        add(file, line, 'منطقية', sel, `left/right مفردة (${(L||R)[2].trim()}) — استعمل inset-inline-start/end`);
    }
    // ② تتبّع
    const LS = /(^|[;\s])letter-spacing\s*:\s*([^;]+)/.exec(body);
    if (LS){
      const v = LS[2].trim();
      if (!/^0[a-z%]*\s*(!important)?$/.test(v) && v !== 'normal' && !v.startsWith('var(')
          && !/lang=["']?en/.test(sel) && !okBy(sel, TRACK_OK))
        add(file, line, 'تتبّع', sel, `letter-spacing:${v} حرفيّة وغير مقصورة على الإنجليزية — استعمل توكنًا`);
    }
    // ③ ارتفاع ثابت على تفاعلي
    /* ⚠️ **شرطُ `font-size` في القاعدة نفسها** هو ما يجعل الفحص ذا معنى: الارتفاع
       الثابت على أيقونة SVG أو مربّع اختيار أو شارةٍ **صحيحٌ ومقصود**، والعطل
       الحقيقي هو «نصٌّ داخل صندوقٍ لا ينمو». وبلا هذا الشرط خرج ٣٩ بلاغًا
       معظمها كاذب — وحارسٌ صاخب حارسٌ مُعطَّل. */
    const H = /(^|[;\s])height\s*:\s*([0-9.]+)px/.exec(body);
    if (H && Number(H[2]) < 44 && /font-size/.test(body) && INTERACTIVE.test(sel) && !okBy(sel, FIXED_H_OK))
      add(file, line, 'ارتفاع', sel, `height:${H[2]}px قاطعة على عنصر تفاعلي — min-height تنمو مع النصّ`);
  }
}

if (problems.length){
  console.error(`\n  ✗ check-css-rules — مخالفات، عددها ${problems.length}:`);
  for (const q of problems) console.error(`      ${q.file}:${q.line}  [${q.check}]  ${q.sel.slice(-56)}\n           ${q.detail}`);
  console.error('');
  process.exit(1);
}
console.log('  ✓ check-css-rules: منطقية · تتبّع · ارتفاع تفاعلي · توكن مكرّر — لا مخالفة');
