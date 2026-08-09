/* Constants that must agree across files, checked by reading the files.
 *
 * WHY THIS EXISTS
 * ---------------
 * `check-spec-mirror.js` was born because FIELD_SPECS drifted between the app
 * and the panel. The same shape of bug exists for plain numbers and strings,
 * and it is worse there because a number never looks wrong on its own — the
 * panel confidently reports one profit figure and the app reports another, and
 * neither surface errors.
 *
 * Each check below is a fact that lives in more than one file *by necessity*
 * (a client cannot import from a SQL view; a JS constant cannot read Gradle),
 * so the only defence is comparing them.
 *
 *   node tools/check-mirrors.js
 */
const fs = require('fs');

const read = (p) => fs.readFileSync(p, 'utf8');
let failed = 0;
function check(name, values) {
  const uniq = [...new Set(values.map(v => v.value))];
  if (uniq.length === 1) {
    console.log(`  ok    ${name} = ${uniq[0]}`);
  } else {
    failed++;
    console.log(`  DRIFT ${name}`);
    values.forEach(v => console.log(`          ${v.value}   <- ${v.where}`));
  }
}
function grab(file, re, label) {
  const m = read(file).match(re);
  if (!m) { failed++; console.log(`  MISSING ${label} in ${file}`); return null; }
  return { value: m[1], where: `${file} (${label})` };
}

console.log('mirrors:');

/* ── commission ──────────────────────────────────────────────────────────
   Three copies, and the third is the dangerous one: changing the rate means
   `create or replace view admin_daily`, and forgetting it gives a dashboard
   that reports two different profits for the same month with no error. */
const rate = [
  grab('site/admin.html',        /var RATE\s*=\s*([\d.]+)/,        'RATE'),
  grab('app/src/app.js',         /COMMISSION:\s*([\d.]+)/,         'CONFIG.COMMISSION'),
  grab('migration/01_schema.sql', /\)\s*\*\s*([\d.]+),\s*2\)\s*as commission/, 'admin_daily'),
].filter(Boolean);
if (rate.length === 3) check('commission rate', rate);

/* ── app build number ────────────────────────────────────────────────────
   The gradle value is what actually ships; CONFIG.APP_BUILD is what the app
   compares against `min_app_version`. If they drift, the version gate is
   measuring a number nobody installed. */
const build = [
  grab('android/app/build.gradle', /versionCode\s+(\d+)/,   'versionCode'),
  grab('app/src/app.js',           /APP_BUILD:\s*(\d+)/,    'CONFIG.APP_BUILD'),
].filter(Boolean);
if (build.length === 2) check('app build number', build);

/* ── player cancellation window ──────────────────────────────────────────
   The UI hides the button, the trigger refuses the write. They are allowed to
   disagree at runtime (the server wins and reports its own number — see 15),
   but shipping them different is never intentional. */
const win = [
  grab('app/src/app.js',                /CANCEL_WINDOW_H:\s*(\d+)/, 'CONFIG.CANCEL_WINDOW_H'),
  grab('migration/15_booking_expiry.sql', /\('player_cancel_window_hours',\s*(\d+)/, 'booking_rules'),
].filter(Boolean);
if (win.length === 2) check('player cancel window (h)', win);

/* ── owner reply deadline ─────────────────────────────────────────────── */
const reply = [
  grab('app/src/app.js',                  /REPLY_DEADLINE_H:\s*(\d+)/, 'CONFIG.REPLY_DEADLINE_H'),
  grab('migration/15_booking_expiry.sql', /\('owner_reply_deadline_hours',\s*(\d+)/, 'booking_rules'),
].filter(Boolean);
if (reply.length === 2) check('owner reply deadline (h)', reply);

/* ── the 10 AM slot label ────────────────────────────────────────────────
   Four files write this string. It is the canonical value stored in
   `fields.slots` and echoed into `bookings.time_label`, so a mismatch splits
   one slot into two filter chips and prints the wrong time on a booking. */
const slot10 = [
  grab('app/src/app.js',              /\{label:'([^']*)',hour:10,/,        'DEFAULT_SLOTS'),
  grab('site/admin.html',             /\{ h:10, label:'([^']*)' \}/,       'SLOT_SETS'),
  grab('migration/build_import.mjs',  /full: '[^']*?10=([^|']*)\|/,        'SLOT_SETS'),
].filter(Boolean);
if (slot10.length === 3) check('10:00 slot label', slot10);

console.log(failed ? `\n${failed} mismatch(es).` : '\nall mirrors agree.');
process.exit(failed ? 1 : 0);
