/**
 * Public survey layout — no authentication required.
 * Branding (colors, logo) is applied dynamically per survey inside SurveyRunner.
 */
export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
