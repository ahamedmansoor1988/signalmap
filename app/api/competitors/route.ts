import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('id, name, website, risk_score, created_at')
      .eq('org_id', membership.org_id)
      .order('risk_score', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ competitors })
  } catch (err) {
    console.error('[GET /api/competitors]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
