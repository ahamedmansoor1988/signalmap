'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, Search } from 'lucide-react'

interface Props {
  competitorId: string
  plan: string
}

type State = 'idle' | 'loading' | 'done' | 'error'

interface DiscoverResult {
  discovered: number
  pages: { url: string; label: string }[]
}

export default function BackfillButton({ competitorId }: Props) {
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<DiscoverResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    if (state === 'loading') return
    setState('loading')
    setErrorMsg('')
    setResult(null)

    try {
      const res = await fetch(`/api/competitor/${competitorId}/discover`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Server error ${res.status}: ${body.slice(0, 120)}`)
      }
      const data = (await res.json()) as DiscoverResult
      setResult(data)
      setState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error — try again')
      setState('error')
    }
  }

  if (state === 'done' && result) {
    const labels = Array.from(new Set(result.pages.map(p => p.label)))
    return (
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600">
          <CheckCircle className="w-3.5 h-3.5" />
          {result.discovered > 0
            ? `Found ${result.discovered} new source${result.discovered !== 1 ? 's' : ''}: ${labels.join(', ')}`
            : 'No new sources found — pages already tracked'}
        </div>
        <button
          onClick={() => setState('idle')}
          className="text-[10px] text-gray-400 hover:text-gray-600 underline"
        >
          Run again
        </button>
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
          <Search className="w-3.5 h-3.5" />
        )}
        {state === 'loading' ? 'Scanning content sources…' : 'Discover Content Sources'}
      </button>

      {state === 'error' && (
        <p className="text-[10px] text-red-500 leading-snug mt-1.5 text-center">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
