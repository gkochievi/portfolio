/**
 * Mock API handlers. Owner: invoicing.
 * Invoices and their lifecycle: dashboard, list, monthly generation (with the
 * one-draft-per-period 409), ad-hoc invoices, VAT / notes / template edits,
 * line replacement, regenerate, issue, mark paid, void, e-mail + outbox, and
 * the three billing cron jobs. Patterns are registered WITHOUT the /api prefix.
 */
import { DemoApiError, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'

import type { Invoice, InvoiceLineItem, Partner } from '@/types'

import { emitChanged, now, nowIso, recordAudit, requireStaff } from '../ctx'
import {
  buildMonthlyInvoice,
  defaultIssueDates,
  displayStatus,
  linesOf,
  nextInvoiceNumber,
  rebuildMonthlyInvoice,
  recomputeInvoiceTotals,
  releaseInvoiceBillables,
  tasksBilled,
  VAT_RATE,
} from '../domain/billing'
import { addDaysIso, addMonths, inPeriod, periodKey, periodOf } from '../domain/dates'
import { newId } from '../domain/ids'
import { round2 } from '../domain/money'
import { periodUsage } from '../domain/points'
import { syntheticTrend } from '../domain/trend'
import { registerJob } from '../jobs'
import { store } from '../runtime'

/* ---------------------------------------------------------------- helpers */

const ACCOUNTING = 'accountant' as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value.replace(',', '.'))
  return Number.NaN
}

function partnerOf(id: string): Partner | undefined {
  return store.data.partners.find((p) => p.id === id)
}

function activePartners(): Partner[] {
  return store.data.partners.filter((p) => p.isActive && !p.deletedAt)
}

function mustFindInvoice(id: string): Invoice {
  const invoice = store.data.invoices.find((i) => i.id === id)
  if (!invoice) throw notFound()
  return invoice
}

function invalidTransition(): DemoApiError {
  return new DemoApiError(409, 'invoice_invalid_transition')
}

/** `YYYY-MM-DD` (noon local) or a full ISO timestamp -> ISO; undefined when blank; throws on garbage. */
function parseDateInput(value: unknown, field: string): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  let d: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, day] = raw.split('-').map(Number)
    d = new Date(y, m - 1, day, 12, 0, 0, 0)
  } else {
    d = new Date(raw)
  }
  if (Number.isNaN(d.getTime())) throw DemoApiError.validation({ [field]: 'Enter a valid date.' })
  return d.toISOString()
}

export function invoiceRow(invoice: Invoice) {
  const partner = partnerOf(invoice.partnerId)
  return {
    ...invoice,
    partnerName: partner?.name ?? '—',
    displayStatus: displayStatus(invoice, now()),
  }
}

function existingForPeriod(partnerId: string, year: number, month: number): Invoice[] {
  return store.data.invoices
    .filter((i) => i.partnerId === partnerId && i.kind === 'monthly' && i.periodYear === year && i.periodMonth === month)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function templateAllowed(templateId: string | null, partnerId: string): boolean {
  if (!templateId) return true
  const template = store.data.invoiceTemplates.find((t) => t.id === templateId)
  return !!template && (template.partnerId === null || template.partnerId === partnerId)
}

interface LineInput {
  description: string
  quantity: number
  unitPrice: number
}

/** Ad-hoc lines: blank descriptions dropped; quantity > 0 (decimal), finite price; at least one line. */
function parseLines(value: unknown): LineInput[] {
  const raw = Array.isArray(value) ? value : []
  const lines: LineInput[] = []
  raw.forEach((row, index) => {
    const input = (row ?? {}) as Record<string, unknown>
    const description = str(input.description)
    if (!description) return
    const quantity = num(input.quantity)
    const unitPrice = num(input.unitPrice)
    if (description.length > 500) throw DemoApiError.validation({ [`lines.${index}.description`]: 'At most 500 characters.' })
    if (!Number.isFinite(quantity) || quantity <= 0) throw DemoApiError.validation({ [`lines.${index}.quantity`]: 'Quantity must be greater than 0.' })
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw DemoApiError.validation({ [`lines.${index}.unitPrice`]: 'Enter a valid price.' })
    lines.push({ description, quantity: round2(quantity * 1000) / 1000, unitPrice: round2(unitPrice) })
  })
  if (lines.length === 0) throw DemoApiError.validation({ lines: 'Add at least one line with a description.' })
  if (lines.length > 100) throw DemoApiError.validation({ lines: 'At most 100 lines.' })
  return lines
}

function toAdhocLines(invoiceId: string, lines: LineInput[]): InvoiceLineItem[] {
  return lines.map((line, index) => ({
    id: newId('line_'),
    invoiceId,
    kind: 'adhoc',
    description: line.description,
    quantityNumerator: line.quantity,
    quantityDenominator: 1,
    unitPrice: line.unitPrice,
    amount: round2(line.quantity * line.unitPrice),
    sortOrder: index + 1,
    metadata: {},
  }))
}

function snapshot(invoice: Invoice) {
  return {
    status: invoice.status,
    vatInclusive: invoice.vatInclusive,
    notes: invoice.notes,
    templateId: invoice.templateId,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    voidedAt: invoice.voidedAt,
    voidReason: invoice.voidReason,
  }
}

const CHANGED = ['invoices', 'dashboards', 'reports', 'points', 'projects'] as const

function changed(): void {
  emitChanged(...CHANGED)
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Draft every given partner for the period, skipping any partner that already has one. */
function draftPartners(partners: Partner[], year: number, month: number, templateId: string | null = null) {
  const created: Invoice[] = []
  let skipped = 0
  for (const partner of partners) {
    if (existingForPeriod(partner.id, year, month).length > 0) {
      skipped += 1
      continue
    }
    const { invoice } = buildMonthlyInvoice(store.data, partner.id, year, month, { templateId, at: nowIso() })
    created.push(invoice)
  }
  return { created, skipped }
}

function previousPeriod() {
  const p = periodOf(now())
  return addMonths(p.year, p.month, -1)
}

/* --------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* -------- partner options (accountants cannot read the SA partner list) */
  api.register('GET', '/invoicing/partners', () => {
    requireStaff(ACCOUNTING)
    return store.data.partners
      .filter((p) => !p.deletedAt)
      .map((p) => ({ id: p.id, name: p.name, legalName: p.legalName, currency: p.currency, isActive: p.isActive }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  /* ------------------------------------------------------------ dashboard */
  api.register('GET', '/accountant/dashboard', () => {
    requireStaff(ACCOUNTING)
    const at = now()
    const invoices = store.data.invoices
    const active = activePartners().length
    const drafts = invoices.filter((i) => i.status === 'draft')
    const unpaid = invoices.filter((i) => i.status === 'issued')
    const paidThisMonth = invoices.filter((i) => i.status === 'paid' && i.paidAt && inPeriod(i.paidAt, at.getFullYear(), at.getMonth() + 1))
    const revenue = new Map<string, number>()
    for (const i of paidThisMonth) revenue.set(i.currency, round2((revenue.get(i.currency) ?? 0) + i.total))
    const revenueByCurrency = [...revenue.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount)
    const overdue = unpaid.filter((i) => displayStatus(i, at) === 'overdue')
    const recentlyPaid = invoices
      .filter((i) => i.status === 'paid' && i.paidAt)
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
      .slice(0, 6)
    const unpaidByCurrency = new Map<string, number>()
    for (const i of unpaid) unpaidByCurrency.set(i.currency, round2((unpaidByCurrency.get(i.currency) ?? 0) + i.total))
    return {
      activePartners: { value: active, trend: syntheticTrend(active, 2) },
      drafts: { value: drafts.length, trend: syntheticTrend(drafts.length, 3, true) },
      unpaid: {
        value: unpaid.length,
        trend: syntheticTrend(unpaid.length, 3, true),
        byCurrency: [...unpaidByCurrency.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount),
      },
      revenue: {
        byCurrency: revenueByCurrency,
        count: paidThisMonth.length,
        trend: syntheticTrend(revenueByCurrency[0]?.amount ?? 0, Math.max(100, (revenueByCurrency[0]?.amount ?? 0) * 0.3)),
      },
      queues: {
        drafts: drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map(invoiceRow),
        overdue: overdue.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')).slice(0, 6).map(invoiceRow),
        recentlyPaid: recentlyPaid.map(invoiceRow),
      },
      counts: { drafts: drafts.length, overdue: overdue.length },
    }
  })

  /* ----------------------------------------------------------------- list */
  api.register('GET', '/invoices', ({ params }) => {
    requireStaff(ACCOUNTING)
    const year = params.year ? Number(params.year) : null
    const month = params.month ? Number(params.month) : null
    const items = store.data.invoices
      .filter((i) => !params.partnerId || i.partnerId === params.partnerId)
      .filter((i) => year === null || i.periodYear === year)
      .filter((i) => month === null || i.periodMonth === month)
      .filter((i) => !params.status || i.status === params.status)
      .sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber))
      .map(invoiceRow)
    return { items, total: items.length }
  })

  /* ------------------------------------------------------------- generate */
  api.register('POST', '/invoices/generate', ({ body }) => {
    requireStaff(ACCOUNTING)
    const input = (body ?? {}) as Record<string, unknown>
    const year = num(input.year)
    const month = num(input.month)
    const partnerId = str(input.partnerId) || null
    const templateId = str(input.templateId) || null
    const allowDuplicate = input.allowDuplicate === true
    const errors: Record<string, string> = {}
    if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Enter a valid year.'
    if (!Number.isInteger(month) || month < 1 || month > 12) errors.month = 'Choose a month.'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)

    if (partnerId) {
      const partner = partnerOf(partnerId)
      if (!partner || partner.deletedAt) throw DemoApiError.validation({ partnerId: 'Unknown partner.' })
      if (!partner.isActive) throw DemoApiError.validation({ partnerId: 'This partner is inactive.' })
      if (!templateAllowed(templateId, partnerId)) throw DemoApiError.validation({ templateId: 'This template is not available for the partner.' })
      const existing = existingForPeriod(partnerId, year, month)
      if (existing.length > 0 && !allowDuplicate) {
        throw new DemoApiError(409, 'invoice_duplicate_period', { existing: existing.map((i) => i.id) })
      }
      const { invoice, lines } = buildMonthlyInvoice(store.data, partnerId, year, month, { templateId, at: nowIso() })
      recordAudit({
        action: 'invoice.generate',
        entityType: 'invoice',
        entityId: invoice.id,
        partnerId,
        after: { invoiceNumber: invoice.invoiceNumber, period: periodKey(year, month), lines: lines.length, total: invoice.total, duplicate: existing.length > 0 },
      })
      changed()
      return invoiceRow(invoice)
    }

    const { created, skipped } = draftPartners(activePartners(), year, month)
    for (const invoice of created) {
      recordAudit({
        action: 'invoice.generate',
        entityType: 'invoice',
        entityId: invoice.id,
        partnerId: invoice.partnerId,
        after: { invoiceNumber: invoice.invoiceNumber, period: periodKey(year, month), total: invoice.total, batch: true },
      })
    }
    if (created.length > 0) changed()
    return { enqueued: created.length, skipped }
  })

  /* --------------------------------------------------------------- ad-hoc */
  api.register('POST', '/invoices/adhoc', ({ body }) => {
    requireStaff(ACCOUNTING)
    const input = (body ?? {}) as Record<string, unknown>
    const partnerId = str(input.partnerId)
    const title = str(input.title)
    const notes = typeof input.notes === 'string' ? input.notes : ''
    const templateId = str(input.templateId) || null
    const errors: Record<string, string> = {}
    const partner = partnerId ? partnerOf(partnerId) : undefined
    if (!partner) errors.partnerId = 'Choose a partner.'
    else if (!partner.isActive || partner.deletedAt) errors.partnerId = 'This partner is inactive.'
    if (!title) errors.title = 'This field is required.'
    else if (title.length > 200) errors.title = 'At most 200 characters.'
    if (notes.length > 4000) errors.notes = 'At most 4000 characters.'
    if (partner && !templateAllowed(templateId, partner.id)) errors.templateId = 'This template is not available for the partner.'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const lines = parseLines(input.lines)
    const p = partner as Partner
    const at = now()
    const period = periodOf(at)
    const invoice: Invoice = {
      id: newId('inv_'),
      partnerId: p.id,
      invoiceNumber: nextInvoiceNumber(store.data, period.year, period.month),
      kind: 'adhoc',
      title,
      periodYear: period.year,
      periodMonth: period.month,
      status: 'draft',
      currency: p.currency,
      subtotal: 0,
      tax: 0,
      total: 0,
      vatInclusive: false,
      vatRate: VAT_RATE,
      notes: notes.trim(),
      issuedAt: null,
      dueAt: null,
      paidAt: null,
      voidedAt: null,
      voidReason: null,
      disputedAt: null,
      disputeReason: null,
      templateId,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
    }
    store.data.invoices.push(invoice)
    store.data.invoiceLines.push(...toAdhocLines(invoice.id, lines))
    recomputeInvoiceTotals(store.data, invoice)
    recordAudit({
      action: 'invoice.create_adhoc',
      entityType: 'invoice',
      entityId: invoice.id,
      partnerId: p.id,
      after: { invoiceNumber: invoice.invoiceNumber, title, lines: lines.length, total: invoice.total },
    })
    changed()
    return invoiceRow(invoice)
  })

  /* --------------------------------------------------------------- detail */
  api.register('GET', '/invoices/:id', ({ path }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    const partner = partnerOf(invoice.partnerId)
    const template = invoice.templateId ? store.data.invoiceTemplates.find((t) => t.id === invoice.templateId) : undefined
    return {
      invoice: invoiceRow(invoice),
      lines: linesOf(store.data, invoice.id),
      tasksBilled: tasksBilled(store.data, invoice),
      partner: partner
        ? {
            id: partner.id,
            name: partner.name,
            legalName: partner.legalName,
            currency: partner.currency,
            billingEmail: partner.billingEmail,
            billingEmails: partner.billingEmails,
            contactEmail: partner.contactEmail,
            isActive: partner.isActive,
          }
        : null,
      template: template ? { id: template.id, name: template.name } : null,
      outbox: store.data.outbox.filter((o) => o.invoiceId === invoice.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    }
  })

  api.register('PATCH', '/invoices/:id', ({ path, body }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status !== 'draft') throw invalidTransition()
    const input = (body ?? {}) as Record<string, unknown>
    const before = snapshot(invoice)
    if ('notes' in input) {
      const notes = typeof input.notes === 'string' ? input.notes : ''
      if (notes.length > 4000) throw DemoApiError.validation({ notes: 'At most 4000 characters.' })
      invoice.notes = notes.trim()
    }
    if ('templateId' in input) {
      const templateId = str(input.templateId) || null
      if (!templateAllowed(templateId, invoice.partnerId)) throw DemoApiError.validation({ templateId: 'This template is not available for the partner.' })
      invoice.templateId = templateId
    }
    if (typeof input.vatInclusive === 'boolean') invoice.vatInclusive = input.vatInclusive
    recomputeInvoiceTotals(store.data, invoice)
    invoice.updatedAt = nowIso()
    recordAudit({ action: 'invoice.update', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, before, after: snapshot(invoice) })
    changed()
    return invoiceRow(invoice)
  })

  api.register('PUT', '/invoices/:id/lines', ({ path, body }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status !== 'draft' || invoice.kind !== 'adhoc') throw invalidTransition()
    const input = (body ?? {}) as Record<string, unknown>
    const lines = parseLines(input.lines)
    const before = { lines: linesOf(store.data, invoice.id).map((l) => ({ description: l.description, quantity: l.quantityNumerator, unitPrice: l.unitPrice })), total: invoice.total }
    store.data.invoiceLines = store.data.invoiceLines.filter((l) => l.invoiceId !== invoice.id)
    store.data.invoiceLines.push(...toAdhocLines(invoice.id, lines))
    recomputeInvoiceTotals(store.data, invoice)
    invoice.updatedAt = nowIso()
    recordAudit({ action: 'invoice.replace_lines', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, before, after: { lines, total: invoice.total } })
    changed()
    return invoiceRow(invoice)
  })

  api.register('POST', '/invoices/:id/regenerate', ({ path }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status !== 'draft' || invoice.kind !== 'monthly') throw invalidTransition()
    const before = { total: invoice.total, lines: linesOf(store.data, invoice.id).length }
    const lines = rebuildMonthlyInvoice(store.data, invoice, nowIso())
    recordAudit({
      action: 'invoice.generate',
      entityType: 'invoice',
      entityId: invoice.id,
      partnerId: invoice.partnerId,
      before,
      after: { total: invoice.total, lines: lines.length, regenerated: true },
    })
    changed()
    return invoiceRow(invoice)
  })

  /* ------------------------------------------------------------ lifecycle */
  api.register('POST', '/invoices/:id/issue', ({ path, body }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status === 'void') throw new DemoApiError(409, 'invoice_already_void')
    if (invoice.status !== 'draft') throw invalidTransition()
    if (linesOf(store.data, invoice.id).length === 0) throw new DemoApiError(409, 'invoice_has_no_lines')
    const input = (body ?? {}) as Record<string, unknown>
    const defaults = defaultIssueDates(invoice, now())
    const issuedAt = parseDateInput(input.issuedAt, 'issuedAt') ?? defaults.issuedAt
    const dueAt = parseDateInput(input.dueAt, 'dueAt') ?? addDaysIso(issuedAt, 14)
    if (dueAt.slice(0, 10) < issuedAt.slice(0, 10)) throw DemoApiError.validation({ dueAt: 'The due date cannot be before the issue date.' })
    const before = snapshot(invoice)
    invoice.status = 'issued'
    invoice.issuedAt = issuedAt
    invoice.dueAt = dueAt
    invoice.updatedAt = nowIso()
    recordAudit({ action: 'invoice.issue', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, before, after: snapshot(invoice) })
    changed()
    return invoiceRow(invoice)
  })

  api.register('POST', '/invoices/:id/mark-paid', ({ path, body }) => {
    requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status === 'void') throw new DemoApiError(409, 'invoice_already_void')
    if (invoice.status !== 'issued') throw invalidTransition()
    const input = (body ?? {}) as Record<string, unknown>
    const paidAt = parseDateInput(input.paidAt, 'paidAt')
    if (!paidAt) throw DemoApiError.validation({ paidAt: 'This field is required.' })
    if (invoice.issuedAt && paidAt.slice(0, 10) < invoice.issuedAt.slice(0, 10)) {
      throw DemoApiError.validation({ paidAt: 'The payment date cannot be before the issue date.' })
    }
    const before = snapshot(invoice)
    invoice.status = 'paid'
    invoice.paidAt = paidAt
    invoice.updatedAt = nowIso()
    recordAudit({ action: 'invoice.mark_paid', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, before, after: snapshot(invoice) })
    changed()
    return invoiceRow(invoice)
  })

  api.register('POST', '/invoices/:id/void', ({ path, body }) => {
    const me = requireStaff('superadmin')
    if (me.role !== 'superadmin') throw forbidden()
    const invoice = mustFindInvoice(path.id)
    if (invoice.status === 'void') throw new DemoApiError(409, 'invoice_already_void')
    if (invoice.status === 'paid') throw invalidTransition()
    const input = (body ?? {}) as Record<string, unknown>
    const reason = str(input.reason)
    if (!reason) throw DemoApiError.validation({ reason: 'This field is required.' })
    if (reason.length > 500) throw DemoApiError.validation({ reason: 'At most 500 characters.' })
    const before = snapshot(invoice)
    invoice.status = 'void'
    invoice.voidedAt = nowIso()
    invoice.voidReason = reason
    invoice.updatedAt = invoice.voidedAt
    if (invoice.kind === 'monthly') releaseInvoiceBillables(store.data, invoice.id)
    recordAudit({ action: 'invoice.void', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, before, after: snapshot(invoice) })
    changed()
    return invoiceRow(invoice)
  })

  /* ---------------------------------------------------------------- email */
  api.register('POST', '/invoices/:id/email', async ({ path, body }) => {
    const me = requireStaff(ACCOUNTING)
    const invoice = mustFindInvoice(path.id)
    if (invoice.status === 'void') throw new DemoApiError(409, 'invoice_already_void')
    const input = (body ?? {}) as Record<string, unknown>
    const clean = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : [])
    const to = [...new Set(clean(input.to))]
    const cc = [...new Set(clean(input.cc))].filter((e) => !to.includes(e))
    if (to.length === 0) throw DemoApiError.validation({ to: 'Add at least one recipient.' })
    if (to.length > 20) throw DemoApiError.validation({ to: 'At most 20 recipients.' })
    if (cc.length > 20) throw DemoApiError.validation({ cc: 'At most 20 recipients.' })
    const bad = [...to, ...cc].find((e) => !EMAIL_RE.test(e))
    if (bad) throw DemoApiError.validation({ [to.includes(bad) ? 'to' : 'cc']: `Not a valid e-mail address: ${bad}` })
    await delay(800)
    const partner = partnerOf(invoice.partnerId)
    const entry = {
      id: newId('out_'),
      invoiceId: invoice.id,
      to,
      cc,
      subject: `Invoice ${invoice.invoiceNumber}${partner ? ` · ${partner.name}` : ''}`,
      sentAt: nowIso(),
      sentByName: me.name,
    }
    store.data.outbox.unshift(entry)
    recordAudit({ action: 'invoice.email', entityType: 'invoice', entityId: invoice.id, partnerId: invoice.partnerId, after: { to, cc } })
    emitChanged('outbox', 'invoices')
    return entry
  })

  api.register('GET', '/outbox', ({ params }) => {
    requireStaff(ACCOUNTING)
    return store.data.outbox
      .filter((o) => !params.invoiceId || o.invoiceId === params.invoiceId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .map((o) => {
        const invoice = store.data.invoices.find((i) => i.id === o.invoiceId)
        return { ...o, invoiceNumber: invoice?.invoiceNumber ?? '—', partnerName: invoice ? partnerOf(invoice.partnerId)?.name ?? '—' : '—' }
      })
  })

  /* ----------------------------------------------------------------- jobs */
  registerJob('points.month.close', () => {
    const { year, month } = previousPeriod()
    let free = 0
    let chargeable = 0
    let amount = 0
    const partners = activePartners()
    for (const partner of partners) {
      const usage = periodUsage(store.data, partner.id, year, month)
      free = round2(free + usage.freeUsed)
      chargeable = round2(chargeable + usage.chargeablePoints)
      amount = round2(amount + usage.chargeableAmount)
    }
    emitChanged('points', 'reports')
    return {
      ok: true,
      summary: `Closed ${periodKey(year, month)} for ${partners.length} partners: ${free} free pts used, ${chargeable} chargeable pts (${amount} in partner currencies)`,
    }
  })

  registerJob('invoices.generate.month', () => {
    const { year, month } = previousPeriod()
    const { created, skipped } = draftPartners(activePartners(), year, month)
    if (created.length > 0) changed()
    return { ok: true, summary: `${periodKey(year, month)}: ${created.length} drafts created, ${skipped} skipped (already invoiced)` }
  })

  registerJob('invoices.autodraft.daily', () => {
    const today = now().getDate()
    const { year, month } = previousPeriod()
    const due = activePartners().filter((p) => p.invoiceGenerationDay === today)
    const { created, skipped } = draftPartners(due, year, month)
    if (created.length > 0) changed()
    return {
      ok: true,
      summary: `Day ${today}: ${due.length} partners due, ${created.length} drafts created for ${periodKey(year, month)}, ${skipped} skipped`,
    }
  })
}

