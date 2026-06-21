import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: membership } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).maybeSingle()
  if (!membership || membership.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { email?: string; role?: string }
  const email = body.email?.trim().toLowerCase() ?? ''
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })

  const { data, error } = await supabase.from('organization_invites').insert({
    org_id: membership.org_id, email, role: body.role === 'admin' ? 'admin' : 'member', invited_by: user.id,
  }).select('token, email, role, expires_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invite: data })
}
