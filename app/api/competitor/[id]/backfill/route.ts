import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractStructured, diffStructured } from '@/lib/structured-extractor'

export const runtime = 'nodejs'
export const maxDuration = 55

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
  req: NextRequest,
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
      total_pages: 0,
      page_index: 0,
      done: true,
      changes_inserted: 0,
      results: [],
    })
  }

  // Process ONE page per call to stay within Vercel's 60s timeout.
  // Client calls this sequentially with page_index=0,1,2,...
  const pageIndex = parseInt(req.nextUrl.searchParams.get('page_index') ?? '0', 10)
  const totalPages = Math.min(pages.length, 5)
  const page = pages[pageIndex]

  if (!page || pageIndex >= totalPages) {
    return NextResponse.json({
      competitor: competitor.name,
      total_pages: totalPages,
      page_index: pageIndex,
      done: true,
      changes_inserted: 0,
      results: [],
    })
  }

  const pageLabel = page.label ?? 'home'
  const results: Array<{ page: string; pair: string; status: string; signal?: string }> = []
  let totalInserted = 0

  // Only compare 30d→now: most useful, fastest (1 CDX + 2 crawls + 2 AI calls)
  const cdx = await fetchCDXSnapshot(page.url, 30).catch(() => null)

  if (!cdx) {
    results.push({ page: pageLabel, pair: '30d→now', status: 'skipped_no_snapshot' })
  } else {
    const alreadyExists = await changeExistsForDate(supabase, page.id, cdx.isoDate)
    if (alreadyExists) {
      results.push({ page: pageLabel, pair: '30d→now', status: 'skipped_already_exists' })
    } else {
      try {
        const [beforeCrawl, afterCrawl] = await Promise.all([
          crawlPage(cdx.archiveUrl),
          crawlPage(page.url),
        ])

        if (beforeCrawl.text.length < 100 || afterCrawl.text.length < 100) {
          results.push({ page: pageLabel, pair: '30d→now', status: 'skipped_crawl_empty' })
        } else {
          const [beforeStructured, afterStructured] = await Promise.all([
            extractStructured(pageLabel, beforeCrawl.text.slice(0, 4000)),
            extractStructured(pageLabel, afterCrawl.text.slice(0, 4000)),
          ])

          if (!beforeStructured || !afterStructured) {
            results.push({ page: pageLabel, pair: '30d→now', status: 'skipped_extraction_failed' })
          } else {
            const diff = await diffStructured(pageLabel, beforeStructured, afterStructured)
            if (!diff || diff.confidence < 30) {
              results.push({ page: pageLabel, pair: '30d→now', status: 'no_significant_change' })
            } else {
              await supabase.from('changes').insert({
                tracked_page_id: page.id,
                ai_summary: diff.summary,
                ai_signal: diff.signal,
                confidence: diff.confidence,
                risk_score: diff.risk_score,
                theme: diff.theme,
                impact_bullets: diff.impact_bullets,
                diff_html: JSON.stringify(diff.structural_changes),
                detected_at: cdx.isoDate,
              })
              totalInserted++
              results.push({ page: pageLabel, pair: '30d→now', status: 'inserted', signal: diff.signal })
            }
          }
        }
      } catch (err) {
        results.push({ page: pageLabel, pair: '30d→now', status: `error: ${String(err).slice(0, 80)}` })
      }
    }
  }

  return NextResponse.json({
    competitor: competitor.name,
    total_pages: totalPages,
    page_index: pageIndex,
    done: pageIndex >= totalPages - 1,
    changes_inserted: totalInserted,
    results,
  })
}
