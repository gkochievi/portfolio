import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, DataTable, FilterBar, Mono, PageHeader, SearchInput, Switch, type Column } from '@/components/ui'
import { formatPoints } from '@/lib/format'

import { useTaskTemplates, type TemplateListRow } from '../api'

function TemplateStatus({ row }: { row: TemplateListRow }) {
  const { t } = useTranslation('admin-catalog')
  if (row.archivedAt) return <Badge tone="neutral">{t('templates.status.archived')}</Badge>
  return row.isActive ? <Badge tone="success">{t('templates.status.active')}</Badge> : <Badge tone="warning">{t('templates.status.disabled')}</Badge>
}

export default function TaskTemplatesPage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const [showArchived, setShowArchived] = useState(false)
  const [q, setQ] = useState('')
  const { data, error, refetch, isLoading } = useTaskTemplates(showArchived)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!data) return undefined
    return needle ? data.filter((r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)) : data
  }, [data, q])

  const columns: Column<TemplateListRow>[] = [
    {
      key: 'name',
      header: t('templates.col.name'),
      sortable: true,
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{r.name}</div>
          {r.description ? <div className="max-w-xs truncate text-xs text-muted">{r.description}</div> : null}
        </div>
      ),
    },
    { key: 'code', header: t('templates.col.code'), mono: true, sortable: true, hideBelow: 'sm', cell: (r) => <Mono>{r.code}</Mono> },
    {
      key: 'defaultPoints',
      header: t('templates.col.points'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.defaultPoints ?? -1,
      cell: (r) => (r.defaultPoints === null ? <span className="text-subtle">—</span> : <span className="num">{formatPoints(r.defaultPoints)}</span>),
    },
    {
      key: 'type',
      header: t('templates.col.type'),
      hideBelow: 'md',
      sortable: true,
      sortValue: (r) => (r.isFreeform ? 1 : 0),
      cell: (r) => <Badge tone={r.isFreeform ? 'accent' : 'outline'} dot={false}>{t(r.isFreeform ? 'templates.type.freeform' : 'templates.type.fixed')}</Badge>,
    },
    {
      key: 'overrides',
      header: t('templates.col.overrides'),
      align: 'right',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (r) => r.overrideCount,
      cell: (r) => <span className="num text-muted">{r.overrideCount || '—'}</span>,
    },
    {
      key: 'status',
      header: t('templates.col.status'),
      sortable: true,
      sortValue: (r) => (r.archivedAt ? 2 : r.isActive ? 0 : 1),
      cell: (r) => <TemplateStatus row={r} />,
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={t('templates.eyebrow')}
        title={t('templates.title')}
        description={t('templates.description')}
        actions={
          <Button icon={<Plus />} asChild>
            <Link to="/admin/task-templates/new">{t('templates.new')}</Link>
          </Button>
        }
      />
      <FilterBar
        actions={
          rows ? <span className="num text-xs text-muted">{t('templates.count', { count: rows.length })}</span> : null
        }
      >
        <SearchInput value={q} onChange={setQ} placeholder={t('templates.searchPlaceholder')} className="w-full sm:w-72" aria-label={t('templates.searchPlaceholder')} />
        <Switch checked={showArchived} onCheckedChange={setShowArchived} label={t('templates.showArchived')} />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={isLoading ? undefined : rows}
        getRowId={(r) => r.id}
        rowNumbers
        rowHref={(r) => `/admin/task-templates/${r.id}`}
        error={error ? (error as Error).message : undefined}
        onRetry={() => void refetch()}
        initialSort={{ key: 'name', dir: 'asc' }}
        pageSize={0}
        empty={{
          title: q ? t('common:states.noResults') : t('templates.empty'),
          description: q ? undefined : t('templates.emptyDescription'),
          action: q ? undefined : (
            <Button icon={<Plus />} asChild>
              <Link to="/admin/task-templates/new">{t('templates.new')}</Link>
            </Button>
          ),
        }}
      />
    </div>
  )
}
