/**
 * The render context every invoice template sees, and the token catalogue
 * the editor offers. `buildInvoiceView` maps a stored invoice; the sample
 * view feeds the editor's live preview.
 */
import { linesOf, tasksBilled } from '@/demo/domain/billing'
import { firstDayOfPeriod, lastDayOfPeriod } from '@/demo/domain/dates'
import { round2 } from '@/demo/domain/money'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPeriod, formatTaskNumber } from '@/lib/format'
import type { BillingDetails, Currency, DemoData, Invoice, InvoiceLineItem, Partner } from '@/types'

export type DocLang = 'en' | 'ka'

/** Labels printed by the generated (block) layout. Templates written by hand carry their own words. */
export const DOC_LABELS = {
  en: {
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit price',
    amount: 'Amount',
    noLines: 'No line items.',
    lineItemsSubtotal: 'Line items subtotal',
    tasksBilled: 'Tasks billed',
    task: 'Task',
    type: 'Type',
    finished: 'Finished',
    points: 'Points',
    rate: 'Rate',
    totalPoints: 'Total',
    freeAllowance: 'Free allowance',
    tasksSubtotal: 'Tasks subtotal',
    subtotal: 'Subtotal',
    vat: 'VAT 18%',
    totalIncl: 'Total (incl. VAT)',
    totalExcl: 'Total (excl. VAT)',
    notes: 'Notes',
    page: 'Page',
    of: 'of',
    pts: 'pts',
    signature: 'Authorised signature',
  },
  ka: {
    description: 'აღწერა',
    qty: 'რაოდ.',
    unitPrice: 'ერთ. ფასი',
    amount: 'თანხა',
    noLines: 'პოზიციები არ არის.',
    lineItemsSubtotal: 'პოზიციების ჯამი',
    tasksBilled: 'ანგარიშში შესული ამოცანები',
    task: 'ამოცანა',
    type: 'ტიპი',
    finished: 'დასრულდა',
    points: 'ქულა',
    rate: 'ტარიფი',
    totalPoints: 'სულ',
    freeAllowance: 'უფასო ლიმიტი',
    tasksSubtotal: 'ამოცანების ჯამი',
    subtotal: 'ჯამი',
    vat: 'დღგ 18%',
    totalIncl: 'სულ (დღგ-ს ჩათვლით)',
    totalExcl: 'სულ (დღგ-ს გარეშე)',
    notes: 'შენიშვნა',
    page: 'გვერდი',
    of: '/',
    pts: 'ქულა',
    signature: 'უფლებამოსილი პირის ხელმოწერა',
  },
} as const

export type DocLabels = (typeof DOC_LABELS)[DocLang]

export interface InvoiceViewLine {
  description: string
  kind: string
  quantityNumerator: string
  quantityDenominator: string
  quantityFmt: string
  unitPriceFmt: string
  amountFmt: string
}

export interface InvoiceViewTask {
  number: string
  title: string
  templateName: string
  finishedAtFmt: string
  verifiedAtFmt: string
  totalPointsFmt: string
  freePointsFmt: string
  rateFmt: string
  grossAmountFmt: string
}

export interface InvoiceView {
  invoice: {
    invoiceNumber: string
    kind: string
    periodLabel: string
    periodStartFmt: string
    periodEndFmt: string
    title: string
    issuedAtFmt: string
    dueAtFmt: string
    paidAtFmt: string
    status: string
    currency: string
    notes: string
    vatInclusive: boolean
  }
  partner: { name: string; legalName: string; billingEmail: string; contactEmail: string }
  totals: {
    lineItemsSubtotalFmt: string
    tasksSubtotalFmt: string
    combinedSubtotalFmt: string
    subtotalFmt: string
    taxFmt: string
    totalFmt: string
    totalLabel: string
  }
  taskBilling: { totalPointsFmt: string; freePointsFmt: string; grossAmountFmt: string; freeDeductionAmountFmt: string; subtotalFmt: string }
  billing: BillingDetails & { show: boolean }
  lineItems: InvoiceViewLine[]
  tasks: InvoiceViewTask[]
  hasTasks: boolean
  generatedAtFmt: string
  labels: DocLabels
}

/* --------------------------------------------------------- token catalogue */

export interface TokenGroup {
  id: 'invoice' | 'partner' | 'totals' | 'taskBilling' | 'billing' | 'other' | 'sections'
  tokens: Array<{ token: string; section?: boolean }>
}

export const TOKEN_CATALOGUE: TokenGroup[] = [
  {
    id: 'invoice',
    tokens: ['invoiceNumber', 'periodLabel', 'periodStartFmt', 'periodEndFmt', 'title', 'issuedAtFmt', 'dueAtFmt', 'paidAtFmt', 'status', 'currency', 'notes'].map(
      (k) => ({ token: `invoice.${k}` }),
    ),
  },
  { id: 'partner', tokens: ['name', 'legalName', 'billingEmail', 'contactEmail'].map((k) => ({ token: `partner.${k}` })) },
  {
    id: 'totals',
    tokens: ['lineItemsSubtotalFmt', 'tasksSubtotalFmt', 'combinedSubtotalFmt', 'totalFmt', 'totalLabel'].map((k) => ({ token: `totals.${k}` })),
  },
  {
    id: 'taskBilling',
    tokens: ['totalPointsFmt', 'freePointsFmt', 'grossAmountFmt', 'freeDeductionAmountFmt', 'subtotalFmt'].map((k) => ({ token: `taskBilling.${k}` })),
  },
  { id: 'billing', tokens: ['bankName', 'accountHolder', 'iban', 'swift', 'address', 'notes'].map((k) => ({ token: `billing.${k}` })) },
  { id: 'other', tokens: [{ token: 'generatedAtFmt' }, { token: 'signature', section: true }] },
  {
    id: 'sections',
    tokens: [
      { token: 'lineItems', section: true },
      { token: 'tasks', section: true },
      { token: 'hasTasks', section: true },
      { token: 'billing.show', section: true },
    ],
  },
]

/** Fields available inside `{{#lineItems}}` and `{{#tasks}}`. */
export const ROW_FIELDS = {
  lineItems: ['description', 'quantityFmt', 'quantityNumerator', 'quantityDenominator', 'unitPriceFmt', 'amountFmt'],
  tasks: ['number', 'title', 'templateName', 'finishedAtFmt', 'totalPointsFmt', 'rateFmt', 'grossAmountFmt'],
} as const

/** What gets inserted for a catalogue entry. */
export function tokenSnippet(token: string, section = false): string {
  if (token === 'signature') return '{{#signature}}<img src="{{{signature}}}" alt="" style="width:240px;height:80px;object-fit:contain">{{/signature}}'
  if (!section) return `{{${token}}}`
  const rows = token === 'lineItems' ? ROW_FIELDS.lineItems : token === 'tasks' ? ROW_FIELDS.tasks : []
  const inner = rows.length ? rows.slice(0, 3).map((f) => `{{${f}}}`).join(' · ') : ''
  return `{{#${token}}}${inner}{{/${token}}}`
}

/* ------------------------------------------------------------- builders */

const TASK_LIKE = new Set(['points_overflow', 'discount'])

function money(n: number, currency: Currency): string {
  return formatMoney(n, currency)
}

function qty(line: Pick<InvoiceLineItem, 'quantityNumerator' | 'quantityDenominator'>): string {
  if (line.quantityDenominator === 1) return formatNumber(line.quantityNumerator)
  return `${formatNumber(line.quantityNumerator)} / ${formatNumber(line.quantityDenominator)}`
}

function viewLine(line: InvoiceLineItem, currency: Currency): InvoiceViewLine {
  return {
    description: line.description,
    kind: line.kind,
    quantityNumerator: formatNumber(line.quantityNumerator),
    quantityDenominator: formatNumber(line.quantityDenominator),
    quantityFmt: qty(line),
    unitPriceFmt: money(line.unitPrice, currency),
    amountFmt: money(line.amount, currency),
  }
}

function billingOf(billing: BillingDetails): InvoiceView['billing'] {
  const show = Boolean(billing.bankName || billing.iban || billing.accountHolder)
  return { ...billing, show }
}

const pts = (n: number): string => formatNumber(n, { maximumFractionDigits: 2 })

/** Map a stored invoice to the template context. */
export function buildInvoiceView(data: DemoData, invoice: Invoice, lang: DocLang, at: Date = new Date()): InvoiceView {
  const partner = data.partners.find((p) => p.id === invoice.partnerId)
  const currency = invoice.currency
  const labels = DOC_LABELS[lang]
  const lines = linesOf(data, invoice.id).slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const visible = lines.filter((l) => !TASK_LIKE.has(l.kind))
  const lineItemsSubtotal = round2(visible.reduce((acc, l) => acc + l.amount, 0))
  const billed = tasksBilled(data, invoice)
  const tasksSubtotal = round2(billed.net)
  return {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      kind: invoice.kind,
      periodLabel: invoice.kind === 'adhoc' && invoice.title ? invoice.title : formatPeriod(invoice.periodYear, invoice.periodMonth),
      periodStartFmt: formatDate(firstDayOfPeriod(invoice.periodYear, invoice.periodMonth)),
      periodEndFmt: formatDate(lastDayOfPeriod(invoice.periodYear, invoice.periodMonth)),
      title: invoice.title ?? formatPeriod(invoice.periodYear, invoice.periodMonth),
      issuedAtFmt: invoice.issuedAt ? formatDate(invoice.issuedAt) : '—',
      dueAtFmt: invoice.dueAt ? formatDate(invoice.dueAt) : '—',
      paidAtFmt: invoice.paidAt ? formatDate(invoice.paidAt) : '',
      status: invoice.status,
      currency,
      notes: invoice.notes,
      vatInclusive: invoice.vatInclusive,
    },
    partner: partnerView(partner),
    totals: {
      lineItemsSubtotalFmt: money(lineItemsSubtotal, currency),
      tasksSubtotalFmt: money(tasksSubtotal, currency),
      combinedSubtotalFmt: money(round2(lineItemsSubtotal + tasksSubtotal), currency),
      subtotalFmt: money(invoice.subtotal, currency),
      taxFmt: money(invoice.tax, currency),
      totalFmt: money(invoice.total, currency),
      totalLabel: invoice.vatInclusive ? labels.totalIncl : labels.totalExcl,
    },
    taskBilling: {
      totalPointsFmt: pts(billed.totalPoints),
      freePointsFmt: pts(billed.freePoints),
      grossAmountFmt: money(billed.grossAmount, currency),
      freeDeductionAmountFmt: money(billed.freeDeductionAmount, currency),
      subtotalFmt: money(tasksSubtotal, currency),
    },
    billing: billingOf(data.settings.billing),
    lineItems: visible.map((l) => viewLine(l, currency)),
    tasks: billed.rows.map((r) => ({
      number: formatTaskNumber(r.number),
      title: r.title,
      templateName: r.template ?? '—',
      finishedAtFmt: r.finishedAt ? formatDate(r.finishedAt) : '—',
      verifiedAtFmt: r.verifiedAt ? formatDate(r.verifiedAt) : '—',
      totalPointsFmt: pts(r.points),
      freePointsFmt: pts(r.freePoints),
      rateFmt: money(r.rate, currency),
      grossAmountFmt: money(r.amount, currency),
    })),
    hasTasks: billed.rows.length > 0,
    generatedAtFmt: formatDateTime(at),
    labels,
  }
}

function partnerView(partner: Partner | undefined): InvoiceView['partner'] {
  return {
    name: partner?.name ?? '—',
    legalName: partner?.legalName ?? '—',
    billingEmail: partner?.billingEmail ?? '',
    contactEmail: partner?.contactEmail ?? '',
  }
}

/**
 * The preview context: a fictional partner shaped like Zemo Systems, the
 * Demo Bank details, three subscription lines, two tasks and VAT on top.
 */
export function buildSampleView(billing: BillingDetails, lang: DocLang, at: Date = new Date()): InvoiceView {
  const currency: Currency = 'GEL'
  const labels = DOC_LABELS[lang]
  const year = at.getMonth() === 0 ? at.getFullYear() - 1 : at.getFullYear()
  const month = at.getMonth() === 0 ? 12 : at.getMonth()
  const lines = [
    { description: 'Agent seat — Voice (per user)', n: 1240, d: 31, unit: 45 },
    { description: 'Supervisor seat — Omnichannel (per user)', n: 186, d: 31, unit: 70 },
    { description: 'Call recording & QA add-on', n: 1, d: 1, unit: 320 },
  ].map((l) => {
    const amount = round2((l.unit * l.n) / l.d)
    return { description: l.description, kind: 'subscription', quantityNumerator: formatNumber(l.n), quantityDenominator: formatNumber(l.d), quantityFmt: l.d === 1 ? formatNumber(l.n) : `${formatNumber(l.n)} / ${formatNumber(l.d)}`, unitPriceFmt: money(l.unit, currency), amountFmt: money(amount, currency), amount }
  })
  const rate = 20
  const tasks = [
    { number: 1187, title: 'IVR change: holiday greeting for the main hotline', template: 'IVR change', points: 4, free: 4 },
    { number: 1203, title: 'New queue for the collections team', template: 'New queue', points: 8, free: 6 },
  ]
  const totalPoints = tasks.reduce((a, t) => a + t.points, 0)
  const freePoints = tasks.reduce((a, t) => a + t.free, 0)
  const gross = totalPoints * rate
  const deduction = freePoints * rate
  const tasksSubtotal = gross - deduction
  const lineSum = round2(lines.reduce((a, l) => a + l.amount, 0))
  const combined = round2(lineSum + tasksSubtotal)
  const tax = round2(combined * 0.18)
  const finished = (daysAgo: number) => formatDate(new Date(at.getTime() - daysAgo * 86_400_000))
  return {
    invoice: {
      invoiceNumber: `INV-${year}-${String(month).padStart(2, '0')}-000142`,
      kind: 'monthly',
      periodLabel: formatPeriod(year, month),
      periodStartFmt: formatDate(firstDayOfPeriod(year, month)),
      periodEndFmt: formatDate(lastDayOfPeriod(year, month)),
      title: formatPeriod(year, month),
      issuedAtFmt: formatDate(lastDayOfPeriod(year, month)),
      dueAtFmt: formatDate(new Date(new Date(lastDayOfPeriod(year, month)).getTime() + 14 * 86_400_000)),
      paidAtFmt: '',
      status: 'issued',
      currency,
      notes: lang === 'ka' ? 'გმადლობთ თანამშრომლობისთვის.' : 'Thank you for your business.',
      vatInclusive: false,
    },
    partner: { name: 'Zemo Systems', legalName: 'შპს ზემო სისტემსი', billingEmail: 'billing@zemo.example', contactEmail: 'ops@zemo.example' },
    totals: {
      lineItemsSubtotalFmt: money(lineSum, currency),
      tasksSubtotalFmt: money(tasksSubtotal, currency),
      combinedSubtotalFmt: money(combined, currency),
      subtotalFmt: money(combined, currency),
      taxFmt: money(tax, currency),
      totalFmt: money(round2(combined + tax), currency),
      totalLabel: labels.totalExcl,
    },
    taskBilling: {
      totalPointsFmt: pts(totalPoints),
      freePointsFmt: pts(freePoints),
      grossAmountFmt: money(gross, currency),
      freeDeductionAmountFmt: money(deduction, currency),
      subtotalFmt: money(tasksSubtotal, currency),
    },
    billing: billingOf(billing),
    lineItems: lines.map(({ amount: _a, ...l }) => l),
    tasks: tasks.map((t, i) => ({
      number: formatTaskNumber(t.number),
      title: t.title,
      templateName: t.template,
      finishedAtFmt: finished(12 - i * 5),
      verifiedAtFmt: finished(11 - i * 5),
      totalPointsFmt: pts(t.points),
      freePointsFmt: pts(t.free),
      rateFmt: money(rate, currency),
      grossAmountFmt: money(t.points * rate, currency),
    })),
    hasTasks: true,
    generatedAtFmt: formatDateTime(at),
    labels,
  }
}
