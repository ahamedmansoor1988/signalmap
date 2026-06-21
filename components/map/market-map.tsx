'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { THEME_CONFIG, type Theme } from './mock-data'
import CompetitorDrawer from './competitor-drawer'
import {
  Search, Plus, RefreshCw, X, LayoutGrid, List, Network, Check, Loader2,
  Building2, Zap, Globe
} from 'lucide-react'
import { getLogoUrl } from '@/lib/get-logo-url'
import type { TypedAction } from '@/lib/typed-actions'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { SearchResult } from '@/app/api/search/route'

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
}

type ViewMode = 'cluster' | 'cards' | 'list'

// ── Canvas ─────────────────────────────────────────────────────
const W  = 1400
const H  = 1060
const CX = W / 2
const CY = H / 2 + 30

// ── Sizes ──────────────────────────────────────────────────────
const THEME_R = 280
const COMP_D  = 130
const NODE_R  = 22
const TW      = 126
const TH      = 48
const TRND    = 10
const FAN     = Math.PI

function dot(count: number) {
  if (!count)    return '#d1d5db'
  if (count < 3) return '#f97316'
  return '#ef4444'
}

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
      cPos.set(comp.id, { x: tp.x + COMP_D * Math.cos(a), y: tp.y + COMP_D * Math.sin(a) })
    })
  }

  return { tPos, cPos, themes }
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low'
  const cls = { High: 'text-red-600 bg-red-50 border-red-100', Medium: 'text-amber-600 bg-amber-50 border-amber-100', Low: 'text-emerald-600 bg-emerald-50 border-emerald-100' }[level]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{level} · {score}</span>
}

function CompetitorLogo({ website, name, size = 10 }: { website: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const url = getLogoUrl(website)
  const s = `w-${size} h-${size}`
  if (!url || err) {
    return (
      <div className={`${s} rounded-xl bg-gray-100 flex items-center justify-center shrink-0`}>
        <span className="text-xs font-bold text-gray-500">{name[0]}</span>
      </div>
    )
  }
  return (
    <div className={`${s} rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden shrink-0`}>
      <img src={url} alt={name} className="w-6 h-6 object-contain" onError={() => setErr(true)} />
    </div>
  )
}

// ── Add Competitor Modal ────────────────────────────────────────
function AddCompetitorModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string, name: string) => void }) {
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [step, setStep] = useState<'form' | 'syncing' | 'done'>('form')
  const [syncMsg, setSyncMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !website.trim()) return
    const normalizedSite = website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`
    setError(null)
    setStep('syncing')
    setSyncMsg('Adding competitor…')

    try {
      // 1. Get org
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: membership } = await supabase
        .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
      if (!membership) throw new Error('No organisation found')

      // 2. Insert competitor
      const { data: comp, error: compErr } = await supabase
        .from('competitors')
        .insert({ org_id: membership.org_id, name: name.trim(), website: normalizedSite })
        .select().single()
      if (compErr) throw compErr

      // 3. Add home tracked_page
      const homeUrl = normalizedSite.replace(/\/$/, '')
      await supabase.from('tracked_pages').insert({ competitor_id: comp.id, url: homeUrl, label: 'Home' })

      // 4. Auto deep-sync
      setSyncMsg(`Crawling ${name.trim()} — finding signals…`)
      const res = await fetch(`/api/deep-sync/${comp.id}`, { method: 'POST' })
      const data = await res.json() as { pages_processed?: number; news_articles_found?: number }
      setSyncMsg(`✓ Found ${data.pages_processed ?? 0} pages · ${data.news_articles_found ?? 0} news articles`)
      setStep('done')
      setTimeout(() => { onAdded(comp.id, name.trim()); onClose() }, 1800)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Something went wrong. Please try again.'
      setError(msg)
      setStep('form')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={step === 'form' ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-semibold text-sm">Add Competitor</h2>
          {step === 'form' && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Competitor name</label>
              <input
                autoFocus
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Crayon"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  required
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="crayon.co"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              We&apos;ll automatically crawl their site and pull 30 days of news signals.
            </p>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-violet-700 transition-colors"
            >
              Add &amp; Auto-Sync
            </button>
          </form>
        )}

        {step === 'syncing' && (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-700 text-sm font-medium">{syncMsg}</p>
            <p className="text-gray-400 text-xs mt-1">This takes about 30 seconds…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-gray-700 text-sm font-medium">{syncMsg}</p>
            <p className="text-gray-400 text-xs mt-1">Refreshing map…</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────
export default function MarketMap({ competitors }: Props) {
  const [selected,    setSelected]    = useState<MapCompetitor | null>(null)
  const [hovered,     setHovered]     = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [imgErrors,   setImgErrors]   = useState<Set<string>>(new Set())
  const [syncing,     setSyncing]     = useState(false)
  const [lastSynced,  setLastSynced]  = useState<string | null>(null)
  const [viewMode,    setViewMode]    = useState<ViewMode>('cluster')
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen,    setSearchOpen]    = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef   = useRef<HTMLDivElement>(null)

  // Load last-synced timestamp from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('signalmap_last_synced')
    if (stored) setLastSynced(stored)
  }, [])

  // Global search — debounced fetch
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!search || search.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`)
      const data = await res.json() as { results: SearchResult[] }
      setSearchResults(data.results ?? [])
      setSearchOpen(true)
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSyncNow() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' })
      const data = await res.json() as { synced?: number; error?: string }
      if (!data.error) {
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setLastSynced(ts)
        localStorage.setItem('signalmap_last_synced', ts)
      }
    } catch { /* non-fatal */ }
    finally { setSyncing(false) }
  }

  // Pan + zoom
  const [zoom,   setZoom]   = useState(1.1)
  const [pan,    setPan]    = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const svgRef    = useRef<SVGSVGElement>(null)

  const { tPos, cPos, themes } = layout(competitors)
  const q   = search.toLowerCase()
  const vis = (c: MapCompetitor) => !q || c.name.toLowerCase().includes(q) || c.theme.toLowerCase().includes(q)

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const delta  = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.002
    const factor = Math.exp(delta)
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setZoom(z => {
      const next  = Math.min(Math.max(z * factor, 0.25), 3)
      const ratio = next / z
      setPan(p => ({ x: mx - ratio * (mx - p.x), y: my - ratio * (my - p.y) }))
      return next
    })
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('[data-interactive]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my })
  }, [])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  const zoomIn   = () => setZoom(z => Math.min(+(z + 0.15).toFixed(2), 3))
  const zoomOut  = () => setZoom(z => Math.max(+(z - 0.15).toFixed(2), 0.25))
  const resetView = () => { setZoom(1.1); setPan({ x: 0, y: 0 }) }

  const filtered = competitors.filter(c => vis(c))

  return (
    <div className="flex flex-col h-full" style={{ background: '#f8f9fb' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.sm-fade{animation:fadeIn .5s ease both}`}</style>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        {/* Global search */}
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => { if (searchResults.length) setSearchOpen(true) }}
            placeholder="Search competitors, signals…"
            className="bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 w-64"
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]); setSearchOpen(false) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-3 h-3" />
            </button>
          )}
          {/* Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {searchResults.map(r => (
                <Link key={r.id} href={r.href}
                  onClick={() => { setSearch(''); setSearchOpen(false) }}
                  className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${r.type === 'competitor' ? 'bg-violet-100' : 'bg-amber-100'}`}>
                    {r.type === 'competitor'
                      ? <Building2 className="w-3.5 h-3.5 text-violet-600" />
                      : <Zap className="w-3.5 h-3.5 text-amber-500" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${r.type === 'competitor' ? 'bg-violet-50 text-violet-500' : 'bg-amber-50 text-amber-500'}`}>
                    {r.type === 'competitor' ? 'Competitor' : 'Signal'}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {searchOpen && search.length >= 2 && searchResults.length === 0 && (
            <div className="absolute top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 px-4 py-3">
              <p className="text-xs text-gray-400">No results for &quot;{search}&quot;</p>
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {([
            { mode: 'cluster', icon: Network,    tip: 'Cluster view' },
            { mode: 'cards',   icon: LayoutGrid, tip: 'Cards view'   },
            { mode: 'list',    icon: List,        tip: 'List view'   },
          ] as const).map(({ mode, icon: Icon, tip }) => (
            <button
              key={mode}
              title={tip}
              onClick={() => setViewMode(mode)}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                viewMode === mode ? 'bg-white shadow-sm text-violet-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Add Competitor */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium shrink-0 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Competitor
        </button>
      </div>

      {/* ── Canvas / Cards / List ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* ── CLUSTER VIEW ── */}
        {viewMode === 'cluster' && (
          <>
            <svg
              ref={svgRef}
              width="100%" height="100%"
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0"
              style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
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

              <g transform={`translate(${pan.x + W/2 * (1 - zoom)} ${pan.y + H/2 * (1 - zoom)}) scale(${zoom})`}>
                <circle cx={CX} cy={CY} r={6} fill="#e5e7eb" />
                <circle cx={CX} cy={CY} r={3} fill="#9ca3af" />

                {themes.map(theme => {
                  const tp  = tPos.get(theme)!
                  const cfg = THEME_CONFIG[theme]
                  const dx  = tp.x - CX
                  const dy  = tp.y - CY
                  const len = Math.sqrt(dx*dx + dy*dy) || 1
                  const ex  = CX + (dx/len) * (THEME_R - TW/2 - 6)
                  const ey  = CY + (dy/len) * (THEME_R - TH/2 - 6)
                  return <line key={`spoke-${theme}`} x1={CX} y1={CY} x2={ex} y2={ey} stroke={cfg.color} strokeWidth={1} strokeOpacity={0.15} />
                })}

                {themes.map(theme => {
                  const tp  = tPos.get(theme)!
                  const cfg = THEME_CONFIG[theme]
                  return competitors.filter(c => c.theme === theme).map(c => {
                    const cp = cPos.get(c.id)
                    if (!cp) return null
                    const dx  = cp.x - tp.x
                    const dy  = cp.y - tp.y
                    const len = Math.sqrt(dx*dx + dy*dy) || 1
                    const hw  = TW/2 + 4
                    const hh  = TH/2 + 4
                    let sx: number, sy: number
                    if (Math.abs(dy) * hw < Math.abs(dx) * hh) {
                      sx = tp.x + Math.sign(dx) * hw; sy = tp.y + (dy/dx) * Math.sign(dx) * hw
                    } else {
                      sx = tp.x + (dx/dy) * Math.sign(dy) * hh; sy = tp.y + Math.sign(dy) * hh
                    }
                    const ex = cp.x - (dx/len) * (NODE_R + 2)
                    const ey = cp.y - (dy/len) * (NODE_R + 2)
                    const mx = (sx + ex)/2 - (dy/len)*24
                    const my = (sy + ey)/2 + (dx/len)*24
                    return <path key={c.id} d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={cfg.color} strokeWidth={1.3} strokeOpacity={vis(c) ? 0.35 : 0.04} />
                  })
                })}

                {themes.map((theme, ti) => {
                  const tp  = tPos.get(theme)!
                  const cfg = THEME_CONFIG[theme]
                  const cnt = competitors.filter(c => c.theme === theme).length
                  return (
                    <g key={theme} className="sm-fade" style={{ animationDelay: `${ti * 70}ms` }}>
                      <rect x={tp.x - TW/2} y={tp.y - TH/2} width={TW} height={TH} rx={TRND} fill={cfg.bg} stroke={cfg.color} strokeWidth={1.5} strokeOpacity={0.6} filter="url(#shadow)" />
                      <text x={tp.x} y={tp.y - 6} textAnchor="middle" fontSize={11} fontWeight="700" fill={cfg.color} fontFamily="ui-sans-serif,system-ui,sans-serif">{cfg.label}</text>
                      <text x={tp.x} y={tp.y + 10} textAnchor="middle" fontSize={9.5} fill={cfg.color} fillOpacity={0.7} fontFamily="ui-sans-serif,system-ui,sans-serif">✦ {cnt}</text>
                    </g>
                  )
                })}

                {competitors.map((c, ci) => {
                  const cp     = cPos.get(c.id)
                  if (!cp) return null
                  const isHov  = hovered === c.id
                  const isVis  = vis(c)
                  const hasErr = imgErrors.has(c.id)
                  const logo   = hasErr ? null : getLogoUrl(c.website)
                  const init   = (c.name[0] ?? '?').toUpperCase()
                  const d      = dot(c.activity_count ?? 0)

                  return (
                    <g key={c.id} data-interactive="true" transform={`translate(${cp.x} ${cp.y})`} opacity={isVis ? 1 : 0.07}
                      className="sm-fade" style={{ cursor: isVis ? 'pointer' : 'default', animationDelay: `${100 + ci * 35}ms` }}
                      onClick={() => isVis && setSelected(c)} onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered(null)}>
                      {isHov && <circle r={NODE_R + 8} fill="#6366f1" fillOpacity={0.1} />}
                      <circle r={NODE_R} fill="white" stroke={isHov ? '#6366f1' : '#e5e7eb'} strokeWidth={isHov ? 2 : 1.5} filter="url(#shadow)" />
                      {logo ? (
                        <image href={logo} x={-(NODE_R-4)} y={-(NODE_R-4)} width={(NODE_R-4)*2} height={(NODE_R-4)*2} clipPath={`url(#cl-${c.id})`} preserveAspectRatio="xMidYMid meet" onError={() => setImgErrors(p => { const s = new Set(p); s.add(c.id); return s })} />
                      ) : (
                        <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="700" fill="#374151" fontFamily="ui-sans-serif,system-ui,sans-serif">{init}</text>
                      )}
                      <circle cx={NODE_R * 0.7} cy={-NODE_R * 0.7} r={6} fill="white" />
                      <circle cx={NODE_R * 0.7} cy={-NODE_R * 0.7} r={4.5} fill={d} />
                      {(() => {
                        const tp2 = tPos.get(c.theme)
                        if (!cp || !tp2) return null
                        const ax = cp.x - tp2.x; const ay = cp.y - tp2.y
                        const al = Math.sqrt(ax*ax + ay*ay) || 1
                        const nx = ax/al; const ny = ay/al
                        const lx = nx * (NODE_R + 13); const ly = ny * (NODE_R + 13)
                        const anchor = Math.abs(nx) > 0.6 ? (nx > 0 ? 'start' : 'end') : 'middle'
                        return <text x={lx} y={ly} textAnchor={anchor} dominantBaseline={Math.abs(ny) > 0.6 ? (ny > 0 ? 'hanging' : 'auto') : 'central'} fontSize={10} fontWeight={isHov ? '700' : '500'} fill={isHov ? '#111827' : '#6b7280'} fontFamily="ui-sans-serif,system-ui,sans-serif">{c.name}</text>
                      })()}
                    </g>
                  )
                })}
              </g>
            </svg>

            {/* Theme count badge */}
            <div className="absolute top-4 right-4 bg-white/90 border border-gray-200 rounded-full px-3 py-1.5 shadow-sm pointer-events-none">
              <span className="text-gray-500 text-xs font-medium">✦ {themes.length} major themes detected</span>
            </div>

            {/* Zoom + Sync bar */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex items-center divide-x divide-gray-100 overflow-hidden">
                <button onClick={zoomOut} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-medium">−</button>
                <button onClick={resetView} className="h-8 px-2.5 flex items-center justify-center text-gray-400 hover:bg-gray-50" title="Reset view">
                  <span className="text-[10px] font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
                </button>
                <button onClick={zoomIn} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-medium">+</button>
              </div>
              {/* Sync Now */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex items-center overflow-hidden">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                {lastSynced && !syncing && (
                  <span className="text-[10px] text-gray-400 pr-3 border-l border-gray-100 pl-2">
                    {lastSynced}
                  </span>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <p className="text-gray-400 text-[9px] font-semibold uppercase tracking-wider mb-2">Activity (7d)</p>
              {[['#d1d5db','No signals'],['#f97316','1–2 signals'],['#ef4444','3+ signals']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-gray-500 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CARDS VIEW ── */}
        {viewMode === 'cards' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(c => {
                const cfg = THEME_CONFIG[c.theme]
                return (
                  <div key={c.id}
                    onClick={() => setSelected(c)}
                    className="bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer hover:border-violet-200 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <CompetitorLogo website={c.website} name={c.name} size={10} />
                      <RiskBadge score={c.risk_score} />
                    </div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">{c.name}</p>
                    <p className="text-gray-400 text-xs mb-3">{c.website.replace(/^https?:\/\//, '')}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{c.theme}</span>
                      <span className="text-[10px] text-gray-400">{c.signals_count} signals</span>
                    </div>
                    {c.last_signal && c.last_signal !== 'No signals yet' && (
                      <p className="text-gray-500 text-[11px] mt-2.5 pt-2.5 border-t border-gray-50 line-clamp-2 leading-snug">{c.last_signal}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100 bg-gray-50" style={{ gridTemplateColumns: '1fr 120px 80px 80px 1fr' }}>
                <span>Competitor</span>
                <span>Theme</span>
                <span>Risk</span>
                <span>Signals</span>
                <span>Latest signal</span>
              </div>
              {filtered.map((c, i) => {
                const cfg = THEME_CONFIG[c.theme]
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`grid items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}
                    style={{ gridTemplateColumns: '1fr 120px 80px 80px 1fr' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CompetitorLogo website={c.website} name={c.name} size={8} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.website.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium w-fit" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{c.theme}</span>
                    <RiskBadge score={c.risk_score} />
                    <span className="text-xs text-gray-500">{c.signals_count}</span>
                    <p className="text-xs text-gray-500 truncate pr-2">{c.last_signal !== 'No signals yet' ? c.last_signal : '—'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <CompetitorDrawer competitor={selected} open={selected !== null} onClose={() => setSelected(null)} />

      {showAddModal && (
        <AddCompetitorModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); window.location.reload() }}
        />
      )}
    </div>
  )
}
