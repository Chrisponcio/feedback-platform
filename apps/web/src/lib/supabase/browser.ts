'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@pulse/db/types'

/**
 * Singleton browser-side Supabase client for Client Components.
 * Use this for:
 *   - Supabase Realtime subscriptions (live dashboard)
 *   - Auth state listeners (onAuthStateChange)
 *
 * Do NOT use this for initial data fetching — prefer Server Components
 * with the server client + TanStack Query's HydrationBoundary.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
