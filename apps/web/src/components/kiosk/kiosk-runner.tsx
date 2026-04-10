'use client'

import { use } from 'react'

interface KioskRunnerProps {
  paramsPromise: Promise<{ token: string }>
}

export function KioskRunner({ paramsPromise }: KioskRunnerProps) {
  const { token } = use(paramsPromise)

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center text-muted-foreground">
        <p className="text-lg font-medium">Kiosk mode</p>
        <p className="text-sm">Token: {token} — kiosk runner coming in Phase 2</p>
      </div>
    </div>
  )
}
