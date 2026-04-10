'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

interface NpsScaleProps {
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
  labelMin?: string
  labelMax?: string
  size?: 'sm' | 'md' | 'lg' | 'kiosk'
  disabled?: boolean
  className?: string
}

/** NPS color: 0-6 = red (detractor), 7-8 = amber (passive), 9-10 = green (promoter) */
function getNpsColor(score: number, isSelected: boolean, isHovered: boolean): string {
  if (!isSelected && !isHovered) return 'bg-muted text-muted-foreground border border-border'
  if (score <= 6) return 'bg-red-500 text-white border-red-600 shadow-red-200'
  if (score <= 8) return 'bg-amber-400 text-amber-900 border-amber-500 shadow-amber-200'
  return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200'
}

const buttonSizeMap = {
  sm: 'h-8 w-8 text-xs rounded-md',
  md: 'h-10 w-10 text-sm rounded-md',
  lg: 'h-12 w-12 text-base rounded-lg',
  kiosk: 'h-16 w-16 text-lg rounded-xl font-bold',
}

export function NpsScale({
  value,
  onChange,
  min = 0,
  max = 10,
  labelMin = 'Not at all likely',
  labelMax = 'Extremely likely',
  size = 'md',
  disabled = false,
  className,
}: NpsScaleProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const scores = Array.from({ length: max - min + 1 }, (_, i) => i + min)

  return (
    <div className={cn('w-full', className)}>
      <div
        role="radiogroup"
        aria-label="Net Promoter Score"
        className="flex flex-wrap justify-center gap-1.5"
      >
        {scores.map((score) => {
          const isSelected = value === score
          const isHovered = hovered === score
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${score} out of ${max}`}
              disabled={disabled}
              onClick={() => onChange(score)}
              onMouseEnter={() => setHovered(score)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'flex items-center justify-center border font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-40',
                buttonSizeMap[size],
                getNpsColor(score, isSelected, isHovered),
                isSelected && 'scale-110 shadow-md',
                !isSelected && !isHovered && 'hover:scale-105'
              )}
            >
              {score}
            </button>
          )
        })}
      </div>

      {/* Endpoint labels */}
      <div className="mt-3 flex justify-between px-1">
        <span className="text-xs text-muted-foreground">{labelMin}</span>
        <span className="text-xs text-muted-foreground">{labelMax}</span>
      </div>

      {/* NPS zone legend (shown when a value is selected) */}
      {value !== null && (
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground animate-[fade-in_0.2s_ease-out]">
          <span className={cn(value <= 6 && 'text-red-600 font-semibold')}>
            0–6: Detractor
          </span>
          <span className={cn(value >= 7 && value <= 8 && 'text-amber-600 font-semibold')}>
            7–8: Passive
          </span>
          <span className={cn(value >= 9 && 'text-emerald-600 font-semibold')}>
            9–10: Promoter
          </span>
        </div>
      )}
    </div>
  )
}
