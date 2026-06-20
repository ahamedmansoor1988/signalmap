import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CompetitorLogo from '@/components/ui/competitor-logo'
import { Swords } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Battle Room — SignalMap' }

function deriveScore(storedScore: number, diffCount: number): number {
  if (storedScore > 30) return storedScore
  if (diffCount >= 4) return 75
  if (diffCount >= 1) return 45
  return 20
}

function riskLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 61) return 'High'
  if (score >= 31) return 'Medium'
  return 'Low'
}

const RISK_COLORS: Record<string, string> = {
  High:   'text-red-600 bg-red-50 border-red-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Low:    'text-emerald-600 bg-emerald-50 border-emerald-200',
}

export default async function BattleIndexPage() {
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

  if (!membership) redirect('/onboarding')

  type CompetitorRow = { id: string; name: string; website: string; risk_score: number }

  let competitors: CompetitorRow[] = []
  const diffCounts: Record<string, number> = {}

  try {
    const { data: comps } = await supabase
      .from('competitors')
      .select('id, name, website, risk_score')
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })

    competitors = (comps ?? []) as CompetitorRow[]

    if (competitors.length > 0) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: diffs } = await supabase
        .from('competitor_diffs')
        .select('competitor_id')
        .in('competitor_id', competitors.map(c => c.id))
        .gte('detected_at', since)

      ;(diffs ?? []).forEach(d => {
        diffCounts[d.competitor_id] = (diffCounts[d.competitor_id] ?? 0) + 1
      })
    }
  } catch (err) {
    console.error('[battle] failed to load competitors:', err)
  }

  const ranked = competitors
    .map(c => ({ ...c, score: deriveScore(c.risk_score, diffCounts[c.id] ?? 0) }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Swords className="w-5 h-5 text-violet-500" />
          <h1 className="text-gray-900 text-xl font-semibold">Battle Room</h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          Choose a competitor to build your battle card
        </p>

        {ranked.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-xl">
            <Swords className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No competitors tracked yet</p>
            <Link href="/settings" className="text-violet-600 text-sm hover:underline mt-1 block">
              Add a competitor to get started →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ranked.map((c) => {
              const level = riskLabel(c.score)
              return (
                <Link
                  key={c.id}
                  href={`/battle/${c.id}`}
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-sm transition-all"
                >
                  <CompetitorLogo website={c.website} name={c.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium text-sm truncate">{c.name}</p>
                    <p className="text-gray-400 text-xs truncate mt-0.5">
                      {c.website.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${RISK_COLORS[level]}`}>
                    {level} · {c.score}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
