/** Small shared pieces of the usage screens: labels, call measures, the calls table. */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AudioLines, Archive, Bot, FileAudio, Layers, Type } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge, DataTable, Tooltip, type Column, type SortState } from '@/components/ui'
import { formatDuration, formatNumber, formatTokens } from '@/lib/format'
import type { LlmUsage } from '@/types'
import type { CallRow } from '../types'

/** Label lookups for the enums the API returns raw; unknown values fall back to the raw string. */
export function useLabels() {
  const { t, i18n } = useTranslation('usage')
  const lang = i18n.language
  const label = (ns: string, key: string | null | undefined) => {
    if (!key) return '-'
    return t(`${ns}.${key}`, { defaultValue: key })
  }
  return {
    t,
    lang,
    group: (k: string) => label('groups', k),
    feature: (k: string) => label('features', k),
    capability: (k: string) => label('capabilities', k),
    provider: (k: string) => label('providers', k),
    channel: (k: string) => label('channels', k),
    state: (k: string) => label('states', k),
    mode: (k: string) => label('modes', k),
    role: (k: string) => label('roles', k),
    actor: (k: string) => (['guest', 'system', 'autopilot'].includes(k) ? t(`actors.${k}`) : k),
    workspace: (row: { workspace?: string | null; workspace_ka?: string | null }) =>
      (lang === 'ka' ? row.workspace_ka || row.workspace : row.workspace) || t('workspaces.public'),
  }
}

export function WindowLabel({ from, to, lang }: { from: string; to: string; lang: string }) {
  const f = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <span className="tabular">
      {f.format(new Date(from))} - {f.format(new Date(to))}
    </span>
  )
}

/** The one number that matters for a call: tokens, audio seconds or characters. */
export function CallMeasure({ row }: { row: Pick<LlmUsage, 'capability' | 'total_tokens' | 'input_tokens' | 'output_tokens' | 'audio_seconds' | 'characters'> }) {
  const { t, lang } = useLabels()
  if (row.capability === 'stt' || row.capability === 'voice_tone') {
    return (
      <span className="tabular inline-flex items-center gap-1.5">
        <AudioLines className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden />
        {formatDuration(row.audio_seconds ?? 0, lang)}
      </span>
    )
  }
  if (row.capability === 'tts') {
    return (
      <span className="tabular inline-flex items-center gap-1.5">
        <Type className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden />
        {t('measure.chars', { n: formatNumber(row.characters ?? 0, lang) })}
      </span>
    )
  }
  return (
    <Tooltip content={t('measure.inOut', { input: formatNumber(row.input_tokens, lang), output: formatNumber(row.output_tokens, lang) })}>
      <span className="tabular font-mono text-[12.5px]">{formatNumber(row.total_tokens, lang)}</span>
    </Tooltip>
  )
}

export function OkBadge({ row }: { row: Pick<LlmUsage, 'ok' | 'error'> }) {
  const { t } = useTranslation('usage')
  if (row.ok) return <Badge tone="success" size="sm">{t('status.ok')}</Badge>
  return (
    <Tooltip content={row.error ?? t('status.failed')}>
      <span>
        <Badge tone="danger" size="sm">{t('status.failed')}</Badge>
      </span>
    </Tooltip>
  )
}

export function TargetLink({ row, search = '' }: { row: CallRow; search?: string }) {
  const { t } = useTranslation('usage')
  const target = row.target
  if (!target) return <span className="text-subtle">-</span>
  if (!target.exists) {
    return (
      <Tooltip content={t('target.archivedHint')}>
        <span className="inline-flex items-center gap-1.5 text-subtle">
          <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
          <span className="font-mono text-[12px]">{target.id}</span>
        </span>
      </Tooltip>
    )
  }
  if (target.kind === 'digest') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted" title={target.label ?? undefined}>
        <Layers className="size-3.5" strokeWidth={1.75} aria-hidden />
        <span className="max-w-[160px] truncate">{t('target.digest')}</span>
      </span>
    )
  }
  const recording = target.kind === 'recording'
  return (
    <Link
      to={`${recording ? '/usage/recordings/' : '/usage/conversations/'}${target.id}`}
      state={{ search }}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-[200px] items-center gap-1.5 text-primary hover:underline"
    >
      {recording ? <FileAudio className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> : <Bot className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
      <span className="truncate">{target.label ?? target.id}</span>
    </Link>
  )
}

interface CallsTableProps {
  rows: CallRow[] | undefined
  loading?: boolean
  /** Compact variant for detail pages: no workspace / actor / target columns. */
  compact?: boolean
  search?: string
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  serverPagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }
  empty?: ReactNode
  caption?: string
  bare?: boolean
}

export function CallsTable({ rows, loading, compact, search, sort, onSortChange, serverPagination, empty, caption, bare }: CallsTableProps) {
  const L = useLabels()
  const { t, lang } = L
  const time = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: compact ? '2-digit' : undefined })

  const srv = !!onSortChange
  const by = (fn: (r: CallRow) => string | number): true | ((r: CallRow) => string | number) => (srv ? true : fn)

  const columns: Column<CallRow>[] = [
    {
      key: 'created_at',
      header: t('calls.cols.time'),
      sortable: true,
      cell: (r) => <span className="tabular whitespace-nowrap text-[12.5px] text-muted">{time.format(new Date(r.created_at))}</span>,
    },
    ...(compact
      ? []
      : [
          {
            key: 'workspace',
            header: t('calls.cols.workspace'),
            sortable: true,
            hideBelow: 'lg' as const,
            cell: (r: CallRow) => <span className="whitespace-nowrap">{L.workspace(r)}</span>,
          },
        ]),
    {
      key: 'feature',
      header: t('calls.cols.feature'),
      sortable: by((r) => r.feature),
      cell: (r) => (
        <div className="min-w-[120px]">
          <div className="font-medium">{L.feature(r.feature)}</div>
          <div className="text-[12px] text-muted">{L.group(r.group)}</div>
        </div>
      ),
    },
    {
      key: 'model',
      header: t('calls.cols.model'),
      sortable: by((r) => r.model),
      hideBelow: 'md',
      cell: (r) => (
        <div className="min-w-[120px]">
          <div className="font-mono text-[12px]">{r.model}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            {L.provider(r.provider)}
            {r.byo ? <Badge tone="accent" size="sm">{t('calls.byo')}</Badge> : null}
          </div>
        </div>
      ),
    },
    { key: 'tokens', header: t('calls.cols.usage'), sortable: by((r) => r.total_tokens || r.audio_seconds || r.characters || 0), align: 'right', cell: (r) => <CallMeasure row={r} /> },
    {
      key: 'latency',
      header: t('calls.cols.latency'),
      sortable: by((r) => r.latency_ms),
      align: 'right',
      hideBelow: 'lg',
      cell: (r) => <span className="tabular text-muted">{t('calls.ms', { n: formatNumber(r.latency_ms, lang) })}</span>,
    },
    { key: 'status', header: t('calls.cols.status'), sortable: by((r) => (r.ok ? 1 : 0)), cell: (r) => <OkBadge row={r} /> },
    ...(compact
      ? []
      : [
          {
            key: 'actor',
            header: t('calls.cols.actor'),
            sortable: true,
            hideBelow: 'lg' as const,
            cell: (r: CallRow) => <span className="max-w-[150px] truncate">{L.actor(r.actor)}</span>,
          },
          { key: 'target', header: t('calls.cols.target'), hideBelow: 'md' as const, cell: (r: CallRow) => <TargetLink row={r} search={search} /> },
        ]),
  ]

  return (
    <DataTable<CallRow>
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      loading={loading}
      dense
      bare={bare}
      caption={caption}
      empty={empty}
      sort={onSortChange ? sort : undefined}
      onSortChange={onSortChange}
      serverPagination={serverPagination}
      pageSize={serverPagination ? undefined : 25}
      defaultSort={onSortChange ? undefined : { key: 'created_at', dir: 'asc' }}
    />
  )
}

export { formatTokens }
