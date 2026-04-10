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

  const surveyUrl = token
    ? `${process.env.NEXT_PUBLIC_APP_URL}/s/${token}`
    : null

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
      if (result.error) {
        setError(result.error)
      } else if (result.token) {
        setToken(result.token)
      }
    })
  }

  function handleDeactivate() {
    if (!token) return
    startTransition(async () => {
      await deactivateDistribution(surveyId, token)
      setToken(null)
    })
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
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-medium text-green-600">Live</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your survey is accepting responses.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Survey URL
        </label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="flex-1 truncate text-xs font-mono">{surveyUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive hover:text-destructive"
        onClick={handleDeactivate}
        disabled={isPending}
      >
        {isPending ? 'Deactivating…' : 'Deactivate link'}
      </Button>
    </div>
  )
}
