export type CrawlTier = 'changelog' | 'pricing' | 'jobs' | 'homepage'

const INTERVALS_MS: Record<CrawlTier, number> = {
  changelog: 2  * 60 * 60 * 1000,  // 2h  — catch announcements fast
  pricing:   6  * 60 * 60 * 1000,  // 6h  — prices change with campaigns
  jobs:      12 * 60 * 60 * 1000,  // 12h — twice daily
  homepage:  24 * 60 * 60 * 1000,  // 24h — messaging rarely changes intraday
}

export function getCrawlTier(url: string): CrawlTier {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.includes('blog') || path.includes('changelog') ||
        path.includes('update') || path.includes('release') ||
        path.includes('news')) return 'changelog'
    if (path.includes('pric')) return 'pricing'
    if (path.includes('job') || path.includes('career') ||
        path.includes('hire')) return 'jobs'
  } catch {
    // malformed URL — fall through to homepage default
  }
  return 'homepage'
}

export function shouldCrawlNow(lastCrawledAt: string | null, url: string): boolean {
  if (!lastCrawledAt) return true
  const tier = getCrawlTier(url)
  return Date.now() - new Date(lastCrawledAt).getTime() >= INTERVALS_MS[tier]
}

export function nextCrawlIn(lastCrawledAt: string | null, url: string): string {
  if (!lastCrawledAt) return 'now'
  const tier = getCrawlTier(url)
  const msUntil = INTERVALS_MS[tier] - (Date.now() - new Date(lastCrawledAt).getTime())
  if (msUntil <= 0) return 'now'
  const h = Math.floor(msUntil / 3600000)
  const m = Math.floor((msUntil % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
