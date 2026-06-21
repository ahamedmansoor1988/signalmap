'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, History, Loader2, Lock } from 'lucide-react'
import { isPaid } from '@/lib/plans'

interface Props {
  competitorId: string
  plan: string
}

type State = 'idle' | 'loading' | 'done' | 'error'

interface BackfillResult {
  total_pages: number
  page_index: number
  done: boolean
  changes_inserted: number
}

const MAX_PAGES = 10

export default function BackfillButton({ competitorId, plan }: Props) {
  const [state, setState] = useState<State>('idle')
  const [inserted, setInserted] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  if (!isPaid(plan)) {
    return (
      <Link
        href="/settings"
        className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-gray-200 text-gray-400 hover:border-violet-200 hover:text-violet-500 transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        Backfill History
      </Link>
    )
  }

  async function handleClick() {
    if (state === 'loading') return
    setState('loading')
    setErrorMsg('')
    setProgress(null)

    let totalInserted = 0

    try {
      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
        const res = await fetch(
          `/api/competitor/${competitorId}/backfill?page_index=${pageIndex}`,
          { method: 'POST' }
        )

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Server error ${res.status}: ${body.slice(0, 120)}`)
        }

        const data = (await res.json()) as BackfillResult
        totalInserted += data.changes_inserted

        const total = data.total_pages > 0 ? data.total_pages : 1
        setProgress({ current: Math.min(pageIndex + 1, total), total })

        if (data.done || data.total_pages === 0 || pageIndex >= data.total_pages - 1) break
      }

      setInserted(totalInserted)
      setState('done')
      if (totalInserted > 0) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error — try again')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle className="w-3.5 h-3.5" />
          {inserted > 0 ? `${inserted} signal${inserted !== 1 ? 's' : ''} added` : 'Already up to date'}
        </div>
        {inserted > 0 && (
          <p className="text-[10px] text-gray-400">Reloading…</p>
        )}
        {inserted === 0 && (
          <button
            onClick={() => setState('idle')}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            Run again
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <History className="w-3.5 h-3.5" />
        )}
        {state === 'loading'
          ? progress && progress.total > 0
            ? `Page ${progress.current} / ${progress.total}…`
            : 'Starting…'
          : 'Backfill 30d History'}
      </button>

      {state === 'loading' && progress && progress.total > 0 && (
        <div className="mt-1.5">
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="bg-violet-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            Checking Wayback Machine snapshots…
          </p>
        </div>
      )}

      {state === 'error' && (
        <p className="text-[10px] text-red-500 leading-snug mt-1.5 text-center">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
