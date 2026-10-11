/**
 * Seat pool table + per-partner price overrides. Owner: licensing.
 * Consumed by partners (PartnerDetailPage ?tab=licenses) and AccountantPartnerPage.
 */
import { History, RefreshCw } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  Field,
  Input,
  Mono,
  Money,
  Section,
  Textarea,
  type Column,
} from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import { useQueryClient } from '@tanstack/react-query'

import {
  useClearOverride,
  useOverrides,
  useSaveOverride,
  useSeats,
  useSetSeats,
  type OverrideRow,
  type SeatHistoryRow,
  type SeatRow,
} from '../api'
import { errorText, todayIso } from '../lib/errors'

export interface PartnerLicensesTabProps {
  partnerId: string
  canEdit: boolean
}

interface PendingChange {
  row: SeatRow
  to: number
}

export function PartnerLicensesTab({ partnerId, canEdit }: PartnerLicensesTabProps) {
  const { t } = useTranslation('licensing')
  const me = useStaffMe()
  const qc = useQueryClient()
  const seats = useSeats(partnerId)
  const setSeats = useSetSeats(partnerId)
  const editSeats = canEdit && (me?.role === 'superadmin' || me?.role === 'accountant')

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [note, setNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const currency = seats.data?.currency ?? 'GEL'

  function apply(row: SeatRow) {
    const raw = drafts[row.licenseId]
    if (raw === undefined) return
    const to = Number(raw)
    if (!Number.isInteger(to) || to < 0) {
      toast.error(t('seats.invalidQuantity'))
      return
    }
    if (to === row.seats) {
      setDrafts(({ [row.licenseId]: _, ...rest }) => rest)
      return
    }
    setEffectiveFrom(todayIso())
    setNote('')
    setPending({ row, to })
  }

  async function confirm() {
    if (!pending) return
    try {
      await setSeats.mutateAsync({ licenseId: pending.row.licenseId, quantity: pending.to, effectiveFrom, note })
      toast.success(t('seats.applied', { name: pending.row.name, from: pending.row.seats, to: pending.to }))
      setDrafts(({ [pending.row.licenseId]: _, ...rest }) => rest)
      setPending(null)
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  const columns: Column<SeatRow>[] = [
    {
      key: 'name',
      header: t('seats.cols.license'),
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink">{r.name}</span>
          {r.kind === 'addon' ? <Badge tone="accent">{t('tags.addon')}</Badge> : null}
          {!r.isActive ? <Badge tone="neutral">{t('tags.inactive')}</Badge> : null}
        </div>
      ),
    },
    { key: 'code', header: t('seats.cols.code'), mono: true, hideBelow: 'md', cell: (r) => <Mono>{r.code}</Mono> },
    {
      key: 'unitPrice',
      header: t('seats.cols.unitPrice'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.unitPrice,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Money amount={r.unitPrice} currency={currency} />
          {r.isOverride ? <Badge tone="info" dot={false}>{t('tags.override')}</Badge> : null}
        </span>
      ),
    },
    {
      key: 'seats',
      header: t('seats.cols.seats'),
      align: 'right',
      width: '150px',
      sortable: true,
      sortValue: (r) => r.seats,
      cell: (r) => {
        if (!editSeats) return <span className="num">{r.seats}</span>
        const draft = drafts[r.licenseId]
        const dirty = draft !== undefined && draft !== String(r.seats)
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Input
              aria-label={t('seats.editAria', { name: r.name })}
              type="number"
              min={0}
              step={1}
              size="sm"
              className="w-20 text-right num"
              value={draft ?? String(r.seats)}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.licenseId]: e.target.value }))}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') apply(r)
                if (e.key === 'Escape') setDrafts(({ [r.licenseId]: _, ...rest }) => rest)
              }}
            />
            {dirty ? (
              <Button size="xs" variant="primary" onClick={() => apply(r)}>
                {t('common:actions.apply')}
              </Button>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'taggedUsers',
      header: t('seats.cols.tagged'),
      align: 'right',
      hideBelow: 'sm',
      cell: (r) =>
        r.kind === 'addon' ? (
          <span className="text-subtle">—</span>
        ) : (
          <span className={r.taggedUsers > r.seats ? 'num text-danger' : 'num'}>{r.taggedUsers}</span>
        ),
    },
    {
      key: 'monthlyCost',
      header: t('seats.cols.monthly'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.monthlyCost,
      cell: (r) => <Money amount={r.monthlyCost} currency={currency} />,
    },
  ]

  const historyColumns: Column<SeatHistoryRow>[] = [
    { key: 'license', header: t('seats.cols.license'), cell: (r) => <span className="text-ink">{r.licenseName}</span> },
    { key: 'qty', header: t('seats.history.qty'), align: 'right', cell: (r) => <span className="num">{r.quantity}</span> },
    { key: 'from', header: t('seats.history.from'), cell: (r) => formatDate(r.effectiveFrom) },
    { key: 'to', header: t('seats.history.to'), cell: (r) => (r.effectiveTo ? formatDate(r.effectiveTo) : <Badge tone="success">{t('seats.history.open')}</Badge>) },
    {
      key: 'note',
      header: t('seats.history.note'),
      hideBelow: 'md',
      cell: (r) => (r.reason === 'cutover' ? t('seats.history.cutover') : r.note || (r.reason === 'split' ? t('seats.history.split') : '—')),
    },
    { key: 'by', header: t('seats.history.by'), hideBelow: 'sm', cell: (r) => r.createdByName ?? t('seats.history.system') },
  ]

  const totals = seats.data?.totals
  const delta = pending ? pending.to - pending.row.seats : 0

  return (
    <div className="space-y-6">
      <Section
        title={t('seats.title')}
        description={t('seats.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<History />} onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? t('seats.hideHistory') : t('seats.showHistory')}
            </Button>
            <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => void qc.invalidateQueries({ queryKey: ['seats', partnerId] })}>
              {t('common:actions.refresh')}
            </Button>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={seats.data?.rows}
          getRowId={(r) => r.licenseId}
          error={seats.error ? errorText(t, seats.error) : undefined}
          onRetry={() => void seats.refetch()}
          pageSize={0}
          empty={{ title: t('seats.empty') }}
          footer={
            totals ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="font-medium text-ink">{t('seats.totals')}</span>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted">
                  <span>
                    {t('seats.totalSeats')}: <span className="num text-ink">{totals.seats}</span>
                  </span>
                  <span>
                    {t('seats.totalTagged')}: <span className="num text-ink">{totals.taggedUsers}</span>
                  </span>
                  <span>
                    {t('seats.totalMonthly')}: <span className="num font-medium text-ink">{formatMoney(totals.monthlyCost, currency)}</span>
                  </span>
                </div>
              </div>
            ) : null
          }
        />
        {seats.data && seats.data.unassignedCount > 0 ? (
          <p className="mt-2 text-sm text-muted">{t('seats.unassigned', { count: seats.data.unassignedCount })}</p>
        ) : null}
      </Section>

      {showHistory ? (
        <Section title={t('seats.history.title')}>
          <DataTable
            columns={historyColumns}
            rows={seats.data?.history}
            getRowId={(r) => r.id}
            pageSize={10}
            empty={{ title: t('seats.history.empty') }}
          />
        </Section>
      ) : null}

      <OverridesTable partnerId={partnerId} canEdit={canEdit && me?.role === 'superadmin'} currency={currency} />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={delta > 0 ? t('seats.confirm.addTitle') : t('seats.confirm.removeTitle')}
        description={pending ? t('seats.confirm.description', { name: pending.row.name }) : undefined}
        confirmLabel={delta > 0 ? t('seats.confirm.add', { count: delta }) : t('seats.confirm.remove', { count: -delta })}
        tone={delta > 0 ? 'primary' : 'danger'}
        pending={setSeats.isPending}
        confirmDisabled={!effectiveFrom}
        onConfirm={() => void confirm()}
      >
        {pending ? (
          <div className="space-y-4">
            <DescriptionList
              columns={2}
              items={[
                { label: t('seats.confirm.delta'), value: <span className={delta > 0 ? 'num text-success' : 'num text-danger'}>{delta > 0 ? `+${delta}` : delta}</span> },
                { label: t('seats.confirm.pool'), value: <span className="num">{pending.row.seats} → {pending.to}</span> },
                { label: t('seats.confirm.monthlyAfter'), value: formatMoney(pending.to * pending.row.unitPrice, currency) },
                { label: t('seats.cols.code'), value: pending.row.code, mono: true },
              ]}
            />
            <Field label={t('seats.confirm.effectiveFrom')} required htmlFor="seat-eff">
              <Input id="seat-eff" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>
            <Field label={t('seats.confirm.note')} hint={t('seats.confirm.noteHint')} htmlFor="seat-note">
              <Textarea id="seat-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function OverridesTable({ partnerId, canEdit, currency }: { partnerId: string; canEdit: boolean; currency: string }) {
  const { t } = useTranslation('licensing')
  const overrides = useOverrides(partnerId)
  const save = useSaveOverride(partnerId)
  const clear = useClearOverride(partnerId)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const reset = (id: string) => setDrafts(({ [id]: _, ...rest }) => rest)

  async function onSave(row: OverrideRow) {
    const raw = drafts[row.licenseId]
    const value = Number(raw)
    if (raw === undefined || raw.trim() === '' || !Number.isFinite(value) || value < 0) {
      toast.error(t('overrides.invalid'))
      return
    }
    try {
      await save.mutateAsync({ licenseId: row.licenseId, unitPrice: value })
      reset(row.licenseId)
      toast.success(t('overrides.saved', { name: row.name }))
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  async function onClear(row: OverrideRow) {
    try {
      await clear.mutateAsync(row.licenseId)
      reset(row.licenseId)
      toast.success(t('overrides.cleared', { name: row.name }))
    } catch (e) {
      toast.error(errorText(t, e))
    }
  }

  const columns: Column<OverrideRow>[] = [
    { key: 'name', header: t('seats.cols.license'), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'code', header: t('seats.cols.code'), hideBelow: 'md', cell: (r) => <Mono>{r.code}</Mono> },
    { key: 'kind', header: t('catalog.cols.kind'), hideBelow: 'sm', cell: (r) => t(`common:licenseKind.${r.kind}`) },
    { key: 'default', header: t('overrides.default'), align: 'right', cell: (r) => <Money amount={r.defaultPrice} currency={currency} /> },
    {
      key: 'override',
      header: t('overrides.override'),
      align: 'right',
      width: '320px',
      cell: (r) => {
        if (!canEdit) return r.override === null ? <span className="text-subtle">—</span> : <Money amount={r.override} currency={currency} />
        const draft = drafts[r.licenseId]
        const value = draft ?? (r.override === null ? '' : String(r.override))
        const dirty = draft !== undefined && draft !== (r.override === null ? '' : String(r.override))
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Input
              aria-label={t('overrides.inputAria', { name: r.name })}
              type="number"
              min={0}
              step="0.01"
              size="sm"
              className="w-24 text-right num"
              placeholder={String(r.defaultPrice)}
              value={value}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.licenseId]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && void onSave(r)}
            />
            <Button size="xs" variant="primary" disabled={!dirty} loading={save.isPending && save.variables?.licenseId === r.licenseId} onClick={() => void onSave(r)}>
              {t('common:actions.save')}
            </Button>
            <Button size="xs" variant="ghost" disabled={!dirty} onClick={() => reset(r.licenseId)}>
              {t('common:actions.reset')}
            </Button>
            <Button size="xs" variant="destructive-ghost" disabled={r.override === null} onClick={() => void onClear(r)}>
              {t('common:actions.clear')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader title={t('overrides.title')} description={t('overrides.description')} />
      {!canEdit ? (
        <div className="px-4 pb-3">
          <Banner tone="neutral">{t('overrides.readOnly')}</Banner>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={overrides.data}
        getRowId={(r) => r.licenseId}
        error={overrides.error ? errorText(t, overrides.error) : undefined}
        onRetry={() => void overrides.refetch()}
        pageSize={0}
        empty={{ title: t('overrides.empty') }}
      />
    </Card>
  )
}
