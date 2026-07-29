const SPREADSHEET_ID = "1sg2IxxU0PbhVjk9BJx3iSWxgyjJE5iFb75LH_2mDgq0";

const SHEET_PLACES = "Places";
const SHEET_FIELDS = "Fields";
const SHEET_BOOKINGS = "Bookings";
const SHEET_REVIEWS = "Reviews";
const SHEET_OWNERS = "Owners";
const SHEET_PLAYERS = "Players";

const CACHE_KEY_PLACES = "mustadeera_places_v9";
const CACHE_TTL_SECONDS = 600;

function getAppCache() {
  return CacheService.getScriptCache();
}

function invalidatePlacesCache() {
  try {
    getAppCache().remove(CACHE_KEY_PLACES);
  } catch (err) {}
}

function getCachedPlacesPayload() {
  const cached = getAppCache().get(CACHE_KEY_PLACES);
  if (!cached) return null;

  try {
    return JSON.parse(cached);
  } catch (err) {
    invalidatePlacesCache();
    return null;
  }
}

function setCachedPlacesPayload(payload) {
  try {
    getAppCache().put(CACHE_KEY_PLACES, JSON.stringify(payload), CACHE_TTL_SECONDS);
  } catch (err) {}
}

function makeSafeId(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
}


function getPlacesPayload(forceRefresh) {
  if (!forceRefresh) {
    const cachedPayload = getCachedPlacesPayload();
    if (cachedPayload) return cachedPayload;
  }

  const payload = {
    version: "performance-initial-data-v10",
    cached: false,
    generated_at: new Date(),
    places: getPlaces()
  };

  setCachedPlacesPayload(payload);
  return payload;
}

function getInitialData(forceRefresh) {
  const placesPayload = getPlacesPayload(forceRefresh);
  return {
    success: true,
    version: "initial-data-v1",
    cached: !!placesPayload.cached,
    generated_at: new Date(),
    places: placesPayload.places || [],
    bookings: getPublicBookings()
  };
}

function doGet(e) {
 try {
  const action = e.parameter.action;

  if (action === "getInitialData") {
    return jsonResponse(getInitialData(e.parameter.force === "1" || e.parameter.force === "true"));
  }

  if (action === "getPlaces") {
    return jsonResponse(getPlacesPayload(e.parameter.force === "1" || e.parameter.force === "true"));
  }

  if (action === "getFields") return jsonResponse(getPlaces());
  if (action === "getBookings") return jsonResponse(getPublicBookings());
  if (action === "getReviews") return jsonResponse(getReviews());

  if (action === "ownerLogin") return jsonResponse(ownerLogin(e.parameter.phone, e.parameter.password));
  if (action === "getOwnerData") return jsonResponse(getOwnerData(e.parameter.owner_token));

  // 🤖 ميزات الذكاء الاصطناعي للوحة المالك (lang=ar/en · force=1 يتجاوز الكاش)
  if (action === "aiInsights") return jsonResponse(aiBusinessInsights(e.parameter.owner_token, e.parameter.lang, e.parameter.force === "1"));
  if (action === "aiReviews")  return jsonResponse(aiReviewSummary(e.parameter.owner_token, e.parameter.lang, e.parameter.force === "1"));
  if (action === "aiWeather")  return jsonResponse(aiWeatherAlert(e.parameter.owner_token, e.parameter.lang, e.parameter.force === "1"));

  if (action === "playerLogin") return jsonResponse(playerLogin(e.parameter.phone, e.parameter.password));
  if (action === "getPlayerBookings") return jsonResponse(getPlayerBookings(e.parameter.player_token));
  if (action === "getPlayerProfile") return jsonResponse(getPlayerProfile(e.parameter.player_token));

  return jsonResponse({ success: false, message: "طلب غير معروف" });
 } catch (err) {
  return jsonResponse({ success: false, message: "صار خطأ بالخادم، حاول مرة ثانية" });
 }
}

function doPost(e) {
 try {
  const data = JSON.parse(e.postData.contents || "{}");

  if (data.action === "createBooking") return jsonResponse(createBooking(data));
  if (data.action === "ownerCreateManualBooking") return jsonResponse(ownerCreateManualBooking(data));
  if (data.action === "createReview") return jsonResponse(createReview(data));
  if (data.action === "updateBookingStatus") return jsonResponse(updateBookingStatus(data));
  if (data.action === "ownerUpdateField") return jsonResponse(ownerUpdateField(data));
  if (data.action === "ownerAddField") return jsonResponse(ownerAddField(data));
  if (data.action === "playerRegister") return jsonResponse(playerRegister(data));
  if (data.action === "updatePlayerProfile") return jsonResponse(updatePlayerProfile(data));

  return jsonResponse({ success: false, message: "طلب غير معروف" });
 } catch (err) {
  return jsonResponse({ success: false, message: "صار خطأ بالخادم، حاول مرة ثانية" });
 }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeHeader(h) {
  return String(h || "")
    .replace(/\uFEFF/g, "")
    .replace(/\u200B/g, "")
    .trim()
    .toLowerCase();
}

function pickNumber(row, key) {
  const value = row[normalizeHeader(key)];

  if (value === "" || value === null || value === undefined) return 0;

  const n = Number(String(value).replace(",", ".").trim());
  return Number.isNaN(n) ? 0 : n;
}

function getRowsAsObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();

  if (values.length < 2) return [];

  const headers = displayValues.shift().map(normalizeHeader);
  values.shift();

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

function formatDateSafe(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }
  return String(value || "");
}

function formatDateOnlySafe(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value || "").split("T")[0];
}

function convertSlots(type) {
  if (!type || String(type).trim().toLowerCase() === "full") {
    return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م|14=2:00 - 4:00 م|16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  }

  type = String(type).trim().toLowerCase();

  if (type === "morning") {
    return "8=8:00 - 10:00 ص|10=10:00 - 12:00 م|12=12:00 - 2:00 م";
  }

  if (type === "evening") {
    return "16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  }

  return type;
}

function getAmenityValue(value, key) {
  const v = String(value || "").trim();

  if (!v) return "";

  const low = v.toLowerCase();

  if (["false", "no", "0", "غير متوفر"].includes(low)) return "";

  if (["true", "yes", "1"].includes(low)) return key + ":Available";

  return key + ":" + v;
}

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
      rating: reviewStat
        ? Number((reviewStat.sum / reviewStat.count).toFixed(1))
        : pickNumber(p, "rating"),

      reviews: reviewStat
        ? reviewStat.count
        : pickNumber(p, "reviews"),

      reviews_dist: reviewStat ? reviewStat.dist : null,   // توزيع النجوم [1★..5★] للأشرطة (بلا بيانات شخصية)

      fields: placeFields
    };
  }).filter(p => p.fields.length > 0);
}

function getReviewsStats() {
  const reviews = getRowsAsObjects(SHEET_REVIEWS);
  const stats = {};

  reviews.forEach(r => {
    const placeId = String(r.place_id || "").trim();
    const rating = Number(String(r.rating || "").replace(",", ".").trim());

    if (!placeId || Number.isNaN(rating)) return;
    if (rating < 1 || rating > 5) return;

    if (!stats[placeId]) stats[placeId] = { sum: 0, count: 0, dist: [0, 0, 0, 0, 0] };

    stats[placeId].sum += rating;
    stats[placeId].count += 1;
    stats[placeId].dist[Math.round(rating) - 1] += 1;   // توزيع النجوم 1..5 (فهرس 0..4)
  });

  return stats;
}

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
  return getBookings().map(b => ({
    date: b.date,
    place_id: b.place_id,
    field_id: b.field_id,
    hour: b.hour,
    status: b.status
  }));
}

function getReviews() {
  return getRowsAsObjects(SHEET_REVIEWS);
}

function getOwners() {
  return getRowsAsObjects(SHEET_OWNERS);
}

function getPlayers() {
  return getRowsAsObjects(SHEET_PLAYERS);
}

function makePlayerToken(playerId, phone) {
  return Utilities.base64Encode(playerId + "|" + normalizePhone(phone));
}

function decodePlayerToken(token) {
  try {
    const raw = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = raw.split("|");
    return {
      player_id: String(parts[0] || "").trim(),
      phone: normalizePhone(parts[1])
    };
  } catch (err) {
    return null;
  }
}

function validatePlayerToken(token) {
  const decoded = decodePlayerToken(token || "");
  if (!decoded) return null;

  const player = getPlayers().find(p =>
    String(p.player_id || "").trim() === decoded.player_id &&
    normalizePhone(p.phone) === decoded.phone &&
    isActive(p.active)
  );

  if (!player) return null;

  return {
    player_id: String(player.player_id || "").trim(),
    name: String(player.name || "").trim(),
    phone: normalizePhone(player.phone)
  };
}

function playerRegister(data) {
  const name = String(data.name || "").trim();
  const phone = normalizePhone(data.phone);
  const password = String(data.password || "").trim();

  if (!name || !phone || !password) {
    return { success: false, message: "كمّل البيانات كلها عشان نكمل" };
  }

  if (password.length < 4) {
    return { success: false, message: "كلمة السر قصيرة، زيد عليها شوي" };
  }

  const players = getPlayers();

  if (players.some(p => normalizePhone(p.phone) === phone)) {
    return { success: false, message: "الرقم عنده حساب، ادخل من هون" };
  }

  const newPlayerId = makeSafeId("player");

  appendObjectByHeaders(SHEET_PLAYERS, {
    player_id: newPlayerId,
    created_at: new Date(),
    name,
    phone,
    password,
    active: true
  });

  return {
    success: true,
    message: "تمام، حسابك جاهز",
    player: { player_id: String(newPlayerId), name, phone },
    player_token: makePlayerToken(newPlayerId, phone)
  };
}

function playerLogin(phone, password) {
  phone = normalizePhone(phone);
  password = String(password || "").trim();

  const player = getPlayers().find(p =>
    normalizePhone(p.phone) === phone &&
    String(p.password || "").trim() === password &&
    isActive(p.active)
  );

  if (!player) return { success: false, message: "الرقم أو كلمة السر غلط، حاول مرة ثانية" };

  return {
    success: true,
    message: "أهلاً، تفضل",
    player: {
      player_id: String(player.player_id || "").trim(),
      name: String(player.name || "").trim(),
      phone: normalizePhone(player.phone)
    },
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

  const newName = String(data.name || "").trim();
  if (!newName) return { success: false, message: "ما حطيت اسمك" };

  const players = getRowsAsObjects(SHEET_PLAYERS);
  const target = players.find(p => String(p.player_id || "").trim() === player.player_id);

  if (!target) return { success: false, message: "ما لقينا الحساب، تواصل معنا" };

  setCellByHeader(SHEET_PLAYERS, target._row_number, "name", newName);

  return {
    success: true,
    message: "تمام، حفظنا التعديلات",
    player: {
      player_id: player.player_id,
      name: newName,
      phone: player.phone
    }
  };
}

function getPlayerBookings(playerToken) {
  const player = validatePlayerToken(playerToken);

  if (!player) return { success: false, message: "سجّل دخولك أول" };

  const bookings = getBookings()
    .filter(b => String(b.player_id || "").trim() === String(player.player_id))
    .map(b => ({
      row_number: b.row_number,
      timestamp: b.timestamp,
      date: b.date,
      place_id: b.place_id,
      place_name: b.place_name,
      field_id: b.field_id,
      field_name: b.field_name,
      city: b.city,
      time: b.time,
      hour: b.hour,
      name: b.name,
      phone: b.phone,
      players: b.players,
      price: b.price,
      source: b.source,
      status: b.status,
      cancel_reason: b.cancel_reason
    }))
    .sort(sortBookingsNewestFirst);

  return { success: true, player, bookings };
}

function makeOwnerToken(ownerId, phone, placeId) {
  return Utilities.base64Encode(ownerId + "|" + normalizePhone(phone) + "|" + placeId);
}

function decodeOwnerToken(token) {
  try {
    const raw = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = raw.split("|");
    return {
      owner_id: parts[0],
      phone: normalizePhone(parts[1]),
      place_id: parts[2]
    };
  } catch (err) {
    return null;
  }
}

function ownerLogin(phone, password) {
  phone = normalizePhone(phone);
  password = String(password || "").trim();

  const owner = getOwners().find(o =>
    normalizePhone(o.phone) === phone &&
    String(o.password || "").trim() === password
  );

  if (!owner) return { success: false, message: "الرقم أو كلمة السر غلط، حاول مرة ثانية" };

  return {
    success: true,
    message: "أهلاً، تفضل",
    owner: {
      owner_id: String(owner.owner_id || "").trim(),
      phone: normalizePhone(owner.phone),
      place_id: String(owner.place_id || "").trim()
    },
    owner_token: makeOwnerToken(owner.owner_id, owner.phone, owner.place_id)
  };
}

function validateOwnerToken(token) {
  const decoded = decodeOwnerToken(token || "");
  if (!decoded) return null;

  const owner = getOwners().find(o =>
    String(o.owner_id || "").trim() === String(decoded.owner_id || "").trim() &&
    normalizePhone(o.phone) === normalizePhone(decoded.phone) &&
    String(o.place_id || "").trim() === String(decoded.place_id || "").trim()
  );

  if (!owner) return null;

  return {
    owner_id: String(owner.owner_id || "").trim(),
    phone: normalizePhone(owner.phone),
    place_id: String(owner.place_id || "").trim()
  };
}

function getOwnerData(ownerToken) {
  const owner = validateOwnerToken(ownerToken);

  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

  const placeId = String(owner.place_id).trim();

  // 1. بيانات المكان الأساسية مباشرة من الشيت (حتى لو كل ملاعبه موقوفة)
  const p = getRowsAsObjects(SHEET_PLACES).find(r => String(r.place_id || "").trim() === placeId);
  const ownerPlaceInfo = p ? {
    place_id: placeId,
    place_name: String(p.place_name || "").trim(),
    city: String(p.city || "").trim(),
    region: String(p.region || "all").trim(),
    type: String(p.type || "عشب صناعي").trim(),
    color: String(p.color || "#15803d").trim(),
    phone: String(p.phone || "962782761026").trim(),
    active: isActive(p.active),
    map_link: String(p.map_link || "").trim()
  } : null;

  // 2. كل ملاعب المالك — شاملة الموقوفة (active=false) ليقدر يديرها/يعيد تفعيلها
  const ownerFields = getRowsAsObjects(SHEET_FIELDS)
    .filter(f => String(f.place_id || "").trim() === placeId)
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

  const bookings = getBookings()
    .filter(b => String(b.place_id).trim() === placeId)
    .map(b => ({
      row_number: b.row_number,
      timestamp: b.timestamp,
      player_id: b.player_id,
      date: b.date,
      place_id: b.place_id,
      place_name: b.place_name,
      field_id: b.field_id,
      field_name: b.field_name,
      city: b.city,
      time: b.time,
      hour: b.hour,
      name: b.name,
      phone: b.phone,
      players: b.players,
      price: b.price,
      source: b.source,
      status: b.status,
      cancel_reason: b.cancel_reason
    }))
    .sort(sortBookingsNewestFirst);

  return {
    success: true,
    owner,
    place: ownerPlaceInfo,
    fields: ownerFields,
    bookings
  };
}

function createBooking(data) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const player = validatePlayerToken(data.player_token);

    if (!player) return { success: false, message: "سجّل دخولك أول قبل الحجز" };

    // ✅ تحقّق خادمي (لا ثقة بالعميل): اكتمال البيانات
    const placeId = String(data.place_id || "").trim();
    const fieldId = String(data.field_id || "").trim();
    const date = formatDateOnlySafe(data.date);
    const hour = Number(data.hour);

    if (!placeId || !fieldId || !date || Number.isNaN(hour)) {
      return { success: false, message: "بيانات الحجز ناقصة" };
    }

    // ✅ التاريخ ليس قديماً (بتوقيت السكربت)
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (date < todayStr) {
      return { success: false, message: "ما بنفع تحجز بتاريخ قديم" };
    }

    // ✅ المكان موجود والملعب تابع له فعلاً
    const place = getPlaces().find(p => String(p.place_id).trim() === placeId);
    if (!place) return { success: false, message: "ما لقينا المكان" };

    const field = (place.fields || []).find(f => String(f.field_id).trim() === fieldId);
    if (!field) return { success: false, message: "هذا الملعب مش تابع لهذا المكان" };

    // ✅ الوقت ضمن أوقات (slots) هذا الملعب + اشتقاق التسمية من الشيت
    const slotList = String(field.slots || "").split("|").map(function (s) {
      const parts = String(s).split("=");
      return { h: Number(parts[0]), label: parts.slice(1).join("=") };
    }).filter(function (s) { return !Number.isNaN(s.h); });

    const matchedSlot = slotList.find(function (s) { return s.h === hour; });
    if (slotList.length && !matchedSlot) {
      return { success: false, message: "هذا الوقت مش متاح لهذا الملعب" };
    }

    // ✅ السعر والتسمية من الشيت — لا من العميل
    const serverPrice = Number(field.price || 0);
    const serverTime = matchedSlot ? matchedSlot.label : String(data.time || "");

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
      date: date,
      place_id: placeId,
      place_name: place.place_name,        // من الشيت
      field_id: field.field_id,
      field_name: field.field_name,        // من الشيت
      city: place.city,                    // من الشيت
      time: serverTime,                    // من الشيت
      hour: hour,
      name: player.name,
      phone: player.phone,
      players: data.players || field.size || "",
      price: serverPrice,                  // ✅ السعر من الشيت (لا ثقة بالعميل)
      source: data.source || "direct",
      status: "pending",
      cancel_reason: ""
    });

    return { success: true, message: "وصل طلبك، بنأكدلك قريب" };
  } catch (err) {
    return { success: false, message: "صار ضغط على النظام، حاول بعد ثانية" };
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}


function ownerCreateManualBooking(data) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const owner = validateOwnerToken(data.owner_token);
    if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

    const fieldId = String(data.field_id || "").trim();
    const date = formatDateOnlySafe(data.date);
    const hour = Number(data.hour);
    const name = String(data.name || "حجز خارجي").trim();
    const phone = normalizePhone(data.phone || "");

    if (!fieldId || !date || Number.isNaN(hour)) {
      return { success: false, message: "اختار الملعب واليوم والوقت" };
    }

    if (!name) return { success: false, message: "اكتب اسم صاحب الحجز" };

    const placeId = String(owner.place_id).trim();
    const ownerPlace = getPlaces().find(p => String(p.place_id).trim() === placeId);
    if (!ownerPlace) return { success: false, message: "ما لقينا المكان تبعك" };

    const field = (ownerPlace.fields || []).find(f => String(f.field_id).trim() === fieldId);
    if (!field) return { success: false, message: "هذا الملعب مش تابع لحسابك" };

    const bookings = getBookings();
    const exists = bookings.some(b =>
      String(b.field_id) === fieldId &&
      String(b.date) === String(date) &&
      Number(b.hour) === hour &&
      !["cancelled", "rejected"].includes(String(b.status || "pending").toLowerCase())
    );

    if (exists) return { success: false, message: "هذا الوقت محجوز بالفعل" };

    appendObjectByHeaders(SHEET_BOOKINGS, {
      timestamp: new Date(),
      booking_id: makeSafeId("booking"),
      player_id: "",
      date,
      place_id: placeId,
      place_name: ownerPlace.place_name,
      field_id: field.field_id,
      field_name: field.field_name,
      city: ownerPlace.city,
      time: data.time || "",
      hour,
      name,
      phone,
      players: data.players || field.size || "",
      price: Number(data.price || field.price || 0),
      source: "owner_manual",
      status: "confirmed",
      cancel_reason: "حجز خارجي أدخله المالك"
    });

    return { success: true, message: "تمام، أضفنا الحجز الخارجي وحجزنا الوقت" };
  } catch (err) {
    return { success: false, message: "صار ضغط على النظام، حاول بعد ثانية" };
  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}

function sortBookingsNewestFirst(a, b) {
  const d1 = new Date(a.date + "T" + String(a.hour || 0).padStart(2, "0") + ":00:00");
  const d2 = new Date(b.date + "T" + String(b.hour || 0).padStart(2, "0") + ":00:00");
  return d2 - d1;
}

function createReview(data) {
  const rating = Number(String(data.rating || "").replace(",", ".").trim());

  if (!data.place_id || Number.isNaN(rating) || rating < 1 || rating > 5) {
    return { success: false, message: "في شي ناقص بالتقييم" };
  }

  appendObjectByHeaders(SHEET_REVIEWS, {
    timestamp: new Date(),
    review_id: makeSafeId("review"),
    place_id: data.place_id,
    field_id: data.field_id || "",
    user_name: data.user_name || "",
    phone: normalizePhone(data.phone),
    rating,
    comment: data.comment || ""
  });

  invalidatePlacesCache();

  return { success: true, message: "شكراً، تقييمك وصل" };
}

function updateBookingStatus(data) {
  // ✅ مسار اللاعب: يُسمح له بإلغاء حجزه هو فقط (cancelled فقط)
  const owner = validateOwnerToken(data.owner_token);
  const player = owner ? null : validatePlayerToken(data.player_token);

  if (!owner && !player) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

  const rowNumber = Number(data.row_number);
  const newStatus = String(data.status || "").trim().toLowerCase();
  const cancelReason = String(data.cancel_reason || "").trim();

  const allowedStatuses = ["pending", "confirmed", "cancelled", "rejected"];

  if (!rowNumber || rowNumber < 2) return { success: false, message: "رقم الحجز ما اشتغل" };
  if (!allowedStatuses.includes(newStatus)) return { success: false, message: "في خطأ بالحالة المختارة" };

  // اللاعب يقدر يلغي فقط — لا يؤكّد/يرفض
  if (player && newStatus !== "cancelled") {
    return { success: false, message: "ما بتقدر تعدّل حالة الحجز" };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOOKINGS);
  const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);

  if (owner) {
    const placeIdCol = headers.indexOf("place_id") + 1;
    if (!placeIdCol) return { success: false, message: "خطأ بإعدادات الشيت — تواصل مع الدعم" };

    const bookingPlaceId = String(rowValues[placeIdCol - 1]).trim();
    if (bookingPlaceId !== String(owner.place_id).trim()) {
      return { success: false, message: "هذا الحجز مش تبعك" };
    }
  } else {
    // اللاعب: يتأكّد أنّ الحجز يخصّه فعلاً
    const playerIdCol = headers.indexOf("player_id") + 1;
    if (!playerIdCol) return { success: false, message: "خطأ بإعدادات الشيت — تواصل مع الدعم" };

    const bookingPlayerId = String(rowValues[playerIdCol - 1]).trim();
    if (!bookingPlayerId || bookingPlayerId !== String(player.player_id).trim()) {
      return { success: false, message: "هذا الحجز مش تبعك" };
    }
  }

  setCellByHeader(SHEET_BOOKINGS, rowNumber, "status", newStatus);
  setCellByHeader(
    SHEET_BOOKINGS,
    rowNumber,
    "cancel_reason",
    newStatus === "cancelled" || newStatus === "rejected" ? cancelReason : ""
  );

  return { success: true, message: "تم الحفظ" };
}

function ownerUpdateField(data) {
  const owner = validateOwnerToken(data.owner_token);

  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

  const fieldId = String(data.field_id || "").trim();
  const newPrice = Number(data.price);
  const newSlots = String(data.slots || "full").trim();
  const newActive = data.active;

  if (!fieldId) return { success: false, message: "ما لقينا معرف الملعب" };

  if (Number.isNaN(newPrice) || newPrice <= 0) {
    return { success: false, message: "السعر اللي حطيته ما اشتغل" };
  }

  const fields = getRowsAsObjects(SHEET_FIELDS);
  const field = fields.find(f => String(f.field_id || "").trim() === fieldId);

  if (!field) return { success: false, message: "ما لقينا الملعب" };

  if (String(field.place_id || "").trim() !== String(owner.place_id).trim()) {
    return { success: false, message: "هذا الملعب مش تبعك" };
  }

  setCellByHeader(SHEET_FIELDS, field._row_number, "price", newPrice);
  setCellByHeader(SHEET_FIELDS, field._row_number, "slots", newSlots);
  setCellByHeader(SHEET_FIELDS, field._row_number, "active", newActive === false ? false : true);

  invalidatePlacesCache();

  return { success: true, message: "تمام، حفظنا التعديلات" };
}

function ownerAddField(data) {
  const owner = validateOwnerToken(data.owner_token);

  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };

  const fieldName = String(data.field_name || "").trim();
  const size = String(data.size || "6×6").trim();
  const price = Number(data.price);
  const slots = String(data.slots || "full").trim();

  if (!fieldName) return { success: false, message: "ما حطيت اسم الملعب" };

  if (Number.isNaN(price) || price <= 0) {
    return { success: false, message: "السعر اللي حطيته ما اشتغل" };
  }

  const newFieldId = makeSafeId("field");

  appendObjectByHeaders(SHEET_FIELDS, {
    field_id: newFieldId,
    place_id: owner.place_id,
    field_name: fieldName,
    size,
    price,
    slots,
    active: true
  });

  invalidatePlacesCache();

  return {
    success: true,
    message: "تمام، الملعب انضاف",
    field_id: newFieldId
  };
}

/* ============================================================
   🤖 ميزات الذكاء الاصطناعي — لوحة المالك
   الإعداد (مرة واحدة): Project Settings ← Script Properties:
     GEMINI_API_KEY  (أو OPENAI_API_KEY — يكفي واحد، Gemini له أولوية)
     AI_MODEL        (اختياري لتجاوز الافتراضي)
   لا تغييرات على Sheets ولا على الدخول/التوكنات.
   ============================================================ */

const AI_CACHE_TTL = 21600;      // 6 ساعات (حد CacheService الأقصى)
const AI_WEATHER_TTL = 10800;    // 3 ساعات

/* ⚙️ شغّلها مرة واحدة من محرر Apps Script (اخترها من قائمة الدوال ثم Run):
   - تُطلق نافذة منح صلاحية «الاتصال بخدمة خارجية» (سبب فشل الطقس الشائع بعد أول نشر)
   - وتفحص Open-Meteo + مفتاح AI وتطبع النتيجة في السجل (View ← Logs) */
function testAiSetup() {
  const wx = UrlFetchApp.fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=31.95&longitude=35.93&daily=weather_code&forecast_days=1&timezone=Asia%2FAmman",
    { muteHttpExceptions: true });
  Logger.log("Open-Meteo: " + wx.getResponseCode() + (wx.getResponseCode() === 200 ? " ✓" : " ✗"));
  const cfg = getAiConfig_();
  if (!cfg) { Logger.log("AI key: ✗ غير موجود — أضف GEMINI_API_KEY في Script Properties"); return; }
  Logger.log("AI provider: " + cfg.provider + " (" + cfg.model + ") ✓");
  const out = callAi_(cfg, "Reply ONLY with JSON.", 'Return exactly {"ok":true}');
  Logger.log(out && out.ok ? "AI call: ✓" : "AI call: ✗ — تحقق من صحة المفتاح");
}

function getAiConfig_() {
  const props = PropertiesService.getScriptProperties();
  const gemini = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  const openai = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model = String(props.getProperty("AI_MODEL") || "").trim();
  if (gemini) return { provider: "gemini", key: gemini, model: model || "gemini-2.0-flash" };
  if (openai) return { provider: "openai", key: openai, model: model || "gpt-4o-mini" };
  return null;
}

/* آخر سبب فشل لاستدعاء AI — يُرفَق بالاستجابة (detail) ليظهر في كونسول الواجهة ويسهّل التشخيص */
let AI_LAST_ERR_ = "";

/* استدعاء موحّد: يرجّع كائن JSON من ردّ النموذج، أو null عند أي فشل */
function callAi_(cfg, systemPrompt, userPrompt) {
  AI_LAST_ERR_ = "";
  try {
    let url, options;
    if (cfg.provider === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/models/" + cfg.model + ":generateContent?key=" + encodeURIComponent(cfg.key);
      options = {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024, response_mime_type: "application/json" }
        })
      };
    } else {
      url = "https://api.openai.com/v1/chat/completions";
      options = {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + cfg.key },
        payload: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.4,
          max_tokens: 1024,
          response_format: { type: "json_object" }
        })
      };
    }
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
      AI_LAST_ERR_ = "HTTP " + res.getResponseCode() + ": " + String(res.getContentText() || "").slice(0, 180);
      return null;
    }
    const body = JSON.parse(res.getContentText());
    const text = cfg.provider === "gemini"
      ? (((body.candidates || [])[0] || {}).content || {}).parts && body.candidates[0].content.parts[0].text
      : (((body.choices || [])[0] || {}).message || {}).content;
    const parsed = parseAiJson_(text);
    if (!parsed) AI_LAST_ERR_ = "unparseable model output: " + String(text || "").slice(0, 120);
    return parsed;
  } catch (err) {
    AI_LAST_ERR_ = String((err && err.message) || err).slice(0, 180);
    return null;
  }
}

/* تنظيف ردّ النموذج من أسوار ```json وتحويله لكائن */
function parseAiJson_(text) {
  if (!text) return null;
  try {
    let s = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    return JSON.parse(s.slice(a, b + 1));
  } catch (err) { return null; }
}

function aiLangName_(lang) { return lang === "en" ? "English" : "Arabic"; }
function aiCacheGet_(key) {
  try { const v = CacheService.getScriptCache().get(key); return v ? JSON.parse(v) : null; } catch (err) { return null; }
}
function aiCachePut_(key, obj, ttl) {
  try { CacheService.getScriptCache().put(key, JSON.stringify(obj), ttl); } catch (err) {}
}
function todayAmman_() { return Utilities.formatDate(new Date(), "Asia/Amman", "yyyy-MM-dd"); }
function dateAfterAmman_(days) {
  return Utilities.formatDate(new Date(Date.now() + days * 86400000), "Asia/Amman", "yyyy-MM-dd");
}

/* ---------- 1) المستشار الذكي (تحليل الحجوزات والإشغال) ---------- */

/* تحليلات مضغوطة تُرسل للنموذج: آخر 30 يوماً + الأسبوع القادم */
function buildOwnerAnalytics_(placeId) {
  const fields = getRowsAsObjects(SHEET_FIELDS)
    .filter(f => String(f.place_id || "").trim() === placeId && isActive(f.active))
    .map(f => ({
      name: String(f.field_name || "ملعب").trim(),
      size: String(f.size || "").trim(),
      price_jod: Number(f.price || 0),
      slots_per_day: convertSlots(f.slots).length
    }));
  const slotsPerDay = fields.reduce((s, f) => s + f.slots_per_day, 0);
  const avgPrice = fields.length ? fields.reduce((s, f) => s + f.price_jod, 0) / fields.length : 0;

  const from = dateAfterAmman_(-30), td = todayAmman_(), to = dateAfterAmman_(7);
  const all = getBookings().filter(b => b.place_id === placeId && b.date >= from && b.date <= to);
  const hist = all.filter(b => b.date <= td);
  const conf = hist.filter(b => b.status === "confirmed");
  const cancelled = hist.filter(b => b.status === "cancelled" || b.status === "rejected");

  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byWeekday = {}, byHour = {}, byField = {};
  conf.forEach(b => {
    const d = new Date(b.date + "T12:00:00");
    if (!isNaN(d)) { const w = WD[d.getDay()]; byWeekday[w] = (byWeekday[w] || 0) + 1; }
    if (!Number.isNaN(b.hour)) byHour[b.hour] = (byHour[b.hour] || 0) + 1;
    if (b.field_name) byField[b.field_name] = (byField[b.field_name] || 0) + 1;
  });
  const phones = {};
  conf.forEach(b => { const k = b.phone || b.player_id; if (k) phones[k] = (phones[k] || 0) + 1; });
  const uniq = Object.keys(phones).length;
  const returning = Object.keys(phones).filter(k => phones[k] > 1).length;

  const capacity30 = slotsPerDay * 30;
  const upcoming = {};
  for (let i = 0; i <= 6; i++) {
    const ds = dateAfterAmman_(i);
    const dayB = all.filter(b => b.date === ds && (b.status === "confirmed" || b.status === "pending"));
    upcoming[ds] = { weekday: WD[new Date(ds + "T12:00:00").getDay()], booked: dayB.length, free_slots: Math.max(slotsPerDay - dayB.length, 0) };
  }

  return {
    fields,
    last_30_days: {
      total_requests: hist.length,
      confirmed: conf.length,
      cancelled_or_rejected: cancelled.length,
      occupancy_pct: capacity30 ? Math.round((conf.length / capacity30) * 100) : 0,
      revenue_jod: Math.round(conf.reduce((s, b) => s + (b.price || 0), 0)),
      est_lost_revenue_jod: Math.round(Math.max(capacity30 - conf.length, 0) * avgPrice),
      confirmed_by_weekday: byWeekday,
      confirmed_by_start_hour: byHour,
      confirmed_by_field: byField,
      unique_customers: uniq,
      returning_customers: returning
    },
    next_7_days: upcoming
  };
}

function aiBusinessInsights(ownerToken, lang, force) {
  const owner = validateOwnerToken(ownerToken);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  lang = lang === "en" ? "en" : "ar";

  const cacheKey = "ai_ins_" + owner.place_id + "_" + lang;
  if (!force) { const c = aiCacheGet_(cacheKey); if (c) { c.cached = true; return c; } }

  const cfg = getAiConfig_();
  if (!cfg) return { success: false, code: "ai_not_configured" };

  const analytics = buildOwnerAnalytics_(owner.place_id);
  const sys = "You are an expert business consultant for football (soccer) field rental venues in Jordan. Currency is JOD. " +
    "Respond ONLY with valid JSON, no markdown. Every text value must be written in " + aiLangName_(lang) + ".";
  const usr = "Venue analytics (last 30 days + next 7 days):\n" + JSON.stringify(analytics) +
    '\n\nReturn JSON exactly in this shape: {"insights":[{"type":"pricing|marketing|schedule|warning|opportunity","title":"...","advice":"..."}]}' +
    "\nRules: 3 to 5 insights. Each must be actionable and cite the actual numbers, field names, weekdays or hours from the data " +
    "(e.g. discount low-demand weekdays, reprice peak hours, reduce cancellations, fill next week's free slots). " +
    "Title max 6 words, advice max 40 words. No generic filler.";
  const out = callAi_(cfg, sys, usr);
  if (!out || !Array.isArray(out.insights)) return { success: false, code: "ai_failed", detail: AI_LAST_ERR_ };

  const res = {
    success: true,
    generated_at: new Date().toISOString(),
    insights: out.insights.slice(0, 5).map(i => ({
      type: String(i.type || "opportunity").toLowerCase(),
      title: String(i.title || "").slice(0, 120),
      advice: String(i.advice || "").slice(0, 400)
    })).filter(i => i.title && i.advice)
  };
  aiCachePut_(cacheKey, res, AI_CACHE_TTL);
  return res;
}

/* ---------- 2) ملخّص التقييمات (تحليل المشاعر) ---------- */

function aiReviewSummary(ownerToken, lang, force) {
  const owner = validateOwnerToken(ownerToken);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  lang = lang === "en" ? "en" : "ar";

  const cacheKey = "ai_rev_" + owner.place_id + "_" + lang;
  if (!force) { const c = aiCacheGet_(cacheKey); if (c) { c.cached = true; return c; } }

  const all = getRowsAsObjects(SHEET_REVIEWS)
    .filter(r => String(r.place_id || "").trim() === owner.place_id)
    .map(r => ({
      rating: Number(String(r.rating || "").replace(",", ".").trim()) || 0,
      comment: String(r.comment || "").trim().slice(0, 300),
      date: formatDateOnlySafe(r.timestamp)
    }))
    .filter(r => r.rating >= 1 && r.rating <= 5);

  if (!all.length) return { success: true, empty: true };

  const avg = Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10;
  const base = { success: true, total: all.length, avg_rating: avg };

  const cfg = getAiConfig_();
  if (!cfg) return Object.assign(base, { success: false, code: "ai_not_configured" });

  // آخر 80 تقييماً (الأحدث أولاً) — التعليقات النصية هي مادة التحليل
  const sample = all.slice(-80).reverse();
  const sys = "You are an expert at analyzing customer reviews for a football field rental venue in Jordan. " +
    "Respond ONLY with valid JSON, no markdown. Every text value must be written in " + aiLangName_(lang) + ".";
  const usr = "Reviews (newest first, avg rating " + avg + "/5, total " + all.length + "):\n" + JSON.stringify(sample) +
    '\n\nReturn JSON exactly in this shape: {"sentiment":"positive|mixed|negative","summary":"...","praises":["..."],"complaints":["..."],"alert":"..."}' +
    "\nRules: summary max 50 words describing the overall impression. praises/complaints: up to 4 short phrases each (2-5 words), " +
    "only themes that actually repeat in the comments; empty arrays if none. " +
    'alert: one urgent sentence ONLY if a serious or recurring complaint appears in recent reviews (e.g. "3 players complained about the lighting"), otherwise "".';
  const out = callAi_(cfg, sys, usr);
  if (!out || !out.summary) return Object.assign(base, { success: false, code: "ai_failed", detail: AI_LAST_ERR_ });

  const res = Object.assign(base, {
    generated_at: new Date().toISOString(),
    sentiment: ["positive", "mixed", "negative"].indexOf(String(out.sentiment || "").toLowerCase()) !== -1 ? String(out.sentiment).toLowerCase() : "mixed",
    summary: String(out.summary || "").slice(0, 500),
    praises: (Array.isArray(out.praises) ? out.praises : []).slice(0, 4).map(s => String(s).slice(0, 60)),
    complaints: (Array.isArray(out.complaints) ? out.complaints : []).slice(0, 4).map(s => String(s).slice(0, 60)),
    alert: String(out.alert || "").slice(0, 300)
  });
  aiCachePut_(cacheKey, res, AI_CACHE_TTL);
  return res;
}

/* ---------- 3) تنبيه الطقس والتسعير (Open-Meteo + AI) ---------- */

const CITY_COORDS_ = {
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
  "المفرق": [32.34, 36.21], "mafraq": [32.34, 36.21]
};

/* تبسيط WMO weather_code لفئة تعرضها الواجهة كأيقونة */
function weatherCategory_(code) {
  if (code === 0) return "sunny";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

function aiWeatherAlert(ownerToken, lang, force) {
  const owner = validateOwnerToken(ownerToken);
  if (!owner) return { success: false, message: "انتهت جلستك، ادخل من جديد" };
  lang = lang === "en" ? "en" : "ar";

  const cacheKey = "ai_wx_" + owner.place_id + "_" + lang;
  if (!force) { const c = aiCacheGet_(cacheKey); if (c) { c.cached = true; return c; } }

  // موقع المكان من مدينة الشيت (افتراضي: عمّان)
  const place = getRowsAsObjects(SHEET_PLACES).find(r => String(r.place_id || "").trim() === owner.place_id);
  const city = String((place && place.city) || "").trim().toLowerCase();
  const coords = CITY_COORDS_[city] || [31.95, 35.93];

  let daily;
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + coords[0] + "&longitude=" + coords[1] +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
      "&forecast_days=3&timezone=Asia%2FAmman";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { success: false, code: "weather_failed", detail: "HTTP " + res.getResponseCode() };
    daily = JSON.parse(res.getContentText()).daily;
    if (!daily || !daily.time) return { success: false, code: "weather_failed", detail: "no daily data" };
  } catch (err) {
    return { success: false, code: "weather_failed", detail: String((err && err.message) || err).slice(0, 180) };
  }

  // ربط كل يوم بحجوزاته وأوقاته الفارغة
  const fields = getRowsAsObjects(SHEET_FIELDS).filter(f => String(f.place_id || "").trim() === owner.place_id && isActive(f.active));
  const slotsPerDay = fields.reduce((s, f) => s + convertSlots(f.slots).length, 0);
  const bookings = getBookings().filter(b => b.place_id === owner.place_id);
  const days = daily.time.map((ds, i) => {
    const dayB = bookings.filter(b => b.date === ds && (b.status === "confirmed" || b.status === "pending"));
    return {
      date: ds,
      category: weatherCategory_(Number(daily.weather_code[i])),
      tmax: Math.round(daily.temperature_2m_max[i]),
      tmin: Math.round(daily.temperature_2m_min[i]),
      rain_prob: Math.round(daily.precipitation_probability_max[i] || 0),
      wind_kmh: Math.round(daily.wind_speed_10m_max[i] || 0),
      bookings: dayB.length,
      free_slots: Math.max(slotsPerDay - dayB.length, 0)
    };
  });

  // شدة التنبيه بقواعد ثابتة (تعمل حتى بلا مفتاح AI)
  const worstRain = Math.max.apply(null, days.map(d => d.rain_prob));
  const worstHeat = Math.max.apply(null, days.map(d => d.tmax));
  const hasStorm = days.some(d => d.category === "storm" || d.category === "snow");
  const severity = (hasStorm || worstRain >= 60) ? "danger" : (worstRain >= 35 || worstHeat >= 38) ? "warn" : "info";

  let title, advice, usedAi = false;
  const cfg = getAiConfig_();
  if (cfg) {
    const sys = "You are an operations advisor for a football field rental venue in Jordan. Currency is JOD. " +
      "Respond ONLY with valid JSON, no markdown. Every text value must be written in " + aiLangName_(lang) + ".";
    const usr = "3-day weather forecast combined with this venue's bookings and free slots:\n" + JSON.stringify(days) +
      '\n\nReturn JSON exactly in this shape: {"title":"...","advice":"..."}' +
      "\nRules: title max 8 words summarizing the situation. advice max 45 words, actionable for the owner: " +
      "e.g. if rain/storm is likely on a day with bookings, recommend sending early confirmation reminders to reduce cancellations; " +
      "if weather is good but free_slots are high, recommend a discount or promotion for those slots; mention the specific days.";
    const out = callAi_(cfg, sys, usr);
    if (out && out.advice) { title = String(out.title || "").slice(0, 120); advice = String(out.advice).slice(0, 400); usedAi = true; }
  }
  if (!advice) {
    // نصيحة تلقائية بلا AI — حتى لا يفقد المالك الميزة إن غاب المفتاح أو فشل النموذج
    const bookedRainy = days.filter(d => d.rain_prob >= 60 && d.bookings > 0).length;
    if (lang === "en") {
      title = severity === "danger" ? "Rain expected in the coming days" : severity === "warn" ? "Changing weather ahead" : "Weather looks fine";
      advice = severity === "danger"
        ? (bookedRainy ? "High chance of rain on booked days — send early confirmation reminders via WhatsApp to reduce cancellations." : "High chance of rain — expect fewer walk-in requests and consider flexible rescheduling.")
        : severity === "warn" ? "Possible rain or high heat — follow up on pending bookings early and keep players informed."
        : "Good playing weather for the next 3 days — a small discount on empty slots could fill them.";
    } else {
      title = severity === "danger" ? "أمطار متوقعة في الأيام القادمة" : severity === "warn" ? "تقلبات جوية قادمة" : "الأجواء مناسبة للعب";
      advice = severity === "danger"
        ? (bookedRainy ? "احتمال مطر مرتفع في أيام فيها حجوزات — أرسل تذكيرات تأكيد مبكرة عبر واتساب لتقليل الإلغاءات." : "احتمال مطر مرتفع — توقّع طلبات أقل وجهّز خيارات لتغيير المواعيد بمرونة.")
        : severity === "warn" ? "احتمال مطر أو حرارة مرتفعة — تابع الحجوزات المعلّقة مبكراً وأبقِ اللاعبين على اطلاع."
        : "الأجواء ممتازة للعب خلال 3 أيام — خصم بسيط على الأوقات الفارغة قد يملؤها.";
    }
  }

  const res = { success: true, ai: usedAi, generated_at: new Date().toISOString(), severity, title, advice, days };
  aiCachePut_(cacheKey, res, AI_WEATHER_TTL);
  return res;
}