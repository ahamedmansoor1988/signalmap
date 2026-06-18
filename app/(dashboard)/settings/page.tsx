import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddCompetitorForm from '@/components/competitor/add-competitor-form'
import CompetitorList from '@/components/competitor/competitor-list'

export const metadata = { title: 'Settings — SignalMap' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get or create org for this user
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, organizations(id, name, slug)')
    .eq('user_id', user.id)
    .maybeSingle()

  let orgId: string

  if (!membership) {
    // First-time user: auto-create a personal org (service role bypasses RLS)
    const service = await createServiceClient()
    const slug = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-org'
    const { data: newOrg, error: orgErr } = await service
      .from('organizations')
      .insert({ name: 'My Organization', slug: `${slug}-${Date.now()}` })
      .select()
      .single()

    if (!newOrg) {
      console.error('[settings] org create failed:', orgErr)
      return (
        <div className="p-8">
          <p className="text-red-600 font-medium">Failed to create organization.</p>
          <pre className="mt-2 text-xs text-red-400 bg-red-50 p-3 rounded-lg">{JSON.stringify(orgErr, null, 2)}</pre>
        </div>
      )
    }

    const { error: memberErr } = await service.from('org_members').insert({ org_id: newOrg.id, user_id: user.id, role: 'admin' })
    if (memberErr) console.error('[settings] member insert failed:', memberErr)
    orgId = newOrg.id
  } else {
    orgId = membership.org_id
  }

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*, tracked_pages(*)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-gray-900 text-xl font-semibold">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage competitors and tracked pages</p>
        </div>

        {/* Add Competitor */}
        <section className="mb-8">
          <h2 className="text-gray-900 text-sm font-semibold mb-4">Add Competitor</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <AddCompetitorForm orgId={orgId} />
          </div>
        </section>

        {/* Competitor List */}
        <section>
          <h2 className="text-gray-900 text-sm font-semibold mb-4">
            Tracked Competitors
            {competitors?.length ? (
              <span className="ml-2 text-gray-400 font-normal">({competitors.length})</span>
            ) : null}
          </h2>
          <CompetitorList competitors={competitors ?? []} />
        </section>
      </div>
    </div>
  )
}
