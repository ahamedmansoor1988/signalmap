import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'

export const runtime = 'nodejs'
export const maxDuration = 60

interface CrawlBody {
  tracked_page_id: string
}

export async function POST(req: NextRequest) {
  try {
    const { tracked_page_id } = (await req.json()) as CrawlBody
    if (!tracked_page_id) {
      return NextResponse.json({ error: 'tracked_page_id required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: page, error: pageErr } = await supabase
      .from('tracked_pages')
      .select('id, url, competitor_id')
      .eq('id', tracked_page_id)
      .single()

    if (pageErr || !page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const result = await crawlPage(page.url)

    // Store snapshot (text only — skip large HTML storage for now)
    const { data: snapshot, error: snapErr } = await supabase
      .from('page_snapshots')
      .insert({
        tracked_page_id: page.id,
        text_content: result.text,
        html_content: result.html.slice(0, 50000), // cap at 50KB
        crawled_at: result.crawledAt,
      })
      .select()
      .single()

    if (snapErr) throw snapErr

    // Update last_crawled_at on tracked_page
    await supabase
      .from('tracked_pages')
      .update({ last_crawled_at: result.crawledAt })
      .eq('id', page.id)

    // Check if there's a previous snapshot to diff against
    const { data: prevSnapshot } = await supabase
      .from('page_snapshots')
      .select('id, text_content')
      .eq('tracked_page_id', page.id)
      .neq('id', snapshot.id)
      .order('crawled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      snapshot_id: snapshot.id,
      has_previous: !!prevSnapshot,
      prev_snapshot_id: prevSnapshot?.id ?? null,
      text_length: result.text.length,
    })
  } catch (err) {
    console.error('[crawl]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
