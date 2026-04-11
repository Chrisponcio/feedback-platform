'use client'

import { useEffect, useState } from 'react'

interface IdleScreenProps {
  orgName?: string
  logoUrl?: string
  accentColor?: string
  onStart: () => void
}

/**
 * Full-screen attract loop shown when the kiosk is idle.
 * Pulses a "tap to start" prompt with a soft breathing animation.
 */
export function IdleScreen({ orgName, logoUrl, accentColor = '#6366f1', onStart }: IdleScreenProps) {
  const [pulse, setPulse] = useState(false)

  // Breathing pulse cycle
  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <button
      className="fixed inset-0 flex cursor-pointer flex-col items-center justify-center gap-8 bg-background text-center"
      onClick={onStart}
      onTouchEnd={(e) => { e.preventDefault(); onStart() }}
      aria-label="Tap to start survey"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Logo or org name */}
      <div className="flex flex-col items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={orgName ?? 'Logo'}
            className="h-20 w-auto object-contain"
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-lg"
            style={{ background: accentColor }}
          >
            {orgName?.[0]?.toUpperCase() ?? 'P'}
          </div>
        )}
        {orgName && (
          <p className="text-xl font-semibold text-foreground">{orgName}</p>
        )}
      </div>

      {/* Tap prompt with breathing animation */}
      <div
        className="flex flex-col items-center gap-4 transition-all duration-[1800ms] ease-in-out"
        style={{ opacity: pulse ? 1 : 0.45, transform: pulse ? 'scale(1.04)' : 'scale(0.97)' }}
      >
        {/* Ripple circle */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute h-24 w-24 animate-ping rounded-full opacity-20"
            style={{ background: accentColor }}
          />
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ background: `${accentColor}22` }}
          >
            👋
          </span>
        </div>

        <p className="text-2xl font-bold tracking-tight text-foreground">
          Share your feedback
        </p>
        <p className="text-base text-muted-foreground">
          Tap anywhere to begin
        </p>
      </div>
    </button>
  )
}
