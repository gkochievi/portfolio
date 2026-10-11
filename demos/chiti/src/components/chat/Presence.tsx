import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatWait } from '@/lib/format'
import { useNow } from '@/lib/realtime'
import type { OperatorStatus } from '@/types'

const DOT: Record<OperatorStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  offline: 'bg-line-strong',
}

/** Presence dot. Decorative by default; the surrounding text carries the state. */
export function StatusDot({ status, size = 8, className }: { status: OperatorStatus; size?: number; className?: string }) {
  return <span aria-hidden className={cn('inline-block shrink-0 rounded-full', DOT[status], className)} style={{ width: size, height: size }} />
}

const TIER: Record<'fresh' | 'amber' | 'late', string> = {
  fresh: 'bg-success-soft text-success',
  amber: 'bg-warning-soft text-warning',
  late: 'bg-danger-soft text-danger',
}

/** Live wait chip: counts up every second, tiers fresh (< 2 min), amber (2-5), late (> 5). */
export function WaitTimer({ since, className }: { since: string; className?: string }) {
  const now = useNow(1000)
  const wait = formatWait(since, now)
  return (
    <span className={cn('tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4', TIER[wait.tier], className)}>{wait.label}</span>
  )
}

/** Three hopping dots plus a label ("Nino is typing..."). */
export function TypingDots({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation('common')
  const text = label ?? t('chat.typing')
  return (
    <div className={cn('flex items-center gap-2 pl-1 text-xs text-muted', className)} role="status" aria-live="polite">
      <span className="inline-flex items-end gap-[3px]" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span key={index} className="size-1.5 animate-dot-hop rounded-full bg-muted" style={{ animationDelay: `${index * 140}ms` }} />
        ))}
      </span>
      <span>{text}</span>
    </div>
  )
}
