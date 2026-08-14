/* ===================== MODAL (+ swipe to close) ===================== */
const Modal = {
  _last:null,
  open(id, keepDirty){ const o=$('#'+id); if(!o) return; if(!keepDirty) Dirty.clear(id); this.closeAll(o); this._last=document.activeElement; o.classList.add('show'); document.body.classList.add('modal-open');
    const panel=o.querySelector('.modal,.scard'); if(panel){ panel.setAttribute('tabindex','-1'); requestAnimationFrame(()=>{ try{ panel.focus({preventScroll:true}); }catch(_){} }); } },
  /* force=true يتخطّى سؤال «تعديلات لم تُحفظ» — يستعمله مسار الحفظ الناجح وحده */
  close(id, force){
    const o = id ? $('#'+id) : $('.modal-overlay.show');
    if(!o){ this._afterClose(); return; }
    if(!force && Dirty.has(o.id)){ confirmDiscard(o.id); return; }
    Dirty.clear(o.id); o.classList.remove('show'); this._afterClose();
  },
  closeAll(except){ $$('.modal-overlay.show, .success-overlay.show').forEach(o=>{ if(o!==except) o.classList.remove('show'); }); },
  _afterClose(){
    if($$('.modal-overlay.show, .success-overlay.show').length) return;   // ما زالت نافذة مفتوحة
    document.body.classList.remove('modal-open');
    if(this._last && this._last.focus){ try{ this._last.focus({preventScroll:true}); }catch(_){} this._last=null; }
  },
};
/* السحب لأسفل لإغلاق النافذة — transform فقط لضمان 60fps */
function enableSwipe(overlay){
  const modal = $('.modal', overlay); if(!modal) return;
  const grip = $('.modal-grip', modal) || modal;
  let startY = 0, dy = 0, active = false;
  grip.addEventListener('touchstart', e => { startY = e.touches[0].clientY; active = true; dy = 0; modal.classList.add('dragging'); }, { passive:true });
  // النوافذ الحرجة (data-safe-close كنافذة مراجعة الحجز): مقاومة بصرية + مسافة إغلاق أكبر بكثير
  grip.addEventListener('touchmove', e => { if(!active) return; dy = Math.max(0, e.touches[0].clientY - startY); const damp = modal.dataset.safeClose ? 0.45 : 1; modal.style.transform = `translate3d(0,${dy*damp}px,0)`; }, { passive:true });
  // الإغلاق بالسحب يمرّ بـModal.close كي يسأل عن التعديلات غير المحفوظة كبقية المسارات
  const end = () => { if(!active) return; active = false; modal.classList.remove('dragging'); modal.style.transform = ''; const limit = modal.dataset.safeClose ? 250 : 110; if (dy > limit){ Modal.close(overlay.id); } dy = 0; };
  grip.addEventListener('touchend', end); grip.addEventListener('touchcancel', end);
}

/* سحبٌ **أفقي** بين شرائح — أخو `enableSwipe` الرأسي أعلاه، ومنفصلٌ عنه لأن
   المحور مختلف والقرار مختلف (ذاك يُغلق نافذة، وهذا ينتقل خطوةً في الاتّجاهين).
   ⚠️ و`transform` فيزيائي بينما «التالي» منطقي: في RTL تصطفّ الشرائح من اليمين
   فالتقدّم سحبٌ إلى **اليمين** (‏dx موجب) لا إلى اليسار. ولذلك يُضرَب الفارق في
   اتّجاه المستند لا يُقرأ خامًا — وهو نفس درس `--nav-dir` في الورقة.
   ⚠️ ويُلغى السحب إن غلب الميلُ الرأسيَّ: الشريحة قد تتمرّر عموديًّا على شاشةٍ
   قصيرة، وابتلاعُ ذلك التمرير يجعلها تبدو معلّقة.
   `cb(+1)` = تقدّم · `cb(-1)` = رجوع. */
function enableSwipeX(track, cb){
  if(!track || track.__swipeX) return; track.__swipeX = true;
  let x0=0, y0=0, on=false;
  track.addEventListener('touchstart', e=>{ const p=e.touches[0]; x0=p.clientX; y0=p.clientY; on=true; }, { passive:true });
  track.addEventListener('touchend', e=>{
    if(!on) return; on=false;
    const p=e.changedTouches && e.changedTouches[0]; if(!p) return;
    const dx=p.clientX-x0, dy=p.clientY-y0;
    if(Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)*1.2) return;
    const dirx = (document.documentElement.dir === 'rtl') ? -1 : 1;
    cb((dx * dirx) < 0 ? 1 : -1);
  }, { passive:true });
  track.addEventListener('touchcancel', ()=>{ on=false; }, { passive:true });
}

/* ===================== RENDER: HOME / PLACES ===================== */
function getRegions(){ const seen=new Set(), out=[]; State.places.forEach(p=>{ const r=String(p.region||'').trim(); if(!r||normalizeText(r)==='all')return; const k=normalizeText(r); if(seen.has(k))return; seen.add(k); out.push(r); }); return out; }
function renderRegionTabs(){
  const el = $('#regionTabs'); if(!el) return;
  const regions = getRegions();
  if (State.filter!=='all' && !regions.some(r=>normalizeText(r)===normalizeText(State.filter))) State.filter='all';
  clear(el);
  /* ⚠️ شريحة القلب حُذفت من هنا: صارت «المفضّلة» زرًّا في الشريط السفلي.
     بابان لميزةٍ واحدة انحرافٌ مؤجَّل — أحدهما يُنسى عند أوّل تعديل. وشريط
     المناطق صار **تصفيةَ منطقةٍ وحدها**، تعمل داخل المفضّلة كما تعمل خارجها. */
  el.append(h('button',{class:'ftab'+(State.filter==='all'?' active-tab':''), onclick:()=>setFilter('all')}, t('all')));
  regions.forEach(r => el.append(h('button',{class:'ftab'+(normalizeText(r)===normalizeText(State.filter)?' active-tab':''), onclick:()=>setFilter(r)}, r)));
}
/* عنوان قسم الرئيسية يتبع الحالة: مباريات ⇐ مفضّلة ⇐ الملاعب المتاحة.
   ثلاث حالات ومصدرٌ واحد — وإلّا بقي «الملاعب المتاحة» فوق قائمة مفضّلة. */
function updateSecTitle(){
  const ttl=$('#secTitleTxt'); if(!ttl) return;
  const k = State.mode==='games' ? 'modeGamesTitle' : State.favOnly ? 'favTab' : 'availableFields';
  ttl.textContent=t(k); ttl.setAttribute('data-i18n',k);
}
function setFilter(f){ State.filter=f; renderRegionTabs(); renderPlaces(); }

/* ═══════════════════════════════════════════════════════════════════════════
   الرياضات (تقسيمة أعلى الرئيسية)

   ⚑ **`ready` لم تعد مكتوبة هنا.** كانت `{football:true, …:false}` قيمةً في
     الكود، فكان فتح البادل يستلزم نشر نسخة جديدة من التطبيق **بعد** تسجيل
     ملاعبها — وبينهما نافذةٌ يرى فيها اللاعب «قريباً» وفي القاعدة ملاعب بادل
     جاهزة (أو أسوأ: العكس، فيُفتَح البابُ على لا شيء).
     الآن تُشتقّ من البيانات: رياضةٌ لها ملعبٌ نشط واحد **هي** المفتوحة.
     وهذا يجعل «إضافة مكان» في `/admin` هي الفعل الذي يفتح الرياضة — بضغطة.
   ⚑ قرار ٧ محفوظ: هذا الجدول ما زال مصدر الحقيقة لأسماء الرياضات وأيقوناتها،
     وقسم «الرياضات» في الموقع مرآةٌ له يقرأ حالته من العرض `sport_availability`
     وقت البناء ⇒ لا يَعِد الموقع بما لا يعطيه التطبيق.
   ═══════════════════════════════════════════════════════════════════════════ */
const SPORTS=[
  {key:'football', label:'sportFootball', icon:'ball'},
  {key:'padel',    label:'sportPadel',    icon:'padel'},
  {key:'basket',   label:'sportBasket',   icon:'basket'},
  {key:'tennis',   label:'sportTennis',   icon:'tennis'},
  {key:'volley',   label:'sportVolley',   icon:'volley'},
];
/* قبل وصول البيانات لا حكم: لا شارة «قريباً» ولا وعد بالفتح. الوسم الوحيد
   الصادق حينها هو **لا وسم** — والشريط يُعاد رسمه فور وصول أوّل جلبة. */
const sportReady = (key) => !State.dataLoaded || sportHasVenues(key);
const sportSoon  = (key) => State.dataLoaded && !sportHasVenues(key);
function renderSportTabs(){
  const el=$('#sportTabs'); if(!el) return; clear(el);
  SPORTS.forEach(s=>{
    const active=State.sport===s.key, soon=sportSoon(s.key);
    // حبّة مضغوطة: أيقونة + اسم على سطر واحد، وشارة «قريباً» داخل الحبّة بعد الاسم
    const ic=h('span',{class:'sport-ic', html:ICON[s.icon]||ICON.ball, 'aria-hidden':'true'});
    const b=h('button',{class:'sport-tab'+(active?' active':''), type:'button',
      'aria-pressed':active?'true':'false',
      'aria-label': soon ? t(s.label)+' — '+t('soonBadge') : t(s.label)},
      ic,
      h('span',{class:'sport-name'}, t(s.label)));
    if(soon) b.append(h('span',{class:'sport-soon','aria-hidden':'true'}, t('soonBadge')));
    b.addEventListener('click', ()=>setSport(s.key));
    el.append(b);
  });
}
function setSport(k){
  if(State.sport===k) return;
  State.sport=k;
  applySportScope();                    // البيانات تُقصّ أولاً، ثمّ يُرسَم ما بُني عليها
  State.filter='all';                   // منطقة كرة القدم قد لا توجد في البادل أصلاً
  renderSportTabs(); renderSportDropdown(); updateSportSections();
  renderRegionTabs(); updateFilterBar(); renderPlaces();
}
/* قائمة الرياضات المنسدلة في شريط التصفّح (مزامنة مع مبدّل الفلاتر عبر setSport) */
function renderSportDropdown(){
  const cur=SPORTS.find(s=>s.key===State.sport)||SPORTS[0];
  const ic=$('#sportDDIc'); if(ic) ic.innerHTML=ICON[cur.icon]||ICON.ball;   // SVG ثابت موثوق
  setText('sportDDName', t(cur.label));
  const menu=$('#sportDDMenu'); if(!menu) return; clear(menu);
  SPORTS.forEach(s=>{
    const active=State.sport===s.key;
    const item=h('button',{class:'sport-dd-item'+(active?' active':''), type:'button', role:'option', 'aria-selected':active?'true':'false'},
      h('span',{class:'sport-dd-ic', html:ICON[s.icon]||ICON.ball, 'aria-hidden':'true'}),
      h('span',{class:'sport-dd-lbl'}, t(s.label)));
    if(sportSoon(s.key)) item.append(h('span',{class:'sport-dd-soon'}, t('soonBadge')));
    item.addEventListener('click',()=>{ setSport(s.key); closeSportDD(); });
    menu.append(item);
  });
}
function toggleSportDD(){
  const dd=$('#sportDD'); if(!dd) return;
  const open=dd.classList.toggle('open');
  $('#sportDDMenu').hidden=!open; $('#sportDDBtn')?.setAttribute('aria-expanded', open?'true':'false');
}
function closeSportDD(){
  const dd=$('#sportDD'); if(!dd || !dd.classList.contains('open')) return;
  dd.classList.remove('open'); $('#sportDDMenu').hidden=true; $('#sportDDBtn')?.setAttribute('aria-expanded','false');
}
/* إخفاء أدوات التصفّح (المناطق/العنوان) عند اختيار رياضة لا ملعب لها بعد —
   المعيار الآن **وجود ملاعب** لا اسم الرياضة: تصفيةُ لا شيء بمناطق لا شيء عبث.
   زرّ الفلاتر يبقى ظاهرًا لأن مُبدِّل الرياضات صار داخل ورقة الفلاتر (وإلا انحبس المستخدم). */
function updateSportSections(){
  const off=sportSoon(State.sport);
  ['#regionTabs','#page-home .sec-title'].forEach(sel=>{ const n=$(sel); if(n) n.style.display=off?'none':''; });
}

/* تحليل مركزي للمرافق (يُستخدم في البطاقة والتفاصيل والفلاتر).
   الصيغة: "water|parking|vests:10" — القيمة بعد ':' تمثّل عدداً/تفصيلاً اختيارياً. */
function parseAmenities(text){
  return String(text||'').split('|').map(s=>s.trim()).filter(Boolean).map(item=>{
    const [rawKey,...rest]=item.split(':');
    const key=(rawKey||'').trim(); const value=rest.join(':').trim();
    const meta=AMENITY[key]||{icon:'dot'};
    return { key, icon:meta.icon||'dot', labelKey:meta.labelKey, value };
  });
}
function amenityKeys(p){ return parseAmenities(p?.amenities).map(a=>a.key); }
function amenitiesRow(text, max){
  const items=parseAmenities(text);
  if(!items.length) return null;
  const shown = max ? items.slice(0,max) : items;
  const row=h('div',{class:'amenities-row'});
  shown.forEach(a=> row.append(h('span',{class:'amenity-chip'}, ico(a.icon,'svg-sm'), ' '+amenityLabel(a))));
  if(max && items.length>max) row.append(h('span',{class:'amenity-chip amenity-more'}, `+${items.length-max}`));
  return row;
}
/* مرافق بطاقة الملعب: **أيقونات لا شرائح**. الشريحة صفٌّ بارتفاع 30px لنصّ 10px،
   أي صفٌّ كامل لمعلومة ثانوية في أضيق مساحة في التطبيق.
   ⚠️ والأيقونة وحدها لا تُقرأ بالسمع: كلٌّ منها `role="img"` **مع** `aria-label`
   يحمل اسم المرفق كاملًا — ولا `aria-hidden` عليها إطلاقًا (السمتان معًا على
   العنصر نفسه تعنيان لا شيء: الثانية تحذفه من شجرة الوصول فلا يبقى للأولى أثر).
   و`title` كي يصل الاسم بالمؤشّر أيضًا لا بقارئ الشاشة وحده. */
function amenityIcons(text, max){
  const items=parseAmenities(text);
  if(!items.length) return null;
  const shown = max ? items.slice(0,max) : items;
  const row=h('div',{class:'amen-icons'});
  shown.forEach(a=>{
    const lbl=amenityLabel(a);
    row.append(h('span',{class:'amen-ic-only', role:'img', 'aria-label':lbl, title:lbl}, ico(a.icon,'svg-sm')));
  });
  if(max && items.length>max) row.append(h('span',{class:'amen-ic-more'}, `+${items.length-max}`));
  return row;
}
/* تحويل قيمة الخدمة إلى نص واضح حسب اللغة (لا إنجليزية داخل العربية) */
function amenityValueText(value, label){
  const v=String(value||'').trim(); if(!v) return t('available');
  if(/^\d+$/.test(v)) return `${v} ${label}`;                 // عدد: 10 بلوزات / 10 vests
  const map = { free:'amenFree', paid:'amenPaid', available:'available', yes:'available', no:'amenNotAvail', 'true':'available', 'false':'amenNotAvail' };
  const key = map[v.toLowerCase()];
  return key ? t(key) : v;
}
/* قسم "الخدمات والمرافق" الكامل في صفحة التفاصيل (كل الخدمات الفعلية بلا تكرار) */
function renderAmenitiesFull(p){
  const el=$('#detailAmenities'); if(!el) return; clear(el);
  const items=parseAmenities(p?.amenities);
  if(!items.length){ el.append(h('div',{class:'amen-empty'}, t('noServices'))); return; }
  const grid=h('div',{class:'amen-grid'});
  items.forEach(a=>{
    const lbl = amenityLabel(a);
    grid.append(h('div',{class:'amen-item'},
      h('span',{class:'amen-ic'}, ico(a.icon,'svg-sm')),
      h('div',{class:'amen-text'}, h('div',{class:'amen-name'}, lbl), h('div',{class:'amen-val'}, amenityValueText(a.value, lbl)))));
  });
  el.append(grid);
}

/* ===================== AVAILABILITY (حالات دقيقة) + SORT + FILTERS ===================== */
/* حالة المكان: متاح اليوم / متاح لاحقاً / مكتمل اليوم / لا أوقات — بحساب فعلي للخانات */
function placeAvailability(p){
  const td=today(); let todayTotal=0, todayFree=0, weekFree=0;   // td كي لا تُظلَّل دالة الترجمة t()
  (p.fields||[]).forEach(f=>{
    if(f.active===false) return;
    /* الخانات **المفتوحة** لا كل الخانات (ترحيل 17): يومٌ مغلق طاقته صفر،
       فلا يدخل `todayTotal` ولا يُقرأ «مكتمل اليوم» — وهما حالتان مختلفتان. */
    const openToday=openSlotsFor(f, td);
    const bToday=(State.bookedSlots[f.field_id]?.[td])||[];
    todayTotal+=openToday.length;
    openToday.forEach(s=>{ if(!bToday.includes(s.hour)) todayFree++; });
    for(let i=0;i<7;i++){ const d=dateAfter(i); const bk=(State.bookedSlots[f.field_id]?.[d])||[]; openSlotsFor(f, d).forEach(s=>{ if(!bk.includes(s.hour)) weekFree++; }); }
  });
  // العدد يُعاد مع الحالة: كان يُحسَب ثمّ يُرمى، والبطاقة تعرض «متاح/غير متاح»
  // ثنائيًّا بينما الفرق بين وقتين وتسعة أوقات هو ما يحسم القرار.
  if(todayFree>0) return {state:'today', label:'متاح اليوم', cls:'avail-yes', free:todayFree};
  if(weekFree>0)  return {state:'later', label:'متاح لاحقاً', cls:'avail-soon'};
  if(todayTotal>0)return {state:'full',  label:'مكتمل اليوم', cls:'avail-no'};
  return {state:'none', label:'لا أوقات', cls:'avail-no'};
}
/* أقرب وقت متاح (طابع زمني) — للترتيب "الأقرب وقتاً" وعرضه على البطاقة */
function soonestSlotTs(p){
  let best=Infinity; const now=Date.now()-90*60*1000;   // تسامح ساعة ونصف للوقت الجاري
  (p.fields||[]).forEach(f=>{
    if(f.active===false) return;
    for(let i=0;i<7;i++){ const d=dateAfter(i); const bk=(State.bookedSlots[f.field_id]?.[d])||[];
      // المفتوحة وحدها: «أقرب وقت» يقود المستخدمَ إلى زرٍّ لا يستطيع النقر عليه
      for(const s of openSlotsFor(f, d)){ if(!bk.includes(s.hour)){ const ts=new Date(`${d}T${String(s.hour).padStart(2,'0')}:00:00`).getTime(); if(ts>=now && ts<best) best=ts; } }
    }
  });
  return best;
}
function soonestSlotLabel(p){
  const ts=soonestSlotTs(p); if(!isFinite(ts)) return '';
  const d=new Date(ts); const dateStr=ymd(d);
  const day = dayLabel(dateStr);
  const hour=d.getHours(); const en=State.lang==='en';
  const ampm = en ? (hour<12?'AM':'PM') : (hour<12?'ص':'م'); const h12=((hour+11)%12)+1;
  return `${day} ${h12}:00 ${ampm}`;
}
/* تنسيق ساعة بنظام 12 ساعة (ص/م بالعربي · AM/PM بالإنجليزي) */
function fmtHour12(hr){
  const h24=((Number(hr)%24)+24)%24; const en=State.lang==='en';
  const ampm = en ? (h24<12?'AM':'PM') : (h24<12?'ص':'م');
  const h12=((h24+11)%12)+1; return `${h12}:00 ${ampm}`;
}
/* أوقات دوام المكان: من أبكر وقت إلى آخر وقت (+ساعتان) عبر كل ملاعبه — يُحسب من الـslots الفعلية */
function placeHours(p){
  const hrs=(p.fields||[]).flatMap(f=>fieldSlots(f)).map(s=>Number(s.hour)).filter(Number.isFinite);
  if(!hrs.length) return '';
  const start=Math.min(...hrs), end=Math.max(...hrs)+2;
  return `${fmtHour12(start)} - ${fmtHour12(end)}`;
}
/* قيم مميّزة من البيانات الفعلية (بلا اختراع) */
function distinctSizes(){ const seen=new Set(), out=[]; State.places.forEach(p=>(p.fields||[]).forEach(f=>{ const v=String(f.size||'').trim(); if(!v) return; const k=normSize(v); if(seen.has(k)) return; seen.add(k); out.push(v); })); return out; }
function distinctTypes(){ const s=new Set(); State.places.forEach(p=>{const v=String(p.type||'').trim(); if(v)s.add(v);}); return [...s]; }
function distinctAmenities(){ const s=new Set(); State.places.forEach(p=>amenityKeys(p).forEach(k=>s.add(k))); return [...s]; }

function passesFilters(p){
  const fx=State.fx;
  const pmin=minPrice(p), pmax=maxPrice(p);
  if(fx.minPrice!=null && pmax>0 && pmax<fx.minPrice) return false;
  if(fx.maxPrice!=null && pmin>0 && pmin>fx.maxPrice) return false;
  if(fx.sizes.length){ const want=new Set(fx.sizes.map(normSize)); if(!(p.fields||[]).some(f=>want.has(normSize(f.size)))) return false; }
  if(fx.types.length && !fx.types.includes(String(p.type||'').trim())) return false;
  if(fx.minRating>0 && safeRating(p.rating)<fx.minRating) return false;
  if(fx.availableToday && placeAvailability(p).state!=='today') return false;
  if(fx.amenities.length){ const have=new Set(amenityKeys(p)); if(!fx.amenities.every(a=>have.has(a))) return false; }
  /* لمن الملعب — «أيٌّ من المختار» لا «كلّها»: مكانٌ فيه ملعب سيدات وآخر مشترك
     يطابق الاثنين. وملعبٌ لم يصرّح **لا يطابق شيئًا**: عدم التصريح ليس «مشترك»،
     فإدخالُه في النتيجة يَعِد بما لم يقله صاحبه. */
  if(fx.genders.length && !(p.fields||[]).some(f=>fx.genders.includes(fieldGender(f)))) return false;
  return true;
}
function sortPlaces(list){
  const a=[...list];
  switch(State.sort){
    case 'price_asc': a.sort((x,y)=>(minPrice(x)||1e9)-(minPrice(y)||1e9)); break;
    case 'price_desc': a.sort((x,y)=>(maxPrice(y)||0)-(maxPrice(x)||0)); break;
    case 'rating': a.sort((x,y)=>safeRating(y.rating)-safeRating(x.rating)||safeReviews(y.reviews)-safeReviews(x.reviews)); break;
    case 'reviews': a.sort((x,y)=>safeReviews(y.reviews)-safeReviews(x.reviews)); break;
    case 'soonest': a.sort((x,y)=>soonestSlotTs(x)-soonestSlotTs(y)); break;
    default: break;
  }
  return a;
}
function activeFilterCount(){
  const fx=State.fx; let n=0;
  if(fx.minPrice!=null) n++; if(fx.maxPrice!=null) n++;
  n+=fx.sizes.length+fx.types.length+fx.amenities.length+fx.genders.length;
  if(fx.minRating>0) n++; if(fx.availableToday) n++;
  if(State.sort!=='default') n++;
  return n;
}
function resetAllFilters(){
  State.fx={ minPrice:null,maxPrice:null,sizes:[],types:[],minRating:0,availableToday:false,amenities:[],genders:[] };
  State.sort='default'; State.filter='all';
  const s=$('#searchInput'); if(s) s.value='';
}
const SORT_LABEL={ default:'sortDefault', price_asc:'sortPriceAsc', price_desc:'sortPriceDesc', rating:'sortRating', reviews:'sortReviews', soonest:'sortSoonest' };
/* وضع عرض البطاقات: السمة data-view على الحاوية + التخزين في localStorage —
   لأن renderPlaces يعيد ضبط السمة كل مرة، يصمد الوضع بعد البحث/الفلترة/الترتيب/التحديث/المفضلة */
function setViewMode(v){
  State.view = v==='list' ? 'list' : 'grid';
  try{ localStorage.setItem('mustadaira:viewMode', State.view); }catch(_){}
  renderPlaces();
}
function updateViewToggle(){
  // `on` صنفًا **وaria-pressed** معًا: الزرّ صار شريحة نصّية في ورقة الفلاتر،
  // وشريحة الفلاتر تُضيء بـ`.on` لا بـ`.active`.
  $$('.vt-btn').forEach(b=>{ const on=b.dataset.view===State.view;
    b.classList.toggle('active',on); b.classList.toggle('on',on);
    b.setAttribute('aria-pressed',on?'true':'false'); });
}
function updateFilterBar(){
  const c=$('#filterCount'); const n=activeFilterCount();
  if(c){ c.textContent=n; c.hidden=n===0; }
  const fb=$('#filterBtn'); if(fb) fb.classList.toggle('has-filters', n>0);
  renderFilterChips();
}

/* ===================== (٧) شرائح التصفية اللاصقة =====================
   ما هو مفعَّل فعلًا في `State.fx` و`State.filter` — شريحة لكلٍّ، وإزالتها بضغطة.
   قبلها كان عدّاد رقمي على زرّ الفلاتر يقول «٣» بلا أن يقول **أيّ ثلاثة**، فيضطرّ
   المستخدم لفتح الورقة ليعرف لماذا اختفت النتائج.
   ملاحظة: الترتيب ليس فلترًا (لا يُخفي نتيجة) فلا شريحة له، وإن كان يدخل العدّاد. */
function filterChipList(){
  const fx=State.fx, out=[];
  const add=(label, remove)=> out.push({label, remove});
  /* ⚠️ لا شريحة لـ«المفضّلة»: صارت مسارًا في الشريط السفلي، وشريحةٌ تزيله
     تترك الحبّة عليه وتحتها كلّ الملاعب. الشرائح لما يُصفّى **داخل** القائمة. */
  if(State.filter!=='all') add(t('fchipRegion',{v:State.filter}),          ()=>{ State.filter='all'; });
  if(fx.minPrice!=null)    add(t('fchipPriceMin',{v:formatCurrency(fx.minPrice)}), ()=>{ fx.minPrice=null; });
  if(fx.maxPrice!=null)    add(t('fchipPriceMax',{v:formatCurrency(fx.maxPrice)}), ()=>{ fx.maxPrice=null; });
  fx.sizes.slice().forEach(v => add(t('fchipSize',{v}),  ()=>toggleArr(fx.sizes, v)));
  fx.types.slice().forEach(v => add(t('fchipType',{v}),  ()=>toggleArr(fx.types, v)));
  if(fx.minRating>0)       add(t('fchipRating',{v:fx.minRating}),          ()=>{ fx.minRating=0; });
  if(fx.availableToday)    add(t('availableToday'),                        ()=>{ fx.availableToday=false; });
  fx.amenities.slice().forEach(k => add(amenityLabel(AMENITY[k]) || k, ()=>toggleArr(fx.amenities, k)));
  fx.genders.slice().forEach(g => add(genderLabel(g), ()=>toggleArr(fx.genders, g)));
  return out;
}
function renderFilterChips(){
  const bar=$('#fchipsBar'); if(!bar) return;
  const list=filterChipList();
  clear(bar);
  if(!list.length){ bar.hidden=true; return; }   // hidden لا شفافية: صفّ فارغ لاصق كان يأكل ارتفاعًا
  bar.hidden=false;
  const after=()=>{ renderRegionTabs(); renderPlaces(); };   // renderPlaces ينادي updateFilterBar ⇒ الشرائح تُعاد بناؤها
  list.forEach(c=>{
    const b=h('button',{class:'fchip', type:'button', 'aria-label':t('fchipRemove',{v:c.label})},
      h('span',{class:'fchip-lbl'}, c.label), ico('x','fchip-x'));
    b.addEventListener('click', ()=>{ c.remove(); buzz(6); after(); });
    bar.append(b);
  });
  if(list.length>1){
    const clr=h('button',{class:'fchip fchip-clear', type:'button'}, t('clearAll'));
    clr.addEventListener('click', ()=>{ resetAllFilters(); buzz(8); updateSearchClear(); after(); });
    bar.append(clr);
  }
}
/* سطر «عادةً يردّ خلال ن» — موضعان اثنان لا أكثر: بطاقة الملعب في القائمة،
   ونافذة المراجعة فوق زرّ التأكيد (هناك تحديدًا يُتّخذ القرار).
   ⚠️ ومكانٌ لا يعود له صفّ في العرض **لا يعرض سطرًا**: لا «غير متوفّر» ولا
      شرطة ولا صفر. ما لا نقيسه لا نقول عنه شيئًا (م5).
   ⚠️ والقيمة داخل `<bdi>`: مدّةٌ بأرقام أوروبية داخل جملة عربية. */
function replySpeedLine(p, cls){
  if(REPLY_OK !== true) return '';
  const txt = replySpeedText(p?.reply_median, State.lang);
  if(!txt) return '';
  const parts = String(t('replySpeed')).split('{t}');
  return h('div',{class:cls}, ico('clock','svg-sm'), ' ',
    parts[0]||'', h('bdi',{}, txt), parts[1]||'');
}
function placeCard(p, eager){
  const av = placeAvailability(p);
  const mn=minPrice(p), mx=maxPrice(p);
  const unit = State.lang==='en' ? 'JOD' : 'د.أ';
  const range = mn!==mx;
  const oneField=(p.fields||[]).length===1;
  const img = (p.fields||[]).map(f=>fieldImages(f)[0]).find(Boolean);

  /* الغلاف: صورة نظيفة — لا يعلوها سوى المفضلة وشارة «غير متاح» عند الامتلاء/غياب الأوقات */
  const cover = h('div',{class:'place-cover'});
  // الصورة الأولى الظاهرة (LCP): eager + أولوية عالية؛ الباقي lazy لتسريع التحميل
  if (img) cover.append(h('img',{ src:img, alt:p.place_name||'ملعب', width:'640', height:'360',
    loading: eager?'eager':'lazy', fetchpriority: eager?'high':'auto', decoding:'async' }));
  else cover.append(h('div',{class:'place-cover-emoji', html:ICON.ball, 'aria-hidden':'true'}));
  // زر مفضّلة (قلب) — تخزين محلي فقط
  const isFav=favHas(p.place_id);
  const favB=h('button',{class:'fav-btn'+(isFav?' on':''), type:'button', html:ICON.heart,
    'aria-pressed':isFav?'true':'false', 'aria-label':t(isFav?'favRemove':'favAdd')});
  favB.addEventListener('click',(e)=>{ e.stopPropagation();
    const on=favToggle(p.place_id);
    favB.classList.toggle('on',on); favB.setAttribute('aria-pressed',on?'true':'false'); favB.setAttribute('aria-label',t(on?'favRemove':'favAdd'));
    if(State.favOnly) renderPlaces();
  });
  const unavailable = av.state==='full' || av.state==='none';
  /* شارة العدد حين يقلّ: نفس حدّ شريط الأيام (‏DAY_LEFT_MAX) كي يقرأ المستخدم
     الرقم نفسه في البطاقة وفي التفاصيل. والعدد قابل للعدّ بالعين داخل الملعب
     ⇒ لا استعجال مخترَع (م5)، وهي القاعدة نفسها التي تحكم لافتة الندرة. */
  const fewToday = av.state==='today' && av.free>0 && av.free<=DAY_LEFT_MAX ? av.free : 0;
  /* شارة التصنيف (م3، نمط المرجع): نوع أرضية الملعب أعلى الصورة — نُقلت من سطر النص السفلي فلا تكرار */
  cover.append(h('div',{class:'place-top-badges'},
    p.type && h('span',{class:'place-cat-badge'}, p.type),
    unavailable && h('span',{class:'avail-badge avail-no'}, t('unavailableBadge')),
    /* ⚠️ ثلاثيّة لا `&&`: الصفر قيمة **زائفة تُرسَم**. `cond && h(...)` تصلح مع
       `false` و`''` لأنهما لا يظهران، أمّا `0` فيمرّ إلى الأبناء ويُطبَع رقمًا
       عاريًا فوق الصورة. ظهر في اللقطة قبل أن يظهر في أي فحص منطقي. */
    (fewToday ? h('span',{class:'avail-badge avail-few'}, t('dayLeft',{n:fewToday})) : ''),
    favB));

  /* جسم البطاقة: ثلاث كتل لا أربعة صفوف بوزن واحد.
     ① الاسم وحده على عرض كامل — التقييم خرج من صفّه، فصار الاسم يستعمل العرض
        كلّه ويكتفي بسطر واحد غالبًا بدل سطرين.
     ② سطر ميتا واحد يجمع **ثلاث معلومات ضعيفة**: التقييم · الموقع · عدد الملاعب،
        بحجم واحد ووزن واحد ومفصولةً بنقاط. ثلاثة صفوف مستقلّة كانت تمنح كلًّا
        منها وزن عنوان وهي لا تحمله.
     ③ المرافق أيقونات لا شرائح (الشريحة صفٌّ كامل بارتفاع 30px لنصّ 10px).
     ⚠️ ومكانٌ بلا تقييم **لا يعرض شيئًا** ولا فاصلًا — لا «0 (0)» ولا نقطة
        يتيمة (م5، وهي قاعدة `hasRating` نفسها). */
  const meta = h('div',{class:'pcard-meta'});
  const metaBits = [];
  if(hasRating(p)) metaBits.push(h('span',{class:'pm-rating'}, h('span',{class:'sr-star'},'★'), ' '+ratingText(p)));
  metaBits.push(h('span',{class:'pm-loc'}, placeLocation(p)));
  metaBits.push(h('span',{class:'pm-fields'}, oneField?t('oneField'):t('fieldsCount',{n:p.fields.length})));
  /* عددُ أوقات اليوم الفارغة — `placeAvailability` تحسبه أصلًا (`free`) ثمّ
     كانت البطاقة **ترميه**: لا يظهر إلّا نقيضُه («غير متاح») عند الامتلاء.
     وهو أنفع رقمٍ على البطاقة: من يتصفّح مساءً يسأل «في فاضي الليلة؟» لا
     «كم ملعبًا عندهم؟».
     ⚠️ **وهو قياسٌ لا وعد** (م5): مشتقٌّ من خانات الملعب ناقصَ المحجوز
     ناقصَ المغلق، ولا يُعرَض إلّا إن كان أكبر من صفر — والصفرُ حالته
     شارةُ «غير متاح» القائمة، لا رقمٌ يقول «صفر». */
  if(av.state==='today' && av.free>0)
    metaBits.push(h('span',{class:'pm-free'}, nFreeToday(av.free)));
  metaBits.forEach((bit,i)=>{
    if(i) meta.append(h('span',{class:'pm-sep','aria-hidden':'true'},'·'));
    meta.append(bit);
  });
  const body = h('div',{class:'place-body'},
    h('div',{class:'place-name'}, p.place_name),
    meta,
    replySpeedLine(p, 'place-reply'),
    amenityIcons(p.amenities, 3));

  /* صف الإجراء السفلي: السعر مع سياقه + زر الحجز في السطر نفسه */
  const bookBtn = h('button',{class:'place-book-btn', type:'button'}, t('bookCta'));
  bookBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openDetail(p.place_id); });
  // عند تعدّد الأسعار: أظهر المدى الحقيقي «40–60» (أدقّ من «يبدأ من 40» ويطابق واقع المكان)
  const priceLabel = range ? `${mn}–${mx}` : String(mn);
  /* ⚠️ سطران لا ثلاثة: تسمية المدى («حسب الملعب») حُذفت لأن **الشرطة نفسها تقولها** —
     «40–60» لا تُقرأ سعرًا واحدًا. سطرٌ ثالث لتكرار ما يقوله الشكل.
     ⚠️ و`<bdi dir="ltr">` حول المدى وحده (لا العملة): «40–60» شرطةٌ محايدة بين
     رقمين أوروبيّين ⇒ تنقلب في السطر العربي فتُعرَض «60–40» — أعلى سعر ثمّ أدناه. */
  const action = h('div',{class:'place-action-row'},
    h('div',{class:'place-price'},
      h('span',{class:'place-price-main'},
        range ? h('bdi',{class:'place-price-val', dir:'ltr'}, priceLabel)
              : h('span',{class:'place-price-val'}, priceLabel),
        h('span',{class:'place-price-cur'}, unit)),
      h('span',{class:'place-price-ctx'}, t('perTwoHours'))),
    bookBtn);

  const card = h('div',{class:'place-card'}, cover, body, action);
  card.addEventListener('click', ()=>openDetail(p.place_id));
  return card;
}
function setPlacesCount(n){ const el=$('#placesCount'); if(!el) return; if(n>0){ el.textContent=String(n); el.hidden=false; } else { el.hidden=true; } }
/* `quiet` ⇒ بلا حركة دخول. تُمرَّر من الكتابة في البحث وحدها: `renderPlaces`
   تُستدعى بعد كل ضغطة زرّ (مؤجَّلة)، فسُلَّم الظهور كان يُعاد توزيعه من الصفر
   مع كل حرف — القائمة تُوزَّع كورق اللعب مرارًا بينما المستخدم يكتب.
   ⚠️ ويُنفَّذ بـ`--enter-t:0ms` لا بـ`animation:none`: الظهور صار انتقالًا من
   `@starting-style` (الحالة الافتراضية **مرئية**) فلا وجود لحالة «حركةٌ ملغاة
   تترك البطاقة غير مرئية» — وهو العطل الذي كان الردّ الصريح للشفافية يعالجه. */
function renderPlaces(opts){
  const quiet = !!(opts && opts.quiet);
  const el = $('#placesList'); if(!el) return;
  el.dataset.view = State.view; updateViewToggle();
  /* رياضة بلا ملعب واحد ⇒ حالة «قريباً» بدل القائمة.
     ⚠️ والزرّ لم يعد «عرض ملاعب كرة القدم» دائمًا: لو كانت كرة القدم نفسها هي
     الفارغة لأعاد المستخدمَ إلى نفس الفراغ. يشير إلى **أوّل رياضة لها ملاعب
     فعلًا**، وإن لم تكن هناك واحدة فلا زرّ أصلًا (لا وجهة تُقترَح). */
  if(sportSoon(State.sport)){
    clear(el); setPlacesCount(0);
    const s=SPORTS.find(x=>x.key===State.sport);
    const alt=SPORTS.find(x=>x.key!==State.sport && sportHasVenues(x.key));
    el.append(emptyState({ iconHtml:courtSvg(State.sport), icon:'⏳',
      title:t('comingSoonTitle'), sub:t('comingSoonSub',{sport:t(s?s.label:'sportFootball')}),
      actionLabel: alt ? t('backToSport',{sport:t(alt.label)}) : '',
      action: alt ? (()=>setSport(alt.key)) : null }));
    return;
  }
  updateFilterBar();
  const rawQ = $('#searchInput')?.value || '';
  const q = normalizeText(rawQ);
  const favs = State.favOnly ? favGet() : null;
  let list = State.places.filter(p=>{
    const regionOk = State.filter==='all' || normalizeText(p.region)===normalizeText(State.filter);
    const searchOk = !q || [p.place_name,p.city,p.region,p.type].some(x=>normalizeText(x).includes(q));
    const favOk = !favs || favs.has(String(p.place_id));
    return regionOk && searchOk && favOk && passesFilters(p);
  });
  list = sortPlaces(list);
  setPlacesCount(list.length);   // عدّاد نتائج بجانب عنوان القسم (نمط الأسواق)
  clear(el);
  if (!list.length){
    if (State.favOnly){
      // ⚠️ الزرّ ينقل إلى **المسار** لا يصفّر العلَم وحده: تصفيرٌ صامت يترك
      //    الحبّة على «المفضّلة» وتحتها كلّ الملاعب.
      el.append(emptyState({ icon:'🤍', title:t('noFavsTitle'), sub:t('noFavsSub'),
        actionLabel:t('browseFields'), action:()=>showPage('home') }));
      return;
    }
    const hasAny = q || State.filter!=='all' || activeFilterCount()>0;
    /* ⚠️ **بحثٌ فارغ = خريطة توسّع** (٣.٣). الكلمة التي تتكرّر بلا نتيجة تسمّي
       المنطقة التي لا عرض فيها، وهي معروفة اليوم لصاحب البحث وحده ثمّ تضيع.
       والتسجيل مشروط بوجود كلمة بحث فعلية: «صفّرتُ الفلاتر فخلت القائمة»
       ليس طلبًا لم يُلبَّ. والكلمة تُطبَّع فلا تصير ثلاثةَ صفوف لسؤال واحد. */
    if (q) Track.searchEmpty({ q: normQuery(rawQ), region: State.filter, sport: State.sport });
    el.append(emptyState({ icon:'🔍', title:t('noResultsTitle'),
      sub: hasAny ? t('noResultsSub') : t('noResultsSubPlain'),
      actionLabel: hasAny?t('clearFiltersBtn'):null, action: hasAny?()=>{ resetAllFilters(); renderRegionTabs(); renderPlaces(); }:null }));
    return;
  }
  list.forEach((p,i) => {
    const card = placeCard(p, i===0);   // أول بطاقة eager (LCP)
    if(quiet){
      /* ⚠️ تصفير **المدّة** لا التأخير: بتأخير صفر تظلّ البطاقات تتلاشى معًا
         340ms مع كل حرف، وهو ما بُني `quiet` لمنعه. والبطاقة مرئية افتراضًا
         الآن (الإخفاء يعيش في `@starting-style` وحده) فلا شفافية تُردّ بعدها. */
      card.style.setProperty('--enter-t', '0ms');
    }else{
      // سُلَّم بسقف: بلا `Math.min` تنتظر البطاقةُ العشرون ثانيةً كاملة قبل ظهورها،
      // والدليل ينمو من القاعدة فالسقف ليس ترفًا. ثمانِ درجات = 0.35s كحدّ أقصى.
      card.style.setProperty('--enter-d', `${Math.min(i, 7) * 50}ms`);
    }
    el.append(card);
  });
}

/* ===================== FILTERS SHEET (Bottom Sheet) ===================== */
const fxChip = (label, on) => h('button',{class:'fx-chip'+(on?' on':''), type:'button'}, label);
const toggleArr = (arr,v)=>{ const i=arr.indexOf(v); if(i>=0)arr.splice(i,1); else arr.push(v); };
const numOrNull = (v)=>{ const n=Number(v); return (v===''||Number.isNaN(n))?null:n; };
function openFilters(){
  State.fxDraft = JSON.parse(JSON.stringify(State.fx));   // مسودّة معزولة
  State.sortDraft = State.sort;
  renderFiltersSheet();
  Modal.open('modal-filters');
}
/* عدّاد زرّ «تطبيق» — يُقرأ من المسودّة، فيجب أن تكون المسودّة محدَّثة أولاً */
function updateFxApplyCount(){
  const fx=State.fxDraft; if(!fx) return;
  let n=0; if(fx.minPrice!=null)n++; if(fx.maxPrice!=null)n++;
  n+=fx.sizes.length+fx.types.length+fx.amenities.length+fx.genders.length;
  if(fx.minRating>0)n++; if(fx.availableToday)n++; if(State.sortDraft!=='default')n++;
  setText('fxApplyCount', n? `${t('apply')} (${n})` : t('apply'));
}
/* ⚠️ الحقول الثابتة (السعر · «متاح اليوم») تعيش في HTML ولا يُعاد إنشاؤها، بينما
   كل نقرة على شريحة تُعيد بناء الورقة و**تُعيد كتابة قيمها من المسودّة**. وما دامت
   المسودّة لا تُكتب إلا في applyFilters، كان كل ما كُتب ولم يُطبَّق بعد يُمحى صامتًا.
   الحلّ: يكتب المستخدمُ المسودّةَ فور إدخاله، فتبقى إعادة البناء أمينة.
   (مزامنة DOM⇒مسودّة قبل الرسم كانت ستُحيي نصّ الجلسة السابقة عند أوّل فتح.) */
function syncDraftInputs(){
  const fx=State.fxDraft; if(!fx) return;
  fx.minPrice=numOrNull($('#fxMin').value);
  fx.maxPrice=numOrNull($('#fxMax').value);
  fx.availableToday=$('#fxToday').checked;
  updateFxApplyCount();
}
function renderFiltersSheet(){
  const fx=State.fxDraft;
  // الترتيب
  const sw=$('#fxSort'); clear(sw);
  Object.entries(SORT_LABEL).forEach(([v,k])=>{ const c=fxChip(t(k), State.sortDraft===v); c.addEventListener('click',()=>{ State.sortDraft=v; renderFiltersSheet(); }); sw.append(c); });
  // المنطقة
  const reg=$('#fxRegion'); const cur=reg.value; clear(reg);
  reg.append(h('option',{value:'all'},t('allRegions')));
  getRegions().forEach(r=> reg.append(h('option',{value:r}, r)));
  reg.value = (State.filter!=='all' && getRegions().some(r=>r===State.filter)) ? State.filter : 'all';
  // السعر — إسناد الخاصّية (لا addEventListener) لأنه **متكافئ**: الحقول ثابتة في HTML
  // وإعادة البناء تمرّ هنا عشرات المرّات، فالإضافة كانت ستكدّس مستمعًا في كل مرّة.
  $('#fxMin').value = fx.minPrice ?? ''; $('#fxMax').value = fx.maxPrice ?? '';
  $('#fxMin').oninput = $('#fxMax').oninput = syncDraftInputs;
  // الحجم
  const sz=$('#fxSizes'); clear(sz); const sizes=distinctSizes();
  sizes.length ? sizes.forEach(szv=>{ const c=fxChip(szv, fx.sizes.includes(szv)); c.addEventListener('click',()=>{ toggleArr(fx.sizes,szv); renderFiltersSheet(); }); sz.append(c); })
               : sz.append(h('span',{class:'fx-empty'},t('noData')));
  // النوع (ty — لا تُظلِّل دالة الترجمة t)
  const tp=$('#fxTypes'); clear(tp); const types=distinctTypes();
  types.length ? types.forEach(ty=>{ const c=fxChip(ty, fx.types.includes(ty)); c.addEventListener('click',()=>{ toggleArr(fx.types,ty); renderFiltersSheet(); }); tp.append(c); })
               : tp.append(h('span',{class:'fx-empty'},t('noData')));
  // التقييم
  const rt=$('#fxRating'); clear(rt); [4,3,2].forEach(r=>{ const c=fxChip('★ '+r+'+', fx.minRating===r); c.addEventListener('click',()=>{ fx.minRating = fx.minRating===r?0:r; renderFiltersSheet(); }); rt.append(c); });
  // متاح اليوم — نفس العطل تمامًا: كان يُعاد ضبطه من المسودّة عند كل إعادة بناء
  $('#fxToday').checked = !!fx.availableToday;
  $('#fxToday').onchange = syncDraftInputs;
  /* لمن الملعب — **القسم كلّه يُخفى** ما لم يصرّح ملعبٌ واحد على الأقلّ
     (‏`genderDeclared`): خانةُ تصفيةٍ لا تصفّي شيئًا زينةٌ تُوهم بقدرة غير
     موجودة، وهي نفس الحجّة التي حذفت دبّوس الموقع في الدفعة ١٤. */
  const gw=$('#fxGenderWrap'), gb=$('#fxGenders');
  const gOn = genderDeclared();
  if(gw) gw.hidden = !gOn;
  if(gb){ clear(gb);
    if(gOn) GENDERS.forEach(g=>{ const c=fxChip(genderLabel(g), fx.genders.includes(g));
      c.addEventListener('click',()=>{ toggleArr(fx.genders,g); renderFiltersSheet(); }); gb.append(c); });
  }
  // المرافق
  const am=$('#fxAmenities'); clear(am); const ams=distinctAmenities();
  ams.length ? ams.forEach(k=>{ const m=AMENITY[k]; const c=fxChip(m&&m.labelKey?t(m.labelKey):k, fx.amenities.includes(k)); c.addEventListener('click',()=>{ toggleArr(fx.amenities,k); renderFiltersSheet(); }); am.append(c); })
              : am.append(h('span',{class:'fx-empty'},t('noData')));
  // عدّاد المسودّة
  updateFxApplyCount();
}
function applyFilters(){
  const fx=State.fxDraft; if(!fx) return;
  fx.minPrice=numOrNull($('#fxMin').value); fx.maxPrice=numOrNull($('#fxMax').value);
  if(fx.minPrice!=null && fx.maxPrice!=null && fx.minPrice>fx.maxPrice){ const tmp=fx.minPrice; fx.minPrice=fx.maxPrice; fx.maxPrice=tmp; }
  fx.availableToday=$('#fxToday').checked;
  State.fx=fx; State.sort=State.sortDraft; State.fxDraft=null;
  const reg=$('#fxRegion').value; State.filter = reg==='all'?'all':reg;
  Modal.close('modal-filters');
  renderRegionTabs(); renderPlaces();
}
function clearFiltersSheet(){
  State.fxDraft={ minPrice:null,maxPrice:null,sizes:[],types:[],minRating:0,availableToday:false,amenities:[],genders:[] };
  State.sortDraft='default'; $('#fxRegion').value='all';
  renderFiltersSheet();
}

/* ===================== RENDER: DETAIL ===================== */
/* شارات رأس التفاصيل: النوع + التقييم + الدوام (الدوام يُعرض هنا فقط — أُزيل من البطاقات بطلب المستخدم) */
function renderDetailBadges(place){
  const badges=$('#dBadges'); if(!badges) return; clear(badges);
  badges.append(h('span',{class:'badge badge-green'}, place.type||''));
  if(hasRating(place)) badges.append(h('span',{class:'badge badge-blue'}, h('span',{class:'sr-star'},'★'), ' '+ratingText(place)));
  const dHrs=placeHours(place);
  if(dHrs) badges.append(h('span',{class:'badge badge-blue detail-hours'}, ico('clock','svg-sm'), ' '+t('operatingHours')+' '+dHrs));
}
/* فتح التفاصيل — **تنقّل فوري لا انتظار شبكة**.
   كان: `await loadPublicBookings()` قبل `showPage` ⇒ الضغط على «احجز الآن» يتجمّد
   5-9 ثوانٍ (Apps Script بطيء) والمستخدم يرى سبينر على الزرّ ولا شيء غيره.
   صار: نرسم الصفحة **فورًا** من التوفّر المخزّن (جاء مع التحميل الأولي)، ثم نحدّث
   الحجوزات **بالخلفية** ونعيد رسم الأوقات عند وصولها مع حالة «يُحدَّث» خفيفة.
   آمن لأن التحقّق النهائي قبل الحفظ (confirmBooking) يجلب بيانات طازجة أصلًا،
   فلا يمكن أن يُحجز وقت مأخوذ بناءً على عرض قديم.
   opts.awaitFresh=true ⇒ انتظر الطازج (يستعمله استئناف حجز ضيف معلّق: يقرأ
   `bookedSlots` مباشرة بعد الفتح فيلزمه أن يكون محدّثًا). */
async function openDetail(placeId, opts={}){
  if (!State.places.length){ placesSkeleton(); await loadData(); }
  else if (opts.awaitFresh){ try { await loadPublicBookings(); } catch(e){ if(!isAbort(e)) toast(t('timesUpdateFail'),'warn'); } }
  const place = State.places.find(p=>String(p.place_id)===String(placeId)); if(!place) return;
  State.detail = { place, field: place.fields[0], date: today(), hour: null };

  setText('dName', place.place_name);
  const dCity=$('#dCity'); clear(dCity); dCity.append(ico('pin','svg-sm'), ' '+placeLocation(place));
  setText('dPrice', formatCurrency(place.fields[0].price));

  renderDetailBadges(place);

  // الغلاف + المعرض: صور الملعب المحدَّد (تتبدّل مع تبديل الملعب داخل المكان)
  renderDetailHero();

  /* رابط الخريطة يمرّ بنفس شرط الصور (‏`isHttpUrl`) — وهو التزامٌ مكتوب في
     `CLAUDE.md` كان مطبَّقًا على `image_url` وحدها. والرابط المرفوض يُخفي
     الزرَّ بدل أن يبقى معطوبًا يقود إلى `#`. */
  const map=$('#mapLink'); const mapOk = isHttpUrl(place.map_link);
  map.href = mapOk ? place.map_link : '#';
  map.hidden = !mapOk;
  const call=$('#callBtn'); if (place.phone){ call.href='tel:+'+normalizePhone(place.phone); call.style.display=''; } else call.style.display='none';

  setDetailTab('book');                                   // ابدأ دائماً على تبويب الحجز
  renderDetailRating(place); renderDetailAmenRow(place);
  renderAmenitiesFull(place); renderSubFields(); renderDetailDays(); renderDetailTimes(); renderPlaceStats(); renderRatingDist(place); renderDetailSticky();
  showPage('detail');
  Track.push(EV.PLACE_VIEW, { place_id:String(place.place_id), sport:State.sport });
  /* شبكة الأسعار **بعد** إظهار الصفحة لا قبله: الأسعار المختلفة استثناء لا
     قاعدة، وحجبُ الشاشة على طلبٍ يعود فارغًا في أغلب الأماكن ثمنٌ بلا مقابل.
     وحين تصل يُعاد رسم الأوقات وحدها. */
  loadPriceGrid(place.place_id).then(()=>{
    if(State.detail.place && String(State.detail.place.place_id)===String(placeId)){ renderDetailTimes(); renderDetailSticky(); }
  });
  if(!opts.awaitFresh) refreshDetailAvailability(placeId);   // تحديث التوفّر بالخلفية (بعد أن ظهرت الصفحة)
}
/* تحديث التوفّر بالخلفية: لا يحجب التنقّل، ويعيد رسم الأوقات فقط إن كان المستخدم
   ما يزال على تفاصيل نفس المكان (وإلّا فالنتيجة قديمة/غير ذات صلة).
   كاش 45s يعني أن الفتحات المتتالية للمكان نفسه لا تكلّف طلبًا أصلًا. */
async function refreshDetailAvailability(placeId){
  const el=$('#detailTimes'); if(el) el.classList.add('times-syncing');
  try{ await ensurePublicBookings(); }
  catch(e){ if(!isAbort(e)) toast(t('timesUpdateFail'),'warn'); }
  finally{
    const still = activePageName()==='detail' && State.detail && String(State.detail.place?.place_id)===String(placeId);
    const now=$('#detailTimes'); if(now) now.classList.remove('times-syncing');
    if(still){
      // لو صار الوقت المختار محجوزًا أثناء الانتظار: أسقط الاختيار وأخبر المستخدم
      const taken=(State.bookedSlots[State.detail.field.field_id]?.[State.detail.date])||[];
      if(State.detail.hour!=null && taken.includes(State.detail.hour)){ State.detail.hour=null; toast(t('bookingConflict'),'warn'); }
      renderDetailTimes();
    }
  }
}
/* تبديل تبويبَي صفحة التفاصيل (احجز / عن الملعب) */
function setDetailTab(name){
  State.detailTab=name;
  $$('#detailTabs .dtab-btn').forEach(b=>{ const on=b.dataset.dtab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); });
  $$('#page-detail .dtab-panel').forEach(p=>{ const on=p.dataset.dtabPanel===name; p.hidden=!on; p.classList.toggle('active', on); });
}
/* سطر التقييم بجانب الاسم — يفتح «عن الملعب» عند قسم التقييمات.
   ⚠️ `hidden` لا نصّ فارغ: مكانٌ بلا تقييم يعرض **لا شيء**، و«★ 0 (0)» ادّعاءٌ
   بأنه قُيِّم فحصل على صفر (م5، ونفس شرط `hasRating` على البطاقة). */
function renderDetailRating(p){
  const el=$('#dRating'); if(!el) return;
  if(!hasRating(p)){ el.hidden=true; clear(el); return; }
  el.hidden=false; clear(el);
  const n=safeReviews(p.reviews), avg=ratingAvgText(p);
  el.append(h('span',{class:'sr-star','aria-hidden':'true'},'★'), ' '+avg,
            h('span',{class:'detail-rating-n'}, ' · '+nReviews(n)));
  el.setAttribute('aria-label', t('dtabReviews')+': '+avg+' — '+nReviews(n));
}
/* صفّ المرافق المضغوط تحت الشارات: ثلاثة وشريحة «+n» تفتح «عن الملعب».
   الصفّ كلّه زرّ واحد — «فيه حمّامات؟» سؤالٌ يُسأل قبل الضغط لا بعده. */
function renderDetailAmenRow(p){
  const wrap=$('#dAmenRow'); if(!wrap) return; clear(wrap);
  const row=amenitiesRow(p.amenities, 3); if(!row) return;
  const btn=h('button',{type:'button', class:'amen-row-btn', 'aria-label':t('dtabAbout')}, row);
  btn.addEventListener('click', ()=>openAboutTab());
  wrap.append(btn);
}
/* فتح «عن الملعب» — و`focusReviews` ينزل إلى قسم التقييمات مباشرةً */
function openAboutTab(focusReviews){
  setDetailTab('about');
  const sec = focusReviews ? $('#dReviewsSec') : null;
  if(sec) requestAnimationFrame(()=>sec.scrollIntoView({block:'start', behavior:'smooth'}));
}
/* توزيع تقييمات حقيقي بأشرطة (من place.reviews_dist إن نُشر الباكند)؛ وإلا ملخّص المتوسط؛ و«لا تقييمات» عند 0 */
function renderRatingDist(place){
  const el=$('#ratingDist'); if(!el) return; clear(el);
  const avg=safeRating(place.rating), count=safeReviews(place.reviews);
  const dist=place.reviews_dist;   // مصفوفة/كائن عدد لكل نجمة 1..5 (اختياري — من الباكند)
  if(!count){ el.append(h('div',{class:'rd-empty'}, h('span',{class:'rd-empty-star'},'★'), ' '+t('noReviewsYet'))); return; }
  // رأس: المتوسط الكبير + النجوم (تعكس المتوسط) + العدد
  const filled=Math.max(0,Math.min(5,Math.round(avg)));
  el.append(h('div',{class:'rd-head'},
    h('div',{class:'rd-avg'}, String(avg).replace('.0','')),
    h('div',{class:'rd-avg-side'},
      h('div',{class:'rd-stars'}, '★'.repeat(filled)+'☆'.repeat(5-filled)),
      h('div',{class:'rd-count'}, t('ratingsCount',{n:count})))));
  // أشرطة لكل نجمة إن توفّر التوزيع
  const get=(s)=> dist ? Number((Array.isArray(dist)?dist[s-1]:dist[s]) || 0) : null;
  const total=dist ? [1,2,3,4,5].reduce((a,s)=>a+get(s),0) : 0;
  if(dist && total>0){
    const bars=h('div',{class:'rd-bars'});
    for(let s=5;s>=1;s--){
      const c=get(s), pct=Math.round(c/total*100);
      bars.append(h('div',{class:'rd-row'},
        h('span',{class:'rd-star-lbl'}, s+'★'),
        h('span',{class:'rd-track'}, h('span',{class:'rd-fill', style:{width:pct+'%'}})),
        h('span',{class:'rd-num'}, String(c))));
    }
    el.append(bars);
  }
}
/* غلاف التفاصيل: صور الملعب المحدَّد أولاً (فصل بصري لكل ملعب)؛
   إن لم تكن له صور ⇒ كل صور المكان؛ وإلا ⇒ الأيقونة الاحتياطية */
function renderDetailHero(){
  const place=State.detail.place, field=State.detail.field; if(!place) return;
  const hero=$('#detailHero'); if(!hero) return;
  $$('#detailHero img').forEach(n=>n.remove());
  const emoji=$('#detailEmoji');
  const own=field?fieldImages(field):[];
  const imgs=own.length?own:[...new Set((place.fields||[]).flatMap(f=>fieldImages(f)))];
  if (imgs.length){
    emoji.style.display='none';
    const heroImg=h('img',{id:'detailHeroImg',src:imgs[0],alt:(own.length&&field?field.field_name:place.place_name)||'',decoding:'async',fetchpriority:'high'});
    heroImg.addEventListener('click', ()=>Lightbox.open(imgs,0));
    hero.insertBefore(heroImg, hero.firstChild);
  }
  else { emoji.style.display=''; hero.style.background='var(--forest-2)'; }
  renderDetailThumbs(imgs);
  renderFieldSpecs(field);
}
/* مواصفات الملعب المحدَّد. لا تُعرَض إلّا ما مرّ من `fieldSpecChips`:
   قيمةٌ داخل المفردات، ولها ترجمة في اللغتين، وليست القيمة المخفيّة.
   ⇒ ملعبٌ بلا مواصفات مسجَّلة لا لوح له أصلًا، ولا عنوان فوق فراغ. */
function renderFieldSpecs(field){
  const wrap=$('#fieldSpecs'), el=$('#specChips'); if(!el) return; clear(el);
  const chips = field ? fieldSpecChips(field) : [];
  if(wrap) wrap.hidden = !chips.length;
  syncFieldExtras();
  chips.forEach(c => el.append(h('span',{class:'spec-chip','title':c.label},
    h('span',{class:'spec-chip-l'}, c.label),
    h('span',{class:'spec-chip-v'}, c.text))));
}
/* مصغّرات صور الملعب المحدَّد — تظهر أسفل اختيار الملعب؛ الضغط يفتح المعرض المكبّر */
/* الطيّة تتبع محتواها: ملعبٌ بلا مواصفة ولا صورة **لا عنوان له أصلًا**،
   فعنوانٌ يُفتح على فراغ أسوأ من غيابه (نفس قاعدة اللوحين قبل دمجهما).
   تُنادى بعد كلٍّ من الراسمَين لأن أيّهما قد يسبق الآخر. */
function syncFieldExtras(){
  const d=$('#fieldExtras'), sp=$('#fieldSpecs'), ph=$('#fieldPhotos');
  if(!d) return;
  const any = (sp && !sp.hidden) || (ph && !ph.hidden);
  d.hidden = !any;
  if(!any) d.open = false;
}
function renderDetailThumbs(imgs){
  const wrap=$('#fieldPhotos'); const el=$('#detailThumbs'); if(!el) return; clear(el);
  const list=imgs||[];
  if(wrap) wrap.hidden=!list.length;
  syncFieldExtras();
  if(!list.length) return;
  list.forEach((src,i)=>{
    const th=h('button',{class:'thumb', type:'button', 'aria-label':t('lbOpen',{i:i+1})}, h('img',{src, alt:'', loading:'lazy', decoding:'async'}));
    th.addEventListener('click', ()=>Lightbox.open(list,i));
    el.append(th);
  });
}
/* ===================== LIGHTBOX (تكبير صور الملعب + تنقّل) ===================== */
const Lightbox = {
  imgs:[], idx:0,
  open(imgs, i){ if(!imgs||!imgs.length) return; this.imgs=imgs; this.show(i||0); Modal.open('modal-lightbox'); },
  show(i){
    const n=this.imgs.length; this.idx=((i%n)+n)%n;
    const img=$('#lbImg'); if(img) img.src=this.imgs[this.idx];
    setText('lbCount', (this.idx+1)+' / '+n);
    const multi=n>1;
    const p=$('#lbPrev'), x=$('#lbNext'); if(p) p.hidden=!multi; if(x) x.hidden=!multi;
    // تجهيز الصورتين المجاورتين مسبقاً لتنقّل سلس
    if(multi) [this.idx+1,this.idx-1].forEach(k=>{ const im=new Image(); im.src=this.imgs[((k%n)+n)%n]; });
  },
  nav(d){ if(this.imgs.length>1) this.show(this.idx+d); },
};
/* الملخّص اللاصق أسفل التفاصيل — يظهر دائماً مع السعر (تقليل المفاجآت):
   قبل اكتمال الاختيار: اسم الملعب + «اختر اليوم والوقت» والسعر/ساعتين؛ بعده: الملخّص الكامل */
function renderDetailSticky(){
  const bar=$('#detailSticky'); if(!bar) return;
  const { field, date, hour } = State.detail;
  if(!field){ bar.hidden=true; return; }
  bar.hidden=false;
  const done = hour!=null;
  bar.classList.toggle('incomplete', !done);
  if(done){
    const slot=fieldSlots(field).find(s=>s.hour===hour);
    setText('dstickyLine', `${field.field_name} • ${dayLabel(date)} ${shortDate(date)} • ${slot?slotDisplay(slot):''}`);
  } else {
    setText('dstickyLine', `${field.field_name} • ${t('chooseDayTimeHint')}`);
  }
  /* السعر الأساسي ما دام لم يُختَر وقت (لا خانة ⇒ لا سعر خانة)، وسعر الخانة
     بعده. والشريط اللاصق آخر ما يراه قبل «تابع» ⇒ لا يجوز أن يحمل رقمًا
     يتغيّر في النافذة التالية. */
  setText('dstickyPrice', formatCurrency(done ? slotPrice(field, date, hour) : field.price));
  /* ⚠️ **الضيف يُخبَر قبل آخر خطوة لا عندها.** `savePendingBooking`/`resume`
     يعملان جيّدًا، لكنّ الضيف كان ينهي كل الاختيار ثمّ يصطدم بجدار الحساب —
     والمفاجأة في آخر خطوة هي ما يُفقد المسار. سطرٌ صغير على الشريط اللاصق،
     **بلا تغيير في المسار نفسه**. */
  const gb=$('#dstickyGuest');
  if(gb) gb.hidden = !!Session.player();
  /* ⚠️ ومدخل «مباراة مفتوحة» **المبكّر**: كان الخيار مدفونًا داخل نافذة
     المراجعة، فمن يبحث عن لاعبين لا يعرف أن التطبيق يفعل ذلك أصلًا حتى يكاد
     ينهي حجزًا خاصًّا. البطاقة تظهر **بعد اختيار الوقت وحده** (قبله لا مباراة
     ليُنشَر لها مقعد)، ولا تظهر إطلاقًا ما لم يثبت ترحيل 22. */
  const oe=$('#detailOpenEntry');
  if(oe) oe.hidden = !(done && GAMES_OK === true && Session.player());
}
function renderSubFields(){
  const el=$('#subFields'); clear(el);
  State.detail.place.fields.forEach(f=>{
    const active = String(State.detail.field.field_id)===String(f.field_id);
    const fi=fieldImages(f)[0];   // صورة مصغّرة خاصة بكل ملعب — فصل بصري داخل المكان
    const card=h('button',{class:'subfield-card'+(active?' active':''), type:'button', 'aria-pressed':active?'true':'false'},
      fi ? h('img',{class:'subfield-thumb', src:fi, alt:'', loading:'lazy', decoding:'async'})
         : h('span',{class:'subfield-thumb ph', html:ICON.ball, 'aria-hidden':'true'}),
      h('div',{class:'subfield-main'},
        h('div',{class:'subfield-name'}, f.field_name),
        h('div',{class:'subfield-size'}, ico('resize','svg-sm'), ' '+f.size,
          /* لمن الملعب — **عند التصريح وحده**. وملعبٌ لم يقل عنه أحد شيئًا
             لا يحمل شارة: «مشترك» المفترضة تُرسل لاعبةً إلى ملعبٍ للرجال. */
          fieldGender(f) ? h('span',{class:'gd-badge gd-'+fieldGender(f)}, genderLabel(fieldGender(f))) : null)),
      h('div',{class:'subfield-price'}, formatCurrency(f.price)));
    card.addEventListener('click', ()=>{ State.detail.field=f; State.detail.hour=null; renderSubFields(); renderDetailHero(); renderDetailDays(); renderDetailTimes(); renderPlaceStats(); setText('dPrice', formatCurrency(f.price)); renderDetailSticky(); });
    el.append(card);
  });
}
/* عدد الأوقات الشاغرة في ملعب فرعي بيوم بعينه.
   ⚠️ لا طلب شبكة هنا: `buildBookedSlots` تبني الأيام كلّها من جلبة واحدة
   (‏`State.bookedSlots[fid][date]`)، فالسبعة أيام حاضرة بعد `ensurePublicBookings`
   الوحيدة التي يناديها التفاعل أصلًا. */
function freeCountFor(field, date){
  if(!field) return null;
  const slots = fieldSlots(field);
  if(!slots.length) return null;
  const open = openSlotsFor(field, date);
  // كل خانات اليوم مغلقة ⇒ **حالة ثالثة** لا «صفر متاح». الفرق يهمّ اللاعب:
  // «ممتلئ» تعني «سبقك غيرك»، و«مغلق» تعني «لا أحد يلعب هنا اليوم».
  if(!open.length) return 'closed';
  const taken = (State.bookedSlots[field.field_id]?.[date]) || [];
  return open.filter(s => !taken.includes(s.hour)).length;
}
/* حدّ إظهار العدد: فوقه لا معنى للرقم — «باقي ٩» لا يغيّر قرارًا، و«باقي ٢» يغيّره.
   والسطر يبقى محجوز الارتفاع في الحالتين فلا يقفز الزرّ حين تتبدّل الحالة. */
const DAY_LEFT_MAX = 3;
/* `field` اختياري: مُرِّر فيُرسَم سطر الحالة، أُغفِل فيبقى الزرّ كما كان.
   نافذة المالك (الحجز الخارجي) لا تمرّره — سياق ملعبها يُختار من قائمة منفصلة. */
function dayButton(date, i, active, onClick, field){
  const label = dayLabel(date);
  const free = field ? freeCountFor(field, date) : null;
  const closed = free === 'closed';
  const n = closed ? 0 : free;
  const show = !closed && n!==null && (n===0 || n<=DAY_LEFT_MAX);
  const stateTxt  = closed ? t('dayClosed') : (n===0 ? t('dayFull') : (show ? t('dayLeft',{n}) : ''));
  const stateAria = closed ? t('dayClosedAria') : (n===0 ? t('dayFullAria') : (show ? t('dayLeftAria',{n}) : ''));
  const b=h('button',{class:'day-btn'+(active?' active':'')+(closed?' day-closed':(n===0?' day-full':'')), type:'button',
    'aria-pressed':active?'true':'false',
    'aria-label':label+' '+shortDate(date)+(stateAria?' — '+stateAria:'')},
    h('div',{}, label), h('div',{class:'d-date'}, shortDate(date)));
  /* السطر يُضاف دائمًا حين نعرف الحالة — فارغًا أو مملوءًا — كي يتساوى ارتفاع
     الأزرار السبعة، وإلّا صار الشريط مسنّنًا وقفز عند كل تبديل يوم. */
  if(free!==null) b.append(h('div',{class:'d-state'+(closed?' is-closed':(n===0?' is-full':' is-few')), 'aria-hidden':'true'}, stateTxt));
  b.addEventListener('click', onClick); b.dataset.date=date;
  return b;
}
function renderDetailDays(){
  const el=$('#detailDays'); clear(el);
  for(let i=0;i<7;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.detail.date, async()=>{
      State.detail.date=d; State.detail.hour=null; renderDetailDays(); renderDetailSticky(); timeSkeleton($('#detailTimes'),6);
      try{ await ensurePublicBookings(); }catch(_){}
      renderDetailDays(); renderDetailTimes();
    }, State.detail.field));
  }
}
/* opts (اختياري): { cls, tag } — لوسم خانة بحالة خاصّة (مثل «الحالي» في تعديل الموعد)
   بدل «محجوز» المضلّل. الاستدعاءات الثلاثة القديمة تمرّ بلا تغيير. */
/* opts: { cls, tag, closed, reason, price }
   `closed` حالة ثالثة لا نوعٌ من «محجوز»: المحجوز باعه غيرُك، والمغلق **لم
   يُعرَض أصلًا** — ولذلك له وسمه وسببه ولونه. و`price` يُعرَض **فقط** حين
   يختلف عن سعر الملعب (ترحيل 18): «السعر قبل الطلب» وعدٌ على الموقع، فسعرٌ
   يظهر أوّل مرّة في نافذة المراجعة هو المفاجأة التي وُضع الوعد لمنعها. */
function timeButton(slot, taken, selected, onClick, opts){
  const o = opts || {};
  const closed = !!o.closed;
  const dead = taken || closed;
  const stateLbl = closed ? (t('stClosed') + (o.reason ? ' — '+o.reason : ''))
                 : taken ? (o.tag || t('stTaken'))
                 : (selected ? t('stSelected') : t('stAvailable'));
  const disp = slotDisplay(slot);
  const b=h('button',{class:'tbtn'+(closed?' closed':(taken?' taken':''))+(selected&&!dead?' sel':'')+(o.cls?' '+o.cls:''), type:'button',
    'aria-pressed': (selected&&!dead)?'true':'false',
    'aria-label': disp+' — '+stateLbl+(o.price!=null?' — '+formatCurrency(o.price):'')}, disp);
  if (dead){
    /* ⚠️ `disabled` **يمنع الحدث** حتى على الأب — فالزرّ القابل للنقر رغم أنه
       محجوز لا يجوز أن يحمله. نستعمل `aria-disabled` بدله: القارئ يقول
       «محجوز» والزرّ يبقى مسموعًا للنقر. وبلا `onTaken` يعود `disabled` كما كان. */
    if (o.onTaken){
      b.setAttribute('aria-disabled','true');
      b.classList.add('taken-alt');
      b.addEventListener('click', o.onTaken);
    } else {
      b.setAttribute('disabled','');
    }
    b.append(h('span',{class:'t-tag'+(closed?' t-closed':'')}, closed ? t('closedTag') : (o.tag || t('bookedTag'))));
  } else {
    // السعر المختلف على الزرّ نفسه — قبل النقر لا بعده
    if(o.price!=null) b.append(h('span',{class:'t-price'}, h('bdi',{dir:'ltr'}, formatCurrency(o.price))));
    b.addEventListener('click', onClick);
  }
  return b;
}
/* تقسيم الأوقات لفترات اليوم (صباحاً/ظهراً/مساءً) — وضوح أعلى في تدفّق الحجز */
const TIME_PERIODS=[
  {key:'tmMorning', test:hr=>hr<12},
  {key:'tmNoon',    test:hr=>hr>=12&&hr<17},
  {key:'tmEvening', test:hr=>hr>=17},
];
/* ندرة الأوقات — لافتة تُعرض **فقط** حين يبقى وقت أو وقتان.
   العدد المعروض = عدد الأزرار القابلة للنقر بالضبط (نفس `free` أدناه)، فالمستخدم
   يستطيع عدّها بعينه ⇒ لا استعجال مخترَع (قاعدة الصدق م5). ولا نصّ عامّ لـ«n»
   لأن المعدود العربي يتغيّر مع العدد: نصّان جاهزان للمفرد والمثنّى. */
function scarcityBanner(free){
  if(free!==1 && free!==2) return null;
  return h('div',{class:'scarce', 'data-n':String(free)},
    h('span',{class:'scarce-dot','aria-hidden':'true'}),
    h('span',{class:'scarce-txt'}, t(free===1?'scarce1':'scarce2')));
}
function renderDetailTimes(){
  const el=$('#detailTimes'); clear(el);
  const fld=State.detail.field, date=State.detail.date;
  const slots=fieldSlots(fld);
  const taken=(State.bookedSlots[fld.field_id]?.[date])||[];
  const whole=dayClosure(fld.field_id, date);
  const open=openSlotsFor(fld, date);
  const free=open.filter(s=>!taken.includes(s.hour)).length;
  /* لوح الإغلاق أوّلًا وبسببه: يومٌ مظلم بلا كلمة يُقرأ عطلًا في التطبيق،
     ومكتوبٌ عليه سببُه معلومةٌ يحترمها اللاعب (م5). */
  if(whole){
    el.append(h('div',{class:'closed-note', style:{gridColumn:'1/-1'}},
      h('span',{class:'closed-ttl'}, t('dayClosedTitle')),
      h('span',{}, whole.reason ? t('closedBecause',{r:whole.reason}) : t('closedNoReason'))));
  }
  // اللافتة تُحسَب على المفتوح وحده — «باقي وقتان» على يوم نصفه مغلق صحيحة
  const scarce=(!whole) ? scarcityBanner(free) : null; if(scarce) el.append(scarce);
  TIME_PERIODS.forEach(p=>{
    const group=slots.filter(s=>p.test(Number(s.hour)));
    if(!group.length) return;
    el.append(h('div',{class:'time-period'}, t(p.key)));
    group.forEach((s,i)=>{
      const cl=slotClosure(fld.field_id, date, s.hour);
      // السعر يُمرَّر فقط حين يختلف — تمريره دائمًا يملأ الشبكة برقم مكرّر
      const pr=(!cl && !taken.includes(s.hour) && slotPriceDiffers(fld, date, s.hour)) ? slotPrice(fld, date, s.hour) : null;
      const isTaken = taken.includes(s.hour);
      const btn=timeButton(s, isTaken, State.detail.hour===s.hour,
        ()=>{ State.detail.hour=s.hour; renderDetailTimes(); },
        { closed:!!cl, reason: cl ? cl.reason : '', price: pr,
          /* ⚠️ **المحجوز يُنقَر، والمغلق لا** (٣.٢). محجوزٌ يعني «أراد غيرُك
             هذا الوقت» — وهذا سؤالٌ له جواب: أين أجده؟ ومغلقٌ يعني «لا أحد
             يلعب هنا» — لا بديل يُشتقّ منه على هذا الملعب في هذا الوقت.
             ولذلك بديلُ الأوّل لوحٌ فيه اقتراحات، والثاني يبقى صامتًا. */
          onTaken: (!cl && isTaken) ? (()=>openAltSheet(fld, date, s)) : null });
      btn.style.animationDelay=`${i*0.04}s`; el.append(btn);
    });
  });
  if(slots.length && free===0){
    if(!whole) el.append(h('div',{class:'no-times', style:{gridColumn:'1/-1'}}, t('noTimesDay')));
    const alt=alternativePanel(); if(alt) el.append(alt);
  }
  renderDetailSticky();
}

/* ===================== البديل الذكي حين يمتلئ اليوم =====================
   «اكتمل جدول هذا اليوم — جرّب يوماً آخر» تطلب من المستخدم أن يفتّش بنفسه عمّا
   نعرفه نحن أصلًا: كل أوقات المكان كلّها في `State.bookedSlots` منذ أول جلبة.
   هذه الدالّة تجيب بدلًا من أن تسأل.

   ⚠️ بلا باكند وبلا migration: لا قائمة انتظار ولا إشعار — كلاهما يحتاج جدولًا
   جديدًا ودالّة جديدة، وأيّ دالّة جديدة تعني هجرة معلَّقة على المالك. هذا يقرأ
   ما هو معروض على الشاشة فعلًا لا أكثر.
   ⚠️ وبلا وعد: يُعرَض الوقت الحقيقي الأوّل الذي يجده الفحص، وإن لم يجد شيئًا
   قال ذلك صراحةً (م5) بدل أن يصمت أو يقترح ما لا يملك.

   الترتيب: **نفس اليوم أوّلًا** على ملعب فرعي آخر (أقرب بديل نفسيًّا — الموعد
   محفوظ)، ثمّ الأيام التالية بالترتيب على أي ملعب. */
function findAlternative(){
  const place = State.detail.place; const cur = State.detail.field;
  if(!place || !cur) return null;
  const fields = (place.fields||[]).filter(f=>f.active!==false);
  /* المفتوح وحده (ترحيل 17): اقتراحُ خانةٍ مغلقة أسوأ من ألّا نقترح — ننقل
     المستخدم بضغطة إلى زرٍّ لا يستطيع النقر عليه، فيبدو التطبيق مكسورًا. */
  const firstFreeOn = (field, date) => {
    const taken=(State.bookedSlots[field.field_id]?.[date])||[];
    return openSlotsFor(field, date).find(s=>!taken.includes(s.hour)) || null;
  };
  // ① اليوم نفسه، ملعب فرعي آخر
  for(const f of fields){
    if(String(f.field_id)===String(cur.field_id)) continue;
    const s=firstFreeOn(f, State.detail.date);
    if(s) return { field:f, date:State.detail.date, slot:s, sameDay:true };
  }
  // ② الأيام التالية — الملعب الحالي أوّلًا في كل يوم، فهو ما اختاره المستخدم.
  // الفهرس يُشتقّ بالمطابقة على dateAfter نفسها التي بنت الشريط: لا حساب فرق
  // تواريخ بيد، فلا مجال لخطأ توقيت أو منطقة زمنية.
  let start = 0;
  for(let i=0;i<7;i++){ if(dateAfter(i)===State.detail.date){ start=i; break; } }
  for(let i=start+1;i<7;i++){
    const d=dateAfter(i);
    for(const f of [cur, ...fields.filter(f=>String(f.field_id)!==String(cur.field_id))]){
      const s=firstFreeOn(f, d);
      if(s) return { field:f, date:d, slot:s, sameDay:false };
    }
  }
  return null;
}
/* ═══════════ (٤) المباريات المفتوحة ═══════════════════════════════════════
   الحصّة **تقديرية دائمًا**: سعر الخانة ÷ عدد اللاعبين. ولا تُخزَّن — تُحسَب من
   `bookings.price` وهي لقطةٌ لا تتغيّر بتغيّر قواعد التسعير (ترحيل 18)، فما
   نُشر يبقى صحيحًا. ولا يُكتب «كل واحد بيدفع كذا»: التطبيق لا يقبض ولا يضمن. */
const gameShare = (price, total) => (total > 0) ? Math.round((Number(price)||0)/total*100)/100 : 0;
/* اقتراح العدد من حجم الملعب: «5×5» ⇒ عشرة. تلميحٌ لا قاعدة — المضيف يغيّره،
   وما لا يُقرأ منه رقمان لا يقترح شيئًا (ولا يخترع رقمًا). */
function suggestedPlayers(field){
  const m = String((field && field.size) || '').match(/(\d+)\s*[x×X]\s*(\d+)/);
  if(!m) return null;
  const n = Number(m[1]) + Number(m[2]);
  return (n >= 2 && n <= 40) ? n : null;
}
/* حالة نموذج «مفتوحة» داخل نافذة المراجعة.
   ⚠️ والكتابة مؤجَّلة 500ms: العنصر `aria-live` (انظر `app.html`)، وهو مربوط
   بـ`oninput` ⇒ بلا تأجيل ينطق قارئُ الشاشة **كل رقم وسيط** («٧ مقاعد» ثمّ
   «٧٢ مقعدًا» وأنت تكتب ٧٢)، وهو ضجيجٌ يُفقد المنطقة قيمتها. والمهلة تُلغى
   وتُعاد مع كل ضربة فلا يُنطق إلّا ما استقرّ. */
/* ── شريط الاكتمال: مكوّن واحد في ثلاثة مواضع ──
   نافذة المراجعة (المضيف يُنشئ) · بطاقة المباراة على الرئيسية · شيت الانضمام.
   ⚠️ **زخرفي دائمًا** (`aria-hidden` في الوسم): الرقم المكتوب بجانبه هو ما
   يُنطق، وشريطٌ يُنطق «٦٢٪» يقول الشيء مرّتين بصيغتين لا تتطابقان.
   ⚠️ و`Math.min` لازم: المُحضَر قد يتجاوز المطلوب لحظةَ الكتابة (تكتب ١٢ في
   خانة «معك» قبل أن ترفع «المطلوب») فيخرج الشريط عن غلافه. */
function seatBarFill(el, done, total){
  if(!el) return;
  const pct = (total > 0) ? Math.min(100, Math.max(0, done/total*100)) : 0;
  const f = el.querySelector('.seat-bar-fill'); if(f) f.style.inlineSize = pct+'%';
}
function seatBar(done, total){
  const el = h('div',{class:'seat-bar','aria-hidden':'true'}, h('span',{class:'seat-bar-fill'}));
  seatBarFill(el, done, total);
  return el;
}
let gmLiveTimer = null;
function renderGmLive(){
  const box=$('#gmFields'), out=$('#gmLive'); if(!box || box.hidden) return;
  /* الشريط يتبع الكتابة **فورًا** بينما النصّ مؤجَّل: هو زخرفة لا يسمعها أحد،
     فتأخيره يجعله يتخلّف عن الأرقام التي تحته بنصف ثانية بلا سبب. */
  seatBarFill($('#gmBar'), Number($('#gmBrought').value)||0, Number($('#gmNeeded').value)||0);
  clearTimeout(gmLiveTimer);
  gmLiveTimer = setTimeout(()=>{
    if(!out.isConnected || box.hidden) return;
    const need=Number($('#gmNeeded').value), got=Number($('#gmBrought').value);
    const f=State.detail.field, d=State.detail.date, hr=State.detail.hour;
    if(!(need>=2) || !(got>=1) || got>need){ out.textContent=t('gmLiveBad'); return; }
    const seats=need-got;
    clear(out);
    out.append(document.createTextNode(t('gmLiveSeats',{ n:seats, noun:nSeats(seats) })+' '));
    // الحصّة **موسومة** بأنها تقدير ومن يقبضها — لا رقم عارٍ
    out.append(h('span',{class:'gm-share'},
      t('gmLiveShare',{ v:formatCurrency(gameShare(slotPrice(f,d,hr), need)) })));
    /* والشرط بعده مباشرةً: الرقم يفترض اكتمال العدد، والناقص على المضيف.
       داخل نفس `aria-live` فيُنطق مع الحصّة لا منفصلًا عنها. */
    out.append(h('span',{class:'gm-share-cond'}, ' '+t('gmShareCond')));
  }, 500);
}
/* ═══════════════ شاشات الترحيب — أوّل تشغيل فقط ═══════════════════════════
   لا تحلّ محلّ `#page-welcome`: هذه تقول **ما الذي يفعله التطبيق**، وتلك تسأل
   **من أنت وماذا تريد الآن**. فلا زرّ دخول ولا تسجيل هنا، ولا إجبار على الإكمال.
   ⚠️ والمفتاح **رقم إصدار** لا `true/false`: تغييرٌ جوهري لاحق يرفعه فتُعرَض
   ثانيةً؛ والقيمة المنطقية تحبسك في «عُرضت مرّة وانتهى».
   ⚠️ وفشل القراءة = **تخطٍّ** لا تكرار: تخزينٌ معطَّل يعني أن الشاشات ستُعرَض
   عند كل إقلاع إلى الأبد، وهو أسوأ من ألّا تُعرَض أصلًا.
   ══════════════════════════════════════════════════════════════════════════ */
/* ⚠️ **رقم إصدار، ورُفع إلى `'2'`**: التوزيع تغيّر (ثلاث مضمونة ورابعة مشروطة)
   وشريحةٌ جديدة أُضيفت، فمن رأى النسخة الأولى لم يرَ ما يقوله المنتج اليوم. */
const OBS_KEY = 'mustadaira:onb', OBS_VER = '3';
const Obs = {
  i:0, n:0, slides:[], built:false,
  /* «مفتوحة» = الصفحة نفسها معروضة. علَمٌ مستقلّ كان يفترق عن الواقع في مسارٍ
     واحد على الأقلّ (‏`showPage` من مكانٍ آخر يترك `open=true`). */
  get open(){ return activePageName()==='onboarding'; },
  shouldShow(){
    try{ return localStorage.getItem(OBS_KEY) !== OBS_VER; }
    catch(_){ return false; }          // الفشل الآمن هو التخطّي
  },
  seen(){ try{ localStorage.setItem(OBS_KEY, OBS_VER); }catch(_){} },
  /* البناء مرّةً واحدة: حذف الشريحة المشروطة وربط السحب. ويُنادى من `showPage`
     عند دخول الصفحة، فلا يوجد مسارٌ يعرضها بلا بناء. */
  build(){
    const el=$('#obs'); if(!el) return false;
    /* ⚠️ الشريحة **الرابعة** تُحذف من الـDOM إن لم يكن العلَم `true` **حرفيًّا**:
       `null` (لم نسأل بعد — وهي الحالة عند أوّل إقلاع لأن لا جلسة) تُعامَل
       معاملة `false`. ميزةٌ خلف علَمٍ مُطفأ لا تُعلَن. والثلاث الأولى غير
       مشروطة ⇒ أوّل إقلاع بلا جلسة وبلا شبكة يعرض ثلاثًا لا اثنتين. */
    if (GAMES_OK !== true) el.querySelectorAll('[data-needs-games]').forEach(s=>s.remove());
    this.slides = [...el.querySelectorAll('.obs-slide')];
    this.n = this.slides.length;
    if(!this.n) return false;
    if(!this.built){ this.built=true; enableSwipeX($('#obsTrack'), d=>{ if(d>0) Obs.next(); else Obs.prev(); }); }
    return true;
  },
  /* ⚠️ `redirect` في الاتجاهين: الشرائح **لا تدخل المكدّس** أصلًا لأن الرجوع
     داخلها يتنقّل بين الشرائح، وعلى الأولى يغادر — فلو دخلت المكدّس لعاد إليها
     زرُّ الرجوع من الصفحة التالية بعد أن أنهاها المستخدم. و`from` يحفظ من أين
     جاء كي يرجع إليه: أوّل إقلاع من «الترحيب»، و«شوف شاشات التعريف» من «حسابي». */
  from:'welcome',
  start(){
    if(!this.build()) return false;
    this.from = activePageName() || 'welcome';
    showPage('onboarding',{ redirect:true });
    return true;
  },
  /* تُنادى من `showPage` بعد أن تصير الصفحة نشِطة — لا من `start` وحدها:
     المسار من زرّ «شوف شاشات التعريف» ومسار أوّل إقلاع كلاهما يمرّ بها. */
  enter(){ if(this.build()) this.go(0, true); },
  go(k, first){
    if(k<0 || k>=this.n) return;
    this.i=k;
    $('#obs').style.setProperty('--obs-i', String(k));
    this.slides.forEach((s,j)=>{
      const on = j===k;
      s.setAttribute('aria-hidden', on?'false':'true');
      /* غير النشطة خارج ترتيب التنقّل: `inert` حيث تُدعَم، و`tabindex="-1"`
         على عناصرها التفاعلية بديلًا — وإلّا وصلها Tab وهي غير مرئية. */
      if('inert' in s) s.inert = !on;
      else s.querySelectorAll('button,a,input,[tabindex]').forEach(x=>x.tabIndex = on?0:-1);
    });
    /* النقاط زخرفة (`aria-hidden` في الوسم) — العدد المنطوق في `#obsLive`.
       وتُبنى مرّةً ثمّ تُحدَّث حالتها: إعادة بنائها في كل تنقّل تُلغي انتقال
       العرض فتقفز الحبّة النشِطة بدل أن تتمدّد. */
    const dots=$('#obsDots');
    if(dots){
      /* شريحةٌ واحدة ⇒ لا نقاط: نقطةٌ وحيدة تقول «واحدة من واحدة» فلا تخبر
         بشيء وتُقرأ عنصرَ واجهةٍ معطَّلًا. وهي الحالة الغالبة عند أوّل إقلاع
         (‏`GAMES_OK` يبدأ `null` فتُحذف المشروطة).
         ⚠️ والصنف بـ`visibility` لا السمة `hidden`: الأخيرة تصطدم بـ
            `[hidden]{display:none!important}` العامّة، والذيل شبكةُ
            `1fr auto 1fr` تحتاج بقاء الصندوق كي يبقى الزرّ في مساره —
            نفس درس انزياح النقاط المسجَّل في الدفعة ٢٩. */
      dots.classList.toggle('is-off', this.n < 2);
      if(dots.childElementCount !== this.n){ clear(dots);
        for(let j=0;j<this.n;j++) dots.append(h('span',{class:'obs-dot'})); }
      [...dots.children].forEach((d,j)=>d.classList.toggle('on', j===k));
    }
    /* 🔴 **لا `hidden` هنا**: في الورقة `[hidden]{display:none!important}` عامّة،
       فأي محاولة لإبقاء العنصر في التدفّق بـ`visibility` تخسر أمام `!important`
       ⇒ الزرّ يفقد حصّته من الصفّ فتنزاح النقاط عن المنتصف في الشريحة الأولى
       وحدها (مقيس: مركزها 329 مقابل 188). الصنف يحتفظ بالصندوق ويُخفي المحتوى،
       ومعه `aria-hidden` و`tabindex` كي لا يصله Tab ولا قارئ الشاشة. */
    const bk=$('#obsBack');
    if(bk){ const off = (k===0);
      bk.classList.toggle('is-off', off);
      bk.setAttribute('aria-hidden', off?'true':'false');
      bk.tabIndex = off ? -1 : 0; }
    const last = k===this.n-1;
    const go=$('#obsGo');
    /* `sbtn` معه: هو من يحمل قاعدة «أبيض على التيل نهارًا وحبرٌ داكن على
       الـLime ليلًا». صبغُه هنا كان سيعطي أبيض على Lime = 2.05:1. */
    if(go){ go.classList.toggle('is-last', last); go.classList.toggle('sbtn', last); }
    setText('obsGo', t(last ? 'onbStart' : 'onbNext'));
    const ttl = this.slides[k].querySelector('.obs-t');
    if(ttl && !first) ttl.focus();
    /* منطقة إعلان **واحدة** لكل الشرائح — لا واحدة لكل شريحة */
    setText('obsLive', (ttl?ttl.textContent+' — ':'') + t('onbDotAria',{ i:k+1, n:this.n }));
  },
  next(){ if(this.i < this.n-1){ this.go(this.i+1); buzz(6); } else this.finish(); },
  prev(){ if(this.i > 0){ this.go(this.i-1); buzz(6); } },
  /* زرّ الرجوع (وإيماءته): شريحةً شريحة، وعلى الأولى يغادر إلى «الترحيب» ولا
     يُغلق التطبيق. يُرجع `true` دائمًا كي يعرف الجسر أن الحدث استُهلك. */
  back(){ if(this.i > 0){ this.prev(); return true; } this.finish(); return true; },
  finish(){
    this.seen();
    showPage(this.from || 'welcome',{ redirect:true });
    $('#app')?.focus();
  }
};

/* ═══════════ مجموعات الاختيار: tabindex متنقّل + تنقّل بالأسهم ═══════════
   الترميز كان صحيحًا أصلًا (‏`role` + `aria-checked`/`aria-selected`) لكنّ
   السلوك لم يكن سلوك مجموعة: كلّ زرّ محطّةُ Tab مستقلّة، ولا أسهم. والمجموعة
   الواحدة محطّةٌ واحدة — من دخلها بـTab يخرج منها بـTab، ويتنقّل داخلها بالأسهم.
   تشمل: `#matchPick` · `.pay-pick` · `#detailTabs` · `#modeSeg` · `.onb-seg`.
   ══════════════════════════════════════════════════════════════════════ */
function initRovingGroups(root){
  (root||document).querySelectorAll('[role="radiogroup"],[role="tablist"]').forEach(g=>{
    if(g.__roving) return; g.__roving = true;
    /* أبناء هذه المجموعة وحدها — لا أبناء مجموعةٍ متداخلة */
    const items = () => [...g.querySelectorAll('[role="radio"],[role="tab"]')]
      .filter(el => el.closest('[role="radiogroup"],[role="tablist"]') === g);
    const sync = () => { const list = items();
      const on = list.find(el => el.getAttribute('aria-checked')==='true'
                              || el.getAttribute('aria-selected')==='true') || list[0];
      list.forEach(el => { el.tabIndex = (el===on ? 0 : -1); }); };
    sync();
    /* المراقب لا مناداةٌ من كل مبدِّل: الاختيار يتغيّر من خمسة مسارات مختلفة
       (نقر · سهم · برمجيًّا · استئناف حجز · تبديل لغة)، ومزامنةٌ تُنادى في
       بعضها تنحرف صامتةً في الباقي. والسمة نفسها هي مصدر الحقيقة. */
    new MutationObserver(sync).observe(g, { subtree:true, attributes:true,
      attributeFilter:['aria-checked','aria-selected'] });
    g.addEventListener('keydown', e=>{
      const list = items(); const i = list.indexOf(document.activeElement);
      if(i < 0 || !list.length) return;
      /* ⚠️ السهم فيزيائي كما `transform`: في RTL يمينُ الشاشة هو **السابق**
         لا التالي. قراءة `dir` شرطٌ لا تحسين — وبعكسها يمشي التنقّل مقلوبًا
         في لغةٍ واحدة فقط، وهو بالضبط الخلل الذي لا يظهر إلّا في اتجاه. */
      const rtl = document.documentElement.dir === 'rtl';
      let n = null;
      if(e.key==='ArrowDown' || e.key===(rtl?'ArrowLeft':'ArrowRight')) n = (i+1)%list.length;
      else if(e.key==='ArrowUp' || e.key===(rtl?'ArrowRight':'ArrowLeft')) n = (i-1+list.length)%list.length;
      else if(e.key==='Home') n = 0;
      else if(e.key==='End') n = list.length-1;
      else return;
      e.preventDefault();
      const el = list[n]; el.focus();
      /* نمط WAI-ARIA: التحرّك يختار. وهو صحيح هنا لأن كل تبويب يبدّل لوحًا
         موجودًا بلا جلب شبكة ⇒ لا كلفة على المرور. ⚠️ و`aria-disabled` تُستثنى
         من الاختيار لا من التركيز: «فيزا — قريباً» تُسمَع وتُشرَح ولا تُختار. */
      if(el.getAttribute('aria-disabled') !== 'true') el.click();
    });
  });
}

function setVisPick(vis){
  State.gmVis = vis;
  $$('#matchPick .pay-opt').forEach(o=>{ const on=o.dataset.vis===vis;
    o.classList.toggle('is-on', on); o.setAttribute('aria-checked', on?'true':'false'); });
  const box=$('#gmFields'); if(box){ box.hidden = vis!=='open'; if(vis==='open') renderGmLive(); }
}

/* ── قائمة المباريات على الرئيسية ── */
function gameCard(g, joinedIds){
  const mine = joinedIds.includes(String(g.id));
  const seats = Number(g.seats_left||0);
  const total = Number(g.players_needed||0);
  const card=h('div',{class:'game-card'+(mine?' is-mine':'')},
    h('div',{class:'gc-top'},
      h('div',{class:'gc-where'},
        h('div',{class:'gc-place'}, h('bdi',{}, g.place_name||''), ' · ', h('bdi',{}, g.field_name||'')),
        h('div',{class:'gc-meta'}, ico('pin','svg-sm'), ' ', h('bdi',{}, g.region||g.city||''))),
      h('span',{class:'gc-seats'+(seats<=2?' few':'')},
        h('bdi',{dir:'ltr'}, `${total-seats}/${total}`))),
    // نفس مكوّن الشريط المستعمل في نافذة المراجعة وشيت الانضمام — لا نسخة ثالثة
    seatBar(total-seats, total),
    h('div',{class:'gc-row'},
      h('span',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+dayLabel(g.booking_date)+' '+shortDate(String(g.booking_date).split('T')[0])),
      h('span',{class:'info-line muted'}, ico('clock','svg-sm'), ' ', h('bdi',{dir:'ltr'}, slotDisplay({hour:Number(g.hour),startHour:Number(g.hour),endHour:Number(g.hour)+2,label:g.time_label||''})))),
    h('div',{class:'gc-row'},
      h('span',{class:'info-line muted'}, ico('person','svg-sm'), ' ', h('bdi',{}, g.host_name||t('gmHostUnknown'))),
      h('span',{class:'info-line muted'}, ico('money','svg-sm'), ' ',
        h('bdi',{dir:'ltr'}, formatCurrency(gameShare(g.price, total))), ' ', h('small',{class:'gc-est'}, t('gmShareTag')))));
  if(mine){
    card.append(h('div',{class:'gc-mine'}, ico('check','svg-sm'), ' '+t('gmYouIn')));
  } else {
    const b=h('button',{class:'sbtn gc-join'}, t('gmJoinBtn'));
    b.addEventListener('click', ()=>openJoinSheet(g));
    card.append(b);
  }
  return card;
}
async function renderGames(){
  const el=$('#gamesList'); if(!el) return;
  clear(el); el.append(...[0,1].map(()=>h('div',{class:'skeleton-card'}, h('div',{class:'sk-body'}, h('div',{class:'sk sk-line w70'}), h('div',{class:'sk sk-line w45'})))));
  let res;
  try{ res = await API.get('getOpenGames', {}, 'openGames'); }
  catch(e){ if(isAbort(e)) return; clear(el); el.append(emptyState({icon:'📡',title:t('connProblem'),sub:t('connProblemSub')})); return; }
  clear(el);
  if(!res.success){
    // الترحيل معلَّق ⇒ المبدّل نفسه يختفي، فلا يبقى تبويبٌ يفتح على عذر
    if(res.missing){ updateModeSeg(); setMode('venues'); return; }
    el.append(emptyState({icon:'⚠️',title:t('gmLoadFail'),sub:t('tryAgain')})); return;
  }
  /* ⚠️ **نفس نطاق الرياضة** الذي تراه بقيّة الشاشة: `State.places` مشتقّة من
     `applySportScope`، فالتصفية بها لا بفحص `State.sport` مرّةً أخرى — موضعٌ
     ثامن يفحص الرياضة بنفسه هو بالضبط ما رُفض في الدفعة الحادية عشرة. */
  const scope = new Set((State.places||[]).map(p=>String(p.place_id)));
  const list = (res.games||[]).filter(g=>scope.has(String(g.place_id)) && Number(g.seats_left)>0);
  State.gamesJoined = res.joined || [];
  if(!list.length){
    el.append(emptyState({ iconHtml:courtSvg(State.sport), icon:'🤝',
      title:t('gmNoneTitle'), sub:t('gmNoneSub'),
      actionLabel:t('gmNoneCta'), action:()=>setMode('venues') }));
    return;
  }
  list.forEach((g,i)=>{ const c=gameCard(g, State.gamesJoined); c.style.animationDelay=`${Math.min(i,7)*0.05}s`; el.append(c); });
}
/* يُنادى بعد كل جلبة. يسأل القاعدة مرّةً واحدة (‏`GAMES_OK` يبقى بعدها)، ثمّ
   يُظهر المبدّل أو يُبقيه مخفيًّا. والضيف لا يراه أصلًا: الانضمام يتطلّب حسابًا. */
async function updateModeSeg(){
  const seg=$('#modeSeg'), row=$('#modeRow'); if(!seg) return;
  const tok=Session.player();
  if(tok && GAMES_OK === null){
    try{ await sbProbeGames(await sbSession(tok, false)); }catch(_){}
  }
  /* ⚠️ الإخفاء على **الصفّ** لا على المبدّل وحده: صار صفًّا مستقلًّا في الغلاف
     اللاصق، وإخفاء ابنه يترك حشوةَ الصفّ فيبقى شريطٌ فارغ بارتفاعٍ بلا محتوى. */
  const off = (GAMES_OK !== true) || !tok;
  seg.hidden = off; if(row) row.hidden = off;
  if(off && State.mode==='games') setMode('venues');
}
function setMode(m){
  State.mode = (m==='games') ? 'games' : 'venues';
  $$('#modeSeg .mode-btn').forEach(b=>{ const on=b.dataset.mode===State.mode;
    b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
  /* موضع الحبّة المنزلقة — نفس متغيّر مبدّل «لاعب/صاحب ملعب» بالحرف.
     والحبّة تُقاس من CSS لا من JS: الأزرار متساوية بـ`flex:1` فالنصف معلوم. */
  const seg=$('#modeSeg'); if(seg) seg.style.setProperty('--seg-i', State.mode==='games'?'1':'0');
  const pl=$('#placesList'), gl=$('#gamesList'), cnt=$('#placesCount');
  const games = State.mode==='games';
  if(pl) pl.hidden=games; if(gl) gl.hidden=!games;
  if(cnt) cnt.hidden = games || !cnt.textContent;
  updateSecTitle();
  /* 🔴 **لا يُخفى الغلاف اللاصق كلّه** — كان `homeSticky.hidden = games`، ثمّ صار
     المبدّل نفسه ابنًا لهذا الغلاف (الدفعة ٢٢) ⇒ اختيار «مباريات» يُخفي المبدّل
     الذي به وحده يُرجَع إلى «ملاعب»: **مصيدة**. (بلاغ المالك 2026-08-11.)
     الآن يُخفى **ما يخصّ تصفّح الملاعب وحده** (الفلاتر · المناطق · الرياضة ·
     شرائح الفلاتر المفعّلة)، ويبقى صفّ المبدّل ملتصقًا في الوضعين.
     ⚠️ والدرس أعمّ: أيّ عنصرٍ يُنقَل داخل حاويةٍ تُخفى بالكامل يرث إخفاءها —
     فابحث عن `.hidden = ` على الحاوية قبل نقل أي شيء إليها. */
  const bs=$('#browseSticky'); if(bs) bs.hidden=games;
  /* شرائح الفلاتر المفعّلة: تُخفى في «مباريات»، وعند العودة **تُعاد بناؤها** لا
     تُظهَر عمياءً — `renderFilterChips` هي وحدها من يعرف أفارغةٌ هي أم لا. */
  const fc=$('#fchipsBar');
  if(fc){ if(games) fc.hidden=true; else renderFilterChips(); }
  if(games) renderGames();
}
/* ── الانضمام ── */
function openJoinSheet(g){
  State.joinGame = g;
  const w=$('#jnWhere'); clear(w);
  const total = Number(g.players_needed||0), seats = Number(g.seats_left||0);
  w.append(
    h('div',{class:'jn-line strong'}, h('bdi',{}, g.place_name||''), ' · ', h('bdi',{}, g.field_name||'')),
    h('div',{class:'jn-line'}, dayLabel(g.booking_date)+' '+shortDate(String(g.booking_date).split('T')[0])+' · ',
      h('bdi',{dir:'ltr'}, slotDisplay({hour:Number(g.hour),startHour:Number(g.hour),endHour:Number(g.hour)+2,label:g.time_label||''}))),
    h('div',{class:'jn-line'}, t('gmHostIs',{ n: g.host_name || t('gmHostUnknown') })),
    /* ⚠️ **المقاعد المتبقّية كانت غائبة عن الشاشة التي يُتَّخذ عليها القرار.**
       البطاقة تعرضها، والشيت — وهو آخر ما يُقرأ قبل «انضمّ» — لا. ونفس مكوّن
       الشريط، لا ثالثٌ يُرسَم هنا بأرقام مختلفة. */
    h('div',{class:'jn-line jn-seats'}, t('gmLiveSeats',{ n:seats, noun:nSeats(seats) })),
    seatBar(total-seats, total));
  const sh=$('#jnShare'); clear(sh);
  sh.append(document.createTextNode(t('joinTermShare',{ v: formatCurrency(gameShare(g.price, Number(g.players_needed||0))) })));
  /* نفس الشرط الذي يراه المضيف — المنضمّ يقرّر على الرقم نفسه فيلزمه القيد نفسه */
  sh.append(h('span',{class:'gm-share-cond'}, ' '+t('gmShareCond')));
  Modal.open('modal-join');
}
/* بطاقة نجاح الانضمام — بمكوّن `success` القائم لا بمودال جديد.
   كان المسار ينتهي بـ`toast` يختفي بعد ثوانٍ، بينما المضيف يخرج بإيصالٍ كامل:
   والمنضمّ التزم بمكانٍ ويومٍ ووقتٍ ومبلغٍ ومضيف. ولا رقم حجز له (الحجز حجزُ
   المضيف) فلا يُخترَع سطرٌ فارغ مكانه.
   ⚠️ و«أضِف إلى التقويم» تُعيد استعمال `downloadBookingIcs` نفسها بغلافٍ يوفّر
   ما تقرأه فقط — لا نسخة ثانية من مولّد ICS تنحرف عن الأولى. */
function showJoinSuccess(g){
  resetSuccessCard();
  const icon=$('#successIcon'); if(icon){ void icon.offsetWidth; icon.classList.add('is-check'); icon.innerHTML=ICON.check; }
  setText('successTitle', t('gmJoined'));
  setText('successText', `${g.place_name||''} · ${g.field_name||''}`);
  const date = String(g.booking_date||'').split('T')[0];
  const hour = Number(g.hour);
  const slot = { hour, startHour:hour, endHour:hour+2, label:g.time_label||'' };
  const total = Number(g.players_needed||0);
  const sum=$('#successSummary'); sum.hidden=false; clear(sum);
  const cell=(lbl,val,icn)=> h('div',{class:'ss-cell'}, h('div',{class:'ss-cell-lbl'}, ico(icn,'svg-sm'), ' '+lbl), h('div',{class:'ss-cell-val'}, val));
  sum.append(h('div',{class:'ss-grid'},
    cell(t('rvDay'), `${dayLabel(date)} ${shortDate(date)}`, 'cal'),
    cell(t('rvTime'), slotDisplay(slot), 'clock'),
    cell(t('rvHost'), h('bdi',{}, g.host_name||t('gmHostUnknown')), 'person'),
    /* الحصّة **موسومة تقديرًا** هنا كما في كل موضع آخر — رقمٌ عارٍ يُقرأ سعرًا مقطوعًا */
    cell(t('rvPrice'), h('span',{}, h('bdi',{dir:'ltr'}, formatCurrency(gameShare(g.price, total))),
      ' ', h('small',{class:'gc-est'}, t('gmShareTag'))), 'money')));
  const act=$('#successActions'); clear(act);
  const goB=h('button',{class:'sbtn'}, t('navBookings')); goB.addEventListener('click',()=>{ Modal.close('success'); showPage('bookings'); });
  const goC=h('button',{class:'cbtn'}, ico('cal','svg-sm'), ' '+t('addToCalendar'));
  goC.addEventListener('click',()=>downloadBookingIcs({
    place:{ place_name:g.place_name, city:g.city, region:g.region },
    field:{ field_id:g.field_id||g.id||'', field_name:g.field_name },
    date, hour }));
  const goH=h('button',{class:'cbtn'}, t('navHome')); goH.addEventListener('click',()=>{ Modal.close('success'); showPage('home'); });
  act.append(goB, goC, goH);
  Modal.open('success');
}
async function confirmJoin(btn){
  const g=State.joinGame; if(!g) return;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'joinGame', player_token:Session.player(), booking_id:g.id });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); await renderGames(); return; }
    Modal.close('modal-join', true);
    showJoinSuccess(g);
    await renderGames();
  });
}
/* ── المضيف يدير مباراته ── */
async function openMatchManage(b){
  State.matchBooking = b;
  setText('mtWhere', `${b.place_name} · ${b.field_name} — ${dayLabel(b.date)} ${shortDate(b.date)}`);
  $('#mtNeeded').value = b.needed || '';
  $('#mtBrought').value = b.brought || '';
  clear($('#mtPlayers')); $('#mtPlayers').append(h('div',{class:'pr-empty'}, t('loadingBookings')));
  Modal.open('modal-match');
  const res = await API.get('getGamePlayers', { booking_id: b.row_number }, 'gamePlayers');
  const players = (res && res.players) || [];
  const taken = players.length;
  const seats = Math.max(Number(b.needed||0) - Number(b.brought||0) - taken, 0);
  setText('mtSeats', t('gmSeatsState',{ n:seats, noun:nSeats(seats), joined:taken }));
  const box=$('#mtPlayers'); clear(box);
  if(!players.length){ box.append(h('div',{class:'pr-empty'}, t('gmNoPlayersYet'))); return; }
  players.forEach(p=>{
    const name = p.first_name || t('gmHostUnknown');
    const rm=h('button',{class:'owner-action owner-reject pr-del'}, t('gmRemove'));
    rm.addEventListener('click', ()=>removeGamePlayer(rm, b, name));
    box.append(h('div',{class:'pr-row'}, h('span',{class:'pr-row-main'}, h('bdi',{}, name)), rm));
  });
}
async function removeGamePlayer(btn, b, name){
  const ok = await askConfirm(t('gmRemoveTitle'), t('gmRemoveMsg',{ n:name }), t('gmRemove'), null, true);
  if(!ok) return;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'removeGamePlayer', player_token:Session.player(), booking_id:b.row_number, first_name:name });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); return; }
    toast(t('gmRemoved'),'success');
    await openMatchManage(b);
  });
}
async function saveMatch(btn){
  const b=State.matchBooking; if(!b) return;
  const need=Number($('#mtNeeded').value), got=Number($('#mtBrought').value);
  if(!(need>=2) || !(got>=1) || got>need){ toast(t('gmLiveBad'),'warn'); return; }
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'setOpenGame', player_token:Session.player(), booking_id:b.row_number, open:true, needed:need, brought:got });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); return; }
    b.needed=need; b.brought=got;
    toast(t('gmSaved'),'success');
    await openMatchManage(b);
    loadPlayerBookings();
  });
}
/* «العدد اكتمل» = خفضُ المطلوب إلى ما عندك الآن ⇒ صفر مقاعد. لا عمود ثالث
   لحالة «مغلقة»: حالةٌ تُشتقّ من رقمٍ قائم أصدق من علَمٍ قد يخالفه. */
async function closeMatchSeats(btn){
  const b=State.matchBooking; if(!b) return;
  const res = await API.get('getGamePlayers', { booking_id: b.row_number }, 'gamePlayers2');
  const taken = ((res && res.players) || []).length;
  const need = Number(b.brought||1) + taken;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'setOpenGame', player_token:Session.player(), booking_id:b.row_number, open:true, needed:need, brought:Number(b.brought||1) });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); return; }
    b.needed=need;
    toast(t('gmSeatsClosed'),'success');
    Modal.close('modal-match', true); loadPlayerBookings();
  });
}
async function makeMatchPrivate(btn){
  const b=State.matchBooking; if(!b) return;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'setOpenGame', player_token:Session.player(), booking_id:b.row_number, open:false });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); return; }
    b.visibility='private'; b.needed=null; b.brought=null;
    toast(t('gmNowPrivate'),'success');
    Modal.close('modal-match', true); loadPlayerBookings();
  });
}
async function leaveGame(btn, bookingId){
  const ok = await askConfirm(t('gmLeaveTitle'), t('gmLeaveMsg'), t('gmLeaveBtn'), null, true);
  if(!ok) return;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'leaveGame', player_token:Session.player(), booking_id:bookingId });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('gmErrGeneric'),'error'); return; }
    toast(t('gmLeft'),'success');
    loadPlayerBookings();
  });
}

/* ═══ (٣.٢) لوح بدائل خانةٍ بعينها ═══════════════════════════════════════
   «البديل الذكي» القديم لا يعمل إلّا حين يمتلئ **اليوم كلّه**. ومن يريد الخميس
   ٨ مساءً تحديدًا فيجدها محجوزة يصطدم بزرٍّ ميّت ولا شيء بعده — وهو أكثر ما
   يحدث فعلًا: الساعة المطلوبة قليلة، لا اليوم.
   الترتيب مقصود من الأقرب إلى ما طلبه:
     ① نفس الساعة · نفس المكان · ملعب آخر  (الموعد محفوظ تمامًا)
     ② أقرب ساعة فارغة · نفس اليوم         (اليوم محفوظ)
     ③ نفس الساعة · أقرب يوم                (الساعة محفوظة)
     ④ نفس الساعة · مكان آخر في نفس المنطقة (المكان يتغيّر، وهو آخر ما يُتنازَل عنه)
   ولا يُعرَض إلّا الموجود فعلًا: لا لوح فارغ ولا بطاقة نائبة (م5). */
function slotAlternatives(field, date, slot){
  const out = [];
  const place = State.detail.place;
  const free = (f, d, hr) => {
    if(f.active===false) return false;
    if(!fieldSlots(f).some(s=>s.hour===hr)) return false;
    if(!isSlotOpen(f.field_id, d, hr)) return false;
    return !((State.bookedSlots[f.field_id]?.[d])||[]).includes(hr);
  };
  // ① ملعب آخر في نفس المكان، نفس الساعة
  (place?.fields||[]).forEach(f=>{
    if(String(f.field_id)===String(field.field_id)) return;
    if(free(f, date, slot.hour)) out.push({ kind:'field', place, field:f, date, hour:slot.hour });
  });
  // ② أقرب ساعة في نفس اليوم على نفس الملعب — الأقرب زمنيًّا لا الأولى في الجدول
  const sameDay = fieldSlots(field).filter(s=>free(field, date, s.hour))
    .sort((a,b)=>Math.abs(a.hour-slot.hour)-Math.abs(b.hour-slot.hour));
  if(sameDay[0]) out.push({ kind:'hour', place, field, date, hour:sameDay[0].hour });
  // ③ نفس الساعة في أقرب يوم قادم
  let start=0; for(let i=0;i<7;i++){ if(dateAfter(i)===date){ start=i; break; } }
  for(let i=start+1;i<7;i++){
    const d=dateAfter(i);
    if(free(field, d, slot.hour)){ out.push({ kind:'day', place, field, date:d, hour:slot.hour }); break; }
  }
  // ④ مكان آخر في نفس المنطقة، نفس اليوم والساعة
  const region = normalizeText(place?.region||'');
  for(const p of (State.places||[])){
    if(String(p.place_id)===String(place?.place_id)) continue;
    if(region && normalizeText(p.region||'')!==region) continue;
    const f=(p.fields||[]).find(x=>free(x, date, slot.hour));
    if(f){ out.push({ kind:'place', place:p, field:f, date, hour:slot.hour }); break; }
  }
  return out.slice(0, 4);
}
function openAltSheet(field, date, slot){
  State.altAsk = { field, date, slot };
  const el=$('#altList'); if(!el) return;
  setText('altAskTitle', t('altAskTitle'));
  setText('altAskSub', t('altAskSub',{ day: dayLabel(date), time: slotDisplay(slot) }));
  clear(el);
  const list = slotAlternatives(field, date, slot);
  if(!list.length){
    el.append(h('div',{class:'alt-none'}, t('altSheetNone')));
  } else {
    const label = {
      field: (a)=>t('altKindField',{ f:a.field.field_name }),
      hour:  (a)=>t('altKindHour'),
      day:   (a)=>t('altKindDay',{ d:dayLabel(a.date) }),
      place: (a)=>t('altKindPlace',{ p:a.place.place_name })
    };
    list.forEach(a=>{
      const sl = fieldSlots(a.field).find(s=>s.hour===a.hour);
      const row=h('button',{class:'alt-row', type:'button'},
        h('span',{class:'alt-row-main'},
          h('span',{class:'alt-row-why'}, label[a.kind](a)),
          h('span',{class:'alt-row-when'},
            h('bdi',{}, a.place.place_name), ' · ', h('bdi',{}, a.field.field_name), ' · ',
            dayLabel(a.date), ' · ', h('bdi',{dir:'ltr'}, sl?slotDisplay(sl):''))),
        h('span',{class:'alt-row-go'}, h('bdi',{dir:'ltr'}, formatCurrency(slotPrice(a.field, a.date, a.hour)))));
      row.addEventListener('click', ()=>{ Modal.close('modal-alt', true); goToAlternative(a); });
      el.append(row);
    });
  }
  /* «نبّهني» — يظهر فقط حين نستطيع الوفاء: جلسةٌ قائمة **و**جدولُ الرغبات
     موجود (ترحيل 20) **و**الإشعارات مفعّلة (14، وهي شرط 20 أصلًا). */
  const w=$('#altWatch');
  const can = !!Session.player() && WATCH_OK;
  w.hidden = !can;
  if(can){ w.disabled=false; w.textContent=t('watchBtn'); w.onclick=()=>watchThisSlot(w); }
  Modal.open('modal-alt');
}
function goToAlternative(a){
  if(String(a.place.place_id)!==String(State.detail.place.place_id)){
    openDetail(a.place.place_id).then(()=>{
      State.detail.field=a.field; State.detail.date=a.date; State.detail.hour=a.hour;
      renderSubFields(); renderDetailDays(); renderDetailTimes(); renderDetailSticky();
    });
    return;
  }
  State.detail.field=a.field; State.detail.date=a.date; State.detail.hour=a.hour;
  setText('dPrice', formatCurrency(a.field.price));
  renderSubFields(); renderDetailDays(); renderDetailTimes(); renderDetailSticky();
  scrollToDetailSection('time');
}
async function watchThisSlot(btn){
  const a=State.altAsk; if(!a) return;
  /* ⚠️ **لا تكتب حالة الزرّ داخل `withLoading`.** الغلاف يحفظ `innerHTML` قبل
     السبينر ويُعيده في `finally` ⇒ أي نصّ نكتبه بالداخل يُمحى بعد ثوانٍ من
     كتابته، فيعود الزرّ يقول «نبّهني» وقد سُجّلت الرغبة فعلًا — فيضغط ثانيةً.
     مقيس. الحالة النهائية تُكتب **بعد** انتهاء الغلاف. */
  let ok=false, gone=false;
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'watchSlot', player_token:Session.player(),
      field_id:a.field.field_id, date:a.date, hour:a.slot.hour });
    if(!r || !r.success){
      toast(apiMsg(r&&r.message)||t('watchFail'),'error');
      gone = !!(r && r.missing);               // لن ينجح مرّة ثانية في هذه الجلسة
      return;
    }
    ok=true;
  });
  if(gone){ btn.hidden=true; return; }
  if(!ok) return;
  Track.push(EV.SLOT_WATCH, { field_id:String(a.field.field_id), hour:a.slot.hour });
  btn.disabled=true; clear(btn); btn.append(document.createTextNode(t('watchDone')));
  toast(t('watchOk'),'success');
}

function alternativePanel(){
  const alt = findAlternative();
  const box = h('div',{class:'alt-panel', style:{gridColumn:'1/-1'}});
  if(!alt){
    box.append(h('div',{class:'alt-none'}, t('altNone')));
    return box;
  }
  const time = slotDisplay(alt.slot);
  /* ⚠️ اسم الملعب والوقت يُعزلان بـ<bdi>، ولا يُلصقان في النصّ لصقًا.
     اسم الملعب من القاعدة وهو عربي دائمًا («ملعب 2»)، والجملة قد تكون
     إنجليزية ⇒ خوارزمية bidi تقلبه إلى «2 ملعب». والوقت مدى برقمين تفصلهما
     شرطة محايدة («10:00 - 12:00») ⇒ ينقلب في الجملة العربية فيصير الانتهاء
     قبل الابتداء. نفس العطل الذي قُلب مدى السعر في الموقع، ومقيس هناك.
     العزل بعلامة نائبة ثمّ تقسيم: النصّ يبقى في ملفّ اللغة كجملة واحدة. */
  const SEP='\u0001';   // sentinel: not present in any UI string, safe to split on
  const raw = alt.sameDay
    ? t('altOtherField',{ field:SEP, time:SEP })
    : t('altSameField',{ field:SEP, day:dayLabel(alt.date), time:SEP });
  const chunks = raw.split(SEP);
  const line = h('span',{},
    chunks[0]||'', h('bdi',{}, alt.field.field_name),
    chunks[1]||'', h('bdi',{dir:'ltr'}, time),
    chunks[2]||'');
  const go = h('button',{class:'alt-go', type:'button'}, t('altGo'));
  go.addEventListener('click', async()=>{
    State.detail.field = alt.field; State.detail.date = alt.date; State.detail.hour = alt.slot.hour;
    renderSubFields(); renderDetailHero(); setText('dPrice', formatCurrency(alt.field.price));
    renderDetailDays(); renderDetailTimes(); renderPlaceStats(); renderDetailSticky();
    scrollToDetailSection('time','#detailTimes .tbtn.sel');
  });
  box.append(
    h('div',{class:'alt-head'}, h('span',{class:'alt-dot','aria-hidden':'true'}), h('span',{}, t('altTitle'))),
    h('div',{class:'alt-line'}, line),
    go);
  return box;
}

/* ===================== RENDER: ECONOMIC (place / player) ===================== */
const bookingsForPlace = (id) => (State.publicBookings||[]).filter(b=>String(b.place_id)===String(id));
const placeWeeklySlots = (p) => (p?.fields||[]).reduce((s,f)=>s+fieldSlots(f).length,0)*7;
function placeTakenThisWeek(p){ const ids=new Set((p?.fields||[]).map(f=>String(f.field_id))); const days=new Set(Array.from({length:7},(_,i)=>dateAfter(i))); return (State.publicBookings||[]).filter(b=>ids.has(String(b.field_id))&&days.has(String(b.date).split('T')[0])&&!['cancelled','rejected'].includes(normStatus(b))).length; }
function econCard(title, badge, items, decision){
  const grid=h('div',{class:'econ-grid'});
  items.forEach(it=> grid.append(h('div',{class:'econ-item'}, h('div',{class:'econ-value'}, it.v), h('div',{class:'econ-label'}, it.l), it.h&&h('div',{class:'econ-hint'}, it.h))));
  return h('div',{class:'card', style:{borderColor:'rgba(216,181,82,.2)',marginBottom:'0'}},
    h('div',{class:'section-title'}, h('span',{}, title), badge&&h('span',{class:'mini-badge'}, badge)),
    grid, decision&&h('div',{class:'econ-decision'}, decision));
}
function renderPlaceStats(){
  const el=$('#placeStats'); if(!el) return; const p=State.detail.place; clear(el);
  const pb=bookingsForPlace(p.place_id); const total=placeWeeklySlots(p); const taken=placeTakenThisWeek(p);
  const availRate=calcPercent(Math.max(total-taken,0), total);
  const confirmed=pb.filter(b=>normStatus(b)==='confirmed').length;
  const confirmRate=calcPercent(confirmed, pb.length);
  const quality = !pb.length ? 'بيانات قليلة' : (confirmRate>=80?'ممتاز':confirmRate>=60?'جيد':'بحاجة متابعة');
  const decision = (confirmRate&&confirmRate<80) ? 'تنبيه: معدل التأكيد أقل من 80%.' : 'المؤشرات تساعدك تعرف إذا الملعب مناسب قبل الحجز.';
  el.append(econCard('📊 مؤشرات قبل الحجز','هذا الأسبوع',[
    {v:availRate+'%',l:'الأوقات المتاحة',h:'كلما قلّت يعني الطلب عالي'},
    {v:confirmRate+'%',l:'معدل التأكيد',h:'أقل من 80% يحتاج انتباه'},
    {v:pb.length,l:'طلبات سابقة',h:'مؤشر نشاط الملعب'},
    {v:quality,l:'نشاط المالك',h:'حسب معدل التأكيد'},
  ], decision));
}
function renderPlayerStats(list){
  const el=$('#playerStats'); if(!el) return; list=list||[]; clear(el);
  const confirmed=list.filter(b=>normStatus(b)==='confirmed');
  const rejected=list.filter(b=>['rejected','cancelled'].includes(normStatus(b)));
  const spent=confirmed.reduce((s,b)=>s+(Number(b.price)||0),0);
  if(!list.length) return;
  el.append(econCard('💸 ملخصك كلاعب', null, [
    {v:confirmed.length,l:'مرات لعبت'},
    {v:formatMoney(spent),l:'إجمالي الصرف'},
    {v:calcPercent(confirmed.length,list.length)+'%',l:'نسبة التأكيد'},
    {v:calcPercent(rejected.length,list.length)+'%',l:'رفض / إلغاء'},
  ], null));
  $('.card', el).style.marginBottom='15px';
}

/* ===================== BOOKING REVIEW (نافذة مراجعة فقط · مصدر حالة واحد = State.detail) =====================
   لا يوجد اختيار يوم/وقت/ملعب داخل النافذة — كله يتم في صفحة التفاصيل (State.detail).
   State.booking مجرّد لقطة من State.detail وقت الفتح حتى لا يختلفا أبداً. */
function detailSelectionComplete(){
  const d=State.detail; return !!(d.place && d.field && d.date && d.hour!=null);
}
function scrollToDetailSection(which, focus){
  if(!$('#page-detail')?.classList.contains('active')) showPage('detail');
  const sel = which==='field' ? '.detail-section[aria-label="اختيار الملعب"]' : '.detail-section[aria-label="اختيار الموعد"]';
  const sec=$(sel);
  requestAnimationFrame(()=>{ if(sec) sec.scrollIntoView({behavior:'smooth', block:'start'}); if(focus){ const f=$(focus); if(f){ try{ f.focus(); }catch(_){} } } });
}
function updateBookingStep(){   // النافذة دائماً عند خطوة المراجعة: 1 و2 مكتملتان، 3 نشطة
  $$('#bkSteps .bk-step').forEach(s=>{ const n=Number(s.dataset.step); s.classList.toggle('done', n<3); s.classList.toggle('active', n===3); s.setAttribute('aria-current', n===3?'step':'false'); });
}
function openBookingReview(preferOpen){
  const { place, field, date, hour } = State.detail;
  // تحقّق قبل فتح المراجعة (رسالة + تمرير + Focus لأول عنصر ناقص)
  if(!place || !field){ toast(t('chooseFirst'),'warn'); scrollToDetailSection('field','#subFields .subfield-card'); return; }
  if(!date){ toast(t('chooseDayMsg'),'warn'); scrollToDetailSection('time','#detailDays .day-btn'); return; }
  if(hour==null){ toast(t('chooseTimeMsg'),'warn'); scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)'); return; }
  // ضيف؟ احفظ الاختيار وافتح خيار الدخول (تظهر المراجعة بعد الدخول)
  if(!Session.player()){ savePendingBooking(); openAuthChoice(); return; }
  State.booking = { place, field, date, hour };   // لقطة متطابقة مع التفاصيل
  Track.push(EV.BOOKING_STARTED, { place_id:String(place.place_id), hour:Number(hour) });
  /* اختيار نوع المباراة يُصفَّر عند كل فتح: «مفتوحة» قرارٌ يُتَّخذ لهذه المباراة
     لا تفضيلٌ يُحفَظ — من فتح مفتوحةً مرّةً لا يعني أنه ينشر مقاعد كلّ حجز بعدها. */
  const pick=$('#matchPick');
  if(pick){
    pick.hidden = (GAMES_OK !== true);
    /* وإن كنّا لا نعرف بعد (`null`) فاسأل الآن وأظهره إن وُجد. الاتجاه
       **مخفيّ ⇒ ظاهر** وحده: خيارٌ يظهر بعد جزء من الثانية إضافةٌ، أمّا العكس
       فبابٌ يُعرَض ثمّ يُسحَب — وهو الممنوع. ولا يُنتظَر هنا: النافذة تُفتح
       فورًا، والسؤال رخيص (`limit=0`) ويقع مرّةً واحدة في الجلسة. */
    if(GAMES_OK === null && Session.player()){
      updateModeSeg().then(()=>{ if(GAMES_OK === true) pick.hidden = false; }).catch(()=>{});
    }
    const sug = suggestedPlayers(field);
    $('#gmNeeded').value = sug || '';
    $('#gmBrought').value = '1';
    // إسناد الخاصّية لا addEventListener: العنصران ثابتان في HTML
    $('#gmNeeded').oninput = renderGmLive;
    $('#gmBrought').oninput = renderGmLive;
    /* «مفتوحة» تُختار سلفًا لمن دخل من بطاقة «ناقصك لاعبين؟» وحده — وبشرط أن
       يكون الترحيل ثابتًا **الآن** لا أن يكون كان ثابتًا حين ظهر الزرّ. */
    setVisPick((preferOpen && GAMES_OK === true) ? 'open' : 'private');
  }
  renderReview();
  Modal.open('modal-booking');
}
function renderReview(){
  const { place, field, date, hour } = State.detail;
  const el=$('#bkReview'); if(!el) return; clear(el);
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  const logged = !!Session.player();
  /* إيصال مراجعة حديث: رأس المكان ← شبكة التفاصيل ← بيانات اللاعب ← الإجمالي البارز ← حالة الإرسال */
  const cell=(lbl,val,icon)=> h('div',{class:'rc-cell'},
    h('span',{class:'rc-lbl'}, ico(icon,'svg-sm'), ' '+lbl),
    h('span',{class:'rc-val'}, val));
  /* ⚠️ **إحدى عشرة خليّة صارت أربع حقائق ظاهرة.** الإيصال كان يعرض الاسم والهاتف
     و«الحالة» و«حجم الملعب» بنفس وزن الموعد والسعر — وثلاثتها الأولى بياناتُ
     الحساب نفسه، أي ما **لا** يُراجَع قبل الإرسال (وإن كانت خاطئة فمكان تصحيحها
     «حسابي» لا هذه النافذة). فبقي المعروض: الموعد · المدّة · الملعب · الإجمالي،
     وما عداه خلف طيّة **بنفس مكوّن `.disclosure`** المستعمل في صفحة الملعب —
     نمطٌ واحد لنفس المعنى، لا `<details>` بشكل ثانٍ.
     ⚠️ ولا يُحذَف شيء (م5): من يريد التحقّق من رقمه قبل الإرسال يفتح الطيّة. */
  const info = h('details',{class:'disclosure rc-info'},
    h('summary',{},
      h('span',{}, t('rvYourInfo'))),
    h('div',{class:'rc-grid'},
      cell(t('rvName'), State.player?.name||'-', 'person'),
      cell(t('rvPhone'), State.player?.phone||'-', 'phone'),
      cell(t('rvStatus'), logged?t('statusPlayer'):t('statusGuest'), 'person'),
      cell(t('rvSize'), field.size||'—', 'resize')));
  el.append(
    h('div',{class:'rc-head'},
      h('div',{class:'rc-place'}, place.place_name),
      h('div',{class:'rc-loc'}, ico('pin','svg-sm'), ' '+placeLocation(place))),
    h('div',{class:'rc-grid'},
      cell(t('rvWhen'), dayLabel(date)+' '+shortDate(date)+' · '+(slot?slotDisplay(slot):''), 'cal'),
      cell(t('rvDuration'), t('twoHours'), 'clock'),
      cell(t('rvField'), fieldGender(field)
             ? h('span',{}, field.field_name, h('span',{class:'gd-badge gd-'+fieldGender(field)}, genderLabel(fieldGender(field))))
             : field.field_name, 'pin')),
    h('div',{class:'rc-total'},
      h('span',{class:'rc-total-lbl'}, t('rvTotal')),
      h('span',{class:'rc-total-val'}, formatCurrency(slotPrice(field, date, hour)))),
    info
  );
  /* سعرٌ يختلف عن سعر الملعب يُقال **سببُه** هنا كذلك، لا على الزرّ وحده:
     من فتح المراجعة مباشرةً (استئناف حجز ضيف) لم يمرّ على الزرّ أصلًا. */
  if(slotPriceDiffers(field, date, hour)){
    el.append(h('div',{class:'rc-note'},
      t('priceRuleNote',{ base: formatCurrency(field.price) })));
  }
  /* سرعة الردّ **فوق زرّ التأكيد** لا داخل الإيصال: هذه اللحظة بالضبط هي
     التي يسأل فيها من يهمّ بالضغط عمّا ينتظره — والحجز طلبٌ لا حجزًا فوريًّا. */
  const rsWrap=$('#bkReplySpeed');
  if(rsWrap){ clear(rsWrap); const rs=replySpeedLine(place,'rc-reply'); if(rs) rsWrap.append(rs); }
  updateBookingStep();
}

/* ===================== SUCCESS SCREEN (عام + حجز) ===================== */
/* يعيد شاشة النجاح لوضعها البسيط (تُستخدم للحساب/التقييم) */
function resetSuccessCard(){
  $('#success')?.classList.remove('success-full');           // ارجع للبطاقة المركزية البسيطة
  const eb=$('#successEyebrow'); if(eb){ eb.hidden=true; eb.textContent=''; }
  const icon=$('#successIcon'); if(icon){ icon.classList.remove('is-check'); icon.textContent='🎉'; }
  const sum=$('#successSummary'); if(sum){ sum.hidden=true; clear(sum); }
  const act=$('#successActions'); if(act){ clear(act); act.append(h('button',{class:'sbtn','data-action':'closeSuccess'}, t('successOkBtn'))); }
}
function showSimpleSuccess(text){
  resetSuccessCard();
  setText('successTitle', t('successDone')); setText('successText', text);
  Modal.open('success');
}
/* توليد ملف تقويم .ics لحدث الحجز (ساعتان، توقيت محلي) — تنزيل عبر Blob بلا أي HTML */
function icsStamp(d){ return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`; }
function downloadBookingIcs({ place, field, date, hour }){
  try{
    const st=new Date(`${date}T${String(hour).padStart(2,'0')}:00:00`); if(Number.isNaN(st.getTime())) return;
    const en=new Date(st); en.setHours(en.getHours()+2);
    const esc=(s)=>String(s||'').replace(/[\\;,]/g, m=>'\\'+m).replace(/\r?\n/g,'\\n');
    const ics=[
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mustadaira//Booking//AR','BEGIN:VEVENT',
      `UID:${Date.now()}-${String(field.field_id||'')}@mustadaira`,
      `DTSTAMP:${icsStamp(new Date())}`,`DTSTART:${icsStamp(st)}`,`DTEND:${icsStamp(en)}`,
      `SUMMARY:${esc(`${place.place_name} - ${field.field_name}`)}`,
      `LOCATION:${esc(placeLocation(place))}`,
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='mustadaira-booking.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }catch(_){}
}
/* شاشة نجاح الحجز: علامة متحركة + ملخّص + حالة + رقم الحجز + إجراءات */
function showBookingSuccess(info, bookingId){
  const { place, field, date, hour } = info;
  /* 🔴 السعر **لا يُقرأ من `field.price` هنا**: ذاك سعر الدليل («من كم يبدأ»)،
     والإيصال يقول ما كُتب على هذا الحجز بالذات. الأولوية: ما ردّه الخادم
     (‏`t_booking_price` في ترحيل 18 هو الحكم) ⇒ ثمّ `slotPrice` المحسوب محلّيًّا.
     ⚠️ والعطل كان **كامنًا** لأن 18 غير مُشغَّل فالقيمتان متطابقتان اليوم؛ وأوّل
     قاعدة تسعير بالساعة تجعل الإيصال يقول رقمًا لم يُحجَز به — ويبدو عطلَ خادم.
     ⚠️ والحارس صريح قبل التحويل: `Number(null)` صفرٌ صالح، و`Number.isFinite(0)`
     صحيحة ⇒ غيابُ القيمة كان سيخرج «0 د.أ» واثقًا (نفس درس `replySpeedText`). */
  const raw = info.price;
  const price = (raw == null || raw === '' || !Number.isFinite(Number(raw)))
    ? slotPrice(field, date, hour) : Number(raw);
  resetSuccessCard();                                       // بطاقة مركزية صغيرة (لا شاشة كاملة)
  // reflow يفصل إزالة is-check (في resetSuccessCard) عن إعادتها ⇒ أنيميشن النجاح يعيد التشغيل لكل حجز
  const icon=$('#successIcon'); if(icon){ void icon.offsetWidth; icon.classList.add('is-check'); icon.innerHTML=ICON.check; }
  setText('successTitle', t('bookingSuccessTitle'));
  setText('successText', `${place.place_name} · ${field.field_name}`);
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  // بطاقة الإيصال: حالة «بانتظار التأكيد» ← شبكة (يوم/وقت/مدة/سعر) ← رقم الحجز monospace
  const sum=$('#successSummary'); sum.hidden=false; clear(sum);
  const cell=(lbl,val,icn)=> h('div',{class:'ss-cell'}, h('div',{class:'ss-cell-lbl'}, ico(icn,'svg-sm'), ' '+lbl), h('div',{class:'ss-cell-val'}, val));
  sum.append(h('div',{class:'ss-status'}, ico('clock','svg-sm'), h('span',{}, t('statusPendingVenue'))));
  sum.append(h('div',{class:'ss-grid'},
    cell(t('rvDay'), `${dayLabel(date)} ${shortDate(date)}`, 'cal'),
    cell(t('rvTime'), slot?slotDisplay(slot):'', 'clock'),
    cell(t('rvDuration'), t('twoHours'), 'clock'),
    cell(t('rvPrice'), formatCurrency(price), 'money')));
  /* 🔴 المباراة المفتوحة: الإيصال كان **صامتًا** عنها تمامًا — نفس الشاشة لمن اختار
     «خاصّة» ولمن نشر ثمانية مقاعد، فيخرج المضيف ظانًّا أن مقاعده معروضة الآن.
     والحقيقة قيدٌ في العرض نفسه (‏`22_open_games.sql`): **لا مقعد قبل تأكيد الملعب**.
     ولا نصّ جديد هنا: نفس شارة بطاقة «حجوزاتي» ونفس جملتها ونفس الصنف — معنًى واحد
     لا يُصاغ مرّتين. والحالة عند الإيصال `pending` دائمًا (الطلب أُرسل للتوّ). */
  if(info.visibility === 'open'){
    const seats = Math.max(0, Number(info.needed||0) - Number(info.brought||0));
    sum.append(h('div',{class:'bk-open'},
      h('span',{class:'bk-open-badge'}, t('gmBadgeWaiting')),
      h('span',{class:'bk-open-txt'},
        t('gmLiveSeats',{ n:seats, noun:nSeats(seats) })+' '+t('gmCardWaiting'))));
  }
  /* ⚠️ **«رقم الحجز» حُذف** (بلاغ المالك 2026-08-13: «غريب للمستخدم وشو بستفيد
     منه»). والمعرّفات صارت `uuid` يوم انتقلت القاعدة إلى Postgres ⇒ ما كان
     يُطبَع سطرٌ من ستّةٍ وثلاثين محرفًا لا يحفظه أحد ولا يُطلَب في أي مسار:
     الملعب يعرف صاحبه بالاسم والهاتف والموعد، و`/admin` تبحث بالهاتف لا بالمعرّف.
     رقمٌ لا يُستعمَل في أي محادثة ليس مرجعًا، إنّما ضجيجٌ في إيصال. */
  const act=$('#successActions'); clear(act);
  const goB=h('button',{class:'sbtn'}, t('navBookings')); goB.addEventListener('click',()=>{ Modal.close('success'); showPage('bookings'); });
  const goC=h('button',{class:'cbtn'}, ico('cal','svg-sm'), ' '+t('addToCalendar')); goC.addEventListener('click',()=>downloadBookingIcs(info));
  const goH=h('button',{class:'cbtn'}, t('navHome')); goH.addEventListener('click',()=>{ Modal.close('success'); showPage('home'); renderPlaces(); });
  act.append(goB, goC, goH);
  Modal.open('success');
}

/* ===================== RENDER: PLAYER BOOKINGS ===================== */
function playerBookingCard(b){
  const rt = runtimeStatus(b); const lbl = statusLabel(rt);
  const status = normStatus(b);
  /* الشرطان مفصولان عمدًا (انظر `cancellableByStatus`): حجزٌ **يصلح** للإلغاء
     لكنّ وقته قرب ليس كحجزٍ انتهى أمره — الأوّل يستحقّ سببًا ومخرَجًا، والثاني
     لا يستحقّ شيئًا. دمجُهما في `canCancel` واحدة كان يُخفي الزرَّ في الحالتين
     بلا كلمة، فيبقى اللاعب يبحث عن زرٍّ حُذف تحت عينيه. */
  const eligible = cancellableByStatus(b);
  const canCancel = eligible && withinCancelWindow(b);
  const card = h('div',{class:'card booking-strip '+status, style:{marginBottom:'14px'}},
    h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px',marginBottom:'8px'}},
      h('div',{style:{fontSize:'14px',fontWeight:'800',color:'var(--ink)'}}, b.place_name+' - '+b.field_name),
      h('span',{class:'badge '+lbl.c}, lbl.t)),
    h('div',{style:{display:'flex',flexDirection:'column',gap:'5px'}},
      h('div',{class:'info-line muted'}, ico('pin','svg-sm'), ' '+b.city),
      h('div',{style:{display:'flex',gap:'14px',flexWrap:'wrap'}},
        h('span',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+b.date),
        h('span',{class:'info-line muted'}, ico('clock','svg-sm'), ' '+b.time)),
      h('div',{style:{display:'flex',gap:'14px',flexWrap:'wrap'}},
        h('span',{class:'info-line muted'}, ico('resize','svg-sm'), ' '+(b.players||'')),
        h('span',{class:'info-line muted'}, ico('money','svg-sm'), ' '+formatCurrency(b.price))))
  );
  /* «انقضت المهلة» تُكتب هنا لا تُخزَّن: الصفّ يحمل `cancel_kind` والجملة
     تُبنى بلغة المستخدم الحالية — نفس مبدأ الإشعارات (ترحيل 14). ولا نُلبس
     الملعبَ رفضًا لم يقله. */
  if (isExpiredBooking(b)) card.append(h('div',{class:'reason-box'}, t('expiredReason')));
  else if (b.cancel_reason) card.append(h('div',{class:'reason-box'}, t('reasonPrefix')+b.cancel_reason));
  /* مباراة مفتوحة: شارةٌ على البطاقة وزرُّ إدارة. والحالة تُقال بدقّة —
     **المعلّقة لم تُنشَر بعد** (قيد ①: لا مقعد قبل التأكيد)، والمؤكّدة منشورة. */
  if (b.visibility === 'open'){
    const live = normStatus(b)==='confirmed';
    const box = h('div',{class:'bk-open'},
      h('span',{class:'bk-open-badge'+(live?' live':'')}, t(live?'gmBadgeLive':'gmBadgeWaiting')),
      h('span',{class:'bk-open-txt'}, live
        ? t('gmCardLive',{ n: Number(b.needed||0)-Number(b.brought||0) })
        : t('gmCardWaiting')));
    if(live && !isFinished(b)){
      const mg=h('button',{class:'cbtn bk-act'}, t('gmManage'));
      mg.addEventListener('click', ()=>openMatchManage(b));
      box.append(mg);
    }
    card.append(box);
  }
  if (canCancel){
    const label = b.place_name+' - '+b.field_name;
    const row = h('div',{class:'bk-actions'});
    // «تعديل» للمعلّق وحده: المؤكّد اتّفق عليه الطرفان ⇒ تغييره من طرف واحد يكسر الاتفاق،
    // وسياسة القاعدة نفسها لا تسمح به (الدالّة ترفض أي حالة غير pending).
    if (status==='pending'){
      const ed=h('button',{class:'cbtn bk-act'}, ico('edit','svg-sm'), ' '+t('rsBtn'));
      ed.addEventListener('click', ()=>openReschedule(b));
      row.append(ed);
    }
    const btn=h('button',{class:'cbtn bk-act danger-outline-btn'}, t('cancelBookingBtn'));
    btn.addEventListener('click', ()=>playerCancelBooking(btn, b, label));
    row.append(btn);
    card.append(row);
  } else if (eligible){
    card.append(cancelClosedPanel(b));
  }
  return card;
}
/* رقم الملعب — من `State.allPlaces` لا من الحجز: `bookings_full` تحمل هاتف
   **العميل** لا هاتف المكان. وإن لم نجده (مكان أُخفي مثلًا) قلنا ذلك ولم
   نعرض زرًّا لا يتّصل بشيء. */
/* ⚠️ ولا يُفحَص بـ`validPhone`: تلك تصف **رقم خلوي أردني** لأنها تحرس هويّة
   الحساب، ورقمُ الملعب قد يكون أرضيًّا (‏06…) أو موحَّدًا (‏0800…). فحصُه
   بقاعدة الخلوي كان سيُخفي زرَّ الاتصال عن كل ملعب يعطي رقمه الأرضي — وهو
   المخرج الوحيد المعروض بعد انغلاق مهلة الإلغاء. السؤال هنا «هل يُطلَب؟»
   لا «هل هو حساب؟»، والجواب: أرقامٌ تكفي لمكالمة. */
function venuePhone(b){
  const p = (State.allPlaces||[]).find(x => String(x.place_id)===String(b.place_id));
  const raw = String((p && p.phone) || '').trim();
  return digits(raw).length >= 7 ? raw : '';
}
/* اللوح الصادق بعد إغلاق المهلة: لا زرَّ يَعِد بما سيرفضه الخادم، وبدلَه
   السببُ ومخرَجٌ حقيقي (اتّصال · واتساب). */
function cancelClosedPanel(b){
  const hrs = nHours(CONFIG.CANCEL_WINDOW_H);
  const tel = venuePhone(b);
  const box = h('div',{class:'reason-box bk-late'},
    h('div',{style:{fontWeight:'800',color:'var(--ink)',marginBottom:'4px'}}, t('cancelTooLateTitle')),
    h('div',{}, t(tel ? 'cancelTooLateSub' : 'cancelTooLateNoPhone', { h: hrs })));
  if (tel){
    const wa = normalizePhone(tel);
    box.append(h('div',{class:'bk-actions', style:{marginTop:'10px'}},
      h('a',{class:'cbtn bk-act', href:'tel:'+tel}, ico('phone','svg-sm'), ' '+t('callVenue')),
      h('a',{class:'cbtn bk-act', href:'https://wa.me/'+wa, target:'_blank', rel:'noopener'}, ico('wa','svg-sm'), ' '+t('waVenue'))));
  }
  return box;
}
async function loadPlayerBookings(){
  const list=$('#bookingsList'), stats=$('#playerStats');
  if (!Session.player()){ clear(stats); clear(list); list.append(emptyState({icon:'🔒',title:t('loginToSee'),sub:t('loginToSeeSub'),actionLabel:t('login'),action:()=>showPage('playerLogin')})); return; }
  clear(stats); clear(list); list.append(...[0,1].map(()=>h('div',{class:'skeleton-card'}, h('div',{class:'sk-body'}, h('div',{class:'sk sk-line w70'}), h('div',{class:'sk sk-line w45'})))));
  try{
    const res = await API.get('getPlayerBookings', { player_token: Session.player() }, 'playerBookings');
    if (!res.success){ clear(list); list.append(emptyState({icon:'⚠️',title:t('bkFetchFail'),sub:apiMsg(res.message)||t('tryAgain')})); return; }
    State.player = res.player || State.player;
    renderPlayerStats(res.bookings||[]);
    clear(list);
    if (!res.bookings || !res.bookings.length){ list.append(emptyState({icon:'📭',title:t('noBookingsYet'),sub:t('noBookingsYetSub'),actionLabel:t('browseFields'),action:()=>showPage('home')})); return; }
    // تصنيف لأربع مجموعات: قادمة / بانتظار التأكيد / سابقة / ملغاة-مرفوضة
    const cats = categorizeBookings(res.bookings);
    const recentFin = visibleBookings(cats.finished, 14, State.showAllPlayer);
    const recentCan = visibleBookings(cats.cancelled, 14, State.showAllPlayer);
    const hidden = (cats.finished.length-recentFin.length) + (cats.cancelled.length-recentCan.length);
    const group=(title, arr)=>{ if(!arr.length) return; list.append(sectionTitle(title, arr.length)); arr.forEach(b=>list.append(playerBookingCard(b))); };
    group(t('grpUpcoming'), cats.upcoming);
    /* مبارياتٌ انضمّ إليها — **قسمٌ منفصل بشكلٍ مختلف**: هو مشاركٌ لا صاحب
       حجز، فلا يُلغي ولا يعدّل ولا يرى هاتف أحد. ودمجُها مع حجوزاته كان
       سيجعله يظنّ أنه يستطيع إلغاءها. */
    await appendJoinedGames(list);
    group(t('grpPending'), cats.pending);
    group(t('grpPast'), recentFin);
    group(t('grpCancelled'), recentCan);
    if(!cats.upcoming.length && !cats.pending.length && !recentFin.length && !recentCan.length){
      list.append(h('div',{class:'card', style:{textAlign:'center',color:'var(--soft)'}}, t('noBookingsToShow')));
    }
    if (hidden>0 || State.showAllPlayer){
      const toggle=h('button',{class:'cbtn', style:{marginTop:'14px'}}, State.showAllPlayer?t('hideOld'):`${t('fullHistory')} (${hidden})`);
      toggle.addEventListener('click', ()=>{ State.showAllPlayer=!State.showAllPlayer; loadPlayerBookings(); });
      list.append(toggle);
    }
  }catch(e){ if(isAbort(e)) return; clear(list); list.append(emptyState({icon:'📡',title:t('connProblem'),sub:t('connProblemSub')})); }
}
/* مباريات انضمّ إليها اللاعب — تُقرأ من `open_games` بالتقاطع مع `booking_players`.
   ⚠️ ولا تُعرَض المنتهية: العرض نفسه يُسقط ما مضى موعده (شرط الزمن فيه)، فتبقى
      في تاريخه على الخادم ولا تزحم قائمته. */
async function appendJoinedGames(list){
  if(GAMES_OK !== true) return;
  let res;
  try{ res = await API.get('getOpenGames', {}, 'joinedGames'); }catch(_){ return; }
  if(!res || !res.success) return;
  const mine = new Set((res.joined||[]).map(String));
  const games = (res.games||[]).filter(g=>mine.has(String(g.id)));
  if(!games.length) return;
  list.append(sectionTitle(t('grpJoined'), games.length));
  games.forEach(g=>{
    const total=Number(g.players_needed||0), seats=Number(g.seats_left||0);
    const card=h('div',{class:'card booking-strip joined-strip', style:{marginBottom:'14px'}},
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px',marginBottom:'8px'}},
        h('div',{style:{fontSize:'14px',fontWeight:'800',color:'var(--ink)'}}, h('bdi',{}, g.place_name||''), ' - ', h('bdi',{}, g.field_name||'')),
        h('span',{class:'badge badge-blue'}, t('gmYouParticipant'))),
      h('div',{style:{display:'flex',flexDirection:'column',gap:'5px'}},
        h('div',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+dayLabel(g.booking_date)+' '+shortDate(String(g.booking_date).split('T')[0])),
        h('div',{class:'info-line muted'}, ico('clock','svg-sm'), ' ', h('bdi',{dir:'ltr'}, slotDisplay({hour:Number(g.hour),startHour:Number(g.hour),endHour:Number(g.hour)+2,label:g.time_label||''}))),
        h('div',{class:'info-line muted'}, ico('person','svg-sm'), ' '+t('gmHostIs',{ n:g.host_name||t('gmHostUnknown') })),
        h('div',{class:'info-line muted'}, ico('money','svg-sm'), ' ', h('bdi',{dir:'ltr'}, formatCurrency(gameShare(g.price, total))), ' ', h('small',{class:'gc-est'}, t('gmShareTag'))),
        h('div',{class:'info-line muted'}, ico('resize','svg-sm'), ' ', h('bdi',{dir:'ltr'}, `${total-seats}/${total}`))));
    // ينسحب، ولا يُلغي: الحجز ليس حجزه.
    const row=h('div',{class:'bk-actions'});
    const lv=h('button',{class:'cbtn bk-act danger-outline-btn'}, t('gmLeaveBtn'));
    lv.addEventListener('click', ()=>leaveGame(lv, g.id));
    row.append(lv); card.append(row);
    list.append(card);
  });
}

/* تصنيف حجوزات اللاعب لأربع مجموعات واضحة */
function categorizeBookings(list){
  const g={ upcoming:[], pending:[], finished:[], cancelled:[] };
  (list||[]).forEach(b=>{
    const s=normStatus(b);
    if(s==='cancelled'||s==='rejected'){ g.cancelled.push(b); return; }
    if(isFinished(b)){ g.finished.push(b); return; }
    if(s==='pending'){ g.pending.push(b); return; }
    g.upcoming.push(b);   // مؤكّد (وجاري اللعب)
  });
  return g;
}
function sectionTitle(title, count){ return h('div',{class:'sec-title', style:{padding:'8px 0 10px'}}, h('span',{}, title), h('span',{class:'mini-badge'}, String(count))); }

async function playerCancelBooking(btn, b, label){
  /* القاعدة في **جملة التأكيد نفسها** لا في حاشية تحتها: من ضغط «تأكيد» لم
     يعد أمامه قرار يستفيد من الحاشية. والمهلة تُذكَر مع كونه داخلها الآن —
     فيعرف أنه يُلغي بحقّه لا في منطقة رمادية. */
  const hint = t('cancelWindowHint',{ h: nHours(CONFIG.CANCEL_WINDOW_H) }) + ' ' + t('playerCancelHint',{label});
  const reason = await askReason(t('playerCancelTitle'), hint, t('confirmCancelBtn'));
  if (reason===null) return;
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'updateBookingStatus', player_token:Session.player(), row_number:b.row_number, status:'cancelled', cancel_reason: reason || t('playerCancelledDefault') });
      if (!res.success){
        toast(apiMsg(res.message)||t('cancelFail'),'error');
        /* رفضته القاعدة لأن المهلة أُغلقت بين الرسم والضغطة (بطاقة مفتوحة
           منذ ساعة، أو ساعةُ الجهاز مضبوطة للخلف). نعيد الرسم فورًا كي
           يحلّ اللوحُ الصادقُ محلّ زرٍّ لن يعمل. */
        if (res.code === 'cancel_window') await loadPlayerBookings();
        return;
      }
      toast(t('cancelOk'),'success');
      await loadPlayerBookings(); await loadData();
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ toast(t('cancelErr'),'error'); }
  });
}

/* ===================== تعديل موعد الحجز (اللاعب) =====================
   يعيد استعمال منطق الوقت نفسه الذي تستعمله صفحة التفاصيل والحجز الخارجي:
   fieldSlots للأوقات · State.bookedSlots للمحجوز · dayButton/timeButton للعرض.
   ⚠️ الحفظ يمرّ بدالّة في القاعدة لا بـPATCH مباشر: سياسة RLS تسمح للاعب أن
   يُلغي حجزه فقط (`with check … status = 'cancelled'`)، ولو وُسِّعت لتمرير
   pending لصار بوسعه تعديل **أي** عمود — السعر والملعب واسم صاحب الحجز.
   الدالّة تعدّل التاريخ والساعة وحدهما وتتحقّق من الملكية والحالة والتوفّر. */
function reschedFieldOf(b){
  const place=(State.places||[]).find(p=>String(p.place_id)===String(b.place_id));
  return place ? (place.fields||[]).find(f=>String(f.field_id)===String(b.field_id)) : null;
}
async function openReschedule(b){
  if(!Session.player()){ showPage('playerLogin'); return; }
  if(!State.places.length){ try{ await loadData(); }catch(_){} }
  // بلا كائن الملعب لا نعرف جدول أوقاته ⇒ نقولها صراحةً بدل عرض أوقات مخترَعة
  const field=reschedFieldOf(b);
  if(!field){ toast(t('rsNoField'),'warn'); return; }
  // اليوم المفتوح = يوم الحجز إن كان ضمن الأيام السبعة المعروضة، وإلّا اليوم.
  // (حجز معلّق بتاريخ أبعد من أسبوع أو تاريخ ماضٍ ⇒ لا يطابق أي زرّ يوم فيبقى بلا نشِط)
  const cur=String(b.date).split('T')[0];
  const inWindow=Array.from({length:7},(_,i)=>dateAfter(i)).includes(cur);
  State.reschedule={ booking:b, field, date: inWindow ? cur : today(), hour:null };
  setText('rsCurrent', `${b.place_name} - ${b.field_name} · ${dayLabel(b.date)} ${shortDate(String(b.date).split('T')[0])} · ${b.time}`);
  renderRescheduleDays(); renderRescheduleTimes();
  Modal.open('modal-reschedule');
  try{ await ensurePublicBookings(); }catch(_){}
  renderRescheduleTimes();
}
function renderRescheduleDays(){
  const el=$('#rsDays'); if(!el) return; clear(el);
  for(let i=0;i<7;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.reschedule.date, async()=>{
      State.reschedule.date=d; State.reschedule.hour=null;
      renderRescheduleDays(); timeSkeleton($('#rsTimes'),6);
      try{ await ensurePublicBookings(); }catch(_){}
      renderRescheduleDays(); renderRescheduleTimes();
    }, State.reschedule.field));
  }
}
function renderRescheduleTimes(){
  const el=$('#rsTimes'); const { booking:b, field, date }=State.reschedule; if(!el||!field) return; clear(el);
  const taken=(State.bookedSlots[field.field_id]?.[date])||[];
  const curDate=String(b.date).split('T')[0], curHour=Number(b.hour);
  const slots=fieldSlots(field);
  const free=slots.filter(s=>!taken.includes(s.hour)).length;
  const scarce=scarcityBanner(free); if(scarce) el.append(scarce);
  slots.forEach(s=>{
    // خانة الحجز نفسه تظهر «محجوزة» لأنها فعلاً في booked_slots — تسميتها «الحالي»
    // تقول الحقيقة: هي محجوزة لك أنت، والانتقال إليها بلا معنى (والقاعدة ترفضه).
    const isCur = (date===curDate && Number(s.hour)===curHour);
    el.append(timeButton(s, taken.includes(s.hour), State.reschedule.hour===s.hour,
      ()=>{ State.reschedule.hour=s.hour; renderRescheduleTimes(); },
      isCur ? { cls:'current', tag:t('rsCurrentTag') } : null));
  });
  if(slots.length && free===0) el.append(h('div',{class:'no-times', style:{gridColumn:'1/-1'}}, t('noTimesDay')));
}
async function saveReschedule(btn){
  const { booking:b, field, date, hour }=State.reschedule;
  if(!b||!field){ Modal.close('modal-reschedule'); return; }
  if(hour==null){ toast(t('rsPickTime'),'warn'); return; }
  const slot=fieldSlots(field).find(s=>Number(s.hour)===Number(hour));
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'playerRescheduleBooking', player_token:Session.player(),
        row_number:b.row_number, date, hour, time: slot ? slot.label : '' });
      if(!res.success){ toast(apiMsg(res.message)||t('rsFail'),'error');
        try{ await loadPublicBookings(); }catch(_){}
        renderRescheduleTimes();                       // الوقت راح لغيرك ⇒ أظهره محجوزاً فوراً
        return; }
      Modal.close('modal-reschedule', true);
      buzz(14); toast(t('rsOk'),'success');
      State.reschedule={ booking:null, field:null, date:null, hour:null };
      await loadPlayerBookings();
      try{ await loadPublicBookings(); }catch(_){}
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ toast(t('rsErr'),'error'); }
  });
}

