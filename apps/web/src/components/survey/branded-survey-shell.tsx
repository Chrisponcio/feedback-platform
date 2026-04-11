'use client'

import { type ReactNode } from 'react'

interface Branding {
  primary_color?: string | null
  background_color?: string | null
  accent_color?: string | null
  font_family?: string | null
  logo_url?: string | null
  org_name?: string | null
}

interface BrandedSurveyShellProps {
  branding?: Branding | null
  children: ReactNode
}

/**
 * Injects per-survey CSS custom properties so child components can use
 * var(--brand-primary), var(--brand-bg), var(--brand-accent).
 * Falls back to Tailwind design tokens when branding is absent.
 */
export function BrandedSurveyShell({ branding, children }: BrandedSurveyShellProps) {
  const vars: Record<string, string> = {}
  if (branding?.primary_color) vars['--brand-primary'] = branding.primary_color
  if (branding?.background_color) vars['--brand-bg'] = branding.background_color
  if (branding?.accent_color) vars['--brand-accent'] = branding.accent_color
  if (branding?.font_family) vars['--brand-font'] = `'${branding.font_family}', var(--font-sans)`

  return (
    <div
      style={vars as React.CSSProperties}
      className="min-h-svh bg-[var(--brand-bg,hsl(var(--background)))]"
    >
      {/* Optional branded header */}
      {(branding?.logo_url || branding?.org_name) && (
        <header className="flex items-center justify-center border-b px-6 py-4">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={branding.org_name ?? 'Logo'}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span
              className="text-base font-semibold"
              style={{ color: branding?.primary_color ?? undefined }}
            >
              {branding?.org_name}
            </span>
          )}
        </header>
      )}

      <div className="font-[var(--brand-font,var(--font-sans))]">{children}</div>
    </div>
  )
}
