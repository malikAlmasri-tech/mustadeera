/* Compares FIELD_SPECS in app/src/app.js against its mirror in site/admin.html.
   Drift here is silent and expensive: the panel writes a value the app cannot
   translate, so the app simply does not draw it and nobody sees why. */
const fs = require('fs');

function slice(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('marker not found: ' + marker);
  let i = src.indexOf(src[start] === 'v' || src[start] === 'c' ? '{' : '{', start);
  i = src.indexOf('{', start);
  let depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return src.slice(src.indexOf('{', start), i + 1); }
  }
  throw new Error('unbalanced: ' + marker);
}
function sliceArr(src, marker) {
  const start = src.indexOf(marker);
  let i = src.indexOf('[', start), depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return src.slice(src.indexOf('[', start), i + 1); }
  }
  throw new Error('unbalanced arr: ' + marker);
}

const app = require('./app-source.cjs').read();
const adm = fs.readFileSync('site/admin.html', 'utf8');

const FIELD_SPECS = eval('(' + slice(app, 'const FIELD_SPECS = {') + ')');
const COMMON = eval('(' + sliceArr(app, 'const FIELD_SPECS_COMMON = [') + ')');
const SPORT_KEYS = eval('(' + sliceArr(app, "const SPORT_KEYS = [") + ')');

const SPEC_ORDER = eval('(' + slice(adm, 'var SPEC_ORDER = {') + ')');
const SPEC_COMMON = eval('(' + sliceArr(adm, "var SPEC_COMMON = [") + ')');
const SPEC_VALS = eval('(' + slice(adm, 'var SPEC_VALS = {') + ')');
const SPEC_BY_SPORT = eval('(' + slice(adm, 'var SPEC_VALS_BY_SPORT = {') + ')');
const SPORTS_ADM = eval('(' + sliceArr(adm, 'var SPORTS = [') + ')');

const problems = [];

// sports themselves
const admKeys = SPORTS_ADM.map(s => s.key);
if (JSON.stringify(admKeys) !== JSON.stringify(SPORT_KEYS)) {
  problems.push(`sport list differs\n  app:   ${SPORT_KEYS}\n  admin: ${admKeys}`);
}
if (JSON.stringify(COMMON.map(s => s.key)) !== JSON.stringify(SPEC_COMMON)) {
  problems.push(`common spec order differs\n  app:   ${COMMON.map(s => s.key)}\n  admin: ${SPEC_COMMON}`);
}

for (const sport of SPORT_KEYS) {
  const appList = (FIELD_SPECS[sport] || []);
  const admList = (SPEC_ORDER[sport] || []);
  if (JSON.stringify(appList.map(s => s.key)) !== JSON.stringify(admList)) {
    problems.push(`[${sport}] spec order differs\n  app:   ${appList.map(s => s.key)}\n  admin: ${admList}`);
  }
  for (const spec of appList.concat(COMMON)) {
    const admVals = ((SPEC_BY_SPORT[sport] || {})[spec.key] || SPEC_VALS[spec.key] || []).map(v => v[0]);
    if (JSON.stringify(spec.opts) !== JSON.stringify(admVals)) {
      problems.push(`[${sport}.${spec.key}] options differ\n  app:   ${spec.opts}\n  admin: ${admVals}`);
    }
  }
}

// every option the app declares must have a label in BOTH languages, or the
// app silently refuses to draw it (fieldSpecChips).
const I18N_start = app.indexOf('const I18N = {');
const i18nLit = slice(app, 'const I18N = {');
const I18N = eval('(' + i18nLit + ')');
for (const sport of SPORT_KEYS) {
  for (const spec of (FIELD_SPECS[sport] || []).concat(COMMON)) {
    for (const lk of ['specL_' + spec.key]) {
      if (!I18N.ar[lk] || !I18N.en[lk]) problems.push(`missing label ${lk} (ar:${!!I18N.ar[lk]} en:${!!I18N.en[lk]})`);
    }
    for (const v of spec.opts) {
      if (v === spec.hideWhen) continue;      // never drawn, so no label needed
      const vk = 'spec_' + spec.key + '_' + v;
      if (!I18N.ar[vk] || !I18N.en[vk]) problems.push(`missing value label ${vk} (ar:${!!I18N.ar[vk]} en:${!!I18N.en[vk]})`);
    }
  }
}

if (problems.length) { console.log('MIRROR DRIFT:\n' + problems.map(p => ' - ' + p).join('\n')); process.exit(1); }
console.log('mirror OK — app.js FIELD_SPECS and admin.html agree, and every drawable option has ar+en labels');
