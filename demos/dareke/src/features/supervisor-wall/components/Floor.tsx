/** KPI strip and the agent tile grid. */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Headset, PauseCircle, PhoneCall, PhoneOutgoing, PhoneIncoming, PhoneOff, Users } from 'lucide-react'

import { Avatar, Badge, EmptyState, Panel, Segmented, Skeleton, Stat, StatusPill } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDuration, formatPercent, maskPhone, secondsSince } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toneClasses } from '@/lib/tone'
import type { RealtimeMetrics } from '@/types'
import { useWallAgents, useWallMetrics, type WallAgentView } from '../api'
import { ICON, QueryError, groupOf, statusIcon, statusPattern, useNow, type StatusGroup } from './shared'

/* ---------------------------------------------------------------- KPI strip */

export function KpiStrip({ targetAbandonRate }: { targetAbandonRate: number | null }) {
  const { t } = useTranslation('wall')
  const metrics = useWallMetrics()
  if (metrics.isError && !metrics.data) return <QueryError error={metrics.error} onRetry={() => void metrics.refetch()} />
  const m: RealtimeMetrics | undefined = metrics.data
  if (!m) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-card" />
        ))}
      </div>
    )
  }
  const answerShare = m.dialedToday === 0 ? 0 : (m.connectedToday / m.dialedToday) * 100
  const overTarget = targetAbandonRate !== null && m.abandonRate > targetAbandonRate
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat size="wall" tone="lime" label={t('kpi.activeCalls')} icon={<PhoneCall {...ICON} />} value={m.activeCalls} hint={t('kpi.onCallHint', { count: m.agentsOnCall })} />
      <Stat size="wall" tone="success" label={t('kpi.agentsWorking')} icon={<Headset {...ICON} />} value={m.agentsWorking} hint={t('kpi.offlineHint', { count: m.agentsOffline })} />
      <Stat size="wall" tone="warning" label={t('kpi.agentsPaused')} icon={<PauseCircle {...ICON} />} value={m.agentsPaused} />
      <Stat size="wall" label={t('kpi.callsThisHour')} icon={<PhoneOutgoing {...ICON} />} value={m.callsThisHour} />
      <Stat size="wall" tone="info" label={t('kpi.avgWait')} icon={<Clock {...ICON} />} value={t('kpi.seconds', { value: m.avgWaitSeconds })} hint={t('kpi.avgWaitHint')} />
      <Stat size="wall" label={t('kpi.dialedToday')} icon={<Users {...ICON} />} value={m.dialedToday} />
      <Stat
        size="wall"
        tone="success"
        label={t('kpi.connectedToday')}
        icon={<PhoneIncoming {...ICON} />}
        value={m.connectedToday}
        hint={t('kpi.answerShare', { value: formatPercent(answerShare) })}
      />
      <Stat
        size="wall"
        tone={overTarget ? 'danger' : 'success'}
        label={t('kpi.abandonRate')}
        icon={<PhoneOff {...ICON} />}
        value={formatPercent(m.abandonRate, 1)}
        hint={targetAbandonRate !== null ? t('kpi.target', { value: formatPercent(targetAbandonRate, 1) }) : undefined}
      />
    </div>
  )
}

/* --------------------------------------------------------------- agent grid */

type Filter = 'all' | StatusGroup

export function AgentGrid({ className }: { className?: string }) {
  const { t } = useTranslation('wall')
  const agents = useWallAgents()
  const [filter, setFilter] = useState<Filter>('all')
  const now = useNow()

  const counts = useMemo(() => {
    const result: Record<StatusGroup, number> = { onCall: 0, working: 0, paused: 0, offline: 0 }
    for (const view of agents.data ?? []) result[groupOf(view)] += 1
    return result
  }, [agents.data])

  const visible = (agents.data ?? []).filter((view) => filter === 'all' || groupOf(view) === filter)
  const options: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('agents.filter.all', { count: agents.data?.length ?? 0 }) },
    { value: 'onCall', label: t('agents.filter.onCall', { count: counts.onCall }) },
    { value: 'working', label: t('agents.filter.working', { count: counts.working }) },
    { value: 'paused', label: t('agents.filter.paused', { count: counts.paused }) },
    { value: 'offline', label: t('agents.filter.offline', { count: counts.offline }) },
  ]

  return (
    <Panel
      className={className}
      title={t('agents.title')}
      description={t('agents.description')}
      icon={<Users {...ICON} />}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="success">{t('agents.summary.working', { count: counts.working + counts.onCall })}</Badge>
          <Badge tone="warning">{t('agents.summary.paused', { count: counts.paused })}</Badge>
          <Badge tone="lime">{t('agents.summary.onCall', { count: counts.onCall })}</Badge>
        </div>
      }
    >
      <div className="-mx-1 mb-3 overflow-x-auto px-1 pb-1">
        <Segmented size="sm" value={filter} onChange={setFilter} options={options} aria-label={t('agents.filterLabel')} />
      </div>
      {agents.isError && !agents.data ? (
        <QueryError error={agents.error} onRetry={() => void agents.refetch()} />
      ) : !agents.data ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState compact title={t('agents.empty')} description={t('agents.emptyHint')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((view) => (
            <AgentTile key={view.agent.id} view={view} now={now} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function AgentTile({ view, now }: { view: WallAgentView; now: number }) {
  const { t } = useTranslation('wall')
  const l = useLocalized()
  const tone = view.currentCall ? 'lime' : view.status.color
  const elapsed = secondsSince(view.stateSince, now)
  const overtime = view.status.type === 'paused' && view.status.timeoutSeconds > 0 && elapsed > view.status.timeoutSeconds
  const call = view.currentCall
  const holdLive = call?.phase === 'hold' ? Math.max(0, Math.round((now - Date.parse(view.sampledAt)) / 1000)) : 0
  const hold = view.holdSeconds + holdLive
  const callSeconds = call ? secondsSince(call.answeredAt ?? call.initiatedAt, now) : 0
  const name = l(view.agent.displayName)

  return (
    <article className="relative overflow-hidden rounded-card border border-hairline bg-panel p-3 pl-4">
      <span className={cn('absolute inset-y-0 left-0 w-1', toneClasses(tone).dot)} aria-hidden />
      <div className="flex items-start gap-3">
        <Avatar name={name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold">{name}</p>
            <span className={cn('shrink-0 font-mono text-xs tabular', overtime ? 'font-semibold text-danger' : 'text-muted')} title={t('agents.timeInStatus')}>
              {formatDuration(elapsed)}
            </span>
          </div>
          <p className="truncate text-xs text-muted">
            {view.campaign ? l(view.campaign.name) : t('agents.noCampaign')}
            {' · '}
            {view.agent.sipExtension ? t('agents.ext', { ext: view.agent.sipExtension }) : t('agents.noExt')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill size="sm" tone={view.status.color} pattern={statusPattern(view)} icon={statusIcon(view.status)} label={l(view.status.displayName)} />
            {overtime && <Badge tone="danger">{t('agents.overtime')}</Badge>}
          </div>
        </div>
      </div>
      {call && (
        <div className="mt-3 rounded-control border border-hairline bg-sunken px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted">
              {call.phase === 'ringing' ? t('agents.ringing') : call.phase === 'hold' ? t('agents.onHold') : t('agents.onCallBox')}
            </span>
            <span className="font-mono tabular">{formatDuration(callSeconds)}</span>
          </div>
          <p className="mt-0.5 font-mono text-sm tabular">{maskPhone(call.destinationNumber)}</p>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted">{call.customerName ? l(call.customerName) : t('agents.unknownCustomer')}</span>
            {hold > 0 && <span className={cn('shrink-0 font-mono tabular', call.phase === 'hold' ? 'text-warning' : 'text-muted')}>{t('agents.hold', { time: formatDuration(hold) })}</span>}
          </div>
        </div>
      )}
    </article>
  )
}
