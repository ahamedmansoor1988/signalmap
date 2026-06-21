import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/profile/profile-client'

export const metadata = { title: 'Profile — SignalMap' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(name, plan, competitor_limit)')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: preferences } = await supabase
    .from('member_preferences')
    .select('display_name, role_view')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', membership?.org_id ?? '')

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? '',
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? '',
      }}
      preferences={preferences ?? { display_name: null, role_view: 'all' }}
      plan={(membership?.organizations as { plan?: string } | null)?.plan ?? 'starter'}
      competitorLimit={(membership?.organizations as { competitor_limit?: number } | null)?.competitor_limit ?? 5}
      competitorsUsed={competitors?.length ?? 0}
      orgRole={membership?.role ?? 'member'}
    />
  )
}
