import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Clock } from 'lucide-react'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import ActivityTimeline from '@/components/competitor/activity-timeline'
import RiskSparkline from '@/components/competitor/risk-sparkline'

export default async function CompetitorProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: competitor }, { data: diffs }, { data: riskHistory }] = await Promise.all([
    supabase
      .from('competitors')
      .select(`
        *,
        tracked_pages(
          id, url, label, last_crawled_at,
          changes(id, ai_signal, ai_summary, theme, risk_score, confidence, detected_at)
        )
      `)
      .eq('id', params.id)
      .single(),

    supabase
      .from('competitor_diffs')
      .select('id, change_type, detected_at, summary')
      .eq('competitor_id', params.id)
      .order('detected_at', { ascending: false })
      .limit(100),

    supabase
      .from('risk_score_history')
      .select('scored_at, product_velocity, messaging_overlap, market_reach, total')
      .eq('competitor_id', params.id)
      .order('scored_at', { ascending: false })
      .limit(30),
  ])

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
  const riskColors = {
    High:   'text-red-600 bg-red-50',
    Medium: 'text-amber-600 bg-amber-50',
    Low:    'text-emerald-600 bg-emerald-50',
  }

  // Latest risk breakdown (most recent history entry or fallback)
  const latestRisk = riskHistory?.[0]
  const productVelocity  = latestRisk?.product_velocity  ?? 0
  const messagingOverlap = latestRisk?.messaging_overlap ?? 0
  const marketReach      = latestRisk?.market_reach      ?? 0

  const diffCounts = {
    Pricing:   (diffs ?? []).filter((d) => d.change_type === 'Pricing').length,
    Messaging: (diffs ?? []).filter((d) => d.change_type === 'Messaging').length,
    Product:   (diffs ?? []).filter((d) => d.change_type === 'Product').length,
    Hiring:    (diffs ?? []).filter((d) => d.change_type === 'Hiring').length,
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href="/competitor"
          className="flex items-center gap-1.5 text-gray-400 text-sm hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Competitors
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-gray-900 text-2xl font-semibold">{competitor.name}</h1>
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-400 text-sm hover:text-gray-600 transition-colors mt-1"
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
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Tracked Pages',  value: pages.length },
            { label: 'Total Signals',  value: allChanges.length },
            { label: 'Changes (90d)',  value: (diffs ?? []).length },
            { label: 'Risk Score',     value: competitor.risk_score },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
              <div className="text-gray-900 text-2xl font-bold">{value}</div>
              <div className="text-gray-400 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Activity Timeline */}
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 text-sm font-semibold">Activity Timeline</h2>
              <div className="flex gap-1.5">
                {Object.entries(diffCounts).map(([type, count]) => count > 0 && (
                  <span key={type} className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                    {type} {count}
                  </span>
                ))}
              </div>
            </div>
            <ActivityTimeline diffs={diffs ?? []} />
          </div>

          {/* Risk Breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-gray-900 text-sm font-semibold mb-4">Risk Breakdown</h2>
            <div className="space-y-4">
              {[
                { label: 'Product velocity',  value: productVelocity,  histKey: 'product_velocity'  },
                { label: 'Messaging overlap', value: messagingOverlap, histKey: 'messaging_overlap' },
                { label: 'Market reach',      value: marketReach,      histKey: 'market_reach'      },
              ].map(({ label, value, histKey }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <div className="flex items-center gap-2">
                      {riskHistory && riskHistory.length >= 2 && (
                        <RiskSparkline
                          data={[...riskHistory].reverse().map((r) => ({
                            scored_at: r.scored_at,
                            total: r[histKey as keyof typeof r] as number,
                          }))}
                          height={16}
                          width={40}
                        />
                      )}
                      <span className="text-gray-700 text-xs font-medium w-6 text-right">{value}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-700"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 30-day total sparkline */}
            {riskHistory && riskHistory.length >= 2 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">30d total trend</span>
                  <RiskSparkline
                    data={[...riskHistory].reverse().map((r) => ({ scored_at: r.scored_at, total: r.total }))}
                    height={24}
                    width={60}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tracked Pages */}
        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-3">Monitored Pages</h2>
          <div className="space-y-2">
            {pages.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-gray-700 text-sm font-medium">{p.label ?? p.url}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{p.url}</p>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <Clock className="w-3 h-3" />
                  {p.last_crawled_at
                    ? new Date(p.last_crawled_at).toLocaleDateString()
                    : 'Never crawled'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Classic change signals */}
        {allChanges.length > 0 && (
          <section>
            <h2 className="text-gray-900 text-sm font-semibold mb-3">AI Signals</h2>
            <div className="space-y-3">
              {allChanges.map((change) => {
                const theme = change.theme as Theme | null
                const cfg = theme && THEME_CONFIG[theme] ? THEME_CONFIG[theme] : null
                return (
                  <Link
                    key={change.id}
                    href={`/changes/${change.id}`}
                    className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
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
                      <span className="text-gray-400 text-xs ml-auto">{new Date(change.detected_at).toLocaleDateString()}</span>
                    </div>
                    {change.ai_signal && <p className="text-gray-800 text-sm font-medium">{change.ai_signal}</p>}
                    {change.ai_summary && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{change.ai_summary}</p>}
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
