import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertOctagon, BellOff, Check, CheckCheck, ChevronLeft, Eye, Mail } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useMarkAllRead, useNotifications, useOptions, useUpdateNotification } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { Badge, Button, EmptyState, IconButton, PageHeader, Panel } from '@/components/ui/primitives'
import { Input, Select } from '@/components/ui/form'
import { Pagination, TableSkeleton, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { FilterBar, FilterSlot } from '@/components/domain/FilterBar'
import type { AppNotification, NotificationStatus } from '@/types'

const STATUS_META: Record<NotificationStatus, { tone: 'info' | 'gold' | 'offline'; icon: typeof Eye; key: string }> = {
  1: { tone: 'info', icon: Eye, key: 'notifications.statusRead' },
  2: { tone: 'gold', icon: Mail, key: 'notifications.statusUnread' },
  3: { tone: 'offline', icon: Check, key: 'notifications.statusClosed' },
}

export function NotificationsPage({ scoped = false }: { scoped?: boolean }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { deviceId } = useParams()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)

  const device = scoped ? deviceId : params.get('device') || undefined
  const campaign = params.get('campaign') || undefined
  const status = params.get('status') || ''
  const dateFrom = params.get('date_from') || ''
  const dateTo = params.get('date_to') || ''

  const filters = useMemo(
    () => ({
      device,
      campaign,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [device, campaign, status, dateFrom, dateTo],
  )

  useEffect(() => setPage(1), [device, campaign, status, dateFrom, dateTo])

  const { data, isPending } = useNotifications({ ...filters, page })
  const { data: options } = useOptions()
  const update = useUpdateNotification()
  const markAll = useMarkAllRead()

  const activeFilters = [
    !scoped && device ? '1' : '',
    campaign,
    status,
    dateFrom,
    dateTo,
  ].filter(Boolean).length

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const markRead = (notification: AppNotification) => {
    if (notification.status !== 2) return
    update.mutate({ id: notification.id, status: 1 })
  }

  const close = (notification: AppNotification) => {
    update.mutate(
      { id: notification.id, status: 3 },
      { onSuccess: () => toast.success(t('notifications.closed')) },
    )
  }

  const scopeName = options?.devices.find(
    (entry) => entry.device_id === deviceId || String(entry.id) === deviceId,
  )?.name

  return (
    <>
      <PageHeader
        title={scoped ? t('notifications.ofDevice', { name: scopeName ?? deviceId }) : t('notifications.title')}
        subtitle={data ? t('notifications.subtitle', { count: data.count }) : undefined}
        breadcrumb={
          scoped ? (
            <Link
              to="/devices"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-gold"
            >
              <ChevronLeft className="size-3.5" />
              {t('photos.backToDevices')}
            </Link>
          ) : undefined
        }
        actions={
          <Button
            icon={<CheckCheck className="size-4" />}
            loading={markAll.isPending}
            onClick={() =>
              markAll.mutate(undefined, {
                onSuccess: () => toast.success(t('notifications.markedAllRead')),
              })
            }
          >
            {t('notifications.markAllRead')}
          </Button>
        }
      />

      <FilterBar
        active={activeFilters}
        onClear={() => setParams(new URLSearchParams(), { replace: true })}
      >
        {!scoped && (
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
        )}
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
        <FilterSlot label={t('common.status')}>
          <Select value={status} onChange={(event) => setParam('status', event.target.value)}>
            <option value="">{t('common.all')}</option>
            {options?.notification_statuses.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </Select>
        </FilterSlot>
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

      <Panel className="overflow-hidden">
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-10" />
              <Th>{t('common.device')}</Th>
              <Th>{t('common.campaign')}</Th>
              <Th>Message</Th>
              <Th>{t('notifications.raised')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="w-16 text-right">{t('common.actions')}</Th>
            </tr>
          </thead>

          {isPending ? (
            <TableSkeleton rows={8} cols={7} />
          ) : (
            <tbody>
              {data?.results.map((notification) => {
                const meta = STATUS_META[notification.status]
                const unread = notification.status === 2
                return (
                  <Tr key={notification.id} className={cn(unread && 'bg-gold/[0.045]')}>
                    <Td className="pr-0">
                      <span
                        className={cn(
                          'grid size-7 place-items-center rounded-full',
                          unread ? 'bg-warn/12 text-warn' : 'bg-white/5 text-ink-faint',
                        )}
                      >
                        <AlertOctagon className="size-3.5" />
                      </span>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink">{notification.device?.name ?? '—'}</p>
                      <p className="numeral text-[11px] text-ink-faint">
                        {notification.device?.device_id ?? ''}
                      </p>
                    </Td>
                    <Td className="max-w-[14rem] truncate">{notification.campaign?.name ?? '—'}</Td>
                    <Td className="text-ink">{notification.message_display}</Td>
                    <Td>
                      <p className="numeral text-xs">{formatDateTime(notification.timestamp)}</p>
                      <p className="text-[11px] text-ink-faint">{formatRelative(notification.timestamp)}</p>
                    </Td>
                    <Td>
                      <Badge tone={meta.tone} dot={unread}>
                        {t(meta.key)}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* A real button, not a row click: the <tr> was not
                            focusable, so this was mouse-only. */}
                        {unread && (
                          <IconButton
                            label={t('notifications.markRead')}
                            size="sm"
                            onClick={() => markRead(notification)}
                          >
                            <Eye className="size-3.5" />
                          </IconButton>
                        )}
                        {notification.status !== 3 && (
                          <IconButton
                            label={t('notifications.close')}
                            size="sm"
                            onClick={() => close(notification)}
                          >
                            <Check className="size-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          )}
        </TableWrap>

        {!isPending && !data?.results.length && (
          <EmptyState
            icon={<BellOff className="size-5" />}
            title={activeFilters ? t('notifications.empty') : t('notifications.emptyAll')}
          />
        )}
      </Panel>

      {data && (
        <Pagination
          page={data.page}
          numPages={data.num_pages}
          count={data.count}
          pageSize={data.page_size}
          onChange={setPage}
        />
      )}
    </>
  )
}
