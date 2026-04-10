import type { Viewport } from 'next'

/**
 * Kiosk layout — full-screen, no browser chrome.
 * Blocks pinch-zoom, scroll, and all standard browser navigation UI.
 * Designed to run as a PWA (display: fullscreen) on iPad/Android tablets.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 overflow-hidden bg-background"
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  )
}
