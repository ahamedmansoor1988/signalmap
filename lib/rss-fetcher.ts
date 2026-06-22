export interface RSSItem {
  title: string
  link: string
  pubDate: string
  summary: string
  source: 'google_news' | 'blog_rss'
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return m?.[1]?.trim() ?? ''
}

function parseItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = []
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml)) !== null && items.length < 10) {
    const b = m[1]
    items.push({
      title:       extractTag(b, 'title'),
      link:        extractTag(b, 'link') || extractTag(b, 'guid'),
      pubDate:     extractTag(b, 'pubDate') || extractTag(b, 'published') || new Date().toISOString(),
      description: extractTag(b, 'description') || extractTag(b, 'summary'),
    })
  }
  return items
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function fetchGoogleNews(competitorName: string): Promise<RSSItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(competitorName)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseItems(xml)
      .filter(i => i.title && i.link)
      .map(i => ({
        title:   i.title,
        link:    i.link,
        pubDate: (() => { try { return new Date(i.pubDate).toISOString() } catch { return new Date().toISOString() } })(),
        summary: i.description.replace(/<[^>]+>/g, '').slice(0, 400),
        source:  'google_news' as const,
      }))
  } catch { return [] }
}

export async function fetchBlogRSS(website: string | null | undefined): Promise<RSSItem[]> {
  if (!website) return []
  const base = website.replace(/\/$/, '')
  const candidates = [
    `${base}/blog/rss.xml`,
    `${base}/blog/feed.xml`,
    `${base}/feed.xml`,
    `${base}/rss.xml`,
    `${base}/blog/feed`,
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml.includes('<item')) continue
      const items = parseItems(xml).filter(i => i.title && i.link)
      if (!items.length) continue
      return items.map(i => ({
        title:   i.title,
        link:    i.link,
        pubDate: (() => { try { return new Date(i.pubDate).toISOString() } catch { return new Date().toISOString() } })(),
        summary: i.description.replace(/<[^>]+>/g, '').slice(0, 400),
        source:  'blog_rss' as const,
      }))
    } catch { continue }
  }
  return []
}
