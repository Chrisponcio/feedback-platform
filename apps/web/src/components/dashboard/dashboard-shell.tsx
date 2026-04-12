'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/supabase/auth-actions'

const NAV = [
  { href: '/surveys',   label: 'Surveys' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/reports',      label: 'Reports' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/pulse',     label: 'Pulse' },
  { href: '/workflows', label: 'Workflows' },
  { href: '/locations', label: 'Locations' },
  { href: '/team',      label: 'Team' },
  { href: '/settings',  label: 'Settings' },
]

interface DashboardShellProps {
  orgId: string
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-tight text-primary">Pulse</span>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  ].join(' ')}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
