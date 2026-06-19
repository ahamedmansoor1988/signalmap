import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { computeDiff } from '@/lib/diff'
import { callClaudeJSON } from '@/lib/ai'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts/summarize'
import { extractPageData, diffParsedPages, changeTypeFromPageType, calculateRiskScores } from '@/lib/extractor'
import { getCrawlTier, shouldCrawlNow } from '@/lib/crawl-schedule'
import { sendDigest } from '@/lib/digest'
import { generateWeeklyBrief } from '@/lib/weekly-brief'
import { generateTypedActions } from '@/lib/personalized-actions'
import type { Database } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const maxDuration = 300

type CompanyProfile = Database['public']['Tables']['company_profiles']['Row']

interface SummarizeResult {
  summary: string
  signal: string
  confidence: number
  risk_score: number
  theme: string
  impact_bullets: string[]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const results: Array<{ page_id: string; url: string; tier: string; status: string; change_id?: string }> = []
  const today = new Date().toISOString().split('T')[0]

  // Fetch all tracked pages — filter by frequency tier in JS rather than SQL
  // (URL-pattern-based intervals can't be expressed as a single WHERE clause)
  const { data: allPages } = await supabase
    .from('tracked_pages')
    .select('id, url, competitor_id, last_crawled_at')
    .order('last_crawled_at', { ascending: true, nullsFirst: true })

  if (!allPages?.length) {
    return NextResponse.json({ message: 'No pages to crawl', results })
  }

  // Only crawl pages whose frequency interval has elapsed since last crawl
  const pages = allPages
    .filter((p) => shouldCrawlNow(p.last_crawled_at, p.url))
    .slice(0, 20)

  if (!pages.length) {
    return NextResponse.json({
      message: 'All pages crawled recently — nothing due yet',
      total: allPages.length,
      skipped: allPages.length,
      results,
    })
  }

  // Pre-fetch competitor metadata and company profiles for personalized actions
  const uniqueCompetitorIds = Array.from(new Set(pages.map((p) => p.competitor_id)))
  const { data: competitorMeta } = await supabase
    .from('competitors')
    .select('id, name, org_id')
    .in('id', uniqueCompetitorIds)

  const competitorMap: Record<string, { name: string; org_id: string }> = Object.fromEntries(
    (competitorMeta ?? []).map((c) => [c.id, { name: c.name, org_id: c.org_id }])
  )

  const uniqueOrgIds = Array.from(new Set(Object.values(competitorMap).map((c) => c.org_id)))
  const { data: profileRows } = await supabase
    .from('company_profiles')
    .select('*')
    .in('org_id', uniqueOrgIds)

  const profileByOrg: Record<string, CompanyProfile> = Object.fromEntries(
    (profileRows ?? []).map((p) => [p.org_id, p])
  )

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (const page of pages) {
    await sleep(2000) // 2s between pages to stay under Groq 12k TPM limit
    const tier = getCrawlTier(page.url)
    try {
      const crawled = await crawlPage(page.url)

      // 1. Store raw snapshot (existing)
      const { data: newSnap } = await supabase
        .from('page_snapshots')
        .insert({
          tracked_page_id: page.id,
          text_content: crawled.text,
          html_content: crawled.html.slice(0, 50000),
          crawled_at: crawled.crawledAt,
        })
        .select()
        .single()

      if (!newSnap) {
        results.push({ page_id: page.id, url: page.url, tier, status: 'snapshot_failed' })
        continue
      }

      await supabase
        .from('tracked_pages')
        .update({ last_crawled_at: crawled.crawledAt })
        .eq('id', page.id)

      // 2. Classic text diff — check for changes before spending AI tokens
      const { data: prevSnap } = await supabase
        .from('page_snapshots')
        .select('id, text_content')
        .eq('tracked_page_id', page.id)
        .neq('id', newSnap.id)
        .order('crawled_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!prevSnap?.text_content) {
        // First snapshot — store structured extraction as baseline, no diff yet
        const parsed = await extractPageData(page.url, crawled.text)
        await supabase
          .from('competitor_snapshots')
          .upsert({
            competitor_id: page.competitor_id,
            tracked_page_id: page.id,
            snapshot_date: today,
            page_type: parsed.page_type,
            raw_text: crawled.text.slice(0, 10000),
            parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
          }, { onConflict: 'tracked_page_id,snapshot_date' })
        results.push({ page_id: page.id, url: page.url, tier, status: 'first_snapshot' })
        continue
      }

      const textDiff = computeDiff(prevSnap.text_content, crawled.text)
      if (!textDiff.hasChanges) {
        // If this page has never had a structured snapshot, extract baseline now (one-time cost)
        const { data: existingSnapshot } = await supabase
          .from('competitor_snapshots')
          .select('id')
          .eq('tracked_page_id', page.id)
          .limit(1)
          .maybeSingle()

        if (!existingSnapshot) {
          const parsed = await extractPageData(page.url, crawled.text)
          await supabase
            .from('competitor_snapshots')
            .upsert({
              competitor_id: page.competitor_id,
              tracked_page_id: page.id,
              snapshot_date: today,
              page_type: parsed.page_type,
              raw_text: crawled.text.slice(0, 10000),
              parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
            }, { onConflict: 'tracked_page_id,snapshot_date' })
        }

        results.push({ page_id: page.id, url: page.url, tier, status: 'no_changes' })
        continue
      }

      // 3. Changes detected — extract structured data + compare with yesterday
      const parsed = await extractPageData(page.url, crawled.text)
      await supabase
        .from('competitor_snapshots')
        .upsert({
          competitor_id: page.competitor_id,
          tracked_page_id: page.id,
          snapshot_date: today,
          page_type: parsed.page_type,
          raw_text: crawled.text.slice(0, 10000),
          parsed_data: parsed as unknown as import('@/lib/supabase/types').Json,
        }, { onConflict: 'tracked_page_id,snapshot_date' })

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const { data: prevSnapshot } = await supabase
        .from('competitor_snapshots')
        .select('parsed_data')
        .eq('tracked_page_id', page.id)
        .eq('snapshot_date', yesterday)
        .maybeSingle()

      if (prevSnapshot?.parsed_data) {
        const diff = diffParsedPages(
          prevSnapshot.parsed_data as unknown as typeof parsed,
          parsed
        )
        if (diff && (diff.added.length > 0 || diff.removed.length > 0)) {
          const summaryLines = [
            diff.added.length > 0 ? `Added: ${diff.added.slice(0, 3).join(' · ')}` : '',
            diff.removed.length > 0 ? `Removed: ${diff.removed.slice(0, 3).join(' · ')}` : '',
          ].filter(Boolean).join(' | ')

          await supabase.from('competitor_diffs').insert({
            competitor_id: page.competitor_id,
            tracked_page_id: page.id,
            change_type: changeTypeFromPageType(parsed.page_type),
            summary: summaryLines || parsed.summary,
            old_value: { key_items: (prevSnapshot.parsed_data as unknown as typeof parsed).key_items },
            new_value: { key_items: parsed.key_items },
          })
        }
      }

      // 4. AI summary of the text diff
      const diffSummary = [
        `REMOVED:\n${textDiff.removedLines.slice(0, 20).map((l) => `- ${l}`).join('\n')}`,
        `ADDED:\n${textDiff.addedLines.slice(0, 20).map((l) => `+ ${l}`).join('\n')}`,
      ].join('\n\n')

      const ai = await callClaudeJSON<SummarizeResult>(SUMMARIZE_SYSTEM, diffSummary, 1024)

      // 5. Personalized actions using company profile context
      const comp = competitorMap[page.competitor_id]
      const profile = comp?.org_id ? (profileByOrg[comp.org_id] ?? null) : null
      const typedActions = await generateTypedActions(
        profile,
        comp?.name ?? 'Competitor',
        diffSummary
      )

      const { data: change } = await supabase
        .from('changes')
        .insert({
          tracked_page_id: page.id,
          before_snapshot_id: prevSnap.id,
          after_snapshot_id: newSnap.id,
          diff_html: textDiff.diffHtml,
          ai_summary: ai.summary,
          ai_signal: ai.signal,
          confidence: ai.confidence,
          risk_score: ai.risk_score,
          theme: ai.theme,
          impact_bullets: ai.impact_bullets,
          suggested_actions: typedActions as unknown as import('@/lib/supabase/types').Json,
        })
        .select()
        .single()

      await supabase
        .from('competitors')
        .update({ risk_score: ai.risk_score })
        .eq('id', page.competitor_id)

      results.push({ page_id: page.id, url: page.url, tier, status: 'change_detected', change_id: change?.id })
    } catch (err) {
      results.push({ page_id: page.id, url: page.url, tier, status: `error: ${String(err)}` })
    }
  }

  // 5. Update risk_score_history for all affected competitors
  const competitorIds = Array.from(new Set(pages.map((p) => p.competitor_id)))
  for (const competitorId of competitorIds) {
    try {
      const { data: allDiffs } = await supabase
        .from('competitor_diffs')
        .select('change_type, detected_at')
        .eq('competitor_id', competitorId)

      if (allDiffs) {
        const scores = calculateRiskScores(allDiffs)
        await supabase
          .from('risk_score_history')
          .upsert({
            competitor_id: competitorId,
            scored_at: today,
            ...scores,
          }, { onConflict: 'competitor_id,scored_at' })

        if (scores.total > 0) {
          await supabase
            .from('competitors')
            .update({ risk_score: scores.total })
            .eq('id', competitorId)
        }
      }
    } catch {
      // non-fatal
    }
  }

  // Send daily digest if there were any detected changes
  let digest: { sent: boolean; count?: number; reason?: string } = { sent: false, reason: 'skipped' }
  const hasChanges = results.some((r) => r.status === 'change_detected')
  if (hasChanges) {
    try {
      digest = await sendDigest()
    } catch {
      digest = { sent: false, reason: 'digest_error' }
    }
  }

  // Generate weekly brief on Mondays (day 1)
  let brief: { sent: boolean; orgs?: number; reason?: string } = { sent: false, reason: 'not_monday' }
  if (new Date().getDay() === 1) {
    try {
      brief = await generateWeeklyBrief()
    } catch {
      brief = { sent: false, reason: 'brief_error' }
    }
  }

  return NextResponse.json({
    crawled: pages.length,
    skipped: allPages.length - pages.length,
    results,
    digest,
    brief,
  })
}
