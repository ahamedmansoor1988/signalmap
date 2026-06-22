import type { PipelineItem, PipelineCompetitor } from './types'
import { UA, safeIso } from './types'

const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/i

function extractHeadlinesFromHtml(html: string, baseUrl: string): PipelineItem[] {
  const items: PipelineItem[] = []
  // Match h1/h2/h3 tags + look for a date pattern nearby
  const headingRe = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
  let m
  while ((m = headingRe.exec(html)) !== null && items.length < 5) {
    const raw = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!raw || raw.length < 15 || raw.length > 200) continue
    // Look for a date in the surrounding 500 chars
    const surrounding = html.slice(Math.max(0, m.index - 100), m.index + m[0].length + 400)
    const dateMatch = surrounding.match(DATE_RE)
    const published_at = dateMatch ? safeIso(dateMatch[0]) : new Date().toISOString()
    // Skip if older than 60 days (stale press)
    if (Date.now() - new Date(published_at).getTime() > 60 * 24 * 60 * 60 * 1000) continue

    // Find a link near this heading
    const linkMatch = surrounding.match(/href="([^"]+)"/)
    const url = linkMatch
      ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `${new URL(baseUrl).origin}${linkMatch[1]}`)
      : baseUrl

    items.push({
      title: raw,
      summary: raw,
      url,
      source_type: 'press',
      published_at,
    })
  }
  return items
}

async function tryCrawl(url: string): Promise<PipelineItem[]> {
  try {
    // Use plain fetch with short timeout (crawlPage may launch Playwright)
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const html = await res.text()
    return extractHeadlinesFromHtml(html, url)
  } catch { return [] }
}

export async function fetchPress(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  if (!competitor.website) return []
  const base = competitor.website.replace(/\/$/, '')
  const urls = [`${base}/press`, `${base}/newsroom`, `${base}/press-releases`]
  const results = await Promise.all(urls.map(tryCrawl))
  return results.flat()
    .filter(i => i.title && !existingUrls.has(i.url))
    .slice(0, 5)
}
