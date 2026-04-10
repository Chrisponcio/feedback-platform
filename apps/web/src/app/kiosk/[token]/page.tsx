'use client'

import { useEffect } from 'react'
import { KioskRunner } from '@/components/kiosk/kiosk-runner'

interface KioskPageProps {
  params: Promise<{ token: string }>
}

export default function KioskPage({ params }: KioskPageProps) {
  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw-kiosk.js', { scope: '/kiosk/' })
        .catch(console.error)
    }
  }, [])

  return <KioskRunner paramsPromise={params} />
}
