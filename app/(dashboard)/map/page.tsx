import { createClient } from '@/lib/supabase/server'
import MarketMap from '@/components/map/market-map'
import { MOCK_COMPETITORS } from '@/components/map/mock-data'
import type { MapCompetitor } from '@/components/map/market-map'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Market Map — SignalMap' }

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
          id, name, website, risk_score,
          changes:tracked_pages(
            changes(theme, ai_signal, detected_at, risk_score)
          )
        `)
        .eq('org_id', membership.org_id)
        .order('risk_score', { ascending: false })

      if (!dbCompetitors || dbCompetitors.length === 0) redirect('/onboarding')

      if (dbCompetitors && dbCompetitors.length > 0) {
        competitors = dbCompetitors.map((c) => {
          // Pick theme from most recent change
          const allChanges = (c.changes as Array<{ changes: Array<{ theme: string | null; ai_signal: string | null; detected_at: string; risk_score: number | null }> }>)
            .flatMap((tp) => tp.changes)
            .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())

          const latestChange = allChanges[0]
          const themes = ['AI Features', 'Pricing', 'Enterprise', 'GTM', 'Content'] as const
          type Theme = typeof themes[number]
          const theme: Theme = (themes.includes(latestChange?.theme as Theme) ? latestChange.theme : 'Content') as Theme

          return {
            id: c.id,
            name: c.name,
            website: c.website,
            risk_score: c.risk_score,
            theme,
            last_signal: latestChange?.ai_signal ?? 'No signals detected yet',
            signals_count: allChanges.length,
            description: `Tracking ${c.website}`,
          }
        })
      }
    }
  }

  // Fall back to mock data when DB is empty
  const data = competitors.length > 0 ? competitors : MOCK_COMPETITORS

  return <MarketMap competitors={data} isLiveData={competitors.length > 0} />
}
