import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { crawlPage } from '@/lib/crawler'
import { extractPageData } from '@/lib/extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

export interface ScanPage {
  url: string
  label: string | null
  page_type: string
  key_items: string[]
  summary: string
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServiceClient()

  const { data: pages } = await supabase
    .from('tracked_pages')
    .select('id, url, label')
    .eq('competitor_id', params.id)
    .limit(2)

  if (!pages?.length) {
    return NextResponse.json({ error: 'No tracked pages found' }, { status: 404 })
  }

  const scannedAt = new Date().toISOString()

  const results: ScanPage[] = await Promise.all(
    pages.map(async (page) => {
      try {
        const crawled = await crawlPage(page.url)
        const parsed = await extractPageData(page.url, crawled.text)

        // Stamp last_crawled_at so the cron frequency filter won't double-crawl
        // within this page's tier interval (minimum 2h for changelog)
        await supabase
          .from('tracked_pages')
          .update({ last_crawled_at: scannedAt })
          .eq('id', page.id)

        return {
          url: page.url,
          label: page.label,
          page_type: parsed.page_type,
          key_items: parsed.key_items,
          summary: parsed.summary,
        }
      } catch (err) {
        return {
          url: page.url,
          label: page.label,
          page_type: 'error',
          key_items: [],
          summary: String(err),
        }
      }
    })
  )

  return NextResponse.json({ pages: results, scannedAt })
}
