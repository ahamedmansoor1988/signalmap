'use client'

import { useState } from 'react'
import { THEME_CONFIG, type Theme } from './mock-data'
import CompetitorDrawer from './competitor-drawer'
import { Search, Plus, Calendar, ChevronDown, Database } from 'lucide-react'
import Link from 'next/link'
import { getLogoUrl } from '@/lib/get-logo-url'
import type { TypedAction } from '@/lib/typed-actions'

export interface MapCompetitor {
  id: string
  name: string
  website: string
  risk_score: number
  theme: Theme
  last_signal: string
  signals_count: number
  description: string
  activity_count?: number
  ai_summary?: string
  suggested_actions?: TypedAction[]
}

interface Props {
  competitors: MapCompetitor[]
  isLiveData: boolean
}

// ── Canvas ─────────────────────────────────────────────────────
const W  = 1300
const H  = 820
const CX = W / 2
const CY = H / 2

// ── Sizes ──────────────────────────────────────────────────────
const THEME_R  = 240   // ring where theme cards sit
const COMP_D   = 125   // distance from theme centre to competitor logo
const NODE_R   = 22    // logo circle radius
const TW       = 126   // theme card width
const TH       = 48    // theme card height
const TRND     = 10    // theme card corner radius
const FAN      = Math.PI  // 180° semicircle — 5 logos get 45° spacing, very clean

function dot(count: number) {
  if (!count)   return '#d1d5db'
  if (count < 3) return '#f97316'
  return '#ef4444'
}

// ── Layout ─────────────────────────────────────────────────────
function layout(competitors: MapCompetitor[]) {
  const all    = Object.keys(THEME_CONFIG) as Theme[]
  const themes = all.filter(t => competitors.some(c => c.theme === t))
  const N      = themes.length

  const tPos = new Map<Theme, { x: number; y: number; angle: number }>()
  themes.forEach((theme, i) => {
    const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
    tPos.set(theme, { x: CX + THEME_R * Math.cos(angle), y: CY + THEME_R * Math.sin(angle), angle })
  })

  const cPos = new Map<string, { x: number; y: number }>()
  for (const theme of themes) {
    const tp    = tPos.get(theme)!
    const group = competitors.filter(c => c.theme === theme)
    const Nc    = group.length
    if (!Nc) continue

    const step = Nc > 1 ? FAN / (Nc - 1) : 0
    group.forEach((comp, i) => {
      const a = tp.angle - FAN / 2 + i * step
      cPos.set(comp.id, {
        x: tp.x + COMP_D * Math.cos(a),
        y: tp.y + COMP_D * Math.sin(a),
      })
    })
  }

  return { tPos, cPos, themes }
}

// ── Component ──────────────────────────────────────────────────
export default function MarketMap({ competitors, isLiveData }: Props) {
  const [selected,  setSelected]  = useState<MapCompetitor | null>(null)
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [zoom,      setZoom]      = useState(1)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  const { tPos, cPos, themes } = layout(competitors)
  const q = search.toLowerCase()
  const vis = (c: MapCompetitor) =>
    !q || c.name.toLowerCase().includes(q) || c.theme.toLowerCase().includes(q)

  const tx = CX * (1 - zoom)
  const ty = CY * (1 - zoom)

  return (
    <div className="flex flex-col h-full" style={{ background: '#f8f9fb' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .sm-fade { animation: fadeIn .5s ease both }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search competitors, topics, or keywords…"
            className="bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 w-60"
          />
        </div>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 shrink-0">
          Watchlist: Core PM Tools <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-gray-400" /> Last 7 days
        </button>
        {!isLiveData && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
            <Database className="w-3 h-3" />
            Demo data — <Link href="/settings" className="underline underline-offset-2">add competitors</Link>
          </span>
        )}
        <div className="flex-1" />
        <Link href="/settings" className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium shrink-0">
          <Plus className="w-3.5 h-3.5" /> Add Competitor
        </Link>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 relative overflow-hidden">
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className="absolute inset-0">

          {/* clip paths for favicons */}
          <defs>
            {competitors.map(c => (
              <clipPath key={c.id} id={`cl-${c.id}`}>
                <circle r={NODE_R - 3} cx={0} cy={0} />
              </clipPath>
            ))}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0001" />
            </filter>
          </defs>


          {/* ── Zoom group ── */}
          <g transform={`translate(${tx} ${ty}) scale(${zoom})`}>

            {/* ── Curved lines (drawn first = behind everything) ── */}
            {themes.map(theme => {
              const tp  = tPos.get(theme)!
              const cfg = THEME_CONFIG[theme]
              return competitors
                .filter(c => c.theme === theme)
                .map(c => {
                  const cp = cPos.get(c.id)
                  if (!cp) return null

                  // Find where line exits the theme card boundary
                  const dx  = cp.x - tp.x
                  const dy  = cp.y - tp.y
                  const len = Math.sqrt(dx * dx + dy * dy) || 1
                  const hw  = TW / 2 + 4   // card half-width + padding
                  const hh  = TH / 2 + 4   // card half-height + padding
                  let sx: number, sy: number
                  if (Math.abs(dy) * hw < Math.abs(dx) * hh) {
                    // exits left or right edge
                    sx = tp.x + Math.sign(dx) * hw
                    sy = tp.y + (dy / dx) * Math.sign(dx) * hw
                  } else {
                    // exits top or bottom edge
                    sx = tp.x + (dx / dy) * Math.sign(dy) * hh
                    sy = tp.y + Math.sign(dy) * hh
                  }

                  // End point pulled back from competitor circle edge
                  const ex = cp.x - (dx / len) * (NODE_R + 2)
                  const ey = cp.y - (dy / len) * (NODE_R + 2)

                  // Gentle quadratic bezier curve
                  const mx = (sx + ex) / 2 - (dy / len) * 24
                  const my = (sy + ey) / 2 + (dx / len) * 24

                  return (
                    <path key={c.id}
                      d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth={1.3}
                      strokeOpacity={vis(c) ? 0.35 : 0.04}
                    />
                  )
                })
            })}

            {/* ── Theme cards ── */}
            {themes.map((theme, ti) => {
              const tp  = tPos.get(theme)!
              const cfg = THEME_CONFIG[theme]
              const cnt = competitors.filter(c => c.theme === theme).length
              return (
                <g key={theme} className="sm-fade" style={{ animationDelay: `${ti * 70}ms` }}>
                  <rect
                    x={tp.x - TW / 2} y={tp.y - TH / 2}
                    width={TW} height={TH} rx={TRND}
                    fill={cfg.bg} stroke={cfg.color} strokeWidth={1.5} strokeOpacity={0.6}
                    filter="url(#shadow)"
                  />
                  <text x={tp.x} y={tp.y - 6} textAnchor="middle"
                    fontSize={11} fontWeight="700" fill={cfg.color}
                    fontFamily="ui-sans-serif,system-ui,sans-serif">
                    {cfg.label}
                  </text>
                  <text x={tp.x} y={tp.y + 10} textAnchor="middle"
                    fontSize={9.5} fill={cfg.color} fillOpacity={0.7}
                    fontFamily="ui-sans-serif,system-ui,sans-serif">
                    ✦ {cnt}
                  </text>
                </g>
              )
            })}

            {/* ── Competitor nodes ── */}
            {competitors.map((c, ci) => {
              const cp = cPos.get(c.id)
              if (!cp) return null
              const isHov  = hovered === c.id
              const isVis  = vis(c)
              const hasErr = imgErrors.has(c.id)
              const logo   = hasErr ? null : getLogoUrl(c.website)
              const init   = (c.name[0] ?? '?').toUpperCase()
              const d      = dot(c.activity_count ?? 0)

              return (
                <g key={c.id}
                  transform={`translate(${cp.x} ${cp.y})`}
                  opacity={isVis ? 1 : 0.07}
                  className="sm-fade"
                  style={{ cursor: isVis ? 'pointer' : 'default', animationDelay: `${100 + ci * 35}ms` }}
                  onClick={() => isVis && setSelected(c)}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* glow on hover */}
                  {isHov && <circle r={NODE_R + 8} fill="#6366f1" fillOpacity={0.1} />}

                  {/* logo circle */}
                  <circle r={NODE_R} fill="white"
                    stroke={isHov ? '#6366f1' : '#e5e7eb'}
                    strokeWidth={isHov ? 2 : 1.5}
                    filter="url(#shadow)"
                  />

                  {logo ? (
                    <image href={logo}
                      x={-(NODE_R - 4)} y={-(NODE_R - 4)}
                      width={(NODE_R - 4) * 2} height={(NODE_R - 4) * 2}
                      clipPath={`url(#cl-${c.id})`}
                      preserveAspectRatio="xMidYMid meet"
                      onError={() => setImgErrors(p => { const s = new Set(p); s.add(c.id); return s })}
                    />
                  ) : (
                    <text textAnchor="middle" dominantBaseline="central"
                      fontSize={12} fontWeight="700" fill="#374151"
                      fontFamily="ui-sans-serif,system-ui,sans-serif">
                      {init}
                    </text>
                  )}

                  {/* activity dot */}
                  <circle cx={NODE_R * 0.7} cy={-NODE_R * 0.7} r={6} fill="white" />
                  <circle cx={NODE_R * 0.7} cy={-NODE_R * 0.7} r={4.5} fill={d} />

                  {/* name */}
                  <text y={NODE_R + 14} textAnchor="middle"
                    fontSize={10} fontWeight={isHov ? '700' : '500'}
                    fill={isHov ? '#111827' : '#6b7280'}
                    fontFamily="ui-sans-serif,system-ui,sans-serif">
                    {c.name}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* badge */}
        <div className="absolute top-4 right-4 bg-white/90 border border-gray-200 rounded-full px-3 py-1.5 shadow-sm pointer-events-none">
          <span className="text-gray-500 text-xs font-medium">✦ {themes.length} major themes detected</span>
        </div>

        {/* zoom controls */}
        <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center divide-x divide-gray-100 overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(+(z - 0.2).toFixed(1), 0.4))}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-medium">−</button>
          <button onClick={() => setZoom(1)}
            className="h-8 px-2.5 flex items-center justify-center text-gray-400 hover:bg-gray-50">
            <span className="text-[10px] font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
          </button>
          <button onClick={() => setZoom(z => Math.min(+(z + 0.2).toFixed(1), 2.0))}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-medium">+</button>
        </div>

        {/* legend */}
        <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-gray-400 text-[9px] font-semibold uppercase tracking-wider mb-2">Activity (7d)</p>
          {[['#d1d5db','No signals'],['#f97316','1–2 signals'],['#ef4444','3+ signals']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <CompetitorDrawer competitor={selected} open={selected !== null} onClose={() => setSelected(null)} />
    </div>
  )
}
