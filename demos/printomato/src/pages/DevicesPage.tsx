import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertOctagon,
  Bell,
  Images,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatMoney, formatNumber } from '@/lib/format'
import { useDeleteDevice, useDeviceCommand, useDevices } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Badge, Button, EmptyState, IconButton, PageHeader, Panel, Skeleton } from '@/components/ui/primitives'
import { SearchInput } from '@/components/ui/form'
import { PaperMeter } from '@/components/charts/indicators'
import { FilterBar, FilterSlot, SegmentedControl } from '@/components/domain/FilterBar'
import { DeviceFormModal } from '@/components/domain/DeviceFormModal'
import type { Device } from '@/types'

type Presence = 'all' | 'online' | 'offline'
type Mode = 'all' | 'paid' | 'free'

export function DevicesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [presence, setPresence] = useState<Presence>('all')
  const [mode, setMode] = useState<Mode>('all')

  const [editing, setEditing] = useState<Device | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null)

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      presence: presence === 'all' ? undefined : presence,
      mode: mode === 'all' ? undefined : mode,
    }),
    [search, presence, mode],
  )

  const { data: devices, isPending } = useDevices(filters)
  const remove = useDeleteDevice()
  const command = useDeviceCommand()

  const focusId = Number(params.get('focus') ?? 0)
  const activeFilters = [search.trim(), presence !== 'all' ? presence : '', mode !== 'all' ? mode : ''].filter(
    Boolean,
  ).length

  const clearFilters = () => {
    setSearch('')
    setPresence('all')
    setMode('all')
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (device: Device) => {
    setEditing(device)
    setFormOpen(true)
  }

  const restart = (device: Device) => {
    command.mutate(
      { id: device.id, command: 'restart' },
      {
        onSuccess: (result) => {
          if (result.delivered) {
            toast.success(t('devices.restarted', { name: device.name }))
          } else {
            toast.info(t('devices.restartOffline'), device.name)
          }
        },
        onError: (error) =>
          toast.error(
            t('common.somethingWentWrong'),
            error instanceof ApiError ? error.message : undefined,
          ),
      },
    )
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(t('devices.deleted', { name }))
        setPendingDelete(null)
      },
      onError: () => toast.error(t('common.somethingWentWrong')),
    })
  }

  return (
    <>
      <PageHeader
        title={t('devices.title')}
        subtitle={devices ? t('devices.subtitle', { count: devices.length }) : undefined}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
            {t('devices.add')}
          </Button>
        }
      />

      <FilterBar active={activeFilters} onClear={clearFilters}>
        <FilterSlot label={t('common.search')} className="min-w-[13rem] flex-[2]">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, ID or location…" />
        </FilterSlot>
        <FilterSlot label={t('devices.presence')} as="div">
          <SegmentedControl<Presence>
            label={t('devices.presence')}
            value={presence}
            onChange={setPresence}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'online', label: t('devices.online') },
              { value: 'offline', label: t('devices.offline') },
            ]}
          />
        </FilterSlot>
        <FilterSlot label={t('devices.mode')} as="div">
          <SegmentedControl<Mode>
            label={t('devices.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'free', label: t('devices.modeFree') },
              { value: 'paid', label: t('devices.modePaid') },
            ]}
          />
        </FilterSlot>
      </FilterBar>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      ) : devices?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              highlighted={device.id === focusId}
              onEdit={() => openEdit(device)}
              onDelete={() => setPendingDelete(device)}
              onRestart={() => restart(device)}
              restarting={command.isPending && command.variables?.id === device.id}
              onDismissFocus={() => {
                params.delete('focus')
                setParams(params, { replace: true })
              }}
            />
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={<Printer className="size-5" />}
            title={activeFilters ? t('devices.empty') : t('devices.emptyAll')}
            action={
              activeFilters ? (
                <Button onClick={clearFilters}>{t('common.clearAll')}</Button>
              ) : (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={openCreate}>
                  {t('devices.add')}
                </Button>
              )
            }
          />
        </Panel>
      )}

      <DeviceFormModal open={formOpen} device={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={remove.isPending}
        title={t('devices.deleteTitle')}
        body={t('devices.deleteBody', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}

/* -------------------------------------------------------------- DeviceCard */

function DeviceCard({
  device,
  highlighted,
  onEdit,
  onDelete,
  onRestart,
  restarting,
  onDismissFocus,
}: {
  device: Device
  highlighted: boolean
  onEdit: () => void
  onDelete: () => void
  onRestart: () => void
  restarting: boolean
  onDismissFocus: () => void
}) {
  const { t } = useTranslation()

  return (
    <Panel
      className={cn(
        'group flex flex-col overflow-hidden transition-all duration-200',
        'hover:border-hairline-strong',
        highlighted && 'border-gold/50 shadow-gold',
      )}
      onMouseEnter={highlighted ? onDismissFocus : undefined}
    >
      {/* Presence strip */}
      <div
        aria-hidden
        className={cn('h-[2px] w-full', device.is_online ? 'bg-online' : 'bg-white/8')}
      />

      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                device.is_online ? 'animate-pulse-ring bg-online' : 'bg-offline',
              )}
              aria-hidden
            />
            <h3 className="truncate text-[15px] leading-tight font-semibold text-ink">{device.name}</h3>
          </div>
          {/* Presence is also stated in words — the dot's colour is never the
              only signal. */}
          <p className="mt-1 flex items-center gap-1.5 truncate text-[11px]">
            <span className={cn('font-semibold', device.is_online ? 'text-online' : 'text-ink-faint')}>
              {device.is_online ? t('devices.online') : t('devices.offline')}
            </span>
            <span className="text-ink-faint/50">·</span>
            <span className="numeral truncate text-ink-faint">{device.device_id}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {device.has_notifications && (
            <Link to={`/devices/${device.device_id}/notifications`} aria-label={t('devices.viewAlerts')}>
              <span className="grid size-7 place-items-center rounded-[8px] border border-warn/30 bg-warn/10 text-warn">
                <AlertOctagon className="size-3.5" />
              </span>
            </Link>
          )}
          {!device.is_active && <Badge tone="offline">{t('devices.inactive')}</Badge>}
        </div>
      </div>

      {device.location && (
        <p className="mt-1.5 flex items-center gap-1 truncate px-4 text-xs text-ink-faint">
          <MapPin className="size-3 shrink-0" />
          {device.location}
        </p>
      )}

      {/* Metrics */}
      <div className="mt-3.5 grid grid-cols-3 gap-px border-y border-hairline bg-white/[0.03]">
        {[
          { label: t('devices.printedToday'), value: formatNumber(device.printed_today) },
          { label: t('devices.printed'), value: formatNumber(device.total_printed) },
          {
            label: t('devices.mode'),
            value: device.requires_payment ? formatMoney(device.photo_price) : t('devices.modeFree'),
            accent: device.requires_payment,
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-surface px-3 py-2.5">
            <p className="text-[10px] tracking-[0.06em] text-ink-faint uppercase">{metric.label}</p>
            <p
              className={cn(
                'numeral mt-0.5 truncate text-sm font-semibold',
                metric.accent ? 'text-gold' : 'text-ink',
              )}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Paper */}
      <div className="px-4 pt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label-caps">{t('devices.paper')}</span>
        </div>
        <PaperMeter count={device.paper_count} capacity={device.paper_capacity} state={device.paper_state} />
      </div>

      {/* Campaigns */}
      <div className="mt-3.5 min-h-[2.5rem] px-4">
        <div className="flex flex-wrap gap-1.5">
          {device.campaigns.length === 0 ? (
            <Badge tone="neutral">{t('devices.noCampaigns')}</Badge>
          ) : (
            device.campaigns.map((campaign) => (
              <Badge key={campaign.id} tone="gold" className="max-w-full">
                <span className="truncate">{campaign.name}</span>
              </Badge>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-hairline px-4 py-3">
        <Link to={`/devices/${device.id}/photos`} className="flex-1">
          <Button size="sm" className="w-full" icon={<Images className="size-3.5" />}>
            {t('devices.viewPhotos')}
          </Button>
        </Link>
        <Link to={`/devices/${device.device_id}/notifications`}>
          <IconButton label={t('devices.viewAlerts')} size="sm">
            <Bell className="size-3.5" />
          </IconButton>
        </Link>
        <IconButton label={t('common.edit')} size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton
          label={device.is_online ? t('devices.restart') : t('devices.restartOffline')}
          size="sm"
          variant="gold"
          disabled={!device.is_online || restarting}
          onClick={onRestart}
        >
          <RefreshCw className={cn('size-3.5', restarting && 'animate-spin')} />
        </IconButton>
        <IconButton label={t('common.delete')} size="sm" variant="danger" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </Panel>
  )
}
