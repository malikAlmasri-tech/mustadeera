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

const src = fs.readFileSync('app/src/app.js', 'utf8');

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
               'normSize', 'countNoun', 'slotsToKeyword'];
const bundle = NAMES.map(extract).join('\n');
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
