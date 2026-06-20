'use client'

import { useState } from 'react'
import { THEME_CONFIG, type Theme } from './mock-data'
import CompetitorDrawer from './competitor-drawer'
import {
  Search, Plus, Calendar, ChevronDown,
  Maximize2, Database,
} from 'lucide-react'
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

// ─── Layout constants ──────────────────────────────────────────
const SVG_W    = 1200
const SVG_H    = 900
const CX       = SVG_W / 2      // 600
const CY       = SVG_H / 2 + 60 // push center down to give title room
const THEME_R  = 210             // themes ring radius
const NODE_R   = 20
const THEME_W  = 130
const THEME_H  = 52
const THEME_RX = 10
// Single-arc and 2-row layout distances (defined in computeLayout below)

function activityColor(count: number): string {
  if (!count) return '#9ca3af'
  if (count < 3) return '#F97316'
  return '#EF4444'
}

// ─── Layout computation ────────────────────────────────────────
interface ThemePos { x: number; y: number; angle: number }
interface CompPos  { x: number; y: number }

function computeLayout(competitors: MapCompetitor[]) {
  const allThemes = Object.keys(THEME_CONFIG) as Theme[]
  const activeThemes = allThemes.filter(t => competitors.some(c => c.theme === t))
  const N = activeThemes.length

  const themePos = new Map<Theme, ThemePos>()
  activeThemes.forEach((theme, i) => {
    const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
    themePos.set(theme, {
      x: CX + THEME_R * Math.cos(angle),
      y: CY + THEME_R * Math.sin(angle),
      angle,
    })
  })

  const compPos = new Map<string, CompPos>()
  for (const theme of activeThemes) {
    const tp = themePos.get(theme)!
    const group = competitors.filter(c => c.theme === theme)
    const Nc = group.length
    if (!Nc) continue

    // Radial and perpendicular unit vectors from theme center
    const rx = Math.cos(tp.angle)
    const ry = Math.sin(tp.angle)
    const px = -Math.sin(tp.angle)
    const py =  Math.cos(tp.angle)

    // Place competitors laterally around the theme node (perpendicular to radial)
    // with a slight push outward so they don't overlap the theme card
    const RADIAL_PUSH = 120  // how far outward from theme center
    const SPACING     = 54   // lateral gap between competitors

    if (Nc <= 4) {
      group.forEach((comp, i) => {
        const lat = (i - (Nc - 1) / 2) * SPACING
        compPos.set(comp.id, {
          x: tp.x + RADIAL_PUSH * rx + lat * px,
          y: tp.y + RADIAL_PUSH * ry + lat * py,
        })
      })
    } else {
      const N1 = Math.ceil(Nc / 2)
      const N2 = Nc - N1
      for (let i = 0; i < N1; i++) {
        const lat = (i - (N1 - 1) / 2) * SPACING
        compPos.set(group[i].id, {
          x: tp.x + RADIAL_PUSH * rx + lat * px,
          y: tp.y + RADIAL_PUSH * ry + lat * py,
        })
      }
      for (let i = 0; i < N2; i++) {
        const lat = (i - (N2 - 1) / 2) * SPACING
        compPos.set(group[N1 + i].id, {
          x: tp.x + (RADIAL_PUSH + 65) * rx + lat * px,
          y: tp.y + (RADIAL_PUSH + 65) * ry + lat * py,
        })
      }
    }
  }

  return { themePos, compPos, activeThemes }
}

// ─── Component ─────────────────────────────────────────────────
export default function MarketMap({ competitors, isLiveData }: Props) {
  const [selected,   setSelected]   = useState<MapCompetitor | null>(null)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [zoom,       setZoom]       = useState(1)
  const [imgErrors,  setImgErrors]  = useState<Set<string>>(new Set())

  const { themePos, compPos, activeThemes } = computeLayout(competitors)
  const searchLower = search.toLowerCase()

  function visible(c: MapCompetitor) {
    if (!searchLower) return true
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.theme.toLowerCase().includes(searchLower) ||
      c.last_signal.toLowerCase().includes(searchLower)
    )
  }

  function markImgError(id: string) {
    setImgErrors(prev => { const s = new Set(prev); s.add(id); return s })
  }

  const zoomIn  = () => setZoom(z => Math.min(+(z + 0.2).toFixed(1), 2.0))
  const zoomOut = () => setZoom(z => Math.max(+(z - 0.2).toFixed(1), 0.4))

  // Scale around the SVG centre
  const transform = `translate(${CX * (1 - zoom)} ${CY * (1 - zoom)}) scale(${zoom})`

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search competitors, topics, or keywords…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 w-60"
          />
        </div>

        {/* Watchlist (UI-only) */}
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0">
          Watchlist: Core PM Tools
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        </button>

        {/* Date range (UI-only) */}
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          Last 7 days
        </button>

        {!isLiveData && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
            <Database className="w-3 h-3" />
            Demo data — <Link href="/settings" className="underline underline-offset-2">add competitors</Link>
          </span>
        )}

        <div className="flex-1 min-w-0" />

        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Competitor
        </Link>
      </div>

      {/* ── Mind Map ── */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="absolute inset-0"
        >
          <defs>
            {competitors.map(c => (
              <clipPath key={c.id} id={`fav-${c.id}`}>
                <circle r={NODE_R - 2} cx={0} cy={0} />
              </clipPath>
            ))}
          </defs>

          {/* ── Title + subtitle — fixed, outside zoom group ── */}
          <text
            x={SVG_W / 2} y={32}
            textAnchor="middle"
            fontSize={13}
            fontWeight="700"
            letterSpacing="0.18em"
            fill="#111827"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            AI MARKET MAP
          </text>
          <text
            x={SVG_W / 2} y={52}
            textAnchor="middle"
            fontSize={10.5}
            fill="#9ca3af"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            Visualize what&apos;s happening in your market
          </text>

          <g transform={transform}>

            {/* ── Connecting lines ── */}
            {activeThemes.map(theme => {
              const tp  = themePos.get(theme)!
              const cfg = THEME_CONFIG[theme]
              return competitors
                .filter(c => c.theme === theme)
                .map(c => {
                  const cp = compPos.get(c.id)
                  if (!cp) return null
                  return (
                    <line
                      key={c.id}
                      x1={tp.x} y1={tp.y}
                      x2={cp.x} y2={cp.y}
                      stroke={cfg.color}
                      strokeWidth={1}
                      strokeOpacity={visible(c) ? 0.28 : 0.04}
                    />
                  )
                })
            })}

            {/* ── Theme cards ── */}
            {activeThemes.map(theme => {
              const tp  = themePos.get(theme)!
              const cfg = THEME_CONFIG[theme]
              const count = competitors.filter(c => c.theme === theme).length
              const tx = tp.x - THEME_W / 2
              const ty = tp.y - THEME_H / 2
              return (
                <g key={theme}>
                  <rect
                    x={tx} y={ty}
                    width={THEME_W} height={THEME_H}
                    rx={THEME_RX}
                    fill={cfg.bg}
                    stroke={cfg.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                  />
                  <text
                    x={tp.x} y={ty + 19}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="700"
                    fill={cfg.color}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {cfg.label}
                  </text>
                  <text
                    x={tp.x} y={ty + 35}
                    textAnchor="middle"
                    fontSize={10}
                    fill={cfg.color}
                    fillOpacity={0.7}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    ✦ {count}
                  </text>
                </g>
              )
            })}

            {/* ── Competitor nodes ── */}
            {competitors.map(c => {
              const cp = compPos.get(c.id)
              if (!cp) return null

              const vis     = visible(c)
              const isHov   = hovered === c.id
              const logoUrl = imgErrors.has(c.id) ? null : getLogoUrl(c.website)
              const dotColor = activityColor(c.activity_count ?? 0)
              const initial  = (c.name[0] ?? '?').toUpperCase()

              return (
                <g
                  key={c.id}
                  transform={`translate(${cp.x} ${cp.y})`}
                  opacity={vis ? 1 : 0.08}
                  style={{ cursor: vis ? 'pointer' : 'default' }}
                  onClick={() => { if (vis) setSelected(c) }}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Hover glow */}
                  {isHov && (
                    <circle r={NODE_R + 7} fill="#6366f1" fillOpacity={0.1} />
                  )}

                  {/* Circle — always white, clean */}
                  <circle
                    r={NODE_R}
                    fill="white"
                    stroke={isHov ? '#6366f1' : '#d1d5db'}
                    strokeWidth={isHov ? 2 : 1.5}
                  />

                  {/* Favicon */}
                  {logoUrl ? (
                    <image
                      href={logoUrl}
                      x={-(NODE_R - 3)} y={-(NODE_R - 3)}
                      width={(NODE_R - 3) * 2} height={(NODE_R - 3) * 2}
                      clipPath={`url(#fav-${c.id})`}
                      preserveAspectRatio="xMidYMid meet"
                      onError={() => markImgError(c.id)}
                    />
                  ) : (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight="700"
                      fill="#374151"
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      {initial}
                    </text>
                  )}

                  {/* Activity dot */}
                  <circle cx={NODE_R * 0.72} cy={-NODE_R * 0.72} r={5.5} fill="white" />
                  <circle cx={NODE_R * 0.72} cy={-NODE_R * 0.72} r={4}   fill={dotColor} />

                  {/* Name label */}
                  <text
                    y={NODE_R + 13}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={isHov ? '700' : '600'}
                    fill={isHov ? '#111827' : '#4b5563'}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {c.name}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* ── Theme count badge — top right ── */}
        <div className="absolute top-4 right-4 bg-white/90 border border-gray-200 rounded-full px-3 py-1.5 shadow-sm pointer-events-none">
          <span className="text-gray-600 text-xs font-medium">✦ {activeThemes.length} major themes detected</span>
        </div>

        {/* ── Zoom controls — bottom left, horizontal ── */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex items-center divide-x divide-gray-100 overflow-hidden">
            <button
              onClick={zoomOut}
              title="Zoom out"
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              −
            </button>
            <button
              onClick={() => setZoom(1)}
              title="Reset zoom"
              className="h-8 px-2.5 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[10px] font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
            </button>
            <button
              onClick={zoomIn}
              title="Zoom in"
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              title="Fullscreen reset"
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Legend — bottom right ── */}
        <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide mb-2">Activity (7d)</p>
          <div className="space-y-1.5">
            {[
              { color: '#9ca3af', label: 'Low activity' },
              { color: '#F97316', label: 'Medium' },
              { color: '#EF4444', label: 'High' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-gray-500 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CompetitorDrawer
        competitor={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
