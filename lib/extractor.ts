import { callClaudeJSON } from './ai'
import {
  EXTRACT_PRICING_SYSTEM,
  EXTRACT_HOMEPAGE_SYSTEM,
  EXTRACT_BLOG_SYSTEM,
  EXTRACT_JOBS_SYSTEM,
  EXTRACT_GENERIC_SYSTEM,
} from './prompts/extract-page'

// ── Page types ────────────────────────────────────────────────────────────────

export type PageType = 'pricing' | 'homepage' | 'jobs' | 'changelog' | 'other'

export interface PricingPlan {
  name: string
  price: string
  billing: string
  features: string[]
  cta: string
  highlighted: boolean
}

export interface PricingPage {
  page_type: 'pricing'
  plans: PricingPlan[]
  pricing_model: string
  free_tier: boolean
  enterprise_option: boolean
  key_items: string[]
  summary: string
}

export interface HomepagePage {
  page_type: 'homepage'
  hero_headline: string
  hero_subheadline: string
  primary_cta: string
  target_customer: string
  key_themes: string[]
  social_proof: string
  key_items: string[]
  summary: string
}

export interface BlogPost {
  title: string
  url: string
  published_date: string
  topic_category: string
}

export interface BlogPage {
  page_type: 'changelog'
  new_posts: BlogPost[]
  key_items: string[]
  summary: string
}

export interface GenericPage {
  page_type: 'jobs' | 'other'
  key_items: string[]
  summary: string
}

export type ParsedPage = PricingPage | HomepagePage | BlogPage | GenericPage

// ── Structured diff types ─────────────────────────────────────────────────────

export interface PlanChange {
  name: string
  status: 'added' | 'removed' | 'changed' | 'unchanged'
  before?: PricingPlan
  after?: PricingPlan
}

export interface FieldChange {
  field: string
  label: string
  before: string
  after: string
}

export interface StructuredDiff {
  page_type: PageType
  added: string[]
  removed: string[]
  // Pricing-specific
  plan_changes?: PlanChange[]
  // Homepage-specific
  field_changes?: FieldChange[]
  // Blog/changelog-specific
  new_posts?: BlogPost[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Extract internal links from HTML for blog post URL detection
function extractBlogLinks(html: string, pageUrl: string): string {
  const linkPattern = /<a[^>]+href="([^"#?]+)"[^>]*>([^<]{10,})<\/a>/gi
  const seen = new Set<string>()
  const lines: string[] = []
  let match

  try {
    const baseOrigin = new URL(pageUrl).origin
    const basePath = new URL(pageUrl).pathname

    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1].trim()
      const text = match[2].replace(/<[^>]+>/g, '').trim()
      if (!text || seen.has(href)) continue

      // Only include links that look like blog post paths (contain basePath)
      const isInternal = !href.startsWith('http') || href.startsWith(baseOrigin)
      const looksLikeBlogPost = href.includes(basePath) || href.startsWith(basePath)

      if (isInternal && looksLikeBlogPost) {
        const fullUrl = href.startsWith('http') ? href : `${baseOrigin}${href}`
        lines.push(`"${text}" → ${fullUrl}`)
        seen.add(href)
      }
      if (lines.length >= 20) break
    }
  } catch {
    // non-fatal
  }

  return lines.join('\n')
}

// ── Main extractor ────────────────────────────────────────────────────────────

export async function extractPageData(
  url: string,
  textContent: string,
  htmlContent?: string
): Promise<ParsedPage> {
  const pageType = detectPageType(url)

  // Larger char budget for pages where content is buried deep
  const charBudget = pageType === 'pricing' ? 8000 : pageType === 'changelog' ? 5000 : 3500
  const truncatedText = textContent.slice(0, charBudget)

  let extraContext = ''
  if (pageType === 'changelog' && htmlContent) {
    const links = extractBlogLinks(htmlContent, url)
    if (links) extraContext = `\n\nInternal blog links found:\n${links}`
  }

  const userPrompt = `URL: ${url}\n\nPage content:\n${truncatedText}${extraContext}`

  if (pageType === 'pricing') {
    return callClaudeJSON<PricingPage>(EXTRACT_PRICING_SYSTEM, userPrompt, 1200)
  }
  if (pageType === 'homepage') {
    return callClaudeJSON<HomepagePage>(EXTRACT_HOMEPAGE_SYSTEM, userPrompt, 800)
  }
  if (pageType === 'changelog') {
    return callClaudeJSON<BlogPage>(EXTRACT_BLOG_SYSTEM, userPrompt, 1200)
  }
  if (pageType === 'jobs') {
    return callClaudeJSON<GenericPage>(EXTRACT_JOBS_SYSTEM, userPrompt, 600)
  }
  return callClaudeJSON<GenericPage>(EXTRACT_GENERIC_SYSTEM, userPrompt, 600)
}

// ── Structured diff ───────────────────────────────────────────────────────────

export function diffParsedPages(prev: ParsedPage, curr: ParsedPage): StructuredDiff | null {
  const pageType = curr.page_type

  if (pageType === 'pricing' && prev.page_type === 'pricing') {
    return diffPricing(prev as PricingPage, curr as PricingPage)
  }
  if (pageType === 'homepage' && prev.page_type === 'homepage') {
    return diffHomepage(prev as HomepagePage, curr as HomepagePage)
  }
  if (pageType === 'changelog' && prev.page_type === 'changelog') {
    return diffBlog(prev as BlogPage, curr as BlogPage)
  }

  // Fallback: flat key_items diff
  return diffGeneric(prev, curr, pageType)
}

function diffPricing(prev: PricingPage, curr: PricingPage): StructuredDiff | null {
  const plan_changes: PlanChange[] = []
  const added: string[] = []
  const removed: string[] = []

  const prevByName = new Map(prev.plans.map((p) => [p.name.toLowerCase(), p]))
  const currByName = new Map(curr.plans.map((p) => [p.name.toLowerCase(), p]))

  // Plans in current
  for (const [key, plan] of Array.from(currByName.entries())) {
    const oldPlan = prevByName.get(key)
    if (!oldPlan) {
      plan_changes.push({ name: plan.name, status: 'added', after: plan })
      added.push(`${plan.name}: ${plan.price}`)
    } else {
      const priceChanged = oldPlan.price !== plan.price
      const featuresChanged = JSON.stringify(oldPlan.features) !== JSON.stringify(plan.features)
      if (priceChanged || featuresChanged) {
        plan_changes.push({ name: plan.name, status: 'changed', before: oldPlan, after: plan })
        if (priceChanged) added.push(`${plan.name}: ${plan.price} (was ${oldPlan.price})`)
      } else {
        plan_changes.push({ name: plan.name, status: 'unchanged', before: oldPlan, after: plan })
      }
    }
  }

  // Plans removed
  for (const [key, plan] of Array.from(prevByName.entries())) {
    if (!currByName.has(key)) {
      plan_changes.push({ name: plan.name, status: 'removed', before: plan })
      removed.push(`${plan.name} plan removed`)
    }
  }

  const hasChanges = plan_changes.some((p) => p.status !== 'unchanged')
  if (!hasChanges) return null

  return { page_type: 'pricing', added, removed, plan_changes }
}

function diffHomepage(prev: HomepagePage, curr: HomepagePage): StructuredDiff | null {
  const FIELDS: Array<{ key: keyof HomepagePage; label: string }> = [
    { key: 'hero_headline',    label: 'Hero Headline' },
    { key: 'hero_subheadline', label: 'Subheadline' },
    { key: 'primary_cta',     label: 'Primary CTA' },
    { key: 'target_customer', label: 'Target Customer' },
    { key: 'social_proof',    label: 'Social Proof' },
  ]

  const field_changes: FieldChange[] = []
  const added: string[] = []
  const removed: string[] = []

  for (const { key, label } of FIELDS) {
    const before = String(prev[key] ?? '')
    const after = String(curr[key] ?? '')
    if (before !== after) {
      field_changes.push({ field: key, label, before, after })
      added.push(`${label}: ${after}`)
      if (before) removed.push(`${label}: ${before}`)
    }
  }

  // key_themes diff (array)
  const prevThemes = new Set(prev.key_themes ?? [])
  const currThemes = new Set(curr.key_themes ?? [])
  for (const t of Array.from(currThemes)) {
    if (!prevThemes.has(t)) added.push(`New theme: ${t}`)
  }
  for (const t of Array.from(prevThemes)) {
    if (!currThemes.has(t)) removed.push(`Removed theme: ${t}`)
  }

  if (!field_changes.length && added.length === 0 && removed.length === 0) return null
  return { page_type: 'homepage', added, removed, field_changes }
}

function diffBlog(prev: BlogPage, curr: BlogPage): StructuredDiff | null {
  const prevTitles = new Set((prev.new_posts ?? []).map((p) => p.title.toLowerCase()))
  const newPosts = (curr.new_posts ?? []).filter(
    (p) => !prevTitles.has(p.title.toLowerCase())
  )

  if (!newPosts.length) return null

  const added = newPosts.map((p) => p.title)
  return { page_type: 'changelog', added, removed: [], new_posts: newPosts }
}

function diffGeneric(prev: ParsedPage, curr: ParsedPage, pageType: PageType): StructuredDiff | null {
  const prevSet = new Set((prev.key_items ?? []).map((s) => s.trim().toLowerCase()))
  const currSet = new Set((curr.key_items ?? []).map((s) => s.trim().toLowerCase()))

  const added = (curr.key_items ?? []).filter((item) => !prevSet.has(item.trim().toLowerCase()))
  const removed = (prev.key_items ?? []).filter((item) => !currSet.has(item.trim().toLowerCase()))

  if (!added.length && !removed.length) return null
  return { page_type: pageType, added, removed }
}

// ── Risk scores ───────────────────────────────────────────────────────────────

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
