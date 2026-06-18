'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import type { CompetitorSuggestion } from '@/app/api/suggest-competitors/route'
import { Sparkles, ArrowRight, Check, Loader2, Globe, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  orgId: string
}

type Step = 'describe' | 'loading' | 'select' | 'saving'

export default function OnboardingClient({ orgId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('describe')
  const [description, setDescription] = useState('')
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  async function fetchSuggestions(exclude: string[] = []) {
    const res = await fetch('/api/suggest-competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, exclude }),
    })
    const data = await res.json() as { suggestions?: CompetitorSuggestion[]; error?: string }
    if (data.error || !data.suggestions) throw new Error(data.error ?? 'No suggestions returned')
    return data.suggestions
  }

  async function handleDescribe(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setStep('loading')
    setError(null)

    try {
      const s = await fetchSuggestions()
      setSuggestions(s)
      setSelected(new Set(s.map((_, i) => i)))
      setStep('select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('describe')
    }
  }

  async function handleSuggestMore() {
    setLoadingMore(true)
    try {
      const exclude = suggestions.map((s) => s.name)
      const more = await fetchSuggestions(exclude)
      setSuggestions((prev) => {
        const next = [...prev, ...more]
        // auto-select the new ones
        setSelected((sel) => {
          const updated = new Set(sel)
          for (let i = prev.length; i < next.length; i++) updated.add(i)
          return updated
        })
        return next
      })
    } catch {
      // silently fail — user still has their existing list
    } finally {
      setLoadingMore(false)
    }
  }

  function addCustom() {
    if (!customName.trim() || !customUrl.trim()) return
    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`
    const custom: CompetitorSuggestion = {
      name: customName.trim(),
      website: url.trim(),
      theme: 'Content',
      reason: 'Added manually',
    }
    setSuggestions((prev) => {
      const next = [...prev, custom]
      setSelected((sel) => new Set(Array.from(sel).concat(next.length - 1)))
      return next
    })
    setCustomName('')
    setCustomUrl('')
    setShowCustom(false)
  }

  function toggleAll() {
    if (selected.size === suggestions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(suggestions.map((_, i) => i)))
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function handleAdd() {
    const toAdd = suggestions.filter((_, i) => selected.has(i))
    if (!toAdd.length) return
    setStep('saving')

    try {
      for (const c of toAdd) {
        const { data: comp, error: compErr } = await supabase
          .from('competitors')
          .insert({ org_id: orgId, name: c.name, website: c.website })
          .select()
          .single()
        if (compErr) throw compErr

        const baseUrl = c.website.replace(/\/$/, '')
        await supabase.from('tracked_pages').insert([
          { competitor_id: comp.id, url: baseUrl, label: 'Home' },
          { competitor_id: comp.id, url: `${baseUrl}/pricing`, label: 'Pricing' },
        ])
      }

      router.push('/map')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setStep('select')
    }
  }

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
        </div>
        <p className="text-gray-600 text-sm">Finding your competitors…</p>
      </div>
    )
  }

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
        </div>
        <p className="text-gray-600 text-sm">Setting up your map…</p>
      </div>
    )
  }

  if (step === 'select') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-gray-900 text-2xl font-semibold">Select your competitors</h1>
            <p className="text-gray-500 text-sm mt-1">
              AI found these based on your description. Pick the ones that matter.
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm">
              <span className="text-gray-900 font-medium">{selected.size}</span> of {suggestions.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="text-xs text-violet-600 hover:text-violet-700 transition-colors"
            >
              {selected.size === suggestions.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {suggestions.map((c, i) => {
              const isSelected = selected.has(i)
              const cfg = THEME_CONFIG[c.theme as Theme] ?? THEME_CONFIG['Content']
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`text-left rounded-xl border p-4 transition-all relative ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <div className="flex items-start gap-3 pr-6">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Globe className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-900 font-semibold text-sm">{c.name}</p>
                      <p className="text-gray-400 text-xs truncate mt-0.5">
                        {c.website.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
                    >
                      {c.theme}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">{c.reason}</p>
                </button>
              )
            })}
          </div>

          {/* Add your own */}
          {showCustom ? (
            <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-white">
              <p className="text-gray-700 text-sm font-medium mb-3">Add a competitor manually</p>
              <div className="flex gap-2">
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Company name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="website.com"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={addCustom}
                  disabled={!customName.trim() || !customUrl.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowCustom(false)}
                  className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleSuggestMore}
                disabled={loadingMore}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all"
              >
                {loadingMore
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Suggest more
              </button>
              <button
                onClick={() => setShowCustom(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add your own
              </button>
            </div>
          )}

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
            >
              Add {selected.size} competitor{selected.size !== 1 ? 's' : ''}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <button
              onClick={() => router.push('/map')}
              className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step: describe
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 mb-5">
            <Sparkles className="w-7 h-7 text-violet-600" />
          </div>
          <h1 className="text-gray-900 text-2xl font-semibold mb-2">
            Who are you competing against?
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Describe your product in one line and AI will suggest<br />competitors for you to track.
          </p>
        </div>

        <form onSubmit={handleDescribe} className="space-y-4">
          <textarea
            autoFocus
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. We build a competitive intelligence platform for B2B SaaS PMM teams to track competitor moves and generate battlecards."
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none shadow-sm"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white gap-2 h-11"
          >
            <Sparkles className="w-4 h-4" />
            Find my competitors
          </Button>

          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="w-full text-gray-400 text-sm hover:text-gray-600 transition-colors py-1"
          >
            I&apos;ll add them manually →
          </button>
        </form>
      </div>
    </div>
  )
}
