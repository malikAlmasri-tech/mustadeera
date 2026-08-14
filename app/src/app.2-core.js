/* ===================== DOM UTILS ===================== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/* h(): مُنشئ عناصر آمن. النصوص دائماً textContent ⇒ لا XSS.
   props.html محجوز فقط لسلاسل SVG الثابتة (ICON.*). */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;                 // SVG ثابت فقط
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  appendKids(e, kids);
  return e;
}
function appendKids(e, kids){
  for (const c of kids.flat(3)) {
    if (c == null || c === false || c === '') continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
const ico = (name, cls='svg-sm') => h('span', { class:cls, html:ICON[name], 'aria-hidden':'true', style:{display:'inline-flex'} });
const clear = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); };
const setText = (id, val) => { const el = $('#'+id); if (el) el.textContent = val; };

/* تحية الهوم الأصلية: سطر زمني (صباح/مساء الخير) + اسم مفرد (بدل «أهلاً [الاسم]») */
function updatePlayerGreeting(){
  const h = new Date().getHours();
  const gk = h < 12 ? 'greetMorning' : (h < 18 ? 'greetAfternoon' : 'greetEvening');
  const eb = $('#greetEyebrow');
  if(eb){ eb.textContent = t(gk); eb.setAttribute('data-i18n', gk); }
  const name = Session.player() ? (State.player?.name || t('welcomeYou')) : t('welcomeGuest');
  setText('playerWelcome', name);
}

/* ===================== UTILS ===================== */
function debounce(fn, wait){
  let tm; return function(...a){ clearTimeout(tm); tm = setTimeout(() => fn.apply(this, a), wait); };
}
/* تاريخ محلي YYYY-MM-DD — بديل toISOString (التي ترجع UTC فتُزيح اليوم بين منتصف الليل و3 فجراً بتوقيت الأردن) */
function ymd(d = new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const today = () => ymd();
const dateAfter = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
/* اسم اليوم حسب اللغة (Intl). يبقى الاسم arabicDay للتوافق مع الاستدعاءات. */
const arabicDay = (s) => { try{ return new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar', {weekday:'long'}).format(new Date(s+"T12:00:00")); }catch(_){ return ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"][new Date(s+"T12:00:00").getDay()]; } };
const dayLabel = (s) => { const d=String(s).split('T')[0]; if(d===today()) return t('today'); if(d===dateAfter(1)) return t('tomorrow'); return arabicDay(d); };
const shortDate = (s) => { const d = new Date(s+"T12:00:00"); return `${d.getDate()}/${d.getMonth()+1}`; };
/* تنسيق العملة الموحّد حسب اللغة: د.أ (عربي) / JOD (إنجليزي) */
const formatCurrency = (v) => { const n = (typeof v==='number'&&!Number.isNaN(v)) ? v : parsePrice(v); const a = Math.round(n*100)/100; return (State.lang==='en') ? `${a} JOD` : `${a} د.أ`; };
const formatMoney = formatCurrency;   // توافق مع الاستدعاءات الحالية
const calcPercent = (part, total) => total ? Math.round((part/total)*100) : 0;
/* توحيد الرقم الأردني إلى صيغة واحدة: `9627XXXXXXXX`.
   ⚠️ والفرع الأخير (`7…` بلا صفر) هو الذي كان ناقصًا، وثمنه **حسابان لشخص
   واحد**: من يكتب `790123456` — وهي صيغة شائعة جدًّا — كان يمرّ بلا لمسة،
   فيُشتقّ له بريدٌ داخلي مستقلّ تمامًا عن `962790123456@…`. حسابان، وحجوزات
   منقسمة، و«العميل = رقم هاتف» في تقارير `/admin` تعدّه شخصين.
   والترتيب مقصود: `07…` تُفحَص قبله، وإلّا لَما وصلها شيء أصلًا. */
function normalizePhone(p){ p = String(p||'').trim().replace(/\s+/g,''); if(p.startsWith('+'))p=p.slice(1); if(p.startsWith('00962'))p='962'+p.slice(5); if(p.startsWith('07'))p='962'+p.slice(1); if(/^7[789]\d{7}$/.test(p))p='962'+p; return p; }
function normalizeText(v){ return String(v||'').trim().toLowerCase().replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'').replace(/\s+/g,''); }
/* تطبيع حجم الملعب للمقارنة: 6×6 و 6x6 و "6 X 6" كلها قيمة واحدة */
const normSize = (v) => String(v||'').trim().toLowerCase().replace(/[×X]/g,'x').replace(/\s+/g,'');
/* صور الملعب: خلية image_url في شيت Fields تقبل عدة روابط مفصولة بفواصل أو أسطر
   (الرابط الأول = الصورة الرئيسية). تُقبل روابط http(s) فقط. */
function fieldImages(f){ return [...new Set(String((f&&f.image_url)||'').split(/[,\n|]+/).map(s=>s.trim()).filter(s=>isHttpUrl(s)))]; }
/* الشرط الوحيد لأي رابط يصل الـDOM من القاعدة. و`href` ليس أهون من `src`:
   نحن داخل WebView كابستور ومعه جسرٌ أصلي، فـ`javascript:` في `map_link`
   يُنفَّذ في سياق التطبيق نفسه. والفحص **بالمخطَّط لا بالبحث عن كلمة**:
   `\tjava\nscript:` و`JaVaScRiPt:` و`%6a%61...` كلّها تمرّ من أي قائمة سوداء،
   ولا تمرّ من قائمة بيضاء تقول «إمّا http أو https وإلّا فلا». */
function isHttpUrl(u){ return /^https?:\/\//i.test(String(u||'').trim()); }
const getSource = () => new URLSearchParams(location.search).get('source') || 'direct';

/* ===================== FAVORITES (محلي فقط — localStorage، بلا باكند) ===================== */
const FAV_KEY = 'mustadaira:favorites';
function favGet(){ try{ const a=JSON.parse(localStorage.getItem(FAV_KEY)||'[]'); return new Set(Array.isArray(a)?a.map(String):[]); }catch(_){ return new Set(); } }
function favHas(id){ return favGet().has(String(id)); }
function favToggle(id){ const s=favGet(); const k=String(id); if(s.has(k)) s.delete(k); else s.add(k); try{ localStorage.setItem(FAV_KEY, JSON.stringify([...s])); }catch(_){} return s.has(k); }

/* أحرف الاسم لأفاتار الأحرف (كلمتان كحدّ أقصى) — يعمل بالعربي والإنجليزي، وبديله '؟' */
function initials(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2);
  return parts.length ? parts.map(w=>[...w][0]).join('') : '؟';
}
function safeRating(v){ const n = Number(v); return (Number.isNaN(n)||n<0||n>5) ? 0 : Math.round(n*10)/10; }
function safeReviews(v){ const n = Number(v); return (Number.isNaN(n)||n<0||n>1e5) ? 0 : Math.round(n); }
// مكان بلا تقييم حقيقي واحد لا تُرسم له شارة نجمة أصلًا — «★ 0 (0)» تُقرأ كتقييم سيّئ لا كغياب تقييم.
function hasRating(place){ return safeReviews(place?.reviews) > 0; }
/* المتوسّط وحده بلا عدد بين قوسين — حيث يُكتب العدد معدودًا صحيحًا بجانبه */
function ratingAvgText(place){
  const r = Number(String(place?.rating??0).replace(',','.'));
  return (Number.isFinite(r)&&r>0&&r<=5) ? String(Math.round(r*10)/10).replace('.0','') : '0';
}
/* «١٢ تقييمًا» لا «12 تقييم» — رقمٌ حيّ يسبق اسمًا ⇒ يمرّ بقاعدة المعدود */
const nReviews = (n) => (State.lang==='en')
  ? (n===1 ? '1 review' : `${n} reviews`)
  : countNoun(n, 'تقييم واحد', 'تقييمان', 'تقييمات', 'تقييمًا');
function ratingText(place){
  const r = Number(String(place?.rating??0).replace(',','.')); const c = Number(String(place?.reviews??0).replace(',','.'));
  const rating = (Number.isFinite(r)&&r>0&&r<=5) ? String(Math.round(r*10)/10).replace('.0','') : '0';
  const reviews = (Number.isFinite(c)&&c>=0) ? Math.round(c) : 0;
  return `${rating} (${reviews})`;
}
function normalizeSlotsKeyword(kw){ kw=String(kw||'').trim().toLowerCase();
  if(kw==='full')return "8=8:00 - 10:00 ص|10=10:00 ص - 12:00 م|12=12:00 - 2:00 م|14=2:00 - 4:00 م|16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  if(kw==='morning')return "8=8:00 - 10:00 ص|10=10:00 ص - 12:00 م|12=12:00 - 2:00 م";
  if(kw==='evening')return "16=4:00 - 6:00 م|18=6:00 - 8:00 م|20=8:00 - 10:00 م|22=10:00 - 12:00 م";
  return kw; }
/* 🔴 كانت تقرأ الملعب المسائي «كامل اليوم» — والعطل يكتب لا يعرض فقط.
   الشرط القديم `s.includes('22=10:00')` يصدق على المسائي كذلك (فيه الساعة 22)،
   وهو مفحوصٌ **أوّلًا** ⇒ كل ملعب مسائي يُقرأ `full`. وأثره في موضعين:
   نافذة «تعديل ملعب» تُظهر «Full — كل اليوم»، و**زرّ إظهار/إخفاء الملعب**
   (‏`ownerUpdateField`) يعيد إرسال `slots: slotsToKeyword(f.slots)` ⇒ ضغطةٌ
   واحدة تمنح الملعبَ المسائيَّ خمسَ خاناتٍ صباحية لم يعرضها صاحبه قطّ.
   والآن الحسم **بمجموعة الساعات** لا بمطابقة نصّية: المجموعة هي التي تعرّف
   الكلمة، والنصّ مجرّد تمثيل لها. (كشفه `tools/test-pure.mjs`، لا القراءة.) */
function slotsToKeyword(s){
  s=String(s||'').trim().toLowerCase();
  if(s==='full'||s==='morning'||s==='evening') return s;
  const hours=new Set(parseSlots(s).map(x=>Number(x.hour)));
  const has=(...hs)=>hs.every(h=>hours.has(h));
  const lacks=(...hs)=>hs.every(h=>!hours.has(h));
  if(has(8,10,12) && lacks(16,18,20,22)) return 'morning';
  if(has(16,18,20,22) && lacks(8,10,12)) return 'evening';
  return 'full';
}
function parseSlots(text){ const clean=normalizeSlotsKeyword(text); if(!clean||!clean.includes('='))return DEFAULT_SLOTS;
  const arr=clean.split('|').map(s=>{const[h,...l]=s.split('=');return{hour:Number(h),label:l.join('=').trim()};}).filter(s=>!Number.isNaN(s.hour)&&s.label);
  return arr.length?arr:DEFAULT_SLOTS; }
const fieldSlots = (f) => parseSlots(f?.slots);

/* قراءة موحّدة لحالة الحجز (تتسامح مع الحالة الفارغة أو بحروف كبيرة من الخادم) */
function normStatus(b){ return String((b && b.status) || 'pending').toLowerCase(); }
const isFinished = (b) => { const h=Number(b.hour); if(!b.date||Number.isNaN(h))return false; const s=new Date(`${b.date}T${String(h).padStart(2,'0')}:00:00`); const e=new Date(s); e.setHours(e.getHours()+2); return new Date()>=e; };
const isOld = (s, keep=14) => { const base=new Date(today()+"T00:00:00"); const d=new Date(String(s||'').split('T')[0]+"T00:00:00"); if(Number.isNaN(d.getTime()))return false; return Math.floor((base-d)/864e5)>keep; };
function splitFinished(list){ const a=[],f=[]; (list||[]).forEach(b=>(isFinished(b)?f:a).push(b)); return {active:a,finished:f}; }
const visibleBookings = (list, keep, all) => all ? list : (list||[]).filter(b=>!isOld(b.date,keep));
function runtimeStatus(b){ const s=normStatus(b); if(s!=='confirmed')return s; const h=Number(b.hour); if(Number.isNaN(h)||!b.date)return s; const st=new Date(`${b.date}T${String(h).padStart(2,'0')}:00:00`); const e=new Date(st); e.setHours(e.getHours()+2); const now=new Date(); return (now>=st&&now<e)?'in_progress':s; }
function statusLabel(s){ const m={confirmed:{t:t('statusConfirmed'),c:'badge-green'},pending:{t:t('statusPending'),c:'badge-yellow'},cancelled:{t:t('statusCancelled'),c:'badge-red'},rejected:{t:t('statusRejected'),c:'badge-red'},in_progress:{t:t('statusInProgress'),c:'badge-blue'}}; return m[String(s||'pending').toLowerCase()]||m.pending; }
const isOwnerManual = (b) => String(b.source||'').trim().toLowerCase()==='owner_manual';
const isWebsite = (b) => !isOwnerManual(b);

/* ═══ (١١) ساعة الخانة — مهلة الإلغاء · مهلة الردّ · لم يحضر ═══════════════
   كل ما تحت يعمل على وقت **الجهاز** لأن الجهاز في الأردن والخانة كذلك؛
   والقاعدة تحسب نفس المقارنة بتوقيت عمّان صراحةً (`amman_now()` في
   الترحيل 15). الواجهة تُخفي ما سيُرفض؛ **الحكم للقاعدة** لا لها. */
const slotStartMs = (b) => { const hr=Number(b&&b.hour); const d=String((b&&b.date)||'').split('T')[0];
  if(!d || Number.isNaN(hr)) return NaN;
  const ts = new Date(`${d}T${String(hr).padStart(2,'0')}:00:00`).getTime();
  return Number.isNaN(ts) ? NaN : ts; };
const cancelDeadlineMs = (b) => { const s=slotStartMs(b); return Number.isNaN(s) ? NaN : s - CONFIG.CANCEL_WINDOW_H*3600e3; };
/* شرط الإلغاء بلا الزمن (حالة الحجز وحدها) — يفصله عن الزمن كي تعرف الواجهة
   الفرقَ بين «لا يُلغى لأنه ملغى أصلًا» (لا نعرض شيئًا) و«لا يُلغى لأن الوقت
   قرب» (نعرض سبباً ورقم الملعب). دمجُهما كان سيُخفي السبب في الحالتين. */
function cancellableByStatus(b){
  const s=normStatus(b);
  return !isFinished(b) && s!=='cancelled' && s!=='rejected' && runtimeStatus(b)!=='in_progress';
}
const withinCancelWindow = (b) => { const dl=cancelDeadlineMs(b); return Number.isNaN(dl) ? true : Date.now() < dl; };
/* «انقضت المهلة» ليست «رفض المالك» — والقيمة الآلية من الترحيل 15 هي الفارق.
   قبل تشغيله لا وجود للعمود ⇒ `undefined` ⇒ false، فيُقرأ كل مرفوض رفضًا
   كما كان بالضبط. */
const isExpiredBooking = (b) => normStatus(b)==='rejected' && String(b&&b.cancel_kind||'')==='expired';
const isNoShow = (b) => !!(b && b.no_show);

/* المعدود العربي يتغيّر مع العدد (١ · ٢ · ٣-١٠ جمع · ١١+ مفرد منصوب).
   مرآةُ `countNoun` في `site/admin.html` — نفس القاعدة في الوجهين. */
function countNoun(n, one, two, few, many){
  if(n===1) return one;
  if(n===2) return two;
  // الصفر يأخذ الجمع لا المفرد المنصوب: «0 ملاعب» لا «0 ملعبًا».
  if(n===0 || (n>=3 && n<=10)) return n+' '+few;
  return n+' '+many;
}
/* «٦ ساعات» بالعربية و«6 hours» بالإنجليزية — يُستعمل حيثما ذُكرت المهلة،
   وهي قيمة قابلة للتغيير من CONFIG ⇒ رقمٌ حيّ يسبق معدودًا. */
const nHours = (n) => (State.lang==='en')
  ? (n===1 ? '1 hour' : `${n} hours`)
  : countNoun(n, 'ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة');
/* «٤ أوقات فاضية اليوم» — رقمٌ حيّ يسبق معدودًا فيلزمه `countNoun`، وإلّا
   خرجت «1 أوقات» و«11 أوقات». يُستعمل على بطاقة المكان. */
const nFreeToday = (n) => (State.lang==='en')
  ? (n===1 ? '1 slot free today' : `${n} slots free today`)
  : countNoun(n, 'وقت واحد فاضي اليوم', 'وقتان فاضيان اليوم',
                 'أوقات فاضية اليوم', 'وقتًا فاضيًا اليوم');
/* مدّة الردّ المعتادة نصًّا: «١٥ دقيقة» · «ساعتان» · «١٫٥ ساعة».
   ⚠️ **اللغة وسيطٌ لا `State`**: دالّة نقيّة تُختبَر معزولةً في
      `tools/test-pure.mjs` — ونسخةٌ ثانية في ملفّ اختبار كانت ستنحرف.
   ⚠️ والحدّ الأدنى دقيقة واحدة لا صفر: الوسيط مُقرَّب في القاعدة إلى أقرب
      دقيقة، والجملة «يردّ خلال دقيقة» صادقة عند كل قيمة دون الدقيقة —
      بينما «خلال 0 دقيقة» جملةٌ لا معنى لها.
   ⚠️ وما ليس رقمًا موجبًا يعود **نصًّا فارغًا** فلا يُعرَض سطر أصلًا (م5). */
function replySpeedText(minutes, lang){
  // ⚠️ `Number(null)` صفرٌ صالح — والغياب لا يجوز أن يُقرأ «يردّ خلال دقيقة»
  if(minutes === null || minutes === undefined || minutes === '') return '';
  const m = Number(minutes);
  if(!Number.isFinite(m) || m < 0) return '';
  const en = lang === 'en';
  if(m < 60){
    const n = Math.max(1, Math.round(m));
    return en ? (n===1 ? '1 minute' : `${n} minutes`)
              : countNoun(n, 'دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة');
  }
  const hrs = Math.round(m/6)/10;                    // منزلة عشرية واحدة
  if(Number.isInteger(hrs)) return en ? (hrs===1 ? '1 hour' : `${hrs} hours`)
                                      : countNoun(hrs, 'ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة');
  // كسرٌ عشري: العربية تُفرد المعدود بعده («١٫٥ ساعة») ولا تُجمعه
  return en ? `${hrs} hours` : `${hrs} ساعة`;
}
/* «مقعد» معدودٌ حيّ يسبق اسمًا ⇒ يمرّ بنفس القاعدة. والصفر له صيغته:
   «٠ مقاعد» عربيّةٌ صحيحة، و«لا مقاعد» أوضح. */
const nSeats = (n) => (State.lang==='en')
  ? (n===0 ? 'no seats' : n===1 ? '1 seat' : `${n} seats`)
  : (n===0 ? 'لا مقاعد' : countNoun(n, 'مقعد واحد', 'مقعدان', 'مقاعد', 'مقعدًا'));
/* «مكانان» — لمالكٍ له أكثر من مكان (أ-٢). نفس نمط `nSeats` بالحرف. */
const nPlaces = (n) => (State.lang==='en')
  ? (n===1 ? '1 venue' : `${n} venues`)
  : countNoun(n, 'مكان واحد', 'مكانان', 'أماكن', 'مكانًا');
/* فرقٌ زمني بصيغة نسبية — Intl يتكفّل بالمعدود في اللغتين.
   ⚠️ الوحدة تُختار بالحجم لا بالثابت: «خلال ١٤٠ دقيقة» تُقرأ أسوأ من «خلال ساعتين». */
function relFromNow(ms){
  const s = Math.round(ms/1000);
  const [v,u] = Math.abs(s) < 3600 ? [Math.round(s/60),'minute']
              : Math.abs(s) < 86400 ? [Math.round(s/3600),'hour']
              : [Math.round(s/86400),'day'];
  try{ return new Intl.RelativeTimeFormat(State.lang==='en'?'en':'ar', {numeric:'auto'}).format(v, u); }
  catch(_){ return String(v); }
}
function getTopBy(items, keyFn, labelFn){ const m={}; items.forEach(it=>{const k=keyFn(it)||'-'; if(!m[k])m[k]={count:0,label:labelFn?labelFn(it):k}; m[k].count++;}); return Object.values(m).sort((a,b)=>b.count-a.count)[0]||null; }

/* استخراج كل الأرقام السعرية من أي صيغة: رقم، «40 د.أ»، «40-60» (مدى بحقل واحد)،
   أرقام عربية «٤٠». يمنع NaN/Infinity من إفساد بطاقة السعر ويكشف المدى الحقيقي. */
const priceNumbers = (v) => {
  if (v == null) return [];
  const s = String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  return (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(x => x > 0);
};
const parsePrice = (v) => { const a = priceNumbers(v); return a.length ? a[0] : 0; };
const fieldPrices = (p) => (p.fields||[]).flatMap(f => priceNumbers(f.price));
const minPrice = (p) => { const a=fieldPrices(p); return a.length?Math.min(...a):0; };
const maxPrice = (p) => { const a=fieldPrices(p); return a.length?Math.max(...a):0; };
/* ⚠️ صار يأخذ **الملعب** لا معرّفه وعددَ خاناته: المقارنة لم تعد بعدد الخانات
   كلّها بل بعدد **المفتوحة** منها في ذلك اليوم (ترحيل 17). يومٌ مغلق كان
   يُقرأ «فيه ٨ خانات ولا حجز ⇒ متاح» وهو مقفل. */
function isFieldAvailable(field){
  const fb=State.bookedSlots[field.field_id]||{};
  for(let i=0;i<7;i++){ const d=dateAfter(i);
    const open=openSlotsFor(field, d); if(!open.length) continue;
    const taken=fb[d]||[];
    if(open.some(s=>!taken.includes(s.hour))) return true;
  }
  return false;
}
const isPlaceAvailable = (p) => p.fields.some(f=>isFieldAvailable(f));
const placeLocation = (p) => { const c=String(p?.city||'').trim(), r=String(p?.region||'').trim(); return (c&&r)?`${c} - ${r}`:(c||r||''); };

/* ===================== SESSION (إدارة الجلسات) ===================== */
/* توافق كامل مع النسخة الأصلية المنشورة: التوكنات تُخزَّن بالمفاتيح القديمة
   player_token / owner_token كنص مباشر بلا TTL (حتى لا يُسجَّل خروج المستخدمين
   الحاليين). الثيم/اللغة فقط تحت namespace. لا تغيير لأي شيء في الخادم. */
/* «تذكّرني»: مؤشّر ⇒ التوكن في localStorage (يبقى بعد إغلاق المتصفّح)،
   غير مؤشّر ⇒ في sessionStorage (ينتهي بإغلاق المتصفّح فلا دخول تلقائي دائم).
   القراءة تبدأ من localStorage ⇒ المستخدمون الحاليون يبقون داخلين بلا خروج قسري. */
const Session = (() => {
  const getRaw = (k) => { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch(_){ return ''; } };
  const setRaw = (k,v,remember) => { try {
    localStorage.removeItem(k); sessionStorage.removeItem(k);
    if(v) (remember ? localStorage : sessionStorage).setItem(k,v);
  } catch(_){} };
  const del = (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch(_){} };
  return {
    player:  () => getRaw('player_token'),
    owner:   () => getRaw('owner_token'),
    setPlayer: (t,remember) => { setRaw('player_token', t, remember); del('owner_token'); },   // دخول لاعب ⇒ احذف توكن المالك
    setOwner:  (t,remember) => { setRaw('owner_token', t, remember); del('player_token'); },   // دخول مالك ⇒ احذف توكن اللاعب
    clear:   () => { del('player_token'); del('owner_token'); },
    theme:   () => { try { const v = localStorage.getItem('mustadaira:theme'); if(v==='light'||v==='dark') return v; return (window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches) ? 'dark' : 'light'; } catch(_){ return 'light'; } },
    setTheme:t => { try { localStorage.setItem('mustadaira:theme', t); } catch(_){} },
  };
})();

/* ===================== API (Timeout + AbortController) ===================== */
const requestControllers = {};   // { key: AbortController } — لإلغاء الطلب القديم من نفس النوع
const isAbort = (e) => !!e && (e.name==='AbortError');
const isTimeout = (e) => !!e && (e.name==='TimeoutError');
/* طلب مع مهلة وإلغاء: إن مُرّر key يُلغى الطلب السابق من نفسه (آخر نتيجة تفوز) */
async function fetchWithTimeout(url, options={}, timeoutMs=CONFIG.API_TIMEOUT, key){
  if(key){ const prev=requestControllers[key]; if(prev){ try{ prev.abort(); }catch(_){} } }
  const ctrl = new AbortController();
  if(key) requestControllers[key]=ctrl;
  const timer = setTimeout(()=>{ try{ ctrl.abort(new DOMException('timeout','TimeoutError')); }catch(_){ ctrl.abort(); } }, timeoutMs);
  try{
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    if(key && requestControllers[key]===ctrl) requestControllers[key]=null;
  }
}
/* رسالة خطأ موحّدة: تتجاهل الإلغاء المقصود، وتميّز انتهاء المهلة */
function handleApiError(e, fallbackKey){
  if(isAbort(e)) return;                                  // إلغاء مقصود — بلا رسالة
  if(isTimeout(e)){ toast(t('apiTimeout'),'error'); return; }
  toast(t(fallbackKey||'apiError'),'error');
}
/* ═══════════════════════════════════════════════════════════════════════════
   طبقة البيانات — Supabase (Postgres) بدل Google Apps Script.

   ⚑ **العقد محفوظ حرفيًّا:** كل عملية تُعيد نفس شكل الاستجابة الذي كان يُعيده
     الباكند القديم (`{success,message,...}` وأسماء الحقول ذاتها)، فلم يتغيّر
     أيّ من الـ19 موضع استدعاء في هذا الملفّ. السبب: تغيير الشكل كان سيفرض
     تعديل الواجهة كلّها، وكل تعديل إضافي = سطح خطأ إضافي في تحويل حسّاس أصلًا.

   ⚑ **الجلسة:** التوكن لم يعد `base64(id|phone)` القابل للقراءة والذي لا ينتهي،
     بل JSON يحمل جلسة Supabase (access/refresh) وينتهي ويُجدَّد. يُخزَّن بنفس
     مفاتيح localStorage القديمة ويمرّ عبر نفس `Session`، فالواجهة تعامله
     كنصّ معتم كما كانت — ولذلك لم تتغيّر وحدة `Session` إطلاقًا.

   ⚑ **المعرّفات:** صارت uuid بدل أرقام. لا يهمّ: كل المقارنات في الواجهة
     نصّية (`String(x)===String(y)`) ومفاتيح `bookedSlots` نصّية أيضًا.
   ═══════════════════════════════════════════════════════════════════════════ */
const SB = {
  URL: 'https://nxqddfuwtrsabprxcfez.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cWRkZnV3dHJzYWJwcnhjZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNDkwNDcsImV4cCI6MjEwMDYyNTA0N30.SOL5yoyeDZpJOEneH9rgqGc5P6HswMw5fR9d76Uh0wA',
  MAIL: '@mustadeera.app',   // بريد مشتقّ من الرقم: مصادقة الهاتف بـOTP تتطلّب مزوّد SMS مدفوعًا
};

/* توحيد الرقم — نفس منطق normalizePhone في الباكند القديم حرفيًّا */
/* ⚠️ كانت نسخةً ثانية من `normalizePhone` بنفس الأسطر الأربعة — ونسختان من
   قاعدةٍ واحدة تنحرفان: هذه هي التي يُشتقّ منها **بريد الدخول** ويُكتب بها
   `customer_phone`، أي أنها تعريف الهويّة نفسه. فحين أُضيف فرعُ «رقمٌ يبدأ بـ7
   بلا صفر» إلى تلك وحدها، كان الرقم يُوحَّد في العرض ولا يُوحَّد في الحساب.
   مصدرٌ واحد الآن، والاسمان يبقيان لأن موضعَي الاستعمال مختلفان. */
const sbPhone = (p) => normalizePhone(p);
const sbMail = (phone) => sbPhone(phone) + SB.MAIL;

/* ── طلب REST/Auth مع نفس المهلة والإلغاء المستعملين سابقًا ── */
async function sbFetch(path, { method='GET', body, token, prefer, key, timeout }={}){
  const headers = { apikey: SB.KEY, Authorization: 'Bearer ' + (token || SB.KEY) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers['Prefer'] = prefer;
  const res = await fetchWithTimeout(SB.URL + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }, timeout || CONFIG.API_TIMEOUT, key);
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch(_){ data = null; }
  return { ok: res.ok, status: res.status, data, raw: text };
}
const sbRest = (path, opts) => sbFetch('/rest/v1' + path, opts);

/* ── الجلسة: قراءة/تجديد التوكن المخزّن ──
   التوكن نصّ JSON. إن قارب على الانتهاء يُجدَّد بـrefresh_token قبل الاستعمال،
   فلا تنقطع جلسة المستخدم فجأة كما كان يحدث لو انتهت صلاحية access وحده. */
function sbParse(tok){ try{ const s = JSON.parse(tok||'null'); return (s && s.at) ? s : null; } catch(_){ return null; } }
async function sbSession(tok, isOwner){
  const s = sbParse(tok);
  if (!s) return null;
  if (s.exp && Date.now() < s.exp - 60000) return s;                       // صالح
  const r = await sbFetch('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token: s.rt } });
  if (!r.ok || !r.data || !r.data.access_token) return null;               // انتهت فعلًا
  const next = { ...s, at:r.data.access_token, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000 };
  const str = JSON.stringify(next);
  try { isOwner ? Session.setOwner(str, true) : Session.setPlayer(str, true); } catch(_){}
  return next;
}

/* ── تحويلات الشكل: من أعمدة القاعدة إلى الحقول التي تتوقّعها الواجهة ── */
// المرافق ⟵ نفس منطق getAmenityValue في الباكند القديم (نصّ "water:Free|vests:Available")
function sbAmenities(p){
  const one = (v, key) => {
    const s = String(v==null?'':v).trim(); if(!s) return '';
    const low = s.toLowerCase();
    if (['false','no','0','غير متوفر'].includes(low)) return '';
    if (['true','yes','1'].includes(low)) return key + ':Available';
    return key + ':' + s;
  };
  return [one(p.amenity_water,'water'), one(p.amenity_vests,'vests'), one(p.amenity_ball,'ball'),
          one(p.amenity_bathrooms,'bathrooms'), one(p.amenity_parking,'parking')].filter(Boolean).join('|');
}
// الأوقات: jsonb [{h,label}] ⟵⟶ النصّ "8=label|10=label" الذي يفهمه parseSlots
const sbSlotsToText = (arr) => Array.isArray(arr) ? arr.map(s => `${s.h}=${s.label}`).join('|') : String(arr||'');
/* ⚠️ `sport` و`attrs` يأتيان من ترحيل 13. وقبل تشغيله لا وجود للعمودين إطلاقاً
   ⇒ `f.sport` تكون `undefined`، و`fieldSport` تقرؤها **كرة قدم** لا خطأً.
   وهذا هو ما يجعل التطبيق يعمل كما هو قبل الترحيل: كل ملعب كرة قدم كما كان. */
const sbField = (f) => ({
  field_id: String(f.id), place_id: String(f.place_id), field_name: f.name, size: f.size,
  price: Number(f.price||0), slots: sbSlotsToText(f.slots), active: !!f.active, image_url: f.image_url || '',
  sport: fieldSport(f),
  /* ترحيل 29. قبله لا وجود للعمود ⇒ `undefined` ⇒ `fieldGender` تقرؤها `''`
     ⇒ لا شارة ولا مرشِّح — أي سلوك اليوم بالحرف، بلا فرعٍ ولا رسالة. */
  gender: f.gender || '',
  attrs: (f.attrs && typeof f.attrs === 'object' && !Array.isArray(f.attrs)) ? f.attrs : {}
});
const sbPlace = (p, stat) => ({
  place_id: String(p.id), place_name: p.name, city: p.city, region: p.region, type: p.type,
  // ‏`color` كان يُنقَل هنا ولا يقرؤه أحد (صفر استعمال في الرسم أو الورقة) —
  // بقيّةُ تصميمٍ قديم. وحقلُه في `/admin` حُذف معه: قرارٌ بلا أثر ليس قرارًا.
  phone: p.phone, active: !!p.active, map_link: p.map_link || '',
  amenities: sbAmenities(p),
  // التقييمات الحقيقية فقط — `rating_seed`/`reviews_seed` (أرقام مكتوبة يدويًّا في الشيت القديم)
  // أُسقطا عمدًا: مكان بلا تقييم حقيقي لا يُعرض له تقييم إطلاقًا (لا صفر ولا رقم مُختلق).
  rating:  stat ? Number(stat.rating) : 0,
  reviews: stat ? Number(stat.reviews_count) : 0,
  reviews_dist: stat ? stat.reviews_dist : null,
  fields: []
});
// الحجز: `row_number` كان رقم الصفّ في الشيت وصار **مُعرّف الصفّ (uuid)**.
// الواجهة تُعيده كما هو إلى updateBookingStatus، فيدور دورة كاملة بلا تعديل استدعاء.
const sbBooking = (b) => ({
  row_number: String(b.id), booking_id: String(b.id), timestamp: b.created_at,
  player_id: b.player_id ? String(b.player_id) : '',
  date: String(b.booking_date||'').split('T')[0],
  place_id: String(b.place_id), place_name: b.place_name || '',
  field_id: String(b.field_id), field_name: b.field_name || '',
  city: b.city || '', time: b.time_label || '', hour: Number(b.hour),
  name: b.customer_name || '', phone: b.customer_phone || '', players: b.players_size || '',
  price: Number(b.price||0), source: b.source || 'direct',
  status: String(b.status||'pending').toLowerCase(), cancel_reason: b.cancel_reason || '',
  /* عمودا الترحيلين 15 و16. قبل تشغيلهما لا يُطلبان أصلًا (‏`bkCols()` أدناه)
     ⇒ `undefined` هنا، والواجهة تقرؤها «لا انقضاء ولا تخلّف» — أي سلوك اليوم
     بالضبط. لا قيمة مخترَعة ولا فرعٌ ثالث. */
  cancel_kind: b.cancel_kind || '', no_show: !!b.no_show,
  // ترحيل 22. `visibility` غائبة قبله ⇒ `'private'` ⇒ لا شيء يتغيّر عن اليوم.
  visibility: b.visibility === 'open' ? 'open' : 'private',
  needed: b.players_needed==null ? null : Number(b.players_needed),
  brought: b.players_brought==null ? null : Number(b.players_brought)
});

/* ── عمليات القراءة العامة (بلا تسجيل دخول) ── */
/* الإغلاقات (ترحيل 17) — قراءتها عامّة، وتُجلَب مع الجلبة الأولى لأن **كل**
   حساب توفّر في الواجهة يحتاجها: حالة اليوم على زرّه · عدّاد بطاقة المكان ·
   البديل الذكي · إشغال لوحة المالك. جلبُها عند فتح التفاصيل وحده كان يترك
   الرئيسية تعدّ خانات مغلقة متاحةً.
   ⚠️ وقبل الترحيل: 404/`PGRST205` ⇒ خريطة فارغة ⇒ **سلوك اليوم بالحرف**
      (لا إغلاق لأحد). لا رسالة خطأ: غيابُ الميزة ليس عطلًا يراه اللاعب. */
let CLOSURES_OK = true;
async function sbGetClosures(key){
  if (!CLOSURES_OK) return [];
  const from = today(), to = dateAfter(45);
  const r = await sbRest(`/field_closures?select=field_id,closure_date,from_hour,to_hour,reason&closure_date=gte.${from}&closure_date=lte.${to}`, { key });
  if (!r.ok){
    if (r.status === 404 || String(r.raw||'').includes('PGRST205')) CLOSURES_OK = false;
    return [];
  }
  return r.data || [];
}

/* سرعة الردّ (ترحيل 28) — «عادةً يردّ خلال ن دقيقة».
   ⚠️ **علَمٌ ثلاثيّ الحالات** بنفس نمط `GAMES_OK` بالحرف: `null` لا نعرف
      (⇒ لا يُعرَض) · `true` موجود · `false` غائب. والافتراض المتفائل هنا
      يعني سطرًا يظهر ثمّ يختفي، وهو أسوأ من غيابه.
   ⚠️ وغيابُ الترحيل **ليس عطلًا يراه اللاعب**: تحسينٌ اختياري لا ميزة ناقصة
      ⇒ لا رسالة ولا لوح ولا شرطة — لا شيء إطلاقًا.
   ⚠️ ولا جلبة جديدة عند الإقلاع: يدخل نفس دفعة `place_stats`. */
let REPLY_OK = null;
/* 🔴 **بلا `key`** — و«المفتاح» هنا ليس مفتاح API بل **رمز إلغاء**:
   `fetchWithTimeout` يُجهض الطلبَ السابق المسجَّل تحت نفس الرمز. فتمريره إلى
   طلبين داخل `Promise.all` واحدة يجعل الدفعة **تُلغي نفسها**: هذا الطلب يُجهض
   `/places` فتفشل الجلبة كلّها وتُقرأ الرئيسية «لا ملاعب». ولهذا كانت
   `sbGetClosures()` تُنادى بلا وسيط رغم أن توقيعها يقبله. */
async function sbGetReplySpeed(){
  if (REPLY_OK === false) return [];
  const r = await sbRest('/place_reply_speed?select=place_id,median_minutes,n');
  if (!r.ok){
    if (r.status === 404 || String(r.raw||'').includes('PGRST205')) REPLY_OK = false;
    return [];
  }
  REPLY_OK = true;
  return r.data || [];
}
async function sbGetInitialData(key){
  const [pl, fl, st, bk, cl, rs] = await Promise.all([
    sbRest('/places?select=*&active=is.true&order=name', { key }),
    sbRest('/fields?select=*&active=is.true'),
    sbRest('/place_stats?select=*'),
    sbRest('/booked_slots?select=*'),
    sbGetClosures(),
    sbGetReplySpeed(),
  ]);
  if (!pl.ok || !fl.ok) throw new Error('supabase places failed');
  /* الوسيط يُخزَّن على المكان نفسه: `null` معناه محدَّد — «لا يُقاس بعد»
     (العرض نفسه يحجب ما دون سبعة ردود)، والواجهة لا تعرض شيئًا حينها. */
  const reply = {}; (rs||[]).forEach(x => { const m=Number(x.median_minutes);
    if(Number.isFinite(m) && m>=0) reply[String(x.place_id)] = m; });
  const stats = {}; (st.data||[]).forEach(s => stats[String(s.place_id)] = s);
  const byPlace = {}; (fl.data||[]).forEach(f => (byPlace[String(f.place_id)] ||= []).push(sbField(f)));
  const places = (pl.data||[]).map(p => { const o = sbPlace(p, stats[String(p.id)]);
                                          o.fields = byPlace[String(p.id)] || [];
                                          const m = reply[String(p.id)]; if(m!=null) o.reply_median = m;
                                          return o; })
                              .filter(p => p.fields.length > 0);       // نفس سلوك الباكند القديم
  const bookings = (bk.data||[]).map(b => ({ field_id:String(b.field_id), date:String(b.booking_date||'').split('T')[0], hour:Number(b.hour), status:'confirmed' }));
  return { places, bookings, closures: cl };
}
async function sbGetBookedSlots(key){
  const [r, cl] = await Promise.all([ sbRest('/booked_slots?select=*', { key }), sbGetClosures() ]);
  if (!r.ok) throw new Error('supabase booked_slots failed');
  return { bookings: (r.data||[]).map(b => ({ field_id:String(b.field_id), date:String(b.booking_date||'').split('T')[0], hour:Number(b.hour), status:'confirmed' })),
           closures: cl };
}

/* شبكة الأسعار لمكان واحد (ترحيل 18) — نداءٌ واحد لكل ما تعرضه شاشة الحجز.
   ⚠️ الدالّة تُرجع **المختلف عن السعر الأساسي وحده**، فالغياب معناه محدَّد:
      «سعر الملعب كما هو». وهذا يجعل الردّ صفوفًا معدودة لا 7×8×عدد الملاعب. */
let PRICING_OK = true;
async function sbGetPriceGrid(placeId, key){
  if (!PRICING_OK || !placeId) return [];
  const r = await sbFetch('/rest/v1/rpc/place_price_grid', { method:'POST', key,
    body:{ p_place: String(placeId), p_from: today(), p_days: 7 } });
  if (!r.ok){
    if (r.status === 404 || String(r.raw||'').includes('PGRST202')) PRICING_OK = false;
    return [];
  }
  return Array.isArray(r.data) ? r.data : [];
}

/* ── المصادقة ── */
async function sbLogin(phone, password, wantRole){
  const r = await sbFetch('/auth/v1/token?grant_type=password', { method:'POST', body:{ email: sbMail(phone), password: String(password||'') } });
  if (!r.ok || !r.data || !r.data.access_token) return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  const at = r.data.access_token, uid = r.data.user && r.data.user.id;
  const pr = await sbRest(`/profiles?select=*&id=eq.${uid}`, { token: at });
  const prof = (pr.data||[])[0];
  if (!prof || !prof.active) return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  if (wantRole === 'owner' && prof.role !== 'owner' && prof.role !== 'admin') return { success:false, message:'الرقم أو كلمة السر غلط، حاول مرة ثانية' };
  /* 🔴 **كل الصفوف لا أوّلها.** `place_owners` جدولُ علاقةٍ متعدّدة: مالكٌ له
     مجمّعان له صفّان. وكان الكود يأخذ `[0]` ويرمي الباقي **بلا كلمة** ⇒ يرى
     مكانًا واحدًا — أيّهما جاء أوّلًا في ترتيب الصفوف — ولا يعرف أن الآخر موجود
     أصلًا. والصمت عن بياناتٍ موجودة مخالفٌ لـم٥ قبل أن يكون نقصَ ميزة.
     و`place_id` يبقى **المختار** (الأوّل افتراضًا) كي لا يتغيّر شيء لمن له مكان
     واحد — وهي الحالة الغالبة. */
  let placeId = '', placeIds = [];
  if (wantRole === 'owner'){
    const po = await sbRest(`/place_owners?select=place_id&profile_id=eq.${uid}`, { token: at });
    placeIds = (po.data||[]).map(r2 => String(r2.place_id||'')).filter(Boolean);
    placeId = placeIds[0] || '';
  }
  return { success:true, session:{ at, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000,
           uid:String(uid), role:prof.role, name:prof.name||'', phone:prof.phone||'', place_id:String(placeId||''), place_ids: placeIds,
           // `select=*` يجلبه تلقائيًّا بعد ترحيل 11، وقبله `undefined` ⇒ false.
           // القيمة تُقرأ عند كل دخول فلا تتقادم في الجلسة المخزَّنة.
           verified: !!prof.phone_verified } };
}

/* ── تغيير كلمة السرّ ──
   ثلاث خطوات مقصودة، والأولى ليست شكليّة:
   ① **إعادة مصادقة بكلمة السرّ الحالية.** توكن الجلسة وحده يكفي تقنيًّا لتغيير
      كلمة السرّ، لكن ذلك يعني أن هاتفًا مسروقًا (والجلسة عليه مفتوحة) يستطيع
      قفل صاحبه خارج حسابه نهائيًّا. اشتراط كلمة السرّ الحالية يمنع ذلك.
   ② التغيير عبر توكن **حديث** من الخطوة ① لا التوكن المخزّن (قد يكون قارب الانتهاء).
   ③ دخول جديد بكلمة السرّ الجديدة ⇒ جلسة مضمونة الصلاحية تُخزَّن مكان القديمة،
      فلا يجد المستخدم نفسه مخرَجًا بعد نجاح العملية. */
async function sbChangePassword(tok, isOwner, currentPassword, newPassword){
  const s = await sbSession(tok, isOwner);
  if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const email = sbMail(s.phone);

  const re = await sbFetch('/auth/v1/token?grant_type=password',
    { method:'POST', body:{ email, password:String(currentPassword||'') } });
  if (!re.ok || !re.data || !re.data.access_token)
    return { success:false, message:'كلمة السر الحالية غلط' };

  const up = await sbFetch('/auth/v1/user',
    { method:'PUT', token:re.data.access_token, body:{ password:String(newPassword||'') } });
  if (!up.ok){
    const m = up.data && (up.data.msg || up.data.error_description || up.data.message);
    // الخادم هو الحكم على السياسة (الطول مثلًا) — ننقل رسالته لا نخترع واحدة
    return { success:false, message: m || 'ما قدرنا نغيّر كلمة السر، جرّب كمان مرة' };
  }

  const fresh = await sbFetch('/auth/v1/token?grant_type=password',
    { method:'POST', body:{ email, password:String(newPassword||'') } });
  const session = (fresh.ok && fresh.data && fresh.data.access_token)
    ? { ...s, at:fresh.data.access_token, rt:fresh.data.refresh_token,
        exp: Date.now() + (fresh.data.expires_in||3600)*1000 }
    : null;
  return { success:true, message:'تم تغيير كلمة السر', session };
}

/* ── الحجوزات ── */
const SB_BK_COLS ='id,created_at,player_id,place_id,field_id,booking_date,hour,time_label,customer_name,customer_phone,players_size,price,source,status,cancel_reason,place_name,field_name,city';

/* ⚠️ **عمودٌ غير موجود يُفشل الاستعلام كلّه** — نفس درس `fields.sport` في
   `/admin`: `select=…,no_show` قبل ترحيل 16 يردّ 400، فتخلو قائمة الحجوزات
   كاملةً ويبدو التطبيق مكسورًا لا «ميزةً غير مفعّلة». فنسأل بالعمودين
   الجديدين، وإن رُفضا سألنا بلا الاثنين — والجولة الثانية لا تقع إلّا في
   حالة «قبل الترحيل»، وبعده لا تقع أبدًا (العلَم يُحفَظ للجلسة).
   ولا نخمّن أيّهما الناقص: كلاهما يأتي من ترحيل معلَّق، والسؤال أرخص من التخمين. */
let SB_BK_EXTRA = ',cancel_kind,no_show,visibility,players_needed,players_brought';
async function sbBookingsQuery(path, opts){
  if (SB_BK_EXTRA){
    const r = await sbRest(path.replace('{cols}', SB_BK_COLS + SB_BK_EXTRA), opts);
    if (r.ok) return r;
    SB_BK_EXTRA = '';   // الترحيلان معلَّقان ⇒ لا نسأل عنهما ثانيةً في هذه الجلسة
  }
  return sbRest(path.replace('{cols}', SB_BK_COLS), opts);
}

async function sbCreateBooking(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const body = {
    player_id: session.uid, place_id: d.place_id, field_id: d.field_id,
    booking_date: d.date, hour: Number(d.hour), time_label: d.time || '',
    customer_name: d.name || session.name || '', customer_phone: sbPhone(d.phone || session.phone),
    players_size: d.players || '', price: Number(d.price||0), source: d.source || 'direct', status: 'pending'
  };
  /* أعمدة ترحيل 22 تُرسَل **فقط** حين تُطلَب مباراة مفتوحة: الحجز الخاصّ لا
     يحملها أصلًا (قيد `bookings_open_counts_chk` يرفض ملأها على الخاصّة)،
     فإرسالها دائمًا كان يُفشل كلّ حجز عادي قبل الترحيل بلا داعٍ. */
  if (d.visibility === 'open'){
    body.visibility = 'open';
    body.players_needed = Number(d.needed);
    body.players_brought = Number(d.brought);
  }
  let r = await sbRest('/bookings', { method:'POST', token: session.at, prefer:'return=representation', body });
  /* ترحيل 22 معلَّق والمستخدم اختار «مفتوحة» ⇒ `PGRST204`. **لا نتراجع صامتًا
     إلى خاصّة**: هو طلب صراحةً أن يُنشر طلبُه، وكتابتُه خاصًّا بلا كلمة تجعله
     ينتظر منضمّين لن يأتوا. نقولها ونترك له القرار. */
  if (!r.ok && d.visibility === 'open' && String(r.raw||'').includes('PGRST204')){
    return { success:false, message: t('gmNotReady') };
  }
  // 23505 = خرق القيد الفريد ⇒ الخانة حُجزت بين العرض والحفظ. هذا هو الضمان الذي
  // لم يكن موجودًا مع الشيت: التزامن يُحسم في القاعدة لا في منطق التطبيق.
  /* حرّاس الترحيل 24 يردّون رمزًا له اسم — والرمز يُقرأ قبل الرسالة العامّة،
     وإلّا قرأ اللاعبُ «صار ضغط على النظام» وهو خطأٌ في طلبه لا في الخادم.
     ونفس مبدأ 15: نعرض ما رُدَّ به فعلًا، لا ما نظنّه. */
  if (!r.ok){
    const guard = dbErrorMessage(r.raw);
    if (guard) return { success:false, message: guard };
    return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت راح، اختار وقت ثاني' : 'صار ضغط على النظام، حاول بعد ثانية' };
  }
  /* السعر الذي **كُتب فعلًا**. بعد ترحيل 18 قد يختلف عمّا أرسلناه: المُشغِّل
     يفرض `resolve_field_price` على إدراج اللاعب، والصفّ المُعاد يحمل النتيجة.
     نُعيده كي تقارنه الواجهة وتقول الفرق بدل أن يكتشفه اللاعب عند الملعب. */
  const row = (r.data||[])[0];
  return { success:true, message:'وصل طلبك، بنأكدلك قريب',
           price: row ? Number(row.price) : null, booking_id: row ? String(row.id) : undefined };
}

async function sbUpdateBookingStatus(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const patch = { status: d.status };
  if (d.cancel_reason !== undefined) patch.cancel_reason = d.cancel_reason || '';
  const r = await sbRest(`/bookings?id=eq.${d.row_number}`, { method:'PATCH', token: session.at, prefer:'return=representation', body: patch });
  /* مهلة الإلغاء (ترحيل 15): المُشغِّل يرفع `cancel_window_closed:<n>`.
     ⚠️ ونقرأ **رقم الخادم** لا `CONFIG.CANCEL_WINDOW_H`: لو اختلف الإعداد في
     القاعدة عن ثابت التطبيق يومًا، فالجملة التي يقرؤها اللاعب يجب أن تحمل
     الرقم الذي رُفض به فعلًا — لا الرقم الذي كنّا نظنّه. */
  if (!r.ok){
    const raw = String(r.raw||'');
    const m = raw.match(/cancel_window_closed:([\d.]+)/);
    if (m) return { success:false, code:'cancel_window', hours: Number(m[1]) || CONFIG.CANCEL_WINDOW_H,
                    message: t('cancelWindowServer', { h: nHours(Number(m[1]) || CONFIG.CANCEL_WINDOW_H) }) };
    return { success:false, message:'صار خطأ، حاول كمان مرة' };
  }
  if (!r.data || !r.data.length) return { success:false, message:'ما بتقدر تعدّل حالة الحجز' };   // منعته سياسة RLS
  return { success:true, message:'تم التحديث' };
}

/* ── كنس الطلبات المنقضية (ترحيل 15) ──────────────────────────────────────
   لا cron في الخطّة المجانية، فالكنس يجري **عند القراءة**: قبل جلب لوحة
   المالك وقبل جلب حجوزات اللاعب. والخانق في القاعدة (‏60ث) يجعل النداء
   المتكرّر بلا كلفة، فلا حاجة إلى خانق ثانٍ هنا.
   ⚠️ وفشلُه لا يُرى ولا يُقال: هو **صيانة** لا بيانات. قبل الترحيل يردّ
      404/`PGRST202` — والصفحة التي تليه تعمل كما كانت تمامًا (الطلب المعلّق
      يبقى معلّقًا، وهو سلوك اليوم). أمّا حيث يهمّ المستخدمَ أن يعرف — لوحة
      المالك — فالنقص يُقال هناك صراحةً لا هنا. */
let SWEEP_OK = true;
async function sbSweepExpiry(session){
  if (!SWEEP_OK || !session) return;
  try{
    const r = await sbFetch('/rest/v1/rpc/expire_stale_bookings', { method:'POST', token: session.at, body:{} });
    if (r.status === 404 || String(r.raw||'').includes('PGRST202')) SWEEP_OK = false;
  }catch(_){ /* شبكة — الجلب بعده سيقول ما يقوله */ }
}

/* ═══ الأحداث (ترحيل 21) — قياسٌ لا يُبطئ ولا يكسر ═══════════════════════
   ⚑ القائمة **مغلقة وفي مكان واحد**، ومرآتها قيدٌ في القاعدة: نوعٌ يُضاف هنا
     بلا هناك يُرفَض بـ400، ونوعٌ هناك بلا هنا لا يُرسله أحد.
   ⚑ والإرسال **دفعةً كل بضع ثوانٍ** بلا انتظار وبلا رسالة عند الفشل: غيابُ
     القياس مقبول، وحجزٌ يتعثّر لأن سطر تحليلات فشل ليس مقبولًا. ولذلك لا
     `await` على أيٍّ من هذه النداءات في أي مسار.
   ⚑ ولا يحمل شيئًا عن **الشخص**: لا رقم ولا اسم ولا موقع. و`profile_id`
     يكتبه الخادم من الجلسة (`fn_events_guard`) ولا نرسله أصلًا. */
const EV = { SEARCH_EMPTY:'search_empty', PLACE_VIEW:'place_view',
             BOOKING_STARTED:'booking_started', BOOKING_SUBMITTED:'booking_submitted',
             SLOT_WATCH:'slot_watch' };
const Track = (()=>{
  let q = [], timer = 0, dead = false;
  async function flush(){
    timer = 0;
    if (dead || !q.length) return;
    const batch = q; q = [];
    try{
      const s = sbParse(Session.player() || Session.owner());
      const r = await sbRest('/events', { method:'POST', token: s ? s.at : undefined,
        prefer:'return=minimal', body: batch });
      // الجدول غير موجود (ترحيل 21 معلَّق) ⇒ نكفّ عن المحاولة لهذه الجلسة.
      if (r.status === 404 || String(r.raw||'').includes('PGRST205')) dead = true;
    }catch(_){ /* شبكة — الدفعة تسقط، ولا أحد يُخبَر */ }
  }
  /* ⚠️ **بحثٌ واحد لا صفٌّ لكل حرف.** `renderPlaces` مربوطة بـ`input` مؤجَّلة،
     فكتابة «صويلح» تمرّ على ستّ قوائم فارغة ⇒ ستّة صفوف لسؤال واحد، وأعلى
     بحثٍ فارغ يبدو ستّة أبحاثٍ صغيرة فيضيع الخبر. قاعدتان تحسمانها:
       ① مهلة أطول من مهلة العرض (١.٢ث) — الكتابة تُلغي ما قبلها.
       ② والكلمة الأطول **تبتلع** بادئتها: «صو» ثمّ «صويلح» سؤالٌ واحد. */
  let sq = null, stimer = 0;
  function settleSearch(){
    stimer = 0;
    if (!sq) return;
    const p = sq; sq = null;
    push(EV.SEARCH_EMPTY, p);
  }
  function push(kind, payload){
    if (dead || !EV_OK(kind)) return;
    q.push({ kind, payload: payload || {} });
    if (q.length >= 20) { flush(); return; }            // سقف للدفعة كي لا تكبر بلا حدّ
    if (!timer) timer = setTimeout(flush, 4000);
  }
  return {
    push,
    searchEmpty(payload){
      if (dead) return;
      const prev = sq && String(sq.q||''), next = String(payload.q||'');
      if (!next) return;
      // بادئةٌ سابقة تُستبدَل بالأطول؛ وكلمةٌ مختلفة تمامًا تُرسَل هي وسابقتها.
      if (prev && next.indexOf(prev) !== 0 && prev.indexOf(next) !== 0) settleSearch();
      sq = payload;
      clearTimeout(stimer); stimer = setTimeout(settleSearch, 1200);
    },
    flushNow(){ settleSearch(); return flush(); }
  };
})();
const EV_OK = (k) => Object.values(EV).includes(k);
/* البحث يُطبَّع قبل التسجيل: «الجبيهه» و«الجبيهة » و«الجبيهة» سؤالٌ واحد،
   وثلاثة صفوف عنه تجعل أعلى بحثٍ فارغ يبدو ثلاثة أبحاثٍ صغيرة. */
const normQuery = (s) => normalizeText(s).slice(0, 60);

/* ── الإغلاقات (ترحيل 17) — الكتابة عبر دالّة، والقراءة مباشرة ──
   الدالّة تُرجع التعارض **مفصّلًا** (بالاسم والوقت) بدل رمز خطأ عارٍ، فالمالك
   يرى مَن سيتأذّى قبل أن يقرّر. والمُشغِّل في القاعدة هو الحارس الحقيقي — يعمل
   حتى على REST مباشر — وهذه طريق الاستعمال اليومي. */
async function sbCloseField(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbFetch('/rest/v1/rpc/owner_close_field', { method:'POST', token: session.at, body:{
    p_field: String(d.field_id), p_date: String(d.date),
    p_from: d.from==null ? null : Number(d.from), p_to: d.to==null ? null : Number(d.to),
    p_reason: String(d.reason||'')
  }});
  if (r.status === 404 || String(r.raw||'').includes('PGRST202')) return { success:false, reason:'not_ready', message:t('closeNotReady') };
  if (!r.ok) return { success:false, message:t('closeFail') };
  const out = r.data || {};
  if (out.success) return { success:true, pending: Number(out.pending||0) };
  return { success:false, reason: out.reason || '', bookings: out.bookings || [],
           message: out.reason==='forbidden' ? t('closeForbidden') : out.reason==='past' ? t('closePast') : '' };
}
async function sbReopen(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbRest(`/field_closures?field_id=eq.${d.field_id}&closure_date=eq.${d.date}`,
    { method:'DELETE', token: session.at, prefer:'return=representation' });
  if (r.status === 404 || String(r.raw||'').includes('PGRST205')) return { success:false, message:t('closeNotReady') };
  if (!r.ok) return { success:false, message:t('closeFail') };
  // صفر صفوف مع 200 = منعته RLS، لا «لا شيء لحذفه». والفرق يهمّ.
  return { success:true, removed: (r.data||[]).length };
}

/* ── قواعد التسعير (ترحيل 18) ──
   القراءة والكتابة مباشرتان: RLS تسمح لمالك المكان وحده، والقيود في القاعدة
   تحرس النطاقات. ولا منطق أسبقية هنا إطلاقاً — الحسم في `resolve_field_price`. */
async function sbGetPriceRules(fieldIds, session){
  if (!session || !fieldIds.length) return { success:true, rules:[] };
  const list = fieldIds.map(encodeURIComponent).join(',');
  const r = await sbRest(`/field_price_rules?select=id,field_id,weekdays,from_hour,to_hour,date_from,date_to,price,priority,active,label&field_id=in.(${list})&order=priority.desc,created_at.desc`, { token: session.at });
  if (!r.ok){
    const missing = r.status === 404 || String(r.raw||'').includes('PGRST205');
    return { success:false, missing, message: missing ? t('pricingNotReady') : t('ruleFail') };
  }
  return { success:true, rules: r.data || [] };
}
async function sbAddPriceRule(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const body = { field_id: d.field_id, price: Number(d.price), priority: Number(d.priority||0),
                 weekdays: (d.weekdays && d.weekdays.length) ? d.weekdays : null,
                 from_hour: d.from==null ? null : Number(d.from), to_hour: d.to==null ? null : Number(d.to) };
  const r = await sbRest('/field_price_rules', { method:'POST', token: session.at, prefer:'return=representation', body });
  if (r.status === 404 || String(r.raw||'').includes('PGRST205')) return { success:false, message:t('pricingNotReady') };
  if (!r.ok || !(r.data||[]).length) return { success:false, message:t('ruleFail') };
  return { success:true, rule:(r.data||[])[0] };
}
async function sbDelPriceRule(id, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbRest(`/field_price_rules?id=eq.${id}`, { method:'DELETE', token: session.at, prefer:'return=representation' });
  if (!r.ok) return { success:false, message:t('ruleFail') };
  if (!(r.data||[]).length) return { success:false, message:t('closeForbidden') };   // منعته RLS
  return { success:true };
}

/* ═══ المباريات المفتوحة (ترحيل 22) ═══════════════════════════════════════
   ⚑ القراءة من **عرض** لا من `bookings`: العرض لا يحمل هاتفًا ولا معرّف لاعب
     ولا اسمًا كاملًا، فما لا يُذكَر فيه لا يخرج مهما كان الاستعلام.
   ⚑ والكتابة كلّها **دوالّ**: الانضمام يفحص المقاعد والحالة والزمن تحت قفل
     صفّ، وإدراجٌ مباشر كان سيتخطّى الثلاثة — ولذلك لا سياسة insert أصلًا.
   ⚑ وقبل الترحيل: 404/`PGRST205` ⇒ العلَم يسقط، ومبدّل «مباريات» **لا يظهر**. */
/* ⚠️ `GAMES_OK` يبدأ **`null` = لا نعرف بعد**، لا `true`. بالافتراض المتفائل
   كان المبدّل ونموذجُ «مفتوحة» يظهران قبل الترحيل، ولا يختفيان إلّا بعد أن
   يفتح المستخدمُ تبويبَ المباريات ويفشل الطلب — أي يعرض عليه المنتجُ بابًا
   ثمّ يسحبه. مقيس. الآن: سؤالٌ واحد رخيص (`limit=0`) عند أوّل تحميل بجلسة،
   وما لا يُعرف لا يُعرَض. */
/* ── أدنى إصدار مقبول (ترحيل 27) ──────────────────────────────────────────
   التوزيع بـAPK مباشر بلا متجر ⇒ **لا آلية تحديث إطلاقًا**، بينما المخطّط
   يتحرّك في كل ترحيل. ونسخةٌ قديمة تُظهر — في أحسن الأحوال — «الميزة غير
   مُفعّلة»، وفي أسوئها بياناتٍ ناقصةً تبدو سليمة (قائمة حجوزات تُجلَب بلا
   `cancel_kind` فلا يرى صاحبها أنّ طلبه انقضت مهلته).
   ⚠️ والقراءة **بلا توكن**: `br_read using (true)` ⇒ حتى الضيف الذي لم يسجّل
   دخوله بعدُ يعرف أنّ نسخته تخلّفت. وسؤالٌ واحد لكل جلسة، ويُبتلع فشلُه
   صامتًا — بوّابةٌ تكسر الإقلاع حين يتعذّر سؤالها أسوأ ممّا تحرسه. */
let VER_CHECKED = false;
async function checkAppVersion(){
  if (VER_CHECKED) return; VER_CHECKED = true;
  try{
    const r = await sbRest('/booking_rules?select=key,num_value&key=in.(min_app_version,block_app_version)');
    if (!r.ok || !Array.isArray(r.data)) return;
    const at = (k) => Number((r.data.find(x => x.key === k) || {}).num_value || 0);
    const min = at('min_app_version');
    if (!(CONFIG.APP_BUILD < min)) return;
    const bar = $('#verBar'); if (!bar) return;
    if (sessionStorage.getItem('mustadaira:verDismissed') === String(min)) return;
    bar.hidden = false;
    const x = $('#verX');
    // إسناد الخاصّية لا `addEventListener`: العنصر ثابت في HTML، والإضافة
    // تُكدّس مستمعًا في كل نداء. مزلق مسجَّل.
    if (x) x.onclick = () => { bar.hidden = true; try{ sessionStorage.setItem('mustadaira:verDismissed', String(min)); }catch(_){} };
  }catch(_){ /* لا شيء: النسخة تعمل، وغياب الخبر ليس عطلًا */ }
}

let GAMES_OK = null;
async function sbProbeGames(session){
  if (GAMES_OK !== null || !session) return GAMES_OK;
  const r = await sbRest('/open_games?select=id&limit=0', { token: session.at });
  // 404/PGRST205 = العرض غير موجود. وأي شيء آخر (حتى الرفض) إثباتُ وجود.
  GAMES_OK = !(r.status === 404 || String(r.raw||'').includes('PGRST205'));
  return GAMES_OK;
}
async function sbGetOpenGames(session, key){
  if (GAMES_OK === false) return { success:false, missing:true, games:[] };
  const tok = session ? session.at : undefined;
  const r = await sbRest(`/open_games?select=*&booking_date=gte.${today()}&order=booking_date,hour`, { token:tok, key });
  if (!r.ok){
    const missing = r.status === 404 || String(r.raw||'').includes('PGRST205');
    if (missing) GAMES_OK = false;
    return { success:false, missing, games:[] };
  }
  return { success:true, games: r.data || [] };
}
async function sbMyJoined(session){
  if (GAMES_OK === false || !session) return [];
  const r = await sbRest('/booking_players?select=booking_id,joined_at', { token: session.at });
  return r.ok ? (r.data||[]) : [];
}
async function sbGamePlayers(bookingId, session){
  if (!session) return [];
  const r = await sbRest(`/open_game_players?select=first_name,joined_at&booking_id=eq.${bookingId}&order=joined_at`, { token: session.at });
  return r.ok ? (r.data||[]) : [];
}
/* ترجمة موحّدة لردود الدوالّ الأربع: رمزٌ آلي ⇒ جملةٌ بلغة المستخدم. */
const GAME_MSG = { auth:'gmErrAuth', missing:'gmErrMissing', not_open:'gmErrNotOpen',
                   past:'gmErrPast', host:'gmErrHost', full:'gmErrFull',
                   forbidden:'gmErrForbidden', bad_counts:'gmErrCounts',
                   // ثغرتان أُغلقتا في القاعدة (22): حساب موقوف · مقعدان في ساعة واحدة
                   inactive:'gmErrInactive', clash:'gmErrClash' };
async function sbGameRpc(fn, body, session){
  if (!session) return { success:false, message:t('gmErrAuth') };
  const r = await sbFetch('/rest/v1/rpc/'+fn, { method:'POST', token: session.at, body });
  if (r.status === 404 || String(r.raw||'').includes('PGRST202')) return { success:false, missing:true, message:t('gmNotReady') };
  if (!r.ok) return { success:false, message:t('gmErrGeneric') };
  const out = r.data || {};
  if (out.success) return { success:true, ...out };
  const key = GAME_MSG[out.reason];
  // `below_joined` و`has_players` يحملان عددًا ⇒ جملتاهما تُبنيان بمعطياتهما
  if (out.reason === 'below_joined') return { success:false, reason:out.reason, message:t('gmErrBelow',{ n:out.joined, min:out.min_needed }) };
  if (out.reason === 'has_players')  return { success:false, reason:out.reason, message:t('gmErrHasPlayers',{ n:out.joined }) };
  return { success:false, reason:out.reason, message: key ? t(key) : t('gmErrGeneric') };
}

/* ── «نبّهني إذا فضيت» (ترحيل 20) ──
   ⚠️ الزرّ **لا يظهر** ما لم يكن الجدول موجودًا: نيّةٌ نقبلها ولا نستطيع الوفاء
      بها أسوأ من ألّا نعرضها. ولذلك نقيس الوجود مرّة عند أوّل محاولة ونحفظ. */
let WATCH_OK = true;
async function sbWatchSlot(d, session){
  if (!session) return { success:false, message:'سجّل دخولك أول' };
  const r = await sbRest('/slot_watch', { method:'POST', token: session.at,
    prefer:'return=minimal,resolution=ignore-duplicates',
    body:{ profile_id: session.uid, field_id: d.field_id, watch_date: d.date, hour: Number(d.hour) } });
  if (r.status === 404 || String(r.raw||'').includes('PGRST205')){ WATCH_OK = false; return { success:false, missing:true, message:t('watchNotReady') }; }
  if (!r.ok) return { success:false, message:t('watchFail') };
  return { success:true };
}

/* ── «لم يحضر» (ترحيل 16) — PATCH على عمود واحد، والقاعدة هي الحارس ──
   من يستطيع؟ ومتى؟ كلاهما في `fn_booking_no_show_guard`. هنا نُترجم رموزه
   فقط: `no_show_too_early` · `no_show_forbidden` · وغيابُ العمود نفسه. */
async function sbSetNoShow(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbRest(`/bookings?id=eq.${d.row_number}`, { method:'PATCH', token: session.at,
    prefer:'return=representation', body:{ no_show: !!d.no_show } });
  if (!r.ok){
    const raw = String(r.raw||'');
    if (raw.includes('PGRST204') || r.status === 404) return { success:false, message:t('noShowNotReady') };
    if (raw.includes('no_show_too_early'))  return { success:false, message:t('noShowTooEarly') };
    if (raw.includes('no_show_forbidden'))  return { success:false, message:t('noShowForbidden') };
    return { success:false, message:t('noShowFail') };
  }
  if (!(r.data||[]).length) return { success:false, message:t('noShowForbidden') };   // منعته RLS
  return { success:true, message: d.no_show ? t('noShowOk') : t('noShowUndone') };
}

/* تعديل موعد حجز معلّق — عبر **دالّة في القاعدة** لا PATCH مباشر.
   سياسة `bookings_update` تسمح للاعب بالتحديث إلى `cancelled` وحدها
   (`with check … status = 'cancelled'`). توسيعها لتمرير `pending` كان سيفتح
   **كل** الأعمدة أمامه — السعر والملعب واسم صاحب الحجز. الدالّة أضيق:
   تعدّل `booking_date` و`hour` وحدهما بعد التحقّق من الملكية والحالة والتوفّر،
   والقيد الفريد في القاعدة يحسم التزامن كما في الإنشاء.
   ⚠️ تحتاج تشغيل `migration/09_player_reschedule.sql` مرّة واحدة. قبله يردّ
   PostgREST 404/PGRST202 ⇒ نقولها للمستخدم صراحةً بدل «حدث خطأ» مبهم. */
async function sbRescheduleBooking(d, session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbFetch('/rest/v1/rpc/player_reschedule_booking', { method:'POST', token: session.at, body:{
    p_booking: String(d.row_number), p_date: String(d.date), p_hour: Number(d.hour), p_time_label: d.time || ''
  }});
  if (r.status === 404 || (r.raw||'').includes('PGRST202')) return { success:false, message: t('rsNotReady') };
  if (!r.ok) return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت راح، اختار وقت ثاني' : 'صار خطأ، حاول كمان مرة' };
  const out = r.data || {};
  return { success: !!out.success, message: out.message || '' };
}

/* ── تأكيد رقم الهاتف — دالّتان في القاعدة، ولا شيء منهما في المتصفّح ──
   الكود يُولَّد ويُجزَّأ ويُقارَن داخل Postgres (‏`migration/11_phone_verification.sql`).
   ولا يعرف التطبيق الكودَ ولا الحدودَ الزمنية: يطلب، ويقرأ ما تردّه الدالّة.

   ثلاثة ردود مختلفة تمامًا يجب ألّا تُخلَط:
     • 404/PGRST202 ⇒ **الترحيل لم يُشغَّل** — عطل خادم، لا عطل مستخدم.
     • sent:false + no_provider ⇒ الترحيل شغّال لكن لا مزوّد رسائل بعد.
     • success:false + too_soon/rate_limited ⇒ حدٌّ حقيقي، ومعه ثوانيه.
   وكلّها تُقال كما هي. «حدث خطأ» على أيٍّ منها تجعل المستخدم يعيد المحاولة
   إلى الأبد على شيء لن ينجح. */
async function sbRequestPhoneCode(session){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbFetch('/rest/v1/rpc/request_phone_code', { method:'POST', token: session.at, body:{} });
  if (r.status === 404 || (r.raw||'').includes('PGRST202')) return { success:true, sent:false, reason:'not_ready' };
  if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
  const out = r.data || {};
  return { success: out.success !== false, sent: !!out.sent, reason: out.reason || '',
           retry_after: Number(out.retry_after||0), message: out.message || '' };
}
async function sbVerifyPhoneCode(session, code){
  if (!session) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
  const r = await sbFetch('/rest/v1/rpc/verify_phone_code', { method:'POST', token: session.at, body:{ p_code: String(code||'') } });
  if (r.status === 404 || (r.raw||'').includes('PGRST202')) return { success:false, reason:'not_ready', message: t('vfNotReady') };
  if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
  const out = r.data || {};
  return { success: !!out.success, reason: out.reason || '', left: out.left,
           message: out.message || '' };
}

/* ═══ الموزّع: نفس واجهة API القديمة (get/post) فوق Supabase ═══ */
const API = {
  async get(action, extra={}, key) {
    switch(action){
      case 'getInitialData': return sbGetInitialData(key);
      case 'getBookings':    return sbGetBookedSlots(key);
      case 'getPriceGrid':   return sbGetPriceGrid(extra.place_id, key);
      case 'getOpenGames': {
        const s = await sbSession(Session.player(), false);
        const r = await sbGetOpenGames(s, key);
        r.joined = s ? (await sbMyJoined(s)).map(x=>String(x.booking_id)) : [];
        return r;
      }
      case 'getGamePlayers':
        return { success:true, players: await sbGamePlayers(extra.booking_id, await sbSession(Session.player(), false)) };

      case 'playerLogin': {
        const r = await sbLogin(extra.phone, extra.password, 'player');
        if (!r.success) return r;
        return { success:true, message:'أهلاً، تفضل', player_token: JSON.stringify(r.session),
                 player:{ player_id:r.session.uid, name:r.session.name, phone:r.session.phone, verified:!!r.session.verified } };
      }
      case 'ownerLogin': {
        const r = await sbLogin(extra.phone, extra.password, 'owner');
        if (!r.success) return r;
        return { success:true, message:'أهلاً، تفضل', owner_token: JSON.stringify(r.session),
                 owner:{ owner_id:r.session.uid, phone:r.session.phone, place_id:r.session.place_id } };
      }

      case 'getPlayerBookings': {
        const s = await sbSession(extra.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        await sbSweepExpiry(s);
        const r = await sbBookingsQuery(`/bookings_full?select={cols}&player_id=eq.${s.uid}&order=booking_date.desc,hour.desc`, { token:s.at, key });
        if (!r.ok) return { success:false, message:'تعذّر جلب البيانات' };
        /* `player` يُعاد معها لأن `init()` يستدعي هذه العملية وحدها عند فتح
           التطبيق بجلسة محفوظة، ثمّ يُسند `State.player = res.player` — وكانت
           تردّ بلا `player` ⇒ `undefined`: الاسم يختفي من سطر الترحيب بعد كل
           إعادة فتح، وشارةُ حالة الرقم لا تعرف ما تعرض. (‏`sbCreateBooking`
           كان يتراجع إلى `session.name` فلم يظهر الأثر في الحجز نفسه.) */
        return { success:true, bookings:(r.data||[]).map(sbBooking),
                 player:{ player_id:s.uid, name:s.name, phone:s.phone, verified: !!s.verified } };
      }
      /* ── الإشعارات ───────────────────────────────────────────────────────
         الصفوف تُكتب داخل القاعدة (‏migration/14) ولا يكتبها أحد من هنا.
         و`notif_read` تقصر القراءة على `profile_id = auth.uid()` ⇒ لا مرشِّح
         على المستخدم في الرابط أصلاً: RLS هو المرشِّح، وإضافةُ واحدٍ هنا كانت
         ستوهم بأن الأمان في الرابط لا في القاعدة.
         ⚠️ ترحيل 14 معلَّق ⇒ الجدول غير موجود وPostgREST يردّ 404/`PGRST205`.
            نميّز هذه الحالة بعينها (`missing:true`) كي تقول الواجهةُ سببها
            صراحةً بدل قائمة فارغة تُوهم بأنه «لا جديد». */
      case 'getNotifications': {
        const tok = extra.token || Session.player() || Session.owner();
        const s = await sbSession(tok, !Session.player());
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const r = await sbRest('/notifications?select=id,created_at,kind,booking_id,place_id,data,read_at,delivered_at&order=created_at.desc&limit=50', { token:s.at, key });
        if (!r.ok){
          const missing = r.status === 404 || String(r.raw||'').includes('PGRST205');
          return { success:false, missing, message:'تعذّر جلب البيانات' };
        }
        return { success:true, notifications: r.data || [] };
      }
      case 'markNotifications': {
        const tok = extra.token || Session.player() || Session.owner();
        const s = await sbSession(tok, !Session.player());
        if (!s || !extra.ids || !extra.ids.length) return { success:false };
        const body = {};
        if (extra.read)      body.read_at = new Date().toISOString();
        if (extra.delivered) body.delivered_at = new Date().toISOString();
        /* المُشغِّل `t_notif_guard` في القاعدة يُعيد كل حقل آخر إلى قيمته
           القديمة قسراً ⇒ حتى لو أُرسل غيرهما لا يُكتب. الحارس هناك لا هنا،
           لأن السياسة تحكم **الصفوف لا الأعمدة**. */
        const r = await sbRest(`/notifications?id=in.(${extra.ids.map(encodeURIComponent).join(',')})`,
          { method:'PATCH', token:s.at, body });
        return { success: r.ok };
      }

      /* رمز جهاز الدفع + لغة الإشعار ⇒ صفّ المستخدم نفسه (ترحيل 31).
         ⚠️ `profiles_self_update` تحكم الصفوف لا الأعمدة، لكنّ مُشغِّل ترحيل 24
            يجمّد `role` و`active` باتّجاه ⇒ هذان العمودان خارج حراسته فيمرّان،
            ولا يستطيع أحد أن يكتب رمزًا في صفّ غيره (السياسة تُقيّد الصفّ).
         ⚠️ **وغيابُ العمودين قبل الترحيل يردّ `PGRST204`** فيعود `success:false`
            صامتًا — والمستخدم لا يرى شيئًا لأنه لم يطلب هذا الفعل أصلًا. */
      case 'savePushToken': {
        const tok = Session.player() || Session.owner();
        const s = await sbSession(tok, !Session.player());
        if (!s || !extra.token) return { success:false };
        const r = await sbRest(`/profiles?id=eq.${encodeURIComponent(s.uid)}`, {
          method:'PATCH', token:s.at,
          body:{ fcm_token: extra.token, fcm_at: new Date().toISOString(), lang: extra.lang || 'ar' },
        });
        return { success: r.ok };
      }

      case 'getPlayerProfile': {
        const s = await sbSession(extra.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        return { success:true, player:{ player_id:s.uid, name:s.name, phone:s.phone, verified: !!s.verified } };
      }

      case 'getOwnerData': {
        const s = await sbSession(extra.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        /* ⚠️ المكان يأتي من **حالةٍ قابلة للتبديل** لا من الجلسة مباشرةً — وإلّا
           استحال على مالكِ مكانين أن يرى ثانيَهما إلّا بخروجٍ ودخول.
           والقائمة البيضاء `place_ids` هي الحكم: `place_id` يصل من العميل، وما
           ليس في جلسته يعود إلى المختار. (‏RLS يحرسه على أي حال، لكنّ الردّ
           حينها «ما لقينا المكان تبعك» — تشخيصٌ خاطئ لخطأ برمجي.) */
        const own = (Array.isArray(s.place_ids) && s.place_ids.length) ? s.place_ids : [String(s.place_id||'')];
        const want = String(extra.place_id||'');
        const pid = own.includes(want) ? want : String(s.place_id || own[0] || '');
        /* الكنس **قبل** الجلب لا بعده: لو جرى بعده لعرضت اللوحة طلبًا منقضيًا
           على أنه ينتظر ردًّا، ولوجد المالك زرَّي «قبول/رفض» على شيء انتهى. */
        await sbSweepExpiry(s);
        const [pl, fl, bk, st, all, sum] = await Promise.all([
          sbRest(`/places?select=*&id=eq.${pid}`, { token:s.at, key }),
          sbRest(`/fields?select=*&place_id=eq.${pid}&order=name`, { token:s.at }),
          sbBookingsQuery(`/bookings_full?select={cols}&place_id=eq.${pid}&order=booking_date.desc,hour.desc`, { token:s.at }),
          sbRest(`/place_stats?select=*&place_id=eq.${pid}`, { token:s.at }),
          /* أسماء أماكن المالك كلّها — داخل نفس الدفعة لا جلبةً جديدة، ولا
             تُطلَب أصلًا لمالكٍ له مكان واحد (وهي الحالة الغالبة). */
          own.length > 1
            ? sbRest(`/places?select=id,name&id=in.(${own.join(',')})&order=name`, { token:s.at })
            : Promise.resolve({ ok:true, data:[] }),
          /* ⚠️ **أربعة أعمدة لا الصفّ كلّه**: هذه مقارنةٌ بين الأماكن لا قائمة
             حجوزات، ولا داعي لجرّ الأسماء والأرقام عبر الشبكة لحساب مجاميع.
             وأعمدةٌ صريحة ⇒ لا `select=*` يفشل بعمودٍ ناقص في ترحيلٍ قادم. */
          own.length > 1
            ? sbRest(`/bookings_full?select=place_id,status,price,booking_date&place_id=in.(${own.join(',')})`, { token:s.at })
            : Promise.resolve({ ok:true, data:[] }),
        ]);
        if (!pl.ok || !(pl.data||[]).length) return { success:false, message:'ما لقينا المكان تبعك' };
        // ملاحظة: المالك يرى ملاعبه **الموقوفة** أيضًا — كان هذا عطلًا في الباكند القديم
        // (getPlaces يُسقط active=false) وصار مضمونًا هنا بسياسة owns_place في RLS.
        const place = sbPlace(pl.data[0], (st.data||[])[0]);
        place.fields = (fl.data||[]).map(sbField);
        return { success:true, place, fields: place.fields, bookings: (bk.data||[]).map(sbBooking),
                 place_id: pid, places: (all.data||[]).map(p => ({ place_id:String(p.id), place_name:p.name||'' })),
                 place_rows: (sum.data||[]).map(r => ({ place_id:String(r.place_id), status:String(r.status||''),
                                                        price:Number(r.price)||0, date:String(r.booking_date||'').split('T')[0] })) };
      }
      default:
        return { success:false, message:'صار خطأ، حاول كمان مرة' };
    }
  },

  async post(data, key) {
    switch(data.action){
      case 'playerRegister': {
        const phone = sbPhone(data.phone), name = String(data.name||'').trim(), pw = String(data.password||'');
        if (!name || !phone || !pw) return { success:false, message:'كمّل البيانات كلها عشان نكمل' };
        if (pw.length < 6) return { success:false, message:'كلمة السر لازم 6 حروف أو أرقام على الأقل' };
        const r = await sbFetch('/auth/v1/signup', { method:'POST', key, body:{ email: sbMail(phone), password: pw, data:{ name, phone } } });
        if (!r.ok){
          const msg = String(r.raw||'');
          if (msg.includes('already registered') || msg.includes('User already')) return { success:false, message:'الرقم عنده حساب، ادخل من هون' };
          return { success:false, message:'صار خطأ، حاول كمان مرة' };
        }
        // بلا جلسة في الردّ ⇒ «تأكيد البريد» ما زال مفعّلًا في إعدادات المشروع.
        if (!r.data || !r.data.access_token) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        const uid = r.data.user && r.data.user.id, at = r.data.access_token;
        await sbRest('/profiles', { method:'POST', token: at, body:{ id: uid, role:'player', name, phone, active:true } });
        const session = { at, rt:r.data.refresh_token, exp: Date.now() + (r.data.expires_in||3600)*1000,
                          uid:String(uid), role:'player', name, phone, place_id:'', verified:false };
        return { success:true, message:'تمام، حسابك جاهز', player_token: JSON.stringify(session),
                 player:{ player_id:String(uid), name, phone, verified:false } };
      }

      case 'updatePlayerProfile': {
        const s = await sbSession(data.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const name = String(data.name||'').trim();
        if (!name) return { success:false, message:'ما حطيت اسمك' };
        const r = await sbRest(`/profiles?id=eq.${s.uid}`, { method:'PATCH', token:s.at, prefer:'return=representation', body:{ name } });
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تم حفظ التعديلات', player:{ player_id:s.uid, name, phone:s.phone } };
      }

      /* «حذف الحساب» = **إغلاقه** (`profiles.active = false`).
         حذف مستخدم من `auth.users` يحتاج `service_role`، ووضع ذلك المفتاح في
         المتصفّح = تسليم القاعدة كاملةً — نفس سبب رفض «إعادة تعيين كلمة السرّ»
         في `/admin` (قرار ٥). والإغلاق يمنع الدخول فعليًّا لا شكليًّا:
         `sbLogin` يرفض أي حساب `active=false` قبل أن يُصدر جلسة.
         ⚠️ ولذلك نصّ التأكيد يقول ما يحدث بالضبط ولا يَعِد بمحو البيانات. */
      case 'deleteAccount': {
        const s = await sbSession(data.player_token, false);
        if (!s) return { success:false, message:'سجّل دخولك أول' };
        const r = await sbRest(`/profiles?id=eq.${s.uid}`, { method:'PATCH', token:s.at,
          prefer:'return=representation', body:{ active:false } });
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        // صفّ فارغ مع 200 = منعته RLS. قبول العملية ≠ نجاحها.
        if (!(r.data||[]).length) return { success:false, message:'ما بتقدر تحذف هذا الحساب' };
        return { success:true, message:'تم حذف حسابك' };
      }

      case 'requestPhoneCode': {
        const s = await sbSession(data.player_token, false);
        return sbRequestPhoneCode(s);
      }
      case 'verifyPhoneCode': {
        const s = await sbSession(data.player_token, false);
        return sbVerifyPhoneCode(s, data.code);
      }

      // يخدم اللاعب والمالك معًا — الفرق فقط أيّ توكن أُرسل
      case 'changePassword': {
        const isOwner = !!data.owner_token;
        return sbChangePassword(data.owner_token || data.player_token, isOwner,
                                data.current_password, data.new_password);
      }

      case 'createBooking':
        return sbCreateBooking(data, await sbSession(data.player_token, false));

      case 'ownerCreateManualBooking': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const r = await sbRest('/bookings', { method:'POST', token:s.at, prefer:'return=representation', body:{
          player_id: null, place_id: s.place_id, field_id: data.field_id,
          booking_date: data.date, hour: Number(data.hour), time_label: data.time || '',
          customer_name: String(data.name||'حجز خارجي').trim(), customer_phone: sbPhone(data.phone||''),
          players_size: data.players || '', price: Number(data.price||0),
          source: 'owner_manual', status: 'confirmed', cancel_reason: 'حجز خارجي أدخله المالك'
        }});
        if (!r.ok) return { success:false, message: (r.raw||'').includes('23505') ? 'هذا الوقت محجوز بالفعل' : 'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تم حفظ الحجز' };
      }

      case 'updateBookingStatus': {
        const s = await sbSession(data.owner_token || data.player_token, !!data.owner_token);
        return sbUpdateBookingStatus(data, s);
      }

      case 'playerRescheduleBooking':
        return sbRescheduleBooking(data, await sbSession(data.player_token, false));

      case 'ownerSetNoShow':
        return sbSetNoShow(data, await sbSession(data.owner_token, true));

      case 'watchSlot':
        return sbWatchSlot(data, await sbSession(data.player_token, false));

      case 'joinGame':
        return sbGameRpc('join_open_game',  { p_booking:String(data.booking_id) }, await sbSession(data.player_token, false));
      case 'leaveGame':
        return sbGameRpc('leave_open_game', { p_booking:String(data.booking_id) }, await sbSession(data.player_token, false));
      case 'removeGamePlayer':
        return sbGameRpc('remove_open_game_player', { p_booking:String(data.booking_id), p_first_name:String(data.first_name||'') }, await sbSession(data.player_token, false));
      case 'setOpenGame':
        return sbGameRpc('set_open_game', { p_booking:String(data.booking_id), p_open:!!data.open,
          p_needed: data.needed==null?null:Number(data.needed), p_brought: data.brought==null?null:Number(data.brought) },
          await sbSession(data.player_token, false));

      case 'ownerCloseField':
        return sbCloseField(data, await sbSession(data.owner_token, true));
      case 'ownerReopenDay':
        return sbReopen(data, await sbSession(data.owner_token, true));
      case 'ownerGetPriceRules':
        return sbGetPriceRules(data.field_ids||[], await sbSession(data.owner_token, true));
      case 'ownerAddPriceRule':
        return sbAddPriceRule(data, await sbSession(data.owner_token, true));
      case 'ownerDelPriceRule':
        return sbDelPriceRule(data.id, await sbSession(data.owner_token, true));

      case 'ownerUpdateField': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        const body = {};
        if (data.price  !== undefined) body.price  = Number(data.price||0);
        if (data.active !== undefined) body.active = data.active !== false;
        if (data.slots  !== undefined) body.slots  = parseSlots(data.slots).map(x => ({ h:x.hour, label:x.label }));
        const r = await sbRest(`/fields?id=eq.${data.field_id}`, { method:'PATCH', token:s.at, prefer:'return=representation', body });
        if (!r.ok || !(r.data||[]).length) return { success:false, message:'هذا الملعب مش تابع لحسابك' };
        return { success:true, message:'تم حفظ التعديلات' };
      }

      case 'ownerAddField': {
        const s = await sbSession(data.owner_token, true);
        if (!s) return { success:false, message:'انتهت جلستك، ادخل من جديد' };
        /* رياضة الملعب الجديد = رياضة ملاعب هذا المكان، لا `'football'` الافتراضية.
           بلا هذا السطر يُضيف صاحبُ نادي بادل ملعبًا من التطبيق فيُكتب **كرة قدم**،
           فيختفي من تصفّح البادل ويظهر في تصفّح كرة القدم — عطلٌ صامت لا يفهم
           صاحبه سببه. والقيمة تُقرأ من ملاعبه الحالية لأنها الحقيقة المسجَّلة،
           ولا شاشةَ في التطبيق تسأل عنها بعد (الرياضة تُسجَّل من `/admin`). */
        const own = (State.ownerData && State.ownerData.fields) || [];
        const sport = SPORT_KEYS.includes(data.sport) ? data.sport
                    : (own.length ? fieldSport(own[0]) : 'football');
        const body = {
          place_id: s.place_id, name: String(data.field_name||'ملعب').trim(), size: data.size || '5×5',
          price: Number(data.price||0), slots: parseSlots(data.slots).map(x => ({ h:x.hour, label:x.label })),
          image_url: data.image_url || '', active: true, sport
        };
        let r = await sbRest('/fields', { method:'POST', token:s.at, prefer:'return=representation', body });
        /* ترحيل 13 معلَّق على المالك ⇒ العمود غير موجود، وPostgREST يردّ
           `PGRST204: column "sport" ... does not exist`. **إضافة الملعب أهمّ من
           تسجيل رياضته**، فنعيدها بلا العمود بدل أن نُفشل عملًا صحيحًا لأجل
           حقلٍ لم يُنشأ بعد. وكل الملاعب حينها كرة قدم أصلًا، فلا شيء يُفقَد. */
        if (!r.ok && String(r.raw||'').includes('PGRST204')){
          delete body.sport;
          r = await sbRest('/fields', { method:'POST', token:s.at, prefer:'return=representation', body });
        }
        if (!r.ok) return { success:false, message:'صار خطأ، حاول كمان مرة' };
        return { success:true, message:'تمت إضافة الملعب' };
      }

      case 'createReview': {
        const s = await sbSession(Session.player(), false);
        const r = await sbRest('/reviews', { method:'POST', token: s ? s.at : undefined, body:{
          place_id: data.place_id, field_id: data.field_id || null,
          author_name: data.user_name || '', phone: sbPhone(data.phone||''),
          rating: Math.round(Number(data.rating||0)), comment: data.comment || ''
        }});
        /* حرّاس الترحيل 25 (تكرار · حدّ معدّل · رقم ناقص · استحقاق) يردّون
           رمزًا له اسم. و«في شي ناقص بالتقييم» على تقييمٍ مكتملٍ رُفض للتكرار
           جملةٌ كاذبة تجعل صاحبها يعيد الكتابة بلا فائدة. */
        if (!r.ok) return { success:false, message: dbErrorMessage(r.raw) || 'في شي ناقص بالتقييم' };
        return { success:true, message:'شكراً، تقييمك وصل' };
      }

      default:
        return { success:false, message:'صار خطأ، حاول كمان مرة' };
    }
  },

  /* ═══════════════════════════════════════════════════════════════════════
     لوحات AI — دالّة حافّة على Supabase، لا Apps Script

     ⚑ **ما كان قبل هذا لم يكن بطيئًا، كان مستحيلًا.** الطلب كان يذهب إلى
       Apps Script حاملًا توكن Supabase، وهناك `validateOwnerToken` تنتظر
       التوكن القديم (`base64(id|phone)`) ⇒ **كل طلب يُردّ بـ«انتهت جلستك»**
       مهما كانت طازجة. ولو مرّ لقرأ من Google Sheets التي توقّفت عن استقبال
       الكتابة يوم انتقل الحجز إلى Postgres. عطلان مستقلّان في المسار نفسه،
       وكلاهما يظهر للمالك رسالةً واحدة تقول «جرّب بعد قليل» — وهي كذبة:
       المحاولة لن تنجح أبدًا.

     ⚑ والمفتاح لا يصل المتصفّح: يعيش في أسرار Supabase وتقرؤه الدالّة وحدها.
       ولذلك لا يمكن أن تعمل هذه اللوحات «بلا عمل على المالك» — مفتاحُ نموذجٍ
       في يد كل مستخدم ليس سرًّا، وهذا ليس نقصًا في التنفيذ بل حدُّ المسألة.

     ⚑ **وما دامت غير منشورة لا شيء يتعلّق**: 404 تُترجَم `ai_not_deployed`،
       والواجهة تعرض **تحليلًا محسوبًا من أرقام المالك نفسها** وتقول صراحةً
       إنه محسوب لا ذكاء اصطناعي. الطقس يعمل بلا الدالّة أصلًا (م5).
     ═══════════════════════════════════════════════════════════════════════ */
  async getAi(kind, extra={}, key) {
    const s = await sbSession(Session.owner(), true);
    if (!s) return { success:false, code:'session' };
    if (!s.place_id) return { success:false, code:'no_place' };
    let res;
    try{
      res = await fetchWithTimeout(`${SB.URL}/functions/v1/ai`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', apikey: SB.KEY, Authorization:'Bearer ' + s.at },
        body: JSON.stringify({ kind, lang: extra.lang === 'en' ? 'en' : 'ar', place_id: s.place_id })
      }, CONFIG.AI_TIMEOUT, key);
    }catch(e){
      if (isAbort(e) || isTimeout(e)) throw e;
      return { success:false, code:'ai_not_deployed' };     // الشبكة وصلت المضيف ولم تجد المسار
    }
    // 404 = الدالّة غير منشورة · 401/403 = الجلسة أو الملكية، وكلاهما له نصّه
    if (res.status === 404) return { success:false, code:'ai_not_deployed' };
    let data = null; try { data = await res.json(); } catch(_){ data = null; }
    if (!data) return { success:false, code: res.ok ? 'ai_failed' : 'ai_not_deployed' };
    return data;
  }
};

/* ===================== STATE (حالة مغلّفة) ===================== */
const State = {
  // `allPlaces` ما وصل من الخادم · `places` مشتقّة منها بملاعب الرياضة الحالية (applySportScope)
  allPlaces: [], places: [], dataLoaded: false,
  publicBookings: [], bookedSlots: {},
  /* الإغلاقات (17) والأسعار (18) — خريطتان مشتقّتان تُبنيان مرّة عند الجلب.
     `closures[field_id][date] = [{from,to,reason}]` · `prices[field_id][date][hour] = n`
     وكلتاهما **فارغة قبل ترحيلها** ⇒ كل قارئ يقرأ «لا إغلاق» و«السعر الأساسي»،
     أي سلوك اليوم بالحرف. */
  closures: {}, prices: {}, pricesPlaceId: '',
  // (٤) المباريات المفتوحة — الوضع الافتراضي «ملاعب»، والمبدّل مخفيّ حتى يثبت
  // أن ترحيل 22 مُشغَّل وأن هناك جلسة.
  mode: 'venues', gmVis: 'private', gamesJoined: [], joinGame: null, matchBooking: null,
  publicBookingsFetchedAt: 0,                                 // آخر جلب ناجح للحجوزات العامة (كاش قصير)
  favOnly: false,                                             // عرض المفضّلة فقط (محلي)
  sport: 'football',                                          // الرياضة المختارة (كرة القدم متاحة، والبقية قريباً)
  // وضع عرض البطاقات (شبكة/قائمة) — محفوظ ويُستعاد بعد إعادة التحميل
  view: (()=>{ try{ return localStorage.getItem('mustadaira:viewMode')==='list'?'list':'grid'; }catch(_){ return 'grid'; } })(),
  player: null, owner: null, ownerData: null, guest: false,
  filter: 'all',                                              // المنطقة (تبويبات)
  // فلاتر متقدّمة (ورقة الفلاتر) + الترتيب — تعتمد فقط على البيانات الموجودة
  fx: { minPrice:null, maxPrice:null, sizes:[], types:[], minRating:0, availableToday:false, amenities:[], genders:[] },
  fxDraft: null,                                              // مسودّة أثناء فتح الورقة (تُلتزم عند "تطبيق")
  sort: 'default', sortDraft: 'default',
  showAllPlayer: false, showAllOwner: false,
  editingField: 'edit',
  refreshTimer: null,
  // اختيارات المستخدم (بدل المتغيرات العامة المتفرّقة)
  detail: { place:null, field:null, date: today(), hour:null },
  booking:{ place:null, field:null, date:null, hour:null, editing:true },   // null date ⇒ إفشاء تدريجي
  manual: { fieldId:null, date: today(), hour:null },
  reschedule: { booking:null, field:null, date:null, hour:null },   // تعديل موعد حجز معلّق
  review: { rating:0, placeId:null },
  pendingBooking: null,   // حجز الضيف المحفوظ ريثما يسجّل دخوله ثم يُستأنف
  pageScroll: {},         // موضع التمرير لكل صفحة (الرئيسية تستعيده دائمًا، والرجوع يستعيد صفحته)
  ownerTab: 'today',      // تبويب لوحة المالك النشط
  /* المكان المعروض في لوحة المالك — **حالة قابلة للتبديل** لا `session.place_id`.
     محفوظٌ كي لا يعود المالك إلى مكانه الأوّل بعد كل إعادة فتح، والخادم يفحصه
     ضدّ `place_ids` فقيمةٌ قديمة لمكانٍ لم يعد له تعود إلى المختار بلا خطأ. */
  ownerPlaceId: (()=>{ try{ return localStorage.getItem('mustadaira:ownerPlace')||''; }catch(_){ return ''; } })(),
  ownerView: 'cards',
  /* شكل عرض الحجوزات: قائمة أو تقويم. **والتقويم ليس قسمًا بل شكلَ عرضٍ لنفس
     الصفوف**، فلا يستحقّ خانةً في شريطٍ من أربع خانات على شاشة 375px — بينما
     «التقارير» (وهي جواب سؤال «هل يربحني هذا؟») كانت بلا خانة إطلاقًا. */
  ownerBkView: 'list',
  tlDate: null,           // اليوم المعروض في مخطّط المالك (‏null = اليوم)     // شكل تبويب «اليوم»: بطاقات · مخطّط زمني
  reportRange: 'all',     // نطاق التقارير: all · d30 · d90 (مرشِّح مُدخَل لا تعديل حساب)
  calMonth: null,         // شهر التقويم المعروض (Date لأول الشهر)
  lang: (()=>{ try{ return localStorage.getItem('mustadaira_language')||'ar'; }catch(_){ return 'ar'; } })(),
};

function normalizePlaces(remote){
  return (remote||[]).map(p => ({
    ...p, place_id:String(p.place_id), rating:safeRating(p.rating), reviews:safeReviews(p.reviews),
    /* `sport` يُطبَّع هنا أيضاً لا في `sbField` وحدها: هذا المسار يمرّ عليه
       **الكاش المحفوظ** الذي كُتب قبل ترحيل 13 (بلا العمود أصلاً). */
    fields:(p.fields||[]).map(f => ({ ...f, field_id:String(f.field_id), place_id:String(f.place_id),
      sport: fieldSport(f), attrs: (f.attrs && typeof f.attrs==='object' && !Array.isArray(f.attrs)) ? f.attrs : {} }))
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   الرياضة تقصّ **البيانات** لا العرض.

   البديل الذي رُفض: أن تفحص كل دالّة عرض `State.sport` بنفسها. ذلك يعني
   تعديل `renderPlaces` و`placeAvailability` و`distinctSizes` و`distinctTypes`
   وتبويبات المناطق وشريط الأرقام وصفحة التفاصيل — سبعة مواضع، ونسيانُ واحد
   يُظهر ملعب بادل في تصفية كرة القدم بلا أن يصرخ شيء.

   بدلاً منه: `State.allPlaces` هي ما وصل من الخادم، و`State.places` **مشتقّة**
   منها بملاعب الرياضة الحالية وحدها. فكل ما بُني على `State.places` — وهو
   كل شيء — صار مقصوراً على الرياضة بلا سطر واحد فيه.
   ⚠️ ومكانٌ لا ملعب له في هذه الرياضة يسقط كلّياً، تماماً كما يُسقط
   `sbGetInitialData` المكانَ بلا ملاعب: مكانٌ لا تستطيع حجز شيء فيه لا يُعرَض.
   ═══════════════════════════════════════════════════════════════════════════ */
function applySportScope(){
  const sp = SPORT_KEYS.includes(State.sport) ? State.sport : 'football';
  State.places = (State.allPlaces || [])
    .map(p => ({ ...p, fields: (p.fields||[]).filter(f => fieldSport(f) === sp) }))
    .filter(p => p.fields.length > 0);
}
/* «هل لهذه الرياضة ملعب فعلاً؟» — تُقرأ من البيانات لا من قيمة مكتوبة بيد.
   ⚠️ قبل وصول أيّ بيانات لا تُسأل هذه الدالّة أصلاً (‏`State.dataLoaded`)، وإلّا
      لومض شريط الرياضات «قريباً» على الخمس جميعاً ثمّ تراجع. */
const sportHasVenues = (key) => (State.allPlaces||[]).some(p => (p.fields||[]).some(f => fieldSport(f) === key));
function buildBookedSlots(remote){
  State.publicBookings = Array.isArray(remote) ? remote : [];
  State.bookedSlots = {};
  /* من `allPlaces` لا `places`: تبديل الرياضة لا يُعيد الجلب، فلو بُذرت مفاتيح
     الرياضة الحالية وحدها لبقيت ملاعب الرياضات الأخرى بلا مفتاح حتى الجلبة التالية. */
  (State.allPlaces||[]).forEach(p => p.fields.forEach(f => State.bookedSlots[f.field_id] = {}));
  State.publicBookings.forEach(b => {
    const s = normStatus(b); if (s==='cancelled'||s==='rejected') return;
    const fid = String(b.field_id||'').trim(); const hour = Number(b.hour); const date = String(b.date||'').trim().split('T')[0];
    if (!fid||!date||Number.isNaN(hour)) return;
    (State.bookedSlots[fid] ||= {});(State.bookedSlots[fid][date] ||= []);
    if (!State.bookedSlots[fid][date].includes(hour)) State.bookedSlots[fid][date].push(hour);
  });
}
/* ── خريطة الإغلاقات ─────────────────────────────────────────────────────
   تُبنى من صفوف `field_closures` مرّةً واحدة عند الجلب، فكل قارئ بعدها
   يفحص مصفوفةً قصيرة بلا بحث في القائمة كلّها. */
function buildClosures(rows){
  State.closures = {};
  (rows||[]).forEach(c => {
    const fid = String(c.field_id||''), d = String(c.closure_date||'').split('T')[0];
    if(!fid || !d) return;
    const from = (c.from_hour===null || c.from_hour===undefined) ? null : Number(c.from_hour);
    const to   = (c.to_hour  ===null || c.to_hour  ===undefined) ? null : Number(c.to_hour);
    ((State.closures[fid] ||= {})[d] ||= []).push({ from, to, reason: String(c.reason||'') });
  });
}
/* الإغلاق الذي يغطّي خانةً بعينها، أو `null`.
   ⚠️ الاختبار **تداخل** لا احتواء: الخانة ساعتان، فخانة تبدأ 18 يغطّيها إغلاق
      [19,22) ولو بدأت قبله. نفس الشرط حرفيًّا في `fn_closure_guard` بالقاعدة. */
function slotClosure(fid, date, hour){
  const list = (State.closures[String(fid)] || {})[date] || [];
  for(const c of list){
    if(c.from===null) return c;                        // اليوم كلّه
    if(hour < c.to && hour + 2 > c.from) return c;     // تداخل
  }
  return null;
}
const dayClosure  = (fid, date) => ((State.closures[String(fid)] || {})[date] || []).find(c => c.from===null) || null;
const isSlotOpen  = (fid, date, hour) => !slotClosure(fid, date, hour);
/* الخانات القابلة للبيع فعلًا في يوم — الأساس الذي تُبنى عليه كل نسبة إشغال
   وكل «إيراد ضائع». عدُّ خانةٍ مغلقة فارغةً يجعل جمعةَ الصيانة خسارةً أبدية. */
function openSlotsFor(field, date){
  return fieldSlots(field).filter(s => isSlotOpen(field.field_id, date, s.hour));
}

/* ── خريطة الأسعار ────────────────────────────────────────────────────────
   الشبكة تحمل **المختلف عن السعر الأساسي وحده** (ترحيل 18)، فالغياب هنا
   ليس نقصًا في البيانات بل معلومة: «سعر الملعب كما هو». */
function buildPrices(rows, placeId){
  State.prices = {}; State.pricesPlaceId = String(placeId||'');
  (rows||[]).forEach(r => {
    const fid = String(r.field_id||''), d = String(r.d||'').split('T')[0], hr = Number(r.hour);
    if(!fid || !d || Number.isNaN(hr)) return;
    ((State.prices[fid] ||= {})[d] ||= {})[hr] = Number(r.price);
  });
}
function slotPrice(field, date, hour){
  const v = ((State.prices[String(field&&field.field_id)] || {})[date] || {})[hour];
  return (typeof v === 'number' && !Number.isNaN(v)) ? v : Number((field && field.price) || 0);
}
const slotPriceDiffers = (field, date, hour) => slotPrice(field, date, hour) !== Number((field && field.price) || 0);

const cacheRead = () => { try { const c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY)||'null'); if(!c||!c.time||!Array.isArray(c.places))return null; if(Date.now()-c.time>CONFIG.CACHE_MS)return null; return c.places; } catch(_){ return null; } };
const cacheSave = (d) => { try { localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ time:Date.now(), places:d })); } catch(_){} };

async function loadInitialData(force=false){
  const r = await API.get('getInitialData', { force:force?'1':'0' }, 'initialData');
  const remote = Array.isArray(r) ? r : (r.places||[]);
  State.allPlaces = normalizePlaces(remote);
  State.dataLoaded = true;
  applySportScope();
  if (State.allPlaces.length) cacheSave(State.allPlaces);
  buildBookedSlots(r.bookings||[]);
  buildClosures(r.closures||[]);
  State.publicBookingsFetchedAt = Date.now();                 // بيانات حجوزات طازجة من الخادم
}
async function loadPublicBookings(){
  const r = await API.get('getBookings', {}, 'publicBookings');
  buildBookedSlots(Array.isArray(r) ? r : (r.bookings||[]));
  if (r && !Array.isArray(r) && r.closures) buildClosures(r.closures);
  State.publicBookingsFetchedAt = Date.now();
}
/* أسعار مكان واحد — تُجلَب عند فتح تفاصيله وتُستبدل عند فتح غيره.
   لا نحتفظ بشبكات كل الأماكن: الشاشة الواحدة تحتاج واحدة، والذاكرة أرخص
   من طلبٍ زائد لكنّ الشبكة القديمة أخطر — سعرٌ من مكانٍ آخر يُعرَض. */
async function loadPriceGrid(placeId){
  if (String(placeId||'') === State.pricesPlaceId) return;
  buildPrices([], placeId);                    // امسح فورًا: لا سعر مكانٍ سابق يُعرَض للحظة
  try { buildPrices(await API.get('getPriceGrid', { place_id: placeId }, 'priceGrid'), placeId); }
  catch(_){ /* الشبكة أو الترحيل — والسعر الأساسي هو الاحتياطي الصحيح */ }
}
/* كاش قصير: يجلب الحجوزات فقط إذا مرّ أكثر من maxAgeMs منذ آخر جلب ناجح.
   التحقق النهائي قبل الحفظ (confirmBooking/saveManual) يبقى جلباً مباشراً طازجاً. */
async function ensurePublicBookings(maxAgeMs = 45000){
  if (Date.now() - (State.publicBookingsFetchedAt||0) < maxAgeMs) return;
  await loadPublicBookings();
}
async function loadData(opts={}){
  /* شريط الرياضات يُعاد رسمه مع كل جلبة لأن حالة كل رياضة («متاح»/«قريباً»)
     مشتقّة من البيانات نفسها: ملعب بادل يُسجَّل في اللوحة الآن ⇒ تُفتَح بادل
     عند أوّل تحديث، بلا نشر نسخة جديدة من التطبيق. */
  checkAppVersion();   // بلا await: خبرٌ لا يؤخّر رسم الصفحة
  try { await loadInitialData(!!opts.force); renderSportTabs(); renderSportDropdown(); updateSportSections(); renderRegionTabs(); updateTrust(); updateModeSeg(); return true; }
  catch(e){
    if (isAbort(e)) return false;                          // ألغاه طلب أحدث — تجاهل
    const cached = cacheRead();
    if (cached && cached.length){ State.allPlaces = normalizePlaces(cached); State.dataLoaded = true; applySportScope(); buildBookedSlots([]); renderSportTabs(); renderSportDropdown(); updateSportSections(); renderRegionTabs(); updateTrust(); toast(t('apiCached'),'warn'); return true; }
    return false;
  }
}
/* عدّاد متحرّك (count-up) — يُحترم reduced-motion ويعمل مرة واحدة */
let trustAnimated=false;
function animateCount(el, target, ms=1100){
  if(!el) return;
  if(target<=0 || matchMedia('(prefers-reduced-motion:reduce)').matches){ el.textContent=target+'+'; return; }
  const t0=performance.now();
  (function tick(now){
    const p=Math.min((now-t0)/ms,1), eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(target*eased)+(p>=1?'+':'');
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}
function updateTrust(){
  const el=$('#trustPlaces'); if(!el || !State.places.length) return;
  const total=State.places.reduce((s,p)=>s+(p.fields||[]).length,0);
  if(trustAnimated){ el.textContent=total+'+'; } else { trustAnimated=true; animateCount(el,total); }
}

/* ===================== UI: TOAST / LOADING ===================== */
function toast(message, type='error', ms=3400){
  const el = $('#toast'); if(!el) return;
  const icons = { success:'✓', error:'✕', warn:'!' };
  clear(el);
  el.append(h('span',{class:'toast-icon'}, icons[type]||'!'), h('span',{}, message));
  el.className = 'toast ' + type;
  clearTimeout(toast._t);
  requestAnimationFrame(() => el.classList.add('show'));
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

/* مؤشّر تحميل على الزر + تعطيله (يمنع النقر المزدوج Double-Submit) */
async function withLoading(btn, fn){
  if (!btn || btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  const original = btn.innerHTML;                 // محتوى الزر نفسه (موثوق) — نعيده لاحقاً
  btn.classList.add('is-loading'); btn.setAttribute('disabled','');
  clear(btn); btn.append(h('span', { class:'spinner' + (btn.classList.contains('cbtn')?' dark':'') }));
  try { return await fn(); }
  finally { btn.classList.remove('is-loading'); btn.removeAttribute('disabled'); btn.innerHTML = original; delete btn.dataset.busy; }
}

/* skeleton placeholders */
function placesSkeleton(){
  // سبينر Dual-Orbit (مدارٌ نُحاسي + نعناعي معاكس + نواة) — وسط منطقة الصورة
  const loader = () => h('div',{class:'place-loader'},
    h('span',{class:'place-loader-orbit o-outer','aria-hidden':'true'}),
    h('span',{class:'place-loader-orbit o-inner','aria-hidden':'true'}),
    h('span',{class:'place-loader-core','aria-hidden':'true'}));
  const one = () => h('div',{class:'skeleton-card', role:'status', 'aria-live':'polite'},
    h('div',{class:'sk-img'}, loader(), h('span',{class:'sr-only'}, t('loadingFields'))),
    h('div',{class:'sk-body'},
      h('div',{class:'sk sk-line w70'}),   // اسم الملعب
      h('div',{class:'sk sk-line w45'}),   // الموقع
      h('div',{class:'sk sk-line w88'}),   // السعر / بيانات
      h('div',{class:'sk sk-cta'})));      // زر الحجز
  const el = $('#placesList'); if(!el) return; clear(el); el.append(one(), one(), one());
}
function timeSkeleton(el, count=6){ if(!el) return; clear(el);
  const wrap = h('div',{class:'time-skeleton', style:{gridColumn:'1/-1'}});
  for(let i=0;i<count;i++) wrap.append(h('span',{class:'sk'}));
  el.append(wrap);
}

/* حالة فراغ جذّابة (Empty State) بدل النص العادي */
/* iconHtml: بديل اختياري للرمز التعبيري بـSVG ثابت (مخطّط ملعب). يُمرَّر عبر
   props.html وهو محجوز للسلاسل الثابتة في هذا الملفّ ⇒ لا مدخل مستخدم فيه. */
function emptyState({icon='🗂️', iconHtml=null, title, sub, actionLabel, action, secondaryLabel, secondaryAction}){
  const box = h('div',{class:'empty'},
    iconHtml ? h('div',{class:'empty-icon empty-court', html:iconHtml})
             : h('div',{class:'empty-icon'}, icon),
    h('div',{class:'empty-title'}, title),
    sub && h('div',{class:'empty-sub'}, sub)
  );
  if (actionLabel && action) box.append(h('button',{class:'sbtn',onclick:action}, actionLabel));
  if (secondaryLabel && secondaryAction) box.append(h('button',{class:'cbtn empty-2nd',onclick:secondaryAction}, secondaryLabel));
  return box;
}

/* ===================== VALIDATION (أخطاء Inline أسفل الحقل) ===================== */
const digits = (s) => String(s||'').replace(/\D/g,'');
/* الرقم الأردني بعد التوحيد: `962` ثمّ `7` ثمّ `7/8/9` ثمّ ثمانية أرقام.
   ⚠️ وكان `digits(p).length >= 9` — «تسعة أرقام فأكثر». وتساهلٌ كهذا لا يفتح
   بابًا للأخطاء فحسب، بل **يصنع حسابين لشخص واحد**: صيغةٌ لا يعرفها
   `normalizePhone` تمرّ التحقّق وتُكتب كما هي، فتصير هويّةً ثانية للرقم نفسه.
   فالتحقّق والتوحيد وجهان لقاعدة واحدة، ولا يجوز أن يقبل الأوّل ما يجهله
   الثاني. والفحص على **الناتج الموحَّد** لا على المدخَل الخام. */
const JO_PHONE_RE = /^9627[789]\d{7}$/;
const validPhone = (p) => JO_PHONE_RE.test(normalizePhone(p));
function setFieldError(id, msg){
  const el=$('#'+id); if(!el) return;
  el.classList.add('input-error'); el.setAttribute('aria-invalid','true');
  let m=el.nextElementSibling;
  if(!(m && m.classList && m.classList.contains('field-err'))){ m=h('div',{class:'field-err'}); el.insertAdjacentElement('afterend', m); }
  m.textContent=msg; el.setAttribute('aria-describedby', (el.id||'')+'-err'); m.id=(el.id||'')+'-err';
  if(!el.dataset.errBound){ el.dataset.errBound='1'; el.addEventListener('input', ()=>clearFieldError(id)); }
}
function clearFieldError(id){
  const el=$('#'+id); if(!el) return;
  el.classList.remove('input-error'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
  const m=el.nextElementSibling; if(m && m.classList && m.classList.contains('field-err')) m.remove();
}
function focusFirstError(scope){ const el=(scope||document).querySelector('.input-error'); if(el){ try{ el.focus({preventScroll:false}); }catch(_){ el.focus(); } el.scrollIntoView({block:'center',behavior:'smooth'}); } }

/* ===================== PENDING BOOKING (استئناف حجز الضيف بعد الدخول) ===================== */
const PENDING_KEY = 'mustadaira:pending';
function savePendingBooking(){
  const d=State.detail; if(!d.place||!d.field) return;   // المصدر الوحيد = State.detail
  State.pendingBooking = { placeId:String(d.place.place_id), fieldId:String(d.field.field_id), date:d.date, hour:d.hour };
  try{ localStorage.setItem(PENDING_KEY, JSON.stringify(State.pendingBooking)); }catch(_){}
}
function loadPendingBooking(){
  if(State.pendingBooking) return State.pendingBooking;
  try{ const p=JSON.parse(localStorage.getItem(PENDING_KEY)||'null'); if(p&&p.placeId) return (State.pendingBooking=p); }catch(_){}
  return null;
}
function clearPendingBooking(){ State.pendingBooking=null; try{ localStorage.removeItem(PENDING_KEY); }catch(_){} }
async function resumePendingBooking(){
  const p=loadPendingBooking(); if(!p) return false;
  if(!State.places.length){ try{ await loadData(); }catch(_){} }
  const place=State.places.find(x=>String(x.place_id)===String(p.placeId));
  if(!place){ clearPendingBooking(); return false; }
  const field=place.fields.find(f=>String(f.field_id)===String(p.fieldId))||place.fields[0];
  await openDetail(place.place_id, {awaitFresh:true});               // يجلب أحدث الحجوزات العامة + يبني التفاصيل
  State.detail.field=field; State.detail.date=p.date; State.detail.hour=p.hour;
  renderSubFields(); renderDetailDays(); renderDetailTimes(); setText('dPrice', formatCurrency(field.price));
  clearPendingBooking();
  // تحقّق أن الوقت ما زال متاحاً قبل فتح المراجعة
  const taken=(State.bookedSlots[field.field_id]?.[p.date])||[];
  if(taken.includes(Number(p.hour))){
    State.detail.hour=null; renderDetailTimes(); renderDetailSticky();
    toast(t('bookingConflict'),'warn');
    scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)');
    return true;
  }
  renderDetailSticky();
  openBookingReview();                                               // الآن مسجّل ⇒ تظهر المراجعة مباشرة
  return true;
}

/* ===================== AUTH CHOICE (للضيف عند التأكيد) ===================== */
function openAuthChoice(){ Modal.open('modal-authchoice'); }

/* ===================== (٥) تعديلات لم تُحفظ =====================
   النوافذ ذات الإدخال تُغلق بأربعة مسارات (زرّ · Escape · نقر خارجها · سحب لأسفل)،
   وكلّها كانت تبتلع ما كتبه المستخدم بصمت. العلَم يُرفع بأي **إدخال أو اختيار** —
   والاختيار هنا ليس حقلًا (أزرار الأيام والأوقات والنجوم) فلا يكفي حدث `input`.
   يُنزَّل عند فتح النافذة (المحتوى يُعاد بناؤه) وعند الحفظ الناجح. */
const DIRTY_MODALS = ['modal-field','modal-review','modal-manual','modal-reschedule'];
const Dirty = {
  _set: new Set(),
  mark(id){ if(DIRTY_MODALS.includes(id)) this._set.add(id); },
  clear(id){ id ? this._set.delete(id) : this._set.clear(); },
  has(id){ return this._set.has(id); },
  init(){
    DIRTY_MODALS.forEach(id=>{
      const o=$('#'+id); if(!o) return;
      const on=()=>Dirty.mark(id);
      o.addEventListener('input', on);
      o.addEventListener('change', on);
      o.addEventListener('click', (e)=>{ if(e.target.closest('.day-btn,.tbtn,.star')) on(); });
    });
  }
};
/* يُستدعى من كل مسارات الإغلاق. ⚠️ فتح نافذة التأكيد يُخفي النافذة القذرة
   (‏`Modal.open` ينادي `closeAll`)، فإن اختار «أكمل التعديل» نعيد إظهارها —
   ومحتواها باقٍ في DOM كما تركه، ولذلك نُبقي العلَم مرفوعًا (keepDirty). */
async function confirmDiscard(id){
  const ok = await askConfirm(t('unsavedTitle'), t('unsavedMsg'), t('unsavedDiscard'), t('unsavedKeep'), true);
  const o=$('#'+id); if(!o) return;
  if(ok){ Dirty.clear(id); o.classList.remove('show'); Modal._afterClose(); }
  else Modal.open(id, true);
}

