// Playwright-based crawler — Sprint 2
// Crawls tracked pages, stores snapshots in Supabase Storage

export interface CrawlResult {
  url: string
  html: string
  text: string
  crawledAt: string
}

export async function crawlPage(_url: string): Promise<CrawlResult> {
  throw new Error('Crawler not yet implemented — coming in Sprint 2')
}
