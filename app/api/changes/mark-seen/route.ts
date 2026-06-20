import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ ok: false }, { status: 403 })

  const supabase = await createServiceClient()

  const { data: orgCompetitors } = await supabase
    .from('competitors')
    .select('id')
    .eq('org_id', membership.org_id)

  const competitorIds = (orgCompetitors ?? []).map(c => c.id)
  if (!competitorIds.length) return NextResponse.json({ ok: true, marked: 0 })

  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id')
    .in('competitor_id', competitorIds)

  const pageIds = (pages ?? []).map(p => p.id)
  if (!pageIds.length) return NextResponse.json({ ok: true, marked: 0 })

  const now = new Date().toISOString()
  await supabase
    .from('changes')
    .update({ seen_at: now })
    .in('tracked_page_id', pageIds)
    .is('seen_at', null)

  return NextResponse.json({ ok: true })
}
