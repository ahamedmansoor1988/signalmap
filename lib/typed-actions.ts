import type { Json } from '@/lib/supabase/types'

export interface TypedAction {
  type: string
  action: string
}

const TYPE_STYLES: Record<string, { cls: string; label: string }> = {
  sales:     { cls: 'bg-blue-50 text-blue-700 border-blue-200',       label: 'Sales' },
  marketing: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Marketing' },
  product:   { cls: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Product' },
}

export function getTypeStyle(type: string): { cls: string; label: string } | null {
  return TYPE_STYLES[type?.toLowerCase()] ?? null
}

export function normalizeActions(raw: Json | string[] | null | undefined): TypedAction[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (typeof item === 'string') {
      const action = item.trim()
      return action ? [{ type: '', action }] : []
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>
      const action = typeof o.action === 'string' ? o.action.trim() : ''
      if (!action) return []
      return [{ type: typeof o.type === 'string' ? o.type : '', action }]
    }
    return []
  })
}
