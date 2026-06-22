import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './onboarding-client'

export const metadata = { title: 'Get Started — SignalMap' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, organizations!inner(plan)')
    .eq('user_id', user.id)
    .maybeSingle()

  let orgId: string

  if (!membership) {
    const slug = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-org'
    const { data: newOrgId, error: orgErr } = await supabase.rpc('create_user_org', {
      p_user_id: user.id,
      p_name: 'My Organization',
      p_slug: `${slug}-${Date.now()}`,
    })

    if (orgErr || !newOrgId) {
      console.error('[onboarding] org create failed:', orgErr)
      return (
        <div className="p-8">
          <p className="text-red-600 font-medium">Failed to create organization.</p>
          <pre className="mt-2 text-xs text-red-400 bg-red-50 p-3 rounded-lg">{JSON.stringify(orgErr, null, 2)}</pre>
        </div>
      )
    }

    orgId = newOrgId as string
  } else {
    orgId = membership.org_id
  }

  const { data: existingCompetitors } = await supabase
    .from('competitors')
    .select('id')
    .eq('org_id', orgId)

  const existingCount = existingCompetitors?.length ?? 0
  const plan = (membership?.organizations as { plan?: string } | null)?.plan ?? 'starter'

  return <OnboardingClient orgId={orgId} existingCount={existingCount} plan={plan} />
}
