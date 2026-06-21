import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function JoinOrganizationPage({ params }: { params: { token: string } }) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${params.token}`)}`)

  const admin = await createServiceClient()
  const { data: invite } = await admin.from('organization_invites').select('*')
    .eq('token', params.token).is('accepted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()

  if (!invite) return <Message title="Invite unavailable" detail="This invite is invalid, expired or already used." />
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return <Message title="Wrong account" detail={`Sign in as ${invite.email} to accept this invitation.`} />
  }

  const { data: existing } = await admin.from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (existing && existing.org_id !== invite.org_id) {
    return <Message title="Account already belongs to an organization" detail="Use a new work account or ask support to move this account." />
  }

  if (!existing) await admin.from('org_members').insert({ org_id: invite.org_id, user_id: user.id, role: invite.role })
  await admin.from('member_preferences').upsert({
    user_id: user.id, org_id: invite.org_id, display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
  }, { onConflict: 'user_id' })
  await admin.from('organization_invites').update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq('id', invite.id)
  redirect('/actions')
}

function Message({ title, detail }: { title: string; detail: string }) {
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md text-center shadow-sm">
    <h1 className="text-lg font-semibold text-gray-900">{title}</h1><p className="text-sm text-gray-500 mt-2">{detail}</p>
  </div></div>
}
