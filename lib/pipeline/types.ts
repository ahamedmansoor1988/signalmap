export interface PipelineItem {
  title: string
  summary: string
  url: string
  source_type: string
  published_at: string // ISO string
}

export type PipelineCompetitor = {
  id: string
  name: string
  website: string | null
}

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export function safeIso(date: string): string {
  try { return new Date(date).toISOString() } catch { return new Date().toISOString() }
}
