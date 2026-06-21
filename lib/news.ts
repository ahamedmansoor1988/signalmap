export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
  pubDateMs: number
  snippet: string
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function parseRSSItems(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null

  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1]
    const title   = extractTag(block, 'title').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    const link    = extractTag(block, 'link') || extractTag(block, 'guid')
    const pubDate = extractTag(block, 'pubDate')
    const source  = extractTag(block, 'source') || extractTag(block, 'dc:source') || ''
    const desc    = extractTag(block, 'description')
    const snippet = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
    const pubDateMs = pubDate ? new Date(pubDate).getTime() : 0

    if (title && !isNaN(pubDateMs)) items.push({ title, link, source, pubDate, pubDateMs, snippet })
  }

  return items
}

async function fetchRSS(query: string, daysBack: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMap/1.0; +https://signalmap.app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const allItems = parseRSSItems(xml)
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000
    return allItems.filter(item => item.pubDateMs >= cutoff)
  } catch {
    return []
  }
}

export async function fetchCompetitorNews(
  competitorName: string,
  daysBack = 30
): Promise<NewsItem[]> {
  // Run multiple queries in parallel:
  // 1. Exact name match (e.g. "Intercom")
  // 2. Broad name match without quotes — catches product-level news (e.g. Fin acquired)
  // 3. High-signal terms tied to the competitor
  const [exact, broad, acquisition] = await Promise.all([
    fetchRSS(`"${competitorName}"`, daysBack),
    fetchRSS(`${competitorName} announcement OR acquired OR funding OR launch OR partnership`, daysBack),
    fetchRSS(`${competitorName} acquired OR acquires OR merger OR IPO`, daysBack),
  ])

  // Merge and deduplicate by link
  const seen = new Set<string>()
  const merged: NewsItem[] = []
  for (const item of [...exact, ...broad, ...acquisition]) {
    const key = item.link || item.title
    if (!seen.has(key)) { seen.add(key); merged.push(item) }
  }

  // Sort newest first
  return merged.sort((a, b) => b.pubDateMs - a.pubDateMs)
}
