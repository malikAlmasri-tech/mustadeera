/* ═══════════════════════════════════════════════════════════════════════════
   مولّد ملفّ الاستيراد: CSV (تصدير Google Sheets) ⟶ migration/02_import.sql

   التشغيل:  node migration/build_import.mjs
   قابل لإعادة التشغيل: صدّر الشيت من جديد وأعد التشغيل ⇒ ملفّ استيراد محدَّث.

   يطبع تقرير تعارضات **قبل** الكتابة (تواريخ فاسدة · معرّفات يتيمة · خانات
   مزدوجة تصطدم بالقيد الفريد) — نراها هنا لا بعد أن يفشل الاستيراد.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(DIR, 'CSV');

/* ── قارئ CSV صغير: يتعامل مع الحقول المقتبسة التي تحوي فواصل (مثل image_url المزدوج) ── */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');                       // إزالة BOM من تصدير جوجل
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => String(v).trim() !== ''))
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function loadSheet(name) {
  const file = readdirSync(CSV_DIR).find(f => f.includes(name) && f.endsWith('.csv'));
  if (!file) return null;
  return parseCSV(readFileSync(join(CSV_DIR, file), 'utf8'));
}

/* ── أدوات ── */
// q  = للأعمدة التي تقبل null (الفراغ يصير null)
const q = v => v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
// qNN = للأعمدة NOT NULL — الفراغ يبقى نصًّا فارغًا لا null.
// ⚠️ استعمالها إلزامي لكل عمود not null: تمرير q() لعمود not null يفجّر الاستيراد
//    حين يكون المصدر فارغًا (وقع هذا مع profiles.name لأن Owners.csv بلا عمود اسم).
const qNN = v => `'${String(v ?? '').replace(/'/g, "''")}'`;
const num = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const bool = v => ['true', 'yes', '1', 'نعم'].includes(String(v).trim().toLowerCase());

// هاتف: نفس منطق normalizePhone في Code.gs بالضبط
function normPhone(p) {
  p = String(p || '').trim().replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00962')) p = '962' + p.slice(5);
  if (p.startsWith('07')) p = '962' + p.slice(1);
  return p;
}

// "5:33:15 م 2026/05/08" ⟶ "2026-05-08 17:33:15"   (ص=صباحًا · م=مساءً)
function parseTs(v) {
  const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(ص|م)\s+(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  let [, hh, mm, ss, mark, Y, M, D] = m;
  let h = Number(hh) % 12;                       // 12ص ⟶ 0 · 12م ⟶ 12
  if (mark === 'م') h += 12;
  return `${Y}-${M}-${D} ${String(h).padStart(2, '0')}:${mm}:${ss}`;
}

// slots: "full"/"morning"/"evening" أو "8=..|10=.." ⟶ jsonb [{h,label}]  (مطابق convertSlots في Code.gs)
const SLOT_SETS = {
  full: '8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م|14=2:00 - 4:00 م|16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م',
  morning: '8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م',
  evening: '16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م',
};
function slotsJson(raw) {
  const key = String(raw || 'full').trim().toLowerCase();
  const spec = SLOT_SETS[key] || (key ? String(raw).trim() : SLOT_SETS.full);
  const arr = spec.split('|').map(s => {
    const [h, ...rest] = s.split('=');
    return { h: Number(h), label: rest.join('=') };
  }).filter(s => Number.isFinite(s.h));
  return JSON.stringify(arr);
}

/* ═══ تحميل البيانات ═══ */
const places  = loadSheet('Places')  || [];
const fields  = loadSheet('Fields')  || [];
const players = loadSheet('Players') || [];
const owners  = loadSheet('Owners');                 // قد يكون مفقودًا
const reviews = loadSheet('Reviews') || [];
const bookings= loadSheet('Bookings')|| [];

/* ⚠️ المعرّفات القديمة تأتي من شيتين مستقلّين بترقيم منفصل (Players.player_id و
   Owners.owner_id) فيتصادمان عند 1 و2 و3 — و`profiles.legacy_id` فريد. لذا يُنسَب
   كل معرّف إلى مجاله ببادئة. **لا تحذف البادئة**: بدونها يفشل استيراد أصحاب الملاعب. */
const NS_PLAYER = 'player:', NS_OWNER = 'owner:';
// Owners.csv بلا عمود اسم — الاسم الافتراضي بقرار المستخدم (2026-07-26)
const DEFAULT_OWNER_NAME = 'محمد';

const report = { warnings: [], counts: {} };
const placeIds = new Set(places.map(p => String(p.place_id).trim()));
const fieldIds = new Set(fields.map(f => String(f.field_id).trim()));

/* ═══ تحقّق قبل الكتابة ═══ */
// ① خانات مزدوجة تصطدم بالقيد الفريد (field_id, date, hour) للحالات النشطة
const seen = new Map();
bookings.forEach((b, i) => {
  const st = String(b.status || 'pending').toLowerCase();
  if (!['pending', 'confirmed'].includes(st)) return;
  const k = `${String(b.field_id).trim()}|${String(b.date).trim()}|${num(b.hour)}`;
  if (seen.has(k)) report.warnings.push(`⚠️ خانة مزدوجة (تصطدم بالقيد الفريد): صف ${i + 2} يكرّر صف ${seen.get(k)} → ${k}`);
  else seen.set(k, i + 2);
});
// ② معرّفات يتيمة
bookings.forEach((b, i) => {
  if (!placeIds.has(String(b.place_id).trim())) report.warnings.push(`⚠️ صف حجز ${i + 2}: place_id «${b.place_id}» غير موجود في Places`);
  if (!fieldIds.has(String(b.field_id).trim())) report.warnings.push(`⚠️ صف حجز ${i + 2}: field_id «${b.field_id}» غير موجود في Fields`);
  if (!parseTs(b.timestamp)) report.warnings.push(`⚠️ صف حجز ${i + 2}: تعذّر تفسير الطابع الزمني «${b.timestamp}»`);
});
reviews.forEach((r, i) => {
  if (!placeIds.has(String(r.place_id).trim())) report.warnings.push(`⚠️ صف تقييم ${i + 2}: place_id «${r.place_id}» غير موجود`);
});
if (!owners) report.warnings.push('⛔ ملفّ Owners.csv مفقود — لن تُنشأ حسابات أصحاب الملاعب (يُستكمل بملفّ لاحق).');

/* ═══ بناء SQL ═══ */
const L = [];
L.push(`-- ═══════════════════════════════════════════════════════════════════`);
L.push(`-- استيراد بيانات المستديرة من Google Sheets — مولَّد آليًّا`);
L.push(`-- المصدر: migration/CSV/*.csv   ·   المولّد: migration/build_import.mjs`);
L.push(`-- وُلِّد في: ${new Date().toISOString()}`);
L.push(`-- التشغيل: لوحة Supabase ← SQL Editor ← لصق ← Run  (يعمل داخل معاملة واحدة)`);
L.push(`-- ═══════════════════════════════════════════════════════════════════`);
L.push('');
L.push('begin;');
L.push('');
L.push('-- pgcrypto قد يكون مثبّتًا في مخطّط extensions (الافتراضي في Supabase) أو في public.');
L.push('-- هذا السطر يجعل crypt()/gen_salt() تُحلّ في الحالتين.');
L.push('set local search_path = public, extensions;');
L.push('');
L.push('-- أعمدة التقييم المبدئي المنقولة من الشيت (تُستعمل حين لا توجد تقييمات حقيقية بعد)');
L.push('alter table public.places add column if not exists rating_seed  numeric(2,1);');
L.push('alter table public.places add column if not exists reviews_seed integer;');
L.push('');

/* ── الأماكن ── */
L.push('-- ─────────── الأماكن ───────────');
places.forEach(p => {
  L.push(`insert into public.places (legacy_id,name,city,region,type,color,phone,map_link,active,` +
    `amenity_water,amenity_vests,amenity_ball,amenity_bathrooms,amenity_parking,rating_seed,reviews_seed) values (` +
    [q(String(p.place_id).trim()), qNN(p.place_name), qNN(p.city), qNN(p.region || 'all'), qNN(p.type || 'عشب صناعي'),
     qNN(p.color || '#15803d'), qNN(normPhone(p.phone)), q(p.map_link), bool(p.active),
     q(p.has_water), q(p.has_vests), q(p.has_ball), q(p.has_bathrooms), q(p.has_parking),
     p.rating ? num(p.rating) : 'null', p.reviews ? Math.round(num(p.reviews)) : 'null'].join(',') + ');');
});
L.push('');

/* ── الملاعب ── */
L.push('-- ─────────── الملاعب ───────────');
fields.forEach(f => {
  // image_url قد يحوي رابطين مفصولين بفاصلة (صف 401) ⇒ نأخذ الأول
  const img = String(f.image_url || '').split(',')[0].trim();
  L.push(`insert into public.fields (legacy_id,place_id,name,size,price,slots,image_url,active) select ` +
    [q(String(f.field_id).trim()), `p.id`, qNN(f.field_name || 'ملعب'), qNN(f.size || '5×5'), num(f.price),
     `${q(slotsJson(f.slots))}::jsonb`, q(img), bool(f.active)].join(',') +
    ` from public.places p where p.legacy_id = ${q(String(f.place_id).trim())};`);
});
L.push('');

/* ── المستخدمون: حساب مصادقة + ملفّ تعريف ── */
L.push('-- ─────────── المستخدمون ───────────');
L.push('-- ملاحظة: البريد مشتقّ من الرقم (لا يُرسل إليه شيء) لأن مصادقة الهاتف بـOTP تتطلّب مزوّد SMS مدفوعًا.');
L.push('-- المستخدم يظلّ يسجّل دخوله برقمه وكلمة سرّه — لا تغيير في التجربة.');
const ADMIN_PHONE = '962795097771';
players.forEach(p => {
  const phone = normPhone(p.phone);
  if (!phone) return;
  const role = phone === ADMIN_PHONE ? 'admin' : 'player';
  const pw = String(p.password || '').trim() || Math.random().toString(36).slice(2, 10);
  L.push(`do $mig$
declare uid uuid := gen_random_uuid();
begin
  -- ⚠️ درس مدفوع الثمن: أعمدة التوكن الثمانية أدناه **يجب** أن تُكتب '' لا أن تُترك NULL.
  --    خدمة المصادقة (Go) تقرأها في حقول نصّية غير قابلة لـNULL، فأي NULL يجعل
  --    **كل محاولة دخول** لهذا المستخدم تفشل بـ500 «Database error querying schema»
  --    — قبل مقارنة كلمة السرّ أصلًا، فيبدو العطل وكأنه كلمة سرّ خاطئة وهو ليس كذلك.
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
                          created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,
                          confirmation_token,recovery_token,email_change,email_change_token_new,
                          email_change_token_current,phone_change,phone_change_token,reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',
          ${q(phone + '@mustadeera.app')}, crypt(${q(pw)}, gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('name', ${q(p.name)}, 'phone', ${q(phone)}), false, false,
          '','','','','','','','');
  insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', ${q(phone + '@mustadeera.app')}, 'email_verified', true),
          'email', now(), now(), now());
  insert into public.profiles (id,role,name,phone,active,legacy_id,created_at)
  values (uid, ${qNN(role)}, ${qNN(p.name)}, ${qNN(phone)}, ${bool(p.active || 'true')}, ${q(NS_PLAYER + String(p.player_id).trim())}, now());
end $mig$;`);
});
L.push('');

/* ── أصحاب الملاعب: ملفّ **مستقلّ** (03_owners.sql) كي يُشغَّل وحده بعد استيراد سبق ── */
const O = [];
if (owners && owners.length) {
  O.push('-- أصحاب الملاعب — مولَّد آليًّا من Owners.csv. يُشغَّل مستقلًّا (آمن بعد 02_import.sql).');
  O.push('begin;');
  O.push('set local search_path = public, extensions;');
  O.push('');
  O.push('-- توحيد المعرّفات القديمة: اللاعبون استُوردوا قبل إضافة البادئة، فنُضيفها الآن.');
  O.push('-- عبارة خاملة إن كانت البادئة موجودة أصلًا (قابلة للتشغيل مرارًا بلا أثر).');
  O.push(`update public.profiles set legacy_id = '${NS_PLAYER}' || legacy_id`);
  O.push(`where role in ('player','admin') and legacy_id is not null and legacy_id not like '${NS_PLAYER}%';`);
  O.push('');
  owners.forEach(o => {
    const phone = normPhone(o.phone);
    if (!phone) return;
    const pw = String(o.password || '').trim() || Math.random().toString(36).slice(2, 10);
    O.push(`do $mig$
declare uid uuid := gen_random_uuid();
begin
  -- ⚠️ درس مدفوع الثمن: أعمدة التوكن الثمانية أدناه **يجب** أن تُكتب '' لا أن تُترك NULL.
  --    خدمة المصادقة (Go) تقرأها في حقول نصّية غير قابلة لـNULL، فأي NULL يجعل
  --    **كل محاولة دخول** لهذا المستخدم تفشل بـ500 «Database error querying schema»
  --    — قبل مقارنة كلمة السرّ أصلًا، فيبدو العطل وكأنه كلمة سرّ خاطئة وهو ليس كذلك.
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
                          created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,
                          confirmation_token,recovery_token,email_change,email_change_token_new,
                          email_change_token_current,phone_change,phone_change_token,reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',
          ${q(phone + '@mustadeera.app')}, crypt(${q(pw)}, gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('name', ${qNN(o.owner_name || o.name || DEFAULT_OWNER_NAME)}, 'phone', ${qNN(phone)}), false, false,
          '','','','','','','','');
  insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', ${q(phone + '@mustadeera.app')}, 'email_verified', true),
          'email', now(), now(), now());
  insert into public.profiles (id,role,name,phone,active,legacy_id,created_at)
  values (uid,'owner', ${qNN(o.owner_name || o.name || DEFAULT_OWNER_NAME)}, ${qNN(phone)}, true, ${q(NS_OWNER + String(o.owner_id || '').trim())}, now());
  insert into public.place_owners (place_id, profile_id)
  select p.id, uid from public.places p where p.legacy_id = ${q(String(o.place_id || '').trim())};
end $mig$;`);
  });
  O.push(`do $chk$
declare n int;
begin
  select count(*) into n from public.profiles where role = 'owner';
  if n <> ${owners.length} then raise exception 'أصحاب الملاعب: متوقّع ${owners.length} والموجود %', n; end if;
  raise notice 'تمّ: % صاحب ملعب مرتبطًا بأماكنهم', n;
end $chk$;`);
  O.push('commit;');
}

/* ── الحجوزات ── */
L.push('-- ─────────── الحجوزات ───────────');
bookings.forEach((b, i) => {
  const st = String(b.status || 'pending').trim().toLowerCase();
  const status = ['pending', 'confirmed', 'cancelled', 'rejected'].includes(st) ? st : 'pending';
  const ts = parseTs(b.timestamp);
  const legacyPlayer = String(b.player_id || '').trim();
  L.push(`insert into public.bookings (legacy_id,created_at,player_id,place_id,field_id,booking_date,hour,` +
    `time_label,customer_name,customer_phone,players_size,price,source,status,cancel_reason) select ` +
    [q('sheet_row_' + (i + 2)), ts ? q(ts) : 'now()',
     legacyPlayer ? `(select id from public.profiles where legacy_id = ${q(NS_PLAYER + legacyPlayer)})` : 'null',
     'p.id', 'f.id', q(String(b.date).trim()), Math.trunc(num(b.hour)),
     qNN(b.time), qNN(b.name), qNN(normPhone(b.phone)), q(b.players), num(b.price),
     qNN(b.source || 'direct'), qNN(status), q(b.cancel_reason)].join(',') +
    ` from public.places p, public.fields f` +
    ` where p.legacy_id = ${q(String(b.place_id).trim())} and f.legacy_id = ${q(String(b.field_id).trim())};`);
});
L.push('');

/* ── التقييمات ── */
L.push('-- ─────────── التقييمات ───────────');
reviews.forEach((r, i) => {
  const ts = parseTs(r.timestamp);
  const fid = String(r.field_id || '').trim();
  L.push(`insert into public.reviews (legacy_id,created_at,place_id,field_id,author_name,phone,rating,comment) select ` +
    [q('sheet_row_' + (i + 2)), ts ? q(ts) : 'now()', 'p.id',
     fid ? `(select id from public.fields where legacy_id = ${q(fid)})` : 'null',
     q(r.user_name), q(normPhone(r.phone)), Math.round(num(r.rating)), q(r.comment)].join(',') +
    ` from public.places p where p.legacy_id = ${q(String(r.place_id).trim())};`);
});
L.push('');

/* ── تحقّق ذاتي داخل نفس المعاملة: يفشل الاستيراد كلّه إن اختلّ العدد ── */
L.push('-- ─────────── تحقّق ذاتي (يُلغي كل شيء إن اختلّ عدد) ───────────');
L.push(`do $chk$
declare n_places int; n_fields int; n_book int; n_rev int; n_prof int;
begin
  select count(*) into n_places from public.places;
  select count(*) into n_fields from public.fields;
  select count(*) into n_book   from public.bookings;
  select count(*) into n_rev    from public.reviews;
  select count(*) into n_prof   from public.profiles;
  if n_places <> ${places.length} then raise exception 'الأماكن: متوقّع ${places.length} والموجود %', n_places; end if;
  if n_fields <> ${fields.length} then raise exception 'الملاعب: متوقّع ${fields.length} والموجود %', n_fields; end if;
  if n_book   <> ${bookings.length} then raise exception 'الحجوزات: متوقّع ${bookings.length} والموجود %', n_book; end if;
  if n_rev    <> ${reviews.length} then raise exception 'التقييمات: متوقّع ${reviews.length} والموجود %', n_rev; end if;
  raise notice 'تمّ: % مكان · % ملعب · % حجز · % تقييم · % حساب', n_places, n_fields, n_book, n_rev, n_prof;
end $chk$;`);
L.push('');
L.push('commit;');

/* ═══ الكتابة والتقرير ═══ */
report.counts = { places: places.length, fields: fields.length, players: players.length,
                  owners: owners ? owners.length : 0, bookings: bookings.length, reviews: reviews.length };

writeFileSync(join(DIR, '02_import.sql'), L.join('\n'), 'utf8');
if (O.length) writeFileSync(join(DIR, '03_owners.sql'), O.join('\n'), 'utf8');

console.log('\n═══ تقرير الاستيراد ═══');
console.log('الأعداد:', report.counts);
console.log(`\nالتحذيرات (${report.warnings.length}):`);
report.warnings.length ? report.warnings.forEach(w => console.log('  ' + w)) : console.log('  ✓ لا شيء');
console.log(`\n✅ كُتب: migration/02_import.sql  (${L.join('\n').length.toLocaleString()} محرف)\n`);
