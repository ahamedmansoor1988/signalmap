import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
