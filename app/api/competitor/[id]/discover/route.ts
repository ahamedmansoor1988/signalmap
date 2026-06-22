import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const CONTENT_PATHS: { path: string; label: string }[] = [
  { path: '/blog',          label: 'Blog'      },
  { path: '/blog/rss.xml',  label: 'Blog'      },
  { path: '/feed.xml',      label: 'Blog'      },
  { path: '/rss.xml',       label: 'Blog'      },
  { path: '/changelog',     label: 'Changelog' },
  { path: '/releases',      label: 'Changelog' },
  { path: '/newsroom',      label: 'Newsroom'  },
  { path: '/press',         label: 'Newsroom'  },
  { path: '/updates',       label: 'Blog'      },
]

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    })
    return res.status === 200
  } catch {
    return false
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userSupabase = await createClient()
  let user = null
  try {
    const result = await userSupabase.auth.getUser()
    user = result.data?.user ?? null
  } catch { /* auth unavailable */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await userSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = createServiceClient()

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, name, website')
    .eq('id', params.id)
    .eq('org_id', membership.org_id)
    .maybeSingle()
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const base = competitor.website.startsWith('http')
    ? competitor.website.replace(/\/$/, '')
    : `https://${competitor.website.replace(/\/$/, '')}`

  // Probe all candidate URLs concurrently
  const checks = await Promise.all(
    CONTENT_PATHS.map(async ({ path, label }) => {
      const url = `${base}${path}`
      const ok = await isReachable(url)
      return ok ? { url, label } : null
    })
  )
  const found = checks.filter((c): c is { url: string; label: string } => c !== null)

  // Determine which are actually new (not yet in tracked_pages)
  const { data: existingPages } = await supabase
    .from('tracked_pages')
    .select('url')
    .eq('competitor_id', competitor.id)
  const existingUrls = new Set(existingPages?.map(p => p.url) ?? [])

  const newPages = found.filter(f => !existingUrls.has(f.url))

  if (newPages.length > 0) {
    await supabase.from('tracked_pages').insert(
      newPages.map(({ url, label }) => ({ competitor_id: competitor.id, url, label }))
    )
  }

  return NextResponse.json({ discovered: newPages.length, pages: found })
}
