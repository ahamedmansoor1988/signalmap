'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, TrendingUp, ChevronDown, ChevronUp, Eye, Check, ExternalLink, ListPlus } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import type { Database } from '@/lib/supabase/types'
import { normalizeActions, getTypeStyle } from '@/lib/typed-actions'
import type { StructuredDiff } from '@/lib/extractor'
import StructuredDiffView from '@/components/changes/structured-diff-view'
import CompetitorLogo from '@/components/ui/competitor-logo'

type Change = Database['public']['Tables']['changes']['Row'] & {
  tracked_pages: {
    url: string
    label: string | null
    competitors: {
      id: string
      name: string
      website: string
    }
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'just now'
}

export default function ChangeCard({ change, structuredDiff }: { change: Change; structuredDiff?: StructuredDiff | null }) {
  const [expanded, setExpanded] = useState(false)
  const [seen, setSeen] = useState(!!change.seen_at)
  const [markingAsSeen, setMarkingAsSeen] = useState(false)
  const [queued, setQueued] = useState<Set<number>>(new Set())
  const [queueing, setQueueing] = useState<number | null>(null)

  const theme = change.theme as Theme | null
  const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
  const risk = change.risk_score ?? 0
  const riskLevel = risk >= 75 ? 'High' : risk >= 50 ? 'Medium' : 'Low'
  const riskColors = { High: 'text-red-600', Medium: 'text-amber-600', Low: 'text-emerald-600' }
  const impactBullets = Array.isArray(change.impact_bullets) ? (change.impact_bullets as string[]) : []
  const suggestedActions = normalizeActions(change.suggested_actions)

  async function markSeen(e: React.MouseEvent) {
    e.stopPropagation()
    if (seen || markingAsSeen) return
    setMarkingAsSeen(true)
    try {
      await fetch(`/api/changes/${change.id}/seen`, { method: 'POST' })
      setSeen(true)
    } finally {
      setMarkingAsSeen(false)
    }
  }

  async function addToQueue(e: React.MouseEvent, index: number, action: { type: string; action: string }) {
    e.stopPropagation()
    if (queued.has(index) || queueing !== null) return
    setQueueing(index)
    try {
      const res = await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: change.id, action_index: index, action_type: action.type, title: action.action }),
      })
      if (res.ok || res.status === 409) setQueued(s => new Set(Array.from(s).concat(index)))
    } finally { setQueueing(null) }
  }

  return (
    <div className={`bg-white border rounded-xl transition-all ${seen ? 'border-gray-100 opacity-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Collapsed header — click anywhere to expand */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <CompetitorLogo
                website={change.tracked_pages.competitors.website}
                name={change.tracked_pages.competitors.name}
                size="sm"
              />
              <span className="text-gray-900 font-medium text-sm">
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
              <p className="text-gray-800 text-sm font-medium mb-1.5 leading-snug">
                {change.ai_signal}
              </p>
            )}

            {change.ai_summary && (
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                {change.ai_summary}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <Clock className="w-3 h-3" />
                {timeAgo(change.detected_at)}
              </span>
              <span className="text-gray-300 text-xs">
                {change.tracked_pages.label ?? (new URL(change.tracked_pages.url).pathname || '/')}
              </span>
              {change.confidence != null && (
                <span className="flex items-center gap-1 text-gray-400 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  {change.confidence}% confidence
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
              style={cfg ? { backgroundColor: cfg.bg, color: cfg.color } : { backgroundColor: '#f3f4f6', color: '#9ca3af' }}
            >
              {risk}
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className={`w-3 h-3 ${riskColors[riskLevel]}`} />
              {expanded
                ? <ChevronUp className="w-3 h-3 text-gray-300" />
                : <ChevronDown className="w-3 h-3 text-gray-300" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded detail — inline, no navigation required */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {structuredDiff && <StructuredDiffView diff={structuredDiff} />}

          {impactBullets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Impact</p>
              <div className="space-y-1.5">
                {impactBullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                    <span className="text-sm text-gray-700 flex-1">{bullet}</span>
                    <button
                      onClick={(e) => addToQueue(e, i, { type: 'general', action: bullet })}
                      disabled={queued.has(i) || queueing === i}
                      className={`flex items-center gap-1 text-[11px] shrink-0 px-2 py-1 rounded-md ${queued.has(i) ? 'text-emerald-600 bg-emerald-50' : 'text-violet-600 bg-white border border-violet-100 hover:bg-violet-50'}`}
                    >
                      {queued.has(i) ? <Check className="w-3 h-3" /> : <ListPlus className="w-3 h-3" />}
                      {queued.has(i) ? 'Queued' : queueing === i ? '…' : 'Add to mine'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggested actions</p>
              <div className="space-y-1.5">
                {suggestedActions.map((action, i) => {
                  const style = getTypeStyle(action.type)
                  return (
                    <div key={i} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      {style ? (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.cls}`}>
                          {style.label}
                        </span>
                      ) : (
                        <span className="text-violet-500 shrink-0 mt-0.5">→</span>
                      )}
                      <span className="text-sm text-gray-700 flex-1">{action.action}</span>
                      <button onClick={(e) => addToQueue(e, i, action)} disabled={queued.has(i) || queueing === i}
                        className={`flex items-center gap-1 text-[11px] shrink-0 px-2 py-1 rounded-md ${queued.has(i) ? 'text-emerald-600 bg-emerald-50' : 'text-violet-600 bg-white border border-violet-100 hover:bg-violet-50'}`}>
                        {queued.has(i) ? <Check className="w-3 h-3" /> : <ListPlus className="w-3 h-3" />}
                        {queued.has(i) ? 'Queued' : queueing === i ? 'Adding…' : 'Add to mine'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Source URL */}
          <div className="flex items-center gap-1.5 pt-1">
            <ExternalLink className="w-3 h-3 text-gray-300 shrink-0" />
            <a
              href={change.tracked_pages.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors truncate"
              title={change.tracked_pages.url}
            >
              {change.tracked_pages.url.replace(/^https?:\/\//, '')}
            </a>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <a
              href={`/changes/${change.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Full detail →
            </a>
            <button
              onClick={markSeen}
              disabled={seen || markingAsSeen}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${
                seen
                  ? 'text-emerald-600 bg-emerald-50 cursor-default'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer'
              }`}
            >
              {seen ? <Check className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {seen ? 'Seen' : markingAsSeen ? 'Marking…' : 'Mark as seen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
