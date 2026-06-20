'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { THEME_CONFIG, type Theme } from './mock-data'
import CompetitorDrawer from './competitor-drawer'
import { Search, RefreshCw, Settings, Database } from 'lucide-react'
import Link from 'next/link'

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
}

interface Props {
  competitors: MapCompetitor[]
  isLiveData: boolean
}

interface Node extends MapCompetitor {
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
}

const CLUSTER_CENTERS: Record<Theme, { x: number; y: number }> = {
  'AI Features': { x: 0.28, y: 0.32 },
  'Pricing':     { x: 0.72, y: 0.28 },
  'Enterprise':  { x: 0.22, y: 0.70 },
  'GTM':         { x: 0.65, y: 0.68 },
  'Content':     { x: 0.50, y: 0.50 },
}

// Entry animation constants
const ENTRY_DURATION = 24  // ticks ≈ 400ms at 60fps
const ENTRY_STAGGER  = 3   // ticks between each bubble ≈ 50ms
const HALO_FADE_TICKS = 40

function riskToRadius(score: number): number {
  return 20 + (score / 100) * 24
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function MarketMap({ competitors, isLiveData }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef     = useRef<Node[]>([])
  const animFrameRef = useRef<number>(0)
  const tickRef      = useRef(0)
  const [selected, setSelected]     = useState<MapCompetitor | null>(null)
  const [hovered, setHovered]       = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)
  const [dims, setDims]             = useState({ w: 0, h: 0 })

  // Pre-simulate physics synchronously so nodes are at stable positions
  // before the first draw — no movement during render, only fade+scale
  const initNodes = useCallback((w: number, h: number) => {
    const nodes: Node[] = competitors.map((c) => {
      const target = CLUSTER_CENTERS[c.theme]
      return {
        ...c,
        x: target.x * w + (Math.random() - 0.5) * 60,
        y: target.y * h + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
        targetX: target.x * w,
        targetY: target.y * h,
      }
    })

    // Run physics headlessly until settled
    for (let tick = 0; tick < 180; tick++) {
      nodes.forEach((a) => {
        a.vx += (a.targetX - a.x) * 0.10
        a.vy += (a.targetY - a.y) * 0.10

        nodes.forEach((b) => {
          if (a === b) return
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.max(Math.hypot(dx, dy), 1)
          const minDist = riskToRadius(a.risk_score) + riskToRadius(b.risk_score) + 12
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.4
            a.vx += dx * force
            a.vy += dy * force
          }
        })

        a.vx *= 0.88
        a.vy *= 0.88
        a.x  += a.vx
        a.y  += a.vy

        const r = riskToRadius(a.risk_score)
        a.x = Math.max(r + 10, Math.min(w - r - 10, a.x))
        a.y = Math.max(r + 10, Math.min(h - r - 10, a.y))
      })
    }

    nodesRef.current = nodes
  }, [competitors])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (dims.w > 0 && dims.h > 0) {
      tickRef.current = 0
      initNodes(dims.w, dims.h)
    }
  }, [dims, initNodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dims.w === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = dims.w
    canvas.height = dims.h

    // Total ticks until all bubbles have fully appeared
    const totalEntryTicks = (competitors.length - 1) * ENTRY_STAGGER + ENTRY_DURATION + 6

    function draw() {
      if (!ctx || !canvas) return
      tickRef.current++
      const tick = tickRef.current

      // Background
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const haloProgress = Math.min(tick / HALO_FADE_TICKS, 1)

      // Cluster halos — fade in once with haloProgress
      const themes = Object.keys(THEME_CONFIG) as Theme[]
      themes.forEach((theme) => {
        const cfg         = THEME_CONFIG[theme]
        const clusterNodes = nodesRef.current.filter((n) => n.theme === theme)
        if (!clusterNodes.length) return

        const cx      = clusterNodes.reduce((s, n) => s + n.x, 0) / clusterNodes.length
        const cy      = clusterNodes.reduce((s, n) => s + n.y, 0) / clusterNodes.length
        const maxDist = Math.max(...clusterNodes.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 60

        const isActive = activeTheme === null || activeTheme === theme
        const alpha    = isActive ? 0.10 * haloProgress : 0.03 * haloProgress

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist)
        grad.addColorStop(0, cfg.color + Math.round(alpha * 255).toString(16).padStart(2, '0'))
        grad.addColorStop(1, cfg.color + '00')
        ctx.beginPath()
        ctx.arc(cx, cy, maxDist, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        if (haloProgress > 0.5) {
          ctx.save()
          ctx.globalAlpha = Math.min((haloProgress - 0.5) * 2, 1) * (isActive ? 0.6 : 0.2)
          ctx.font        = '700 11px ui-sans-serif, system-ui, sans-serif'
          ctx.fillStyle   = cfg.color
          ctx.textAlign   = 'center'
          ctx.fillText(cfg.label.toUpperCase(), cx, cy - maxDist + 18)
          ctx.restore()
        }
      })

      // Draw nodes — fade + scale in per-bubble, then static
      const filteredSearch = search.toLowerCase()
      nodesRef.current.forEach((node, index) => {
        const cfg         = THEME_CONFIG[node.theme]
        const r           = riskToRadius(node.risk_score)
        const isHovered   = hovered === node.id
        const isSelected  = selected?.id === node.id
        const matchesSearch = !filteredSearch || node.name.toLowerCase().includes(filteredSearch)
        const matchesTheme  = activeTheme === null || activeTheme === node.theme
        const isActive    = matchesSearch && matchesTheme

        // Per-bubble entry progress (0 → 1), staggered by index
        const nodeStartTick = index * ENTRY_STAGGER
        const t       = Math.max(0, Math.min(1, (tick - nodeStartTick) / ENTRY_DURATION))
        const ease    = easeOutCubic(t)
        const scale   = 0.8 + 0.2 * ease
        const opacity = ease

        ctx.save()
        ctx.globalAlpha = opacity * (isActive ? 1 : 0.2)

        // Translate to node center, scale from there, draw at origin
        ctx.translate(node.x, node.y)
        ctx.scale(scale, scale)

        if (isHovered || isSelected) {
          ctx.shadowColor = cfg.color
          ctx.shadowBlur  = 16
        }

        // Node fill
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r)
        grad.addColorStop(0, cfg.color + 'ee')
        grad.addColorStop(1, cfg.color + 'aa')
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Border
        ctx.strokeStyle = isHovered || isSelected ? cfg.color : cfg.color + 'cc'
        ctx.lineWidth   = isHovered || isSelected ? 2.5 : 1.5
        ctx.stroke()
        ctx.shadowBlur = 0

        // Label
        ctx.font          = `${isHovered || isSelected ? '700' : '600'} ${r > 32 ? '11' : '10'}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle     = '#ffffff'
        ctx.textAlign     = 'center'
        ctx.textBaseline  = 'middle'
        ctx.fillText(node.name, 0, 0)

        // Risk score below (unscaled position: r below center)
        if (r > 28 || isHovered) {
          ctx.font      = '600 9px ui-sans-serif, system-ui, sans-serif'
          ctx.fillStyle = cfg.color
          ctx.fillText(`${node.risk_score}`, 0, r + 12)
        }

        // Activity dot — top-right corner of bubble
        const ac = node.activity_count ?? 0
        if (ac > 0) {
          const dotColor = ac >= 6 ? '#EF4444' : ac >= 3 ? '#F97316' : '#F59E0B'
          const dotX = r * 0.72
          const dotY = -r * 0.72
          ctx.shadowBlur = 0
          ctx.beginPath()
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = dotColor
          ctx.fill()
        }

        ctx.restore()
      })

      // Loop only during entry animation; static after all bubbles appear
      if (tick < totalEntryTicks) {
        animFrameRef.current = requestAnimationFrame(draw)
      }
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [dims, hovered, selected, search, activeTheme, competitors.length])

  function getNodeAt(cx: number, cy: number): Node | null {
    for (const node of nodesRef.current) {
      const r = riskToRadius(node.risk_score)
      if (Math.hypot(node.x - cx, node.y - cy) <= r) return node
    }
    return null
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top)
    if (node) setSelected(node)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top)
    setHovered(node?.id ?? null)
    if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : 'default'
  }

  function handleReset() {
    tickRef.current = 0
    if (dims.w > 0) initNodes(dims.w, dims.h)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-gray-900 font-semibold text-sm">Market Map</h1>

        {!isLiveData && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Database className="w-3 h-3" />
            Demo data — <Link href="/settings" className="underline underline-offset-2">add competitors</Link>
          </span>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search competitors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 w-44"
          />
        </div>

        <div className="flex items-center gap-1">
          {(Object.keys(THEME_CONFIG) as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTheme(activeTheme === t ? null : t)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
              style={
                activeTheme === t
                  ? { backgroundColor: THEME_CONFIG[t].bg, color: THEME_CONFIG[t].color, borderColor: THEME_CONFIG[t].color + '60' }
                  : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: THEME_CONFIG[t].color }} />
              {THEME_CONFIG[t].label}
            </button>
          ))}
        </div>

        <button
          onClick={handleReset}
          title="Replay animation"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <Link
          href="/settings"
          title="Add competitors"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          className="absolute inset-0"
        />

        <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">Node size = risk score</p>
          <div className="flex items-end gap-2 mb-3">
            {[30, 50, 75].map((score) => (
              <div key={score} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-full bg-gray-300"
                  style={{ width: riskToRadius(score) * 1.4, height: riskToRadius(score) * 1.4 }}
                />
                <span className="text-gray-400 text-xs">{score}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-xs mb-1.5 font-medium uppercase tracking-wide">Activity (7d)</p>
          <div className="flex items-center gap-3">
            {([['#F59E0B', 'Low'], ['#F97316', 'Med'], ['#EF4444', 'High']] as const).map(([color, label]) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-gray-400 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <span className="text-gray-500 text-xs">{competitors.length} competitors tracked</span>
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
