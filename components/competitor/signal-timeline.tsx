'use client'

import { useEffect, useState } from 'react'
import { Lock, Zap, Loader2 } from 'lucide-react'
import { TIME_PERIODS } from '@/lib/plans'
import { THEME_CONFIG, type Theme } from '@/components/map/mock-data'
import type { TimelineResponse } from '@/app/api/competitor/[id]/timeline/route'

interface Props {
  competitorId: string
  plan: string
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

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-gray-900">Signal Timeline</h2>
          {data && !loading && (
            <span className="text-xs text-gray-400 ml-1">· {data.signals.length} signals</span>
          )}
        </div>

        {/* Time period tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {TIME_PERIODS.map(p => {
            const locked = p.paid && !paid
            const active = days === p.days && !locked
            return (
              <button
                key={p.days}
                onClick={() => selectPeriod(p.days, p.paid)}
                className={`relative flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                  active
                    ? 'bg-white text-violet-700 shadow-sm'
                    : locked
                    ? 'text-gray-400 cursor-pointer hover:text-gray-600'
                    : 'text-gray-500 hover:text-gray-700'
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
            <p className="text-sm font-semibold text-violet-800">Unlock 30, 60 &amp; 90-day history</p>
            <p className="text-xs text-violet-600 mt-0.5">Available on Pro, Business and Elite plans. See months of competitive movement, not just a week.</p>
            <a
              href={`mailto:ahamedmansoor1988@gmail.com?subject=SignalMap upgrade`}
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-violet-700 hover:text-violet-900"
            >
              Upgrade now →
            </a>
          </div>
          <button onClick={() => setShowUpgrade(false)} className="text-violet-400 hover:text-violet-600 text-sm leading-none">✕</button>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
        )}

        {!loading && data && data.signals.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">No signals in the last {days} days</p>
        )}

        {!loading && data && data.signals.length > 0 && (
          <>
            {/* Mini risk trend chart */}
            {data.risk_trend.length > 1 && (
              <div className="mb-5 pb-4 border-b border-gray-50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Risk over time</p>
                <div className="flex items-end gap-1 h-12">
                  {data.risk_trend.map(r => {
                    const color = r.score >= 75 ? 'bg-red-400' : r.score >= 45 ? 'bg-amber-400' : 'bg-emerald-400'
                    const heightPct = Math.max(8, Math.min(100, r.score))
                    return (
                      <div key={r.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${heightPct}%` }} />
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
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

            {/* Signal feed */}
            <div className="space-y-0">
              {data.signals.map((s, i) => {
                const theme = s.theme as Theme | null
                const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
                const date = new Date(s.detected_at)
                const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                const isLast = i === data.signals.length - 1

                return (
                  <div key={s.id} className="flex gap-3">
                    {/* Timeline spine */}
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        (s.risk_score ?? 0) >= 75 ? 'bg-red-400' :
                        (s.risk_score ?? 0) >= 45 ? 'bg-amber-400' :
                        'bg-violet-400'
                      }`} />
                      {!isLast && <div className="w-px flex-1 bg-gray-100 my-1" />}
                    </div>

                    {/* Content */}
                    <div className={`pb-4 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-gray-700 leading-snug flex-1">{s.ai_signal ?? 'Change detected'}</p>
                        {s.risk_score != null && s.risk_score > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            s.risk_score >= 75 ? 'bg-red-50 text-red-500' :
                            s.risk_score >= 45 ? 'bg-amber-50 text-amber-500' :
                            'bg-gray-50 text-gray-400'
                          }`}>
                            {s.risk_score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {cfg && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{dateLabel} · {timeLabel}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
