/** /admin/history: search the archive of chats and open a read-only transcript. Admin + supervisor. */
import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChannelBadge } from '@/components/chat'
import { Avatar, Badge, Button, Card, DataTable, DateRangePicker, ErrorState, Input, PageHeader, SearchInput, Select, lastDays, type Column, type DateRange } from '@/components/ui'
import { formatDateTime, formatDuration, personName, pickText } from '@/lib/format'
import { CHANNELS, type EndCategory, type SessionSummary } from '@/types'

import { useDebounced, useHistory, useHistoryFilters } from '../api'
import { EndCategoryBadge, Stars, useLang } from '../shared'
import { durationSeconds, endCategoryOf } from '../stats'
import { TranscriptDialog } from '../TranscriptDialog'

const STATUSES = ['ended', 'active', 'waiting', 'inactive'] as const
const CATEGORIES: EndCategory[] = ['operator', 'customer', 'system', 'missed']

interface Filters {
  range: DateRange
  q: string
  operatorId: string
  channel: string
  status: string
  endCategory: string
  fields: Record<string, string>
}

const initial = (): Filters => ({ range: lastDays(7), q: '', operatorId: 'all', channel: 'all', status: 'all', endCategory: 'all', fields: {} })

export default function HistoryPage() {
  const { t } = useTranslation('adminInsights')
  const { t: tc } = useTranslation()
  const lang = useLang()
  const [filters, setFilters] = useState<Filters>(initial)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const options = useHistoryFilters()
  const debounced = useDebounced(filters, 300)

  const params = useMemo(() => {
    const fieldParams: Record<string, string> = {}
    for (const [id, value] of Object.entries(debounced.fields)) if (value.trim()) fieldParams[`field.${id}`] = value.trim()
    return {
      from: debounced.range.from,
      to: debounced.range.to,
      q: debounced.q.trim(),
      operatorId: debounced.operatorId,
      channel: debounced.channel,
      status: debounced.status,
      endCategory: debounced.endCategory,
      ...fieldParams,
      page,
    }
  }, [debounced, page])
  const history = useHistory(params)

  const update = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }
  const dirty = JSON.stringify(filters) !== JSON.stringify(initial())

  const columns: Column<SessionSummary>[] = [
    {
      id: 'customer',
      header: t('history.columns.customer'),
      cell: (row) => (
        <div className="min-w-0">
          <button type="button" onClick={() => setOpenId(row.id)} className="block max-w-full truncate text-left text-sm font-medium text-ink hover:underline focus-visible:underline">
            {row.customerName}
          </button>
          <p className="truncate text-xs text-muted">{row.secondaryLine ?? row.customerNumber}</p>
        </div>
      ),
    },
    { id: 'channel', header: t('history.columns.channel'), hideBelow: 'sm', cell: (row) => <ChannelBadge channel={row.channel} withLabel /> },
    {
      id: 'operator',
      header: t('history.columns.operator'),
      hideBelow: 'md',
      cell: (row) =>
        row.operator ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Avatar name={personName(row.operator.name, lang)} avatarId={row.operator.avatarId ?? undefined} avatarUrl={row.operator.avatarUrl ?? undefined} size="xs" />
            <span className="truncate text-sm">{personName(row.operator.name, lang)}</span>
          </span>
        ) : (
          <span className="text-muted">{t('history.noOperator')}</span>
        ),
    },
    {
      id: 'started',
      header: t('history.columns.started'),
      sortValue: (row) => row.startedAt,
      cell: (row) => <span className="tabular whitespace-nowrap text-sm">{formatDateTime(row.startedAt, lang)}</span>,
    },
    {
      id: 'duration',
      header: t('history.columns.duration'),
      hideBelow: 'lg',
      align: 'right',
      sortValue: (row) => durationSeconds(row),
      cell: (row) => <span className="tabular text-sm">{formatDuration(durationSeconds(row))}</span>,
    },
    {
      id: 'category',
      header: t('history.columns.category'),
      hideBelow: 'sm',
      cell: (row) => (row.status === 'ended' ? <EndCategoryBadge category={endCategoryOf(row)} /> : <Badge tone="success" dot>{tc(`sessionStatus.${row.status}`)}</Badge>),
    },
    {
      id: 'summary',
      header: t('history.columns.summary'),
      hideBelow: 'lg',
      width: '24%',
      cell: (row) => <span className="line-clamp-2 text-sm text-muted">{row.endSummary ?? '-'}</span>,
    },
    { id: 'rating', header: t('history.columns.rating'), hideBelow: 'md', cell: (row) => <Stars rating={row.rating} /> },
  ]

  const fields = options.data?.fields ?? []
  const total = history.data?.total ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('history.title')} description={t('history.description')} />

      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={filters.range} onChange={(range) => update({ range })} presets={[7, 30, 90]} />
          <div className="min-w-[200px] flex-1">
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder={t('history.filters.keyword')} aria-label={t('history.filters.keyword')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Select
            aria-label={t('history.filters.operator')}
            value={filters.operatorId}
            onValueChange={(operatorId) => update({ operatorId })}
            options={[{ value: 'all', label: t('history.filters.allOperators') }, ...(options.data?.operators ?? []).map((op) => ({ value: op.id, label: personName(op.name, lang) }))]}
          />
          <Select
            aria-label={t('history.filters.channel')}
            value={filters.channel}
            onValueChange={(channel) => update({ channel })}
            options={[{ value: 'all', label: tc('channel.all') }, ...CHANNELS.map((channel) => ({ value: channel, label: tc(`channel.${channel}`) }))]}
          />
          <Select
            aria-label={t('history.filters.status')}
            value={filters.status}
            onValueChange={(status) => update({ status })}
            options={[{ value: 'all', label: t('history.filters.anyStatus') }, ...STATUSES.map((status) => ({ value: status, label: tc(`sessionStatus.${status}`) }))]}
          />
          <Select
            aria-label={t('history.filters.endCategory')}
            value={filters.endCategory}
            onValueChange={(endCategory) => update({ endCategory })}
            options={[{ value: 'all', label: t('history.filters.anyCategory') }, ...CATEGORIES.map((category) => ({ value: category, label: tc(`endCategory.${category}`) }))]}
          />
          {fields.map((field) => {
            const label = pickText(field.label, lang)
            const value = filters.fields[field.id] ?? (field.type === 'select' ? 'all' : '')
            const set = (next: string) => update({ fields: { ...filters.fields, [field.id]: next } })
            return field.type === 'select' ? (
              <Select
                key={field.id}
                aria-label={label}
                value={value}
                onValueChange={set}
                options={[{ value: 'all', label: label }, ...field.options.map((option) => ({ value: option.value, label: pickText(option.label, lang) }))]}
              />
            ) : (
              <Input key={field.id} value={value} onChange={(event) => set(event.target.value)} placeholder={label} aria-label={label} />
            )
          })}
        </div>
        {dirty ? (
          <div>
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={16} strokeWidth={1.75} />} onClick={() => { setFilters(initial()); setPage(1) }}>
              {t('history.reset')}
            </Button>
          </div>
        ) : null}
      </Card>

      {history.isError && !history.data ? (
        <ErrorState title={tc('states.error')} onRetry={() => void history.refetch()} retryLabel={tc('actions.retry')} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {history.isLoading ? tc('states.loading') : t('history.count', { count: total })}
          </p>
          <DataTable
            columns={columns}
            rows={history.data?.rows}
            rowKey={(row) => row.id}
            loading={history.isLoading}
            total={total}
            pageSize={history.data?.pageSize ?? 25}
            page={page}
            onPageChange={setPage}
            onRowClick={(row) => setOpenId(row.id)}
            caption={t('history.title')}
            empty={{ title: t('history.empty.title'), description: t('history.empty.description'), nest: true }}
          />
        </div>
      )}

      <TranscriptDialog sessionId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  )
}
