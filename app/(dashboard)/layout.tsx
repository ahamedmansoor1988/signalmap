import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import DashboardNav from '@/components/ui/dashboard-nav'
import SignalNotifier from '@/components/ui/signal-notifier'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  } catch {
    // auth service unavailable — treat as signed out
  }

  if (!user) redirect('/login')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isOnboarding = pathname.startsWith('/onboarding')

  if (isOnboarding) {
    return (
      <div className="h-screen overflow-hidden bg-gray-50">
        <main className="h-full">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SignalNotifier />
      <DashboardNav user={user} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
