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
  /* أجزاء التطبيق الخمسة **بترتيب البناء لا الأبجدي**: هي شظايا IIFE واحد
     يضمّها `build.ps1` بهذا الترتيب، وقراءتها مبعثرةً تقلب المعنى — الأسماء
     مرقَّمة فيكفي فرزها أبجديًّا داخل هذا الوزن. */
  [/^app\/src\/app\.\d-[^/]+\.js$/,   11],
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
/* ══════════════════════════════════════════════════════════════════════════
   خريطة الجريان + الحالة الحيّة — ما لا يستطيع الكود أن يقوله عن نفسه.
   البندل يُرفَع إلى نموذجٍ آخر ليقرأ المشروع ويُشير بنصيحة، والنصيحة تفسد
   بأحد أمرين: ألّا يعرف القارئ **كيف تتّصل القطع**، أو أن يفترض أنّ كلّ ما في
   `migration/` مُشغَّلٌ فعلًا على القاعدة الحيّة. الثاني وقع فعلًا في هذا
   المشروع أكثر من مرّة (قارئٌ يقترح إصلاحًا لميزةٍ يظنّها تعمل، وهي معطَّلة
   لأن ترحيلها نصفُه) — فالسطران أدناه يمنعانه.
   ⚠️ **وهذا القسم يُحدَّث بيد** لأنه يصف قياسًا لحظيًّا لا يُشتقّ من الملفّات:
   من غيّر حالة القاعدة أو نشر دالّةً يُحدّثه هنا، وإلّا كذب البندل بثقة.
   ══════════════════════════════════════════════════════════════════════════ */
head.push('## كيف تتّصل القطع — خريطة الجريان');
head.push('');
head.push('```');
head.push('  app/src/{app.html, app.1..5-*.js, app.css}');
head.push('        └─ build.ps1 ─► app/www/index.html (ملفّ واحد مدموج) ─► cap sync ─► APK');
head.push('                                    │');
head.push('  site/{pages,partials,strings,styles}                       ▲');
head.push('        └─ site/build-site.ps1 ─► public/ ─► Vercel          │ REST + RLS');
head.push('                    │  (يقرأ القاعدة وقت البناء لتوليد /places)');
head.push('                    ▼                                        │');
head.push('            Postgres / Supabase ◄───────────────────────────┘');
head.push('              ├─ migration/*.sql   ← المخطّط والسياسات، تُشغَّل بيد المالك');
head.push('              └─ supabase/functions/ai ← دالّة حافّة (لوحات المالك الثلاث)');
head.push('```');
head.push('');
head.push('- **لا خادم تطبيقات ولا ORM**: التطبيق ينادي PostgREST مباشرةً بتوكن المستخدم،');
head.push('  فكلّ ضمانة أمنٍ في المشروع هي **سياسة RLS** في `migration/` لا فحصٌ في JS.');
head.push('- **مصدر التطبيق خمسة ملفّات، وهي شظايا وحدةٍ مغلّفة واحدة (‏IIFE) لا modules.**');
head.push('  كان ملفًّا واحدًا بـ٨٬٦٦٣ سطرًا، فقُسّم للتنقّل والمراجعة — و`build.ps1` يضمّها');
head.push('  **بالترتيب وبلا فاصل**، والمخرَج مطابقٌ بايتًا ببايت لما كان. **والترتيب حامل.**');
head.push('  ⚠️ ولا تُقرأ قطعةٌ منها بـ`node --check` وحدها، ولا تُستورَد: التطبيق بصفر');
head.push('  متغيّرات عامّة، وجعلُها modules يحتاج `export` ⇒ يغيّر المخرَج. فالمكسب');
head.push('  التنقّلُ لا قابليةُ الاختبار — و`test-pure.mjs` ما زال يستخرج الدوالّ من النصّ');
head.push('  عبر `tools/app-source.cjs` الذي يقرأ قائمة الأجزاء من `build.ps1` نفسه.');
head.push('- **الحرّاس تُشغَّل قبل كل التزام**: `npm run check && npm test` (تفصيلها في `CLAUDE.md`).');
head.push('');
head.push('## الحالة الحيّة — مقيسة، لا مستنتَجة من الكود');
head.push('');
head.push('> ⚠️ **اقرأ هذا قبل أن تقترح إصلاحًا.** وجودُ ملفٍّ في `migration/` **لا يعني**');
head.push('> أنّه مُشغَّل على القاعدة، ووجودُ كودٍ في `supabase/functions/` **لا يعني** أنّه');
head.push('> منشور. آخر قياسٍ حيّ بسؤال القاعدة: **2026-08-14**.');
head.push('');
head.push('| | الحالة |');
head.push('|---|---|');
head.push('| `migration/08` … `31` | ✅ **كلّها مُشغَّلة** على القاعدة الحيّة (مؤكَّدة بسؤالها لا بقراءة الملفّات) |');
head.push('| `supabase/functions/ai` | ✅ **منشورة وتعمل**، ومعها `GEMINI_API_KEY` و`AI_MODEL=gemini-flash-latest` في الأسرار |');
head.push('| `supabase/functions/push` | ✅ **منشورة، وإشعارات الدفع تعمل من طرف إلى طرف** — صفٌّ حقيقي أطلق المُشغِّل فوصل الدالّةَ فردّت `200 {sent:false,"reason":"no_token"}`، وهي الإجابة الصحيحة قبل أن يسجّل جهازٌ رمزًا |');
head.push('| مفتاح توقيع APK | ✅ **أُنشئ، والإصدار موقَّع به** (`CN=Al-Mustadira`, v2) **وبلا `debuggable`**، ويخدمه الموقع من أصله |');
head.push('| مزوّد رسائل SMS | ❌ غير مشترًى ⇒ `request_phone_code` تردّ `no_provider` وشاشة التأكيد **لا تحجز أحدًا** |');
head.push('| بوّابة دفع | ❌ لا توجد **بقرار المالك** (النموذج عمولة) ⇒ «فيزا» معطَّلة بشارة «قريباً» والدفع نقدي في الملعب |');
head.push('| متجر Play · نطاق حقيقي | ❌ لم يقعا بعد ⇒ التوزيع بـAPK من الموقع، والنطاق `mustadeera.vercel.app` |');
head.push('| تحليلات الموقع | ❌ لا توجد ⇒ القمع مقطوع عند حدّ الموقع، ولا يُعرَف كم زائرًا وصل `/download` |');
head.push('| بيانات القاعدة اليوم | **7 أماكن · 14 ملعبًا · رياضة واحدة (كرة قدم) · و`fields.gender` كلُّها `null`** — أي أنّ مرشّح «لمن الملعب» مخفيٌّ صحيحًا لا معطوبًا |');
head.push('| الاختبار على جهاز حقيقي | ⛔ **لم يقع بعد — وهو أهمّ ما ينقص.** كلّ القياس في المعاينة، وهي لا ترى WebView أندرويد ولا TalkBack ولا الأداء ولا وصولَ إشعار الدفع |');
head.push('');
head.push('**وما هو معلَّق على المالك بالتفصيل — ومعه سببُ كلّ تأجيل — في رأس `CLAUDE.md`.**');
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
