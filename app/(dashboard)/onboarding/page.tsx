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
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let orgId: string

  if (!membership) {
    const slug = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-org'
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: 'My Organization', slug: `${slug}-${Date.now()}` })
      .select()
      .single()

    if (!newOrg) {
      console.error('[onboarding] org create failed:', orgErr)
      return (
        <div className="p-8">
          <p className="text-red-600 font-medium">Failed to create organization.</p>
          <pre className="mt-2 text-xs text-red-400 bg-red-50 p-3 rounded-lg">{JSON.stringify(orgErr, null, 2)}</pre>
        </div>
      )
    }

    await supabase.from('org_members').insert({ org_id: newOrg.id, user_id: user.id, role: 'admin' })
    orgId = newOrg.id
  } else {
    orgId = membership.org_id
  }

  const { count } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (count && count > 0) redirect('/map')

  return <OnboardingClient orgId={orgId} />
}
