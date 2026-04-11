interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'green' | 'amber' | 'red'
}

const accentMap = {
  default: 'text-foreground',
  green:   'text-emerald-600',
  amber:   'text-amber-600',
  red:     'text-red-600',
}

export function MetricCard({ label, value, sub, accent = 'default' }: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${accentMap[accent]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
