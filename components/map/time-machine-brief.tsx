'use client'

import { useEffect, useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Zap, AlertTriangle, ArrowRight, Loader2, BookOpen } from 'lucide-react'
import type { BriefResponse } from '@/app/api/time-machine/brief/route'

interface Props {
  days: 30 | 60 | 90
  onClose: () => void
}

export default function TimeMachineBrief({ days, onClose }: Props) {
  const [data, setData] = useState<BriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/time-machine/brief?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as BriefResponse); setLoading(false) })
      .catch(() => { setError('Failed to generate brief'); setLoading(false) })
  }, [days])

  return (
    <div className="absolute inset-0 z-50 flex items-stretch pointer-events-none">
      {/* Backdrop */}
      <div
        className="flex-1 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="w-[420px] bg-white border-l border-gray-200 shadow-2xl flex flex-col pointer-events-auto overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-violet-600 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className="w-4 h-4 text-violet-200" />
              <span className="text-xs font-semibold text-violet-200 uppercase tracking-wide">Competitive Brief</span>
            </div>
            <p className="text-white font-bold text-base leading-tight">
              Last {days} days
            </p>
            {data && <p className="text-violet-200 text-xs mt-0.5">Since {data.window_label}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-violet-300 hover:text-white transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-400">Generating your competitive brief…</p>
            </div>
          )}

          {error && (
            <div className="p-5">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {data && !loading && (
            <div className="p-5 space-y-5">

              {/* Headline */}
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-violet-800 leading-snug">{data.headline}</p>
              </div>

              {/* AI Narrative */}
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Analysis</h3>
                <div className="space-y-3">
                  {data.narrative.map((para, i) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed">{para}</p>
                  ))}
                </div>
              </section>

              {/* Watch out + Your move */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">Watch out</p>
                    <p className="text-xs text-red-700 leading-snug">{data.watch_out}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
                  <ArrowRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Your move</p>
                    <p className="text-xs text-emerald-700 leading-snug">{data.your_move}</p>
                  </div>
                </div>
              </div>

              {/* Top movers */}
              {data.top_movers.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Risk Movers</h3>
                  <div className="space-y-2">
                    {data.top_movers.map(m => (
                      <div key={m.name} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          m.risk_delta > 10 ? 'bg-red-100 text-red-600' :
                          m.risk_delta > 0  ? 'bg-orange-50 text-orange-500' :
                          m.risk_delta < 0  ? 'bg-emerald-50 text-emerald-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {m.risk_delta > 0
                            ? <><TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />+{m.risk_delta}</>
                            : m.risk_delta < 0
                            ? <><TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />{m.risk_delta}</>
                            : <><Minus className="w-2.5 h-2.5 inline" />0</>
                          }
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                            {m.signals > 0 && (
                              <span className="text-[10px] text-violet-500 shrink-0">{m.signals} signal{m.signals > 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {m.top_signal && (
                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">{m.top_signal}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Theme shifts */}
              {data.theme_shifts.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Active Themes</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.theme_shifts.map(t => (
                      <div key={t.theme} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700">{t.theme}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{t.competitors.slice(0, 3).join(', ')}{t.competitors.length > 3 ? ` +${t.competitors.length - 3}` : ''} · {t.signal_count} signals</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Key signals */}
              {data.key_signals.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Key Signals</h3>
                  <div className="space-y-2.5">
                    {data.key_signals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold text-violet-600">{s.competitor} · </span>
                          <span className="text-[11px] text-gray-600 leading-snug">{s.signal}</span>
                          <p className="text-[10px] text-gray-300 mt-0.5">
                            {new Date(s.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            AI-generated from {data?.key_signals.length ?? 0} signals · {data?.window_label}
          </p>
        </div>
      </div>
    </div>
  )
}
