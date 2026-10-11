import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { Banner, Button, PageHeader, Tabs, TabsList, TabsTrigger } from '@/components/ui'

import { useTasks, type TaskFilters } from '../api'
import { TaskExportButtons, TaskFilterBar, type TaskFilterValue, TasksTable } from './TasksTable'

type Area = 'l1' | 'technician'
type Tab = 'mine' | 'unassigned' | 'all'
const TABS: Tab[] = ['mine', 'unassigned', 'all']

/**
 * The task queue table with its URL-backed filters, shared by /l1/tasks and
 * /technician/tasks. Filters live in the query string (state, partnerId, q,
 * mine, tab) so a view can be bookmarked or linked from a dashboard tile.
 */
export function TaskListView({ area }: { area: Area }) {
  const { t } = useTranslation(['tasks', 'common'])
  const [params, setParams] = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'mine'
  const value: TaskFilterValue = {
    state: params.get('state') ?? 'all',
    partnerId: params.get('partnerId') ?? 'all',
    q: params.get('q') ?? '',
    mine: params.get('mine') === '1',
  }

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, v] of Object.entries(changes)) {
            if (v === null || v === '' || v === 'all') next.delete(key)
            else next.set(key, v)
          }
          return next
        },
        { replace: true },
      )
      setSelectedIds([])
    },
    [setParams],
  )

  const filters: TaskFilters = useMemo(
    () => ({
      state: value.state,
      partnerId: value.partnerId,
      q: value.q,
      ...(area === 'l1' ? { mine: value.mine } : { tab }),
    }),
    [area, tab, value.mine, value.partnerId, value.q, value.state],
  )
  const query = useTasks(filters)
  const rows = query.data?.rows
  const selected = useMemo(() => (rows ?? []).filter((r) => selectedIds.includes(r.id)), [rows, selectedIds])
  const base = area === 'l1' ? '/l1/tasks' : '/technician/tasks'
  const filtered = value.state !== 'all' || value.partnerId !== 'all' || value.q !== '' || value.mine

  return (
    <>
      <PageHeader
        eyebrow={t(area === 'l1' ? 'list.eyebrowL1' : 'list.eyebrowTechnician')}
        title={t(area === 'l1' ? 'list.titleL1' : 'list.titleTechnician')}
        description={t(area === 'l1' ? 'list.descriptionL1' : 'list.descriptionTechnician')}
        actions={
          area === 'l1' ? (
            <Button asChild icon={<Plus />}>
              <Link to="/l1/tasks/new">{t('list.new')}</Link>
            </Button>
          ) : undefined
        }
      />

      {area === 'technician' ? (
        <Tabs value={tab} onValueChange={(v) => patch({ tab: v === 'mine' ? null : v })} className="mb-3">
          <TabsList>
            {TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {area === 'technician' && tab === 'unassigned' ? (
        <Banner tone="warning" title={t('tabs.unassignedTitle')}>
          {t('tabs.unassignedNote')}
        </Banner>
      ) : null}

      <TaskFilterBar
        value={value}
        showMine={area === 'l1'}
        onChange={(change) =>
          patch({
            ...(change.state !== undefined ? { state: change.state } : {}),
            ...(change.partnerId !== undefined ? { partnerId: change.partnerId } : {}),
            ...(change.q !== undefined ? { q: change.q } : {}),
            ...(change.mine !== undefined ? { mine: change.mine ? '1' : null } : {}),
          })
        }
        onClear={() => patch({ state: null, partnerId: null, q: null, mine: null })}
        actions={<TaskExportButtons rows={rows ?? []} selected={selected} />}
      />

      <div className="mb-2 flex min-h-5 items-center justify-between text-[13px] text-muted">
        <span className="num">{rows ? t('list.count', { count: rows.length }) : ''}</span>
        {selectedIds.length > 0 ? <span className="num">{t('common:table.selected', { count: selectedIds.length })}</span> : null}
      </div>

      <TasksTable
        rows={rows}
        error={query.isError ? query.error : undefined}
        onRetry={() => void query.refetch()}
        basePath={base}
        selectedIds={selectedIds}
        onSelectedChange={setSelectedIds}
        empty={
          filtered
            ? { title: t('common:states.noResults'), description: t('list.emptyFiltered') }
            : { title: t('common:states.allCaughtUp'), description: t(tab === 'unassigned' && area === 'technician' ? 'list.emptyUnassigned' : 'list.empty') }
        }
      />
    </>
  )
}
