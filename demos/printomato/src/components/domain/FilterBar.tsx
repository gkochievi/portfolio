import type { ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

/** Filters always sit in one row above the content they filter. */
export function FilterBar({
  children,
  active,
  onClear,
  className,
}: {
  children: ReactNode
  active?: number
  onClear?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('panel mb-4 p-3 sm:p-3.5', className)}>
      <div className="flex flex-wrap items-end gap-2.5">{children}</div>
      {Boolean(active) && onClear && (
        <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-2.5">
          <SlidersHorizontal className="size-3.5 text-gold" />
          <span className="text-xs text-ink-faint">
            {active} {active === 1 ? 'filter' : 'filters'} active
          </span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-gold-bright"
          >
            <X className="size-3" />
            {t('common.clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}

export function FilterSlot({
  label,
  children,
  className,
  as: Wrapper = 'label',
}: {
  label: string
  children: ReactNode
  className?: string
  /** `div` for children that are buttons (SegmentedControl): a label's click
   *  forwards to its first labelable descendant, so a caption click would
   *  press the first segment and reset the filter. Buttons name themselves. */
  as?: 'label' | 'div'
}) {
  return (
    // A <label> rather than a <div>: the caption is the accessible name for the
    // select / date input inside, which were otherwise unnamed controls.
    <Wrapper className={cn('flex min-w-[8.5rem] flex-1 flex-col gap-1.5', className)}>
      <span className="label-caps">{label}</span>
      {children}
    </Wrapper>
  )
}

/** Compact pill group for two-to-four mutually exclusive states. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  className?: string
  /** Group name for assistive tech — the buttons are not a labelable control. */
  label?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex h-10 items-center gap-0.5 rounded-control border border-hairline-strong bg-void/60 p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-[7px] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            value === option.value
              ? 'bg-gold/15 text-gold'
              : 'text-ink-faint hover:bg-white/5 hover:text-ink-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
