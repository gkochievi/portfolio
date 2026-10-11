import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProjectStateChip } from '@/components/status'
import { Badge, Button, type Column, DataTable, FilterBar, Money, PageHeader, SearchInput, Select, SelectItem, Mono } from '@/components/ui'
import { formatNumber, formatProjectNumber } from '@/lib/format'

import { type ProjectRow, useProjects } from '../api'
import { CreateProjectDialog } from '../components/ProjectDialogs'

const STATES = ['open', 'completed', 'cancelled'] as const

export default function ProjectsPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const navigate = useNavigate()
  const query = useProjects()
  const [q, setQ] = useState('')
  const [state, setState] = useState<string>('all')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return query.data?.rows
      .filter((p) => state === 'all' || p.state === state)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.partnerName.toLowerCase().includes(needle) || formatProjectNumber(p.number).toLowerCase().includes(needle))
  }, [query.data, q, state])

  const columns = useMemo<Column<ProjectRow>[]>(
    () => [
      { key: 'number', header: t('projects.cols.number'), sortable: true, width: 100, cell: (r) => <Mono>{formatProjectNumber(r.number)}</Mono> },
      {
        key: 'name',
        header: t('projects.cols.name'),
        sortable: true,
        cell: (r) => (
          <div className="min-w-0 max-w-[480px]">
            <div className="truncate font-medium text-ink">{r.name}</div>
            <div className="truncate text-xs text-muted sm:hidden">{r.partnerName}</div>
          </div>
        ),
      },
      { key: 'partnerName', header: t('projects.cols.partner'), sortable: true, hideBelow: 'sm' },
      { key: 'state', header: t('common:fields.status'), sortable: true, width: 130, cell: (r) => <ProjectStateChip state={r.state} /> },
      {
        key: 'taskCount',
        header: t('projects.cols.tasks'),
        sortable: true,
        align: 'right',
        hideBelow: 'sm',
        width: 90,
        cell: (r) => <span className="num">{formatNumber(r.taskCount)}</span>,
      },
      {
        key: 'price',
        header: t('projects.cols.price'),
        sortable: true,
        align: 'right',
        width: 150,
        sortValue: (r) => r.price ?? -1,
        cell: (r) =>
          r.price === null ? <Badge tone="warning">{t('projects.pricingPending')}</Badge> : <Money amount={r.price} currency={r.currency} />,
      },
    ],
    [t],
  )

  const filtered = q !== '' || state !== 'all'

  return (
    <>
      <PageHeader
        eyebrow={t('projects.eyebrow')}
        title={t('projects.title')}
        description={t('projects.description')}
        icon={<FolderKanban />}
        actions={
          <Button icon={<Plus />} onClick={() => setCreating(true)}>
            {t('projects.new')}
          </Button>
        }
      />
      <FilterBar onClear={filtered ? () => { setQ(''); setState('all') } : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder={t('projects.searchPlaceholder')} />
        <div className="w-full sm:w-44">
          <Select aria-label={t('common:fields.status')} value={state} onValueChange={setState}>
            <SelectItem value="all">{t('projects.anyState')}</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`common:projectState.${s}`)}
              </SelectItem>
            ))}
          </Select>
        </div>
      </FilterBar>
      <DataTable<ProjectRow>
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        rowHref={(r) => `/l1/projects/${r.id}`}
        initialSort={{ key: 'number', dir: 'desc' }}
        empty={
          filtered
            ? { title: t('projects.emptyFiltered') }
            : { title: t('projects.empty'), description: t('projects.emptyHint'), action: <Button icon={<Plus />} onClick={() => setCreating(true)}>{t('projects.new')}</Button> }
        }
        caption={t('projects.title')}
      />
      <CreateProjectDialog
        open={creating}
        onOpenChange={setCreating}
        partners={query.data?.partners ?? []}
        onCreated={(p) => navigate(`/l1/projects/${p.id}`)}
      />
    </>
  )
}
