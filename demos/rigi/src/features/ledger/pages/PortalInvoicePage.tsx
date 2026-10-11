import { Download, Flag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { InvoiceDisplayStatusChip } from '@/components/status'
import { Banner, Button, DateText, Dialog, EmptyState, Field, Mono, Money, PageHeader, PageSkeleton, TicketCard, Textarea, toast } from '@/components/ui'
import { isApiError } from '@/lib/api'
import { formatPercent, formatPeriod } from '@/lib/format'

import { useDisputeInvoice, useDownloadPortalPdf, usePortalInvoice, type PortalInvoice } from '../api'
import { ErrorPanel } from '../components/ErrorPanel'

const MIN = 3
const MAX = 2000

export default function PortalInvoicePage() {
  const { t } = useTranslation(['ledger', 'common'])
  const { invoiceId = '' } = useParams()
  const { data: invoice, error, refetch } = usePortalInvoice(invoiceId)
  const pdf = useDownloadPortalPdf(invoiceId)
  const [disputeOpen, setDisputeOpen] = useState(false)

  if (error) {
    if (isApiError(error, 404)) {
      return (
        <>
          <PageHeader title={t('invoice.title')} back={{ to: '/partner/invoices', label: t('invoice.back') }} />
          <EmptyState title={t('invoice.notFound')} description={t('invoice.notFoundDescription')} />
        </>
      )
    }
    return <ErrorPanel onRetry={() => void refetch()} />
  }
  if (!invoice) return <PageSkeleton />

  const heading = invoice.kind === 'adhoc' && invoice.title ? invoice.title : formatPeriod(invoice.periodYear, invoice.periodMonth)
  const disputed = invoice.displayStatus === 'disputed'
  const closed = invoice.displayStatus === 'paid' || invoice.displayStatus === 'void'

  const download = () =>
    pdf.mutate(undefined, { onError: () => toast.error(t('invoice.pdfFailed')) })

  return (
    <>
      <PageHeader
        eyebrow={t('invoice.eyebrow')}
        title={heading}
        meta={<Mono>{invoice.invoiceNumber}</Mono>}
        back={{ to: '/partner/invoices', label: t('invoice.back') }}
        actions={
          <>
            <Button variant="outline" icon={<Download />} loading={pdf.isPending} onClick={download}>
              {t('invoice.downloadPdf')}
            </Button>
            {invoice.canDispute ? (
              <Button variant={disputed ? 'secondary' : 'outline'} icon={<Flag />} onClick={() => setDisputeOpen(true)}>
                {disputed ? t('invoice.dispute.edit') : t('invoice.dispute.open')}
              </Button>
            ) : null}
          </>
        }
      />

      {disputed ? (
        <Banner tone="warning" title={t('invoice.dispute.activeTitle')} action={invoice.canDispute ? <Button size="sm" variant="outline" onClick={() => setDisputeOpen(true)}>{t('invoice.dispute.edit')}</Button> : undefined}>
          <span className="block">{t('invoice.dispute.activeBody')}</span>
          {invoice.disputeReason ? <span className="mt-1 block whitespace-pre-wrap font-medium">{invoice.disputeReason}</span> : null}
        </Banner>
      ) : null}
      {closed && invoice.disputeReason ? (
        <Banner tone="neutral" title={t('invoice.dispute.closedTitle')}>
          <span className="block whitespace-pre-wrap">{invoice.disputeReason}</span>
        </Banner>
      ) : null}

      <div className="mt-4 max-w-3xl">
        <TicketCard
          footer={
            <div className="flex flex-col gap-1.5 text-sm">
              <TotalRow label={t('invoice.subtotal')} amount={invoice.subtotal} currency={invoice.currency} />
              <TotalRow label={t('invoice.tax', { rate: formatPercent(invoice.vatRate) })} amount={invoice.tax} currency={invoice.currency} />
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hairline pt-2">
                <span className="font-display text-base font-semibold">
                  {t('invoice.total')} <span className="text-xs font-normal text-subtle">{invoice.vatInclusive ? t('invoices.inclVat') : t('invoices.plusVat')}</span>
                </span>
                <Money amount={invoice.total} currency={invoice.currency} />
              </div>
            </div>
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{t('invoice.billedTo')}</p>
              <p className="mt-1 font-medium">{invoice.partner.legalName}</p>
              <p className="text-sm text-muted">{invoice.partner.name}</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <InvoiceDisplayStatusChip status={invoice.displayStatus} />
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
                <dt className="text-muted">{t('invoices.issued')}</dt>
                <dd>{invoice.issuedAt ? <DateText value={invoice.issuedAt} /> : '—'}</dd>
                <dt className="text-muted">{t('invoices.due')}</dt>
                <dd>{invoice.dueAt ? <DateText value={invoice.dueAt} /> : '—'}</dd>
                {invoice.paidAt ? (
                  <>
                    <dt className="text-muted">{t('invoice.paidOn')}</dt>
                    <dd><DateText value={invoice.paidAt} /></dd>
                  </>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-strong text-left">
                  <th className="eyebrow py-2 pr-3 font-normal">{t('invoice.lines.description')}</th>
                  <th className="eyebrow hidden py-2 pr-3 font-normal sm:table-cell">{t('invoice.lines.kind')}</th>
                  <th className="eyebrow py-2 text-right font-normal">{t('invoice.lines.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted">{t('invoice.lines.empty')}</td>
                  </tr>
                ) : (
                  invoice.lines.map((line) => (
                    <tr key={line.id} className="border-b border-hairline last:border-0 align-top">
                      <td className="py-2.5 pr-3">
                        {line.description}
                        <span className="mt-0.5 block text-xs text-subtle sm:hidden">{t(`common:lineKind.${line.kind}`)}</span>
                      </td>
                      <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">{t(`common:lineKind.${line.kind}`)}</td>
                      <td className="py-2.5 text-right"><Money amount={line.amount} currency={invoice.currency} tone="auto" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {invoice.notes ? (
            <div className="mt-4 rounded-md bg-sunken p-3 text-sm">
              <p className="eyebrow mb-1">{t('invoice.notes')}</p>
              <p className="whitespace-pre-wrap text-muted">{invoice.notes}</p>
            </div>
          ) : null}
        </TicketCard>
      </div>

      <DisputeDialog invoice={invoice} open={disputeOpen} onOpenChange={setDisputeOpen} />
    </>
  )
}

function TotalRow({ label, amount, currency }: { label: string; amount: number; currency: PortalInvoice['currency'] }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted">
      <span>{label}</span>
      <Money amount={amount} currency={currency} />
    </div>
  )
}

function DisputeDialog({ invoice, open, onOpenChange }: { invoice: PortalInvoice; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['ledger', 'common'])
  const dispute = useDisputeInvoice(invoice.id)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason(invoice.disputeReason ?? '')
      setError(null)
    }
  }, [open, invoice.disputeReason])

  const submit = () => {
    const value = reason.trim()
    if (value.length < MIN) return setError(t('invoice.dispute.tooShort', { min: MIN }))
    if (value.length > MAX) return setError(t('invoice.dispute.tooLong', { max: MAX }))
    setError(null)
    dispute.mutate(value, {
      onSuccess: () => {
        toast.success(invoice.disputedAt ? t('invoice.dispute.updated') : t('invoice.dispute.sent'))
        onOpenChange(false)
      },
      onError: (e) => setError(isApiError(e, 409) ? t('invoice.dispute.notAllowed') : e instanceof Error ? e.message : t('common:states.error')),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={invoice.disputedAt ? t('invoice.dispute.editTitle') : t('invoice.dispute.title')}
      description={t('invoice.dispute.description', { number: invoice.invoiceNumber })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button loading={dispute.isPending} onClick={submit}>
            {invoice.disputedAt ? t('common:actions.saveChanges') : t('invoice.dispute.submit')}
          </Button>
        </>
      }
    >
      <Field label={t('invoice.dispute.reason')} htmlFor="dispute-reason" error={error ?? undefined} hint={t('invoice.dispute.count', { count: reason.trim().length, max: MAX })} required>
        <Textarea id="dispute-reason" rows={6} value={reason} invalid={Boolean(error)} onChange={(e) => setReason(e.target.value)} placeholder={t('invoice.dispute.placeholder')} />
      </Field>
    </Dialog>
  )
}
