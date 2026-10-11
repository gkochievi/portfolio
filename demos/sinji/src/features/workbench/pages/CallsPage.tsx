/** Calls: tenant recordings table, digests and the "New analysis" panel. OWNED BY: workbench. */
import { FilePlus2, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  Panel,
  PageHeader,
  SearchInput,
  Select,
  StatusChip,
  toast,
  type Column,
} from '@/components/ui'
import { SummariseButton } from '@/features/analysis'
import { formatDate, formatDuration, formatPercent, formatRelative } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { useCanEdit } from '@/lib/session'
import type { RecordingRow } from '@/types'
import { useBands, useDeleteRecordings, useDigests, useRecordingEvents, useRecordings } from '../api'
import { NewAnalysisPanel } from '../components/NewAnalysisPanel'
import { RESULT_ICON } from '../components/RunBar'
import { AgreementBadge, BandPill, RecordingStatusChip, SourceIcon } from '../components/status'

const STATUSES = ['pending', 'transcribing', 'ready', 'analyzing', 'done', 'error'] as const
const KEYS = ['factcheck', 'score', 'semantic', 'summary'] as const

function Analysers({ row }: { row: RecordingRow }) {
  const { t } = useTranslation('workbench')
  return (
    <span className="inline-flex items-center gap-1.5">
      {KEYS.map((key) => {
        const Icon = RESULT_ICON[key]
        const running = (row.running as string[]).includes(key)
        const ran = row.ran[key]
        return (
          <span key={key} title={`${t(`analysers.${key}`)}: ${running ? t('status.running') : ran ? t('analysers.ran') : t('analysers.notRun')}`}>
            {running ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : (
              <Icon className={ran ? 'size-4 text-primary' : 'size-4 text-line-strong'} strokeWidth={1.75} />
            )}
          </span>
        )
      })}
    </span>
  )
}

export default function CallsPage() {
  const { t, i18n } = useTranslation('workbench')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const canEdit = useCanEdit()
  const bands = useBands()
  const { pick } = useGloss()
  useRecordingEvents()

  const [showNew, setShowNew] = useState(params.get('new') === '1')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 250)
    return () => window.clearTimeout(id)
  }, [search])

  const filters = { q, status: status === 'all' ? undefined : status, source: source === 'all' ? undefined : source }
  const list = useRecordings(filters)
  const digests = useDigests()
  const del = useDeleteRecordings()
  const filtered = Boolean(q) || status !== 'all' || source !== 'all'

  const columns: Column<RecordingRow>[] = [
    {
      key: 'filename',
      header: t('cols.recording'),
      sortable: true,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <SourceIcon source={r.source} />
          <span className="truncate font-medium">{r.filename}</span>
        </span>
      ),
    },
    { key: 'status', header: t('cols.status'), sortable: true, cell: (r) => <RecordingStatusChip status={r.status} /> },
    {
      key: 'language',
      header: t('cols.language'),
      hideBelow: 'md',
      cell: (r) => (r.language ? t(`lang.${r.language}`) : <span className="text-subtle">-</span>),
    },
    {
      key: 'duration_s',
      header: t('cols.duration'),
      hideBelow: 'md',
      align: 'right',
      sortable: true,
      cell: (r) => <span className="tabular">{r.duration_s ? formatDuration(r.duration_s, i18n.language) : '-'}</span>,
    },
    { key: 'ran', header: t('cols.analysers'), hideBelow: 'lg', cell: (r) => <Analysers row={r} /> },
    {
      key: 'score',
      header: t('cols.score'),
      align: 'right',
      sortable: (r) => r.score ?? -1,
      cell: (r) => (r.score === null ? <span className="text-subtle">-</span> : <BandPill score={r.score} bands={bands} size="sm" />),
    },
    {
      key: 'accuracy',
      header: t('cols.accuracy'),
      hideBelow: 'lg',
      align: 'right',
      sortable: (r) => r.accuracy ?? -1,
      cell: (r) => <span className="tabular">{r.accuracy === null ? '-' : formatPercent(r.accuracy, i18n.language, { ratio: false })}</span>,
    },
    { key: 'agreement', header: t('cols.agreement'), hideBelow: 'lg', cell: (r) => <AgreementBadge agreement={r.agreement} /> },
    {
      key: 'created_at',
      header: t('cols.created'),
      hideBelow: 'sm',
      sortable: true,
      cell: (r) => (
        <span className="block leading-tight">
          <span className="block truncate">{r.created_by}</span>
          <span className="text-xs text-muted" title={formatDate(r.created_at, i18n.language)}>
            {formatRelative(r.created_at, i18n.language)}
          </span>
        </span>
      ),
    },
  ]

  const deleteSelected = async () => {
    try {
      await del.mutateAsync(selected)
      toast.success(t('list.deleted', { count: selected.length }))
      setSelected([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common:errors.generic'))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => setShowNew((v) => !v)} aria-expanded={showNew}>
            {t('new.button')}
          </Button>
        }
      />

      {showNew ? <NewAnalysisPanel onClose={() => setShowNew(false)} /> : null}

      <section aria-label={t('list.title')} className="space-y-3">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('list.search')} />
          <Select
            size="sm"
            className="w-full sm:w-44"
            value={status}
            onValueChange={setStatus}
            options={[{ value: 'all', label: t('list.allStatuses') }, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))]}
          />
          <Select
            size="sm"
            className="w-full sm:w-40"
            value={source}
            onValueChange={setSource}
            options={[
              { value: 'all', label: t('list.allSources') },
              { value: 'audio', label: t('source.audio') },
              { value: 'text', label: t('source.text') },
            ]}
          />
        </FilterBar>

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary/30 bg-primary/6 px-3 py-2" role="region" aria-label={t('list.selection')}>
            <span className="text-sm font-medium">{t('common:table.selected', { count: selected.length })}</span>
            <SummariseButton recordingIds={selected} disabled={selected.length > 10} />
            {selected.length > 10 ? <span className="text-xs text-muted">{t('list.maxSummarise')}</span> : null}
            {canEdit ? (
              <Button variant="danger-ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
                {t('list.delete')}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
              {t('common:actions.clear')}
            </Button>
          </div>
        ) : null}

        {list.isError ? (
          <Callout tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void list.refetch()}>{t('common:actions.retry')}</Button>}>
            {t('common:errors.load')}
          </Callout>
        ) : (
          <DataTable
            rows={list.data}
            loading={list.isLoading}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/workspace/calls/${r.id}`)}
            selectedKeys={selected}
            onSelectionChange={setSelected}
            defaultSort={{ key: 'created_at', dir: 'desc' }}
            pageSize={10}
            caption={t('list.title')}
            empty={
              filtered ? (
                <EmptyState
                  compact
                  title={t('list.noMatch')}
                  body={t('common:empty.noResults')}
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSearch('')
                        setStatus('all')
                        setSource('all')
                      }}
                    >
                      {t('common:empty.clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title={t('list.emptyTitle')}
                  body={t('list.emptyBody')}
                  action={<Button variant="primary" onClick={() => setShowNew(true)}>{t('new.button')}</Button>}
                />
              )
            }
          />
        )}
      </section>

      <Panel title={t('digests.title')} description={t('digests.description')}>
        {digests.isLoading ? (
          <p className="text-sm text-muted">{t('common:loading')}</p>
        ) : digests.isError || (digests.data?.length ?? 0) === 0 ? (
          <EmptyState compact title={t('digests.emptyTitle')} body={t('digests.emptyBody')} />
        ) : (
          <ul className="divide-y divide-line">
            {[...(digests.data ?? [])]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/workspace/summaries/${s.id}`}
                    className="flex flex-wrap items-start gap-x-4 gap-y-1 rounded-ctl px-1 py-3 hover:bg-sunken/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{pick(s.title, s.title_en)}</span>
                      <span className="mt-0.5 line-clamp-2 text-sm text-muted">{pick(s.short_summary, s.short_summary_en)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      {s.status === 'running' ? (
                        <StatusChip tone="accent" pulse>{t('status.running')}</StatusChip>
                      ) : (
                        <Badge size="sm" tone="neutral">{t('digests.calls', { count: s.calls.length })}</Badge>
                      )}
                      <span>{formatRelative(s.created_at, i18n.language)}</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('list.deleteTitle', { count: selected.length })}
        body={t('list.deleteBody')}
        confirmLabel={t('list.delete')}
        danger
        onConfirm={deleteSelected}
      />
    </div>
  )
}
