import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangesClient from '@/components/changes/changes-client'
import type { StructuredDiff } from '@/lib/extractor'
import type { Json } from '@/lib/supabase/types'

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
        competitors!inner(id, name, org_id, website)
      )
    `)
    .eq('tracked_pages.competitors.org_id', membership.org_id)
    .order('detected_at', { ascending: false })
    .limit(50)

  const safeChanges = changes ?? []

  // Fetch structured diffs from competitor_diffs for the same pages
  const pageIds = Array.from(new Set(safeChanges.map((c) => c.tracked_page_id)))
  const diffsMap = new Map<string, StructuredDiff>()

  if (pageIds.length) {
    const since = safeChanges.at(-1)?.detected_at ?? new Date(0).toISOString()
    const { data: diffs } = await supabase
      .from('competitor_diffs')
      .select('tracked_page_id, old_value, new_value, change_type, detected_at')
      .in('tracked_page_id', pageIds)
      .gte('detected_at', since)
      .order('detected_at', { ascending: false })

    // Match each diff to the closest change by (tracked_page_id, detected_at)
    for (const change of safeChanges) {
      const candidates = (diffs ?? []).filter((d) => d.tracked_page_id === change.tracked_page_id)
      if (!candidates.length) continue

      // Pick the candidate whose detected_at is within 10 minutes of the change
      const changeTs = new Date(change.detected_at).getTime()
      const match = candidates.find((d) => {
        const dt = Math.abs(new Date(d.detected_at).getTime() - changeTs)
        return dt < 10 * 60 * 1000
      })

      if (match?.old_value && match?.new_value) {
        const { diffParsedPages } = await import('@/lib/extractor')
        const sd = diffParsedPages(
          match.old_value as unknown as Parameters<typeof diffParsedPages>[0],
          match.new_value as unknown as Parameters<typeof diffParsedPages>[1]
        )
        if (sd) diffsMap.set(change.id, sd)
      }
    }
  }

  // Attach structured_diff to each change
  const changesWithDiff = safeChanges.map((c) => ({
    ...c,
    structured_diff: (diffsMap.get(c.id) ?? null) as Json | null,
  }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-gray-900 text-xl font-semibold">Change Explorer</h1>
          <p className="text-gray-500 text-sm mt-1">Every detected competitor move, explained by AI</p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ChangesClient changes={changesWithDiff as any} />
      </div>
    </div>
  )
}
