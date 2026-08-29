import { useState, useRef } from 'react'

// ─── Brand tokens — faithful to Al-Mustadaira brand kit ──────────────────────
const B = {
  // Backgrounds
  bgApp:       '#081D22',          // dark forest night
  bgSec:       '#0B252B',
  header:      '#0E3D45',          // the dark teal header from the kit
  // Surfaces (glass)
  glass:       'rgba(15,45,52,0.72)',
  glassBorder: 'rgba(127,189,199,0.16)',
  surface:     'rgba(15,45,52,0.9)',
  surfaceAlt:  '#0D2830',
  // Brand colors
  lime:        '#8CC63E',          // primary CTA / active / accent
  limeDim:     'rgba(140,198,62,0.12)',
  limeBorder:  'rgba(140,198,62,0.25)',
  limeGlow:    '0 10px 24px -8px rgba(120,180,50,0.45)',
  teal:        '#0F4B53',
  tealBright:  '#136069',
  mint:        '#4ADE80',          // success / confirmed
  mintDim:     'rgba(74,222,128,0.11)',
  // Text
  ink:         '#EAF0EE',
  muted:       '#A7B9B8',
  soft:        '#70847F',
  btnInk:      '#0B2227',          // text on lime buttons
  // Borders & shadows
  line:        'rgba(127,189,199,0.16)',
  shadowCard:  '0 24px 54px -22px rgba(0,0,0,0.78), 0 2px 10px -4px rgba(0,0,0,0.55)',
  shadowMd:    '0 14px 32px -12px rgba(0,0,0,0.66), 0 2px 8px -3px rgba(0,0,0,0.5)',
  // Radii
  rSm: '10px', rMd: '12px', rLg: '14px', rXl: '18px', r2xl: '22px', rFull: '999px',
}

const head:   React.CSSProperties = { fontFamily: "'Montserrat', 'Cairo', sans-serif" }
const arabic: React.CSSProperties = { fontFamily: "'Tajawal', 'Cairo', sans-serif" }
const body:   React.CSSProperties = { fontFamily: "'Inter', 'Tajawal', sans-serif" }

// ─── Types ────────────────────────────────────────────────────────────────────
type Role   = 'player' | 'owner' | null
type Screen = 'splash' | 'home' | 'venue' | 'confirmed' | 'dashboard'
type Sport  = 'All' | 'Football' | 'Padel' | 'Basketball' | 'Tennis' | 'Cricket' | 'Volleyball'

interface Venue {
  id: string; name: string; location: string
  sports: Exclude<Sport, 'All'>[]
  rating: number; reviews: number; pricePerHour: number
  imageId: string; distance: string; featured: boolean
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const VENUES: Venue[] = [
  { id:'1', name:'Al-Noor Sports Complex', location:'Al Wasl, Dubai',
    sports:['Football','Padel'], rating:4.8, reviews:312, pricePerHour:120,
    imageId:'photo-1575361204480-aadea25e6e68', distance:'1.2 km', featured:true },
  { id:'2', name:'Emirates Arena', location:'Al Qusais, Dubai',
    sports:['Basketball','Tennis'], rating:4.6, reviews:189, pricePerHour:90,
    imageId:'photo-1546519638-68e109498ffc', distance:'3.4 km', featured:true },
  { id:'3', name:'Jumeirah Courts', location:'Jumeirah 1, Dubai',
    sports:['Tennis','Padel'], rating:4.9, reviews:445, pricePerHour:150,
    imageId:'photo-1554068865-24ceec13d068', distance:'5.1 km', featured:false },
  { id:'4', name:'Al-Safa Sports Hub', location:'Al Safa, Dubai',
    sports:['Football','Basketball','Volleyball'], rating:4.5, reviews:227, pricePerHour:80,
    imageId:'photo-1565299624946-b28f40a0ae38', distance:'2.7 km', featured:false },
  { id:'5', name:'Desert Padel Club', location:'Business Bay, Dubai',
    sports:['Padel'], rating:4.7, reviews:156, pricePerHour:130,
    imageId:'photo-1532444651960-4c9e8e5f7a37', distance:'4.0 km', featured:true },
  { id:'6', name:'Crescent Cricket Ground', location:'Dubai Sports City',
    sports:['Cricket'], rating:4.4, reviews:98, pricePerHour:200,
    imageId:'photo-1624526267942-ab0ff8a3e972', distance:'8.2 km', featured:false },
]

const TIME_SLOTS = [
  {time:'07:00',available:false,price:80 },{time:'08:00',available:true, price:80 },
  {time:'09:00',available:true, price:100},{time:'10:00',available:false,price:100},
  {time:'11:00',available:true, price:100},{time:'14:00',available:true, price:90 },
  {time:'15:00',available:false,price:90 },{time:'16:00',available:true, price:120},
  {time:'17:00',available:true, price:140},{time:'18:00',available:false,price:140},
  {time:'19:00',available:true, price:150},{time:'20:00',available:true, price:150},
  {time:'21:00',available:true, price:130},{time:'22:00',available:true, price:110},
]

const SPORTS: Sport[] = ['All','Football','Padel','Basketball','Tennis','Cricket','Volleyball']
const SPORT_ICON: Record<string,string> = {
  All:'⚡', Football:'⚽', Padel:'🎾', Basketball:'🏀',
  Tennis:'🎾', Cricket:'🏏', Volleyball:'🏐',
}

const OWNER_BOOKINGS = [
  {id:'B001',player:'Ahmed Al-Rashid', avatar:'A',sport:'Football',court:'Court A',time:'18:00–19:00',status:'confirmed',amount:120},
  {id:'B002',player:'Sara Mohammed',   avatar:'S',sport:'Padel',   court:'Padel 1',time:'19:00–20:00',status:'confirmed',amount:130},
  {id:'B003',player:'Khalid Hassan',   avatar:'K',sport:'Football',court:'Court B',time:'20:00–21:00',status:'pending',  amount:120},
  {id:'B004',player:'Fatima Al-Zaabi',avatar:'F',sport:'Padel',   court:'Padel 2',time:'20:00–21:00',status:'confirmed',amount:130},
  {id:'B005',player:'Omar Yusuf',      avatar:'O',sport:'Football',court:'Court A',time:'21:00–22:00',status:'pending',  amount:120},
]

const INIT_COURTS = [
  {name:'Court A',sport:'Football',size:'5-a-side',active:true },
  {name:'Court B',sport:'Football',size:'5-a-side',active:true },
  {name:'Padel 1',sport:'Padel',   size:'Standard',active:true },
  {name:'Padel 2',sport:'Padel',   size:'Standard',active:false},
]

function makeDates(n: number) {
  return Array.from({length:n},(_,i) => { const d=new Date(2026,6,22); d.setDate(d.getDate()+i); return d })
}
const DATES     = makeDates(7)
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
function nextHour(t:string){ return (parseInt(t)+1).toString().padStart(2,'0')+':00' }

// ─── Logo mark (SVG brand mark from kit) ─────────────────────────────────────
function LogoMark({size=28,lime=false}:{size?:number;lime?:boolean}) {
  const s = lime ? B.lime : '#fff'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke={s} strokeWidth="2" opacity="0.9"/>
      <circle cx="20" cy="20" r="11" stroke={s} strokeWidth="1.5" opacity="0.5"/>
      <path d="M12 20 C12 14 16 10 20 10 C24 10 28 14 28 20" stroke={s} strokeWidth="2" strokeLinecap="round"/>
      <path d="M14 26 C16 29 24 29 26 26" stroke={s} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="3" fill={s} opacity="0.8"/>
      <line x1="12" y1="20" x2="28" y2="20" stroke={s} strokeWidth="1" opacity="0.4"/>
    </svg>
  )
}

// ─── Glass card ───────────────────────────────────────────────────────────────
function GlassCard({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return (
    <div style={{
      background: B.glass,
      border: `1px solid ${B.glassBorder}`,
      borderRadius: B.rXl,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      boxShadow: B.shadowCard,
      ...style,
    }}>{children}</div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({on,onChange}:{on:boolean;onChange:()=>void}) {
  return (
    <button onClick={onChange} style={{
      position:'relative', width:46, height:26, borderRadius:13, flexShrink:0,
      background: on ? B.lime : 'rgba(127,189,199,0.2)', border:'none', cursor:'pointer',
      transition:'background 0.2s', boxShadow: on ? B.limeGlow : 'none',
    }}>
      <span style={{
        position:'absolute', top:3, width:20, height:20, borderRadius:10,
        background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
        transition:'transform 0.2s', transform: on ? 'translateX(23px)' : 'translateX(3px)',
      }}/>
    </button>
  )
}

// ─── Lime CTA button ─────────────────────────────────────────────────────────
function LimeBtn({children,onClick,disabled,full}:{children:React.ReactNode;onClick?:()=>void;disabled?:boolean;full?:boolean}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...(full?{width:'100%'}:{}),
      background: disabled ? 'rgba(140,198,62,0.25)' : B.lime,
      color: disabled ? 'rgba(11,34,39,0.4)' : B.btnInk,
      border:'none', borderRadius: B.rLg,
      padding:'15px 24px', ...head, fontSize:15, fontWeight:900,
      letterSpacing:'0.05em', cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : B.limeGlow,
      transition:'transform 0.15s, box-shadow 0.15s',
    }}>{children}</button>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
function BottomNav({current,onGo,isOwner}:{current:Screen;onGo:(s:Screen)=>void;isOwner:boolean}) {
  const items = isOwner
    ? [{icon:'📊',label:'Overview',s:'dashboard'as Screen},{icon:'📅',label:'Bookings',s:'dashboard'as Screen},
       {icon:'🏟️',label:'Courts',  s:'dashboard'as Screen},{icon:'👤',label:'Profile', s:'dashboard'as Screen}]
    : [{icon:'🏠',label:'Home',    s:'home'as Screen},{icon:'🔍',label:'Explore', s:'home'as Screen},
       {icon:'📅',label:'Bookings',s:'home'as Screen},{icon:'👤',label:'Profile', s:'home'as Screen}]

  return (
    <div style={{
      position:'absolute', bottom:0, left:0, right:0,
      background: 'rgba(8,29,34,0.92)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderTop:`1px solid ${B.line}`,
      display:'flex', justifyContent:'space-around',
      padding:'6px 4px 10px',
    }}>
      {items.map(item => {
        const active = current===item.s || (current==='venue'&&item.s==='home')
        return (
          <button key={item.label} onClick={()=>onGo(item.s)} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            padding:'6px 12px', background:'none', border:'none', cursor:'pointer',
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
              background: active ? B.limeDim : 'transparent',
              border: active ? `1px solid ${B.limeBorder}` : '1px solid transparent',
              transition:'all 0.15s',
            }}>
              <span style={{fontSize:18}}>{item.icon}</span>
            </div>
            <span style={{...body, fontSize:10, fontWeight:700,
              color: active ? B.lime : B.soft}}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [role,setRole]         = useState<Role>(null)
  const [screen,setScreen]     = useState<Screen>('splash')
  const [sport,setSport]       = useState<Sport>('All')
  const [venue,setVenue]       = useState<Venue|null>(null)
  const [dateIdx,setDateIdx]   = useState(0)
  const [slotTime,setSlotTime] = useState<string|null>(null)
  const [ownerTab,setOwnerTab] = useState<'bookings'|'courts'>('bookings')
  const [courts,setCourts]     = useState(INIT_COURTS.map(c=>({...c})))
  const [bStatuses,setBStatuses] = useState(OWNER_BOOKINGS.map(b=>b.status))
  const bookRef = useRef(`ALM-${Math.floor(Math.random()*90000+10000)}`)

  function goVenue(v:Venue){ setVenue(v); setSlotTime(null); setScreen('venue') }
  function goBook(){
    if(!slotTime) return
    bookRef.current = `ALM-${Math.floor(Math.random()*90000+10000)}`
    setScreen('confirmed')
  }

  const filteredVenues = sport==='All' ? VENUES : VENUES.filter(v=>v.sports.includes(sport as any))

  // ── Splash ────────────────────────────────────────────────────────────────
  function SplashScreen() {
    return (
      <div style={{height:'100%', display:'flex', flexDirection:'column', background:B.bgApp, position:'relative', overflow:'hidden'}}>
        {/* Aurora background */}
        <div style={{position:'absolute', inset:'-25%', zIndex:0, pointerEvents:'none',
          background:`radial-gradient(circle at 20% 30%, rgba(15,75,83,0.4) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(140,198,62,0.15) 0%, transparent 45%),
                      radial-gradient(circle at 60% 20%, rgba(74,222,128,0.1) 0%, transparent 40%)`,
          filter:'blur(40px)',
          animation:'luxeDrift 20s ease-in-out infinite alternate'}}/>

        {/* Photo hero */}
        <div style={{position:'relative', flex:1, overflow:'hidden'}}>
          <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&h=900&fit=crop&auto=format"
            alt="Football pitch at night"
            style={{width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.45}}/>
          <div style={{position:'absolute', inset:0,
            background:`linear-gradient(to bottom, ${B.bgApp}cc 0%, transparent 30%, ${B.bgApp}f0 85%, ${B.bgApp} 100%)`}}/>

          {/* Logo centered top */}
          <div style={{position:'absolute', top:52, left:0, right:0, display:'flex', flexDirection:'column', alignItems:'center', gap:10, zIndex:2}}>
            <div style={{
              width:72, height:72, borderRadius:20,
              background: B.header,
              border:`1.5px solid rgba(140,198,62,0.35)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:`0 8px 32px rgba(0,0,0,0.5), ${B.limeGlow}`,
            }}>
              <LogoMark size={44}/>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{...head, fontWeight:900, fontSize:22, color:B.lime, letterSpacing:'-0.02em'}}>
                AL-MUSTADAIRA
              </div>
              <div style={{...arabic, fontSize:13, color:B.muted, marginTop:1}}>المستديرة</div>
            </div>
          </div>
        </div>

        {/* Bottom content */}
        <div style={{position:'relative', zIndex:1, padding:'0 24px 40px'}}>
          {/* Live badge */}
          <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:7,
              background:B.glass, border:`1px solid ${B.glassBorder}`,
              borderRadius:B.rFull, padding:'8px 16px',
              backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)'}}>
              <span style={{width:6, height:6, borderRadius:3, background:B.lime, display:'block',
                animation:'pulseGreen 2s infinite'}}/>
              <span style={{...body, fontSize:12, fontWeight:700, color:B.lime}}>47 courts live now</span>
            </div>
          </div>

          <h1 style={{...head, fontWeight:900, fontSize:36, color:B.ink, textAlign:'center',
            letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:8}}>
            Book Your Pitch,<br />
            <span style={{color:B.lime}}>Instantly.</span>
          </h1>
          <p style={{...body, fontSize:13, color:B.muted, textAlign:'center', marginBottom:28, lineHeight:1.65}}>
            Football · Padel · Basketball · Tennis and more<br/>احجز ملعبك خلال ثوانٍ
          </p>

          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <LimeBtn onClick={()=>{setRole('player');setScreen('home')}} full>
              I'm a Player · لاعب
            </LimeBtn>
            <button onClick={()=>{setRole('owner');setScreen('dashboard')}} style={{
              ...body, width:'100%', background:B.glass, color:B.ink,
              border:`1.5px solid ${B.glassBorder}`, borderRadius:B.rLg,
              padding:'15px 0', fontSize:14, fontWeight:700, cursor:'pointer',
              backdropFilter:'blur(8px)',
            }}>
              I Manage a Venue · مالك ملعب
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Home ──────────────────────────────────────────────────────────────────
  function HomeScreen() {
    return (
      <div style={{height:'100%', position:'relative', background:B.bgApp}}>
        <div style={{height:'100%', overflowY:'auto'}} className="scrollbar-hide">

          {/* Header — the dark teal from brand kit */}
          <div style={{
            background: B.header,
            padding:'44px 20px 20px',
            position:'relative', overflow:'hidden',
            boxShadow:`0 16px 36px -18px rgba(0,0,0,0.7)`,
          }}>
            {/* Subtle lime underline per brand kit */}
            <div style={{position:'absolute', bottom:0, left:'14%', right:'14%', height:1,
              background:B.lime, opacity:0.3}}/>
            {/* Grid pattern overlay */}
            <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:0.06,
              backgroundImage:`linear-gradient(rgba(140,198,62,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(140,198,62,0.4) 1px, transparent 1px)`,
              backgroundSize:'40px 40px',
              maskImage:'linear-gradient(180deg, #000, transparent)'}}/>

            <div style={{position:'relative', zIndex:1}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                {/* Brand */}
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:44, height:44, borderRadius:13, background:'rgba(255,255,255,0.1)',
                    border:'1.5px solid rgba(255,255,255,0.18)', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0}}>
                    <LogoMark size={28}/>
                  </div>
                  <div>
                    <div style={{...head, fontWeight:800, fontSize:18, color:B.lime, letterSpacing:'-0.02em'}}>
                      AL-MUSTADAIRA
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:4, marginTop:1}}>
                      <svg width="10" height="10" fill={B.lime} viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                      </svg>
                      <span style={{...body, fontSize:11, color:'rgba(255,255,255,0.55)'}}>Al Wasl, Dubai</span>
                    </div>
                  </div>
                </div>
                {/* Avatar */}
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <button style={{width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.13)',
                    border:'1.5px solid rgba(255,255,255,0.2)', display:'grid', placeItems:'center',
                    cursor:'pointer', fontSize:16, backdropFilter:'blur(8px)'}}>🔔</button>
                  <div style={{width:40, height:40, borderRadius:12, background:B.lime,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    ...head, fontWeight:900, fontSize:16, color:B.btnInk}}>A</div>
                </div>
              </div>

              {/* Greeting */}
              <div style={{marginBottom:14}}>
                <div style={{...head, fontWeight:800, fontSize:22, color:'#fff', letterSpacing:'-0.02em'}}>
                  Good evening, Ahmed 👋
                </div>
                <div style={{...body, fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2}}>
                  أهلاً بك — Find your perfect court
                </div>
              </div>

              {/* Search bar */}
              <div style={{display:'flex', alignItems:'center', gap:10,
                background:'rgba(255,255,255,0.08)', backdropFilter:'blur(20px)',
                border:`1px solid rgba(127,189,199,0.25)`, borderRadius:B.rLg,
                padding:'5px 5px 5px 14px', boxShadow:'0 10px 30px rgba(0,0,0,0.4)'}}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <span style={{...body, fontSize:13, color:'rgba(255,255,255,0.3)', flex:1}}>
                  Search courts, venues…
                </span>
                <button style={{background:B.lime, color:B.btnInk, border:'none', borderRadius:11,
                  padding:'0 16px', height:38, ...head, fontSize:12, fontWeight:900,
                  letterSpacing:'0.05em', cursor:'pointer', boxShadow:B.limeGlow}}>
                  SEARCH
                </button>
              </div>
            </div>
          </div>

          {/* Sport filter tabs */}
          <div style={{padding:'14px 0 4px', display:'flex', gap:8, overflowX:'auto',
            paddingLeft:20}} className="scrollbar-hide">
            {SPORTS.map(s => (
              <button key={s} onClick={()=>setSport(s)} style={{
                flexShrink:0, display:'flex', alignItems:'center', gap:6,
                padding:'9px 16px', borderRadius:B.rFull,
                border: sport===s ? 'transparent' : `1.5px solid ${B.glassBorder}`,
                background: sport===s ? B.lime : B.glass,
                color: sport===s ? B.btnInk : B.muted,
                ...head, fontSize:12, fontWeight:800, letterSpacing:'0.02em',
                cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                backdropFilter:'blur(8px)',
                boxShadow: sport===s ? B.limeGlow : 'none',
                transition:'all 0.15s',
              }}>
                <span style={{fontSize:14}}>{SPORT_ICON[s]}</span>
                {s}
              </button>
            ))}
            <div style={{width:12, flexShrink:0}}/>
          </div>

          {/* Featured */}
          {filteredVenues.filter(v=>v.featured).length > 0 && (
            <div style={{marginTop:8}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'14px 20px 12px'}}>
                <span style={{...head, fontSize:15, fontWeight:800, color:B.ink, letterSpacing:'-0.01em'}}>
                  Featured Venues
                  <span style={{...body, fontSize:12, fontWeight:700, color:B.lime,
                    background:B.limeDim, borderRadius:B.rFull, padding:'2px 9px', marginLeft:8}}>
                    {filteredVenues.filter(v=>v.featured).length}
                  </span>
                </span>
                <button style={{...head, fontSize:12, fontWeight:800, color:B.lime, background:'none', border:'none', cursor:'pointer'}}>
                  See all →
                </button>
              </div>
              <div style={{display:'flex', gap:12, paddingLeft:20, overflowX:'auto'}} className="scrollbar-hide">
                {filteredVenues.filter(v=>v.featured).map(v => (
                  <button key={v.id} onClick={()=>goVenue(v)}
                    style={{flexShrink:0, width:220, borderRadius:B.r2xl, overflow:'hidden',
                      border:'none', cursor:'pointer', textAlign:'left', background:B.glass,
                      border:`1px solid ${B.glassBorder}`, backdropFilter:'blur(20px)',
                      boxShadow:B.shadowCard, transition:'transform 0.15s'}}>
                    <div style={{position:'relative', height:130}}>
                      <img src={`https://images.unsplash.com/${v.imageId}?w=320&h=200&fit=crop&auto=format`}
                        alt={v.name} style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}/>
                      <div style={{position:'absolute', inset:0,
                        background:'linear-gradient(to top, rgba(8,29,34,0.85) 0%, transparent 60%)'}}/>
                      {/* Rating */}
                      <div style={{position:'absolute', top:10, right:10,
                        background:'rgba(140,198,62,0.9)', borderRadius:8, padding:'4px 8px',
                        display:'flex', alignItems:'center', gap:3}}>
                        <span style={{fontSize:10}}>★</span>
                        <span style={{...head, fontSize:12, fontWeight:800, color:B.btnInk}}>{v.rating}</span>
                      </div>
                      {/* Sports */}
                      <div style={{position:'absolute', bottom:10, left:10, display:'flex', gap:5}}>
                        {v.sports.slice(0,2).map(s=>(
                          <span key={s} style={{...body, fontSize:10, fontWeight:700,
                            background:'rgba(8,29,34,0.7)', color:B.lime, borderRadius:6, padding:'3px 7px',
                            border:`1px solid ${B.limeBorder}`}}>{s}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{padding:'12px 14px 14px'}}>
                      <div style={{...head, fontWeight:700, fontSize:14, color:B.ink,
                        letterSpacing:'-0.01em', marginBottom:3}}>{v.name}</div>
                      <div style={{...body, fontSize:11, color:B.soft, marginBottom:10}}>{v.location}</div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                        paddingTop:10, borderTop:`1px solid ${B.line}`}}>
                        <div>
                          <span style={{...head, fontSize:20, fontWeight:900, color:B.lime}}>{v.pricePerHour}</span>
                          <span style={{...body, fontSize:11, color:B.soft}}> AED/hr</span>
                        </div>
                        <span style={{...body, fontSize:11, color:B.soft}}>{v.distance}</span>
                      </div>
                    </div>
                  </button>
                ))}
                <div style={{width:8, flexShrink:0}}/>
              </div>
            </div>
          )}

          {/* Nearby list */}
          <div style={{padding:'16px 20px 96px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <span style={{...head, fontSize:15, fontWeight:800, color:B.ink}}>Nearby Courts</span>
              <span style={{...body, fontSize:12, color:B.soft}}>{filteredVenues.length} venues</span>
            </div>
            {filteredVenues.length === 0 ? (
              <div style={{textAlign:'center', padding:'32px 0'}}>
                <div style={{fontSize:40, marginBottom:8}}>{SPORT_ICON[sport]}</div>
                <div style={{...body, fontSize:13, color:B.muted}}>No {sport} courts nearby</div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {filteredVenues.map(v => (
                  <button key={v.id} onClick={()=>goVenue(v)}
                    style={{display:'flex', alignItems:'center', background:B.glass,
                      border:`1px solid ${B.glassBorder}`, borderRadius:B.rXl,
                      overflow:'hidden', cursor:'pointer', textAlign:'left',
                      backdropFilter:'blur(20px)', boxShadow:B.shadowCard,
                      transition:'transform 0.15s'}}>
                    {/* Lime left indicator */}
                    <div style={{width:3, alignSelf:'stretch', background:B.lime, flexShrink:0}}/>
                    {/* Thumbnail */}
                    <div style={{width:76, height:76, flexShrink:0}}>
                      <img src={`https://images.unsplash.com/${v.imageId}?w=120&h=120&fit=crop&auto=format`}
                        alt={v.name} style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}/>
                    </div>
                    {/* Info */}
                    <div style={{flex:1, padding:'12px 10px', minWidth:0}}>
                      <div style={{...head, fontWeight:700, fontSize:13, color:B.ink,
                        marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {v.name}
                      </div>
                      <div style={{...body, fontSize:11, color:B.soft, marginBottom:7}}>
                        {v.location}
                      </div>
                      <div style={{display:'flex', gap:5}}>
                        {v.sports.slice(0,2).map(s=>(
                          <span key={s} style={{...body, fontSize:10, fontWeight:700,
                            color:B.lime, background:B.limeDim, border:`1px solid ${B.limeBorder}`,
                            borderRadius:B.rFull, padding:'2px 8px'}}>{s}</span>
                        ))}
                      </div>
                    </div>
                    {/* Price */}
                    <div style={{padding:'0 14px', textAlign:'right', flexShrink:0}}>
                      <div style={{...head, fontSize:22, fontWeight:900, color:B.lime, lineHeight:1}}>
                        {v.pricePerHour}
                      </div>
                      <div style={{...body, fontSize:10, color:B.soft}}>AED/hr</div>
                      <div style={{...body, fontSize:10, color:B.soft, marginTop:3}}>{v.distance}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <BottomNav current={screen} onGo={setScreen} isOwner={false}/>
      </div>
    )
  }

  // ── Venue detail ─────────────────────────────────────────────────────────
  function VenueScreen() {
    if(!venue) return null
    const v = venue
    const slot = TIME_SLOTS.find(s=>s.time===slotTime)

    return (
      <div style={{height:'100%', position:'relative', background:B.bgApp}}>
        <div style={{height:'100%', overflowY:'auto'}} className="scrollbar-hide">

          {/* Hero */}
          <div style={{position:'relative', height:280}}>
            <img src={`https://images.unsplash.com/${v.imageId}?w=600&h=500&fit=crop&auto=format`}
              alt={v.name} style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}/>
            <div style={{position:'absolute', inset:0,
              background:`linear-gradient(to bottom, rgba(8,29,34,0.4) 0%, transparent 40%, ${B.bgApp} 100%)`}}/>
            {/* Back */}
            <button onClick={()=>setScreen('home')} style={{
              position:'absolute', top:48, left:16, width:40, height:40, borderRadius:12,
              background:B.glass, border:`1px solid ${B.glassBorder}`, display:'flex',
              alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(10px)',
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={B.ink} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            {/* Rating badge */}
            <div style={{position:'absolute', top:48, right:16,
              background:B.lime, borderRadius:10, padding:'5px 10px',
              display:'flex', alignItems:'center', gap:3, boxShadow:B.limeGlow}}>
              <span style={{fontSize:12}}>★</span>
              <span style={{...head, fontSize:15, fontWeight:900, color:B.btnInk}}>{v.rating}</span>
            </div>
            {/* Name over hero */}
            <div style={{position:'absolute', bottom:20, left:18, right:18}}>
              <h2 style={{...head, fontWeight:900, fontSize:26, color:'#fff',
                letterSpacing:'-0.02em', marginBottom:8}}>
                {v.name}
              </h2>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {v.sports.map(s=>(
                  <span key={s} style={{...body, fontSize:11, fontWeight:700,
                    color:B.lime, background:B.limeDim, border:`1px solid ${B.limeBorder}`,
                    borderRadius:B.rFull, padding:'3px 10px', backdropFilter:'blur(8px)'}}>
                    {SPORT_ICON[s]} {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Content — glass card */}
          <div style={{padding:'0 16px 120px'}}>
            <GlassCard style={{padding:'16px 16px 0', marginBottom:12}}>
              {/* Location + reviews */}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
                <div style={{...body, fontSize:12, color:B.muted, display:'flex', alignItems:'center', gap:4}}>
                  <svg width="10" height="10" fill={B.lime} viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                  {v.location} · {v.distance}
                </div>
                <div style={{...body, fontSize:11, color:B.soft}}>{v.reviews} reviews</div>
              </div>

              {/* Amenities */}
              <div style={{display:'flex', gap:8, paddingBottom:16, overflowX:'auto', borderBottom:`1px solid ${B.line}`}}
                className="scrollbar-hide">
                {[['🅿️','Parking'],['🚿','Showers'],['💡','Floodlit'],['🏪','Café'],['🎽','Rental']].map(([icon,lbl])=>(
                  <div key={lbl as string} style={{flexShrink:0, display:'flex', alignItems:'center', gap:5,
                    background:'rgba(255,255,255,0.05)', border:`1px solid ${B.line}`,
                    borderRadius:10, padding:'6px 11px'}}>
                    <span style={{fontSize:14}}>{icon}</span>
                    <span style={{...body, fontSize:11, fontWeight:600, color:B.muted}}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* Date picker */}
              <div style={{padding:'14px 0'}}>
                <div style={{...head, fontSize:11, fontWeight:800, color:B.soft,
                  textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>
                  Select Date
                </div>
                <div style={{display:'flex', gap:8, overflowX:'auto', marginBottom:2}}
                  className="scrollbar-hide">
                  {DATES.map((d,i)=>(
                    <button key={i} onClick={()=>setDateIdx(i)} style={{
                      flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center',
                      width:50, padding:'10px 0', borderRadius:B.rMd, border:'none', cursor:'pointer',
                      background: dateIdx===i ? B.lime : 'rgba(255,255,255,0.06)',
                      boxShadow: dateIdx===i ? B.limeGlow : 'none',
                      transition:'all 0.15s',
                    }}>
                      <span style={{...body, fontSize:11, fontWeight:600,
                        color: dateIdx===i ? B.btnInk : B.soft}}>{DAY_SHORT[d.getDay()]}</span>
                      <span style={{...head, fontSize:22, fontWeight:900, lineHeight:1.15,
                        color: dateIdx===i ? B.btnInk : B.ink}}>{d.getDate()}</span>
                      <span style={{...body, fontSize:10, opacity:0.75,
                        color: dateIdx===i ? B.btnInk : B.soft}}>{MON_SHORT[d.getMonth()]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Time slots */}
            <GlassCard style={{padding:'16px'}}>
              <div style={{...head, fontSize:11, fontWeight:800, color:B.soft,
                textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>
                Available Times
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
                {TIME_SLOTS.map(s=>(
                  <button key={s.time} disabled={!s.available} onClick={()=>setSlotTime(s.time)} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0',
                    borderRadius:B.rMd, border:`1px solid ${slotTime===s.time ? B.lime : s.available ? B.glassBorder : 'transparent'}`,
                    cursor: s.available ? 'pointer' : 'not-allowed',
                    background: !s.available ? 'rgba(255,255,255,0.03)'
                      : slotTime===s.time ? B.lime : 'rgba(255,255,255,0.06)',
                    boxShadow: slotTime===s.time ? B.limeGlow : 'none',
                    transition:'all 0.15s',
                  }}>
                    <span style={{...head, fontSize:13, fontWeight:800,
                      color: !s.available ? 'rgba(255,255,255,0.15)'
                        : slotTime===s.time ? B.btnInk : B.ink}}>
                      {s.time}
                    </span>
                    {s.available && (
                      <span style={{...body, fontSize:10,
                        color: slotTime===s.time ? 'rgba(11,34,39,0.7)' : B.lime}}>
                        {s.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Booking bar */}
        <div style={{position:'absolute', bottom:0, left:0, right:0,
          background:'rgba(8,29,34,0.95)', backdropFilter:'blur(20px)',
          borderTop:`1px solid ${B.line}`, padding:'14px 20px 28px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{...body, fontSize:11, color:B.soft, marginBottom:2}}>Total price</div>
              <div>
                <span style={{...head, fontSize:32, fontWeight:900, color:B.lime, lineHeight:1}}>
                  AED {slot?.price ?? v.pricePerHour}
                </span>
                <span style={{...body, fontSize:12, color:B.soft}}> /hr</span>
              </div>
            </div>
            <LimeBtn onClick={goBook} disabled={!slotTime}>
              {slotTime ? 'Book Court →' : 'Select a slot'}
            </LimeBtn>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────
  function ConfirmedScreen() {
    if(!venue||!slotTime) return null
    const date = DATES[dateIdx]
    const slotPrice = TIME_SLOTS.find(s=>s.time===slotTime)?.price ?? venue.pricePerHour

    return (
      <div style={{height:'100%', background:B.bgApp, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'0 20px', position:'relative', overflow:'hidden'}}>
        {/* Aurora */}
        <div style={{position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(circle at 50% 40%, rgba(140,198,62,0.15) 0%, transparent 60%)`,
          filter:'blur(40px)'}}/>

        <div style={{position:'relative', zIndex:1, width:'100%'}}>
          {/* Check icon */}
          <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
            <div style={{width:88, height:88, borderRadius:44,
              background:B.limeDim, border:`2px solid ${B.limeBorder}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:B.limeGlow}}>
              <svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke={B.lime} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          </div>

          <div style={{textAlign:'center', marginBottom:28}}>
            <div style={{...body, fontSize:11, fontWeight:800, color:B.lime,
              textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6}}>
              Booking Confirmed · تم الحجز
            </div>
            <div style={{...head, fontWeight:900, fontSize:24, color:B.ink, marginBottom:4}}>
              {venue.name}
            </div>
            <div style={{...body, fontSize:13, color:B.muted}}>{venue.location}</div>
          </div>

          <GlassCard style={{padding:'20px', marginBottom:20}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
              {([
                ['Date',     `${DAY_FULL[date.getDay()]}, ${date.getDate()} ${MON_SHORT[date.getMonth()]}`],
                ['Time',     `${slotTime} – ${nextHour(slotTime)}`],
                ['Duration', '1 hour'],
                ['Paid',     `AED ${slotPrice}`],
              ] as [string,string][]).map(([label,val])=>(
                <div key={label} style={{background:'rgba(255,255,255,0.04)',
                  borderRadius:B.rMd, padding:'10px 12px'}}>
                  <div style={{...body, fontSize:10, color:B.soft, marginBottom:3}}>{label}</div>
                  <div style={{...head, fontSize:13, fontWeight:800, color:B.ink}}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{borderTop:`1px solid ${B.line}`, paddingTop:14,
              display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{...body, fontSize:10, color:B.soft, marginBottom:2}}>Booking Reference</div>
                <div style={{fontFamily:'monospace', fontSize:15, fontWeight:700, color:B.lime}}>
                  #{bookRef.current}
                </div>
              </div>
              <div style={{width:52, height:52, background:B.lime, borderRadius:14,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>📲</div>
            </div>
          </GlassCard>

          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <LimeBtn onClick={()=>{setScreen('home');setSlotTime(null)}} full>
              Back to Home
            </LimeBtn>
            <button style={{...body, width:'100%', background:B.glass, color:B.muted,
              border:`1.5px solid ${B.glassBorder}`, borderRadius:B.rLg,
              padding:'15px 0', fontSize:14, fontWeight:700, cursor:'pointer',
              backdropFilter:'blur(8px)'}}>
              Add to Calendar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  function DashboardScreen() {
    const confirmedRevenue = OWNER_BOOKINGS
      .filter((_,i)=>bStatuses[i]==='confirmed').reduce((s,b)=>s+b.amount,0)
    const pendingCount  = bStatuses.filter(s=>s==='pending').length
    const confirmedCnt  = bStatuses.filter(s=>s==='confirmed').length

    function accept(i:number){ setBStatuses(p=>p.map((s,j)=>j===i?'confirmed':s)) }
    function decline(i:number){ setBStatuses(p=>p.map((s,j)=>j===i?'declined':s)) }

    return (
      <div style={{height:'100%', position:'relative', background:B.bgApp}}>
        <div style={{height:'100%', overflowY:'auto'}} className="scrollbar-hide">

          {/* Header */}
          <div style={{background:B.header, padding:'44px 20px 20px', position:'relative', overflow:'hidden',
            boxShadow:`0 16px 36px -18px rgba(0,0,0,0.7)`}}>
            <div style={{position:'absolute', bottom:0, left:'14%', right:'14%', height:1, background:B.lime, opacity:0.3}}/>
            <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:0.06,
              backgroundImage:`linear-gradient(rgba(140,198,62,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(140,198,62,0.4) 1px, transparent 1px)`,
              backgroundSize:'40px 40px', maskImage:'linear-gradient(180deg, #000, transparent)'}}/>
            <div style={{position:'relative', zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div style={{...body, fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:4}}>Venue Dashboard · لوحة التحكم</div>
                <div style={{...head, fontWeight:900, fontSize:20, color:B.lime, letterSpacing:'-0.02em'}}>
                  Al-Noor Sports Complex
                </div>
                <div style={{...body, fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2, display:'flex', alignItems:'center', gap:4}}>
                  <svg width="10" height="10" fill={B.lime} viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                  Al Wasl, Dubai
                </div>
              </div>
              <div style={{textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6}}>
                <div style={{width:44, height:44, borderRadius:13, background:B.lime,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>🏟️</div>
                {pendingCount > 0 && (
                  <div style={{background:'rgba(140,198,62,0.2)', border:`1px solid ${B.limeBorder}`,
                    borderRadius:B.rFull, padding:'4px 10px', ...body, fontSize:11, fontWeight:700, color:B.lime}}>
                    {pendingCount} pending
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{padding:'14px 16px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            {[
              {label:"Today's Revenue", value:`${confirmedRevenue}`, unit:'AED', sub:'+12% vs last week', color:B.lime},
              {label:'Total Bookings',  value:`${OWNER_BOOKINGS.length}`, unit:'', sub:`${pendingCount} pending`, color:B.mint},
              {label:'Confirmed',        value:`${confirmedCnt}`, unit:'', sub:'accepted today', color:B.lime},
              {label:'Occupancy',        value:'78', unit:'%', sub:'4 courts active', color:B.mint},
            ].map(stat=>(
              <GlassCard key={stat.label} style={{padding:'14px 14px'}}>
                <div style={{...body, fontSize:11, color:B.soft, marginBottom:6}}>{stat.label}</div>
                <div>
                  <span style={{...head, fontSize:30, fontWeight:900, color:stat.color, lineHeight:1}}>
                    {stat.value}
                  </span>
                  <span style={{...head, fontSize:14, fontWeight:700, color:stat.color}}>{stat.unit}</span>
                </div>
                <div style={{...body, fontSize:11, color:B.soft, marginTop:4}}>{stat.sub}</div>
              </GlassCard>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex', gap:8, padding:'14px 16px 0'}}>
            {(['bookings','courts'] as const).map(tab=>(
              <button key={tab} onClick={()=>setOwnerTab(tab)} style={{
                flex:1, padding:'11px 0', borderRadius:B.rMd, border:'none', cursor:'pointer',
                ...head, fontSize:13, fontWeight:800, letterSpacing:'0.02em',
                background: ownerTab===tab ? B.lime : B.glass,
                color: ownerTab===tab ? B.btnInk : B.muted,
                boxShadow: ownerTab===tab ? B.limeGlow : 'none',
                backdropFilter:'blur(8px)', transition:'all 0.15s',
              }}>
                {tab==='bookings' ? "Today's Bookings" : 'Manage Courts'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{padding:'12px 16px 96px'}}>
            {ownerTab==='bookings' ? (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {OWNER_BOOKINGS.map((b,i)=>{
                  const status = bStatuses[i]
                  if(status==='declined') return null
                  return (
                    <GlassCard key={b.id} style={{overflow:'hidden'}}>
                      <div style={{padding:'14px', borderBottom: status==='pending' ? `1px solid ${B.line}` : 'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                          <div style={{display:'flex', alignItems:'center', gap:9}}>
                            <div style={{width:36, height:36, borderRadius:11, background:B.teal,
                              border:`1px solid ${B.lime}40`, display:'flex', alignItems:'center',
                              justifyContent:'center', ...head, fontSize:15, fontWeight:900, color:B.lime, flexShrink:0}}>
                              {b.avatar}
                            </div>
                            <div>
                              <div style={{...head, fontWeight:700, fontSize:14, color:B.ink}}>{b.player}</div>
                              <div style={{...body, fontSize:11, color:B.soft}}>{b.court} · {b.sport}</div>
                            </div>
                          </div>
                          <div style={{
                            background: status==='confirmed' ? B.mintDim : 'rgba(140,198,62,0.1)',
                            border:`1px solid ${status==='confirmed' ? 'rgba(74,222,128,0.25)' : B.limeBorder}`,
                            borderRadius:B.rFull, padding:'4px 10px',
                            ...body, fontSize:11, fontWeight:700,
                            color: status==='confirmed' ? B.mint : B.lime,
                          }}>
                            {status==='confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                          </div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div style={{...body, fontSize:12, color:B.soft, display:'flex', alignItems:'center', gap:4}}>
                            🕐 {b.time}
                          </div>
                          <div style={{...head, fontSize:20, fontWeight:900, color:B.ink}}>AED {b.amount}</div>
                        </div>
                      </div>
                      {status==='pending' && (
                        <div style={{display:'flex'}}>
                          <button onClick={()=>accept(i)} style={{
                            flex:1, padding:'12px 0', background:B.limeDim,
                            border:'none', borderRight:`1px solid ${B.line}`, cursor:'pointer',
                            ...head, fontSize:13, fontWeight:800, color:B.lime, letterSpacing:'0.03em',
                          }}>Accept ✓</button>
                          <button onClick={()=>decline(i)} style={{
                            flex:1, padding:'12px 0', background:'rgba(240,86,92,0.08)',
                            border:'none', cursor:'pointer',
                            ...head, fontSize:13, fontWeight:800, color:'#F0565C', letterSpacing:'0.03em',
                          }}>Decline ✕</button>
                        </div>
                      )}
                    </GlassCard>
                  )
                })}
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {courts.map((c,i)=>(
                  <GlassCard key={c.name} style={{padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
                    borderLeft:`3px solid ${c.active ? B.lime : 'rgba(127,189,199,0.2)'}`}}>
                    <div style={{width:46, height:46, borderRadius:14, background:B.teal,
                      border:`1px solid ${B.glassBorder}`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:22, flexShrink:0}}>
                      {c.sport==='Football' ? '⚽' : '🎾'}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{...head, fontWeight:700, fontSize:15, color:B.ink}}>{c.name}</div>
                      <div style={{...body, fontSize:12, color:B.soft}}>{c.sport} · {c.size}</div>
                      <div style={{display:'flex', alignItems:'center', gap:5, marginTop:4}}>
                        <div style={{width:6, height:6, borderRadius:3,
                          background: c.active ? B.lime : 'rgba(127,189,199,0.3)'}}/>
                        <span style={{...body, fontSize:11, fontWeight:600,
                          color: c.active ? B.lime : B.soft}}>
                          {c.active ? 'Active & bookable' : 'Closed'}
                        </span>
                      </div>
                    </div>
                    <Toggle on={c.active}
                      onChange={()=>setCourts(p=>p.map((ct,j)=>j===i?{...ct,active:!ct.active}:ct))}/>
                  </GlassCard>
                ))}
                <button style={{width:'100%', padding:'15px 0',
                  background:B.limeDim, border:`1.5px dashed ${B.limeBorder}`,
                  borderRadius:B.rXl, cursor:'pointer',
                  ...head, fontSize:14, fontWeight:800, color:B.lime, letterSpacing:'0.02em'}}>
                  + Add New Court
                </button>
              </div>
            )}
          </div>
        </div>
        <BottomNav current={screen} onGo={setScreen} isOwner/>
      </div>
    )
  }

  // ── Phone frame + routing ─────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100vh', background:'#04090B',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Inter', 'Tajawal', sans-serif", padding:'20px 0',
    }}>
      {/* Far background glow */}
      <div style={{position:'fixed', inset:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 70% 50% at 50% 50%, rgba(140,198,62,0.06) 0%, transparent 70%)`}}/>

      {/* Phone */}
      <div style={{
        position:'relative', width:390, height:844, flexShrink:0,
        borderRadius:52, overflow:'hidden',
        background: B.bgApp,
        boxShadow:`
          0 0 0 2px #0E3D45,
          0 0 0 8px #070E10,
          0 60px 120px rgba(0,0,0,0.9),
          0 0 100px rgba(140,198,62,0.07)
        `,
      }}>
        {/* Aurora inside phone */}
        <div style={{position:'absolute', inset:'-20%', zIndex:0, pointerEvents:'none',
          background:`
            radial-gradient(circle at 20% 30%, rgba(15,75,83,0.35) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(140,198,62,0.1) 0%, transparent 45%)
          `,
          filter:'blur(40px)',
          animation:'luxeDrift 20s ease-in-out infinite alternate'}}/>

        {/* Grid overlay */}
        <div style={{position:'absolute', inset:0, zIndex:0, pointerEvents:'none', opacity:0.03,
          backgroundImage:`linear-gradient(rgba(15,75,83,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,75,83,0.5) 1px, transparent 1px)`,
          backgroundSize:'60px 60px',
          maskImage:'radial-gradient(120% 80% at 50% 0%, #000, transparent 75%)'}}/>

        {/* Dynamic island */}
        <div style={{position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
          width:120, height:34, background:'#04090B', borderRadius:'0 0 22px 22px', zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          <div style={{width:8, height:8, borderRadius:4, background:'#0E3D45'}}/>
          <div style={{width:42, height:5, borderRadius:3, background:'#0E3D45'}}/>
          <div style={{width:8, height:8, borderRadius:4, background:'#0E3D45'}}/>
        </div>

        {/* Screen */}
        <div style={{position:'absolute', inset:0, zIndex:1}}>
          {screen==='splash'    && <SplashScreen/>}
          {screen==='home'      && <HomeScreen/>}
          {screen==='venue'     && <VenueScreen/>}
          {screen==='confirmed' && <ConfirmedScreen/>}
          {screen==='dashboard' && <DashboardScreen/>}
        </div>
      </div>

      {/* Role switcher */}
      {role!==null && (
        <button onClick={()=>{setRole(null);setScreen('splash')}} style={{
          marginTop:20, padding:'8px 18px', borderRadius:B.rFull,
          background:'rgba(140,198,62,0.06)', border:`1px solid ${B.limeBorder}`,
          color:B.soft, fontSize:12, fontWeight:700, cursor:'pointer', ...body,
        }}>← Switch role</button>
      )}
    </div>
  )
}
