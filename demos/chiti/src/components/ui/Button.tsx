import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-ui font-medium transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-chirp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Yellow fill, ink text, 1.5px ink border, hard offset shadow; presses 2px and drops the shadow. */
        primary:
          'border-[1.5px] border-on-primary bg-primary font-semibold text-on-primary shadow-hard hover:bg-primary-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        /** Transparent with a 1.5px ink border. */
        secondary: 'border-[1.5px] border-ink bg-transparent text-ink hover:bg-hover active:bg-sunken',
        /** Olive fill, for confirm actions inside dense UI. */
        accent: 'border border-transparent bg-accent text-on-accent hover:bg-accent-hover',
        /** Hairline outline, quieter than secondary. */
        outline: 'border border-line-strong bg-panel text-ink hover:bg-hover',
        ghost: 'border border-transparent bg-transparent text-ink hover:bg-hover active:bg-sunken',
        subtle: 'border border-transparent bg-sunken text-ink hover:bg-hover',
        danger: 'border border-transparent bg-danger text-on-accent hover:opacity-90',
        'danger-outline': 'border border-danger bg-transparent text-danger hover:bg-danger-soft',
        link: 'h-auto border-0 px-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-4',
        md: 'h-9 px-4 text-sm [&_svg]:size-[18px]',
        lg: 'h-11 px-5 text-[15px] [&_svg]:size-5',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, leftIcon, rightIcon, children, disabled, type, ...props },
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
    <button ref={ref} type={type ?? 'button'} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner size={size === 'lg' ? 18 : 15} /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  )
})
