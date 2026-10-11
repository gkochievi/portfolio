import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Tooltip } from './overlay'

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-sans font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Primary CTA: the "dial key" - carbon with a lime label. */
        dial: 'bg-carbon text-on-carbon hover:bg-[#26322F] dark:ring-1 dark:ring-inset dark:ring-hairline-strong dark:hover:bg-[#22302D]',
        /** Reserved for the call itself: Call, Connect, Next lead, Answer. */
        call: 'bg-lime text-on-lime hover:bg-[#B3E33A]',
        outline: 'border border-ink/80 bg-transparent text-ink hover:bg-ink/5 dark:border-hairline-strong dark:hover:bg-ink/8',
        ghost: 'bg-transparent text-ink hover:bg-ink/6',
        subtle: 'bg-sunken text-ink hover:bg-ink/8',
        danger: 'bg-danger text-white hover:bg-danger/90 dark:text-paper',
        link: 'h-auto px-0 text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink',
      },
      size: {
        xs: 'h-7 min-w-7 px-2 text-xs',
        sm: 'h-8 min-w-8 px-3 text-[13px]',
        md: 'h-9 min-w-9 px-4 text-sm',
        lg: 'h-11 min-w-11 px-5 text-[15px]',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto min-w-0 px-0' }],
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Icon before the label (lucide element, 18px recommended). */
  icon?: ReactNode
  /** Icon after the label. */
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, icon, iconRight, children, disabled, type, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 size={16} strokeWidth={2} className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconRight' | 'children'> {
  /** Required accessible name; also shown as a tooltip unless `tooltip={false}`. */
  label: string
  icon: ReactNode
  tooltip?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tooltip = true, variant = 'ghost', size = 'md', className, ...props },
  ref,
) {
  const btn = (
    <Button ref={ref} variant={variant} size={size} aria-label={label} className={cn('px-0', className)} {...props}>
      {icon}
    </Button>
  )
  return tooltip ? <Tooltip content={label}>{btn}</Tooltip> : btn
})
