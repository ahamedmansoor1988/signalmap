import { NextResponse } from 'next/server'
import { fetchGoogleNews, fetchBlogRSS } from '@/lib/rss-fetcher'
import { fetchChangelog } from '@/lib/pipeline/changelog'
import { fetchPress } from '@/lib/pipeline/press'
import { fetchGitHub } from '@/lib/pipeline/github'
import { fetchProductHunt } from '@/lib/pipeline/producthunt'
import { fetchJobs } from '@/lib/pipeline/jobs'
import { fetchAppStore } from '@/lib/pipeline/appstore'
import type { PipelineItem } from '@/lib/pipeline/types'

export const runtime = 'nodejs'
export const maxDuration = 55

const TEST_COMPETITOR = {
  id: 'qc-test',
  name: 'Intercom',
  website: 'https://www.intercom.com',
}

const NOISE_WORDS = ['front office', 'military', 'sports', 'nba', 'nfl', 'baseball', 'hockey', 'soccer']
const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

type QCStatus = 'pass' | 'fail' | 'empty'

type QCResult = {
  source: string
  status: QCStatus
  itemCount: number
  sample: { title: string; url: string; published_at: string } | null
  error: string | null
}

function validate(source: string, items: PipelineItem[]): QCResult {
  if (!items.length) {
    return { source, status: 'empty', itemCount: 0, sample: null, error: null }
  }

  for (const item of items) {
    if (!item.title?.trim()) {
      return { source, status: 'fail', itemCount: items.length, sample: null, error: 'Item has empty title' }
    }
    if (!item.url?.startsWith('http')) {
      return { source, status: 'fail', itemCount: items.length, sample: { title: item.title, url: item.url, published_at: item.published_at }, error: `URL does not start with http: ${item.url}` }
    }
    if (new Date(item.published_at) < THIRTY_DAYS_AGO) {
      return { source, status: 'fail', itemCount: items.length, sample: { title: item.title, url: item.url, published_at: item.published_at }, error: `Stale data — published_at ${item.published_at} is older than 30 days` }
    }
  }

  // Noise check for google_news
  if (source === 'google_news') {
    const noiseCount = items.filter(i => {
      const combined = `${i.title} ${i.summary}`.toLowerCase()
      return NOISE_WORDS.some(w => combined.includes(w))
    }).length
    if (noiseCount / items.length > 0.5) {
      return {
        source, status: 'fail', itemCount: items.length,
        sample: { title: items[0].title, url: items[0].url, published_at: items[0].published_at },
        error: `>50% noise words found — competitor name may be too generic`,
      }
    }
  }

  const first = items[0]
  return {
    source,
    status: 'pass',
    itemCount: items.length,
    sample: { title: first.title, url: first.url, published_at: first.published_at },
    error: null,
  }
}

async function runWithTimeout<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs = 10000
): Promise<{ name: string; result: T | null; error: string | null }> {
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    return { name, result, error: null }
  } catch (e) {
    return { name, result: fallback, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET() {
  const empty = new Set<string>()
  const c = TEST_COMPETITOR

  const [
    googleRes, blogRes, changelogRes, pressRes,
    githubRes, phRes, jobsRes, appstoreRes,
  ] = await Promise.all([
    runWithTimeout('google_news', () => fetchGoogleNews(c.name, c.website).then(items => items.map(i => ({ title: i.title, summary: i.summary, url: i.link, source_type: i.source, published_at: i.pubDate }))), []),
    runWithTimeout('blog_rss',   () => fetchBlogRSS(c.website).then(items => items.map(i => ({ title: i.title, summary: i.summary, url: i.link, source_type: i.source, published_at: i.pubDate }))), []),
    runWithTimeout('changelog',  () => fetchChangelog(c, empty), []),
    runWithTimeout('press',      () => fetchPress(c, empty), []),
    runWithTimeout('github',     () => fetchGitHub(c, empty), []),
    runWithTimeout('product_hunt', () => fetchProductHunt(c, empty), []),
    runWithTimeout('job_postings', () => fetchJobs(c, empty), []),
    runWithTimeout('app_store',  () => fetchAppStore(c, empty), []),
  ])

  const results: QCResult[] = [
    googleRes, blogRes, changelogRes, pressRes,
    githubRes, phRes, jobsRes, appstoreRes,
  ].map(r => {
    const items = (r.result ?? []) as PipelineItem[]
    const qc = validate(r.name, items)
    if (r.error && qc.status !== 'fail') {
      return { ...qc, status: 'fail' as QCStatus, error: r.error.includes('timeout') ? 'timeout' : `error: ${r.error}` }
    }
    return qc
  })

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length

  return NextResponse.json({ passCount, failCount, results })
}
