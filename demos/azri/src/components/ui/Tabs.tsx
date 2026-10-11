/**
 * Tabs (Radix) with an underline or pill look, and SegmentedControl (a
 * compact radiogroup for 2-4 choices: windows, modes, languages).
 * Owner: design-system agent.
 */
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { createContext, forwardRef, useContext, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type TabsVariant = 'underline' | 'pill'
const VariantContext = createContext<TabsVariant>('underline')

/** Radix Tabs root: value / defaultValue / onValueChange. */
export const Tabs = TabsPrimitive.Root
export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(function TabsContent(
  { className, ...props },
  ref,
) {
  return <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
})

export interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList({ variant = 'underline', className, ...props }, ref) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          'scrollbar-none flex max-w-full items-center overflow-x-auto',
          variant === 'underline' ? 'gap-5 border-b border-border' : 'w-fit gap-1 rounded-full bg-ink/6 p-1',
          className,
        )}
        {...props}
      />
    </VariantContext.Provider>
  )
})

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  count?: number | string
  icon?: ReactNode
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ count, icon, className, children, ...props }, ref) {
  const variant = useContext(VariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'group inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 [&_svg]:size-4',
        variant === 'underline'
          ? '-mb-px h-10 border-b-2 border-transparent text-muted hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink'
          : 'h-8 rounded-full px-3.5 text-muted hover:text-ink data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-ink/7 px-1.5 py-0.5 text-[11px] font-semibold tabular text-muted group-data-[state=active]:bg-primary-soft group-data-[state=active]:text-on-primary-soft">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  )
})

/* -------------------------------------------------------- SegmentedControl */

export interface SegmentOption<V extends string> {
  value: V
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: SegmentOption<V>[]
  size?: 'sm' | 'md'
  /** Accessible name of the group. */
  label: string
  fullWidth?: boolean
  className?: string
}

/** Pill radiogroup; arrow keys move the selection. */
export function SegmentedControl<V extends string>({ value, onChange, options, size = 'md', label, fullWidth, className }: SegmentedControlProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const enabled = options.filter((o) => !o.disabled)
  const move = (delta: number) => {
    const current = enabled.findIndex((o) => o.value === value)
    const next = enabled[(current + delta + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.value)
    refs.current[options.indexOf(next)]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-border bg-panel p-0.5', fullWidth && 'flex w-full', className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-200 ease-azri focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-40 [&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              fullWidth && 'flex-1',
              checked ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
