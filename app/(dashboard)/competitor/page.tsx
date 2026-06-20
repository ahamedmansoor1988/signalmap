'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, TrendingUp, Users } from 'lucide-react'

type CompetitorRow = {
  id: string
  name: string
  website: string
  risk_score: number
  created_at: string
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
      <div className="h-full flex items-center justify-center">
        <div className="space-y-3 w-full max-w-3xl px-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-gray-900 text-xl font-semibold">Competitors</h1>
            <p className="text-gray-500 text-sm mt-1">
              {competitors?.length ?? 0} being tracked
            </p>
          </div>
          <Link
            href="/settings"
            className="text-xs text-violet-600 hover:text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all"
          >
            + Add competitor
          </Link>
        </div>

        {!competitors?.length ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-xl">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No competitors tracked yet</p>
            <Link href="/settings" className="text-violet-600 text-sm hover:underline mt-1 block">
              Add your first competitor →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {competitors.map((c) => {
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 45 ? 'Medium' : 'Low'
              const riskColors = {
                High:   'text-red-600 bg-red-50',
                Medium: 'text-amber-600 bg-amber-50',
                Low:    'text-emerald-600 bg-emerald-50',
              }
              return (
                <Link
                  key={c.id}
                  href={`/competitor/${c.id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="text-gray-900 font-medium text-sm">{c.name}</p>
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-gray-400 text-xs hover:text-gray-600 transition-colors mt-1"
                    >
                      {c.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {c.risk_score}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskColors[riskLevel]}`}>
                      {riskLevel}
                    </span>
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
