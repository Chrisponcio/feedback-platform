import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@pulse/db'

/**
 * Handles Supabase auth redirects:
 *   - Email confirmation (signup)
 *   - Magic link login
 *   - Password reset
 *   - OAuth callbacks (future)
 *
 * Supabase redirects here with ?code=... after the user clicks the email link.
 * We exchange the code for a session, then send the user to the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/surveys'
  const error = searchParams.get('error')

  // Surface auth errors back to the login page
  if (error) {
    const desc = searchParams.get('error_description') ?? error
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(desc)}`
    )
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return response
    }
  }

  // Fallback — something went wrong, send to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
