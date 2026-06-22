'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const next = new URLSearchParams(window.location.search).get('next')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: value prop panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col justify-between px-12 py-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">SM</span>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">SignalMap</span>
        </div>

        {/* Tagline + bullets */}
        <div className="max-w-sm">
          <h1 className="text-white text-3xl font-bold leading-snug mb-8">
            Know what your competitors are doing before your team asks
          </h1>

          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <span className="text-xl shrink-0 mt-0.5">⚡</span>
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">7-day signal timeline</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Get notified when competitors update pricing, launch features, or change messaging
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-xl shrink-0 mt-0.5">🗺</span>
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">Visual market map</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  See the entire competitive landscape in one view
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-xl shrink-0 mt-0.5">⚔</span>
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">AI battle cards</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Instant positioning guidance against any competitor
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs">Trusted by PMM teams at B2B SaaS companies</p>
      </div>

      {/* ── Right: auth panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">SM</span>
              </div>
              <span className="text-gray-900 text-xl font-semibold tracking-tight">SignalMap</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h2 className="text-gray-900 text-2xl font-bold mb-2">Welcome to SignalMap</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Sign in to your competitive intelligence workspace
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="text-red-500 text-xs text-center mt-3">{error}</p>
          )}

          {/* Legal */}
          <p className="text-gray-400 text-xs text-center mt-4">
            By continuing, you agree to our Terms of Service
          </p>

          {/* Footer note */}
          <p className="text-gray-400 text-xs text-center mt-6 leading-relaxed">
            New to SignalMap? Your account is created automatically on first sign in.
          </p>
        </div>
      </div>
    </div>
  )
}
