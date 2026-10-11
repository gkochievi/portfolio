import { Boxes, Globe2, Lock, MoreHorizontal, Pencil, RefreshCw, Tags, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { errorMessage } from '@/api/client'
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterBar,
  IconButton,
  Select,
  SearchInput,
  Switch,
  toast,
  type Column,
} from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { useCanEdit } from '@/lib/session'
import {
  isInFlight,
  useBulkAction,
  useDeleteDocument,
  useKbDocuments,
  useKbTags,
  useReembedDocument,
  useUpdateDocument,
} from '../api'
import { DocTypeBadge, StatusCell } from '../components/fields'
import { EditDocumentDialog, RetagDialog } from '../components/dialogs'
import { KB_DOC_TYPES, type KbBulkAction, type KbDocumentRow } from '../types'

const PAGE_SIZE = 20
const ALL = 'all'

/** Documents table: filters, selection, bulk actions, per-row actions. OWNED BY: knowledge-base. */
export default function KbDocumentsPage() {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const gloss = useGloss()
  const navigate = useNavigate()
  const canEdit = useCanEdit()
  const [params, setParams] = useSearchParams()

  const status = params.get('status') ?? ''
  const docType = params.get('doc_type') ?? ''
  const tag = params.get('tag') ?? ''
  const visibility = params.get('visibility') ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const [search, setSearch] = useState(q)
  const [selected, setSelected] = useState<string[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KbDocumentRow | null>(null)
  const [bulkDelete, setBulkDelete] = useState(false)
  const [retag, setRetag] = useState(false)

  const setParam = (patch: Record<string, string | null>, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (resetPage) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // Debounced search (250 ms) -> URL.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => setParam({ q: search.trim() || null }), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const docs = useKbDocuments({ status, doc_type: docType, tag, visibility, q, page, page_size: PAGE_SIZE })
  const tags = useKbTags()
  const update = useUpdateDocument()
  const remove = useDeleteDocument()
  const reembed = useReembedDocument()
  const bulk = useBulkAction()

  const rows = docs.data?.items
  const filtered = Boolean(status || docType || tag || visibility || q)

  const typeOptions = useMemo(
    () => [{ value: ALL, label: t('documents.allTypes') }, ...KB_DOC_TYPES.map((v) => ({ value: v, label: t(`docTypes.${v}`) }))],
    [t],
  )
  const statusOptions = [
    { value: ALL, label: t('documents.allStatuses') },
    { value: 'ready', label: t('status.ready') },
    { value: 'in_progress', label: t('status.inProgress') },
    { value: 'error', label: t('status.error') },
  ]
  const tagOptions = [{ value: ALL, label: t('documents.allTags') }, ...(tags.data ?? []).map((v) => ({ value: v, label: v }))]
  const visibilityOptions = [
    { value: ALL, label: t('documents.allVisibility') },
    { value: 'public', label: t('visibility.public') },
    { value: 'internal', label: t('visibility.internal') },
  ]

  const clearFilters = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  const toggleVisibility = (doc: KbDocumentRow, next: boolean) =>
    update.mutate(
      { id: doc.id, visibility: next ? 'public' : 'internal' },
      {
        onSuccess: () => toast.success(next ? t('documents.nowPublic') : t('documents.nowInternal')),
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  const runBulk = (action: KbBulkAction, extra?: { tags?: string[]; mode?: 'add' | 'replace' }) =>
    bulk.mutateAsync({ ids: selected, action, ...extra }).then(
      ({ affected }) => {
        toast.success(t(`bulk.done.${action}`, { count: affected }))
        if (action === 'delete') setSelected([])
        return true
      },
      (e) => {
        toast.error(errorMessage(e))
        return false
      },
    )

  const columns: Column<KbDocumentRow>[] = [
    {
      key: 'title',
      header: t('documents.columns.title'),
      sortable: (d) => d.title.toLowerCase(),
      cell: (d) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {canEdit ? (
              <button type="button" onClick={() => setEditId(d.id)} className="truncate text-left font-medium text-ink hover:text-primary hover:underline">
                {gloss.pick(d.title, d.title_en)}
              </button>
            ) : (
              <Link to={`/workspace/kb/chunks?doc=${d.id}`} className="truncate font-medium text-ink hover:text-primary hover:underline">
                {gloss.pick(d.title, d.title_en)}
              </Link>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="truncate">{d.filename ?? t(`source.${d.source_type}`)}</span>
            {d.tags.slice(0, 3).map((x) => (
              <Badge key={x} shape="tag" size="sm">
                {x}
              </Badge>
            ))}
            {d.tags.length > 3 ? <span>+{d.tags.length - 3}</span> : null}
          </div>
          {d.status === 'error' && d.error ? <p className="mt-1 text-xs text-danger">{d.error}</p> : null}
        </div>
      ),
    },
    { key: 'doc_type', header: t('documents.columns.type'), hideBelow: 'md', sortable: (d) => d.doc_type, cell: (d) => <DocTypeBadge type={d.doc_type} /> },
    {
      key: 'status',
      header: t('documents.columns.status'),
      sortable: (d) => d.status,
      cell: (d) => <StatusCell status={d.status} error={d.error} restructuring={d.restructure === 'running'} />,
    },
    {
      key: 'visibility',
      header: t('documents.columns.visibility'),
      cell: (d) =>
        canEdit ? (
          <Switch
            size="sm"
            checked={d.visibility === 'public'}
            disabled={update.isPending && update.variables?.id === d.id}
            onCheckedChange={(v) => toggleVisibility(d, v)}
            label={d.visibility === 'public' ? t('visibility.public') : t('visibility.internal')}
          />
        ) : (
          <Badge tone={d.visibility === 'public' ? 'success' : 'neutral'} size="sm" icon={d.visibility === 'public' ? <Globe2 className="size-3" /> : <Lock className="size-3" />}>
            {t(`visibility.${d.visibility}`)}
          </Badge>
        ),
    },
    { key: 'chunk_count', header: t('documents.columns.chunks'), align: 'right', hideBelow: 'md', sortable: true, cell: (d) => <span className="tabular">{fmt.number(d.chunk_count)}</span> },
    { key: 'updated_at', header: t('documents.columns.updated'), hideBelow: 'lg', sortable: (d) => d.updated_at, cell: (d) => <span className="text-muted">{fmt.relative(d.updated_at)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('documents.columns.actions')}</span>,
      align: 'right',
      width: 56,
      cell: (d) => (
        <DropdownMenu
          trigger={<IconButton label={t('documents.rowActions', { title: d.title })} icon={<MoreHorizontal />} />}
          items={[
            ...(canEdit ? [{ label: t('actions.edit'), icon: <Pencil />, onSelect: () => setEditId(d.id) }] : []),
            { label: t('documents.viewChunks'), icon: <Boxes />, onSelect: () => navigate(`/workspace/kb/chunks?doc=${d.id}`) },
            ...(canEdit
              ? [
                  {
                    label: t('documents.reembed'),
                    icon: <RefreshCw />,
                    disabled: isInFlight(d.status),
                    onSelect: () =>
                      reembed.mutate(d.id, { onSuccess: () => toast.success(t('documents.reembedStarted')), onError: (e) => toast.error(errorMessage(e)) }),
                  },
                  { type: 'separator' as const },
                  { label: t('actions.delete'), icon: <Trash2 />, danger: true, onSelect: () => setDeleteTarget(d) },
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        end={
          canEdit ? (
            <Button asChild variant="primary" size="sm" icon={<Upload />}>
              <Link to="/workspace/kb/import">{t('documents.import')}</Link>
            </Button>
          ) : undefined
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder={t('documents.search')} className="w-full sm:w-64" />
        <Select size="sm" className="w-full sm:w-44" value={status || ALL} onValueChange={(v) => setParam({ status: v === ALL ? null : v })} options={statusOptions} aria-label={t('documents.columns.status')} />
        <Select size="sm" className="w-full sm:w-44" value={docType || ALL} onValueChange={(v) => setParam({ doc_type: v === ALL ? null : v })} options={typeOptions} aria-label={t('documents.columns.type')} />
        <Select size="sm" className="w-full sm:w-44" value={tag || ALL} onValueChange={(v) => setParam({ tag: v === ALL ? null : v })} options={tagOptions} aria-label={t('fields.tags')} />
        <Select size="sm" className="w-full sm:w-44" value={visibility || ALL} onValueChange={(v) => setParam({ visibility: v === ALL ? null : v })} options={visibilityOptions} aria-label={t('documents.columns.visibility')} />
        {filtered ? (
          <Button variant="ghost" size="sm" icon={<X />} onClick={clearFilters}>
            {t('documents.clear')}
          </Button>
        ) : null}
      </FilterBar>

      {!canEdit ? <Callout tone="info" icon={<Lock />}>{t('readOnly')}</Callout> : null}

      {canEdit && selected.length > 0 ? (
        <div role="region" aria-label={t('bulk.region')} className="flex flex-wrap items-center gap-2 rounded-card border border-primary/30 bg-primary/8 px-3 py-2">
          <span className="mr-2 text-sm font-medium">{t('bulk.selected', { count: selected.length })}</span>
          <Button size="sm" variant="secondary" icon={<Globe2 />} disabled={bulk.isPending} onClick={() => void runBulk('publish')}>
            {t('bulk.publish')}
          </Button>
          <Button size="sm" variant="secondary" icon={<Lock />} disabled={bulk.isPending} onClick={() => void runBulk('unpublish')}>
            {t('bulk.unpublish')}
          </Button>
          <Button size="sm" variant="secondary" icon={<RefreshCw />} disabled={bulk.isPending} onClick={() => void runBulk('reembed')}>
            {t('bulk.reembed')}
          </Button>
          <Button size="sm" variant="secondary" icon={<Tags />} disabled={bulk.isPending} onClick={() => setRetag(true)}>
            {t('bulk.retag')}
          </Button>
          <Button size="sm" variant="danger-ghost" icon={<Trash2 />} disabled={bulk.isPending} onClick={() => setBulkDelete(true)}>
            {t('actions.delete')}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
            {t('bulk.clear')}
          </Button>
        </div>
      ) : null}

      {docs.isError ? (
        <Callout tone="danger" title={t('documents.loadFailed')} action={<Button size="sm" onClick={() => void docs.refetch()}>{t('actions.retry')}</Button>}>
          {errorMessage(docs.error)}
        </Callout>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          loading={docs.isLoading}
          caption={t('documents.caption')}
          pageSize={0}
          {...(canEdit ? { selectedKeys: selected, onSelectionChange: setSelected } : {})}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            total: docs.data?.total ?? 0,
            onPageChange: (p) => setParam({ page: p > 1 ? String(p) : null }, false),
          }}
          empty={
            filtered ? (
              <EmptyState compact title={t('documents.noMatch')} body={t('documents.noMatchBody')} action={<Button onClick={clearFilters}>{t('documents.clear')}</Button>} />
            ) : (
              <EmptyState
                compact
                title={t('documents.emptyTitle')}
                body={t('documents.emptyBody')}
                action={
                  canEdit ? (
                    <Button asChild variant="primary" icon={<Upload />}>
                      <Link to="/workspace/kb/import">{t('documents.import')}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      )}

      <EditDocumentDialog id={editId} onClose={() => setEditId(null)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('delete.title')}
        body={t('delete.body', { title: deleteTarget?.title ?? '', count: deleteTarget?.chunk_count ?? 0 })}
        confirmLabel={t('actions.delete')}
        danger
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await remove.mutateAsync(deleteTarget.id)
            setSelected((s) => s.filter((id) => id !== deleteTarget.id))
            toast.success(t('delete.done'))
          } catch (e) {
            toast.error(errorMessage(e))
          }
          setDeleteTarget(null)
        }}
      />

      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={t('delete.bulkTitle', { count: selected.length })}
        body={t('delete.bulkBody')}
        confirmLabel={t('actions.delete')}
        danger
        onConfirm={async () => {
          await runBulk('delete')
          setBulkDelete(false)
        }}
      />

      <RetagDialog
        open={retag}
        count={selected.length}
        busy={bulk.isPending}
        onOpenChange={setRetag}
        onSubmit={(tagList, mode) =>
          void runBulk('retag', { tags: tagList, mode }).then((ok) => {
            if (ok) setRetag(false)
          })
        }
      />
    </div>
  )
}
