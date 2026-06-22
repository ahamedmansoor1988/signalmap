import type { PipelineItem, PipelineCompetitor } from './types'
import { UA, safeIso } from './types'
import { parseItems } from '@/lib/rss-fetcher'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchProductHunt(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  try {
    const res = await fetch('https://www.producthunt.com/feed?category=all', {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const nameLC = competitor.name.toLowerCase()

    // Also try website domain as keyword
    let domainKW = ''
    if (competitor.website) {
      try { domainKW = new URL(competitor.website).hostname.replace(/^www\./, '') } catch { /* ignore */ }
    }

    return parseItems(xml)
      .filter(i => {
        const combined = `${i.title} ${i.description}`.toLowerCase()
        return combined.includes(nameLC) || (domainKW && combined.includes(domainKW))
      })
      .filter(i => i.title && i.link && !existingUrls.has(i.link))
      .slice(0, 5)
      .map(i => ({
        title: i.title,
        summary: stripHtml(i.description).slice(0, 400),
        url: i.link,
        source_type: 'product_hunt',
        published_at: safeIso(i.pubDate),
      }))
  } catch { return [] }
}
