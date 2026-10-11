/** Section 4b: live tail of the backup event log. */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'

import { Card, CardBody, CardHeader, DataTable, ErrorState, Field, LiveDot, Select, StatusChip, Switch, type Column } from '@/components/ui'
import { fmtBytes, fmtDateTime, fmtNumber } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { LogEvent, LogLevel } from '@/types'
import { useBackupEvents } from '../api'
import { LEVEL_TONE } from './shared'

type FlowFilter = 'all' | 'voice_archive' | 'edge_pbx'
const ROW_OPTIONS = [25, 50, 100, 200] as const
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

export function LiveEventsSection() {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const [flow, setFlow] = useState<FlowFilter>('all')
  const [minLevel, setMinLevel] = useState<LogLevel>('info')
  const [limit, setLimit] = useState<number>(50)
  const [paused, setPaused] = useState(false)
  const events = useBackupEvents(flow, minLevel, limit, paused)

  const columns = useMemo<Column<LogEvent>[]>(
    () => [
      { id: 'time', header: t('events.columns.time'), mono: true, cell: (e) => <span className="whitespace-nowrap">{fmtDateTime(e.createdAt, lang, { seconds: true })}</span> },
      {
        id: 'level',
        header: t('events.columns.level'),
        cell: (e) => (
          <StatusChip tone={LEVEL_TONE[e.level]} size="sm">
            {t(`events.levels.${e.level}`)}
          </StatusChip>
        ),
      },
      { id: 'event', header: t('events.columns.event'), mono: true, cell: (e) => <span className="whitespace-nowrap">{e.event}</span> },
      { id: 'dateDir', header: t('events.columns.dateDir'), mono: true, hideBelow: 'lg', cell: (e) => e.dateDir },
      {
        id: 'path',
        header: t('events.columns.path'),
        mono: true,
        hideBelow: 'lg',
        cell: (e) => (
          <span className="block max-w-[260px] truncate" title={e.relativePath}>
            {e.relativePath || '-'}
          </span>
        ),
      },
      { id: 'size', header: t('events.columns.size'), align: 'right', mono: true, hideBelow: 'md', cell: (e) => (e.sizeBytes == null ? '-' : fmtBytes(e.sizeBytes)) },
      {
        id: 'duration',
        header: t('events.columns.duration'),
        align: 'right',
        mono: true,
        hideBelow: 'md',
        cell: (e) => (e.durationMs == null ? '-' : `${fmtNumber(e.durationMs, lang)} ms`),
      },
      {
        id: 'message',
        header: t('events.columns.message'),
        cell: (e) => (
          <span className="block min-w-[200px] max-w-[420px] truncate" title={e.message}>
            {e.message}
          </span>
        ),
      },
    ],
    [t, lang],
  )

  const flowOptions: { value: FlowFilter; label: string }[] = [
    { value: 'all', label: t('events.flows.all') },
    { value: 'voice_archive', label: t('events.flows.voice_archive') },
    { value: 'edge_pbx', label: t('events.flows.edge_pbx') },
  ]
  const levelOptions = LEVELS.map((l) => ({ value: l, label: t('events.levelAtLeast', { level: t(`events.levels.${l}`) }) }))
  const rowOptions = ROW_OPTIONS.map((n) => ({ value: String(n), label: t('events.rowsValue', { count: n }) }))

  return (
    <Card>
      <CardHeader
        icon={Radio}
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        actions={
          <span className="inline-flex items-center gap-2 text-[12.5px] text-muted">
            <LiveDot tone={paused ? 'neutral' : 'success'} still={paused} />
            {paused ? t('events.paused') : t('events.live')}
          </span>
        }
      />
      <CardBody className="flex flex-col gap-3">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label={t('events.flow')} htmlFor="events-flow">
            <Select<FlowFilter> id="events-flow" value={flow} onValueChange={setFlow} options={flowOptions} aria-label={t('events.flow')} />
          </Field>
          <Field label={t('events.minLevel')} htmlFor="events-level">
            <Select<LogLevel> id="events-level" value={minLevel} onValueChange={setMinLevel} options={levelOptions} aria-label={t('events.minLevel')} />
          </Field>
          <Field label={t('events.rows')} htmlFor="events-rows">
            <Select<string> id="events-rows" value={String(limit)} onValueChange={(v) => setLimit(Number(v))} options={rowOptions} aria-label={t('events.rows')} />
          </Field>
          <div className="pb-2">
            <Switch checked={paused} onCheckedChange={setPaused} label={t('events.pause')} />
          </div>
        </div>
        {events.isError ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : (
          <DataTable
            compact
            columns={columns}
            rows={events.data}
            rowKey={(e) => e.id}
            loading={events.isLoading}
            emptyTitle={t('events.empty')}
            maxHeight={440}
          />
        )}
      </CardBody>
    </Card>
  )
}
