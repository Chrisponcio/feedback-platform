import { Suspense } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span className="text-primary">Pulse</span>
          </div>
        </div>
        <Suspense>{children}</Suspense>
      </div>
    </div>
  )
}
