import type { Viewport } from 'next'

/**
 * Signage layout — full-screen display mode for lobbies / TV screens.
 * No scroll, no zoom, auto-refreshing dashboard.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function SignageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-zinc-950 text-white"
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  )
}
