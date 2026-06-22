export interface RSSItem {
  title: string
  link: string
  pubDate: string
  summary: string
}

function extractText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return ''
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=['"]([^'"]+)['"][^>]*>`, 'i')
  const m = xml.match(re)
  return m ? m[1] : ''
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString()
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export function isFeedUrl(url: string): boolean {
  return /\.(xml|rss|atom)($|\?)/i.test(url) ||
    /\/(rss|feed|atom)(\/|$|\?)/i.test(url)
}

export async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SignalMap/1.0 RSS Reader',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) return []

    const xml = await res.text()
    if (!xml.includes('<')) return []

    const isAtom = xml.includes('<feed') && xml.includes('<entry')
    const itemTag = isAtom ? 'entry' : 'item'

    const itemRe = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, 'gi')
    const rawItems = xml.match(itemRe) ?? []

    return rawItems
      .slice(0, 10)
      .map(item => {
        const title = extractText(item, 'title') || 'Untitled'

        let link = isAtom
          ? extractAttr(item, 'link', 'href') || extractText(item, 'link')
          : extractText(item, 'link') || extractAttr(item, 'link', 'href')

        if (!link) link = extractText(item, 'guid')

        const pubDateRaw = isAtom
          ? extractText(item, 'published') || extractText(item, 'updated')
          : extractText(item, 'pubDate') || extractText(item, 'dc:date')

        const summary =
          extractText(item, 'content:encoded') ||
          extractText(item, 'description') ||
          extractText(item, 'summary') ||
          extractText(item, 'content')

        return {
          title,
          link,
          pubDate: parseDate(pubDateRaw),
          summary: summary.slice(0, 500),
        }
      })
      .filter(item => item.link)
  } catch {
    return []
  }
}
