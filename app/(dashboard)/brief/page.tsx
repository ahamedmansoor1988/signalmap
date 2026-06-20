import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart3, TrendingUp, Trophy, Zap, ChevronRight } from 'lucide-react'
import { normalizeActions, getTypeStyle } from '@/lib/typed-actions'
import type { Json } from '@/lib/supabase/types'
import type { TopMove } from '@/lib/weekly-brief'
import CompetitorLogo from '@/components/ui/competitor-logo'

export const metadata = { title: 'Weekly Brief — SignalMap' }

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatShortWeek(weekStart: string): string {
  return new Date(weekStart + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function BriefPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const [{ data: briefs }, { data: orgCompetitors }] = await Promise.all([
    supabase
      .from('weekly_briefs')
      .select('*')
      .eq('org_id', membership.org_id)
      .order('week_start', { ascending: false })
      .limit(10),
    supabase
      .from('competitors')
      .select('name, website')
      .eq('org_id', membership.org_id),
  ])

  const websiteByName: Record<string, string> = {}
  for (const c of orgCompetitors ?? []) {
    websiteByName[c.name.toLowerCase()] = c.website
  }

  const latest = briefs?.[0] ?? null
  const previous = briefs?.slice(1) ?? []

  const topMoves: TopMove[] = Array.isArray(latest?.top_moves)
    ? (latest.top_moves as unknown as TopMove[])
    : []
  const actions = normalizeActions(latest?.recommended_actions as Json)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-violet-500" />
            <h1 className="text-gray-900 text-xl font-semibold">Weekly Executive Brief</h1>
          </div>
          {latest ? (
            <p className="text-gray-400 text-sm">
              Week of {formatWeekLabel(latest.week_start)}
            </p>
          ) : (
            <p className="text-gray-400 text-sm">Generated every Monday at 9am UTC</p>
          )}
        </div>

        {!latest ? (
          /* Empty state */
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center shadow-sm">
            <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No brief yet</p>
            <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
              The first Weekly Executive Brief will be generated next Monday at 9am UTC, or you can trigger it manually via the API.
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Market Summary */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <span className="text-gray-700 text-sm font-semibold">Market Summary</span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{latest.summary}</p>
            </div>

            {/* Top Competitor Moves */}
            {topMoves.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-gray-700 text-sm font-semibold">Top Competitor Moves</span>
                </div>
                <div className="space-y-2">
                  {topMoves.map((move, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <CompetitorLogo
                          website={websiteByName[move.competitor?.toLowerCase() ?? ''] ?? null}
                          name={move.competitor}
                          size="sm"
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-300 text-xs font-semibold">{i + 1}</span>
                            <span className="text-gray-900 text-sm font-semibold">{move.competitor}</span>
                          </div>
                          <p className="text-gray-600 text-sm mt-0.5 leading-snug">{move.move}</p>
                          <p className="text-gray-400 text-xs mt-1 italic leading-snug">{move.impact}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emerging Trend */}
            {latest.trend_summary && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-gray-700 text-sm font-semibold">Emerging Trend</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{latest.trend_summary}</p>
              </div>
            )}

            {/* Recommended Actions */}
            {actions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-violet-500 text-sm font-bold">→</span>
                  <span className="text-gray-700 text-sm font-semibold">Recommended Actions</span>
                </div>
                <div className="space-y-2">
                  {actions.map((a, i) => {
                    const style = getTypeStyle(a.type)
                    return (
                      <div key={i} className="flex items-start gap-2.5 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        {style ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.cls}`}>
                            {style.label}
                          </span>
                        ) : (
                          <span className="text-violet-400 shrink-0 mt-1">›</span>
                        )}
                        <span className="text-gray-700 text-sm leading-snug">{a.action}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Previous Briefs */}
        {previous.length > 0 && (
          <div className="mt-10">
            <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">Previous Briefs</h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
              {previous.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-gray-700 text-sm font-medium">{formatShortWeek(b.week_start)}</p>
                    {b.summary && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate max-w-xs">{b.summary}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 ml-3" />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
