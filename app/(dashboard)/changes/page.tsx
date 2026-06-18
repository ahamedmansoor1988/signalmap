import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangeCard from '@/components/changes/change-card'
import { GitCompare } from 'lucide-react'

export const metadata = { title: 'Change Explorer — SignalMap' }

export default async function ChangesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-sm">Set up your organization in Settings first.</p>
      </div>
    )
  }

  const { data: changes } = await supabase
    .from('changes')
    .select(`
      *,
      tracked_pages(
        url, label,
        competitors!inner(id, name, org_id)
      )
    `)
    .eq('tracked_pages.competitors.org_id', membership.org_id)
    .order('detected_at', { ascending: false })
    .limit(50)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-gray-900 text-xl font-semibold">Change Explorer</h1>
          <p className="text-gray-500 text-sm mt-1">Every detected competitor move, explained by AI</p>
        </div>

        {!changes?.length ? (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-xl">
            <GitCompare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No changes detected yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Add competitors in Settings, then the cron job will detect changes automatically
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {changes.map((c) => <ChangeCard key={c.id} change={c as any} />)}
          </div>
        )}
      </div>
    </div>
  )
}
