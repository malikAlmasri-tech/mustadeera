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
  /* ⚠️ نطاق التقارير **مرشِّح مُدخَل لا تعديل حساب**: الدوالّ تأخذ مصفوفةً
     وتحسب منها، فتقليص المصفوفة يغيّر ما تشمله الأرقام ولا يمسّ سطرًا واحدًا
     من رياضياتها. و«الكل» هو الافتراضي فلا يتغيّر شيء لمن لا يلمس المُبدِّل. */
  const scoped = reportScoped(bookings);
  resolveOwnerView();
  safeRender('stats', ()=>renderOwnerStats(scoped));
  safeRender('revNotes', ()=>renderOwnerRevNotes(scoped));
  safeRender('reply', ()=>renderOwnerReply(scoped));
  safeRender('leak', ()=>renderOwnerLeak(scoped));
  safeRender('demand', renderOwnerDemand);
  safeRender('heat', ()=>renderOwnerHeat(scoped));
  safeRender('charts', ()=>renderOwnerCharts(scoped));
  safeRender('capacity', ()=>renderOwnerCapacityCard(bookings, scoped));
  safeRender('customers', ()=>renderOwnerCustomersCard(scoped));
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
  const prev = State.ownerTab;
  State.ownerTab=name;
  $$('#nav-owner .nitem').forEach(b=>{ const on=b.dataset.otab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); b.setAttribute('tabindex', on?'0':'-1'); });
  /* اللوح المعروض قد يخالف اسم التبويب: «الحجوزات» تعرض التقويم حين يكون هو
     الشكل المختار، والحبّة تبقى على زرّ الحجوزات لأنّ المستخدم فيها فعلًا. */
  const panel = (name==='bookings' && State.ownerBkView==='calendar') ? 'calendar' : name;
  $$('#page-owner .owner-tab').forEach(p=>{ p.hidden = (p.id !== 'ownerTab-'+panel); });
  NavPill.schedule();
  if(panel==='calendar') renderOwnerCalendar();
  /* المخطّط يُعاد رسمه مع البطاقات: كلاهما يقرأ نفس الجلبة، وإعادة رسم واحدٍ
     دون الآخر تترك شكلًا يتقدّم على الثاني بجلبة كاملة. */
  if(name==='today'){ renderOwnerToday(); if(State.ownerView==='timeline') renderOwnerTimeline(); }
  if(name==='reports' && State.ownerData){ loadAiInsights(); loadAiReviews(); }   // 🤖 جلب كسول أول مرة فقط
  if(name==='bookings'){ State.ownerNewCount=0; updateOwnerTabBadge(); }          // فتح التبويب يصفّر شارة الجديد
  /* 🔴 **الصعود إلى الرأس عند تبديل التبويب وحده.** كانت تُصعّد دائمًا، وهي
     تُنادى من `renderOwnerDashboard` بعد **كل** إعادة جلب ⇒ المالك يردّ على
     طلبٍ في منتصف قائمة اليوم فتقفز به الصفحة إلى أعلاها، ويردّ على عشرة.
     وتبديلُ التبويب يستحقّ الصعود (لوحٌ جديد يُقرأ من أوّله)، وإعادةُ الرسم
     في مكانك لا تستحقّه. */
  if(prev !== name) window.scrollTo({ top:0, behavior:'instant' });
}
/* ===================== OWNER · TODAY TAB ===================== */
function renderOwnerToday(){
  const el=$('#ownerToday'); if(!el) return;
  const all=State.ownerData?.bookings||[]; const fields=State.ownerData?.fields||[]; const td=today();
  const onDay=(ds)=>all.filter(b=>String(b.date||'').split('T')[0]===ds);
  const todayB=onDay(td);
  /* ⚠️ **الترتيب بالمهلة لا بالساعة.** كان الترتيب بساعة اللعب، فيقع الطلب
     الذي وصل أمس ويكاد ينقضي **تحت** طلبٍ وصل قبل دقيقة لأن مباراته أبكر —
     وهو بالضبط الطلب الذي جاء المالك من أجله. */
  const pend=todayB.filter(b=>normStatus(b)==='pending')
    .sort((a,b)=>{ const x=replyDeadlineMs(a), y=replyDeadlineMs(b);
                   if(Number.isNaN(x)) return 1; if(Number.isNaN(y)) return -1;
                   return x-y || Number(a.hour)-Number(b.hour); });
  const conf=todayB.filter(b=>normStatus(b)==='confirmed');
  const dayRevenue=(list)=>list.filter(b=>normStatus(b)==='confirmed').reduce((s,b)=>s+(Number(b.price)||0),0);
  const revenue=dayRevenue(todayB);
  // أوقات اليوم الفارغة (من بيانات المالك مباشرة)
  const bookedToday={};
  todayB.forEach(b=>{ const s=normStatus(b); if(s==='cancelled'||s==='rejected') return; const fid=String(b.field_id); const hr=Number(b.hour); if(!Number.isNaN(hr)){ (bookedToday[fid] ||= new Set()).add(hr); } });
  let totalSlots=0, booked=0;
  // «أوقات متاحة اليوم» تعدّ المفتوح وحده: خانةٌ مغلقة ليست متاحة للحجز.
  fields.forEach(f=>{ if(f.active===false) return; const slots=openSlotsFor(f, td); totalSlots+=slots.length; const set=bookedToday[String(f.field_id)]||new Set(); booked+=slots.filter(s=>set.has(s.hour)).length; });
  setText('otToday', todayB.length); setText('otPending', pend.length); setText('otRevenue', formatMoney(revenue)); setText('otFree', Math.max(totalSlots-booked,0));
  /* ═══ البلاطة تصير أربعة أسطر: تسمية ⇐ رقم ⇐ **مقامه** ⇐ اتجاه ═══════════
     رقمٌ مطلق بلا مقام لا يقول شيئًا («٧» مقابل ماذا؟) — وهي القاعدة المطبَّقة
     على البطل منذ الدفعة ٣٣ ومتروكةٌ في الخانات الثلاث تحته.
     ⚠️ **ولكلٍّ مقامٌ يخصّه**: لو حملت «الحجوزات» و«الفارغة» نفس المقام لقال
        اللوحُ الشيءَ مرّتين بصيغتين — وهو ضجيجٌ لا معلومة. */
  const openFields = fields.filter(f=>f.active!==false && openSlotsFor(f, td).length);
  setText('otTodaySub',   totalSlots ? t('otOfSlots', { n: totalSlots }) : '');
  setText('otFreeSub',    openFields.length ? t('otOnFields', { n: nFields(openFields.length) }) : '');
  /* أقدمُ معلَّق: العدد يقول «كم»، وهذا يقول «منذ متى» — وهو ما يُحرّك. */
  const oldest = pend.length ? pend.reduce((a,b2)=>{
    const x=new Date(String(a.timestamp||'').replace(' ','T')).getTime();
    const y=new Date(String(b2.timestamp||'').replace(' ','T')).getTime();
    return (Number.isNaN(y) || (!Number.isNaN(x) && x<=y)) ? a : b2; }) : null;
  const oldestTs = oldest ? new Date(String(oldest.timestamp||'').replace(' ','T')).getTime() : NaN;
  setText('otPendingSub', (!Number.isNaN(oldestTs)) ? t('otOldest', { rel: relFromNow(oldestTs-Date.now()) }) : '');
  /* خطّ سبعة أيام على البطل وحده — والاتجاه هو الشيء الوحيد الذي يحمله المال
     ولا تحمله الخانات الثلاث (طابورٌ وعددُ خاناتٍ فارغة لا اتجاه لهما). */
  const spark=$('#otRevSpark');
  if(spark){ clear(spark);
    const days=[]; const base=new Date(td+'T12:00:00');
    for(let i=6;i>=0;i--){ const d=new Date(base); d.setDate(d.getDate()-i);
      days.push(dayRevenue(onDay(d.toISOString().slice(0,10)))); }
    put(spark, createSparkline(days, 'spark-hero'));
  }
  /* ⚠️ **شريط الفعل يُخفى عند الصفر ولا يعرض «٠ طلبات»**: شريطٌ لاصق يأكل
     ارتفاعًا من كل شاشة مقابل خبرٍ سارّ لا يحتاج شريطًا. */
  const wrap=$('#otAlertWrap');
  if(wrap){
    const on = pend.length>0;
    wrap.hidden = !on;
    if(on) setText('otAlertTxt', t('otAlertTxt', { n: nRequests(pend.length) }));
  }
  const cell=$('#otPendingCell'); if(cell) cell.classList.toggle('is-hot', pend.length>0);
  /* المقارنة: نفس اليوم من الأسابيع الأربعة الماضية — لا الأمس. */
  const cmp=$('#otRevCmp');
  if(cmp){ clear(cmp);
    put(cmp, compareLine(revenue, sameWeekdayAvg(all, td, (ds)=>dayRevenue(onDay(ds))), td,
                         (v)=>formatMoney(Math.round(v)))); }
  renderOwnerNext(todayB);
  renderOwnerLostWeek(all, td);
  clear(el);
  if(!todayB.length){ el.append(emptyState({icon:'📅', title:t('noBookingsToday'), sub:t('noBookingsTodaySub')})); return; }
  const rest=todayB.filter(b=>normStatus(b)!=='pending').sort((a,b)=>Number(a.hour)-Number(b.hour));
  if(pend.length){
    el.append(sectionTitle(t('pendingReply'), pend.length));
    /* حاشيةٌ صادقة عن **آلية** الانقضاء لا وعدٌ بها: بلا cron في الخطّة
       المجانية، الكنس يقع عند فتح اللوحة. */
    el.append(h('div',{class:'ot-note'},
      h('span',{class:'ot-note-sub'}, t('otSoonestFirst')),
      h('span',{}, SWEEP_OK ? t('expirySweepNote') : t('expirySweepOff'))));
    pend.forEach(b=>el.append(ownerBookingCard(b)));
  }
  if(rest.length){ el.append(sectionTitle(t('restToday'), rest.length)); rest.forEach(b=>el.append(ownerBookingCard(b))); }
}

/* ═══ «راحت بلا ردّ» في تبويب اليوم ═══════════════════════════════════════
   الرقم يُحسَب في التقارير منذ الدفعة ٣٣، وموضعُه الصحيح هنا: **الإهمال
   يُصحَّح اليوم لا في مراجعة آخر الشهر**. و«٣ طلبات» رقمٌ لا يُحرّك أحدًا،
   و«‏١٤٠ د.أ» يُحرّك — فيُترجَم مالًا كما يفعل لوح «وين بضيّع؟» بالضبط.
   ⚠️ **والمنقضي ليس المرفوض**: الرفض قرارُك (وقد يكون صائبًا)، والانقضاء
      إهمالُك وحده — وهو الفرق الوحيد الذي يستطيع صاحبه أن يفعل شيئًا حياله.
      ولذلك `isExpiredBooking` لا `status==='rejected'`.
   ⚠️ **ويُخفى عند الصفر**: صفرٌ هنا خبرٌ سارّ، ولوحٌ يقول «٠» يُدرَّب صاحبُه
      على تجاهله فيغفل عنه يوم يصير ثلاثة. */
function renderOwnerLostWeek(all, td){
  const box=$('#otLost'); if(!box) return; clear(box);
  const from = new Date(td+'T12:00:00'); from.setDate(from.getDate()-7);
  const fromDs = from.toISOString().slice(0,10);
  const lost=(all||[]).filter(b=>{
    if(!isExpiredBooking(b)) return false;
    const ds=String(b.date||'').split('T')[0];
    return ds >= fromDs && ds <= td;
  });
  if(!lost.length) return;
  const money=lost.reduce((s,b)=>s+(Number(b.price)||0),0);
  box.append(h('div',{class:'ot-lost'},
    h('span',{class:'ot-lost-ic','aria-hidden':'true'}, ico('clock','svg-sm')),
    h('div',{class:'ot-lost-txt'},
      h('b',{}, t('otLostTitle', { n: nRequests(lost.length), m: formatMoney(Math.round(money)) })),
      h('span',{}, t('otLostSub', { h: CONFIG.REPLY_DEADLINE_H })))));
}

/* ═══ «القادم الآن» — سطرٌ واحد يهزم أربع بلاطات ══════════════════════════
   المالك الواقف عند البوّابة الثامنة مساءً لا يسأل عن إشغال الشهر: يسأل «مين
   جايّ الحين؟». والجواب في البيانات كلَّه، وكان يحتاج نقرتين ليصل إليه.
   ⚠️ ولا يُعرَض شيء بلا حجزٍ قادم اليوم (م5) — لا لوحٌ فارغ ولا «لا يوجد».
   ⚠️ و«جارية الآن» حالةٌ ثالثة: الخانة ساعتان، فما بدأ ولم ينتهِ ليس قادمًا
      ولا ماضيًا — وهو أكثر ما يعني الواقف عند البوّابة. */
function renderOwnerNext(todayB){
  const box=$('#otNext'); if(!box) return; clear(box);
  const now=Date.now();
  const up=(todayB||[])
    .filter(b=>['confirmed','pending'].includes(normStatus(b)))
    .map(b=>({ b, ts:slotStartMs(b) }))
    .filter(x=>!Number.isNaN(x.ts) && (x.ts + 2*3600e3) > now)
    .sort((a,b)=>a.ts-b.ts)[0];
  if(!up) return;
  const b=up.b, live = up.ts <= now;
  const lbl=statusLabel(runtimeStatus(b));
  const phone=normalizePhone(b.phone||'');
  box.append(h('div',{class:'ot-next'+(live?' is-live':'')},
    h('div',{class:'ot-next-top'},
      h('span',{class:'ot-next-when'}, live ? t('otNextLive') : t('otNextIn',{ rel: relFromNow(up.ts-now) })),
      h('span',{class:'badge '+lbl.c}, lbl.t)),
    h('div',{class:'ot-next-who'},
      h('bdi',{}, b.name||'-'), h('span',{class:'ot-next-dot'}, '·'),
      h('bdi',{}, b.field_name||''), h('span',{class:'ot-next-dot'}, '·'),
      h('bdi',{dir:'ltr'}, b.time||'')),
    phone ? h('a',{class:'ot-next-call', href:'tel:'+phone, 'aria-label':t('otNextCall')},
              ico('phone','svg-sm'), h('bdi',{dir:'ltr'}, b.phone||'')) : null));
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
  /* شريط اليوم: المخطّط يخدم التخطيط لا متابعة الساعة الجارية وحدها. والسهم
     فيزيائي فيُقلب بالاتّجاه في الورقة لا هنا. */
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
  const hours=[...new Set(fields.flatMap(f=>fieldSlots(f).map(s=>s.hour)))].sort((a,b)=>a-b);
  if(!hours.length){ el.append(emptyState({icon:'🕒', title:t('tlNoHours'), sub:t('tlNoHoursSub')})); return; }
  const byKey={};
  (State.ownerData?.bookings||[]).forEach(b=>{
    if(String(b.date||'').split('T')[0]!==td) return;
    const st=normStatus(b); if(st==='cancelled'||st==='rejected') return;
    byKey[String(b.field_id)+'@'+Number(b.hour)] = b;
  });
  /* «راح» تُقاس بساعة **اليوم المعروض** لا بالساعة الحالية مطلقًا. */
  const past = (hr) => td < now ? true : td > now ? false : (hr + 2) <= new Date().getHours();
  const wrap=h('div',{class:'tl-wrap'});
  /* 🔴 **الساعاتُ صفوفًا والملاعبُ أعمدة** (كانت معكوسة). والسبب سؤالٌ لا ذوق:
     السطر الواحد صار «الثامنة مساءً عبر ملاعبك كلّها» — وهو السؤال الذي يُسأل
     («هل امتلأت الثامنة؟»)، وقراءتُه مسحٌ أفقيّ واحد لا تنقّلٌ بين صفوف. ومع
     أربعة عشر ملعبًا كان الجواب أربعة عشر صفًّا يُقرأ كلٌّ منها على حدة.
     والزمن ينساب لأسفل كما يُقرأ أيّ تقويم، فالتمرير الرأسي طبيعيّ على الهاتف
     والأفقيّ يبقى للملاعب وحدها مع عمود الساعة مثبَّتًا. */
  const grid=h('div',{class:'tl-grid', style:{ gridTemplateColumns:`auto repeat(${fields.length}, minmax(76px,1fr))` }});
  grid.append(h('div',{class:'tl-head tl-name tl-hour'}, t('tlHour')));
  fields.forEach(f=> grid.append(h('div',{class:'tl-head tl-fname', title:f.field_name}, h('bdi',{}, f.field_name))));
  hours.forEach(hr=>{
    grid.append(h('div',{class:'tl-name tl-hour'}, h('bdi',{dir:'ltr'}, String(hr).padStart(2,'0')+':00')));
    fields.forEach(f=>{
      const own = fieldSlots(f).map(s=>s.hour);
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
      /* ⚠️ **المغلق صار قابلًا للنقر** بعد أن كان `disabled`: إعادةُ الفتح فعلٌ
         يقع على المغلق وحده، ومنعُ نقره كان يترك المالك بلا طريقٍ إليه من
         حيث يراه. والماضي يبقى ميّتًا — لا فعل عليه. */
      const dead = dis && !cl;
      const btn=h('button',{ class:cls, type:'button', disabled:dead||undefined,
        'aria-label': `${f.field_name} — ${String(hr).padStart(2,'0')}:00 — ${label}` }, label);
      if(!dead){
        btn.addEventListener('click', ()=> openSlotSheet({ field:f, date:td, hour:hr, booking:b, closure:cl }));
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
/* ═══ ورقة خليّة المخطّط (البند ٦٢) ═══════════════════════════════════════
   المخطّط كان يُقرأ ولا يُعمَل منه: نقرُ الخليّة يفتح البطاقة أو لوح الإغلاق
   بحسب امتلائها، فيبقى المالك يخمّن ما ستفعله الضغطة — ويخرج من المخطّط إلى
   شاشةٍ أخرى ليفعل ما كان يستطيع فعله من مكانه.
   ⚠️ **ولكل حالةٍ أفعالُها وحدها**: نفس قاعدة أزرار البطاقة («لا يُعرَض إلّا ما
      يُغيّر شيئًا») مطبَّقةً على الشبكة.
   ⚠️ **والخانة الفارغة تحمل سياقها**: «هذه الساعة حُجزت ن من آخر ٧ ليالٍ» —
      رقمٌ مقيس من حجوزات المالك نفسها يمنع إغلاقًا يكلّف صاحبَه أغلى ساعاته.
      ولا يُعرَض السطر بلا سابقةٍ تُقاس (صفرٌ من سبعٍ لا يُكتب: الغياب ليس خبرًا
      هنا، والملعب قد يكون جديدًا). */
function slotHistory(field, hour, date){
  const all=State.ownerData?.bookings||[]; const base=new Date(date+'T12:00:00');
  const days=[]; for(let i=1;i<=7;i++){ const d=new Date(base); d.setDate(d.getDate()-i); days.push(d.toISOString().slice(0,10)); }
  const hit=new Set();
  all.forEach(b=>{
    if(String(b.field_id)!==String(field.field_id)) return;
    if(Number(b.hour)!==Number(hour)) return;
    if(normStatus(b)!=='confirmed') return;
    const ds=String(b.date||'').split('T')[0];
    if(days.includes(ds)) hit.add(ds);
  });
  return hit.size;
}
function openSlotSheet(o){
  const { field, date, hour, booking, closure } = o;
  const body=$('#slBody'), acts=$('#slActions'); if(!body||!acts) return;
  const st = booking ? normStatus(booking) : null;
  const stateTxt = closure ? t('tlClosed') : st==='pending' ? t('statusPending')
                 : st==='confirmed' ? t('statusConfirmed') : t('tlFree');
  setText('slTitle', `${field.field_name} — ${fmtHour12(hour)}`);
  setText('slSub', `${date===today()?t('today'):dayLabel(date)} ${shortDate(date)} · ${stateTxt}`);
  clear(body); clear(acts);
  /* الزرّ يُمرَّر إلى مُعالِجه: `withLoading` تخرج فورًا بلا زرّ (`if(!btn) return`)،
     فنداءٌ بلا عنصرٍ حقيقي كان سيصمت تمامًا — لا فعل ولا خطأ. */
  const act=(cls,label,fn)=>{ const b=h('button',{class:cls, type:'button'}, label); b.addEventListener('click',()=>fn(b)); return b; };
  const shut=()=>Modal.close('modal-slot', true);

  if(closure){
    body.append(h('div',{class:'sl-hint'}, closure.reason ? t('slClosedWhy',{ r:closure.reason }) : t('slClosedNoWhy')));
    /* إعادةُ الفتح **باليوم لا بالساعة**: `ownerReopenDay` تحذف إغلاقات الملعب
       في ذلك اليوم كلَّها — والزرّ يقول ذلك بالحرف بدل أن يَعِد بساعة. */
    acts.append(act('sbtn', t('slReopenDay'), async(b)=>{
      await ownerReopenDay(b, field, date); renderOwnerTimeline(); shut(); }));
    Modal.open('modal-slot'); return;
  }
  if(booking){
    const row=(icon,val)=>h('div',{class:'dc-fact'}, ico(icon,'svg-sm'), h('bdi',{}, String(val==null?'-':val)));
    body.append(h('div',{class:'dc-facts'},
      row('person', booking.name||'-'), row('phone', booking.phone||'-'),
      row('money', formatCurrency(booking.price||0))));
    put(body, custHistLine(booking));
    const phone=normalizePhone(booking.phone||'');
    if(st==='pending'){
      acts.append(act('sbtn', t('slAnswerHere'), ()=>{ shut(); openDecideSheet(booking); }));
    } else {
      acts.append(act('sbtn', t('slOpenCard'), ()=>{ shut(); openOwnerBookingFromTimeline(booking); }));
    }
    if(phone) acts.append(h('a',{class:'cbtn', href:'tel:'+phone}, ico('phone','svg-sm'), ' '+t('slCallPlayer')));
    Modal.open('modal-slot'); return;
  }
  /* خانة فارغة: السياق أوّلًا ثمّ الفعلان — إغلاقٌ يسحبها من العرض، أو حجزٌ
     خارجيّ يملؤها بمن اتّصل على الهاتف. وكلاهما كان يستلزم مغادرة المخطّط. */
  const n=slotHistory(field, hour, date);
  if(n) body.append(h('div',{class:'sl-hint'}, t('slFreeHistory',{ n: nTimes(n) })));
  acts.append(act('sbtn', t('slAddManual'), ()=>{ shut(); openManual({ fieldId:String(field.field_id), date, hour }); }));
  acts.append(act('cbtn', t('slCloseHour'), ()=>{ shut(); openClosure(date, { fieldId:String(field.field_id), hour }); }));
  Modal.open('modal-slot');
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
/* ⚠️ **الافتراضي يتبع عدد الملاعب، والاختيار يعلو عليه.** «قائمة» تجيب «مين
   مستنّي ردّي؟» وهي أفضل شكلٍ لذلك؛ أمّا «شو وضع اليوم؟» على أربعة عشر ملعبًا
   فلا تجيبه قائمةٌ إطلاقًا — تجيبه شبكةٌ واحدة. فمن له أكثر من ملعبين يفتح على
   المخطّط، ومن له ملعبٌ أو ملعبان يفتح على البطاقات. **واختيارُ المالك يُحفَظ**
   فلا يُعاد فرضُ الافتراضي عليه في كل إقلاع. */
function resolveOwnerView(){
  if(State.ownerView) return;
  let saved=null; try{ saved=localStorage.getItem('mustadaira:ownerView'); }catch(_){}
  if(saved==='timeline' || saved==='cards'){ applyOwnerView(saved); return; }
  const n=(State.ownerData?.fields||[]).filter(f=>f.active!==false).length;
  applyOwnerView(n > 2 ? 'timeline' : 'cards');
}
/* يطبّق الشكل بلا حفظ — يفصل «ما اخترتَه» عن «ما استنتجناه». */
function applyOwnerView(v){
  State.ownerView = (v==='timeline') ? 'timeline' : 'cards';
  $$('#ownerViewSeg .ov-btn').forEach(b=>{ const on=b.dataset.ov===State.ownerView;
    b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on?'true':'false'); });
  const tl=$('#ownerTimelineWrap'), cd=$('#ownerToday');
  const on = State.ownerView==='timeline';
  if(tl) tl.hidden=!on; if(cd) cd.hidden=on;
  const card=$('#tlCard'); if(card && !on){ card.hidden=true; clear(card); }
  if(on) renderOwnerTimeline();
}
function setOwnerView(v){
  applyOwnerView(v);
  try{ localStorage.setItem('mustadaira:ownerView', State.ownerView); }catch(_){}
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
    /* ⚠️ تسميةٌ كل `every` عمودًا: ثلاثون عمودًا يوميًّا تعني ثلاثين تسمية على
       عرض شاشة، وهي تتداخل حتمًا (نفس درس أسماء الأيام العربية في الدفعة ٢٩).
       والاسم المنطوق يبقى كاملًا لأنه يُبنى من المصفوفة لا من المرسوم. */
    if(!opts.every || i % opts.every === 0)
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
/* ═══ الرسوم تتبع النطاق ═════════════════════════════════════════════════
   🔴 كانت مثبَّتةً على «آخر ٧ أيام» بينما المُبدِّل فوقها يقول «الكل / ٣٠ / ٩٠»
   ⇒ تناقضٌ ظاهرٌ للمستخدم: يغيّر النطاق فلا يتحرّك الرسم. والحلّ ربطُها،
   **وتغييرُ حجم الدلو مع النطاق**: تسعون عمودًا يوميًّا على شاشة هاتف تُقرأ
   خطًّا أسودَ لا رسمًا (وهو نفس درس تداخل تسميات الأيام). فالعدد يبقى بين
   ستّة وثلاثين عمودًا مهما كان النطاق، **والدلو مكتوبٌ على الشارة** كي لا
   يُقرأ عمودُ أسبوعٍ عمودَ يوم. */
function ownerRevSeries(scoped){
  const r = State.reportRange || 'all';
  const conf = scoped.filter(b=>normStatus(b)==='confirmed');
  const sum = (from, to) => conf.filter(b=>{ const d=String(b.date||'').split('T')[0]; return d>=from && d<=to; })
                                .reduce((s,b)=>s+(Number(b.price)||0),0);
  if(r === 'd30'){
    const data=[...Array(30)].map((_,i)=>{ const ds=dateAfter(i-29); return { label: shortDate(ds), value: sum(ds,ds) }; });
    return { data, every:5, scope:t('bucketDay') };
  }
  if(r === 'd90'){
    const data=[...Array(13)].map((_,i)=>{ const to=dateAfter(-7*(12-i)); const from=dayShift(to,-6);
                                           return { label: shortDate(to), value: sum(from,to) }; });
    return { data, every:2, scope:t('bucketWeek') };
  }
  const data=[...Array(6)].map((_,i)=>{
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
    const from=ymd(d); const e=new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { label: monthTight(d), value: sum(from, ymd(e)) };
  });
  return { data, every:1, scope:t('bucketMonth') };
}
/* 🔴 **و`month:'short'` بالعربية ليست مختصرة كذلك** — نفس مزلق `weekday:'short'`
   بالضبط: Intl يردّ «أغسطس» و«سبتمبر» كاملتين بينما الإنجليزية تردّ «Aug».
   ومقيسٌ في المعاينة أنّ الأسماء الكاملة تُقصّ على ستّة أعمدة بعرض شاشة.
   والمصفوفة مكتوبة لا مقصوصة من مخرَج Intl: قصُّ ثلاثة محارف يكسر عند أوّل
   لهجة تختلف («آب» في الشام مقابل «أغسطس»). */
const AR_MONTH_TIGHT = ['ينا','فبر','مار','أبر','مايو','يون','يول','أغس','سبت','أكت','نوف','ديس'];
function monthTight(d){
  if(State.lang==='en'){
    try{ return new Intl.DateTimeFormat('en-GB', { month:'short' }).format(d); }catch(_){}
  }
  return AR_MONTH_TIGHT[d.getMonth()] || String(d.getMonth()+1);
}
function renderOwnerCharts(bookings){
  const ser = ownerRevSeries(bookings);
  const badge=$('#repChartScope'); if(badge) badge.textContent = ser.scope;
  const rc=$('#ownerRevChart');
  if(rc){ clear(rc); rc.append( ser.data.some(d=>d.value>0)
    ? createBarChart(ser.data,{ showVal:false, every:ser.every, label:t('chartRevenue') })
    : h('div',{class:'chart-empty'}, t('noData')) ); }
  // التوزيع حسب الساعة (المؤكّد) — يتبع النطاق نفسه لأن مصدره `scoped`
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
  setText('oTotal',bookings.length); setText('oConfirmed',confirmed.length); setText('oPending',pending.length); setText('oToday',todayCount);
  setText('oWeek',`${t('last7')}: ${weekCount}`); setText('oRevenue',formatMoney(webRev)); setText('oProfit',formatMoney(profit)); setText('oNet',formatMoney(net));
  /* 🔴 **النسبة بمقامها أو لا نسبة.** «نسبة التأكيد ٦٧٪» على ثلاثة حجوزات
     جملةٌ صحيحة حسابيًّا وكاذبة عمليًّا، والقاعدة مطبَّقة في `place_reply_speed`
     منذ ترحيل 28 (عتبةٌ **داخل العرض**) ومتروكةٌ هنا. `pctRow` تفرضها. */
  const perf=$('#repPerf');
  if(perf){
    clear(perf);
    put(perf, pctRow(t('confirmRate'), confirmed.length, bookings.length));
    const topField=getTopBy(bookings,b=>String(b.field_id||''),b=>b.field_name||'-');
    const topSource=getTopBy(bookings,b=>String(b.source||'direct').trim()||'direct',b=>String(b.source||'direct').trim()||'direct');
    if(topField) perf.append(statRow(t('topField'), topField.label, t('outOf',{ a: topField.count, b: bookings.length })));
    if(topSource) perf.append(statRow(t('topSource'), topSource.label, t('outOf',{ a: topSource.count, b: bookings.length })));
    const hourTop=getTopBy(confirmed,b=>String(b.hour||''),b=>b.time||((b.hour||'-')+':00'));
    if(hourTop) perf.append(statRow(t('bestTime'), hourTop.label, t('outOf',{ a: hourTop.count, b: confirmed.length })));
    put(perf, pctRow(t('siteShare'), confirmed.filter(isWebsite).length, confirmed.length, t('hintDirectVsExt')));
  }
  // اتجاه آخر 14 يوماً: كل الطلبات (بطاقة الكل) + المؤكدة (بطاقتها، بلون النعناع)
  const days14=[...Array(14)].map((_,i)=>dateAfter(i-13));
  setSpark('oTotal', days14.map(ds=>bookings.filter(b=>String(b.date)===ds).length));
  setSpark('oConfirmed', days14.map(ds=>confirmed.filter(b=>String(b.date)===ds).length), 'spark-ok');
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

/* ═══ تاريخ العميل — أهمّ معلومةٍ تُغيّر قرار القبول، وكانت غائبة ═══════════
   كان المالك يقرأ اسمًا ورقمًا ويقرّر: أهذا زبونٌ من سنة، أم رقمٌ غاب مرّتين،
   أم أوّل مرّة؟ ثلاثة أجوبةٍ تُغيّر القرار، وكلُّها في `State.ownerData.bookings`
   عنده أصلًا — لا طلب شبكة ولا عمود جديد.
   ⚠️ **المطابقة على الرقم لا على الاسم**: العميل عندنا **رقم هاتف** لا حساب
      (نفس تعريف `/admin` حرفيًّا)، والاسم يُكتب مرّةً «أحمد» ومرّةً «احمد».
      و`normalizePhone` هي نفسها التي يُشتقّ منها بريدُ الدخول ⇒ صيغتان لرقمٍ
      واحد تُقرآن واحدًا.
   ⚠️ **ولا يُعدّ إلّا ما مضى فعلًا** (`isFinished`): حجزٌ مؤكَّد الأسبوع القادم
      ليس سجلًّا بعد، وعدُّه يجعل كلَّ عميلٍ جديد يبدو قديمًا.
   ⚠️ **و«أكثر عملائك» تحت العتبة لا تُقال**: صدارةٌ بحجزين تصف قلّة البيانات
      لا العميل — نفس `OWNER_MIN_N` المطبَّقة في التقارير. */
/* 🔴 **كان المسح كاملًا لكلّ بطاقة** — أي O(n²). الدالّة تُبنى منها
   `byPhone` من الحجوزات كلِّها، وتُنادى مرّةً لكلّ بطاقةٍ معلّقة وفي ورقة القرار
   وفي تبويب «اليوم» ⇒ مالكٌ بثلاثين طلبًا معلّقًا وخمسة آلاف حجز يدفع مئة
   وخمسين ألف نداء `normalizePhone` في إعادة رسمٍ واحدة. واليوم الكلفة صغيرة
   (مقيس على الشبكة: ٧ بطاقاتٍ معلّقة × ٥٤٥ حجزًا) — وهي تكبر بنجاح المالك،
   وهو أسوأ وقتٍ لاكتشافها.
   ⚠️ **والمفتاح هويّةُ المصفوفة نفسها** (`===`) لا طابعُ وقتٍ ولا علَمٌ يُرفَع
      باليد: `loadOwnerDashboard` تُسند `State.ownerData = res` بمصفوفةٍ جديدة
      عند كلّ جلبة، فالفهرس يسقط من نفسه ولا يبقى بائتًا بعد قبولٍ أو رفض.
      وعلَمٌ يُصفَّر يدويًّا كان سينسى أوّل مسارِ كتابةٍ يُضاف بعدنا. */
let CH_SRC = null, CH_IDX = null;
function custIndex(all){
  if(CH_SRC === all && CH_IDX) return CH_IDX;
  const byPhone = {}, seen = {};
  all.forEach(x=>{
    const p = normalizePhone(x.phone); if(!p) return;
    (seen[p] ||= []).push(x);
    if(normStatus(x)==='confirmed' && isFinished(x)) (byPhone[p] ||= []).push(x);
  });
  let top = 0; for(const k in byPhone) if(byPhone[k].length > top) top = byPhone[k].length;
  CH_SRC = all; CH_IDX = { byPhone, seen, top };
  return CH_IDX;
}
function customerHistory(b){
  const phone = normalizePhone(b && b.phone);
  if(!phone) return null;
  const all = State.ownerData?.bookings || [];
  const ix = custIndex(all);
  const row = String(b.row_number);
  const mine = (ix.seen[phone]||[]).filter(x=>String(x.row_number)!==row);
  const done = (ix.byPhone[phone]||[]).filter(x=>String(x.row_number)!==row);
  const n = done.length;
  if(!n) return { text: mine.length ? t('chFirstPlay') : t('chNew'), cls:'ch-new' };
  const noShows = done.filter(isNoShow).length;
  /* الصدارة تُقاس على **من لعب فعلًا** لا على من أرسل طلبًا: أكثر عملائك هو
     أكثرهم حضورًا، لا أكثرهم طلبًا. */
  const top = ix.top;
  if(noShows) return { text: t('chWithNoShow', { n: nBookings(n), k: nTimes(noShows) }), cls:'ch-warn' };
  if(n >= OWNER_MIN_N && n === top) return { text: t('chTop', { n: nBookings(n) }), cls:'ch-ok' };
  return { text: t('chClean', { n: nBookings(n) }), cls:'ch-ok' };
}
function custHistLine(b){
  const ch = customerHistory(b); if(!ch) return null;
  return h('div',{class:'cust-hist '+ch.cls}, ico('person','svg-sm'), h('span',{}, ch.text));
}
/* ملاحظة اللاعب — نصٌّ من مستخدم ⇒ يمرّ بـ`h()` (textContent) لا بـ`innerHTML`.
   والسقف مفروضٌ في القاعدة (‏240) فلا يفيض السطر مهما أُرسل. */
function noteLine(b){
  const txt = String((b && b.note) || '').trim(); if(!txt) return null;
  return h('div',{class:'bk-note-said'},
    h('span',{class:'bk-note-said-lbl'}, t('bkNoteSaid')),
    h('bdi',{class:'bk-note-said-txt'}, txt));
}
function ownerBookingCard(b){
  /* 🔴 **الشارة وشريحتا العمر والمهلة خرجت كلُّها إلى الشريط العلوي** (الدفعة ٤٠):
     كانت أربعةَ عناصر مكدَّسةً في عمودٍ بأعلى اليمين تقول شيئًا واحدًا، وتزاحم
     اسمَ الملعب على أضيق موضعٍ في البطاقة. وما بقي في هذا الركن شارةُ «لم يحضر»
     وحدها — وهي **حقيقةٌ أخرى** لا حالةٌ ثانية. */
  const card=h('div',{class:'card booking-strip has-hd '+normStatus(b)+(isNoShow(b)?' bk-noshow':''), style:{marginBottom:'14px'}});
  card.append(bookingStripHead(b, true));
  const body=h('div',{class:'bk-body'});
  card.append(body);
  body.append(
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
          /* 🔴 **الموعد صار عنوانًا لا حاشيتين** (بلاغ المالك 2026-08-22:
             «بطاقات الحجز تكون أوضح من ناحية اليوم والساعة»). كان سطرين
             صغيرين بلون `--muted`: أحدهما **التاريخ خامًا** كما يخرج من القاعدة
             (`2026-08-22`) والآخر مدى الوقت — أي أنّ المالك يقرأ رقمًا آليًّا
             ليعرف أيّ يومٍ هذا. الآن اسمُ اليوم أوّلًا («اليوم» و«بكرا» حيث
             يصحّان) ثمّ التاريخ القصير ثمّ المدى، بوزنٍ يميّزه عن بقيّة السطور.
             ⚠️ **ونفس مكوّن لوح «حجزك القادم» بالحرف** (`.trk-when` منذ الدفعة
                ١٨): الموعد هو البطل في الوجهين لأنّ السؤال واحد — «متى؟».
             ⚠️ و`<bdi dir="ltr">` على المدى وحده: «4:00 م - 6:00 م» داخل جملة
                عربية ينقلب فيسبق الانتهاءُ الابتداء (مزلقٌ مسجَّل).
             ⚠️ والأرقام `tabular-nums` في CSS: البطاقات تُقرأ عمودًا واحدًا،
                وأرقامٌ متفاوتة العرض تجعل الأعمدة تتعرّج. */
          /* 🔴 و`.bk-when` **محجوزةٌ أصلًا** لحبّة الموعد في ورقة المراجعة
             (‏§35 ③: عمود موسَّط بصبغة الفعل وحدّ) — فاسمي كان سيرثها فيخرج
             صفُّ التاريخ عمودًا موسَّطًا داخل بطاقةٍ محاذاتها من البداية. وهي
             نفس عائلة `pl-card` و`place-meta` المسجَّلة: **فضاء الأصناف مشترك،
             والاسم العامّ يسرق قاعدةً لم تكتبها.** */
          h('div',{class:'owner-bk-when'},
            ico('cal','svg-sm'),
            h('span',{class:'owner-bk-when-day'}, dayLabel(b.date)+' '+shortDate(String(b.date).split('T')[0])),
            h('span',{class:'owner-bk-when-sep','aria-hidden':'true'}, '·'),
            h('bdi',{dir:'ltr', class:'owner-bk-when-time'},
              slotDisplay({ hour:Number(b.hour), startHour:Number(b.hour),
                            endHour:Number(b.hour)+2, label:b.time||'' }))))),
      isNoShow(b) ? h('span',{class:'badge badge-red', style:{flexShrink:'0'}}, t('noShowBadge')) : null),
    );
  body.append(
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'11px'}},
      h('span',{class:'info-line'}, ico('person','svg-sm'), ' '+(b.name||'-')),
      h('span',{class:'info-line'}, ico('phone','svg-sm'), ' '+(b.phone||'-')),
      h('span',{class:'info-line'}, ico('resize','svg-sm'), ' '+(b.players||'-')),
      h('span',{class:'info-line'}, ico('money','svg-sm'), ' '+formatCurrency(b.price||0)),
      h('span',{class:'info-line', style:{color:isOwnerManual(b)?'#2563eb':'var(--ink-2)'}}, isOwnerManual(b)?t('externalBooking'):t('srcPrefix')+(b.source||'direct'))));
  /* سطر التاريخ **على المعلّق وحده**: هو الموضع الذي يُتَّخذ فيه قرار، وعلى
     المؤكَّد يصير خبرًا لا يُغيّر شيئًا — والقاعدة المكتوبة في هذا الملفّ
     أنّ ما لا يُغيّر شيئًا لا يُعرَض. */
  if(normStatus(b)==='pending') put(body, custHistLine(b));
  /* ملاحظة اللاعب (ترحيل 33) — تُعرَض في **كل** الحالات لا على المعلّق وحده:
     «بنحتاج صدريّات» يبقى نافعًا بعد القبول إلى أن تُلعب المباراة. */
  put(body, noteLine(b));
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
    body.append(h('div',{class:'own-open'},
      h('span',{class:'own-open-badge'+(live?'':' pending')}, t(live?'gmBadgeLive':'gmBadgeWaiting'), ' · ',
        // العدد الذي يهمّ المالك واحد: **كم إنسانًا يدخل ملعبه** — لا تفصيل
        // المقاعد (منشور/مُحضَر) وهو شأن المضيف. و«حتى» لأن المقاعد قد لا تمتلئ.
        t('gmOwnerUpTo', { n: total })),
      h('span',{class:'own-open-note'}, t('gmOwnerNote'))));
  }
  if (isExpiredBooking(b)) body.append(h('div',{class:'reason-box', style:{marginTop:'0',marginBottom:'11px'}}, t('expiredReason')));
  else if (b.cancel_reason) body.append(h('div',{class:'reason-box', style:{marginTop:'0',marginBottom:'11px'}}, t('cancelReasonPrefix')+reasonText(b.cancel_reason)));
  const mk=(cls,txt,st)=>{ const x=h('button',{class:'owner-action '+cls}, txt); x.addEventListener('click',()=>updateBookingStatus(x,b.row_number,st)); return x; };
  const waBtn=()=>h('a',{href:'https://wa.me/'+String(b.phone||'').replace(/^0/,'962'),target:'_blank',rel:'noopener',class:'owner-wa-link'}, h('button',{class:'owner-action owner-wa'}, ico('wa','svg-sm'), ' '+t('actWhatsapp')));
  if (normStatus(b)==='pending'){
    /* 🔴 **زرٌّ واحد يفتح ورقة القرار، لا زرّان متجاوران على البطاقة.**
       وخلف الزرَّين مال، وكانا متساويَي الوزن على شاشةٍ تُلمَس بإبهام واحد في
       أعلى قائمةٍ طويلة — أسوأ موضعٍ ممكن لقرارٍ لا يُتراجَع عنه بسهولة.
       والورقة تحلّ ثلاثة معًا: مسارُ الإبهام إلى أسفل الشاشة، وتسلسلٌ هرميّ
       حقيقيّ (قبولٌ مملوء · رفضٌ هادئ)، والعودةُ إلى **موضعك في القائمة** بعد
       الردّ بدل إعادة الصفحة من رأسها.
       ⚠️ **وبلا نقرةٍ إضافية**: «قبول» كان يمرّ بنافذة تأكيدٍ على أي حال —
          والورقة **هي** تلك النافذة وقد صارت تحمل القرارين معًا. */
    const open=h('button',{class:'owner-action owner-approve owner-decide-open'}, t('dcOpen'));
    open.addEventListener('click', ()=>openDecideSheet(b));
    body.append(h('div',{class:'owner-decide'}, open));
    body.append(h('div',{class:'owner-actions-sec'}, waBtn()));
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
      /* ⚠️ **نبرةٌ دافئة لا حمراء**: التطبيق باردٌ كلُّه (تيل)، فالتحذير يضيع
         فيه ما لم يُكسَر البرود — والأحمر محجوزٌ للخطر الذي لا يُتراجَع عنه
         (حذف حساب · إلغاء حجز)، و«لم يحضر» علامةٌ تُرفَع وتُنزَل. */
      const ns=h('button',{class:'owner-action '+(isNoShow(b)?'owner-edit':'is-warn')},
        isNoShow(b) ? t('noShowUndoBtn') : t('noShowBtn'));
      ns.addEventListener('click', ()=>ownerToggleNoShow(ns, b));
      actions.append(ns);
    }
    body.append(actions);
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
      /* 🤚 نبضةٌ ثقيلة عند **الرفع** وخفيفة عند التراجع: «لم يحضر» أثقل ما
         يسجّله المالك على لاعب (المادّة ٩ — الحجز يبقى مكتملًا والعمولة
         مستحقّة)، فوزنُ اللمسة يطابق وزنَ الفعل. وبعد ردّ الخادم لا قبله. */
      buzz(on ? 26 : 8);
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
  /* 🔴 **ما ينتظر ردَّك أوّلًا** (طلب المالك 2026-08-22). كانت القائمة مرتَّبة
     بالتاريخ وحده، فالمعلّق يقع حيث يقع بينها — مقيس على بيانات الشبكة:
     `مؤكّد · مؤكّد · مؤكّد · معلّق · مؤكّد · معلّق` ⇒ الطلب الذي ينتظر جوابًا
     مدفونٌ بين ما لا يحتاج جوابًا. وهو المكان الوحيد الذي يخسر فيه المالك
     خانةً حقيقية: المعلّق **يحجزها** (‏`bookings_no_double_idx` يشمل `pending`)
     ثمّ تنقضي مهلته فتضيع (الدفعة ١٢ ②).
     ⚠️ **وقسمٌ ثالث لا فرزٌ داخل القسم**: الترتيب داخل «الحالية والقادمة» يبقى
        بالتاريخ كما هو — تجميعُ اليوم هو ما يجعل القائمة تُقرأ، وخلطُ معلّقٍ
        بعيدٍ في رأس يومٍ قريب كان سيكسره.
     ⚠️ **ولا يُعرَض القسم فارغًا**: صفرُ معلّقاتٍ حالةٌ صحيحة تُقال بغيابها. */
  const waiting = active.filter(b=>normStatus(b)==='pending');
  const rest    = active.filter(b=>normStatus(b)!=='pending');
  if (waiting.length){ el.append(sectionTitle(t('otPendingLbl'),waiting.length)); grouped(waiting); }
  if (rest.length){ el.append(sectionTitle(t('ownerActiveUpcoming'),rest.length)); grouped(rest); }
  if (!active.length) el.append(h('div',{class:'card',style:{textAlign:'center',color:'var(--soft)',marginBottom:'11px'}},t('noActiveUpcoming')));
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
        /* 🔴 **عمود الإجراءات صار صنفًا لا أنماطًا سطرية** (بلاغ المالك
           2026-08-22: «تأكّد من محاذاة الأزرار»). مقيس قبله عند 375px:
           «تعديل» 66.3px و«التسعير» 98.7px يبدآن من 36.8 وينتهيان عند 103.1
           و135.5 ⇒ حافّةٌ مسنَّنة؛ والمبدّل يحمل `align-self:center` في
           `app.css` فيغلب `align-items:flex-end` للأب ⇒ يبدأ عند 63.2 لا 36.8،
           أي **ثلاثة عناصر بثلاث محاذيات في عمودٍ واحد**. */
        h('div',{class:'field-acts'}, sw, edit, pricing))));
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

/* ═══════════════════════════════════════════════════════════════════════════
   تحليلات لوحة المالك — رقمٌ بلا مقارنة لا يقول شيئًا

   القاعدة التي تحكم هذا القسم كلَّه: **لا نسبة بلا مقامها، ولا نسبة تحت
   العتبة أصلًا.** «نسبة التأكيد ٦٧٪» على ثلاثة حجوزات جملةٌ صحيحة حسابيًّا
   وكاذبة عمليًّا. والقاعدة مطبَّقة في القاعدة نفسها منذ ترحيل 28
   (`place_reply_speed` تحجب ما دون سبعة **داخل العرض** لا في الواجهة)،
   وكانت مطبَّقةً هناك وحده ومتروكةً في ستّة مواضع هنا. `OWNER_MIN_N` هو
   نفس السبعة — والرقم واحدٌ عمدًا: عتبتان مختلفتان لنفس الفكرة تنحرفان.
   ═══════════════════════════════════════════════════════════════════════════ */
const OWNER_MIN_N = 7;

/* إزاحة يومٍ بصيغة YYYY-MM-DD. `dateAfter` تُزيح عن **اليوم** وحده، والمقارنة
   الأسبوعية تحتاج الإزاحة عن تاريخٍ معطًى. والظهيرة عمدًا: منتصف الليل يقع في
   حفرة التوقيت الصيفي في بعض المناطق فيقفز اليوم يومًا. */
function dayShift(ds, n){
  const d = new Date(String(ds)+'T12:00:00');
  d.setDate(d.getDate()+n);
  return ymd(d);
}
const dowOf = (ds) => new Date(String(ds)+'T12:00:00').getDay();

/* أوّل يومٍ فيه أثرٌ لهذا المكان — حدُّ المقارنة الأدنى. ويومٌ سابقٌ لوجود
   المكان **ليس صفرًا** بل غياب: عدُّه صفرًا يجعل كلَّ مكانٍ جديد يقرأ «أعلى
   من المعتاد بـ٤٠٠٪» في أسبوعه الأوّل. */
function ownerFirstDate(list){
  let min='';
  (list||[]).forEach(b=>{ const d=String(b.date||''); if(d && (!min || d<min)) min=d; });
  return min;
}

/* متوسّط نفس اليوم من الأسابيع الأربعة الماضية.
   ⚠️ **بنفس اليوم لا بالأمس**: الطلب على الملاعب موسميّته أسبوعية حادّة —
      الخميس ليس الأحد — فمقارنةُ خميسٍ بأربعاء تقيس اليومَ لا الأداء.
   ⚠️ ويعود `null` بأقلّ من عيّنتين: مقارنةٌ بعيّنةٍ واحدة ليست متوسّطًا. */
function sameWeekdayAvg(all, ds, valueFn, weeks){
  weeks = weeks || 4;
  const first = ownerFirstDate(all);
  const vals = [];
  for(let k=1; k<=weeks; k++){
    const d = dayShift(ds, -7*k);
    if(first && d < first) continue;
    vals.push(Number(valueFn(d)) || 0);
  }
  if(vals.length < 2) return null;
  return { avg: vals.reduce((a,b)=>a+b,0)/vals.length, n: vals.length };
}
/* سطر المقارنة الرمادي تحت الرقم البطل. ولا يُرسَم بلا أساسٍ يُقارَن به (م5). */
function compareLine(now, base, ds, fmt){
  if(!base) return null;
  const avg = base.avg;
  const txt = t('cmpAvg', { n: base.n, day: arabicDay(ds), val: fmt(avg) });
  let delta = null;
  if(avg > 0){
    const pct = Math.round(((now - avg)/avg)*100);
    if(pct !== 0) delta = { pct, up: pct > 0 };
  } else if(now > 0){
    delta = { pct:null, up:true };
  }
  return h('div',{class:'cmp-line'},
    h('span',{}, txt),
    delta ? h('span',{class:'cmp-delta '+(delta.up?'is-up':'is-down')},
      delta.pct===null ? t('cmpAboveNone')
        : t(delta.up?'cmpUp':'cmpDown', { p: Math.abs(delta.pct) })) : null);
}

/* ═══ ساعات الذروة — تُحسَب ولا تُفترَض ══════════════════════════════════
   لا «المساء ذروة» مكتوبةً بيد: الذروة هي **الساعات التي تحمل نصف حجوزاتك**
   مأخوذةً من الأزحم نزولًا. والمالك يقرأ أسماءها فيستطيع أن يخالفها إن أراد —
   وهذا هو الفرق بين رقمٍ يُفهَم ورقمٍ يُصدَّق. ولا تُحسَب تحت العتبة. */
function ownerPeakHours(confirmed){
  const total = confirmed.length;
  if(total < OWNER_MIN_N) return null;
  const byHour = {};
  confirmed.forEach(b=>{ const hr=Number(b.hour); if(Number.isFinite(hr)) byHour[hr]=(byHour[hr]||0)+1; });
  const hrs = Object.keys(byHour).map(Number).sort((a,b)=> byHour[b]-byHour[a] || a-b);
  if(!hrs.length) return null;
  const set = new Set(); let acc = 0;
  for(const hr of hrs){ set.add(hr); acc += byHour[hr]; if(acc*2 >= total) break; }
  return set;
}
const hourTxt = (hr) => String(hr).padStart(2,'0')+':00';
/* «١٨:٠٠ · ٢٠:٠٠ · ٢٢:٠٠» — والأرقام معزولة LTR وإلّا قلبها bidi في السطر العربي */
function hoursListEl(set){
  const arr=[...set].sort((a,b)=>a-b);
  return h('bdi',{dir:'ltr'}, arr.map(hourTxt).join(' · '));
}

/* نافذة القياس الماضية: من بداية النطاق المختار إلى اليوم، ومحدودةٌ بأوّل يومٍ
   فيه أثر. **والمستقبل خارجها**: خانةُ الخميس القادم لم تُعرَض بعد، وعدُّها
   «فارغة» يجعل كلَّ حسابِ كفاءةٍ يهبط كلّما فتحتَ التقويم أبعد. */
function ownerWindow(all){
  const days = REPORT_RANGES[State.reportRange || 'all'];
  const td = today();
  const first = ownerFirstDate(all);
  let from = days ? dateAfter(-(days-1)) : (first || td);
  if(first && from < first) from = first;
  if(from > td) from = td;
  return { from, to: td };
}
const windowDates = (w) => { const out=[]; for(let d=w.from; d<=w.to; d=dayShift(d,1)) out.push(d); return out; };

/* ═══ كفاءة الخانة — نسخةُ الملاعب من RevPASH ════════════════════════════
   الإيراد ÷ **الخانات المعروضة**، لا الإيراد وحده (يتجاهل الحجم) ولا الإشغال
   وحده (يتجاهل السعر). وذروةً وغيرَ ذروة لا رقمًا واحدًا — وهو بيت القصيد:
   رقمٌ مجمَّع يخلط ملعبًا ممتلئًا ثلاث ساعات بملعبٍ نصفِ ممتلئ طوال اليوم.
   ⚠️ و«المعروضة» لا «المتاحة» بدقّة: `fieldSlots` هي ما يُعلنه الملعب، وتاريخُ
      الإغلاقات الماضية غير محفوظ في العميل (‏`sbGetClosures` تجلب اليوم وما
      بعده) — فالتسمية تقول ما يُحسَب بالضبط بدل أن تدّعي دقّةً لا تملكها. */
function ownerCapacity(all, scoped){
  const fields=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
  if(!fields.length) return null;
  const w = ownerWindow(all);
  const dates = windowDates(w);
  if(dates.length < 7) return null;
  const conf = scoped.filter(b => normStatus(b)==='confirmed' && String(b.date||'') >= w.from && String(b.date||'') <= w.to);
  const peak = ownerPeakHours(conf);
  const slots = { peak:0, off:0 };
  dates.forEach(d=>{ fields.forEach(f=>{ fieldSlots(f).forEach(s=>{
    if(peak && peak.has(s.hour)) slots.peak++; else slots.off++;
  }); }); });
  const sold = { peak:{n:0,rev:0}, off:{n:0,rev:0} };
  conf.forEach(b=>{ const k = (peak && peak.has(Number(b.hour))) ? 'peak' : 'off';
                    sold[k].n++; sold[k].rev += Number(b.price)||0; });
  return { window:w, days:dates.length, peak, slots, sold,
           all:{ slots: slots.peak+slots.off, n: sold.peak.n+sold.off.n, rev: sold.peak.rev+sold.off.rev } };
}

/* ═══ زمن الاستباق — كم يومًا قبل اللعب يحجز الناس ═══════════════════════
   «متى أفتح التقويم» و«متى أخفّض لملء خانة الغد» سؤالان جوابهما هذا الرقم.
   ⚠️ **والوسيط لا المتوسّط**: حجزٌ واحد قبل ستّة أشهر يسحب المتوسّط وحده.
   ⚠️ **وحجوزات المالك اليدوية مستثناة**: يُدخلها بعد أن تقع، فزمن استباقها
      يقيس متى فتح اللوحة لا متى قرّر اللاعب. */
function ownerLeadDays(scoped){
  const vals = scoped.filter(b => !isOwnerManual(b) && ['confirmed','pending'].includes(normStatus(b)))
    .map(b=>{
      const c = new Date(String(b.timestamp||'').replace(' ','T')).getTime();
      const d = new Date(String(b.date||'')+'T12:00:00').getTime();
      if(Number.isNaN(c) || Number.isNaN(d)) return null;
      return Math.max(0, Math.round((d - c)/86400000));
    }).filter(v => v !== null).sort((a,b)=>a-b);
  if(vals.length < OWNER_MIN_N) return null;
  const mid = Math.floor(vals.length/2);
  const med = vals.length%2 ? vals[mid] : Math.round((vals[mid-1]+vals[mid])/2);
  return { median: med, n: vals.length };
}

/* ═══ عملاء لا حجوزات ═════════════════════════════════════════════════════
   «معدّل العودة ٪» رقمٌ وصفيّ؛ والقائمة هي القابلة للفعل. والعميل **رقم هاتف**
   لا حسابًا مسجَّلًا (نفس تعريف `/admin`) — فحجزُ الواتساب الذي أدخله المالك
   لنفس الرقم عميلٌ واحد لا اثنان.
   🔒 ولا باب خصوصيةٍ جديد: المالك يرى `customer_phone` لحجوزات ملعبه أصلًا
      عبر RLS، وهذا تجميعٌ لما يراه لا كشفٌ لما لا يراه. */
function ownerCustomers(scoped){
  const map = {};
  scoped.filter(b => normStatus(b)==='confirmed').forEach(b=>{
    const k = normalizePhone(b.phone||'') || String(b.player_id||'');
    if(!k) return;
    const c = (map[k] ||= { key:k, name:b.name||'', phone:b.phone||'', n:0, total:0, last:'' });
    c.n++; c.total += Number(b.price)||0;
    const d = String(b.date||'');
    if(d > c.last){ c.last = d; if(b.name) c.name = b.name; if(b.phone) c.phone = b.phone; }
  });
  const list = Object.values(map);
  const td = today(), cut = dateAfter(-21);
  return {
    list,
    uniq: list.length,
    back: list.filter(c=>c.n>1).length,
    top: list.slice().sort((a,b)=> b.total-a.total || b.n-a.n).slice(0,10),
    /* «انقطع» = عميلٌ **معتاد** (حجزان فأكثر) آخرُ لعبةٍ له مضت وتجاوزت ثلاثة
       أسابيع. ومن حجز مرّةً واحدة ليس منقطعًا بل لم يصر عميلًا بعد. */
    lapsed: list.filter(c => c.n>1 && c.last && c.last < cut && c.last <= td)
                .sort((a,b)=> b.total-a.total).slice(0,10),
  };
}

/* ═══ أثر سرعة الردّ ══════════════════════════════════════════════════════
   الوسيط وحده يقول «كم»، ولا يقول «وماذا يترتّب». وهذا هو الترتّب: نسبة
   التأكيد لمن رُدّ عليه بسرعة مقابل من انتظر.
   ⚠️ **والانقضاء التلقائي خارج الحساب** (‏`cancel_kind='expired'`): المُشغِّل
      في ترحيل 28 لا يكتب له `replied_at` أصلًا، وعدُّه ردًّا يجعل المُهمِل يبدو
      أسرعَ كلّما أهمل. وكلا الدلوين يحتاج عتبته وإلّا لم يُعرَض شيء. */
function ownerReplyEffect(scoped){
  const fast=[], slow=[];
  scoped.forEach(b=>{
    if(!b.replied_at) return;
    if(isExpiredBooking(b)) return;
    const c = new Date(String(b.timestamp||'').replace(' ','T')).getTime();
    const r = new Date(String(b.replied_at||'').replace(' ','T')).getTime();
    if(Number.isNaN(c) || Number.isNaN(r) || r < c) return;
    const mins = (r-c)/60000;
    if(mins <= 10) fast.push(b); else if(mins > 60) slow.push(b);
  });
  if(fast.length < OWNER_MIN_N || slow.length < OWNER_MIN_N) return null;
  const box = (arr) => { const ok = arr.filter(b=>normStatus(b)==='confirmed').length;
                         return { n: arr.length, ok, rate: calcPercent(ok, arr.length) }; };
  return { fast: box(fast), slow: box(slow) };
}

/* صفُّ «تسمية ⇠ قيمة» بمقامٍ اختياري تحته — المكوّن الوحيد لكل رقمٍ في
   التقارير، فلا ينحرف شكلُ رقمٍ عن شكل جاره. */
/* `Element.append(null)` يكتب النصّ «null» في الصفحة — والقيمة الغائبة هنا
   شائعة (كل نسبةٍ تحت العتبة تعود `null`). فالإضافة تمرّ من هنا دائمًا. */
const put = (box, el) => { if(el && box) box.append(el); };
function statRow(label, value, hint, tone){
  return h('div',{class:'srow'+(tone?' '+tone:'')},
    h('div',{class:'srow-main'},
      h('span',{class:'srow-lbl'}, label),
      h('span',{class:'srow-val'}, value)),
    hint ? h('div',{class:'srow-hint'}, hint) : null);
}
/* نسبةٌ **بمقامها دائمًا**، وتحت العتبة لا تُعرَض نسبةٌ إطلاقًا بل يُقال العدد
   وسببُ الامتناع. هذه م5 حرفيًّا مطبَّقةً على النسب. */
function pctRow(label, part, total, hint){
  if(!total) return null;
  if(total < OWNER_MIN_N)
    return statRow(label, t('tooFewVal',{ n: total }), t('tooFewHint',{ min: OWNER_MIN_N }), 'is-thin');
  return statRow(label, calcPercent(part,total)+'%', t('outOf',{ a: part, b: total }) + (hint ? ' · '+hint : ''));
}

/* ═══════════ لوحات التقارير ═══════════════════════════════════════════════ */

/* ملاحظات تحت ملخّص الإيراد: ما يعنيه الرقم فعلًا. */
function renderOwnerRevNotes(scoped){
  const box=$('#repRevNotes'); if(!box) return; clear(box);
  /* ⚠️ **التزامٌ لا نقد** — ولا بوّابة دفع في هذا المنتج (قرار المالك)، فما
     يُعرَض وعدُ دفعٍ عند الملعب. وطباعةُ «إيراد» بلا هذا السطر تجعل المالك
     يظنّ الرقم في جيبه، ثمّ يُفاجَأ بفرقٍ لا يعرف مصدره. */
  box.append(h('div',{class:'rev-note'}, t('revCommitNote')));
  const conf = scoped.filter(b=>normStatus(b)==='confirmed');
  const ns = conf.filter(isNoShow);
  if(ns.length){
    box.append(h('div',{class:'rev-note is-warn'},
      t('revUncollected', { n: ns.length, v: formatMoney(ns.reduce((s,b)=>s+(Number(b.price)||0),0)) })));
  }
  /* أثر المباريات المفتوحة — حجوزاتٌ ما كانت لتقع: لاعبٌ واحد لا يملأ ملعبًا.
     ولا يُعرَض السطر بلا مباراةٍ واحدة (م5). */
  const og = conf.filter(b=>b.visibility==='open');
  if(og.length){
    box.append(h('div',{class:'rev-note is-ok'},
      t('revOpenGames', { n: og.length, v: formatMoney(og.reduce((s,b)=>s+(Number(b.price)||0),0)) })));
  }
}

/* سرعة ردّك — الرقم الذي يقرؤه اللاعب فوق زرّ التأكيد، ومعه أثرُه. */
function renderOwnerReply(scoped){
  const card=$('#repReplyCard'), box=$('#repReplyBody'); if(!card||!box) return;
  const rs = State.ownerData && State.ownerData.reply_speed;
  if(!rs || !Number.isFinite(rs.median)){ card.hidden=true; clear(box); return; }
  card.hidden=false; clear(box);
  box.append(statRow(t('repReplyMedian'), replySpeedText(rs.median, State.lang),
                     t('repReplyBasis', { n: nReplies(rs.n) })));
  box.append(h('p',{class:'cap'}, t('repReplySeen')));
  const eff = ownerReplyEffect(scoped);
  if(eff){
    box.append(statRow(t('repReplyFast'), eff.fast.rate+'%', t('outOf',{ a: eff.fast.ok, b: eff.fast.n })));
    box.append(statRow(t('repReplySlow'), eff.slow.rate+'%', t('outOf',{ a: eff.slow.ok, b: eff.slow.n })));
  }
}

/* «أين يتسرّب المال؟» — ثلاثة أرقام تُخلَط عادةً، وواحدٌ منها وحده فعلٌ لك.
   🔴 **و«الإيراد الضائع» القديم حُذف**: كان (كلّ خانة فارغة × السعر)، فيحسب
      خانة التاسعة صباحًا التي لن يحجزها أحد في أيّ كون. رقمٌ مخيف بلا فعل
      يُدرِّب صاحبه على تجاهله — وهو نفس عيب الزرّ الذي يَعِد بما لا يقع.
      محلُّه **ما طُلب فعلًا**: طلبٌ وصلك وانقضى بلا ردّ. */
function renderOwnerLeak(scoped){
  const box=$('#repLeak'); if(!box) return; clear(box);
  const sum = (arr) => arr.reduce((s,b)=>s+(Number(b.price)||0),0);
  const expired = scoped.filter(isExpiredBooking);
  const rejected = scoped.filter(b => normStatus(b)==='rejected' && !isExpiredBooking(b));
  const cancelled = scoped.filter(b => normStatus(b)==='cancelled');
  /* ⚠️ **المنقضي ليس المرفوض** (ترحيل 15 يفرّقهما، واللوحة كانت تجمعهما في
     «إلغاء/رفض ٪»): الرفض **قرارُك** والانقضاء **إهمالُك**، وجمعُهما يطمس
     الفرق الوحيد الذي يستطيع صاحبه أن يفعل شيئًا حياله.
     ⚠️ وصفُّ المنقضي لا يُعرَض إن كان العمود غائبًا أصلًا (ترحيل 15 معلَّق):
        صفرٌ لا مصدر له يُقرأ «لا يحدث هذا عندي» وهو ادّعاء لا قياس. */
  if(SB_BK_EXTRA || expired.length){
    box.append(statRow(t('leakExpired'), formatMoney(sum(expired)),
      t('leakExpiredHint', { n: nRequests(expired.length) }), expired.length ? 'is-bad' : ''));
  }
  box.append(statRow(t('leakRejected'), formatMoney(sum(rejected)), t('leakRejectedHint', { n: nRequests(rejected.length) })));
  box.append(statRow(t('leakCancelled'), formatMoney(sum(cancelled)), t('leakCancelledHint', { n: nBookings(cancelled.length) })));
  const ns = scoped.filter(b => normStatus(b)==='confirmed' && isNoShow(b));
  if(ns.length) box.append(statRow(t('leakNoShow'), formatMoney(sum(ns)), t('leakNoShowHint', { n: nBookings(ns.length) })));
  /* الطاقة الفارغة تبقى — **موسومةً سقفًا نظريًّا لا هدفًا**، ومقصورةً على
     ساعات الذروة: تلك وحدها التي كان يمكن أن تُباع فعلًا. */
  const cap = ownerCapacity(State.ownerData?.bookings||[], scoped);
  if(cap && cap.peak && cap.slots.peak){
    const empty = Math.max(cap.slots.peak - cap.sold.peak.n, 0);
    const avg = cap.sold.peak.n ? (cap.sold.peak.rev / cap.sold.peak.n) : 0;
    if(empty && avg > 0){
      box.append(statRow(t('leakIdlePeak'), formatMoney(Math.round(empty*avg)),
        t('leakIdlePeakHint', { n: empty, days: nDays(cap.days) })));
      box.append(h('p',{class:'cap'}, t('leakIdleCeiling')));
    }
  }
}

/* الطلب المكبوت (ترحيل 32) — أثمنُ إشارةٍ في القاعدة، ولا يراها أحد. */
function renderOwnerDemand(){
  const card=$('#repDemandCard'), box=$('#repDemand'); if(!card||!box) return;
  const d=State.ownerData;
  const rows = (d && d.demand) || [];
  if(!d || !d.demand_ok || !rows.length){ card.hidden=true; clear(box); return; }
  card.hidden=false; clear(box);
  const fieldName = (fid) => ((d.fields||[]).find(f=>String(f.field_id)===String(fid))||{}).field_name || '';
  const td = today();
  /* الصفوف القادمة أوّلًا: تلك وحدها ما زال يمكن فعلُ شيء حيالها اليوم
     (تُفتح خانة · يُلغى إغلاق · يُضاف ملعب)، والماضية تصلح للتسعير لا للفعل. */
  const soon = rows.filter(r => r.date >= td).sort((a,b)=> b.n-a.n || a.date.localeCompare(b.date) || a.hour-b.hour).slice(0,6);
  if(soon.length){
    box.append(h('div',{class:'dm-head'}, t('repDemandSoon')));
    soon.forEach(r=> box.append(h('div',{class:'dm-row'},
      h('span',{class:'dm-when'}, arabicDay(r.date)+' ', h('bdi',{dir:'ltr'}, hourTxt(r.hour))),
      h('span',{class:'dm-where'}, h('bdi',{}, fieldName(r.field_id))),
      h('span',{class:'dm-n'}, t('repDemandN', { n: nWaiting(r.n) })))));
  }
  /* وتجميعٌ بالساعة على النافذة كلّها — هذه هي التي تقود التسعير (18)
     والإغلاق (17): أيّ ساعةٍ عليها طلبٌ يفوق ما تعرضه. */
  const byHour={}; rows.forEach(r=> byHour[r.hour]=(byHour[r.hour]||0)+r.n);
  const hrs=Object.keys(byHour).map(Number).sort((a,b)=> byHour[b]-byHour[a] || a-b).slice(0,4);
  if(hrs.length){
    box.append(h('div',{class:'dm-head'}, t('repDemandByHour')));
    box.append(h('div',{class:'dm-hours'}, hrs.map(hr=>
      h('span',{class:'dm-chip'}, h('bdi',{dir:'ltr'}, hourTxt(hr)), ' ', h('b',{}, String(byHour[hr]))))));
  }
}

/* كفاءة الخانة + زمن الاستباق. */
function renderOwnerCapacityCard(all, scoped){
  const box=$('#repCap'); if(!box) return; clear(box);
  const cap = ownerCapacity(all, scoped);
  if(!cap){ box.append(h('p',{class:'cap'}, t('repCapNone'))); return; }
  const per = (rev, slots) => slots ? formatMoney(Math.round((rev/slots)*100)/100) : '—';
  if(cap.peak){
    box.append(h('div',{class:'peak-line'}, t('repPeakIs'), ' ', hoursListEl(cap.peak)));
    box.append(statRow(t('repRevpashPeak'), per(cap.sold.peak.rev, cap.slots.peak),
      t('repRevpashHint', { n: cap.sold.peak.n, s: cap.slots.peak })));
    box.append(statRow(t('repRevpashOff'), per(cap.sold.off.rev, cap.slots.off),
      t('repRevpashHint', { n: cap.sold.off.n, s: cap.slots.off })));
    put(box, pctRow(t('repOccPeak'), cap.sold.peak.n, cap.slots.peak));
    put(box, pctRow(t('repOccOff'),  cap.sold.off.n,  cap.slots.off));
  } else {
    box.append(statRow(t('repRevpashAll'), per(cap.all.rev, cap.all.slots),
      t('repRevpashHint', { n: cap.all.n, s: cap.all.slots })));
    put(box, pctRow(t('occupancy'), cap.all.n, cap.all.slots));
    box.append(h('p',{class:'cap'}, t('repPeakTooFew')));
  }
  box.append(h('p',{class:'cap'}, t('repCapBasis', { days: nDays(cap.days) })));
  const lead = ownerLeadDays(scoped);
  if(lead) box.append(statRow(t('repLead'), t('repLeadVal', { n: nDays(lead.median) }), t('repLeadHint', { n: nBookings(lead.n) })));
}

/* عملاء لا حجوزات. */
function renderOwnerCustomersCard(scoped){
  const box=$('#repCust'); if(!box) return; clear(box);
  const c = ownerCustomers(scoped);
  if(!c.uniq){ box.append(h('p',{class:'cap'}, t('repCustNone'))); return; }
  box.append(statRow(t('repCustUniq'), String(c.uniq), t('repCustUniqHint')));
  put(box, pctRow(t('returnRate'), c.back, c.uniq, t('repCustBackHint')));
  if(c.top.length){
    box.append(h('div',{class:'dm-head'}, t('repCustTop')));
    box.append(h('div',{class:'cust-list'}, c.top.map(x=>
      h('div',{class:'cust-row'},
        h('span',{class:'cust-name'}, h('bdi',{}, x.name || x.phone || '—')),
        h('span',{class:'cust-n'}, t('repCustTimes', { n: nTimes(x.n) })),
        h('span',{class:'cust-val'}, formatMoney(x.total))))));
  }
  /* «منقطعون» — القائمة هي القابلة للفعل: رقمٌ تتصل به، لا نسبةٌ تقرؤها. */
  if(c.lapsed.length){
    box.append(h('div',{class:'dm-head'}, t('repCustLapsed')));
    box.append(h('div',{class:'cust-list'}, c.lapsed.map(x=>
      h('div',{class:'cust-row'},
        h('span',{class:'cust-name'}, h('bdi',{}, x.name || x.phone || '—')),
        h('span',{class:'cust-n'}, shortDate(x.last)),
        x.phone ? h('a',{class:'cust-wa', href:'https://wa.me/'+String(x.phone).replace(/^0/,'962'), target:'_blank', rel:'noopener',
                        'aria-label': t('actWhatsapp')}, ico('wa','svg-sm')) : null))));
    box.append(h('p',{class:'cap'}, t('repCustLapsedHint')));
  }
}

/* ═══ خريطة الامتلاء: ٧ أيام × ساعات ══════════════════════════════════════
   الخليّة **عددُ حجوزاتٍ مؤكّدة** لا نسبة: تاريخُ الإغلاقات الماضية غير محفوظ
   في العميل، ونسبةٌ مقامُها مجهول تكذب بثقة. والتمييز الذي يهمّ محفوظٌ مع ذلك:
   ساعةٌ **لا يعرضها أيّ ملعب** تُرسَم شرطةً لا صفرًا — فيفرّق القارئ بين «لا
   أبيع هذه الساعة» و«أبيعها ولا يشتريها أحد»، وهما قراران متعاكسان. */
function renderOwnerHeat(scoped){
  const box=$('#ownerHeat'); if(!box) return; clear(box);
  const fields=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
  const offered = new Set(fields.flatMap(f=>fieldSlots(f).map(s=>s.hour)));
  const hours=[...offered].sort((a,b)=>a-b);
  if(!hours.length){ box.append(h('p',{class:'cap'}, t('tlNoHoursSub'))); return; }
  const w = ownerWindow(State.ownerData?.bookings||[]);
  const cells={}; let max=0;
  scoped.filter(b => normStatus(b)==='confirmed' && String(b.date||'') >= w.from && String(b.date||'') <= w.to)
    .forEach(b=>{ const hr=Number(b.hour); if(!Number.isFinite(hr)) return;
      const k = dowOf(b.date)+'@'+hr; cells[k]=(cells[k]||0)+1; if(cells[k]>max) max=cells[k]; });
  const badge=$('#repHeatRange'); if(badge) badge.textContent = t('repHeatDays', { n: nDays(windowDates(w).length) });
  if(!max){ box.append(h('p',{class:'cap'}, t('repHeatNone'))); return; }
  const grid=h('div',{class:'heat-grid', style:{ gridTemplateColumns:`auto repeat(${hours.length}, minmax(30px,1fr))` }});
  grid.append(h('div',{class:'heat-head heat-day'}, ''));
  hours.forEach(hr=> grid.append(h('div',{class:'heat-head'}, h('bdi',{dir:'ltr'}, String(hr).padStart(2,'0')))));
  for(let d=0; d<7; d++){
    grid.append(h('div',{class:'heat-day'}, dowTightLabel(d)));
    hours.forEach(hr=>{
      const n = cells[d+'@'+hr] || 0;
      const lvl = n===0 ? 0 : Math.min(4, Math.ceil((n/max)*4));
      grid.append(h('div',{ class:'heat-cell l'+lvl,
        title: `${dowTightLabel(d)} ${hourTxt(hr)} — ${n}`,
        'aria-hidden':'true' }, n ? String(n) : ''));
    });
  }
  box.append(h('div',{class:'heat-wrap'}, grid));
  box.append(h('div',{class:'heat-legend'},
    h('span',{}, t('repHeatLow')),
    h('i',{class:'heat-key l1'}), h('i',{class:'heat-key l2'}), h('i',{class:'heat-key l3'}), h('i',{class:'heat-key l4'}),
    h('span',{}, t('repHeatHigh', { n: max }))));
  /* والاسم المنطوق يُبنى من نفس الأرقام المرسومة: شبكةٌ من ٧×ن خليّة لا تُقرأ
     خليّةً خليّة، والأعلى وحده هو الخبر. */
  let topK='', topV=0;
  Object.keys(cells).forEach(k=>{ if(cells[k]>topV){ topV=cells[k]; topK=k; } });
  if(topK){
    const [dd,hh]=topK.split('@');
    box.append(h('p',{class:'cap'}, t('repHeatAria', { day: dowTightLabel(Number(dd)), hr: hourTxt(Number(hh)), n: nBookings(topV) })));
  }
}
/* تسمية اليوم القصيرة — نفس مصفوفة الرسوم، والإنجليزية من Intl.
   ⚠️ و`weekday:'short'` بالعربية ليست مختصرة (يردّ «الخميس» كاملة) — والمزلق
      مسجَّل، فالمصفوفة مكتوبة لا مقصوصة من مخرَج Intl. */
function dowTightLabel(d){
  if(State.lang==='en'){
    try{ return new Intl.DateTimeFormat('en-GB',{weekday:'short'}).format(new Date(Date.UTC(2024,0,7+d,12))); }catch(_){}
  }
  return AR_DOW_TIGHT[d] || '';
}

/* ═══ تصدير CSV ═══════════════════════════════════════════════════════════
   ⚠️ **ولا يُدّعى ما لا يقع.** `<a download>` لا يفعل شيئًا في WebView أندرويد
      (لا مستمعَ تنزيل مسجَّلًا)، وWeb Share غير مطبَّقة فيه أصلًا — فزرٌّ يقول
      «نزّل» ثمّ لا ينزل شيء هو بالضبط ما تمنعه م5. فالمسار يُختار **بحسب أين
      نعمل**: مشاركةٌ إن وُجدت، وإلّا نسخٌ إلى الحافظة على الجهاز (والرسالة
      تقول «نسخنا» لا «نزّلنا»)، وتنزيلٌ حقيقي في المتصفّح.
   ⚠️ و`﻿` في أوّل الملفّ: بدونه يقرأ إكسل كلَّ اسمٍ عربي محرفاتٍ مشوّهة —
      نفس ما فُعل في تصدير `/admin`. */
/* ⚠️ **بلا تعبيرٍ نمطيّ فيه علامة اقتباس.** `/[",\n]/` تبدو بريئة، وقد أعمت
   `check-globals` عن **كلّ تعريفٍ بعدها في الشجرة كلّها**: الحارس يتخطّى
   النصوص ولا يعرف التعابير النمطية، فقرأ `"` بدايةَ نصٍّ وابتلع ما بعده ⇒
   ثمانية عشر بلاغًا كاذبًا عن أسماء معرَّفة فعلًا (وبلاغٌ كاذب واحد يكفي
   ليُعطَّل الحارس كلُّه — درسٌ مسجَّل). والبديل أوضح على أي حال. */
const CSV_SPECIAL = ['"', ',', ';', '\n', '\r'];
const csvCell = (v) => {
  const s = String(v==null ? '' : v);
  const need = CSV_SPECIAL.some(ch => s.indexOf(ch) >= 0);
  return need ? '"' + s.split('"').join('""') + '"' : s;
};
const csvRows = (rows) => rows.map(r=>r.map(csvCell).join(',')).join('\r\n');

function ownerBookingsCsv(scoped){
  const head=[t('csvDate'),t('csvHour'),t('csvField'),t('csvName'),t('csvPhone'),t('csvStatus'),t('csvPrice'),t('csvSource'),t('csvCreated')];
  const body=scoped.slice().sort((a,b)=> String(b.date||'').localeCompare(String(a.date||'')) || Number(b.hour)-Number(a.hour))
    .map(b=>[ b.date||'', b.time||hourTxt(Number(b.hour)||0), b.field_name||'', b.name||'', b.phone||'',
              isExpiredBooking(b) ? t('csvExpired') : statusLabel(normStatus(b)).t,
              Number(b.price)||0, b.source||'direct', String(b.timestamp||'').replace('T',' ').slice(0,16) ]);
  return csvRows([head, ...body]);
}
function ownerCustomersCsv(scoped){
  const c=ownerCustomers(scoped);
  const head=[t('csvName'),t('csvPhone'),t('csvTimes'),t('csvTotal'),t('csvLast')];
  return csvRows([head, ...c.list.slice().sort((a,b)=>b.total-a.total)
    .map(x=>[x.name||'', x.phone||'', x.n, Math.round(x.total*100)/100, x.last||''])]);
}
/* يُرجع ما **حدث فعلًا** لا ما نتمنّاه: 'share' · 'download' · 'copy' · 'abort' · 'fail' */
async function deliverText(filename, text){
  const native = document.body.classList.contains('native');
  const blob = new Blob(['﻿'+text], { type:'text/csv;charset=utf-8' });
  try{
    if(navigator.canShare && navigator.share && typeof File === 'function'){
      const f = new File([blob], filename, { type:'text/csv' });
      if(navigator.canShare({ files:[f] })){ await navigator.share({ files:[f], title:filename }); return 'share'; }
    }
  }catch(e){ if(e && e.name==='AbortError') return 'abort'; }
  if(!native){
    try{
      const url=URL.createObjectURL(blob);
      const a=h('a',{ href:url, download:filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 4000);
      return 'download';
    }catch(_){}
  }
  try{ await navigator.clipboard.writeText(text); return 'copy'; }catch(_){}
  return 'fail';
}
async function ownerExportCsv(btn){
  const d=State.ownerData; if(!d) return;
  const kind=(btn && btn.dataset.csv) || 'bookings';
  const scoped=reportScoped(d.bookings||[]);
  if(!scoped.length){ toast(t('csvEmpty'),'error'); return; }
  const stamp=today();
  const name=(kind==='customers'?'customers-':'bookings-')+stamp+'.csv';
  const text=kind==='customers' ? ownerCustomersCsv(scoped) : ownerBookingsCsv(scoped);
  await withLoading(btn, async()=>{
    const how=await deliverText(name, text);
    if(how==='abort') return;
    if(how==='fail'){ toast(t('csvFail'),'error'); return; }
    toast(t(how==='copy' ? 'csvCopied' : how==='share' ? 'csvShared' : 'csvSaved'),'success');
  });
}

/* «٣ طلبات» — رقمٌ حيّ يسبق معدودًا ⇒ يمرّ بـ`countNoun`، وإلّا خرجت
   «1 طلبات» و«11 طلبات». نفس نمط `nSeats` و`nPlaces` بالحرف. */
const nRequests = (n) => (State.lang==='en')
  ? (n===1 ? '1 request' : `${n} requests`)
  : countNoun(n, 'طلب واحد', 'طلبان', 'طلبات', 'طلبًا');
const nBookings = (n) => (State.lang==='en')
  ? (n===1 ? '1 booking' : `${n} bookings`)
  : countNoun(n, 'حجز واحد', 'حجزان', 'حجوزات', 'حجزًا');
/* الصفر له صيغته: «نفس اليوم» أوضح من «٠ أيام» — وهي الحالة الشائعة فعلًا
   في زمن الاستباق (من يحجز لليلته). */
const nDays = (n) => (State.lang==='en')
  ? (n===0 ? 'same day' : n===1 ? '1 day' : `${n} days`)
  : (n===0 ? 'نفس اليوم' : countNoun(n, 'يوم واحد', 'يومان', 'أيام', 'يومًا'));
const nReplies = (n) => (State.lang==='en')
  ? (n===1 ? '1 reply' : `${n} replies`)
  : countNoun(n, 'ردّ واحد', 'ردّان', 'ردود', 'ردًّا');
const nTimes = (n) => (State.lang==='en')
  ? (n===1 ? 'once' : n===2 ? 'twice' : `${n}×`)
  : countNoun(n, 'مرّة واحدة', 'مرّتان', 'مرّات', 'مرّة');
const nWaiting = (n) => (State.lang==='en')
  ? (n===1 ? '1 waiting' : `${n} waiting`)
  : countNoun(n, 'لاعب واحد مستنّي', 'لاعبان مستنّيان', 'لاعبين مستنّين', 'لاعبًا مستنّيًا');

/* ═══ ورقة القرار ═════════════════════════════════════════════════════════
   كلُّ ما يحتاجه القرار في مكانٍ واحد أسفل الشاشة: الحقائق، ثمّ فعلٌ مملوء
   وفعلٌ هادئ. ولا تُعيد كتابة البطاقة: تعرض ما **يُقرَّر عليه** لا ما يُتصفَّح.
   ⚠️ و«رفض» يمرّ بسببٍ إلزامي كما كان (‏`askReason(…, true)`) — والسبب يفيد
      مرّتين: يصل اللاعب في رسالة الواتساب، ويبقى في `cancel_reason` بيانًا
      يُحلَّل لاحقًا («ليش برفض؟» سؤالٌ لا جواب له اليوم رغم أنّ العمود موجود). */
function openDecideSheet(b){
  const sub=$('#dcSub'), body=$('#dcBody'), acts=$('#dcActions');
  if(!body || !acts) return;
  const dl=replyDeadlineChip(b), age=bookingAge(b);
  if(sub) sub.textContent = [age && age.label, dl && dl.label].filter(Boolean).join(' · ');
  clear(body); clear(acts);
  const row=(icon, val)=>h('div',{class:'dc-fact'}, ico(icon,'svg-sm'), h('bdi',{}, String(val==null?'-':val)));
  body.append(h('div',{class:'dc-facts'},
    row('cal', (b.date||'') + ' · ' + (b.time||'')),
    row('resize', b.field_name||''),
    row('person', b.name||'-'),
    row('phone', b.phone||'-'),
    row('money', formatCurrency(b.price||0))));
  /* التاريخ في الورقة كذلك لا على البطاقة وحدها: **هنا** تُضغط «قبول»، وهذه
     هي المعلومة الوحيدة التي تفصل بين زبونٍ من سنة ورقمٍ غاب مرّتين. */
  put(body, custHistLine(b));
  put(body, noteLine(b));
  /* المباراة المفتوحة تُقال **قبل** القبول لا بعده: العدد يغيّر القرار نفسه
     (كم إنسانًا يدخل الملعب)، ومعلومةٌ تغيّر قرارًا مكانها قبله. */
  if(b.visibility === 'open'){
    body.append(h('div',{class:'own-open'},
      h('span',{class:'own-open-badge pending'}, t('gmBadgeWaiting'), ' · ', t('gmOwnerUpTo',{ n: Number(b.needed||0) })),
      h('span',{class:'own-open-note'}, t('gmOwnerNote'))));
  }
  const ok=h('button',{class:'sbtn'}, t('actApprove'));
  ok.addEventListener('click', ()=>decideBooking(ok, b, 'confirmed'));
  const phone=normalizePhone(b.phone||'');
  const wa = phone ? h('a',{ class:'cbtn dc-wa', href:'https://wa.me/'+phone, target:'_blank', rel:'noopener' },
                        ico('wa','svg-sm'), ' '+t('actWhatsapp')) : null;
  /* «رفض» زرٌّ نصّي بلا تعبئة: أهدأُ من القبول عمدًا، وهدفُ لمسه كامل. */
  const no=h('button',{class:'dc-decline'}, t('actDecline'));
  no.addEventListener('click', ()=>decideBooking(no, b, 'rejected'));
  acts.append(ok); if(wa) acts.append(wa); acts.append(no);
  Modal.open('modal-decide');
}
/* ⚠️ **تُغلَق الورقة أوّلًا** ثمّ يقع الفعل: `Modal.open` ينادي `closeAll`،
   فنافذة السبب كانت ستُخفي الورقة على أي حال — وإغلاقُها صراحةً يجعل مسار
   الرجوع (Escape · سحب · نقر خارجها) متّسقًا مع مسار الفعل. */
async function decideBooking(btn, b, status){
  Modal.close('modal-decide', true);
  await updateBookingStatus(btn, b.row_number, status, { skipConfirm:true });
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
  /* ⭐ **من نصيحةٍ إلى الشاشة التي تُنفَّذ فيها** (مراجعة جيميناي، البند ٩).
     التوصية كانت نصًّا مغلقًا: يقرأ المالك «جرّب سعرًا أقلّ صباح الثلاثاء» ثمّ
     يمشي ثلاث نقرات (الشريط ⇐ الملاعب ⇐ التسعير) ليصل إلى حيث يفعلها.
     ⚠️ **والزرّ ينقل ولا يكتب قاعدةً ولا يقترح رقمًا**: التوصية نصٌّ حرّ من
        النموذج، واشتقاقُ ملعبٍ وساعةٍ وسعرٍ منه اختراعٌ يمرّ تحت اسم «تطبيق
        فوري» — وهو م5 حرفيًّا. المالك يقرّر، ونحن نختصر الطريق.
     ⚠️ **وعلى `pricing` وحدها**: هي النوع الوحيد الذي له شاشةٌ واحدة لا لبس
        فيها. و`warning`/`marketing` لا شاشة لهما فزرٌّ عليهما يَعِد بمكانٍ
        لا وجود له.
     ⚠️ **وملعبٌ واحد ⇒ تُفتَح تسعيرتُه مباشرةً**: لا لبس أصلًا حينها، وقائمةٌ
        من عنصرٍ واحد نقرةٌ بلا قرار. وأكثرُ من ملعب ⇒ التبويب: التوصية
        على مستوى المكان، وتسميةُ ملعبٍ بعينه نيابةً عن المالك تخمين. */
  const goPricing=()=>{
    const fs=(State.ownerData?.fields||[]).filter(f=>f.active!==false);
    if(fs.length===1) return openPricing(fs[0].field_id);
    showOwnerTab('fields');
  };
  const paint=(list)=>list.forEach(it=>{
    const box=h('div',{},
      h('div',{class:'ai-i-title'}, String(it.title||'')),
      h('div',{class:'ai-i-text'}, String(it.advice||'')));
    if(String(it.type)==='pricing' && (State.ownerData?.fields||[]).length){
      const go=h('button',{class:'ai-i-go', type:'button'}, t('aiGoPricing'), h('span',{class:'btn-go','aria-hidden':'true'}));
      go.addEventListener('click', ()=>{ buzz(6); goPricing(); });
      box.append(go);
    }
    el.append(h('div',{class:'ai-insight t-'+String(it.type||'opportunity')},
      h('span',{class:'ai-i-ico','aria-hidden':'true'}, AI_TYPE_ICON[it.type]||'🤖'),
      box));
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
      ? t('ntfReason', { r: reasonText(d.cancel_reason) }) : '';
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
    let group = null, newSeen = 0;
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
      /* غير المقروء يصل **بعد** المقروء بقليل فتلتقطه العين بلا لونٍ فاقع.
         والفهرس للجديد وحده: لو عُدَّت الصفوف كلُّها لتأخّر أوّلُ جديدٍ خلف
         عشرين قديمًا، فصار التأخير ضجيجًا لا إشارة. والقديم بلا حركة أصلًا. */
      if(!n.read_at){ row.style.setProperty('--ntf-i', String(Math.min(newSeen++, 6))); }
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

