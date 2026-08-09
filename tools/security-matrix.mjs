/* Every guard this project relies on, asserted against the live database.
 *
 * WHY A SCRIPT AND NOT A CHECKLIST
 * --------------------------------
 * The recorded lesson is "do not assume RLS protects you — query with the anon
 * key and see". That is how the `reviews.phone` leak was found and closed. But
 * a one-off curl proves one thing on one day; every guard added since has been
 * verified once, by hand, and never again. This file makes the whole set
 * re-runnable, so a policy that regresses is caught by a command instead of by
 * a customer.
 *
 * Each row is an attempt a modified client can make. The assertion is on the
 * OUTCOME, not the status code, because PostgREST answers a policy violation
 * with "200 and an empty row" — the worst possible reply, and the reason the
 * guards in 24 are triggers rather than widened `with check` expressions.
 *
 * USAGE
 *   node tools/security-matrix.mjs --url https://<ref>.supabase.co \
 *                                  --anon <anon key> \
 *                                  --phone 07xxxxxxxx --pass <password>
 *
 * The account is an ORDINARY PLAYER account — that is the point. Nothing here
 * needs a service-role key, and none is accepted: a test that requires the
 * master key does not test what an attacker can do.
 *
 * It creates and cancels a booking on a real venue. Run it against a staging
 * project, or accept one cancelled row.
 */

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 ? process.argv[i + 1] : d;
};
const URL_ = (arg('url', process.env.SB_URL) || '').replace(/\/+$/, '');
const ANON = arg('anon', process.env.SB_ANON) || '';
const PHONE = arg('phone', process.env.SB_PHONE) || '';
const PASS = arg('pass', process.env.SB_PASS) || '';

if (!URL_ || !ANON) {
  console.error('usage: node tools/security-matrix.mjs --url <supabase url> --anon <key> [--phone .. --pass ..]');
  process.exit(2);
}

/* Same normalisation as the app, because the login e-mail is derived from it.
   A different spelling here would look up a different account. */
function normalizePhone(p) {
  p = String(p || '').trim().replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00962')) p = '962' + p.slice(5);
  if (p.startsWith('07')) p = '962' + p.slice(1);
  if (/^7[789]\d{7}$/.test(p)) p = '962' + p;
  return p;
}

let token = null, uid = null;
async function rest(path, { method = 'GET', body, auth = true, prefer } = {}) {
  const headers = { apikey: ANON, Authorization: `Bearer ${auth && token ? token : ANON}` };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await r.text();
  let data = null; try { data = JSON.parse(raw); } catch { /* not json */ }
  return { status: r.status, ok: r.ok, raw, data };
}

let pass = 0, fail = 0, skip = 0;
function assert(name, ok, detail) {
  if (ok === null) { skip++; console.log(`  skip  ${name}${detail ? ' — ' + detail : ''}`); return; }
  if (ok) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '\n        ' + detail : ''}`); }
}

/* ── 1. things anyone can try with no account at all ─────────────────────── */
console.log('\nanon (no login):');
{
  const r = await rest('reviews?select=phone', { auth: false });
  assert('reviews.phone is not readable', r.status === 401 || r.status === 403, `got ${r.status}`);
}
{
  const r = await rest('reviews?select=id,place_id,author_name,rating,comment&limit=1', { auth: false });
  assert('reviews public columns still readable', r.ok, `got ${r.status} ${r.raw.slice(0, 120)}`);
}
{
  const r = await rest('place_applications?select=*', { auth: false });
  const leaked = Array.isArray(r.data) && r.data.length > 0;
  assert('place_applications leaks no rows', !leaked, leaked ? `${r.data.length} rows returned` : '');
}
{
  const r = await rest('profiles?select=phone,name', { auth: false });
  const leaked = Array.isArray(r.data) && r.data.length > 0;
  assert('profiles leaks no rows to anon', !leaked, leaked ? `${r.data.length} rows` : '');
}
{
  const r = await rest('bookings?select=customer_phone', { auth: false });
  const leaked = Array.isArray(r.data) && r.data.length > 0;
  assert('bookings leak no phone numbers to anon', !leaked, leaked ? `${r.data.length} rows` : '');
}
{
  const r = await rest('booking_rules?select=key,num_value', { auth: false });
  assert('booking_rules readable (version gate needs it before login)', r.ok, `got ${r.status}`);
}

if (!PHONE || !PASS) {
  console.log('\nno --phone/--pass given: the authenticated half is skipped.');
  console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
  process.exit(fail ? 1 : 0);
}

/* ── 2. log in as an ordinary player ─────────────────────────────────────── */
{
  const email = normalizePhone(PHONE) + '@mustadeera.app';
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const j = await r.json();
  if (!j.access_token) {
    console.error(`\ncould not sign in as ${email}: ${JSON.stringify(j).slice(0, 200)}`);
    process.exit(2);
  }
  token = j.access_token;
  uid = j.user?.id;
  console.log(`\nsigned in as player ${uid}`);
}

/* ── 3. privilege escalation ─────────────────────────────────────────────── */
console.log('\nprofiles (migration 24, guard 1):');
{
  const r = await rest(`profiles?id=eq.${uid}`, { method: 'PATCH', body: { role: 'admin' }, prefer: 'return=representation' });
  const role = r.data?.[0]?.role;
  assert('role cannot be raised to admin', role !== 'admin', `role is now "${role}"`);
}
{
  const r = await rest(`profiles?id=eq.${uid}`, { method: 'PATCH', body: { active: false }, prefer: 'return=representation' });
  assert('self-deactivation still works (delete account)', r.data?.[0]?.active === false, `active=${r.data?.[0]?.active}`);
  const back = await rest(`profiles?id=eq.${uid}`, { method: 'PATCH', body: { active: true }, prefer: 'return=representation' });
  assert('a suspended account cannot re-enable itself', back.data?.[0]?.active === false, `active=${back.data?.[0]?.active}`);
  // Leave the test account usable: only an admin/SQL can undo this.
  if (back.data?.[0]?.active === false) {
    console.log('        note: the test account is now active=false — re-enable it in /admin or SQL.');
  }
}

/* ── 4. booking guards ───────────────────────────────────────────────────── */
console.log('\nbookings (migration 24, guards 2 and 3):');
const places = (await rest('places?select=id,name&active=is.true&limit=2')).data || [];
const fields = (await rest(`fields?select=id,place_id,slots,price&active=is.true&limit=20`)).data || [];
const field = fields.find(f => Array.isArray(f.slots) && f.slots.length);
const other = fields.find(f => field && f.place_id !== field.place_id);

if (!field) {
  assert('booking guards', null, 'no active field with slots found — cannot exercise');
} else {
  const hour = Number(field.slots[0].h);
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const base = {
    player_id: uid, place_id: field.place_id, field_id: field.id,
    hour, time_label: 'x', customer_name: 'matrix', customer_phone: normalizePhone(PHONE),
  };

  {
    const r = await rest('bookings', { method: 'POST', prefer: 'return=representation',
      body: { ...base, booking_date: day(-3) } });
    assert('a past date is refused', !r.ok && r.raw.includes('booking_date_past'), `${r.status} ${r.raw.slice(0, 120)}`);
  }
  if (other) {
    const r = await rest('bookings', { method: 'POST', prefer: 'return=representation',
      body: { ...base, field_id: other.id, booking_date: day(9) } });
    assert('a field from another venue is refused', !r.ok && r.raw.includes('field_not_in_place'), `${r.status} ${r.raw.slice(0, 120)}`);
  } else {
    assert('a field from another venue is refused', null, 'only one venue has fields');
  }
  {
    const bad = [0, 1, 3, 5, 7].find(h => !field.slots.some(s => Number(s.h) === h));
    const r = await rest('bookings', { method: 'POST', prefer: 'return=representation',
      body: { ...base, hour: bad, booking_date: day(9) } });
    assert('an hour outside the field slots is refused', !r.ok && r.raw.includes('hour_not_in_slots'), `${r.status} ${r.raw.slice(0, 120)}`);
  }
  {
    /* The load-bearing one: the open-games design rests on `status='confirmed'`
       meaning the venue said yes. */
    const r = await rest('bookings', { method: 'POST', prefer: 'return=representation',
      body: { ...base, booking_date: day(23), status: 'confirmed', price: 0 } });
    const row = r.data?.[0];
    assert('status is forced to pending', row ? row.status === 'pending' : false,
      row ? `status=${row.status}` : `${r.status} ${r.raw.slice(0, 160)}`);
    if (row) {
      assert('price is written by the server, not the client (migration 18)',
        Number(row.price) === Number(field.price) || Number(row.price) > 0,
        `sent 0, stored ${row.price} (base ${field.price}) — is 18 run?`);

      const forged = await rest(`bookings?id=eq.${row.id}`, {
        method: 'PATCH', prefer: 'return=representation',
        body: { status: 'cancelled', cancel_kind: 'expired', price: 999, customer_name: 'tampered' },
      });
      const after = forged.data?.[0];
      assert('cancel_kind cannot be forged to "expired"', after ? after.cancel_kind !== 'expired' : false,
        after ? `cancel_kind=${JSON.stringify(after.cancel_kind)}` : `${forged.status} ${forged.raw.slice(0, 160)}`);
      assert('no other column rides along with the cancellation',
        after ? (Number(after.price) !== 999 && after.customer_name !== 'tampered') : false,
        after ? `price=${after.price} name=${after.customer_name}` : '');
    }
  }
}

/* ── 5. reviews (migration 25) ───────────────────────────────────────────── */
console.log('\nreviews (migration 25):');
if (!places.length) {
  assert('review limits', null, 'no active place found');
} else {
  const place = places[0].id;
  {
    const r = await rest('reviews', { method: 'POST', body: { place_id: place, rating: 5, comment: 'x'.repeat(2000), phone: normalizePhone(PHONE) } });
    assert('an over-long comment is refused', !r.ok, `got ${r.status}`);
  }
  {
    const r = await rest('reviews', { method: 'POST', body: { place_id: place, rating: 5, comment: 'ok' } });
    assert('a review without a phone number is refused', !r.ok && r.raw.includes('rv_phone_required'), `${r.status} ${r.raw.slice(0, 120)}`);
  }
  {
    const p = '9627' + String(Date.now()).slice(-8);
    const a = await rest('reviews', { method: 'POST', body: { place_id: place, rating: 4, comment: 'matrix 1', phone: p } });
    const b = await rest('reviews', { method: 'POST', body: { place_id: place, rating: 1, comment: 'matrix 2', phone: p } });
    assert('the first review is accepted', a.ok || a.status === 201, `${a.status} ${a.raw.slice(0, 120)}`);
    assert('a second review from the same number is refused', !b.ok && b.raw.includes('rv_duplicate'), `${b.status} ${b.raw.slice(0, 120)}`);
    const c = await rest('reviews', { method: 'POST', body: { place_id: place, rating: 1, comment: 'matrix 3', phone: '0' + p.slice(3) } });
    assert('another spelling of the same number does not escape the limit', !c.ok && c.raw.includes('rv_duplicate'), `${c.status} ${c.raw.slice(0, 120)}`);
  }
}

/* ── 6. open games (migration 22) ────────────────────────────────────────── */
console.log('\nopen games (migration 22):');
{
  const r = await rest('open_games?select=*&limit=5');
  if (r.status === 404 || r.raw.includes('PGRST205')) {
    assert('open_games view', null, 'migration 22 not run');
  } else {
    const cols = r.data?.[0] ? Object.keys(r.data[0]) : [];
    assert('open_games exposes no phone or player id',
      !cols.some(c => /phone|player_id/.test(c)),
      cols.length ? cols.join(', ') : 'no rows to inspect (columns unverified)');
    const bp = await rest('booking_players?select=profile_id&limit=5');
    const foreign = (bp.data || []).some(x => x.profile_id !== uid);
    assert('booking_players shows only my own rows', !foreign, foreign ? 'someone else\'s row returned' : '');
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
