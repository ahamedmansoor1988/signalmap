import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface SearchResult {
  type: 'competitor' | 'signal'
  id: string
  title: string
  subtitle: string
  href: string
  theme?: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ results: [] })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ results: [] })

  const orgId = membership.org_id

  // Search competitors by name or website
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, website, risk_score')
    .eq('org_id', orgId)
    .or(`name.ilike.%${q}%,website.ilike.%${q}%`)
    .limit(5)

  // Get competitor IDs for this org (to filter changes)
  const { data: orgCompetitors } = await supabase
    .from('competitors').select('id').eq('org_id', orgId)

  const competitorIds = orgCompetitors?.map(c => c.id) ?? []

  // Search signals/changes
  let signalResults: SearchResult[] = []
  if (competitorIds.length > 0) {
    const { data: pages } = await supabase
      .from('tracked_pages')
      .select('id, competitor_id')
      .in('competitor_id', competitorIds)

    const pageIds = pages?.map(p => p.id) ?? []
    const pageToCompetitor = new Map(pages?.map(p => [p.id, p.competitor_id]) ?? [])
    const competitorMap = new Map(competitors?.map(c => [c.id, c]) ?? [])

    // Also get all org competitor details for signal competitor names
    const { data: allComps } = await supabase
      .from('competitors').select('id, name').eq('org_id', orgId)
    allComps?.forEach(c => competitorMap.set(c.id, c as typeof competitorMap extends Map<string, infer V> ? V : never))

    if (pageIds.length > 0) {
      const { data: changes } = await supabase
        .from('changes')
        .select('id, tracked_page_id, ai_signal, theme, detected_at')
        .in('tracked_page_id', pageIds)
        .or(`ai_signal.ilike.%${q}%,theme.ilike.%${q}%`)
        .order('detected_at', { ascending: false })
        .limit(5)

      signalResults = (changes ?? []).map(ch => {
        const compId = pageToCompetitor.get(ch.tracked_page_id)
        const comp = compId ? competitorMap.get(compId) : null
        return {
          type: 'signal' as const,
          id: ch.id,
          title: ch.ai_signal ?? 'Signal',
          subtitle: comp ? `${comp.name} · ${ch.theme ?? ''}` : ch.theme ?? '',
          href: `/changes/${ch.id}`,
          theme: ch.theme ?? undefined,
        }
      })
    }
  }

  const competitorResults: SearchResult[] = (competitors ?? []).map(c => ({
    type: 'competitor' as const,
    id: c.id,
    title: c.name,
    subtitle: c.website.replace(/^https?:\/\//, ''),
    href: `/competitor/${c.id}`,
  }))

  return NextResponse.json({
    results: [...competitorResults, ...signalResults].slice(0, 8),
  })
}
