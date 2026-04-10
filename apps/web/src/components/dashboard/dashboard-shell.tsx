interface DashboardShellProps {
  orgId: string
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-6 py-3">
        <span className="font-semibold">Pulse</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
