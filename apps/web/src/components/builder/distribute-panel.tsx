'use client'

import { useTransition, useState } from 'react'
import { Button } from '@pulse/ui'
import { createWebDistribution, deactivateDistribution } from '@/lib/distribution-actions'

interface DistributePanelProps {
  surveyId: string
  existingToken: string | null
}

export function DistributePanel({ surveyId, existingToken }: DistributePanelProps) {
  const [isPending, startTransition] = useTransition()
  const [token, setToken] = useState<string | null>(existingToken)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const surveyUrl = token ? `${appUrl}/s/${token}` : null

  function handleCopy() {
    if (!surveyUrl) return
    navigator.clipboard.writeText(surveyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePublish() {
    setError(null)
    startTransition(async () => {
      const result = await createWebDistribution(surveyId)
      if (result.error) { setError(result.error) }
      else if (result.token) { setToken(result.token) }
    })
  }

  function handleDeactivate() {
    if (!token) return
    startTransition(async () => {
      await deactivateDistribution(surveyId, token)
      setToken(null)
      setQrUrl(null)
    })
  }

  async function handleGenerateQr() {
    setQrLoading(true)
    try {
      const res = await fetch('/api/survey/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) setQrUrl(data.url)
      else setError(data.error ?? 'Failed to generate QR code')
    } catch {
      setError('Failed to generate QR code')
    } finally {
      setQrLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h3 className="font-medium">Web link</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a shareable link. The survey will be set to active.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={handlePublish} disabled={isPending}>
          {isPending ? 'Publishing…' : 'Publish & get link'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-green-600">Live</span>
        <span className="text-sm text-muted-foreground">— accepting responses</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Survey URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Survey URL
        </label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="flex-1 truncate font-mono text-xs">{surveyUrl}</span>
          <button onClick={handleCopy} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <a href={surveyUrl ?? '#'} target="_blank" rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Open in new tab ↗
        </a>
      </div>

      {/* QR Code */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          QR Code
        </label>
        {qrUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Survey QR code" className="h-40 w-40 rounded-lg border bg-white p-2" />
            <div className="flex gap-2">
              <a href={qrUrl} download="survey-qr.png"
                className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                Download PNG
              </a>
              <button onClick={() => navigator.clipboard.writeText(qrUrl)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                Copy URL
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleGenerateQr} disabled={qrLoading}
            className="w-full rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
            {qrLoading ? 'Generating…' : '+ Generate QR code'}
          </button>
        )}
      </div>

      <div className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive"
          onClick={handleDeactivate} disabled={isPending}>
          {isPending ? 'Deactivating…' : 'Deactivate link'}
        </Button>
      </div>
    </div>
  )
}
