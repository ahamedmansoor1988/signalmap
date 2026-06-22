import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// ── POST /api/competitors — create a competitor with plan-limit enforcement ───
export async function POST(req: NextRequest) {
  const userSupabase = await createClient()

  let user = null
  try {
    const result = await userSupabase.auth.getUser()
    user = result.data?.user ?? null
  } catch { /* auth unavailable */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createServiceClient()

  // Fetch org plan limit
  const { data: org } = await supabase
    .from('organizations')
    .select('competitor_limit')
    .eq('id', membership.org_id)
    .single()

  // Count current competitors
  const { count } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', membership.org_id)

  const limit = org?.competitor_limit ?? 5
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: 'limit_reached', limit }, { status: 403 })
  }

  const body = await req.json() as { name: string; website: string }
  if (!body.name?.trim() || !body.website?.trim()) {
    return NextResponse.json({ error: 'name and website are required' }, { status: 400 })
  }

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({ org_id: membership.org_id, name: body.name.trim(), website: body.website.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(competitor, { status: 201 })
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ competitors: [] })

    // Step 1: flat competitor list (no nested joins)
    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('id, name, website, risk_score, created_at')
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const competitorIds = (competitors ?? []).map(c => c.id)
    if (!competitorIds.length) return NextResponse.json({ competitors: [] })

    // Step 2: tracked_page IDs for all competitors
    const { data: trackedPages } = await supabase
      .from('tracked_pages')
      .select('id, competitor_id')
      .in('competitor_id', competitorIds)

    const pageIdToCompId = new Map((trackedPages ?? []).map(p => [p.id, p.competitor_id]))
    const pageIds = (trackedPages ?? []).map(p => p.id)

    // Step 3: 30d changes for those pages only
    type ChangeRow = { tracked_page_id: string; ai_signal: string | null; theme: string | null; detected_at: string }
    let changes: ChangeRow[] = []
    if (pageIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('changes')
        .select('tracked_page_id, ai_signal, theme, detected_at')
        .in('tracked_page_id', pageIds)
        .gte('detected_at', thirtyDaysAgo)
        .order('detected_at', { ascending: false })
      changes = (data ?? []) as ChangeRow[]
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Group changes by competitor
    const changesByComp = new Map<string, ChangeRow[]>()
    for (const ch of changes) {
      const compId = pageIdToCompId.get(ch.tracked_page_id)
      if (!compId) continue
      if (!changesByComp.has(compId)) changesByComp.set(compId, [])
      changesByComp.get(compId)!.push(ch)
    }

    const enriched = (competitors ?? []).map(c => {
      const compChanges = changesByComp.get(c.id) ?? []
      const recentCount = compChanges.filter(ch => ch.detected_at >= sevenDaysAgo).length
      const lastSignal  = compChanges[0]?.detected_at ?? null
      const themes      = Array.from(new Set(compChanges.map(ch => ch.theme).filter(Boolean))).slice(0, 3)

      return {
        id:            c.id,
        name:          c.name,
        website:       c.website,
        risk_score:    c.risk_score,
        created_at:    c.created_at,
        signals_total: compChanges.length,
        signals_week:  recentCount,
        last_signal:   lastSignal,
        themes,
      }
    })

    return NextResponse.json({ competitors: enriched })
  } catch (err) {
    console.error('[GET /api/competitors]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
