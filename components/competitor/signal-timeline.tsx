'use client'

import { useEffect, useState } from 'react'
import { Lock, Zap, Loader2, ChevronDown, ChevronUp, ArrowRight, TrendingUp } from 'lucide-react'
import { TIME_PERIODS } from '@/lib/plans'
import { THEME_CONFIG, type Theme } from '@/components/map/mock-data'
import type { TimelineResponse, TimelineSignal } from '@/app/api/competitor/[id]/timeline/route'

interface Props {
  competitorId: string
  plan: string
}

const PAGE_LABEL_COLOR: Record<string, { bg: string; text: string }> = {
  Pricing:    { bg: 'bg-amber-50',   text: 'text-amber-600'   },
  Changelog:  { bg: 'bg-blue-50',    text: 'text-blue-600'    },
  Homepage:   { bg: 'bg-violet-50',  text: 'text-violet-600'  },
  Blog:       { bg: 'bg-green-50',   text: 'text-green-600'   },
  Newsroom:   { bg: 'bg-orange-50',  text: 'text-orange-600'  },
  News:       { bg: 'bg-orange-50',  text: 'text-orange-600'  },
  Enterprise: { bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  Product:    { bg: 'bg-teal-50',    text: 'text-teal-600'    },
}

function pageLabelStyle(label: string | null) {
  if (!label) return { bg: 'bg-gray-100', text: 'text-gray-500' }
  return PAGE_LABEL_COLOR[label] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
}

function SignalCard({ s }: { s: TimelineSignal }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = s.ai_summary || s.impact_bullets.length > 0 || s.suggested_actions.length > 0
  const date = new Date(s.detected_at)
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const theme = s.theme as Theme | null
  const themeCfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
  const labelStyle = pageLabelStyle(s.page_label)
  const riskColor = (s.risk_score ?? 0) >= 75 ? 'bg-red-400' : (s.risk_score ?? 0) >= 45 ? 'bg-amber-400' : 'bg-violet-400'

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Signal header */}
      <div
        className={`flex items-start gap-3 p-4 ${hasDetail ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
        onClick={() => hasDetail && setExpanded(e => !e)}
      >
        {/* Risk dot */}
        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${riskColor}`} />

        <div className="flex-1 min-w-0">
          {/* Headline */}
          <p className="text-sm font-semibold text-gray-800 leading-snug">{s.ai_signal ?? 'Change detected'}</p>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            {s.page_label && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${labelStyle.bg} ${labelStyle.text}`}>
                {s.page_label}
              </span>
            )}
            {themeCfg && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: themeCfg.bg, color: themeCfg.color }}>
                {themeCfg.label}
              </span>
            )}
            <span className="text-[10px] text-gray-400">{dateLabel} · {timeLabel}</span>
            {s.confidence != null && (
              <span className="text-[10px] text-gray-300">{Math.round(s.confidence * 100)}% confidence</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {s.risk_score != null && s.risk_score > 0 && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
              s.risk_score >= 75 ? 'bg-red-50 text-red-500' :
              s.risk_score >= 45 ? 'bg-amber-50 text-amber-500' :
              'bg-gray-50 text-gray-400'
            }`}>{s.risk_score}</span>
          )}
          {hasDetail && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {/* Full summary */}
          {s.ai_summary && s.ai_summary !== s.ai_signal && (
            <p className="text-xs text-gray-600 leading-relaxed">{s.ai_summary}</p>
          )}

          {/* Impact bullets */}
          {s.impact_bullets.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">What this means</p>
              <ul className="space-y-1">
                {s.impact_bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested actions */}
          {s.suggested_actions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Recommended actions</p>
              <ul className="space-y-1">
                {s.suggested_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-violet-700">
                    <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-violet-400" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source link */}
          {s.page_url && (
            <a href={s.page_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-violet-600 transition-colors">
              Source: {s.page_url.replace(/^https?:\/\//, '').slice(0, 60)}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function SignalTimeline({ competitorId, plan }: Props) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const paid = plan === 'pro' || plan === 'business' || plan === 'elite'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/competitor/${competitorId}/timeline?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as TimelineResponse); setLoading(false) })
      .catch(() => setLoading(false))
  }, [competitorId, days])

  function selectPeriod(d: number, requiresPaid: boolean) {
    if (requiresPaid && !paid) { setShowUpgrade(true); return }
    setShowUpgrade(false)
    setDays(d)
  }

  // Group signals by page label
  const grouped = data?.signals.reduce<Record<string, TimelineSignal[]>>((acc, s) => {
    const key = s.page_label ?? 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {}) ?? {}

  const groupOrder = ['Pricing', 'Changelog', 'Product', 'Homepage', 'Blog', 'Newsroom', 'News', 'Enterprise', 'Other']
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = groupOrder.indexOf(a); const bi = groupOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-gray-900">Signal Timeline</h2>
          {data && !loading && (
            <span className="text-xs text-gray-400">· {data.signals.length} signals</span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {TIME_PERIODS.map(p => {
            const locked = p.paid && !paid
            const active = days === p.days && !locked
            return (
              <button
                key={p.days}
                onClick={() => selectPeriod(p.days, p.paid)}
                className={`relative flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                  active ? 'bg-white text-violet-700 shadow-sm' :
                  locked ? 'text-gray-400 cursor-pointer hover:text-gray-600' :
                  'text-gray-500 hover:text-gray-700'
                }`}
              >
                {locked && <Lock className="w-2.5 h-2.5" />}
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Upgrade prompt */}
      {showUpgrade && (
        <div className="mx-5 mt-4 bg-violet-50 border border-violet-100 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-800">Unlock 15 &amp; 30-day history</p>
            <p className="text-xs text-violet-600 mt-0.5">Available on Pro, Business and Elite plans.</p>
            <a href="mailto:ahamedmansoor1988@gmail.com?subject=SignalMap upgrade"
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-violet-700 hover:text-violet-900">
              Upgrade now →
            </a>
          </div>
          <button onClick={() => setShowUpgrade(false)} className="text-violet-400 hover:text-violet-600 text-sm">✕</button>
        </div>
      )}

      <div className="px-5 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
        )}

        {!loading && data && data.signals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No signals in the last {days} days</p>
            <p className="text-xs text-gray-300 mt-1">Run Deep Sync to crawl this competitor&apos;s pages</p>
          </div>
        )}

        {!loading && data && data.signals.length > 0 && (
          <div className="space-y-5">
            {/* Direction bar */}
            {data.direction && (
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-2.5">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <p className="text-xs text-violet-700 font-medium">{data.direction}</p>
              </div>
            )}

            {/* Risk trend chart */}
            {data.risk_trend.length > 1 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Risk over time</p>
                <div className="flex items-end gap-1 h-10">
                  {data.risk_trend.map(r => {
                    const color = r.score >= 75 ? 'bg-red-400' : r.score >= 45 ? 'bg-amber-400' : 'bg-emerald-400'
                    return (
                      <div key={r.date} className="flex-1 flex flex-col items-center group relative">
                        <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(8, Math.min(100, r.score))}%` }} />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {r.score}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-gray-300">{new Date(data.risk_trend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="text-[9px] text-gray-300">{new Date(data.risk_trend[data.risk_trend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            )}

            {/* Grouped signals */}
            {sortedGroups.map(([group, sigs]) => {
              const style = pageLabelStyle(group)
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${style.bg} ${style.text}`}>{group}</span>
                    <span className="text-[10px] text-gray-300">{sigs.length} signal{sigs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {sigs.map(s => <SignalCard key={s.id} s={s} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
