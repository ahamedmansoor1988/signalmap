'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select URL bar
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
      title="Copy link"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
