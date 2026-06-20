'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Users, Zap } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'

type CompetitorRow = {
  id: string
  name: string
  website: string
  risk_score: number
  created_at: string
  signals_total: number
  signals_week: number
  last_signal: string | null
  themes: string[]
}

function getLogoUrl(website: string) {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch { return null }
}

function timeAgo(date: string | null) {
  if (!date) return null
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

function CompetitorLogo({ website, name }: { website: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const url = getLogoUrl(website)
  if (!url || failed) {
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-gray-500">{name[0]}</span>
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
      <img
        src={url}
        alt={name}
        className="w-6 h-6 object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<CompetitorRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/competitors')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setCompetitors(data.competitors ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-[72px] bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold mb-1">Could not load competitors</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const highRisk   = competitors?.filter(c => c.risk_score >= 75).length ?? 0
  const totalSignals = competitors?.reduce((sum, c) => sum + c.signals_week, 0) ?? 0

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-gray-900 text-xl font-bold">Competitors</h1>
            <p className="text-gray-400 text-sm mt-0.5">{competitors?.length ?? 0} being tracked</p>
          </div>
          <Link
            href="/settings"
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-50 transition-all"
          >
            + Add competitor
          </Link>
        </div>

        {/* Stats row */}
        {(competitors?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{competitors?.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Tracked</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-amber-500">{totalSignals}</p>
              <p className="text-xs text-gray-400 mt-0.5">Signals this week</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-red-500">{highRisk}</p>
              <p className="text-xs text-gray-400 mt-0.5">High risk</p>
            </div>
          </div>
        )}

        {!competitors?.length ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-2xl bg-white">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No competitors tracked yet</p>
            <Link href="/settings" className="text-violet-600 text-sm hover:underline mt-1 block">
              Add your first competitor →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {competitors.map((c) => {
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 45 ? 'Medium' : 'Low'
              const riskConfig = {
                High:   { cls: 'text-red-600 bg-red-50 border-red-100', dot: 'bg-red-500' },
                Medium: { cls: 'text-amber-600 bg-amber-50 border-amber-100', dot: 'bg-amber-400' },
                Low:    { cls: 'text-emerald-600 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-400' },
              }[riskLevel]

              const ago = timeAgo(c.last_signal)

              return (
                <Link
                  key={c.id}
                  href={`/competitor/${c.id}`}
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-4 py-3.5 hover:border-violet-200 hover:shadow-sm transition-all group"
                >
                  <CompetitorLogo website={c.website} name={c.name} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 font-semibold text-sm">{c.name}</p>
                      {c.signals_week > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-100">
                          <Zap className="w-2.5 h-2.5" />
                          {c.signals_week} this week
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 text-gray-400 text-xs hover:text-gray-600 transition-colors"
                      >
                        {c.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      {ago && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">last signal {ago}</span>
                        </>
                      )}
                    </div>
                    {c.themes.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {c.themes.slice(0, 3).map(t => {
                          const cfg = THEME_CONFIG[t as Theme]
                          return cfg ? (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{c.risk_score}</p>
                      <p className="text-[10px] text-gray-400">risk</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border ${riskConfig.cls}`}>
                      {riskLevel}
                    </span>
                    <span className="text-gray-300 group-hover:text-violet-400 transition-colors text-lg">›</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
