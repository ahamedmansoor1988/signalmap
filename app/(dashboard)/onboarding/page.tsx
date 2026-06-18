import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './onboarding-client'

export const metadata = { title: 'Get Started — SignalMap' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get or create org — use service client to bypass RLS on insert
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let orgId: string

  if (!membership) {
    const service = await createServiceClient()
    const slug = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-org'
    const { data: newOrg } = await service
      .from('organizations')
      .insert({ name: 'My Organization', slug: `${slug}-${Date.now()}` })
      .select()
      .single()

    if (!newOrg) redirect('/settings')

    await service.from('org_members').insert({ org_id: newOrg.id, user_id: user.id, role: 'admin' })
    orgId = newOrg.id
  } else {
    orgId = membership.org_id
  }

  // If they already have competitors, skip onboarding
  const { count } = await supabase
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (count && count > 0) redirect('/map')

  return <OnboardingClient orgId={orgId} />
}
