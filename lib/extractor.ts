import { callClaudeJSON } from './ai'
import { EXTRACT_PAGE_SYSTEM } from './prompts/extract-page'

export type PageType = 'pricing' | 'homepage' | 'jobs' | 'changelog' | 'other'

export interface ParsedPage {
  page_type: PageType
  key_items: string[]
  summary: string
}

export interface PageDiff {
  added: string[]
  removed: string[]
}

export function detectPageType(url: string): PageType {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.includes('pric')) return 'pricing'
    if (path.includes('job') || path.includes('career') || path.includes('hire')) return 'jobs'
    if (path.includes('blog') || path.includes('changelog') || path.includes('update') || path.includes('release')) return 'changelog'
    if (path === '/' || path === '' || path === '/home') return 'homepage'
    return 'other'
  } catch {
    return 'other'
  }
}

export function changeTypeFromPageType(pageType: PageType): string {
  const map: Record<PageType, string> = {
    pricing: 'Pricing',
    homepage: 'Messaging',
    jobs: 'Hiring',
    changelog: 'Product',
    other: 'Product',
  }
  return map[pageType]
}

export function diffParsedPages(prev: ParsedPage, curr: ParsedPage): PageDiff | null {
  const prevSet = new Set(prev.key_items.map((s) => s.trim().toLowerCase()))
  const currSet = new Set(curr.key_items.map((s) => s.trim().toLowerCase()))

  const added = curr.key_items.filter((item) => !prevSet.has(item.trim().toLowerCase()))
  const removed = prev.key_items.filter((item) => !currSet.has(item.trim().toLowerCase()))

  if (added.length === 0 && removed.length === 0) return null
  return { added, removed }
}

export async function extractPageData(url: string, textContent: string): Promise<ParsedPage> {
  return callClaudeJSON<ParsedPage>(
    EXTRACT_PAGE_SYSTEM,
    `URL: ${url}\n\nPage content (first 3000 chars):\n${textContent.slice(0, 3000)}`
  )
}

export function calculateRiskScores(diffs: Array<{ change_type: string; detected_at: string }>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const recent = diffs.filter((d) => new Date(d.detected_at) >= thirtyDaysAgo)

  const productCount = recent.filter((d) => d.change_type === 'Product').length
  const messagingCount = recent.filter((d) => d.change_type === 'Messaging' || d.change_type === 'Pricing').length
  const hiringCount = recent.filter((d) => d.change_type === 'Hiring').length

  const product_velocity = Math.min(100, productCount * 18)
  const messaging_overlap = Math.min(100, messagingCount * 22)
  const market_reach = Math.min(100, hiringCount * 20)
  const total = Math.round((product_velocity + messaging_overlap + market_reach) / 3)

  return { product_velocity, messaging_overlap, market_reach, total }
}
