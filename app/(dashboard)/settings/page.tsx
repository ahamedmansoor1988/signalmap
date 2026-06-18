import { createClient } from '@/lib/supabase/server'
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
    // First-time user: auto-create a personal org
    const slug = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') ?? 'my-org'
    const { data: newOrg } = await supabase
      .from('organizations')
      .insert({ name: 'My Organization', slug: `${slug}-${Date.now()}` })
      .select()
      .single()

    if (!newOrg) {
      return <div className="p-8 text-red-400">Failed to create organization. Check Supabase keys.</div>
    }

    await supabase.from('org_members').insert({ org_id: newOrg.id, user_id: user.id, role: 'admin' })
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
          <h1 className="text-white text-xl font-semibold">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage competitors and tracked pages</p>
        </div>

        {/* Add Competitor */}
        <section className="mb-8">
          <h2 className="text-white text-sm font-semibold mb-4">Add Competitor</h2>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <AddCompetitorForm orgId={orgId} />
          </div>
        </section>

        {/* Competitor List */}
        <section>
          <h2 className="text-white text-sm font-semibold mb-4">
            Tracked Competitors
            {competitors?.length ? (
              <span className="ml-2 text-zinc-600 font-normal">({competitors.length})</span>
            ) : null}
          </h2>
          <CompetitorList competitors={competitors ?? []} />
        </section>
      </div>
    </div>
  )
}
