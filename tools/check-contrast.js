#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   check-contrast — نسب WCAG محسوبةً من التوكنات نفسها، في الثيمين

   هذا الملفّ يحرس درسًا دفع المشروع ثمنه مرّتين، وهو مسجَّل في `CLAUDE.md`:
   **لون الهوية نصًّا على سطح فاتح يرسب، والعطل لا يُرى في الثيم الليلي إطلاقًا**
   (‏Lime ‎#8CC63E = 2.05:1 على الأبيض · Mint = 2.62:1، وكلاهما 8.5:1 و10:1 على
   البطاقة الداكنة). فمن يفحص ثيمًا واحدًا **يمرّره**. والحساب هنا يفحص الاثنين
   معًا فلا ينجو رقمٌ لأن أحدًا نظر إلى النصف الصحيح.

   وثلاثة تفاصيل تجعل الرقم صادقًا، وكلّها من مزالق مقيسة في هذا المشروع:
     ① **سلاسل `var()` تُحَلّ**: `--ink` تشير إلى `--light-text-primary`، وقارئٌ
       ساذج يقرأ النصّ حرفيًّا فيحسب صفرًا.
     ② **الشفّافية تُركَّب لا تُقرأ**: `rgba(17,24,28,.09)` فوق سطحٍ يُحسَب
       بالتركيب على ذلك السطح — لا بقراءة أقرب لونٍ معتم.
     ③ **الثيم الليلي يرث الجذر**: ما لم يُعَد تعريفه في `body.dark` يبقى كما هو.

   ⚠️ وحدّه: يفحص **أزواجًا مصرَّحة** أدناه، لا كل تركيبٍ ممكن على الشاشة. زوجٌ
      جديد يُضاف هنا بيد — وهذا بالضبط ما يجعله حارسًا لا ضمانًا، ومكتوبٌ كي لا
      يُقرأ مرورُه أوسعَ ممّا هو.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'app/src/app.css'), 'utf8');

/* الأزواج المحروسة: [نصّ, خلفية, أدنى نسبة, وصف] */
const PAIRS = [
  ['--ink',           '--surface', 4.5, 'النصّ الأساسي على البطاقة'],
  ['--ink',           '--cream',   4.5, 'النصّ الأساسي على الخلفية'],
  ['--muted',         '--surface', 4.5, 'النصّ الثانوي على البطاقة'],
  ['--muted',         '--cream',   4.5, 'النصّ الثانوي على الخلفية'],
  ['--warning-ink',   '--surface', 4.5, 'حبر التنبيه (سعرٌ يخالف الأساسي)'],
  ['--auth-lime-ink', '--surface', 4.5, 'حبر الهوية النصّي — وهو الذي رسب مرّتين'],
];

/* ── قراءة التوكنات: آخر تعريفٍ يفوز، كما في الكاسكيد ── */
function scope(re){
  const out = {};
  let m;
  const g = new RegExp(re.source + '\\s*\\{([^{}]*)\\}', 'g');
  while ((m = g.exec(css)))
    for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) out[d[1]] = d[2].trim();
  return out;
}
const ROOT = scope(/(?<![\w.-]):root/);
const DARK = scope(/body\.dark/);

function raw(token, theme){
  let v = (theme === 'dark' ? DARK[token] : undefined) ?? ROOT[token];
  for (let i = 0; i < 12 && v && v.startsWith('var('); i++){
    const next = v.slice(4, v.indexOf(')')).trim();
    v = (theme === 'dark' ? DARK[next] : undefined) ?? ROOT[next];
  }
  return v;
}
function parse(v){
  if (!v) return null;
  v = v.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m){
    const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m){
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}
const over = (fg, bg) => fg[3] >= 1 ? fg : [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat(1);
const lum = (c) => { const f = (x) => { x /= 255; return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4); };
  return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2]); };
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); };

let bad = 0;
for (const theme of ['light','dark']){
  for (const [fgT, bgT, min, label] of PAIRS){
    const fg = parse(raw(fgT, theme)), bg = parse(raw(bgT, theme));
    if (!fg || !bg){ console.error(`  ! تعذّر حلّ ${fgT} أو ${bgT} في ${theme} — أضِف الشكل إلى parse()`); bad++; continue; }
    const r = ratio(over(fg, bg), bg);
    const ok = r >= min;
    if (!ok){ bad++;
      console.error(`  ✗ [${theme === 'light' ? 'نهاري' : 'ليلي'}] ${label}: ${fgT} على ${bgT} = ${r.toFixed(2)}:1 (المطلوب ${min})`); }
    else if (process.env.VERBOSE)
      console.log(`    ${theme === 'light' ? 'نهاري' : 'ليلي'} ${label}: ${r.toFixed(2)}`);
  }
}
if (bad){ console.error(`\n  ولا يُصلَح بتغيير الثيم الذي رصده: القيمة تُقاس في الاثنين.\n`); process.exit(1); }
console.log(`  ✓ check-contrast: ${PAIRS.length * 2} زوجًا في الثيمين — كلّها فوق عتبتها`);
