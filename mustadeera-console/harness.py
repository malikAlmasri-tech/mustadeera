# -*- coding: utf-8 -*-
"""يبني نسخةً محلّية من الموقع بمعطيات الشيت الحقيقية.

يستبدل google.script.run بردودٍ **بشكل ما يرجعه الخادم بالضبط**، فيجري
مسار الواجهة كلُّه — الجلبة والرسم والحفظ. ولا يُشحن هذا الملفّ إلى أحد:
`_preview.html` مخرَجُ فحصٍ يُحذَف بعده.
"""
import io, json, os, datetime
import openpyxl
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string

ROOT = os.path.dirname(os.path.abspath(__file__))
# ⚠️ المجلّد انتقل داخل المستودع (ترتيب 2026-08-30) فصار التصدير بجانبه لا
# فوقه. تُجرَّب المواضع بالترتيب، ويتقدّم عليها `MUSTADEERA_XLSX` كي يُفحَص
# تصديرٌ بعينه بلا تحرير الملفّ.
_CANDIDATES = [
    os.environ.get("MUSTADEERA_XLSX", ""),
    os.path.join(ROOT, "المستديرة.xlsx"),
    os.path.join(os.path.dirname(ROOT), "المستديرة.xlsx"),
]
# ⚠️ التصديرات على القرص لقطاتٌ متفرّقة بأسماءٍ مختلفة («المستديرة» ·
# «… الربح الشهري ٢٤ شهرًا» …) — فالبحث الأخير **بالمحتوى لا بالاسم**:
# أيّ مصنّفٍ فيه ورقة «اقتصاديات المنصة» يصلح. وإلّا وقف الفحص لأنّ
# التصدير أُعيدت تسميته، وهو ما وقع فعلًا.
for _n in sorted(os.listdir(ROOT)):
    if _n.endswith(".xlsx") and not _n.startswith("~$"):
        _CANDIDATES.append(os.path.join(ROOT, _n))
XLSX = next((p for p in _CANDIDATES if p and os.path.exists(p)), "")
if not XLSX:
    raise SystemExit("ما لقيت تصدير الشيت. حطّه بجانب harness.py باسم «المستديرة.xlsx» "
                     "أو مرّر MUSTADEERA_XLSX=<المسار>.")

wbv = openpyxl.load_workbook(XLSX, data_only=True)


def sh(n):
    return wbv[n] if n in wbv.sheetnames else None


def norm(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime('%Y-%m-%d')
    return '' if v is None else v


def read_table(name, header_row=1, max_rows=300):
    ws = sh(name)
    if ws is None:
        return {'headers': [], 'rows': []}
    lc = ws.max_column
    headers = [str(ws.cell(header_row, c).value or '').strip() for c in range(1, lc + 1)]
    rows = []
    for r in range(header_row + 1, min(ws.max_row, max_rows) + 1):
        obj, any_ = {'_row': r}, False
        for c in range(1, lc + 1):
            h = headers[c - 1]
            if not h:
                continue
            v = norm(ws.cell(r, c).value)
            obj[h] = v
            obj['#' + h] = '' if v == '' else str(v)
            if v != '':
                any_ = True
        if any_:
            rows.append(obj)
    return {'headers': [h for h in headers if h], 'rows': rows}


def gv(ws, a1):
    col, row = coordinate_from_string(a1)
    return norm(ws.cell(row, column_index_from_string(col)).value)


def vocab_of(name, cols):
    ws, out = sh(name), {}
    if ws is None:
        return out
    headers = [str(ws.cell(1, c).value or '').strip() for c in range(1, ws.max_column + 1)]
    for c in range(1, ws.max_column + 1):
        h = headers[c - 1]
        if not h or h not in cols:
            continue
        seen = []
        for r in range(2, min(ws.max_row, 300) + 1):
            v = str(norm(ws.cell(r, c).value)).strip()
            if v and len(v) < 40 and not v[:1].isdigit() and v not in seen:
                seen.append(v)
        if seen and len(seen) <= 40:
            out[h] = sorted(seen)
    return out


CON, CAL, ECO = sh('الثوابت'), \
                sh('حاسبة الملعب'), \
                sh('اقتصاديات المنصة')

constants = {}
for i in range(1, 61):
    constants['B%d' % i] = {
        'label':   str(CON.cell(i, 1).value or ''),
        'value':   norm(CON.cell(i, 2).value),
        'display': str(norm(CON.cell(i, 2).value)),
        'hint':    str(CON.cell(i, 3).value or ''),
    }

calc_inputs = {
    'current':   norm(CAL.cell(11, 2).value), 'subfields': norm(CAL.cell(12, 2).value),
    'price':     norm(CAL.cell(13, 2).value), 'varCost':   norm(CAL.cell(14, 2).value),
    'through':   norm(CAL.cell(15, 2).value), 'newB':      norm(CAL.cell(16, 2).value),
}

PLAN_LABEL = 'شهر انضمام الرياضة للمنصّة'


def plan_row():
    """رقمُ صفّ خطّة الإدخال — **بتسميته لا برقمه**، كما يقرؤه WebApp.gs.

    وغيابُه حالةٌ عادية: الورقة لم يُكتب فيها الصفّ بعد ⇒ كلُّ رياضةٍ
    تُقرأ «على المنصّة اليوم».
    """
    for r in range(1, min(ECO.max_row, 400) + 1):
        if str(ECO.cell(r, 1).value or '').strip() == PLAN_LABEL:
            return r
    return 0


_PR = plan_row()

econ_inputs = {
    'sports': [{
        'name':     str(ECO.cell(10, 2 + k).value or ''),
        'places':   norm(ECO.cell(11, 2 + k).value),
        'perPlace': norm(ECO.cell(12, 2 + k).value),
        'weekly':   norm(ECO.cell(13, 2 + k).value),
        'price':    norm(ECO.cell(14, 2 + k).value),
        'start':    (norm(ECO.cell(_PR, 2 + k).value) if _PR else 1) or 1,
    } for k in range(4)],
    'msgCost': norm(ECO.cell(32, 2).value), 'msgPer':   norm(ECO.cell(33, 2).value),
    'infra':   norm(ECO.cell(34, 2).value), 'fixed':    norm(ECO.cell(35, 2).value),
    'churn':   norm(ECO.cell(36, 2).value), 'newPlace': norm(ECO.cell(37, 2).value),
    # التكاليف الحقيقية (رواتب · ضمان · تسويق · إداري · عمولة · بوّابة · ضريبة)
    'salary1':   norm(ECO.cell(57, 2).value), 'salary2': norm(ECO.cell(58, 2).value),
    'ssRate':    norm(ECO.cell(59, 2).value),
    'mkt1':      norm(ECO.cell(62, 2).value), 'mkt2':    norm(ECO.cell(63, 2).value),
    'admin':     norm(ECO.cell(64, 2).value), 'salesComm': norm(ECO.cell(65, 2).value),
    'gwOn':      norm(ECO.cell(68, 2).value), 'gwRate':  norm(ECO.cell(69, 2).value),
    'taxRate':   norm(ECO.cell(73, 2).value),
}

sheet_computed = {
    'con_B17': gv(CON, 'B17'), 'con_B18': gv(CON, 'B18'), 'con_B19': gv(CON, 'B19'),
    'con_B20': gv(CON, 'B20'), 'con_B37': gv(CON, 'B37'), 'con_B38': gv(CON, 'B38'),
    'con_B39': gv(CON, 'B39'), 'con_B40': gv(CON, 'B40'),
    'cal_B31': gv(CAL, 'B31'), 'cal_B34': gv(CAL, 'B34'), 'cal_B36': gv(CAL, 'B36'),
    'cal_B38': gv(CAL, 'B38'),
    'eco_B45': gv(ECO, 'B45'), 'eco_B48': gv(ECO, 'B48'), 'eco_B54': gv(ECO, 'B54'),
    'eco_B76': gv(ECO, 'B76'), 'eco_B78': gv(ECO, 'B78'), 'eco_B84': gv(ECO, 'B84'),
    'eco_B87': gv(ECO, 'B87'), 'eco_B88': gv(ECO, 'B88'),
}

boot = {
    'ok': True, 'now': datetime.date.today().strftime('%Y-%m-%d'), 'tz': 'Asia/Amman',
    'url': '#', 'sheetUrl': 'https://docs.google.com/spreadsheets/', 'user': 'preview@local',
    'constants': constants, 'calcInputs': calc_inputs, 'econInputs': econ_inputs, 'econStartRow': _PR,
    'sheetComputed': sheet_computed,
    'vocab': {
        'venues': vocab_of('الملاعب',
                           ['المنطقة', 'الحالة',
                            'الرياضة',
                            'من أين وصلتُه']),
        'tasks':  vocab_of('المهام',
                           ['المجال', 'الأولوية',
                            'الحالة', 'على مَن']),
        'ideas':  vocab_of('الأفكار',
                           ['من أين جاءت', 'القرار']),
        'logs':   vocab_of('سجل التواصل',
                           ['النوع', 'النتيجة']),
        'model':  ['عمولة متدرّجة',
                   'اشتراك شهري',
                   'الاثنان معاً'],
    },
    'venueLinks': {},
    'venues': read_table('الملاعب'),
    'tasks':  read_table('المهام'),
    'ideas':  read_table('الأفكار'),
    'logs':   read_table('سجل التواصل'),
}

rd = lambda f: io.open(os.path.join(ROOT, f), encoding='utf-8').read()
page = rd('Index.html')
page = page.replace("<?!= include('Styles'); ?>", rd('Styles.html'))
page = page.replace("<?!= include('Model');  ?>", rd('Model.html'))
page = page.replace("<?!= include('Script'); ?>", rd('Script.html'))

MOCK = """
<script>
var __BOOT__ = __JSON__;
window.google = { script: { run: (function () {
  var ok = null;
  var api = {
    withSuccessHandler: function (f) { ok = f; return api; },
    withFailureHandler: function () { return api; },
    getBootstrap:   function () { setTimeout(function () { ok(JSON.parse(JSON.stringify(__BOOT__))); }, 110); },
    refresh:        function (w) { setTimeout(function () { ok(__BOOT__[w]); }, 80); },
    saveRow:        function () { setTimeout(function () { ok({ ok: true, written: 1, skipped: [] }); }, 120); },
    appendRow:      function () { setTimeout(function () { ok({ ok: true, written: 1, skipped: [] }); }, 120); },
    clearRow:       function () { setTimeout(function () { ok({ ok: true }); }, 100); },
    saveConstant:   function (r, v) { setTimeout(function () { __BOOT__.constants['B' + r].value = v; ok({ ok: true, row: r, value: v }); }, 100); },
    saveCalcInputs: function () { setTimeout(function () { ok({ ok: true }); }, 100); },
    saveEconInputs: function () { setTimeout(function () { ok({ ok: true }); }, 100); },
    setVenueMap:    function () { setTimeout(function () { ok({ ok: true }); }, 100); }
  };
  return api;
})() } };
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
</script>
"""

page = page.replace('<body>', '<body>' + MOCK.replace('__JSON__', json.dumps(boot, ensure_ascii=False)), 1)
io.open(os.path.join(ROOT, '_preview.html'), 'w', encoding='utf-8', newline='\n').write(page)

print('wrote _preview.html (%d chars)' % len(page))
print('venues=%d tasks=%d ideas=%d logs=%d' % (
    len(boot['venues']['rows']), len(boot['tasks']['rows']),
    len(boot['ideas']['rows']), len(boot['logs']['rows'])))
print('sheetComputed =', json.dumps(sheet_computed, ensure_ascii=False))
print('planRow       =', _PR or '(غير موجود — كلّ رياضةٍ تبدأ من الشهر ١)')
print('vocab.venues  =', json.dumps(boot['vocab']['venues'], ensure_ascii=False))
