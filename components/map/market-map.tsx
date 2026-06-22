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
  tracked_pages_count?: number
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

// ── Bubble sizing ───────────────────────────────────────────────
const MIN_R = 54
const MAX_R = 120

function dot(count: number) {
  if (!count)    return '#d1d5db'
  if (count < 3) return '#f97316'
  return '#ef4444'
}

function bubbleLayout(competitors: MapCompetitor[]) {
  const N = competitors.length
  if (N === 0) return new Map<string, { x: number; y: number; r: number }>()

  type Node = { id: string; r: number; x: number; y: number }

  const nodes: Node[] = competitors.map((c, i) => {
    const r = MIN_R + (c.risk_score / 100) * (MAX_R - MIN_R)
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2
    const initR = N === 1 ? 0 : r * 2.4
    return { id: c.id, r, x: CX + initR * Math.cos(angle), y: CY + initR * Math.sin(angle) }
  })

  const vx = new Array(N).fill(0) as number[]
  const vy = new Array(N).fill(0) as number[]

  for (let t = 0; t < 300; t++) {
    const g = 0.013
    for (let i = 0; i < N; i++) {
      vx[i] += (CX - nodes[i].x) * g
      vy[i] += (CY - nodes[i].y) * g
    }
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const minD = nodes[i].r + nodes[j].r + 14
        if (dist < minD) {
          const push = (minD - dist) / dist * 0.5
          vx[i] -= dx * push; vy[i] -= dy * push
          vx[j] += dx * push; vy[j] += dy * push
        }
      }
    }
    for (let i = 0; i < N; i++) {
      vx[i] *= 0.83; vy[i] *= 0.83
      nodes[i].x += vx[i]; nodes[i].y += vy[i]
    }
  }

  return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, r: n.r }]))
}

function RiskBadge({ score }: { score: number }) {
  if (score === 0) return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-gray-400 bg-gray-50 border-gray-200">
      Monitoring
    </span>
  )
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
  const [limitReached, setLimitReached] = useState(false)
  const supabase = createClient()

  function isSafeUrl(raw: string): boolean {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
      const hostname = url.hostname
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false
      return true
    } catch { return false }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !website.trim()) return
    const normalizedSite = website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`
    if (!isSafeUrl(normalizedSite)) {
      setError('Invalid website URL — must be a public domain')
      return
    }
    setError(null)
    setStep('syncing')
    setSyncMsg('Adding competitor…')

    try {
      // 1. Create competitor via API (enforces plan limits)
      const createRes = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), website: normalizedSite }),
      })
      if (!createRes.ok) {
        const errData = await createRes.json() as { error?: string; limit?: number }
        if (errData.error === 'limit_reached') {
          setLimitReached(true)
          setStep('form')
          return
        }
        throw new Error(errData.error ?? `Server error ${createRes.status}`)
      }
      const comp = await createRes.json() as { id: string; name: string }

      // 2. Add home tracked_page
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
            {limitReached && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-amber-800 text-xs font-semibold mb-1">Competitor limit reached</p>
                <p className="text-amber-700 text-xs mb-2">
                  You&apos;ve reached your competitor limit on the free plan.
                </p>
                <a
                  href="/pricing"
                  className="inline-block text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Upgrade to add more →
                </a>
              </div>
            )}
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={limitReached}
              className="w-full bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  const bubblePos = bubbleLayout(competitors)
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

        {/* ── BUBBLE MAP VIEW ── */}
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
                {competitors.map(c => {
                  const bp = bubblePos.get(c.id)
                  if (!bp) return null
                  return (
                    <clipPath key={c.id} id={`bbl-${c.id}`}>
                      <circle r={bp.r - 8} cx={0} cy={0} />
                    </clipPath>
                  )
                })}
                <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00000014" />
                </filter>
              </defs>

              <g transform={`translate(${pan.x + W/2 * (1 - zoom)} ${pan.y + H/2 * (1 - zoom)}) scale(${zoom})`}>
                {competitors.map((c, ci) => {
                  const bp    = bubblePos.get(c.id)
                  if (!bp) return null
                  const { x, y, r } = bp
                  const isHov  = hovered === c.id
                  const isVis  = vis(c)
                  const hasErr = imgErrors.has(c.id)
                  const logo   = hasErr ? null : getLogoUrl(c.website)
                  const init   = (c.name[0] ?? '?').toUpperCase()
                  const d      = dot(c.activity_count ?? 0)
                  const riskStroke = c.risk_score >= 75 ? '#fca5a5' : c.risk_score >= 45 ? '#fde68a' : '#e2e8f0'

                  return (
                    <g key={c.id} data-interactive="true" transform={`translate(${x} ${y})`}
                      opacity={isVis ? 1 : 0.07} className="sm-fade"
                      style={{ cursor: isVis ? 'pointer' : 'default', animationDelay: `${ci * 55}ms` }}
                      onClick={() => isVis && setSelected(c)}
                      onMouseEnter={() => setHovered(c.id)}
                      onMouseLeave={() => setHovered(null)}>
                      {isHov && <circle r={r + 12} fill="#6366f1" fillOpacity={0.07} />}
                      <circle r={r} fill="white" stroke={isHov ? '#6366f1' : riskStroke}
                        strokeWidth={isHov ? 3 : 2.5} filter="url(#shadow)" />
                      {logo ? (
                        <image href={logo} x={-(r - 12)} y={-(r - 12)} width={(r - 12) * 2} height={(r - 12) * 2}
                          clipPath={`url(#bbl-${c.id})`} preserveAspectRatio="xMidYMid meet"
                          onError={() => setImgErrors(p => { const s = new Set(p); s.add(c.id); return s })} />
                      ) : (
                        <text textAnchor="middle" dominantBaseline="central"
                          fontSize={r * 0.44} fontWeight="700" fill="#374151"
                          fontFamily="ui-sans-serif,system-ui,sans-serif">{init}</text>
                      )}
                      {/* Activity dot */}
                      <circle cx={r * 0.72} cy={-r * 0.72} r={7} fill="white" />
                      <circle cx={r * 0.72} cy={-r * 0.72} r={5} fill={d} />
                      {/* Name */}
                      <text x={0} y={r + 18} textAnchor="middle" fontSize={12}
                        fontWeight={isHov ? '700' : '600'} fill={isHov ? '#111827' : '#374151'}
                        fontFamily="ui-sans-serif,system-ui,sans-serif">{c.name}</text>
                      {/* Risk label — only when meaningful */}
                      {c.risk_score > 0 && (
                        <text x={0} y={r + 33} textAnchor="middle" fontSize={10} fontWeight="500"
                          fill={c.risk_score >= 75 ? '#ef4444' : c.risk_score >= 45 ? '#f59e0b' : '#94a3b8'}
                          fontFamily="ui-sans-serif,system-ui,sans-serif">Risk · {c.risk_score}</text>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>

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
            {/* Bubble size legend */}
            <div className="absolute top-4 right-4 bg-white/90 border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm pointer-events-none">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Bubble size = risk level</p>
              <p className="text-[10px] text-gray-400">Grows as signals are detected</p>
            </div>
          </>
        )}

        {/* ── CARDS VIEW ── */}
        {viewMode === 'cards' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(c => {
                const signalLabel = c.signals_count > 0
                  ? `${c.signals_count} signal${c.signals_count !== 1 ? 's' : ''}`
                  : c.tracked_pages_count
                    ? `${c.tracked_pages_count} page${c.tracked_pages_count !== 1 ? 's' : ''} tracked`
                    : 'Monitoring…'
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
                    <div className="flex items-center justify-end">
                      <span className="text-[10px] text-gray-400">{signalLabel}</span>
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
