import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, TrendingUp, Clock } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'

export default async function CompetitorProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: competitor } = await supabase
    .from('competitors')
    .select(`
      *,
      tracked_pages(
        id, url, label, last_crawled_at,
        changes(
          id, ai_signal, ai_summary, theme, risk_score, confidence, detected_at
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!competitor) notFound()

  type TrackedPage = {
    id: string
    url: string
    label: string | null
    last_crawled_at: string | null
    changes: Array<{
      id: string
      ai_signal: string | null
      ai_summary: string | null
      theme: string | null
      risk_score: number | null
      confidence: number | null
      detected_at: string
    }>
  }

  const pages = competitor.tracked_pages as TrackedPage[]
  const allChanges = pages
    .flatMap((p) => p.changes.map((c) => ({ ...c, page: p })))
    .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())

  const riskLevel = competitor.risk_score >= 75 ? 'High' : competitor.risk_score >= 50 ? 'Medium' : 'Low'
  const riskColors = { High: 'text-red-400 bg-red-400/10', Medium: 'text-amber-400 bg-amber-400/10', Low: 'text-emerald-400 bg-emerald-400/10' }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href="/competitor"
          className="flex items-center gap-1.5 text-zinc-500 text-sm hover:text-zinc-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Competitors
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-white text-2xl font-semibold">{competitor.name}</h1>
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-500 text-sm hover:text-zinc-300 transition-colors mt-1"
            >
              {competitor.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${riskColors[riskLevel]}`}>
            {riskLevel} Risk · {competitor.risk_score}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Tracked Pages', value: pages.length },
            { label: 'Total Changes', value: allChanges.length },
            { label: 'Risk Score', value: competitor.risk_score },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-white text-2xl font-bold">{value}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Tracked Pages */}
        <section className="mb-8">
          <h2 className="text-white text-sm font-semibold mb-3">Monitored Pages</h2>
          <div className="space-y-2">
            {pages.map((p) => (
              <div key={p.id} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-zinc-300 text-sm">{p.label ?? p.url}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">{p.url}</p>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
                  <Clock className="w-3 h-3" />
                  {p.last_crawled_at
                    ? new Date(p.last_crawled_at).toLocaleDateString()
                    : 'Never crawled'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <h2 className="text-white text-sm font-semibold mb-3">Activity Feed</h2>
          {allChanges.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
              <p className="text-zinc-500 text-sm">No changes detected yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allChanges.map((change) => {
                const theme = change.theme as Theme | null
                const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
                return (
                  <Link
                    key={change.id}
                    href={`/changes/${change.id}`}
                    className="block bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {cfg && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
                        >
                          {theme}
                        </span>
                      )}
                      <span className="text-zinc-600 text-xs ml-auto flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Risk {change.risk_score ?? 0}
                      </span>
                      <span className="text-zinc-700 text-xs">
                        {new Date(change.detected_at).toLocaleDateString()}
                      </span>
                    </div>
                    {change.ai_signal && (
                      <p className="text-zinc-200 text-sm font-medium">{change.ai_signal}</p>
                    )}
                    {change.ai_summary && (
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{change.ai_summary}</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
