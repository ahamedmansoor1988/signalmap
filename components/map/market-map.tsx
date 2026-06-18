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

function riskToRadius(score: number): number {
  return 20 + (score / 100) * 24
}

export default function MarketMap({ competitors, isLiveData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<Node[]>([])
  const animFrameRef = useRef<number>(0)
  const tickRef = useRef(0)
  const [selected, setSelected] = useState<MapCompetitor | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const initNodes = useCallback((w: number, h: number) => {
    nodesRef.current = competitors.map((c) => {
      const target = CLUSTER_CENTERS[c.theme]
      return {
        ...c,
        x: w / 2 + (Math.random() - 0.5) * 40,
        y: h / 2 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        targetX: target.x * w,
        targetY: target.y * h,
      }
    })
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
    if (dims.w === 0) return
    nodesRef.current.forEach((n) => {
      const target = CLUSTER_CENTERS[n.theme]
      n.targetX = target.x * dims.w
      n.targetY = target.y * dims.h
    })
  }, [dims])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dims.w === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = dims.w
    canvas.height = dims.h

    function draw() {
      if (!ctx || !canvas) return
      tickRef.current++
      const progress = Math.min(tickRef.current / 60, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const themes = Object.keys(THEME_CONFIG) as Theme[]
      themes.forEach((theme) => {
        const cfg = THEME_CONFIG[theme]
        const clusterNodes = nodesRef.current.filter((n) => n.theme === theme)
        if (!clusterNodes.length) return

        const cx = clusterNodes.reduce((s, n) => s + n.x, 0) / clusterNodes.length
        const cy = clusterNodes.reduce((s, n) => s + n.y, 0) / clusterNodes.length
        const maxDist = Math.max(...clusterNodes.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 60

        const isActive = activeTheme === null || activeTheme === theme
        const alpha = isActive ? 0.12 * progress : 0.04 * progress

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist)
        grad.addColorStop(0, cfg.color + Math.round(alpha * 255).toString(16).padStart(2, '0'))
        grad.addColorStop(1, cfg.color + '00')
        ctx.beginPath()
        ctx.arc(cx, cy, maxDist, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        if (progress > 0.5) {
          ctx.save()
          ctx.globalAlpha = Math.min((progress - 0.5) * 2, 1) * (isActive ? 0.7 : 0.3)
          ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif'
          ctx.fillStyle = cfg.color
          ctx.textAlign = 'center'
          ctx.fillText(cfg.label.toUpperCase(), cx, cy - maxDist + 18)
          ctx.restore()
        }
      })

      const nodes = nodesRef.current
      nodes.forEach((a) => {
        const springK = 0.06
        a.vx += (a.targetX - a.x) * springK
        a.vy += (a.targetY - a.y) * springK

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

        a.vx *= 0.82
        a.vy *= 0.82
        a.x += a.vx
        a.y += a.vy

        const r = riskToRadius(a.risk_score)
        a.x = Math.max(r + 10, Math.min(canvas.width - r - 10, a.x))
        a.y = Math.max(r + 10, Math.min(canvas.height - r - 10, a.y))
      })

      const filteredSearch = search.toLowerCase()
      nodes.forEach((node) => {
        const cfg = THEME_CONFIG[node.theme]
        const r = riskToRadius(node.risk_score)
        const isHovered = hovered === node.id
        const isSelected = selected?.id === node.id
        const matchesSearch = !filteredSearch || node.name.toLowerCase().includes(filteredSearch)
        const matchesTheme = activeTheme === null || activeTheme === node.theme
        const isActive = matchesSearch && matchesTheme

        ctx.save()
        ctx.globalAlpha = isActive ? 1 : 0.25

        if (isHovered || isSelected) {
          ctx.shadowColor = cfg.color
          ctx.shadowBlur = 20
        }

        const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r)
        grad.addColorStop(0, cfg.color + 'cc')
        grad.addColorStop(1, cfg.color + '55')
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        ctx.strokeStyle = isHovered || isSelected ? cfg.color : cfg.color + '80'
        ctx.lineWidth = isHovered || isSelected ? 2 : 1.5
        ctx.stroke()
        ctx.shadowBlur = 0

        ctx.font = `${isHovered || isSelected ? '700' : '600'} ${r > 32 ? '11' : '10'}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.name, node.x, node.y)

        if (r > 28 || isHovered) {
          ctx.font = '500 9px ui-sans-serif, system-ui, sans-serif'
          ctx.fillStyle = cfg.color
          ctx.fillText(`${node.risk_score}`, node.x, node.y + r + 12)
        }

        ctx.restore()
      })

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [dims, hovered, selected, search, activeTheme])

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
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <h1 className="text-white font-semibold text-sm">Market Map</h1>

        {!isLiveData && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
            <Database className="w-3 h-3" />
            Demo data — <Link href="/settings" className="underline underline-offset-2">add competitors</Link>
          </span>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search competitors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-44"
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
                  : { backgroundColor: 'transparent', color: '#71717a', borderColor: '#27272a' }
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
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <Link
          href="/settings"
          title="Add competitors"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
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

        <div className="absolute bottom-4 left-4 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 backdrop-blur-sm">
          <p className="text-zinc-600 text-xs mb-2 font-medium uppercase tracking-wide">Node size = risk score</p>
          <div className="flex items-end gap-2">
            {[30, 50, 75].map((score) => (
              <div key={score} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-full bg-zinc-700"
                  style={{ width: riskToRadius(score) * 1.4, height: riskToRadius(score) * 1.4 }}
                />
                <span className="text-zinc-500 text-xs">{score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 backdrop-blur-sm">
          <span className="text-zinc-500 text-xs">{competitors.length} competitors tracked</span>
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
