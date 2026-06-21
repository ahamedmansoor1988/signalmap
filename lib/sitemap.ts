export interface SitemapUrl {
  loc: string
  lastmod?: string
  priority?: number
}

// Page types we care about tracking — ordered by strategic importance
const STRATEGIC_PATTERNS: Array<{ pattern: RegExp; label: string; priority: number }> = [
  { pattern: /\/(pricing|plans?|price|packages?)/i,   label: 'Pricing',   priority: 10 },
  { pattern: /\/(product|features?|platform|solutions?)/i, label: 'Product', priority: 9 },
  { pattern: /\/(changelog|releases?|updates?|whats-new)/i, label: 'Changelog', priority: 8 },
  { pattern: /\/(enterprise|business|teams?)/i,        label: 'Enterprise', priority: 7 },
  { pattern: /\/(newsroom|press|about\/press)/i,       label: 'Newsroom',  priority: 6 },
  { pattern: /\/(blog|insights?|resources?)/i,         label: 'Blog',      priority: 5 },
  { pattern: /\/(integrations?|apps?|marketplace)/i,   label: 'Integrations', priority: 4 },
  { pattern: /\/(customers?|case-studies?|stories)/i,  label: 'Customers', priority: 3 },
]

function parseSitemapXml(xml: string): string[] {
  const urls: string[] = []
  const locRegex = /<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = locRegex.exec(xml)) !== null) {
    urls.push(m[1].trim())
  }
  return urls
}

async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 2) return []
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMap/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()

    // Sitemap index — recurse into child sitemaps
    if (xml.includes('<sitemapindex')) {
      const childSitemaps = parseSitemapXml(xml)
      // Only recurse into likely-relevant sitemaps
      const relevant = childSitemaps.filter(u =>
        /pricing|product|blog|changelog|enterprise|press/i.test(u)
      ).slice(0, 5)
      const nested = await Promise.all(relevant.map(u => fetchSitemapUrls(u, depth + 1)))
      return nested.flat()
    }

    return parseSitemapXml(xml)
  } catch {
    return []
  }
}

export interface StrategicPage {
  url: string
  label: string
  priority: number
}

export async function discoverStrategicPages(baseUrl: string): Promise<StrategicPage[]> {
  const base = baseUrl.replace(/\/$/, '')

  // Try common sitemap locations
  const sitemapCandidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-index.xml`,
  ]

  let allUrls: string[] = []
  for (const candidate of sitemapCandidates) {
    const urls = await fetchSitemapUrls(candidate)
    if (urls.length > 0) { allUrls = urls; break }
  }

  if (allUrls.length === 0) return []

  // Filter to same domain only
  const hostname = new URL(base).hostname
  const sameOrigin = allUrls.filter(u => {
    try { return new URL(u).hostname === hostname } catch { return false }
  })

  // Score each URL against strategic patterns
  const scored: StrategicPage[] = []
  const seenLabels = new Map<string, number>() // label → count

  for (const url of sameOrigin) {
    const path = new URL(url).pathname
    for (const { pattern, label, priority } of STRATEGIC_PATTERNS) {
      if (pattern.test(path)) {
        const count = seenLabels.get(label) ?? 0
        // Allow up to 3 pages per label (e.g. pricing/gmail, pricing/omni, pricing/enterprise)
        if (count < 3) {
          scored.push({ url, label: count === 0 ? label : `${label} ${count + 1}`, priority })
          seenLabels.set(label, count + 1)
        }
        break
      }
    }
  }

  // Sort by priority desc, deduplicate
  return scored.sort((a, b) => b.priority - a.priority).slice(0, 15)
}
