import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardHeader, EmptyState, ErrorState, Mono, Skeleton, StatusChip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtTime } from '@/lib/format'
import { useLang, useTheme } from '@/shell/state'
import type { PingRow } from '@/types'
import { usePings } from '../api'
import { binPings, chartColors, fmtRtt, laneState, LANE_ORDER, median, type LaneBin, type LaneState } from '../lib/series'
import { useNow } from '../lib/useNow'

const W = 720
const H = 48

/** One lane's latency line on the shared 24 h axis; loss shows as tinted columns. */
function LaneChart({ bins, color, label }: { bins: LaneBin[]; color: string; label: string }) {
  const max = Math.max(1, ...bins.map((b) => b.rtt ?? 0)) * 1.3
  const step = W / bins.length
  const segments: [number, number][][] = []
  let cur: [number, number][] | null = null
  bins.forEach((b, i) => {
    if (b.rtt == null) {
      cur = null
      return
    }
    const pt: [number, number] = [(i + 0.5) * step, H - 4 - (b.rtt / max) * (H - 12)]
    if (!cur) {
      cur = []
      segments.push(cur)
    }
    cur.push(pt)
  })
  const f = (n: number) => n.toFixed(1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="block h-12 w-full">
      {bins.map((b, i) =>
        b.loss > 0 || b.down ? (
          <rect
            key={i}
            x={i * step}
            y={0}
            width={step + 0.4}
            height={H}
            fill={b.down ? 'var(--bani-danger)' : 'var(--bani-warning)'}
            opacity={b.down ? 0.28 : 0.16 + (b.loss / 100) * 0.3}
          />
        ) : null,
      )}
      {segments.map((seg, i) => {
        const first = seg[0]
        const last = seg[seg.length - 1]
        if (!first || !last) return null
        const pts = seg.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')
        return (
          <g key={i}>
            <polygon points={`${f(first[0])},${H} ${pts} ${f(last[0])},${H}`} fill={color} fillOpacity={0.12} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}
    </svg>
  )
}

const STATE_TONE = { healthy: 'success', degraded: 'warning', down: 'danger' } as const
const STATE_BAND: Record<LaneState, string> = {
  healthy: '',
  degraded: 'bg-warning/12 pt-5',
  down: 'bg-danger/12 outline-2 -outline-offset-2 outline-danger rounded-[8px]',
}

export function VoiceLanes() {
  const { t } = useTranslation('health')
  const lang = useLang()
  const theme = useTheme()
  const pings = usePings(24)
  const now = useNow(60_000)
  const colors = chartColors(theme)

  const lanes = useMemo(() => {
    const rows = pings.data ?? []
    const to = now
    const from = to - 24 * 3_600_000
    return LANE_ORDER.map((label, i) => {
      const own = rows.filter((r) => r.label === label)
      const latest: PingRow | undefined = own[own.length - 1]
      const baseline = median(own.filter((r) => r.rttAvgMs != null && r.packetLossPct === 0).map((r) => r.rttAvgMs as number))
      return { label, color: colors[i % colors.length] ?? '#A3441A', latest, state: laneState(latest, baseline), bins: binPings(own, from, to), host: latest?.target ?? own[0]?.target ?? '' }
    })
  }, [pings.data, now, colors])

  const axis = [0, 0.25, 0.5, 0.75, 1].map((p) => ({ p, at: now - 24 * 3_600_000 + p * 24 * 3_600_000 }))

  return (
    <Card>
      <CardHeader title={t('lanes.title')} subtitle={t('lanes.subtitle')} />
      {pings.isError && !pings.data ? (
        <div className="p-4">
          <ErrorState error={pings.error} onRetry={() => void pings.refetch()} />
        </div>
      ) : pings.isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {LANE_ORDER.map((l) => (
            <Skeleton key={l} className="h-12 w-full" />
          ))}
        </div>
      ) : !pings.data?.length ? (
        <EmptyState compact title={t('lanes.empty')} />
      ) : (
        <div className="px-2 pb-4 pt-1 sm:px-3">
          <ul>
            {lanes.map((lane) => (
              <li
                key={lane.label}
                data-state={lane.state}
                className={cn(
                  'grid items-center gap-x-5 gap-y-2 border-t border-line px-3 py-3 first:border-t-0 md:grid-cols-[210px_minmax(0,1fr)_150px]',
                  STATE_BAND[lane.state],
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-bold text-ink">{lane.label}</span>
                    <StatusChip tone={STATE_TONE[lane.state]} size="sm">
                      {t(`lanes.state.${lane.state}`)}
                    </StatusChip>
                  </div>
                  <Mono muted className="mt-0.5 block truncate text-[12px]">
                    {lane.host}
                  </Mono>
                </div>
                <div className="min-w-0">
                  <LaneChart bins={lane.bins} color={lane.color} label={t('lanes.chartLabel', { name: lane.label })} />
                </div>
                <dl className="flex items-baseline justify-between gap-4 md:block md:text-right">
                  <div className="md:mb-0.5">
                    <dt className="sr-only">{t('lanes.rtt')}</dt>
                    <dd className="font-mono text-[18px] font-medium tabular text-ink">{lane.state === 'down' ? '-' : fmtRtt(lane.latest?.rttAvgMs)}</dd>
                  </div>
                  <div className="text-[12.5px] text-muted">
                    <dt className="inline">{t('lanes.loss')} </dt>
                    <dd className={cn('inline font-mono tabular', (lane.latest?.packetLossPct ?? 0) > 0 && 'font-medium text-warning')}>
                      {lane.latest ? `${Math.round(lane.latest.packetLossPct)}%` : '-'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {/* The one shared bronze baseline every lane rests on, with the common 24 h axis. */}
          <div className="mx-3 h-[2px] rounded-full bg-primary" aria-hidden />
          <div className="mx-3 mt-1.5 grid md:grid-cols-[210px_minmax(0,1fr)_150px] md:gap-x-5" aria-hidden>
            <span className="hidden md:block" />
            <div className="flex justify-between text-[11.5px] text-faint tabular">
              {axis.map(({ p, at }) => (
                <span key={p}>{p === 1 ? t('lanes.now') : fmtTime(new Date(at).toISOString(), lang)}</span>
              ))}
            </div>
            <span className="hidden md:block" />
          </div>
        </div>
      )}
    </Card>
  )
}
