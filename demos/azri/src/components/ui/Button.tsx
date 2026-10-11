/**
 * Button (pill) and IconButton. Owner: design-system agent.
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { BarsLoader } from './Feedback'
import { Tooltip } from './Overlay'

export const buttonVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,border-color,transform,filter] duration-200 ease-azri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        /** Tenant colour inside the respondent frame (var --brand). */
        brand: 'bg-brand text-on-brand hover:brightness-110',
        secondary: 'border border-border-strong bg-panel text-ink hover:border-ink/35 hover:bg-panel-2',
        soft: 'bg-primary-soft text-on-primary-soft hover:brightness-95 dark:hover:brightness-125',
        ghost: 'text-ink hover:bg-ink/6',
        danger: 'bg-danger text-on-danger hover:brightness-110',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3.5 text-[13px] [&_svg]:size-4',
        md: 'h-10 px-4.5 text-sm [&_svg]:size-[18px]',
        lg: 'h-12 px-6 text-[15px] [&_svg]:size-5',
        /** 56px full-width pill (respondent sticky action). */
        xl: 'h-14 w-full px-7 text-[17px] [&_svg]:size-5',
      },
    },
    compoundVariants: [{ variant: 'link', class: 'h-auto rounded-md px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router <Link>) with button styling. */
  asChild?: boolean
  /** Shows the bars loader, disables the button, keeps its width. */
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, leftIcon, rightIcon, fullWidth, children, disabled, type, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), fullWidth && 'w-full', className)
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">
            {leftIcon}
            {children}
            {rightIcon}
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <BarsLoader size="sm" label="" className="text-current" />
          </span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  )
})

const iconSizes = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-5',
  lg: 'size-12 [&_svg]:size-5',
} as const

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name (also the tooltip text). Required. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'secondary' | 'primary' | 'soft' | 'danger' | 'brand'
  size?: keyof typeof iconSizes
  /** Show `label` in a tooltip on hover/focus (default true). */
  tooltip?: boolean
  /** Toggle state for icon toggles. */
  pressed?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', tooltip = true, pressed, className, type, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        buttonVariants({ variant }),
        'px-0',
        iconSizes[size],
        pressed && 'bg-primary-soft text-on-primary-soft',
        variant === 'ghost' && 'text-muted hover:text-ink',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button
})
