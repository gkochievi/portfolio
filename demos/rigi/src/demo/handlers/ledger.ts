/**
 * Mock API handlers. Owner: ledger.
 * Partner money views (licenses & users, invoices, dispute, points meter) and
 * the finance reports (payments, unused allowance). Patterns are registered
 * WITHOUT the /api prefix.
 */
import { DemoApiError, notFound, type MockApi } from '@portfolio/demo-kit'

import type { Currency, Invoice } from '@/types'

import { emitChanged, now, nowIso, requirePartnerAdmin, requireStaff, writeSystemLog } from '../ctx'
import { displayStatus, linesOf } from '../domain/billing'
import { addMonths, inPeriod, periodOf } from '../domain/dates'
import { round2, sum } from '../domain/money'
import { periodUsage, usageHistory } from '../domain/points'
import { effectiveLicensePrice, seatSummary } from '../domain/seats'
import { store } from '../runtime'

/* ---------------------------------------------------------------- helpers */

function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : Number.NaN
}

function ownInvoice(partnerId: string, id: string): Invoice {
  const invoice = store.data.invoices.find((i) => i.id === id && i.partnerId === partnerId)
  if (!invoice || invoice.status === 'draft') throw notFound()
  return invoice
}

function invoiceRow(invoice: Invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    kind: invoice.kind,
    title: invoice.title,
    periodYear: invoice.periodYear,
    periodMonth: invoice.periodMonth,
    displayStatus: displayStatus(invoice, now()),
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    total: invoice.total,
    currency: invoice.currency,
    vatInclusive: invoice.vatInclusive,
  }
}

function canDispute(invoice: Invoice): boolean {
  const status = displayStatus(invoice, now())
  return status === 'pending' || status === 'overdue' || status === 'disputed'
}

function validYear(value: unknown): number {
  const year = toInt(value)
  if (year === null) throw DemoApiError.validation({ year: 'This field is required.' })
  if (!Number.isFinite(year) || year < 2000 || year > 2100) throw DemoApiError.validation({ year: 'Enter a valid year.' })
  return year
}

function validMonth(value: unknown, required: boolean): number | null {
  const month = toInt(value)
  if (month === null) {
    if (required) throw DemoApiError.validation({ month: 'This field is required.' })
    return null
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) throw DemoApiError.validation({ month: 'Enter a month from 1 to 12.' })
  return month
}

/* --------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* ---- partner portal: licenses & users ---- */
  api.register('GET', '/portal/account', () => {
    const { partner } = requirePartnerAdmin()
    const data = store.data
    const summary = seatSummary(data, partner.id)
    const licenseById = new Map(data.licenses.map((l) => [l.id, l]))

    const licenses = summary.rows.map((r) => ({
      id: r.license.id,
      code: r.license.code,
      name: r.license.name,
      kind: r.license.kind,
      unitPrice: r.unitPrice,
      seats: r.seats,
      users: r.taggedUsers,
      monthlyCost: r.monthlyCost,
      isOverride: r.isOverride,
    }))

    const users = data.partnerUsers.filter((u) => u.partnerId === partner.id && u.isActive)
    const roster = users
      .map((u) => {
        const license = u.licenseId ? licenseById.get(u.licenseId) : undefined
        const cost = u.billingEnabled && license ? effectiveLicensePrice(data, partner.id, license.id) : null
        return {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          status: u.status,
          statusCode: u.statusCode,
          licenseId: license?.id ?? null,
          licenseCode: license?.code ?? null,
          licenseName: license?.name ?? null,
          cost,
        }
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    return {
      currency: partner.currency,
      kpis: {
        activeUsers: users.length,
        licensedUsers: users.filter((u) => u.licenseId !== null).length,
        licenseTypes: licenses.length,
        monthlyCost: summary.totals.monthlyCost,
      },
      licenses,
      roster,
    }
  })

  /* ---- partner portal: invoices ---- */
  api.register('GET', '/portal/invoices', () => {
    const { partner } = requirePartnerAdmin()
    return store.data.invoices
      .filter((i) => i.partnerId === partner.id && i.status !== 'draft')
      .sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt))
      .map(invoiceRow)
  })

  api.register('GET', '/portal/invoices/:id', ({ path }) => {
    const { partner } = requirePartnerAdmin()
    const invoice = ownInvoice(partner.id, path.id as string)
    return {
      ...invoiceRow(invoice),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      vatRate: invoice.vatRate,
      notes: invoice.notes,
      paidAt: invoice.paidAt,
      voidedAt: invoice.voidedAt,
      disputedAt: invoice.disputedAt,
      disputeReason: invoice.disputeReason,
      lines: linesOf(store.data, invoice.id).map((l) => ({ id: l.id, kind: l.kind, description: l.description, amount: l.amount })),
      partner: { name: partner.name, legalName: partner.legalName },
      canDispute: canDispute(invoice),
    }
  })

  api.register('POST', '/portal/invoices/:id/dispute', ({ path, body }) => {
    const { partner } = requirePartnerAdmin()
    const invoice = ownInvoice(partner.id, path.id as string)
    const raw = (body as { reason?: unknown } | null)?.reason
    const reason = typeof raw === 'string' ? raw.trim() : ''
    if (reason.length < 3) throw DemoApiError.validation({ reason: 'Enter at least 3 characters.' })
    if (reason.length > 2000) throw DemoApiError.validation({ reason: 'Keep it under 2000 characters.' })
    if (!canDispute(invoice)) throw new DemoApiError(409, 'invoice_not_disputable')

    // The status stays as it is: a dispute is a flag the accountant sees as a banner.
    const at = nowIso()
    invoice.disputedAt = invoice.disputedAt ?? at
    invoice.disputeReason = reason
    invoice.updatedAt = at
    writeSystemLog({
      level: 'info',
      source: 'portal.invoice',
      message: `Invoice ${invoice.invoiceNumber} disputed by the partner`,
      partnerId: partner.id,
      context: { invoiceId: invoice.id },
    })
    emitChanged('invoices', 'dashboards', 'system-logs', 'reports')
    return invoiceRow(invoice)
  })

  /* ---- partner portal: points meter ---- */
  api.register('GET', '/portal/points', () => {
    const { partner } = requirePartnerAdmin()
    const data = store.data
    const today = now()
    const { year, month } = periodOf(today)
    const usage = periodUsage(data, partner.id, year, month)
    const next = addMonths(year, month, 1)
    const billablePoints = round2(usage.chargeablePoints + usage.adjustmentDebitPoints - usage.adjustmentCreditPoints)

    return {
      currency: partner.currency,
      current: {
        year,
        month,
        allowance: usage.allowance,
        freeUsed: usage.freeUsed,
        freeUsedPct: usage.freeUsedPct,
        remaining: usage.remaining,
        resetOn: `${next.year}-${String(next.month).padStart(2, '0')}-01`,
        billable: { points: billablePoints, rate: usage.ratePerPoint, amount: round2(usage.chargeableAmount + usage.adjustments) },
      },
      history: usageHistory(data, partner.id, today, 12).map((u) => ({
        year: u.year,
        month: u.month,
        allowance: u.allowance,
        used: u.usedPoints,
        freeUsed: u.freeUsed,
        billablePoints: round2(u.chargeablePoints + u.adjustmentDebitPoints - u.adjustmentCreditPoints),
        rate: u.ratePerPoint,
        cost: round2(u.chargeableAmount + u.adjustments),
      })),
    }
  })

  /* ---- finance reports ---- */
  api.register('GET', '/reports/payments', ({ params }) => {
    requireStaff('accountant')
    const year = validYear(params.year)
    const month = validMonth(params.month, false)
    const data = store.data

    const paid = data.invoices.filter((i) => i.status === 'paid' && i.paidAt && inPeriod(i.paidAt, year, month ?? periodOf(i.paidAt).month))
    const byPartner = new Map<string, { paid: number; invoiceCount: number }>()
    for (const invoice of paid) {
      const row = byPartner.get(invoice.partnerId) ?? { paid: 0, invoiceCount: 0 }
      row.paid = round2(row.paid + invoice.total)
      row.invoiceCount += 1
      byPartner.set(invoice.partnerId, row)
    }

    const rows = [...byPartner.entries()]
      .map(([partnerId, value]) => {
        const partner = data.partners.find((p) => p.id === partnerId)
        return { partnerId, partnerName: partner?.name ?? partnerId, currency: (partner?.currency ?? 'GEL') as Currency, ...value }
      })
      .sort((a, b) => b.paid - a.paid)

    const totals = new Map<Currency, { paid: number; invoiceCount: number }>()
    for (const invoice of paid) {
      const t = totals.get(invoice.currency) ?? { paid: 0, invoiceCount: 0 }
      t.paid = round2(t.paid + invoice.total)
      t.invoiceCount += 1
      totals.set(invoice.currency, t)
    }

    return {
      year,
      month,
      totals: [...totals.entries()].map(([currency, t]) => ({ currency, ...t })).sort((a, b) => b.paid - a.paid),
      rows,
    }
  })

  api.register('GET', '/reports/unused-allowance', ({ params }) => {
    requireStaff('accountant')
    const current = periodOf(now())
    const year = params.year ? validYear(params.year) : current.year
    const month = (params.month ? validMonth(params.month, true) : null) ?? current.month
    const data = store.data

    const rows = data.partners
      .filter((p) => p.isActive && !p.deletedAt)
      .map((partner) => {
        const usage = periodUsage(data, partner.id, year, month)
        const unused = round2(Math.max(0, usage.allowance - usage.freeUsed))
        return {
          partnerId: partner.id,
          partnerName: partner.name,
          currency: partner.currency,
          allowance: usage.allowance,
          used: usage.freeUsed,
          unused,
          ratePerPoint: usage.ratePerPoint,
          equivalent: round2(unused * usage.ratePerPoint),
        }
      })
      .sort((a, b) => b.equivalent - a.equivalent)

    const totals = new Map<Currency, { unused: number; equivalent: number }>()
    for (const row of rows) {
      const t = totals.get(row.currency) ?? { unused: 0, equivalent: 0 }
      t.unused = sum([t.unused, row.unused])
      t.equivalent = sum([t.equivalent, row.equivalent])
      totals.set(row.currency, t)
    }

    return {
      year,
      month,
      totals: [...totals.entries()].map(([currency, t]) => ({ currency, ...t })).sort((a, b) => b.equivalent - a.equivalent),
      rows,
    }
  })
}
