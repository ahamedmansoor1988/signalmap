import type { PipelineItem, PipelineCompetitor } from './types'
import { UA } from './types'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function extractJobTitles(html: string): string[] {
  const titles: string[] = []
  const re = /<h[34][^>]*class="[^"]*(?:job|role|position|title)[^"]*"[^>]*>([\s\S]*?)<\/h[34]>|<(?:h[34]|div|li)[^>]*>([\s\S]{10,80}?)<\/(?:h[34]|div|li)>/gi
  let m
  while ((m = re.exec(html)) !== null && titles.length < 30) {
    const raw = (m[1] ?? m[2] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (raw.length >= 8 && raw.length <= 80 && /[a-zA-Z]/.test(raw)) {
      titles.push(raw)
    }
  }
  return Array.from(new Set(titles))
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

export async function fetchJobs(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  if (!competitor.website) return []
  const base = competitor.website.replace(/\/$/, '')
  const slug = slugify(competitor.name)

  const urls = [
    `${base}/jobs`,
    `${base}/careers`,
    `${base}/about/jobs`,
    `https://jobs.lever.co/${slug}`,
    `https://boards.greenhouse.io/${slug}`,
  ]

  const htmlResults = await Promise.all(urls.map(tryFetch))

  let allJobs: string[] = []
  for (const html of htmlResults) {
    if (!html) continue
    allJobs = [...allJobs, ...extractJobTitles(html)]
  }

  // Deduplicate
  allJobs = Array.from(new Set(allJobs)).slice(0, 20)

  if (allJobs.length < 3) return []

  const signalUrl = `${base}/jobs`
  if (existingUrls.has(signalUrl)) return []

  const preview = allJobs.slice(0, 5).join(', ')
  const summary = `Hiring ${allJobs.length} roles: ${preview}${allJobs.length > 5 ? ` and ${allJobs.length - 5} more` : ''}`

  return [{
    title: `${competitor.name} is actively hiring — ${allJobs.length} open roles`,
    summary,
    url: signalUrl,
    source_type: 'job_postings',
    published_at: new Date().toISOString(),
  }]
}
