/**
 * ai — the venue owner's three AI panels, moved off Google Apps Script.
 *
 * WHY THIS EXISTS
 * ---------------
 * The panels used to call the old Apps Script backend. That path has been dead
 * since the Postgres migration and failed in two independent ways at once:
 *
 *   1. `validateOwnerToken()` there expected the old `base64(id|phone)` token.
 *      The app now holds a Supabase session (JSON with a JWT), so every call
 *      was rejected with "your session expired" no matter how fresh it was.
 *   2. Even past that gate, it read bookings and reviews from Google Sheets,
 *      which stopped receiving writes when booking moved to Postgres. Any
 *      answer it produced would have described a frozen copy of the world.
 *
 * So the panels were not "slow" or "flaky" — they could not succeed. This
 * function replaces that path end to end.
 *
 * WHAT IT GUARANTEES
 * ------------------
 * • The Gemini key never reaches a browser. It lives in Supabase secrets and
 *   is read here, server-side, only.
 * • The caller proves who they are with their own JWT, and the data they get
 *   back is derived from the venue THEY own — ownership is re-checked here
 *   against `place_owners`, never taken from the request body. A caller who
 *   passes someone else's place_id gets 403, not that venue's numbers.
 * • It never hangs: every outbound call is built inside `withDeadline`, which
 *   hands the request an AbortSignal it actually cancels on. A slow model call
 *   surfaces as `deadline_25000ms` and the panel falls back to computed-only
 *   analysis; any other failure returns a JSON body the app already renders.
 *   (This line used to be false. The controller existed, the timer fired, and
 *   the signal reached nothing — see the note on `withDeadline` below. A
 *   comment describing an intention rather than a behaviour is worse than no
 *   comment, because the next reader audits the prose instead of the code.)
 *
 * WHAT IT REFUSES TO DO (rule 5 — the honesty rule)
 * -------------------------------------------------
 * The model is handed ONLY numbers computed here from real rows, and is told
 * to cite them. It is never asked to estimate a figure the data does not
 * contain. Where there is not enough history to say anything, the function
 * returns `not_enough_data` and the app says so — it does not let the model
 * fill the silence with plausible-sounding invention.
 *
 * DEPLOY (once, by the owner)
 * ---------------------------
 *   supabase functions deploy ai
 *   supabase secrets set GEMINI_API_KEY=...        # or OPENAI_API_KEY
 *
 * Until then the app falls back to computed-only analysis and says plainly
 * that the AI layer is not configured. Nothing in the app breaks.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI = (Deno.env.get("GEMINI_API_KEY") || "").trim();
const OPENAI = (Deno.env.get("OPENAI_API_KEY") || "").trim();
const MODEL = (Deno.env.get("AI_MODEL") || "").trim();

/** Model calls are the slow leg; 25s keeps us inside the app's 45s client timeout
 *  with room for the round trip, so the app shows a real message rather than a
 *  spinner that never resolves. */
const AI_DEADLINE_MS = 25_000;
const DB_DEADLINE_MS = 8_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/* A pinned model name is a dated asset, not a constant — measured twice on
 * 2026-08-13. First `gemini-2.0-flash` answered
 *   404 "This model ... is no longer available. Please update your code"
 * (a hard retirement). The obvious fix, pinning to the current flagship
 * `gemini-2.5-flash`, hit a DIFFERENT 404 with near-identical wording:
 *   404 "This model models/gemini-2.5-flash is no longer available to new
 *        users. Please update your code to use a newer model"
 * — not retired, but gated: `ListModels` on this exact key still returns it,
 * so the snapshot exists, yet `generateContent` on it 404s for this key's
 * account tier. Google's own fix for that gate is the SAME shape of name for
 * a different reason: an alias, not a dated snapshot.
 *
 * So the pinned-default plan (see the old version of this comment, still
 * worth knowing was tried and failed) is inverted: default to the alias
 * `gemini-flash-latest`, which exists specifically to keep working across
 * both failure modes above — retirement and the new-account gate — because
 * it always resolves to whatever flash snapshot is currently unrestricted.
 * The tradeoff accepted: output could drift slightly when Google repoints
 * the alias, unlike a pinned snapshot. For a JSON-only owner-dashboard blurb
 * this is worth it; a component with real regression risk from prompt drift
 * would want a pin plus a monitored `AI_MODEL` override instead.
 *
 * `AI_MODEL` still overrides both this default AND the reasoning above
 * without a redeploy — one `supabase secrets set` away.
 * Confirm what a key can actually call (existence ≠ access — see above):
 *   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$KEY"
 */
function aiConfig() {
  if (GEMINI) return { provider: "gemini" as const, key: GEMINI, model: MODEL || "gemini-flash-latest" };
  if (OPENAI) return { provider: "openai" as const, key: OPENAI, model: MODEL || "gpt-4o-mini" };
  return null;
}

/** Deadline-bounded fetch.
 *
 * The previous shape took an already-created `Promise<T>` and an AbortController
 * whose signal was never handed to anything. Two things were wrong with it and
 * both are invisible at a glance: the promise had already been constructed by
 * the time the controller existed, and no `fetch` was ever told about the
 * signal. So `ctl.abort()` fired into the void, `clearTimeout` tidied up a timer
 * that had done nothing, and the file's own header claimed "it never hangs".
 *
 * It takes a factory now, so the signal reaches the request it is meant to cut.
 * `AbortSignal.timeout` would be shorter, but an explicit controller lets the
 * rejection carry a name we can tell apart from a network failure — the caller
 * says "the AI service took too long", not "something went wrong".
 */
async function withDeadline<T>(make: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await make(ctl.signal);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error(`deadline_${ms}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** A place id reaches PostgREST as a raw query fragment, so it has to be a uuid
 *  and nothing else. RLS still bounds what any of these reads can return — that
 *  is the real defence and it has not changed — but an `&` inside the value
 *  would append parameters of the caller's choosing (`limit`, `order`,
 *  `select`) to a URL we believe we wrote. Reject the shape; don't escape it. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PostgREST read AS THE CALLER: their JWT is forwarded, so RLS applies to this
 *  query exactly as it would in the app. This function deliberately does not
 *  hold a service-role key — a bug here can therefore never read another
 *  venue's rows, because the database itself would refuse. */
async function rest(path: string, jwt: string) {
  const res = await withDeadline(
    (signal) =>
      fetch(`${SB_URL}/rest/v1/${path}`, {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${jwt}` },
        signal,
      }),
    DB_DEADLINE_MS,
  );
  if (!res.ok) throw new Error(`rest ${path} -> ${res.status}`);
  return await res.json();
}

/** Strip ```json fences and parse. Models wrap JSON in markdown often enough
 *  that treating a fenced body as a failure would throw away good answers. */
function parseModelJson(text: string): any | null {
  if (!text) return null;
  try {
    const s = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    return JSON.parse(s.slice(a, b + 1));
  } catch { return null; }
}

async function callModel(sys: string, usr: string): Promise<{ out: any | null; err: string }> {
  const cfg = aiConfig();
  if (!cfg) return { out: null, err: "no_key" };
  try {
    let url: string, init: RequestInit;
    if (cfg.provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.key)}`;
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: usr }] }],
          /* 8192, not 1024 — measured 2026-08-13. At 1024 the reviews panel
           * succeeded and insights failed with `unparseable`, and the split is
           * the giveaway: reviews asks for one ~50-word summary, insights for
           * 3-5 objects of up to 46 words EACH. In Arabic that is far more
           * tokens per word than the English the limit was eyeballed against,
           * so the reply is cut mid-object; `parseModelJson` then finds an
           * inner `}` from a finished element, feeds JSON.parse a truncated
           * body and gets null. Nothing reports "too long" — a length ceiling
           * fails as a syntax error two layers away from its cause.
           * And the ceiling is now shared with THINKING tokens: the alias
           * resolves to a reasoning-capable flash model whose internal tokens
           * are billed against this same budget, so a small number can be
           * spent entirely before one output character is emitted. */
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192, response_mime_type: "application/json" },
        }),
      };
    } else {
      url = "https://api.openai.com/v1/chat/completions";
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
          temperature: 0.4, max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
      };
    }
    const res = await withDeadline((signal) => fetch(url, { ...init, signal }), AI_DEADLINE_MS);
    if (!res.ok) return { out: null, err: `http_${res.status}: ${(await res.text()).slice(0, 160)}` };
    const body = await res.json();
    /* JOIN the parts, don't take [0]. A reasoning model can return a thought
     * part before the answer part, and `parts[0].text` would then hand the
     * parser prose instead of the JSON that sits in a later part. */
    const text = cfg.provider === "gemini"
      ? (body?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("")
      : body?.choices?.[0]?.message?.content;
    const out = parseModelJson(text);
    /* A bare "unparseable" cost a full round trip with the owner to diagnose:
     * it says the parse failed and nothing about WHY, while the two answers
     * that matter — was it cut short, or was it refused — are sitting in the
     * response we already hold. `finishReason` separates MAX_TOKENS from
     * SAFETY from STOP-with-junk, and the head of the text shows whether we
     * got prose, an empty string, or truncated JSON. Same lesson as the app's
     * generic failure line: an error that does not name its cause moves the
     * work from reading a message to reproducing a bug. */
    if (out) return { out, err: "" };
    const fin = body?.candidates?.[0]?.finishReason ?? body?.promptFeedback?.blockReason ?? "none";
    const t = String(text ?? "");
    return { out: null, err: `unparseable finish=${fin} len=${t.length} head=${t.slice(0, 90)}` };
  } catch (e) {
    return { out: null, err: String((e as Error)?.message || e).slice(0, 160) };
  }
}

const langName = (l: string) => (l === "en" ? "English" : "Arabic");
const ammanDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(d);

/* ───────────────────────────── analytics ───────────────────────────── */

/** Everything the model is allowed to see, and nothing else: counts, sums and
 *  rates computed here from real rows. No raw customer names or phone numbers
 *  are ever put in a prompt — the model has no use for them and no business
 *  holding them. */
async function buildAnalytics(jwt: string, placeId: string) {
  const today = ammanDate();
  const from = ammanDate(new Date(Date.now() - 30 * 86400000));
  const to = ammanDate(new Date(Date.now() + 7 * 86400000));

  const [fields, bookings] = await Promise.all([
    rest(`fields?select=id,name,size,price,slots,sport,active&place_id=eq.${placeId}`, jwt),
    rest(
      `bookings?select=booking_date,hour,price,status,customer_phone,field_id` +
      `&place_id=eq.${placeId}&booking_date=gte.${from}&booking_date=lte.${to}`,
      jwt,
    ),
  ]);

  const live = (fields as any[]).filter((f) => f.active);
  const slotsPerDay = live.reduce((s, f) => s + (Array.isArray(f.slots) ? f.slots.length : 0), 0);
  const fieldName: Record<string, string> = {};
  live.forEach((f) => (fieldName[String(f.id)] = String(f.name || "")));

  const past = (bookings as any[]).filter((b) => String(b.booking_date) <= today);
  const next = (bookings as any[]).filter((b) => String(b.booking_date) > today);
  const confirmed = past.filter((b) => b.status === "confirmed");
  const lost = past.filter((b) => b.status === "cancelled" || b.status === "rejected");

  const byWeekday: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  const byField: Record<string, number> = {};
  confirmed.forEach((b) => {
    const wd = new Date(String(b.booking_date) + "T12:00:00").getDay();
    byWeekday[String(wd)] = (byWeekday[String(wd)] || 0) + 1;
    byHour[String(b.hour)] = (byHour[String(b.hour)] || 0) + 1;
    const fn = fieldName[String(b.field_id)] || "?";
    byField[fn] = (byField[fn] || 0) + 1;
  });

  /* A customer is a phone number, not an account: the same person books from a
   * guest flow and a signed-in flow and would otherwise count twice. */
  const seen: Record<string, number> = {};
  confirmed.forEach((b) => {
    const p = String(b.customer_phone || "").trim();
    if (p) seen[p] = (seen[p] || 0) + 1;
  });
  const uniqueCustomers = Object.keys(seen).length;
  const returning = Object.values(seen).filter((n) => n > 1).length;

  const capacity30 = slotsPerDay * 30;
  const revenue = confirmed.reduce((s, b) => s + Number(b.price || 0), 0);
  const avgPrice = confirmed.length ? revenue / confirmed.length : 0;

  return {
    // `days_with_bookings` is the gate the caller checks before asking the
    // model anything: advice drawn from three days of history is fiction.
    days_with_bookings: new Set(past.map((b) => String(b.booking_date))).size,
    fields: live.map((f) => ({
      name: String(f.name || ""), sport: String(f.sport || "football"),
      size: String(f.size || ""), price_jod: Number(f.price || 0),
      slots_per_day: Array.isArray(f.slots) ? f.slots.length : 0,
    })),
    last_30_days: {
      requests: past.length,
      confirmed: confirmed.length,
      cancelled_or_rejected: lost.length,
      cancel_rate_pct: past.length ? Math.round((lost.length / past.length) * 100) : 0,
      capacity_slots: capacity30,
      occupancy_pct: capacity30 ? Math.round((confirmed.length / capacity30) * 100) : 0,
      revenue_jod: Math.round(revenue),
      avg_price_jod: Math.round(avgPrice),
      est_lost_revenue_jod: Math.round(Math.max(capacity30 - confirmed.length, 0) * avgPrice),
      confirmed_by_weekday_0_sunday: byWeekday,
      confirmed_by_start_hour: byHour,
      confirmed_by_field: byField,
      unique_customers: uniqueCustomers,
      returning_customers: returning,
    },
    next_7_days: {
      booked: next.length,
      capacity_slots: slotsPerDay * 7,
      free_slots: Math.max(slotsPerDay * 7 - next.length, 0),
    },
  };
}

/* ───────────────────────────── weather ───────────────────────────── */

const CITY: Record<string, [number, number]> = {
  "عمان": [31.95, 35.93], "عمّان": [31.95, 35.93], "amman": [31.95, 35.93],
  "الزرقاء": [32.07, 36.09], "zarqa": [32.07, 36.09],
  "اربد": [32.55, 35.85], "إربد": [32.55, 35.85], "irbid": [32.55, 35.85],
  "العقبة": [29.53, 35.01], "aqaba": [29.53, 35.01],
  "السلط": [32.04, 35.73], "salt": [32.04, 35.73],
  "مادبا": [31.72, 35.79], "madaba": [31.72, 35.79],
  "جرش": [32.27, 35.89], "jerash": [32.27, 35.89],
  "عجلون": [32.33, 35.75], "ajloun": [32.33, 35.75],
  "الكرك": [31.18, 35.70], "karak": [31.18, 35.70],
  "معان": [30.19, 35.73], "maan": [30.19, 35.73],
  "الطفيلة": [30.84, 35.60], "tafilah": [30.84, 35.60],
  "المفرق": [32.34, 36.21], "mafraq": [32.34, 36.21],
};

const wmo = (c: number) =>
  c === 0 ? "sunny" : c <= 3 ? "cloudy" : c === 45 || c === 48 ? "fog"
  : c >= 51 && c <= 67 ? "rain" : c >= 71 && c <= 77 ? "snow"
  : c >= 80 && c <= 82 ? "rain" : c >= 85 && c <= 86 ? "snow"
  : c >= 95 ? "storm" : "cloudy";

/* ───────────────────────────── handler ───────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, code: "bad_method" }, 405);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ success: false, code: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is a bad request, handled below */ }
  const kind = String(body.kind || "");
  const lang = body.lang === "en" ? "en" : "ar";
  const placeId = String(body.place_id || "");
  if (!UUID_RE.test(placeId)) return json({ success: false, code: "bad_request" }, 400);
  if (!["insights", "reviews", "weather"].includes(kind)) {
    return json({ success: false, code: "bad_request" }, 400);
  }

  /* Ownership is verified against the database, not trusted from the body.
   * `place_owners` is readable only for your own rows (policy `po_read`), so an
   * empty result means "not yours" — including for a valid JWT of a different
   * owner. Admins are allowed through by the same policy. */
  let owns: any[];
  try {
    owns = await rest(`place_owners?select=place_id&place_id=eq.${placeId}`, jwt);
  } catch {
    return json({ success: false, code: "unauthorized" }, 401);
  }
  if (!Array.isArray(owns) || !owns.length) return json({ success: false, code: "forbidden" }, 403);

  const hasKey = !!aiConfig();

  try {
    /* ── weather ──
     * Open-Meteo needs no key, so the forecast itself always works. Only the
     * advisory sentence needs the model — and when it is missing, the caller
     * still gets the days and writes a rule-based line locally. That split is
     * deliberate: a missing API key should cost you the prose, not the data. */
    if (kind === "weather") {
      const places = await rest(`places?select=city&id=eq.${placeId}`, jwt);
      const city = String(places?.[0]?.city || "").trim().toLowerCase();
      const [lat, lon] = CITY[city] || [31.95, 35.93];

      const wx = await withDeadline(
        (signal) =>
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&daily=weather_code,temperature_2m_max,temperature_2m_min,` +
                `precipitation_probability_max,wind_speed_10m_max&forecast_days=3&timezone=Asia%2FAmman`,
                { signal }),
        DB_DEADLINE_MS,
      );
      if (!wx.ok) return json({ success: false, code: "weather_failed", detail: `HTTP ${wx.status}` });
      const daily = (await wx.json()).daily;
      if (!daily?.time) return json({ success: false, code: "weather_failed", detail: "no daily data" });

      const days = daily.time.map((d: string, i: number) => ({
        date: d,
        category: wmo(Number(daily.weather_code[i])),
        tmax: Math.round(daily.temperature_2m_max[i]),
        tmin: Math.round(daily.temperature_2m_min[i]),
        rain_prob: Math.round(daily.precipitation_probability_max[i] || 0),
        wind_kmh: Math.round(daily.wind_speed_10m_max[i] || 0),
      }));

      if (!hasKey) return json({ success: true, ai: false, days, generated_at: new Date().toISOString() });

      const analytics = await buildAnalytics(jwt, placeId);
      const { out, err } = await callModel(
        `You advise a sports-venue operator in Jordan. Currency is JOD. Reply ONLY with valid JSON, ` +
        `no markdown. Every text value must be written in ${langName(lang)}.`,
        `3-day forecast:\n${JSON.stringify(days)}\n\nVenue position:\n${JSON.stringify(analytics.next_7_days)}\n\n` +
        `Return exactly {"title":"...","advice":"..."}\n` +
        `Rules: title max 8 words. advice max 45 words, actionable, and it must name the specific ` +
        `day(s) it is about. Use only the numbers given; never state a figure that is not above.`,
      );
      return json(out?.advice
        ? { success: true, ai: true, days, title: String(out.title || "").slice(0, 120),
            advice: String(out.advice).slice(0, 400), generated_at: new Date().toISOString() }
        : { success: true, ai: false, days, detail: err, generated_at: new Date().toISOString() });
    }

    if (!hasKey) return json({ success: false, code: "ai_not_configured" });

    /* ── insights ── */
    if (kind === "insights") {
      const analytics = await buildAnalytics(jwt, placeId);
      // Below a week of real history there is no pattern, only noise. Saying so
      // is the honest answer; asking the model anyway would produce confident
      // advice about a weekday that happened to have two bookings.
      if (analytics.days_with_bookings < 7) {
        return json({ success: false, code: "not_enough_data", days: analytics.days_with_bookings });
      }
      const { out, err } = await callModel(
        `You are a business consultant for sports-venue rental in Jordan. Currency is JOD. ` +
        `Reply ONLY with valid JSON, no markdown. Every text value must be written in ${langName(lang)}.`,
        `Venue analytics (last 30 days + next 7):\n${JSON.stringify(analytics)}\n\n` +
        `Return exactly {"insights":[{"type":"pricing|marketing|schedule|warning|opportunity",` +
        `"title":"...","advice":"..."}]}\n` +
        `Rules: 3 to 5 insights. Each must cite an actual number, field name, weekday or hour from ` +
        `the data above. Title max 6 words, advice max 40 words. No generic filler. ` +
        `Never invent a figure that is not in the data.`,
      );
      if (!out || !Array.isArray(out.insights)) return json({ success: false, code: "ai_failed", detail: err });
      return json({
        success: true, generated_at: new Date().toISOString(),
        insights: out.insights.slice(0, 5).map((i: any) => ({
          type: String(i.type || "opportunity").toLowerCase(),
          title: String(i.title || "").slice(0, 120),
          advice: String(i.advice || "").slice(0, 400),
        })).filter((i: any) => i.title && i.advice),
      });
    }

    /* ── reviews ──
     * Ratings and counts are computed here and returned even when the model
     * fails, so the panel degrades to real numbers rather than to nothing. */
    const rows = await rest(
      `reviews?select=rating,comment,created_at&place_id=eq.${placeId}&order=created_at.desc&limit=80`,
      jwt,
    );
    const all = (rows as any[]).filter((r) => r.rating >= 1 && r.rating <= 5);
    if (!all.length) return json({ success: true, empty: true });
    const avg = Math.round((all.reduce((s, r) => s + Number(r.rating), 0) / all.length) * 10) / 10;
    const base = { success: true, total: all.length, avg_rating: avg };

    const { out, err } = await callModel(
      `You analyse customer reviews for a sports venue in Jordan. Reply ONLY with valid JSON, ` +
      `no markdown. Every text value must be written in ${langName(lang)}.`,
      `Reviews (newest first, avg ${avg}/5, total ${all.length}):\n` +
      JSON.stringify(all.map((r) => ({ rating: r.rating, comment: String(r.comment || "").slice(0, 300) }))) +
      `\n\nReturn exactly {"sentiment":"positive|mixed|negative","summary":"...","praises":["..."],` +
      `"complaints":["..."],"alert":"..."}\n` +
      `Rules: summary max 50 words. praises/complaints: up to 4 short phrases each (2-5 words), ` +
      `ONLY themes that actually repeat in the comments — empty arrays if none repeat. ` +
      `alert: one sentence ONLY if a serious complaint recurs in recent reviews, otherwise "".`,
    );
    if (!out?.summary) return json({ ...base, success: false, code: "ai_failed", detail: err });
    return json({
      ...base,
      generated_at: new Date().toISOString(),
      sentiment: ["positive", "mixed", "negative"].includes(String(out.sentiment || "").toLowerCase())
        ? String(out.sentiment).toLowerCase() : "mixed",
      summary: String(out.summary).slice(0, 500),
      praises: (Array.isArray(out.praises) ? out.praises : []).slice(0, 4).map((s: any) => String(s).slice(0, 60)),
      complaints: (Array.isArray(out.complaints) ? out.complaints : []).slice(0, 4).map((s: any) => String(s).slice(0, 60)),
      alert: String(out.alert || "").slice(0, 300),
    });
  } catch (e) {
    return json({ success: false, code: "server_error", detail: String((e as Error)?.message || e).slice(0, 160) }, 500);
  }
});
