import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@pulse/ui/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    template: '%s | Pulse',
    default: 'Pulse — Modern Feedback Platform',
  },
  description: 'Collect customer and employee feedback across every channel.',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
