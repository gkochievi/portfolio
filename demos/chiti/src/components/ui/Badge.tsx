import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

export const badgeVariants = cva('inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-medium [&_svg]:shrink-0', {
  variants: {
    tone: {
      neutral: 'bg-sunken text-ink border border-line',
      muted: 'bg-transparent text-muted border border-line',
      accent: 'bg-accent-soft text-accent',
      primary: 'bg-primary text-on-primary',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger',
      info: 'bg-info-soft text-info',
      ink: 'bg-ink text-bg',
      outline: 'border border-line-strong text-ink',
    },
    size: {
      sm: 'h-5 px-2 text-[11px] [&_svg]:size-3',
      md: 'h-6 px-2.5 text-xs [&_svg]:size-3.5',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
})

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: ReactNode
  /** Leading status dot in the badge's colour. */
  dot?: boolean
}

/** Pill-shaped label (status, counts, tags). */
export function Badge({ tone, size, icon, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}
/** Alias used in the plan. */
export const Pill = Badge

/** Small round count (unread etc.). Hidden when 0. */
export function CountBubble({ count, tone = 'primary', className }: { count: number | undefined; tone?: 'primary' | 'danger' | 'muted'; className?: string }) {
  if (!count) return null
  return (
    <span
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular',
        tone === 'primary' && 'bg-primary text-on-primary',
        tone === 'danger' && 'bg-danger text-on-accent',
        tone === 'muted' && 'bg-sunken text-muted',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
