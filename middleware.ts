import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  } catch {
    // auth service unavailable — treat as unauthenticated
  }

  const { pathname } = request.nextUrl

  const isAuthRoute    = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAuthCallback = pathname.startsWith('/auth/')
  const isInviteRoute  = pathname.startsWith('/join/')
  const isOnboarding   = pathname.startsWith('/onboarding')
  const isPricingRoute = pathname.startsWith('/pricing')

  if (!user && !isAuthRoute && !isAuthCallback && !isInviteRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/map'
    return NextResponse.redirect(url)
  }

  // Onboarding check: skip if already on onboarding/pricing/auth/invite,
  // or if the sm_onboarded cookie is present (set after completing step 3)
  if (user && !isAuthRoute && !isInviteRoute && !isOnboarding && !isPricingRoute) {
    const alreadyOnboarded = request.cookies.has('sm_onboarded')

    if (!alreadyOnboarded) {
      try {
        const { data: mem } = await supabase
          .from('org_members')
          .select('org_id, organizations!inner(name)')
          .eq('user_id', user.id)
          .maybeSingle()

        const orgName = (mem?.organizations as { name?: string } | null)?.name
        if (!mem || orgName === 'My Organization') {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          return NextResponse.redirect(url)
        }

        // Org has a real name → set cookie so we don't check again
        supabaseResponse.cookies.set('sm_onboarded', '1', {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
      } catch {
        // Don't block the request if the check fails
      }
    }
  }

  supabaseResponse.headers.set('x-pathname', pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
