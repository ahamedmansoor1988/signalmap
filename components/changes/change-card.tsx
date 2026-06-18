import Link from 'next/link'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type Change = Database['public']['Tables']['changes']['Row'] & {
  tracked_pages: {
    url: string
    label: string | null
    competitors: {
      id: string
      name: string
    }
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

export default function ChangeCard({ change }: { change: Change }) {
  const theme = change.theme as Theme | null
  const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
  const riskLevel = (change.risk_score ?? 0) >= 75 ? 'High' : (change.risk_score ?? 0) >= 50 ? 'Medium' : 'Low'
  const riskColors = { High: 'text-red-400', Medium: 'text-amber-400', Low: 'text-emerald-400' }

  return (
    <Link
      href={`/changes/${change.id}`}
      className="block bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-medium text-sm">
              {change.tracked_pages.competitors.name}
            </span>
            {cfg && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
              >
                {theme}
              </span>
            )}
            <span className={`text-xs font-medium ${riskColors[riskLevel]}`}>
              {riskLevel} risk
            </span>
          </div>

          {change.ai_signal && (
            <p className="text-zinc-200 text-sm font-medium mb-1.5 leading-snug">
              {change.ai_signal}
            </p>
          )}

          {change.ai_summary && (
            <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">
              {change.ai_summary}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1 text-zinc-600 text-xs">
              <Clock className="w-3 h-3" />
              {timeAgo(change.detected_at)}
            </span>
            <span className="text-zinc-700 text-xs">
              {change.tracked_pages.label ?? (new URL(change.tracked_pages.url).pathname || '/')}
            </span>
            {change.confidence != null && (
              <span className="flex items-center gap-1 text-zinc-600 text-xs">
                <TrendingUp className="w-3 h-3" />
                {change.confidence}% confidence
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={cfg ? { backgroundColor: cfg.bg, color: cfg.color } : { backgroundColor: '#27272a', color: '#71717a' }}
          >
            {change.risk_score ?? 0}
          </div>
          <AlertTriangle className={`w-3 h-3 ${riskColors[riskLevel]}`} />
        </div>
      </div>
    </Link>
  )
}
