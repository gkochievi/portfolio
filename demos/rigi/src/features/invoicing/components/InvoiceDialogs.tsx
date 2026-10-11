import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Banner, Button, ConfirmDialog, Dialog, Field, Input, Textarea, toast } from '@/components/ui'
import type { Invoice, InvoiceLineItem } from '@/types'

import { useEmailInvoice, useIssueInvoice, useMarkPaid, useReplaceLines, useVoidInvoice } from '../api'
import { errorMessage, fieldErrorOf } from '../lib/errors'
import { fromInvoiceLines, validateLines, type LineDraft, type LinesValidation } from '../lib/lines'
import { EmailChips } from './EmailChips'
import { LinesEditor } from './LinesEditor'

/** Local calendar day as YYYY-MM-DD (what <input type="date"> speaks). */
export function ymd(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function isoToYmd(iso: string | null | undefined): string {
  return iso ? ymd(new Date(iso)) : ''
}

function addDays(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number)
  return ymd(new Date(y, m - 1, d + days))
}

/** Same defaults the server applies: monthly = last day of the period, ad-hoc = today; due = +14 days. */
export function defaultIssueDay(invoice: Pick<Invoice, 'kind' | 'periodYear' | 'periodMonth'>): string {
  return invoice.kind === 'monthly' ? ymd(new Date(invoice.periodYear, invoice.periodMonth, 0)) : ymd(new Date())
}

interface Common {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ------------------------------------------------------------------ issue */

export function IssueDialog({ open, onOpenChange, invoice }: Common & { invoice: Invoice }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const issue = useIssueInvoice(invoice.id)
  const [issuedAt, setIssuedAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [dueTouched, setDueTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    const day = defaultIssueDay(invoice)
    setIssuedAt(day)
    setDueAt(addDays(day, 14))
    setDueTouched(false)
    issue.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id])

  const dueError = fieldErrorOf(issue.error, 'dueAt') ?? (issuedAt && dueAt && dueAt < issuedAt ? t('issue.dueBeforeIssued') : undefined)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !issue.isPending && onOpenChange(next)}
      title={t('issue.title')}
      description={t('issue.description')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={issue.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            loading={issue.isPending}
            disabled={!!dueError}
            onClick={() =>
              issue.mutate(
                { issuedAt: issuedAt || undefined, dueAt: dueAt || undefined },
                {
                  onSuccess: () => {
                    toast.success(t('issue.done', { number: invoice.invoiceNumber }))
                    onOpenChange(false)
                  },
                },
              )
            }
          >
            {t('actions.issue')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {issue.error && !dueError ? (
          <div className="sm:col-span-2">
            <Banner tone="danger">{errorMessage(t, issue.error)}</Banner>
          </div>
        ) : null}
        <Field label={t('dates.issued')} htmlFor="issue-issued" hint={t('issue.issuedHint', { context: invoice.kind })}>
          <Input
            id="issue-issued"
            type="date"
            value={issuedAt}
            onChange={(e) => {
              setIssuedAt(e.target.value)
              if (!dueTouched && e.target.value) setDueAt(addDays(e.target.value, 14))
            }}
          />
        </Field>
        <Field label={t('dates.due')} htmlFor="issue-due" hint={t('issue.dueHint')} error={dueError}>
          <Input
            id="issue-due"
            type="date"
            value={dueAt}
            invalid={!!dueError}
            onChange={(e) => {
              setDueAt(e.target.value)
              setDueTouched(true)
            }}
          />
        </Field>
      </div>
    </Dialog>
  )
}

/* -------------------------------------------------------------- mark paid */

export function MarkPaidDialog({ open, onOpenChange, invoice }: Common & { invoice: Invoice }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const pay = useMarkPaid(invoice.id)
  const [paidAt, setPaidAt] = useState(ymd(new Date()))

  useEffect(() => {
    if (open) {
      setPaidAt(ymd(new Date()))
      pay.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const min = isoToYmd(invoice.issuedAt)
  const error = !paidAt ? t('validation.dateRequired') : min && paidAt < min ? t('paid.beforeIssued') : fieldErrorOf(pay.error, 'paidAt')

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('paid.title')}
      description={t('paid.description', { number: invoice.invoiceNumber })}
      confirmLabel={t('actions.markPaid')}
      pending={pay.isPending}
      confirmDisabled={!!error}
      onConfirm={() =>
        pay.mutate(paidAt, {
          onSuccess: () => {
            toast.success(t('paid.done', { number: invoice.invoiceNumber }))
            onOpenChange(false)
          },
        })
      }
    >
      {pay.error && !fieldErrorOf(pay.error, 'paidAt') ? <Banner tone="danger">{errorMessage(t, pay.error)}</Banner> : null}
      <Field label={t('dates.paid')} htmlFor="paid-at" error={error} required>
        <Input id="paid-at" type="date" min={min || undefined} value={paidAt} invalid={!!error} onChange={(e) => setPaidAt(e.target.value)} />
      </Field>
    </ConfirmDialog>
  )
}

/* ------------------------------------------------------------------- void */

export function VoidDialog({ open, onOpenChange, invoice }: Common & { invoice: Invoice }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const voidInvoice = useVoidInvoice(invoice.id)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      voidInvoice.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title={t('void.title', { number: invoice.invoiceNumber })}
      description={t('void.description')}
      confirmLabel={t('actions.void')}
      pending={voidInvoice.isPending}
      confirmDisabled={!reason.trim() || reason.length > 500}
      onConfirm={() =>
        voidInvoice.mutate(reason.trim(), {
          onSuccess: () => {
            toast.success(t('void.done', { number: invoice.invoiceNumber }))
            onOpenChange(false)
          },
        })
      }
    >
      {voidInvoice.error ? <Banner tone="danger">{errorMessage(t, voidInvoice.error)}</Banner> : null}
      <Field label={t('void.reason')} htmlFor="void-reason" required hint={`${reason.length}/500`} error={reason.length > 500 ? t('validation.max500') : undefined}>
        <Textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('void.reasonPlaceholder')} />
      </Field>
    </ConfirmDialog>
  )
}

/* ------------------------------------------------------------------ email */

export function EmailDialog({ open, onOpenChange, invoice, defaults }: Common & { invoice: Invoice; defaults: string[] }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const send = useEmailInvoice(invoice.id)
  const [to, setTo] = useState<string[]>([])
  const [cc, setCc] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setTo(defaults)
      setCc([])
      send.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !send.isPending && onOpenChange(next)}
      title={t('email.title')}
      description={t('email.description', { number: invoice.invoiceNumber })}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            loading={send.isPending}
            disabled={to.length === 0}
            onClick={() =>
              send.mutate(
                { to, cc },
                {
                  onSuccess: () => {
                    toast.success(t('email.sent', { count: to.length + cc.length }))
                    onOpenChange(false)
                  },
                },
              )
            }
          >
            {send.isPending ? t('email.sending') : t('actions.sendEmail')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {send.error ? <Banner tone="danger">{errorMessage(t, send.error)}</Banner> : null}
        <Field label={t('email.to')} htmlFor="email-to" required hint={t('email.toHint')} error={fieldErrorOf(send.error, 'to')}>
          <EmailChips id="email-to" value={to} onChange={setTo} placeholder="billing@partner.example" invalid={!!fieldErrorOf(send.error, 'to')} />
        </Field>
        <Field label={t('email.cc')} htmlFor="email-cc" error={fieldErrorOf(send.error, 'cc')}>
          <EmailChips id="email-cc" value={cc} onChange={setCc} placeholder="accounting@rigi.example" invalid={!!fieldErrorOf(send.error, 'cc')} />
        </Field>
        <p className="text-xs text-muted">{t('email.attachmentNote')}</p>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------- edit lines */

export function EditLinesDialog({ open, onOpenChange, invoice, lines }: Common & { invoice: Invoice; lines: InvoiceLineItem[] }) {
  const { t } = useTranslation(['invoicing', 'common'])
  const replace = useReplaceLines(invoice.id)
  const [drafts, setDrafts] = useState<LineDraft[]>([])
  const [validation, setValidation] = useState<LinesValidation | null>(null)

  useEffect(() => {
    if (open) {
      setDrafts(fromInvoiceLines(lines))
      setValidation(null)
      replace.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = () => {
    const result = validateLines(drafts)
    setValidation(result)
    if (result.error || Object.keys(result.rowErrors).length > 0) return
    replace.mutate(result.lines, {
      onSuccess: () => {
        toast.success(t('editLines.done'))
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !replace.isPending && onOpenChange(next)}
      title={t('editLines.title')}
      description={t('editLines.description', { number: invoice.invoiceNumber })}
      size="xl"
      dismissible={false}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={replace.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button loading={replace.isPending} onClick={save}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      {replace.error ? <Banner tone="danger">{errorMessage(t, replace.error)}</Banner> : null}
      <LinesEditor
        value={drafts}
        onChange={(next) => {
          setDrafts(next)
          if (validation) setValidation(validateLines(next))
        }}
        currency={invoice.currency}
        validation={validation}
      />
    </Dialog>
  )
}
