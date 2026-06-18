'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, TrendingUp, AlertCircle, Zap } from 'lucide-react'
import type { MockCompetitor } from './mock-data'
import { THEME_CONFIG } from './mock-data'

interface CompetitorDrawerProps {
  competitor: MockCompetitor | null
  open: boolean
  onClose: () => void
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const colors = {
    High: 'bg-red-50 text-red-600 border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border-amber-200',
    Low: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level]}`}>
      <AlertCircle className="w-3 h-3" />
      {level} Risk · {score}
    </span>
  )
}

export default function CompetitorDrawer({ competitor, open, onClose }: CompetitorDrawerProps) {
  if (!competitor) return null

  const theme = THEME_CONFIG[competitor.theme]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[400px] bg-white border-l border-gray-200 p-0 overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-gray-900 text-xl font-semibold">{competitor.name}</h2>
              <a
                href={`https://${competitor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1 mt-0.5 transition-colors"
              >
                {competitor.website}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <RiskBadge score={competitor.risk_score} />
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: theme.bg, color: theme.color, border: `1px solid ${theme.color}40` }}
            >
              {competitor.theme}
            </span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-gray-400 text-xs">{competitor.signals_count} signals this month</span>
          </div>
        </div>

        <Separator className="bg-gray-200" />

        {/* Latest Signal */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-gray-700 text-sm font-medium">Latest Signal</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-gray-900 text-sm leading-relaxed">{competitor.last_signal}</p>
            <p className="text-gray-400 text-xs mt-2">Detected 2 hours ago</p>
          </div>
        </div>

        <Separator className="bg-gray-200" />

        {/* Strategic Summary */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            <span className="text-gray-700 text-sm font-medium">Strategic Summary</span>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">{competitor.description}</p>
        </div>

        <Separator className="bg-gray-200" />

        {/* Risk Score Breakdown */}
        <div className="p-6">
          <span className="text-gray-700 text-sm font-medium block mb-3">Risk Score Breakdown</span>
          <div className="space-y-2">
            {[
              { label: 'Product velocity', value: Math.round(competitor.risk_score * 0.35) },
              { label: 'Messaging overlap', value: Math.round(competitor.risk_score * 0.3) },
              { label: 'Market reach', value: Math.round(competitor.risk_score * 0.35) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-gray-400 text-xs w-32 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${value}%`, backgroundColor: theme.color }}
                  />
                </div>
                <span className="text-gray-500 text-xs w-6 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-gray-200" />

        {/* Suggested Actions */}
        <div className="p-6">
          <span className="text-gray-700 text-sm font-medium block mb-3">Suggested Actions</span>
          <div className="space-y-2">
            {[
              'Update battlecard with latest positioning changes',
              'Review pricing page for competitive gaps',
              'Flag to sales team for upcoming deals',
            ].map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">›</span>
                <span className="text-gray-500 text-sm">{action}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
