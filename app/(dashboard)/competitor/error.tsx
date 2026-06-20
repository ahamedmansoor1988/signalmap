'use client'

import { useEffect } from 'react'

export default function CompetitorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[/competitor] page error:', error)
  }, [error])

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <p className="text-gray-900 font-semibold mb-1">Something went wrong</p>
        <p className="text-gray-400 text-sm mb-1">{error.message}</p>
        {error.digest && (
          <p className="text-gray-300 text-xs mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-violet-600 text-sm border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
