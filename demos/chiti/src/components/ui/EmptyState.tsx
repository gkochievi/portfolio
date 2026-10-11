import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { NestIllustration } from '@/components/brand/NestIllustration'

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  /** Lucide icon in a soft circle; ignored when illustration="nest". */
  icon?: ReactNode
  /** 'nest' draws the empty woven nest (empty inbox / no results). */
  illustration?: 'nest' | 'none'
  action?: ReactNode
  /** Tighter spacing for use inside cards and drawers. */
  compact?: boolean
  className?: string
}

export function EmptyState({ title, description, icon, illustration = 'none', action, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {illustration === 'nest' ? (
        <NestIllustration className={compact ? 'w-28' : 'w-40'} />
      ) : icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent [&_svg]:size-5">{icon}</span>
      ) : null}
      <div className="max-w-sm">
        <p className={cn('font-display font-semibold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/** Inline error panel with a retry action. */
export function ErrorState({ title, description, onRetry, retryLabel, className }: { title: ReactNode; description?: ReactNode; onRetry?: () => void; retryLabel?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-2 rounded-ui border border-danger/40 bg-danger-soft px-6 py-8 text-center', className)}>
      <p className="font-medium text-danger">{title}</p>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="link text-sm">
          {retryLabel ?? 'Retry'}
        </button>
      ) : null}
    </div>
  )
}
