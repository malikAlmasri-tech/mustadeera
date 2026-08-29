/* ═══════════════════════════════════════════════════════════════════════════
   push — من صفّ إشعارٍ في القاعدة إلى إشعار دفعٍ على الجهاز

   يُنادى من مُشغِّل `t_push_notify` (ترحيل 31) بجسمٍ فيه `{ id }` وحده.
   ويقرأ الصفّ بنفسه بـ`service_role` — **وهذا هو الموضع الوحيد في المشروع
   الذي يستعمله**، ولسببٍ لا مفرّ منه: الإشعار يخصّ مستخدمًا آخر (المالك أو
   اللاعب) ولا توجد جلسةٌ له في هذا السياق. ولذلك الدالّة **لا تقبل مدخلًا
   من عميل**: مفتاحها في `app_settings` المحجوب، ولا تفعل شيئًا إلّا قراءة
   صفٍّ بمعرّفه وإرسالَه إلى صاحبه هو.

   ⚠️ **والنصّ يُبنى هنا لا يُقرأ من الصفّ** — نفس قاعدة 14: الصفّ يحمل `kind`
      ومعطياته، والجملة تُكتب بلغة المستخدم. ونصٌّ مخزَّن يُجمَّد على لغة لحظة
      كتابته، فمن بدّل لغته يقرأ إشعاراته بلغةٍ هجرها.

   ⚠️ **ولا يفشل الحجز إن فشل الإشعار**: كل مسار خطأ هنا يردّ 200 مع سببٍ في
      الجسم. المُشغِّل غير حاجزٍ أصلًا، لكنّ ردًّا بـ500 يملأ `net._http_response`
      بضجيجٍ يخفي العطل الحقيقي حين يقع.
   ═══════════════════════════════════════════════════════════════════════════ */

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT") || "";

/* ── نصوص الإشعارات، باللغتين ────────────────────────────────────────────
   ⚠️ مرآةٌ مقصودة لـ`I18N` في التطبيق، ومختصرةٌ عمدًا: شريط النظام يقتطع بعد
      ~٤٠ محرفًا في العنوان و~١٢٠ في الجسم، فالجملة الطويلة تصل مبتورة. */
const T: Record<string, Record<string, { t: string; b: (d: Rec) => string }>> = {
  ar: {
    booking_new:       { t: "طلب حجز جديد",        b: (d) => `${d.customer_name ?? ""} — ${d.field_name ?? ""} · ${d.time_label ?? ""}` },
    booking_confirmed: { t: "تأكّد حجزك",           b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    booking_rejected:  { t: "اعتذر الملعب عن طلبك", b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    booking_cancelled: { t: "أُلغي الحجز",          b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    booking_moved:     { t: "تغيّر موعد الحجز",     b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    booking_expired:   { t: "انقضت مهلة الردّ",     b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    slot_free:         { t: "الوقت اللي بدّك ياه فضي", b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    game_joined:       { t: "انضمّ لاعب لمباراتك",  b: (d) => `${d.first_name ?? ""} انضمّ` },
    game_left:         { t: "انسحب لاعب",           b: (d) => `${d.first_name ?? ""} انسحب` },
    game_full:         { t: "اكتملت مباراتك",       b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
    game_off:          { t: "أُلغيت المباراة",       b: (d) => `${d.place_name ?? ""} · ${d.time_label ?? ""}` },
  },
  en: {
    booking_new:       { t: "New booking request", b: (d) => `${d.customer_name ?? ""} — ${d.field_name ?? ""}` },
    booking_confirmed: { t: "Booking confirmed",   b: (d) => `${d.place_name ?? ""}` },
    booking_rejected:  { t: "Request declined",    b: (d) => `${d.place_name ?? ""}` },
    booking_cancelled: { t: "Booking cancelled",   b: (d) => `${d.place_name ?? ""}` },
    booking_moved:     { t: "Booking time changed", b: (d) => `${d.place_name ?? ""}` },
    booking_expired:   { t: "The request timed out", b: (d) => `${d.place_name ?? ""}` },
    slot_free:         { t: "Your slot is free",   b: (d) => `${d.place_name ?? ""}` },
    game_joined:       { t: "A player joined",     b: (d) => `${d.first_name ?? ""} joined` },
    game_left:         { t: "A player left",       b: (d) => `${d.first_name ?? ""} left` },
    game_full:         { t: "Your game is full",   b: (d) => `${d.place_name ?? ""}` },
    game_off:          { t: "The game was cancelled", b: (d) => `${d.place_name ?? ""}` },
  },
};
type Rec = Record<string, unknown>;

const ok = (o: Rec) => new Response(JSON.stringify(o), {
  status: 200, headers: { "Content-Type": "application/json" },
});

async function rest(path: string): Promise<Rec[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` },
  });
  if (!r.ok) throw new Error(`rest ${r.status} ${(await r.text()).slice(0, 120)}`);
  return await r.json();
}

/* ── توكن OAuth2 لحساب الخدمة ────────────────────────────────────────────
   FCM v1 لا يقبل «مفتاح خادم» بعد الآن — يلزم توكن يُوقَّع بمفتاح حساب الخدمة.
   ⚠️ ويُخزَّن في الذاكرة حتى انتهائه: توليدُه في كل إشعار يضيف نداءً كاملًا
      إلى جوجل لكل رسالة، وهو تأخيرٌ في المسار الذي بُني كلُّه لأجل السرعة. */
let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const sa = JSON.parse(SA_RAW);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64(claim);

  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`)));
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${body}.${sigB64}`,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`oauth ${res.status} ${JSON.stringify(j).slice(0, 160)}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

Deno.serve(async (req) => {
  try {
    if (!SA_RAW) return ok({ sent: false, reason: "no_service_account" });

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return ok({ sent: false, reason: "bad_id" });

    const rows = await rest(
      `notifications?id=eq.${id}&select=id,kind,data,profile_id,booking_id`);
    const n = rows[0];
    if (!n) return ok({ sent: false, reason: "no_row" });

    /* لغة المستخدم من ملفّه إن كانت مخزَّنة، وإلّا العربية — وهي لغة المنتج
       الأساسية والأغلب. ولا تُخمَّن من الجهاز: لا نراه من هنا. */
    const prof = await rest(`profiles?id=eq.${n.profile_id}&select=fcm_token,lang`);
    const tok = prof[0]?.fcm_token as string | undefined;
    if (!tok) return ok({ sent: false, reason: "no_token" });

    const lang = (prof[0]?.lang as string) === "en" ? "en" : "ar";
    const spec = T[lang][String(n.kind)];
    if (!spec) return ok({ sent: false, reason: `unknown_kind:${n.kind}` });

    const d = (n.data ?? {}) as Rec;
    const sa = JSON.parse(SA_RAW);
    const at = await accessToken();

    const r = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
      body: JSON.stringify({
        message: {
          token: tok,
          notification: { title: spec.t, body: spec.b(d).trim() },
          /* المعرّف يسافر مع الرسالة كي تفتح النقرة ما يخصّها — التطبيق
             يستمع لـ`app:notification-tap` بنفس المفتاح `nid` (‏native.js). */
          data: { nid: String(n.id), kind: String(n.kind) },
          android: { priority: "high", notification: { channel_id: "mustadeera" } },
        },
      }),
    });
    const txt = await r.text();

    /* 🔴 رمزٌ ميّت ⇒ نظّفه. الجهاز الذي أُلغي تثبيته يردّ 404/UNREGISTERED،
       وإبقاؤه يعني محاولةً فاشلة عند كل إشعار إلى الأبد. */
    if (r.status === 404 || txt.includes("UNREGISTERED") || txt.includes("INVALID_ARGUMENT")) {
      await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${n.profile_id}`, {
        method: "PATCH",
        headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: null }),
      });
      return ok({ sent: false, reason: "token_dropped", status: r.status });
    }
    return ok({ sent: r.ok, status: r.status, detail: r.ok ? undefined : txt.slice(0, 200) });
  } catch (e) {
    /* السبب في الجسم لا في رمز الحالة — درس الدفعة الثلاثين: رسالةٌ لا تسمّي
       سببها تحوّل العمل من قراءة سطر إلى إعادة إنتاج عطل. */
    return ok({ sent: false, reason: "error", detail: String((e as Error).message).slice(0, 200) });
  }
});
