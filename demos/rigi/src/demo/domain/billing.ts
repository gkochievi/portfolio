/**
 * Invoice maths. Owner: seed. The seed builds its invoice history with these
 * same functions, so a freshly generated draft always matches the seeded ones.
 */
import type {
  DemoData,
  Invoice,
  InvoiceDisplayStatus,
  InvoiceLineItem,
  ISODate,
  ISODateTime,
  PointTransaction,
  Project,
} from '@/types'

import { addDays, addDaysIso, comparePeriod, daysInMonth, diffDays, firstDayOfPeriod, lastDayOfPeriod, parseIsoDate, periodOf } from './dates'
import { newId } from './ids'
import { round2, sum } from './money'
import { effectiveLicensePrice } from './seats'

/** Georgian VAT. */
export const VAT_RATE = 0.18
/** dueAt defaults to issuedAt + 14 days. */
export const PAYMENT_TERMS_DAYS = 14

export interface InvoiceTotals {
  subtotal: number
  tax: number
  total: number
}

/**
 * VAT-inclusive: total = sum of lines, tax = total - total/(1+r), subtotal = total - tax.
 * VAT-exclusive: subtotal = sum, tax = subtotal x r, total = subtotal + tax.
 */
export function computeTotals(lines: ReadonlyArray<Pick<InvoiceLineItem, 'amount'>>, vatInclusive: boolean, vatRate = VAT_RATE): InvoiceTotals {
  const gross = sum(lines.map((l) => l.amount))
  if (vatInclusive) {
    const tax = round2(gross - gross / (1 + vatRate))
    return { subtotal: round2(gross - tax), tax, total: gross }
  }
  const tax = round2(gross * vatRate)
  return { subtotal: gross, tax, total: round2(gross + tax) }
}

export type DraftLine = Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'sortOrder'>

/* --------------------------------------------------------- subscription */

/**
 * Billed user-days of one membership period inside the month, by the
 * hotel-nights rule: the join day and the leave day are not billed.
 */
export function billedUserDays(startedOn: ISODate, endedOn: ISODate | null, year: number, month: number): number {
  const monthStart = firstDayOfPeriod(year, month)
  const monthEnd = lastDayOfPeriod(year, month)
  const afterJoin = addDays(startedOn, 1)
  const first = afterJoin > monthStart ? afterJoin : monthStart
  const beforeLeave = endedOn ? addDays(endedOn, -1) : monthEnd
  const last = beforeLeave < monthEnd ? beforeLeave : monthEnd
  if (last < first) return 0
  return diffDays(last, first) + 1
}

/** One line per per_user license: price x billed user-days / days in month (billingEnabled users only). */
export function subscriptionLines(data: DemoData, partnerId: string, year: number, month: number): DraftLine[] {
  const dim = daysInMonth(year, month)
  const billable = new Set(data.partnerUsers.filter((u) => u.partnerId === partnerId && u.billingEnabled).map((u) => u.id))
  const lines: DraftLine[] = []
  for (const license of data.licenses) {
    if (license.kind !== 'per_user') continue
    let userDays = 0
    for (const period of data.membershipPeriods) {
      if (period.partnerId !== partnerId || period.licenseId !== license.id || !billable.has(period.partnerUserId)) continue
      userDays += billedUserDays(period.startedOn, period.endedOn, year, month)
    }
    if (userDays === 0) continue
    const price = effectiveLicensePrice(data, partnerId, license.id)
    lines.push({
      kind: 'subscription',
      description: `${license.name} (${license.code}): ${userDays} user-days / ${dim}`,
      quantityNumerator: userDays,
      quantityDenominator: dim,
      unitPrice: price,
      amount: round2((price * userDays) / dim),
      metadata: { licenseCode: license.code, sumUserDays: userDays, daysInMonth: dim },
    })
  }
  return lines
}

/* ------------------------------------------------------------- overflow */

const OVERFLOW_KINDS: ReadonlyArray<PointTransaction['kind']> = ['debit_chargeable', 'adjustment_debit', 'adjustment_credit']

/**
 * Unbilled chargeable + adjustment rows up to and including the period, as one
 * `points_overflow` line (or a negative `discount` line when credits win).
 * Returns the rows so the caller can mark them billed once the line has an id.
 */
export function overflowLine(data: DemoData, partnerId: string, year: number, month: number): { line: DraftLine; rows: PointTransaction[] } | null {
  const rows = data.pointTransactions.filter(
    (t) =>
      t.partnerId === partnerId &&
      t.invoiceLineItemId === null &&
      OVERFLOW_KINDS.includes(t.kind) &&
      comparePeriod({ year: t.periodYear, month: t.periodMonth }, { year, month }) <= 0,
  )
  if (rows.length === 0) return null
  const signed = (t: PointTransaction) => (t.kind === 'adjustment_credit' ? -1 : 1)
  const amount = round2(rows.reduce((acc, t) => acc + signed(t) * t.amount, 0))
  const points = round2(rows.reduce((acc, t) => acc + signed(t) * t.points, 0))
  if (amount === 0) return null
  const unitPrice = points !== 0 ? round2(Math.abs(amount / points)) : rows[0].ratePerPoint
  const line: DraftLine =
    amount > 0
      ? {
          kind: 'points_overflow',
          description: `Points over the free allowance: ${points} pts`,
          quantityNumerator: points,
          quantityDenominator: 1,
          unitPrice,
          amount,
          metadata: { points },
        }
      : {
          kind: 'discount',
          description: `Points credit: ${Math.abs(points)} pts`,
          quantityNumerator: points,
          quantityDenominator: 1,
          unitPrice,
          amount,
          metadata: { points },
        }
  return { line, rows }
}

/* ------------------------------------------------------------- projects */

export function projectLines(data: DemoData, partnerId: string, year: number, month: number): Array<{ line: DraftLine; project: Project }> {
  return data.projects
    .filter(
      (p) =>
        p.partnerId === partnerId &&
        p.state === 'completed' &&
        p.billedInvoiceId === null &&
        p.price !== null &&
        p.completedAt !== null &&
        comparePeriod(periodOf(p.completedAt), { year, month }) <= 0,
    )
    .map((project) => ({
      project,
      line: {
        kind: 'project' as const,
        description: `Project PRJ-${project.number}: ${project.name}`,
        quantityNumerator: 1,
        quantityDenominator: 1,
        unitPrice: project.price ?? 0,
        amount: round2(project.price ?? 0),
        metadata: { projectId: project.id },
      },
    }))
}

/* --------------------------------------------------------------- numbers */

/** `INV-YYYY-MM-NNNNNN`: a global per-period sequence. */
export function nextInvoiceNumber(data: DemoData, year: number, month: number): string {
  const prefix = `INV-${year}-${String(month).padStart(2, '0')}-`
  let max = 0
  for (const invoice of data.invoices) {
    if (!invoice.invoiceNumber.startsWith(prefix)) continue
    max = Math.max(max, Number(invoice.invoiceNumber.slice(prefix.length)) || 0)
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`
}

/* ------------------------------------------------------------- invoices */

export function linesOf(data: DemoData, invoiceId: string): InvoiceLineItem[] {
  return data.invoiceLines.filter((l) => l.invoiceId === invoiceId).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Re-sum the invoice from its lines (call after any line or VAT change). */
export function recomputeInvoiceTotals(data: DemoData, invoice: Invoice): Invoice {
  Object.assign(invoice, computeTotals(linesOf(data, invoice.id), invoice.vatInclusive, invoice.vatRate))
  return invoice
}

/** Undo what a monthly invoice billed (points rows, projects); used by void and regenerate. */
export function releaseInvoiceBillables(data: DemoData, invoiceId: string): void {
  const lineIds = new Set(data.invoiceLines.filter((l) => l.invoiceId === invoiceId).map((l) => l.id))
  for (const t of data.pointTransactions) if (t.invoiceLineItemId && lineIds.has(t.invoiceLineItemId)) t.invoiceLineItemId = null
  for (const p of data.projects) if (p.billedInvoiceId === invoiceId) p.billedInvoiceId = null
}

/** Build subscription + overflow + project lines for a monthly invoice, mark what they bill, re-total. */
export function attachMonthlyLines(data: DemoData, invoice: Invoice): InvoiceLineItem[] {
  const { periodYear: y, periodMonth: m, partnerId } = invoice
  const lines: InvoiceLineItem[] = []
  const push = (draft: DraftLine): InvoiceLineItem => {
    const line: InvoiceLineItem = { ...draft, id: newId('line_'), invoiceId: invoice.id, sortOrder: lines.length + 1 }
    lines.push(line)
    return line
  }
  for (const draft of subscriptionLines(data, partnerId, y, m)) push(draft)
  for (const { line, project } of projectLines(data, partnerId, y, m)) {
    push(line)
    project.billedInvoiceId = invoice.id
  }
  const overflow = overflowLine(data, partnerId, y, m)
  if (overflow) {
    const line = push(overflow.line)
    for (const row of overflow.rows) row.invoiceLineItemId = line.id
  }
  data.invoiceLines.push(...lines)
  recomputeInvoiceTotals(data, invoice)
  return lines
}

export interface BuildInvoiceOptions {
  templateId?: string | null
  at?: ISODateTime
  vatInclusive?: boolean
  notes?: string
}

/** Create a monthly DRAFT (pushed into `data`) with its lines. */
export function buildMonthlyInvoice(
  data: DemoData,
  partnerId: string,
  year: number,
  month: number,
  options: BuildInvoiceOptions = {},
): { invoice: Invoice; lines: InvoiceLineItem[] } {
  const partner = data.partners.find((p) => p.id === partnerId)
  if (!partner) throw new Error(`Unknown partner ${partnerId}`)
  const at = options.at ?? new Date().toISOString()
  const invoice: Invoice = {
    id: newId('inv_'),
    partnerId,
    invoiceNumber: nextInvoiceNumber(data, year, month),
    kind: 'monthly',
    title: null,
    periodYear: year,
    periodMonth: month,
    status: 'draft',
    currency: partner.currency,
    subtotal: 0,
    tax: 0,
    total: 0,
    vatInclusive: options.vatInclusive ?? false,
    vatRate: VAT_RATE,
    notes: options.notes ?? '',
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    voidedAt: null,
    voidReason: null,
    disputedAt: null,
    disputeReason: null,
    templateId: options.templateId ?? null,
    createdAt: at,
    updatedAt: at,
  }
  data.invoices.push(invoice)
  const lines = attachMonthlyLines(data, invoice)
  return { invoice, lines }
}

/** Regenerate a monthly draft: release what it billed, drop its lines, rebuild. */
export function rebuildMonthlyInvoice(data: DemoData, invoice: Invoice, at: ISODateTime = new Date().toISOString()): InvoiceLineItem[] {
  releaseInvoiceBillables(data, invoice.id)
  data.invoiceLines = data.invoiceLines.filter((l) => l.invoiceId !== invoice.id)
  invoice.updatedAt = at
  return attachMonthlyLines(data, invoice)
}

/** Issue defaults: monthly = last day of the period (noon), ad-hoc = now; due = +14 days. */
export function defaultIssueDates(invoice: Pick<Invoice, 'kind' | 'periodYear' | 'periodMonth'>, now: Date = new Date()): { issuedAt: ISODateTime; dueAt: ISODateTime } {
  let issued: Date
  if (invoice.kind === 'monthly') {
    issued = parseIsoDate(lastDayOfPeriod(invoice.periodYear, invoice.periodMonth))
    issued.setHours(12, 0, 0, 0)
  } else {
    issued = now
  }
  const issuedAt = issued.toISOString()
  return { issuedAt, dueAt: addDaysIso(issuedAt, PAYMENT_TERMS_DAYS) }
}

/** Portal status: void > paid > disputed > overdue (issued, past due) > pending. */
export function displayStatus(invoice: Pick<Invoice, 'status' | 'disputedAt' | 'dueAt'>, now: Date = new Date()): InvoiceDisplayStatus {
  if (invoice.status === 'void') return 'void'
  if (invoice.status === 'paid') return 'paid'
  if (invoice.disputedAt) return 'disputed'
  if (invoice.status === 'issued' && invoice.dueAt && new Date(invoice.dueAt).getTime() < now.getTime()) return 'overdue'
  return 'pending'
}

/* ---------------------------------------------------------- tasks billed */

export interface TaskBilledRow {
  taskId: string
  number: number
  title: string
  finishedAt: ISODateTime | null
  verifiedAt: ISODateTime | null
  /** Template name, or null for a template-less task. */
  template: string | null
  points: number
  freePoints: number
  chargeablePoints: number
  rate: number
  /** Gross: points x rate. */
  amount: number
}

export interface TasksBilled {
  rows: TaskBilledRow[]
  totalPoints: number
  grossAmount: number
  freePoints: number
  freeDeductionAmount: number
  /** gross - free deduction = what the partner pays for tasks. */
  net: number
}

/** The "Tasks billed" card and the PDF `tasks` / `taskBilling.*` tokens. */
export function tasksBilled(data: DemoData, invoice: Invoice): TasksBilled {
  const empty: TasksBilled = { rows: [], totalPoints: 0, grossAmount: 0, freePoints: 0, freeDeductionAmount: 0, net: 0 }
  if (invoice.kind !== 'monthly') return empty
  const lineIds = new Set(data.invoiceLines.filter((l) => l.invoiceId === invoice.id).map((l) => l.id))
  const txs = data.pointTransactions.filter(
    (t) =>
      t.partnerId === invoice.partnerId &&
      t.taskId !== null &&
      (t.kind === 'debit_free' || t.kind === 'debit_chargeable') &&
      ((t.periodYear === invoice.periodYear && t.periodMonth === invoice.periodMonth) || (t.invoiceLineItemId !== null && lineIds.has(t.invoiceLineItemId))),
  )
  const byTask = new Map<string, TaskBilledRow>()
  for (const t of txs) {
    const taskId = t.taskId as string
    let row = byTask.get(taskId)
    if (!row) {
      const task = data.tasks.find((x) => x.id === taskId)
      const template = task?.templateId ? data.taskTemplates.find((x) => x.id === task.templateId) : undefined
      row = {
        taskId,
        number: task?.number ?? 0,
        title: task?.title ?? '',
        finishedAt: task?.finishedAt ?? null,
        verifiedAt: task?.verifiedAt ?? null,
        template: template?.name ?? null,
        points: 0,
        freePoints: 0,
        chargeablePoints: 0,
        rate: t.ratePerPoint,
        amount: 0,
      }
      byTask.set(taskId, row)
    }
    row.points = round2(row.points + t.points)
    if (t.kind === 'debit_free') row.freePoints = round2(row.freePoints + t.points)
    else row.chargeablePoints = round2(row.chargeablePoints + t.points)
    row.amount = round2(row.points * row.rate)
  }
  const rows = [...byTask.values()].sort((a, b) => (a.verifiedAt ?? '').localeCompare(b.verifiedAt ?? ''))
  const grossAmount = sum(rows.map((r) => r.amount))
  const freeDeductionAmount = sum(rows.map((r) => round2(r.freePoints * r.rate)))
  return {
    rows,
    totalPoints: sum(rows.map((r) => r.points)),
    grossAmount,
    freePoints: sum(rows.map((r) => r.freePoints)),
    freeDeductionAmount,
    net: round2(grossAmount - freeDeductionAmount),
  }
}
