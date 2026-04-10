import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Routes that are publicly accessible without authentication.
 * Matched against the full pathname.
 */
const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
])

/**
 * Route prefixes that bypass auth entirely (survey respondents, kiosk sync, etc.)
 */
const PUBLIC_PREFIXES = [
  '/s/',           // Public survey pages
  '/embed/',       // Embedded survey widget
  '/api/submit',   // Response submission (service role auth)
  '/api/auth',     // Supabase auth callbacks
  '/api/webhooks', // Incoming webhooks
  '/_next/',       // Next.js internals
  '/favicon',
  '/manifest',
  '/icons/',
  '/sw-kiosk.js',  // Kiosk service worker
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public prefixes through — no session refresh needed
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Refresh session and get current user
  const { supabaseResponse, user } = await updateSession(request)

  // Public routes — redirect to dashboard if already authenticated
  if (PUBLIC_ROUTES.has(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL('/surveys', request.url))
    }
    return supabaseResponse
  }

  // Dashboard routes (everything else) — require authentication
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Inject org context into request headers for Server Components
  const orgId = user.app_metadata?.organization_id as string | undefined
  const role = user.app_metadata?.role as string | undefined

  if (orgId) {
    supabaseResponse.headers.set('x-organization-id', orgId)
  }
  if (role) {
    supabaseResponse.headers.set('x-org-role', role)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static files and Next.js internals.
     * This is the recommended pattern from the Supabase SSR docs.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
