import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROLE_VIEWS = ['all', 'sales', 'marketing', 'product', 'leadership'] as const
const DIGESTS = ['daily', 'weekly', 'off'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const { data } = await supabase
    .from('member_preferences').select('*').eq('user_id', user.id).maybeSingle()

  return NextResponse.json({
    preferences: data ?? {
      user_id: user.id,
      org_id: membership.org_id,
      display_name: user.email?.split('@')[0] ?? null,
      role_view: 'all',
      browser_notifications: true,
      action_notifications: true,
      digest_frequency: 'weekly',
      minimum_risk: 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>
  const roleView = ROLE_VIEWS.includes(body.role_view as typeof ROLE_VIEWS[number])
    ? body.role_view as typeof ROLE_VIEWS[number] : 'all'
  const digestFrequency = DIGESTS.includes(body.digest_frequency as typeof DIGESTS[number])
    ? body.digest_frequency as typeof DIGESTS[number] : 'weekly'
  const minimumRisk = Math.max(0, Math.min(100, Number(body.minimum_risk) || 0))

  const { data, error } = await supabase.from('member_preferences').upsert({
    user_id: user.id,
    org_id: membership.org_id,
    display_name: typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 80) : null,
    role_view: roleView,
    browser_notifications: body.browser_notifications !== false,
    action_notifications: body.action_notifications !== false,
    digest_frequency: digestFrequency,
    minimum_risk: minimumRisk,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferences: data })
}
