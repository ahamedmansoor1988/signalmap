import { createClient } from '@/lib/supabase/server'
import MarketMap from '@/components/map/market-map'
import { MOCK_COMPETITORS } from '@/components/map/mock-data'
import type { MapCompetitor } from '@/components/map/market-map'
import { redirect } from 'next/navigation'
import { normalizeActions } from '@/lib/typed-actions'
import type { Json } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Market Map — SignalMap' }

const VALID_THEMES = ['AI Features', 'Pricing', 'Enterprise', 'GTM', 'Content'] as const
type Theme = typeof VALID_THEMES[number]

function pickTheme(
  allChanges: Array<{ theme: string | null }>,
  idx: number
): Theme {
  // Count votes per theme across ALL signals
  const votes: Record<string, number> = {}
  for (const c of allChanges) {
    if (c.theme && VALID_THEMES.includes(c.theme as Theme)) {
      votes[c.theme] = (votes[c.theme] ?? 0) + 1
    }
  }
  // Pick most-voted theme
  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] as Theme | undefined
  // Only fall back to idx spread when there are genuinely no signals at all
  return winner ?? VALID_THEMES[idx % VALID_THEMES.length]
}

function computeRisk(
  dbScore: number | null,
  allChanges: Array<{ detected_at: string; risk_score: number | null }>,
): number {
  // Use DB score if set (including 0); only derive when null
  if (dbScore != null) return dbScore

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentCount = allChanges.filter(c => new Date(c.detected_at) >= sevenDaysAgo).length
  return Math.min(100, allChanges.length * 6 + recentCount * 12)
}

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let competitors: MapCompetitor[] = []

  if (user) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) redirect('/onboarding')

    if (membership) {
      const { data: dbCompetitors } = await supabase
        .from('competitors')
        .select(`
          id, name, website, risk_score, ai_summary, suggested_actions,
          changes:tracked_pages(
            changes(theme, ai_signal, detected_at, risk_score)
          )
        `)
        .eq('org_id', membership.org_id)
        .order('name')

      if (!dbCompetitors || dbCompetitors.length === 0) redirect('/onboarding')

      competitors = dbCompetitors.map((c, idx) => {
        type RawChange = { theme: string | null; ai_signal: string | null; detected_at: string; risk_score: number | null }
        const trackedPages = c.changes as Array<{ changes: RawChange[] }>
        const allChanges = trackedPages
          .flatMap(tp => tp.changes)
          .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const activityCount = allChanges.filter(ch => new Date(ch.detected_at) >= sevenDaysAgo).length

        const theme    = pickTheme(allChanges, idx)
        const riskScore = computeRisk(c.risk_score, allChanges)

        return {
          id: c.id,
          name: c.name,
          website: c.website,
          risk_score: riskScore,
          theme,
          last_signal: allChanges[0]?.ai_signal ?? 'No signals yet',
          signals_count: allChanges.length,
          tracked_pages_count: trackedPages.length,
          activity_count: activityCount,
          description: c.ai_summary ?? `Tracking ${c.website}`,
          ai_summary: c.ai_summary ?? undefined,
          suggested_actions: normalizeActions(c.suggested_actions as Json) || undefined,
        }
      })
    }
  }

  const data = competitors.length > 0 ? competitors : MOCK_COMPETITORS
  return <MarketMap competitors={data} />
}
