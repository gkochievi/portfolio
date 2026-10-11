/** Auto-dialer pacing panel: global Start/Stop and one card per AUTO / PREDICTIVE campaign. */
import { useTranslation } from 'react-i18next'
import { Gauge, Play, RotateCcw, Square, TriangleAlert, Zap } from 'lucide-react'

import { Badge, Button, EmptyState, Panel, Skeleton, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDuration, formatPercent, formatRelative } from '@/lib/format'
import { useLang, useLocalized } from '@/lib/localized'
import { toast, toastError } from '@/lib/toast'
import type { AutoDialerOverview } from '@/types'
import { useAutoDialer, useDialerAction, useDialerSwitch, type DialerAction } from '../api'
import { ICON, QueryError, useNow } from './shared'

type CampaignRow = AutoDialerOverview['campaigns'][number]

const MAX_ERRORS = 5

export function DialerPanel() {
  const { t } = useTranslation('wall')
  const dialer = useAutoDialer()
  const toggle = useDialerSwitch()
  const now = useNow()
  const data = dialer.data
  const enabled = data?.enabled ?? false

  const onToggle = () =>
    toggle.mutate(!enabled, {
      onSuccess: (result) => toast.success(result.enabled ? t('dialer.toast.started') : t('dialer.toast.stopped')),
      onError: (error) => toastError(error),
    })

  return (
    <Panel
      title={t('dialer.title')}
      description={t('dialer.description')}
      icon={<Gauge {...ICON} />}
      actions={
        data ? (
          <div className="flex items-center gap-2">
            <Badge tone={enabled ? 'success' : 'muted'} variant={enabled ? 'soft' : 'outline'}>
              {enabled ? t('dialer.engineOn') : t('dialer.engineOff')}
            </Badge>
            <Button
              size="sm"
              variant={enabled ? 'outline' : 'dial'}
              icon={enabled ? <Square {...ICON} /> : <Play {...ICON} />}
              loading={toggle.isPending}
              onClick={onToggle}
            >
              {enabled ? t('dialer.stop') : t('dialer.start')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {dialer.isError && !data ? (
        <QueryError error={dialer.error} onRetry={() => void dialer.refetch()} />
      ) : !data ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-card" />
          ))}
        </div>
      ) : data.campaigns.length === 0 ? (
        <EmptyState compact title={t('dialer.empty')} description={t('dialer.emptyHint')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {data.campaigns.map((row) =>
            row.dialingMode === 'PREDICTIVE' ? (
              <PredictiveCard key={row.campaignId} row={row} />
            ) : (
              <AutoCard key={row.campaignId} row={row} engineOn={enabled} target={data.targetAbandonRate} now={now} />
            ),
          )}
        </div>
      )}
    </Panel>
  )
}

function PredictiveCard({ row }: { row: CampaignRow }) {
  const { t } = useTranslation('wall')
  const l = useLocalized()
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-card border border-dashed border-hairline-strong p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{l(row.campaignName)}</p>
          <p className="text-xs text-muted">{t(`common:dialingMode.${row.dialingMode}`)}</p>
        </div>
        <Badge tone="info">{t('dialer.comingSoon')}</Badge>
      </div>
      <p className="text-sm text-muted">{t('dialer.predictiveNote')}</p>
    </article>
  )
}

function AutoCard({ row, engineOn, target, now }: { row: CampaignRow; engineOn: boolean; target: number; now: number }) {
  const { t } = useTranslation('wall')
  const l = useLocalized()
  const lang = useLang()
  const action = useDialerAction()
  const backoffLeft = row.backoffUntil ? Math.max(0, Math.ceil((Date.parse(row.backoffUntil) - now) / 1000)) : 0
  const inBackoff = backoffLeft > 0
  const active = row.status === 'active'

  const state = inBackoff
    ? { tone: 'danger' as const, label: t('dialer.state.backoff', { time: formatDuration(backoffLeft) }) }
    : !active
      ? { tone: 'muted' as const, label: t('dialer.state.campaignPaused') }
      : !engineOn
        ? { tone: 'muted' as const, label: t('dialer.state.engineOff') }
        : row.availableAgents === 0
          ? { tone: 'warning' as const, label: t('dialer.state.noAgents') }
          : { tone: 'success' as const, label: t('dialer.state.dialing') }

  const run = (kind: DialerAction) =>
    action.mutate(
      { campaignId: row.campaignId, action: kind },
      {
        onSuccess: (result) => {
          if (kind === 'trigger') {
            const dialed = 'dialed' in result ? result.dialed : 0
            if (dialed > 0) toast.success(t('dialer.toast.triggered', { count: dialed }))
            else toast.info(t('dialer.toast.nothing'), { description: t('dialer.toast.nothingHint') })
          } else if (kind === 'reset') toast.success(t('dialer.toast.reset'))
          else toast.warning(t('dialer.toast.failed'), { description: t('dialer.toast.failedHint') })
        },
        onError: (error) => toastError(error),
      },
    )

  const busy = action.isPending ? action.variables?.action : null
  const stats: Array<{ label: string; value: string; danger?: boolean }> = [
    { label: t('dialer.stats.available'), value: String(row.availableAgents) },
    { label: t('dialer.stats.ratio'), value: `×${row.dialRatio.toFixed(1)}` },
    { label: t('dialer.stats.target'), value: String(row.target) },
    { label: t('dialer.stats.inFlight'), value: `${row.inFlight} / ${row.maxConcurrentCalls}` },
    { label: t('dialer.stats.errors'), value: `${row.consecutiveErrors} / ${MAX_ERRORS}`, danger: row.consecutiveErrors > 0 },
    { label: t('dialer.stats.interval'), value: t('dialer.ms', { value: row.dialIntervalMs }) },
    { label: t('dialer.stats.lastDial'), value: row.lastDialAt ? formatRelative(row.lastDialAt, lang) : t('dialer.never') },
    { label: t('dialer.stats.session'), value: String(row.dialedThisSession) },
  ]

  return (
    <article className={cn('flex min-w-0 flex-col gap-4 rounded-card border border-hairline bg-panel p-4', inBackoff && 'border-danger/60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{l(row.campaignName)}</p>
          <p className="text-xs text-muted">
            {t(`common:dialingMode.${row.dialingMode}`)} · {t(`common:campaignStatus.${row.status}`)}
          </p>
        </div>
        <Badge tone={state.tone} icon={inBackoff ? <TriangleAlert {...ICON} /> : undefined} className="shrink-0">
          {state.label}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="truncate text-[11.5px] text-muted">{stat.label}</dt>
            <dd className={cn('truncate font-mono text-sm tabular', stat.danger && 'text-danger')}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <AbandonGauge value={row.abandonRate} target={target} />

      <div className="mt-auto flex flex-wrap gap-2">
        <Tooltip content={active ? t('dialer.triggerHint') : t('dialer.triggerDisabled')}>
          <span>
            <Button size="sm" variant="dial" icon={<Zap {...ICON} />} disabled={!active || inBackoff} loading={busy === 'trigger'} onClick={() => run('trigger')}>
              {t('dialer.trigger')}
            </Button>
          </span>
        </Tooltip>
        <Button size="sm" variant="outline" icon={<RotateCcw {...ICON} />} loading={busy === 'reset'} onClick={() => run('reset')}>
          {t('dialer.reset')}
        </Button>
        <Tooltip content={t('dialer.failHint')}>
          <Button size="sm" variant="ghost" className="text-danger" icon={<TriangleAlert {...ICON} />} loading={busy === 'fail'} onClick={() => run('fail')}>
            {t('dialer.fail')}
          </Button>
        </Tooltip>
      </div>
    </article>
  )
}

/** Abandon % against the target, on a scale of twice the target. */
function AbandonGauge({ value, target }: { value: number; target: number }) {
  const { t } = useTranslation('wall')
  const scale = Math.max(target * 2, value, 1)
  const fill = Math.min(100, (value / scale) * 100)
  const marker = Math.min(100, (target / scale) * 100)
  const tone = value <= target ? 'bg-success' : value <= target * 1.5 ? 'bg-warning' : 'bg-danger'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{t('dialer.abandon')}</span>
        <span className="font-mono tabular">
          {formatPercent(value, 1)} <span className="text-muted">/ {t('dialer.abandonTarget', { value: formatPercent(target, 1) })}</span>
        </span>
      </div>
      <div
        className="relative h-2 rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={scale}
        aria-valuenow={value}
        aria-label={t('dialer.abandon')}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-300', tone)} style={{ width: `${fill}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink" style={{ left: `calc(${marker}% - 1px)` }} aria-hidden />
      </div>
    </div>
  )
}
