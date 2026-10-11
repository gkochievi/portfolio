import { createContext, forwardRef, useContext, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import * as RT from '@radix-ui/react-tabs'

import { cn } from '@/lib/cn'
import { CountBubble } from './Badge'

type TabsVariant = 'underline' | 'pill'
const VariantCtx = createContext<TabsVariant>('underline')

export interface TabsProps extends ComponentPropsWithoutRef<typeof RT.Root> {
  /** 'underline' (page sections, default) or 'pill' (compact toggles inside cards). */
  variant?: TabsVariant
}

/** Radix tabs. Use <Tabs value onValueChange> + <TabsList> + <TabsTrigger value count?> + <TabsContent value>. */
export function Tabs({ variant = 'underline', className, ...props }: TabsProps) {
  return (
    <VariantCtx.Provider value={variant}>
      <RT.Root className={cn('flex min-w-0 flex-col', className)} {...props} />
    </VariantCtx.Provider>
  )
}

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RT.List>>(function TabsList({ className, ...props }, ref) {
  const variant = useContext(VariantCtx)
  return (
    <RT.List
      ref={ref}
      className={cn(
        'flex min-w-0 items-center overflow-x-auto',
        variant === 'underline' ? 'gap-5 border-b border-line' : 'w-fit gap-1 rounded-full border border-line bg-sunken p-1',
        className,
      )}
      {...props}
    />
  )
})

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof RT.Trigger> {
  count?: number
  icon?: ReactNode
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ className, count, icon, children, ...props }, ref) {
  const variant = useContext(VariantCtx)
  return (
    <RT.Trigger
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 [&_svg]:size-4',
        variant === 'underline'
          ? '-mb-px border-b-2 border-transparent px-0.5 pb-2.5 pt-1 text-muted hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink'
          : 'h-7 rounded-full px-3 text-[13px] text-muted hover:text-ink data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-[0_0_0_1px_var(--c-line)]',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined ? <CountBubble count={count} tone="muted" /> : null}
    </RT.Trigger>
  )
})

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RT.Content>>(function TabsContent({ className, ...props }, ref) {
  return <RT.Content ref={ref} className={cn('min-w-0 pt-4 focus-visible:outline-none', className)} {...props} />
})

export interface SegmentedOption<V extends string> {
  value: V
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: readonly SegmentedOption<V>[]
  size?: 'sm' | 'md'
  'aria-label'?: string
  className?: string
}

/** Radio-group style switcher (Live / 1h / 24h / 7d, Online / Away). */
export function SegmentedControl<V extends string>({ value, onChange, options, size = 'md', className, ...rest }: SegmentedControlProps<V>) {
  return (
    <div role="radiogroup" aria-label={rest['aria-label']} className={cn('inline-flex w-fit items-center gap-0.5 rounded-ui border border-line bg-sunken p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[8px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-45 [&_svg]:size-4',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--c-line)]' : 'text-muted hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
