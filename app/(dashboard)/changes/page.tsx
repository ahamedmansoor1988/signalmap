import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangesClient from '@/components/changes/changes-client'
import type { StructuredDiff } from '@/lib/extractor'
import type { Json } from '@/lib/supabase/types'

export const metadata = { title: 'Signal Inbox — SignalMap' }

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

  // Resolve org → competitor IDs → page IDs, then query changes directly
  const { data: orgCompetitors } = await supabase
    .from('competitors')
    .select('id')
    .eq('org_id', membership.org_id)

  const competitorIds = (orgCompetitors ?? []).map(c => c.id)

  const { data: orgPages } = await supabase
    .from('tracked_pages')
    .select('id, url, label, competitor_id, competitors(id, name, website)')
    .in('competitor_id', competitorIds)

  const pageIds = (orgPages ?? []).map(p => p.id)
  const pageMap = Object.fromEntries((orgPages ?? []).map(p => [p.id, p]))

  const { data: rawChanges } = await supabase
    .from('changes')
    .select('*')
    .in('tracked_page_id', pageIds)
    .order('detected_at', { ascending: false })
    .limit(100)

  // Attach tracked_pages (with competitor) to each change to match expected shape
  const changes = (rawChanges ?? []).map(c => ({
    ...c,
    tracked_pages: pageMap[c.tracked_page_id] ?? null,
  }))

  const safeChanges = changes

  // Fetch structured diffs from competitor_diffs for the same pages
  const diffPageIds = Array.from(new Set(safeChanges.map((c) => c.tracked_page_id)))
  const diffsMap = new Map<string, StructuredDiff>()

  if (diffPageIds.length) {
    const since = safeChanges.at(-1)?.detected_at ?? new Date(0).toISOString()
    const { data: diffs } = await supabase
      .from('competitor_diffs')
      .select('tracked_page_id, old_value, new_value, change_type, detected_at')
      .in('tracked_page_id', diffPageIds)
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

  // Mark all unseen changes as seen (fire-and-forget, don't block render)
  if (pageIds.length) {
    const now = new Date().toISOString()
    supabase
      .from('changes')
      .update({ seen_at: now })
      .in('tracked_page_id', pageIds)
      .is('seen_at', null)
      .then(() => {/* non-blocking */})
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-gray-900 text-xl font-semibold">Signal Inbox</h1>
          <p className="text-gray-500 text-sm mt-1">Every competitor move, detected and explained by AI</p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ChangesClient changes={changesWithDiff as any} />
      </div>
    </div>
  )
}
