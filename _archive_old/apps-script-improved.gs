/* =============================================================
   المستديرة · Google Apps Script (نسخة محسّنة)
   ✦ متوافقة رجعياً: نفس أسماء الـ actions ونفس شكل الردود،
     فالواجهة الحالية تشتغل عليها بدون أي تعديل.

   أهم التحسينات مقابل النسخة الأصلية:
   1) أمان كلمات السر: تُخزَّن مُجزّأة (SHA-256 + salt) بدل النص الصريح،
      مع ترقية تلقائية عند أول تسجيل دخول (لا حاجة لتعديل يدوي للبيانات).
   2) توكنات موقّعة (HMAC-SHA256) + صلاحية زمنية (انتهاء)، مع قبول
      التوكنات القديمة مؤقتاً لضمان عدم خروج المستخدمين الحاليين.
   3) عدم الوثوق بسعر العميل: السعر/الأسماء تُشتق من الشيت في الخادم
      عند الحجز (يمنع التلاعب بالسعر من المتصفّح).
   4) أداء: قراءة واحدة للورقة بدل قراءتين (getDisplayValues فقط).
   5) متانة: doGet/doPost ملفوفان بـ try/catch ⇒ يرجّعان JSON دائماً
      (بدل صفحة خطأ HTML)، وتوجيه عبر خريطة بدل سلسلة if الطويلة.
   6) حدود إدخال بسيطة (طول الاسم/التعليق) لحماية الورقة.

   ⚠️ جرّبها على نسخة من الـ Spreadsheet أولاً.
   ============================================================= */

const SPREADSHEET_ID = "1sg2IxxU0PbhVjk9BJx3iSWxgyjJE5iFb75LH_2mDgq0";

const SHEET_PLACES   = "Places";
const SHEET_FIELDS   = "Fields";
const SHEET_BOOKINGS = "Bookings";
const SHEET_REVIEWS  = "Reviews";
const SHEET_OWNERS   = "Owners";
const SHEET_PLAYERS  = "Players";

const CACHE_KEY_PLACES = "mustadeera_places_v9";
const CACHE_TTL_SECONDS = 600;
const TOKEN_TTL_MS = 45 * 24 * 60 * 60 * 1000; // صلاحية التوكن: 45 يوم
const MAX_NAME = 60, MAX_COMMENT = 500;        // حدود إدخال

/* ============ السرّ المشترك لتوقيع التوكنات ============ */
/* يُحفظ مرة واحدة في Script Properties (لا يظهر في الكود).
   إن لم يوجد يُولَّد تلقائياً. */
function getTokenSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("TOKEN_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("TOKEN_SECRET", secret);
  }
  return secret;
}

/* ============ الكاش ============ */
function getAppCache() { return CacheService.getScriptCache(); }
function invalidatePlacesCache() { try { getAppCache().remove(CACHE_KEY_PLACES); } catch (err) {} }
function getCachedPlacesPayload() {
  const cached = getAppCache().get(CACHE_KEY_PLACES);
  if (!cached) return null;
  try { return JSON.parse(cached); } catch (err) { invalidatePlacesCache(); return null; }
}
function setCachedPlacesPayload(payload) {
  try { getAppCache().put(CACHE_KEY_PLACES, JSON.stringify(payload), CACHE_TTL_SECONDS); } catch (err) {}
}

function makeSafeId(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
}

/* ============ التوجيه (Routing) ============ */
// خرائط بدل سلسلة if الطويلة — أسهل صيانةً وأقل تكراراً.
const GET_ROUTES = {
  getInitialData: e => getInitialData(isTrue(e.parameter.force)),
  getPlaces:      e => getPlacesPayload(isTrue(e.parameter.force)),
  getFields:      ()=> getPlaces(),
  getBookings:    ()=> getPublicBookings(),
  getReviews:     ()=> getReviews(),
  ownerLogin:     e => ownerLogin(e.parameter.phone, e.parameter.password),
  getOwnerData:   e => getOwnerData(e.parameter.owner_token),
  playerLogin:    e => playerLogin(e.parameter.phone, e.parameter.password),
  getPlayerBookings: e => getPlayerBookings(e.parameter.player_token),
  getPlayerProfile:  e => getPlayerProfile(e.parameter.player_token),
};
const POST_ROUTES = {
  createBooking:            d => createBooking(d),
  ownerCreateManualBooking: d => ownerCreateManualBooking(d),
  createReview:             d => createReview(d),
  updateBookingStatus:      d => updateBookingStatus(d),
  ownerUpdateField:         d => ownerUpdateField(d),
  ownerAddField:            d => ownerAddField(d),
  playerRegister:           d => playerRegister(d),
  updatePlayerProfile:      d => updatePlayerProfile(d),
};
const isTrue = v => v === "1" || v === "true";

function doGet(e) {
  try {
    const handler = GET_ROUTES[e && e.parameter && e.parameter.action];
    if (!handler) return jsonResponse({ success: false, message: "طلب غير معروف" });
    return jsonResponse(handler(e));
  } catch (err) {
    return jsonResponse({ success: false, message: "صار خطأ بالخادم", error: String(err) });
  }
}
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const handler = POST_ROUTES[data.action];
    if (!handler) return jsonResponse({ success: false, message: "طلب غير معروف" });
    return jsonResponse(handler(data));
  } catch (err) {
    return jsonResponse({ success: false, message: "صار خطأ بالخادم", error: String(err) });
  }
}
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/* ============ أدوات الورقة ============ */
function normalizeHeader(h) {
  return String(h || "").replace(/﻿/g, "").replace(/​/g, "").trim().toLowerCase();
}
function pickNumber(row, key) {
  const value = row[normalizeHeader(key)];
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(String(value).replace(",", ".").trim());
  return Number.isNaN(n) ? 0 : n;
}
/* تحسين أداء: قراءة واحدة (getDisplayValues) بدل قراءتين كما في الأصل. */
function getRowsAsObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const displayValues = sheet.getDataRange().getDisplayValues();
  if (displayValues.length < 2) return [];
  const headers = displayValues.shift().map(normalizeHeader);
  return displayValues
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .map((row, index) => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      obj._row_number = index + 2;
      return obj;
    });
}
function appendObjectByHeaders(sheetName, obj) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : "");
  sheet.appendRow(row);
}
function setCellByHeader(sheetName, rowNumber, headerName, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const col = headers.indexOf(normalizeHeader(headerName)) + 1;
  if (col) sheet.getRange(rowNumber, col).setValue(value);
}

function isActive(value) {
  const v = String(value).trim().toLowerCase();
  return value === true || v === "true" || v === "yes" || v === "1" || v === "active" || v === "";
}
function normalizePhone(phone) {
  phone = String(phone || "").trim().replace(/\s+/g, "");
  if (phone.startsWith("+")) phone = phone.substring(1);
  if (phone.startsWith("00962")) phone = "962" + phone.substring(5);
  if (phone.startsWith("07")) phone = "962" + phone.substring(1);
  return phone;
}
function clip(s, max) { return String(s || "").trim().slice(0, max); }

function formatDateSafe(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value))
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  return String(value || "");
}
function formatDateOnlySafe(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value))
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(value || "").split("T")[0];
}

function convertSlots(type) {
  if (!type || String(type).trim().toLowerCase() === "full")
    return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م|14=2:00 - 4:00 م|16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  type = String(type).trim().toLowerCase();
  if (type === "morning") return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م";
  if (type === "evening") return "16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  return type;
}
/* استخراج وسم الوقت من سلسلة الـ slots اعتماداً على ساعة البداية (لاشتقاق time في الخادم) */
function slotLabelFromHour(slotsString, hour) {
  const parts = String(slotsString || "").split("|");
  for (let i = 0; i < parts.length; i++) {
    const kv = parts[i].split("=");
    if (Number(kv[0]) === Number(hour)) return (kv[1] || "").trim();
  }
  return "";
}

function getAmenityValue(value, key) {
  const v = String(value || "").trim();
  if (!v) return "";
  const low = v.toLowerCase();
  if (["false", "no", "0", "غير متوفر"].includes(low)) return "";
  if (["true", "yes", "1"].includes(low)) return key + ":Available";
  return key + ":" + v;
}

/* ============ الأماكن/الملاعب ============ */
function getPlaces() {
  const placesRows = getRowsAsObjects(SHEET_PLACES).filter(p => isActive(p.active));
  const fieldsRows = getRowsAsObjects(SHEET_FIELDS).filter(f => isActive(f.active));
  const stats = getReviewsStats();

  return placesRows.map(p => {
    const placeId = String(p.place_id).trim();
    const placeFields = fieldsRows
      .filter(f => String(f.place_id).trim() === placeId)
      .map(f => ({
        field_id: String(f.field_id || "").trim(),
        place_id: placeId,
        field_name: String(f.field_name || "ملعب").trim(),
        size: String(f.size || "5×5").trim(),
        price: Number(f.price || 0),
        slots: convertSlots(f.slots),
        active: isActive(f.active),
        image_url: String(f.image_url || "").trim()
      }));
    const reviewStat = stats[placeId];
    return {
      place_id: placeId,
      place_name: String(p.place_name || "").trim(),
      city: String(p.city || "").trim(),
      region: String(p.region || "all").trim(),
      type: String(p.type || "عشب صناعي").trim(),
      color: String(p.color || "#15803d").trim(),
      phone: String(p.phone || "962782761026").trim(),
      active: isActive(p.active),
      map_link: String(p.map_link || "").trim(),
      amenities: [
        getAmenityValue(p.has_water, "water"),
        getAmenityValue(p.has_vests, "vests"),
        getAmenityValue(p.has_ball, "ball"),
        getAmenityValue(p.has_bathrooms, "bathrooms"),
        getAmenityValue(p.has_parking, "parking")
      ].filter(Boolean).join("|"),
      rating: reviewStat ? Number((reviewStat.sum / reviewStat.count).toFixed(1)) : pickNumber(p, "rating"),
      reviews: reviewStat ? reviewStat.count : pickNumber(p, "reviews"),
      fields: placeFields
    };
  }).filter(p => p.fields.length > 0);
}
function getPlacesPayload(forceRefresh) {
  if (!forceRefresh) { const c = getCachedPlacesPayload(); if (c) return c; }
  const payload = { version: "performance-initial-data-v10", cached: false, generated_at: new Date(), places: getPlaces() };
  setCachedPlacesPayload(payload);
  return payload;
}
function getInitialData(forceRefresh) {
  const placesPayload = getPlacesPayload(forceRefresh);
  return {
    success: true, version: "initial-data-v1", cached: !!placesPayload.cached,
    generated_at: new Date(), places: placesPayload.places || [], bookings: getPublicBookings()
  };
}
function getReviewsStats() {
  const reviews = getRowsAsObjects(SHEET_REVIEWS);
  const stats = {};
  reviews.forEach(r => {
    const placeId = String(r.place_id || "").trim();
    const rating = Number(String(r.rating || "").replace(",", ".").trim());
    if (!placeId || Number.isNaN(rating) || rating < 1 || rating > 5) return;
    if (!stats[placeId]) stats[placeId] = { sum: 0, count: 0 };
    stats[placeId].sum += rating; stats[placeId].count += 1;
  });
  return stats;
}

/* ============ الحجوزات ============ */
function getBookings() {
  return getRowsAsObjects(SHEET_BOOKINGS).map(b => ({
    ...b,
    row_number: b._row_number,
    timestamp: formatDateSafe(b.timestamp),
    player_id: String(b.player_id || "").trim(),
    date: formatDateOnlySafe(b.date),
    place_id: String(b.place_id || "").trim(),
    place_name: String(b.place_name || "").trim(),
    field_id: String(b.field_id || "").trim(),
    field_name: String(b.field_name || "").trim(),
    city: String(b.city || "").trim(),
    time: String(b.time || "").trim(),
    hour: Number(b.hour),
    name: String(b.name || "").trim(),
    phone: normalizePhone(b.phone),
    players: String(b.players || "").trim(),
    price: Number(b.price || 0),
    source: String(b.source || "direct").trim(),
    status: String(b.status || "pending").trim().toLowerCase(),
    cancel_reason: String(b.cancel_reason || "").trim()
  }));
}
function getPublicBookings() {
  return getBookings().map(b => ({ date: b.date, place_id: b.place_id, field_id: b.field_id, hour: b.hour, status: b.status }));
}
function getReviews() { return getRowsAsObjects(SHEET_REVIEWS); }
function getOwners()  { return getRowsAsObjects(SHEET_OWNERS); }
function getPlayers() { return getRowsAsObjects(SHEET_PLAYERS); }

/* ============ تجزئة كلمات السر (SHA-256 + salt) ============ */
function sha256Hex(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}
function hashPassword(plain) {
  const salt = Utilities.getUuid().replace(/-/g, "").substring(0, 12);
  return "sha256$" + salt + "$" + sha256Hex(salt + "|" + plain);
}
/* يتحقّق من كلمة السر. متوافق رجعياً:
   - إن كانت القيمة المخزّنة مجزّأة (sha256$..) ⇒ مقارنة الهاش.
   - إن كانت نصاً صريحاً (بيانات قديمة) ⇒ مقارنة مباشرة (ويُعاد ترقيتها). */
function verifyPassword(stored, plain) {
  stored = String(stored || "");
  plain = String(plain || "");
  if (stored.indexOf("sha256$") === 0) {
    const parts = stored.split("$"); // ["sha256", salt, hash]
    return parts.length === 3 && sha256Hex(parts[1] + "|" + plain) === parts[2];
  }
  return stored.trim() === plain.trim(); // قديم (نص صريح)
}
function isHashed(stored) { return String(stored || "").indexOf("sha256$") === 0; }

/* ============ التوكنات الموقّعة (HMAC-SHA256 + انتهاء) ============ */
function b64url(bytesOrString) {
  const bytes = (typeof bytesOrString === "string")
    ? Utilities.newBlob(bytesOrString).getBytes() : bytesOrString;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}
function hmac(payload) {
  return b64url(Utilities.computeHmacSha256Signature(payload, getTokenSecret()));
}
function signToken(payloadParts) {
  // payloadParts: مصفوفة (id, phone, [placeId]) — نضيف الانتهاء ثم نوقّع.
  const payload = payloadParts.concat([Date.now() + TOKEN_TTL_MS]).join("|");
  return b64url(payload) + "." + hmac(payload);
}
function verifyToken(token) {
  token = String(token || "");
  const dot = token.indexOf(".");
  if (dot === -1) return { legacy: true, token: token }; // توكن قديم ⇒ يُفحص بالطريقة القديمة
  const payloadB64 = token.substring(0, dot);
  const sig = token.substring(dot + 1);
  let payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString(); }
  catch (e) { return null; }
  if (hmac(payload) !== sig) return null;             // توقيع غير صالح
  const parts = payload.split("|");
  const exp = Number(parts[parts.length - 1]);
  if (!exp || Date.now() > exp) return null;          // منتهي
  return { legacy: false, parts: parts.slice(0, -1) };
}
/* فكّ التوكن القديم (base64 عادي: id|phone[|place]) — للتوافق الرجعي فقط */
function decodeLegacy(token) {
  try {
    const raw = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    return raw.split("|");
  } catch (e) { return null; }
}

function makePlayerToken(playerId, phone) { return signToken([String(playerId), normalizePhone(phone)]); }
function makeOwnerToken(ownerId, phone, placeId) { return signToken([String(ownerId), normalizePhone(phone), String(placeId)]); }

function validatePlayerToken(token) {
  const v = verifyToken(token);
  let playerId, phone;
  if (!v) return null;
  if (v.legacy) { const p = decodeLegacy(v.token); if (!p) return null; playerId = String(p[0] || "").trim(); phone = normalizePhone(p[1]); }
  else { playerId = String(v.parts[0] || "").trim(); phone = normalizePhone(v.parts[1]); }

  const player = getPlayers().find(p =>
    String(p.player_id || "").trim() === playerId &&
    normalizePhone(p.phone) === phone &&
    isActive(p.active)
  );
  if (!player) return null;
  return { player_id: String(player.player_id || "").trim(), name: String(player.name || "").trim(), phone: normalizePhone(player.phone) };
}
function validateOwnerToken(token) {
  const v = verifyToken(token);
  let ownerId, phone, placeId;
  if (!v) return null;
  if (v.legacy) { const p = decodeLegacy(v.token); if (!p) return null; ownerId = p[0]; phone = normalizePhone(p[1]); placeId = p[2]; }
  else { ownerId = v.parts[0]; phone = normalizePhone(v.parts[1]); placeId = v.parts[2]; }

  const owner = getOwners().find(o =>
    String(o.owner_id || "").trim() === String(ownerId || "").trim() &&
    normalizePhone(o.phone) === normalizePhone(phone) &&
    String(o.place_id || "").trim() === String(placeId || "").trim()
  );
  if (!owner) return null;
  return { owner_id: String(owner.owner_id || "").trim(), phone: normalizePhone(owner.phone), place_id: String(owner.place_id || "").trim() };
}

/* ============ تسجيل اللاعب ودخوله ============ */
function playerRegister(data) {
  const name = clip(data.name, MAX_NAME);
  const phone = normalizePhone(data.phone);
  const password = String(data.password || "").trim();

  if (!name || !phone || !password) return { success: false, message: "كمّل البيانات كلها عشان نكمل" };
  if (password.length < 4) return { success: false, message: "كلمة السر قصيرة، زيد عليها شوي" };

  const players = getPlayers();
  if (players.some(p => normalizePhone(p.phone) === phone)) return { success: false, message: "الرقم عنده حساب، ادخل من هون" };

  const newPlayerId = makeSafeId("player");
  appendObjectByHeaders(SHEET_PLAYERS, {
    player_id: newPlayerId, created_at: new Date(), name, phone,
    password: hashPassword(password),   // ✦ مُجزّأة
    active: true
  });

  return { success: true, message: "تمام، حسابك جاهز", player: { player_id: String(newPlayerId), name, phone }, player_token: makePlayerToken(newPlayerId, phone) };
}
function playerLogin(phone, password) {
  phone = normalizePhone(phone);
  password = String(password || "").trim();
  const players = getRowsAsObjects(SHEET_PLAYERS);
  const player = players.find(p => normalizePhone(p.phone) === phone && isActive(p.active) && verifyPassword(p.password, password));
  if (!player) return { success: false, message: "الرقم أو كلمة السر غلط، حاول مرة ثانية" };

  // ترقية تلقائية: لو كانت مخزّنة نصاً صريحاً، حوّلها لهاش الآن.
  if (!isHashed(player.password)) { try { setCellByHeader(SHEET_PLAYERS, player._row_number, "password", hashPassword(password)); } catch (e) {} }

  return {
    success: true, message: "أهلاً، تفضل",
    player: { player_id: String(player.player_id || "").trim(), name: String(player.name || "").trim(), phone: normalizePhone(player.phone) },
    player_token: makePlayerToken(player.player_id, player.phone)
  };
}
function getPlayerProfile(playerToken) {
  const player = validatePlayerToken(playerToken);
  if (!player) return { success: false, message: "سجّل دخولك أول" };
  return { success: true, player };
}
function updatePlayerProfile(data) {
  const player = validatePlayerToken(data.player_token);
  if (!player) return { success: false, message: "سجّل دخولك أول" };
  const newName = clip(data.name, MAX_NAME);
  if (!newName) return { success: false, message: "ما حطيت اسمك" };
  const players = getRowsAsObjects(SHEET_PLAYERS);
  const target = players.find(p => String(p.player_id || "").trim() === player.player_id);
  if (!target) return { success: false, message: "ما لقينا الحساب، تواصل معنا" };
  setCellByHeader(SHEET_PLAYERS, target._row_number, "name", newName);
  return { success: true, message: "تمام، حفظنا التعديلات", player: { player_id: player.player_id, name: newName, phone: player.phone } };
}
function getPlayerBookings(playerToken) {
  const player = validatePlayerToken(playerToken);
  if (!player) return { success: false, message: "سجّل دخولك أول" };
  const bookings = getBookings()
    .filter(b => String(b.player_id || "").trim() === String(player.player_id))
    .map(pickBookingFields)
    .sort(sortBookingsNewestFirst);
  return { success: true, player, bookings };
}

/* ============ دخول المالك ولوحته ============ */
function ownerLogin(phone, password) {
  phone = normalizePhone(phone);
  password = String(password || "").trim();
  const owners = getRowsAsObjects(SHEET_OWNERS);
  const owner = owners.find(o => normalizePhone(o.phone) === phone && verifyPassword(o.password, password));
  if (!owner) return { success: false, message: "الرقم أو كلمة السر غلط، حاول مرة ثانية" };
  if (!isHashed(owner.password)) { try { setCellByHeader(SHEET_OWNERS, owner._row_number, "password", hashPassword(password)); } catch (e) {} }
  return {
    success: true, message: "أهلاً، تفضل",
    owner: { owner_id: String(owner.owner_id || "").trim(), phone: normalizePhone(owner.phone), place_id: String(owner.place_id || "").trim() },
    owner_token: makeOwnerToken(owner.owner_id, owner.phone, owner.place_id)
  };
}
function getOwnerData(ownerToken) {
  const owner = validateOwnerToken(ownerToken);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  const placeId = String(owner.place_id).trim();
  const ownerPlace = getPlaces().find(p => String(p.place_id) === placeId);
  const bookings = getBookings()
    .filter(b => String(b.place_id).trim() === placeId)
    .map(b => Object.assign(pickBookingFields(b), { player_id: b.player_id }))
    .sort(sortBookingsNewestFirst);
  return { success: true, owner, place: ownerPlace || null, fields: ownerPlace ? ownerPlace.fields : [], bookings };
}
function pickBookingFields(b) {
  return {
    row_number: b.row_number, timestamp: b.timestamp, date: b.date, place_id: b.place_id,
    place_name: b.place_name, field_id: b.field_id, field_name: b.field_name, city: b.city,
    time: b.time, hour: b.hour, name: b.name, phone: b.phone, players: b.players,
    price: b.price, source: b.source, status: b.status, cancel_reason: b.cancel_reason
  };
}
function sortBookingsNewestFirst(a, b) {
  const d1 = new Date(a.date + "T" + String(a.hour || 0).padStart(2, "0") + ":00:00");
  const d2 = new Date(b.date + "T" + String(b.hour || 0).padStart(2, "0") + ":00:00");
  return d2 - d1;
}

/* ============ إنشاء حجز (سعر مشتق من الخادم) ============ */
function createBooking(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const player = validatePlayerToken(data.player_token);
    if (!player) return { success: false, message: "سجّل دخولك أول قبل الحجز" };

    const date = formatDateOnlySafe(data.date);
    const hour = Number(data.hour);
    const fieldId = String(data.field_id || "").trim();
    if (!fieldId || !date || Number.isNaN(hour)) return { success: false, message: "اختار الملعب واليوم والوقت" };

    // ✦ لا نثق ببيانات العميل: نشتق الملعب/المكان/السعر من الشيت.
    let foundPlace = null, foundField = null;
    const places = getPlaces();
    for (const p of places) {
      const f = (p.fields || []).find(x => String(x.field_id).trim() === fieldId);
      if (f) { foundPlace = p; foundField = f; break; }
    }
    if (!foundField) return { success: false, message: "هذا الملعب غير متاح" };

    const bookings = getBookings();
    const exists = bookings.some(b =>
      String(b.field_id) === fieldId &&
      String(b.date) === String(date) &&
      Number(b.hour) === hour &&
      !["cancelled", "rejected"].includes(String(b.status || "pending").toLowerCase())
    );
    if (exists) return { success: false, message: "هذا الوقت راح، اختار وقت ثاني" };

    appendObjectByHeaders(SHEET_BOOKINGS, {
      timestamp: new Date(),
      booking_id: makeSafeId("booking"),
      player_id: player.player_id,
      date,
      place_id: foundPlace.place_id,
      place_name: foundPlace.place_name,
      field_id: foundField.field_id,
      field_name: foundField.field_name,
      city: foundPlace.city,
      time: slotLabelFromHour(foundField.slots, hour) || String(data.time || ""),
      hour,
      name: player.name,
      phone: player.phone,
      players: foundField.size || "",
      price: Number(foundField.price || 0),       // ✦ السعر من الشيت لا من العميل
      source: clip(data.source, 40) || "direct",
      status: "pending",
      cancel_reason: ""
    });
    return { success: true, message: "وصل طلبك، بنأكدلك قريب" };
  } catch (err) {
    return { success: false, message: "صار ضغط على النظام، حاول بعد ثانية" };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ============ حجز خارجي للمالك ============ */
function ownerCreateManualBooking(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const owner = validateOwnerToken(data.owner_token);
    if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

    const fieldId = String(data.field_id || "").trim();
    const date = formatDateOnlySafe(data.date);
    const hour = Number(data.hour);
    const name = clip(data.name, MAX_NAME) || "حجز خارجي";
    const phone = normalizePhone(data.phone || "");
    if (!fieldId || !date || Number.isNaN(hour)) return { success: false, message: "اختار الملعب واليوم والوقت" };

    const placeId = String(owner.place_id).trim();
    const ownerPlace = getPlaces().find(p => String(p.place_id).trim() === placeId);
    if (!ownerPlace) return { success: false, message: "ما لقينا المكان تبعك" };
    const field = (ownerPlace.fields || []).find(f => String(f.field_id).trim() === fieldId);
    if (!field) return { success: false, message: "هذا الملعب مش تابع لحسابك" };

    const exists = getBookings().some(b =>
      String(b.field_id) === fieldId && String(b.date) === String(date) && Number(b.hour) === hour &&
      !["cancelled", "rejected"].includes(String(b.status || "pending").toLowerCase())
    );
    if (exists) return { success: false, message: "هذا الوقت محجوز بالفعل" };

    appendObjectByHeaders(SHEET_BOOKINGS, {
      timestamp: new Date(), booking_id: makeSafeId("booking"), player_id: "",
      date, place_id: placeId, place_name: ownerPlace.place_name,
      field_id: field.field_id, field_name: field.field_name, city: ownerPlace.city,
      time: data.time || slotLabelFromHour(field.slots, hour), hour, name, phone,
      players: data.players || field.size || "",
      price: Number(data.price || field.price || 0),  // المالك يحدّد السعر يدوياً (مسموح)
      source: "owner_manual", status: "confirmed", cancel_reason: "حجز خارجي أدخله المالك"
    });
    return { success: true, message: "تمام، أضفنا الحجز الخارجي وحجزنا الوقت" };
  } catch (err) {
    return { success: false, message: "صار ضغط على النظام، حاول بعد ثانية" };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ============ التقييمات ============ */
function createReview(data) {
  const rating = Number(String(data.rating || "").replace(",", ".").trim());
  if (!data.place_id || Number.isNaN(rating) || rating < 1 || rating > 5) return { success: false, message: "في شي ناقص بالتقييم" };
  appendObjectByHeaders(SHEET_REVIEWS, {
    timestamp: new Date(), review_id: makeSafeId("review"),
    place_id: clip(data.place_id, 60), field_id: clip(data.field_id, 60),
    user_name: clip(data.user_name, MAX_NAME), phone: normalizePhone(data.phone),
    rating, comment: clip(data.comment, MAX_COMMENT)
  });
  invalidatePlacesCache();
  return { success: true, message: "شكراً، تقييمك وصل" };
}

/* ============ تحديث حالة الحجز ============ */
function updateBookingStatus(data) {
  const owner = validateOwnerToken(data.owner_token);
  const player = owner ? null : validatePlayerToken(data.player_token); // اللاعب يلغي حجزه فقط
  if (!owner && !player) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

  const rowNumber = Number(data.row_number);
  const newStatus = String(data.status || "").trim().toLowerCase();
  const cancelReason = clip(data.cancel_reason, MAX_COMMENT);
  const allowed = ["pending", "confirmed", "cancelled", "rejected"];
  if (!rowNumber || rowNumber < 2) return { success: false, message: "رقم الحجز ما اشتغل" };
  if (!allowed.includes(newStatus)) return { success: false, message: "في خطأ بالحالة المختارة" };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const placeIdCol = headers.indexOf("place_id");
  const playerIdCol = headers.indexOf("player_id");
  if (placeIdCol === -1) return { success: false, message: "خطأ بإعدادات الشيت — تواصل مع الدعم" };

  const bookingPlaceId = String(rowValues[placeIdCol]).trim();
  const bookingPlayerId = playerIdCol > -1 ? String(rowValues[playerIdCol]).trim() : "";

  if (owner) {
    if (bookingPlaceId !== String(owner.place_id).trim()) return { success: false, message: "هذا الحجز مش تبعك" };
  } else {
    // اللاعب: يقدر يلغي حجزه هو فقط
    if (bookingPlayerId !== String(player.player_id).trim()) return { success: false, message: "هذا الحجز مش تبعك" };
    if (newStatus !== "cancelled") return { success: false, message: "غير مسموح بهذا الإجراء" };
  }

  setCellByHeader(SHEET_BOOKINGS, rowNumber, "status", newStatus);
  setCellByHeader(SHEET_BOOKINGS, rowNumber, "cancel_reason", (newStatus === "cancelled" || newStatus === "rejected") ? cancelReason : "");
  return { success: true, message: "تم الحفظ" };
}

/* ============ إدارة الملاعب ============ */
function ownerUpdateField(data) {
  const owner = validateOwnerToken(data.owner_token);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  const fieldId = String(data.field_id || "").trim();
  const newPrice = Number(data.price);
  const newSlots = String(data.slots || "full").trim();
  if (!fieldId) return { success: false, message: "ما لقينا معرف الملعب" };
  if (Number.isNaN(newPrice) || newPrice <= 0) return { success: false, message: "السعر اللي حطيته ما اشتغل" };

  const fields = getRowsAsObjects(SHEET_FIELDS);
  const field = fields.find(f => String(f.field_id || "").trim() === fieldId);
  if (!field) return { success: false, message: "ما لقينا الملعب" };
  if (String(field.place_id || "").trim() !== String(owner.place_id).trim()) return { success: false, message: "هذا الملعب مش تبعك" };

  setCellByHeader(SHEET_FIELDS, field._row_number, "price", newPrice);
  setCellByHeader(SHEET_FIELDS, field._row_number, "slots", newSlots);
  setCellByHeader(SHEET_FIELDS, field._row_number, "active", data.active === false ? false : true);
  invalidatePlacesCache();
  return { success: true, message: "تمام، حفظنا التعديلات" };
}
function ownerAddField(data) {
  const owner = validateOwnerToken(data.owner_token);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  const fieldName = clip(data.field_name, MAX_NAME);
  const size = String(data.size || "6×6").trim();
  const price = Number(data.price);
  const slots = String(data.slots || "full").trim();
  if (!fieldName) return { success: false, message: "ما حطيت اسم الملعب" };
  if (Number.isNaN(price) || price <= 0) return { success: false, message: "السعر اللي حطيته ما اشتغل" };

  const newFieldId = makeSafeId("field");
  appendObjectByHeaders(SHEET_FIELDS, { field_id: newFieldId, place_id: owner.place_id, field_name: fieldName, size, price, slots, active: true });
  invalidatePlacesCache();
  return { success: true, message: "تمام، الملعب انضاف", field_id: newFieldId };
}
