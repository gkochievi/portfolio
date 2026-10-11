import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/cn'

import { Tooltip } from './overlay'

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,color,border-color,opacity] duration-150 ease-rigi disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-ink/80 bg-transparent text-ink hover:bg-ink/5',
        outline: 'border border-hairline-strong bg-panel text-ink hover:border-ink/40 hover:bg-sunken',
        ghost: 'bg-transparent text-ink hover:bg-ink/6',
        destructive: 'bg-danger text-on-danger hover:bg-danger/90',
        'destructive-ghost': 'bg-transparent text-danger hover:bg-danger/10',
        link: 'h-auto px-0 text-ink underline decoration-signal decoration-2 underline-offset-4 hover:text-primary',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-4 text-sm',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child (e.g. a router <Link>) with button styles. */
  asChild?: boolean
  /** Shows a spinner and disables the button. */
  loading?: boolean
  /** Icon before the label. */
  icon?: ReactNode
  /** Icon after the label. */
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, icon, iconRight, disabled, children, type, ...props },
  ref,
) {
  if (asChild) {
    return <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Slot>
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also the tooltip text. Required. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'outline' | 'primary' | 'destructive-ghost'
  size?: 'sm' | 'md'
  /** Show the label as a tooltip on hover. Default true. */
  tooltip?: boolean
  loading?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', tooltip = true, loading, className, disabled, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size: 'md' }),
        size === 'sm' ? 'size-8 px-0' : 'size-9 px-0',
        'text-muted hover:text-ink',
        variant === 'primary' && 'text-on-primary hover:text-on-primary',
        variant === 'destructive-ghost' && 'text-danger hover:text-danger',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
    </button>
  )
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button
})

export interface CopyButtonProps {
  value: string
  /** Visible label; omit for an icon-only button. */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Copies `value` to the clipboard and confirms with a toast. */
export function CopyButton({ value, label, size = 'sm', className }: CopyButtonProps) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      /* clipboard can be blocked inside iframes; still confirm */
    }
    setCopied(true)
    toast.success(t('actions.copied'))
    window.setTimeout(() => setCopied(false), 1600)
  }
  const icon = copied ? <Check aria-hidden /> : <Copy aria-hidden />
  if (!label) return <IconButton label={t('actions.copy')} icon={icon} size={size} onClick={copy} className={className} />
  return (
    <Button variant="outline" size={size === 'sm' ? 'sm' : 'md'} icon={icon} onClick={copy} className={className}>
      {label}
    </Button>
  )
}
