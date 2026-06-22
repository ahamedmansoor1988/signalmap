import type { PipelineItem, PipelineCompetitor } from './types'
import { safeIso } from './types'

const GH_UA = 'SignalMap/1.0'
const GH_HEADERS = { 'User-Agent': GH_UA, 'Accept': 'application/vnd.github.v3+json' }

type GHRelease = {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string
  html_url: string
  draft: boolean
  prerelease: boolean
}

type GHRepo = { name: string; full_name: string }

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: GH_HEADERS })
    if (!res.ok) return null
    return await res.json() as T
  } catch { return null }
}

async function getOrgName(competitor: PipelineCompetitor): Promise<string | null> {
  const slug = competitor.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const variations = [slug, slug.replace(/-/g, ''), competitor.name.toLowerCase().replace(/\s+/g, '')]
  for (const name of variations) {
    const org = await fetchJson<{ login: string }>(`https://api.github.com/orgs/${name}`)
    if (org?.login) return org.login
    const user = await fetchJson<{ login: string; type: string }>(`https://api.github.com/users/${name}`)
    if (user?.login) return user.login
  }
  return null
}

export async function fetchGitHub(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  const orgName = await getOrgName(competitor)
  if (!orgName) return []

  const repos = await fetchJson<GHRepo[]>(
    `https://api.github.com/orgs/${orgName}/repos?sort=pushed&per_page=5`
  ) ?? await fetchJson<GHRepo[]>(
    `https://api.github.com/users/${orgName}/repos?sort=pushed&per_page=5`
  )
  if (!repos?.length) return []

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const items: PipelineItem[] = []

  await Promise.all(
    repos.slice(0, 3).map(async (repo) => {
      const releases = await fetchJson<GHRelease[]>(
        `https://api.github.com/repos/${repo.full_name}/releases?per_page=3`
      )
      if (!releases?.length) return
      for (const rel of releases) {
        if (rel.draft || rel.prerelease) continue
        const pub = new Date(rel.published_at)
        if (pub < sevenDaysAgo) continue
        if (existingUrls.has(rel.html_url)) continue
        const title = `${competitor.name} released ${rel.tag_name}${rel.name && rel.name !== rel.tag_name ? ': ' + rel.name : ''}`
        items.push({
          title,
          summary: (rel.body ?? '').slice(0, 400) || title,
          url: rel.html_url,
          source_type: 'github_release',
          published_at: safeIso(rel.published_at),
        })
      }
    })
  )

  return items.slice(0, 5)
}
