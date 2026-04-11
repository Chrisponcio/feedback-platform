'use client'

import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'pointerdown',
  'scroll',
] as const

interface UseIdleTimeoutOptions {
  /** Idle duration in seconds before onIdle fires */
  timeoutSeconds: number
  /** Called when the user has been idle for timeoutSeconds */
  onIdle: () => void
  /** Whether the timeout is active (false = paused) */
  enabled?: boolean
}

/**
 * Fires onIdle after timeoutSeconds of no user interaction.
 * Resets on any touch, mouse, or keyboard event.
 */
export function useIdleTimeout({
  timeoutSeconds,
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!enabled) return
    timerRef.current = setTimeout(() => {
      onIdleRef.current()
    }, timeoutSeconds * 1000)
  }, [timeoutSeconds, enabled])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    reset()

    const handleActivity = () => reset()

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, [enabled, reset])

  return { reset }
}
