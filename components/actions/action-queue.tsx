'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Circle, Clock3, RefreshCw, UserRound } from 'lucide-react'
import type { Database } from '@/lib/supabase/types'

type Task = Database['public']['Tables']['action_tasks']['Row']
type Person = Pick<Database['public']['Tables']['member_preferences']['Row'], 'user_id' | 'display_name' | 'role_view'>

const TYPE_STYLE: Record<string, string> = {
  sales: 'bg-blue-50 text-blue-700', marketing: 'bg-emerald-50 text-emerald-700',
  product: 'bg-violet-50 text-violet-700', general: 'bg-gray-100 text-gray-600',
}

export default function ActionQueue({ initialTasks, people, userId, defaultRole }: {
  initialTasks: Task[]; people: Person[]; userId: string; defaultRole: string
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const [type, setType] = useState('all') // always default to all — role view is a separate preference
  const [refreshing, setRefreshing] = useState(false)

  const fetchTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/actions')
      if (res.ok) {
        const data = await res.json() as { tasks: Task[] }
        setTasks(data.tasks)
      }
    } finally { setRefreshing(false) }
  }, [])

  // Always fetch fresh data on mount (bypasses SSR staleness)
  useEffect(() => { void fetchTasks() }, [fetchTasks])

  const visible = useMemo(() => tasks.filter(t => {
    if (scope === 'mine' && t.assignee_user_id !== userId) return false
    if (type !== 'all' && t.action_type !== type) return false
    return t.status !== 'dismissed'
  }), [tasks, scope, type, userId])

  async function update(id: string, patch: Record<string, unknown>) {
    const previous = tasks
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } as Task : t))
    const res = await fetch(`/api/actions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!res.ok) setTasks(previous)
  }

  const nameFor = (id: string | null) => people.find(p => p.user_id === id)?.display_name ?? (id === userId ? 'You' : 'Unassigned')

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="bg-gray-100 rounded-lg p-1 flex">
          {(['mine', 'team'] as const).map(v => <button key={v} onClick={() => setScope(v)}
            className={`text-xs px-3 py-1.5 rounded-md ${scope === v ? 'bg-white text-gray-900 font-semibold shadow-sm' : 'text-gray-500'}`}>
            {v === 'mine' ? 'My queue' : 'Team queue'}
          </button>)}
        </div>
        <select value={type} onChange={e => setType(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-white text-gray-600 appearance-none bg-no-repeat bg-right cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundPosition: 'right 10px center' }}>
          <option value="all">All roles</option><option value="sales">Sales</option>
          <option value="marketing">Marketing</option><option value="product">Product</option><option value="general">General</option>
        </select>
        <span className="ml-auto text-xs text-gray-400">{visible.filter(t => t.status !== 'done').length} active</span>
        <button onClick={() => void fetchTasks()} disabled={refreshing}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <Check className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No actions in this queue</p>
          <p className="text-xs text-gray-400 mt-1">Open a signal and add one of its recommended actions.</p>
        </div>
      ) : <div className="space-y-2">{visible.map(task => (
        <div key={task.id} className={`bg-white border rounded-xl p-4 ${task.status === 'done' ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
          <div className="flex items-start gap-3">
            <button onClick={() => update(task.id, { status: task.status === 'done' ? 'open' : 'done' })}
              className="mt-0.5 text-gray-300 hover:text-emerald-500">
              {task.status === 'done' ? <Check className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${TYPE_STYLE[task.action_type]}`}>{task.action_type}</span>
                {task.status === 'in_progress' && <span className="text-[10px] text-amber-600">In progress</span>}
              </div>
              <p className={`text-sm text-gray-800 ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <UserRound className="w-3 h-3" />
                  <select value={task.assignee_user_id ?? ''} onChange={e => update(task.id, { assignee_user_id: e.target.value || null })}
                    className="bg-transparent text-xs text-gray-500 focus:outline-none">
                    <option value="">Unassigned</option>
                    {!people.some(p => p.user_id === userId) && <option value={userId}>You</option>}
                    {people.map(p => <option key={p.user_id} value={p.user_id}>{p.user_id === userId ? 'You' : p.display_name ?? 'Team member'}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock3 className="w-3 h-3" />
                  <input type="date" value={task.due_date ?? ''} onChange={e => update(task.id, { due_date: e.target.value || null })}
                    className="bg-transparent text-xs text-gray-500 focus:outline-none" />
                </label>
                {task.status === 'open' && <button onClick={() => update(task.id, { status: 'in_progress' })}
                  className="text-xs text-violet-600 hover:underline">Start</button>}
                <span className="text-xs text-gray-300 ml-auto">{nameFor(task.assignee_user_id)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}</div>}
    </div>
  )
}
