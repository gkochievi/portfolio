import { Ban, CheckCircle2, Download, Mail, Pencil, RefreshCw, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { OverdueChip } from '@/components/status'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  DateText,
  DescriptionList,
  EmptyState,
  Mono,
  Money,
  PageHeader,
  PageSkeleton,
  Switch,
  TicketCard,
  Textarea,
  toast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber, formatPeriod, formatPoints } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import type { InvoiceLineItem } from '@/types'

import { useDownloadPdf, useInvoice, usePatchInvoice, useRegenerate, type InvoiceDetail, type TasksBilled } from '../api'
import { EditLinesDialog, EmailDialog, IssueDialog, MarkPaidDialog, VoidDialog } from '../components/InvoiceDialogs'
import { InvoiceStatusCell } from '../components/InvoiceStatusCell'
import { errorMessage } from '../lib/errors'

const VISIBLE_KINDS = new Set(['subscription', 'adhoc', 'project'])

type DialogName = 'issue' | 'paid' | 'void' | 'email' | 'lines' | null

export default function InvoiceDetailPage() {
  const { t } = useTranslation(['invoicing', 'common'])
  const { invoiceId } = useParams()
  const me = useStaffMe()
  const { data, error, isLoading, refetch } = useInvoice(invoiceId)
  const [dialog, setDialog] = useState<DialogName>(null)

  if (isLoading) return <PageSkeleton />
  if (error || !data) {
    return (
      <div>
        <PageHeader title={t('detail.notFound')} back={{ to: '/accountant/invoices', label: t('list.title') }} />
        <Banner tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>}>
          {errorMessage(t, error)}
        </Banner>
      </div>
    )
  }
  return <InvoiceScreen data={data} isSuperadmin={me?.role === 'superadmin'} dialog={dialog} setDialog={setDialog} />
}

function InvoiceScreen({ data, isSuperadmin, dialog, setDialog }: { data: InvoiceDetail; isSuperadmin: boolean; dialog: DialogName; setDialog: (d: DialogName) => void }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const { invoice, lines, partner, tasksBilled, outbox } = data
  const pdf = useDownloadPdf(invoice.id)
  const regenerate = useRegenerate(invoice.id)
  const patch = usePatchInvoice(invoice.id)

  const isDraft = invoice.status === 'draft'
  const isIssued = invoice.status === 'issued'
  const isVoid = invoice.status === 'void'
  const visibleLines = lines.filter((l) => VISIBLE_KINDS.has(l.kind))
  const periodLabel = invoice.kind === 'adhoc' && invoice.title ? invoice.title : formatPeriod(invoice.periodYear, invoice.periodMonth)
  const emailDefaults = partner ? (partner.billingEmails.length > 0 ? partner.billingEmails : [partner.billingEmail || partner.contactEmail].filter(Boolean)) : []

  const download = () =>
    pdf.mutate(undefined, { onError: (e) => toast.error(errorMessage(t, e)) })

  return (
    <div>
      <PageHeader
        eyebrow={t(`common:invoiceKind.${invoice.kind}`)}
        title={<span className="inline-flex flex-wrap items-center gap-3"><span className="font-mono">{invoice.invoiceNumber}</span><InvoiceStatusCell invoice={invoice} /></span>}
        description={
          <span>
            {partner ? (
              <Link to={`/accountant/partners/${partner.id}`} className="link">
                {partner.name}
              </Link>
            ) : (
              '—'
            )}
            {' · '}
            {periodLabel}
          </span>
        }
        back={{ to: '/accountant/invoices', label: t('list.title') }}
        actions={
          <>
            {isDraft ? (
              <Button icon={<Send />} onClick={() => setDialog('issue')}>
                {t('actions.issue')}
              </Button>
            ) : null}
            {isIssued ? (
              <Button icon={<CheckCircle2 />} onClick={() => setDialog('paid')}>
                {t('actions.markPaid')}
              </Button>
            ) : null}
            {isDraft && invoice.kind === 'monthly' ? (
              <Button
                variant="secondary"
                icon={<RefreshCw />}
                loading={regenerate.isPending}
                onClick={() =>
                  regenerate.mutate(undefined, {
                    onSuccess: () => toast.success(t('regenerate.done')),
                    onError: (e) => toast.error(errorMessage(t, e)),
                  })
                }
              >
                {t('actions.regenerate')}
              </Button>
            ) : null}
            {isDraft && invoice.kind === 'adhoc' ? (
              <Button variant="secondary" icon={<Pencil />} onClick={() => setDialog('lines')}>
                {t('actions.editLines')}
              </Button>
            ) : null}
            <Button variant="secondary" icon={<Download />} loading={pdf.isPending} onClick={download}>
              {t('actions.downloadPdf')}
            </Button>
            {!isVoid ? (
              <Button variant="secondary" icon={<Mail />} onClick={() => setDialog('email')}>
                {t('actions.sendEmail')}
              </Button>
            ) : null}
            {isSuperadmin && (isDraft || isIssued) ? (
              <Button variant="destructive-ghost" icon={<Ban />} onClick={() => setDialog('void')}>
                {t('actions.void')}
              </Button>
            ) : null}
          </>
        }
      />

      {invoice.disputedAt ? (
        <div className="mb-4">
          <Banner tone="warning" title={t('dispute.title')}>
            <p>
              {t('dispute.since')} <DateText value={invoice.disputedAt} />
              {invoice.disputeReason ? <> — {invoice.disputeReason}</> : null}
            </p>
          </Banner>
        </div>
      ) : null}
      {isVoid ? (
        <div className="mb-4">
          <Banner tone="neutral" title={t('void.banner')}>
            {invoice.voidedAt ? <DateText value={invoice.voidedAt} /> : null}
            {invoice.voidReason ? <> — {invoice.voidReason}</> : null}
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <TicketCard
            active={isIssued && invoice.displayStatus === 'overdue'}
            footer={
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">{invoice.vatInclusive ? t('amounts.totalIncl') : t('amounts.totalDue')}</p>
                  <p className="font-display text-3xl font-semibold num">
                    <Money amount={invoice.total} currency={invoice.currency} />
                  </p>
                </div>
                <div className="text-right text-sm text-muted">
                  {invoice.dueAt ? (
                    <p>
                      {t('dates.due')} <DateText value={invoice.dueAt} />
                    </p>
                  ) : (
                    <p>{t('dates.notIssued')}</p>
                  )}
                  <p className="font-mono text-xs">{invoice.currency}</p>
                </div>
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 className="font-display text-lg font-semibold">{t('lines.title')}</h2>
              <span className="text-sm text-muted">{invoice.kind === 'adhoc' ? invoice.title : periodLabel}</span>
            </div>
            <LinesTable lines={visibleLines} currency={invoice.currency} />
          </TicketCard>

          {invoice.kind === 'monthly' ? <TasksBilledCard billed={tasksBilled} currency={invoice.currency} /> : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={t('dates.title')} />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: t('dates.created'), value: <DateText value={invoice.createdAt} withTime /> },
                  { label: t('dates.issued'), value: invoice.issuedAt ? <DateText value={invoice.issuedAt} /> : <span className="text-subtle">—</span> },
                  {
                    label: t('dates.due'),
                    value: invoice.dueAt ? (
                      <span className="inline-flex items-center gap-2">
                        <DateText value={invoice.dueAt} />
                        {invoice.displayStatus === 'overdue' ? <OverdueChip /> : null}
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    ),
                  },
                  { label: t('dates.paid'), value: invoice.paidAt ? <DateText value={invoice.paidAt} /> : <span className="text-subtle">—</span> },
                  data.template ? { label: t('detail.template'), value: data.template.name } : null,
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('amounts.title')}
              actions={
                <Badge tone="info" dot={false}>
                  {t(invoice.vatInclusive ? 'amounts.vatIncluded' : 'amounts.vatExcluded', { rate: Math.round(invoice.vatRate * 100) })}
                </Badge>
              }
            />
            <CardBody className="flex flex-col gap-3">
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">{t('amounts.subtotal')}</dt>
                <dd className="text-right num">
                  <Money amount={invoice.subtotal} currency={invoice.currency} />
                </dd>
                <dt className="text-muted">{t('amounts.vat', { rate: Math.round(invoice.vatRate * 100) })}</dt>
                <dd className="text-right num">
                  <Money amount={invoice.tax} currency={invoice.currency} />
                </dd>
                <dt className="border-t border-hairline pt-2 font-medium">{t('common:fields.total')}</dt>
                <dd className="border-t border-hairline pt-2 text-right font-display text-lg font-semibold num">
                  <Money amount={invoice.total} currency={invoice.currency} />
                </dd>
              </dl>
              {isDraft ? (
                <Switch
                  checked={invoice.vatInclusive}
                  disabled={patch.isPending}
                  label={t('amounts.switchLabel')}
                  description={t('amounts.switchHint')}
                  onCheckedChange={(checked) =>
                    patch.mutate({ vatInclusive: checked }, { onError: (e) => toast.error(errorMessage(t, e)) })
                  }
                />
              ) : null}
            </CardBody>
          </Card>

          <NotesCard key={invoice.id + invoice.updatedAt} invoiceId={invoice.id} notes={invoice.notes} editable={isDraft} />

          <Card>
            <CardHeader title={t('email.history')} description={t('email.historyHint')} />
            {outbox.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">{t('email.none')}</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-hairline">
                {outbox.map((mail) => (
                  <li key={mail.id} className="animate-rise px-4 py-3 text-sm">
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{mail.subject}</span>
                      <span className="text-xs text-muted">
                        <DateText value={mail.sentAt} withTime />
                      </span>
                    </p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {t('email.to')}: <span className="font-mono">{mail.to.join(', ')}</span>
                    </p>
                    {mail.cc.length > 0 ? (
                      <p className="break-words text-xs text-muted">
                        {t('email.cc')}: <span className="font-mono">{mail.cc.join(', ')}</span>
                      </p>
                    ) : null}
                    <p className="text-xs text-subtle">{t('email.sentBy', { name: mail.sentByName })}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <IssueDialog open={dialog === 'issue'} onOpenChange={(o) => setDialog(o ? 'issue' : null)} invoice={invoice} />
      <MarkPaidDialog open={dialog === 'paid'} onOpenChange={(o) => setDialog(o ? 'paid' : null)} invoice={invoice} />
      <VoidDialog open={dialog === 'void'} onOpenChange={(o) => setDialog(o ? 'void' : null)} invoice={invoice} />
      <EmailDialog open={dialog === 'email'} onOpenChange={(o) => setDialog(o ? 'email' : null)} invoice={invoice} defaults={emailDefaults} />
      <EditLinesDialog open={dialog === 'lines'} onOpenChange={(o) => setDialog(o ? 'lines' : null)} invoice={invoice} lines={lines} />
    </div>
  )
}

/* ------------------------------------------------------------------ lines */

function quantityOf(line: InvoiceLineItem): string {
  const q = line.quantityDenominator ? line.quantityNumerator / line.quantityDenominator : line.quantityNumerator
  return formatNumber(q, { maximumFractionDigits: 3 })
}

function LinesTable({ lines, currency }: { lines: InvoiceLineItem[]; currency: InvoiceDetail['invoice']['currency'] }) {
  const { t } = useTranslation(['invoicing', 'common'])
  if (lines.length === 0) return <EmptyState compact title={t('lines.empty')} />
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-hairline-strong text-left">
            <th className="eyebrow py-2 pr-3 font-normal">{t('lines.description')}</th>
            <th className="eyebrow px-3 py-2 text-right font-normal">{t('lines.quantity')}</th>
            <th className="eyebrow px-3 py-2 text-right font-normal">{t('lines.unitPrice')}</th>
            <th className="eyebrow py-2 pl-3 text-right font-normal">{t('lines.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const meta = line.metadata ?? {}
            const hasMeta = !!(meta.licenseCode || meta.sumUserDays !== undefined || meta.daysInMonth !== undefined)
            return (
              <FragmentRows key={line.id}>
                <tr className={cn(!hasMeta && 'border-b border-hairline')}>
                  <td className="py-2.5 pr-3 align-top">
                    <p className="text-ink">{line.description}</p>
                    <p className="text-xs text-muted">{t(`common:lineKind.${line.kind}`)}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top num">{quantityOf(line)}</td>
                  <td className="px-3 py-2.5 text-right align-top num">
                    <Money amount={line.unitPrice} currency={currency} />
                  </td>
                  <td className="py-2.5 pl-3 text-right align-top font-medium num">
                    <Money amount={line.amount} currency={currency} />
                  </td>
                </tr>
                {hasMeta ? (
                  <tr className="border-b border-hairline">
                    <td colSpan={4} className="pb-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
                        {meta.licenseCode ? <Mono>{meta.licenseCode}</Mono> : null}
                        {meta.sumUserDays !== undefined ? <span>{t('lines.meta.userDays', { count: meta.sumUserDays, value: formatNumber(meta.sumUserDays) })}</span> : null}
                        {meta.daysInMonth !== undefined ? <span>{t('lines.meta.daysInMonth', { count: meta.daysInMonth })}</span> : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </FragmentRows>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/* ------------------------------------------------------------ tasks billed */

function TasksBilledCard({ billed, currency }: { billed: TasksBilled; currency: InvoiceDetail['invoice']['currency'] }) {
  const { t } = useTranslation(['invoicing', 'common'])
  return (
    <Card>
      <CardHeader title={t('tasks.title')} description={t('tasks.description')} />
      {billed.rows.length === 0 ? (
        <CardBody>
          <EmptyState compact title={t('tasks.empty')} />
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-hairline text-left">
                <th className="eyebrow px-4 py-2 font-normal">{t('tasks.task')}</th>
                <th className="eyebrow px-3 py-2 font-normal">{t('tasks.finished')}</th>
                <th className="eyebrow px-3 py-2 font-normal">{t('tasks.template')}</th>
                <th className="eyebrow px-3 py-2 text-right font-normal">{t('tasks.points')}</th>
                <th className="eyebrow px-3 py-2 text-right font-normal">{t('tasks.rate')}</th>
                <th className="eyebrow px-4 py-2 text-right font-normal">{t('lines.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {billed.rows.map((row) => (
                <tr key={row.taskId} className="border-b border-hairline">
                  <td className="px-4 py-2.5">
                    <Link to={`/l1/tasks/${row.taskId}`} className="link">
                      {row.title}
                    </Link>
                    <p className="font-mono text-xs text-muted">TCK-{row.number}</p>
                  </td>
                  <td className="px-3 py-2.5">{row.finishedAt ? <DateText value={row.finishedAt} /> : '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{row.template ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right num">{formatPoints(row.points)}</td>
                  <td className="px-3 py-2.5 text-right num">
                    <Money amount={row.rate} currency={currency} />
                  </td>
                  <td className="px-4 py-2.5 text-right num">
                    <Money amount={row.amount} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-4 pt-3 text-right text-muted">
                  {t('tasks.gross')}
                </td>
                <td className="px-4 pt-3 text-right num">
                  <Money amount={billed.grossAmount} currency={currency} />
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="px-4 py-1 text-right text-muted">
                  {t('tasks.lessFree')} <span className="num">({formatPoints(billed.freePoints)})</span>
                </td>
                <td className="px-4 py-1 text-right num text-success">
                  −<Money amount={billed.freeDeductionAmount} currency={currency} />
                </td>
              </tr>
              <tr className="border-t border-hairline-strong">
                <td colSpan={5} className="px-4 py-3 text-right font-medium">
                  {t('tasks.net')}
                </td>
                <td className="px-4 py-3 text-right font-display text-base font-semibold num">
                  <Money amount={billed.net} currency={currency} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ notes */

function NotesCard({ invoiceId, notes, editable }: { invoiceId: string; notes: string; editable: boolean }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const patch = usePatchInvoice(invoiceId)
  const [value, setValue] = useState(notes)
  useEffect(() => setValue(notes), [notes])
  const dirty = value !== notes
  return (
    <Card>
      <CardHeader title={t('common:fields.notes')} />
      <CardBody className="flex flex-col gap-3">
        {editable ? (
          <>
            <Textarea rows={3} value={value} maxLength={4000} aria-label={t('common:fields.notes')} placeholder={t('notes.placeholder')} onChange={(e) => setValue(e.target.value)} />
            {patch.error ? <p className="text-sm text-danger">{errorMessage(t, patch.error)}</p> : null}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={!dirty}
                loading={patch.isPending}
                onClick={() => patch.mutate({ notes: value }, { onSuccess: () => toast.success(t('notes.saved')) })}
              >
                {t('common:actions.save')}
              </Button>
            </div>
          </>
        ) : notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted">{t('notes.none')}</p>
        )}
      </CardBody>
    </Card>
  )
}
