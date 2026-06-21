'use client'

import { ExternalLink, Swords, User, Zap } from 'lucide-react'
import Link from 'next/link'
import type { MockCompetitor } from './mock-data'
import { THEME_CONFIG } from './mock-data'
import CompetitorLogo from '@/components/ui/competitor-logo'

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const colors = {
    High:   'bg-red-50 text-red-600 border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border-amber-200',
    Low:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level]}`}>
      {level} Risk · {score}
    </span>
  )
}

function isRealId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export default function CompetitorDrawer({ competitor, open, onClose }: {
  competitor: MockCompetitor | null
  open: boolean
  onClose: () => void
}) {
  if (!competitor || !open) return null

  const theme = THEME_CONFIG[competitor.theme]
  const isReal = isRealId(competitor.id)
  const latestSignal = competitor.last_signal ?? competitor.description ?? null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
      />

      {/* Compact card — top-right of map */}
      <div className="fixed top-16 right-4 z-40 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <CompetitorLogo website={competitor.website} name={competitor.name} size="md" />
              <div>
                <h2 className="text-gray-900 font-semibold text-sm leading-tight">{competitor.name}</h2>
                <a
                  href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-gray-400 text-xs hover:text-violet-600 flex items-center gap-0.5 mt-0.5 transition-colors"
                >
                  {competitor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none -mt-0.5"
            >
              ×
            </button>
          </div>

          {/* Theme + risk */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: theme.bg, color: theme.color }}
            >
              {competitor.theme}
            </span>
            <RiskBadge score={competitor.risk_score} />
          </div>
        </div>

        {/* Latest signal */}
        {latestSignal && (
          <div className="px-4 pb-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Latest signal</span>
                {competitor.signals_count > 0 && (
                  <span className="ml-auto text-[10px] text-gray-400">{competitor.signals_count} total</span>
                )}
              </div>
              <p className="text-gray-700 text-xs leading-snug line-clamp-3">{latestSignal}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {isReal && (
          <div className="px-4 pb-4 flex gap-2">
            <Link
              href={`/competitor/${competitor.id}`}
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition-all"
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </Link>
            <Link
              href={`/battle/${competitor.id}`}
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              Battle Room
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
