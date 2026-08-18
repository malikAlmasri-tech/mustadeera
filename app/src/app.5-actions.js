/* ===================== ACTIONS (controllers) ===================== */
async function updateBookingStatus(btn, rowNumber, status, opts){
  const booking=(State.ownerData?.bookings||[]).find(b=>Number(b.row_number)===Number(rowNumber));
  let reason='';
  /* ⚠️ **ورقةُ القرار هي التأكيد** (`opts.skipConfirm`): كانت البطاقة تعرض
     زرًّا ثمّ تسأل «متأكّد؟» في نافذة؛ والورقة الجديدة تعرض الحقائق نفسها ومعها
     الزرّان ⇒ سؤالٌ ثانٍ بعدها نافذةٌ تسأل عمّا في النافذة التي تحتها.
     والمسار الآخر (زرّ «أكّد» على حجزٍ ملغى أو مرفوض) يبقى بتأكيده كما كان:
     هناك لا توجد ورقةٌ تسبقه. */
  if (status==='confirmed' && !(opts && opts.skipConfirm)){
    const info = booking ? `${booking.name||''} — ${booking.field_name||''}\n${booking.date||''}  ${booking.time||''}` : '';
    const ok = await askConfirm(t('confirmBookingTitle'), t('confirmBookingMsg')+'\n\n'+info, t('actConfirm'));
    if(!ok) return;
  }
  if (status==='cancelled'||status==='rejected'){
    const r=await askReason(status==='cancelled'?t('cancelReasonTitle'):t('rejectReasonTitle'), t('reasonHint'), t('confirmWord'), true);
    if (r===null) return; reason=r;
  }
  // فتح تبويب واتساب الآن (ضمن إيماءة المستخدم ⇒ لا يحظره المتصفح) وتوجيهه بعد نجاح التحديث
  const waWin = (booking && normalizePhone(booking.phone)) ? window.open('about:blank','_blank') : null;
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'updateBookingStatus', owner_token:Session.owner(), row_number:rowNumber, status, cancel_reason:reason });
      if (!res.success){ try{ waWin&&waWin.close(); }catch(_){} toast(apiMsg(res.message)||t('updateFail'),'error'); return; }
      if (booking) sendWhatsApp(booking, status, reason, waWin);
      await loadOwnerDashboard(); await loadData();
      if ($('#page-home').classList.contains('active')) renderPlaces();
    }catch(_){ try{ waWin&&waWin.close(); }catch(_){} toast(t('updateErr'),'error'); }
  });
}
function sendWhatsApp(b, status, reason='', win=null){
  const phone=normalizePhone(b.phone);
  if(!phone){ try{ win&&win.close(); }catch(_){} return; }
  const base={ name:b.name||'', place:b.place_name, field:b.field_name, date:b.date, time:b.time, size:b.players, price:formatCurrency(b.price) };
  let msg='';
  if(status==='confirmed') msg = t('waConfirmed', base);
  else if(status==='rejected') msg = t('waRejected', {...base, reason: reason || t('waRejectedDefault')});
  else if(status==='cancelled') msg = t('waCancelled', {...base, reason: reason || t('waCancelledDefault')});
  if(!msg){ try{ win&&win.close(); }catch(_){} return; }
  const url=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  // التبويب المفتوح مسبقاً ضمن الإيماءة أضمن؛ وإلا المحاولة القديمة (تعمل ضمن مهلة سماح المتصفح)
  if(win && !win.closed){ try{ win.location.href=url; return; }catch(_){} }
  setTimeout(()=>window.open(url,'_blank'),500);
}

/* ---- Reason modal as a Promise ---- */
function askReason(title, hint, confirmLabel, required=false){
  return new Promise(resolve=>{
    const input=$('#reasonInput'), ok=$('#reasonConfirm'), no=$('#reasonCancel');
    setText('reasonTitle',title); setText('reasonHint',hint); input.value=''; ok.textContent=confirmLabel||t('confirmWord'); clearFieldError('reasonInput');
    Modal.open('modal-reason'); setTimeout(()=>input.focus(),200);
    const done=(val)=>{ Modal.close('modal-reason'); ok.onclick=null; no.onclick=null; clearFieldError('reasonInput'); resolve(val); };
    ok.onclick=()=>{ const v=input.value.trim(); if(required && !v){ setFieldError('reasonInput',t('reasonRequired')); input.focus(); return; } done(v); };
    no.onclick=()=>done(null);
  });
}
/* تأكيد إجراء (Promise<boolean>).
   `cancelLabel` أُضيف لأن زرّ الرجوع كان نصًّا عربيًّا ثابتًا في HTML بلا `data-i18n`
   ⇒ يبقى «رجوع» في الواجهة الإنجليزية. و`danger` يصبغ زرّ التأكيد أحمر للإجراءات
   التي لا رجعة فيها (حذف الحساب · تجاهل التعديلات). */
function askConfirm(title, message, confirmLabel, cancelLabel, danger){
  return new Promise(resolve=>{
    setText('confirmTitle',title); setText('confirmMessage',message);
    const ok=$('#confirmOk'), no=$('#confirmCancel');
    ok.textContent=confirmLabel||t('confirmWord');
    no.textContent=cancelLabel||t('backWord');
    ok.classList.toggle('danger-solid-btn', !!danger);
    Modal.open('modal-confirm');
    const done=(v)=>{ Modal.close('modal-confirm', true); ok.onclick=null; no.onclick=null; resolve(v); };
    ok.onclick=()=>done(true); no.onclick=()=>done(false);
  });
}

/* ---- Manual booking ---- */
function manualField(){ return (State.ownerData?.fields||[]).find(f=>String(f.field_id)===String(State.manual.fieldId)); }
async function openManual(){
  if (!Session.owner()){ showPage('ownerLogin'); return; }
  if (!State.ownerData) await loadOwnerDashboard();
  const fields=State.ownerData?.fields||[]; if(!fields.length){ toast(t('noFieldsAdded'),'warn'); return; }
  try{ await loadPublicBookings(); }catch(_){}
  State.manual={ fieldId:String(fields[0].field_id), date:today(), hour:null };
  $('#mName').value=''; $('#mPhone').value=''; $('#mPrice').value=fields[0].price||'';
  // خيار التكرار الأسبوعي (تعبئة بترجمة حيّة)
  const rep=$('#mRepeat'); if(rep){ clear(rep); rep.append(h('option',{value:'1'}, t('repeatNone'))); [2,3,4,5,6,8].forEach(n=> rep.append(h('option',{value:String(n)}, t('repeatFor',{n})))); rep.value='1'; }
  const sel=$('#mField'); clear(sel); fields.forEach(f=> sel.append(h('option',{value:f.field_id}, `${f.field_name} — ${f.size} — ${formatCurrency(f.price)}`))); sel.value=State.manual.fieldId;
  sel.onchange=()=>{ State.manual.fieldId=sel.value; State.manual.hour=null; const f=manualField(); if(f)$('#mPrice').value=f.price||''; renderManualTimes(); };
  renderManualDays(); renderManualTimes(); Modal.open('modal-manual');
}
function renderManualDays(){
  const el=$('#mDays'); clear(el);
  for(let i=0;i<14;i++){ const d=dateAfter(i);
    el.append(dayButton(d, i, d===State.manual.date, async()=>{ State.manual.date=d; State.manual.hour=null; renderManualDays(); timeSkeleton($('#mTimes'),6); try{await ensurePublicBookings();}catch(_){} renderManualDays(); renderManualTimes(); }));
  }
}
function renderManualTimes(){
  const el=$('#mTimes'); const f=manualField(); if(!f||!el) return; clear(el);
  const taken=(State.bookedSlots[f.field_id]?.[State.manual.date])||[];
  fieldSlots(f).forEach(s=> el.append(timeButton(s, taken.includes(s.hour), State.manual.hour===s.hour, ()=>{ State.manual.hour=s.hour; renderManualTimes(); })));
}

/* ---- Fields modal ---- */
function openEditField(fieldId){
  State.editingField='edit';
  const f=(State.ownerData.fields||[]).find(x=>String(x.field_id)===String(fieldId)); if(!f)return;
  setText('fieldTitle',t('editFieldTitle'));
  $('#fieldId').value=f.field_id; $('#fieldName').value=f.field_name; $('#fieldName').disabled=true;
  $('#fieldSize').value=f.size; $('#fieldSize').disabled=true; $('#fieldPrice').value=f.price;
  $('#fieldSlots').value=slotsToKeyword(f.slots); $('#fieldActive').checked=f.active!==false;
  Modal.open('modal-field');
}
function openAddField(){
  State.editingField='add';
  setText('fieldTitle',t('addFieldTitle'));
  $('#fieldId').value=''; $('#fieldName').value=''; $('#fieldName').disabled=false;
  $('#fieldSize').value='6×6'; $('#fieldSize').disabled=false; $('#fieldPrice').value='40';
  $('#fieldSlots').value='full'; $('#fieldActive').checked=true;
  Modal.open('modal-field');
}

/* ═══ (٢.١) إغلاق يوم ═══════════════════════════════════════════════════ */
/* ساعات القائمتين من **خانات ملاعب هذا المالك** لا من 0..23: نطاقٌ خارج
   ساعات عمله يُقبَل في القاعدة ولا يعني شيئًا في التطبيق. */
function ownerHourOptions(){
  const set=new Set();
  (State.ownerData?.fields||[]).forEach(f=> fieldSlots(f).forEach(s=> set.add(Number(s.hour))));
  const hrs=[...set].sort((a,b)=>a-b);
  return hrs.length ? hrs : DEFAULT_SLOTS.map(s=>s.hour);
}
function fillHourSelect(sel, hours, extraEnd){
  if(!sel) return; clear(sel);
  hours.forEach(hr=> sel.append(h('option',{value:String(hr)}, fmtHour12(hr))));
  // نهاية النطاق تحتاج ساعةً بعد آخر بداية، وإلّا استحال إغلاق آخر خانة
  if(extraEnd){ const last=hours[hours.length-1]+2; sel.append(h('option',{value:String(last)}, fmtHour12(last))); }
}
function openClosure(ds){
  const fields=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
  if(!fields.length) return;
  State.closureDate=ds;
  setText('clWhen', `${arabicDay(ds)} ${shortDate(ds)}`);
  const sel=$('#clField'); clear(sel);
  fields.forEach(f=> sel.append(h('option',{value:String(f.field_id)}, f.field_name)));
  const hrs=ownerHourOptions();
  fillHourSelect($('#clFrom'), hrs, false);
  fillHourSelect($('#clTo'), hrs, true);
  $('#clTo').value = String(hrs[hrs.length-1]+2);
  $('#clScope').value='day'; $('#clHours').hidden=true; $('#clReason').value='';
  const res=$('#clResult'); res.hidden=true; clear(res);
  // إسناد الخاصّية لا addEventListener: العنصر ثابت في HTML ولا يُعاد إنشاؤه،
  // فالإضافة تكدّس مستمعاً في كل فتح.
  $('#clScope').onchange = () => { $('#clHours').hidden = $('#clScope').value!=='hours'; };
  Modal.open('modal-closure');
}
async function saveClosure(btn){
  const ds=State.closureDate; if(!ds) return;
  const fid=$('#clField').value;
  const scope=$('#clScope').value;
  let from=null, to=null;
  if(scope==='hours'){
    from=Number($('#clFrom').value); to=Number($('#clTo').value);
    if(Number.isNaN(from)||Number.isNaN(to)||to<=from){ toast(t('closeNeedHours'),'warn'); return; }
  }
  const res=$('#clResult'); res.hidden=true; clear(res);
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'ownerCloseField', owner_token:Session.owner(),
      field_id:fid, date:ds, from, to, reason:$('#clReason').value.trim() });
    if(r && r.success){
      Modal.close('modal-closure', true);
      toast(t('closeOk') + (r.pending ? ' — '+t('closePendingWarn') : ''), 'success');
      await refreshClosures(); renderOwnerCalendar();
      /* الإغلاق يغيّر **الطاقة**، فيغيّر كلّ ما يُقسَم عليها: كفاءة الخانة
         وطاقةُ الذروة الفارغة. و`renderOwnerEcon` سقطت وحلّ محلّها لوحان
         لكلٍّ منهما عتبتُه، فيُعاد رسمهما معًا لا واحدًا منهما. */
      { const bk=State.ownerData?.bookings||[]; const sc=reportScoped(bk);
        safeRender('leak', ()=>renderOwnerLeak(sc));
        safeRender('capacity', ()=>renderOwnerCapacityCard(bk, sc)); }
      safeRender('today', renderOwnerToday);
      return;
    }
    /* التعارض يُعرَض **داخل النافذة** بالأسماء والأوقات، لا كتوست يختفي:
       هذه قائمةُ من سيتأذّى، والمالك يحتاجها أمامه ليتصرّف. */
    if(r && r.reason==='conflict'){
      res.hidden=false;
      res.append(h('div',{class:'cl-conf-ttl'}, t('closeConflictTitle')),
                 h('div',{class:'cl-conf-sub'}, t('closeConflictSub')));
      const ul=h('div',{class:'cl-conf-list'});
      (r.bookings||[]).forEach(b=> ul.append(h('div',{class:'cl-conf-row'},
        h('bdi',{}, String(b.name||'-')), h('bdi',{dir:'ltr'}, String(b.time||fmtHour12(b.hour))))));
      res.append(ul);
      return;
    }
    toast(apiMsg(r&&r.message)||t('closeFail'),'error');
  });
}
async function ownerReopenDay(btn, field, ds){
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'ownerReopenDay', owner_token:Session.owner(), field_id:field.field_id, date:ds });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('closeFail'),'error'); return; }
    toast(t('closeReopened'),'success');
    await refreshClosures(); renderOwnerCalendar();
      /* الإغلاق يغيّر **الطاقة**، فيغيّر كلّ ما يُقسَم عليها: كفاءة الخانة
         وطاقةُ الذروة الفارغة. و`renderOwnerEcon` سقطت وحلّ محلّها لوحان
         لكلٍّ منهما عتبتُه، فيُعاد رسمهما معًا لا واحدًا منهما. */
      { const bk=State.ownerData?.bookings||[]; const sc=reportScoped(bk);
        safeRender('leak', ()=>renderOwnerLeak(sc));
        safeRender('capacity', ()=>renderOwnerCapacityCard(bk, sc)); }
      safeRender('today', renderOwnerToday);
  });
}
/* إعادة جلب الإغلاقات وحدها بعد تغييرها — أرخص من إعادة تحميل اللوحة كاملةً،
   ويُبقي كل القرّاء (الرئيسية · التفاصيل · اللوحة) على خريطة واحدة. */
async function refreshClosures(){
  try{ buildClosures(await sbGetClosures()); }catch(_){}
}

/* ═══ (٢.٢) قواعد التسعير ═══════════════════════════════════════════════ */
const WD_KEYS=['sun','mon','tue','wed','thu','fri','sat'];
const wdName=(i)=>{ try{ return new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'}).format(new Date(2024,8,1+i)); }catch(_){ return WD_KEYS[i]; } };
function openPricing(fieldId){
  const f=(State.ownerData?.fields||[]).find(x=>String(x.field_id)===String(fieldId)); if(!f) return;
  State.pricing={ field:f, days:[], rules:[] };
  setText('prField', `${f.field_name} — ${t('priceGridBase',{v:formatCurrency(f.price)})}`);
  const hrs=ownerHourOptions();
  fillHourSelect($('#prFrom'), hrs, false);
  fillHourSelect($('#prTo'), hrs, true);
  $('#prTo').value=String(hrs[hrs.length-1]+2);
  $('#prPrice').value=''; $('#prPriority').value='10';
  const days=$('#prDays'); clear(days);
  for(let i=0;i<7;i++){
    const b=h('button',{class:'fx-chip', type:'button', dataset:{wd:String(i)}}, wdName(i));
    b.addEventListener('click', ()=>{ toggleArr(State.pricing.days, i); b.classList.toggle('on'); });
    days.append(b);
  }
  Modal.open('modal-pricing');
  loadPricingRules();
}
async function loadPricingRules(){
  const f=State.pricing?.field; if(!f) return;
  const warn=$('#prNotReady'); warn.hidden=true; clear(warn);
  const r = await API.post({ action:'ownerGetPriceRules', owner_token:Session.owner(), field_ids:[f.field_id] });
  if(!r || !r.success){
    // الترحيل الناقص يُسمّى، ونموذج الإضافة يُخفى: زرٌّ يَعِد بما سيُرفَض أسوأ من غيابه
    warn.hidden=false; warn.textContent = (r&&r.message) || t('ruleFail');
    $('#prForm').hidden = !!(r&&r.missing);
    clear($('#prList')); clear($('#prGrid'));
    return;
  }
  $('#prForm').hidden=false;
  State.pricing.rules = r.rules || [];
  renderPricingRules(); renderPriceGridPreview();
}
function renderPricingRules(){
  const el=$('#prList'); clear(el);
  const rules=State.pricing?.rules||[];
  if(!rules.length){ el.append(h('div',{class:'pr-empty'}, t('ruleNone'))); return; }
  rules.forEach(r=>{
    const days = (r.weekdays && r.weekdays.length) ? r.weekdays.map(n=>wdName(Number(n))).join('، ') : t('ruleAllDays');
    const hours = (r.from_hour==null) ? t('ruleAllHours')
      : h('bdi',{dir:'ltr'}, `${fmtHour12(r.from_hour)} – ${fmtHour12(r.to_hour)}`);
    const del=h('button',{class:'owner-action owner-reject pr-del'}, t('ruleDelBtn'));
    del.addEventListener('click', ()=>delPriceRule(del, r.id));
    el.append(h('div',{class:'pr-row'},
      h('div',{class:'pr-row-main'},
        h('span',{class:'pr-price'}, h('bdi',{dir:'ltr'}, formatCurrency(r.price))),
        h('span',{class:'pr-when'}, days, ' · ', hours)),
      h('span',{class:'pr-prio'}, '#'+String(r.priority)),
      del));
  });
}
/* القراءة الراجعة: ناتج القواعد على سبعة أيام كما ستراه شاشة الحجز بالضبط —
   مقروءًا من **نفس الدالّة** التي يقرأ منها التطبيق، لا محسوبًا هنا ثانيةً. */
async function renderPriceGridPreview(){
  const el=$('#prGrid'); clear(el);
  const f=State.pricing?.field; if(!f) return;
  el.append(h('div',{class:'pr-grid-load'}, t('loadingBookings')));
  let rows=[];
  try{ rows = await API.get('getPriceGrid', { place_id: State.ownerData?.place?.place_id }, 'ownerPriceGrid'); }catch(_){ }
  clear(el);
  const map={};
  (rows||[]).filter(r=>String(r.field_id)===String(f.field_id))
            .forEach(r=>{ (map[String(r.d).split('T')[0]] ||= {})[Number(r.hour)] = Number(r.price); });
  const hrs=fieldSlots(f).map(s=>s.hour);
  for(let i=0;i<7;i++){
    const d=dateAfter(i);
    const row=h('div',{class:'pr-gd'}, h('span',{class:'pr-gd-day'}, dayLabel(d)));
    hrs.forEach(hr=>{
      const v=(map[d]||{})[hr];
      row.append(h('span',{class:'pr-gd-cell'+(v!=null?' on':'')},
        h('span',{class:'pr-gd-h'}, h('bdi',{dir:'ltr'}, fmtHour12(hr))),
        v!=null ? h('bdi',{dir:'ltr', class:'pr-gd-v'}, formatCurrency(v)) : h('span',{class:'pr-gd-v dim'}, '—')));
    });
    el.append(row);
  }
}
async function addPriceRule(btn){
  const f=State.pricing?.field; if(!f) return;
  const price=Number($('#prPrice').value);
  if(!$('#prPrice').value.trim() || Number.isNaN(price) || price<0){ toast(t('ruleNeedPrice'),'warn'); return; }
  const from=Number($('#prFrom').value), to=Number($('#prTo').value);
  if(Number.isNaN(from)||Number.isNaN(to)||to<=from){ toast(t('ruleNeedHours'),'warn'); return; }
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'ownerAddPriceRule', owner_token:Session.owner(),
      field_id:f.field_id, price, priority:Number($('#prPriority').value||0),
      weekdays:(State.pricing.days||[]).slice().sort((a,b)=>a-b), from, to });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('ruleFail'),'error'); return; }
    toast(t('ruleAdded'),'success');
    $('#prPrice').value='';
    await loadPricingRules();
    // شبكة اللاعب أصبحت قديمة ⇒ أبطِلها كي تُجلب من جديد عند فتح التفاصيل
    State.pricesPlaceId='';
  });
}
async function delPriceRule(btn, id){
  await withLoading(btn, async()=>{
    const r = await API.post({ action:'ownerDelPriceRule', owner_token:Session.owner(), id });
    if(!r || !r.success){ toast(apiMsg(r&&r.message)||t('ruleFail'),'error'); return; }
    toast(t('ruleDeleted'),'success');
    await loadPricingRules(); State.pricesPlaceId='';
  });
}

/* ---- Review ---- */
function openReview(){
  const p=State.detail.place; if(!p)return;
  State.review={ rating:0, placeId:String(p.place_id) }; setRating(0);
  setText('rvPlace',p.place_name); $('#rvName').value=State.player?.name||''; $('#rvPhone').value=State.player?.phone||'';
  Modal.open('modal-review');
}
function setRating(r){
  State.review.rating=r;
  $$('#starsBox .star').forEach((s,i)=>s.classList.toggle('active', i<r));
  const radios=$$('#starsBox .star-input');
  radios.forEach(i=>{ i.checked = (Number(i.value)===r); });
}

/* ══════════════════════════════════════════════════════════════════════
   الحبّة المنزلقة في الشريط السفلي

   ما تفعله: تقيس زرّ التبويب النشط، وتنقل عنصرًا واحدًا (`.nav-pill`) إليه
   بـ`transform` و`width`. الأزرار نفسها لا تتحرّك ولا تتغيّر خلفياتها، فكل
   الحركة في طبقة واحدة مركَّبة.

   ⚠️ لماذا القياس في JS لا في CSS: عرض كل زرّ يتبع نصّه (‏«الرئيسية» أضيق من
   «حجوزاتي»)، والصفّ موسَّط ⇒ لا صيغة CSS ثابتة تعطي موضع الزرّ الثالث.

   ⚠️ والإحداثيان **فارقان** بين مستطيل الزرّ ومستطيل الشريط، لا `left` مطلقة:
   الشريط نفسه مزاح بـ`translate3d(-50%,…)` ويُزاح ثانيةً عند فتح الكيبورد،
   والفارق ثابت في الحالتين. وهو أيضًا ما يجعل المنطق **واحدًا في RTL وLTR**:
   `getBoundingClientRect` فيزيائي أصلًا فلا إشارة تُعكَس ولا ضرب في --dirx.

   ⚠️ ولا يُقاس شريط مخفيّ: `display:none` يعطي أصفارًا، فتذهب الحبّة إلى
   الزاوية. الشريط المخفيّ يفقد `pill-on` ⇒ ظهوره التالي **قفزة لا انزلاق**
   (الانزلاق من موضع بائد يُقرأ خللًا).
   ══════════════════════════════════════════════════════════════════════ */
const NavPill = {
  raf: 0,
  sync(jump){
    $$('.bnav').forEach(nav=>{
      const pill=nav.querySelector('.nav-pill'); if(!pill) return;
      if(!nav.classList.contains('show')){ nav.classList.remove('pill-on'); return; }
      const act=nav.querySelector('.nitem.active');
      if(!act){ nav.classList.remove('pill-on'); return; }
      const nr=nav.getBoundingClientRect(), ar=act.getBoundingClientRect();
      if(!ar.width || !ar.height){ nav.classList.remove('pill-on'); return; }
      /* ⚠️ حدّ الشريط يُطرح: العنصر المطلق يُوضَع من **صندوق الحشوة** لا صندوق
         الحدّ، و`.bnav` لها `border-top:1px` ⇒ فارقُ المستطيلين يزيد بكسلًا
         واحدًا فتجلس الحبّة أخفض من الزرّ. (مقيسة: y=11.5 والحبّة عند 12.5.) */
      const cs=getComputedStyle(nav);
      // فيزيائي لا منطقي: `ar.left-nr.left` فيزيائي، فالحدّ المطروح منه مثله
      const bl=parseFloat(cs.borderLeftWidth)||0;
      const bt=parseFloat(cs.borderTopWidth)||0;
      // شريط لم يُقَس بعد ⇒ لا مكان سابق يُنزلَق منه
      const hard = jump || !nav.classList.contains('pill-on');
      if(hard) nav.classList.add('pill-jump');
      pill.style.setProperty('--pill-x', (ar.left-nr.left-bl)+'px');
      pill.style.setProperty('--pill-y', (ar.top -nr.top -bt)+'px');
      pill.style.setProperty('--pill-w', ar.width +'px');
      pill.style.setProperty('--pill-h', ar.height+'px');
      nav.classList.add('pill-on');
      // القراءة تُجبر تثبيت القيم الجديدة قبل إعادة الانتقالات
      if(hard){ void pill.offsetWidth; nav.classList.remove('pill-jump'); }
    });
  },
  /* قياسان: واحد **فورًا** وآخر بعد فريم.
     ⚠️ الفوري ليس تفاؤلًا — قراءة `getBoundingClientRect` تُجبر المتصفّح على
     إعادة التخطيط قبل أن تردّ، فالمقاس صحيح ولو تغيّر `display` قبل سطر واحد.
     وبدونه تتعلّق الحبّة بـ`requestAnimationFrame` وهو **يُخنَق في التبويب
     المخفيّ ولا يُطلَق أصلًا**: قيس ذلك في متصفّح بلا واجهة فظهرت الحبّة
     متأخّرة خطوةً كاملة عن التبويب النشط في كل لقطة.
     والثاني يلتقط ما يستقرّ بعد فريم (وصول خطّ عربي يغيّر عرض الكلمات). */
  schedule(jump){
    this.sync(jump);
    cancelAnimationFrame(this.raf);
    this.raf=requestAnimationFrame(()=>this.sync(jump));
  }
};
window.addEventListener('resize', ()=>NavPill.schedule(true));
/* ⚠️ `fonts.ready` مرّة واحدة لا تكفي: خطّ الإنجليزية لا يُحمَّل إلّا حين
   تُستعمل الإنجليزية أوّل مرّة، فقياسُ الحبّة عند قلب اللغة يقع على مقاييس
   الخطّ الاحتياطي. (مقيس: الحبّة تستقرّ على 85.93px والزرّ 85.40px وتبقى
   الفارقة أبدًا.) و`loadingdone` يُطلَق مع كل دفعة خطوط تصل. */
try{
  document.fonts?.ready?.then(()=>NavPill.schedule(true));
  document.fonts?.addEventListener?.('loadingdone', ()=>NavPill.schedule(true));
}catch(_){}

/* ===================== ROUTER ===================== */
/* 🔴 **و`hub` خارج الخريطة عمدًا** (طلب المالك 2026-08-18): الشريط السفلي يظهر
   داخل صفحة الملاعب وأخواتها لا على الشبكة — والشبكة نفسها هي القائمة. وغيابُ
   المفتاح هو الآليّة: `NAV_OF[name]` تعود `undefined` فلا يُظهَر شريطٌ أصلًا.
   ⚠️ ويبقى زرّ «الرئيسية» في الشريط **مخرجًا مرئيًّا** من التصفّح إلى الشبكة —
      بلا ذلك لا يعود إليها إلّا من يعرف إيماءة الرجوع، وهي مصيدةٌ مسجَّلة. */
const NAV_OF = { home:'player', favorites:'player', bookings:'player', account:'player', owner:'owner' };
/* مكدّس تنقّل داخلي: «رجوع» حقيقي داخل التطبيق دون مغادرة الموقع وبلا window.history */
const NavStack = [];
const activePageName = () => { const p=$('.page.active'); return p ? p.id.replace('page-','') : null; };
/* التمرير قد يقع على #app (حاوية overflow) أو على النافذة حسب البيئة — نقرأ ونكتب كليهما */
function pageScrollGet(){ const a=$('#app'); return Math.max(a?a.scrollTop:0, window.scrollY||0); }
function pageScrollSet(y){ const a=$('#app'); if(a) a.scrollTop=y; window.scrollTo({top:y,behavior:'instant'}); }
const navigateTo = (name)=>showPage(name);
function navigateBack(fallback){
  /* شرائح الترحيب ليست صفحات ⇒ الرجوع داخلها يرجع شريحةً واحدة قبل أن يغادر
     الصفحة أصلًا. والحارس هنا لا في الجسر الأصلي وحده كي يتصرّف زرُّ الرجوع
     في الواجهة وإيماءةُ أندرويد بالسلوك نفسه — مصدرٌ واحد للقرار. */
  if(Obs.open && Obs.i > 0){ Obs.prev(); return; }
  const cur=activePageName();
  let prev=NavStack.pop();
  while(prev && prev===cur) prev=NavStack.pop();     // منع الحلقات: لا رجوع إلى الصفحة نفسها
  showPage(prev || fallback || 'home', {back:true});
}
function showPage(name, opts){
  opts=opts||{};
  /* «المفضّلة» ليست صفحةً بل **حالةً** على الرئيسية: مسارٌ واحد يعرض `home`
     مع `favOnly=true`، و`home` يفرضها `false`. مصدر الحالة واحد ⇒ لا نسخة
     ثانية من `renderPlaces` ولا شريحة ثانية تنحرف عنه.
     و`navKey` ينفصل عن `name` هنا وحده: الأوّل يضيء زرّ الشريط، والثاني
     يختار `#page-*`. */
  let navKey = name;
  if(name==='favorites'){ State.favOnly=true;  name='home'; }
  else if(name==='home'){ State.favOnly=false; navKey='hub'; }   // التصفّح ابنُ الشبكة فيضيء زرّها
  const cur=activePageName();
  if(cur) State.pageScroll[cur]=pageScrollGet();     // حفظ موضع الصفحة المغادَرة
  // دفع الصفحة الحالية للمكدّس — إلا عند الرجوع، والتحويل الداخلي، وإعادة عرض الصفحة نفسها (لا تكرار)
  if(cur && cur!==name && !opts.back && !opts.redirect){
    if(NavStack[NavStack.length-1]!==cur) NavStack.push(cur);
    if(NavStack.length>30) NavStack.shift();
  }
  const ds=$('#detailSticky'); if(ds && name!=='detail') ds.hidden=true;   // إخفاء الملخّص اللاصق خارج التفاصيل
  /* الصفحة المغادِرة تبقى مرسومة طوال الانتقال وتنزاح **أقلّ** من الداخلة
     (‏14% مقابل 100%) — والفارق بين السرعتين هو ما يُقرأ عمقًا: الطبقة الخلفية
     تتحرّك أبطأ. وقبل هذا كانت تُقصّ بـ`display:none` فورًا، فيتحرّك طرفٌ واحد. */
  const leaving = (cur && cur!==name) ? $('#page-'+cur) : null;
  const lmode = leaving ? (opts.back ? 'lv-back'
    : (NAV_OF[cur] && NAV_OF[name] && NAV_OF[cur]===NAV_OF[name] ? 'lv-fade' : 'lv-fwd')) : null;
  /* ⚠️ **وأصنافُ المغادرة تُمسح هنا كذلك.** كانت تُزال بمؤقّت 360ms وحده، فتنقّلٌ
     ثالثٌ خلال المهلة يجد الصفحةَ الأولى ما زالت `pg-leave` — أي `absolute`
     فوق المحتوى بمظهرٍ مجمَّد (‏`both`). والمسح هنا يسبق إعادة الإسناد بسطرين
     فلا يضرّ، والمؤقّت الباقي يزيل أصنافًا مزالة أصلًا. */
  $$('.page').forEach(p=>{ p.classList.remove('active','pg-fwd','pg-back','pg-fade','pg-drag','pg-settle','pg-leave','lv-fwd','lv-back','lv-fade'); p.style.transform=''; });
  if(leaving){
    leaving.classList.add('pg-leave', lmode);
    /* ⚠️ 360ms (‏> 320) **ولا يُلغى عند تنقّل متتالٍ**: التنظيف المكرّر غير ضارّ،
       بينما إلغاء المؤقّت يترك صفحةً عالقة مرسومةً فوق المحتوى. */
    setTimeout(()=>leaving.classList.remove('pg-leave','lv-fwd','lv-back','lv-fade'), 360);
  }
  const page=$('#page-'+name); if(page) page.classList.add('active');
  // أشرطة التنقّل
  const nav=NAV_OF[name];
  $('#nav-player').classList.toggle('show', nav==='player');
  $('#nav-owner').classList.toggle('show', nav==='owner');
  $$('#nav-player .nitem').forEach(n=>{ const on=n.dataset.nav===navKey; n.classList.toggle('active', on); n.setAttribute('aria-current', on?'page':'false'); });
  NavPill.schedule();
  // خطافات الصفحات — التحويلات الداخلية {redirect:true} كي لا تدخل المكدّس فتصنع حلقة
  if (name==='onboarding') Obs.enter();
  if (name==='hub') renderHub();
  /* ⚠️ **الدخول يعود إلى وضع الملاعب دائمًا**: لم يعد في الصفحة مبدّلٌ يُرجِع
     منه، فمن دخل بعد زيارةٍ سابقة للمباريات كان سيجد قائمة مباريات بلا مخرج.
     و`hubGames` تستدعي `setMode('games')` **بعد** هذا السطر فلا يتعارضان. */
  if (name==='home'){ setMode('venues'); updateSecTitle(); renderPlaces(); }
  if (name==='bookings'){ if(!Session.player()&&State.guest){ toast(t('loginToSeeBookings'),'warn'); return showPage('playerLogin',{redirect:true}); } loadPlayerBookings(); }
  if (name==='account'){ if(!Session.player()){ return showPage('playerLogin',{redirect:true}); }
    const nm=State.player?.name||'', ph=State.player?.phone||'';
    $('#accName').value=nm; $('#accPhone').value=ph;
    setText('accNameDisplay', nm||t('welcomeYou')); setText('accPhoneDisplay', ph||'—');
    const av=$('#accAvatar'); if(av) av.textContent=(nm.trim().charAt(0))||t('avatarFallback');
    renderVerifyBadge();
  }
  // العدّاد يُوقَف عند مغادرة شاشة التأكيد لا عند الدخول إليها: `cur` هو ما غادرناه
  if (cur==='verifyPhone' && name!=='verifyPhone') Verify.stopTimer();
  if (name==='verifyPhone'){ if(!Session.player()){ return showPage('playerLogin',{redirect:true}); } Verify.enter(); }
  if (name==='playerRegister') renderPwFeedback();
  if (name==='owner'){ if(!Session.owner()){ return showPage('ownerLogin',{redirect:true}); } if(State.ownerData) renderOwnerDashboard(); }
  /* 🔴 **الحركة تبدأ بعد أن تُبنى الصفحة، لا قبلها** (بلاغ المالك 2026-08-13:
     «الانتقال مرّات بطيء وبعلق»). كان صنفُ الاتجاه يُضاف **قبل** خطّافات
     الصفحات، ثمّ تجري `renderPlaces()` / `renderOwnerDashboard()` — وهي تبني
     عشرات العقد — بينما الانتقال جارٍ: كلّ تعديلٍ على الـDOM يُبطل تخطيط
     الطبقة المتحرّكة فتُعاد رسمتُها في كل فريم. والعطل **متقطّع** لأنه يتبع
     كِبَر الصفحة الداخلة: التبويبات الخفيفة سلسة والرئيسية ولوحة المالك تتلعثم.
     والنقل إلى هنا بلا وميض: كلّ ما فوق يجري في **مهمّة واحدة** لا يرسم
     المتصفّح بينها شيئًا، والصنف يُضاف قبل أن يعود المحرّك.
     ⚠️ وموضعه بعد الخطّافات مقصود لسببٍ ثانٍ: كلٌّ منها قد يُحوّل إلى صفحة
     أخرى (`return showPage(...)`)، فبالترتيب القديم كنّا نُشغّل انتقالًا
     لصفحةٍ هُجرت في السطر التالي. */
  if(page && cur && cur!==name){
    const tabToTab = !!NAV_OF[cur] && !!NAV_OF[name] && NAV_OF[cur]===NAV_OF[name];
    const mode = opts.back ? 'pg-back' : tabToTab ? 'pg-fade' : 'pg-fwd';
    void page.offsetWidth;                 // إعادة تشغيل مضمونة للأنيميشن بعد إزالة الأصناف
    page.classList.add(mode);
  }
  manageAutoRefresh();
  HeroPh.sync();   // يوقف دوران النائب خارج صفحة الهبوط ويستأنفه عند العودة إليها
  // الرئيسية تستعيد موضعها دائمًا؛ الرجوع يستعيد موضع الصفحة السابقة؛ التقدّم يبدأ من الأعلى
  // ⚠️ إلّا التبديل بين «الرئيسية» و«المفضّلة»: الصفحة واحدة والقائمة تحتها
  // تتغيّر طولًا، فاستعادةُ موضعٍ من قائمةٍ أطول تُنزل المستخدم تحت آخر بطاقة.
  const keyChanged = State.navKey!==navKey; State.navKey=navKey;
  const y = (name==='home' && !keyChanged) ? (State.pageScroll.home||0)
          : name==='home' ? 0
          : (opts.back ? (State.pageScroll[name]||0) : 0);
  requestAnimationFrame(()=>pageScrollSet(y));
  // إشعار طبقة native (شريط الحالة يتلوّن حسب الصفحة) — خامل تمامًا على المتصفح
  try{ document.dispatchEvent(new CustomEvent('app:page',{detail:name})); }catch(_){}
}

/* جسر التطبيق (Capacitor): خامل تمامًا على المتصفح — يُنشأ فقط داخل التطبيق المُغلَّف.
   يتيح لطبقة native.js تشغيل «الرجوع» الداخلي دون كسر تغليف الوحدة (IIFE). */
try{
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()){
    /* ⚠️ شاشات الترحيب تعترض الرجوع **قبل** المكدّس: داخلها يرجع شريحةً واحدة،
       وعلى الأولى ينتقل إلى `welcome` **ولا يُغلق التطبيق**. وصارت صفحةً في
       `showPage` (فترث الانتقالات والـhistory)، لكنّ الشرائح داخلها ليست صفحات
       ⇒ يبقى الاعتراض هنا، على الجسر القائم لا على معالِج ثانٍ يتنازع معه. */
    window.__native = {
      back: (fb)=>{ if(Obs.open){ Obs.back(); return; } navigateBack(fb); },
      page: ()=> activePageName()
    };
  }
}catch(_){}

/* اهتزاز خفيف (نبضة لمس) — يعمل داخل WebView أندرويد، ويُتجاهل بهدوء حيث لا يتوفّر */
// تغذية لمسية: تفضّل محرّك التغذية اللمسية الأصلي (@capacitor/haptics عبر جسر
// `window.__haptic` في native.js) وترجع إلى محرّك الاهتزاز الخام في المتصفّح.
// نقاط النداء لم تتغيّر — نفس `buzz(ms)` في كل مكان.
function buzz(ms){
  try{ if(typeof window.__haptic === 'function'){ window.__haptic(ms); return; } }catch(_){}
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(_){}
}

/* ══════════════════════════════════════════════════════════════════════
   الأنيميشن الترحيبي (INTRO) — يظهر من أول فريم (موجود في HTML فلا وميض)،
   والـCSS يديره كاملًا؛ مهمّة الـJS هنا **إزالته من DOM** بعد انتهائه كي لا
   يبقى حاجزًا فوق الواجهة ولا طبقة GPU. مرّة واحدة لكل إقلاع (لا تنقّل).
   ══════════════════════════════════════════════════════════════════════ */
(function intro(){
  const el=document.getElementById('intro'); if(!el) return;
  let done=false;
  const kill = () => {
    if(done) return; done=true;
    el.remove();
    /* ⚠️ شريط الحالة كان Teal ما دام اللوح موجودًا (native.js يفحص #intro).
       ومراقب الشريط يرصد **صنف body** لا حذف عنصر ⇒ لا شيء يوقظه بعد الإزالة،
       فيبقى Teal فوق رأسٍ أبيض. حدث الصفحة هو الموقظ القائم فنُطلقه. */
    try{ document.dispatchEvent(new CustomEvent('app:page',{detail:activePageName()})); }catch(_){}
  };
  /* الإزالة تتبع الأنيميشن نفسه لا ساعةً موازية له. الساعتان لا تبدآن معًا:
     ساعة CSS تبدأ عند أوّل رسم لعقدة `.intro` (وسمُها في أعلى «body» وورقتها في
     <head>)، وساعة `setTimeout` لا تبدأ إلّا بعد تحليل الحزمة كلّها وتنفيذ كلّ
     ما قبلها من IIFE. الفارق على WebView بارد مئات المللي‑ثانية، وكان اللوح
     يبقى فيها فوق الواجهة. `animationend` يقيس الساعة الصحيحة بلا رقم مكتوب. */
  el.addEventListener('animationend', e=>{
    if(e.target===el && e.animationName==='introOut') kill();
  });
  /* شبكة أمان لا مؤقّت رئيسي: الحدث قد لا يصل إن أُلغيت الحركة أو كانت الصفحة
     مخفيّة. ⚠️ ومدّتها **تُقرأ من CSS** لا تُكتب رقمًا ثانيًا: التوقيت يحكمه
     `--intro-k` وقاعدةُ تقليل الحركة معًا، ورقمٌ مكتوب هنا يخالفهما صامتًا —
     وهو ما كان يقع فعلًا (الفرع القديم كان 500ms لتقليل الحركة بينما الحركة
     الفعلية 1240+520، لأن لاحقتَي §27 تعلوان على مختصر قاعدة التقليل).
     والهامش سخيّ عمدًا: `pointer-events:none` يجعل التأخّر بلا كلفة، والتبكير
     يقطع الحركة في منتصفها. */
  const ms = v => { const s=String(v||'').split(',')[0].trim(), n=parseFloat(s);
                    return isFinite(n) ? (/ms$/.test(s) ? n : n*1000) : 0; };
  const cs = getComputedStyle(el);
  const base = ms(cs.animationDuration) + ms(cs.animationDelay);
  setTimeout(kill, (base > 0 ? base : 1800) + 1200);
})();

/* ══════════════════════════════════════════════════════════════════════
   إيماءة الرجوع من الحافة (تطبيق) — سحب من الحافة الابتدائية ⇒ navigateBack
   • الحافة الابتدائية = اليمين بالعربي · اليسار بالإنجليزي (تتبع dir).
   • الصفحة تتبع الإصبع فريمًا بفريم (transform فقط)، وتُحسم بالمسافة أو السرعة.
   • تُلغى الإيماءة إن بدأت داخل عنصر يتمرّر أفقيًا (أيام/أوقات/شرائح) كي لا نسرق تمريره.
   ══════════════════════════════════════════════════════════════════════ */
(function edgeBackGesture(){
  const EDGE=32;            // عرض منطقة البدء من الحافة (px)
  const LOCK=10;            // إزاحة تحسم أن الإيماءة أفقية
  const TRIG=0.32;          // نسبة العرض التي تُنجز الرجوع
  const VEL=0.5;            // px/ms — سرعة تُنجز الرجوع مهما كانت المسافة
  let sx=0, sy=0, t0=0, dx=0, tracking=false, locked=false, page=null, W=1, rtl=false;

  const backable=()=>{ const p=activePageName(); return !!p && p!=='hub' && p!=='welcome'; };
  /* هل نقطة اللمس داخل عنصر يتمرّر أفقيًا؟ (rails الأيام/الأوقات/الرياضات/التقييمات) */
  function inHScroller(el){
    for(let n=el; n && n!==document.body; n=n.parentElement){
      if(n.scrollWidth > n.clientWidth+4){
        const ox=getComputedStyle(n).overflowX;
        if(ox==='auto'||ox==='scroll') return true;
      }
    }
    return false;
  }
  function detach(){ document.removeEventListener('touchmove', onMove, {passive:false}); }
  function reset(){
    if(page){ page.classList.remove('pg-drag','pg-settle'); page.style.transform=''; }
    document.body.classList.remove('dragging-back');
    page=null; tracking=false; locked=false; dx=0; detach();
  }
  /* ⚠️ مستمع غير سلبي (passive:false) يُلزم المتصفّح بانتظار الـJS في كل touchmove، فيقطّع
     التمرير على الأجهزة المتوسطة. لذا يُركَّب فقط عند بدء لمسة مؤهّلة من الحافة، ويُفكّ بعدها. */
  function onMove(e){
    if(!tracking || !page){ detach(); return; }
    const T=e.touches[0];
    const ax = rtl ? (sx-T.clientX) : (T.clientX-sx);   // موجب = سحب نحو الحافة النهائية
    const ay = T.clientY-sy;
    if(!locked){
      if(Math.abs(ay) > Math.abs(ax) && Math.abs(ay) > LOCK){ tracking=false; detach(); return; }  // تمرير عمودي ⇒ اتركه
      if(ax < LOCK) return;
      locked=true;
      page.classList.add('pg-drag');
      document.body.classList.add('dragging-back');
    }
    dx = Math.max(0, Math.min(ax, W));
    e.preventDefault();                                  // بعد الحسم فقط — لا نعطّل التمرير العمودي
    page.style.transform = 'translate3d('+(rtl?-dx:dx)+'px,0,0)';
  }
  document.addEventListener('touchstart', e=>{
    if(e.touches.length!==1 || document.body.classList.contains('modal-open') || !backable()) return;
    const T=e.touches[0];
    rtl = document.documentElement.dir==='rtl';
    W = window.innerWidth||1;
    const atEdge = rtl ? (T.clientX > W-EDGE) : (T.clientX < EDGE);
    if(!atEdge || inHScroller(e.target)) return;
    sx=T.clientX; sy=T.clientY; t0=Date.now(); dx=0; tracking=true; locked=false;
    page=$('.page.active');
    document.addEventListener('touchmove', onMove, {passive:false});
  }, {passive:true});

  const end=()=>{
    if(!tracking || !page){ reset(); return; }
    if(!locked){ reset(); return; }
    const v = dx/Math.max(1, Date.now()-t0);
    // المسافة تحسم، أو السرعة مع مسافة معقولة (12% على الأقل) — كي لا ترجع رفّة إصبع عابرة
    const done = dx > W*TRIG || (v > VEL && dx > W*0.12);
    const el=page;
    if(done){ buzz(8); reset(); navigateBack('hub'); return; }
    el.classList.remove('pg-drag'); el.classList.add('pg-settle');
    el.style.transform='';
    const clean=()=>{ el.classList.remove('pg-settle'); el.removeEventListener('transitionend',clean); };
    el.addEventListener('transitionend', clean, {once:true});
    setTimeout(clean, 320);                              // شبكة أمان لو لم يصل transitionend
    document.body.classList.remove('dragging-back');
    page=null; tracking=false; locked=false; dx=0; detach();
  };
  document.addEventListener('touchend', end, {passive:true});
  document.addEventListener('touchcancel', ()=>{ if(page) reset(); else detach(); }, {passive:true});
})();

/* ══════════════════════════════════════════════════════════════════════
   (٤) انقطاع الاتصال — طبقة تحجب التفاعل وتقول ما حدث
   • `navigator.onLine === false` دليل قاطع على الانقطاع؛ و`true` **ليس** دليلًا
     على وجود إنترنت (شبكة بلا بوّابة تُعطيه). لذلك نُظهر الطبقة على `offline`
     وحدها، ولا ندّعي شيئًا عند `online` سوى أن الجهاز عاد متّصلًا.
   • زرّ خروج إجباري: لو أخطأ المتصفّح في التقدير لا يعلق المستخدم أمام حائط.
     والإخفاء يدويًّا لا يمنع ظهورها في الانقطاع التالي.
   ══════════════════════════════════════════════════════════════════════ */
const Offline = {
  el(){ return $('#offlineOverlay'); },
  show(){ const o=this.el(); if(!o||!o.hidden) return; o.hidden=false; requestAnimationFrame(()=>o.classList.add('show')); buzz(18); },
  hide(){ const o=this.el(); if(!o||o.hidden) return; o.classList.remove('show');
    const done=()=>{ if(!o.classList.contains('show')) o.hidden=true; };
    o.addEventListener('transitionend', done, {once:true}); setTimeout(done, 400); },   // شبكة أمان لو لم يصل transitionend
  init(){
    window.addEventListener('offline', ()=>this.show());
    window.addEventListener('online',  ()=>{ this.hide(); toast(t('onlineBack'),'success'); loadData().catch(()=>{}); });
    if(navigator.onLine === false) this.show();          // قد يقلع التطبيق وهو مقطوع أصلًا
  }
};

/* ══════════════════════════════════════════════════════════════════════
   (٦) السحب للتحديث — على الصفحات الثلاث القابلة للتحديث
   • المتمرِّر هو **المستند** لا `#app` (لا `overflow-y` عليه) ⇒ الشرط `scrollY<=0`.
   • المستمع غير السلبي يُركَّب عند لمسة مؤهّلة ويُفكّ فور انتهائها — نفس نمط
     إيماءة الرجوع، فلا يُقطَّع التمرير العادي على الأجهزة المتوسطة.
   • التخميد 0.5 يجعل السحب يُقاوم كالتطبيقات الأصلية، والمؤشّر ثابت خارج
     تدفّق الصفحة فلا يزحزح المحتوى، وحركته transform/opacity وحدهما.
   ══════════════════════════════════════════════════════════════════════ */
const PullRefresh = (()=>{
  const TRIG=72, MAX=110, DAMP=0.5;
  const JOBS = {
    home:     async()=>{ try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){} await loadData({force:true}); renderPlaces(); },
    bookings: async()=>{ await loadPlayerBookings(); },
    owner:    async()=>{ await loadOwnerDashboard(); },
  };
  let sy=0, pull=0, tracking=false, locked=false, busy=false;

  const box=()=>$('#ptr');
  function paint(state){
    const el=box(); if(!el) return;
    // محور Y وحده: التمركز الأفقي صار بـ`margin-inline:auto` في CSS — و`-50%` هنا
    // كانت تُزيح المؤشّر يسارًا بعرضه في RTL (transform فيزيائي لا يدرك الاتجاه).
    el.style.transform = `translate3d(0,${pull}px,0)`;
    el.style.opacity = String(Math.min(1, pull/44));
    el.classList.toggle('ready', pull>=TRIG && state!=='loading');
    el.classList.toggle('loading', state==='loading');
    const ring=$('#ptrRing'); if(ring && state!=='loading') ring.style.transform=`rotate(${pull*3}deg)`;
    setText('ptrTxt', state==='loading' ? t('ptrLoading') : (pull>=TRIG ? t('ptrRelease') : t('ptrPull')));
  }
  function reset(){
    pull=0; tracking=false; locked=false;
    const el=box(); if(el){ el.classList.add('snap'); el.classList.remove('ready','loading'); el.style.transform='translate3d(0,0,0)'; el.style.opacity='0';
      setTimeout(()=>el.classList.remove('snap'), 260); }
    detach();
  }
  const eligible=()=>{
    if(busy || document.body.classList.contains('modal-open')) return false;
    if(!$('#offlineOverlay')?.hidden) return false;
    const p=activePageName();
    return !!(p && JOBS[p]) && (window.scrollY||document.documentElement.scrollTop||0) <= 0;
  };
  function detach(){ document.removeEventListener('touchmove', onMove, {passive:false}); }
  function onMove(e){
    if(!tracking){ detach(); return; }
    const dy = e.touches[0].clientY - sy;
    if(!locked){
      if(dy < 8) { if(dy < -8){ tracking=false; detach(); } return; }   // تمرير لأعلى ⇒ اتركه
      if((window.scrollY||0) > 0){ tracking=false; detach(); return; }
      locked=true; const el=box(); if(el) el.classList.remove('snap');
    }
    pull = Math.min(MAX, dy*DAMP);
    e.preventDefault();                       // بعد الحسم فقط — يمنع أيضًا تحديث المتصفّح المدمج
    paint();
  }
  async function run(){
    const p=activePageName(); const job=JOBS[p]; if(!job){ reset(); return; }
    busy=true; pull=TRIG; paint('loading'); buzz(10);
    try{ await job(); }catch(_){ /* الوظائف تعالج أخطاءها وتُظهر رسالتها */ }
    finally{ busy=false; setText('ptrTxt', t('ptrDone')); setTimeout(reset, 320); }
  }
  const end=()=>{
    if(!tracking || !locked){ if(tracking) reset(); return; }
    if(pull >= TRIG) run(); else reset();
  };
  return { init(){
    document.addEventListener('touchstart', (e)=>{
      if(e.touches.length!==1 || !eligible()) return;
      sy=e.touches[0].clientY; pull=0; tracking=true; locked=false;
      document.addEventListener('touchmove', onMove, {passive:false});
    }, {passive:true});
    document.addEventListener('touchend', end, {passive:true});
    document.addEventListener('touchcancel', ()=>{ if(tracking) reset(); else detach(); }, {passive:true});
  }};
})();

/* ارتفاع كيبورد الهاتف: نرفع التوست فوقه ونُنزل الشريط السفلي تحته (بدل أن يطفو بمنتصف الشاشة) */
if(window.visualViewport){
  const vv=window.visualViewport;
  const syncKb=()=>{
    const kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const open=kb>80;
    document.documentElement.style.setProperty('--kb', (open?kb:0)+'px');
    document.documentElement.classList.toggle('kb-open', open);
  };
  vv.addEventListener('resize', syncKb);
  vv.addEventListener('scroll', syncKb);
}

/* تحديث تلقائي للأوقات على الصفحات الحيّة فقط (+ لوحة المالك بتحديث صامت) */
function autoRefreshActive(){ return $('#page-home')?.classList.contains('active') || $('#page-detail')?.classList.contains('active') || ($('#page-owner')?.classList.contains('active') && !!Session.owner()); }
async function refreshVisible(){
  if (document.hidden || !autoRefreshActive()) return;
  /* الإشعارات **قبل** حارس المودال وقبل الخروج المبكّر: هي أخفّ طلب في الدورة
     (خمسون صفًّا بلا انضمام) ولا تُعيد رسم شيء تحت نافذة مفتوحة — إنّما تحدّث
     رقمًا على جرس. وربطُها بحارسٍ وُضع لمنع إعادة الرسم كان سيصمتها كلّما فتح
     المستخدم نافذة، وهي اللحظة التي يطول فيها بقاؤه. */
  Notifs.load();
  Tracker.tick();
  if (document.body.classList.contains('modal-open')) return;                              // مودال مفتوح — لا تُعد الرسم تحته
  if ($('#page-owner')?.classList.contains('active')){ await refreshOwnerSilent(); return; }
  const onDetail = $('#page-detail')?.classList.contains('active');
  if (onDetail && State.detail.hour != null) return;                                       // المستخدم اختار وقتاً — لا تقاطعه
  await loadData();
  if($('#page-home').classList.contains('active')) renderPlaces();
  if(onDetail && State.detail.field){ renderDetailDays(); renderDetailTimes(); }
}
/* بصمة الحجوزات: أي إضافة أو تغيير حالة يغيّرها ⇒ نعيد الرسم فقط عند تغيّر فعلي */
const bookingsSig = (bs)=> (bs||[]).map(b=>b.row_number+':'+normStatus(b)).join('|');
/* تحديث صامت للوحة المالك: بلا تغيير تبويب ولا تمرير ولا مقاطعة —
   يعيد رسم الأقسام عند تغيّر البيانات فقط + شارة/تنبيه عند وصول طلب معلّق جديد */
async function refreshOwnerSilent(){
  if(!Session.owner() || !State.ownerData) return;
  let res; try{ res = await API.get('getOwnerData', { owner_token:Session.owner(), place_id:State.ownerPlaceId }, 'ownerPoll'); }catch(_){ return; }
  if(!res || !res.success) return;
  const oldB=State.ownerData.bookings||[], newB=res.bookings||[];
  if(bookingsSig(oldB)===bookingsSig(newB)){ State.ownerData=res; return; }
  const known=new Set(oldB.map(b=>Number(b.row_number)));
  const freshPending=newB.filter(b=>!known.has(Number(b.row_number)) && normStatus(b)==='pending').length;
  State.ownerData=res;
  /* ⚠️ **الاستطلاع يحترم نطاق التقارير كذلك.** كان يمرّر القائمة كاملةً بينما
     الرسم الأوّل يمرّر المقصوصة ⇒ رقمٌ يتبدّل وحده كل استطلاع على مالكٍ اختار
     «آخر ٣٠ يوم»، بلا أن يلمس شيئًا. مصدرٌ واحد للقصّ في الاثنين. */
  const scopedNew = reportScoped(newB);
  safeRender('stats', ()=>renderOwnerStats(scopedNew));
  safeRender('revNotes', ()=>renderOwnerRevNotes(scopedNew));
  safeRender('leak', ()=>renderOwnerLeak(scopedNew));
  safeRender('bookings', renderOwnerBookings);
  safeRender('today', renderOwnerToday);
  if(freshPending>0){
    if(State.ownerTab!=='bookings'){ State.ownerNewCount=(State.ownerNewCount||0)+freshPending; updateOwnerTabBadge(); }
    toast(t('newPendingToast',{n:freshPending}),'success');
  }
}
/* شارة عدّاد الطلبات الجديدة على تبويب «الحجوزات» — تُصفَّر عند فتح التبويب */
function updateOwnerTabBadge(){
  const tab=$('#otab-bookings'); if(!tab) return;
  let bd=tab.querySelector('.tab-badge');
  const n=State.ownerNewCount||0;
  if(!n){ if(bd) bd.remove(); return; }
  if(!bd){ bd=h('span',{class:'tab-badge','aria-hidden':'true'}); tab.append(bd); }
  bd.textContent=String(Math.min(n,99));
}
function manageAutoRefresh(){ const run=autoRefreshActive()&&!document.hidden; if(run&&!State.refreshTimer)State.refreshTimer=setInterval(refreshVisible,CONFIG.AUTO_REFRESH_MS); if(!run&&State.refreshTimer){clearInterval(State.refreshTimer);State.refreshTimer=null;} }

/* ===================== AUTH ===================== */
async function browse(){
  State.guest=true; showPage('hub'); placesSkeleton();
  await loadData(); renderPlaces();
}
async function playerLogin(btn){
  clearFieldError('playerPhone'); clearFieldError('playerPassword');
  const phone=$('#playerPhone').value.trim(), password=$('#playerPassword').value.trim();
  let bad=false;
  if(!validPhone(phone)){ setFieldError('playerPhone',t('vPhoneEmpty')); bad=true; }
  if(!password){ setFieldError('playerPassword',t('vPass')); bad=true; }
  if(bad){ focusFirstError($('#page-playerLogin')); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.get('playerLogin',{phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('loginFailRetry'),'error'); setFieldError('playerPassword', apiMsg(res.message)||t('loginBadData')); return; }
      const remember = !!$('#playerRemember')?.checked;
      Session.setOwner('') /* لا مالك */; Session.setPlayer(res.player_token, remember);
      State.player=res.player; State.guest=false;
      updatePlayerGreeting();
      Notifs.load(); Tracker.refresh();      // الجرس ولوح المتابعة يخصّان هذا الحساب لا سابقه
      if(!State.places.length){ placesSkeleton(); await loadData(); }
      /* 🔴 والمبدّل يُسأل عنه هنا صراحةً، لا داخل `loadData` وحدها.
         `sbProbeGames` لا يسأل إلّا بوجود توكن، و`updateModeSeg` لا تُنادى إلّا
         من `loadData` — والسطر أعلاه **يتخطّاها** إن كانت الأماكن محمَّلة. ومسار
         «تصفّح بدون حساب ⇒ اختر وقتًا ⇒ سجّل دخولك» هو المسار الذي يعرضه
         التطبيق نفسه: الأماكن تُحمَّل وأنت ضيف، فيبقى `GAMES_OK = null` **بقيّة
         الجلسة** ⇒ لا مبدّل «مباريات» ولا خيار «مباراة مفتوحة» إطلاقًا. مقيس. */
      await updateModeSeg();
      if(await resumePendingBooking()) return;          // استئناف حجز الضيف إن وُجد
      showPage('hub');
    }catch(_){ toast(t('connLag'),'error'); }
  });
}
async function playerRegister(btn){
  clearFieldError('regName'); clearFieldError('regPhone'); clearFieldError('regPass');
  const name=$('#regName').value.trim(), phone=$('#regPhone').value.trim(), password=$('#regPass').value.trim();
  let bad=false;
  if(!name){ setFieldError('regName',t('vName')); bad=true; }
  if(!validPhone(phone)){ setFieldError('regPhone',t('vPhone')); bad=true; }
  // نفس شرط الخادم بالضبط، معروضًا قبل الإرسال لا بعد الرفض
  if(!password){ setFieldError('regPass',t('vPass')); bad=true; }
  else if(!pwValid(password)){ setFieldError('regPass', pwChecks(password).len ? t('pwNeedMix') : t('pwShort6')); bad=true; }
  if(bad){ focusFirstError($('#page-playerRegister')); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({action:'playerRegister',name,phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('regFailRetry'),'error'); setFieldError('regPhone', apiMsg(res.message)||t('regFail')); return; }
      Session.setPlayer(res.player_token, !!$('#regRemember')?.checked); State.player=res.player; State.guest=false;
      updatePlayerGreeting();
      if(!State.places.length){ placesSkeleton(); await loadData(); }
      await updateModeSeg();          // نفس سبب `playerLogin` أعلاه بالحرف
      /* ⚠️ الحجز أوّلًا، والتأكيد بعده.
         الضيف الذي جاء من نافذة «خطوة أخيرة ويكتمل حجزك» في منتصف حجز، ووضع
         شاشةً بينه وبين الحجز يخسر الحجز نفسه — وهو ما جاء لأجله. شارةُ
         «رقم غير مؤكَّد» في «حسابي» تدعوه إلى التأكيد متى شاء. */
      if(await resumePendingBooking()) return;
      showPage('verifyPhone');
    }catch(_){ toast(t('connLag'),'error'); }
  });
}

/* ═══════════════ تأكيد رقم الهاتف ═══════════════
   ست خانات منفصلة تتصرّف كحقل واحد: الكتابة تتقدّم، والمسح يتراجع، واللصق
   يوزّع، والاكتمال يُرسِل بلا زرّ. والأرقام تُطبَّع إلى اللاتينية لأن لوحة
   المفاتيح العربية تكتب ٠-٩ بينما الكود المخزَّن لاتيني. */
const toAscii = (s) => String(s||'')
  .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
/* تعديل حقل واحد في الجلسة المخزَّنة مع **الحفاظ على مكان تخزينها**:
   `Session.setPlayer(str,true)` ينقل جلسةً مؤقّتة إلى localStorage ⇒ «تذكّرني»
   يُفعَّل خلسةً على جهاز لم يطلبه صاحبه. */
function sessionPatch(patch){
  try{
    const raw = Session.player(); if(!raw) return;
    const s = JSON.parse(raw); if(!s) return;
    Object.assign(s, patch);
    Session.setPlayer(JSON.stringify(s), !!localStorage.getItem('player_token'));
  }catch(_){}
}
const relSeconds = (n) => {
  const v = Math.max(1, Math.round(n));
  // Intl يتكفّل بالمعدود العربي (ثانية · ثانيتان · ثوانٍ) — لا نكتبه بأيدينا
  try{ return new Intl.RelativeTimeFormat(State.lang==='en'?'en':'ar', {numeric:'always'}).format(v, 'second'); }
  catch(_){ return State.lang==='en' ? `in ${v}s` : `بعد ${v} ث`; }
};

const Verify = {
  timer:0, left:0, busy:false, blocked:'', sent:false,
  cells(){ return $$('#vfCells .vf-cell'); },
  code(){ return this.cells().map(c => toAscii(c.value).replace(/\D/g,'')).join(''); },
  err(msg){
    const e=$('#vfErr'); if(!e) return;
    e.textContent = msg||''; e.hidden = !msg;
    const box=$('#vfCells'); if(!box) return;
    box.classList.remove('shake'); if(msg){ void box.offsetWidth; box.classList.add('shake'); }
  },
  clear(){ this.cells().forEach(c=>{ c.value=''; c.classList.remove('filled'); }); this.err(''); },
  focusFirstEmpty(){ const c=this.cells().find(x=>!x.value) || this.cells()[5]; if(c){ try{ c.focus(); }catch(_){} } },

  /* نصّان لا يمرّان على data-i18n لأن فيهما قيمة مُدخَلة (الرقم) أو حالة (سبب
     التعطيل)؛ applyTranslations كانت ستكتب فوقهما القالبَ الخام عند تبديل اللغة. */
  phone(){
    if(State.player && State.player.phone) return State.player.phone;
    // احتياط: الجلسة المخزَّنة تحمل الرقم أيضًا. بدونه تخرج الجملة بفجوة
    // («وأرسلناه إلى . اكتبه هنا») — وهو أسوأ من عدم ذكر الرقم أصلًا.
    try{ return (JSON.parse(Session.player()||'null')||{}).phone || ''; }catch(_){ return ''; }
  },
  syncText(){
    const sub=$('#vfSub');
    if(sub){
      /* ⚠️ م5: «أرسلنا كوداً إلى رقمك» تُكتب **بعد** أن يؤكّد الخادم الإرسال
         لا قبله. قبل ذلك (وطوال حالة «لا مزوّد») السطرُ يقول لماذا نؤكّد
         الرقم — لا يدّعي إرسالًا لم يقع. */
      if(!this.sent){ sub.textContent = t('vfWhy'); }
      else {
        const phone = this.phone();
        const parts = String(t('vfSub')).split('{phone}');
        sub.textContent = '';
        sub.append(parts[0]||'');
        // الرقم لاتيني داخل جملة عربية ⇒ يُعزَل، وإلّا زحفت النقطة بعده إلى صدره
        if(phone){ const b=document.createElement('bdi'); b.dir='ltr'; b.textContent=phone; sub.append(b); }
        sub.append(parts[1]||'');
      }
    }
    const txt=$('#vfBlockedText');
    if(txt && this.blocked) txt.textContent = t(this.blocked==='not_ready' ? 'vfNotReady' : 'vfNoProvider');
    this.paintResend();
  },
  paintResend(){
    const b=$('#vfResendBtn'); if(!b) return;
    if(this.left > 0){ b.disabled=true; b.textContent = t('vfResendIn', {rel: relSeconds(this.left)}); }
    else { b.disabled=false; b.textContent = t('vfResend'); }
  },
  stopTimer(){ if(this.timer){ clearInterval(this.timer); this.timer=0; } this.left=0; },
  startTimer(sec){
    this.stopTimer(); this.left = Math.max(0, Math.round(sec||0)); this.paintResend();
    if(!this.left) return;
    this.timer = setInterval(()=>{
      this.left--; this.paintResend();
      if(this.left <= 0) this.stopTimer();
    }, 1000);
  },
  showForm(){ this.blocked=''; $('#vfBlocked').hidden=true; $('#vfForm').hidden=false; },
  showBlocked(reason){
    this.blocked = reason || 'no_provider';
    this.stopTimer();
    $('#vfForm').hidden = true;
    const b=$('#vfBlocked'); if(b) b.hidden = false;
    this.syncText();
  },
  markVerified(){
    if(State.player) State.player.verified = true;
    sessionPatch({ verified:true });
    renderVerifyBadge();
  },
  /* ردٌّ واحد بأربعة معانٍ مختلفة — ولكلٍّ منها ما يليق به */
  applyRequest(res, silent){
    if(!res || res.success === false){
      if(res && (res.reason==='too_soon' || res.reason==='rate_limited')){
        this.showForm(); this.startTimer(res.retry_after||60);
        if(!silent) toast(apiMsg(res.message)||t('vfTooSoon'),'warn');
        return;
      }
      toast(apiMsg(res&&res.message)||t('vfFail'),'error'); return;
    }
    if(res.sent){ this.sent = true; this.showForm(); this.syncText(); this.startTimer(res.retry_after||60); if(!silent) toast(t('vfSending'),'success'); return; }
    if(res.reason==='already_verified'){ this.markVerified(); this.leave(); toast(t('vfAlready'),'success'); return; }
    this.showBlocked(res.reason);            // no_provider | not_ready
  },
  async enter(){
    this.sent = false;
    this.clear(); this.stopTimer(); this.showForm(); this.syncText();
    if(!Session.player()){ showPage('playerLogin',{redirect:true}); return; }
    try{ this.applyRequest(await API.post({action:'requestPhoneCode', player_token:Session.player()}), true); }
    catch(_){ toast(t('connLag'),'error'); }
  },
  async resend(btn){
    if(this.left > 0) return;
    await withLoading(btn, async()=>{
      try{ this.clear(); this.applyRequest(await API.post({action:'requestPhoneCode', player_token:Session.player()})); }
      catch(_){ toast(t('connLag'),'error'); }
    });
  },
  async submit(btn){
    const code = this.code();
    if(code.length < 6){ this.err(t('vfNeedAll')); this.focusFirstEmpty(); buzz(14); return; }
    if(this.busy) return; this.busy = true;
    try{
      await withLoading(btn, async()=>{
        try{
          const res = await API.post({action:'verifyPhoneCode', player_token:Session.player(), code});
          if(!res.success){
            // كودٌ محروق أو منتهٍ ⇒ الخانات تُفرَّغ، فلا يعيد إرسال ما لن ينجح
            if(res.reason==='expired' || res.reason==='too_many' || res.reason==='no_code') this.clear();
            this.err(apiMsg(res.message)||t('vfFail')); buzz(18);
            this.focusFirstEmpty(); return;
          }
          this.markVerified(); this.leave();
          showSimpleSuccess(t('vfOk'));
        }catch(_){ toast(t('connLag'),'error'); }
      });
    } finally { this.busy = false; }
  },
  /* الخروج من الشاشة: يوقف العدّاد دائمًا (مؤقّتٌ يعدّ في صفحة مخفيّة = تسريب).
     ⚠️ والوجهة ليست «رجوعًا» دائمًا: القادم من التسجيل يجد في المكدّس
     `playerRegister` — أي نموذجَ إنشاء حساب وقد صار له حساب. الرجوع يصحّ
     من «حسابي» وحدها؛ وما عداها فالرئيسة. */
  leave(){
    this.stopTimer();
    if(NavStack[NavStack.length-1] === 'account'){ navigateBack('hub'); return; }
    showPage('home', {redirect:true});
  },
};
/* شارة حالة الرقم في «حسابي» — تُخفى تمامًا حين تكون الحالة مجهولة (جلسة
   قديمة قبل ترحيل 11 لا تحمل العلَم) بدل أن تُعرَض «غير مؤكَّد» بلا دليل (م5). */
function renderVerifyBadge(){
  const b = $('#accVerifyBadge'); if(!b) return;
  const p = State.player;
  if(!p || p.verified === undefined){ b.hidden = true; return; }
  const ok = !!p.verified;
  b.hidden = false;
  b.classList.toggle('is-ok', ok);
  b.disabled = ok;
  b.textContent = ok ? t('accPhoneVerified') : `${t('accPhoneUnverified')} — ${t('accVerifyNow')}`;
}

/* ═══════════════ كلمة السرّ: الشرط مكتوب، والقوّة وصف ═══════════════
   ⚠️ الحدّ **ستّ** خانات لأن الخادم يرفض ما دونها (`playerRegister` في API.post).
   كانت النائبة تقول أربعًا، فيكتب المستخدم خمسًا ويُرَدّ بلا سبب ظاهر —
   رقمٌ واحد مختلف في مكانين كلّفه محاولةً ضائعة. المصدر هنا واحد: `PW_MIN`. */
const PW_MIN = 6;
// الأرقام الهندية (٠-٩ · ۰-۹) تُعدّ أرقامًا كما تُعدّ اللاتينية: لوحة المفاتيح
// العربية تكتبها، والخادم يعدّ المحارف لا أشكالها.
const RE_DIGIT  = /[0-9٠-٩۰-۹]/;
const RE_LETTER = /[A-Za-zء-يٱ-ۓ]/;
const pwChecks = (v) => { const s=String(v||''); return {
  len: s.length >= PW_MIN, letter: RE_LETTER.test(s), digit: RE_DIGIT.test(s) }; };
const pwValid  = (v) => { const c=pwChecks(v); return c.len && c.letter && c.digit; };
/* القوّة **لا تمنع** الإنشاء — الشروط الثلاثة وحدها تمنع. هذا مقياس يشجّع لا حارس
   يعاقب: كلمة من ثماني خانات وحرف ورقم مقبولة تمامًا وإن قال المقياس «مقبولة». */
function pwScore(v){
  const s = String(v||''); if(!s) return 0;
  let n = 0;
  if(s.length >= PW_MIN) n++;
  if(s.length >= 10) n++;
  if(RE_DIGIT.test(s) && RE_LETTER.test(s)) n++;
  if(/[^A-Za-z0-9؀-ۿ]/.test(s) || (/[a-z]/.test(s) && /[A-Z]/.test(s))) n++;
  return Math.min(4, n);
}
function renderPwFeedback(){
  const inp = $('#regPass'); if(!inp) return;
  const v = inp.value, c = pwChecks(v), score = pwScore(v);
  $$('#pwRules .pw-rule').forEach(li => li.classList.toggle('ok', !!c[li.dataset.rule]));
  const meter = $('#pwMeter');
  if(meter){
    meter.hidden = !v;
    meter.dataset.lvl = String(score);   // الشرائح تُملأ بمحدّدات nth-child على هذه القيمة
    setText('pwLvlText', v ? `${t('pwStrength')}: ${t('pwLvl'+Math.max(1,score))}` : '');
  }
}

async function ownerLogin(btn){
  const phone=$('#ownerPhone').value.trim(), password=$('#ownerPass').value.trim();
  if(!phone||!password){ toast(t('loginNeed'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.get('ownerLogin',{phone,password});
      if(!res.success){ toast(apiMsg(res.message)||t('loginFailRetry'),'error'); return; }
      Session.setOwner(res.owner_token, !!$('#ownerRemember')?.checked); State.player=null;
      Tracker.booking=null; Tracker.paint();     // لوح اللاعب لا يخصّ المالك
      showPage('owner'); await loadOwnerDashboard();
      Notifs.load(); Notifs.askPermission();     // الطلبات هي عمله — والسؤال في موضعه
    }catch(_){ toast(t('connLag'),'error'); }
  });
}
/* ---- (٣) حذف الحساب ---- */
async function deleteAccount(btn){
  if(!Session.player()){ showPage('playerLogin'); return; }
  const ok = await askConfirm(t('delAccTitle'), t('delAccMsg'), t('delAccConfirm'), t('backWord'), true);
  if(!ok) return;
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'deleteAccount', player_token:Session.player() });
      if(!res.success){ toast(apiMsg(res.message)||t('delAccFail'),'error'); return; }
      doLogout();                                   // يمسح الجلسة ويعود لشاشة الترحيب
      toast(t('delAccOk'),'success', 5200);
    }catch(_){ toast(t('delAccErr'),'error'); }
  });
}
function doLogout(){
  Session.clear(); State.player=null; State.owner=null; State.ownerData=null; State.guest=false;
  /* إشعارات الحساب السابق ولوح حجزه لا يبقيان على شاشة من خرج — والجهاز قد
     يُسلَّم لغيره. الصفوف باقية في القاعدة وتعود بعودته، وما يُمحى هنا الذاكرة. */
  Notifs.rows=[]; Notifs.missing=false; Notifs.asked=false; Notifs.paint();
  Tracker.booking=null; Tracker.paint();
  $('#nav-player').classList.remove('show'); $('#nav-owner').classList.remove('show');
  showPage('welcome');
}
async function saveAccount(btn){
  if(!Session.player()){ showPage('playerLogin'); return; }
  const name=$('#accName').value.trim(); if(!name){ toast(t('vNameAcc'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({action:'updatePlayerProfile',player_token:Session.player(),name});
      if(!res.success){ toast(apiMsg(res.message)||t('saveErr'),'error'); return; }
      State.player=res.player; updatePlayerGreeting();
      showSimpleSuccess(t('accSaved'));
    }catch(_){ toast(t('saveErr'),'error'); }
  });
}

/* ---- تغيير كلمة السرّ (لاعب أو مالك — أيّهما جلسته مفتوحة) ---- */
async function changePassword(btn){
  const isOwner = !Session.player() && !!Session.owner();
  if(!Session.player() && !Session.owner()){ showPage('playerLogin'); return; }
  const cur=$('#pwCur'), nw=$('#pwNew'), nw2=$('#pwNew2');
  const c=cur.value, n=nw.value, n2=nw2.value;
  if(!c){ toast(t('pwNeedCur'),'warn'); cur.focus(); return; }
  if(n.length < 6){ toast(t('pwTooShort'),'warn'); nw.focus(); return; }
  if(n !== n2){ toast(t('pwMismatch'),'warn'); nw2.focus(); return; }
  if(n === c){ toast(t('pwSame'),'warn'); nw.focus(); return; }
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'changePassword',
        [isOwner?'owner_token':'player_token']: isOwner?Session.owner():Session.player(),
        current_password:c, new_password:n });
      if(!res.success){ toast(apiMsg(res.message)||t('pwFail'),'error'); return; }
      // الجلسة تجدّدت بكلمة السرّ الجديدة ⇒ تُخزَّن نصًّا (نفس شكل sbSession)،
      // فلا يجد المستخدم نفسه مخرَجًا بعد نجاح العملية
      if(res.session){
        const str = JSON.stringify(res.session);
        isOwner ? Session.setOwner(str, true) : Session.setPlayer(str, true);
      }
      cur.value=nw.value=nw2.value='';
      showSimpleSuccess(t('pwOk'));
    }catch(_){ toast(t('pwFail'),'error'); }
  });
}

/* ---- booking confirm (من نافذة المراجعة · المصدر = State.detail) ---- */
async function confirmBooking(btn){
  const { place, field, date, hour } = State.detail;
  if(!place || !field || !date || hour==null){ toast(t('completeSelection'),'warn'); Modal.close('modal-booking'); scrollToDetailSection('time'); return; }
  // ضيف؟ احفظ الاختيار وافتح خيار الدخول (تظهر المراجعة بعد الدخول)
  if(!Session.player()){ savePendingBooking(); openAuthChoice(); return; }
  const name=(State.player?.name||'').trim(), phone=(State.player?.phone||'').trim();
  // فحص محلي فوري بلا انتظار شبكة — الخادم هو الحكم النهائي (LockService) ويردّ برسالة تعارض إن حدث سباق
  const takenNow=(State.bookedSlots[field.field_id]?.[date])||[];
  if(takenNow.includes(Number(hour))){
    Modal.close('modal-booking'); State.detail.hour=null; renderDetailTimes(); renderDetailSticky();
    toast(t('bookingConflict'),'warn');
    scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)'); return;
  }
  // أُغلقت الخانة بين العرض والضغطة (ترحيل 17). الحارس في القاعدة يمنع إغلاقًا
  // يبتلع حجزًا **مؤكّدًا** لا طلبًا لم يُرسَل بعد، فالفحص هنا ليس زائدًا.
  if(slotClosure(field.field_id, date, Number(hour))){
    Modal.close('modal-booking'); State.detail.hour=null; renderDetailTimes(); renderDetailSticky();
    toast(t('slotClosedNow'),'warn'); return;
  }
  const slot=fieldSlots(field).find(s=>s.hour===hour);
  const shown=slotPrice(field, date, hour);
  // نوع المباراة — والتحقّق قبل الإرسال لا بعد ردّ القاعدة
  let vis='private', need=null, got=null;
  if(GAMES_OK === true && State.gmVis==='open'){
    need=Number($('#gmNeeded').value); got=Number($('#gmBrought').value);
    if(!(need>=2) || !(got>=1) || got>need){ toast(t('gmLiveBad'),'warn'); return; }
    vis='open';
  }
  let sent = null;
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'createBooking', player_token:Session.player(), date, place_id:place.place_id, place_name:place.place_name, field_id:field.field_id, field_name:field.field_name, city:place.city, time:slot.label, hour, name, phone, players:field.size, price:shown, source:getSource(),
        visibility:vis, needed:need, brought:got });
      if(!res.success){ toast(apiMsg(res.message)||t('bookingFailRetry'),'error'); await loadData(); return; }
      /* ⚠️ الخادم هو من يكتب السعر (‏`t_booking_price` في ترحيل 18)، ونحن
         نعرض ما حسبناه. وإن اختلفا — قاعدة تسعير تغيّرت بين فتح الشاشة
         والضغطة — **يُقال ذلك**، لأن الرقم الذي يدفعه هو رقم الخادم لا رقمنا. */
      if(res.price != null && Number(res.price) !== Number(shown)){
        toast(t('priceChanged',{ from: formatCurrency(shown), to: formatCurrency(res.price) }), 'warn', 6000);
      }
      Track.push(EV.BOOKING_SUBMITTED, { place_id:String(place.place_id), hour:Number(hour) });
      (State.bookedSlots[field.field_id] ||= {})[date] ||= []; State.bookedSlots[field.field_id][date].push(hour);
      /* السعر يُمرَّر صراحةً: الخادم أوّلًا (وهو صاحب الحقيقة) ثمّ المعروض.
         ومعه حالة النشر، وإلّا بقي الإيصال يعِد ضمنًا بما لم يقع. */
      /* ⚠️ **لا يُكتب على الزرّ من داخل `withLoading`**: هي تُعيد `innerHTML`
         في `finally` فتمحو كلَّ ما كُتب (مزلق مسجَّل). فالعلَم يخرج من هنا،
         والحالة النهائية تُكتب بعد انتهائها. */
      sent = { price: (res.price != null ? Number(res.price) : shown), id: res.booking_id };
    }catch(_){ toast(t('bookingConnLag'),'error'); }
  });
  if(!sent) return;
  /* الزرّ يقول «تمّ» **بعد** جواب الخادم لا قبله (م5)، ثمّ تُغلَق الورقة. */
  await btnDone(btn);
  Modal.close('modal-booking');
  showBookingSuccess({ place, field, date, hour, price: sent.price,
                       visibility: vis, needed: need, brought: got }, sent.id);
  if($('#page-detail').classList.contains('active')){ State.detail.hour=null; renderDetailDays(); renderDetailTimes(); renderDetailSticky(); }
  Tracker.refresh();          // اللوح يظهر على الشبكة فور إرسال الطلب لا بعد دورة
  /* لحظة طلب الإذن: الطلب أُرسل للتوّ وينتظر ردًّا، فالسؤال «أنُعلمك حين
     يردّون؟» جوابه أمام عينه. طلبُه عند الإقلاع يُرفَض ثمّ لا يعود أندرويد
     يسمح بطرحه — والرفض حينها رفضٌ لسؤال لم يُفهَم بعد. */
  Notifs.askPermission();
}
async function submitReview(btn){
  if(!State.review.rating){ toast(t('reviewNeed'),'warn'); return; }
  const id=State.review.placeId;
  await withLoading(btn, async()=>{
    try{
      const res=await API.post({ action:'createReview', place_id:id, field_id:State.detail.field?.field_id||'', user_name:$('#rvName').value.trim(), phone:$('#rvPhone').value.trim(), rating:State.review.rating, comment:$('#rvComment').value.trim() });
      if(!res.success){ toast(apiMsg(res.message)||t('reviewFail'),'error'); return; }
      Modal.close('modal-review', true); showSimpleSuccess(t('reviewOk'));
      await loadData({force:true});
      const updated=State.places.find(p=>String(p.place_id)===id); if(updated&&State.detail.place){ State.detail.place=updated; if($('#dBadges')&&$('#page-detail').classList.contains('active')){ renderDetailBadges(updated); renderPlaceStats(); } }
    }catch(_){ toast(t('reviewErr'),'error'); }
  });
}
async function saveManual(btn){
  const f=manualField(); const name=$('#mName').value.trim(), phone=$('#mPhone').value.trim(), price=Number($('#mPrice').value||0);
  if(!f||!State.manual.date||State.manual.hour===null){ toast(t('manualNeed'),'warn'); return; }
  if(!name){ toast(t('manualName'),'warn'); return; }
  if(!price||Number.isNaN(price)){ toast(t('manualPrice'),'warn'); return; }
  const slot=fieldSlots(f).find(s=>s.hour===State.manual.hour);
  const weeks=Math.max(1, Math.min(12, Number($('#mRepeat')?.value||1)||1));
  await withLoading(btn, async()=>{
    try{
      if(weeks===1){
        const res=await API.post({ action:'ownerCreateManualBooking', owner_token:Session.owner(), field_id:f.field_id, date:State.manual.date, hour:State.manual.hour, time:slot?slot.label:'', name, phone, players:f.size, price });
        if(!res.success){ toast(apiMsg(res.message)||t('manualFail'),'error'); await loadPublicBookings().catch(()=>{}); renderManualTimes(); return; }
        Modal.close('modal-manual', true); toast(t('manualOk'),'success');
        await loadOwnerDashboard(); await loadData({force:true});
        return;
      }
      // تكرار أسبوعي: تحقّق طازج مرة واحدة، ثم استدعاءات متتابعة بنفس الـAPI مع تخطّي الأوقات المحجوزة
      try{ await loadPublicBookings(); }catch(_){}
      let added=0, skipped=0;
      for(let w=0; w<weeks; w++){
        const d0=new Date(`${State.manual.date}T12:00:00`); d0.setDate(d0.getDate()+7*w); const dt=ymd(d0);
        const takenArr=(State.bookedSlots[f.field_id]?.[dt])||[];
        if(takenArr.includes(Number(State.manual.hour))){ skipped++; continue; }
        try{
          const res=await API.post({ action:'ownerCreateManualBooking', owner_token:Session.owner(), field_id:f.field_id, date:dt, hour:State.manual.hour, time:slot?slot.label:'', name, phone, players:f.size, price });
          if(res.success){ added++; ((State.bookedSlots[f.field_id] ||= {})[dt] ||= []).push(Number(State.manual.hour)); }
          else skipped++;
        }catch(_){ skipped++; }
      }
      Modal.close('modal-manual', true);
      toast(t('repeatSummary',{added, skipped}), added>0?'success':'error', 5200);
      await loadOwnerDashboard(); await loadData({force:true});
    }catch(_){ toast(t('manualErr'),'error'); }
  });
}
async function saveField(btn){
  const field_id=$('#fieldId').value, field_name=$('#fieldName').value.trim(), size=$('#fieldSize').value.trim();
  const price=Number($('#fieldPrice').value), slots=$('#fieldSlots').value, active=$('#fieldActive').checked;
  if(!field_name||!size||!price){ toast(t('fieldNeed'),'warn'); return; }
  await withLoading(btn, async()=>{
    try{
      const payload=State.editingField==='add'
        ? { action:'ownerAddField', owner_token:Session.owner(), field_name, size, price, slots }
        : { action:'ownerUpdateField', owner_token:Session.owner(), field_id, price, slots, active };
      const res=await API.post(payload);
      if(!res.success){ toast(apiMsg(res.message)||t('fieldFail'),'error'); return; }
      Modal.close('modal-field', true); try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){}
      await loadOwnerDashboard(); await loadData({force:true}); toast(t('fieldOk'),'success');
    }catch(_){ toast(t('fieldErr'),'error'); }
  });
}

/* ===================== THEME ===================== */
/* رسم أيقونة الثيم: **مسار واحد** يُبدَّل شكله — لا عنصران متراكبان.
   الشمس مرسومة كاملةً داخل نفس السمة `d` (قرص بقوسين + ثمانية أشعّة). */
const THEME_ICON = {
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  sun :'M12 7.9a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 1 0 0-8.2M12 2.6v2.1M12 19.3v2.1'
      +'M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5'
};
function applyTheme(theme){
  const dark = theme==='dark';
  document.body.classList.toggle('dark', dark);
  const d = dark ? THEME_ICON.sun : THEME_ICON.moon;
  // ‏`themePick` هو بند قائمة فائض المالك — نفس الفعل باسمٍ آخر (انظر `Actions`)،
  // ويحتاج تبديلَ المسار نفسه وإلّا بقيت أيقونته على شكلٍ لا يصف الوضع الحالي.
  $$('[data-action="toggleTheme"],[data-action="themePick"]').forEach(b=>{
    b.classList.toggle('is-dark', dark);
    const p = b.querySelector('.thm-ic-path');
    if(p && p.getAttribute('d') !== d){
      p.setAttribute('d', d);
      // إعادة تشغيل دوران الدخول (بلا الحذف+reflow لا تُعاد الحركة عند تبديلين متتاليين)
      b.classList.remove('thm-pop'); void b.offsetWidth; b.classList.add('thm-pop');
    }
  });
  const meta=$('meta[name="theme-color"]'); if(meta) meta.setAttribute('content', dark?'#081D22':'#FAFAF7');
}
/* ══════════════════════════════════════════════════════════════════════
   تبديل الثيم — كشف دائري من الزرّ المضغوط، بمسارين.

   ① **View Transitions** (الأساسي): المتصفّح يلتقط لقطتَي «قبل» و«بعد»، فنُبقي
      لقطة «قبل» ساكنة تحت ونقصّ لقطة «بعد» بدائرة تكبر من الإصبع. النتيجة أن
      **الواجهة الجديدة بمحتواها الحقيقي** هي ما ينتشر — فلا تُغطّى الشاشة بلون
      مصمت ولا تختفي المحتويات لحظةً. (هذا ما كان ينقص القرص المصمت.)
   ② **قرص مصمت احتياطي** لأي WebView بلا الـAPI — يغطّي لكنه لا يكسر شيئًا.

   ⚠️ لا يُستعمل المحدّد الشامل `*` لإيقاف الانتقالات هنا إطلاقًا: إبطال أنماط
   كل عقدة في الشجرة كان سبب التلعثم سابقًا. الإيقاف محصور بقائمة الوسوم
   الحاملة لانتقال الثيم، ولحظةَ التقاط اللقطة الجديدة فقط.
   ══════════════════════════════════════════════════════════════════════ */
const THEME_BG = { light:'#F4F5F6', dark:'#0A0E11' };   // = --bg-primary في كل ثيم (الجزء 1 من app.css)
/* قفل **مشترك** بين تبديل الثيم وتبديل اللغة: المتصفّح لا يشغّل انتقالَي جذر معًا —
   بدء الثاني **يُلغي** الأوّل فورًا (`vt.skipTransition` ضمنيًّا) فيُقرأ الإلغاء وميضًا.
   قفل واحد لكليهما ⇒ الضغطة الثانية أثناء انتقال جارٍ تُبدَّل فورًا بلا حركة، لا تُبتلع. */
let vtBusy = false;
/* ⚠️ انتقال الثيم صار مشروطًا بـ`html.theming` (‏app.css) ⇒ يلزم رفع الصنف حول
   لحظة التبديل. وإجبار الـreflow بين الرفع والتبديل **ليس زينة**: بلا قراءةٍ
   تُجبر التخطيط يضمّ المتصفّح العمليتين في إطارٍ واحد فلا تُوجَد حالة «قبل»
   ولا ينتقل شيء أصلًا.
   ⚠️ والإزالة بـ`setTimeout` وحده لا `transitionend`: الأخير يُطلَق مرّةً **لكل
   خاصّية لكل عنصر** (ستّ خاصّيات × مئات العقد)، وإزالة الصنف عند أوّلها تقع
   قبل انتهاء الباقي ⇒ نصف الشاشة ينتقل ونصفها يقفز. */
const THEME_MS = 450;
let themingTimer = null;
function withThemeTransition(commit){
  const root = document.documentElement;
  root.classList.add('theming');
  void root.offsetHeight;
  commit();
  clearTimeout(themingTimer);
  themingTimer = setTimeout(()=>root.classList.remove('theming'), THEME_MS + 60);
}
function toggleTheme(btn, e){
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  const commit = ()=>{ Session.setTheme(next); applyTheme(next); };
  let reduce=false; try{ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){}
  const r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : null;
  /* تقليل الحركة ⇒ تبديل **فوري بلا انتقال**. وهذا تحسّنٌ جانبي مقصود: القاعدة
     غير المشروطة كانت تُبقي تلاشي 450ms حتى لمن طلب تقليل الحركة. */
  if(reduce){ commit(); return; }
  // بلا زرّ صالح · بلا WAAPI · نقرة أثناء كشف جارٍ ⇒ بلا كشف دائري، والانتقال اللوني يبقى
  if(vtBusy || !r || !r.width || typeof Element.prototype.animate !== 'function'){
    withThemeTransition(commit); return;
  }
  const cx = r.left + r.width/2, cy = r.top + r.height/2;

  // ① الكشف الحقيقي للمحتوى
  if(typeof document.startViewTransition === 'function'){
    const root = document.documentElement;
    let vt = null;
    try{
      vtBusy = true;
      // مركز التفتّح = موضع الزرّ (نسبةً لا بكسلًا كي يصمد مع أي مقاس شاشة)
      root.style.setProperty('--vt-ox', (cx/innerWidth*100).toFixed(2)+'%');
      root.style.setProperty('--vt-oy', (cy/innerHeight*100).toFixed(2)+'%');
      root.classList.add('vt-theme','theming');   // الانتقال اللوني مشروط بالصنف الثاني
      vt = document.startViewTransition(()=>{
        // تُلتقط لقطة «بعد» هنا: نوقف انتقالات اللون لحظتَها كي تُلتقط بألوانها
        // النهائية لا في منتصف تحوّل (الإيقاف محصور بقائمة الوسوم).
        // ⚠️ جُرّب إبقاء الحارس مرفوعًا طوال الانتقال بدل reflow واحد — بلا أي
        //    فرق في الإطارات الساقطة (12 و9 قبل وبعد). انظر تعليق `.theme-swap`
        //    في app.css: السبب ما زال غير محسوم ويحتاج تنميطًا.
        root.classList.add('theme-swap');
        commit();
        void document.body.offsetWidth;
        root.classList.remove('theme-swap');
      });
    }catch(_){ root.classList.remove('vt-theme','theme-swap'); vtBusy = false; vt = null; }
    if(vt){
      /* `theme-swap` تُرفع في المسار العادي داخل الاستدعاء أعلاه؛ ورفعها هنا
         أيضًا شبكة أمان: لو أخفق الاستدعاء بعد إضافتها لبقيت الواجهة بلا
         انتقالات للأبد. */
      const done = ()=>{ root.classList.remove('vt-theme','theme-swap','theming'); vtBusy = false; };
      vt.ready.then(()=>{
        // تفتّح ناعم: اللقطة الجديدة تظهر وهي تستقرّ من تكبير طفيف عند الإصبع.
        // `opacity`+`transform` فقط ⇒ الحركة كلّها على الـGPU، صفر رسم في كل فريم.
        // منحنى بلا تسارع في البداية (ease-out خالص) فيُقرأ التبديل فوريًّا ثم يهدأ.
        root.animate({opacity:[0,1], transform:['scale(1.045)','scale(1)']},
          {duration:560, easing:'cubic-bezier(.22,.61,.36,1)',
           pseudoElement:'::view-transition-new(root)'});
      }).catch(()=>{});
      vt.finished.then(done, done);
      // شبكة أمان: لو لم تُحسم وعود الانتقال (بيئة تجمّد الأنيميشن مثلًا)
      // يُحرَّر القفل فلا تُبتلع ضغطة المستخدم التالية.
      setTimeout(done, 950);
      buzz(8);
      return;
    }
  }
  // ② الاحتياطي: قرص مصمت
  vtBusy = true;
  document.documentElement.classList.add('theming');
  void document.documentElement.offsetHeight;
  clearTimeout(themingTimer);
  themingTimer = setTimeout(()=>document.documentElement.classList.remove('theming'), THEME_MS + 60);
  const x = r.left + r.width/2, y = r.top + r.height/2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const wrap = document.createElement('div'); wrap.className = 'theme-reveal';
  const disc = document.createElement('div'); disc.className = 'theme-reveal-disc';
  disc.style.width = disc.style.height = (2*R).toFixed(0)+'px';
  disc.style.left = (x-R).toFixed(1)+'px'; disc.style.top = (y-R).toFixed(1)+'px';
  disc.style.background = THEME_BG[next];
  wrap.appendChild(disc); document.body.appendChild(wrap);
  buzz(8);
  let done = false;
  const finish = ()=>{
    if(done) return; done = true;
    // التبديل والقرص يغطّي الشاشة: نوقف انتقالات اللون لحظةً كي تُكشف الواجهة
    // بثيمها النهائي لا في منتصف تحوّل (الإيقاف محصور بقائمة الوسوم لا بـ`*`).
    document.documentElement.classList.add('theme-swap');
    commit();
    void document.body.offsetWidth;                       // إلزام إعادة تدفّق قبل رفع الإيقاف
    document.documentElement.classList.remove('theme-swap');
    // كشف سريع: القرص بلون خلفية الثيم الجديد أصلًا، فما «يظهر» أثناء التلاشي هو
    // المحتوى فوق خلفية مطابقة — لا شاشة فارغة. 130ms تكفي لتُقرأ كظهور لا كوميض.
    const out = disc.animate([{opacity:1},{opacity:0}],
      {duration:200, easing:'cubic-bezier(.22,.61,.36,1)', fill:'forwards'});
    const drop = ()=>{ wrap.remove(); vtBusy = false; };
    out.onfinish = drop; setTimeout(drop, 380);            // شبكة أمان لو لم يُطلق الحدث
  };
  // منحنى ينهي التغطية بسرعة في آخره ⇒ زمن «الشاشة مغطّاة بالكامل» أقصر ما يمكن.
  // 380ms بدل 340: مع إيقاف انتقالات اللون صارت الواجهة تحته جاهزة فورًا،
  // فالزمن الإضافي يذهب كلّه إلى نعومة الحركة لا إلى انتظار تحوّل الألوان.
  const grow = disc.animate([{transform:'scale(0)'},{transform:'scale(1)'}],
    {duration:380, easing:'cubic-bezier(.32,0,.16,1)', fill:'forwards'});
  grow.onfinish = finish;
  setTimeout(finish, 520);                                 // شبكة أمان: لا يبقى قرص عالقًا أبدًا
}

/* ===================== I18N RUNTIME (تطبيق الترجمة + تبديل اللغة) ===================== */
function applyTranslations(root){
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el=>{ const v=t(el.getAttribute('data-i18n')); if(v!=null) el.textContent=v; });
  r.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  r.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  r.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  r.querySelectorAll('[data-i18n-alt]').forEach(el=>{ el.setAttribute('alt', t(el.getAttribute('data-i18n-alt'))); });
  if(r===document) document.title = t('docTitle');   // عنوان المستند
}
/* مدقّق تكافؤ المفاتيح (وقت التطوير فقط) — يُحذّر بالكونسول دون تعطيل التطبيق */
function validateI18nParity(){
  try{
    const ar=Object.keys(I18N.ar||{}), en=Object.keys(I18N.en||{});
    const setAr=new Set(ar), setEn=new Set(en);
    const missingEn=ar.filter(k=>!setEn.has(k)), missingAr=en.filter(k=>!setAr.has(k));
    if(missingEn.length) console.warn('[i18n] keys missing in EN:', missingEn);
    if(missingAr.length) console.warn('[i18n] keys missing in AR:', missingAr);
  }catch(_){}
}
function setLanguage(lang){
  if(lang!=='ar' && lang!=='en') lang='ar';
  State.lang = lang;
  try{ localStorage.setItem('mustadaira_language', lang); }catch(_){}
  const html=document.documentElement; html.lang=lang; html.dir = lang==='ar'?'rtl':'ltr';
  applyTranslations(document);
  /* 🔴 **لا تُتلف زرًّا مركَّبًا.** كان السطر يكتب `textContent` على **كل** زرّ
     لغة، وبند اللغة في قائمة فائض المالك زرٌّ فيه أيقونةٌ وتسمية ⇒ يُمحى
     الاثنان ويحلّ محلّهما «EN» عارية: سطرٌ بلا أيقونة ولا اسم بين سطرين
     كاملين — وهو نصفُ ما شكا منه المالك في شكل القائمة. الزرّ العاري (شاشة
     الترحيب · «حسابي») يبقى كما كان، والمركَّب تُكتب قيمتُه في خانتها. */
  $$('[data-action="toggleLang"]').forEach(b=>{
    if(b.childElementCount) return;
    b.textContent = t('langSwitch');
  });
  // أعد رسم المحتوى الديناميكي للصفحة النشطة دون فقد الحالة/الجلسة/الفلاتر
  try{
    renderSportTabs(); renderSportDropdown(); updateSportSections(); renderRegionTabs(); updateFilterBar(); updateTrust();
    HeroPh.sync();   // كلمات النائب المتحرّك تتبع اللغة — ويُلغى المؤقّت القديم فلا يتراكم
    // ترجمة سطر الترحيب حسب حالة الجلسة (ضيف/مسجّل) دون كسر التخصيص
    updatePlayerGreeting();
    /* ⚠️ نصُّ الشبكة **مركَّبٌ من معطيات** (عدد المباريات · التحية) فلا يمسّه
       `data-i18n`: مبدّل اللغة يترجم الوسوم الحاملة للسمة وحدها، وما بُني في
       JS يبقى بلغة لحظة بنائه إلى الجلبة التالية. مقيس: البطاقة بقيت عربيّة
       في الإنجليزية. (مزلق مسجَّل، ونفس علاج `Notifs.paint`.) */
    if($('#page-hub')?.classList.contains('active')) renderHub();
    if($('#page-home')?.classList.contains('active')) renderPlaces();
    if($('#page-detail')?.classList.contains('active') && State.detail.place){ renderDetailBadges(State.detail.place); renderAmenitiesFull(State.detail.place); renderSubFields(); renderDetailHero(); renderDetailDays(); renderDetailTimes(); renderDetailSticky(); if(State.detail.field) setText('dPrice', formatCurrency(State.detail.field.price)); }
    if($('#page-bookings')?.classList.contains('active')) loadPlayerBookings();
    // نصوص تحمل قيمة أو حالة ⇒ خارج data-i18n، فتُعاد بناءً هنا (انظر Verify.syncText)
    renderPwFeedback(); renderVerifyBadge();
    /* الإشعارات ولوح المتابعة يُكتب نصّهما من معطيات لا من `data-i18n` (النوع +
       المكان + الموعد)، فلا يمسّهما تبديل اللغة إلّا بإعادة بنائهما.
       ⚠️ مقيس: بدون هذين السطرين يبقى اللوح إنجليزيًّا بعد الرجوع إلى العربية
          — ونصُّه مكتوبٌ منذ آخر جلبة، فلا شيء يعيد كتابته حتى الجلبة التالية. */
    Notifs.paint(); Tracker.paint();
    if($('#page-verifyPhone')?.classList.contains('active')) Verify.syncText();
    if($('#page-owner')?.classList.contains('active') && State.ownerData) renderOwnerDashboard();
    // نصوص التبويبات تغيّرت ⇒ عروض الأزرار تغيّرت. قفزة لا انزلاق: الحبّة
    // تتبع كلمةً صار مكانها في الطرف المقابل، فالانزلاق عبر الشريط بلا معنى.
    NavPill.schedule(true);
  }catch(_){}
}
/* ══════════════════════════════════════════════════════════════════════
   تبديل اللغة — تلاشٍ متقاطع فوق قلب الاتجاه.

   ما الذي يُعالَج فعلًا: `setLanguage` تقلب `dir` على `<html>` ثم تُعيد ترجمة
   المستند كلّه وترسم محتوى الصفحة النشطة من جديد. الشغل نفسه **متزامن**، فلا
   يراه المستخدم تدرّجًا — يراه **قطعًا حادًّا** بين تخطيطين متعاكسين في فريم
   واحد. ⚠️ فالانتقال هنا لا يجعل التبديل أسرع (لا شيء يجعله أسرع، المهمّة
   متزامنة بطبعها)، بل يستبدل بالقطعة الحادّة ذوبانًا يُقرأ كتحوّل مقصود.

   ① **View Transitions** (الأساسي): لقطة «قبل» تبقى ساكنة تحت، ولقطة «بعد»
      بتخطيطها المعكوس تتلاشى فوقها. `opacity`+`transform` وحدهما ⇒ صفر رسم
      في كل فريم بعد التقاط اللقطتين.
   ② **حجاب احتياطي** لأي WebView قبل Chrome 111.

   ⚠️ لماذا **لا** `opacity` على `#app` كاحتياطي: أي عنصر بـ`opacity<1` يصير
   **الكتلة الحاوية** لأبنائه `position:fixed`. و`.bnav` و`.detail-sticky`
   و`.ptr` أبناء مباشرون لـ`#app`، و`#app` طوله طول المستند كلّه ⇒ `bottom:0`
   يقفز من أسفل **الشاشة** إلى أسفل **الصفحة**: شريط التنقّل يطير خارج الرؤية
   طوال التلاشي. والعطل يظهر على الأجهزة القديمة وحدها (مسار الاحتياطي) فينجو
   من الفحص. الحجاب عنصر مستقلّ على `body` ⇒ لا يمسّ الكتلة الحاوية لأحد.
   ══════════════════════════════════════════════════════════════════════ */
function toggleLang(){ switchLanguage(State.lang==='ar'?'en':'ar'); }
function switchLanguage(lang){
  if(lang===State.lang) return;
  let reduce=false; try{ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){}
  // حارس: تقليل حركة · انتقال جذر جارٍ · بلا WAAPI ⇒ تبديل فوري (لا ابتلاع للضغطة)
  if(reduce || vtBusy || typeof Element.prototype.animate !== 'function'){ setLanguage(lang); return; }

  if(typeof document.startViewTransition === 'function'){
    const root = document.documentElement;
    let vt = null;
    try{
      vtBusy = true;
      root.classList.add('vt-lang');
      // الاستثناء يُبتلع داخل الردّ: لو رمى `setLanguage` لسبب ما، وجب أن يُكمل
      // الانتقالُ دورتَه ويُرفع القفل — وإلّا بقيت الشاشة على اللقطة القديمة.
      vt = document.startViewTransition(()=>{ try{ setLanguage(lang); }catch(_){} });
    }catch(_){ root.classList.remove('vt-lang'); vtBusy = false; vt = null; }
    if(vt){
      const done = ()=>{ root.classList.remove('vt-lang'); vtBusy = false; };
      vt.finished.then(done, done);
      if(vt.updateCallbackDone) vt.updateCallbackDone.catch(()=>{});
      setTimeout(done, 900);   // شبكة أمان: بيئة تجمّد الأنيميشن لا تحسم الوعود
      buzz(6);
      return;
    }
  }
  // ② الحجاب الاحتياطي
  vtBusy = true;
  const veil = document.createElement('div');
  veil.className = 'lang-veil';
  veil.style.background = document.body.classList.contains('dark') ? THEME_BG.dark : THEME_BG.light;
  document.body.appendChild(veil);
  buzz(6);
  let swapped = false;
  const swap = ()=>{
    if(swapped) return; swapped = true;
    try{ setLanguage(lang); }catch(_){}
    const out = veil.animate([{opacity:1},{opacity:0}],
      {duration:190, easing:'cubic-bezier(.22,.61,.36,1)', fill:'forwards'});
    const drop = ()=>{ veil.remove(); vtBusy = false; };
    out.onfinish = drop; setTimeout(drop, 330);
  };
  const cover = veil.animate([{opacity:0},{opacity:1}],
    {duration:110, easing:'cubic-bezier(.4,0,1,1)', fill:'forwards'});
  cover.onfinish = swap; setTimeout(swap, 240);   // شبكة أمان: المعاينة تجمّد WAAPI فلا يُطلق onfinish
}

/* ===================== EVENT DELEGATION ===================== */
/* ═══ علامةُ النجاح على الزرّ ═════════════════════════════════════════════
   الزرّ كان يبقى محمَّلًا حتى تختفي الورقة تحته — لحظةٌ تُقرأ تعليقًا لا نجاحًا.
   الآن يقول «تمّ» بعلامةٍ داخله قبل الإغلاق بـ`400ms`.
   ⚠️ **ولا يُنادى إلّا بعد نجاحٍ مؤكَّد**: علامةٌ تسبق الجواب هي بالضبط ما
      تمنعه م5 — وعدٌ بما لم يقع بعد.
   ⚠️ و«تقليل الحركة» لا يُلغيها: هي **حالة** لا زخرفة، والانتظار وحده يُلغى. */
function btnDone(btn, label){
  if(!btn) return Promise.resolve();
  btn.classList.add('is-done');
  clear(btn);
  btn.append(h('span',{class:'btn-check','aria-hidden':'true'}), label || t('successDone'));
  buzz(10);
  return new Promise(res => setTimeout(res, 400));
}
const Actions = {
  browse, playerLogin, playerRegister, ownerLogin, logout:doLogout, saveAccount, changePassword, toggleTheme, toggleLang,
  /* 🔴 **اسمان آخران للفعلين نفسيهما — والسبب بنيويّ لا تجميلي.**
     `[data-action="toggleTheme"]` يحمل حارس «الشمسين» (‏app.css §الحارس):
     `> :not(.thm-ic){display:none!important}` مع `font-size:0!important`،
     وهو حارسٌ صحيح لزرٍّ **أيقونته كلُّ محتواه**. لكنّ بند القائمة صفٌّ فيه
     أيقونةٌ وتسميةٌ وقيمة ⇒ كان الحارس يمحو تسميته وقيمته فيظهر أيقونةً
     عارية. و`toggleLang` كان يُكتب عليه `textContent` فيمحو الاثنين كذلك.
     وإضعاف الحارس باستثناءات يفتح البابَ الذي أُغلق بعد خمس دفعات من العطل،
     فالأصحّ أن يخرج البندُ من نطاقه: **نفس الدالّة، اسمُ فعلٍ آخر.** */
  themePick:(btn,e)=>toggleTheme(btn,e), langPick:(btn,e)=>toggleLang(btn,e),
  deleteAccount, dismissOffline:()=>Offline.hide(),
  search:()=>renderPlaces(),
  openFilters, applyFilters, clearFiltersSheet,
  openBooking: ()=>openBookingReview(),
  /* نفس النافذة ونفس الحقول — الفرق أنّ «مفتوحة» مختارة سلفًا. ولو كان
     ترحيل 22 معلَّقًا لما ظهر الزرّ أصلًا، والحارس هنا مكرّر عمدًا: زرٌّ ظهر
     بشرطٍ يجب أن يُفحَص ثانيةً عند الضغط لا أن يُفترَض. */
  openBookingAsGame: ()=>openBookingReview(true),
  changeTime:()=>{ Modal.close('modal-booking'); scrollToDetailSection('time','#detailDays .day-btn'); },
  openReview, confirmBooking, submitReview,
  authLogin:()=>{ Modal.close('modal-authchoice'); showPage('playerLogin'); },
  authRegister:()=>{ Modal.close('modal-authchoice'); showPage('playerRegister'); },
  verifyPhone:(btn)=>Verify.submit(btn), resendCode:(btn)=>Verify.resend(btn),
  vfContinue:()=>Verify.leave(), goVerify:()=>showPage('verifyPhone'),
  openManual, saveManual, addField:openAddField, saveField, saveReschedule,
  saveClosure, addPriceRule,
  setMode:(btn)=>setMode(btn.dataset.mode||'venues'),
  visPick:(btn)=>setVisPick(btn.dataset.vis||'private'),
  confirmJoin, saveMatch, closeMatchSeats, makeMatchPrivate,
  clearFilters:()=>{ $('#ownerDateFilter').value=''; $('#ownerFieldFilter').value='all'; const st=$('#ownerStatusFilter'); if(st)st.value='all'; const se=$('#ownerSearch'); if(se)se.value=''; renderOwnerBookings(); },
  refreshOwner:loadOwnerDashboard, toggleOwnerHistory:()=>{ State.showAllOwner=!State.showAllOwner; renderOwnerBookings(); },
  /* شريطُ «ردّ الآن» وخانةُ «بانتظار ردّك» يقودان إلى **نفس** الموضع: أوّل
     بطاقة معلّقة — بابان بارتفاعين لا وجهتان.
     ⚠️ وإن كان المعروض هو المخطّط فالبطاقات غير مرسومة أصلًا، فيُبدَّل
        الشكل **بلا حفظ** (`applyOwnerView` لا `setOwnerView`): ضغطةٌ على «ردّ
        الآن» ليست تغييرًا لتفضيل العرض، ولا يجوز أن تُكتب فوق اختيار المالك. */
  ownerGoPending:()=>{
    showOwnerTab('today');
    if(State.ownerView==='timeline') applyOwnerView('cards');
    const el=$('#ownerToday .booking-strip.pending') || $('#ownerToday');
    if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  },
  exportCsv:(btn)=>ownerExportCsv(btn),
  /* بطاقة «مباريات» في الشبكة تفتح **نفس** صفحة التصفّح في وضع المباريات، لا
     صفحةً ثالثة: القائمة والمبدّل موجودان هناك أصلًا، ونسخةٌ ثانية منهما
     تنحرف عن الأولى عند أوّل تعديل. */
  hubGames:()=>{ showPage('home'); setMode('games'); },
  /* ملاعب السيدات: **نفس** صفحة الملاعب و**نفس** مرشِّح الجنس في `State.fx` —
     لا قائمة ثانية ولا حالة ثانية. والشريحة تظهر في صفّ الفلاتر المفعّلة
     فيراها المستخدم ويستطيع رفعها من حيث يرفع أيّ مرشِّح. */
  hubWomen:()=>{
    if(!womenVenues()){ buzz(8); toast(t('hubSoon_women'),'warn'); return; }
    State.fx.genders = ['women'];
    showPage('home');
    updateFilterBar(); renderFilterChips(); renderPlaces();
  },
  refreshAiInsights:()=>loadAiInsights(true), refreshAiReviews:()=>loadAiReviews(true), refreshAiWeather:()=>loadAiWeather(true),
  calPrev:()=>{ if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00'); State.calMonth=new Date(State.calMonth.getFullYear(), State.calMonth.getMonth()-1, 1); renderOwnerCalendar(); },
  calNext:()=>{ if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00'); State.calMonth=new Date(State.calMonth.getFullYear(), State.calMonth.getMonth()+1, 1); renderOwnerCalendar(); },
  closeModal:()=>Modal.close(), closeSuccess:()=>{ Modal.close('success'); renderPlaces(); },
  lbPrev:()=>Lightbox.nav(-1), lbNext:()=>Lightbox.nav(1),
  togglePass:(btn)=>{ const wrap=btn.closest('.input-wrap'); const inp=wrap&&wrap.querySelector('input'); if(!inp) return; const show=inp.type==='password'; inp.type=show?'text':'password'; btn.classList.toggle('is-on',show); btn.setAttribute('aria-label', t(show?'hidePass':'showPass')); inp.focus(); },
  clearSearch:()=>{ const s=$('#searchInput'); if(s){ s.value=''; updateSearchClear(); renderPlaces(); s.focus(); } },
  setView:(btn)=>setViewMode(btn.dataset.view||'grid'),
  setDetailTab:(btn)=>setDetailTab(btn.dataset.dtab||'book'),
  openAboutReviews:()=>openAboutTab(true),
  toggleSportDD:()=>toggleSportDD(),
  openNotifs:()=>Notifs.open(), notifsMarkAll:()=>Notifs.markAll(),
  openTracker:()=>{ if(Session.player()) showPage('bookings'); },
  navBack:(btn)=>navigateBack(btn.dataset.fallback||'home'),
  obsSkip:()=>Obs.finish(), obsNext:()=>Obs.next(), obsBack:()=>Obs.back(),
  ownerPlaceMenu:()=>openOwnerPlaceMenu(),
  ownerView:(btn)=>setOwnerView(btn.dataset.ov||'cards'),
  ownerBkView:(btn)=>setOwnerBkView(btn.dataset.bkv||'list'),
  /* رجوعٌ إلى خطوةٍ في صفحة الملعب. `force` لأن لا شيء يُفقَد: الاختيار كلّه في
     `State.detail` والنافذة لقطةٌ منه — فسؤال «تعديلات لم تُحفظ» هنا كذبة. */
  bkGoStep:(btn)=>{
    const to = btn.dataset.goto || 'field';
    Modal.close('modal-booking', true);
    if(to==='field') scrollToDetailSection('field','#subFields .subfield-card');
    else if(to==='date') scrollToDetailSection('time','#detailDays .day-btn');
    else scrollToDetailSection('time','#detailTimes .tbtn:not(.taken)');
  },
  /* عدّاد ±. الحدّان من الحقل نفسه (‏`min`/`max` في الوسم) فلا رقم مكرّر في JS،
     و`input` يُطلَق يدويًّا لأن الإسناد البرمجي لا يُطلقه — وعليه يعتمد
     `renderGmLive` والشريط. */
  stepNum:(btn)=>{
    const el = $('#'+btn.dataset.target); if(!el) return;
    const lo = Number(el.min), hi = Number(el.max), d = Number(btn.dataset.d)||0;
    let v = Number(el.value); if(!Number.isFinite(v)) v = Number.isFinite(lo) ? lo : 0;
    v += d;
    if(Number.isFinite(lo)) v = Math.max(lo, v);
    if(Number.isFinite(hi)) v = Math.min(hi, v);
    if(String(v) === String(el.value)) return;
    el.value = String(v); buzz(6);
    el.dispatchEvent(new Event('input',{ bubbles:true }));
  },
  /* قائمة فائض رأس المالك. والإغلاق يُعلَّق مرّةً واحدة على المستند لا في
     كل فتحة — الإضافة في كل فتحة تكدّس مستمعًا (مزلق مسجّل في `initAuthForms`). */
  toggleOwnMore:(btn)=>{
    const m=$('#ownMoreMenu'); if(!m) return;
    const open = m.hidden;
    /* ⚠️ القيمتان تُكتبان **عند كل فتح** لا مرّةً عند الإقلاع: اللغة والثيم
       يتبدّلان من خمسة مسارات (هذه القائمة · «حسابي» · شاشة الترحيب · تفضيل
       النظام · الاستعادة من التخزين)، فمرآةٌ تُكتب مرّةً تنحرف عن الحالة. */
    if(open){
      setText('ownMoreLangVal', State.lang==='en' ? 'EN' : 'عربي');
      setText('ownMoreThemeVal', t(document.body.classList.contains('dark') ? 'themeDarkVal' : 'themeLightVal'));
    }
    m.hidden = !open; btn.setAttribute('aria-expanded', open?'true':'false');
    if(open && !document.__ownMoreBound){
      document.__ownMoreBound = true;
      document.addEventListener('click', (e)=>{
        const mm=$('#ownMoreMenu'), bb=$('#ownMoreBtn');
        if(!mm || mm.hidden) return;
        /* النقر على **زرّ الفتح** يتركه للمبدّل نفسه؛ والنقر على **بند** يُغلق
           القائمة: قائمةٌ تبقى مفتوحة بعد تنفيذ بندها تُقرأ «لم يحدث شيء». */
        if(e.target.closest('#ownMoreBtn')) return;
        mm.hidden = true; if(bb) bb.setAttribute('aria-expanded','false');
      });
      document.addEventListener('keydown', (e)=>{
        if(e.key!=='Escape') return;
        const mm=$('#ownMoreMenu'), bb=$('#ownMoreBtn');
        if(mm && !mm.hidden){ mm.hidden=true; if(bb){ bb.setAttribute('aria-expanded','false'); bb.focus(); } }
      });
    }
  },
  repRange:(btn)=>{ State.reportRange = btn.dataset.range || 'all';
    $$('.rep-range-btn').forEach(b=>{ const on = b.dataset.range === State.reportRange;
      b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on?'true':'false'); });
    renderOwnerDashboard(); },
  /* إعادة العرض للاختبار: بدونها لا تُختبَر الميزة إلّا بمسح تخزين التطبيق
     في كل مرّة — وذلك يمحو الجلسة والمفضّلة ويُفسد اختبار المسارات الأخرى. */
  /* ⚠️ تُعرَض **الآن** لا «عند الفتح الجاي»: من ضغط الزرّ يريد أن يراها، ووعدٌ
     مؤجَّل يعني إعادة تشغيل التطبيق لاختبار شاشةٍ من ثلاث ضغطات. و`finish` هي
     التي تكتب المفتاح على أي حال، فلا حاجة إلى مسحه أوّلًا. */
  /* ⚠️ **«أعِد عرض شاشات الترحيب» حُذف** (قرار المالك 2026-08-13): سطرٌ في
     «حسابي» لفعلٍ لا يفعله مستخدمٌ مرّةً في عمره — وُضع أصلًا لتيسير الاختبار،
     وثمنُه يدفعه كلُّ لاعبٍ يفتح الصفحة. و`Obs.start` باقية: يناديها الإقلاع
     الأوّل (`Obs.shouldShow`) وهو مسارها الحقيقي. */
  /* مبدّل لاعب/مالك: المؤشّر ينزلق بـ--seg-i (CSS)، واللوحان يتبادلان بصنف .off لا بـhidden
     (hidden يصفّر ارتفاع الغلاف ⇒ قفزة). الارتفاع يبقى = أطول لوح دائمًا. */
  onbRole:(btn)=>{ const role=btn.dataset.role||'player';
    $$('.onb-seg-btn').forEach(b=>{ const on=b.dataset.role===role; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
    const seg=$('.onb-seg'); if(seg) seg.style.setProperty('--seg-i', role==='player'?'0':'1');
    const p=$('#onbPanelPlayer'), o=$('#onbPanelOwner');
    if(p) p.classList.toggle('off', role!=='player');
    if(o) o.classList.toggle('off', role!=='owner');
    buzz(6);
  },
};
/* موجة ضوء من نقطة الإصبع بالضبط على مبدّل لاعب/مالك (نمط مرجع finance-entry).
   pointerdown مفوّض: نضبط --rx/--ry بإحداثيات اللمسة داخل الزرّ ثم نعيد تشغيل
   الأنيميشن بحذف الصنف + reflow (بدونه لا تعاد الموجة عند نقرتين متتاليتين). */
document.addEventListener('pointerdown', (e)=>{
  const b = e.target.closest && e.target.closest('.onb-seg-btn'); if(!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--rx', (e.clientX - r.left) + 'px');
  b.style.setProperty('--ry', (e.clientY - r.top) + 'px');
  b.classList.remove('rip'); void b.offsetWidth; b.classList.add('rip');
}, {passive:true});

/* إظهار/إخفاء زر مسح البحث حسب وجود نص */
function updateSearchClear(){ const s=$('#searchInput'), c=$('#searchClear'); if(c) c.classList.toggle('show', !!(s&&s.value.trim())); }
document.addEventListener('click', (e)=>{
  /* اهتزازٌ خفيف عند التنقّل المقصود من الشريط وحده — لا عند كل `showPage`
     (التحويلات الداخلية تُنادى برمجيًّا، واهتزازٌ بلا لمسة يُقرأ عطلًا).
     وإيماءةُ الرجوع تهتزّ أصلًا عند اكتمالها في `edgeBackGesture`. */
  const nav=e.target.closest('[data-nav]'); if(nav){ buzz(6); showPage(nav.dataset.nav); return; }
  const otab=e.target.closest('[data-otab]'); if(otab){ showOwnerTab(otab.dataset.otab); return; }
  const go=e.target.closest('[data-go]'); if(go){ if(go.tagName==='A') e.preventDefault(); showPage(go.dataset.go); return; }
  const star=e.target.closest('[data-star]'); if(star){ setRating(Number(star.dataset.star)); return; }
  const act=e.target.closest('[data-action]'); if(!act) return;
  const fn=Actions[act.dataset.action]; if(fn) fn(act, e);
});
/* إغلاق قائمة الرياضات المنسدلة عند النقر خارجها أو بمفتاح Escape */
document.addEventListener('click', (e)=>{ if(!e.target.closest('#sportDD')) closeSportDD(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSportDD(); });
/* بحث الهيرو بصفحة الهبوط — يعبّئ بحث الرئيسية ثم يتصفّح كضيف */
const heroForm=$('#heroSearchForm');
if(heroForm){ heroForm.addEventListener('submit',(e)=>{ e.preventDefault(); const hi=$('#heroSearchInput'); const v=hi?hi.value.trim():''; const s=$('#searchInput'); if(s) s.value=v; updateSearchClear(); browse(); }); }

/* ===================== النائب المتحرّك لبحث الهيرو =====================
   طبقة نصّية فوق الحقل: بادئة ثابتة («ابحث عن») تُثبّت العين + كلمة متبدّلة كل 2.4s
   بانزلاق رأسي وتلاشٍ. مؤقّت واحد فقط، وكل مزامنة تُلغي السابق ⇒ لا تتراكم المؤقّتات
   عند تبديل اللغة أو التنقّل بين الصفحات. */
const HeroPh = (()=>{
  const PERIOD=2400, FADE=350;                 // FADE يطابق مدّة الانتقال في CSS
  let timer=null, fadeTimer=null, idx=0;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion:reduce)') : null;
  const reduced = ()=> !!(mq && mq.matches);
  const input = ()=> $('#heroSearchInput');
  const hint  = ()=> $('#heroSearchHint');
  const word  = ()=> $('#heroSearchWord');
  const words = ()=>{ const w=t('heroSearchWords'); return Array.isArray(w)&&w.length ? w : []; };

  /* الطبقة تظهر فقط إن كان الحقل فارغاً وغير مركَّز */
  const shouldShow = ()=>{ const i=input(); return !!i && !i.value && document.activeElement!==i; };
  function paint(){ const w=hint(); if(w) w.classList.toggle('hide', !shouldShow()); }

  /* شروط التشغيل: حركة مسموحة + تبويب ظاهر + صفحة الهبوط نشطة + الحقل غير مركَّز */
  function canRun(){
    if(reduced() || document.hidden) return false;
    if(!$('#page-welcome')?.classList.contains('active')) return false;
    const i=input(); if(!i || document.activeElement===i) return false;
    return words().length>1;
  }
  function step(){
    const el=word(), list=words(); if(!el || !list.length) return;
    el.classList.add('out');                                 // الكلمة الحالية تصعد وتتلاشى
    fadeTimer=setTimeout(()=>{
      fadeTimer=null;
      idx=(idx+1)%list.length;
      el.style.transition='none';                            // قفزة صامتة إلى موضع البداية (أسفل)
      el.classList.remove('out'); el.classList.add('in');
      el.textContent=list[idx];
      void el.offsetWidth;                                   // reflow يثبّت حالة البداية قبل الانتقال
      el.style.transition='';
      el.classList.remove('in');                             // تنزلق للأعلى وتظهر
    }, FADE);
  }
  function stop(){
    if(timer){ clearInterval(timer); timer=null; }
    if(fadeTimer){ clearTimeout(fadeTimer); fadeTimer=null; }
  }
  /* مزامنة كاملة — تُستدعى عند التهيئة/تبديل اللغة/تبديل الصفحة/التركيز/إخفاء التبويب */
  function sync(){
    const el=word(); if(!el) return;
    stop();
    const list=words(); if(!list.length) return;
    if(idx>=list.length) idx=0;
    el.classList.remove('out','in'); el.style.transition='';
    el.textContent = reduced() ? list[0] : list[idx];         // حركة مخفّضة ⇒ نصّ واحد ثابت
    paint();
    if(canRun()) timer=setInterval(step, PERIOD);
  }
  return { sync, stop, paint };
})();
if(heroForm){
  const hin=$('#heroSearchInput');
  if(hin){
    hin.addEventListener('focus', ()=>HeroPh.sync());   // يُخفي الطبقة ويوقف الحركة أثناء الكتابة
    hin.addEventListener('blur',  ()=>HeroPh.sync());   // تعود إن بقي الحقل فارغاً
    hin.addEventListener('input', ()=>HeroPh.paint());  // إظهار/إخفاء فوري حسب وجود قيمة
  }
}
document.addEventListener('visibilitychange', ()=>HeroPh.sync());   // لا يحرق دورات في الخلفية
// تفعيل عناصر التنقّل غير-الأزرار (مثل الشعار) بلوحة المفاتيح (Enter/Space)
document.addEventListener('keydown', (e)=>{ if(e.key!=='Enter' && e.key!==' ') return; const el=e.target.closest('[data-go],[data-nav]'); if(el && el.getAttribute('role')==='button'){ e.preventDefault(); el.click(); } });
// إغلاق النافذة عند الضغط على الخلفية
/* النقر خارج النافذة و Escape — كلاهما يمرّ بـModal.close كي يسأل عن التعديلات
   غير المحفوظة. (كانا يزيلان `.show` مباشرةً فيتخطّيان أي حارس.) */
document.addEventListener('click', (e)=>{ const o=e.target.closest('.modal-overlay,.success-overlay'); if(o&&e.target===o) Modal.close(o.id); });
// إغلاق بزر Escape (وصولية)
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const o=$('.modal-overlay.show, .success-overlay.show'); if(o) Modal.close(o.id); } });
// تنقّل المعرض المكبّر بأسهم الكيبورد (يحترم اتجاه الصفحة)
document.addEventListener('keydown', (e)=>{
  if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
  const o=$('#modal-lightbox'); if(!o || !o.classList.contains('show')) return;
  e.preventDefault();
  const rtl=document.documentElement.dir==='rtl';
  Lightbox.nav(e.key==='ArrowRight' ? (rtl?-1:1) : (rtl?1:-1));
});
// سحب أفقي على صورة المعرض = تنقّل (اللمس)
(function(){
  const st=$('#lbStage'); if(!st) return;
  let sx=0, sy=0;
  st.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, {passive:true});
  st.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)<50 || Math.abs(dx)<Math.abs(dy)) return;
    const rtl=document.documentElement.dir==='rtl';
    Lightbox.nav(dx<0 ? (rtl?-1:1) : (rtl?1:-1));
  }, {passive:true});
})();
// حصر التركيز داخل النافذة المفتوحة (Focus Trap) — Tab / Shift+Tab
document.addEventListener('keydown', (e)=>{
  if(e.key!=='Tab') return;
  const panel=$('.modal-overlay.show .modal, .success-overlay.show .scard'); if(!panel) return;
  const f=[...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!f.length) return;
  const first=f[0], last=f[f.length-1], a=document.activeElement;
  if(e.shiftKey && (a===first || a===panel)){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && a===last){ e.preventDefault(); first.focus(); }
});
// تقييم النجوم عبر الكيبورد/الراديو (Radio Group)
document.addEventListener('change', (e)=>{ const sr=e.target.closest('.star-input'); if(sr) setRating(Number(sr.value)); });
// أسهم لوحة المفاتيح في تبويبات المالك (←/→/Home/End) — يحترم اتجاه الصفحة
$('#nav-owner')?.addEventListener('keydown', (e)=>{
  if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
  e.preventDefault();
  const tabs=$$('#nav-owner .nitem'); const cur=tabs.findIndex(t=>t.dataset.otab===State.ownerTab); if(cur<0) return;
  const rtl=document.documentElement.dir==='rtl';
  let i=cur;
  if(e.key==='Home') i=0; else if(e.key==='End') i=tabs.length-1;
  else if(e.key==='ArrowDown') i=(cur+1)%tabs.length;                 // عمودي (Sidebar الكمبيوتر)
  else if(e.key==='ArrowUp') i=(cur-1+tabs.length)%tabs.length;
  else { const fwd=(e.key==='ArrowLeft')===rtl ? 1 : -1; i=(cur+fwd+tabs.length)%tabs.length; }   // أفقي (الجوال)
  const tab=tabs[i]; if(tab){ showOwnerTab(tab.dataset.otab); tab.focus(); }
});
// بحث مع تأخير (Debounce 300ms) + إظهار زر المسح فورياً
$('#searchInput')?.addEventListener('input', updateSearchClear);
$('#searchInput')?.addEventListener('input', debounce(()=>renderPlaces({quiet:true}), CONFIG.SEARCH_DEBOUNCE));
/* قناع رقم الهاتف الأردني (079 123 4567) — لكل type="tel" عبر التفويض.
   تنسيق بصري فقط: normalizePhone/validPhone يتجاهلان الفراغات فلا يتأثر التحقق ولا المُرسَل للخادم.
   يقنّع أرقام 07 المحلية فقط؛ الصيغ الدولية (962…) تبقى أرقاماً متصلة بلا قناع. */
document.addEventListener('input', (e)=>{
  const inp=e.target;
  if(!(inp && inp.tagName==='INPUT' && inp.type==='tel') || inp.disabled) return;
  const caret = inp.selectionStart==null ? inp.value.length : inp.selectionStart;
  let digitsBefore = inp.value.slice(0,caret).replace(/\D/g,'').length;
  let d = inp.value.replace(/\D/g,'');
  // Backspace أزال فراغ القناع فقط (الأرقام كما هي) ⇒ نحذف الرقم الذي قبله ليبقى الحذف طبيعياً
  if(e.inputType==='deleteContentBackward' && inp.dataset.pdg===d && digitsBefore>0){
    d = d.slice(0,digitsBefore-1)+d.slice(digitsBefore); digitsBefore--;
  }
  const isLocal = d.startsWith('07');
  d = d.slice(0, isLocal?10:14);
  const out = !isLocal ? d
    : d.length>6 ? d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6)
    : d.length>3 ? d.slice(0,3)+' '+d.slice(3) : d;
  inp.dataset.pdg = d;
  if(inp.value!==out){
    inp.value = out;
    let ci=0,seen=0; while(ci<out.length && seen<digitsBefore){ if(/\d/.test(out[ci])) seen++; ci++; }
    try{ inp.setSelectionRange(ci,ci); }catch(_){}
  }
});
// الفلاتر في لوحة المالك
$('#ownerDateFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerFieldFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerStatusFilter')?.addEventListener('change', renderOwnerBookings);
$('#ownerSearch')?.addEventListener('input', debounce(()=>renderOwnerBookings(), CONFIG.SEARCH_DEBOUNCE));
// تحديث تلقائي عند العودة للتبويب
document.addEventListener('visibilitychange', ()=>{ manageAutoRefresh(); if(!document.hidden&&autoRefreshActive()) refreshVisible(); });
/* العودة إلى التطبيق هي اللحظة التي يُقرأ فيها الإشعار فعلًا — فتُجلَب حينها
   مهما كانت الصفحة، بلا انتظار الدورة. و`autoRefreshActive` لا تشمل «حجوزاتي»
   ولا «حسابي»، وهما صفحتان يفتحهما المنتظِر تحديدًا. */
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ Notifs.load(); Tracker.refresh(); } });
/* نقر إشعار الجهاز ⇒ فتح المركز، ومن سطره إلى الصفحة المعنيّة. */
document.addEventListener('app:notification-tap', ()=>{ Notifs.load({silent:true}); Notifs.open(); });
/* وصلت رسالة دفعٍ والتطبيق مفتوح: نجلب بلا إظهار — أندرويد عرضها بنفسه،
   وإظهارها ثانيةً من `deliver()` يكوّم إشعارين لخبرٍ واحد. */
document.addEventListener('app:push-received', ()=>{ Notifs.load({silent:true}); });
// تفعيل السحب لإغلاق كل النوافذ
$$('.modal-overlay').forEach(enableSwipe);

/* ===================== INIT ===================== */
/* ===================== LANDING SCROLL REVEAL ===================== */
/* منع تكرار زرّ «متابعة الحجز»: يُخفى الشريط اللاصق كلما ظهر الزر الداخلي على الشاشة
   (يعمل على الشاشات العريضة حيث يظهر الزرّان؛ على الجوال الزر الداخلي display:none فيبقى اللاصق). */
function initStickyDedup(){
  const inline=document.querySelector('.detail-book-inline'), bar=$('#detailSticky');
  if(!inline || !bar || !('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>bar.classList.toggle('covered-by-inline', e.isIntersecting));
  }, { threshold:0 });
  io.observe(inline);
}

/* ربط حقول المصادقة مرّة واحدة.
   ⚠️ **إسناد خاصّية** (`el.oninput=`) لا `addEventListener`: هذه عناصر ثابتة في
   الـHTML، والإضافة تكدّس مستمعًا جديدًا لو نُودي المهيّئ مرّتين. */
function initAuthForms(){
  const pass = $('#regPass');
  if(pass) pass.oninput = renderPwFeedback;

  const cells = $$('#vfCells .vf-cell');
  const submitBtn = () => $('#vfForm [data-action="verifyPhone"]');
  const paint = (c) => c.classList.toggle('filled', !!c.value);
  const maybeSubmit = () => { if(Verify.code().length === 6) Verify.submit(submitBtn()); };

  cells.forEach((c, i) => {
    c.oninput = () => {
      // آخر محرف لا أوّله: من يكتب فوق خانة ممتلئة يقصد استبدالها
      c.value = toAscii(c.value).replace(/\D/g,'').slice(-1);
      paint(c); Verify.err('');
      if(c.value && i < cells.length-1) cells[i+1].focus();
      maybeSubmit();
    };
    c.onkeydown = (e) => {
      if(e.key === 'Backspace' && !c.value && i > 0){
        e.preventDefault(); cells[i-1].value=''; paint(cells[i-1]); cells[i-1].focus(); return;
      }
      // الصفّ `dir="ltr"` دائمًا (الكود عدد لا نصّ) ⇒ اليسار هو السابق في اللغتين
      if(e.key === 'ArrowLeft'  && i > 0){ e.preventDefault(); cells[i-1].focus(); }
      if(e.key === 'ArrowRight' && i < cells.length-1){ e.preventDefault(); cells[i+1].focus(); }
    };
    // لصق الكود كاملًا على أي خانة يملأ الصفّ من أوّله — لا من الخانة الملصوق فيها
    c.onpaste = (e) => {
      const cb = e.clipboardData || window.clipboardData;
      const txt = toAscii(cb ? cb.getData('text') : '').replace(/\D/g,'').slice(0,6);
      if(!txt) return;
      e.preventDefault();
      cells.forEach((x,k)=>{ x.value = txt[k]||''; paint(x); });
      Verify.err('');
      cells[Math.min(txt.length, cells.length-1)].focus();
      maybeSubmit();
    };
    c.onfocus = () => { try{ c.select(); }catch(_){} };
  });
}

async function init(){
  applyTheme(Session.theme());
  setLanguage(State.lang);   // يضبط lang/dir + يطبّق الترجمة على الواجهة الثابتة
  validateI18nParity();      // تحقّق تكافؤ مفاتيح ar/en (تحذير كونسول فقط)
  Dirty.init();              // مراقبة الإدخال في نوافذ النماذج (تحذير التعديلات غير المحفوظة)
  Offline.init();            // طبقة انقطاع الاتصال + استئناف عند العودة
  PullRefresh.init();        // السحب للتحديث على الرئيسية/الحجوزات/لوحة المالك
  initStickyDedup();         // منع تكرار زرّ متابعة الحجز (اللاصق × الداخلي)
  initAuthForms();           // شروط كلمة السرّ الحيّة + خانات كود التحقّق
  initRovingGroups();        // مجموعات الاختيار: tabindex متنقّل + تنقّل بالأسهم
  loadData().then(updateTrust);
  Notifs.load();             // الجرس يعرف عدده قبل أن ينظر إليه المستخدم
  if (Session.owner()){
    $('#nav-owner').classList.add('show'); showPage('owner'); loadOwnerDashboard();
    /* المالك يُسأل عن الإذن هنا: الطلبات هي عمله، والسؤال يقع وهو يفتح لوحته
       لا وهو يفتح التطبيق لأول مرّة ولا يعرف بعدُ ما هذا التطبيق أصلًا. */
    Notifs.askPermission();
    return;
  }
  if (Session.player()){
    try{
      const res=await API.get('getPlayerBookings',{ player_token:Session.player() }, 'playerBookings');
      if (res.success){ State.player=res.player; State.guest=false; updatePlayerGreeting(); showPage('hub'); placesSkeleton(); await loadData(); renderPlaces(); Tracker.refresh(); return; }
      Session.clear();
    }catch(_){ /* الإبقاء على شاشة الترحيب عند فشل الشبكة */ }
  }
  /* 🔴 حُذف توست «أوّل زيارة» ومفتاحُه معه:
     نصّه يقول تقريبًا ما تقوله الشريحة الأولى، وعرضُ الاثنين تكرارٌ في أوّل
     تسع ثوانٍ من عمر التطبيق — والشرائح تقولها بمهلةٍ يقرؤها المستخدم بدل
     توستٍ يمرّ. مسارٌ واحد للحقيقة الواحدة.
     ⚠️ و**إمّا/أو** لا الاثنتان: كانت `welcome` تُعرَض ثمّ تُغطَّى بالطبقة، وقد
     صارت الشرائح صفحةً ⇒ عرضُ الاثنتين يدفع `welcome` إلى المكدّس فيرتدّ إليها
     زرُّ الرجوع من الشريحة الأولى بدل أن يُنهي المسار. */
  if (Obs.shouldShow() && Obs.start()) return;
  showPage('welcome');
}
init();

})();
