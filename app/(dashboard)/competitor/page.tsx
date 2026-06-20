import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, TrendingUp, Users } from 'lucide-react'

export const metadata = { title: 'Competitors — SignalMap' }

export default async function CompetitorsPage() {
  const supabase = await createClient()

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  } catch {
    // auth service unavailable
  }
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/settings')

  type CompetitorRow = {
    id: string
    name: string
    website: string
    risk_score: number
    created_at: string
    page_count?: number
  }
  let competitors: CompetitorRow[] | null = null
  let loadError = false
  try {
    const { data, error } = await supabase
      .from('competitors')
      .select('id, name, website, risk_score, created_at')
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })
    if (error) console.error('[competitors] query error:', error)
    competitors = data
  } catch (err) {
    console.error('[competitors] failed to load:', err)
    loadError = true
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold mb-1">Something went wrong</p>
          <p className="text-gray-400 text-sm">Could not load competitors. Try refreshing.</p>
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
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 50 ? 'Medium' : 'Low'
              const riskColors = {
                High: 'text-red-600 bg-red-50',
                Medium: 'text-amber-600 bg-amber-50',
                Low: 'text-emerald-600 bg-emerald-50',
              }
              return (
                <Link
                  key={c.id}
                  href={`/competitor/${c.id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="text-gray-900 font-medium text-sm">{c.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-gray-400 text-xs hover:text-gray-600 transition-colors"
                      >
                        {c.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-gray-300 text-xs">
                        tracked
                      </span>
                    </div>
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
