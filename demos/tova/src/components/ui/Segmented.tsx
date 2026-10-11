import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when the label is an icon. */
  title?: string
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  size?: 'sm' | 'md'
  /** Stretch segments to fill the width. */
  block?: boolean
  'aria-label': string
  className?: string
}

/** 6px-radius segmented control (KA/EN toggle, difficulty, speed, filters). */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', block, className, ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex rounded-chip border-[1.5px] border-line bg-sunken p-0.5', block && 'flex w-full', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.title}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
              event.preventDefault()
              const enabled = options.filter((o) => !o.disabled)
              const index = enabled.findIndex((o) => o.value === value)
              const next = enabled[(index + (event.key === 'ArrowRight' ? 1 : enabled.length - 1)) % enabled.length]
              if (next) onChange(next.value)
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] font-semibold transition-colors disabled:opacity-50 [&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
              block && 'flex-1',
              active ? 'bg-panel text-ink shadow-[0_1px_0_var(--color-line),0_2px_6px_-3px_rgb(11_42_49/0.3)]' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
