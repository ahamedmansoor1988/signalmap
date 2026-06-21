import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ActionQueue from '@/components/actions/action-queue'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Actions — SignalMap' }

export default async function ActionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: membership } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/onboarding')

  const [{ data: tasks }, { data: people }, { data: preferences }] = await Promise.all([
    supabase.from('action_tasks').select('*').eq('org_id', membership.org_id).order('created_at', { ascending: false }),
    supabase.from('member_preferences').select('user_id, display_name, role_view').eq('org_id', membership.org_id),
    supabase.from('member_preferences').select('role_view').eq('user_id', user.id).maybeSingle(),
  ])

  return <div className="h-full overflow-y-auto"><div className="max-w-3xl mx-auto px-6 py-8">
    <div className="mb-6"><h1 className="text-gray-900 text-xl font-semibold">My Actions</h1>
      <p className="text-gray-500 text-sm mt-1">Turn competitive signals into owned, trackable work</p></div>
    <ActionQueue initialTasks={tasks ?? []} people={people ?? []} userId={user.id} defaultRole={preferences?.role_view ?? 'all'} />
  </div></div>
}
