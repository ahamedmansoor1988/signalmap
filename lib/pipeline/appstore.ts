import type { PipelineItem, PipelineCompetitor } from './types'
import { safeIso } from './types'

type ItunesSearchResult = {
  resultCount: number
  results: Array<{ trackId: number; trackName: string }>
}

type ItunesLookupResult = {
  resultCount: number
  results: Array<{
    version: string
    releaseNotes: string | null
    currentVersionReleaseDate: string
    trackName: string
    trackViewUrl: string
  }>
}

export async function fetchAppStore(
  competitor: PipelineCompetitor,
  existingUrls: Set<string>
): Promise<PipelineItem[]> {
  try {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(competitor.name)}&entity=software&limit=3`
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) })
    if (!searchRes.ok) return []
    const search = await searchRes.json() as ItunesSearchResult
    if (!search.results?.length) return []

    const appId = search.results[0].trackId
    const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${appId}&country=us`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!lookupRes.ok) return []
    const lookup = await lookupRes.json() as ItunesLookupResult
    const app = lookup.results?.[0]
    if (!app) return []

    const updatedAt = new Date(app.currentVersionReleaseDate)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (updatedAt < sevenDaysAgo) return []

    const url = app.trackViewUrl
    if (existingUrls.has(url)) return []

    return [{
      title: `${app.trackName} updated to v${app.version}`,
      summary: (app.releaseNotes ?? `New version ${app.version} released`).slice(0, 400),
      url,
      source_type: 'app_store',
      published_at: safeIso(app.currentVersionReleaseDate),
    }]
  } catch { return [] }
}
