'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Briefcase, CreditCard, LogOut, Trash2, Check, AlertTriangle, Zap } from 'lucide-react'
import { PLANS, getPlan, competitorLabel } from '@/lib/plans'

const ROLES = [
  { value: 'all',        label: 'All signals'  },
  { value: 'sales',      label: 'Sales'        },
  { value: 'marketing',  label: 'Marketing'    },
  { value: 'product',    label: 'Product'      },
  { value: 'leadership', label: 'Leadership'   },
]

interface Props {
  user: { id: string; email: string; full_name: string; avatar_url: string }
  preferences: { display_name: string | null; role_view: string | null }
  plan: string
  competitorLimit: number
  competitorsUsed: number
  orgRole: string
}

export default function ProfileClient({ user, preferences, plan, competitorLimit, competitorsUsed, orgRole }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName]       = useState(preferences.display_name ?? user.full_name ?? '')
  const [role, setRole]       = useState(preferences.role_view ?? 'all')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const planInfo = getPlan(plan)
  const isUnlimited = competitorLimit >= 9999

  async function save() {
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, role_view: role }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function deleteAccount() {
    setDeleting(true)
    const res = await fetch('/api/profile', { method: 'DELETE' })
    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/login')
    } else {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">{initials}</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{name || user.email}</h1>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>

        {/* Profile info */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Display name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
            <input
              value={user.email}
              disabled
              className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
            />
            <p className="text-[11px] text-gray-400 mt-1">Email is managed by Google OAuth and cannot be changed here.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">My role lens</label>
            <p className="text-[11px] text-gray-400 mb-2">Filters your default signal and action view</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    role === r.value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </section>

        {/* Billing */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Billing & Plan</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{planInfo.name} plan</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {planInfo.price === 0 ? 'Free' : `$${planInfo.price}/month`}
                {' · '}
                {competitorLabel(competitorLimit, competitorsUsed)}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              plan === 'elite' ? 'bg-violet-100 text-violet-700' :
              plan === 'business' ? 'bg-blue-50 text-blue-700' :
              plan === 'pro' ? 'bg-emerald-50 text-emerald-700' :
              'bg-gray-100 text-gray-600'
            }`}>{planInfo.name}</span>
          </div>

          {!isUnlimited && (
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.min(100, (competitorsUsed / Math.max(competitorLimit, 1)) * 100)}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 pt-1">
            {PLANS.filter(p => p.id !== 'starter').map(p => (
              <div key={p.id} className={`rounded-xl border p-3 text-center ${plan === p.id ? 'border-violet-400 bg-violet-50' : 'border-gray-100'}`}>
                <p className="text-xs font-semibold text-gray-900">{p.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{p.competitors === -1 ? 'Unlimited' : `${p.competitors} competitors`}</p>
                <p className="text-sm font-bold text-gray-900 mt-1">${p.price}<span className="text-[10px] font-normal text-gray-400">/mo</span></p>
                {plan === p.id
                  ? <span className="text-[10px] text-violet-600 font-semibold">Current</span>
                  : (
                    <a
                      href={`mailto:ahamedmansoor1988@gmail.com?subject=SignalMap upgrade to ${p.name}`}
                      className="text-[10px] text-violet-600 hover:underline font-medium flex items-center justify-center gap-1 mt-1"
                    >
                      <Zap className="w-2.5 h-2.5" /> Upgrade
                    </a>
                  )
                }
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400">Unlimited teammates on all plans. Pricing is based on competitors monitored.</p>
        </section>

        {/* Org role */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Organization</h2>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Your role</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
              orgRole === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
            }`}>{orgRole}</span>
          </div>
        </section>

        {/* Account actions */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-2">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-gray-400" />
            Log out
          </button>

          <div className="border-t border-gray-100 pt-2">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete account
              </button>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Permanently delete your account?</p>
                    <p className="text-xs text-red-500 mt-0.5">This removes your profile and access. Your organization&apos;s data stays unless you are the only member.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
