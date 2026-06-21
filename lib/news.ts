export interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
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
    // Strip HTML tags from description
    const snippet = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)

    if (title) items.push({ title, link, source, pubDate, snippet })
  }

  return items
}

export async function fetchCompetitorNews(
  competitorName: string,
  daysBack = 30
): Promise<NewsItem[]> {
  // Search Google News RSS for the competitor by name
  const query = `"${competitorName}"`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMap/1.0; +https://signalmap.app)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []

    const xml = await res.text()
    const allItems = parseRSSItems(xml)

    // Filter to items within daysBack
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000
    return allItems.filter(item => {
      const d = new Date(item.pubDate).getTime()
      return !isNaN(d) && d >= cutoff
    })
  } catch {
    return []
  }
}
