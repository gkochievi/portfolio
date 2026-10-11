/** /admin/events/:eventId/items: falling items for one event (sponsor items and hazards). */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'

import { ItemToken } from '@/components/brand'
import { Badge, Button, DataTable, ErrorState, IconButton, InlineConfirm, toast, toastError, type Column, type Tone } from '@/components/ui'
import { formatNumber, formatSigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Item, ItemType } from '@/types'
import { useContentSync, useItemCrud, useItems } from '../api'
import { ItemSheet } from '../components/ItemSheet'
import { ContentHeader, useCanEdit } from '../components/shared'

const TYPE_TONE: Record<ItemType, Tone> = { GOOD: 'primary', MINOR: 'warning', MAJOR: 'danger' }

export default function ItemsPage() {
  const { eventId = '' } = useParams()
  const { t } = useTranslation('content')
  const canEdit = useCanEdit()
  useContentSync()
  const items = useItems(eventId)
  const { remove } = useItemCrud(eventId)
  const [sheet, setSheet] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null })

  const openCreate = () => setSheet({ open: true, item: null })
  const openEdit = (item: Item) => setSheet({ open: true, item })

  const summary = useMemo(() => {
    const rows = items.data ?? []
    return {
      good: rows.filter((r) => r.type === 'GOOD').length,
      hazards: rows.filter((r) => r.type !== 'GOOD').length,
      inactive: rows.filter((r) => !r.active).length,
    }
  }, [items.data])

  const columns: Column<Item>[] = [
    {
      id: 'art',
      header: <span className="sr-only">{t('items.columns.art')}</span>,
      width: '64px',
      cell: (row) => <ItemToken type={row.type} imageUrl={row.imageUrl} name={row.name} size={36} />,
    },
    {
      id: 'name',
      header: t('items.columns.name'),
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <div className="min-w-0">
          {canEdit ? (
            <button type="button" onClick={() => openEdit(row)} className="max-w-full truncate text-left font-medium text-ink hover:text-primary hover:underline">
              {row.name}
            </button>
          ) : (
            <span className="font-medium">{row.name}</span>
          )}
          <div className="truncate text-xs text-muted md:hidden">
            {row.brandName ?? t('items.noBrand')} · {t('items.weightShort', { value: row.weight })}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('items.columns.type'),
      hideBelow: 'sm',
      sortValue: (row) => row.type,
      cell: (row) => <Badge tone={TYPE_TONE[row.type]} size="sm">{t(`types.${row.type}`)}</Badge>,
    },
    {
      id: 'points',
      header: t('items.columns.points'),
      align: 'right',
      sortValue: (row) => row.points,
      cell: (row) => (
        <span className={cn('font-mono tabular-nums', row.points >= 0 ? 'text-success' : 'text-danger')}>{formatSigned(row.points)}</span>
      ),
    },
    {
      id: 'brand',
      header: t('items.columns.brand'),
      hideBelow: 'md',
      sortValue: (row) => row.brandName ?? '',
      cell: (row) => (row.brandName ? <span className="truncate">{row.brandName}</span> : <span className="text-muted">—</span>),
    },
    {
      id: 'weight',
      header: t('items.columns.weight'),
      align: 'right',
      hideBelow: 'md',
      sortValue: (row) => row.weight,
      cell: (row) => <span className="font-mono tabular-nums">{formatNumber(row.weight)}</span>,
    },
    {
      id: 'active',
      header: t('items.columns.active'),
      hideBelow: 'sm',
      sortValue: (row) => (row.active ? 1 : 0),
      cell: (row) =>
        row.active ? (
          <Badge tone="success" dot size="sm">{t('state.active')}</Badge>
        ) : (
          <Badge tone="neutral" size="sm">{t('state.inactive')}</Badge>
        ),
    },
  ]

  if (canEdit) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">{t('items.columns.actions')}</span>,
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton label={t('common:actions.edit')} icon={<Pencil className="size-4" />} size="sm" onClick={() => openEdit(row)} />
          <InlineConfirm
            iconOnly
            question={t('items.deleteQuestion')}
            onConfirm={async () => {
              try {
                await remove.mutateAsync(row.id)
                toast.success(t('items.toasts.deleted', { name: row.name }))
              } catch (error) {
                toastError(error)
              }
            }}
          />
        </div>
      ),
    })
  }

  return (
    <div>
      <ContentHeader
        eventId={eventId}
        title={t('items.title')}
        description={t('items.description')}
        actions={
          canEdit ? (
            <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
              {t('items.add')}
            </Button>
          ) : null
        }
      />

      {items.isError ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <>
          {items.data && items.data.length > 0 ? (
            <p className="mb-3 text-sm text-muted tabular-nums">
              {t('items.summary', { good: summary.good, hazards: summary.hazards })}
              {summary.inactive ? ` · ${t('items.inactiveCount', { count: summary.inactive })}` : ''}
            </p>
          ) : null}
          <DataTable
            columns={columns}
            rows={items.data}
            getRowId={(row) => row.id}
            pageSize={0}
            rowClassName={(row) => (row.active ? '' : 'opacity-60')}
            caption={t('items.title')}
            empty={
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <p className="font-display text-base text-ink">{t('items.empty.title')}</p>
                <p className="max-w-sm text-sm text-muted">{t('items.empty.description')}</p>
                {canEdit ? (
                  <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                    {t('items.add')}
                  </Button>
                ) : null}
              </div>
            }
          />
        </>
      )}

      {canEdit ? (
        <ItemSheet eventId={eventId} open={sheet.open} item={sheet.item} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
      ) : null}
    </div>
  )
}
