'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'

type Preference = Database['public']['Tables']['member_preferences']['Row']

export default function PersonalPreferencesForm({ initial }: { initial: Partial<Preference> }) {
  const [form, setForm] = useState({
    display_name: initial.display_name ?? '',
    role_view: initial.role_view ?? 'all',
    browser_notifications: initial.browser_notifications ?? true,
    action_notifications: initial.action_notifications ?? true,
    digest_frequency: initial.digest_frequency ?? 'weekly',
    minimum_risk: initial.minimum_risk ?? 0,
  })
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save() {
    setState('saving')
    const res = await fetch('/api/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setState(res.ok ? 'saved' : 'error')
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-xs font-medium text-gray-500">
          Display name
          <input className={`${input} mt-1.5`} value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Your name" />
        </label>
        <label className="text-xs font-medium text-gray-500">
          My default view
          <select className={`${input} mt-1.5`} value={form.role_view}
            onChange={e => setForm(f => ({ ...f, role_view: e.target.value as typeof f.role_view }))}>
            <option value="all">All company signals</option>
            <option value="sales">Sales</option>
            <option value="marketing">Marketing</option>
            <option value="product">Product</option>
            <option value="leadership">Leadership</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-xs font-medium text-gray-500">
          Digest cadence
          <select className={`${input} mt-1.5`} value={form.digest_frequency}
            onChange={e => setForm(f => ({ ...f, digest_frequency: e.target.value as typeof f.digest_frequency }))}>
            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="off">Off</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Minimum alert risk: {form.minimum_risk}
          <input type="range" min="0" max="100" step="5" className="w-full mt-3 accent-violet-600"
            value={form.minimum_risk} onChange={e => setForm(f => ({ ...f, minimum_risk: Number(e.target.value) }))} />
        </label>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.browser_notifications}
            onChange={e => setForm(f => ({ ...f, browser_notifications: e.target.checked }))} /> Browser signal alerts
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.action_notifications}
            onChange={e => setForm(f => ({ ...f, action_notifications: e.target.checked }))} /> My action reminders
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={state === 'saving'}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
          {state === 'saving' ? 'Saving…' : 'Save personal settings'}
        </button>
        {state === 'saved' && <span className="text-emerald-600 text-sm">✓ Saved for your account</span>}
        {state === 'error' && <span className="text-red-600 text-sm">Could not save</span>}
      </div>
    </div>
  )
}
