'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { getTypeStyle } from '@/lib/typed-actions'
import Link from 'next/link'

interface BattleAnalysis {
  feature_gaps: Array<{ feature: string; us: boolean; them: boolean }>
  battle_actions: Array<{ type: string; action: string }>
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className ?? ''}`} />
}

export default function BattleAISections({
  competitorId,
  ourName,
  competitorName,
  profile,
  homepage,
  recentChanges,
}: {
  competitorId: string
  ourName: string
  competitorName: string
  profile: { company_name: string; icp: string; differentiators: string; description: string }
  homepage: { hero_headline: string; target_customer: string; key_themes: string[]; summary: string }
  recentChanges: string[]
}) {
  const [analysis, setAnalysis] = useState<BattleAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/battle/${competitorId}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, homepage, recent_changes: recentChanges }),
    })
      .then(r => r.json())
      .then((data: BattleAnalysis) => {
        if (data && Array.isArray(data.feature_gaps)) setAnalysis(data)
        else setAnalysis({ feature_gaps: [], battle_actions: [] })
      })
      .catch(() => setAnalysis({ feature_gaps: [], battle_actions: [] }))
      .finally(() => setLoading(false))
  }, [competitorId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-gray-700 text-sm font-semibold">Feature Gaps</h2>
            <span className="text-gray-400 text-xs">Analyzing…</span>
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="text-violet-500 font-bold text-sm">→</span>
            <h2 className="text-gray-700 text-sm font-semibold">Recommended Actions</h2>
            <span className="text-gray-400 text-xs">Generating…</span>
          </div>
          <div className="p-4 sm:p-5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Feature Gaps */}
      {(analysis?.feature_gaps.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-gray-700 text-sm font-semibold">Feature Gaps</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[11px] text-gray-400 font-medium px-4 sm:px-5 py-3 w-1/2">Feature</th>
                  <th className="text-center text-[11px] text-gray-400 font-medium px-3 sm:px-4 py-3 w-1/4">
                    <span className="hidden sm:inline">{ourName}</span>
                    <span className="sm:hidden">You</span>
                  </th>
                  <th className="text-center text-[11px] text-gray-400 font-medium px-3 sm:px-4 py-3 w-1/4">
                    <span className="hidden sm:inline">{competitorName}</span>
                    <span className="sm:hidden">Them</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {analysis!.feature_gaps.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 sm:px-5 py-3 text-gray-700 text-sm">{row.feature}</td>
                    <td className="px-3 sm:px-4 py-3 text-center">
                      {row.us
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-gray-200 mx-auto" />}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center">
                      {row.them
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-gray-200 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Battle Actions */}
      {(analysis?.battle_actions.length ?? 0) > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="text-violet-500 font-bold text-sm">→</span>
            <h2 className="text-gray-700 text-sm font-semibold">Recommended Actions</h2>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {(() => {
              // Deduplicate: one action per type, max 6 total
              const seen = new Set<string>()
              const deduped = analysis!.battle_actions.filter(a => {
                const key = (a.type ?? 'other').toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
              }).slice(0, 6)
              return deduped.map((action, i) => {
                const style = getTypeStyle(action.type)
                return (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {style && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-block mb-2 ${style.cls}`}>
                        {style.label}
                      </span>
                    )}
                    <p className="text-gray-700 text-sm leading-relaxed">{action.action}</p>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      ) : (
        analysis !== null && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-gray-700 text-sm font-semibold">Suggested Battle Actions</h2>
            </div>
            <div className="px-4 sm:px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">
                Add your company profile in Settings to generate personalized battle actions.
              </p>
              <Link href="/settings" className="text-xs text-violet-600 hover:text-violet-700 mt-2 inline-block transition-colors">
                Go to Settings →
              </Link>
            </div>
          </div>
        )
      )}
    </>
  )
}
