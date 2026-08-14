/* Every Arabic string returned as `message:` must have an English translation.
 *
 * WHY THIS EXISTS — and why the existing guard could not catch it
 * ---------------------------------------------------------------
 * `check-i18n-parity.js` compares the two I18N tables and passed 939/939. It
 * was right: these strings never go through I18N at all. They are written
 * inline in the API shim (`message:'…'`) and translated at display time by
 * `API_MESSAGE_MAP`, which had 22 of the 25 missing — so an English user was
 * told, in Arabic, that their password was wrong.
 *
 * A test that always passes is more dangerous than no test: it buys confidence
 * with no coverage. The blind spot was never the assertion, it was the scope.
 *
 *   node tools/check-api-messages.js
 */
const fs = require('fs');

const src = require('./app-source.cjs').read();

/* The map, sliced by brace depth rather than by regex: the values contain
   braces, apostrophes and commas of their own. */
function sliceObject(marker) {
  const at = src.indexOf(marker);
  if (at === -1) throw new Error('marker not found: ' + marker);
  const open = src.indexOf('{', at);
  let depth = 0, inStr = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error('unterminated object: ' + marker);
}

const mapBody = sliceObject('const API_MESSAGE_MAP');
const keys = new Set([...mapBody.matchAll(/'((?:[^'\\]|\\.)*)'\s*:/g)].map(m => m[1]));

/* Every literal handed back to the UI as a message. Only Arabic ones matter:
   machine codes (`slot_closed`) are looked up in I18N by dbErrorMessage and are
   covered by check-i18n-parity instead. */
const isArabic = (s) => /[؀-ۿ]/.test(s);
const used = new Set(
  [...src.matchAll(/message:\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]).filter(isArabic)
);

const missing = [...used].filter(m => !keys.has(m));
const stale = [...keys].filter(k => isArabic(k) && !used.has(k));

console.log(`API_MESSAGE_MAP: ${keys.size} keys | message: literals (ar): ${used.size}`);
if (missing.length) {
  console.log('\nNO ENGLISH TRANSLATION — an English user reads these in Arabic:');
  missing.forEach(m => console.log('  - ' + m));
}
/* Stale keys are a warning, not a failure: several come from database
   functions (`player_reschedule_booking` raises Arabic text) and never appear
   as a literal in this file. */
if (stale.length) {
  console.log('\nnote: mapped but not found as a literal here (may come from the DB):');
  stale.forEach(m => console.log('  · ' + m));
}
if (!missing.length) console.log('\nevery returned message has a translation.');
process.exit(missing.length ? 1 : 0);
