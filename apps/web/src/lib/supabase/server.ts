import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@pulse/db'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads the user session from cookies and applies RLS automatically.
 *
 * Usage:
 *   const supabase = await createServerClient()
 *   const { data } = await supabase.from('surveys').select(...)
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore;
            // middleware handles session refresh
          }
        },
      },
    }
  )
}

/**
 * Service-role Supabase client — bypasses RLS entirely.
 * ONLY use in API routes and Server Actions for operations that don't have a user session
 * (e.g., anonymous survey submission, invitation validation, cron jobs).
 *
 * NEVER import this in Client Components or expose to the browser.
 *
 * Usage:
 *   const supabase = createServiceRoleClient()
 *   const { data } = await supabase.from('responses').insert(...)
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
