import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Copy, Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Tooltip } from './overlay'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-ctl font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-line-strong bg-panel text-ink hover:bg-sunken',
        ghost: 'text-ink hover:bg-ink/6',
        subtle: 'bg-primary/10 text-primary hover:bg-primary/16',
        accent: 'bg-accent text-on-accent hover:opacity-90',
        danger: 'bg-danger text-white hover:opacity-90 dark:text-bg',
        'danger-ghost': 'text-danger hover:bg-danger/10',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 min-w-7 px-2 text-xs [&_svg]:size-[14px]',
        sm: 'h-8 min-w-8 px-3 text-[13px] [&_svg]:size-4',
        md: 'h-9 min-w-9 px-4 text-sm',
        lg: 'h-11 min-w-11 px-5 text-[15px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean
  /** Shows a spinner and disables the button. */
  loading?: boolean
  /** Icon element placed before the label. */
  icon?: ReactNode
  /** Icon element placed after the label. */
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, icon, iconRight, children, disabled, type, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    )
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

export interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconRight' | 'children'> {
  /** Accessible name; also shown as a tooltip. */
  label: string
  icon: ReactNode
  /** Hide the tooltip (the label is still the accessible name). */
  noTooltip?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, noTooltip, variant = 'ghost', size = 'md', className, ...props },
  ref,
) {
  const btn = (
    <Button ref={ref} variant={variant} size={size} aria-label={label} className={cn('px-0', className)} {...props}>
      {icon}
    </Button>
  )
  return noTooltip ? btn : <Tooltip content={label}>{btn}</Tooltip>
})

/** Copies `value` to the clipboard (in-page only) and flips to a check for 1.5 s. */
export function CopyButton({
  value,
  label,
  size = 'sm',
  variant = 'ghost',
  withText = false,
  className,
}: {
  value: string
  label?: string
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  withText?: boolean
  className?: string
}) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } finally {
        area.remove()
      }
    }
    setCopied(true)
  }
  const text = copied ? t('actions.copied') : (label ?? t('actions.copy'))
  const icon = copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />
  if (withText) {
    return (
      <Button size={size} variant={variant} icon={icon} onClick={() => void onCopy()} className={className}>
        {text}
      </Button>
    )
  }
  return <IconButton size={size} variant={variant} label={text} icon={icon} onClick={() => void onCopy()} className={className} />
}
