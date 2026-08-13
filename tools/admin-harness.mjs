#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   admin-harness — شبكة مموَّهة تفتح `/admin` بلا قاعدة ولا كلمة سرّ

   لماذا؟ اللوحة **خلف تسجيل دخول**، وكل ما فيها يُرسَم من ردود PostgREST.
   فقراءةُ الكود لا تُري تخطيطًا، و`javascript_tool` معزول عن نطاق الصفحة،
   ولا يمكن الدخول بحساب حقيقي. والطريقة المسجَّلة في `CLAUDE.md` هي هذه:
   **نسخةٌ من المخرَج المبنيّ يُحقَن فيها سكربتٌ يستبدل `fetch`/`WebSocket`
   ويزرع جلسةً وهمية** ⇒ كل لوح يُرى فعلًا وكل مسار خطأ يُجرَّب. وبها انكشفت
   في الدفعة ١١ ثلاثة أعطال ما كانت القراءة لتكشفها.

   الاستعمال:  node tools/admin-harness.mjs        ⇒ public/_admin_test.html
               node tools/admin-harness.mjs --rm   ⇒ حذفها

   ⚠️ **وتُحذَف بعد الفحص دائمًا**: `public/` مخرَجٌ متتبَّع في git، وصفحةٌ
      تحمل بيانات وهمية وتتخطّى تسجيل الدخول لا تُشحَن إلى الإنتاج.
      ولا خطر تسريب: البيانات هنا **مولَّدة**، ولا سطر منها من قاعدة حقيقية.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const SRC = path.join(ROOT, 'public', 'admin', 'index.html');
const OUT = path.join(ROOT, 'public', '_admin_test.html');

if (process.argv.includes('--rm')){
  if (existsSync(OUT)){ unlinkSync(OUT); console.log('  حُذفت public/_admin_test.html'); }
  else console.log('  لا شيء ليُحذَف');
  process.exit(0);
}
if (!existsSync(SRC)) { console.error('  ابنِ الموقع أولًا: build.ps1'); process.exit(1); }

/* السكربت المحقون — يعمل في <head> قبل سكربت الصفحة، فيسبق كل نداء */
const STUB = `<script>/* ⚠️ شبكة اختبار — تُحذف بعد الفحص */(function(){
var PLACES=['ملاعب اكسفورد','ملاعب القوات المسلحة','ملعب المنهل','ملعب ميار','ملعب الخطوة الأولى','ملعب كلية المجتمع','ملعبي'];
var CITY='عمان', REG=['المدينة الرياضية','طبربور','عرجان','ضاحية الرشيد','شارع الجامعة','تلاع العلي','صويلح'];
var pid=function(i){return '0000000'+i+'-0000-4000-8000-000000000000';};
function iso(d){return new Date(d).toISOString();}
function day(off){var d=new Date();d.setDate(d.getDate()+off);return d.toISOString().slice(0,10);}

/* أماكن وملاعب */
var places=PLACES.map(function(n,i){return {id:pid(i),name:n,city:CITY,region:REG[i],type:'عشب صناعي',phone:'07900000'+i,active:i!==6};});
var fields=[];PLACES.forEach(function(n,i){var k=(i%2)+1;for(var j=0;j<k;j++)fields.push(
  {id:pid(i)+'-f'+j,place_id:pid(i),name:'ملعب '+(j+1),size:'7x7',price:40,active:true,image_url:'',
   slots:[{h:8,label:'8:00 - 10:00 ص'},{h:10,label:'10:00 ص - 12:00 م'},{h:16,label:'4:00 - 6:00 م'},
          {h:18,label:'6:00 - 8:00 م'},{h:20,label:'8:00 - 10:00 م'},{h:22,label:'10:00 - 12:00 م'}],
   sport:'football',attrs:{},gender:null});});

/* حجوزات: مزيج حالات وأسماء وأرقام — كي تمتلئ «العملاء» و«التشغيل» و«المال» */
var NAMES=['أحمد العلي','محمد حسن','ليث درويش','عمر الزعبي','سامر خالد','يزن أبو ندى','رامي فاخوري','خالد المومني'];
var ST=['confirmed','confirmed','confirmed','pending','cancelled','rejected'];
var bookings=[];
for(var i=0;i<180;i++){
  var f=fields[i%fields.length], st=ST[i%ST.length], off=-(i%60), nm=NAMES[i%NAMES.length];
  bookings.push({id:'b'+i,created_at:iso(Date.now()-(i%60)*864e5-36e5),booking_date:day(off),
    hour:[8,10,16,18,20,22][i%6],time_label:'8:00 - 10:00 م',place_id:f.place_id,field_id:f.id,
    customer_name:nm,customer_phone:'07' + (90000000+(i%NAMES.length)),player_id:'p'+(i%NAMES.length),
    price:40,status:st,source:i%9?'app':'manual',cancel_reason:st==='cancelled'?'ظرف طارئ':'',
    cancel_kind:st==='rejected'&&i%2?'expired':'',no_show:st==='confirmed'&&i%17===0});
}
/* طلبات معلّقة فات وقتها + قادمة بلا ردّ — كي تمتلئ لافتتا «التشغيل» */
for(var q=0;q<4;q++) bookings.push({id:'bp'+q,created_at:iso(Date.now()-40*36e5),booking_date:day(q?2:-1),
  hour:20,time_label:'8:00 - 10:00 م',place_id:pid(q%3),field_id:fields[q].id,customer_name:NAMES[q],
  customer_phone:'0790000' + (100+q),player_id:'p'+q,price:45,status:'pending',source:'app',
  cancel_reason:'',cancel_kind:'',no_show:false});

/* العروض المجمَّعة — تُشتقّ من نفس الحجوزات فلا تتناقض الجداول */
var byPlace={};bookings.forEach(function(b){var k=b.place_id;(byPlace[k]=byPlace[k]||{b:0,c:0,r:0});
  byPlace[k].b++;if(b.status==='confirmed'){byPlace[k].c++;byPlace[k].r+=b.price;}});
var adminPlaces=places.map(function(p,i){var s=byPlace[p.id]||{b:0,c:0,r:0};
  return {id:p.id,name:p.name,city:p.city,region:p.region,active:p.active,bookings:s.b,confirmed:s.c,
          revenue:s.r,rating:i===6?null:(3.8+(i%3)*0.4),reviews_count:i===6?0:(i+2)};});
var byDay={};bookings.forEach(function(b){var d=b.booking_date;(byDay[d]=byDay[d]||{bookings:0,confirmed:0,lost:0,revenue:0});
  byDay[d].bookings++;if(b.status==='confirmed'){byDay[d].confirmed++;byDay[d].revenue+=b.price;}
  else if(b.status==='cancelled'||b.status==='rejected')byDay[d].lost++;});
/* ⚠️ اسم العمود **booking_date** لا d — قرأته من renderDaily/renderMonths لا من الحدس.
   وبالاسم الخطأ خرجت خليّة تاريخٍ فارغة و«undefined قادم»، فبدت اللوحة معطوبةً
   وهي سليمة: **شبكةٌ لا تطابق المخطّط تصنع أعطالًا وهمية تُهدر عليها دفعة.** */
var daily=Object.keys(byDay).sort().map(function(d){var x=byDay[d];
  return {booking_date:d,bookings:x.bookings,confirmed:x.confirmed,lost:x.lost,
          revenue:x.revenue,commission:x.revenue*0.10};});

var apps=[0,1,2].map(function(i){return {id:'a'+i,created_at:iso(Date.now()-i*864e5),contact_name:NAMES[i],
  phone:'0791111'+i,venue_name:'ملعب مقترح '+(i+1),city:CITY,region:REG[i],sport:'football',courts:i+1,
  notes:'ملعب جديد في المنطقة',status:i?'pending':'pending',review_note:'',place_id:null};});
var audit=[0,1,2,3,4].map(function(i){return {id:'l'+i,at:iso(Date.now()-i*36e5),actor_role:i%2?'owner':'admin',
  action:['confirm','reject','create','update','cancel'][i],entity:'booking',entity_id:'b'+i};});

var MAP=[[/\\/rest\\/v1\\/admin_daily/,daily],[/\\/rest\\/v1\\/admin_places/,adminPlaces],
  [/\\/rest\\/v1\\/bookings/,bookings],[/\\/rest\\/v1\\/fields/,fields],[/\\/rest\\/v1\\/places/,places],
  [/\\/rest\\/v1\\/reviews/,places.map(function(p){return {place_id:p.id};})],
  [/\\/rest\\/v1\\/place_applications/,apps],[/\\/rest\\/v1\\/audit_log/,audit],
  [/\\/rest\\/v1\\/admin_funnel/,[]],[/\\/rest\\/v1\\/admin_empty_searches/,[]],
  [/\\/rest\\/v1\\/admin_slot_demand/,[]],[/\\/rest\\/v1\\/place_owners/,[]],[/\\/rest\\/v1\\/profiles/,[]]];

window.fetch=function(url){
  var u=String(url);
  var hit=MAP.find(function(m){return m[0].test(u);});
  var body=hit?hit[1]:[];
  if(/\\/auth\\/v1\\//.test(u)) body={access_token:'x',refresh_token:'y',expires_in:3600};
  if(/\\/rpc\\//.test(u)) body={};
  return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
};
window.WebSocket=function(){this.readyState=0;this.close=function(){};this.send=function(){};
  setTimeout(function(){}.bind(this),0);};

/* جلسة أدمن وهمية: JWT صالح الشكل بانتهاء بعيد — jwtExp تقرؤه ولا تجدّد */
var payload=btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+7200,role:'authenticated'}));
try{sessionStorage.setItem('mustadaira:admin',JSON.stringify(
  {at:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.sig',rt:'r',name:'مالك (اختبار)',phone:'0790000000',uid:'u1'}));}catch(e){}
})();</script>`;

let html = readFileSync(SRC, 'utf8');
const at = html.indexOf('<head>') + '<head>'.length;
html = html.slice(0, at) + '\n' + STUB + '\n' + html.slice(at);
writeFileSync(OUT, html);
console.log('  ✓ public/_admin_test.html — افتحه على منفذ الموقع، ثمّ:  node tools/admin-harness.mjs --rm');
