#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   check-view-parity — عمودٌ في الجدول وخارج العرض

   لماذا وُجد هذا الحارس؟
   ─────────────────────
   `bookings_full` مُعرَّف في `01_schema.sql` بـ`select b.*`، و`*` في تعريف
   عرضٍ **تُفكّ عند الإنشاء لا عند القراءة**: Postgres يخزّن قائمة الأعمدة كما
   كانت لحظتَئذ. فكلّ عمودٍ أضافه ترحيلٌ لاحق إلى `bookings` بقي **خارج العرض**
   بلا خطأ ولا تحذير ولا سطرٍ في سجلّ.

   وقع هذا فعلًا على **خمسة أعمدة عبر ثلاث دفعات**: `cancel_kind` (15) ·
   `no_show` (16) · `visibility` و`players_needed` و`players_brought` (22).
   **والتطبيق يقرأ العرض بينما `/admin` تقرأ الجدول خامًا** ⇒ عُطّلت «لم يحضر»
   والمباريات المفتوحة وتمييز «انقضت المهلة» في التطبيق وحده، **بلا عطلٍ ظاهر**
   لأن `sbBookingsQuery` تتراجع ثلاث جولات فتنجح الأخيرة. فبدت الميزة «غير
   مُفعّلة» لا مكسورة، وبقيت كذلك حتى كشفها فحصٌ عابر.

   وأُصلح بترحيل `30` — **وكُتب العلاج قاعدةً في وثيقة**: «كلّ ترحيلٍ يضيف
   عمودًا إلى `bookings` يجب أن يعيد بناء العرض معه». والقواعد في الوثائق
   تُنسى، والحرّاس لا تُنسى. هذا الملفّ يحوّلها إلى أمر.

   كيف يعمل؟
   ─────────
   ① يقرأ `SB.URL` و`SB.KEY` من `app/src/app.js` **نفسه** لا من نسخةٍ هنا —
     المفتاح `anon` عامّ بالتصميم (الأمان في RLS)، ونسخةٌ ثانية تنحرف.
   ② يستخرج أعمدة `bookings` من `migration/*.sql`: جسم `create table` ومعه
     كلّ `add column` في كلّ `alter table … bookings` (وهي **متعدّدة الأسطر**
     في 16 و22 ⇒ القراءة بالجملة حتى الفاصلة المنقوطة لا بالسطر).
   ③ يسأل الجدول بالقائمة كلّها دفعةً واحدة. و`42703` **يسمّي العمود** في
     رسالته ⇒ يُنزَع ويُعاد السؤال. فالطلبات بعدد المفقود لا بعدد الأعمدة.
     (وما يسقط هنا عمودٌ استخرجه ② ولا وجود له — عمودٌ حُذف أو أُعيدت تسميته.)
   ④ ثمّ يسأل العرض بما ثبت وجوده في الجدول. وكلّ ما يسقط هنا **هو العطل**.

   ⚠️ وغيابُ الشبكة تخطٍّ لا فشل: `npm run check` يُشغَّل بلا إنترنت كثيرًا،
      وحارسٌ يفشل لأن الشبكة مقطوعة حارسٌ يُعطَّل بعد أسبوع. والتخطّي **يقول
      نفسه بصوتٍ عالٍ** فلا يُقرأ مرورًا. أمّا تطابقٌ ناقص فيفشل دائمًا.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appSource from './app-source.cjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = 'bookings';
const VIEW = 'bookings_full';

/* الأعمدة التي يملكها العرض من جداوله الأخرى — ليست من `bookings` فلا تُفحَص */
const VIEW_EXTRA = new Set(['place_name', 'city', 'field_name']);

/* كلماتٌ تبدأ بها أسطرُ القيود داخل `create table` فتُقرأ أعمدةً لو لم تُستثنَ */
const NOT_A_COLUMN = new Set([
  'primary', 'foreign', 'unique', 'check', 'constraint', 'exclude', 'like', 'references',
]);

const fail = (msg) => { console.error(msg); process.exit(1); };

/* ── ① الاتّصال، من `app.js` لا من نسخةٍ هنا ───────────────────────────── */
function readConn() {
  const src = appSource.read();     // خمسة أجزاء مدموجة كما يبنيها build.ps1
  const url = src.match(/URL:\s*'([^']+)'/);
  const key = src.match(/KEY:\s*'([^']+)'/);
  if (!url || !key) fail('check-view-parity: تعذّرت قراءة SB.URL/SB.KEY من مصدر التطبيق');
  return { url: url[1].replace(/\/+$/, ''), key: key[1] };
}

/* ── ② أعمدة الجدول، من الترحيلات ──────────────────────────────────────── */
function columnsFromMigrations() {
  const dir = path.join(ROOT, 'migration');
  const cols = new Set();

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = stripSql(fs.readFileSync(path.join(dir, file), 'utf8'));

    // create table … bookings ( … ) — أعمدةٌ على المستوى الأوّل من الأقواس
    const create = new RegExp(`create\\s+table[^;]*?\\b${TABLE}\\s*\\(`, 'i').exec(sql);
    if (create) {
      const body = balanced(sql, create.index + create[0].length - 1);
      for (const line of splitTopLevel(body)) {
        const name = (line.trim().match(/^"?([a-z_][a-z0-9_]*)"?/i) || [])[1];
        if (name && !NOT_A_COLUMN.has(name.toLowerCase())) cols.add(name.toLowerCase());
      }
    }

    /* alter table … bookings … ; — تُقرأ **بالجملة** حتى الفاصلة المنقوطة:
       الترحيلان 16 و22 يكتبان عدّة `add column` على أسطرٍ تالية تحت رأسٍ واحد،
       وقراءةٌ سطرًا سطرًا تلتقط الأوّل وحده وتترك الباقي — وهي بالضبط الأعمدة
       التي غابت عن العرض. */
    const alter = new RegExp(`alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?${TABLE}\\b([^;]*);`, 'gi');
    for (let m; (m = alter.exec(sql)); ) {
      const add = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
      for (let c; (c = add.exec(m[1])); ) cols.add(c[1].toLowerCase());
    }
  }
  return [...cols].filter((c) => !VIEW_EXTRA.has(c)).sort();
}

/* تجريد التعليقات والنصوص — تعليقٌ يشرح عمودًا لا يُعرِّفه، و`--` تسبق أغلب
   السطور في ملفّات هذا المشروع (رؤوسها نثرٌ طويل). */
function stripSql(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')   // أجسام الدوالّ: فيها create table مؤقّتة أحيانًا
    .replace(/'(?:[^']|'')*'/g, "''");
}

/* جسم الأقواس المتوازنة ابتداءً من `(` عند `i` */
function balanced(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')' && --depth === 0) return s.slice(i + 1, j);
  }
  return '';
}

/* تقسيم على الفواصل التي على المستوى الأوّل — `numeric(10,2)` فاصلتُها ليست فاصلَ عمود */
function splitTopLevel(body) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* ── ③④ السؤال: ما الذي يقبله هذا المسار من هذه الأعمدة؟ ────────────────── */
async function surviving(conn, rel, cols) {
  const missing = [];
  let live = [...cols];

  for (let guard = 0; guard < cols.length + 1; guard++) {
    if (!live.length) break;
    const url = `${conn.url}/rest/v1/${rel}?select=${live.join(',')}&limit=0`;
    const res = await fetch(url, {
      headers: { apikey: conn.key, Authorization: `Bearer ${conn.key}` },
      cache: 'no-store',
    });
    if (res.ok) return { live, missing };

    const body = await res.json().catch(() => ({}));
    if (body.code !== '42703') {
      fail(`check-view-parity: ${rel} ردّ ${res.status} ${body.code || ''} — ${body.message || ''}`);
    }
    // «column bookings_full.no_show does not exist» ⇒ الرسالة تسمّي المفقود
    const named = (String(body.message).match(/column\s+\S*?\.?([a-z_][a-z0-9_]*)\s+does not exist/i) || [])[1];
    if (!named || !live.includes(named)) {
      fail(`check-view-parity: ${rel} ردّ 42703 بلا اسم عمودٍ مقروء — ${body.message || ''}`);
    }
    missing.push(named);
    live = live.filter((c) => c !== named);
  }
  return { live, missing };
}

/* ── التشغيل ───────────────────────────────────────────────────────────── */
const conn = readConn();
const declared = columnsFromMigrations();
if (!declared.length) fail(`check-view-parity: لم يُستخرَج عمودٌ واحد لـ${TABLE} من migration/*.sql`);

/* ⚠️ **السؤالان كلاهما داخل الحماية** لا الأوّل وحده: الشبكة قد تسقط بينهما،
   فيمرّ الجدول ثمّ يرمي العرضُ رميةً غير ملتقطة — وهو فشلٌ يبدو عطلًا في
   الحارس. والسقوطُ بين طلبين ليس نادرًا على شبكةٍ متذبذبة. */
let tableCols, notInTable, notInView;
try {
  ({ live: tableCols, missing: notInTable } = await surviving(conn, TABLE, declared));
  ({ missing: notInView } = await surviving(conn, VIEW, tableCols));
} catch (e) {
  /* شبكةٌ مقطوعة أو مهلة — تخطٍّ صريح لا فشل صامت ولا فشلٌ كاذب */
  console.log(`⚠️  check-view-parity: تُخُطّي — تعذّر الوصول إلى القاعدة (${e.message}).`);
  console.log('   الحارس يحتاج شبكة. شغّله قبل أي دفعة تمسّ ترحيلًا.');
  process.exit(0);
}

if (notInView.length) {
  console.error(`✗ check-view-parity: ${notInView.length} عمودًا في ${TABLE} وخارج ${VIEW}\n`);
  for (const c of notInView) console.error(`    • ${c}`);
  console.error(`
  السبب: \`select b.*\` في تعريف العرض تُفكّ **عند الإنشاء لا عند القراءة**،
  فأعمدةُ الترحيلات اللاحقة تبقى خارجه. والتطبيق يقرأ العرض ⇒ الميزة تبدو
  «غير مُفعّلة» لا مكسورة، لأن الجلب يتراجع ولا يصرخ شيء.

  العلاج: **احذف العرض ثمّ أنشئه** — \`create or replace view\` لا تكفي
  (ترتيب الأعمدة يتغيّر). القالب في migration/30_bookings_full_refresh.sql.`);
  process.exit(1);
}

const skipped = notInTable.length ? `  (وتُجوهل ${notInTable.length} استخرجها التحليل ولا وجود لها: ${notInTable.join(', ')})` : '';
console.log(`✓ check-view-parity: ${tableCols.length} عمودًا في ${TABLE} وكلُّها في ${VIEW}${skipped}`);
