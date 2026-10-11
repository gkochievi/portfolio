import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'
import { Tooltip } from './Tooltip'

const iconButtonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center rounded-ui transition-colors duration-150 ease-chirp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        ghost: 'text-ink hover:bg-hover active:bg-sunken',
        muted: 'text-muted hover:bg-hover hover:text-ink',
        outline: 'border border-line-strong bg-panel text-ink hover:bg-hover',
        secondary: 'border-[1.5px] border-ink text-ink hover:bg-hover',
        primary: 'border-[1.5px] border-on-primary bg-primary text-on-primary shadow-hard active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        danger: 'text-danger hover:bg-danger-soft',
      },
      size: {
        xs: 'size-6 [&_svg]:size-3.5',
        sm: 'size-8 [&_svg]:size-4',
        md: 'size-9 [&_svg]:size-5',
        lg: 'size-11 [&_svg]:size-5',
      },
      round: { true: 'rounded-full' },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
)

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible name, also shown as the tooltip. */
  label: string
  icon: ReactNode
  /** Show the label as a tooltip (default true). */
  tooltip?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  loading?: boolean
  /** Small count bubble on the top-right corner (hidden when 0/undefined). */
  badge?: number
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tooltip = true, tooltipSide, loading, badge, active, className, variant, size, round, type, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      aria-pressed={active}
      className={cn(iconButtonVariants({ variant, size, round }), active && 'bg-accent-soft text-accent', className)}
      {...props}
    >
      {loading ? <Spinner size={16} /> : icon}
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-panel bg-danger px-1 text-[10px] font-semibold leading-none text-on-accent tabular">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
  return tooltip ? (
    <Tooltip content={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  )
})
