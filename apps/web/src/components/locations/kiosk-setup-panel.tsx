'use client'

import { useState, useTransition } from 'react'
import { createKioskDistribution } from '@/lib/location-actions'

interface KioskSetupPanelProps {
  locationId: string
  surveys: { id: string; title: string }[]
  /** @deprecated kept for backwards compatibility; URL is derived from window.location.origin at click time */
  appUrl?: string
}

export function KioskSetupPanel({ locationId, surveys }: KioskSetupPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [kioskUrl, setKioskUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSetup() {
    if (!selectedSurveyId) return
    setError(null)
    startTransition(async () => {
      const result = await createKioskDistribution(locationId, selectedSurveyId)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('token' in result && result.token) {
        // Derive base URL from the user's actual browser origin so kiosk
        // URLs match the domain serving the dashboard.
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        setKioskUrl(`${baseUrl}/kiosk/${result.token}`)
      }
    })
  }

  function handleCopy() {
    if (!kioskUrl) return
    navigator.clipboard.writeText(kioskUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kiosk</p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {kioskUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-1.5">
            <span className="flex-1 truncate font-mono text-xs">{kioskUrl}</span>
            <button onClick={handleCopy} className="text-xs text-primary hover:underline">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <a
            href={kioskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Open kiosk ↗
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleSetup}
            disabled={isPending || !selectedSurveyId}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? 'Setting up…' : 'Set up kiosk'}
          </button>
        </div>
      )}

      {kioskUrl && (
        <p className="text-xs text-muted-foreground">
          Open this URL on your kiosk device and add to Home Screen for fullscreen mode.
        </p>
      )}
    </div>
  )
}
