'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/**
 * Graduated Realtime hook — uses Supabase Realtime for low-volume orgs,
 * falls back to snapshot polling at configurable intervals for high-volume.
 *
 * Threshold: If > REALTIME_THRESHOLD responses/day, switch to polling.
 * This prevents Realtime channel saturation at scale (200k+/month ≈ 6.7k/day).
 */

const REALTIME_THRESHOLD = 5000 // responses per day before switching to polling
const POLL_INTERVAL_MS = 5000  // 5-second polling when in poll mode

interface UseGraduatedRealtimeOptions {
  orgId: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  dailyResponseCount: number
  onEvent: (payload: unknown) => void
}

export function useGraduatedRealtime({
  orgId,
  table,
  event = 'INSERT',
  dailyResponseCount,
  onEvent,
}: UseGraduatedRealtimeOptions) {
  const [mode, setMode] = useState<'realtime' | 'polling'>(
    dailyResponseCount > REALTIME_THRESHOLD ? 'polling' : 'realtime'
  )
  const lastFetchRef = useRef<string>(new Date().toISOString())
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // Realtime mode
  useEffect(() => {
    if (mode !== 'realtime') return

    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`graduated-${orgId}-${table}`)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          onEventRef.current(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mode, orgId, table, event])

  // Polling mode
  useEffect(() => {
    if (mode !== 'polling') return

    const poll = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('organization_id', orgId)
        .gt('created_at', lastFetchRef.current)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data && data.length > 0) {
        for (const row of data) {
          onEventRef.current(row)
        }
        const lastRow = data[data.length - 1] as unknown as { created_at: string } | undefined
        if (lastRow) lastFetchRef.current = lastRow.created_at
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [mode, orgId, table])

  const switchMode = useCallback((newMode: 'realtime' | 'polling') => {
    setMode(newMode)
  }, [])

  return { mode, switchMode }
}
