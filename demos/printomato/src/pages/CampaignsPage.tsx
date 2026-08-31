import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarRange, Images, MapPin, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useCampaigns, useDeleteCampaign } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Badge, Button, EmptyState, IconButton, PageHeader, Panel, Skeleton } from '@/components/ui/primitives'
import { SearchInput } from '@/components/ui/form'
import { Pagination } from '@/components/ui/table'
import { ProgressBar } from '@/components/charts/indicators'
import { FilterBar, FilterSlot, SegmentedControl } from '@/components/domain/FilterBar'
import { CampaignFormModal } from '@/components/domain/CampaignFormModal'
import type { Campaign, CampaignState } from '@/types'

type StateFilter = 'all' | CampaignState

const STATE_TONES: Record<CampaignState, 'online' | 'info' | 'offline'> = {
  active: 'online',
  upcoming: 'info',
  expired: 'offline',
}

export function CampaignsPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [state, setState] = useState<StateFilter>('all')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<Campaign | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null)

  useEffect(() => setPage(1), [search, state])

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      state: state === 'all' ? undefined : state,
      page,
      page_size: 24,
    }),
    [search, state, page],
  )

  const { data, isPending } = useCampaigns(filters)
  const remove = useDeleteCampaign()

  const activeFilters = [search.trim(), state !== 'all' ? state : ''].filter(Boolean).length
  const clearFilters = () => {
    setSearch('')
    setState('all')
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(t('campaigns.deleted', { name }))
        setPendingDelete(null)
      },
      onError: () => toast.error(t('common.somethingWentWrong')),
    })
  }

  return (
    <>
      <PageHeader
        title={t('campaigns.title')}
        subtitle={data ? t('campaigns.subtitle', { count: data.count }) : undefined}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
            {t('campaigns.add')}
          </Button>
        }
      />

      <FilterBar active={activeFilters} onClear={clearFilters}>
        <FilterSlot label={t('common.search')} className="min-w-[14rem] flex-[2]">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, sponsor or location…" />
        </FilterSlot>
        <FilterSlot label={t('common.status')} className="flex-[1.4]" as="div">
          <SegmentedControl<StateFilter>
            label={t('common.status')}
            value={state}
            onChange={setState}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'active', label: t('campaigns.active') },
              { value: 'upcoming', label: t('campaigns.upcoming') },
              { value: 'expired', label: t('campaigns.expired') },
            ]}
          />
        </FilterSlot>
      </FilterBar>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      ) : data?.results.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.results.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={() => {
                  setEditing(campaign)
                  setFormOpen(true)
                }}
                onDelete={() => setPendingDelete(campaign)}
              />
            ))}
          </div>
          <Pagination
            page={data.page}
            numPages={data.num_pages}
            count={data.count}
            pageSize={data.page_size}
            onChange={setPage}
          />
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title={activeFilters ? t('campaigns.empty') : t('campaigns.emptyAll')}
            action={
              activeFilters ? (
                <Button onClick={clearFilters}>{t('common.clearAll')}</Button>
              ) : (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                  {t('campaigns.add')}
                </Button>
              )
            }
          />
        </Panel>
      )}

      <CampaignFormModal open={formOpen} campaign={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={remove.isPending}
        title={t('campaigns.deleteTitle')}
        body={t('campaigns.deleteBody', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}

/* ------------------------------------------------------------ CampaignCard */

function CampaignCard({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: Campaign
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const artwork = campaign.main_logo ?? campaign.banner

  return (
    <Panel className="group flex flex-col overflow-hidden transition-colors duration-200 hover:border-hairline-strong">
      {/* Artwork strip */}
      <div className="relative h-24 overflow-hidden border-b border-hairline bg-void/50">
        {campaign.banner && (
          <img
            src={campaign.banner}
            alt=""
            className="absolute inset-0 size-full scale-105 object-cover opacity-25 blur-[1px] transition-transform duration-500 group-hover:scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
        <div className="relative flex h-full items-center justify-between gap-3 px-4">
          {artwork ? (
            <img src={artwork} alt="" className="max-h-14 max-w-[55%] object-contain" />
          ) : (
            <Megaphone className="size-7 text-ink-faint" />
          )}
          <Badge
            tone={STATE_TONES[campaign.state]}
            dot={campaign.state === 'active'}
            pulse={campaign.state === 'active'}
          >
            {t(`campaigns.${campaign.state}`)}
          </Badge>
        </div>
      </div>

      <div className="px-4 pt-3.5">
        <h3 className="truncate text-[15px] leading-tight font-semibold text-ink">{campaign.name}</h3>
        <p className="mt-1 truncate text-xs text-ink-faint">{campaign.sponsor}</p>
        {campaign.location && (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-ink-faint">
            <MapPin className="size-3 shrink-0" />
            {campaign.location}
          </p>
        )}
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-px border-y border-hairline bg-white/[0.03]">
        {[
          { label: t('campaigns.printed'), value: formatNumber(campaign.total_printed) },
          { label: t('campaigns.remaining'), value: formatNumber(campaign.photo_quantity), accent: true },
          { label: t('campaigns.live'), value: `${campaign.online_devices}/${campaign.total_devices}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-3 py-2.5">
            <dt className="text-[10px] tracking-[0.06em] text-ink-faint uppercase">{stat.label}</dt>
            <dd className={cn('numeral mt-0.5 text-sm font-semibold', stat.accent ? 'text-gold' : 'text-ink')}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-4 pt-3.5">
        <p className="label-caps flex items-center gap-1.5">
          <CalendarRange className="size-3" />
          {t('campaigns.period')}
        </p>
        <p className="numeral mt-1.5 text-[11px] text-ink-muted">
          {formatDateTime(campaign.start_time)}
        </p>
        <p className="numeral text-[11px] text-ink-muted">{formatDateTime(campaign.end_time)}</p>
        {campaign.state !== 'upcoming' && (
          <div className="mt-2.5">
            <ProgressBar
              percent={campaign.days_gone_percentage}
              tone={campaign.state === 'expired' ? 'danger' : 'gold'}
            />
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-hairline px-4 py-3 pt-3.5">
        <Link to={`/campaigns/${campaign.id}/photos`} className="flex-1">
          <Button size="sm" className="w-full" icon={<Images className="size-3.5" />}>
            {t('campaigns.viewPhotos')}
          </Button>
        </Link>
        <IconButton label={t('common.edit')} size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton label={t('common.delete')} size="sm" variant="danger" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </Panel>
  )
}
