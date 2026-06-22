import type { PipelineItem, PipelineCompetitor } from './types'
import { UA, safeIso } from './types'
import { parseItems } from '@/lib/rss-fetcher'

const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/i

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractHtmlChangelogs(html: string, baseUrl: string): PipelineItem[] {
  const items: PipelineItem[] = []
  // Find headings with adjacent date patterns
  const blockRe = /<(?:h[1-4]|article|section|li)[^>]*>([\s\S]*?)<\/(?:h[1-4]|article|section|li)>/gi
  let m
  while ((m = blockRe.exec(html)) !== null && items.length < 5) {
    const block = m[0]
    const text = stripHtml(block).trim()
    if (text.length < 10 || text.length > 500) continue
    const dateMatch = text.match(DATE_RE)
    if (!dateMatch) continue
    const title = text.replace(DATE_RE, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!title) continue
    items.push({
      title,
      summary: text.slice(0, 400),
      url: baseUrl,
      source_type: 'changelog',
      published_at: safeIso(dateMatch[0]),
    })
  }
  return items
}

async function tryUrl(url: string): Promise<PipelineItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const text = await res.text()

    if (text.includes('<item') || text.includes('<?xml')) {
      const parsed = parseItems(text)
        .filter(i => i.title && i.link)
        .slice(0, 5)
        .map(i => ({
          title: i.title,
          summary: stripHtml(i.description).slice(0, 400),
          url: i.link,
          source_type: 'changelog',
          published_at: safeIso(i.pubDate),
        }))
      return parsed
    }
    return extractHtmlChangelogs(text, url)
  } catch { return [] }
}

export async function fetchChangelog(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  if (!competitor.website) return []
  const base = competitor.website.replace(/\/$/, '')
  const urls = [
    `${base}/changelog`,
    `${base}/changelog/rss.xml`,
    `${base}/changelog/feed`,
    `${base}/releases`,
  ]
  const results = await Promise.all(urls.map(tryUrl))
  return results.flat()
    .filter(i => i.title && i.url && !existingUrls.has(i.url))
    .slice(0, 5)
}
