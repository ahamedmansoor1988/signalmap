'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['company_profiles']['Row']

interface Props {
  initialProfile: Profile | null
}

const FIELD_LABEL: Record<string, string> = {
  company_name:    'Company name',
  description:     'What does your product do?',
  icp:             'Who is your ideal customer?',
  pricing_model:   'How do you price?',
  differentiators: 'Key differentiators',
  website_url:     'Your website',
}

type FormState = Pick<Profile, 'company_name' | 'description' | 'icp' | 'pricing_model' | 'differentiators' | 'website_url'>

function toFormState(p: Profile | null): FormState {
  return {
    company_name:    p?.company_name    ?? '',
    description:     p?.description     ?? '',
    icp:             p?.icp             ?? '',
    pricing_model:   p?.pricing_model   ?? '',
    differentiators: p?.differentiators ?? '',
    website_url:     p?.website_url     ?? '',
  }
}

export default function CompanyProfileForm({ initialProfile }: Props) {
  const [form, setForm]       = useState<FormState>(toFormState(initialProfile))
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/company-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Save failed')
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

  return (
    <div className="space-y-4">
      {/* Row 1: Company name + website side by side on wide, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            {FIELD_LABEL.company_name}
          </label>
          <input
            type="text"
            value={form.company_name ?? ''}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="Acme Inc."
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            {FIELD_LABEL.website_url}
          </label>
          <input
            type="url"
            value={form.website_url ?? ''}
            onChange={(e) => set('website_url', e.target.value)}
            placeholder="https://acme.com"
            className={inputClass}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {FIELD_LABEL.description}
        </label>
        <textarea
          rows={3}
          value={form.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="A CX platform that unifies ticketing, messaging, and AI automation for support teams."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* ICP */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {FIELD_LABEL.icp}
        </label>
        <textarea
          rows={2}
          value={form.icp ?? ''}
          onChange={(e) => set('icp', e.target.value)}
          placeholder="Mid-market B2B SaaS companies with 50–500 person support teams."
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Pricing model */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {FIELD_LABEL.pricing_model}
        </label>
        <input
          type="text"
          value={form.pricing_model ?? ''}
          onChange={(e) => set('pricing_model', e.target.value)}
          placeholder="Per seat, $49/month · Enterprise custom pricing"
          className={inputClass}
        />
      </div>

      {/* Differentiators */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {FIELD_LABEL.differentiators}
        </label>
        <textarea
          rows={3}
          value={form.differentiators ?? ''}
          onChange={(e) => set('differentiators', e.target.value)}
          placeholder={`• Native AI that doesn't require add-ons\n• Unified inbox across email, chat, and voice\n• 5-minute onboarding vs weeks for Zendesk`}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Footer: save button + feedback */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>

        {saved && (
          <span className="text-emerald-600 text-sm font-medium">
            ✓ Profile saved
          </span>
        )}
        {error && (
          <span className="text-red-600 text-sm">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
