'use client'

import { ExternalLink } from 'lucide-react'
import type { StructuredDiff, PlanChange, FieldChange, BlogPost } from '@/lib/extractor'

// ── Pricing ───────────────────────────────────────────────────────────────────

function PlanBadge({ status }: { status: PlanChange['status'] }) {
  if (status === 'added')   return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">NEW</span>
  if (status === 'removed') return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 shrink-0">REMOVED</span>
  if (status === 'changed') return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">CHANGED</span>
  return null
}

function PricingDiff({ plan_changes }: { plan_changes: PlanChange[] }) {
  const relevant = plan_changes.filter((p) => p.status !== 'unchanged')
  if (!relevant.length) return null

  return (
    <div className="space-y-2">
      {relevant.map((pc) => (
        <div key={pc.name} className="border border-gray-100 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700">{pc.name}</span>
            <PlanBadge status={pc.status} />
          </div>

          {pc.status === 'changed' && pc.before && pc.after && (
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Before</p>
                <p className="text-sm font-semibold text-red-600 line-through">{pc.before.price}</p>
                {pc.before.features.slice(0, 3).map((f, i) => (
                  <p key={i} className="text-xs text-gray-400 mt-0.5 line-through">{f}</p>
                ))}
              </div>
              <div className="p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">After</p>
                <p className="text-sm font-semibold text-emerald-600">{pc.after.price}</p>
                {pc.after.features.slice(0, 3).map((f, i) => (
                  <p key={i} className="text-xs text-gray-600 mt-0.5">{f}</p>
                ))}
              </div>
            </div>
          )}

          {pc.status === 'added' && pc.after && (
            <div className="p-3">
              <p className="text-sm font-semibold text-emerald-600">{pc.after.price}</p>
              <p className="text-xs text-gray-400 mt-0.5">{pc.after.billing}</p>
              {pc.after.features.slice(0, 3).map((f, i) => (
                <p key={i} className="text-xs text-gray-600 mt-0.5">• {f}</p>
              ))}
            </div>
          )}

          {pc.status === 'removed' && pc.before && (
            <div className="p-3">
              <p className="text-sm font-semibold text-red-600 line-through">{pc.before.price}</p>
              {pc.before.features.slice(0, 2).map((f, i) => (
                <p key={i} className="text-xs text-gray-400 mt-0.5 line-through">{f}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Homepage ──────────────────────────────────────────────────────────────────

function HomepageDiff({ field_changes }: { field_changes: FieldChange[] }) {
  return (
    <div className="space-y-2">
      {field_changes.map((fc) => (
        <div key={fc.field} className="border border-gray-100 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase">{fc.label}</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Before</p>
              <p className="text-xs text-red-600 line-through leading-relaxed">{fc.before || '—'}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">After</p>
              <p className="text-xs text-emerald-700 leading-relaxed">{fc.after || '—'}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Blog ──────────────────────────────────────────────────────────────────────

function BlogDiff({ new_posts }: { new_posts: BlogPost[] }) {
  return (
    <div className="space-y-2">
      {new_posts.map((post, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-800 leading-snug">{post.title}</p>
              {post.published_date !== 'unknown' && (
                <p className="text-[10px] text-gray-400 mt-0.5">{post.published_date}</p>
              )}
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 shrink-0">
              {post.topic_category}
            </span>
          </div>
          {post.url && post.url !== 'unknown' && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400 hover:text-violet-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {post.url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StructuredDiffView({ diff }: { diff: StructuredDiff }) {
  if (diff.page_type === 'pricing' && diff.plan_changes?.length) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Plan Changes</p>
        <PricingDiff plan_changes={diff.plan_changes} />
      </div>
    )
  }

  if (diff.page_type === 'homepage' && diff.field_changes?.length) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Messaging Changes</p>
        <HomepageDiff field_changes={diff.field_changes} />
      </div>
    )
  }

  if (diff.page_type === 'changelog' && diff.new_posts?.length) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">New Posts</p>
        <BlogDiff new_posts={diff.new_posts} />
      </div>
    )
  }

  // Fallback: generic added/removed list
  if (!diff.added.length && !diff.removed.length) return null

  return (
    <div className="space-y-1">
      {diff.added.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="text-emerald-500 shrink-0 font-bold mt-0.5">+</span>
          <span className="text-gray-700">{item}</span>
        </div>
      ))}
      {diff.removed.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="text-red-400 shrink-0 font-bold mt-0.5">−</span>
          <span className="text-gray-500 line-through">{item}</span>
        </div>
      ))}
    </div>
  )
}
