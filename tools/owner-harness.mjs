#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   owner-harness — لوحة المالك تُفحَص، وهي خلف تسجيل دخول

   `/admin` لها `admin-harness.mjs` منذ الدفعة ٢٧ للسبب نفسه بالضبط: صفحةٌ خلف
   جلسة لا تُفحَص بقراءة الكود. ولوحة المالك أسوأ حالًا — سُجِّل في `CLAUDE.md`
   أنها **لم تُقَس حيّةً قطّ**، فكلُّ ما قيل عن تخطيطها كان استنتاجًا.

   🔴 **ولا يصحّ هنا حقنُ `State` مباشرةً**: التطبيق **مغلَّف في IIFE** (مكتوبٌ
   في رأس `app.js` حرفيًّا: «صفر متغيرات عامة في window»)، فسكربتٌ لاحق لا يرى
   `State` ولا `renderOwnerDashboard`. جُرّب فأعطى `State is not defined`
   **بلا خطأٍ واحد في الـconsole**، والصفحة تبدو سليمة على شاشة الترحيب.
   فالمدخل الصادق الوحيد هو **الشبكة**: تُستبدَل `fetch` بردودٍ بشكل صفوف
   القاعدة الخام، فيجري المسار الحقيقي كلُّه — `sbSession` ثمّ `sbBookingsQuery`
   بجولات أعمدتها ثمّ `sbBooking`/`sbField` — ويُرى ما يراه المالك بالضبط.

   ⚠️ **والبيانات تُحسَب من `Date.now()` بلا قصّ** (مزلق مسجَّل): حجزٌ «بعد ثلاث
      ساعات» يُشتقّ منه التاريخُ والساعةُ معًا، وإلّا وقع الفحص عند منتصف الليل
      على يومٍ آخر فمرّ عطلٌ في المُعطى على أنه سلوكٌ صحيح.
   ⚠️ **وأسماء الأعمدة تُقرأ من `sbBooking`/`sbField` لا من الحدس**: شبكةٌ لا
      تطابق المخطّط تصنع أعطالًا وهمية تُهدَر عليها دفعة (وقع ذلك في
      `admin-harness` حين سُمّي `booking_date` باسم `d`).

   التشغيل:  node tools/owner-harness.mjs        ⇒ app/src/_preview_owner.html
   والحذف:   node tools/owner-harness.mjs --rm
   (والملفّ ضمن `app/src/_preview_*.html` وهو **مُتجاهَل في git**؛ ومع ذلك
    يُحذف بعد الفحص: صفحةٌ تتخطّى تسجيل الدخول لا تُترك على القرص.)
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'app', 'src', '_preview_app.html');
const OUT = path.join(ROOT, 'app', 'src', '_preview_owner.html');

if (process.argv.includes('--rm')) {
  if (fs.existsSync(OUT)) { fs.unlinkSync(OUT); console.log('  removed ' + path.relative(ROOT, OUT)); }
  else console.log('  nothing to remove');
  process.exit(0);
}
if (!fs.existsSync(SRC)) {
  console.error('  x لا يوجد _preview_app.html — شغّل build.ps1 أوّلًا.');
  process.exit(1);
}

/* الحقن **قبل** سكربت التطبيق: `fetch` تُستبدَل قبل أن يُطلَق أيّ طلب، والجلسة
   تُزرع قبل أن يقرأها `init()`. ولو وقع قبل `</body>` لسبقه الإقلاع كلُّه. */
const INJECT = String.raw`<script>
/* ===== owner-harness — فحصٌ فقط، لا يُشحَن ===== */
(function(){
  var NOW = Date.now();
  var HOURS = [8,10,12,14,16,18,20,22];
  function ymdOf(t){ var d = new Date(t);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function label(h){ var a=h%12||12, b=h<12?'ص':'م', c=(h+2)%12||12, d=(h+2)<12?'ص':'م';
    return a+':00 '+b+' - '+c+':00 '+d; }

  /* جلسة مالكٍ صالحة ساعةً — «sbSession« تُرجعها كما هي بلا تجديد. */
  var SESSION = { at:'harness-token', rt:'harness-refresh', exp: NOW + 36e5,
                  uid:'u-owner', role:'owner', name:'صاحب الملعب', phone:'0790000000',
                  place_id:'p1', place_ids:['p1'], verified:true };
  try{
    localStorage.setItem('owner_token', JSON.stringify(SESSION));
    localStorage.removeItem('player_token'); sessionStorage.removeItem('player_token');
    localStorage.setItem('mustadaira:onb','9');
    localStorage.setItem('mustadaira:introSeen','1');
  }catch(e){}

  var FIELDS = [];
  for(var f=1; f<=4; f++) FIELDS.push({
    id:'f'+f, place_id:'p1', name:'ملعب '+f, size:'7x7', price:25+f, active:true,
    slots: HOURS.map(function(h){ return { h:h, label:label(h) }; }),
    image_url:'', sport:'football', gender:null, attrs:{} });

  var NAMES = ['أبو أحمد','خالد','سامر','ليث','عمر','مهند','زيد','باسل','رامي','طارق'];
  var BK = [], id = 0;
  function push(dayOffset, hour, fieldIx, status, extra){
    id++;
    var created = NOW - (dayOffset >= 0 ? (2 + dayOffset) * 864e5 : 864e5) + (id % 7) * 36e5;
    var row = { id:'b'+id, created_at:new Date(created).toISOString(), player_id:'u'+(id%10),
      place_id:'p1', field_id:'f'+(fieldIx+1), booking_date:ymdOf(NOW + dayOffset*864e5), hour:hour,
      time_label:label(hour), customer_name:NAMES[id%NAMES.length],
      customer_phone:'07'+String(90000000 + (id%10)*1111111), players_size:'14',
      price:25+fieldIx, source:'direct', status:status, cancel_reason:null,
      place_name:'مجمّع الاختبار', field_name:'ملعب '+(fieldIx+1), city:'عمّان',
      cancel_kind:null, no_show:false, visibility:'private',
      players_needed:null, players_brought:null, replied_at:null };
    for(var k in (extra||{})) row[k] = extra[k];
    BK.push(row); return row;
  }
  /* تسعون يومًا للخلف: كثافةٌ تتجاوز كلَّ عتبةٍ في اللوحة (٧ فأعلى) فتُرى
     الذروة والخريطة الحرارية وأثرُ سرعة الردّ والعملاء المنقطعون معًا. */
  for(var day=-90; day<=3; day++){
    for(var i=0; i<HOURS.length; i++){
      var hour = HOURS[i], fx = ((day + i) % 4 + 4) % 4;
      /* الطلب مائلٌ إلى المساء عمدًا: بلا ميلٍ لا تُحسَب «ذروة» فيمتنع لوحُ
         الكفاءة عن الفصل — وهي حالةٌ صحيحة لكنّها لا تفحص المسار. */
      var hit = ((((day*7 + i*3) % 10) + 10) % 10) < (hour >= 18 ? 7 : 3);
      if(!hit) continue;
      var st = day > 0 ? (((day + i) % 3 === 0) ? 'pending' : 'confirmed') : 'confirmed';
      var ex = {};
      if(day < 0){
        var fast = ((day + i) % 4 === 0);
        ex.replied_at = new Date(NOW + day*864e5 + (fast ? 4 : 95) * 60e3).toISOString();
        if((day + i) % 17 === 0){ st = 'rejected'; ex.cancel_kind = 'expired'; ex.replied_at = null; }
        else if((day + i) % 19 === 0){ st = 'rejected'; ex.cancel_reason = 'صيانة'; }
        else if((day + i) % 23 === 0){ st = 'cancelled'; }
        else if((day + i) % 29 === 0){ ex.no_show = true; }
        if((day + i) % 31 === 0){ ex.visibility = 'open'; ex.players_needed = 10; ex.players_brought = 4; }
      }
      push(day, hour, fx, st, ex);
    }
  }
  /* حجزٌ يبدأ بعد ثلاث ساعات — التاريخ والساعة من نفس اللحظة. */
  var soon = NOW + 3*36e5, sh = new Date(soon).getHours();
  var snap = HOURS.reduce(function(a,b){ return Math.abs(b-sh) < Math.abs(a-sh) ? b : a; }, HOURS[0]);
  push(new Date(soon).getDate() === new Date(NOW).getDate() ? 0 : 1, snap, 1, 'confirmed');
  /* وثلاثة معلّقة — شريط الفعل وترتيبُ المهلة لا يُرَيان بلا معلّق. */
  push(0, 20, 0, 'pending'); push(0, 22, 2, 'pending');
  push(1, 18, 3, 'pending', { visibility:'open', players_needed:10, players_brought:3 });

  var DEMAND = [];
  for(var d2=0; d2<6; d2++) DEMAND.push({ field_id:'f'+((d2%4)+1),
    watch_date: ymdOf(NOW + (d2+1)*864e5), hour: [20,22,18,20,22,18][d2], n: 1 + (d2%4) });

  var PLACE = [{ id:'p1', name:'مجمّع الاختبار', city:'عمّان', region:'صويلح', type:'عشب صناعي',
                 phone:'0790000000', active:true, map_link:'', amenity_water:'Free',
                 amenity_vests:'Available', amenity_ball:'Available', amenity_bathrooms:'Available',
                 amenity_parking:'Free' }];

  var ROUTES = [
    ['/rest/v1/place_slot_demand', DEMAND],
    ['/rest/v1/place_reply_speed', [{ place_id:'p1', median_minutes:12, n:41 }]],
    ['/rest/v1/place_stats',       [{ place_id:'p1', rating:4.4, reviews_count:11, reviews_dist:null }]],
    ['/rest/v1/bookings_full',     BK],
    ['/rest/v1/places',            PLACE],
    ['/rest/v1/fields',            FIELDS],
  ];
  var realFetch = window.fetch.bind(window);
  window.__hits = [];
  window.fetch = function(input, init){
    var url = String((input && input.url) || input || '');
    if(url.indexOf('/rest/v1/') < 0 && url.indexOf('/auth/v1/') < 0 && url.indexOf('/functions/v1/') < 0)
      return realFetch(input, init);
    var body = [];
    for(var i=0; i<ROUTES.length; i++) if(url.indexOf(ROUTES[i][0]) >= 0){ body = ROUTES[i][1]; break; }
    window.__hits.push(url.split('?')[0]);
    return Promise.resolve(new Response(JSON.stringify(body),
      { status:200, headers:{ 'Content-Type':'application/json' } }));
  };

  /* الانتقال إلى اللوحة بمسار التطبيق نفسه — ما يُفحَص هو المسار الحقيقي. */
  window.addEventListener('load', function(){
    setTimeout(function(){
      var b = document.querySelector('[data-go="owner"],[data-nav="owner"],[data-action="ownerLogin"]');
      if(b) b.click();
      window.__harnessKicked = !!b;
    }, 400);
  });
})();
</script>
`;

const TRAP = '<script>window.__errs=[];window.addEventListener("error",function(e){'
           + 'window.__errs.push(String(e.message)+" @"+e.lineno);});<\/script>\n';

const html = fs.readFileSync(SRC, 'utf8');
/* سكربت التطبيق هو **أوّل** `<script>` بلا سمات بعد الوسم `<body>` — وأمارته
   تعليقُ الرأس «المستديرة · app.js». والبحث عنه بالنصّ لا بالترتيب: ترتيبُ
   السكربتات يتغيّر، والتعليق هو الذي يسمّي الملفّ. */
const at = html.indexOf('   المستديرة · app.js');
if (at < 0) { console.error('  x لم يُعثَر على سكربت التطبيق في المعاينة.'); process.exit(1); }
const tag = html.lastIndexOf('<script>', at);
if (tag < 0) { console.error('  x لم يُعثَر على وسم السكربت.'); process.exit(1); }
fs.writeFileSync(OUT, html.slice(0, tag) + TRAP + INJECT + html.slice(tag), 'utf8');
console.log('  ok ' + path.relative(ROOT, OUT) + '  (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
console.log('     افتحه على منفذ المعاينة، ثمّ احذفه:  node tools/owner-harness.mjs --rm');
