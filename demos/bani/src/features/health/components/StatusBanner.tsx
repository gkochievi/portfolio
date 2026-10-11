import { AlertTriangle, CheckCircle2, PlayCircle, XOctagon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Card, Skeleton, StatusChip, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtTime, timeAgo } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { SelfTestOverview, TestRun } from '@/types'
import { fmtMs } from '../lib/series'
import { useNow } from '../lib/useNow'

const RUN_TONE: Record<TestRun['status'], Tone> = { passed: 'success', degraded: 'warning', failed: 'danger' }
const RUN_ICON = { passed: CheckCircle2, degraded: AlertTriangle, failed: XOctagon } as const
const FILL: Record<Tone, string> = {
  success: 'bg-success/12',
  warning: 'bg-warning/12',
  danger: 'bg-danger/12',
  info: 'bg-info/12',
  neutral: 'bg-sunken',
  bronze: 'bg-primary/12',
}
const TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted',
  bronze: 'text-primary',
}

export function StatusBanner({
  overview,
  loading,
  running,
  onRun,
}: {
  overview: SelfTestOverview | undefined
  loading: boolean
  running: boolean
  onRun: () => void
}) {
  const { t } = useTranslation('health')
  const lang = useLang()
  const now = useNow(30_000)
  const run = overview?.latest ?? null

  if (loading && !overview) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </Card>
    )
  }

  const tone: Tone = run ? RUN_TONE[run.status] : 'neutral'
  const Icon = run ? RUN_ICON[run.status] : PlayCircle
  const by = run ? (run.triggeredBy === 'schedule' ? t('banner.schedule') : run.triggeredBy) : ''

  return (
    <Card className={cn('flex flex-col gap-4 border-transparent p-5 lg:flex-row lg:items-center lg:justify-between', FILL[tone])} aria-live="polite">
      <div className="flex min-w-0 items-start gap-3.5">
        <Icon size={30} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', TEXT[tone])} aria-hidden />
        <div className="min-w-0">
          <h2 className={cn('font-display text-[24px] font-bold leading-tight', TEXT[tone])} style={{ letterSpacing: '-0.015em' }}>
            {running ? t('run.running') : run ? t(`banner.state.${run.status}`) : t('banner.none')}
          </h2>
          <p className="mt-1 text-[14px] text-muted">
            {run
              ? t('banner.line', { ago: timeAgo(run.completedAt, lang, now), duration: fmtMs(run.durationMs), by })
              : t('banner.noRun')}
          </p>
          {overview && (
            <p className="mt-0.5 text-[12.5px] text-faint">{t('banner.next', { time: fmtTime(overview.nextRunAt, lang) })}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end xl:flex-row">
        {run && (
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="neutral" icon={false}>
              {t('banner.total')} <b className="tabular">{run.total}</b>
            </StatusChip>
            <StatusChip tone="success" icon={false}>
              {t('banner.passed')} <b className="tabular">{run.passed}</b>
            </StatusChip>
            <StatusChip tone={run.failed ? 'danger' : 'neutral'} icon={false}>
              {t('banner.failed')} <b className="tabular">{run.failed}</b>
            </StatusChip>
            <StatusChip tone="neutral" icon={false}>
              {t('banner.skipped')} <b className="tabular">{run.skipped}</b>
            </StatusChip>
          </div>
        )}
        <Button variant="primary" icon={PlayCircle} loading={running} onClick={onRun} disabled={running}>
          {running ? t('run.running') : t('run.now')}
        </Button>
      </div>
    </Card>
  )
}
