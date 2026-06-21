import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    let user = null
    try {
      const result = await supabase.auth.getUser()
      user = result.data?.user ?? null
    } catch { /* auth unavailable */ }
    if (!user) return NextResponse.json({ activity: [] }, { status: 401 })

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ activity: [] }, { status: 403 })

    const { data: ownerCheck } = await supabase
      .from('competitors')
      .select('id')
      .eq('id', params.id)
      .eq('org_id', membership.org_id)
      .maybeSingle()
    if (!ownerCheck) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: pages } = await supabase
      .from('tracked_pages')
      .select('id')
      .eq('competitor_id', params.id)

    const pageIds = (pages ?? []).map(p => p.id)
    if (!pageIds.length) return NextResponse.json({ activity: [] })

    const { data, error } = await supabase
      .from('changes')
      .select('id, ai_signal, theme, detected_at')
      .in('tracked_page_id', pageIds)
      .order('detected_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('[activity]', error)
      return NextResponse.json({ activity: [] })
    }

    return NextResponse.json({ activity: data ?? [] })
  } catch (err) {
    console.error('[activity] unexpected error', err)
    return NextResponse.json({ activity: [] })
  }
}
