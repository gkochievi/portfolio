import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  CircleCheckBig,
  Download,
  Images,
  Square,
  Trash2,
} from 'lucide-react'

import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { useDeletePhotos, useDownloadPhotos, useOptions, usePhotos } from '@/lib/queries'
import type { Filters } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Badge, Button, EmptyState, PageHeader, Panel, Skeleton } from '@/components/ui/primitives'
import { Input, Select } from '@/components/ui/form'
import { Pagination } from '@/components/ui/table'
import { FilterBar, FilterSlot } from '@/components/domain/FilterBar'
import { Lightbox } from '@/components/domain/Lightbox'
import type { Photo } from '@/types'

type Scope = 'all' | 'device' | 'campaign'

export function PhotosPage({ scope = 'all' }: { scope?: Scope }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { deviceId, campaignId } = useParams()
  const [params, setParams] = useSearchParams()

  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number[] | null>(null)

  const device = scope === 'device' ? deviceId : params.get('device') || undefined
  const campaign = scope === 'campaign' ? campaignId : params.get('campaign') || undefined
  const dateFrom = params.get('date_from') || ''
  const dateTo = params.get('date_to') || ''

  const filters: Filters = useMemo(
    () => ({
      device,
      campaign,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [device, campaign, dateFrom, dateTo],
  )

  const { data, isPending, isFetching, error } = usePhotos({ ...filters, page })
  const { data: options } = useOptions()
  const remove = useDeletePhotos()
  const downloader = useDownloadPhotos()

  // Reset paging and selection whenever the result set changes shape.
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [device, campaign, dateFrom, dateTo])

  useEffect(() => setSelected(new Set()), [page])

  // Deleting everything on the final page leaves `page` beyond num_pages, and
  // the refetch then returns an empty list forever. Step back into range.
  useEffect(() => {
    if (data && data.num_pages > 0 && page > data.num_pages) {
      setPage(data.num_pages)
    }
  }, [data, page])

  // The out-of-range refetch itself 404s ("Invalid page.") rather than
  // returning data, so the clamp above never sees fresh numbers — without
  // this the gallery would sit on the stale, already-deleted page.
  useEffect(() => {
    if (page > 1 && error instanceof ApiError && error.status === 404) {
      setPage(page - 1)
    }
  }, [error, page])

  const photos = data?.results ?? []
  const allSelected = photos.length > 0 && photos.every((photo) => selected.has(photo.id))
  const hasFilters = Boolean(
    dateFrom || dateTo || (scope === 'all' && (device || campaign)),
  )

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true })

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(photos.map((photo) => photo.id)))
  }

  const runDelete = () => {
    const ids = confirmDelete
    if (!ids?.length) return
    remove.mutate(ids, {
      onSuccess: () => {
        toast.success(t('photos.deleted', { count: ids.length }))
        setSelected(new Set())
        setConfirmDelete(null)
        setLightboxIndex(null)
      },
      onError: () => toast.error(t('common.somethingWentWrong')),
    })
  }

  const downloadSelected = () => {
    downloader.mutate(
      { ids: [...selected] },
      {
        onSuccess: (count) => toast.success(t('photos.downloaded', { count })),
        onError: () => toast.error(t('common.somethingWentWrong')),
      },
    )
  }

  const downloadAll = () => {
    downloader.mutate(
      { filters },
      {
        onSuccess: (count) => toast.success(t('photos.downloaded', { count })),
        onError: () => toast.error(t('common.somethingWentWrong')),
      },
    )
  }

  const scopeName =
    scope === 'device'
      ? options?.devices.find((entry) => entry.device_id === deviceId || String(entry.id) === deviceId)?.name
      : scope === 'campaign'
        ? options?.campaigns.find((entry) => String(entry.id) === campaignId)?.name
        : undefined

  const title =
    scope === 'device'
      ? t('photos.ofDevice', { name: scopeName ?? deviceId })
      : scope === 'campaign'
        ? t('photos.ofCampaign', { name: scopeName ?? campaignId })
        : t('photos.title')

  return (
    <>
      <PageHeader
        title={title}
        subtitle={data ? t('photos.subtitle', { count: data.count }) : undefined}
        breadcrumb={
          scope !== 'all' ? (
            <Link
              to={scope === 'device' ? '/devices' : '/campaigns'}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-gold"
            >
              <ChevronLeft className="size-3.5" />
              {scope === 'device' ? t('photos.backToDevices') : t('photos.backToCampaigns')}
            </Link>
          ) : undefined
        }
        actions={
          <Button
            icon={<Download className="size-4" />}
            onClick={downloadAll}
            loading={downloader.isPending && !selected.size}
            disabled={!data?.count}
          >
            {hasFilters ? t('photos.downloadFiltered') : t('photos.downloadAll')}
          </Button>
        }
      />

      <FilterBar active={hasFilters ? 1 : 0} onClear={clearFilters}>
        {scope === 'all' && (
          <>
            <FilterSlot label={t('common.device')}>
              <Select value={device ?? ''} onChange={(event) => setParam('device', event.target.value)}>
                <option value="">{t('common.all')}</option>
                {options?.devices.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </FilterSlot>
            <FilterSlot label={t('common.campaign')}>
              <Select value={campaign ?? ''} onChange={(event) => setParam('campaign', event.target.value)}>
                <option value="">{t('common.all')}</option>
                {options?.campaigns.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </FilterSlot>
          </>
        )}
        <FilterSlot label={t('common.dateFrom')}>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setParam('date_from', event.target.value)}
            className="numeral"
          />
        </FilterSlot>
        <FilterSlot label={t('common.dateTo')}>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setParam('date_to', event.target.value)}
            className="numeral"
          />
        </FilterSlot>
      </FilterBar>

      {/* Selection toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={allSelected ? <Square className="size-3.5" /> : <CircleCheckBig className="size-3.5" />}
          onClick={toggleAll}
          disabled={!photos.length}
        >
          {allSelected ? t('photos.deselectAll') : t('photos.selectAll')}
        </Button>

        {selected.size > 0 && (
          <div className="animate-fade flex flex-wrap items-center gap-2">
            <Badge tone="gold">{t('common.selected', { count: selected.size })}</Badge>
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="size-3.5" />}
              onClick={downloadSelected}
              loading={downloader.isPending}
            >
              {t('photos.downloadSelected')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => setConfirmDelete([...selected])}
            >
              {t('photos.deleteSelected')}
            </Button>
          </div>
        )}

        {isFetching && !isPending && (
          <span className="ml-auto text-xs text-ink-faint">{t('common.loading')}</span>
        )}
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {Array.from({ length: 18 }, (_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : photos.length ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                selected={selected.has(photo.id)}
                onToggle={() => toggle(photo.id)}
                onOpen={() => setLightboxIndex(index)}
                onDelete={() => setConfirmDelete([photo.id])}
              />
            ))}
          </div>
          <Pagination
            page={data!.page}
            numPages={data!.num_pages}
            count={data!.count}
            pageSize={data!.page_size}
            onChange={setPage}
          />
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={<Images className="size-5" />}
            title={hasFilters ? t('photos.empty') : t('photos.emptyAll')}
            action={hasFilters ? <Button onClick={clearFilters}>{t('common.clearAll')}</Button> : undefined}
          />
        </Panel>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={(photo) => setConfirmDelete([photo.id])}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        loading={remove.isPending}
        title={t('photos.deleteTitle')}
        body={t('photos.deleteBody', { count: confirmDelete?.length ?? 0 })}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}

/* --------------------------------------------------------------- PhotoTile */

function PhotoTile({
  photo,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  photo: Photo
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()

  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-control border bg-surface transition-all duration-200',
        selected ? 'border-gold shadow-gold' : 'border-hairline hover:border-hairline-strong',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('photos.openFull')}
        className="block aspect-[3/4] w-full overflow-hidden bg-void/60"
      >
        <img
          src={photo.thumbnail_url ?? photo.photo_url ?? ''}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </button>

      {/* Selection checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t('common.select')}
        onClick={onToggle}
        className={cn(
          'absolute top-2 left-2 grid size-6 place-items-center rounded-md border backdrop-blur transition-all',
          selected
            ? 'border-gold bg-gold text-void'
            : 'border-white/25 bg-void/60 text-transparent opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <CircleCheckBig className="size-3.5" />
      </button>

      {/* Quick actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {photo.photo_url && (
          <a
            href={photo.photo_url}
            download
            target="_blank"
            rel="noreferrer"
            aria-label={t('common.download')}
            onClick={(event) => event.stopPropagation()}
            className="grid size-6 place-items-center rounded-md border border-white/20 bg-void/70 text-ink-muted backdrop-blur transition-colors hover:text-ink"
          >
            <Download className="size-3" />
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('common.delete')}
          className="grid size-6 place-items-center rounded-md border border-danger/40 bg-void/70 text-danger/85 backdrop-blur transition-colors hover:text-danger"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/85 to-transparent px-2.5 pt-6 pb-2">
        <p className="truncate text-[11px] font-medium text-ink">{photo.campaign?.name ?? '—'}</p>
        <p className="numeral truncate text-[10px] text-ink-faint">
          {photo.device?.name ?? '—'} · {formatDateTime(photo.timestamp)}
        </p>
      </figcaption>
    </figure>
  )
}
