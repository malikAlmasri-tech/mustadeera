#!/usr/bin/env node
/**
 * يجمع المشروع كلّه في ملفّ Markdown واحد صالح للرفع كمصدر محادثة في Claude.
 *
 *   node tools/bundle-project.mjs [مسار-الخرج]
 *
 * ما يدخل: كل ملفّ نصّي متتبَّع في git من مصادر المشروع الفعلية.
 * ما يخرج (ولماذا) مكتوب في EXCLUDE أدناه ويُطبَع في رأس الملفّ نفسه —
 * حتّى يعرف من يقرأ البندل ما الذي لم يره، بدل أن يظنّ أنّه رأى كلّ شيء.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT = process.argv[2] || path.join(ROOT, '..', 'المستديرة-المشروع-كامل.md');

/** مجلّدات تُستثنى، ومعها سبب يُطبَع في الملفّ. */
const EXCLUDE_DIRS = [
  ['public/',        'مخرَج مولَّد من `site/` بأمر البناء — نسخة مطابقة، فوجودها تكرار محض'],
  ['app/www/',       'مخرَج مولَّد من `app/src/` — نفس السبب'],
  ['docs/مراجع/',    'مراجع تصميم أوّلية (نماذج HTML/React من أدوات AI) لا يعتمد عليها الكود'],
  ['ai template/',   'نماذج تصميم أوّلية كذلك'],
  ['.claude/',       'إعدادات أداة التطوير المحلّية، لا علاقة لها بالمنتج'],
  ['android/.idea/', 'إعدادات Android Studio المحلّية'],
  ['android/gradle/','ملفّات wrapper مولَّدة'],
];

/** امتدادات ثنائية — لا تُمثَّل نصًّا. */
const BINARY = /\.(png|jpe?g|webp|gif|ico|svg|ttf|otf|woff2?|apk|aab|keystore|jks|jar|zip|pdf|xlsx|xls|pyc|thumbnail)$/i;

/** ملفّات مفردة تُستثنى. */
const EXCLUDE_FILES = new Set([
  'package-lock.json',   // قفل تبعيّات مولَّد
  '.gitattributes',
]);

/** ترتيب العرض: الأهمّ أوّلًا، لا ترتيب أبجدي. الرقم = وزن الفرز. */
const ORDER = [
  [/^README\.md$/,                    0],
  [/^CLAUDE\.md$/,                    1],
  [/^(package\.json|capacitor\.config\.json|vercel\.json|build\.ps1)$/, 2],
  [/^app\/src\/app\.html$/,           10],
  [/^app\/src\/app\.js$/,             11],
  [/^app\/src\/app\.css$/,            12],
  [/^app\/src\//,                     13],
  [/^app\//,                          14],
  [/^migration\//,                    20],
  [/^supabase\//,                     25],
  [/^site\/strings\//,                30],
  [/^site\/pages\//,                  31],
  [/^site\/partials\//,               32],
  [/^site\/styles\//,                 33],
  [/^site\/scripts\//,                34],
  [/^site\/admin\.html$/,             35],
  [/^site\/build-site\.ps1$/,         36],
  [/^site\/data\//,                   37],
  [/^site\//,                         38],
  [/^tools\//,                        40],
  [/^backend\//,                      45],
  [/^docs\/plans\//,                  50],
  [/^docs\/design-system\//,          51],
  [/^docs\/legal\//,                  52],
  [/^docs\/history\.md$/,             53],
  [/^docs\//,                         54],
  [/^android\//,                      60],
  [/^\.github\//,                     65],
];
const weight = (f) => (ORDER.find(([re]) => re.test(f)) || [null, 70])[1];

const LANG = {
  '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript', '.json': 'json',
  '.html': 'html', '.css': 'css', '.sql': 'sql', '.ps1': 'powershell',
  '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml', '.gs': 'javascript',
  '.gradle': 'groovy', '.xml': 'xml', '.properties': 'ini', '.tex': 'latex',
  '.txt': 'text', '.bat': 'batch',
};

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 28 })
  .toString('utf8').split('\0').filter(Boolean);

const skipped = [];
const files = tracked.filter((f) => {
  const dir = EXCLUDE_DIRS.find(([p]) => f.startsWith(p));
  if (dir) return false;
  if (EXCLUDE_FILES.has(f)) return false;
  if (BINARY.test(f)) { skipped.push(f); return false; }
  try { if (statSync(path.join(ROOT, f)).size === 0) return false; } catch { return false; }
  return true;
}).sort((a, b) => weight(a) - weight(b) || a.localeCompare(b, 'en'));

/** سياج لا يصطدم بما في المحتوى: عدّ أطول سلسلة backtick في أوّل السطر. */
function fenceFor(text) {
  let max = 2;
  for (const m of text.matchAll(/^(`{3,})/gm)) max = Math.max(max, m[1].length);
  return '`'.repeat(max + 1);
}

const N = (n) => n.toLocaleString('en-US');
const parts = [];
let totalBytes = 0;

// ── رأس الملفّ ──────────────────────────────────────────────────────────────
const head = [];
head.push('# المستديرة — المشروع كاملًا في ملفّ واحد');
head.push('');
// ⚠️ بتوقيت عمّان لا UTC: `toISOString()` يعطي UTC، وعمّان **تسبقه ثلاث ساعات** ⇒
// بين منتصف الليل والثالثة فجرًا يطبع البندلُ **تاريخ أمس** على عملٍ جرى اليوم.
// (مقيس 2026-08-11 الساعة 00:48 — خرج «2026-08-10».) وهي نفس زلّة `current_date`
// المسجَّلة في CLAUDE.md، معكوسةَ الاتجاه.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
head.push(`> مولَّد آليًّا بـ\`tools/bundle-project.mjs\` بتاريخ ${today}.`);
head.push('> المستودع: `malikAlmasri-tech/mustadeera` — الفرع `main`.');
head.push('');
head.push('**كيف تقرأ هذا الملفّ:** بعد هذا الرأس يأتي شرحٌ موجز للمشروع، ثمّ فهرس بكلّ ملفّ،');
head.push('ثمّ **محتوى كلّ ملفّ كاملًا** تحت عنوان `## 📄 <مساره في المستودع>` — والبادئة 📄');
head.push('تميّزه عن عناوين `##` التي تحملها ملفّات Markdown نفسها داخل محتواها.');
head.push('لا اختصار ولا اقتطاع: ما تراه هنا هو ما في المستودع حرفًا بحرف.');
head.push('');
head.push('## ما هو المشروع — في عشرة أسطر');
head.push('');
head.push('منصّة حجز **ملاعب رياضية** في الأردن، اسمها «المستديرة». **وجهان اثنان لا ثالث لهما:**');
head.push('');
head.push('| | ما هو | المصدر | المخرَج | الباكند |');
head.push('|---|---|---|---|---|');
head.push('| **التطبيق** | أندرويد مدمج (Capacitor) — **الحجز يجري هنا وحده** | `app/src/` | `app/www/` ⇒ APK | Postgres/Supabase |');
head.push('| **الموقع** | موقع تسويقي ثابت + لوحة `/admin` | `site/` | `public/` ⇒ Vercel | يُولَّد وقت البناء |');
head.push('');
head.push('- **بلا أي مكتبة**: Vanilla JS/HTML/CSS في الوجهين. لا React ولا build step غير `build.ps1`.');
head.push('- **ثنائي اللغة** (عربي RTL / إنجليزي LTR) و**ثيمان** نهاري/ليلي. الهوية: Teal `#0F4B53` + Lime `#8CC63E`.');
head.push('- **خمس رياضات** في التطبيق (قدم · بادل · سلة · تنس · طائرة)، والمفتوح للحجز يُشتقّ من القاعدة:');
head.push('  رياضةٌ لها ملعب نشط واحد هي المفتوحة — لا قيمة `ready` مكتوبة بيد في أيّ من الوجهين.');
head.push('- **الأمان في RLS** لا في الإخفاء: المفتاح `anon` عامّ بالتصميم، والسياسات في `migration/`.');
head.push('- **قاعدة الصدق (م5)** تحكم كلّ نصّ: لا رقم مخترَع ولا نشاط وهمي؛ الحقل الفارغ يقول إنّه فارغ.');
head.push('');
head.push('**أمر البناء (يبني الوجهين معًا):** `powershell -ExecutionPolicy Bypass -File build.ps1`');
head.push('');
head.push('> الحالة التفصيلية وما هو معلَّق على المالك والمزالق المقيسة: كلّها في `CLAUDE.md` أدناه —');
head.push('> وهو أهمّ ملفّ في هذا البندل بعد الكود نفسه. والسجلّ التاريخي في `docs/history.md`.');
head.push('');
head.push('## ما لم يدخل هذا الملفّ');
head.push('');
for (const [p, why] of EXCLUDE_DIRS) head.push(`- **\`${p}\`** — ${why}.`);
head.push(`- **الملفّات الثنائية** (صور · خطوط · PDF · XLSX · APK): ${N(skipped.length)} ملفًّا لا يُمثَّل نصًّا.`);
head.push('- **`package-lock.json`** — قفل تبعيّات مولَّد.');
head.push('- **بيانات العملاء** (`CSV/` · `migration/02` · `migration/03`) — مستثناة بـ`.gitignore` أصلًا لأنّ المستودع عامّ.');
head.push('');
parts.push(head.join('\n'));

// ── الفهرس ─────────────────────────────────────────────────────────────────
const index = ['## الفهرس', ''];
let lastGroup = null;
const bodies = [];
for (const f of files) {
  const abs = path.join(ROOT, f);
  const raw = readFileSync(abs);
  const text = raw.toString('utf8').replace(/\r\n/g, '\n').replace(/﻿/g, '');
  totalBytes += raw.length;
  const lines = text.split('\n').length;
  const group = f.includes('/') ? f.slice(0, f.indexOf('/')) + '/' : '(الجذر)';
  if (group !== lastGroup) { index.push('', `**${group}**`, ''); lastGroup = group; }
  index.push(`- [\`${f}\`](#${f.replace(/[^\w؀-ۿ]+/g, '-').toLowerCase()}) — ${N(lines)} سطر · ${N(raw.length)} بايت`);

  const fence = fenceFor(text);
  const lang = LANG[path.extname(f).toLowerCase()] || '';
  // البادئة 📄 تميّز عنوانَ الملفّ عن عناوين `##` التي تحملها ملفّات Markdown نفسها.
  bodies.push(`## 📄 ${f}\n\n> ${N(lines)} سطر · ${N(raw.length)} بايت\n\n${fence}${lang}\n${text.replace(/\n+$/, '')}\n${fence}`);
}
index.push('');
index.push(`**المجموع: ${N(files.length)} ملفًّا · ${N(totalBytes)} بايت.**`);
parts.push(index.join('\n'));
parts.push('---\n\n# محتوى الملفّات');
parts.push(bodies.join('\n\n---\n\n'));

const out = parts.join('\n\n') + '\n';
writeFileSync(OUT, out, 'utf8');
console.log(`${files.length} files, ${N(totalBytes)} source bytes -> ${OUT} (${N(Buffer.byteLength(out))} bytes)`);
