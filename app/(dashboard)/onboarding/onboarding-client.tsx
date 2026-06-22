'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { THEME_CONFIG } from '@/components/map/mock-data'
import type { Theme } from '@/components/map/mock-data'
import type { CompetitorSuggestion } from '@/app/api/suggest-competitors/route'
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Loader2,
  Globe, Plus, RefreshCw, Building2, Users2, Rocket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  orgId: string
  existingCount: number
}

const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'EdTech', 'Marketing', 'Other'] as const
const ROLES = ['Founder/CEO', 'PMM', 'Product Manager', 'Marketing', 'Sales', 'Other'] as const
const TEAM_SIZES = ['Just me', '2–5', '6–20', '20+'] as const

type FlowStep = 1 | 2 | 3 | 'ai_loading' | 'select' | 'saving'

interface FormData {
  companyName: string
  companyWebsite: string
  industry: string
  productDescription: string
  icp: string
  productStrength: string
  knownCompetitors: string
  fullName: string
  role: string
  teamSize: string
}

const INIT: FormData = {
  companyName: '', companyWebsite: '', industry: 'SaaS', productDescription: '',
  icp: '', productStrength: '', knownCompetitors: '',
  fullName: '', role: 'Founder/CEO', teamSize: 'Just me',
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {([1, 2, 3] as const).map(s => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            s === current ? 'w-8 bg-violet-600' : s < current ? 'w-4 bg-violet-300' : 'w-4 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

export default function OnboardingClient({ orgId, existingCount }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FlowStep>(1)
  const [form, setForm] = useState<FormData>(INIT)
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function fetchSuggestions(exclude: string[] = []) {
    const res = await fetch('/api/suggest-competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.productDescription, exclude }),
    })
    const data = await res.json() as { suggestions?: CompetitorSuggestion[]; error?: string }
    if (data.error || !data.suggestions) throw new Error(data.error ?? 'No suggestions returned')
    return data.suggestions
  }

  async function handleStep3Submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStep('ai_loading')

    try {
      const normalizedSite = form.companyWebsite.trim().startsWith('http')
        ? form.companyWebsite.trim()
        : `https://${form.companyWebsite.trim()}`

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          companyWebsite: normalizedSite,
          industry: form.industry,
          productDescription: form.productDescription,
          icp: form.icp,
          productStrength: form.productStrength,
          fullName: form.fullName,
          role: form.role,
          teamSize: form.teamSize,
          knownCompetitors: form.knownCompetitors
            .split(',').map(s => s.trim()).filter(Boolean),
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }

      // Mark onboarding done (cookie read by middleware)
      document.cookie = 'sm_onboarded=1; path=/; max-age=31536000'

      const s = await fetchSuggestions()
      setSuggestions(s)
      setSelected(new Set(s.slice(0, 5).map((_, i) => i)))
      setStep('select')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep(3)
    }
  }

  async function handleSuggestMore() {
    setLoadingMore(true)
    try {
      const more = await fetchSuggestions(suggestions.map(s => s.name))
      setSuggestions(prev => {
        const next = [...prev, ...more]
        setSelected(sel => {
          const updated = new Set(sel)
          for (let i = prev.length; i < next.length; i++) updated.add(i)
          return updated
        })
        return next
      })
    } catch { /* silently fail */ } finally {
      setLoadingMore(false)
    }
  }

  function addCustom() {
    if (!customName.trim() || !customUrl.trim()) return
    const url = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`
    const custom: CompetitorSuggestion = {
      name: customName.trim(), website: url.trim(), theme: 'Content', reason: 'Added manually',
    }
    setSuggestions(prev => {
      const next = [...prev, custom]
      setSelected(sel => new Set([...Array.from(sel), next.length - 1]))
      return next
    })
    setCustomName(''); setCustomUrl(''); setShowCustom(false)
  }

  const FREE_LIMIT = 5

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else if (next.size < FREE_LIMIT) {
        next.add(i)
      }
      return next
    })
  }

  async function handleAdd() {
    const toAdd = suggestions.filter((_, i) => selected.has(i))
    if (!toAdd.length) return
    setStep('saving')

    try {
      if (existingCount > 0) {
        const res = await fetch('/api/competitors/reset', { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to clear existing competitors')
      }

      for (const c of toAdd) {
        const { data: comp, error: compErr } = await supabase
          .from('competitors')
          .insert({ org_id: orgId, name: c.name, website: c.website })
          .select().single()
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

  // ── Shared input styles ──────────────────────────────────────────────────────
  const inp = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500'
  const sel = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  const lbl = 'block text-xs font-semibold text-gray-700 mb-1.5'

  // ── Loading / saving ─────────────────────────────────────────────────────────
  if (step === 'ai_loading' || step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
        </div>
        <p className="text-gray-600 text-sm">
          {step === 'ai_loading' ? 'Finding your competitors…' : 'Setting up your map…'}
        </p>
      </div>
    )
  }

  // ── Competitor select ────────────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-gray-900 text-2xl font-semibold">Select your competitors</h1>
            <p className="text-gray-500 text-sm mt-1">AI found these based on your description. Pick the ones that matter.</p>
          </div>

          {existingCount > 0 && (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
              <p className="text-amber-800 text-sm leading-snug">
                <span className="font-semibold">This will replace your {existingCount} existing competitor{existingCount !== 1 ? 's' : ''}.</span>
                {' '}All previous signals and history will be removed.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm">
              <span className={`font-medium ${selected.size >= FREE_LIMIT ? 'text-violet-600' : 'text-gray-900'}`}>{selected.size}</span>
              <span className="text-gray-400"> / {FREE_LIMIT} selected</span>
              {selected.size >= FREE_LIMIT && (
                <span className="ml-2 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Free plan limit</span>
              )}
            </span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Deselect all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {suggestions.map((c, i) => {
              const isSelected = selected.has(i)
              const cfg = THEME_CONFIG[c.theme as Theme] ?? THEME_CONFIG['Content']
              return (
                <button
                  key={i} onClick={() => toggle(i)}
                  className={`text-left rounded-xl border p-4 transition-all relative ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50 shadow-sm'
                      : selected.size >= FREE_LIMIT
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
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
                      <p className="text-gray-400 text-xs truncate mt-0.5">{c.website.replace(/^https?:\/\//, '')}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                      {c.theme}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">{c.reason}</p>
                </button>
              )
            })}
          </div>

          {showCustom ? (
            <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-white">
              <p className="text-gray-700 text-sm font-medium mb-3">Add a competitor manually</p>
              <div className="flex gap-2">
                <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Company name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="website.com"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <button onClick={addCustom} disabled={!customName.trim() || !customUrl.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
                  Add
                </button>
                <button onClick={() => setShowCustom(false)} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <button onClick={handleSuggestMore} disabled={loadingMore}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all">
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Suggest more
              </button>
              <button onClick={() => setShowCustom(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all">
                <Plus className="w-3.5 h-3.5" />
                Add your own
              </button>
            </div>
          )}

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleAdd} disabled={selected.size === 0}
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
              {existingCount > 0 ? 'Replace with' : 'Add'} {selected.size} competitor{selected.size !== 1 ? 's' : ''}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <button onClick={() => router.push('/map')} className="text-gray-400 text-sm hover:text-gray-600 transition-colors">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1: Company info ─────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <StepIndicator current={1} />
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 mb-4">
              <Building2 className="w-6 h-6 text-violet-600" />
            </div>
            <h1 className="text-gray-900 text-2xl font-semibold mb-1">About your company</h1>
            <p className="text-gray-500 text-sm">Help us personalize your competitive intelligence.</p>
          </div>

          <form onSubmit={e => { e.preventDefault(); setError(null); setStep(2) }} className="space-y-4">
            <div>
              <label className={lbl}>Company name *</label>
              <input required value={form.companyName} onChange={e => setField('companyName', e.target.value)}
                placeholder="Acme Inc" className={inp} />
            </div>
            <div>
              <label className={lbl}>Company website *</label>
              <input required value={form.companyWebsite} onChange={e => setField('companyWebsite', e.target.value)}
                placeholder="https://acme.com" className={inp} />
            </div>
            <div>
              <label className={lbl}>Industry</label>
              <select value={form.industry} onChange={e => setField('industry', e.target.value)} className={sel}>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>What does your product do? *</label>
              <textarea required rows={3} value={form.productDescription}
                onChange={e => setField('productDescription', e.target.value)}
                placeholder="e.g. We build a competitive intelligence platform for B2B SaaS PMM teams to track competitor moves and generate battlecards."
                className={`${inp} resize-none`} />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white h-11 gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // ── Step 2: GTM ──────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <StepIndicator current={2} />
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 mb-4">
              <Rocket className="w-6 h-6 text-violet-600" />
            </div>
            <h1 className="text-gray-900 text-2xl font-semibold mb-1">Your go-to-market</h1>
            <p className="text-gray-500 text-sm">Used to personalize AI analysis and battlecards.</p>
          </div>

          <form onSubmit={e => { e.preventDefault(); setStep(3) }} className="space-y-4">
            <div>
              <label className={lbl}>Who is your target customer? (ICP)</label>
              <textarea rows={2} value={form.icp} onChange={e => setField('icp', e.target.value)}
                placeholder="e.g. Mid-market B2B SaaS, 50–500 employees, VP Marketing buyer"
                className={`${inp} resize-none`} />
            </div>
            <div>
              <label className={lbl}>Core product strength</label>
              <textarea rows={2} value={form.productStrength} onChange={e => setField('productStrength', e.target.value)}
                placeholder="e.g. Easiest onboarding in the category, no code required"
                className={`${inp} resize-none`} />
            </div>
            <div>
              <label className={lbl}>
                Competitors you already know{' '}
                <span className="font-normal text-gray-400">(optional, comma-separated)</span>
              </label>
              <input value={form.knownCompetitors} onChange={e => setField('knownCompetitors', e.target.value)}
                placeholder="e.g. Crayon, Klue, Kompyte" className={inp} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white h-11 gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Step 3: About you ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg">
        <StepIndicator current={3} />
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 mb-4">
            <Users2 className="w-6 h-6 text-violet-600" />
          </div>
          <h1 className="text-gray-900 text-2xl font-semibold mb-1">About you</h1>
          <p className="text-gray-500 text-sm">Just a few details to complete your setup.</p>
        </div>

        <form onSubmit={handleStep3Submit} className="space-y-4">
          <div>
            <label className={lbl}>Your full name *</label>
            <input required value={form.fullName} onChange={e => setField('fullName', e.target.value)}
              placeholder="Jane Smith" className={inp} />
          </div>
          <div>
            <label className={lbl}>Your role</label>
            <select value={form.role} onChange={e => setField('role', e.target.value)} className={sel}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Team size</label>
            <select value={form.teamSize} onChange={e => setField('teamSize', e.target.value)} className={sel}>
              {TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white h-11 gap-2">
              <Sparkles className="w-4 h-4" />
              Find my competitors
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
