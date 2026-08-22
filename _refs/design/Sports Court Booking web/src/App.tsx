import { useState, useRef, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
type Role    = 'player' | 'owner'
type Screen  = 'home' | 'venue' | 'confirmed' | 'dashboard'
type Sport   = 'All' | 'Football' | 'Padel' | 'Basketball' | 'Tennis' | 'Cricket' | 'Volleyball'

interface Venue {
  id: string; name: string; location: string
  sports: Exclude<Sport, 'All'>[]
  rating: number; reviews: number; pricePerHour: number
  imageId: string; distance: string; featured: boolean
  description: string
}

// ─── Data ────────────────────────────────────────────────────────────────────
const VENUES: Venue[] = [
  {
    id: '1', name: 'Al-Noor Sports Complex', location: 'Al Wasl, Dubai',
    sports: ['Football', 'Padel'], rating: 4.8, reviews: 312, pricePerHour: 120,
    imageId: 'photo-1575361204480-aadea25e6e68', distance: '1.2 km', featured: true,
    description: 'Premium 5-a-side and padel facility with floodlit courts available until midnight. Freshly laid artificial turf, changing rooms, and an on-site café.',
  },
  {
    id: '2', name: 'Emirates Arena', location: 'Al Qusais, Dubai',
    sports: ['Basketball', 'Tennis'], rating: 4.6, reviews: 189, pricePerHour: 90,
    imageId: 'photo-1546519638-68e109498ffc', distance: '3.4 km', featured: true,
    description: 'Indoor hardwood basketball court and four clay tennis courts in an air-conditioned facility. Ideal for club sessions and casual games alike.',
  },
  {
    id: '3', name: 'Jumeirah Courts', location: 'Jumeirah 1, Dubai',
    sports: ['Tennis', 'Padel'], rating: 4.9, reviews: 445, pricePerHour: 150,
    imageId: 'photo-1554068865-24ceec13d068', distance: '5.1 km', featured: false,
    description: 'Dubai\'s highest-rated racket sports destination. Six padel courts and eight tennis courts, all with real-time availability and on-site coaching.',
  },
  {
    id: '4', name: 'Al-Safa Sports Hub', location: 'Al Safa, Dubai',
    sports: ['Football', 'Basketball', 'Volleyball'], rating: 4.5, reviews: 227, pricePerHour: 80,
    imageId: 'photo-1565299624946-b28f40a0ae38', distance: '2.7 km', featured: false,
    description: 'Multi-sport complex with three football pitches, two basketball courts, and a beach volleyball setup. Family-friendly with ample parking.',
  },
  {
    id: '5', name: 'Desert Padel Club', location: 'Business Bay, Dubai',
    sports: ['Padel'], rating: 4.7, reviews: 156, pricePerHour: 130,
    imageId: 'photo-1532444651960-4c9e8e5f7a37', distance: '4.0 km', featured: true,
    description: 'The UAE\'s most photographed padel venue — glass-backed courts under panoramic city views. Equipment rental and coaching packages available.',
  },
  {
    id: '6', name: 'Crescent Cricket Ground', location: 'Dubai Sports City',
    sports: ['Cricket'], rating: 4.4, reviews: 98, pricePerHour: 200,
    imageId: 'photo-1624526267942-ab0ff8a3e972', distance: '8.2 km', featured: false,
    description: 'Full-length turf and net facilities at Dubai Sports City. The only venue in the emirate with an ICC-compliant pitch available for private hire.',
  },
]

const TIME_SLOTS = [
  { time: '07:00', available: false, price: 80 },
  { time: '08:00', available: true,  price: 80 },
  { time: '09:00', available: true,  price: 100 },
  { time: '10:00', available: false, price: 100 },
  { time: '11:00', available: true,  price: 100 },
  { time: '14:00', available: true,  price: 90 },
  { time: '15:00', available: false, price: 90 },
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

const OWNER_BOOKINGS = [
  { id: 'B001', player: 'Ahmed Al-Rashid',  avatar: 'A', sport: 'Football', court: 'Court A',  time: '18:00–19:00', status: 'confirmed', amount: 120, date: 'Today' },
  { id: 'B002', player: 'Sara Mohammed',    avatar: 'S', sport: 'Padel',    court: 'Padel 1',  time: '19:00–20:00', status: 'confirmed', amount: 130, date: 'Today' },
  { id: 'B003', player: 'Khalid Hassan',    avatar: 'K', sport: 'Football', court: 'Court B',  time: '20:00–21:00', status: 'pending',   amount: 120, date: 'Today' },
  { id: 'B004', player: 'Fatima Al-Zaabi', avatar: 'F', sport: 'Padel',    court: 'Padel 2',  time: '20:00–21:00', status: 'confirmed', amount: 130, date: 'Today' },
  { id: 'B005', player: 'Omar Yusuf',       avatar: 'O', sport: 'Football', court: 'Court A',  time: '21:00–22:00', status: 'pending',   amount: 120, date: 'Today' },
  { id: 'B006', player: 'Layla Mahmoud',    avatar: 'L', sport: 'Padel',    court: 'Padel 1',  time: '09:00–10:00', status: 'confirmed', amount: 100, date: 'Tomorrow' },
  { id: 'B007', player: 'Nasser Al-Falasi', avatar: 'N', sport: 'Football', court: 'Court A',  time: '10:00–11:00', status: 'confirmed', amount: 100, date: 'Tomorrow' },
]

const INIT_COURTS = [
  { name: 'Court A',  sport: 'Football', size: '5-a-side', active: true  },
  { name: 'Court B',  sport: 'Football', size: '5-a-side', active: true  },
  { name: 'Padel 1',  sport: 'Padel',    size: 'Standard', active: true  },
  { name: 'Padel 2',  sport: 'Padel',    size: 'Standard', active: false },
]

function makeDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 6, 22)
    d.setDate(d.getDate() + i)
    return d
  })
}
const DATES    = makeDates(7)
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function nextHour(t: string) {
  const h = parseInt(t.split(':')[0]) + 1
  return h.toString().padStart(2, '0') + ':00'
}

// ─── Shared primitives ────────────────────────────────────────────────────────
const G = {
  bg:        '#07090F',
  surface:   '#0E1218',
  surfaceAlt:'#131820',
  border:    'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  text:      '#F1F5F9',
  muted:     'rgba(255,255,255,0.38)',
  faint:     'rgba(255,255,255,0.14)',
  green:     '#10B981',
  greenDim:  'rgba(16,185,129,0.12)',
  greenBorder:'rgba(16,185,129,0.25)',
  greenText: '#34D399',
}

function Badge({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'amber' | 'red' | 'blue' }) {
  const styles: Record<string, { bg: string; border: string; text: string }> = {
    green: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#34D399' },
    amber: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  text: '#FCD34D' },
    red:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.22)',   text: '#F87171' },
    blue:  { bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.22)',  text: '#60A5FA' },
  }
  const s = styles[color]
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {children}
    </span>
  )
}

// ─── Topnav ───────────────────────────────────────────────────────────────────
function Topnav({
  role, screen, onRoleSwitch, onGo, searchQuery, onSearch,
}: {
  role: Role; screen: Screen
  onRoleSwitch: () => void
  onGo: (s: Screen) => void
  searchQuery: string
  onSearch: (q: string) => void
}) {
  return (
    <nav className="sticky top-0 z-40 flex items-center gap-4 px-6 py-0"
      style={{
        background: 'rgba(7,9,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${G.border}`,
        height: 64,
      }}>
      {/* Logo */}
      <button onClick={() => onGo(role === 'owner' ? 'dashboard' : 'home')}
        className="flex items-center gap-2.5 flex-shrink-0 mr-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ background: G.green, color: '#fff' }}>M</div>
        <div className="hidden sm:block">
          <span className="font-black tracking-tight" style={{ color: G.text, fontSize: 16 }}>Al-Mustadaira</span>
          <span className="ml-2 text-xs" style={{ color: G.muted }}>المستديرة</span>
        </div>
      </button>

      {/* Search — player only */}
      {role === 'player' && (
        <div className="flex-1 max-w-md flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: G.surface, border: `1px solid ${G.border}` }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: G.muted }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search venues, sports, locations…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: G.text }}
          />
        </div>
      )}

      {role === 'owner' && (
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: G.muted }}>
            Al-Noor Sports Complex · Al Wasl, Dubai
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Role toggle */}
        <div className="flex items-center rounded-xl p-1"
          style={{ background: G.surface, border: `1px solid ${G.border}` }}>
          {(['player', 'owner'] as Role[]).map(r => (
            <button key={r} onClick={() => { if (role !== r) onRoleSwitch() }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
              style={role === r
                ? { background: G.green, color: '#fff' }
                : { color: G.muted }}>
              {r === 'player' ? 'Player' : 'Owner'}
            </button>
          ))}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: G.greenDim, border: `1px solid ${G.greenBorder}`, color: G.greenText }}>
          {role === 'player' ? 'A' : 'M'}
        </div>
      </div>
    </nav>
  )
}

// ─── Owner sidebar ────────────────────────────────────────────────────────────
function OwnerSidebar({ activeTab, onTab }: { activeTab: string; onTab: (t: string) => void }) {
  const items = [
    { id: 'overview',  icon: '📊', label: 'Overview'   },
    { id: 'bookings',  icon: '📅', label: 'Bookings'   },
    { id: 'courts',    icon: '🏟️', label: 'My Courts'  },
    { id: 'analytics', icon: '📈', label: 'Analytics'  },
    { id: 'settings',  icon: '⚙️', label: 'Settings'   },
  ]
  return (
    <aside className="w-56 flex-shrink-0 hidden md:flex flex-col py-6 px-3"
      style={{ borderRight: `1px solid ${G.border}`, minHeight: 'calc(100vh - 64px)' }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onTab(item.id)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-0.5 text-left transition-all"
          style={activeTab === item.id
            ? { background: G.greenDim, color: G.greenText, border: `1px solid ${G.greenBorder}` }
            : { color: G.muted, border: '1px solid transparent' }}>
          <span className="text-base">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole]       = useState<Role>('player')
  const [screen, setScreen]   = useState<Screen>('home')
  const [sport, setSport]     = useState<Sport>('All')
  const [venue, setVenue]     = useState<Venue | null>(null)
  const [dateIdx, setDateIdx] = useState(0)
  const [slotTime, setSlotTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [ownerTab, setOwnerTab]  = useState('overview')
  const [courts, setCourts]      = useState(INIT_COURTS.map(c => ({ ...c })))
  const [bookingStatuses, setBookingStatuses] = useState(OWNER_BOOKINGS.map(b => b.status))
  const bookingRef = useRef(`ALM-${Math.floor(Math.random() * 90000 + 10000)}`)

  function switchRole() {
    const next = role === 'player' ? 'owner' : 'player'
    setRole(next)
    setScreen(next === 'owner' ? 'dashboard' : 'home')
  }

  function goVenue(v: Venue) {
    setVenue(v); setSlotTime(null); setScreen('venue')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBook() {
    if (!slotTime) return
    bookingRef.current = `ALM-${Math.floor(Math.random() * 90000 + 10000)}`
    setScreen('confirmed')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredVenues = VENUES.filter(v => {
    const matchSport  = sport === 'All' || v.sports.includes(sport as any)
    const matchSearch = !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
      || v.location.toLowerCase().includes(searchQuery.toLowerCase())
      || v.sports.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchSport && matchSearch
  })

  // ── Home ──────────────────────────────────────────────────────────────────
  function HomeScreen() {
    return (
      <div style={{ background: G.bg, minHeight: 'calc(100vh - 64px)' }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ height: '62vh', minHeight: 400 }}>
          <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=1600&h=900&fit=crop&auto=format"
            alt="Floodlit football pitch at night" className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(7,9,15,0.85) 0%, rgba(7,9,15,0.4) 50%, rgba(7,9,15,0.7) 100%)' }} />

          <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 lg:px-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
                style={{ background: G.greenDim, border: `1px solid ${G.greenBorder}` }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: G.green }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: G.greenText }}>
                  Dubai · 47 courts available now
                </span>
              </div>
              <h1 className="font-black leading-none mb-4"
                style={{ color: G.text, fontSize: 'clamp(36px, 5vw, 68px)', letterSpacing: '-0.02em' }}>
                Book Your Court,<br />Own the Game.
              </h1>
              <p className="text-base mb-8 max-w-lg" style={{ color: 'rgba(255,255,255,0.58)', lineHeight: 1.65 }}>
                Football, padel, basketball, tennis and more — find and book the perfect court near you in seconds. No calls, no waiting.
              </p>

              {/* Hero search */}
              <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${G.borderMid}`, backdropFilter: 'blur(10px)' }}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    style={{ color: G.green }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search sport, venue or area…"
                    className="flex-1 bg-transparent text-base outline-none"
                    style={{ color: G.text }}
                  />
                </div>
                <button className="px-6 py-3.5 rounded-2xl font-bold text-base text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: G.green, flexShrink: 0 }}>
                  Find Courts
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sport pills */}
        <div className="px-6 md:px-10 lg:px-16 py-6" style={{ borderBottom: `1px solid ${G.border}` }}>
          <div className="flex items-center gap-2 flex-wrap">
            {SPORTS.map(s => (
              <button key={s} onClick={() => setSport(s)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={sport === s
                  ? { background: G.green, color: '#fff' }
                  : { background: G.surface, border: `1px solid ${G.border}`, color: G.muted }}>
                <span>{SPORT_ICON[s]}</span>
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Venue grid */}
        <div className="px-6 md:px-10 lg:px-16 py-10">
          {/* Featured */}
          {!searchQuery && sport === 'All' && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-xl" style={{ color: G.text }}>Featured Venues</h2>
                <span className="text-sm" style={{ color: G.muted }}>Top picks in Dubai</span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {VENUES.filter(v => v.featured).map(v => <VenueCard key={v.id} venue={v} large />)}
              </div>
            </div>
          )}

          {/* All / filtered */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-xl" style={{ color: G.text }}>
              {searchQuery ? `Results for "${searchQuery}"` : sport === 'All' ? 'All Venues' : `${sport} Courts`}
            </h2>
            <span className="text-sm" style={{ color: G.muted }}>
              {filteredVenues.length} venue{filteredVenues.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredVenues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="text-5xl mb-4">{SPORT_ICON[sport]}</span>
              <p className="text-lg font-semibold mb-2" style={{ color: G.text }}>No venues found</p>
              <p className="text-sm" style={{ color: G.muted }}>Try a different sport or search term</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {filteredVenues.map(v => <VenueCard key={v.id} venue={v} />)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Venue card ────────────────────────────────────────────────────────────
  function VenueCard({ venue: v, large = false }: { venue: Venue; large?: boolean }) {
    const [hovered, setHovered] = useState(false)
    return (
      <button
        onClick={() => goVenue(v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="text-left rounded-2xl overflow-hidden transition-all"
        style={{
          background: G.surface,
          border: `1px solid ${hovered ? G.greenBorder : G.border}`,
          transform: hovered ? 'translateY(-2px)' : 'none',
          boxShadow: hovered ? `0 16px 40px rgba(0,0,0,0.4)` : 'none',
        }}>
        <div className="relative" style={{ height: large ? 220 : 180 }}>
          <img src={`https://images.unsplash.com/${v.imageId}?w=600&h=400&fit=crop&auto=format`}
            alt={v.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid rgba(255,255,255,0.12)` }}>
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-white text-xs font-bold">{v.rating}</span>
          </div>
          {v.featured && (
            <div className="absolute top-3 left-3 rounded-full px-2.5 py-1"
              style={{ background: G.green }}>
              <span className="text-white text-xs font-bold">Featured</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
            {v.sports.map(s => (
              <span key={s} className="text-xs rounded-full px-2 py-0.5 font-medium"
                style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.85)' }}>{s}</span>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="font-bold text-base leading-tight mb-0.5" style={{ color: G.text }}>{v.name}</p>
          <p className="text-sm flex items-center gap-1" style={{ color: G.muted }}>
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
            {v.location} · {v.distance}
          </p>
          {large && <p className="text-sm mt-2 line-clamp-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{v.description}</p>}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${G.border}` }}>
            <span className="font-black text-lg" style={{ color: G.green }}>
              AED {v.pricePerHour}<span className="text-xs font-normal" style={{ color: G.muted }}>/hr</span>
            </span>
            <div className="flex items-center gap-1" style={{ color: G.muted }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
              <span className="text-xs">{v.reviews} reviews</span>
            </div>
          </div>
        </div>
      </button>
    )
  }

  // ── Venue detail ─────────────────────────────────────────────────────────
  function VenueScreen() {
    if (!venue) return null
    const v = venue
    const slot = TIME_SLOTS.find(s => s.time === slotTime)

    return (
      <div style={{ background: G.bg, minHeight: 'calc(100vh - 64px)' }}>
        {/* Back */}
        <div className="px-6 md:px-10 lg:px-16 pt-6 pb-4">
          <button onClick={() => setScreen('home')}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: G.muted }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to venues
          </button>
        </div>

        {/* Hero image */}
        <div className="relative overflow-hidden" style={{ height: '45vh', minHeight: 280 }}>
          <img src={`https://images.unsplash.com/${v.imageId}?w=1400&h=700&fit=crop&auto=format`}
            alt={v.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(7,9,15,0.7) 0%, transparent 60%), linear-gradient(to top, rgba(7,9,15,0.9) 0%, transparent 60%)' }} />
          <div className="absolute bottom-8 left-8 md:left-16">
            <div className="flex gap-2 mb-3 flex-wrap">
              {v.sports.map(s => (
                <span key={s} className="flex items-center gap-1.5 text-sm font-semibold rounded-full px-3 py-1"
                  style={{ background: G.greenDim, border: `1px solid ${G.greenBorder}`, color: G.greenText }}>
                  {SPORT_ICON[s]} {s}
                </span>
              ))}
            </div>
            <h1 className="font-black leading-none mb-2"
              style={{ color: G.text, fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: '-0.02em' }}>
              {v.name}
            </h1>
            <p className="flex items-center gap-1.5 text-base" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              {v.location} · {v.distance} away
            </p>
          </div>
        </div>

        {/* Two-column body */}
        <div className="px-6 md:px-10 lg:px-16 py-10 flex flex-col lg:flex-row gap-10">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            {/* Stats */}
            <div className="flex items-center gap-6 mb-8 pb-8" style={{ borderBottom: `1px solid ${G.border}` }}>
              <div>
                <p className="text-2xl font-black" style={{ color: G.text }}>{v.rating}</p>
                <div className="flex gap-0.5 my-1">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="text-yellow-400 text-sm">{i <= Math.round(v.rating) ? '★' : '☆'}</span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: G.muted }}>{v.reviews} reviews</p>
              </div>
              <div style={{ width: 1, height: 48, background: G.border }} />
              <div>
                <p className="text-2xl font-black" style={{ color: G.green }}>AED {v.pricePerHour}</p>
                <p className="text-xs mt-1" style={{ color: G.muted }}>per hour</p>
              </div>
              <div style={{ width: 1, height: 48, background: G.border }} />
              <div>
                <p className="text-2xl font-black" style={{ color: G.text }}>{v.sports.length}</p>
                <p className="text-xs mt-1" style={{ color: G.muted }}>sports available</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="font-bold text-lg mb-3" style={{ color: G.text }}>About this venue</h2>
              <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
                {v.description}
              </p>
            </div>

            {/* Amenities */}
            <div className="mb-8">
              <h2 className="font-bold text-lg mb-4" style={{ color: G.text }}>Facilities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['🅿️','Free Parking'],['🚿','Changing Rooms'],['💡','Floodlighting'],['🏪','On-site Café'],['🎽','Kit Rental'],['🏆','Coaching'],['📹','Video Analysis'],['❄️','Air Conditioning']].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: G.surface, border: `1px solid ${G.border}` }}>
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-bold text-lg mb-4" style={{ color: G.text }}>Recent Reviews</h2>
              <div className="flex flex-col gap-3">
                {[
                  { name: 'Ahmed Al-Rashid', rating: 5, text: 'Best facilities in Dubai. Pitch quality is exceptional and the staff are always helpful.', date: '2 days ago' },
                  { name: 'Sara Mohammed',   rating: 5, text: "Booked padel for the first time here — smooth process and courts were spotless.", date: '1 week ago' },
                  { name: 'Khalid Hassan',   rating: 4, text: 'Great venue overall. The café could use more healthy options but otherwise perfect.', date: '2 weeks ago' },
                ].map(r => (
                  <div key={r.name} className="rounded-xl p-4" style={{ background: G.surface, border: `1px solid ${G.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: G.greenDim, color: G.greenText }}>{r.name[0]}</div>
                        <span className="font-semibold text-sm" style={{ color: G.text }}>{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 text-sm">{'★'.repeat(r.rating)}</span>
                        <span className="text-xs" style={{ color: G.muted }}>{r.date}</span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: booking panel */}
          <div className="lg:w-96 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl p-6"
              style={{ background: G.surface, border: `1px solid ${G.border}` }}>
              <h3 className="font-bold text-lg mb-5" style={{ color: G.text }}>Reserve a Court</h3>

              {/* Date row */}
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G.muted }}>Date</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
                {DATES.map((d, i) => (
                  <button key={i} onClick={() => setDateIdx(i)}
                    className="flex-shrink-0 flex flex-col items-center w-12 py-2.5 rounded-xl transition-all"
                    style={dateIdx === i
                      ? { background: G.green, color: '#fff' }
                      : { background: G.surfaceAlt, border: `1px solid ${G.border}`, color: G.muted }}>
                    <span className="text-xs font-medium">{DAY_SHORT[d.getDay()]}</span>
                    <span className="font-black text-lg leading-tight">{d.getDate()}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{MON_SHORT[d.getMonth()]}</span>
                  </button>
                ))}
              </div>

              {/* Time slots */}
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G.muted }}>Time</p>
              <div className="grid grid-cols-4 gap-1.5 mb-5">
                {TIME_SLOTS.map(s => (
                  <button key={s.time} disabled={!s.available}
                    onClick={() => setSlotTime(s.time)}
                    className="flex flex-col items-center py-2 rounded-lg transition-all"
                    style={
                      !s.available
                        ? { background: G.surfaceAlt, color: 'rgba(255,255,255,0.15)', cursor: 'not-allowed' }
                        : slotTime === s.time
                        ? { background: G.green, color: '#fff' }
                        : { background: G.surfaceAlt, border: `1px solid ${G.border}`, color: 'rgba(255,255,255,0.65)' }
                    }>
                    <span className="text-xs font-bold">{s.time}</span>
                    {s.available && (
                      <span style={{ fontSize: 9, color: slotTime === s.time ? 'rgba(255,255,255,0.7)' : G.greenText }}>
                        {s.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Price + CTA */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs" style={{ color: G.muted }}>Total</p>
                  <p className="font-black text-2xl" style={{ color: G.text }}>
                    AED {slot?.price ?? v.pricePerHour}
                    <span className="text-sm font-normal" style={{ color: G.muted }}> / hr</span>
                  </p>
                </div>
                {slotTime && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: G.muted }}>Selected</p>
                    <p className="text-sm font-bold" style={{ color: G.greenText }}>{slotTime} – {nextHour(slotTime)}</p>
                  </div>
                )}
              </div>
              <button onClick={goBook} disabled={!slotTime}
                className="w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95"
                style={slotTime
                  ? { background: G.green, color: '#fff' }
                  : { background: G.surfaceAlt, color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>
                {slotTime ? 'Confirm Booking' : 'Select a time slot'}
              </button>
              <p className="text-center text-xs mt-3" style={{ color: G.muted }}>Free cancellation up to 24 hours before</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────
  function ConfirmedScreen() {
    if (!venue || !slotTime) return null
    const date     = DATES[dateIdx]
    const slotPrice = TIME_SLOTS.find(s => s.time === slotTime)?.price ?? venue.pricePerHour

    return (
      <div className="flex items-center justify-center px-6 py-16"
        style={{ background: G.bg, minHeight: 'calc(100vh - 64px)' }}>
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: G.greenDim, border: `2px solid ${G.greenBorder}` }}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                style={{ color: G.green }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: G.green }}>Booking Confirmed</span>
            <h2 className="font-black text-3xl mt-2 mb-1" style={{ color: G.text }}>{venue.name}</h2>
            <p className="text-sm" style={{ color: G.muted }}>{venue.location}</p>
          </div>

          <div className="rounded-2xl p-6 mb-6" style={{ background: G.surface, border: `1px solid ${G.border}` }}>
            <div className="grid grid-cols-2 gap-5">
              {([
                ['Date',     `${DAY_FULL[date.getDay()]}, ${date.getDate()} ${MON_SHORT[date.getMonth()]}`],
                ['Time',     `${slotTime} – ${nextHour(slotTime)}`],
                ['Duration', '1 hour'],
                ['Amount',   `AED ${slotPrice}`],
              ] as [string,string][]).map(([label, val]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: G.surfaceAlt }}>
                  <p className="text-xs mb-1" style={{ color: G.muted }}>{label}</p>
                  <p className="font-bold text-sm" style={{ color: G.text }}>{val}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-5 pt-5"
              style={{ borderTop: `1px solid ${G.border}` }}>
              <div>
                <p className="text-xs mb-0.5" style={{ color: G.muted }}>Booking Reference</p>
                <p className="font-mono font-bold text-base" style={{ color: G.greenText }}>#{bookingRef.current}</p>
              </div>
              <div className="text-4xl">📲</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setScreen('home'); setSlotTime(null) }}
              className="flex-1 py-4 rounded-xl font-bold text-base text-white"
              style={{ background: G.green }}>
              Back to Home
            </button>
            <button className="flex-1 py-4 rounded-xl font-semibold"
              style={{ background: G.surface, border: `1px solid ${G.border}`, color: G.muted }}>
              Add to Calendar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Owner Dashboard ───────────────────────────────────────────────────────
  function DashboardScreen() {
    const confirmedRevenue = OWNER_BOOKINGS
      .filter((_, i) => bookingStatuses[i] === 'confirmed')
      .reduce((sum, b) => sum + b.amount, 0)
    const pendingCount   = bookingStatuses.filter(s => s === 'pending').length
    const confirmedCount = bookingStatuses.filter(s => s === 'confirmed').length

    function accept(i: number) { setBookingStatuses(p => p.map((s, j) => j === i ? 'confirmed' : s)) }
    function decline(i: number){ setBookingStatuses(p => p.map((s, j) => j === i ? 'declined'  : s)) }

    return (
      <div className="flex" style={{ background: G.bg, minHeight: 'calc(100vh - 64px)' }}>
        <OwnerSidebar activeTab={ownerTab} onTab={setOwnerTab} />

        <main className="flex-1 min-w-0 px-6 md:px-10 py-8">
          {/* Overview */}
          {ownerTab === 'overview' && (
            <>
              <div className="mb-8">
                <h1 className="font-black text-2xl mb-1" style={{ color: G.text }}>Dashboard Overview</h1>
                <p className="text-sm" style={{ color: G.muted }}>Tuesday, 22 July 2026 · Al-Noor Sports Complex</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Today's Revenue",  value: `AED ${confirmedRevenue}`, sub: '+12% vs last week', col: G.greenText },
                  { label: 'Total Bookings',   value: OWNER_BOOKINGS.length, sub: `${pendingCount} pending`,   col: '#60A5FA' },
                  { label: 'Confirmed',         value: confirmedCount,            sub: 'accepted today',         col: G.greenText },
                  { label: 'Occupancy Rate',   value: '78%',                      sub: '4 of 4 courts active',   col: '#FCD34D' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl p-5"
                    style={{ background: G.surface, border: `1px solid ${G.border}` }}>
                    <p className="text-xs font-medium mb-2" style={{ color: G.muted }}>{stat.label}</p>
                    <p className="font-black text-3xl mb-1" style={{ color: stat.col }}>{stat.value}</p>
                    <p className="text-xs" style={{ color: G.faint }}>{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* Hourly bar chart (css-drawn) */}
              <div className="rounded-2xl p-6 mb-8" style={{ background: G.surface, border: `1px solid ${G.border}` }}>
                <h2 className="font-bold text-base mb-5" style={{ color: G.text }}>Today's Bookings by Hour</h2>
                <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                  {[0,0,0,0,0,0,0,1,2,1,0,1,0,0,1,1,0,2,2,2,2,2,1,0].map((val, h) => {
                    const pct = val === 0 ? 8 : val === 1 ? 45 : 85
                    const booked = val > 0
                    return (
                      <div key={h} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-sm transition-all"
                          style={{
                            height: `${pct}%`,
                            background: booked ? G.green : 'rgba(255,255,255,0.06)',
                            opacity: booked ? 0.85 : 1,
                          }} />
                        {h % 3 === 0 && (
                          <span style={{ fontSize: 9, color: G.faint, flexShrink: 0 }}>{h}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Upcoming today */}
              <div>
                <h2 className="font-bold text-base mb-4" style={{ color: G.text }}>Upcoming Today</h2>
                <div className="flex flex-col gap-2">
                  {OWNER_BOOKINGS.filter((_, i) => bookingStatuses[i] !== 'declined').slice(0, 4).map((b, i) => {
                    const status = bookingStatuses[i]
                    return (
                      <div key={b.id} className="flex items-center gap-4 rounded-xl px-4 py-3"
                        style={{ background: G.surfaceAlt, border: `1px solid ${G.border}` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background: G.greenDim, color: G.greenText }}>{b.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: G.text }}>{b.player}</p>
                          <p className="text-xs" style={{ color: G.muted }}>{b.court} · {b.time}</p>
                        </div>
                        <Badge color={status === 'confirmed' ? 'green' : 'amber'}>
                          {status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                        </Badge>
                        <span className="font-bold text-sm flex-shrink-0" style={{ color: G.text }}>AED {b.amount}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Bookings tab */}
          {ownerTab === 'bookings' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-black text-2xl mb-1" style={{ color: G.text }}>Bookings</h1>
                  <p className="text-sm" style={{ color: G.muted }}>{OWNER_BOOKINGS.length} total · {pendingCount} awaiting action</p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${G.border}` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: G.surface }}>
                      {['Ref','Player','Court','Sport','Date','Time','Status','Amount','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                          style={{ color: G.muted, borderBottom: `1px solid ${G.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {OWNER_BOOKINGS.map((b, i) => {
                      const status = bookingStatuses[i]
                      if (status === 'declined') return null
                      return (
                        <tr key={b.id} style={{ borderBottom: `1px solid ${G.border}`, background: i % 2 === 0 ? G.bg : G.surfaceAlt }}>
                          <td className="px-4 py-3"><span className="font-mono text-xs" style={{ color: G.greenText }}>#{b.id}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ background: G.greenDim, color: G.greenText }}>{b.avatar}</div>
                              <span className="text-sm font-medium whitespace-nowrap" style={{ color: G.text }}>{b.player}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: G.muted }}>{b.court}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{SPORT_ICON[b.sport]} {b.sport}</span>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: G.muted }}>{b.date}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: G.muted }}>{b.time}</td>
                          <td className="px-4 py-3">
                            <Badge color={status === 'confirmed' ? 'green' : 'amber'}>
                              {status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-bold text-sm" style={{ color: G.text }}>AED {b.amount}</td>
                          <td className="px-4 py-3">
                            {status === 'pending' ? (
                              <div className="flex gap-1.5">
                                <button onClick={() => accept(i)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                  style={{ background: G.greenDim, color: G.greenText, border: `1px solid ${G.greenBorder}` }}>
                                  Accept
                                </button>
                                <button onClick={() => decline(i)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: G.faint }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Courts tab */}
          {ownerTab === 'courts' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-black text-2xl mb-1" style={{ color: G.text }}>My Courts</h1>
                  <p className="text-sm" style={{ color: G.muted }}>Manage availability and status</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: G.green }}>+ Add Court</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                {courts.map((c, i) => (
                  <div key={c.name} className="rounded-2xl p-5 flex items-center gap-4"
                    style={{ background: G.surface, border: `1px solid ${c.active ? G.greenBorder : G.border}` }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ background: G.surfaceAlt }}>
                      {c.sport === 'Football' ? '⚽' : '🎾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base" style={{ color: G.text }}>{c.name}</p>
                      <p className="text-sm" style={{ color: G.muted }}>{c.sport} · {c.size}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-2 h-2 rounded-full"
                          style={{ background: c.active ? G.green : '#F87171' }} />
                        <span className="text-xs font-semibold"
                          style={{ color: c.active ? G.greenText : '#F87171' }}>
                          {c.active ? 'Active & bookable' : 'Closed'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <button
                        onClick={() => setCourts(prev => prev.map((ct, j) => j === i ? { ...ct, active: !ct.active } : ct))}
                        className="relative w-12 h-6 rounded-full transition-colors"
                        style={{ background: c.active ? G.green : 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                          style={{ transform: c.active ? 'translateX(24px)' : 'translateX(2px)' }} />
                      </button>
                      <Badge color={c.active ? 'green' : 'red'}>{c.active ? 'Open' : 'Closed'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Analytics placeholder */}
          {ownerTab === 'analytics' && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="text-5xl mb-4">📈</span>
              <h2 className="font-black text-2xl mb-2" style={{ color: G.text }}>Analytics</h2>
              <p className="text-sm max-w-xs" style={{ color: G.muted }}>
                Detailed revenue trends, occupancy heatmaps and player retention reports coming soon.
              </p>
            </div>
          )}

          {/* Settings placeholder */}
          {ownerTab === 'settings' && (
            <div className="max-w-lg">
              <h1 className="font-black text-2xl mb-6" style={{ color: G.text }}>Settings</h1>
              {[
                { label: 'Venue Name',    value: 'Al-Noor Sports Complex' },
                { label: 'Contact Email', value: 'bookings@alnoor-sports.ae' },
                { label: 'Phone',         value: '+971 4 234 5678' },
                { label: 'Location',      value: 'Al Wasl, Dubai, UAE' },
              ].map(field => (
                <div key={field.label} className="mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: G.muted }}>{field.label}</label>
                  <input defaultValue={field.value}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: G.surface, border: `1px solid ${G.border}`, color: G.text }} />
                </div>
              ))}
              <button className="mt-2 px-6 py-3 rounded-xl font-bold text-white"
                style={{ background: G.green }}>Save Changes</button>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", background: G.bg, minHeight: '100vh' }}>
      <Topnav
        role={role} screen={screen}
        onRoleSwitch={switchRole}
        onGo={(s) => { setScreen(s) }}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
      />
      {role === 'player'  && screen === 'home'      && <HomeScreen />}
      {role === 'player'  && screen === 'venue'     && <VenueScreen />}
      {role === 'player'  && screen === 'confirmed' && <ConfirmedScreen />}
      {role === 'owner'   && <DashboardScreen />}
    </div>
  )
}
