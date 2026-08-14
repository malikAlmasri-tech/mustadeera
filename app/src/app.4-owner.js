/* ===================== RENDER: OWNER DASHBOARD ===================== */
/* بطاقة حجز هيكلية واحدة (أفاتار + سطران + شريط حالة) — تطابق هيكل بطاقة الحجز الحقيقية */
const skBookingCard = ()=> h('div',{class:'sk-bk'},
  h('span',{class:'sk sk-bk-av'}),
  h('div',{class:'sk-bk-col'}, h('span',{class:'sk'}), h('span',{class:'sk'})),
  h('span',{class:'sk sk-bk-tag'}));
/* هيكل اللوحة أثناء الجلب: يقنّع أصفار بلاطات الإحصاء ويملأ قائمتَي اليوم والحجوزات.
   بديل عن سطر نصّي واحد كان يترك بقية اللوحة تعرض أصفارًا تُقرأ كبيانات حقيقية. */
function renderOwnerSkeleton(){
  const pg=$('#page-owner'); if(pg) pg.classList.add('owner-loading');
  for(const id of ['#ownerToday','#ownerBookings']){
    const box=$(id); if(!box) continue;
    clear(box); for(let i=0;i<3;i++) box.append(skBookingCard());
  }
}
const clearOwnerSkeleton = ()=>{ const pg=$('#page-owner'); if(pg) pg.classList.remove('owner-loading'); };

async function loadOwnerDashboard(){
  if (!Session.owner()){ showPage('ownerLogin'); return; }
  const el=$('#ownerBookings');
  renderOwnerSkeleton();
  // 1) جلب البيانات — فشل الشبكة فقط يُظهر "تعذّر جلب البيانات"
  let res;
  try{
    res = await API.get('getOwnerData', { owner_token: Session.owner(), place_id: State.ownerPlaceId }, 'ownerData');
  }catch(e){
    // إجهاض = طلب أحدث يعمل الآن ⇒ نترك الهيكل له، فرفعه هنا يُومض اللوحة فارغةً
    if(isAbort(e)) return;
    clearOwnerSkeleton();
    clear(el); el.append(emptyState({icon:'📡',title:t('fetchFail'),sub:t('fetchFailSub')}));
    return;
  }
  clearOwnerSkeleton();
  if (!res || !res.success){ toast(apiMsg(res&&res.message)||t('sessionExpired'),'error'); doLogout(); return; }
  // 2) الرسم — خطأ هنا لا يُلبَّس لباس فشل الشبكة، بل يُظهر الرسالة الحقيقية
  State.ownerData = res;
  /* الخادم هو الحكم على أيّ مكان عُرض فعلًا (قد يردّ المختار إن كان المطلوب
     ليس للمالك)، فتُكتب الحالة من ردّه لا من الطلب — وإلّا أضاء المبدّل مكانًا
     غير الذي على الشاشة. */
  if (res.place_id){ State.ownerPlaceId = String(res.place_id);
    try{ localStorage.setItem('mustadaira:ownerPlace', State.ownerPlaceId); }catch(_){} }
  // مالك مختلف (مكان مختلف) ⇒ تصفير كاش AI للجلسة حتى لا تظهر تحليلات مكان سابق
  const aiPid = res.place ? String(res.place.place_id||'') : '';
  if (aiState().placeId !== aiPid) State.ai = { placeId: aiPid };
  try{
    renderOwnerDashboard();
  }catch(err){
    console.error('renderOwnerDashboard failed:', err);
    clear(el); el.append(emptyState({icon:'⚠️', title:t('dashRenderErr'), sub:String((err&&err.message)||err)}));
  }
}
/* يشغّل خطوة رسم معزولة: خطؤها يُسجَّل ولا يُسقط بقية اللوحة */
function safeRender(label, fn){ try{ fn(); }catch(err){ console.error('owner render ['+label+'] failed:', err); } }

/* ═══════════ نطاق التقارير ═══════════════════════════════════════════════
   يقصّ **المدخَل** لا الحساب. والنافذة على `booking_date` أي على **تاريخ
   اللعب** — وهو ما تقيسه بقيّة اللوحة أصلًا (‏`oToday` = «حسب تاريخ اللعب»)،
   فخلطُ نافذةٍ على تاريخ الطلب بأخرى على تاريخ اللعب يعطي رقمين لا يجتمعان.
   ⚠️ **ولا مقارنة فترات**: الجدول الشهري يمتنع عن حساب النموّ للشهر الجارٍ
   عمدًا (مقارنة شهر ناقص بشهر كامل بلا معنى)، والقاعدة نفسها تنطبق على أي
   نافذة جزئية هنا. رقمٌ تقريبي أسوأ من غياب المقارنة. */
const REPORT_RANGES = { all:null, d30:30, d90:90 };
function reportScoped(bookings){
  const days = REPORT_RANGES[State.reportRange || 'all'];
  if(!days) return bookings;
  const from = dateAfter(-(days - 1));
  return bookings.filter(b => String(b.date||'') >= from);
}
/* ═══════════ مبدّل الأماكن (أ-٢ · ج-١) ═══════════════════════════════════
   `place_owners` علاقةٌ متعدّدة، وكان العميل يأخذ أوّل صفّ ويرمي الباقي صامتًا.
   ⚠️ **والمبدّل لا يظهر إطلاقًا لمالكٍ له مكان واحد**: مبدّلٌ لخيار واحد ضجيج،
   والحالة الغالبة مكانٌ واحد. فالزرّ يبقى نصًّا حتى تصل قائمةٌ فيها اثنان. */
const ownerPlaces = () => (State.ownerData && State.ownerData.places) || [];
function renderOwnerPlaceSwitch(){
  const btn=$('#ownerPlaceTitle'), d=State.ownerData; if(!btn) return;
  const list=ownerPlaces(), multi=list.length>1;
  setText('ownerPlaceName', d && d.place ? d.place.place_name : t('unknownPlace'));
  btn.classList.toggle('is-switch', multi);
  btn.disabled = !multi;
  btn.setAttribute('aria-expanded','false');
  /* عددُ الأماكن يُقال على الزرّ نفسه: من لا يفتح القائمة لا يعرف أنها قائمة. */
  if(multi) btn.setAttribute('aria-label', t('ownPlacesAria',{ n:nPlaces(list.length) }));
  else btn.removeAttribute('aria-label');
}
function openOwnerPlaceMenu(){
  const list=ownerPlaces(); if(list.length<2) return;
  const box=$('#opList'); if(!box) return; clear(box);
  list.forEach(p=>{
    const on = String(p.place_id)===String(State.ownerPlaceId);
    const b=h('button',{class:'op-item'+(on?' is-on':''), type:'button', role:'option', 'aria-selected':on?'true':'false'},
      h('span',{class:'op-name'}, h('bdi',{}, p.place_name||'')),
      on ? ico('check','svg-sm') : '');
    b.addEventListener('click', ()=>pickOwnerPlace(String(p.place_id)));
    box.append(b);
  });
  Modal.open('modal-ownerplace');
}
async function pickOwnerPlace(pid){
  Modal.close('modal-ownerplace');
  if(String(pid)===String(State.ownerPlaceId)) return;
  State.ownerPlaceId=String(pid);
  try{ localStorage.setItem('mustadaira:ownerPlace', State.ownerPlaceId); }catch(_){}
  await loadOwnerDashboard();
}
function renderOwnerDashboard(){
  const d=State.ownerData; if(!d) return;
  renderOwnerPlaceSwitch();
  const bookings = d.bookings || [];
  /* ⚠️ نطاق التقارير **مرشِّح مُدخَل لا تعديل حساب**: الدوالّ الثلاث تأخذ
     مصفوفةً وتحسب منها، فتقليص المصفوفة يغيّر ما تشمله الأرقام ولا يمسّ سطرًا
     واحدًا من رياضياتها (العمولة · الصافي · الإشغال كما هي بالحرف).
     و«الكل» هو الافتراضي فلا يتغيّر شيء لمن لا يلمس المُبدِّل. */
  const scoped = reportScoped(bookings);
  safeRender('stats', ()=>renderOwnerStats(scoped));
  safeRender('econ', ()=>renderOwnerEcon(scoped));
  safeRender('charts', ()=>renderOwnerCharts(scoped));
  safeRender('fieldFilter', ()=>{
    const sel=$('#ownerFieldFilter'); const old=sel.value||'all';
    clear(sel); sel.append(h('option',{value:'all'},t('allFields')));
    (d.fields||[]).forEach(f=> sel.append(h('option',{value:f.field_id}, f.field_name)));
    sel.value=old;
  });
  safeRender('bookings', renderOwnerBookings);
  safeRender('fields', renderOwnerFields);
  safeRender('today', renderOwnerToday);
  safeRender('timeline', ()=>{ if(State.ownerView==='timeline') renderOwnerTimeline(); });
  safeRender('byPlace', renderOwnerByPlace);
  // 🤖 لوحات AI: الطقس فوراً (تبويب اليوم الافتراضي)، والتقارير كسولة عند فتح تبويبها
  safeRender('ai', ()=>{ loadAiWeather(); if((State.ownerTab||'today')==='reports'){ loadAiInsights(); loadAiReviews(); } });
  showOwnerTab(State.ownerTab || 'today');
}
/* ===================== OWNER TABS ===================== */
/* ⚠️ **دالّة واحدة تظلّ مصدر الحقيقة.** الأزرار انتقلت من شريطٍ أعلى الصفحة
   إلى الشريط السفلي، ولم يُكرَّر منطق التبديل: هي التي تُحدّث حالة الأزرار
   والحبّة معًا. و«التقارير» ليست فيها زرّ — تُفتَح من بطاقة في «اليوم» —
   فالحبّة تُخفى حينها بدل أن تجلس على تبويب ليس هو المعروض. */
function showOwnerTab(name){
  State.ownerTab=name;
  $$('#nav-owner .nitem').forEach(b=>{ const on=b.dataset.otab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); b.setAttribute('tabindex', on?'0':'-1'); });
  /* اللوح المعروض قد يخالف اسم التبويب: «الحجوزات» تعرض التقويم حين يكون هو
     الشكل المختار، والحبّة تبقى على زرّ الحجوزات لأنّ المستخدم فيها فعلًا. */
  const panel = (name==='bookings' && State.ownerBkView==='calendar') ? 'calendar' : name;
  $$('#page-owner .owner-tab').forEach(p=>{ p.hidden = (p.id !== 'ownerTab-'+panel); });
  NavPill.schedule();
  const fab=$('#ownerAddFab'); if(fab) fab.hidden = (name!=='fields');   // FAB إضافة ملعب — تبويب الملاعب فقط
  if(panel==='calendar') renderOwnerCalendar();
  /* المخطّط يُعاد رسمه مع البطاقات: كلاهما يقرأ نفس الجلبة، وإعادة رسم واحدٍ
     دون الآخر تترك شكلًا يتقدّم على الثاني بجلبة كاملة. */
  if(name==='today'){ renderOwnerToday(); if(State.ownerView==='timeline') renderOwnerTimeline(); }
  if(name==='reports' && State.ownerData){ loadAiInsights(); loadAiReviews(); }   // 🤖 جلب كسول أول مرة فقط
  if(name==='bookings'){ State.ownerNewCount=0; updateOwnerTabBadge(); }          // فتح التبويب يصفّر شارة الجديد
  window.scrollTo({ top:0, behavior:'instant' });
}
/* ===================== OWNER · TODAY TAB ===================== */
function renderOwnerToday(){
  const el=$('#ownerToday'); if(!el) return;
  const all=State.ownerData?.bookings||[]; const fields=State.ownerData?.fields||[]; const td=today();
  const todayB=all.filter(b=>String(b.date||'').split('T')[0]===td);
  /* ⚠️ **الترتيب بالمهلة لا بالساعة.** كان الترتيب بساعة اللعب، فيقع الطلب
     الذي وصل أمس ويكاد ينقضي **تحت** طلبٍ وصل قبل دقيقة لأن مباراته أبكر —
     وهو بالضبط الطلب الذي جاء المالك من أجله. والمهلة تجمع الاثنين أصلًا:
     `min(الوصول + المهلة, بدء الخانة)` ⇒ الترتيب بها يقدّم الأقدم **و**
     يقدّم من موعده الليلة معًا. */
  const pend=todayB.filter(b=>normStatus(b)==='pending')
    .sort((a,b)=>{ const x=replyDeadlineMs(a), y=replyDeadlineMs(b);
                   if(Number.isNaN(x)) return 1; if(Number.isNaN(y)) return -1;
                   return x-y || Number(a.hour)-Number(b.hour); });
  const conf=todayB.filter(b=>normStatus(b)==='confirmed');
  const revenue=conf.reduce((s,b)=>s+(Number(b.price)||0),0);
  // أوقات اليوم الفارغة (من بيانات المالك مباشرة)
  const bookedToday={};
  todayB.forEach(b=>{ const s=normStatus(b); if(s==='cancelled'||s==='rejected') return; const fid=String(b.field_id); const hr=Number(b.hour); if(!Number.isNaN(hr)){ (bookedToday[fid] ||= new Set()).add(hr); } });
  let totalSlots=0, booked=0;
  // «أوقات متاحة اليوم» تعدّ المفتوح وحده: خانةٌ مغلقة ليست متاحة للحجز.
  fields.forEach(f=>{ if(f.active===false) return; const slots=openSlotsFor(f, td); totalSlots+=slots.length; const set=bookedToday[String(f.field_id)]||new Set(); booked+=slots.filter(s=>set.has(s.hour)).length; });
  setText('otToday', todayB.length); setText('otPending', pend.length); setText('otRevenue', formatMoney(revenue)); setText('otFree', Math.max(totalSlots-booked,0));
  // اتجاه آخر 7 أيام على بطاقة «حجوزات اليوم» (بلا الملغاة/المرفوضة)
  setSpark('otToday', [...Array(7)].map((_,i)=>{ const ds=dateAfter(i-6); return all.filter(b=>String(b.date||'').split('T')[0]===ds && !['cancelled','rejected'].includes(normStatus(b))).length; }));
  clear(el);
  if(!todayB.length){ el.append(emptyState({icon:'📅', title:t('noBookingsToday'), sub:t('noBookingsTodaySub')})); return; }
  const rest=todayB.filter(b=>normStatus(b)!=='pending').sort((a,b)=>Number(a.hour)-Number(b.hour));
  if(pend.length){
    el.append(sectionTitle(t('pendingReply'), pend.length));
    /* حاشيةٌ صادقة عن **آلية** الانقضاء لا وعدٌ بها: بلا cron في الخطّة
       المجانية، الكنس يقع عند فتح اللوحة. وإن كان ترحيل 15 معلَّقًا فلا
       انقضاء إطلاقًا — والحاشية تقول ذلك بدل أن تَعِد بما لا يحدث. */
    el.append(h('div',{class:'ot-note'},
      h('span',{class:'ot-note-sub'}, t('otSoonestFirst')),
      h('span',{}, SWEEP_OK ? t('expirySweepNote') : t('expirySweepOff'))));
    pend.forEach(b=>el.append(ownerBookingCard(b)));
  }
  if(rest.length){ el.append(sectionTitle(t('restToday'), rest.length)); rest.forEach(b=>el.append(ownerBookingCard(b))); }
}

/* ═══════════ المخطّط الزمني ليوم واحد (ج-٣) ═══════════════════════════════
   صفٌّ لكل ملعب، عمودٌ لكل ساعةٍ **مفتوحة أو مغلقة** في يومه — والمصدر
   `fieldSlots` لا `openSlotsFor`: هذا عرضُ حالةٍ لا حسابُ طاقة، والمغلق حالةٌ
   تُعرَض («ليش اليوم مظلم؟») لا خانةٌ تُطرَح.
   ⚠️ **خمس حالات، وكلٌّ منها بلون ونمط معًا** (حدّ متّصل/متقطّع/منقّط ونقش
      مائل للمغلق) — من لا يميّز اللونين يقرأ الفرق. والألوان هي ألوان
      `statusLabel` نفسها، فلا لوحة ثانية لنفس المعنى.
   ⚠️ **ولا زرّ يبدو قابلًا للنقر وهو ليس كذلك**: المغلق `disabled` حقيقي
      (لا بديل يُشتقّ منه)، والباقي أزرارٌ تفتح البطاقة أو لوح الإغلاق.
   ⚠️ والبطاقات تبقى الشكل الافتراضي لـ«طلبات تنتظر ردّك» — هي أفضل شكل له،
      والمخطّط يجيب عن سؤال آخر: «شو وضع اليوم كلّه؟». */
function ownerDayCellState(b, date, hour){
  if(!b) return null;
  const s=normStatus(b);
  if(s==='cancelled'||s==='rejected') return null;
  return s;
}
function tlDate(){ return State.tlDate || today(); }
function shiftTlDate(d){
  const cur = new Date(tlDate()+'T12:00:00');
  cur.setDate(cur.getDate()+d);
  State.tlDate = cur.toISOString().slice(0,10);
  renderOwnerTimeline();
}
function renderOwnerTimeline(){
  const el=$('#ownerTimeline'); if(!el) return; clear(el);
  const fields=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
  const td=tlDate(), now=today();
  /* شريط اليوم: المخطّط يخدم التخطيط لا متابعة الساعة الجارية وحدها، فالمالك
     يسأل «شو وضع الخميس؟» بقدر ما يسأل «شو وضع اليوم؟». والسهم فيزيائي
     فيُقلب بالاتّجاه في الورقة لا هنا. */
  const bar=h('div',{class:'tl-bar'},
    (()=>{ const b=h('button',{class:'tl-nav', type:'button', 'aria-label':t('tlPrevDay')},
             h('span',{class:'tl-nav-ic', html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>'}));
           b.addEventListener('click',()=>shiftTlDate(-1)); return b; })(),
    h('div',{class:'tl-day'},
      h('b',{}, td===now ? t('today') : dayLabel(td)),
      h('span',{}, shortDate(td))),
    (()=>{ const b=h('button',{class:'tl-nav', type:'button', 'aria-label':t('tlNextDay')},
             h('span',{class:'tl-nav-ic', html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'}));
           b.addEventListener('click',()=>shiftTlDate(1)); return b; })(),
    (()=>{ if(td===now) return null;
           const b=h('button',{class:'tl-today', type:'button'}, t('tlBackToday'));
           b.addEventListener('click',()=>{ State.tlDate=now; renderOwnerTimeline(); }); return b; })());
  el.append(bar);
  if(!fields.length){ el.append(emptyState({icon:'🥅', title:t('noFieldsTitle'), sub:t('noFieldsSub')})); return; }
  // كل ساعات اليوم عبر الملاعب كلّها، مرتّبة — عمودٌ لكل ساعة يظهر في أيٍّ منها
  const hours=[...new Set(fields.flatMap(f=>fieldSlots(f).map(s=>s.hour)))].sort((a,b)=>a-b);
  if(!hours.length){ el.append(emptyState({icon:'🕒', title:t('tlNoHours'), sub:t('tlNoHoursSub')})); return; }
  const byKey={};
  (State.ownerData?.bookings||[]).forEach(b=>{
    if(String(b.date||'').split('T')[0]!==td) return;
    const st=normStatus(b); if(st==='cancelled'||st==='rejected') return;
    byKey[String(b.field_id)+'@'+Number(b.hour)] = b;
  });
  /* «راح» تُقاس بساعة **اليوم المعروض** لا بالساعة الحالية مطلقًا: يومٌ قادم
     لا شيء فيه راح، ويومٌ ماضٍ كلّه راح. وبلا هذا الفرق كان الغد يُرسَم نصفه
     رماديًّا لأن الساعة عندنا الآن الثامنة. */
  const past = (hr) => td < now ? true : td > now ? false : (hr + 2) <= new Date().getHours();
  const wrap=h('div',{class:'tl-wrap'});
  const grid=h('div',{class:'tl-grid', style:{ gridTemplateColumns:`auto repeat(${hours.length}, minmax(58px,1fr))` }});
  grid.append(h('div',{class:'tl-head tl-name'}, t('tlField')));
  hours.forEach(hr=> grid.append(h('div',{class:'tl-head'}, h('bdi',{dir:'ltr'}, String(hr).padStart(2,'0')+':00'))));
  fields.forEach(f=>{
    const own = fieldSlots(f).map(s=>s.hour);
    grid.append(h('div',{class:'tl-name', title:f.field_name}, h('bdi',{}, f.field_name)));
    hours.forEach(hr=>{
      const cellWrap=h('div',{class:'tl-cell'});
      if(!own.includes(hr)){ cellWrap.append(h('span',{class:'tl-off','aria-hidden':'true'}, '·')); grid.append(cellWrap); return; }
      const cl = slotClosure(f.field_id, td, hr);
      const b  = byKey[String(f.field_id)+'@'+hr];
      const st = ownerDayCellState(b, td, hr);
      let cls='tl-slot ', label='', dis=false;
      if(cl){ cls+='tl-closed'; label=t('tlClosed'); dis=true; }
      else if(st==='confirmed'){ cls+='tl-confirmed'; label=t('statusConfirmed'); }
      else if(st==='pending'){ cls+='tl-pending'; label=t('statusPending'); }
      else if(past(hr)){ cls+='tl-past'; label=t('tlPast'); dis=true; }
      else { cls+='tl-free'; label=t('tlFree'); }
      /* الاسم المنطوق يحمل **الملعب والساعة والحالة** معًا: الخليّة وحدها في
         شبكة لا تُقرأ صفًّا وعمودًا كالجدول، فالسياق يُكتب فيها. */
      const btn=h('button',{ class:cls, type:'button', disabled:dis||undefined,
        'aria-label': `${f.field_name} — ${String(hr).padStart(2,'0')}:00 — ${label}` }, label);
      if(!dis){
        btn.addEventListener('click', ()=>{
          if(b) openOwnerBookingFromTimeline(b);
          else openClosure(td);
        });
      }
      cellWrap.append(btn); grid.append(cellWrap);
    });
  });
  wrap.append(grid);
  const key=(cls,txt)=>h('span',{}, h('i',{class:'tl-key '+cls,'aria-hidden':'true'}), txt);
  el.append(wrap, h('div',{class:'tl-legend'},
    key('tl-free', t('tlFree')), key('tl-pending', t('statusPending')),
    key('tl-confirmed', t('statusConfirmed')), key('tl-closed', t('tlClosed')),
    key('tl-past', t('tlPast'))));
}
/* ═══════════ تجزئة التقارير بين الأماكن (ج-٥) ═══════════════════════════
   بقيّة اللوحة تصف **المكان المختار** — والجلبة نفسها مقصورة عليه، فلا خلط.
   وهذا اللوح وحده يقارن، ولا يُعرَض إطلاقًا لمالكِ مكان واحد.
   ⚠️ ويحترم **نفس نطاق التقارير** (‏`reportScoped` على `date`): لوحٌ يقول «الكل»
      بينما فوقه «آخر ٣٠ يوم» يعطي رقمين لا يجتمعان على شاشة واحدة.
   ⚠️ ولا نموّ ولا مقارنة فترات هنا — نفس قاعدة الجدول الشهري بالحرف. */
function renderOwnerByPlace(){
  const box=$('#repByPlace'); if(!box) return;
  const names=ownerPlaces();
  const rows=(State.ownerData && State.ownerData.place_rows) || [];
  if(names.length < 2 || !rows.length){ box.hidden=true; clear(box); return; }
  const scoped = reportScoped(rows);
  const agg={};
  scoped.forEach(r=>{
    const a = (agg[r.place_id] ||= { n:0, conf:0, revenue:0 });
    a.n++;
    if(String(r.status).toLowerCase()==='confirmed'){ a.conf++; a.revenue += r.price; }
  });
  clear(box); box.hidden=false;
  const card=h('div',{class:'card mb-card'},
    h('div',{class:'section-title'}, h('span',{}, t('repByPlace'))),
    h('p',{class:'cap'}, t('repByPlaceSub')));
  const list=h('div',{class:'op-list'});
  names.forEach(p=>{
    const a = agg[String(p.place_id)] || { n:0, conf:0, revenue:0 };
    const on = String(p.place_id)===String(State.ownerPlaceId);
    list.append(h('div',{class:'op-item'+(on?' is-on':'')},
      h('span',{class:'op-name'}, h('bdi',{}, p.place_name||'')),
      h('span',{class:'bp-nums'},
        h('b',{}, formatMoney(a.revenue)), ' ',
        h('small',{}, t('bpConfirmed',{ n:a.conf, all:a.n })))));
  });
  card.append(list);
  box.append(card);
}
/* نقر خليّة محجوزة يفتح **نفس** بطاقة الحجز لا نسخة ثانية منها */
function openOwnerBookingFromTimeline(b){
  const box=$('#tlCard'); if(!box) return;
  clear(box); box.hidden=false;
  box.append(ownerBookingCard(b));
  box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
/* التقويم شكلُ عرضٍ للحجوزات لا قسمًا — ولهذا يعيش المبدّل في الاثنين ويُزامَن
   من `State` وحدها (مصدرٌ واحد، فلا ينحرف نسختاه). */
function setOwnerBkView(v){
  State.ownerBkView = (v==='calendar') ? 'calendar' : 'list';
  /* نسختان في اللوحين، وتُزامَنان بالصنف لا بالمُعرّف: مُعرّفٌ مكرّر وسمٌ غير
     صالح، ويُربك `aria-labelledby` وgetElementById معًا. */
  $$('.bk-seg .ov-btn').forEach(b=>{ const on=b.dataset.bkv===State.ownerBkView;
    b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on?'true':'false'); });
  showOwnerTab('bookings');
}
function setOwnerView(v){
  State.ownerView = (v==='timeline') ? 'timeline' : 'cards';
  $$('#ownerViewSeg .ov-btn').forEach(b=>{ const on=b.dataset.ov===State.ownerView;
    b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on?'true':'false'); });
  const tl=$('#ownerTimelineWrap'), cd=$('#ownerToday');
  const on = State.ownerView==='timeline';
  if(tl) tl.hidden=!on; if(cd) cd.hidden=on;
  const card=$('#tlCard'); if(card && !on){ card.hidden=true; clear(card); }
  if(on) renderOwnerTimeline();
}
/* ===================== OWNER · CALENDAR TAB (Vanilla) ===================== */
function ownerBookingsByDate(){
  const m={}; (State.ownerData?.bookings||[]).forEach(b=>{ const d=String(b.date||'').split('T')[0]; if(!d) return; (m[d] ||= []).push(b); }); return m;
}
function renderOwnerCalendar(){
  if(!State.calMonth) State.calMonth=new Date(today()+'T12:00:00');
  const month=State.calMonth, y=month.getFullYear(), mo=month.getMonth();
  setText('calTitle', month.toLocaleDateString(State.lang==='en'?'en-GB':'ar', {month:'long', year:'numeric'}));
  const wd=$('#calWeekdays'); clear(wd);
  const wdFmt=new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'});
  for(let i=0;i<7;i++){ wd.append(h('div',{class:'cal-wd'}, wdFmt.format(new Date(2024,8,1+i)))); }   // 2024-09-01 = الأحد
  const grid=$('#calGrid'); clear(grid);
  const startDay=new Date(y,mo,1).getDay();
  const daysInMonth=new Date(y,mo+1,0).getDate();
  const byDate=ownerBookingsByDate(); const td=today();
  /* ⚠️ `cal-blank` لا `empty`: الثاني حالةُ فراغٍ عامّة في الورقة بحشوة
     `56px 28px` ⇒ ينتفخ عمودُ الخانة الفارغة ويسرق عرض جيرانه. انظر app.css. */
  for(let i=0;i<startDay;i++) grid.append(h('div',{class:'cal-cell cal-blank'}));
  for(let d=1; d<=daysInMonth; d++){
    const ds=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cnt=(byDate[ds]||[]).filter(b=>!['cancelled','rejected'].includes(normStatus(b))).length;
    const cell=h('button',{class:'cal-cell'+(ds===td?' today':'')+(cnt?' has':''), type:'button', dataset:{date:ds}},
      h('span',{class:'cal-d'}, String(d)), cnt?h('span',{class:'cal-dot'}, String(cnt)):null);
    cell.addEventListener('click', ()=>renderCalDay(ds));
    grid.append(cell);
  }
  // اعرض اليوم افتراضياً إن كان ضمن الشهر، وإلا أول يوم فيه حجوزات
  const def = (td.startsWith(`${y}-${String(mo+1).padStart(2,'0')}`)) ? td : Object.keys(byDate).filter(k=>k.startsWith(`${y}-${String(mo+1).padStart(2,'0')}`)).sort()[0];
  if(def) renderCalDay(def); else clear($('#calDayBookings'));
}
function renderCalDay(ds){
  const el=$('#calDayBookings'); if(!el) return;
  $$('#calGrid .cal-cell').forEach(c=>c.classList.toggle('sel', c.dataset.date===ds));
  const list=(ownerBookingsByDate()[ds]||[]).sort((a,b)=>Number(a.hour)-Number(b.hour));
  clear(el);
  el.append(h('div',{class:'sec-title', style:{padding:'0 0 10px'}}, h('span',{}, `${arabicDay(ds)} ${shortDate(ds)}`), h('span',{class:'mini-badge'}, String(list.length))));
  /* لوح الإغلاق فوق القائمة: التقويم هو المكان الطبيعي للسؤال «ماذا يجري في
     هذا اليوم؟»، والإغلاق جوابٌ عليه لا إجراءٌ منفصل في تبويب آخر. */
  el.append(closurePanel(ds));
  if(!list.length){ el.append(h('div',{class:'card', style:{textAlign:'center',color:'var(--soft)'}}, t('noBookingsDay'))); return; }
  list.forEach(b=> el.append(ownerBookingCard(b)));
}
/* ملخّص إغلاقات اليوم لملاعب هذا المالك + زرّ الفعل. */
function closurePanel(ds){
  const fields=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
  const box=h('div',{class:'card cl-panel', style:{marginBottom:'14px'}});
  const rows=[];
  fields.forEach(f=>{
    ((State.closures[String(f.field_id)]||{})[ds]||[]).forEach(c=> rows.push({ f, c }));
  });
  if(!rows.length){
    box.append(h('div',{class:'cl-state open'}, ico('check','svg-sm'), ' '+t('closeStateOpen')));
  } else {
    rows.forEach(({f,c})=>{
      const what = c.from===null
        ? (c.reason ? t('closeStateClosed',{r:c.reason}) : t('closeStateClosedNoReason'))
        : t('closeStateHours',{ from:fmtHour12(c.from), to:fmtHour12(c.to) }) + (c.reason ? ' — '+c.reason : '');
      const line=h('div',{class:'cl-state closed'},
        h('span',{class:'cl-f'}, f.field_name), h('span',{}, what));
      const undo=h('button',{class:'owner-action owner-edit cl-undo'}, t('closeReopenBtn'));
      undo.addEventListener('click', ()=>ownerReopenDay(undo, f, ds));
      line.append(undo);
      box.append(line);
    });
  }
  const add=h('button',{class:'owner-action owner-reject', style:{marginTop:'10px'}}, t('closeOpenBtn'));
  add.addEventListener('click', ()=>openClosure(ds));
  box.append(add);
  return box;
}
/* ===================== SPARKLINES (SVG خفيف — بلا مكتبات) =====================
   منحنى اتجاه صغير أسفل بطاقات الإحصاء. المدخلات تُطهَّر بـNumber (أرقام فقط)
   ⇒ حقن الـSVG كسلسلة آمن تماماً (لا بيانات مستخدم). */
function createSparkline(points, cls){
  const data=(points||[]).map(Number).filter(n=>Number.isFinite(n));
  if(data.length<2 || !data.some(n=>n>0)) return null;      // لا نرسم خطاً مسطّحاً على أصفار
  const W=100,H=26,P=2, max=Math.max(...data), min=Math.min(...data), span=(max-min)||1;
  const step=(W-P*2)/(data.length-1);
  const pts=data.map((v,i)=>[P+i*step, H-P-((v-min)/span)*(H-P*2)]);
  let dPath='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
  for(let i=1;i<pts.length;i++){                            // تنعيم بمنحنيات ربعية عبر نقاط المنتصف
    const mx=((pts[i-1][0]+pts[i][0])/2).toFixed(1), my=((pts[i-1][1]+pts[i][1])/2).toFixed(1);
    dPath+=' Q'+pts[i-1][0].toFixed(1)+','+pts[i-1][1].toFixed(1)+' '+mx+','+my;
  }
  const last=pts[pts.length-1];
  dPath+=' L'+last[0].toFixed(1)+','+last[1].toFixed(1);
  return h('span',{class:'sparkline'+(cls?' '+cls:''), 'aria-hidden':'true',
    html:'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
         '<path class="spark-fill" d="'+dPath+' L'+(W-P)+','+H+' L'+P+','+H+' Z"/>'+
         '<path class="spark-line" d="'+dPath+'"/></svg>'});
}
/* يثبّت سباركلاين أسفل بطاقة .stat-card الحاوية للعنصر المعطى (يستبدل القديم) */
function setSpark(anchorId, points, cls){
  const card=$('#'+anchorId)?.closest('.stat-card'); if(!card) return;
  card.querySelector('.sparkline')?.remove();
  const s=createSparkline(points, cls); if(s) card.append(s);
}
/* ===================== OWNER CHARTS (SVG فانيلا — بلا مكتبات) =====================
   القيم تُطهَّر بـNumber والتسميات مُولّدة داخليًا (أيام/ساعات) ⇒ حقن SVG آمن تماماً. */
function sanTxt(s){ return String(s).replace(/[<>&]/g,''); }
function createBarChart(data, opts){
  opts=opts||{};
  const n=data.length||1, vals=data.map(d=>Number(d.value)||0), max=Math.max(1,...vals);
  const W=Math.max(n*38,220), H=126, padB=22, padT=opts.showVal?18:8, slot=W/n, bw=Math.min(30, slot-12);
  let s='';
  data.forEach((d,i)=>{
    const cx=(i+0.5)*slot, v=Number(d.value)||0, bh=v/max*(H-padB-padT), y=H-padB-bh;
    s+='<rect class="bar-r" x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(bh,2).toFixed(1)+'" rx="4"/>';
    if(opts.showVal && v>0) s+='<text class="bar-v" x="'+cx.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle">'+Math.round(v)+'</text>';
    s+='<text class="bar-x" x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+sanTxt(d.label)+'</text>';
  });
  /* ⚠️ `role="img"` مع `aria-hidden="true"` **تناقض** وكانتا معًا هنا: الثانية
     تحذف العنصر من شجرة الوصول تمامًا فلا يبقى للأولى أثر. والاسم يُبنى من
     نفس المصفوفة المرسومة — «رسم بياني» اسمٌ عامّ يَعِد بمحتوى ولا يعطيه. */
  return h('div',{class:'chart-svg', html:'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+
    sanTxt(opts.label ? opts.label+' — '+chartSummary(data) : chartSummary(data))+'">'+s+'</svg>'});
}
/* ملخّصٌ منطوق من الأرقام: الأعلى بتسميته، ثمّ المتوسّط. */
function chartSummary(data){
  const vals=data.map(d=>Number(d.value)||0);
  if(!vals.length) return '';
  let top=0, ti=0; vals.forEach((v,i)=>{ if(v>top){ top=v; ti=i; } });
  const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  return t('chartAria',{ top:String(top), lbl:String(data[ti].label||''), avg:String(avg) });
}
function createDonut(pct, label){
  pct=Math.max(0,Math.min(100,Math.round(Number(pct)||0)));
  const r=42, c=2*Math.PI*r, off=c*(1-pct/100);
  return h('div',{class:'chart-donut-svg', html:
    '<svg viewBox="0 0 110 110" width="104" height="104" role="img" aria-label="'+sanTxt((label?label+' ':'')+pct+'%')+'">'+
    '<circle class="donut-bg" cx="55" cy="55" r="'+r+'"/>'+
    '<circle class="donut-fg" cx="55" cy="55" r="'+r+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 55 55)"/>'+
    '<text class="donut-num" x="55" y="53" text-anchor="middle">'+pct+'%</text>'+
    (label?'<text class="donut-lbl" x="55" y="69" text-anchor="middle">'+sanTxt(label)+'</text>':'')+
    '</svg>'});
}
/* 🔴 **`weekday:'short'` بالعربية = الاسم كاملًا** — لا اختصار فيه: يردّ Intl
   «الخميس» و«الأربعاء» كما هما، بينما الإنجليزية تردّ «Thu». والخانة في
   `createBarChart` عرضها 38 وحدة، فقاست «الخميس» **45.5** عند 12px ⇒ تتداخل
   التسميات فعلًا (ومعها «الأربعاء» 40.4 و«الجمعة» 38.8 — ثلاثٌ من سبع).
   والعلاج شقّان: خطٌّ أصغر في الورقة (‏10px)، **واختصارٌ صريح للعربية** بحذف
   أداة التعريف — «خميس» تقيس 30.6 داخل 38. ومصفوفة مكتوبة لا قصُّ نصّ: لا
   لغةَ ثالثةَ هنا، وقصُّ محرفين من مخرَج Intl يكسر عند أوّل لهجة تختلف. */
const AR_DOW_TIGHT = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
function chartDayLabel(ds){
  const d = new Date(ds+'T12:00:00');
  if(State.lang==='en'){
    try{ return new Intl.DateTimeFormat('en-GB',{weekday:'short'}).format(d); }catch(_){}
  }
  return AR_DOW_TIGHT[d.getDay()] || '';
}
function renderOwnerCharts(bookings){
  const fields=State.ownerData?.fields||[];
  const days=[...Array(7)].map((_,i)=>dateAfter(i-6));
  // 1) الإيراد اليومي (المؤكّد فقط)
  const revData=days.map(ds=>({ label: chartDayLabel(ds),
    value: bookings.filter(b=>String(b.date||'').split('T')[0]===ds && normStatus(b)==='confirmed').reduce((s,b)=>s+(Number(b.price)||0),0) }));
  const rc=$('#ownerRevChart'); if(rc){ clear(rc); rc.append( revData.some(d=>d.value>0) ? createBarChart(revData,{showVal:false, label:t('chartRevenue')}) : h('div',{class:'chart-empty'}, t('noData')) ); }
  // 2) إشغال الأسبوع (نفس منطق renderOwnerEcon)
  const dset=new Set(days);
  const confW=bookings.filter(b=>dset.has(String(b.date||'').split('T')[0]) && normStatus(b)==='confirmed');
  const totalSlots=fields.reduce((s,f)=>s+fieldSlots(f).length,0)*7;
  const oc=$('#ownerOccChart'); if(oc){ clear(oc); oc.append(createDonut(calcPercent(confW.length,totalSlots), t('occupancy'))); }
  // 3) التوزيع حسب الساعة (المؤكّد)
  const byHour={}; bookings.filter(b=>normStatus(b)==='confirmed').forEach(b=>{ const hr=Number(b.hour); if(!Number.isNaN(hr)) byHour[hr]=(byHour[hr]||0)+1; });
  const hrs=Object.keys(byHour).map(Number).sort((a,b)=>a-b);
  const hc=$('#ownerHoursChart'); if(hc){ clear(hc); hc.append( hrs.length ? createBarChart(hrs.map(hr=>({label:hr+':00', value:byHour[hr]})),{showVal:true, label:t('chartHours')}) : h('div',{class:'chart-empty'}, t('noData')) ); }
}
function renderOwnerStats(bookings){
  const confirmed=bookings.filter(b=>normStatus(b)==='confirmed');
  const fromWeb=confirmed.filter(b=>!isOwnerManual(b)); const manual=confirmed.filter(isOwnerManual);
  const pending=bookings.filter(b=>normStatus(b)==='pending');
  const td=today(), weekStart=dateAfter(-6);
  const todayCount=bookings.filter(b=>String(b.date)===td).length;
  const weekCount=bookings.filter(b=>String(b.date||'')>=weekStart && String(b.date)<=td).length;
  const webRev=fromWeb.reduce((s,b)=>s+(Number(b.price)||0),0);
  const manualRev=manual.reduce((s,b)=>s+(Number(b.price)||0),0);
  const profit=webRev*CONFIG.COMMISSION; const net=webRev-profit+manualRev;
  const rate=bookings.length?Math.round((confirmed.length/bookings.length)*100):0;
  const topField=getTopBy(bookings,b=>String(b.field_id||''),b=>b.field_name||'-');
  const topSource=getTopBy(bookings,b=>String(b.source||'direct').trim()||'direct',b=>String(b.source||'direct').trim()||'direct');
  setText('oTotal',bookings.length); setText('oConfirmed',confirmed.length); setText('oPending',pending.length); setText('oToday',todayCount);
  setText('oWeek',`${t('last7')}: ${weekCount}`); setText('oRevenue',formatMoney(webRev)); setText('oProfit',formatMoney(profit)); setText('oNet',formatMoney(net));
  setText('oRate',rate+'%'); requestAnimationFrame(()=>{ const bar=$('#oRateBar'); if(bar)bar.style.width=Math.min(rate,100)+'%'; });
  setText('oTopField', topField?`${topField.label} (${topField.count})`:'-'); setText('oTopSource', topSource?`${topSource.label} (${topSource.count})`:'-');
  // اتجاه آخر 14 يوماً: كل الطلبات (بطاقة الكل) + المؤكدة (بطاقتها، بلون النعناع)
  const days14=[...Array(14)].map((_,i)=>dateAfter(i-13));
  setSpark('oTotal', days14.map(ds=>bookings.filter(b=>String(b.date)===ds).length));
  setSpark('oConfirmed', days14.map(ds=>confirmed.filter(b=>String(b.date)===ds).length), 'spark-ok');
}
function renderOwnerEcon(bookings){
  const fields=State.ownerData?.fields||[]; const days=new Set(Array.from({length:7},(_,i)=>dateAfter(i)));
  const week=bookings.filter(b=>days.has(String(b.date||'').split('T')[0]));
  const confW=week.filter(b=>normStatus(b)==='confirmed');
  /* ⚠️ الطاقة = الخانات **المفتوحة** لا كل الخانات (ترحيل 17). بلا هذا تُقرأ
     جمعةُ الصيانة «إيرادًا ضائعًا» إلى الأبد، ويهبط الإشغال بلا أن يكون
     المالك أخطأ في شيء — وهو الرقم الذي تُبنى عليه كل نصيحة في اللوحة. */
  let totalSlots=0;
  for(let i=0;i<7;i++){ const d=dateAfter(i); fields.forEach(f=>{ if(f.active!==false) totalSlots+=openSlotsFor(f, d).length; }); }
  const occ=calcPercent(confW.length,totalSlots);
  const avgPrice=fields.length?fields.reduce((s,f)=>s+(Number(f.price)||0),0)/fields.length:0;
  const lost=Math.round(Math.max(totalSlots-confW.length,0)*avgPrice);
  const cancelled=bookings.filter(b=>['cancelled','rejected'].includes(normStatus(b)));
  const cancelRate=calcPercent(cancelled.length,bookings.length);
  const confAll=bookings.filter(b=>normStatus(b)==='confirmed');
  const webShare=calcPercent(confAll.filter(isWebsite).length, confAll.length);
  const hourTop=getTopBy(confAll,b=>String(b.hour||''),b=>b.time||((b.hour||'-')+':00'));
  const phones={}; confAll.forEach(b=>{const k=normalizePhone(b.phone||'')||String(b.player_id||''); if(k)phones[k]=(phones[k]||0)+1;});
  const uniq=Object.keys(phones).length; const ret=Object.values(phones).filter(c=>c>1).length;
  const returnRate=calcPercent(ret,uniq);
  let decision=t('econMore');
  if(occ<40)decision=t('econLow');
  else if(occ>=60&&occ<=80)decision=t('econGood');
  else if(occ>=85)decision=t('econHigh');
  setText('oOccupancy',occ+'%'); setText('oLost',formatMoney(lost)); setText('oCancel',cancelRate+'%');
  setText('oBestTime',hourTop?hourTop.label:'-'); setText('oWebShare',webShare+'%'); setText('oReturn',returnRate+'%'); setText('oDecision',decision);
  /* «لم يحضر» — عدداً وقيمةً. البلاطة تظهر حين يوجد ما يُعرَض فعلاً: صفرٌ
     دائم قبل ترحيل 16 يُقرأ «ما في تخلّف عن الحضور»، وهو ادّعاء لا قياس. */
  const noShows = confAll.filter(isNoShow);
  const nsItem = $('#oNoShowItem');
  if (nsItem){
    const on = noShows.length > 0;
    nsItem.hidden = !on;
    if (on) setText('oNoShow', `${noShows.length} · ${formatMoney(noShows.reduce((s,b)=>s+(Number(b.price)||0),0))}`);
  }
}
/* ═══ مهلة ردّ المالك (١.٢) ═══════════════════════════════════════════════
   الموعد النهائي = **الأقرب** من: وصول الطلب + المهلة · وبدء الخانة نفسها.
   والثاني ليس تفصيلًا: طلبٌ لمباراة الليلة لا يملك حتى الغد ليُردّ عليه —
   بدونه يبقى الطلب معلّقًا **بعد** أن يمرّ موعده، حاجزًا خانةً مضت.
   نفس الحساب حرفيًّا في `public.booking_reply_deadline` (ترحيل 15). */
function replyDeadlineMs(b){
  const created = new Date(String(b.timestamp||'').replace(' ','T')).getTime();
  const start = slotStartMs(b);
  const byAge = Number.isNaN(created) ? NaN : created + CONFIG.REPLY_DEADLINE_H*3600e3;
  const cands = [byAge, start].filter(v => !Number.isNaN(v));
  return cands.length ? Math.min(...cands) : NaN;
}
/* ثلاث حالات: مريحة · تحت العتبة (برتقالي) · فاتت (أحمر).
   والنصّ من Intl لا من أيدينا — المعدود العربي يتغيّر مع العدد. */
function replyDeadlineChip(b){
  if(normStatus(b)!=='pending') return null;
  const dl = replyDeadlineMs(b); if(Number.isNaN(dl)) return null;
  const left = dl - Date.now();
  if(left <= 0) return { label:t('deadlineOver'), cls:'dl-over' };
  return { label:t('deadlineLeft',{ rel: relFromNow(left) }),
           cls: left <= CONFIG.REPLY_WARN_H*3600e3 ? 'dl-warn' : 'dl-ok' };
}

/* عمر الطلب المعلّق «منذ …» — لون يشتد مع التأخر لتحفيز سرعة الردّ */
function bookingAge(b){
  if(normStatus(b)!=='pending') return null;
  const d=new Date(String(b.timestamp||'').replace(' ','T'));
  if(Number.isNaN(d.getTime())) return null;
  const mins=Math.max(0, Math.floor((Date.now()-d.getTime())/60000));
  const label = mins<1 ? t('ageNow') : mins<60 ? t('ageMin',{n:mins}) : mins<1440 ? t('ageHr',{n:Math.floor(mins/60)}) : t('ageDay',{n:Math.floor(mins/1440)});
  return { label, cls: mins<15?'age-ok' : mins<60?'age-warn' : 'age-late' };
}
function ownerBookingCard(b){
  const lbl=statusLabel(runtimeStatus(b));
  const age=bookingAge(b);
  const dl=replyDeadlineChip(b);
  const card=h('div',{class:'card booking-strip '+normStatus(b)+(isNoShow(b)?' bk-noshow':''), style:{marginBottom:'14px'}},
    h('div',{style:{display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'flex-start',marginBottom:'9px'}},
      h('div',{class:'owner-bk-head'},
        // أفاتار أحرف العميل (م4، نمط المرجع) — تمييز بصري سريع لصاحب الحجز
        h('span',{class:'owner-bk-av','aria-hidden':'true'}, initials(b.name)),
        h('div',{style:{minWidth:'0'}},
          h('div',{style:{fontSize:'14px',fontWeight:'900',color:'var(--ink)'}}, b.field_name),
          /* ⚠️ اسم المكان **عند التعدّد وحده**: أسماء الملاعب تتشابه بين مجمّعين
             («ملعب ١» هنا و«ملعب ١» هناك)، فبطاقةٌ بلا مكان تُقرأ في المكان
             الخطأ. ولمالكِ مكانٍ واحد سطرٌ يكرّر ما في الرأس ⇒ لا يُعرَض. */
          ownerPlaces().length > 1
            ? h('div',{class:'info-line muted', style:{marginTop:'3px'}}, ico('pin','svg-sm'), ' ', h('bdi',{}, b.place_name||''))
            : null,
          h('div',{style:{display:'flex',gap:'10px',marginTop:'4px',flexWrap:'wrap'}},
            h('span',{class:'info-line muted'}, ico('cal','svg-sm'), ' '+b.date),
            h('span',{class:'info-line muted'}, ico('clock','svg-sm'), ' '+b.time)))),
      h('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'5px'}},
        h('span',{class:'badge '+lbl.c}, lbl.t),
        isNoShow(b) ? h('span',{class:'badge badge-red'}, t('noShowBadge')) : null,
        age && h('span',{class:'age-chip '+age.cls}, '⏱ '+age.label),
        // العدّاد تحت العمر: العمر يقول «منذ متى وصل»، والعدّاد يقول «كم بقي» —
        // والثاني هو الذي يُحرّك، والأوّل هو الذي يُفسّر.
        dl && h('span',{class:'dl-chip '+dl.cls}, dl.label))),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'11px'}},
      h('span',{class:'info-line'}, ico('person','svg-sm'), ' '+(b.name||'-')),
      h('span',{class:'info-line'}, ico('phone','svg-sm'), ' '+(b.phone||'-')),
      h('span',{class:'info-line'}, ico('resize','svg-sm'), ' '+(b.players||'-')),
      h('span',{class:'info-line'}, ico('money','svg-sm'), ' '+formatCurrency(b.price||0)),
      h('span',{class:'info-line', style:{color:isOwnerManual(b)?'#2563eb':'var(--ink-2)'}}, isOwnerManual(b)?t('externalBooking'):t('srcPrefix')+(b.source||'direct')))
  );
  /* (٤.٥) المالك يعرف شيئًا واحدًا جديدًا: هذا الحجز مباراة مفتوحة وكم عددها.
     ولا يُدير مقاعد ولا يرى منضمّين — ومسؤوليّته **لم تتغيّر**: حجزٌ واحد،
     صاحبُ حجزٍ واحد، دافعٌ واحد. والسطر يقول ذلك صراحةً كي لا يظنّ أنه صار
     مطالَبًا بتحصيل عشر حصص عند البوّابة.
     🔴 **وتُعرَض على المعلّقة كذلك، لا على المؤكّدة وحدها.** كانت مشروطة بـ
     `confirmed` ⇒ المالك يضغط «قبول» وهو **لا يعرف** أن الطلب مباراة مفتوحة
     يأتيها حتى `needed` لاعبًا؛ فيكتشف العدد بعد أن يصير التزامًا. والقرار
     الذي تُغيّره المعلومة هو قرار القبول نفسه، فمكانها قبله لا بعده. */
  if (b.visibility === 'open'){
    const total=Number(b.needed||0), live = normStatus(b)==='confirmed';
    card.append(h('div',{class:'own-open'},
      h('span',{class:'own-open-badge'+(live?'':' pending')}, t(live?'gmBadgeLive':'gmBadgeWaiting'), ' · ',
        // العدد الذي يهمّ المالك واحد: **كم إنسانًا يدخل ملعبه** — لا تفصيل
        // المقاعد (منشور/مُحضَر) وهو شأن المضيف. و«حتى» لأن المقاعد قد لا تمتلئ.
        t('gmOwnerUpTo', { n: total })),
      h('span',{class:'own-open-note'}, t('gmOwnerNote'))));
  }
  if (isExpiredBooking(b)) card.append(h('div',{class:'reason-box', style:{marginTop:'0',marginBottom:'11px'}}, t('expiredReason')));
  else if (b.cancel_reason) card.append(h('div',{class:'reason-box', style:{marginTop:'0',marginBottom:'11px'}}, t('cancelReasonPrefix')+b.cancel_reason));
  const mk=(cls,txt,st)=>{ const x=h('button',{class:'owner-action '+cls}, txt); x.addEventListener('click',()=>updateBookingStatus(x,b.row_number,st)); return x; };
  const waBtn=()=>h('a',{href:'https://wa.me/'+String(b.phone||'').replace(/^0/,'962'),target:'_blank',rel:'noopener',class:'owner-wa-link'}, h('button',{class:'owner-action owner-wa'}, ico('wa','svg-sm'), ' '+t('actWhatsapp')));
  if (normStatus(b)==='pending'){
    // طلب معلّق: قبول/رفض بارزان بعرض كامل (مرجع لوحة المالك) + واتساب ثانوي
    card.append(h('div',{class:'owner-decide'},
      mk('owner-approve','✓ '+t('actApprove'),'confirmed'),
      mk('owner-decline','✕ '+t('actDecline'),'rejected')));
    card.append(h('div',{class:'owner-actions-sec'}, waBtn()));
  } else {
    const actions=h('div',{style:{display:'flex',gap:'7px',flexWrap:'wrap'}});
    /* 🔴 **الأزرار تتبع الحالة** (بلاغ المالك 2026-08-13). كانت الحالات الثلاث
       غير المعلّقة تعرض الأربعة نفسها، فيقرأ المالك «أكّد + واتساب» على حجزٍ
       **أكّده هو بنفسه** — زرٌّ يعرض فعلًا وقع سلفًا، وضغطُه يعيد كتابة الحالة
       نفسها فلا يحدث شيء ظاهر. والقاعدة: لا يُعرَض إلّا ما يُغيّر شيئًا.
       • **مؤكّد** ⇒ الإلغاء وحده (ومعه «لم يحضر» بعد انتهاء الخانة).
       • **ملغى/مرفوض** ⇒ «أكّد» وحده، فهو المخرج الوحيد من رفضٍ بالخطأ.
       والواتساب يبقى في الحالتين: التواصل ليس تغييرًا في الحالة. */
    if(normStatus(b)==='confirmed'){
      actions.append(mk('owner-cancel',t('actCancel'),'cancelled'));
    } else {
      actions.append(mk('owner-confirm',t('actConfirmWa'),'confirmed'));
    }
    actions.append(waBtn());
    /* «لم يحضر» على المؤكّد **بعد انتهاء خانته** وحده. الشرطان نفسهما في
       `fn_booking_no_show_guard` — الواجهة لا تعرض ما سيرفضه الخادم، والخادم
       لا يثق بما تعرضه الواجهة. والزرّ يظهر في الحالتين (تعليم ورجوع) لأن
       علامةً لا تُرفَع يتجنّبها صاحبها فيموت المقياس. */
    if (normStatus(b)==='confirmed' && isFinished(b)){
      const ns=h('button',{class:'owner-action '+(isNoShow(b)?'owner-edit':'owner-reject')},
        isNoShow(b) ? t('noShowUndoBtn') : t('noShowBtn'));
      ns.addEventListener('click', ()=>ownerToggleNoShow(ns, b));
      actions.append(ns);
    }
    card.append(actions);
  }
  return card;
}
/* تعليم/رفع «لم يحضر». التأكيد يقول ما يحدث بالضبط، **ولا يَعِد بتحصيل**:
   التطبيق لا يمسّ مالًا (لا بوّابة دفع أصلًا)، والتحصيل بين المالك واللاعب. */
async function ownerToggleNoShow(btn, b){
  const on = !isNoShow(b);
  const ok = await askConfirm(t(on?'noShowAskTitle':'noShowUndoAskTitle'),
                              t(on?'noShowAskMsg':'noShowUndoAskMsg'),
                              t(on?'noShowBtn':'noShowUndoBtn'), null, on);
  if(!ok) return;
  await withLoading(btn, async()=>{
    try{
      const res = await API.post({ action:'ownerSetNoShow', owner_token:Session.owner(), row_number:b.row_number, no_show:on });
      if(!res || !res.success){ toast(apiMsg(res&&res.message)||t('noShowFail'),'error'); return; }
      toast(res.message,'success');
      await loadOwnerDashboard();
    }catch(e){ if(!isAbort(e)) toast(t('noShowFail'),'error'); }
  });
}
/* ═══════════ شرائح فلاتر المالك (ج-٤) ═══════════════════════════════════
   **نفس مكوّن جهة اللاعب** (‏`.fchip` و`fchipRemove` و`clearAll`) لا نسخة ثانية
   من المنطق. والفارق الوحيد أن مصدر الحالة هنا هو **عناصر HTML نفسها** لا
   `State.fx`: الفلاتر أربعةٌ ثابتة في الوسم، فمرآةٌ لها في `State` كانت ستصير
   حقيقتين تنحرفان.
   ⚠️ وإخفاء الغلاف بـ`hidden` لا بشفافية: صفٌّ فارغ يأكل ارتفاعًا بلا محتوى. */
function ownerChipList(){
  const out=[];
  const dt=$('#ownerDateFilter'), fd=$('#ownerFieldFilter'), st=$('#ownerStatusFilter'), se=$('#ownerSearch');
  if(dt && dt.value) out.push({ label: shortDate(dt.value), remove:()=>{ dt.value=''; } });
  if(fd && fd.value && fd.value!=='all'){
    const nm=(fd.options[fd.selectedIndex]||{}).text || fd.value;
    out.push({ label:nm, remove:()=>{ fd.value='all'; } });
  }
  if(st && st.value && st.value!=='all'){
    const nm=(st.options[st.selectedIndex]||{}).text || st.value;
    out.push({ label:nm, remove:()=>{ st.value='all'; } });
  }
  if(se && se.value.trim()) out.push({ label:'“'+se.value.trim()+'”', remove:()=>{ se.value=''; } });
  return out;
}
function renderOwnerChips(){
  const bar=$('#obfChips'); if(!bar) return;
  const list=ownerChipList();
  clear(bar);
  if(!list.length){ bar.hidden=true; return; }
  bar.hidden=false;
  list.forEach(c=>{
    const b=h('button',{class:'fchip', type:'button', 'aria-label':t('fchipRemove',{v:c.label})},
      h('span',{class:'fchip-lbl'}, c.label), ico('x','fchip-x'));
    b.addEventListener('click', ()=>{ c.remove(); buzz(6); renderOwnerBookings(); });
    bar.append(b);
  });
  if(list.length>1){
    const clr=h('button',{class:'fchip fchip-clear', type:'button'}, t('clearAll'));
    clr.addEventListener('click', ()=>{ buzz(8); Actions.clearFilters(); });
    bar.append(clr);
  }
}
function renderOwnerBookings(){
  const d=State.ownerData; if(!d) return;
  let bookings=d.bookings||[];
  const date=$('#ownerDateFilter').value; const fieldId=$('#ownerFieldFilter').value;
  const status=$('#ownerStatusFilter')?.value||'all';
  const raw=($('#ownerSearch')?.value||'').trim(); const q=normalizeText(raw); const qd=raw.replace(/\D/g,'');
  renderOwnerChips();
  if (!State.showAllOwner) bookings=visibleBookings(bookings,30,false);
  if (date) bookings=bookings.filter(b=>String(b.date)===date);
  if (fieldId&&fieldId!=='all') bookings=bookings.filter(b=>String(b.field_id)===String(fieldId));
  if (status!=='all') bookings=bookings.filter(b=>normStatus(b)===status);
  if (raw) bookings=bookings.filter(b=> normalizeText(b.name).includes(q) || (qd && String(b.phone||'').replace(/\D/g,'').includes(qd)) );
  const tgl=$('#ownerHistoryToggle'); if(tgl) tgl.textContent=State.showAllOwner?t('hideOld'):t('fullHistory');
  const el=$('#ownerBookings'); clear(el);
  if(!bookings.length){
    el.append(emptyState({icon:'🗓️', title:t('noMatchBookings'), sub:t('noMatchBookingsSub'),
      actionLabel:t('clearFilter'), action:()=>Actions.clearFilters(),
      secondaryLabel:State.showAllOwner?null:t('fullHistory'), secondaryAction:()=>{ State.showAllOwner=true; renderOwnerBookings(); }}));
    return;
  }
  const {active,finished}=splitFinished(bookings);
  const grouped=(list)=>{
    const g={}; list.forEach(b=>{(g[String(b.date)] ||= []).push(b);});
    const td=today(), tm=dateAfter(1);
    Object.keys(g).sort().forEach(date=>{
      const dayB=g[date].sort((a,b)=>Number(a.hour)-Number(b.hour));
      const c=dayB.filter(b=>normStatus(b)==='confirmed').length, p=dayB.filter(b=>normStatus(b)==='pending').length, x=dayB.filter(b=>['cancelled','rejected'].includes(normStatus(b))).length;
      const isToday=date===td, isPast=date<td;
      const lbl = date===td?`${t('today')} — ${arabicDay(date)} ${shortDate(date)}` : date===tm?`${t('tomorrow')} — ${arabicDay(date)} ${shortDate(date)}` : `${arabicDay(date)} ${shortDate(date)}`;
      const pills=h('div',{class:'pills'});
      if(c)pills.append(h('span',{},`✓ ${c}`)); if(p)pills.append(h('span',{},`⏳ ${p}`)); if(x)pills.append(h('span',{},`✕ ${x}`));
      const wrap=h('div',{style:{marginBottom:'22px'}},
        h('div',{class:'day-group '+(isToday?'today':isPast?'past':'future')}, h('span',{}, lbl), pills));
      dayB.forEach(b=>wrap.append(ownerBookingCard(b)));
      el.append(wrap);
    });
  };
  if (active.length){ el.append(sectionTitle(t('ownerActiveUpcoming'),active.length)); grouped(active); }
  else el.append(h('div',{class:'card',style:{textAlign:'center',color:'var(--soft)',marginBottom:'11px'}},t('noActiveUpcoming')));
  if (finished.length){ el.append(sectionTitle(t('ownerFinished'),finished.length)); grouped(finished); }
}
function renderOwnerFields(){
  const el=$('#ownerFields'); const fields=State.ownerData.fields||[]; clear(el);
  if(!fields.length){ el.append(emptyState({icon:'🥅',title:t('noFieldsTitle'),sub:t('noFieldsSub'),actionLabel:t('addFieldBtn'),action:openAddField})); return; }
  fields.forEach(f=>{
    const isOn = f.active!==false;
    const edit=h('button',{class:'owner-action owner-edit'}, t('edit')); edit.addEventListener('click',()=>openEditField(f.field_id));
    // «التسعير» بجانب «تعديل»: الأوّل يغيّر السعر الأساسي، والثاني يبني عليه
    // قواعد الساعات. فصلُهما مقصود — أحدهما رقمٌ واحد والآخر جدول.
    const pricing=h('button',{class:'owner-action owner-confirm'}, t('pricingBtn')); pricing.addEventListener('click',()=>openPricing(f.field_id));
    // مبدّل تشغيل/إيقاف الملعب (مرجع لوحة المالك) — يستدعي ownerUpdateField الموجود
    const sw=h('button',{class:'field-switch'+(isOn?' on':''), type:'button', role:'switch', 'aria-checked':isOn?'true':'false', 'aria-label':t(isOn?'fieldActive':'fieldInactive')}, h('span',{class:'field-switch-knob'}));
    sw.addEventListener('click',()=>toggleFieldActive(f, sw));
    // مصغّرة صورة الملعب (م4، نمط المرجع «إدارة الملاعب») — وإن غابت الصورة فأيقونة كرة
    const thumbSrc=fieldImages(f)[0];
    const thumb=h('div',{class:'field-thumb'}, thumbSrc
      ? h('img',{src:thumbSrc, alt:'', width:'104', height:'104', loading:'lazy', decoding:'async'})
      : h('span',{html:ICON.ball, 'aria-hidden':'true'}));
    el.append(h('div',{class:'card field-card'+(isOn?'':' field-off'), style:{marginBottom:'14px'}},
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}},
        h('div',{class:'field-row-main'},
        thumb,
        h('div',{style:{minWidth:'0'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}},
            h('div',{style:{fontSize:'14px',fontWeight:'900',color:'var(--ink)'}}, f.field_name),
            !isOn && h('span',{class:'field-off-badge'}, t('fieldInactive'))),
          h('div',{style:{display:'flex',gap:'10px',marginTop:'5px'}},
            h('span',{class:'info-line muted'}, ico('resize','svg-sm'), ' '+f.size),
            h('span',{class:'info-line muted'}, ico('money','svg-sm'), ' '+formatCurrency(f.price))),
          h('div',{style:{fontSize:'11px',color:'var(--soft)',marginTop:'3px'}}, t('slotsLbl')+': '+t({full:'kwFull',morning:'kwMorning',evening:'kwEvening'}[slotsToKeyword(f.slots)]||'kwFull')))),
        h('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:'0'}}, sw, edit, pricing))));
  });
}
/* تبديل تشغيل/إيقاف ملعب مباشرة (بلا فتح نافذة) عبر ownerUpdateField القائم */
function toggleFieldActive(f, sw){
  const next=!(f.active!==false);
  sw.disabled=true;
  API.post({ action:'ownerUpdateField', owner_token:Session.owner(), field_id:f.field_id, price:f.price, slots:slotsToKeyword(f.slots), active:next })
    .then(res=>{
      if(res && res.success){
        f.active=next; try{ localStorage.removeItem(CONFIG.CACHE_KEY); }catch(_){}
        toast(t(next?'fieldEnabled':'fieldDisabled'),'success');
        renderOwnerFields(); loadData({force:true});
      } else { toast(apiMsg(res&&res.message)||t('fieldFail'),'error'); sw.disabled=false; }
    })
    .catch(err=>{ if(!isAbort(err)) toast(t('fieldErr'),'error'); sw.disabled=false; });
}

/* ===================== OWNER · AI (مستشار الأعمال · التقييمات · الطقس) =====================
   ثلاث لوحات تُجلب من الباكند (aiInsights/aiReviews/aiWeather) بكاش خادمي 3-6 ساعات.
   هنا: كاش جلسة حسب اللغة + هيكل تحميل + عزل كامل للأخطاء (فشل AI لا يمسّ بقية اللوحة). */
const AI_TYPE_ICON = { pricing:'💰', marketing:'📣', schedule:'🗓️', warning:'⚠️', opportunity:'✨' };
const WEATHER_EMOJI = { sunny:'☀️', cloudy:'⛅', fog:'🌫️', rain:'🌧️', snow:'❄️', storm:'⛈️' };
function aiState(){ return (State.ai ||= {}); }
function aiSkeleton(n=3){
  const box=h('div',{class:'ai-skel','aria-hidden':'true'}); const w=['w88','w70','w45'];
  for(let i=0;i<n;i++) box.append(h('div',{class:'sk sk-line '+w[i%3]}));
  return box;
}
/* رسالة فشل موحّدة + زر إعادة محاولة (لا زر عند غياب مفتاح الـAPI — الحل عند المالك لا هنا) */
/* الأكواد التي **لا يُعيدها زرُّ المحاولة**: علّتها عند المالك لا في الشبكة —
   دالّة غير منشورة · مفتاح غير مضبوط · تاريخ أقصر من أسبوع. زرُّ «أعد المحاولة»
   عليها يَعِد بما لن يقع، ويُدرِّب صاحبه على أن يضغطه بلا فائدة. */
const AI_TERMINAL = ['ai_not_configured','ai_not_deployed','not_enough_data','no_place'];
function aiErrorBox(res, retry){
  const code=res&&res.code;
  const msg = code==='ai_not_configured' ? t('aiNotConfigured')
            : code==='ai_not_deployed'  ? t('aiNotDeployed')
            : code==='not_enough_data'  ? t('aiNeedHistory',{n:(res&&res.days)||0})
            : code==='no_place'         ? t('aiNoPlace')
            : code==='weather_failed' ? t('aiWeatherFail')
            : code==='timeout' ? t('apiTimeout') : t('aiFail');
  const box=h('div',{class:'ai-alert'+(AI_TERMINAL.includes(code)?' info':'')}, msg);
  if(retry && !AI_TERMINAL.includes(code)){
    const l=h('span',{class:'link',role:'button',tabindex:'0'}, t('aiRetry'));
    l.addEventListener('click',retry);
    l.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); retry(); } });
    box.append(l);
  }
  return box;
}
/* جالب موحّد للوحات الثلاث: يتخطّى الجلب إن كانت النتيجة محفوظة بنفس اللغة */
async function loadAi(kind, targetSel, render, force){
  const el=$(targetSel); if(!el || !Session.owner()) return;
  const ai=aiState(), lang=(State.lang==='en'?'en':'ar');
  if(ai[kind] && ai[kind+'Lang']===lang && !force){ render(); return; }
  if(ai[kind+'Loading']) return;
  ai[kind+'Loading']=true;
  clear(el); el.append(kind==='weather' ? h('div',{class:'ai-weather'}, aiSkeleton()) : aiSkeleton());
  try{
    let res = await API.getAi(kind, { lang }, 'ai_'+kind);
    /* الطقس **لا يحتاج الدالّة ولا مفتاحًا**: Open-Meteo عامّة بلا مفتاح
       وتسمح بالقراءة من المتصفّح. فإن لم تُنشَر الدالّة نجلبه مباشرةً هنا
       ونكتب النصيحة بقاعدة ثابتة. غيابُ مفتاحِ نموذجٍ يكلّفك الجملة لا البيانات. */
    if(kind==='weather' && res && !res.success && (res.code==='ai_not_deployed' || res.code==='ai_not_configured')){
      const local = await fetchWeatherLocal();
      if(local) res = local;
    }
    ai[kind]=res; ai[kind+'Lang']=lang;
    if(res && !res.success) console.warn('AI ['+kind+'] failed — code:', res.code||'(none)', res.detail?('· detail: '+res.detail):'');
  }catch(e){
    if(isAbort(e)){ ai[kind+'Loading']=false; return; }
    ai[kind]={ success:false, code:isTimeout(e)?'timeout':'network' }; ai[kind+'Lang']=lang;
  }
  ai[kind+'Loading']=false;
  try{ render(); }catch(err){ console.error('ai render ['+kind+'] failed:', err); }
}
const loadAiInsights=(force)=>loadAi('insights','#aiInsights',renderAiInsights,force);
const loadAiReviews=(force)=>loadAi('reviews','#aiReviews',renderAiReviews,force);
const loadAiWeather=(force)=>loadAi('weather','#aiWeatherWrap',renderAiWeather,force);

/* ── الطقس بلا خادم ──────────────────────────────────────────────────────
   Open-Meteo واجهة عامّة **بلا مفتاح** وترسل `Access-Control-Allow-Origin: *`
   ⇒ يجلبها المتصفّح مباشرةً. فالتوقّعات نفسها لا تتوقّف على شيء عند المالك،
   ولا يبقى معلَّقًا عليه إلّا جملةُ النصيحة. والنصيحة هنا **قاعدة ثابتة**
   لا نموذج، ولذلك تُوسَم `ai:false` فتكتب الواجهة «نصيحة تلقائية» لا
   «ذكاء اصطناعي» — الوسم يقول ما هو، ولا يُنسَب إلى النموذج ما لم يكتبه. */
const WX_CITY = {
  'عمان':[31.95,35.93], 'عمّان':[31.95,35.93], 'amman':[31.95,35.93],
  'الزرقاء':[32.07,36.09], 'zarqa':[32.07,36.09],
  'اربد':[32.55,35.85], 'إربد':[32.55,35.85], 'irbid':[32.55,35.85],
  'العقبة':[29.53,35.01], 'aqaba':[29.53,35.01], 'السلط':[32.04,35.73], 'salt':[32.04,35.73],
  'مادبا':[31.72,35.79], 'madaba':[31.72,35.79], 'جرش':[32.27,35.89], 'jerash':[32.27,35.89],
  'عجلون':[32.33,35.75], 'ajloun':[32.33,35.75], 'الكرك':[31.18,35.70], 'karak':[31.18,35.70],
  'معان':[30.19,35.73], 'maan':[30.19,35.73], 'الطفيلة':[30.84,35.60], 'tafilah':[30.84,35.60],
  'المفرق':[32.34,36.21], 'mafraq':[32.34,36.21],
};
const wxCategory = (c) => c===0?'sunny' : c<=3?'cloudy' : (c===45||c===48)?'fog'
  : (c>=51&&c<=67)?'rain' : (c>=71&&c<=77)?'snow' : (c>=80&&c<=82)?'rain'
  : (c>=85&&c<=86)?'snow' : c>=95?'storm' : 'cloudy';
async function fetchWeatherLocal(){
  const city = String(State.ownerData?.place?.city || '').trim().toLowerCase();
  const [lat, lon] = WX_CITY[city] || [31.95, 35.93];
  try{
    const r = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=3&timezone=Asia%2FAmman`, {}, CONFIG.API_TIMEOUT, 'wxLocal');
    if(!r.ok) return null;
    const d = (await r.json()).daily; if(!d || !d.time) return null;
    const days = d.time.map((date,i)=>({
      date, category: wxCategory(Number(d.weather_code[i])),
      tmax: Math.round(d.temperature_2m_max[i]), tmin: Math.round(d.temperature_2m_min[i]),
      rain_prob: Math.round(d.precipitation_probability_max[i]||0),
      wind_kmh: Math.round(d.wind_speed_10m_max[i]||0),
    }));
    return { success:true, ai:false, days, generated_at:new Date().toISOString() };
  }catch(_){ return null; }
}
/* شدّة التنبيه وجملته بقواعد ثابتة — تُقرأ من نفس الأرقام المعروضة فوقها،
   فلا تقول شيئًا لا يستطيع القارئ التحقّق منه بعينه. */
function wxRuleAdvice(days){
  const rain = Math.max(0, ...days.map(d=>d.rain_prob||0));
  const heat = Math.max(0, ...days.map(d=>d.tmax||0));
  const rough = days.some(d=>d.category==='storm'||d.category==='snow');
  const severity = (rough || rain>=60) ? 'danger' : (rain>=35 || heat>=38) ? 'warn' : 'info';
  return { severity, title: t('wxT_'+severity), advice: t('wxA_'+severity) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   تحليل محسوب — لا نموذج، ولا يُسمّى ذكاءً اصطناعيًّا

   حين لا تكون الدالّة منشورة أو المفتاح مضبوطًا، البديلُ ليس لوحًا فارغًا ولا
   دوّامة لا تنتهي: **جُملٌ كلٌّ منها من رقم مقيس في `State.ownerData`** — نفس
   منطق «ماذا تقول الأرقام؟» في `/admin`. وكلٌّ منها يُنشَر فقط إن كان الرقم
   الذي يسنده موجودًا؛ وما تعجز عنه الأرقام لا يُقال (م5).
   ⚠️ والوسم صريح: «تحليل محسوب من أرقامك» لا «ذكاء اصطناعي». تسميةُ الحساب
      ذكاءً اصطناعيًّا كذبةٌ صغيرة تُفقد كل شارة في التطبيق معناها.
   ═══════════════════════════════════════════════════════════════════════════ */
function computedInsights(){
  const bs = State.ownerData?.bookings || [], fs = State.ownerData?.fields || [];
  if(!bs.length || !fs.length) return [];
  const td = today(), from = dateAfter(-30);
  const past = bs.filter(b => { const d=String(b.date||'').split('T')[0]; return d>=from && d<=td; });
  if(!past.length) return [];
  const conf = past.filter(b=>normStatus(b)==='confirmed');
  const lost = past.filter(b=>['cancelled','rejected'].includes(normStatus(b)));
  const slotsDay = fs.filter(f=>f.active!==false).reduce((s,f)=>s+fieldSlots(f).length,0);
  const cap = slotsDay*30;
  const out = [];

  if(cap>0){
    const occ = Math.round(conf.length/cap*100);
    const avg = conf.length ? conf.reduce((s,b)=>s+Number(b.price||0),0)/conf.length : 0;
    out.push({ type: occ<35?'warning':'opportunity', title:t('ciOccT'),
      advice:t('ciOccA',{ occ, jod: Math.round(cap/100*avg) }) });
  }
  if(past.length>=10){
    const rate = Math.round(lost.length/past.length*100);
    if(rate>=15) out.push({ type:'warning', title:t('ciCancelT'), advice:t('ciCancelA',{p:rate, n:lost.length}) });
  }
  /* اليوم الأضعف — يُقال فقط إن كان أضعف بفارق يُعتدّ به عن الأقوى.
     ⚠️ الأيام السبعة تُبذَر بصفر قبل العدّ، ولولا ذلك **لاستحال أن يظهر اليوم
        الميّت أصلًا**: يومٌ بلا حجز واحد لا يدخل الجدول فلا يُرشَّح للأضعف،
        فتقول اللوحة «السبت أضعف أيامك بثلاثة» ويوم الثلاثاء صفرٌ تامّ.
        وهو بالضبط اليوم الذي جاء المالك يسأل عنه. (مقيس على بيانات مصطنعة
        فيها ثلاثاء فارغ عمدًا — وقد أُخفي.) والنافذة ٣٠ يومًا فكل يوم أسبوع
        وقع فيها أربع مرّات على الأقلّ: صفرُه غيابٌ حقيقي لا نقصُ عيّنة. */
  if(conf.length>=14){
    const byDay = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
    conf.forEach(b=>{ const w=new Date(String(b.date).split('T')[0]+'T12:00:00').getDay(); byDay[w]=(byDay[w]||0)+1; });
    const ks = Object.keys(byDay);
    if(ks.length>=3){
      const hi = ks.reduce((a,k)=>byDay[k]>byDay[a]?k:a, ks[0]);
      const lo = ks.reduce((a,k)=>byDay[k]<byDay[a]?k:a, ks[0]);
      if(byDay[hi] >= byDay[lo]*2){
        const nm = (w)=>{ try{ return new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'long'}).format(new Date(Date.UTC(2024,0,7+Number(w)))); }catch(_){ return ''; } };
        out.push({ type:'pricing', title:t('ciWeekT'), advice:t('ciWeekA',{lo:nm(lo), hi:nm(hi), a:byDay[lo], b:byDay[hi]}) });
      }
    }
  }
  // الطلبات المعلّقة التي فات موعدها — كلٌّ منها خانةٌ حجزها ولم تُبَع
  const stale = bs.filter(b => normStatus(b)==='pending' && String(b.date||'').split('T')[0] < td).length;
  if(stale) out.push({ type:'warning', title:t('ciStaleT'), advice:t('ciStaleA',{n:stale}) });
  // العائدون بالهاتف لا بالحساب: الشخص نفسه يحجز ضيفًا ومسجَّلًا فيُعدّ مرّتين
  if(conf.length>=10){
    const seen={}; conf.forEach(b=>{ const p=normalizePhone(b.phone||''); if(p) seen[p]=(seen[p]||0)+1; });
    const uniq=Object.keys(seen).length, ret=Object.values(seen).filter(n=>n>1).length;
    if(uniq) out.push({ type: ret/uniq<0.2?'marketing':'opportunity', title:t('ciRetT'),
      advice:t('ciRetA',{p:Math.round(ret/uniq*100), n:ret, u:uniq}) });
  }
  // الخانات الفارغة في الأسبوع القادم — ما زال يمكن بيعها
  if(slotsDay>0){
    const to = dateAfter(7);
    const next = bs.filter(b=>{ const d=String(b.date||'').split('T')[0]; return d>td && d<=to && ['pending','confirmed'].includes(normStatus(b)); }).length;
    const free = Math.max(0, slotsDay*7 - next);
    if(free) out.push({ type:'opportunity', title:t('ciFreeT'), advice:t('ciFreeA',{n:free}) });
  }
  return out.slice(0,6);
}
/* سطر «آخر تحديث» أسفل كل لوحة */
function aiMetaLine(res){
  let s='';
  try{ if(res && res.generated_at) s=t('aiUpdatedAt',{time:new Date(res.generated_at).toLocaleString(State.lang==='en'?'en-GB':'ar',{dateStyle:'short',timeStyle:'short'})}); }catch(_){}
  return s ? h('div',{class:'ai-meta'}, s) : null;
}
function renderAiInsights(){
  const el=$('#aiInsights'); if(!el) return; clear(el);
  const res=aiState().insights; if(!res) return;
  const paint=(list)=>list.forEach(it=>{
    el.append(h('div',{class:'ai-insight t-'+String(it.type||'opportunity')},
      h('span',{class:'ai-i-ico','aria-hidden':'true'}, AI_TYPE_ICON[it.type]||'🤖'),
      h('div',{},
        h('div',{class:'ai-i-title'}, String(it.title||'')),
        h('div',{class:'ai-i-text'}, String(it.advice||'')))));
  });
  if(!res.success){
    /* الفشل لا يعني الفراغ: نعرض ما تستطيع الأرقام قوله، **موسومًا بما هو**.
       والسبب يُقال فوقه كي يعرف المالك ما ينقصه إن أراد الأعمق. */
    const own = computedInsights();
    el.append(aiErrorBox(res, ()=>loadAiInsights(true)));
    if(own.length){ el.append(h('div',{class:'ai-chip-lbl'}, t('aiComputedLbl'))); paint(own); }
    return;
  }
  const list=res.insights||[];
  if(!list.length){ el.append(h('div',{class:'ai-alert info'}, t('aiNoInsights'))); return; }
  paint(list);
  el.append(aiMetaLine(res)||'');
}
function renderAiReviews(){
  const el=$('#aiReviews'); if(!el) return; clear(el);
  const res=aiState().reviews; if(!res) return;
  if(res.empty){ el.append(h('div',{class:'ai-alert info'}, t('aiNoReviews'))); return; }
  if(!res.success){
    el.append(aiErrorBox(res, ()=>loadAiReviews(true)));
    /* ما يُقال بلا نموذج: العدد والمتوسّط والتوزيع — أرقامٌ عند المالك أصلًا.
       ⚠️ ولا يُقال أكثر: «ما يمدحه اللاعبون» و«ما يشتكون منه» يتطلّبان قراءة
       نصٍّ حرّ، واستخراجُهما بمطابقة كلمات يخترع نمطًا من صدفة (م5). */
    const st = State.ownerData?.place;
    if(st && st.reviews > 0){
      el.append(h('div',{class:'ai-sentiment '+(st.rating>=4?'positive':st.rating>=3?'mixed':'negative')},
        h('span',{}, t('aiComputedLbl')),
        h('span',{'aria-hidden':'true'}, '·'),
        h('span',{}, t('aiReviewsCount',{n:st.reviews, avg:String(st.rating)}))));
    }
    return;
  }
  const sent=['positive','mixed','negative'].includes(res.sentiment)?res.sentiment:'mixed';
  el.append(h('div',{class:'ai-sentiment '+sent},
    h('span',{}, t('aiSentiment_'+sent)),
    h('span',{'aria-hidden':'true'}, '·'),
    h('span',{}, t('aiReviewsCount',{n:res.total||0, avg:res.avg_rating!=null?String(res.avg_rating):'-'}))));
  if(res.summary) el.append(h('div',{class:'ai-summary'}, String(res.summary)));
  const chips=(arr,cls,lbl)=>{
    if(!Array.isArray(arr)||!arr.length) return;
    el.append(h('div',{class:'ai-chip-lbl'}, lbl));
    const c=h('div',{class:'ai-chips'}); arr.forEach(x=>c.append(h('span',{class:'ai-chip '+cls}, String(x)))); el.append(c);
  };
  chips(res.praises,'good',t('aiPraises'));
  chips(res.complaints,'bad',t('aiComplaints'));
  if(res.alert) el.append(h('div',{class:'ai-alert danger'}, '⚠️ '+String(res.alert)));
  el.append(aiMetaLine(res)||'');
}
function renderAiWeather(){
  const el=$('#aiWeatherWrap'); if(!el) return; clear(el);
  const res=aiState().weather; if(!res) return;
  if(!res.success){ el.append(h('div',{class:'ai-weather'}, aiErrorBox(res, ()=>loadAiWeather(true)))); return; }
  /* الشدّة والجملة تُحسبان هنا حين لا يكتبهما النموذج — من نفس الأيام
     المعروضة تحتها، فيستطيع القارئ التحقّق منهما بعينه. */
  if(!res.severity || !res.advice){
    const r = wxRuleAdvice(res.days||[]);
    res.severity = res.severity || r.severity;
    if(!res.advice){ res.advice = r.advice; res.title = res.title || r.title; res.ai = false; }
  }
  const sev=['warn','danger'].includes(res.severity)?res.severity:'';
  const banner=h('div',{class:('ai-weather '+sev).trim()});
  banner.append(h('div',{class:'ai-w-head'},
    h('span',{class:'ai-w-title'},
      h('span',{class:'ai-w-emoji','aria-hidden':'true'}, sev==='danger'?'🌧️':sev==='warn'?'🌦️':'☀️'),
      h('span',{}, t('aiWeatherTitle'))),
    h('span',{class:'mini-badge ai-badge'}, res.ai===false?t('aiAutoAdvice'):t('aiBadge'))));
  const daysBox=h('div',{class:'ai-w-days'});
  const fmt=new Intl.DateTimeFormat(State.lang==='en'?'en-GB':'ar',{weekday:'short'});
  (res.days||[]).forEach(d=>{
    let wd=''; try{ wd=fmt.format(new Date(d.date+'T12:00:00')); }catch(_){}
    daysBox.append(h('div',{class:'ai-w-day'},
      h('div',{class:'ai-w-ico','aria-hidden':'true'}, WEATHER_EMOJI[d.category]||'⛅'),
      h('div',{class:'ai-w-t'}, wd+' · '+(d.tmax!=null?d.tmax+'°':'-')),
      h('div',{class:'ai-w-sub'}, t('aiRainShort',{n:d.rain_prob||0}))));
  });
  banner.append(daysBox);
  const adv=h('div',{class:'ai-w-advice'});
  if(res.title) adv.append(h('strong',{}, String(res.title)+' — '));
  adv.append(String(res.advice||''));
  banner.append(adv);
  el.append(banner);
}

/* ═══════════════════════════════════════════════════════════════════════════
   الإشعارات — مركزٌ داخل التطبيق، وإظهارٌ على شريط الجهاز

   ⚑ **مصدر الحقيقة صفٌّ في القاعدة**، يكتبه مُشغِّل داخل نفس معاملة الحجز
     (‏migration/14). فلا يضيع إشعار لأن الشبكة انقطعت بعد نجاح الحجز، ولا
     يستطيع عميلٌ تلفيق إشعار لغيره (لا سياسة `insert` لأحد).
   ⚑ **النصّ يُكتب هنا** من `kind` + `data` بلغة المستخدم **الحالية**، لا في
     القاعدة: نصٌّ مخزَّن يُجمَّد على لغة لحظة كتابته.
   ⚑ **الوصول بالاستطلاع لا بالبثّ**، وهذا قرار لا نقص: البثّ الحيّ يفتح
     WebSocket دائمًا على هاتف، مقابل تعجيلٍ لحدثٍ زمنُه دقائق أصلًا (ردّ
     صاحب ملعب). والاستطلاع يجري مع دورة التحديث القائمة **ومع كل عودة إلى
     التطبيق** — وهي اللحظة التي يقرأ فيها المستخدم فعلًا.
   ⚑ ⚠️ **ولا يوقظ هاتفًا مغلقًا**: هذه إشعارات محلّية لا دفع. إيقاظ الجهاز
     يحتاج FCM ومشروع Firebase (بنية عند المالك). والصفّ باقٍ في القاعدة على
     أي حال، فيُقرأ عند أوّل فتح ولا يضيع.
   ═══════════════════════════════════════════════════════════════════════════ */
const Notifs = {
  rows: [], missing: false, loading: false, asked: false,

  unread(){ return this.rows.filter(n => !n.read_at).length; },

  /* بصمة المجموعة: المعرّفات وحدها تكفي — الصفوف لا تُعدَّل بعد كتابتها
     (‏`t_notif_guard` يمنع ذلك في القاعدة)، فمجيء معرّف جديد هو كل الخبر. */
  sig(){ return this.rows.map(n => n.id).join('|'); },

  /* عزلُ اتّجاهٍ في نصّ عارٍ: الإشعار على شريط النظام لا DOM فيه ولا `<bdi>`.
     البديل المكافئ محارف Unicode: LRI…PDI تفعل ما يفعله `<bdi dir="ltr">`.
     وبدونها ينقلب مدى الوقت في السطر العربي فيسبق الانتهاءُ الابتداء
     («10:00 - 8:00» بدل «8:00 - 10:00») — نفس عطل «40–60» في الموقع. */
  _iso(s){ return '⁦' + String(s == null ? '' : s) + '⁩'; },

  /* الوقت يُولَّد من `hour` لا يُقرأ من `time_label`: التسمية المخزَّنة عربية
     دائمًا (قيمة كنسية في بروتوكول الحجز)، فقراءتها كما هي تُظهر «8:00 - 10:00 م»
     لمستخدم الإنجليزية. و`slotDisplay` تعرف كيف تكتبها بلغته. */
  _time(d){
    const hr = Number(d && d.hour);
    if (!Number.isNaN(hr)) return slotDisplay({ hour:hr, startHour:hr, endHour:hr+2, label:(d && d.time_label) || '' });
    return String((d && d.time_label) || '');
  },

  /* النصّ من النوع ومعطياته. نوعٌ لا نعرفه ⇒ `null` ولا يُعرَض شيء:
     صفٌّ من نسخة خادم أحدث لا يُخترَع له عنوان (م5). */
  text(n){
    const d = (n && n.data) || {}, K = {
      booking_new:       ['ntfNewTitle',       'ntfNewBody'],
      booking_confirmed: ['ntfConfirmedTitle', 'ntfConfirmedBody'],
      booking_rejected:  ['ntfRejectedTitle',  'ntfRejectedBody'],
      booking_cancelled: ['ntfCancelledTitle', 'ntfCancelledBody'],
      booking_moved:     ['ntfMovedTitle',     'ntfMovedBody'],
      /* ⚠️ هذان يأتيان من ترحيلَي 15 و20، وبلا سطريهما هنا تصل الصفوف
         ويُرجع `text()` قيمة فارغة فلا يُعرَض شيء — إشعارٌ موجود لا يُقرأ.
         و«انقضت المهلة» له نصّه لا نصّ الرفض: الأوّل صمتٌ والثاني قرار. */
      booking_expired:   ['ntfExpiredTitle',   'ntfExpiredBody'],
      slot_free:         ['ntfSlotFreeTitle',  'ntfSlotFreeBody'],
      game_joined:       ['ntfGameJoinedTitle','ntfGameJoinedBody'],
      game_left:         ['ntfGameLeftTitle',  'ntfGameLeftBody'],
      game_full:         ['ntfGameFullTitle',  'ntfGameFullBody'],
      game_off:          ['ntfGameOffTitle',   'ntfGameOffBody'],
    }[n && n.kind];
    if (!K) return null;
    const vars = {
      name:  d.customer_name || '',
      place: d.place_name || '',
      field: d.field_name || '',
      day:   d.booking_date ? (dayLabel(d.booking_date) + ' ' + shortDate(String(d.booking_date).split('T')[0])) : '',
      time:  this._time(d),
      // معطيات المباريات المفتوحة (ترحيل 22) — الاسم الأوّل وعدد المقاعد
      who:   d.first_name || t('gmHostUnknown'),
      seats: nSeats(Number(d.seats_left||0)),
    };
    const reason = (n.kind === 'booking_rejected' || n.kind === 'booking_cancelled') && d.cancel_reason
      ? t('ntfReason', { r: d.cancel_reason }) : '';
    /* نسختان من الجسد: `body` خام تُقسَّم في الـDOM ويُلَفّ المدى الزمني
       بـ`<bdi dir="ltr">`، و`bodyNative` نصٌّ عارٍ لشريط النظام حيث لا DOM
       فيُعزَل المدى بمحارف Unicode المكافئة. */
    return { title: t(K[0]), body: t(K[1], vars), reason, vars,
             bodyNative: t(K[1], { ...vars, time: vars.time ? this._iso(vars.time) : '' }) };
  },

  /* معرّف الإشعار على الجهاز عدد صحيح موجب، ومعرّف الصفّ uuid ⇒ تجزئة ثابتة.
     ثابتةٌ عمدًا: إعادة عرض نفس الإشعار **تستبدله** ولا تكوّم نسخًا منه. */
  _devId(uuid){
    let hsh = 5381; const s = String(uuid || '');
    for (let i = 0; i < s.length; i++) hsh = ((hsh * 33) ^ s.charCodeAt(i)) >>> 0;
    return (hsh % 2000000000) + 1;
  },

  async load(opts = {}){
    if (this.loading) return;
    if (!Session.player() && !Session.owner()){ this.rows = []; this.paint(); return; }
    this.loading = true;
    try {
      const res = await API.get('getNotifications', {}, 'notifs');
      if (res && res.success){
        this.missing = false;
        const before = this.sig();
        this.rows = (res.notifications || []).filter(n => this.text(n));   // ما لا نصّ له لا يُعدّ ولا يُعرَض
        this.paint();
        /* تغيّرُ الإشعارات هو **إشارة** تغيّر الحجوزات: كل إشعار يكتبه مُشغِّل
           على `bookings`. فيُجلَب لوح المتابعة عندها وحدها بدل جلبه كل دورة —
           طلبٌ يُوفَّر في كل دورة لا جديد فيها، وهي أغلب الدورات. */
        if (this.sig() !== before) Tracker.refresh();
        if (!opts.silent) await this.deliver();
      } else if (res && res.missing){
        this.missing = true; this.rows = []; this.paint();
      }
    } catch(e){ /* انقطاع شبكة ⇒ نُبقي ما بين أيدينا؛ الإشعار ليس عملية يفشل بها المستخدم */ }
    this.loading = false;
  },

  /* الإظهار على شريط الجهاز: ما لم يُظهَر بعد فقط، والأحدث خمسة لا أكثر —
     خمسة إشعارات تُقرأ، وعشرون تُمسح جملةً. و`delivered_at` يُكتب في القاعدة
     لا في الذاكرة كي لا يُعاد الإظهار بعد إعادة تثبيت التطبيق. */
  async deliver(){
    const api = window.__notify;
    if (!api) return;                                   // متصفّح أو بلا بلَغن ⇒ المركز وحده
    const fresh = this.rows.filter(n => !n.delivered_at && !n.read_at).slice(0, 5);
    if (!fresh.length) return;
    const ok = await api.ensure(false);                 // بلا إلحاح: الطلب له لحظته (`askPermission`)
    if (!ok) return;
    const items = fresh.map(n => {
      const tx = this.text(n);
      return { id: this._devId(n.id), nid: String(n.id),
               title: tx.title, body: tx.bodyNative + (tx.reason ? ' — ' + tx.reason : '') };
    });
    const shown = await api.show(items);
    if (!shown) return;
    const ids = fresh.map(n => n.id);
    fresh.forEach(n => { n.delivered_at = new Date().toISOString(); });
    API.get('markNotifications', { ids, delivered:true }, 'notifsMark').catch(()=>{});
  },

  /* طلب الإذن في لحظته: بعد أوّل حجز يرسله اللاعب، وعند دخول المالك — حيث
     يكون الجواب على «لماذا تُسألني؟» أمام عينه. نافذةُ إذنٍ عند الإقلاع
     تُرفَض ثمّ لا يعود أندرويد يسمح بطلبها. */
  async askPermission(){
    if (this.asked || !window.__notify) return;
    this.asked = true;
    try { await window.__notify.ensure(true); } catch(_){}
    /* الإذن نفسه يخدم القناتين على أندرويد (‏POST_NOTIFICATIONS واحد)، فما إن
       يُمنح حتى يُسجَّل رمز الدفع — لا نافذة ثانية ولا سؤال ثانٍ. */
    this.registerPush();
  },

  /* رمز الجهاز ⇒ `profiles.fcm_token` (ترحيل 31).
     ⚠️ **يُكتب فقط إن تغيّر**: الرمز ثابتٌ عبر الجلسات، وكتابتُه عند كل إقلاع
        طلبٌ في كل مرّة بلا جديد — و`fcm_at` تبقى تقول متى تغيّر فعلًا.
     ⚠️ **ولا يُسجَّل لضيف**: لا صفّ له في `profiles` أصلًا.
     ⚠️ وغيابُ `__push` (لا خدمات جوجل · لا `google-services.json`) خروجٌ
        صامت: القناة إضافةٌ لا شرط، والمركز والإشعار المحلّي يعملان بدونها. */
  async registerPush(){
    if (!window.__push) return;
    if (!Session.player() && !Session.owner()) return;
    let tok = '';
    try { tok = await window.__push.register(); } catch(_){ return; }
    if (!tok) return;
    const lang = State.lang === 'en' ? 'en' : 'ar';
    if (tok === this._pushTok && lang === this._pushLang) return;
    const res = await API.get('savePushToken', { token: tok, lang }, 'push').catch(()=>null);
    /* لا توست ولا رسالة عند الفشل: المستخدم لم يطلب هذا ولا يملك إصلاحه،
       والفشل يعني «إشعارات أبطأ» لا «عمليةٌ لم تتمّ». */
    if (res && res.success){ this._pushTok = tok; this._pushLang = lang; }
  },

  paint(){
    const n = this.unread();
    /* جرسٌ للضيف لا يرنّ أبدًا — لا صفوف له في القاعدة أصلًا — ويُقرأ عطلًا
       في التطبيق لا حالةً في حسابه. فيظهر بوجود جلسة وحدها. */
    const hb = $('#homeNotifBtn'); if (hb) hb.hidden = !(Session.player() || Session.owner());
    $$('.notif-btn').forEach(btn => {
      let bd = btn.querySelector('.notif-badge');
      btn.setAttribute('aria-label', n ? t('notifsTitle') + ' — ' + t('notifsNew') : t('notifsTitle'));
      if (!n){ if (bd) bd.remove(); return; }
      if (!bd){ bd = h('span',{class:'notif-badge','aria-hidden':'true'}); btn.append(bd); }
      bd.textContent = n > 9 ? '9+' : String(n);
    });
    if ($('#modal-notifs')?.classList.contains('show')) this.render();
  },

  /* أيقونةٌ ونبرةٌ لكل نوع.
     كانت الأنواع الأحد عشر تُرسَم بالشكل نفسه تمامًا — «تأكّد حجزك» و«رفض
     الملعب» و«انقضت المهلة» لا يفترق أحدها عن الآخر بلا قراءة، وكلّ ما يميّز
     المقروءَ من غيره نقطةٌ 9px.
     ⚠️ والنبرات **ثلاث لا أكثر**، وكلُّها من توكناتٍ مقيسة في هذا الملفّ
     أصلًا — لا لونَ جديد يُخترَع: `ok` (تأكيدٌ ونجاح) · `no` (رفضٌ وإلغاء) ·
     `wait` (وصلَ طلبٌ · نُقل موعد · انقضت مهلة — أفعالٌ تنتظر ردًّا لا تحسم). */
  _face(kind){
    return {
      booking_new:       ['bell',  'wait'],
      booking_confirmed: ['check', 'ok'],
      booking_rejected:  ['x',     'no'],
      booking_cancelled: ['x',     'no'],
      booking_moved:     ['clock', 'wait'],
      booking_expired:   ['clock', 'wait'],
      slot_free:         ['ball',  'ok'],
      game_joined:       ['person','ok'],
      game_left:         ['person','wait'],
      game_full:         ['check', 'ok'],
      game_off:          ['x',     'no'],
    }[kind] || ['bell', 'wait'];
  },

  /* التجميع بالأيام — يُحسَب من `created_at` ولا يُخزَّن.
     ⚠️ والمقارنة **بتاريخٍ محلّي** لا بفرق ساعات: إشعارٌ وصل 11:50 مساءً
     وآخر 12:10 صباحًا بينهما عشرون دقيقة وهما يومان مختلفان — والعكس بالعكس. */
  _bucket(iso){
    const d = new Date(iso), now = new Date();
    const key = (x) => x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate();
    if (key(d) === key(now)) return t('today');
    const y = new Date(now); y.setDate(y.getDate() - 1);
    if (key(d) === key(y)) return t('ntfGroupYesterday');
    return t('ntfGroupOlder');
  },

  render(){
    const el = $('#notifList'); if (!el) return; clear(el);
    const mk = $('#notifMarkAll'); if (mk) mk.hidden = !this.unread();

    if (this.missing){
      el.append(h('div',{class:'notif-empty'},
        h('div',{class:'notif-empty-t'}, t('notifsOff')),
        h('div',{class:'notif-empty-s'}, t('notifsOffSub'))));
      return;
    }
    if (!this.rows.length){
      el.append(h('div',{class:'notif-empty'},
        h('div',{class:'notif-empty-t'}, t('notifsEmpty')),
        h('div',{class:'notif-empty-s'}, t('notifsEmptySub'))));
      return;
    }
    let group = null;
    this.rows.forEach(n => {
      const tx = this.text(n); if (!tx) return;
      const g = this._bucket(n.created_at);
      if (g !== group){ group = g; el.append(h('div',{class:'notif-group'}, g)); }

      const [icon, tone] = this._face(n.kind);
      const row = h('button',{class:'notif-row tone-'+tone+(n.read_at?'':' unread'), type:'button'},
        h('span',{class:'notif-ic','aria-hidden':'true'}, ico(icon,'svg-sm')),
        h('span',{class:'notif-main'},
          h('span',{class:'notif-head'},
            h('span',{class:'notif-t'}, tx.title),
            h('span',{class:'notif-time'}, relTime(n.created_at))),
          /* القيم داخل الجملة معزولة اتّجاهيًّا: اسمُ ملعبٍ عربي داخل جملة
             إنجليزية ينقلب، ومدى وقتٍ داخل جملة عربية يسبق انتهاؤه ابتداءَه. */
          h('span',{class:'notif-b'}, ...this._bodyParts(tx)),
          tx.reason ? h('span',{class:'notif-r'}, tx.reason) : null),
        /* غير المقروء يُحمَل على **الشكل** لا على اللون وحده (مبدأ الشريط
           السفلي): شريطٌ جانبي مصمت + سطحٌ أوضح ⇒ يُقرأ بلا تمييز لون. */
        n.read_at ? null : h('span',{class:'notif-dot','aria-hidden':'true'}));
      row.addEventListener('click', ()=>this.openRow(n));
      el.append(row);
    });
  },

  /* الجملة كاملةً في ملفّ اللغة ثمّ تُقسَّم على قيمتها — لا تُركَّب من قطع،
     وإلّا استحال ترتيبُ الكلمات في إحدى اللغتين.
     ⚠️ و`dir="ltr"` لا `<bdi>` وحده: الأرقام الأوروبية ليست محارف قوية فلا
     تحسم اتّجاه العزل، والمدى «8:00 - 10:00» ينقلب في السطر العربي بدونها. */
  _bodyParts(tx){
    const time = tx.vars.time, body = String(tx.body);
    if (!time || !body.includes(time)) return [body];
    const [before, ...rest] = body.split(time);
    return [before, h('bdi',{dir:'ltr'}, time), rest.join(time)];
  },

  openRow(n){
    if (!n.read_at){
      n.read_at = new Date().toISOString();
      API.get('markNotifications', { ids:[n.id], read:true }, 'notifsMark').catch(()=>{});
      this.paint();
    }
    Modal.close('modal-notifs', true);
    // المالك إلى حجوزاته، واللاعب إلى حجوزاته — كلاهما حيث ينتظره الفعل التالي
    if (Session.owner()){ showPage('owner'); showOwnerTab('bookings'); }
    else if (Session.player()) showPage('bookings');
  },

  open(){
    Modal.open('modal-notifs');
    this.render();
    this.load({ silent:true });
  },

  markAll(){
    const ids = this.rows.filter(n => !n.read_at).map(n => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    this.rows.forEach(n => { if (!n.read_at) n.read_at = now; });
    this.paint(); this.render();
    API.get('markNotifications', { ids, read:true }, 'notifsMark').catch(()=>{});
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   لوح متابعة الحجز على الرئيسية

   السؤال الذي يفتح اللاعبُ التطبيقَ من أجله بعد أن يحجز ليس «أين ألعب؟» بل
   **«هل ردّوا عليّ؟ ومتى موعدي؟»** — وكان جوابه مدفونًا خلف نقرتين في
   «حجوزاتي». هذا اللوح يرفعه إلى أوّل ما تقع عليه العين.

   ⚑ **حجز واحد لا قائمة**: الأقرب زمنًا من غير الملغى ولا المرفوض. قائمةٌ هنا
     تصير «حجوزاتي» ثانيةً في غير موضعها.
   ⚑ **العدّاد يُحسب من الساعة لا من نصّ الوقت**: `hour` عدد، و`time_label`
     نصّ عربي كنسي لا يُحلَّل.
   ⚑ **ولا يُعرَض شيء ما لم يوجد حجز** (م5): لوحٌ يقول «لا حجز» يزحم أعلى
     الصفحة كلَّ يوم لا يلعب فيه أحد.
   ═══════════════════════════════════════════════════════════════════════════ */
const Tracker = {
  booking: null, timer: null,

  /* الحجوزات تُجلَب هنا لا تُقرأ من صفحة «حجوزاتي»: الرئيسية قد تُفتَح قبلها
     أصلًا، وربطُ لوحٍ بصفحةٍ لم تُزَر بعد يجعله فارغًا بلا سبب ظاهر. */
  async refresh(){
    if (!Session.player()){ this.booking = null; this.paint(); return; }
    try {
      const res = await API.get('getPlayerBookings', { player_token: Session.player() }, 'trackerBk');
      if (!res || !res.success) return;
      this.booking = this.pick(res.bookings || []);
      this.paint();
    } catch(_){ /* شبكة ⇒ نُبقي آخر ما عُرض؛ العدّاد يواصل من نفس الحجز */ }
  },

  /* الأقرب بدءًا ممّا لم يمضِ بعد. المقارنة بلحظة **بدء** المباراة لا بيومها:
     حجزُ اليوم الثامنة مساءً يبقى قادمًا حتى الثامنة، ولا يسقط منذ منتصف الليل. */
  pick(list){
    const now = Date.now();
    return (list || [])
      .filter(b => { const s = normStatus(b); return s === 'pending' || s === 'confirmed'; })
      .map(b => ({ b, at: this.startAt(b) }))
      .filter(x => x.at != null && x.at > now - 2 * 3600 * 1000)   // ساعتان بعد البدء: المباراة نفسها
      .sort((x, y) => x.at - y.at)
      .map(x => x.b)[0] || null;
  },

  startAt(b){
    const d = String(b.date || '').split('T')[0], hr = Number(b.hour);
    if (!d || Number.isNaN(hr)) return null;
    const dt = new Date(d + 'T00:00:00'); if (isNaN(dt)) return null;
    dt.setHours(hr, 0, 0, 0);
    return dt.getTime();
  },

  /* «بعد ٣ ساعات» — بوحدتين على الأكثر. الوحدة الثالثة («يومان و٤ ساعات
     و١٢ دقيقة») لا تغيّر قرارًا وتُطيل السطر. و`countNoun` غير لازم: كل نصّ
     هنا «{n} يوم/ساعة/دقيقة» بالعدد **بعد** الاسم فيصحّ مع أي رقم. */
  countdown(ms){
    if (ms <= 0) return t('trkNow');
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), hr = Math.floor((m % 1440) / 60), mi = m % 60;
    if (d > 0) return t('trkD', { n:d }) + (hr ? ' · ' + t('trkH', { n:hr }) : '');
    if (hr > 0) return t('trkH', { n:hr }) + (mi ? ' · ' + t('trkM', { n:mi }) : '');
    return t('trkM', { n: Math.max(1, mi) });
  },

  /* نبضة الدقيقة: تُعيد رسم الرقم وحده. وتتوقّف حين لا لوح — مؤقّتٌ يدور على
     صفحة لا شيء فيها يستهلك بطارية بلا أثر يُرى. */
  tick(){
    if (!this.booking) return;
    const at = this.startAt(this.booking);
    const el = $('#trkCount'); if (!el || at == null) return;
    const left = at - Date.now();
    el.textContent = left <= -60000 ? t('trkNow') : this.countdown(left);
  },

  paint(){
    const wrap = $('#trackerWrap'); if (!wrap) return;
    clearInterval(this.timer); this.timer = null;
    const b = this.booking;
    if (!b || !Session.player()){ wrap.hidden = true; clear(wrap); return; }

    const st = normStatus(b), pending = st === 'pending';
    const at = this.startAt(b), left = at == null ? 0 : at - Date.now();
    clear(wrap); wrap.hidden = false;

    const slot = { hour:Number(b.hour), startHour:Number(b.hour), endHour:Number(b.hour)+2, label:b.time || '' };
    const card = h('button',{ class:'trk'+(pending?' is-pending':' is-confirmed'), type:'button',
      'aria-label': (pending ? t('trkPending') : t('trkConfirmed')) + ' — ' + t('trkOpen') },
      h('div',{class:'trk-top'},
        h('span',{class:'trk-state'},
          h('span',{class:'trk-pulse','aria-hidden':'true'}),
          pending ? t('trkPending') : t('trkConfirmed')),
        h('span',{class:'trk-title'}, t('trkTitle'))),
      /* ⚠️ **الموعد أوّلًا والمكان بعده** — وكان العكس.
         الدفعة 11 بنت هذا اللوح على جملة صريحة: «السؤال بعد الحجز ليس أين ألعب؟
         بل هل ردّوا؟ ومتى موعدي؟». ثمّ جاء التنسيق فجعل **اسم الملعب** أكبر
         عنصر في البطاقة (‏15.5px/800 بلون `--ink`) والموعد سطرًا باهتًا تحته
         (‏13px بلون `--muted`) — أي أن البطاقة كانت تجيب بأعلى صوتها عن السؤال
         الذي قال تصميمُها نفسُه إنه ليس السؤال.
         والترتيب في الـDOM يتبع الترتيب البصري لا يخالفه: قارئ الشاشة يقرأ ما
         يراه المبصر بالترتيب نفسه. */
      /* ⚠️ **صفٌّ واحد للموعد والعدّاد** بدل صفَّين وفاصلٍ أفقي (تغيّر 2026-08-11
         بطلب المالك: البطاقة كانت ستّة صفوف على أزحم شاشة). والعدّاد إجابةُ
         نفس السؤال الذي يجيبه الموعد — «متى؟» — فوضعُهما في سطرين متباعدين
         يجعل العين تقفز بينهما. وتسمية «يبدأ بعد» سقطت: الحبّة نفسها تقولها. */
      h('div',{class:'trk-line'},
        h('div',{class:'trk-when'},
          h('span',{}, dayLabel(b.date) + ' ' + shortDate(String(b.date).split('T')[0])),
          h('span',{class:'trk-sep','aria-hidden':'true'}, '·'),
          // مدى وقتٍ داخل جملة عربية ينقلب بلا عزل صريح فيسبق الانتهاءُ الابتداء
          h('bdi',{dir:'ltr'}, slotDisplay(slot))),
        h('span',{class:'trk-count', id:'trkCount'},
          left <= -60000 ? t('trkNow') : this.countdown(left))),
      h('div',{class:'trk-where'},
        h('bdi',{}, b.place_name || ''),
        b.field_name ? h('span',{class:'trk-sep','aria-hidden':'true'}, '·') : null,
        b.field_name ? h('bdi',{}, b.field_name) : null),
      /* التلميح للمعلّق وحده: «طلبك ينتظر ردّ الملعب» يشرح حالةَ انتظار لا يفهمها
         المستخدم بلا كلمات؛ أمّا المؤكّد فشارة «مؤكّد» والعدّاد يقولان كل شيء،
         وسطرٌ ثالث تحتهما تكرارٌ يزيد ارتفاع البطاقة بلا معلومة. */
      pending ? h('div',{class:'trk-hint'}, t('trkPendingHint')) : null);
    card.addEventListener('click', ()=>showPage('bookings'));
    wrap.append(card);

    this.tick();
    this.timer = setInterval(()=>this.tick(), 60000);
  },
};

/* «قبل دقيقتين» — بجموع عربية صحيحة مجّانًا (Intl يتكفّل بالمعدود) */
function relTime(iso){
  try{
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(State.lang==='en'?'en':'ar', { numeric:'auto' });
    const units = [['year',31536000],['month',2592000],['day',86400],['hour',3600],['minute',60]];
    for (const [u, s] of units){ if (Math.abs(diff) >= s) return rtf.format(Math.round(diff/s), u); }
    return rtf.format(Math.round(diff), 'second');
  }catch(_){ return ''; }
}

