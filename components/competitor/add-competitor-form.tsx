'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, X, Globe, Link } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  orgId: string
  onSuccess?: () => void
}

export default function AddCompetitorForm({ orgId, onSuccess }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [urls, setUrls] = useState<string[]>([''])

  function addUrl() {
    setUrls((prev) => [...prev, ''])
  }

  function removeUrl(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateUrl(i: number, val: string) {
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)))
  }

  function isSafeUrl(raw: string): boolean {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
      const hostname = url.hostname
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false
      return true
    } catch { return false }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!isSafeUrl(website)) {
      setError('Invalid website URL — must be a public domain')
      setLoading(false)
      return
    }

    try {
      const { data: comp, error: compErr } = await supabase
        .from('competitors')
        .insert({ org_id: orgId, name: name.trim(), website: website.trim() })
        .select()
        .single()

      if (compErr) throw compErr

      const validUrls = urls.filter((u) => u.trim())
      if (validUrls.length > 0) {
        const { error: pagesErr } = await supabase.from('tracked_pages').insert(
          validUrls.map((url) => ({
            competitor_id: comp.id,
            url: url.trim(),
            label: new URL(url.trim()).pathname.replace(/\//g, ' ').trim() || 'Home',
          }))
        )
        if (pagesErr) throw pagesErr
      }

      setName('')
      setWebsite('')
      setUrls([''])
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-gray-600 text-xs font-medium block mb-1.5">Competitor name</label>
          <div className="relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Crayon"
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>
        <div>
          <label className="text-gray-600 text-xs font-medium block mb-1.5">Website</label>
          <div className="relative">
            <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              required
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://crayon.co"
              type="url"
              className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-gray-600 text-xs font-medium block mb-1.5">Pages to monitor</label>
        <div className="space-y-2">
          {urls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={url}
                onChange={(e) => updateUrl(i, e.target.value)}
                placeholder="https://crayon.co/pricing"
                type="url"
                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  className="w-8 h-8 my-auto rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addUrl}
          className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add another page
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="bg-violet-600 hover:bg-violet-500 text-white w-full"
      >
        {loading ? 'Adding…' : 'Add competitor'}
      </Button>
    </form>
  )
}
