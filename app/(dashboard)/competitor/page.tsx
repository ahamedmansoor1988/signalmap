import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, TrendingUp, Users } from 'lucide-react'

export const metadata = { title: 'Competitors — SignalMap' }

export default async function CompetitorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/settings')

  const { data: competitors } = await supabase
    .from('competitors')
    .select(`
      id, name, website, risk_score, created_at,
      tracked_pages(id)
    `)
    .eq('org_id', membership.org_id)
    .order('risk_score', { ascending: false })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-semibold">Competitors</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {competitors?.length ?? 0} being tracked
            </p>
          </div>
          <Link
            href="/settings"
            className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-all"
          >
            + Add competitor
          </Link>
        </div>

        {!competitors?.length ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
            <Users className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No competitors tracked yet</p>
            <Link href="/settings" className="text-violet-400 text-sm hover:underline mt-1 block">
              Add your first competitor →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {competitors.map((c) => {
              const riskLevel = c.risk_score >= 75 ? 'High' : c.risk_score >= 50 ? 'Medium' : 'Low'
              const riskColors = {
                High: 'text-red-400 bg-red-400/10',
                Medium: 'text-amber-400 bg-amber-400/10',
                Low: 'text-emerald-400 bg-emerald-400/10',
              }
              return (
                <Link
                  key={c.id}
                  href={`/competitor/${c.id}`}
                  className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                >
                  <div>
                    <p className="text-white font-medium text-sm">{c.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-zinc-600 text-xs hover:text-zinc-400 transition-colors"
                      >
                        {c.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-zinc-700 text-xs">
                        {(c.tracked_pages as Array<{ id: string }>).length} pages tracked
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-zinc-500 text-xs">
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
