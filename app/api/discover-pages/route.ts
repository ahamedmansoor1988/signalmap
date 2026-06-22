import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const BLOG_PATHS = ['/blog', '/changelog', '/updates', '/news', '/releases']
const JOBS_PATHS = ['/careers', '/jobs', '/about/careers', '/about/jobs']

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalMap/1.0; +https://signalmap-sigma.vercel.app)' },
    })
    clearTimeout(id)
    return res.ok
  } catch {
    return false
  }
}

function labelFromPath(path: string): string {
  const segment = path.replace(/^\//, '').split('/')[0]
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

function normalizeBase(website: string): string {
  let base = website.trim().replace(/\/$/, '')
  if (!base.startsWith('http')) base = `https://${base}`
  return base
}

interface DiscoverResult {
  competitor: string
  type: 'blog' | 'jobs'
  url: string
  status: 'added' | 'exists' | 'not_found'
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, website')

  if (!competitors?.length) {
    return NextResponse.json({ error: 'No competitors found' }, { status: 404 })
  }

  const { data: existingPages } = await supabase
    .from('tracked_pages')
    .select('url, competitor_id')

  const existingUrls = new Set(existingPages?.map((p) => p.url) ?? [])

  // Track which types are already covered per competitor
  const coveredBlog = new Set(
    existingPages
      ?.filter((p) => BLOG_PATHS.some((path) => p.url.includes(path)))
      .map((p) => p.competitor_id) ?? []
  )
  const coveredJobs = new Set(
    existingPages
      ?.filter((p) => JOBS_PATHS.some((path) => p.url.includes(path)))
      .map((p) => p.competitor_id) ?? []
  )

  const results: DiscoverResult[] = []

  for (const competitor of competitors) {
    if (!competitor.website) continue
    const base = normalizeBase(competitor.website)

    // --- Blog / Changelog ---
    if (coveredBlog.has(competitor.id)) {
      const existing = existingPages?.find(
        (p) => p.competitor_id === competitor.id && BLOG_PATHS.some((path) => p.url.includes(path))
      )
      results.push({ competitor: competitor.name, type: 'blog', url: existing?.url ?? '', status: 'exists' })
    } else {
      let found = false
      for (const path of BLOG_PATHS) {
        const url = `${base}${path}`
        if (existingUrls.has(url)) {
          results.push({ competitor: competitor.name, type: 'blog', url, status: 'exists' })
          found = true
          break
        }
        const ok = await probeUrl(url)
        if (ok) {
          await supabase.from('tracked_pages').insert({
            competitor_id: competitor.id,
            url,
            label: labelFromPath(path),
          })
          existingUrls.add(url)
          results.push({ competitor: competitor.name, type: 'blog', url, status: 'added' })
          found = true
          break
        }
      }
      if (!found) {
        results.push({ competitor: competitor.name, type: 'blog', url: `${base}/blog`, status: 'not_found' })
      }
    }

    // --- Jobs / Careers ---
    if (coveredJobs.has(competitor.id)) {
      const existing = existingPages?.find(
        (p) => p.competitor_id === competitor.id && JOBS_PATHS.some((path) => p.url.includes(path))
      )
      results.push({ competitor: competitor.name, type: 'jobs', url: existing?.url ?? '', status: 'exists' })
    } else {
      let found = false
      for (const path of JOBS_PATHS) {
        const url = `${base}${path}`
        if (existingUrls.has(url)) {
          results.push({ competitor: competitor.name, type: 'jobs', url, status: 'exists' })
          found = true
          break
        }
        const ok = await probeUrl(url)
        if (ok) {
          await supabase.from('tracked_pages').insert({
            competitor_id: competitor.id,
            url,
            label: labelFromPath(path),
          })
          existingUrls.add(url)
          results.push({ competitor: competitor.name, type: 'jobs', url, status: 'added' })
          found = true
          break
        }
      }
      if (!found) {
        results.push({ competitor: competitor.name, type: 'jobs', url: `${base}/careers`, status: 'not_found' })
      }
    }
  }

  const added = results.filter((r) => r.status === 'added').length
  const existed = results.filter((r) => r.status === 'exists').length
  const notFound = results.filter((r) => r.status === 'not_found').length

  return NextResponse.json({ added, existed, not_found: notFound, results })
}
