const fs = require('fs');
const s = fs.readFileSync(process.argv[2] || 'app/src/app.js', 'utf8');
const start = s.indexOf('const I18N = {');
let i = s.indexOf('{', start), depth = 0, end = -1, inStr = null;
for (; i < s.length; i++) {
  const c = s[i];
  if (inStr) {
    if (c === '\\') { i++; continue; }
    if (c === inStr) inStr = null;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
  if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i) + 1; continue; }
  if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); continue; }
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const lit = s.slice(s.indexOf('{', start), end + 1);
const I18N = eval('(' + lit + ')');
const ar = Object.keys(I18N.ar), en = Object.keys(I18N.en);
const missEn = ar.filter(k => !(k in I18N.en));
const missAr = en.filter(k => !(k in I18N.ar));
console.log('ar keys:', ar.length, '| en keys:', en.length);
console.log('missing in en:', missEn.length ? missEn : '(none)');
console.log('missing in ar:', missAr.length ? missAr : '(none)');
process.exit(missEn.length || missAr.length ? 1 : 0);
