'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2, ExternalLink, Globe } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type Competitor = Database['public']['Tables']['competitors']['Row'] & {
  tracked_pages: Array<Database['public']['Tables']['tracked_pages']['Row']>
}

interface Props {
  competitors: Competitor[]
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const cls = {
    High: 'bg-red-500/10 text-red-400',
    Medium: 'bg-amber-500/10 text-amber-400',
    Low: 'bg-emerald-500/10 text-emerald-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[level]}`}>
      {level} · {score}
    </span>
  )
}

export default function CompetitorList({ competitors }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this competitor and all its tracked data?')) return
    setDeleting(id)
    await supabase.from('competitors').delete().eq('id', id)
    router.refresh()
    setDeleting(null)
  }

  if (!competitors.length) {
    return (
      <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
        <Globe className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">No competitors added yet</p>
        <p className="text-zinc-600 text-xs mt-1">Add your first competitor above</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {competitors.map((c) => (
        <div
          key={c.id}
          className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-start justify-between group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-medium text-sm">{c.name}</span>
              <RiskBadge score={c.risk_score} />
            </div>
            <a
              href={c.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-500 text-xs hover:text-zinc-300 transition-colors w-fit"
            >
              {c.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
            {c.tracked_pages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tracked_pages.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full"
                  >
                    {p.label ?? (new URL(p.url).pathname || '/')}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleDelete(c.id)}
            disabled={deleting === c.id}
            className="ml-3 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
