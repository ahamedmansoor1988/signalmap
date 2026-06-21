'use client'

import { useState } from 'react'
import Link from 'next/link'
import { History, Loader2, Lock } from 'lucide-react'
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

export default function BackfillButton({ competitorId, plan }: Props) {
  const [state, setState] = useState<State>('idle')
  const [inserted, setInserted] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  // Locked for starter plan
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
    let pageIndex = 0

    try {
      while (true) {
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
        setProgress({ current: data.page_index + 1, total: data.total_pages || 1 })

        if (data.done || data.total_pages === 0) break
        pageIndex++
      }

      setInserted(totalInserted)
      setState('done')
      if (totalInserted > 0) setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error — try again')
      setState('error')
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={state === 'loading' || state === 'done'}
        className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold px-3 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <History className="w-3.5 h-3.5" />
        )}
        {state === 'loading'
          ? progress && progress.total > 0
            ? `Backfilling page ${progress.current}/${progress.total}…`
            : 'Backfilling…'
          : 'Backfill 90d History'}
      </button>

      {state === 'loading' && (
        <p className="text-[10px] text-gray-400 leading-snug mt-1.5 text-center">
          {progress && progress.total > 0
            ? `Fetching Wayback Machine snapshots… page ${progress.current} of ${progress.total}`
            : 'Fetching tracked pages…'}
        </p>
      )}

      {state === 'done' && inserted > 0 && (
        <p className="text-[10px] text-emerald-600 font-medium mt-1.5 text-center">
          ✓ {inserted} signal{inserted !== 1 ? 's' : ''} added — reloading…
        </p>
      )}

      {state === 'done' && inserted === 0 && (
        <p className="text-[10px] text-gray-400 leading-snug mt-1.5 text-center">
          No historical changes found — Wayback Machine may not have snapshots for this site.
        </p>
      )}

      {state === 'error' && (
        <p className="text-[10px] text-red-500 leading-snug mt-1.5 text-center">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
