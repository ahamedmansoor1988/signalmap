export interface CrawlResult {
  url: string
  html: string
  text: string
  crawledAt: string
}

// Strips HTML tags, collapses whitespace, returns readable text
function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function crawlPage(url: string): Promise<CrawlResult> {
  // Try Playwright first (works locally); fall back to fetch for serverless
  try {
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const html = await page.content()
    await browser.close()
    return {
      url,
      html,
      text: extractText(html),
      crawledAt: new Date().toISOString(),
    }
  } catch {
    // Playwright not available — fall back to fetch
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SignalMap/1.0 competitive-intelligence-bot' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const html = await res.text()
    return {
      url,
      html,
      text: extractText(html),
      crawledAt: new Date().toISOString(),
    }
  }
}
