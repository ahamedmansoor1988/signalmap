import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH — update name + role
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { full_name?: string; role_view?: string }

  // Update auth metadata (display name)
  if (body.full_name !== undefined) {
    const { error } = await supabase.auth.updateUser({ data: { full_name: body.full_name } })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update member_preferences (display_name + role_view)
  const { data: membership } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()

  if (membership) {
    const prefPatch: Record<string, string> = {}
    if (body.full_name !== undefined) prefPatch.display_name = body.full_name
    if (body.role_view !== undefined) prefPatch.role_view = body.role_view

    if (Object.keys(prefPatch).length > 0) {
      await supabase.from('member_preferences').upsert({
        user_id: user.id,
        org_id: membership.org_id,
        ...prefPatch,
      }, { onConflict: 'user_id' })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE — delete account (requires service role)
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  // Remove from org_members first (RLS won't let user delete themselves)
  await service.from('org_members').delete().eq('user_id', user.id)
  await service.from('member_preferences').delete().eq('user_id', user.id)

  // Delete auth user
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
