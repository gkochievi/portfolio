import { Gauge, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Meter, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { LimitsSnapshot, QuotaKind } from '@/types'
import { useLimits } from '../api'

const KINDS: QuotaKind[] = ['tts', 'analyses', 'conversions']

/** Daily-allowance banner: refreshed after every spend, with disabled, unavailable and used-up states. */
export function QuotaBanner({ kinds, className }: { kinds?: QuotaKind[]; className?: string }) {
  const { t } = useTranslation('voiceTools')
  const limits = useLimits()

  if (limits.isLoading) return <Skeleton className={cn('h-[84px] w-full rounded-card', className)} />

  if (limits.isError || !limits.data) {
    return (
      <Callout
        tone="warning"
        title={t('quota.unavailable')}
        className={className}
        action={
          <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => void limits.refetch()}>
            {t('quota.retry')}
          </Button>
        }
      >
        {t('quota.unavailableBody')}
      </Callout>
    )
  }

  const data: LimitsSnapshot = limits.data
  if (!data.enabled) {
    return (
      <Callout tone="warning" title={t('quota.disabledTitle')} className={className}>
        {t('quota.disabled')}
      </Callout>
    )
  }

  const shown = (kinds ?? KINDS).filter((k) => (k === 'analyses' ? data.features.analyze : k === 'tts' ? data.features.tts : data.features.convert))
  const visible = data.anonymous ? shown.filter((k) => k !== 'analyses') : shown

  return (
    <section aria-label={t('quota.title')} className={cn('rounded-card border border-line bg-panel p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <Gauge className="size-4 text-accent" aria-hidden /> {t('quota.title')}
        </span>
        <span className="text-xs text-muted">{data.anonymous ? t('quota.guest') : t('quota.account')}</span>
        <span className="ml-auto text-xs text-subtle">{t('quota.renews')}</span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {visible.map((kind) => {
          const max = data.max[kind]
          const left = data.remaining[kind]
          const spent = left <= 0
          return (
            <li key={kind} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted">{t(`quota.kinds.${kind}`)}</span>
                <span className={cn('tabular font-display text-lg leading-none', spent ? 'text-danger' : 'text-ink')}>
                  {spent ? t('quota.spent') : t('quota.left', { remaining: left, max })}
                </span>
              </div>
              <Meter value={left} max={Math.max(1, max)} ticks={Math.min(20, Math.max(5, max))} tone={spent ? 'danger' : left / Math.max(1, max) < 0.35 ? 'warning' : 'success'} label={t(`quota.kinds.${kind}`)} />
              {spent ? <p className="text-xs text-danger">{t(`quota.exhausted.${kind}`)}</p> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
