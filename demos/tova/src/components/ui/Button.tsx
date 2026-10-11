/**
 * Arcade-key buttons: 10px radius, primary has a 3px darker bottom edge that
 * presses down on :active. No pill shapes. Sizes: sm 36px (admin toolbars),
 * md 48px (default), lg 56px (player screens).
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-card font-semibold',
    'transition-[transform,box-shadow,background-color,border-color,color,filter] duration-100',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-on-primary shadow-[0_3px_0_var(--color-primary-edge)] hover:brightness-[1.07] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-primary-edge)]',
        accent:
          'bg-accent text-on-accent shadow-[0_3px_0_var(--color-accent-ink)] hover:brightness-[1.05] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-accent-ink)]',
        secondary: 'border-[1.5px] border-primary bg-panel text-primary hover:bg-primary-soft active:translate-y-px',
        outline: 'border-[1.5px] border-line bg-panel text-ink hover:border-line-strong hover:bg-sunken active:translate-y-px',
        ghost: 'text-ink hover:bg-sunken active:translate-y-px',
        danger:
          'bg-danger text-on-danger shadow-[0_3px_0_var(--color-danger-edge)] hover:brightness-[1.07] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-danger-edge)]',
        'danger-ghost': 'text-danger hover:bg-danger-soft active:translate-y-px',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-12 px-5 text-[15px] [&_svg]:size-5',
        lg: 'h-14 px-6 text-base [&_svg]:size-5',
      },
      block: { true: 'w-full', false: '' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router <Link>) with button styling. */
  asChild?: boolean
  /** Shows a spinner and disables the button. */
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, loading = false, leftIcon, rightIcon, children, disabled, type, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, block }), className)
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
      {loading ? <Spinner className="size-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-card transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        ghost: 'text-muted hover:bg-sunken hover:text-ink',
        outline: 'border-[1.5px] border-line bg-panel text-ink hover:border-line-strong hover:bg-sunken',
        primary: 'bg-primary text-on-primary hover:brightness-[1.07]',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'size-8 [&_svg]:size-4',
        md: 'size-10 [&_svg]:size-5',
        lg: 'size-12 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
)

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible name; also the native tooltip. Required. */
  label: string
  icon: ReactNode
  loading?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant, size, className, loading, disabled, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
    </button>
  )
})
