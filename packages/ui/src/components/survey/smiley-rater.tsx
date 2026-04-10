'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

interface SmileyOption {
  value: number
  label: string
  /** Accessible description of the face expression */
  description: string
}

const DEFAULT_OPTIONS: SmileyOption[] = [
  { value: 1, label: '😡', description: 'Very unhappy' },
  { value: 2, label: '😟', description: 'Unhappy' },
  { value: 3, label: '😐', description: 'Neutral' },
  { value: 4, label: '😊', description: 'Happy' },
  { value: 5, label: '😍', description: 'Very happy' },
]

interface SmileyRaterProps {
  value: number | null
  onChange: (value: number) => void
  options?: SmileyOption[]
  size?: 'sm' | 'md' | 'lg' | 'kiosk'
  disabled?: boolean
  className?: string
}

const sizeMap = {
  sm: 'text-3xl gap-2',
  md: 'text-4xl gap-3',
  lg: 'text-5xl gap-4',
  kiosk: 'text-7xl gap-6',
}

const buttonSizeMap = {
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
  kiosk: 'p-5',
}

const labelSizeMap = {
  sm: 'text-xs mt-1',
  md: 'text-sm mt-1',
  lg: 'text-sm mt-2',
  kiosk: 'text-base mt-2',
}

export function SmileyRater({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'md',
  disabled = false,
  className,
}: SmileyRaterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Satisfaction rating"
      className={cn('flex items-center justify-center', sizeMap[size], className)}
    >
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <div key={option.value} className="flex flex-col items-center">
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={option.description}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'relative flex items-center justify-center rounded-full transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-40',
                buttonSizeMap[size],
                isSelected
                  ? 'scale-125 drop-shadow-lg'
                  : 'opacity-60 hover:opacity-90 hover:scale-110'
              )}
            >
              <span
                className={cn(
                  'select-none transition-all duration-200 leading-none',
                  isSelected && 'animate-[bounce_0.3s_ease-out_1]'
                )}
                aria-hidden="true"
              >
                {option.label}
              </span>
            </button>
            <span
              className={cn(
                'text-muted-foreground font-medium transition-colors',
                labelSizeMap[size],
                isSelected && 'text-foreground'
              )}
            >
              {option.description}
            </span>
          </div>
        )
      })}
    </div>
  )
}
