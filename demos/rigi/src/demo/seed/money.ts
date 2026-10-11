/**
 * Invoice templates, invoice history (built with the same billing functions
 * the accountant's "Generate" uses) and the e-mail outbox.
 */
import { buildMonthlyInvoice, computeTotals, defaultIssueDates, nextInvoiceNumber, releaseInvoiceBillables, VAT_RATE } from '@/demo/domain/billing'
import { addMonths, firstDayOfPeriod, parseIsoDate, type Period } from '@/demo/domain/dates'
import { newId } from '@/demo/domain/ids'
import { round2 } from '@/demo/domain/money'
import type { Invoice, InvoiceLineItem, TemplateBlock } from '@/types'

import { maxIso, minIso, plusHours, type SeedCtx } from './ctx'

/* ------------------------------------------------------------ templates */

const BASE_CSS = `
body { font-family: 'Instrument Sans', 'Noto Sans Georgian', system-ui, sans-serif; color: #1A1B1E; font-size: 12px; line-height: 1.5; margin: 0; }
.page { padding: 40px 48px; }
h1 { font-size: 26px; margin: 0; letter-spacing: -0.02em; }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5D6067; margin: 24px 0 6px; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2A7A2E; padding-bottom: 16px; }
.parties { display: flex; gap: 48px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th { text-align: left; font-weight: 600; border-bottom: 1px solid #1A1B1E; padding: 6px 4px; }
td { border-bottom: 1px solid #E2E2DC; padding: 6px 4px; vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.totals { width: 280px; margin-left: auto; margin-top: 16px; }
.totals .grand td { font-weight: 700; border-bottom: 3px double #1A1B1E; }
.notes { margin-top: 24px; color: #5D6067; }
footer { margin-top: 32px; padding-top: 12px; border-top: 1px dashed #5D6067; color: #5D6067; }
`.trim()

const LINES_TABLE = `<table class="lines">
  <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
  <tbody>
    {{#lineItems}}<tr><td>{{description}}</td><td class="num">{{quantityNumerator}} / {{quantityDenominator}}</td><td class="num">{{unitPriceFmt}}</td><td class="num">{{amountFmt}}</td></tr>{{/lineItems}}
    {{^lineItems}}<tr><td colspan="4">No line items.</td></tr>{{/lineItems}}
  </tbody>
  <tfoot><tr><td colspan="3">Line items subtotal</td><td class="num">{{totals.lineItemsSubtotalFmt}}</td></tr></tfoot>
</table>`

const TASKS_TABLE = `{{#hasTasks}}
<h3>Tasks billed</h3>
<table class="tasks">
  <thead><tr><th>Task</th><th>Type</th><th>Finished</th><th class="num">Points</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
  <tbody>{{#tasks}}<tr><td>{{title}}</td><td>{{templateName}}</td><td>{{finishedAtFmt}}</td><td class="num">{{totalPointsFmt}}</td><td class="num">{{rateFmt}}</td><td class="num">{{grossAmountFmt}}</td></tr>{{/tasks}}</tbody>
  <tfoot>
    <tr><td colspan="5">Total ({{taskBilling.totalPointsFmt}} pts)</td><td class="num">{{taskBilling.grossAmountFmt}}</td></tr>
    <tr><td colspan="5">Free allowance ({{taskBilling.freePointsFmt}} pts)</td><td class="num">-{{taskBilling.freeDeductionAmountFmt}}</td></tr>
    <tr><td colspan="5">Tasks subtotal</td><td class="num">{{taskBilling.subtotalFmt}}</td></tr>
  </tfoot>
</table>
{{/hasTasks}}`

const TOTALS = `<table class="totals">
  <tr><td>Subtotal</td><td class="num">{{totals.subtotalFmt}}</td></tr>
  <tr><td>VAT 18%</td><td class="num">{{totals.taxFmt}}</td></tr>
  <tr class="grand"><td>{{totals.totalLabel}}</td><td class="num">{{totals.totalFmt}}</td></tr>
</table>`

const BANK = `{{#billing.show}}<footer>{{billing.accountHolder}} · {{billing.address}}<br>{{billing.bankName}} · IBAN <span class="mono">{{billing.iban}}</span> · SWIFT <span class="mono">{{billing.swift}}</span>{{#billing.notes}}<br>{{billing.notes}}{{/billing.notes}}</footer>{{/billing.show}}`

const STANDARD_HTML = `<div class="page">
<header class="head">
  <div><h1>Invoice</h1><div class="mono">{{invoice.invoiceNumber}}</div></div>
  <div style="text-align:right"><strong>{{billing.accountHolder}}</strong><br>{{billing.address}}</div>
</header>
<section class="parties">
  <div><h3>Bill to</h3><strong>{{partner.legalName}}</strong><br>{{partner.name}}<br>{{partner.billingEmail}}</div>
  <div><h3>Details</h3>{{invoice.title}}<br>Period: {{invoice.periodLabel}} ({{invoice.periodStartFmt}} - {{invoice.periodEndFmt}})<br>Issued: {{invoice.issuedAtFmt}}<br>Due: {{invoice.dueAtFmt}}</div>
</section>
<h3>Services</h3>
${LINES_TABLE}
${TASKS_TABLE}
${TOTALS}
{{#invoice.notes}}<p class="notes">{{invoice.notes}}</p>{{/invoice.notes}}
${BANK}
<p class="notes">Generated {{generatedAtFmt}}</p>
</div>`

const COMPACT_HTML = `<div class="page compact">
<table class="meta"><tr>
  <td><h1>{{partner.name}}</h1>{{partner.legalName}}</td>
  <td class="num"><span class="mono">{{invoice.invoiceNumber}}</span><br>{{invoice.periodLabel}}<br>Due {{invoice.dueAtFmt}}</td>
</tr></table>
${LINES_TABLE}
${TASKS_TABLE}
${TOTALS}
${BANK}
</div>`

const COMPACT_CSS = `${BASE_CSS}
.compact h1 { font-size: 20px; }
.meta td { border: 0; }`

const MZEO_HTML = `<div class="page">
<header class="head">
  <div><h1>ანგარიშ-ფაქტურა / Invoice</h1><div class="mono">{{invoice.invoiceNumber}}</div></div>
  <div style="text-align:right">Procurement ref. <span class="mono">MZ-PROC-0042</span><br>Cost centre: Contact centre</div>
</header>
<section class="parties">
  <div><h3>მყიდველი / Buyer</h3><strong>{{partner.legalName}}</strong><br>{{partner.billingEmail}}</div>
  <div><h3>პერიოდი / Period</h3>{{invoice.periodStartFmt}} - {{invoice.periodEndFmt}}<br>გადახდის ვადა / Due: {{invoice.dueAtFmt}}</div>
</section>
${LINES_TABLE}
${TASKS_TABLE}
${TOTALS}
${BANK}
<p class="notes">Please quote the invoice number on the payment order.</p>
</div>`

const STANDARD_BLOCKS: TemplateBlock[] = [
  { id: 'blk_1', type: 'text', props: { text: 'Invoice {{invoice.invoiceNumber}}', size: 26, weight: 700, align: 'left' } },
  { id: 'blk_2', type: 'text', props: { text: '{{billing.accountHolder}}\n{{billing.address}}', size: 12, weight: 400, align: 'right' } },
  { id: 'blk_3', type: 'divider', props: { color: '#2A7A2E', thickness: 3 } },
  { id: 'blk_4', type: 'text', props: { text: 'Bill to: {{partner.legalName}} ({{partner.name}})\nPeriod: {{invoice.periodLabel}}\nIssued {{invoice.issuedAtFmt}} · Due {{invoice.dueAtFmt}}', size: 12, weight: 400, align: 'left' } },
  { id: 'blk_5', type: 'spacer', props: { height: 16 } },
  { id: 'blk_6', type: 'line-items', props: { showQuantity: true } },
  { id: 'blk_7', type: 'tasks', props: { showRate: true } },
  { id: 'blk_8', type: 'totals', props: { align: 'right' } },
  { id: 'blk_9', type: 'notes', props: { label: 'Notes' } },
  { id: 'blk_10', type: 'text', props: { text: '{{billing.bankName}} · IBAN {{billing.iban}} · SWIFT {{billing.swift}}', size: 11, weight: 400, align: 'left' } },
  { id: 'blk_11', type: 'page-number', props: { align: 'right' } },
]

function seedTemplates(ctx: SeedCtx): { mzeoTemplateId: string } {
  const created = ctx.at(-400, 11, 0)
  ctx.data.invoiceTemplates.push(
    { id: newId('itpl_'), name: 'Standard', partnerId: null, mode: 'blocks', html: STANDARD_HTML, css: BASE_CSS, layout: STANDARD_BLOCKS, signatureDataUrl: null, isDefault: true, createdAt: created, updatedAt: ctx.ago(35) },
    { id: newId('itpl_'), name: 'Compact (HTML)', partnerId: null, mode: 'html', html: COMPACT_HTML, css: COMPACT_CSS, layout: [], signatureDataUrl: null, isDefault: false, createdAt: ctx.ago(210), updatedAt: ctx.ago(90) },
  )
  const mzeo = { id: newId('itpl_'), name: 'Mzeo Bank procurement format', partnerId: 'prt_mzeo', mode: 'html' as const, html: MZEO_HTML, css: BASE_CSS, layout: [], signatureDataUrl: null, isDefault: true, createdAt: ctx.ago(180), updatedAt: ctx.ago(60) }
  ctx.data.invoiceTemplates.push(mzeo)
  return { mzeoTemplateId: mzeo.id }
}

/* ------------------------------------------------------------- invoices */

const MONTHLY_ORDER = ['prt_zemo', 'prt_kolkheti', 'prt_batumiwave', 'prt_mzeo', 'prt_lukma', 'prt_talgha', 'prt_alvani', 'prt_vake', 'prt_ruisi']

interface AdhocSeed {
  partnerId: string
  period: number
  frac: number
  title: string
  lines: Array<[description: string, quantity: number, unitPrice: number]>
  status: 'draft' | 'paid'
  vatInclusive: boolean
  notes: string
}

const ADHOC: readonly AdhocSeed[] = [
  { partnerId: 'prt_vake', period: -4, frac: 0.15, title: 'Set-up fee: cloud tenant and number provisioning', lines: [['Cloud tenant set-up', 1, 450], ['Number provisioning', 3, 40]], status: 'paid', vatInclusive: false, notes: 'One-off, as agreed in the order form.' },
  { partnerId: 'prt_lukma', period: -3, frac: 0.5, title: 'On-site training day for supervisors', lines: [['Training day (8 hours)', 1, 600], ['Printed training materials', 12, 8]], status: 'paid', vatInclusive: true, notes: '' },
  { partnerId: 'prt_alvani', period: -2, frac: 0.3, title: 'Hardware: IP desk phones and headsets', lines: [['IP desk phone', 10, 165], ['Binaural headset', 10, 48]], status: 'paid', vatInclusive: false, notes: 'Delivered to the claims office, 2nd floor.' },
  { partnerId: 'prt_kolkheti', period: 0, frac: 0.4, title: 'SIP migration services', lines: [['SIP trunk migration (engineer days)', 3, 350], ['After-hours cut-over window', 1, 200]], status: 'draft', vatInclusive: false, notes: '' },
]

export function seedMoney(ctx: SeedCtx): void {
  const { data, rng } = ctx
  const { mzeoTemplateId } = seedTemplates(ctx)
  const issue = (inv: Invoice, issuedAt: string, dueAt: string) => {
    inv.status = 'issued'
    inv.issuedAt = issuedAt
    inv.dueAt = dueAt
    inv.updatedAt = ctx.clamp(maxIso(issuedAt, inv.createdAt))
  }
  const pay = (inv: Invoice, paidAt: string) => {
    inv.status = 'paid'
    inv.paidAt = ctx.clamp(paidAt)
    inv.updatedAt = inv.paidAt
  }
  const generatedOn = (p: Period) => {
    const next = addMonths(p.year, p.month, 1)
    const d = parseIsoDate(firstDayOfPeriod(next.year, next.month))
    d.setHours(2, rng.int(0, 9), rng.int(0, 59))
    return ctx.clamp(d)
  }
  const monthly = (partnerId: string, n: number, vatInclusive = false) => {
    const p = ctx.period(n)
    return buildMonthlyInvoice(data, partnerId, p.year, p.month, {
      templateId: partnerId === 'prt_mzeo' ? mzeoTemplateId : null,
      at: generatedOn(p),
      vatInclusive,
    }).invoice
  }
  const statusFor = (partnerId: string, n: number): 'paid' | 'skip' | 'special' => {
    if (partnerId === 'prt_ruisi') return n <= -5 ? 'paid' : 'skip'
    if (partnerId === 'prt_vake' && n < -4) return 'skip'
    if (n < -5) return 'skip'
    if (n === -1 || (n === -2 && partnerId === 'prt_talgha') || (n === -3 && partnerId === 'prt_lukma')) return 'special'
    return n <= -2 ? 'paid' : 'skip'
  }

  for (let n = -6; n <= 0; n += 1) {
    const p = ctx.period(n)
    // Ad-hoc invoices created during this period.
    for (const a of ADHOC.filter((x) => x.period === n)) {
      const partner = data.partners.find((x) => x.id === a.partnerId)
      if (!partner) continue
      const createdAt = ctx.inPeriod(n, a.frac)
      const invoice: Invoice = {
        id: newId('inv_'), partnerId: a.partnerId, invoiceNumber: nextInvoiceNumber(data, p.year, p.month), kind: 'adhoc', title: a.title,
        periodYear: p.year, periodMonth: p.month, status: 'draft', currency: partner.currency, subtotal: 0, tax: 0, total: 0,
        vatInclusive: a.vatInclusive, vatRate: VAT_RATE, notes: a.notes, issuedAt: null, dueAt: null, paidAt: null, voidedAt: null, voidReason: null,
        disputedAt: null, disputeReason: null, templateId: null, createdAt, updatedAt: createdAt,
      }
      const lines: InvoiceLineItem[] = a.lines.map(([description, quantity, unitPrice], i) => ({
        id: newId('line_'), invoiceId: invoice.id, kind: 'adhoc', description, quantityNumerator: quantity, quantityDenominator: 1, unitPrice, amount: round2(quantity * unitPrice), sortOrder: i + 1, metadata: {},
      }))
      Object.assign(invoice, computeTotals(lines, invoice.vatInclusive, invoice.vatRate))
      data.invoices.push(invoice)
      data.invoiceLines.push(...lines)
      if (a.status === 'paid') {
        const issuedAt = plusHours(createdAt, 2)
        issue(invoice, issuedAt, plusHours(issuedAt, 24 * 14))
        pay(invoice, plusHours(issuedAt, 24 * (6 + rng.int(0, 8))))
      }
    }
    // Monthly invoices for this period (drafted on the 1st of the next month).
    if (n === 0) continue
    for (const partnerId of MONTHLY_ORDER) {
      const mode = statusFor(partnerId, n)
      if (mode === 'skip') continue
      if (mode === 'paid') {
        const inv = monthly(partnerId, n)
        const d = defaultIssueDates(inv)
        issue(inv, d.issuedAt, d.dueAt)
        pay(inv, plusHours(d.issuedAt, 24 * (5 + rng.int(0, 13))))
        continue
      }
      // Special cases.
      if (partnerId === 'prt_lukma' && n === -3) {
        const wrong = monthly(partnerId, n, true)
        const d = defaultIssueDates(wrong)
        issue(wrong, d.issuedAt, d.dueAt)
        wrong.status = 'void'
        wrong.voidedAt = ctx.clamp(plusHours(d.issuedAt, 24 * 3 + 2))
        wrong.voidReason = 'Issued with VAT included by mistake; replaced by a corrected invoice.'
        wrong.updatedAt = wrong.voidedAt
        releaseInvoiceBillables(data, wrong.id)
        const fixed = monthly(partnerId, n)
        fixed.createdAt = plusHours(wrong.voidedAt, 1)
        const issuedAt = plusHours(wrong.voidedAt, 2)
        issue(fixed, issuedAt, plusHours(issuedAt, 24 * 14))
        fixed.notes = `Replaces ${wrong.invoiceNumber}.`
        pay(fixed, plusHours(issuedAt, 24 * 9))
        continue
      }
      if (partnerId === 'prt_talgha' && n === -2) {
        const inv = monthly(partnerId, n)
        const d = defaultIssueDates(inv)
        issue(inv, d.issuedAt, d.dueAt)
        inv.notes = 'Contract renewal pending; billed at the current price list.'
        continue
      }
      if (n !== -1) continue
      if (partnerId === 'prt_zemo') {
        const inv = monthly(partnerId, n)
        const d = defaultIssueDates(inv)
        // Still pending: if the default due date is (nearly) past, the accountant gave extra days.
        const soon = new Date(ctx.now.getTime() + 3 * 86_400_000).toISOString()
        issue(inv, d.issuedAt, d.dueAt < soon ? new Date(ctx.now.getTime() + 6 * 86_400_000).toISOString() : d.dueAt)
      } else if (partnerId === 'prt_mzeo') {
        const inv = monthly(partnerId, n)
        const d = defaultIssueDates(inv)
        issue(inv, d.issuedAt, d.dueAt)
        inv.disputedAt = ctx.clamp(new Date(d.issuedAt).getTime() + (ctx.now.getTime() - new Date(d.issuedAt).getTime()) * 0.6)
        inv.disputeReason = 'Four Agent Pro users were disabled mid-month. Please confirm they are not billed after their leave dates before we approve payment.'
        inv.updatedAt = inv.disputedAt
      } else if (partnerId === 'prt_kolkheti') {
        const inv = monthly(partnerId, n)
        const d = defaultIssueDates(inv)
        issue(inv, d.issuedAt, d.dueAt)
        pay(inv, minIso(plusHours(d.issuedAt, 24 * 5), ctx.ago(0.5)))
      } else if (partnerId === 'prt_lukma' || partnerId === 'prt_talgha') {
        monthly(partnerId, n)
      }
    }
  }

  /* ---------------------------------------------------------------- outbox */
  const byNumberOf = (partnerId: string, n: number, kind: Invoice['kind'] = 'monthly') => {
    const p = ctx.period(n)
    return data.invoices.find((i) => i.partnerId === partnerId && i.periodYear === p.year && i.periodMonth === p.month && i.kind === kind && i.status !== 'void')
  }
  const send = (inv: Invoice | undefined, subject: string, at: string) => {
    if (!inv) return
    const partner = data.partners.find((x) => x.id === inv.partnerId)
    data.outbox.push({
      id: newId('out_'),
      invoiceId: inv.id,
      to: partner?.billingEmails.slice(0, 2) ?? [],
      cc: partner?.contacts.filter((c) => c.role === 'financial').map((c) => c.email) ?? [],
      subject,
      sentAt: ctx.clamp(at),
      sentByName: 'Levan Abashidze',
    })
  }
  const after = (inv: Invoice | undefined, hours: number) => plusHours(maxIso(inv?.issuedAt ?? ctx.ago(1), inv?.createdAt ?? ctx.ago(1)), hours)
  const lukmaP2 = byNumberOf('prt_lukma', -2)
  const alvaniHw = data.invoices.find((i) => i.partnerId === 'prt_alvani' && i.kind === 'adhoc')
  const talghaP2 = byNumberOf('prt_talgha', -2)
  const zemoP1 = byNumberOf('prt_zemo', -1)
  const mzeoP1 = byNumberOf('prt_mzeo', -1)
  const kolkhetiP1 = byNumberOf('prt_kolkheti', -1)
  send(lukmaP2, `Invoice ${lukmaP2?.invoiceNumber} from Rigi`, after(lukmaP2, 26))
  send(alvaniHw, `Invoice ${alvaniHw?.invoiceNumber} from Rigi`, after(alvaniHw, 1))
  send(talghaP2, `Invoice ${talghaP2?.invoiceNumber} from Rigi`, after(talghaP2, 30))
  send(talghaP2, `Reminder: invoice ${talghaP2?.invoiceNumber} is overdue`, ctx.ago(4))
  send(zemoP1, `Invoice ${zemoP1?.invoiceNumber} from Rigi`, after(zemoP1, 27))
  send(mzeoP1, `Invoice ${mzeoP1?.invoiceNumber} from Rigi`, after(mzeoP1, 27.5))
  send(kolkhetiP1, `Invoice ${kolkhetiP1?.invoiceNumber} from Rigi`, after(kolkhetiP1, 28))
  data.outbox.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}
