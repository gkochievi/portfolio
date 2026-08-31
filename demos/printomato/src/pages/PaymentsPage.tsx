import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CircleSlash, Clock3, Receipt, Wallet } from 'lucide-react'

import { formatDateTime, formatMoney, formatNumber, formatPercent, formatRelative } from '@/lib/format'
import { useOptions, usePayments, usePaymentSummary } from '@/lib/queries'
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/primitives'
import { Input, SearchInput, Select } from '@/components/ui/form'
import { Pagination, TableSkeleton, TableWrap, Td, Th, Tr } from '@/components/ui/table'
import { StatTile } from '@/components/charts/indicators'
import { FilterBar, FilterSlot } from '@/components/domain/FilterBar'
import type { PaymentStatus } from '@/types'

const STATUS_TONES: Record<PaymentStatus, 'online' | 'gold' | 'danger'> = {
  success: 'online',
  started: 'gold',
  rejected: 'danger',
}

const STATUS_KEYS: Record<PaymentStatus, string> = {
  success: 'payments.statusSuccess',
  started: 'payments.statusStarted',
  rejected: 'payments.statusRejected',
}

export function PaymentsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const device = params.get('device') || undefined
  const status = params.get('status') || ''
  const dateFrom = params.get('date_from') || ''
  const dateTo = params.get('date_to') || ''

  const filters = useMemo(
    () => ({
      device,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search.trim() || undefined,
    }),
    [device, status, dateFrom, dateTo, search],
  )

  useEffect(() => setPage(1), [device, status, dateFrom, dateTo, search])

  const { data, isPending } = usePayments({ ...filters, page })
  const { data: summary } = usePaymentSummary(filters)
  const { data: options } = useOptions()

  const activeFilters = [device, status, dateFrom, dateTo, search.trim()].filter(Boolean).length

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const clearFilters = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        subtitle={data ? t('payments.subtitle', { count: data.count }) : undefined}
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('payments.revenue')}
          value={formatMoney(summary?.revenue ?? 0)}
          icon={<Wallet className="size-4" />}
          accent
          loading={!summary}
        />
        <StatTile
          label={t('payments.succeeded')}
          value={formatNumber(summary?.succeeded)}
          icon={<CheckCircle2 className="size-4" />}
          loading={!summary}
          hint={summary ? `${formatPercent(summary.success_rate, 1)} ${t('payments.successRate').toLowerCase()}` : undefined}
        />
        <StatTile
          label={t('payments.pending')}
          value={formatNumber(summary?.started)}
          icon={<Clock3 className="size-4" />}
          loading={!summary}
        />
        <StatTile
          label={t('payments.rejected')}
          value={formatNumber(summary?.rejected)}
          icon={<CircleSlash className="size-4" />}
          loading={!summary}
        />
      </section>

      <FilterBar active={activeFilters} onClear={clearFilters}>
        <FilterSlot label={t('common.search')} className="min-w-[12rem] flex-[1.6]">
          <SearchInput value={search} onChange={setSearch} placeholder="Payment ID or device…" />
        </FilterSlot>
        <FilterSlot label={t('common.device')}>
          <Select value={device ?? ''} onChange={(event) => setParam('device', event.target.value)}>
            <option value="">{t('common.all')}</option>
            {options?.devices.map((entry) => (
              <option key={entry.id} value={entry.device_id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </FilterSlot>
        <FilterSlot label={t('common.status')}>
          <Select value={status} onChange={(event) => setParam('status', event.target.value)}>
            <option value="">{t('common.all')}</option>
            {options?.payment_statuses.map((choice) => (
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
              <Th>{t('payments.paymentId')}</Th>
              <Th>{t('common.device')}</Th>
              <Th>{t('common.status')}</Th>
              <Th className="text-right">{t('payments.amount')}</Th>
              <Th>{t('payments.created')}</Th>
              <Th>{t('payments.updated')}</Th>
            </tr>
          </thead>

          {isPending ? (
            <TableSkeleton rows={8} cols={6} />
          ) : (
            <tbody>
              {data?.results.map((session) => (
                <Tr key={session.id}>
                  <Td className="numeral max-w-[13rem] truncate text-ink">{session.payment_id}</Td>
                  <Td>
                    <p className="font-medium text-ink">{session.device?.name ?? '—'}</p>
                    <p className="numeral text-[11px] text-ink-faint">{session.device?.device_id ?? ''}</p>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONES[session.status] ?? 'neutral'} dot>
                      {t(STATUS_KEYS[session.status] ?? 'common.unknown')}
                    </Badge>
                  </Td>
                  <Td className="numeral text-right font-semibold text-ink">
                    {session.amount ? formatMoney(session.amount) : '—'}
                  </Td>
                  <Td>
                    <p className="numeral text-xs">{formatDateTime(session.created_at)}</p>
                    <p className="text-[11px] text-ink-faint">{formatRelative(session.created_at)}</p>
                  </Td>
                  <Td className="numeral text-xs">{formatDateTime(session.updated_at)}</Td>
                </Tr>
              ))}
            </tbody>
          )}
        </TableWrap>

        {!isPending && !data?.results.length && (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title={activeFilters ? t('payments.empty') : t('payments.emptyAll')}
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
