import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompanyProfileForm from '@/components/settings/company-profile-form'
import PersonalPreferencesForm from '@/components/settings/personal-preferences-form'
import OrganizationPlanCard from '@/components/settings/organization-plan-card'
import TeamAccess from '@/components/settings/team-access'

export const metadata = { title: 'Settings — SignalMap' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name, slug)')
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
      console.error('[settings] org create failed:', orgErr)
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

  const [{ data: competitors }, { data: companyProfile }, { data: preferences }, { data: organization }] = await Promise.all([
    supabase
      .from('competitors')
      .select('*, tracked_pages(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('company_profiles')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase.from('member_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('organizations').select('plan, competitor_limit').eq('id', orgId).single(),
  ])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-gray-900 text-xl font-semibold">Settings</h1>
            <p className="text-gray-500 text-sm mt-1">Manage competitors and tracked pages</p>
          </div>
          <a
            href="/onboarding"
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-50 transition-all"
          >
            ✦ Re-run setup
          </a>
        </div>

        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-1">Team Access</h2>
          <p className="text-gray-400 text-xs mb-4">Give every teammate an owned queue and private notifications</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <TeamAccess isAdmin={!membership || membership.role === 'admin'} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-1">My Workspace</h2>
          <p className="text-gray-400 text-xs mb-4">Your role lens, action reminders and private notification rules</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <PersonalPreferencesForm initial={preferences ?? {}} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-4">Organization Usage</h2>
          <OrganizationPlanCard plan={organization?.plan ?? 'starter'} used={competitors?.length ?? 0} limit={organization?.competitor_limit ?? 15} />
        </section>

        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-1">Company Profile</h2>
          <p className="text-gray-400 text-xs mb-4">Used to personalise AI analysis and suggested actions</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <CompanyProfileForm initialProfile={companyProfile ?? null} />
          </div>
        </section>

      </div>
    </div>
  )
}
