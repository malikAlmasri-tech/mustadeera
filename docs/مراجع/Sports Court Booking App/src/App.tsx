import { useState, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Role   = 'player' | 'owner' | null
type Screen = 'splash' | 'home' | 'venue' | 'confirmed' | 'dashboard'
type Sport  = 'All' | 'Football' | 'Padel' | 'Basketball' | 'Tennis' | 'Cricket' | 'Volleyball'

interface Venue {
  id: string; name: string; location: string
  sports: Exclude<Sport, 'All'>[]
  rating: number; reviews: number; pricePerHour: number
  imageId: string; distance: string; featured: boolean
  description: string
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#F3EDE2',
  card:         '#FFFFFF',
  dark:         '#111111',
  accent:       '#FF3B00',
  accentLight:  'rgba(255,59,0,0.09)',
  accentBorder: 'rgba(255,59,0,0.22)',
  green:        '#00AE6C',
  greenLight:   'rgba(0,174,108,0.1)',
  greenBorder:  'rgba(0,174,108,0.25)',
  amber:        '#F5A623',
  text:         '#111111',
  muted:        '#91897E',
  faint:        'rgba(17,17,17,0.12)',
  border:       'rgba(17,17,17,0.09)',
  shadow:       '0 2px 16px rgba(0,0,0,0.07)',
  shadowMd:     '0 8px 40px rgba(0,0,0,0.11)',
}

const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" }
const body:    React.CSSProperties = { fontFamily: "'Inter', sans-serif" }

// ─── Data ─────────────────────────────────────────────────────────────────────
const VENUES: Venue[] = [
  {
    id: '1', name: 'Al-Noor Sports Complex', location: 'Al Wasl, Dubai',
    sports: ['Football', 'Padel'], rating: 4.8, reviews: 312, pricePerHour: 120,
    imageId: 'photo-1575361204480-aadea25e6e68', distance: '1.2 km', featured: true,
    description: 'Premium 5-a-side and padel facility with floodlit courts until midnight, freshly laid turf, and an on-site café.',
  },
  {
    id: '2', name: 'Emirates Arena', location: 'Al Qusais, Dubai',
    sports: ['Basketball', 'Tennis'], rating: 4.6, reviews: 189, pricePerHour: 90,
    imageId: 'photo-1546519638-68e109498ffc', distance: '3.4 km', featured: true,
    description: 'Indoor hardwood basketball court and four clay tennis courts in an air-conditioned facility.',
  },
  {
    id: '3', name: 'Jumeirah Courts', location: 'Jumeirah 1, Dubai',
    sports: ['Tennis', 'Padel'], rating: 4.9, reviews: 445, pricePerHour: 150,
    imageId: 'photo-1554068865-24ceec13d068', distance: '5.1 km', featured: false,
    description: "Dubai's highest-rated racket sports venue. Six padel courts and eight tennis courts with coaching available.",
  },
  {
    id: '4', name: 'Al-Safa Sports Hub', location: 'Al Safa, Dubai',
    sports: ['Football', 'Basketball', 'Volleyball'], rating: 4.5, reviews: 227, pricePerHour: 80,
    imageId: 'photo-1565299624946-b28f40a0ae38', distance: '2.7 km', featured: false,
    description: 'Multi-sport complex with three football pitches, two basketball courts, and a beach volleyball setup.',
  },
  {
    id: '5', name: 'Desert Padel Club', location: 'Business Bay, Dubai',
    sports: ['Padel'], rating: 4.7, reviews: 156, pricePerHour: 130,
    imageId: 'photo-1532444651960-4c9e8e5f7a37', distance: '4.0 km', featured: true,
    description: "Glass-backed courts under panoramic city views. Equipment rental and coaching packages available.",
  },
  {
    id: '6', name: 'Crescent Cricket Ground', location: 'Dubai Sports City',
    sports: ['Cricket'], rating: 4.4, reviews: 98, pricePerHour: 200,
    imageId: 'photo-1624526267942-ab0ff8a3e972', distance: '8.2 km', featured: false,
    description: 'Full-length turf and net facilities at Dubai Sports City. ICC-compliant pitch for private hire.',
  },
]

const TIME_SLOTS = [
  { time: '07:00', available: false, price: 80  },
  { time: '08:00', available: true,  price: 80  },
  { time: '09:00', available: true,  price: 100 },
  { time: '10:00', available: false, price: 100 },
  { time: '11:00', available: true,  price: 100 },
  { time: '14:00', available: true,  price: 90  },
  { time: '15:00', available: false, price: 90  },
  { time: '16:00', available: true,  price: 120 },
  { time: '17:00', available: true,  price: 140 },
  { time: '18:00', available: false, price: 140 },
  { time: '19:00', available: true,  price: 150 },
  { time: '20:00', available: true,  price: 150 },
  { time: '21:00', available: true,  price: 130 },
  { time: '22:00', available: true,  price: 110 },
]

const SPORTS: Sport[] = ['All', 'Football', 'Padel', 'Basketball', 'Tennis', 'Cricket', 'Volleyball']
const SPORT_ICON: Record<string, string> = {
  All: '⚡', Football: '⚽', Padel: '🎾', Basketball: '🏀',
  Tennis: '🎾', Cricket: '🏏', Volleyball: '🏐',
}

const SPORT_COLOR: Record<string, string> = {
  Football: '#166534', Padel: '#1D4ED8', Basketball: '#C2410C',
  Tennis: '#713F12', Cricket: '#7C2D12', Volleyball: '#581C87', All: C.dark,
}

const OWNER_BOOKINGS = [
  { id: 'B001', player: 'Ahmed Al-Rashid',  avatar: 'A', sport: 'Football', court: 'Court A', time: '18:00–19:00', status: 'confirmed', amount: 120 },
  { id: 'B002', player: 'Sara Mohammed',    avatar: 'S', sport: 'Padel',    court: 'Padel 1', time: '19:00–20:00', status: 'confirmed', amount: 130 },
  { id: 'B003', player: 'Khalid Hassan',    avatar: 'K', sport: 'Football', court: 'Court B', time: '20:00–21:00', status: 'pending',   amount: 120 },
  { id: 'B004', player: 'Fatima Al-Zaabi', avatar: 'F', sport: 'Padel',    court: 'Padel 2', time: '20:00–21:00', status: 'confirmed', amount: 130 },
  { id: 'B005', player: 'Omar Yusuf',       avatar: 'O', sport: 'Football', court: 'Court A', time: '21:00–22:00', status: 'pending',   amount: 120 },
]

const INIT_COURTS = [
  { name: 'Court A', sport: 'Football', size: '5-a-side', active: true  },
  { name: 'Court B', sport: 'Football', size: '5-a-side', active: true  },
  { name: 'Padel 1', sport: 'Padel',    size: 'Standard', active: true  },
  { name: 'Padel 2', sport: 'Padel',    size: 'Standard', active: false },
]

function makeDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 6, 22)
    d.setDate(d.getDate() + i)
    return d
  })
}
const DATES     = makeDates(7)
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function nextHour(t: string) {
  return (parseInt(t) + 1).toString().padStart(2, '0') + ':00'
}

// ─── Tiny shared components ───────────────────────────────────────────────────
function Pill({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...body, fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 9px',
      background: color + '18', color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, flexShrink: 0, cursor: 'pointer',
        background: on ? C.accent : 'rgba(17,17,17,0.15)', border: 'none', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform .2s',
        transform: on ? 'translateX(23px)' : 'translateX(3px)' }} />
    </button>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
function BottomNav({ current, onGo, isOwner }: { current: Screen; onGo: (s: Screen) => void; isOwner: boolean }) {
  const items = isOwner
    ? [{ icon: '📊', label: 'Overview', s: 'dashboard' as Screen },
       { icon: '📅', label: 'Bookings', s: 'dashboard' as Screen },
       { icon: '🏟️', label: 'Courts',   s: 'dashboard' as Screen },
       { icon: '👤', label: 'Profile',  s: 'dashboard' as Screen }]
    : [{ icon: '🏠', label: 'Home',     s: 'home' as Screen },
       { icon: '🔍', label: 'Explore',  s: 'home' as Screen },
       { icon: '📅', label: 'Bookings', s: 'home' as Screen },
       { icon: '👤', label: 'Profile',  s: 'home' as Screen }]

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 8px 10px',
      background: 'rgba(243,237,226,0.96)', backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {items.map(item => {
          const active = current === item.s || (current === 'venue' && item.s === 'home')
          return (
            <button key={item.label} onClick={() => onGo(item.s)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                borderTop: `2px solid ${active ? C.accent : 'transparent'}` }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ ...body, fontSize: 10, fontWeight: 600,
                color: active ? C.accent : C.muted }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole]           = useState<Role>(null)
  const [screen, setScreen]       = useState<Screen>('splash')
  const [sport, setSport]         = useState<Sport>('All')
  const [venue, setVenue]         = useState<Venue | null>(null)
  const [dateIdx, setDateIdx]     = useState(0)
  const [slotTime, setSlotTime]   = useState<string | null>(null)
  const [ownerTab, setOwnerTab]   = useState<'bookings' | 'courts'>('bookings')
  const [courts, setCourts]       = useState(INIT_COURTS.map(c => ({ ...c })))
  const [bStatuses, setBStatuses] = useState(OWNER_BOOKINGS.map(b => b.status))
  const bookingRef = useRef(`ALM-${Math.floor(Math.random() * 90000 + 10000)}`)

  function goVenue(v: Venue) {
    setVenue(v); setSlotTime(null); setScreen('venue')
  }
  function goBook() {
    if (!slotTime) return
    bookingRef.current = `ALM-${Math.floor(Math.random() * 90000 + 10000)}`
    setScreen('confirmed')
  }

  const filteredVenues = sport === 'All' ? VENUES : VENUES.filter(v => v.sports.includes(sport as any))

  // ─── Splash ──────────────────────────────────────────────────────────────
  function SplashScreen() {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.dark }}>
        {/* Branding strip */}
        <div style={{ padding: '44px 24px 20px', flexShrink: 0, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...display, fontWeight: 900, fontSize: 18, color: '#fff' }}>M</div>
            <div>
              <div style={{ ...display, fontWeight: 900, fontSize: 18, color: '#fff',
                letterSpacing: '0.06em', textTransform: 'uppercase' }}>Al-Mustadaira</div>
              <div style={{ ...body, fontSize: 10, color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em' }}>المستديرة · DUBAI</div>
            </div>
          </div>
        </div>

        {/* Photo */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&h=900&fit=crop&auto=format"
            alt="Floodlit football pitch" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 20%, rgba(17,17,17,0.5) 60%, #111 100%)' }} />

          {/* Live badge */}
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 20, padding: '6px 12px', backdropFilter: 'blur(8px)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: C.accent,
              display: 'block', animation: 'pulse 2s infinite' }} />
            <span style={{ ...body, fontSize: 11, fontWeight: 600, color: '#fff' }}>47 courts live</span>
          </div>

          {/* Hero text + CTAs */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 32px' }}>
            <h1 style={{ ...display, fontWeight: 900, fontSize: 64, lineHeight: 0.95,
              color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 12 }}>
              Book<br />
              <span style={{ color: C.accent }}>Your</span><br />
              Court.
            </h1>
            <p style={{ ...body, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28, lineHeight: 1.6 }}>
              Football · Padel · Basketball · Tennis<br />and more — reserve in seconds.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setRole('player'); setScreen('home') }}
                style={{ ...body, width: '100%', background: C.accent, color: '#fff', border: 'none',
                  borderRadius: 14, padding: '15px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                I'm a Player
              </button>
              <button onClick={() => { setRole('owner'); setScreen('dashboard') }}
                style={{ ...body, width: '100%', background: 'rgba(255,255,255,0.1)',
                  color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 14, padding: '15px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                I Manage a Venue
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Home ────────────────────────────────────────────────────────────────
  function HomeScreen() {
    return (
      <div style={{ height: '100%', position: 'relative', background: C.bg }}>
        <div style={{ height: '100%', overflowY: 'auto' }} className="scrollbar-hide">
          {/* Header */}
          <div style={{ background: C.dark, padding: '44px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ ...body, fontSize: 11, color: 'rgba(255,255,255,0.38)',
                  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <svg width="10" height="10" fill={C.accent} viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                  Al Wasl, Dubai
                </div>
                <div style={{ ...display, fontWeight: 900, fontSize: 26, color: '#fff',
                  letterSpacing: '-0.01em', lineHeight: 1 }}>Good evening, Ahmed</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...display, fontWeight: 900, fontSize: 16, color: '#fff', flexShrink: 0 }}>A</div>
            </div>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.35)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <span style={{ ...body, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
                Search courts, venues…
              </span>
            </div>
          </div>

          {/* Sport filter */}
          <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16 }}
            className="scrollbar-hide">
            {SPORTS.map(s => {
              const active = sport === s
              const sc = active ? C.accent : SPORT_COLOR[s] ?? C.dark
              return (
                <button key={s} onClick={() => setSport(s)}
                  style={{ ...body, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer', transition: 'all .15s',
                    background: active ? C.accent : C.card,
                    color: active ? '#fff' : sc,
                    boxShadow: active ? `0 4px 12px ${C.accent}40` : C.shadow }}>
                  <span style={{ fontSize: 15 }}>{SPORT_ICON[s]}</span>
                  {s}
                </button>
              )
            })}
          </div>

          {/* Featured */}
          {filteredVenues.filter(v => v.featured).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0 20px 12px' }}>
                <span style={{ ...display, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.01em' }}>
                  FEATURED
                </span>
                <button style={{ ...body, fontSize: 12, fontWeight: 600, color: C.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
                  See all
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, paddingLeft: 20, overflowX: 'auto' }}
                className="scrollbar-hide">
                {filteredVenues.filter(v => v.featured).map(v => (
                  <button key={v.id} onClick={() => goVenue(v)}
                    style={{ flexShrink: 0, width: 210, background: C.card, borderRadius: 18,
                      overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left',
                      boxShadow: C.shadowMd }}>
                    <div style={{ position: 'relative', height: 130 }}>
                      <img src={`https://images.unsplash.com/${v.imageId}?w=320&h=200&fit=crop&auto=format`}
                        alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', top: 10, right: 10,
                        background: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: '3px 8px',
                        display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ color: C.amber, fontSize: 11 }}>★</span>
                        <span style={{ ...body, color: '#fff', fontSize: 11, fontWeight: 700 }}>{v.rating}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px 14px' }}>
                      <div style={{ ...body, fontWeight: 700, fontSize: 14, color: C.text,
                        marginBottom: 4, lineHeight: 1.2 }}>{v.name}</div>
                      <div style={{ ...body, fontSize: 11, color: C.muted, marginBottom: 10 }}>{v.location}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <span style={{ ...display, fontSize: 22, fontWeight: 900, color: C.accent }}>
                            {v.pricePerHour}
                          </span>
                          <span style={{ ...body, fontSize: 11, color: C.muted }}> AED/hr</span>
                        </div>
                        <span style={{ ...body, fontSize: 11, color: C.muted }}>{v.distance}</span>
                      </div>
                    </div>
                  </button>
                ))}
                <div style={{ width: 8, flexShrink: 0 }} />
              </div>
            </div>
          )}

          {/* Nearby */}
          <div style={{ padding: '16px 20px 96px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ ...display, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.01em' }}>
                NEARBY
              </span>
              <span style={{ ...body, fontSize: 12, color: C.muted }}>
                {filteredVenues.length} venues
              </span>
            </div>

            {filteredVenues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{SPORT_ICON[sport]}</div>
                <div style={{ ...body, fontSize: 14, color: C.muted }}>No {sport} courts nearby</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredVenues.map(v => (
                  <button key={v.id} onClick={() => goVenue(v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 0, background: C.card,
                      borderRadius: 16, overflow: 'hidden', border: 'none', cursor: 'pointer',
                      textAlign: 'left', boxShadow: C.shadow }}>
                    {/* Accent bar */}
                    <div style={{ width: 4, alignSelf: 'stretch', background: C.accent, flexShrink: 0 }} />
                    {/* Thumbnail */}
                    <div style={{ width: 72, height: 72, flexShrink: 0, overflow: 'hidden' }}>
                      <img src={`https://images.unsplash.com/${v.imageId}?w=120&h=120&fit=crop&auto=format`}
                        alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, padding: '12px 10px', minWidth: 0 }}>
                      <div style={{ ...body, fontWeight: 700, fontSize: 13, color: C.text,
                        marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.name}
                      </div>
                      <div style={{ ...body, fontSize: 11, color: C.muted, marginBottom: 6 }}>{v.location}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {v.sports.slice(0, 2).map(s => (
                          <Pill key={s} color={SPORT_COLOR[s]}>{s}</Pill>
                        ))}
                      </div>
                    </div>
                    {/* Price + distance */}
                    <div style={{ padding: '0 14px 0 8px', textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ ...display, fontSize: 22, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
                        {v.pricePerHour}
                      </div>
                      <div style={{ ...body, fontSize: 10, color: C.muted, marginBottom: 4 }}>AED/hr</div>
                      <div style={{ ...body, fontSize: 10, color: C.muted }}>{v.distance}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <BottomNav current={screen} onGo={setScreen} isOwner={false} />
      </div>
    )
  }

  // ─── Venue detail ─────────────────────────────────────────────────────────
  function VenueScreen() {
    if (!venue) return null
    const v = venue
    const slot = TIME_SLOTS.find(s => s.time === slotTime)

    return (
      <div style={{ height: '100%', position: 'relative', background: C.bg }}>
        <div style={{ height: '100%', overflowY: 'auto' }} className="scrollbar-hide">
          {/* Hero */}
          <div style={{ position: 'relative', height: 260 }}>
            <img src={`https://images.unsplash.com/${v.imageId}?w=600&h=500&fit=crop&auto=format`}
              alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 50%, rgba(17,17,17,0.6) 100%)' }} />
            {/* Back */}
            <button onClick={() => setScreen('home')}
              style={{ position: 'absolute', top: 48, left: 16, width: 36, height: 36, borderRadius: 18,
                background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            {/* Rating badge */}
            <div style={{ position: 'absolute', top: 48, right: 16, display: 'flex', alignItems: 'center', gap: 4,
              background: C.amber, borderRadius: 10, padding: '5px 10px' }}>
              <span style={{ fontSize: 11 }}>★</span>
              <span style={{ ...display, fontSize: 15, fontWeight: 900, color: C.dark }}>{v.rating}</span>
              <span style={{ ...body, fontSize: 10, color: C.dark, opacity: 0.65 }}>({v.reviews})</span>
            </div>
            {/* Name overlay */}
            <div style={{ position: 'absolute', bottom: 20, left: 18, right: 18 }}>
              <h2 style={{ ...display, fontWeight: 900, fontSize: 30, color: '#fff',
                textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, marginBottom: 6 }}>
                {v.name}
              </h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.sports.map(s => (
                  <span key={s} style={{ ...body, fontSize: 11, fontWeight: 600, color: '#fff',
                    background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '3px 9px' }}>
                    {SPORT_ICON[s]} {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* White content card */}
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', marginTop: -16,
            padding: '20px 20px 0', minHeight: 'calc(100% - 244px)' }}>

            {/* Location + amenities */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
              ...body, fontSize: 12, color: C.muted }}>
              <svg width="10" height="10" fill={C.accent} viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              {v.location} · {v.distance} away
            </div>

            {/* Amenity chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }} className="scrollbar-hide">
              {[['🅿️','Parking'],['🚿','Showers'],['💡','Floodlit'],['🏪','Café'],['🎽','Rental']].map(([icon, label]) => (
                <div key={label as string}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                    background: C.bg, borderRadius: 10, padding: '6px 11px', ...body, fontSize: 12, color: C.text }}>
                  <span>{icon}</span>
                  <span style={{ fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: C.faint, marginBottom: 20 }} />

            {/* Date picker */}
            <div style={{ ...body, fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Select Date
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20 }} className="scrollbar-hide">
              {DATES.map((d, i) => (
                <button key={i} onClick={() => setDateIdx(i)}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: 50, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                    transition: 'all .15s',
                    background: dateIdx === i ? C.accent : C.bg,
                    color: dateIdx === i ? '#fff' : C.muted,
                    boxShadow: dateIdx === i ? `0 4px 14px ${C.accent}40` : 'none' }}>
                  <span style={{ ...body, fontSize: 11, fontWeight: 500 }}>{DAY_SHORT[d.getDay()]}</span>
                  <span style={{ ...display, fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>{d.getDate()}</span>
                  <span style={{ ...body, fontSize: 10, opacity: 0.75 }}>{MON_SHORT[d.getMonth()]}</span>
                </button>
              ))}
            </div>

            {/* Time slots */}
            <div style={{ ...body, fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Available Times
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
              {TIME_SLOTS.map(s => (
                <button key={s.time} disabled={!s.available}
                  onClick={() => setSlotTime(s.time)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0',
                    borderRadius: 10, border: 'none', cursor: s.available ? 'pointer' : 'not-allowed',
                    transition: 'all .15s',
                    background: !s.available ? 'rgba(17,17,17,0.05)'
                      : slotTime === s.time ? C.accent : C.bg,
                    boxShadow: slotTime === s.time ? `0 4px 12px ${C.accent}40` : 'none' }}>
                  <span style={{ ...body, fontSize: 13, fontWeight: 700,
                    color: !s.available ? 'rgba(17,17,17,0.2)' : slotTime === s.time ? '#fff' : C.text }}>
                    {s.time}
                  </span>
                  {s.available && (
                    <span style={{ ...body, fontSize: 10,
                      color: slotTime === s.time ? 'rgba(255,255,255,0.75)' : C.green }}>
                      AED {s.price}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Booking bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
          background: C.card, borderTop: `1px solid ${C.border}`,
          padding: '14px 20px 28px',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ ...body, fontSize: 11, color: C.muted, marginBottom: 2 }}>Total price</div>
              <div>
                <span style={{ ...display, fontSize: 34, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
                  AED {slot?.price ?? v.pricePerHour}
                </span>
                <span style={{ ...body, fontSize: 12, color: C.muted }}>/hr</span>
              </div>
            </div>
            <button onClick={goBook} disabled={!slotTime}
              style={{ ...body, padding: '14px 28px', borderRadius: 14, border: 'none',
                fontSize: 15, fontWeight: 700, cursor: slotTime ? 'pointer' : 'not-allowed',
                background: slotTime ? C.accent : 'rgba(17,17,17,0.08)',
                color: slotTime ? '#fff' : 'rgba(17,17,17,0.25)',
                boxShadow: slotTime ? `0 6px 20px ${C.accent}45` : 'none',
                transition: 'all .2s' }}>
              Book Court
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Confirmed ────────────────────────────────────────────────────────────
  function ConfirmedScreen() {
    if (!venue || !slotTime) return null
    const date = DATES[dateIdx]
    const slotPrice = TIME_SLOTS.find(s => s.time === slotTime)?.price ?? venue.pricePerHour

    return (
      <div style={{ height: '100%', background: C.accent, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        {/* Big check */}
        <div style={{ width: 88, height: 88, borderRadius: 44, background: 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div style={{ ...body, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
          Booking Confirmed
        </div>
        <div style={{ ...display, fontWeight: 900, fontSize: 32, color: '#fff', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 4 }}>
          {venue.name}
        </div>
        <div style={{ ...body, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
          {venue.location}
        </div>

        {/* White card */}
        <div style={{ width: '100%', background: '#fff', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            {([
              ['Date',     `${DAY_FULL[date.getDay()]}, ${date.getDate()} ${MON_SHORT[date.getMonth()]}`],
              ['Time',     `${slotTime} – ${nextHour(slotTime)}`],
              ['Duration', '1 hour'],
              ['Paid',     `AED ${slotPrice}`],
            ] as [string,string][]).map(([label, val]) => (
              <div key={label} style={{ background: C.bg, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ ...body, fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
                <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ ...body, fontSize: 10, color: C.muted, marginBottom: 2 }}>Booking Ref</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: C.accent }}>
                #{bookingRef.current}
              </div>
            </div>
            <div style={{ fontSize: 36 }}>📲</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button onClick={() => { setScreen('home'); setSlotTime(null) }}
            style={{ ...body, width: '100%', background: '#fff', color: C.accent, border: 'none',
              borderRadius: 14, padding: '15px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Back to Home
          </button>
          <button style={{ ...body, width: '100%', background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 14, padding: '15px 0',
            fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Add to Calendar
          </button>
        </div>
      </div>
    )
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  function DashboardScreen() {
    const confirmedRevenue = OWNER_BOOKINGS
      .filter((_, i) => bStatuses[i] === 'confirmed')
      .reduce((s, b) => s + b.amount, 0)
    const pendingCount   = bStatuses.filter(s => s === 'pending').length
    const confirmedCount = bStatuses.filter(s => s === 'confirmed').length

    function accept(i: number)  { setBStatuses(p => p.map((s, j) => j === i ? 'confirmed' : s)) }
    function decline(i: number) { setBStatuses(p => p.map((s, j) => j === i ? 'declined'  : s)) }

    return (
      <div style={{ height: '100%', position: 'relative', background: C.bg }}>
        <div style={{ height: '100%', overflowY: 'auto' }} className="scrollbar-hide">
          {/* Header */}
          <div style={{ background: C.dark, padding: '44px 20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...body, fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>
                  Venue Dashboard
                </div>
                <div style={{ ...display, fontSize: 24, fontWeight: 900, color: '#fff',
                  textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1 }}>
                  Al-Noor<br />Sports Complex
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🏟️</div>
                {pendingCount > 0 && (
                  <div style={{ background: C.accent, borderRadius: 10, padding: '3px 9px',
                    ...body, fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {pendingCount} pending
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: "Today's Revenue",  value: `${confirmedRevenue}`, unit: 'AED', sub: '+12% vs last week', color: C.accent },
              { label: 'Total Bookings',   value: `${OWNER_BOOKINGS.length}`, unit: '',    sub: `${pendingCount} pending`, color: C.dark },
              { label: 'Confirmed',         value: `${confirmedCount}`,  unit: '',    sub: 'accepted today',  color: C.green },
              { label: 'Occupancy',         value: '78',                 unit: '%',   sub: '4 courts active', color: '#7C3AED' },
            ].map(stat => (
              <div key={stat.label}
                style={{ background: C.card, borderRadius: 16, padding: '16px', boxShadow: C.shadow }}>
                <div style={{ ...body, fontSize: 11, color: C.muted, marginBottom: 6 }}>{stat.label}</div>
                <div>
                  <span style={{ ...display, fontSize: 36, fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                    {stat.value}
                  </span>
                  <span style={{ ...body, fontSize: 13, color: stat.color, fontWeight: 600 }}>{stat.unit}</span>
                </div>
                <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 4 }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0' }}>
            {(['bookings', 'courts'] as const).map(tab => (
              <button key={tab} onClick={() => setOwnerTab(tab)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                  cursor: 'pointer', ...body, fontSize: 13, fontWeight: 700, transition: 'all .15s',
                  background: ownerTab === tab ? C.accent : C.card,
                  color: ownerTab === tab ? '#fff' : C.muted,
                  boxShadow: ownerTab === tab ? `0 4px 14px ${C.accent}40` : C.shadow }}>
                {tab === 'bookings' ? "Today's Bookings" : 'Manage Courts'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '14px 20px 96px' }}>
            {ownerTab === 'bookings' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {OWNER_BOOKINGS.map((b, i) => {
                  const status = bStatuses[i]
                  if (status === 'declined') return null
                  return (
                    <div key={b.id}
                      style={{ background: C.card, borderRadius: 16, overflow: 'hidden',
                        boxShadow: C.shadow, display: 'flex', flexDirection: 'column' }}>
                      {/* Left accent + content */}
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: 4, background: status === 'confirmed' ? C.green : C.amber, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: '14px 14px 14px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 17, background: C.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                ...display, fontSize: 15, fontWeight: 900, color: C.accent, flexShrink: 0 }}>
                                {b.avatar}
                              </div>
                              <div>
                                <div style={{ ...body, fontWeight: 700, fontSize: 14, color: C.text }}>
                                  {b.player}
                                </div>
                                <div style={{ ...body, fontSize: 11, color: C.muted }}>
                                  {b.court} · {b.sport}
                                </div>
                              </div>
                            </div>
                            <div style={{ background: status === 'confirmed' ? C.greenLight : 'rgba(245,166,35,0.1)',
                              border: `1px solid ${status === 'confirmed' ? C.greenBorder : 'rgba(245,166,35,0.25)'}`,
                              borderRadius: 8, padding: '4px 9px',
                              ...body, fontSize: 11, fontWeight: 600,
                              color: status === 'confirmed' ? C.green : C.amber }}>
                              {status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ ...body, fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                              🕐 {b.time}
                            </div>
                            <div style={{ ...display, fontSize: 20, fontWeight: 900, color: C.text }}>
                              AED {b.amount}
                            </div>
                          </div>
                        </div>
                      </div>
                      {status === 'pending' && (
                        <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                          <button onClick={() => accept(i)}
                            style={{ flex: 1, padding: '12px 0', background: C.greenLight, border: 'none',
                              borderRight: `1px solid ${C.border}`, cursor: 'pointer',
                              ...body, fontSize: 13, fontWeight: 700, color: C.green }}>
                            Accept
                          </button>
                          <button onClick={() => decline(i)}
                            style={{ flex: 1, padding: '12px 0', background: 'rgba(255,59,0,0.06)',
                              border: 'none', cursor: 'pointer',
                              ...body, fontSize: 13, fontWeight: 700, color: C.accent }}>
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {courts.map((c, i) => (
                  <div key={c.name}
                    style={{ background: C.card, borderRadius: 16, padding: '16px', boxShadow: C.shadow,
                      display: 'flex', alignItems: 'center', gap: 12,
                      borderLeft: `4px solid ${c.active ? C.green : 'rgba(17,17,17,0.1)'}` }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {c.sport === 'Football' ? '⚽' : '🎾'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...body, fontWeight: 700, fontSize: 15, color: C.text }}>{c.name}</div>
                      <div style={{ ...body, fontSize: 12, color: C.muted }}>{c.sport} · {c.size}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3,
                          background: c.active ? C.green : 'rgba(17,17,17,0.2)' }} />
                        <span style={{ ...body, fontSize: 11, fontWeight: 600,
                          color: c.active ? C.green : C.muted }}>
                          {c.active ? 'Active & bookable' : 'Closed'}
                        </span>
                      </div>
                    </div>
                    <Toggle on={c.active} onChange={() =>
                      setCourts(p => p.map((ct, j) => j === i ? { ...ct, active: !ct.active } : ct))} />
                  </div>
                ))}
                <button style={{ width: '100%', padding: '16px 0', background: 'none',
                  border: `2px dashed ${C.faint}`, borderRadius: 16, cursor: 'pointer',
                  ...body, fontSize: 14, fontWeight: 600, color: C.muted }}>
                  + Add New Court
                </button>
              </div>
            )}
          </div>
        </div>
        <BottomNav current={screen} onGo={setScreen} isOwner={true} />
      </div>
    )
  }

  // ─── Frame ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#1A1410', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", padding: '24px 0' }}>

      {/* Subtle background grain */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundSize: '150px' }} />

      {/* Phone frame */}
      <div style={{
        position: 'relative', width: 390, height: 844,
        borderRadius: 52, overflow: 'hidden',
        background: '#111',
        boxShadow: `
          0 0 0 2px #2A2520,
          0 0 0 8px #111,
          0 60px 120px rgba(0,0,0,0.85),
          0 0 80px rgba(255,59,0,0.08)
        `,
      }}>
        {/* Notch */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 126, height: 36, background: '#0A0A0A', borderRadius: '0 0 24px 24px', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#1A1A1A' }} />
          <div style={{ width: 48, height: 5, borderRadius: 3, background: '#1A1A1A' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#1A1A1A' }} />
        </div>

        {/* Screen content */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {screen === 'splash'    && <SplashScreen />}
          {screen === 'home'      && <HomeScreen />}
          {screen === 'venue'     && <VenueScreen />}
          {screen === 'confirmed' && <ConfirmedScreen />}
          {screen === 'dashboard' && <DashboardScreen />}
        </div>
      </div>

      {/* Role switcher */}
      {role !== null && (
        <button onClick={() => { setRole(null); setScreen('splash') }}
          style={{ marginTop: 20, padding: '8px 18px', borderRadius: 20, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', ...body }}>
          ← Switch role
        </button>
      )}
    </div>
  )
}
