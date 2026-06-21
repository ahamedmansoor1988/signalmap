import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractStructured, diffStructured } from '@/lib/structured-extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── CDX snapshot lookup ───────────────────────────────────────────────────────
// Returns the closest archived URL for a given URL on a specific calendar day.
// Uses CDX API (more reliable than availability API for specific dates).
async function fetchCDXSnapshot(
  url: string,
  daysAgo: number
): Promise<{ archiveUrl: string; isoDate: string } | null> {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const yyyymmdd = date.toISOString().replace(/\D/g, '').slice(0, 8)

  try {
    // CDX returns JSON array-of-arrays; first row is the header
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx` +
      `?url=${encodeURIComponent(url)}` +
      `&output=json&limit=1` +
      `&from=${yyyymmdd}&to=${yyyymmdd}235959` +
      `&fl=timestamp&filter=statuscode:200` +
      `&collapse=timestamp:8`

    const res = await fetch(cdxUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const rows = (await res.json()) as string[][]
    // rows[0] is header ["timestamp"], rows[1..] are data
    const data = rows.slice(1)
    if (!data.length || !data[0]?.[0]) return null

    const ts = data[0][0] // e.g. "20231115143200"
    return {
      archiveUrl: `https://web.archive.org/web/${ts}/${url}`,
      isoDate: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T12:00:00.000Z`,
    }
  } catch {
    return null
  }
}

// ── Dedup check ───────────────────────────────────────────────────────────────
// Returns true if a change already exists for this page on the same calendar day.
async function changeExistsForDate(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  trackedPageId: string,
  isoDate: string
): Promise<boolean> {
  const day = isoDate.slice(0, 10) // "2023-11-15"
  const { data } = await supabase
    .from('changes')
    .select('id')
    .eq('tracked_page_id', trackedPageId)
    .gte('detected_at', `${day}T00:00:00.000Z`)
    .lte('detected_at', `${day}T23:59:59.999Z`)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth
  const userSupabase = await createClient()
  let user = null
  try {
    const result = await userSupabase.auth.getUser()
    user = result.data?.user ?? null
  } catch {
    // auth service unavailable
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createServiceClient()

  // Verify competitor belongs to this org
  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website')
    .eq('id', params.id)
    .eq('org_id', membership.org_id)
    .maybeSingle()
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch tracked pages
  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, url, label')
    .eq('competitor_id', competitor.id)

  if (!pages?.length) {
    return NextResponse.json({
      competitor: competitor.name,
      message: 'No tracked pages found — run a sync first to discover pages',
      changes_inserted: 0,
    })
  }

  // Time points to backfill: pairs of (snapshotDaysAgo, detectedAtIsoDate)
  // We compare: (90d snapshot → 60d snapshot), (60d → 30d), (30d → now)
  const NOW_TEXT = 'now'
  type Checkpoint = { daysAgo: number | typeof NOW_TEXT; label: string }
  const CHECKPOINTS: Checkpoint[] = [
    { daysAgo: 90, label: '90d' },
    { daysAgo: 60, label: '60d' },
    { daysAgo: 30, label: '30d' },
    { daysAgo: NOW_TEXT, label: 'now' },
  ]

  const results: Array<{
    page: string
    pair: string
    status: string
    signal?: string
  }> = []
  let totalInserted = 0

  for (const page of pages.slice(0, 5)) {
    const pageLabel = page.label ?? 'home'

    // Fetch all snapshots for this page (CDX + live crawl) sequentially
    type Snap = { text: string; isoDate: string } | null
    const snapshots: Snap[] = []

    for (const cp of CHECKPOINTS) {
      try {
        if (cp.daysAgo === NOW_TEXT) {
          const crawl = await crawlPage(page.url)
          snapshots.push(
            crawl.text.length > 100
              ? { text: crawl.text, isoDate: new Date().toISOString() }
              : null
          )
        } else {
          const cdx = await fetchCDXSnapshot(page.url, cp.daysAgo)
          if (!cdx) {
            snapshots.push(null)
            continue
          }
          const crawl = await crawlPage(cdx.archiveUrl)
          snapshots.push(
            crawl.text.length > 100
              ? { text: crawl.text, isoDate: cdx.isoDate }
              : null
          )
        }
      } catch {
        snapshots.push(null)
      }
    }

    // Compare consecutive pairs: (0,1), (1,2), (2,3)
    for (let i = 0; i < CHECKPOINTS.length - 1; i++) {
      const before = snapshots[i]
      const after  = snapshots[i + 1]
      const pairLabel = `${CHECKPOINTS[i].label}→${CHECKPOINTS[i + 1].label}`

      if (!before || !after) {
        results.push({ page: pageLabel, pair: pairLabel, status: 'skipped_no_snapshot' })
        continue
      }

      // Dedup: skip if we already have a change for this page on this date
      const alreadyExists = await changeExistsForDate(supabase, page.id, after.isoDate)
      if (alreadyExists) {
        results.push({ page: pageLabel, pair: pairLabel, status: 'skipped_already_exists' })
        continue
      }

      try {
        const [beforeStructured, afterStructured] = await Promise.all([
          extractStructured(pageLabel, before.text.slice(0, 4000)),
          extractStructured(pageLabel, after.text.slice(0, 4000)),
        ])

        if (!beforeStructured || !afterStructured) {
          results.push({ page: pageLabel, pair: pairLabel, status: 'skipped_extraction_failed' })
          continue
        }

        const diff = await diffStructured(pageLabel, beforeStructured, afterStructured)

        if (!diff || diff.confidence < 30) {
          results.push({ page: pageLabel, pair: pairLabel, status: 'no_significant_change' })
          continue
        }

        await supabase.from('changes').insert({
          tracked_page_id: page.id,
          ai_summary: diff.summary,
          ai_signal: diff.signal,
          confidence: diff.confidence,
          risk_score: diff.risk_score,
          theme: diff.theme,
          impact_bullets: diff.impact_bullets,
          diff_html: JSON.stringify(diff.structural_changes),
          detected_at: after.isoDate,
        })

        totalInserted++
        results.push({
          page: pageLabel,
          pair: pairLabel,
          status: 'inserted',
          signal: diff.signal,
        })
      } catch (err) {
        results.push({
          page: pageLabel,
          pair: pairLabel,
          status: `error: ${String(err).slice(0, 80)}`,
        })
      }
    }
  }

  return NextResponse.json({
    competitor: competitor.name,
    pages_processed: pages.slice(0, 5).length,
    changes_inserted: totalInserted,
    results,
  })
}
