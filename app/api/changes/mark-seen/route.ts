import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const supabase = userSupabase

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

  const { data: changes } = await supabase.from('changes').select('id')
    .in('tracked_page_id', pageIds)

  if (changes?.length) {
    await supabase.from('signal_reads').upsert(
      changes.map(change => ({ user_id: user.id, change_id: change.id })),
      { onConflict: 'user_id,change_id' }
    )
  }

  return NextResponse.json({ ok: true, marked: changes?.length ?? 0 })
}
