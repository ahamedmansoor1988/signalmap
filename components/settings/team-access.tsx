'use client'

import { useState } from 'react'
import { Copy, UserPlus } from 'lucide-react'

export default function TeamAccess({ isAdmin }: { isAdmin: boolean }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createInvite() {
    setLoading(true); setError(''); setLink('')
    const res = await fetch('/api/team/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }),
    })
    const data = await res.json() as { invite?: { token: string }; error?: string }
    if (res.ok && data.invite) setLink(`${window.location.origin}/join/${data.invite.token}`)
    else setError(data.error ?? 'Could not create invite')
    setLoading(false)
  }

  if (!isAdmin) return <p className="text-sm text-gray-500">Ask an organization admin to invite teammates.</p>

  return <div className="space-y-3">
    <div className="flex gap-2 flex-col sm:flex-row">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      <select value={role} onChange={e => setRole(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
        <option value="member">Member</option><option value="admin">Admin</option>
      </select>
      <button onClick={createInvite} disabled={loading || !email}
        className="inline-flex items-center justify-center gap-1.5 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
        <UserPlus className="w-4 h-4" /> {loading ? 'Creating…' : 'Create invite'}
      </button>
    </div>
    {link && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
      <input readOnly value={link} className="flex-1 bg-transparent text-xs text-emerald-800 outline-none min-w-0" />
      <button onClick={() => navigator.clipboard.writeText(link)} title="Copy invite link" className="text-emerald-700"><Copy className="w-4 h-4" /></button>
    </div>}
    {error && <p className="text-xs text-red-600">{error}</p>}
    <p className="text-xs text-gray-400">Invite links expire in seven days. Team members do not increase plan cost.</p>
  </div>
}
