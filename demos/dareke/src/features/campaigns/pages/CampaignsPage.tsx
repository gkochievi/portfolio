/** /admin/campaigns: list with filters, lifecycle actions, create/edit drawer and quick import. */
import { Archive, MoreHorizontal, Pause, Pencil, Play, Plus, Square, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  SearchInput,
  Select,
  Toolbar,
  type Column,
} from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { CampaignStatus, CampaignWithStats } from '@/types'

import { useCampaigns, useDeleteCampaign, type CampaignFilters } from '../api'
import { CampaignFormDrawer } from '../components/CampaignFormDrawer'
import { ImportNumbersDialog } from '../components/ImportNumbersDialog'
import { CampaignStatusPill, canPause, canStart, canStop, useApiErrorText, useLifecycleActions } from '../components/shared'

const STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed', 'archived']
const i18 = { size: 16, strokeWidth: 1.75 } as const

export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const navigate = useNavigate()
  const errText = useApiErrorText()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<CampaignFilters>({ status: 'all', q: '' })
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<{ open: boolean; campaign: CampaignWithStats | null }>({ open: false, campaign: null })
  const [importing, setImporting] = useState<CampaignWithStats | null>(null)
  const [deleting, setDeleting] = useState<CampaignWithStats | null>(null)
  const query = useCampaigns(filters)
  const remove = useDeleteCampaign()
  const lifecycle = useLifecycleActions()

  // Debounce the search box.
  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 250)
    return () => window.clearTimeout(id)
  }, [search])

  // ?new=1 opens the create drawer (the admin dashboard links here).
  useEffect(() => {
    if (params.get('new') === '1') {
      setDrawer({ open: true, campaign: null })
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: (r) => {
        toast.success(r.archived ? t('delete.archived') : t('delete.deleted'), { description: l(deleting.name) })
        setDeleting(null)
      },
      onError: (error) => {
        toast.error(t('delete.failed'), { description: errText(error) })
        setDeleting(null)
      },
    })
  }

  const columns = useMemo<Column<CampaignWithStats>[]>(
    () => [
      {
        key: 'name',
        header: t('list.name'),
        sortValue: (c) => l(c.name),
        cell: (c) => (
          <Link to={`/admin/campaigns/${c.id}`} className="font-medium text-ink underline-offset-4 hover:underline" onClick={(e) => e.stopPropagation()}>
            {l(c.name)}
          </Link>
        ),
      },
      { key: 'client', header: t('list.client'), sortValue: (c) => l(c.clientName), cell: (c) => <span className="text-muted">{l(c.clientName)}</span>, hideOnMobile: true },
      { key: 'status', header: t('list.status'), sortValue: (c) => STATUSES.indexOf(c.status), cell: (c) => <CampaignStatusPill status={c.status} /> },
      { key: 'mode', header: t('list.mode'), sortValue: (c) => c.dialingMode, cell: (c) => <span className="text-sm">{tc(`dialingMode.${c.dialingMode}`)}</span>, hideOnMobile: true },
      { key: 'numbers', header: t('list.numbers'), align: 'right', sortValue: (c) => c.stats.totalNumbers, cell: (c) => <span className="font-mono tabular">{formatNumber(c.stats.totalNumbers)}</span> },
      {
        key: 'progress',
        header: t('list.progress'),
        sortValue: (c) => c.stats.progress,
        width: '160px',
        cell: (c) => (
          <div className="flex min-w-[120px] items-center gap-2">
            <ProgressBar value={c.stats.progress} size="sm" tone={c.status === 'active' ? 'success' : 'ink'} className="flex-1" />
            <span className="w-10 text-right font-mono text-xs tabular text-muted">{Math.round(c.stats.progress)}%</span>
          </div>
        ),
        hideOnMobile: true,
      },
      { key: 'agents', header: t('list.agents'), align: 'right', sortValue: (c) => c.agentCount, cell: (c) => <span className={c.agentCount === 0 ? 'text-warning' : 'tabular'}>{c.agentCount}</span>, hideOnMobile: true },
      { key: 'created', header: t('list.created'), sortValue: (c) => c.createdAt, cell: (c) => <span className="font-mono text-xs text-muted">{formatDate(c.createdAt)}</span>, hideOnMobile: true },
      {
        key: 'actions',
        header: <span className="sr-only">{t('list.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={t('list.actionsFor', { name: l(c.name) })} icon={<MoreHorizontal size={18} strokeWidth={1.75} />} size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canStart(c.status) && (
                  <DropdownMenuItem icon={<Play {...i18} />} onSelect={() => lifecycle.request(c, 'start')}>
                    {c.status === 'paused' ? t('lifecycle.resume') : t('lifecycle.start')}
                  </DropdownMenuItem>
                )}
                {canPause(c.status) && (
                  <DropdownMenuItem icon={<Pause {...i18} />} onSelect={() => lifecycle.request(c, 'pause')}>
                    {t('lifecycle.pause')}
                  </DropdownMenuItem>
                )}
                {canStop(c.status) && (
                  <DropdownMenuItem icon={<Square {...i18} />} onSelect={() => lifecycle.request(c, 'stop')}>
                    {t('lifecycle.stop')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Pencil {...i18} />} onSelect={() => setDrawer({ open: true, campaign: c })}>
                  {tc('actions.edit')}
                </DropdownMenuItem>
                {c.status !== 'completed' && c.status !== 'archived' && (
                  <DropdownMenuItem icon={<Upload {...i18} />} onSelect={() => setImporting(c)}>
                    {t('list.importNumbers')}
                  </DropdownMenuItem>
                )}
                {c.status !== 'archived' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={<Trash2 {...i18} />} danger onSelect={() => setDeleting(c)}>
                      {tc('actions.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tc, l],
  )

  const filtered = filters.status !== 'all' || filters.q !== ''

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('pages.CampaignsPage')}
        description={t('list.subtitle')}
        actions={
          <Button variant="dial" icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setDrawer({ open: true, campaign: null })}>
            {t('list.new')}
          </Button>
        }
      />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder={t('list.search')} />
        <Select
          className="w-full sm:w-48"
          aria-label={t('list.status')}
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as CampaignFilters['status'] }))}
          options={[{ value: 'all', label: t('list.allStatuses') }, ...STATUSES.map((s) => ({ value: s, label: tc(`campaignStatus.${s}`) }))]}
        />
      </Toolbar>
      {query.isError ? (
        <Alert
          tone="danger"
          title={tc('states.error')}
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {errText(query.error)}
        </Alert>
      ) : (
        <DataTable
          rows={query.data ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={query.isLoading}
          pageSize={10}
          onRowClick={(c) => navigate(`/admin/campaigns/${c.id}`)}
          empty={
            filtered ? (
              <EmptyState title={tc('states.noResults')} description={tc('states.noResultsHint')} compact />
            ) : (
              <EmptyState
                title={t('list.emptyTitle')}
                description={t('list.emptyHint')}
                action={
                  <Button variant="dial" icon={<Plus size={18} strokeWidth={1.75} />} onClick={() => setDrawer({ open: true, campaign: null })}>
                    {t('list.new')}
                  </Button>
                }
              />
            )
          }
        />
      )}

      <CampaignFormDrawer
        open={drawer.open}
        campaign={drawer.campaign}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        onSaved={(saved, created) => created && navigate(`/admin/campaigns/${saved.id}`)}
      />
      {importing && (
        <ImportNumbersDialog open={!!importing} onOpenChange={(o) => !o && setImporting(null)} campaignId={importing.id} campaignName={l(importing.name)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('delete.title')}
        description={deleting ? t('delete.body', { name: l(deleting.name) }) : ''}
        confirmLabel={tc('actions.delete')}
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      >
        <p className="flex items-start gap-2 text-sm text-muted">
          <Archive size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {t('delete.archiveNote')}
        </p>
      </ConfirmDialog>
      {lifecycle.dialog}
    </div>
  )
}
