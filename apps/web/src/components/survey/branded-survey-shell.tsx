interface BrandedSurveyShellProps {
  branding: Record<string, string>
  children: React.ReactNode
}

export function BrandedSurveyShell({ branding, children }: BrandedSurveyShellProps) {
  const style = {
    '--brand-primary': branding.primary_color ?? '#0f172a',
    '--brand-accent': branding.accent_color ?? '#6366f1',
  } as React.CSSProperties

  return (
    <div style={style} className="min-h-svh bg-background">
      {children}
    </div>
  )
}
