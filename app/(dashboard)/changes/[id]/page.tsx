import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import { ArrowLeft, ExternalLink, AlertCircle, Zap, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function ChangeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: change } = await supabase
    .from('changes')
    .select(`
      *,
      tracked_pages(url, label, competitors(name, website))
    `)
    .eq('id', params.id)
    .single()

  if (!change) notFound()

  const theme = change.theme as Theme | null
  const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
  const impactBullets = change.impact_bullets as string[] | null
  const suggestedActions = change.suggested_actions as string[] | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const competitor = (change.tracked_pages as any)?.competitors
  const page = change.tracked_pages as { url: string; label: string | null } | null

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back */}
        <Link
          href="/changes"
          className="flex items-center gap-1.5 text-gray-400 text-sm hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Change Explorer
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-gray-900 text-xl font-semibold">{competitor?.name}</h1>
            {cfg && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
              >
                {theme}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <a
              href={competitor?.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-600 transition-colors"
            >
              {competitor?.website?.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>·</span>
            <span>{page?.label ?? page?.url}</span>
            <span>·</span>
            <span>{new Date(change.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Signal */}
          {change.ai_signal && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-gray-700 text-sm font-medium">Signal</span>
                {change.confidence != null && (
                  <span className="ml-auto text-gray-400 text-xs">{change.confidence}% confidence</span>
                )}
              </div>
              <p className="text-gray-900 font-medium">{change.ai_signal}</p>
            </div>
          )}

          {/* AI Summary */}
          {change.ai_summary && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <span className="text-gray-700 text-sm font-medium">What it means</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{change.ai_summary}</p>
            </div>
          )}

          {/* Impact + Actions */}
          <div className="grid grid-cols-2 gap-4">
            {impactBullets && impactBullets.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-gray-700 text-sm font-medium">Impact</span>
                </div>
                <ul className="space-y-1.5">
                  {impactBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-500 text-xs">
                      <span className="text-red-500 mt-0.5">·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {suggestedActions && suggestedActions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-violet-500 text-sm">→</span>
                  <span className="text-gray-700 text-sm font-medium">Actions</span>
                </div>
                <ul className="space-y-1.5">
                  {suggestedActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-500 text-xs">
                      <span className="text-violet-500 mt-0.5">›</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Risk Score */}
          {change.risk_score != null && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 text-sm font-medium">Risk Score</span>
                <span
                  className="text-2xl font-bold"
                  style={{ color: cfg?.color ?? '#9ca3af' }}
                >
                  {change.risk_score}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${change.risk_score}%`,
                    backgroundColor: cfg?.color ?? '#9ca3af',
                  }}
                />
              </div>
            </div>
          )}

          {/* Diff View */}
          {change.diff_html && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <span className="text-gray-700 text-sm font-medium">Page Diff</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre
                  className="text-xs font-mono leading-relaxed [&_.diff-add]:text-emerald-700 [&_.diff-add]:bg-emerald-50 [&_.diff-remove]:text-red-700 [&_.diff-remove]:bg-red-50 [&_.diff-context]:text-gray-400"
                  dangerouslySetInnerHTML={{ __html: change.diff_html }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
