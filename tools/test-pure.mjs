/* Unit tests for the pure functions in app/src/app.js.
 *
 * WHY THESE, AND WHY THIS WAY
 * ---------------------------
 * `npm test` was `exit 1` against 7,300 lines of app.js and 23 migrations. All
 * checking was manual and visual, which is why bugs like "0 active users" and
 * the flipped "+15%" survived whole batches: nothing re-ran the arithmetic.
 *
 * These are the functions where wrong answers are silent — no exception, no
 * blank screen, just a number or a string that is quietly incorrect. They are
 * also the ones with no DOM and no network, so they need neither.
 *
 * app.js is one big IIFE with no exports (it ships inlined into an APK, so
 * modules would buy nothing). Rather than restructure the app for the tests,
 * the source is read and the functions under test are evaluated in isolation.
 * That keeps the tested code byte-identical to the shipped code — a copy in a
 * test file would drift, and a drifted copy passes while production breaks.
 *
 *   node tools/test-pure.mjs
 */
import fs from 'node:fs';
/* مصدر التطبيق مجموعًا من أجزائه الخمسة — القائمة تُقرأ من `build.ps1` نفسه
   فلا تنحرف عمّا يُشحَن فعلًا. (كان الملفّ واحدًا قبل تقسيم الدفعة ٣٣.) */
import appSource from './app-source.cjs';

const src = appSource.read();

/* A `/` is a comment, a division, or the start of a regex literal, and only
 * context tells you which. Getting it wrong is not a near miss: `isHttpUrl`
 * contains `/^https?:\/\//i`, whose `\/\/` reads as a line comment to a naive
 * scanner — it swallowed the rest of the line, never saw the closing brace, and
 * extracted 6,187 lines instead of one. The symptom was a duplicate-identifier
 * error naming a completely different function.
 *
 * A regex can only begin where a value is expected, which is exactly after an
 * operator, an opening bracket, or a keyword — never after an identifier, a
 * literal, or a closing bracket. That distinction is enough here. */
const BEFORE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', 'return', 'typeof']);
function regexCanStartAfter(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  if (BEFORE_REGEX.has(src[j])) return true;
  const word = src.slice(Math.max(0, j - 8), j + 1).match(/[a-z]+$/);
  return !!(word && BEFORE_REGEX.has(word[0]));
}

/** Pull a top-level `function name(...)` or `const name = ...;` out of the
 *  source by brace/paren matching. Regex would stop at the first `}` inside a
 *  string or a nested block. */
function extract(name) {
  const patterns = [
    new RegExp(`function ${name}\\s*\\(`),
    new RegExp(`const ${name}\\s*=`),
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    const start = m.index;
    if (re.source.startsWith('function')) {
      const open = src.indexOf('{', src.indexOf(')', start));
      let depth = 0, inStr = null;
      for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
        if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
        if (c === '/' && src[i + 1] !== '/' && regexCanStartAfter(src, i)) { inStr = '/'; continue; }
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
      }
    } else {
      /* const … = <expr>;  — stop at the semicolon that is not inside anything.
         ⚠️ Comments must be skipped BEFORE quote handling, not after. This
         codebase comments in Arabic and quotes identifiers in backticks, so a
         scanner that sees ` inside a comment enters template-literal mode and
         runs away for hundreds of lines — which is exactly what happened, and
         it surfaced as "Identifier 'digits' has already been declared" from a
         completely unrelated extraction. */
      let depth = 0, inStr = null;
      for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
        if (c === '/' && src[i + 1] !== '/' && regexCanStartAfter(src, i)) { inStr = '/'; continue; }
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ';' && depth === 0) return src.slice(start, i + 1);
      }
    }
  }
  throw new Error('could not extract: ' + name);
}

const NAMES = ['normalizePhone', 'JO_PHONE_RE', 'validPhone', 'digits', 'isHttpUrl',
               'normalizeSlotsKeyword', 'parseSlots', 'DEFAULT_SLOTS', 'enSlotLabel',
               'normSize', 'countNoun', 'slotsToKeyword', 'replySpeedText',
               /* العمولة المتدرّجة (ترحيل 34) — ومعها تبعاتها، فالدالّة تقرأ
                  `CONFIG` وأربعةَ قارئي حقول. تُستخرَج كلُّها من المصدر نفسه
                  ولا تُنسَخ هنا: نسخةٌ في ملفّ اختبار تنحرف، والمنحرفة تمرّ. */
               'CONFIG', 'normStatus', 'isOwnerManual', 'bkDate', 'bkKey', 'bkMade',
               'monthIdx', 'commissionRules', 'commissionByBooking', 'commissionTotal'];
/* `LIVE_RULES` مُعرَّفة بـ`let` في المصدر، و`extract` يعرف `function` و`const`
   وحدهما. وقيمتها هنا `null` عمدًا — أي «لم يصل ردّ الخادم بعد» ⇒ الحساب يقع
   على افتراضات `CONFIG`، وهي الحالة التي تُختبَر. */
const bundle = 'let LIVE_RULES = null;\n' + NAMES.map(extract).join('\n');
const api = new Function(`${bundle}\nreturn {${NAMES.join(',')}};`)();

/* ── the harness ─────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const groups = [];
function describe(name, fn) { groups.push(name); fn(); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.log(`  FAIL  ${groups.at(-1)} :: ${what}\n        expected ${e}\n        actual   ${a}`); }
}

/* ── phone identity ──────────────────────────────────────────────────────── */
describe('normalizePhone', () => {
  const n = api.normalizePhone;
  eq(n('0790123456'),     '962790123456', 'leading 07');
  eq(n('+962790123456'),  '962790123456', 'plus prefix');
  eq(n('00962790123456'), '962790123456', 'international 00');
  eq(n('962790123456'),   '962790123456', 'already normal');
  eq(n(' 079 012 3456 '), '962790123456', 'spaces stripped');
  /* The regression that made two accounts for one person: this form used to
     pass validation untouched and derive its own login e-mail. */
  eq(n('790123456'), '962790123456', 'bare 79 without the zero');
  eq(n('780123456'), '962780123456', 'bare 78');
  eq(n('770123456'), '962770123456', 'bare 77');
  /* All four spellings must land on ONE identity, or the "a customer is a
     phone number" reporting in /admin counts one person as four. */
  eq(new Set(['0790123456', '+962790123456', '00962790123456', '790123456'].map(n)).size,
     1, 'every spelling collapses to one identity');
});

describe('validPhone', () => {
  const v = api.validPhone;
  eq(v('0790123456'), true,  'ordinary mobile');
  eq(v('790123456'),  true,  'bare form is valid once normalised');
  eq(v('064612345'),  false, 'landline is not an account identity');
  eq(v('07901234'),   false, 'too short');
  eq(v('07901234567'), false, 'too long');
  eq(v('0760123456'), false, 'no such Jordanian mobile prefix (76)');
  eq(v(''),           false, 'empty');
  eq(v('abcdefghi'),  false, 'nine non-digits used to pass the old length check');
});

/* ── links reaching the DOM ──────────────────────────────────────────────── */
describe('isHttpUrl', () => {
  const u = api.isHttpUrl;
  eq(u('https://maps.app.goo.gl/x'), true,  'https');
  eq(u('http://example.com'),        true,  'http');
  eq(u('  https://x.test  '),        true,  'trimmed');
  eq(u('javascript:alert(1)'),       false, 'javascript scheme');
  eq(u('JaVaScRiPt:alert(1)'),       false, 'mixed case does not help');
  eq(u('\tjava\nscript:alert(1)'),   false, 'embedded whitespace does not help');
  eq(u('data:text/html,<script>'),   false, 'data scheme');
  eq(u('//evil.test'),               false, 'protocol-relative');
  eq(u(''),                          false, 'empty');
  eq(u(null),                        false, 'null');
});

/* ── slots ───────────────────────────────────────────────────────────────── */
describe('slot labels', () => {
  const slots = api.parseSlots('full');
  const at = (h) => slots.find(s => Number(s.hour) === h);
  eq(slots.length, 8, 'full day has eight slots');
  /* The bug: hour 10 and hour 22 carried the same string, so nothing on a
     booking card, a review sheet, a notification or the WhatsApp message told
     10am from 10pm. */
  eq(at(10).label, '10:00 ص - 12:00 م', '10:00 morning says ص');
  eq(at(22).label, '10:00 - 12:00 م',   '10:00 evening unchanged');
  eq(new Set(slots.map(s => s.label)).size, slots.length, 'every label is unique');

  eq(api.parseSlots('morning').length, 3, 'morning set');
  eq(api.parseSlots('evening').length, 4, 'evening set');
  eq(api.parseSlots('').length, api.DEFAULT_SLOTS.length, 'empty falls back to defaults');
  eq(api.parseSlots('garbage').length, api.DEFAULT_SLOTS.length, 'garbage falls back');
  eq(api.parseSlots('8=ثمانية|10=عشرة').map(s => s.hour), [8, 10], 'explicit pairs');
  /* Round-trip: the keyword the panel stores must survive being expanded and
     collapsed again, or a field silently changes its opening hours on save. */
  ['full', 'morning', 'evening'].forEach(k =>
    eq(api.slotsToKeyword(api.normalizeSlotsKeyword(k)), k, `round-trip ${k}`));
});

describe('enSlotLabel', () => {
  const e = api.enSlotLabel;
  eq(e(10, 12), '10:00 AM - 12:00 PM',   'morning slot names both meridiems');
  eq(e(22, 24), '10:00 PM - 12:00 AM',   'evening slot crosses midnight');
  eq(e(8, 10),  '8:00 - 10:00 AM',       'both AM');
  eq(e(12, 14), '12:00 - 2:00 PM',       'noon is 12 PM not 0');
  /* English was never ambiguous — which is exactly why the Arabic bug survived
     review. Whoever checked the second language passed it. */
  eq(e(10, 12) === e(22, 24), false, 'the two ten-o-clocks differ');
});

/* ── the size filter chips ───────────────────────────────────────────────── */
describe('normSize', () => {
  const s = api.normSize;
  /* `8x8` with a Latin x and `8×8` with a multiplication sign are both in the
     database right now, and each one grows its own filter chip. */
  eq(s('8x8'), s('8×8'), 'latin x and multiplication sign agree');
  eq(s('8 X 8'), s('8x8'), 'spaces and case');
  eq(s('  5×5 '), '5x5', 'trimmed and lowered');
});

/* ── Arabic counted nouns ────────────────────────────────────────────────── */
describe('countNoun', () => {
  const c = api.countNoun;
  const forms = ['ملعب واحد', 'ملعبان', 'ملاعب', 'ملعبًا'];
  eq(c(1, ...forms), 'ملعب واحد', 'one');
  eq(c(2, ...forms), 'ملعبان', 'two');
  eq(String(c(3, ...forms)).includes('ملاعب'), true, 'three to ten take the plural');
  eq(String(c(10, ...forms)).includes('ملاعب'), true, 'ten');
  eq(String(c(11, ...forms)).includes('ملعبًا'), true, 'eleven takes the accusative singular');
  eq(String(c(0, ...forms)).includes('ملاعب'), true, 'zero');
});

/* ── "usually replies within N" ──────────────────────────────────────────────
 * This string is the only place the product tells a player how long the wait
 * is. A wrong unit here is not a typo: it is the difference between "they
 * answer in a quarter of an hour" and "they answer tomorrow", on the screen
 * where the player decides whether to send the request at all. */
describe('replySpeedText', () => {
  const r = api.replySpeedText;
  /* The minutes/hours boundary, from both sides. 59 must not round up into
     hours, and 60 must not stay as "60 minutes". */
  eq(r(59, 'en'),  '59 minutes', '59 stays in minutes');
  eq(r(60, 'en'),  '1 hour',     '60 becomes exactly one hour');
  eq(r(61, 'en'),  '1 hour',     '61 rounds to one hour, not 1.0166');
  eq(r(90, 'en'),  '1.5 hours',  'one decimal place where it earns its keep');
  eq(r(120, 'en'), '2 hours',    'two hours is an integer again');
  /* A median of 0 means "under a minute", and "within 0 minutes" is not a
     sentence. One minute is the floor and it stays true. */
  eq(r(0, 'en'), '1 minute', 'zero floors to one minute');
  eq(r(1, 'en'), '1 minute', 'one');
  /* Anything that is not a positive number returns the empty string, and the
     caller renders no line at all — m5: we say nothing about what we do not
     measure. */
  eq(r(null, 'en'),      '', 'null');
  eq(r(undefined, 'en'), '', 'undefined');
  eq(r('soon', 'en'),    '', 'not a number');
  eq(r(NaN, 'en'),       '', 'NaN');
  eq(r(-5, 'en'),        '', 'negative');
  /* Arabic counted nouns: the number changes the noun, and 1 and 2 drop the
     numeral entirely. */
  eq(r(1, 'ar'),   'دقيقة واحدة', 'one minute in Arabic drops the numeral');
  eq(r(2, 'ar'),   'دقيقتان',     'two minutes is a dual');
  eq(r(15, 'ar'),  '15 دقيقة',    'eleven and up take the accusative singular');
  eq(r(5, 'ar'),   '5 دقائق',     'three to ten take the plural');
  eq(r(60, 'ar'),  'ساعة واحدة',  'one hour');
  eq(r(120, 'ar'), 'ساعتان',      'two hours is a dual');
  eq(r(240, 'ar'), '4 ساعات',     'four hours takes the plural');
  /* A decimal keeps the noun singular in Arabic — "1.5 ساعات" is wrong. */
  eq(r(90, 'ar'),  '1.5 ساعة',    'a fraction singularises the noun');
});

/* ── العمولة المتدرّجة (ترحيل 34) ─────────────────────────────────────────
   أخطر حسابٍ في المنتج يصمت حين يخطئ: رقمٌ أعلى أو أدنى بقليل لا يرمي خطأً
   ولا يُفرغ شاشة — تقرأ اللوحة ربحًا وتقرأ القاعدة غيره. وكلّ تأكيدٍ هنا
   محسوبٌ باليد من نصّ النموذج، لا من مخرَج الدالّة نفسها. */
describe('commissionByBooking', () => {
  const total = api.commissionTotal;
  const map = api.commissionByBooking;
  /* حجزٌ بأقلّ ما يلزم. التاريخ هو ما يرتّب ويُجمّع، والسعر ما يُضرَب. */
  const mk = (id, field, date, price, extra) => Object.assign(
    { booking_id: String(id), field_id: field, date, hour: 20, price,
      status: 'confirmed', source: 'direct', timestamp: date + 'T00:00:00Z' }, extra || {});
  /* حجوزاتٌ متتالية في شهرٍ واحد على ملعبٍ واحد */
  /* ⚠️ المعرّف يحمل الشهر: الخريطة مفاتيحها معرّفات الحجوزات، ومعرّفان
     متطابقان يبتلع أحدهما الآخر. في الإنتاج هي `uuid` مفتاحٌ أوّليّ فلا
     تتكرّر — وفي المعطى الاصطناعي تتكرّر إن لم يُذكر الشهر. */
  const run = (n, price, field, month) => Array.from({ length: n }, (_, i) =>
    mk(`${field}-${month}-${i}`, field, `${month}-${String((i % 28) + 1).padStart(2, '0')}`, price,
       { timestamp: `${month}-01T${String(i % 24).padStart(2, '0')}:00:00Z`, hour: i % 24 }));
  /* أشهر الانضمام مُطفأة في اختبارات الشرائح كي تُقاس الشريحة وحدها */
  const noFree = { free: 0 };

  // ① داخل الشريحة الأولى: نسبةٌ واحدة لا غير
  eq(total(run(3, 40, 'F1', '2026-03'), noFree), 12, '3 × 40 × 10٪');

  // ② العبور إلى الشريحة الثانية عند الحجزة ٣١
  eq(total(run(32, 40, 'F1', '2026-03'), noFree), 123.2, '30 بـ10٪ ثمّ 2 بـ4٪');

  /* ③ السقف — والرقم مرجعيّ في الشيت نفسه: عند سعر ٤٠ يُبلَغ عند الحجزة ٥٥
     (‏120 + 25×1.6 = 160)، وما بعدها لا يزيد شيئًا مهما حجز. */
  eq(total(run(55, 40, 'F1', '2026-03'), noFree), 160, 'الحجزة ٥٥ تبلغ السقف بالضبط');
  eq(total(run(60, 40, 'F1', '2026-03'), noFree), 160, 'ما بعد السقف لا يزيد');
  eq(total(run(90, 40, 'F1', '2026-03'), noFree), 160, 'ولا يزيد مهما بعُد');

  // ④ سقفٌ صفر = بلا سقف (اتّفاقٌ مكتوب في الشيت وفي الترحيل)
  eq(total(run(60, 40, 'F1', '2026-03'), { free: 0, cap: 0 }), 168, 'cap=0 ⇒ بلا قصّ');

  /* ⑤ العدّاد **لكلّ ملعبٍ فرعيّ لا لكلّ مكان** — وهو مفتاح النموذج كلّه:
     ملعبان لكلٍّ ٣٠ حجزة يدفعان ١٢٠+١٢٠، لا ١٢٠ ثمّ ٤٪ على الثاني. */
  eq(total([...run(30, 40, 'F1', '2026-03'), ...run(30, 40, 'F2', '2026-03')], noFree),
     240, 'ملعبان × ٣٠ = ١٢٠ لكلٍّ');

  // ⑥ ويصفّر أوّل كلّ شهرٍ ميلادي
  eq(total([...run(30, 40, 'F1', '2026-03'), ...run(30, 40, 'F1', '2026-04')], noFree),
     240, 'شهران × ٣٠ على نفس الملعب = ١٢٠ لكلٍّ');

  /* ⑦ شهر الانضمام مجّانيّ بالكامل — والأوّل يُشتقّ من البيانات: أصغرُ شهرٍ
     فيه حجزٌ محتسَبٌ لذلك الملعب. */
  const twoMonths = [...run(3, 40, 'F1', '2026-03'), ...run(3, 40, 'F1', '2026-04')];
  eq(total(twoMonths), 12, 'آذار مجّانيّ ونيسان يُحتسَب');
  eq(total(twoMonths, { free: 0 }), 24, 'وبإطفاء المجّانيّ يُحتسَب الشهران');
  eq(total(twoMonths, { free: 2 }), 0, 'وبشهرين مجّانيّين لا شيء');

  /* ⑧ ما لا يُحتسَب أصلًا: غيرُ المؤكّد، وحجزُ المالك بيده — والثاني كان
     يُحتسَب في `/admin` ولا يُحتسَب في التطبيق قبل هذا الترحيل. */
  eq(total(run(3, 40, 'F1', '2026-03').map(b => ({ ...b, status: 'pending' })), noFree), 0, 'المعلّق لا يُحتسَب');
  eq(total(run(3, 40, 'F1', '2026-03').map(b => ({ ...b, status: 'cancelled' })), noFree), 0, 'الملغى لا يُحتسَب');
  eq(total(run(3, 40, 'F1', '2026-03').map(b => ({ ...b, source: 'owner_manual' })), noFree), 0, 'اليدويّ لا يُحتسَب');

  /* ⑨ الترتيب زمنيّ لا بالسعر — «أوّل ثلاثين» تعني الأسبق وقتًا. وبأسعارٍ
     متفاوتة يظهر الفرق: ثلاثون رخيصة أوّلًا ثمّ غاليةٌ واحدة في الشريحة
     الثانية. لو رُتّبت بالسعر لخرج رقمٌ آخر تمامًا. */
  const cheapFirst = [
    ...Array.from({ length: 30 }, (_, i) =>
      mk('c' + i, 'F1', `2026-03-${String(i + 1).padStart(2, '0')}`, 10)),
    mk('big', 'F1', '2026-03-31', 1000),
  ];
  eq(total(cheapFirst, { free: 0, cap: 0 }), 70, '30×10×10٪ + 1000×4٪');

  /* ⑩ الخريطة والمجموع حقيقةٌ واحدة — التجميعات كلّها (يوم · مكان · عميل)
     مبنيّةٌ على أنّ مجموع الخريطة هو المجموع. */
  const mixed = [...run(32, 40, 'F1', '2026-04'), ...run(5, 25, 'F2', '2026-04')];
  const m = map(mixed, noFree);
  let sum = 0; m.forEach(v => { sum += v; });
  eq(Math.round(sum * 100) / 100, total(mixed, noFree), 'مجموع الخريطة = المجموع');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
