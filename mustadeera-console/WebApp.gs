/**
 * المستديرة — لوحة الإدارة على الويب  (Apps Script Web App)
 * ═══════════════════════════════════════════════════════════════════
 *
 * الموقع **يقرأ ويكتب في نفس الشيت**. لا قاعدة بيانات ثانية ولا نسخة
 * ثانية من أي رقم — تعدّل من الموقع أو من الشيت، والنتيجة واحدة.
 * (وهي قاعدة الملفّ نفسها: «الرقم يُكتب مرّةً واحدة».)
 *
 * ⚠️ هذا الملفّ **لا يعرّف onEdit ولا onOpen** عمدًا — النسخة القديمة
 *    (mustadeera-sync-v2.gs) تعرّفهما، ولا يجوز وجود اثنتين في مشروعٍ
 *    واحد. الصق هذا في ملفٍّ جديد بجانبها، ولا تحذف شيئًا منها.
 *
 * ⚠️ ولا خريطةَ أعمدةٍ مكتوبةً بيد هنا: الخادم يقرأ **صفّ العناوين** من
 *    الورقة نفسها ويرسله إلى الواجهة، والكتابة **باسم العمود** لا برقمه.
 *    فعمودٌ يُضاف أو يُزاح غدًا لا يجعل الموقع يكتب في الخانة الخطأ.
 */

// ═══════════════════════════════════════════════════════════
//  الإعداد
// ═══════════════════════════════════════════════════════════

/** اتركه فارغًا إن كان السكربت مربوطًا بالشيت (الحالة الطبيعية).
 *  وإن كان مشروعًا مستقلًّا، ضع هنا معرّف الشيت من رابطه. */
var SHEET_ID = '';

var SH = {
  CON:   'الثوابت',
  VEN:   'الملاعب',
  TASK:  'المهام',
  IDEA:  'الأفكار',
  LOG:   'سجل التواصل',
  CALC:  'حاسبة الملعب',
  ECON:  'اقتصاديات المنصة'
};

/** أقصى صفٍّ يُقرأ من الجداول — أعلى بكثير ممّا سيُملأ، وأقلّ بكثير من 1000. */
var MAX_ROWS = 300;

function ss_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActive();
}


// ═══════════════════════════════════════════════════════════
//  تقديم الصفحة
// ═══════════════════════════════════════════════════════════

/**
 * هل الذي يفتح الصفحة هو صاحب السكربت نفسه؟
 *
 * 🔴 هذا **حارسُ نشرٍ خاطئ لا بديلٌ عن النشر الصحيح.** النشر الموثَّق في
 *    README هو «التنفيذ باسمي · الوصول: أنا فقط»، وApps Script نفسه يمنع
 *    غيرَك حينها. لكنّ إعدادًا واحدًا يُغيَّر يومًا («الوصول: أيّ أحد») يفتح
 *    **الكتابة في الشيت** لكلّ من يملك الرابط — ولا شيء في الكود يصرخ.
 *
 * والفحص مقارنةٌ بين هويّتين لا قائمةَ بريدٍ مكتوبةً بيد:
 *   • `getEffectiveUser` = الحساب الذي **يشتغل به** السكربت (أنت دائمًا).
 *   • `getActiveUser`    = الحساب الذي **فتح الصفحة**.
 * وتساويهما هو تعريف «أنا فقط» بالضبط. وزائرٌ من نطاقٍ آخر يُرجع بريدًا
 * فارغًا ⇒ لا يساوي شيئًا ⇒ يُردّ. فالفارغُ رفضٌ لا تساهل.
 */
function isOwner_() {
  var eff = '', act = '';
  try { eff = String(Session.getEffectiveUser().getEmail() || ''); } catch (e) {}
  try { act = String(Session.getActiveUser().getEmail() || ''); } catch (e) {}
  return !!eff && eff === act;
}

/** يُرفَع قبل أيّ قراءةٍ أو كتابة. والرسالة تقول **ما يُفعَل** لا «ممنوع». */
function guardOwner_() {
  if (!isOwner_()) {
    throw new Error('هذه اللوحة لصاحب الشيت وحده. افتح Deploy ⟵ إدارة عمليات النشر ' +
                    'واجعل «مَن له حقّ الوصول» = «أنا فقط».');
  }
}

function doGet() {
  /* صفحةُ ردٍّ مقروءة لا خطأُ Apps Script الأحمر: الأخير يقول «Script
     function not found» أو نصًّا إنجليزيًّا لا يقول للمالك ماذا يفعل. */
  if (!isOwner_()) {
    return HtmlService.createHtmlOutput(
      '<div dir="rtl" style="font:16px/1.7 system-ui,sans-serif;max-width:34em;' +
      'margin:12vh auto;padding:0 20px;color:#1b2733">' +
      '<h1 style="font-size:20px;margin:0 0 10px">لوحة الإدارة مقفلة</h1>' +
      '<p style="margin:0 0 14px;color:#5a6a7a">هذه اللوحة تقرأ وتكتب في شيت ' +
      '«المستديرة»، فلا تُفتَح إلّا من حساب صاحبه.</p>' +
      '<p style="margin:0;color:#5a6a7a">إن كنتَ أنت صاحبه: افتح محرّر Apps Script ' +
      '⟵ <b>Deploy</b> ⟵ <b>إدارة عمليات النشر</b>، واجعل «مَن له حقّ الوصول» = ' +
      '<b>أنا فقط</b>، ثمّ افتح الرابط وأنت داخلٌ بذلك الحساب.</p>' +
      /* ⚠️ **تشخيصٌ بلا كشف.** لو أخطأ الحارس يومًا فقفَل صاحبَه خارجًا،
         فالسببُ أحدُ اثنين ولا ثالث — ويُقال أيُّهما بلا طباعة أيّ بريد:
         طباعتُه على صفحةٍ قد يفتحها غريبٌ تسريبٌ صغير بلا مقابل. */
      '<p style="margin:16px 0 0;font-size:12.5px;color:#8a97a4">تشخيص: ' +
      'حسابُ التشغيل ' + (Session.getEffectiveUser().getEmail() ? 'معروف' : '<b>غير معروف</b>') +
      ' · حسابُ الزائر ' + (Session.getActiveUser().getEmail() ? 'معروف' : '<b>غير معروف</b>') +
      '. و«غير معروف» للزائر معناها أنّ النشر ليس «أنا فقط».</p></div>'
    ).setTitle('المستديرة — لوحة الإدارة');
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('المستديرة — لوحة الإدارة')
    /* الوسم مكتوبٌ في Index.html كذلك — والنسختان متطابقتان نصًّا.
       سببُ التكرار أنّ المعاينة المحلّية لا تمرّ بهذه الدالّة، فتُخطِّط
       عند 980px ويبدو التصميم سليمًا وهو غير مفحوص على عرض الهاتف. */
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    /* 🔴 كانت `ALLOWALL` — أي أنّ أيّ صفحةٍ في الإنترنت تستطيع أن تضع هذه
       اللوحة في إطارٍ شفّاف فوق أزرارها الخاصّة، فتقع ضغطاتُك على أزرارٍ
       لا تراها (clickjacking). و`DEFAULT` تسمح بالتضمين من نطاق جوجل
       وحده — وهو ما تحتاجه الصفحة فعلًا، فالفتحُ المباشر بالرابط يعمل
       كما هو. ولا تُعاد إلى ALLOWALL إلّا لو أردتَ يومًا تضمينها في
       Google Sites — ولا نفعل. */
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}


// ═══════════════════════════════════════════════════════════
//  قراءة عامّة  —  جدولٌ بعناوينه
// ═══════════════════════════════════════════════════════════

/**
 * يقرأ ورقةً ذات صفّ عناوين واحد ويُرجع { headers, rows }.
 * كلّ صفٍّ كائنٌ فيه `_row` (رقم الصفّ الحقيقي في الشيت) — وهو ما تكتب
 * به الواجهة لاحقًا، فلا تعتمد على ترتيب العرض إطلاقًا.
 */
function readTable_(name, headerRow) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return { headers: [], rows: [], missing: true };

  headerRow = headerRow || 1;
  var lastCol = Math.max(1, sh.getLastColumn());
  var lastRow = Math.min(sh.getLastRow(), MAX_ROWS);
  if (lastRow < headerRow) return { headers: [], rows: [] };

  var headers = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0]
                  .map(function (h) { return String(h).trim(); });

  var rows = [];
  if (lastRow > headerRow) {
    var vals  = sh.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getValues();
    var disp  = sh.getRange(headerRow + 1, 1, lastRow - headerRow, lastCol).getDisplayValues();
    for (var r = 0; r < vals.length; r++) {
      var obj = { _row: headerRow + 1 + r };
      var any = false;
      for (var c = 0; c < headers.length; c++) {
        if (!headers[c]) continue;
        var v = vals[r][c];
        if (v instanceof Date) v = Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
        obj[headers[c]] = v;
        obj['#' + headers[c]] = disp[r][c];          // النصّ كما يراه الشيت
        if (v !== '' && v !== null) any = true;
      }
      if (any) rows.push(obj);
    }
  }
  return { headers: headers.filter(String), rows: rows };
}

function tz_() {
  return ss_().getSpreadsheetTimeZone() || 'Asia/Amman';
}


// ═══════════════════════════════════════════════════════════
//  الحزمة الأولى  —  كلّ شيء في نداءٍ واحد
// ═══════════════════════════════════════════════════════════

function getBootstrap() {
  guardOwner_();
  var ss  = ss_();
  var con = ss.getSheetByName(SH.CON);
  var cal = ss.getSheetByName(SH.CALC);
  var eco = ss.getSheetByName(SH.ECON);

  if (!con) throw new Error('ما لقيت ورقة «' + SH.CON + '» — تأكّد أنّك فتحت الموقع من الشيت الصحيح.');

  // ① الثوابت: القيم الخام (للحساب) والمعروضة (للعرض) والتسميات (للقراءة)
  var conVals = con.getRange('A1:C60').getValues();
  var conDisp = con.getRange('A1:C60').getDisplayValues();
  var constants = {};
  for (var i = 0; i < conVals.length; i++) {
    constants['B' + (i + 1)] = {
      label: String(conVals[i][0] || ''),
      value: norm_(conVals[i][1]),
      display: conDisp[i][1],
      hint: String(conVals[i][2] || '')
    };
  }

  // ② مدخلات الحاسبتين — تُقرأ لتكون نقطة البداية، ولا تُكتب إلّا بطلب صريح
  var calcInputs = {};
  if (cal) {
    var cv = cal.getRange('B11:B16').getValues();
    calcInputs = {
      current:   norm_(cv[0][0]),   // B11 حجوزاته الشهرية اليوم
      subfields: norm_(cv[1][0]),   // B12 عدد ملاعبه الفرعية
      price:     norm_(cv[2][0]),   // B13 متوسط سعر الحجزة
      varCost:   norm_(cv[3][0]),   // B14 تكلفته المتغيّرة
      through:   norm_(cv[4][0]),   // B15 ٪ ما يمرّ عبر المنصّة
      newB:      norm_(cv[5][0])    // B16 حجوزات جديدة
    };
  }

  var econInputs = {}, econStartRow = 0;
  if (eco) {
    var sports = eco.getRange('B10:E10').getDisplayValues()[0];
    var grid   = eco.getRange('B11:E14').getValues();
    var costs  = eco.getRange('B32:B37').getValues();
    /* التكاليف الحقيقية (رواتب · ضمان · تسويق · إداري · عمولة مبيعات ·
       بوّابة دفع · ضريبة) — أُضيفت إلى الورقة 2026-09-03، وهي التي تحوّل
       «هامش المساهمة» إلى ربحٍ صافٍ. تُقرأ بثلاثة مدَيات لا مدًى واحد:
       بينها صفوفُ فواصلَ ورؤوسُ أقسامٍ **مدموجة** (A:F)، والقراءة عبرها
       تعمل لكنّ الكتابة فوقها ترمي. */
    var team = eco.getRange('B57:B65').getValues();   // رواتب/ضمان/تسويق/إداري/عمولة
    var gate = eco.getRange('B68:B70').getValues();   // بوّابة الدفع
    var tax  = eco.getRange('B73').getValues();       // نسبة الضريبة
    /* 🔴 صفُّ «شهر الانضمام» **يُعثَر عليه بتسميته لا برقمه**: الورقة
       فيها صيغٌ ورؤوسٌ مدموجة، ورقمُ صفٍّ مكتوبٌ بيد يصير كاذبًا أوّل
       مرّةٍ يُدرَج صفٌّ فوقه — فيُكتب فوق صيغةٍ حيّة. وغيابُ الصفّ حالةٌ
       عادية لا عطل: كلُّ رياضةٍ تُقرأ «على المنصّة اليوم» (١). */
    var startRow  = findLabelRow_(eco, PLAN_LABEL);
    var startVals = startRow ? eco.getRange(startRow, 2, 1, 4).getValues()[0] : [];
    var capRow    = findLabelRow_(eco, CAP_LABEL);
    var capVals   = capRow ? eco.getRange(capRow, 2, 1, 4).getValues()[0] : [];
    econInputs = {
      sports: sports.map(function (s, k) {
        return {
          name:     s,
          places:   norm_(grid[0][k]),
          perPlace: norm_(grid[1][k]),
          weekly:   norm_(grid[2][k]),
          price:    norm_(grid[3][k]),
          start:    Math.max(1, Math.round(Number(startVals[k]) || 1)),
          /* ٠ = بلا سقف، وهو ما يُقرأ عند غياب الصفّ ⇒ سلوكٌ كما كان */
          maxPlaces: Math.max(0, Math.round(Number(capVals[k]) || 0))
        };
      }),
      msgCost:  norm_(costs[0][0]),
      msgPer:   norm_(costs[1][0]),
      infra:    norm_(costs[2][0]),
      fixed:    norm_(costs[3][0]),
      churn:    norm_(costs[4][0]),
      newPlace: norm_(costs[5][0]),
      /* B60/B61 ضمانٌ محسوبٌ في الشيت، ولا يُقرأ هنا: الموقع يحسبه من
         الراتب والنسبة كما يحسبه الشيت — قيمةٌ مقروءةٌ ومحسوبةٌ معًا تتباعد. */
      salary1:   norm_(team[0][0]),   // B57
      salary2:   norm_(team[1][0]),   // B58
      ssRate:    norm_(team[2][0]),   // B59
      mkt1:      norm_(team[5][0]),   // B62
      mkt2:      norm_(team[6][0]),   // B63
      admin:     norm_(team[7][0]),   // B64
      salesComm: norm_(team[8][0]),   // B65
      gwOn:      norm_(gate[0][0]),   // B68
      gwRate:    norm_(gate[1][0]),   // B69
      taxRate:   norm_(tax[0][0])     // B73
    };
    econStartRow = startRow;

    /* الغياب حالةٌ عادية: تُستعمل الأرقام المبدئية في الواجهة. */
    var scenRow = findLabelRow_(eco, SCEN_LABEL);
    if (scenRow) {
      var sv = eco.getRange(scenRow, 2, 1, 3).getValues()[0];
      econInputs.devWeekly   = norm_(sv[0]);
      econInputs.devChurn    = norm_(sv[1]);
      econInputs.devNewPlace = norm_(sv[2]);
    }

    /* الطلب والتحصيل — والغيابُ يعني القيم المحايدة (تبنٍّ كامل · بلا
       تسريب · تحصيلٌ فوريّ) وهي سلوكُ النموذج قبل هذه الدفعة بالحرف. */
    var demRow = findLabelRow_(eco, DEMAND_LABEL);
    if (demRow) {
      var dv = eco.getRange(demRow, 2, 1, 6).getValues()[0];
      econInputs.adopt0      = norm_(dv[0]);
      econInputs.adoptMax    = norm_(dv[1]);
      econInputs.adoptMonths = norm_(dv[2]);
      econInputs.leak        = norm_(dv[3]);
      econInputs.collect     = norm_(dv[4]);
      econInputs.collectDays = norm_(dv[5]);
    }
  }

  // ③ القيم التي حسبها الشيت — تُقارَن بحساب الواجهة (فحص المطابقة)
  var sheetComputed = {
    conCommission: cal ? null : null,
    con_B17: pick_(con, 'B17'), con_B18: pick_(con, 'B18'),
    con_B19: pick_(con, 'B19'), con_B20: pick_(con, 'B20'),
    con_B37: pick_(con, 'B37'), con_B38: pick_(con, 'B38'),
    con_B39: pick_(con, 'B39'), con_B40: pick_(con, 'B40'),
    cal_B31: pick_(cal, 'B31'), cal_B34: pick_(cal, 'B34'),
    cal_B36: pick_(cal, 'B36'), cal_B38: pick_(cal, 'B38'),
    eco_B45: pick_(eco, 'B45'), eco_B48: pick_(eco, 'B48'),
    eco_B54: pick_(eco, 'B54'),
    /* الأرقام الحقيقية بعد الرواتب والضريبة — أُضيفت مع قسم التكاليف. */
    eco_B76: pick_(eco, 'B76'), eco_B78: pick_(eco, 'B78'),
    eco_B84: pick_(eco, 'B84'), eco_B87: pick_(eco, 'B87'),
    eco_B88: pick_(eco, 'B88')
  };

  return {
    ok: true,
    now: Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'),
    tz: tz_(),
    url: ScriptApp.getService().getUrl(),
    sheetUrl: ss.getUrl(),
    user: (Session.getActiveUser().getEmail() || ''),
    constants: constants,
    calcInputs: calcInputs,
    econInputs: econInputs,
    econStartRow: econStartRow,
    sheetComputed: sheetComputed,
    vocab: {
      venues: readVocab_(SH.VEN, 1),
      tasks:  readVocab_(SH.TASK, 1),
      ideas:  readVocab_(SH.IDEA, 1),
      logs:   readVocab_(SH.LOG, 1),
      model:  modelVocab_()
    },
    venueLinks: readLinks_(SH.VEN, 'الموقع (خريطة)'),
    venues:   readTable_(SH.VEN, 1),
    tasks:    readTable_(SH.TASK, 1),
    ideas:    readTable_(SH.IDEA, 1),
    logs:     readTable_(SH.LOG, 1)
  };
}

/** مفردات «نموذج التسعير» — من تحقّق الخانة B5 إن وُجد. */
function modelVocab_() {
  var sh = ss_().getSheetByName(SH.CON);
  if (!sh) return ['عمولة متدرّجة'];
  var dv = sh.getRange('B5').getDataValidation();
  if (dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    var a = dv.getCriteriaValues();
    if (a && a[0] && a[0].length) return a[0].map(String);
  }
  return ['عمولة متدرّجة', 'اشتراك شهري', 'الاثنان معاً'];
}

function pick_(sh, a1) {
  if (!sh) return null;
  var v = sh.getRange(a1).getValue();
  return norm_(v);
}

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  return v;
}


// ═══════════════════════════════════════════════════════════
//  الكتابة  —  وحارسٌ واحد يحمي كلّ صيغةٍ في الشيت
// ═══════════════════════════════════════════════════════════

/**
 * 🔴 لا يُكتب فوق خليّةٍ فيها صيغة إطلاقًا.
 * أعمدة مثل «#» و«منذ (يوم)» صيغٌ تحسب نفسها، وكتابةُ قيمةٍ فوقها
 * تقتلها بصمت — ولا يظهر الأثر إلّا بعد أسابيع حين يتوقّف الترتيب
 * بعمود «منذ» عن العمل. الحارس هنا لا في الواجهة: الواجهة تُخفي،
 * والخادم يمنع.
 */
function setCell_(sh, row, col, value) {
  var rg = sh.getRange(row, col);
  if (String(rg.getFormula() || '').charAt(0) === '=') return false;   // صيغة — تُترك
  var nf = rg.getNumberFormat();
  rg.setValue(value === undefined || value === null ? '' : value);
  rg.setNumberFormat(nf);                                             // الجوّال يمسحه، فنعيده
  return true;
}

function colOf_(headers, name) {
  for (var i = 0; i < headers.length; i++) if (String(headers[i]).trim() === name) return i + 1;
  return 0;
}

/**
 * 🔴 يكتب مصفوفةً 2D في مدًى متجاور **بنداءٍ واحد** — لا خليّةً خليّة.
 * كلّ استدعاءٍ إلى الشيت رحلةٌ شبكية؛ حفظ جدول الرياضات الأربع كان ١٦
 * نداءً منفصلًا، صار ثلاثةً: قراءة الصيغ · كتابة القيم · إعادة التنسيق.
 * والحارس ينتقل معه: خليّةٌ فيها صيغة تبقى كما هي — قيمتها الحالية
 * تُعاد بدل قيمتك الجديدة، لا أن تُكتب فوقها (نفس عقد `setCell_`).
 */
function writeRange_(sh, row, col, values) {
  var numRows = values.length, numCols = values[0].length;
  var rg = sh.getRange(row, col, numRows, numCols);
  var formulas = rg.getFormulas();
  var current  = rg.getValues();
  var formats  = rg.getNumberFormats();

  var out = [], skipped = 0;
  for (var r = 0; r < numRows; r++) {
    out.push([]);
    for (var c = 0; c < numCols; c++) {
      if (String(formulas[r][c] || '').charAt(0) === '=') { out[r].push(current[r][c]); skipped++; }
      else out[r].push(values[r][c] === undefined || values[r][c] === null ? '' : values[r][c]);
    }
  }
  rg.setValues(out);
  rg.setNumberFormats(formats);          // الجوّال يمسحه، فنعيده — دفعةً واحدة أيضًا
  return { written: numRows * numCols - skipped, skipped: skipped };
}

/** يكتب كائنًا { "اسم العمود": قيمة } في صفٍّ قائم. */
function saveRow(sheetName, rowIndex, patch) {
  guardOwner_();
  var sh = ss_().getSheetByName(sheetName);
  if (!sh) throw new Error('ما لقيت ورقة «' + sheetName + '»');
  if (rowIndex < 2) throw new Error('صفّ العناوين لا يُعدَّل.');

  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0]
                  .map(function (h) { return String(h).trim(); });

  var written = 0, skipped = [];
  Object.keys(patch).forEach(function (k) {
    var c = colOf_(headers, k);
    if (!c) { skipped.push(k); return; }
    if (setCell_(sh, rowIndex, c, coerce_(patch[k]))) written++;
    else skipped.push(k + ' (صيغة)');
  });

  SpreadsheetApp.flush();
  return { ok: true, written: written, skipped: skipped, row: rowIndex };
}

/** يضيف صفًّا في أوّل موضعٍ فارغ — لا في نهاية الورقة، فالصيغ ممتدّة مسبقًا. */
function appendRow(sheetName, patch, keyColumn) {
  guardOwner_();
  var sh = ss_().getSheetByName(sheetName);
  if (!sh) throw new Error('ما لقيت ورقة «' + sheetName + '»');

  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0]
                  .map(function (h) { return String(h).trim(); });

  var keyCol = colOf_(headers, keyColumn) || 2;
  var scanTo = Math.max(2, Math.min(sh.getMaxRows(), MAX_ROWS));
  var keys   = sh.getRange(2, keyCol, scanTo - 1, 1).getValues();

  var target = 0;
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][0] === '' || keys[i][0] === null) { target = i + 2; break; }
  }
  if (!target) target = scanTo + 1;

  return saveRow(sheetName, target, patch);
}

/** يمسح محتوى صفٍّ (بلا حذفه) — فالصيغ في أعمدته تبقى حيّة للصفّ التالي. */
function clearRow(sheetName, rowIndex) {
  guardOwner_();
  var sh = ss_().getSheetByName(sheetName);
  if (!sh) throw new Error('ما لقيت ورقة «' + sheetName + '»');
  if (rowIndex < 2) throw new Error('صفّ العناوين لا يُمسَح.');

  var lastCol = Math.max(1, sh.getLastColumn());
  var blank = [];
  for (var c = 0; c < lastCol; c++) blank.push('');
  writeRange_(sh, rowIndex, 1, [blank]);
  SpreadsheetApp.flush();
  return { ok: true, row: rowIndex };
}

/** الثوابت: خانةٌ واحدة في العمود B. */
function saveConstant(row, value) {
  guardOwner_();
  var sh = ss_().getSheetByName(SH.CON);
  if (!sh) throw new Error('ما لقيت ورقة «' + SH.CON + '»');
  var ok = setCell_(sh, Number(row), 2, coerce_(value));
  SpreadsheetApp.flush();
  if (!ok) throw new Error('B' + row + ' فيها صيغة — تُحسب ولا تُكتب.');
  return { ok: true, row: Number(row), value: norm_(sh.getRange(Number(row), 2).getValue()) };
}

/** مدخلات حاسبة الملعب — تُكتب بطلبٍ صريح وحده، بنداءٍ واحد لا ستّة. */
function saveCalcInputs(v) {
  guardOwner_();
  var sh = ss_().getSheetByName(SH.CALC);
  if (!sh) throw new Error('ما لقيت ورقة «' + SH.CALC + '»');
  writeRange_(sh, 11, 2, [
    [Number(v.current)   || 0],
    [Number(v.subfields) || 0],
    [Number(v.price)     || 0],
    [Number(v.varCost)   || 0],
    [Number(v.through)   || 0],
    [Number(v.newB)      || 0]
  ]);
  SpreadsheetApp.flush();
  return { ok: true };
}

/** مدخلات اقتصاديات المنصة — مدَيان متجاوران، مدًى لكلّ نداء لا ٢٢ نداءً. */
/* تسميةُ صفّ خطّة الإدخال — **مكتوبةٌ مرّةً واحدة**: القراءةُ والكتابة
   تبحثان بها، فتغييرُها في موضعٍ واحد يكفي، ولا صفّان بمعنًى واحد. */
var PLAN_LABEL = 'شهر انضمام الرياضة للمنصّة';

/* انحرافُ السيناريوهات الثلاثة — نسبٌ يضبطها المالك من الموقع. تُخزَّن
   بنفس نمط صفّ الخطّة: يُعثَر عليها **بتسميتها** لا برقمها. */
var SCEN_LABEL = 'انحراف السيناريوهات (حجوزات · تسرّب · أماكن جديدة)';
/* ── صفّان مُسمّيان جديدان (2026-09-06) ────────────────────────────────
   بنفس نمط الصفَّين أعلاه: يُبحَث عنهما بالتسمية ويُنشآن في الذيل إن غابا
   ⇒ **لا يمسّان صيغةً ولا رأسًا مدموجًا** مهما تبدّلت الورقة، وغيابُهما
   حالةٌ عادية تُقرأ بالقيم المحايدة لا عطل. */
var CAP_LABEL    = 'سقف السوق لكلّ رياضة (0 = بلا سقف)';
var DEMAND_LABEL = 'الطلب والتحصيل (تبنٍّ · إلى · أشهر · تسريب · تحصيل · أيام)';

function saveEconInputs(v) {
  guardOwner_();
  var sh = ss_().getSheetByName(SH.ECON);
  if (!sh) throw new Error('ما لقيت ورقة «' + SH.ECON + '»');

  writeRange_(sh, 11, 2, [                                   // B11:E14 — شبكة الرياضات الأربع
    v.sports.map(function (s) { return Number(s.places)   || 0; }),
    v.sports.map(function (s) { return Number(s.perPlace) || 0; }),
    v.sports.map(function (s) { return Number(s.weekly)   || 0; }),
    v.sports.map(function (s) { return Number(s.price)    || 0; })
  ]);

  /* ── خطّة الإدخال: صفٌّ يُنشَأ مرّةً في ذيل الورقة ──────────────────
     🔴 لا يُكتب في الفراغ بين الصفوف ولا فوق رقمٍ محفوظ: يُبحَث عن الصفّ
        بتسميته، فإن غاب أُنشئ **بعد آخر صفٍّ فيه محتوى** بسطرَي فصل.
        وبهذا لا يمسّ صيغةً ولا رأسًا مدموجًا مهما تبدّلت الورقة. */
  var planRow = findLabelRow_(sh, PLAN_LABEL);
  if (!planRow) {
    /* موضعُه الطبيعي صفّ ٢١ — تحت شبكة الرياضات مباشرةً. ولا يُكتب فيه
       إن كان مشغولًا بشيءٍ آخر: عندها يُلحَق في الذيل بلا أن يمسّ شيئًا. */
    planRow = sh.getRange(ECON_JOIN_ROW, 1).getValue() ? sh.getLastRow() + 2 : ECON_JOIN_ROW;
    sh.getRange(planRow, 1).setValue(PLAN_LABEL);
    sh.getRange(planRow, 3).setValue('١ = على المنصّة اليوم · ٧ = تبدأ بعد ستّة أشهر. يكتبه الموقع.');
  }
  sh.getRange(planRow, 2, 1, 4).setValues([
    v.sports.map(function (s) { return Math.max(1, Math.round(Number(s.start) || 1)); })
  ]);
  sh.getRange(planRow, 2, 1, 4).setNumberFormat('#,##0');

  /* انحراف السيناريوهات — صفٌّ ثانٍ بنفس نمط الأوّل */
  var scenRow = findLabelRow_(sh, SCEN_LABEL);
  if (!scenRow) {
    scenRow = sh.getLastRow() + 2;
    sh.getRange(scenRow, 1).setValue(SCEN_LABEL);
    sh.getRange(scenRow, 5).setValue('نِسَبٌ مبدئية يضبطها الموقع — تُطبَّق صعودًا في المتفائل ونزولًا في المتشائم.');
  }
  var pctOf = function (x) { return Math.max(0, Math.min(3, Number(x) || 0)); };
  sh.getRange(scenRow, 2, 1, 3).setValues([[
    pctOf(v.devWeekly), pctOf(v.devChurn), pctOf(v.devNewPlace)
  ]]);
  sh.getRange(scenRow, 2, 1, 3).setNumberFormat('0%');

  /* ② سقف السوق — صفٌّ ثالث بنفس النمط */
  var capRow = findLabelRow_(sh, CAP_LABEL);
  if (!capRow) {
    capRow = sh.getLastRow() + 2;
    sh.getRange(capRow, 1).setValue(CAP_LABEL);
    sh.getRange(capRow, 6).setValue('أقصى عدد أماكن في السوق لكلّ رياضة — النموّ يقف عنده. 0 = بلا سقف.');
  }
  sh.getRange(capRow, 2, 1, 4).setValues([
    v.sports.map(function (s) { return Math.max(0, Math.round(Number(s.maxPlaces) || 0)); })
  ]);
  sh.getRange(capRow, 2, 1, 4).setNumberFormat('#,##0');

  /* ③④ الطلب والتحصيل — صفٌّ رابع. والنِّسَبُ تُكتب كسورًا (0..1)
     بتنسيق ٪، والشهورُ والأيامُ أعدادًا صحيحة ⇒ خانتان بتنسيقين. */
  var demRow = findLabelRow_(sh, DEMAND_LABEL);
  if (!demRow) {
    demRow = sh.getLastRow() + 2;
    sh.getRange(demRow, 1).setValue(DEMAND_LABEL);
    sh.getRange(demRow, 8).setValue(
      'التبنّي: كم من حجوزات المكان تمرّ عبرنا في شهره الأوّل ⇐ وإلى كم يصل ⇐ في كم شهرًا. ' +
      'ثمّ التسريب (وجدك ثمّ حجز مباشرةً)، ونسبةُ ما تُحصّله فعلًا، ومتوسّطُ أيام التحصيل. ' +
      'القيم المحايدة: ١٠٠٪ · ١٠٠٪ · ٦ · ٠٪ · ١٠٠٪ · ٠ — وهي التي كان النموذج يفترضها ضمنًا.');
  }
  var frac = function (x) { return Math.max(0, Math.min(1, Number(x) || 0)); };
  sh.getRange(demRow, 2, 1, 6).setValues([[
    frac(v.adopt0), frac(v.adoptMax), Math.max(0, Math.round(Number(v.adoptMonths) || 0)),
    frac(v.leak),   frac(v.collect),  Math.max(0, Math.round(Number(v.collectDays) || 0))
  ]]);
  sh.getRange(demRow, 2, 1, 2).setNumberFormat('0%');
  sh.getRange(demRow, 4).setNumberFormat('#,##0');
  sh.getRange(demRow, 5, 1, 2).setNumberFormat('0%');
  sh.getRange(demRow, 7).setNumberFormat('#,##0');

  writeRange_(sh, 32, 2, [                                   // B32:B37 — التكاليف
    [Number(v.msgCost)  || 0], [Number(v.msgPer)   || 0], [Number(v.infra)    || 0],
    [Number(v.fixed)    || 0], [Number(v.churn)    || 0], [Number(v.newPlace) || 0]
  ]);

  /* ⚠️ ثلاثة مدَيات لا مدًى واحد: بين B65 وB68 صفُّ فاصلٍ ورأسُ قسمٍ
     **مدموجٌ** A:F، والكتابة داخل خليّةٍ مدموجة ترمي. وB60/B61/B70 صيغٌ
     داخل المدَيات — و`writeRange_` يتخطّاها ويُبقيها كما هي. */
  writeRange_(sh, 57, 2, [                                   // B57:B65 — الفريق والتسويق
    [Number(v.salary1) || 0], [Number(v.salary2) || 0], [Number(v.ssRate) || 0],
    [''], [''],                                              // B60/B61 صيغتان — تُتخطّيان
    [Number(v.mkt1) || 0], [Number(v.mkt2) || 0],
    [Number(v.admin) || 0], [Number(v.salesComm) || 0]
  ]);
  writeRange_(sh, 68, 2, [                                   // B68:B70 — بوّابة الدفع
    [Number(v.gwOn) ? 1 : 0], [Number(v.gwRate) || 0], ['']  // B70 صيغة
  ]);
  writeRange_(sh, 73, 2, [[Number(v.taxRate) || 0]]);        // B73 — الضريبة

  SpreadsheetApp.flush();
  return { ok: true, planRow: planRow };
}

/** رقمُ الصفّ الذي نصُّ خليّته الأولى `label` — أو صفر. */
function findLabelRow_(sh, label) {
  var last = sh.getLastRow();
  if (!last) return 0;
  var col = sh.getRange(1, 1, last, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0] || '').trim() === label) return i + 1;
  }
  return 0;
}

/* ═══════════════════════════════════════════════════════════════════
   ترقية ورقة «اقتصاديات المنصة» — كي تحترم شهر انضمام كلّ رياضة
   ───────────────────────────────────────────────────────────────────
   🔴 **المشكلة التي تحلّها:** صيغ الورقة تفترض أنّ كلّ رياضةٍ أدخلتَ لها
      أماكن هي على المنصّة **الآن**. فلو أجّلتَ بادل ستّة أشهر، ظلّ الشيت
      يعدّ دخلها في ربح هذا الشهر بينما الموقع يستبعده — فيختلف الرقمان
      بلا أن يكون أحدهما مخطئًا في حسابه.

   وبعد هذه الترقية يحسب الشيت ما يحسبه الموقع **بالضبط**: مسارٌ لأماكن
   كلّ رياضةٍ على حدة، تدخل فيه في شهرها، وتنمو بحصّتها من الأماكن
   الجديدة وتنقص بالتسرّب. ومُتحقَّقٌ منه محلّيًّا على أربعة سيناريوهات
   (كلُّها اليوم · واحدةٌ مؤجَّلة · ثلاثٌ بشهورٍ مختلفة · كلُّها مؤجَّلة)
   بمحرّك حسابٍ مستقلّ: **٩٢ مقارنة، أقصى فرق 2.8e-14**.

   ⚠️ **ولا صفَّ يُدرَج ولا عمود**: ٦٠ عنوانًا في سكربت المزامنة ومدَياتٌ
      في هذا الملفّ وفي أداة الفحص كلُّها مثبَّتة على مواضعها. الترقية
      تكتب في صفّ ٢١ (كان فارغًا) وفي الأعمدة O..AB (كانت فارغة) وتعيد
      كتابة صيغٍ قائمة في مكانها.
   ⚠️ **والعمود L يبقى «الربح الشهري الحقيقي»** — الرسمة تقرؤه.
   ═══════════════════════════════════════════════════════════════════ */

var ECON_JOIN_ROW = 21;                 // B21:E21 — شهر انضمام كلّ رياضة
var ECON_M_FIRST  = 6, ECON_M_LAST = 29;   // صفوف المسار: الشهر ١..٢٤
var ECON_SPORTS   = ['B', 'C', 'D', 'E'];
var ECON_PCOL     = { B: 'P', C: 'Q', D: 'R', E: 'S' };   // عمود أماكن كلّ رياضة
var ECON_RATE     = { inc: 32, bk: 33, gmv: 34, sub: 35 };  // معدّلات لكلّ مكان

/**
 * يبني خريطة {عنوان: صيغة} لكلّ ما تكتبه الترقية — **دالّةٌ نقيّة**
 * لا تلمس الشيت، فتُقارَن بالمرجع المُتحقَّق منه خارج Apps Script.
 */
function econUpgradeCells_() {
  var out = {}, J = ECON_JOIN_ROW, i, r, sc;

  /* ① وسم صفّ شهر الانضمام — **مطابقٌ حرفيًّا** لـ`PLAN_LABEL`، فالقراءة
        والكتابة تجدان الصفّ به. والشرح في العمود C لا في التسمية. */
  out['A' + J] = PLAN_LABEL;

  /* ② معدّلات لكلّ مكانٍ واحد — تُحسب مرّةً وتُضرَب في أعمدة الأشهر */
  out['O31'] = 'معدّلات لكلّ مكانٍ واحد — تُقرأ من شبكة الرياضات أعلاه';
  var rl = { inc: ['دخل لكل مكان', 18], bk: ['حجوزات لكل مكان', 19],
             gmv: ['قيمة حجوزات لكل مكان', 20], sub: ['ملاعب فرعية لكل مكان', 15] };
  for (var key in rl) {
    out['O' + ECON_RATE[key]] = rl[key][0];
    for (i = 0; i < ECON_SPORTS.length; i++) {
      sc = ECON_SPORTS[i];
      out[ECON_PCOL[sc] + ECON_RATE[key]] = '=IFERROR(' + sc + rl[key][1] + '/' + sc + '11,0)';
    }
  }

  /* ③ رأس الكتلة المساعدة */
  out['O4'] = 'مسار الأماكن لكلّ رياضة — يحترم شهر انضمامها (صفّ ' + J + ')';
  out['O5'] = 'الشهر';
  for (i = 0; i < ECON_SPORTS.length; i++) out[ECON_PCOL[ECON_SPORTS[i]] + '5'] = '=' + ECON_SPORTS[i] + '10';
  var heads = [['T', 'أماكن مخطَّطة حيّة'], ['U', 'دخل مخطَّط حيّ'],
               ['V', 'أماكن تنضمّ هذا الشهر'], ['W', 'دخلها'],
               ['X', 'العمولة الفعلية'], ['Y', 'الحجوزات'], ['Z', 'قيمة الحجوزات'],
               ['AA', 'دخل المنضمّين'], ['AB', 'عدد المنضمّين']];
  for (i = 0; i < heads.length; i++) out[heads[i][0] + '5'] = heads[i][1];

  /* ④ صفوف الأشهر */
  var rngJ = '$B$' + J + ':$E$' + J, r11 = '$B$11:$E$11', r18 = '$B$18:$E$18';
  for (r = ECON_M_FIRST; r <= ECON_M_LAST; r++) {
    out['O' + r] = '=$H' + r;

    for (i = 0; i < ECON_SPORTS.length; i++) {
      sc = ECON_SPORTS[i];
      var pc = ECON_PCOL[sc];
      if (r === ECON_M_FIRST) {
        /* الشهر الأوّل: إمّا لم تنضمّ بعد (صفر) أو هي على المنصّة بأماكنها */
        out[pc + r] = '=IF($O' + r + '<' + sc + '$' + J + ',0,IF($O' + r + '=' + sc + '$' + J + ',' + sc + '$11,0))';
      } else {
        /* وإلّا: تنقص بالتسرّب وتنمو بحصّتها من الأماكن الجديدة */
        out[pc + r] = '=IF($O' + r + '<' + sc + '$' + J + ',0,IF($O' + r + '=' + sc + '$' + J + ',' + sc + '$11,' +
                      pc + (r - 1) + '*(1-$B$36)+IFERROR($B$37*' + sc + '$11/$T' + r + ',0)))';
      }
    }

    out['T' + r] = '=SUMIF(' + rngJ + ',"<="&$O' + r + ',' + r11 + ')';
    out['U' + r] = '=SUMIF(' + rngJ + ',"<="&$O' + r + ',' + r18 + ')';
    /* ما ينضمّ دفعةً واحدة هذا الشهر — والشهر الأوّل لا انضمامَ فيه:
       رياضةٌ شهرُها ١ هي على المنصّة اليوم لا «تنضمّ» الآن. */
    out['V' + r] = '=IF($O' + r + '=1,0,SUMIF(' + rngJ + ',$O' + r + ',' + r11 + '))';
    out['W' + r] = '=IF($O' + r + '=1,0,SUMIF(' + rngJ + ',$O' + r + ',' + r18 + '))';

    var pr = '$P' + r + ':$S' + r;
    out['X' + r] = '=SUMPRODUCT(' + pr + ',$P$' + ECON_RATE.inc + ':$S$' + ECON_RATE.inc + ')';
    out['Y' + r] = '=SUMPRODUCT(' + pr + ',$P$' + ECON_RATE.bk + ':$S$' + ECON_RATE.bk + ')';
    out['Z' + r] = '=SUMPRODUCT(' + pr + ',$P$' + ECON_RATE.gmv + ':$S$' + ECON_RATE.gmv + ')';

    /* المنضمّون: حصّةُ الأماكن الجديدة على الحيّة غيرِ المنضمّة الآن،
       زائدَ أماكن الرياضة التي تنضمّ هذا الشهر كلِّها. */
    out['AA' + r] = '=IFERROR($B$37*(U' + r + '-W' + r + ')/T' + r + ',0)+W' + r;
    out['AB' + r] = '=IFERROR($B$37*(T' + r + '-V' + r + ')/T' + r + ',0)+V' + r;

    /* ⑤ أعمدة المسار القائمة I..L — تُعاد كتابتها لتقرأ من الكتلة */
    out['I' + r] = '=SUM($P' + r + ':$S' + r + ')';
    var rev = 'IF($B$23="اشتراك شهري",I' + r + '*$B$29,' +
              'IF($B$23="الاثنان معاً",X' + r + '-$B$28*AA' + r + '+I' + r + '*$B$29,' +
              'X' + r + '-$B$28*AA' + r + '))';
    out['J' + r] = '=' + rev + '-Y' + r + '*$B$32*$B$33-$B$34-$B$35';
    out['K' + r] = '=IF($H' + r + '<=12,$B$57+$B$60+$B$62,$B$58+$B$61+$B$63)+$B$64' +
                   '+AB' + r + '*$B$65+Z' + r + '*$B$69*$B$68';
    out['L' + r] = '=J' + r + '-K' + r;
  }

  /* ⑥ لقطة «اليوم» = الشهر الأوّل من المسار نفسِه، لا حسابٌ ثانٍ بجانبه */
  var f = ECON_M_FIRST;
  out['B40'] = '=$Y$' + f;
  out['B41'] = '=$Z$' + f;
  out['B42'] = '=$X$' + f;
  out['B43'] = '=-$B$28*$AA$' + f;
  out['B44'] = '=$I$' + f + '*$B$29';
  out['B51'] = '=IFERROR($B$45/$I$' + f + ',"—")';
  out['B52'] = '=IFERROR($B$45/SUMPRODUCT($P$' + f + ':$S$' + f + ',$P$' + ECON_RATE.sub + ':$S$' + ECON_RATE.sub + '),"—")';
  out['B53'] = '=IFERROR($B$45/$Z$' + f + ',"—")';
  /* ── ① التعادل بالثابت كلِّه (2026-09-06) ──────────────────────────
     🔴 كانت الصيغة `($B$34+$B$35)` — البنيةُ التحتية والثابتُ الآخر وحدهما
        (٤٠ د.أ على المدخلات الحقيقية)، والرواتبُ B57 والضمانُ B60 والتسويقُ
        B62 والإداريُّ B64 (‏١٨٩٢٫٥) خارجَها ⇒ «تتعادل عند ٠٫٢٥ مكانًا»،
        أي إنّك رابحٌ قبل ملعبك الأوّل. والمقامُ كذلك: المساهمةُ تطرح
        المتغيّرَ كلَّه (رسائلُ B46 وبوّابةٌ B70 وعمولةُ مبيعات) لا الرسائلَ
        وحدها. وهي الآن **نفسُ تعبير الموقع حرفًا بحرف**.
     ⚠️ وتُسري بعد `upgradeEconSheet()` وحده — وحتى تُشغَّل يبقى فحصُ
        المطابقة في الموقع يقارن التعريف القديم عمدًا. */
  out['B54'] = '=IFERROR(($B$34+$B$35+$B$57+$B$60+$B$62+$B$64)' +
               '/(($B$45-$B$46-$B$70-$AB$' + f + '*$B$65)/$I$' + f + '),"—")';
  out['C54'] = 'الثابتُ الشهري كلُّه (بنيةٌ ورواتبُ وضمانٌ وتسويقٌ وإداريّ) ÷ مساهمة المكان الواحد';
  out['B7']  = '=IFERROR($B$45/$Z$' + f + ',"—")';
  out['B70'] = '=$Z$' + f + '*B69*B68';
  /* عمولة المبيعات صارت شهريةً متغيّرة ⇒ تُقرأ من الشهر الأوّل هنا،
     ومن صفّ كلّ شهرٍ في العمود K. */
  out['B76'] = '=B57+B60+B62+B64+$AB$' + f + '*$B$65';
  out['B77'] = '=B58+B61+B63+B64+$AB$' + f + '*$B$65';

  /* 🔴 الضمان الاجتماعي: صيغتاه كانتا **مفقودتين** من الورقة (B60/B61
     فارغتان) فكان `B76` يجمع صفرًا مكانه ⇒ الشيت لا يعدّ الضمان أصلًا
     بينما الموقع يحسبه. تُستعادان — والقاعدة الموثَّقة أنّ الضمان
     **يُحسَب من الراتب لا يُقرأ**، فقيمةٌ مقروءةٌ ومحسوبةٌ تتباعدان. */
  out['B60'] = '=B57*B59';
  out['B61'] = '=B58*B59';

  /* ⑦ حواشٍ تقول ما تغيّر — وإلّا قرأ القارئ «الدخل الشهري» خطّةً كاملة */
  out['C5']  = 'ما هو على المنصّة اليوم فقط — الرياضة المؤجَّلة تدخل في شهرها (صفّ ' + J + ')';
  out['C42'] = 'من الرياضات التي على المنصّة اليوم وحدها';
  out['C' + J] = '١ = على المنصّة اليوم · ٧ = تنضمّ بعد ستّة أشهر. يكتبه الموقع أيضًا.';

  return out;
}

/**
 * يكتب الترقية في الشيت. آمنٌ للتكرار: تشغيلُه مرّتين يكتب نفس الصيغ.
 */
function upgradeEconSheet() {
  guardOwner_();
  var sh = ss_().getSheetByName(SH.ECON);
  if (!sh) throw new Error('ما لقيت ورقة «' + SH.ECON + '»');

  /* ① صفّ شهر الانضمام: يُنقَل إلى ٢١ إن كان الموقع قد أنشأه في الذيل،
        بقيمه كما هي — فلا يفقد المالك خطّته. */
  var old = findLabelRow_(sh, PLAN_LABEL);
  var vals = (old ? sh.getRange(old, 2, 1, 4).getValues()[0] : [1, 1, 1, 1]);
  for (var i = 0; i < 4; i++) vals[i] = Math.max(1, Math.round(Number(vals[i]) || 1));
  if (old && old !== ECON_JOIN_ROW) sh.getRange(old, 1, 1, 6).clearContent();

  /* ② الصيغ */
  var cells = econUpgradeCells_(), n = 0;
  for (var addr in cells) { sh.getRange(addr).setValue(cells[addr]); n++; }

  /* ③ القيم بعد الصيغ — كي لا تُمحى بتسمية العمود A */
  sh.getRange(ECON_JOIN_ROW, 2, 1, 4).setValues([vals]);
  sh.getRange(ECON_JOIN_ROW, 2, 1, 4).setNumberFormat('#,##0');
  sh.getRange(ECON_M_FIRST, 15, ECON_M_LAST - ECON_M_FIRST + 1, 14).setNumberFormat('#,##0.00');

  SpreadsheetApp.flush();
  return { ok: true, wrote: n, joinRow: ECON_JOIN_ROW, movedFrom: (old && old !== ECON_JOIN_ROW) ? old : 0 };
}

/** التاريخ يُكتب تاريخًا لا نصًّا — وإلّا فشل «منذ (يوم)» بصمت. */
function coerce_(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    var p = v.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  return v;
}

/** تحديثٌ خفيف بعد كتابة — لا يُعيد كلّ شيء. */
function refresh(what) {
  guardOwner_();
  if (what === 'venues') return readTable_(SH.VEN, 1);
  if (what === 'tasks')  return readTable_(SH.TASK, 1);
  if (what === 'ideas')  return readTable_(SH.IDEA, 1);
  if (what === 'logs')   return readTable_(SH.LOG, 1);
  return getBootstrap();
}


// ═══════════════════════════════════════════════════════════
//  مفردات الحالة  —  تُقرأ من قوائم التحقّق في الشيت لا تُخترَع
// ═══════════════════════════════════════════════════════════

/**
 * 🔴 لا تُكتب هنا قائمةُ حالاتٍ بيد. الشيت يحمل قوائم التحقّق الخاصّة به،
 *    وقائمةٌ ثانيةٌ في الموقع تنحرف عنها أوّلَ مرّةٍ يضيف فيها المالك حالة —
 *    فيكتب الموقعُ قيمةً ترفضها الورقة، أو يُخفي قيمةً موجودة.
 *    وإن لم يكن على العمود تحقّق، تُجمَع القيم الموجودة فعلًا في صفوفه.
 */
function readVocab_(name, headerRow) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return {};

  var lastCol = Math.max(1, sh.getLastColumn());
  var lastRow = Math.min(Math.max(sh.getLastRow(), headerRow + 1), MAX_ROWS);
  var headers = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
  var out = {};

  for (var c = 1; c <= lastCol; c++) {
    var head = String(headers[c - 1] || '').trim();
    if (!head) continue;

    var list = null;
    // التحقّق قد يكون على أوّل صفٍّ فارغ أو على صفٍّ مملوء — نجرّب بضعة صفوف
    for (var probe = headerRow + 1; probe <= Math.min(headerRow + 6, lastRow); probe++) {
      var dv = sh.getRange(probe, c).getDataValidation();
      if (dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        var args = dv.getCriteriaValues();
        if (args && args[0] && args[0].length) { list = args[0].map(String); break; }
      }
    }

    if (!list && lastRow > headerRow) {
      var seen = {}, vals = sh.getRange(headerRow + 1, c, lastRow - headerRow, 1).getDisplayValues();
      for (var r = 0; r < vals.length; r++) {
        var v = String(vals[r][0]).trim();
        if (v && v.length < 40 && !/^\d/.test(v)) seen[v] = true;
      }
      /* السقف ٤٠ لا ١٢: عندك أربع عشرة منطقة، وسقفٌ أضيق كان يُسقط العمود
         كلَّه فتخرج القائمة بقيمةٍ واحدة — وهي أسوأ من غياب القائمة، لأنّها
         تدفع إلى الكتابة الحرّة فتصير «عمّان» و«عمان» منطقتين. وفلترُ الطول
         (<40 محرفًا) هو ما يمنع أعمدة النثر من الدخول أصلًا. */
      var keys = Object.keys(seen);
      if (keys.length && keys.length <= 40) list = keys.sort();
    }

    if (list) out[head] = list;
  }
  return out;
}

/** روابط عمود «الموقع (خريطة)» مخبّأةٌ في النصّ الغنيّ لا في القيمة. */
function readLinks_(name, headerName) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return {};
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
                  .map(function (h) { return String(h).trim(); });
  var c = colOf_(headers, headerName);
  if (!c) return {};

  var lastRow = Math.min(sh.getLastRow(), MAX_ROWS);
  if (lastRow < 2) return {};

  var rt = sh.getRange(2, c, lastRow - 1, 1).getRichTextValues();
  var out = {};
  for (var i = 0; i < rt.length; i++) {
    var v = rt[i][0];
    if (!v) continue;
    var url = v.getLinkUrl();
    if (!url) {
      var runs = v.getRuns();
      for (var k = 0; k < runs.length; k++) { if (runs[k].getLinkUrl()) { url = runs[k].getLinkUrl(); break; } }
    }
    if (url) out[i + 2] = url;
  }
  return out;
}

/** يُكتب الرابط نصًّا غنيًّا كي يبقى قابلًا للنقر في الشيت كما في الموقع. */
function setVenueMap(rowIndex, url, label) {
  guardOwner_();
  var sh = ss_().getSheetByName(SH.VEN);
  if (!sh) throw new Error('ما لقيت ورقة «' + SH.VEN + '»');
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0]
                  .map(function (h) { return String(h).trim(); });
  var c = colOf_(headers, 'الموقع (خريطة)');
  if (!c) throw new Error('ما في عمود «الموقع (خريطة)»');

  var rg = sh.getRange(rowIndex, c);
  if (!url) { rg.setValue(''); return { ok: true }; }
  if (!/^https?:\/\//i.test(url)) throw new Error('الرابط لازم يبدأ بـ http أو https.');

  rg.setRichTextValue(
    SpreadsheetApp.newRichTextValue()
      .setText(label || 'افتح الخريطة')
      .setLinkUrl(url)
      .build()
  );
  SpreadsheetApp.flush();
  return { ok: true };
}
