import { EyeOff, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Tooltip, type Tone } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Confidence } from '@/types'

const CONFIDENCE_TONE: Record<Confidence, Tone> = { high: 'success', medium: 'warning', low: 'danger' }

export function ConfidencePill({ level, size = 'md' }: { level: Confidence; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('kbQuality')
  return (
    <Badge tone={CONFIDENCE_TONE[level]} size={size}>
      {t(`retrieval.level.${level}`)}
    </Badge>
  )
}

/** A thin bar for a 0..1 score, with an optional threshold tick. */
export function ScoreBar({ value, tick, className }: { value: number; tick?: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const tone = value > 0.75 ? 'bg-success' : value > 0.5 ? 'bg-primary' : 'bg-subtle'
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-pill bg-sunken', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
    >
      <div className={cn('h-full rounded-pill', tone)} style={{ width: `${pct}%` }} />
      {tick !== undefined && tick > 0 ? (
        <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${tick * 100}%` }} aria-hidden />
      ) : null}
    </div>
  )
}

export function VisibilityBadge({ visibility }: { visibility: 'public' | 'internal' }) {
  const { t } = useTranslation('kbQuality')
  if (visibility === 'public') {
    return (
      <Badge tone="success" icon={<Globe className="size-3" />}>
        {t('visibility.public')}
      </Badge>
    )
  }
  return (
    <Tooltip content={t('visibility.internalHint')}>
      <span tabIndex={0} className="inline-flex">
        <Badge tone="accent" icon={<EyeOff className="size-3" />}>
          {t('visibility.internal')}
        </Badge>
      </span>
    </Tooltip>
  )
}

/** First readable message from a failed request (field errors win over the generic text). */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fieldErrors).flat()[0]
    return first ?? error.message ?? fallback
  }
  return fallback
}
