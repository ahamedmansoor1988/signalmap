'use client'

import { useState } from 'react'
import { Copy, Check, UserPlus, Shield, User } from 'lucide-react'

export default function TeamAccess({ isAdmin }: { isAdmin: boolean }) {
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState<'member' | 'admin'>('member')
  const [link,    setLink]    = useState('')
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function createInvite() {
    if (!email.trim()) return
    setLoading(true); setError(''); setLink('')
    const res = await fetch('/api/team/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await res.json() as { invite?: { token: string }; error?: string }
    if (res.ok && data.invite) {
      setLink(`${window.location.origin}/join/${data.invite.token}`)
      setEmail('')
    } else {
      setError(data.error ?? 'Could not create invite')
    }
    setLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isAdmin) {
    return (
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <Shield className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-500">Only admins can invite teammates. Ask your organization admin to send you an invite link.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-2">Teammate email</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createInvite() }}
            placeholder="teammate@company.com"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <div className="flex border border-gray-200 rounded-xl overflow-hidden">
            {(['member', 'admin'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex items-center gap-1.5 px-3 text-xs font-medium transition-colors ${role === r ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {r === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {r === 'admin' ? 'Admin' : 'Member'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={createInvite}
        disabled={loading || !email.trim()}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors w-full justify-center"
      >
        <UserPlus className="w-4 h-4" />
        {loading ? 'Creating link…' : 'Generate invite link'}
      </button>

      {/* Generated link */}
      {link && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-700">Invite link ready — share this with your teammate</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-emerald-100 rounded-lg p-2.5">
            <p className="flex-1 text-[11px] text-gray-600 truncate font-mono">{link}</p>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-emerald-600 mt-2">Link expires in 7 days · only works for {email || 'the invited email'}</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <p className="text-[11px] text-gray-400">Team members never increase your plan cost — pricing is based on competitors monitored, not seats.</p>
    </div>
  )
}
