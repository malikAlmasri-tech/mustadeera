#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   check-globals — الاسم المستعمَل ولم يُعرَّف

   لماذا وُجد هذا الحارس؟
   ─────────────────────
   شحنت دفعةٌ (2026-08-12) خمسة استعمالات بلا تعريف — `GENDERS` ·
   `genderLabel` · `genderDeclared` · `fieldGender` · و`filters.genders` —
   فكانت `updateFilterBar()` ترمي **قبل** `renderPlaces()` مباشرةً:
   **لا بطاقة ملعبٍ واحدة تُرسَم**، ورسالةُ الخطأ الموحَّدة تقول للمستخدم
   «حدث خطأ في الاتصال» بينما الشبكة والقاعدة سليمتان تمامًا (قِستُ الثمانية
   نقاط: كلّها 200). عطلٌ يوقف المنتج كلَّه، ولا يراه أحدٌ قبل التشغيل:

     • `node --check` يمرّ — الاسم غير المعرَّف خطأ **تشغيل** لا صياغة.
     • `check-i18n-parity` و`check-spec-mirror` و`check-api-messages`
       و`check-mirrors` كلّها تفحص **النصوص والمرايا** لا المعرّفات.
     • و`test-pure` يقرأ دوالَّ بعينها ويُقيّمها معزولةً، فلا يمرّ بمسار الرسم.

   وهذا هو **الصنف الذي لا يراه أيّ حارسٍ قائم** — وهو السؤال الذي يوصي به
   `CLAUDE.md` نفسه قبل الاطمئنان إلى أيّ حارس.

   كيف يعمل؟
   ─────────
   بلا مكتبة تحليل (المشروع بلا تبعيات بناء). يُجرَّد المصدر من التعليقات
   والنصوص، ثمّ:
     ① تُجمَع **التعريفات**: function · class · const/let/var · التفكيك ·
       ومعامِلات كل دالّة وسهم (وإلّا صار كل `cb()` بلاغًا كاذبًا).
     ② تُجمَع **الاستعمالات**: ما هو في موضع نداء `اسم(` وليس قبله نقطة،
       وكل اسمٍ صارخ `SCREAMING_CASE` ليس مفتاحَ كائن ولا خاصّيةً.
     ③ يُطرح من ② كلُّ ①، وكلُّ ما في قائمة عوالم المتصفّح البيضاء.

   ⚠️ الفحص **تقريبيّ بطبيعته** فلا يدّعي إثبات السلامة: يمسك الصنف الذي
      يقتل الشاشة (اسمٌ لم يُكتب له تعريفٌ قطّ) ولا يمسك اسمًا معرَّفًا في
      نطاقٍ خاطئ. وهذا مكتوبٌ هنا كي لا يُقرأ مرورُه ضمانًا ليس فيه —
      وهي نفس زلّة «اختبارٌ يمرّ دائمًا» المسجَّلة في `CLAUDE.md`.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ── ما يوفّره المتصفّح/كابستور، فلا يُطلَب تعريفه في الملفّ ── */
const GLOBALS = new Set([
  // لغة
  'Object','Array','String','Number','Boolean','Symbol','BigInt','Math','JSON','Date','RegExp',
  'Error','TypeError','RangeError','SyntaxError','ReferenceError','EvalError','URIError',
  'Promise','Proxy','Reflect','Map','Set','WeakMap','WeakSet','Function','Intl',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'encodeURI','decodeURI','eval','globalThis','undefined','NaN','Infinity',
  'ArrayBuffer','Uint8Array','Int8Array','Uint16Array','Int16Array','Uint32Array','Int32Array',
  'Float32Array','Float64Array','DataView','structuredClone','queueMicrotask',
  // متصفّح
  'window','document','navigator','location','history','screen','localStorage','sessionStorage',
  'console','fetch','Request','Response','Headers','Blob','File','FileReader','FormData','URL',
  'URLSearchParams','AbortController','AbortSignal','DOMException','DOMParser','XMLSerializer',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame',
  'cancelAnimationFrame','requestIdleCallback','cancelIdleCallback',
  'alert','confirm','prompt','matchMedia','getComputedStyle','scrollTo','scrollBy','open','close',
  'Element','HTMLElement','Node','NodeList','Event','CustomEvent','MouseEvent','KeyboardEvent',
  'PointerEvent','TouchEvent','IntersectionObserver','MutationObserver','ResizeObserver',
  'PerformanceObserver','performance','crypto','atob','btoa','TextEncoder','TextDecoder',
  'WebSocket','EventSource','Worker','Image','Audio','Option','CSS','MediaQueryList',
  'ViewTransition','CanvasRenderingContext2D','Notification','caches','indexedDB',
  // وحدات/كابستور
  'require','module','exports','process','__dirname','__filename','Capacitor',
]);

/* ── تجريد التعليقات والنصوص ──
   ⚠️ **بدائل النصّ محارف مسافة بالطول نفسه** لا حذفٌ: كي تبقى أرقام الأسطر
      صحيحةً في البلاغ. وتمييز `/` القاسمة من `/` بداية التعبير النمطي يتمّ
      بآخر محرفٍ ذي معنى قبلها — وهو الحسم نفسه الذي يستعمله كل مُصغِّر. */
function strip(src){
  let out = '';
  let i = 0, prev = '';
  const push = (s) => { out += s; };
  const blank = (s) => { push(s.replace(/[^\n]/g, ' ')); };
  while (i < src.length){
    const c = src[i], c2 = src[i+1];
    if (c === '/' && c2 === '/'){ let j = src.indexOf('\n', i); if (j < 0) j = src.length; blank(src.slice(i, j)); i = j; continue; }
    if (c === '/' && c2 === '*'){ let j = src.indexOf('*/', i+2); j = j < 0 ? src.length : j+2; blank(src.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'" || c === '`'){
      let j = i+1;
      while (j < src.length){ if (src[j] === '\\'){ j += 2; continue; } if (src[j] === c) break; j++; }
      j = Math.min(j+1, src.length);
      blank(src.slice(i, j)); i = j; prev = '"'; continue;
    }
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^<>]/.test(prev)){          // تعبير نمطي لا قسمة
      let j = i+1, cls = false;
      while (j < src.length){
        if (src[j] === '\\'){ j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        else if (src[j] === '\n') break;
        j++;
      }
      if (src[j] === '/'){ while (/[gimsuyd]/.test(src[j+1]||'')) j++; j++; blank(src.slice(i, j)); i = j; prev = '/'; continue; }
    }
    push(c);
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const IDENT = '[A-Za-z_$][A-Za-z0-9_$]*';
const KEYWORDS = new Set(['if','for','while','switch','catch','return','typeof','function','new','delete',
  'void','in','of','do','else','case','try','finally','throw','await','yield','class','extends','super',
  'this','null','true','false','async','const','let','var','instanceof','with','debugger','import','export','from','as','static','get','set']);

function declaredNames(code){
  const out = new Set();
  const add = (n) => { if (n && !KEYWORDS.has(n)) out.add(n); };

  for (const m of code.matchAll(new RegExp(`\\b(?:function|class)\\s*\\*?\\s*(${IDENT})`, 'g'))) add(m[1]);
  /* ⚠️ **جملة الإعلان تُمسَح إلى نهايتها لا يُلتقط أوّلُ اسمٍ فيها**:
     `const OBS_KEY = '…', OBS_VER = '2';` تُعرِّف اسمين، والregex الساذجة
     تلتقط الأوّل وحده فيصير الثاني بلاغًا كاذبًا — وبلاغٌ كاذب واحد يكفي
     ليُعطَّل الحارس كلُّه. المسح يقف عند `;` أو سطرٍ جديد على العمق صفر. */
  for (const m of code.matchAll(/\b(?:const|let|var)\s+/g)){
    let i = m.index + m[0].length, depth = 0, seg = '';
    while (i < code.length){
      const c = code[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
      else if (depth === 0 && (c === ';' || c === '\n')) break;
      seg += c; i++;
    }
    // على العمق صفر: كل معرّف يليه `=` أو `,` أو نهاية الجملة هو تسمية
    let d = 0, buf = '';
    for (let k = 0; k <= seg.length; k++){
      const c = seg[k] ?? ',';
      if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) d--;
      if (d === 0 && (c === '=' || c === ',')){
        const ids = buf.match(new RegExp(IDENT, 'g')) || [];
        // التفكيك يعطي أكثر من اسم، والتسمية البسيطة اسمًا واحدًا — وكلاهما يُضاف
        if (buf.includes('{') || buf.includes('[')) ids.forEach(add); else if (ids.length === 1) add(ids[0]);
        buf = ''; if (c === '=') { // تخطَّ القيمة حتى الفاصلة على العمق صفر
          let dd = 0; k++;
          while (k < seg.length){ const q = seg[k];
            if ('([{'.includes(q)) dd++; else if (')]}'.includes(q)) dd--;
            else if (q === ',' && dd === 0) break; k++; }
        }
        continue;
      }
      buf += c;
    }
  }
  // تفكيك: كل معرّف داخل {…} أو […] بعد const/let/var
  for (const m of code.matchAll(/\b(?:const|let|var)\s*([{[][^;=]*?[}\]])\s*=/g))
    for (const id of m[1].matchAll(new RegExp(IDENT, 'g'))) add(id[0]);
  // معامِلات: كل ما بين قوسي دالّة أو سهم، وقوس catch، وحلقات for..of/in
  for (const m of code.matchAll(new RegExp(`\\bfunction\\s*\\*?\\s*(?:${IDENT})?\\s*\\(([^)]*)\\)`, 'g')))
    for (const id of m[1].matchAll(new RegExp(IDENT, 'g'))) add(id[0]);
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g))
    for (const id of m[1].matchAll(new RegExp(IDENT, 'g'))) add(id[0]);
  for (const m of code.matchAll(new RegExp(`(${IDENT})\\s*=>`, 'g'))) add(m[1]);
  for (const m of code.matchAll(new RegExp(`\\bcatch\\s*\\(\\s*(${IDENT})`, 'g'))) add(m[1]);
  // اختصار الدوالّ داخل الكائنات:  name(a,b){  ⇒ الاسم مُعرَّف كخاصّية، ومعامِلاته محلّية
  for (const m of code.matchAll(new RegExp(`(${IDENT})\\s*\\(([^)]*)\\)\\s*\\{`, 'g')))
    for (const id of m[2].matchAll(new RegExp(IDENT, 'g'))) add(id[0]);
  return out;
}

function usedNames(code){
  const calls = new Map(), consts = new Map();
  const lineOf = (idx) => code.slice(0, idx).split('\n').length;

  /* ① موضع نداء: اسم( — وليس قبله نقطة (خاصّية) ولا كلمة مفتاحية.
     ⚠️ و**تعريفُ دالّةٍ داخل كائن يُقرأ نداءً** إن لم يُستثنَ: `closeAll(except){`
        شكلها شكل النداء تمامًا. الفارق الوحيد ما بعد القوس المُغلِق المقابل —
        `{` تعني تعريفًا لا نداءً — ولا يُعرَف إلّا بموازنة الأقواس فعلًا. */
  for (const m of code.matchAll(new RegExp(`(^|[^.\\w$])(${IDENT})\\s*\\(`, 'g'))){
    const n = m[2];
    if (KEYWORDS.has(n)) continue;
    let i = code.indexOf('(', m.index + m[1].length), depth = 0;
    for (; i < code.length; i++){
      if (code[i] === '(') depth++;
      else if (code[i] === ')' && --depth === 0) break;
    }
    const after = code.slice(i + 1).match(/^\s*(.)/);
    if (after && after[1] === '{') continue;                    // تعريف لا نداء
    if (!calls.has(n)) calls.set(n, lineOf(m.index));
  }
  // ② ثابت صارخ: ليس خاصّية (.X) ولا مفتاح كائن (X:) ولا تسميةً (X =)
  for (const m of code.matchAll(/(^|[^.\w$])([A-Z][A-Z0-9_]{2,})\b\s*([:=]?)/g)){
    const n = m[2], after = m[3];
    if (after === ':' || after === '=') continue;
    if (!consts.has(n)) consts.set(n, lineOf(m.index));
  }
  return { calls, consts };
}

/* ── التشغيل ── */
const TARGETS = [
  { file: 'app/src/app.js',    label: 'التطبيق' },
  { file: 'app/src/native.js', label: 'طبقة أندرويد' },
];

let bad = 0, scanned = 0;
for (const t of TARGETS){
  const p = path.join(ROOT, t.file);
  if (!fs.existsSync(p)) continue;
  const code = strip(fs.readFileSync(p, 'utf8'));
  const dec = declaredNames(code);
  const { calls, consts } = usedNames(code);
  scanned++;

  const miss = [];
  for (const [n, line] of calls) if (!dec.has(n) && !GLOBALS.has(n)) miss.push([n, line, 'نداء']);
  for (const [n, line] of consts) if (!dec.has(n) && !GLOBALS.has(n)) miss.push([n, line, 'ثابت']);
  miss.sort((a, b) => a[1] - b[1]);

  if (miss.length){
    bad += miss.length;
    // العدد خارج العنوان: «4 اسمًا» خطأ و«4 أسماء» صواب، وصيغةُ جملةٍ تصحّ مع أيّ عدد
    console.error(`\n  ✗ ${t.file} — أسماء مستعمَلة بلا تعريف، عددها ${miss.length}:`);
    for (const [n, line, kind] of miss) console.error(`      ${t.file}:${line}  ${n}  (${kind})`);
  }
}

if (bad){
  console.error(`\n  الاسم المستعمَل بلا تعريف يرمي ReferenceError عند أوّل مرور،`);
  console.error(`  فتتوقّف الدالّة الحاوية كلّها — وقد تكون هي التي ترسم الشاشة.\n`);
  process.exit(1);
}
console.log(`  ✓ check-globals: ${scanned} ملفًّا — لا اسم مستعمَل بلا تعريف`);
