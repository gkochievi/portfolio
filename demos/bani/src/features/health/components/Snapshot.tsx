import { useState } from 'react'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Banner, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, SectionTitle, Skeleton, StatusChip, Table, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { fmtBytes, fmtDateTime, fmtNumber, fmtPct, fromTenantInput, toTenantInput } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { HostMetricRow, PingRow } from '@/types'
import { useSnapshot } from '../api'
import { fmtRate, fmtRtt } from '../lib/series'
import { useNow } from '../lib/useNow'

const PRESETS = [
  { id: 'm30', minutes: 30 },
  { id: 'h1', minutes: 60 },
  { id: 'h6', minutes: 360 },
  { id: 'h12', minutes: 720 },
] as const

const minuteIso = (ms: number): string => new Date(Math.floor(ms / 60_000) * 60_000).toISOString()

interface MetricLine {
  id: string
  avg: string
  max?: string
  min?: string
}

function metricLines(m: HostMetricRow, lang: 'en' | 'ka'): MetricLine[] {
  const n = (v: number, d = 2) => fmtNumber(v, lang, d)
  const pct = (v: number) => fmtPct(v, 1)
  return [
    { id: 'cpu', avg: pct(m.cpuPctAvg), max: pct(m.cpuPctMax), min: pct(m.cpuPctMin) },
    { id: 'ram', avg: fmtBytes(m.memUsedBytesAvg), max: fmtBytes(m.memUsedBytesMax), min: fmtBytes(m.memUsedBytesMin) },
    { id: 'disk', avg: `${pct(m.diskUsedPct)} · ${fmtBytes(m.diskFreeBytes)}` },
    { id: 'rx', avg: fmtRate(m.netRxBytesPerSecAvg), max: fmtRate(m.netRxBytesPerSecMax) },
    { id: 'tx', avg: fmtRate(m.netTxBytesPerSecAvg), max: fmtRate(m.netTxBytesPerSecMax) },
    { id: 'load', avg: `${n(m.loadAvg1)} / ${n(m.loadAvg5)} / ${n(m.loadAvg15)}` },
    { id: 'processes', avg: fmtNumber(m.processCount, lang) },
  ]
}

function pingTone(p: PingRow): 'success' | 'warning' | 'danger' {
  return !p.reachable ? 'danger' : p.packetLossPct > 0 ? 'warning' : 'success'
}

export function Snapshot() {
  const { t } = useTranslation('health')
  const lang = useLang()
  const now = useNow(60_000)
  const [value, setValue] = useState(() => toTenantInput(minuteIso(Date.now() - 30 * 60_000)))
  const [at, setAt] = useState<string | null>(() => fromTenantInput(toTenantInput(minuteIso(Date.now() - 30 * 60_000))))
  const [formError, setFormError] = useState<string | null>(null)
  const snap = useSnapshot(at)

  const submit = (next = value) => {
    const ms = Date.parse(fromTenantInput(next))
    if (!next || !Number.isFinite(ms)) return setFormError(t('snapshot.invalid'))
    if (ms > Date.now() + 60_000) return setFormError(t('snapshot.future'))
    if (ms < Date.now() - 24 * 3_600_000 - 5 * 60_000) return setFormError(t('snapshot.tooOld'))
    setFormError(null)
    setAt(new Date(ms).toISOString())
  }

  const preset = (minutes: number) => {
    const v = toTenantInput(minuteIso(Date.now() - minutes * 60_000))
    setValue(v)
    submit(v)
  }

  const m = snap.data?.metrics ?? null

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('snapshot.title')}</SectionTitle>
      <Card>
        <CardHeader title={t('snapshot.cardTitle')} subtitle={t('snapshot.subtitle')} icon={History} />
        <CardBody className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="w-full sm:w-64">
              <Field label={t('snapshot.at')} error={formError ?? undefined} htmlFor="snapshot-at">
                <Input
                  id="snapshot-at"
                  type="datetime-local"
                  value={value}
                  min={toTenantInput(new Date(now - 24 * 3_600_000).toISOString())}
                  max={toTenantInput(new Date(now).toISOString())}
                  invalid={!!formError}
                  onChange={(e) => setValue(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" loading={snap.isFetching}>
              {t('snapshot.show')}
            </Button>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('snapshot.presets')}>
              {PRESETS.map((p) => (
                <Button key={p.id} size="sm" variant="secondary" onClick={() => preset(p.minutes)}>
                  {t(`snapshot.preset.${p.id}`)}
                </Button>
              ))}
            </div>
          </form>

          {snap.isError ? (
            <Banner tone="danger">{errorMessage(snap.error)}</Banner>
          ) : snap.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : snap.data ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-[13px] font-semibold text-ink">
                  {t('snapshot.metrics', { at: fmtDateTime(snap.data.requestedAt, lang, { seconds: false }), window: snap.data.windowSec })}
                </h3>
                {m ? (
                  <Table compact>
                    <THead>
                      <Tr>
                        <Th>{t('snapshot.metric')}</Th>
                        <Th align="right">{t('snapshot.avg')}</Th>
                        <Th align="right">{t('snapshot.max')}</Th>
                        <Th align="right">{t('snapshot.min')}</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {metricLines(m, lang).map((line) => (
                        <Tr key={line.id}>
                          <Td>{t(`live.${line.id === 'ram' ? 'ram' : line.id}`)}</Td>
                          <Td align="right" mono>
                            {line.avg}
                          </Td>
                          <Td align="right" mono muted>
                            {line.max ?? '-'}
                          </Td>
                          <Td align="right" mono muted>
                            {line.min ?? '-'}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <EmptyState compact title={t('snapshot.noMetrics')} body={t('snapshot.noMetricsBody', { window: snap.data.windowSec })} />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-[13px] font-semibold text-ink">{t('snapshot.pings')}</h3>
                {snap.data.pings.length ? (
                  <ul className="overflow-hidden rounded-[8px] border border-line">
                    {snap.data.pings.map((p) => (
                      <li key={p.label} className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 first:border-t-0">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-ink">{p.label}</div>
                          <div className="font-mono text-[12px] tabular text-muted">
                            {fmtRtt(p.rttAvgMs)} · {t('lanes.loss')} {Math.round(p.packetLossPct)}%
                          </div>
                        </div>
                        <StatusChip tone={pingTone(p)} size="sm">
                          {t(`lanes.state.${p.reachable ? (p.packetLossPct > 0 ? 'degraded' : 'healthy') : 'down'}`)}
                        </StatusChip>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title={t('snapshot.noPings')} />
                )}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </section>
  )
}
