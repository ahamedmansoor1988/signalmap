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

function activityColor(count: number) {
  if (!count) return '#9ca3af'
  if (count < 3) return '#F97316'
  return '#EF4444'
}

function CompetitorLogo({
  competitor,
  onClick,
}: {
  competitor: MapCompetitor
  onClick: () => void
}) {
  const [imgErr, setImgErr] = useState(false)
  const logoUrl = imgErr ? null : getLogoUrl(competitor.website)
  const dot     = activityColor(competitor.activity_count ?? 0)
  const initial = (competitor.name[0] ?? '?').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
      title={competitor.name}
    >
      <div className="relative">
        <div className="w-11 h-11 rounded-full bg-white border-2 border-gray-200 group-hover:border-violet-400 transition-colors shadow-sm flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={competitor.name}
              className="w-8 h-8 object-contain"
              onError={() => setImgErr(true)}
            />
          ) : (
            <span className="text-sm font-bold text-gray-600">{initial}</span>
          )}
        </div>
        {/* Activity dot */}
        <span
          className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: dot }}
        />
      </div>
      <span className="text-[10px] text-gray-500 group-hover:text-gray-800 transition-colors leading-tight text-center max-w-[52px] truncate">
        {competitor.name}
      </span>
    </button>
  )
}

export default function MarketMap({ competitors, isLiveData }: Props) {
  const [selected, setSelected] = useState<MapCompetitor | null>(null)
  const [search,   setSearch]   = useState('')

  const allThemes    = Object.keys(THEME_CONFIG) as Theme[]
  const activeThemes = allThemes.filter(t => competitors.some(c => c.theme === t))
  const searchLower  = search.toLowerCase()

  function visible(c: MapCompetitor) {
    if (!searchLower) return true
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.theme.toLowerCase().includes(searchLower)
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <style>{`
        @keyframes clusterIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        .cluster-card {
          animation: clusterIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0 flex-wrap">
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
        <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0">
          Watchlist: Core PM Tools
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        </button>
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

      {/* ── Cluster Grid ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">

          {/* Header */}
          <div className="text-center mb-10">
            <h2 className="text-sm font-bold tracking-[0.2em] text-gray-800 uppercase">AI Market Map</h2>
            <p className="text-xs text-gray-400 mt-1">Visualize what&apos;s happening in your market</p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
              <span className="text-violet-500">✦</span>
              {activeThemes.length} major themes detected
            </div>
          </div>

          {/* Theme clusters — responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeThemes.map((theme, ti) => {
              const cfg   = THEME_CONFIG[theme]
              const group = competitors.filter(c => c.theme === theme)
              const visibleGroup = group.filter(visible)

              return (
                <div
                  key={theme}
                  className="cluster-card bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  style={{ animationDelay: `${ti * 60}ms`, borderTopColor: cfg.color, borderTopWidth: 3 }}
                >
                  {/* Theme header */}
                  <div className="px-4 pt-4 pb-3" style={{ backgroundColor: cfg.bg }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wide" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: cfg.color, backgroundColor: 'white', opacity: 0.9 }}>
                        ✦ {group.length}
                      </span>
                    </div>
                  </div>

                  {/* Competitor logos */}
                  <div className="px-4 py-4">
                    {visibleGroup.length === 0 ? (
                      <p className="text-gray-300 text-xs text-center py-2">No matches</p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {visibleGroup.map(c => (
                          <CompetitorLogo
                            key={c.id}
                            competitor={c}
                            onClick={() => setSelected(c)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-8">
            {[
              { color: '#9ca3af', label: 'Low activity' },
              { color: '#F97316', label: 'Medium' },
              { color: '#EF4444', label: 'High' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-gray-400 text-xs">{label}</span>
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
