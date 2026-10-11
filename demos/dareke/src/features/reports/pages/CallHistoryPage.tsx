/** /calls: call history (CDR) with filters, server pagination and a detail drawer. */
import { FilterX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Alert, Badge, Button, DataTable, EmptyState, Field, PageHeader, SearchInput, Select, ToneDot, Toolbar, type Column } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { formatDateTime, formatDuration, maskPhone } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { CallOutcome, CallRecordView } from '@/types'

import { useCalls, useReportFilters } from '../api'
import { CallDrawer } from '../components/CallDrawer'
import { DateRangeFields, DispositionBadge, OutcomeBadge, type DateInputs } from '../components/shared'
import type { CallListFilters } from '../types'

const PAGE_SIZE = 25
const OUTCOMES: CallOutcome[] = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'ABANDONED', 'IN_PROGRESS']

interface Form {
  campaignId: string
  agentId: string
  disposition: string
  outcome: string
  dates: DateInputs
  phone: string
}

const EMPTY: Form = { campaignId: 'all', agentId: 'all', disposition: 'all', outcome: 'all', dates: { from: '', to: '' }, phone: '' }

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return out
}

export default function CallHistoryPage() {
  const { t } = useTranslation('reports')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const lookups = useReportFilters()
  const [form, setForm] = useState<Form>(EMPTY)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useSearchParams()
  const selectedId = search.get('call')
  const phone = useDebounced(form.phone, 250)

  const dateError = form.dates.from && form.dates.to && form.dates.from > form.dates.to ? t('validation.toBeforeFrom') : undefined

  // While the date range is invalid, keep showing the last valid query.
  const lastValid = useRef<Omit<CallListFilters, 'page' | 'pageSize'>>({})
  const filters = useMemo<Omit<CallListFilters, 'page' | 'pageSize'>>(() => {
    if (dateError) return lastValid.current
    const f: Omit<CallListFilters, 'page' | 'pageSize'> = {}
    if (form.campaignId !== 'all') f.campaignId = form.campaignId
    if (form.agentId !== 'all') f.agentId = form.agentId
    if (form.disposition !== 'all') f.disposition = form.disposition
    if (form.outcome !== 'all') f.outcome = form.outcome as CallOutcome
    if (form.dates.from) f.from = new Date(`${form.dates.from}T00:00:00`).toISOString()
    if (form.dates.to) f.to = new Date(`${form.dates.to}T23:59:59.999`).toISOString()
    const digits = phone.replace(/\D/g, '')
    if (digits) f.phone = digits
    lastValid.current = f
    return f
  }, [form.campaignId, form.agentId, form.disposition, form.outcome, form.dates, phone, dateError])

  useEffect(() => setPage(1), [filters])

  const query = useCalls({ ...filters, page, pageSize: PAGE_SIZE })
  const data = query.data
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY)

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const openCall = (id: string | null) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('call', id)
        else next.delete('call')
        return next
      },
      { replace: true },
    )

  const columns: Column<CallRecordView>[] = [
    { key: 'at', header: t('table.dateTime'), cell: (r) => <span className="whitespace-nowrap font-mono text-[13px] tabular">{formatDateTime(r.callInitiatedAt)}</span> },
    { key: 'phone', header: t('table.phone'), cell: (r) => <span className="whitespace-nowrap font-mono text-[13px]">{maskPhone(r.destinationNumber)}</span> },
    { key: 'campaign', header: t('table.campaign'), hideOnMobile: true, cell: (r) => <span className="block max-w-52 truncate">{l(r.campaignName)}</span> },
    { key: 'agent', header: t('table.agent'), hideOnMobile: true, cell: (r) => (r.agentName ? l(r.agentName) : <span className="text-muted">{t('table.noAgent')}</span>) },
    { key: 'outcome', header: t('table.outcome'), cell: (r) => <OutcomeBadge outcome={r.outcome} /> },
    { key: 'duration', header: t('table.duration'), align: 'right', cell: (r) => <span className="font-mono tabular">{formatDuration(r.totalDuration)}</span> },
    { key: 'disposition', header: t('table.disposition'), hideOnMobile: true, cell: (r) => <DispositionBadge call={r} /> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('pages.CallHistoryPage')}
        description={t('cdr.intro')}
        actions={
          <Badge tone="success" variant="outline" icon={<ToneDot tone="success" pulse />}>
            {t('cdr.live')}
          </Badge>
        }
      />

      <Toolbar
        className="items-end"
        end={
          dirty && (
            <Button variant="ghost" icon={<FilterX size={18} strokeWidth={1.75} />} onClick={() => setForm(EMPTY)}>
              {tc('actions.clearFilters')}
            </Button>
          )
        }
      >
        <Field label={t('filters.phone')} className="w-full sm:w-52">
          <SearchInput value={form.phone} onChange={(v) => update('phone', v)} placeholder={t('filters.phonePlaceholder')} />
        </Field>
        <Field label={t('filters.campaign')} className="w-full sm:w-56">
          <Select
            value={form.campaignId}
            onValueChange={(v) => update('campaignId', v)}
            aria-label={t('filters.campaign')}
            options={[{ value: 'all', label: t('filters.allCampaigns') }, ...(lookups.data?.campaigns ?? []).map((c) => ({ value: c.id, label: l(c.name) }))]}
          />
        </Field>
        <Field label={t('filters.agent')} className="w-full sm:w-48">
          <Select
            value={form.agentId}
            onValueChange={(v) => update('agentId', v)}
            aria-label={t('filters.agent')}
            options={[{ value: 'all', label: t('filters.allAgents') }, ...(lookups.data?.agents ?? []).map((a) => ({ value: a.id, label: l(a.name) }))]}
          />
        </Field>
        <Field label={t('filters.disposition')} className="w-full sm:w-52">
          <Select
            value={form.disposition}
            onValueChange={(v) => update('disposition', v)}
            aria-label={t('filters.disposition')}
            options={[
              { value: 'all', label: t('filters.allDispositions') },
              { value: 'none', label: t('filters.noDisposition') },
              ...(lookups.data?.dispositions ?? []).map((d) => ({ value: d.code, label: l(d.name), icon: <ToneDot tone={d.color} /> })),
            ]}
          />
        </Field>
        <Field label={t('filters.outcome')} className="w-full sm:w-44">
          <Select
            value={form.outcome}
            onValueChange={(v) => update('outcome', v)}
            aria-label={t('filters.outcome')}
            options={[{ value: 'all', label: t('filters.allOutcomes') }, ...OUTCOMES.map((o) => ({ value: o, label: tc(`callOutcome.${o}`) }))]}
          />
        </Field>
        <DateRangeFields value={form.dates} onChange={(dates) => update('dates', dates)} errors={dateError ? { to: dateError } : undefined} />
      </Toolbar>

      {query.isError ? (
        <Alert tone="danger" title={tc('states.error')} action={<Button size="sm" onClick={() => void query.refetch()}>{tc('actions.retry')}</Button>}>
          {errorMessage(query.error)}
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted">
            {data ? t('cdr.count', { count: data.total }) : tc('states.loading')} · {tc('demoDataNote')}
          </p>
          <DataTable
            rows={data?.items}
            columns={columns}
            rowKey={(r) => r.id}
            loading={query.isLoading}
            onRowClick={(r) => openCall(r.id)}
            selectedKey={selectedId}
            pagination={{ page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onPageChange: setPage }}
            skeletonRows={10}
            empty={
              <EmptyState
                title={t('cdr.empty')}
                description={dirty ? t('cdr.emptyFiltered') : t('empty.tryRange')}
                action={dirty ? <Button onClick={() => setForm(EMPTY)}>{tc('actions.clearFilters')}</Button> : undefined}
                compact
              />
            }
          />
        </>
      )}

      <CallDrawer callId={selectedId} onClose={() => openCall(null)} onOpenCall={openCall} />
    </div>
  )
}
