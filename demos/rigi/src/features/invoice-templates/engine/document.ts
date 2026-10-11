/**
 * Blocks -> mustache HTML compiler, and the full printable document wrapper.
 * Fonts are the bundled fontsource woff2 files (served from BASE_URL by Vite),
 * so Georgian prints and nothing is fetched from another host.
 */
import georgianWoff2 from '@fontsource-variable/noto-sans-georgian/files/noto-sans-georgian-georgian-wght-normal.woff2?url'
import instrumentWoff2 from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url'
import monoWoff2 from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'

import type { TemplateBlock, TemplateBlockType, TemplateMode } from '@/types'

import { escapeHtml, renderMustache } from './mustache'
import { DOC_LABELS, type DocLang, type InvoiceView } from './view'

export interface TemplateSource {
  mode: TemplateMode
  html: string
  css: string
  layout: TemplateBlock[]
  signatureDataUrl: string | null
}

/* ------------------------------------------------------------ defaults */

export const BLOCK_TYPES: TemplateBlockType[] = ['text', 'image', 'spacer', 'divider', 'page-number', 'line-items', 'tasks', 'totals', 'notes']

export const BLOCK_DEFAULT_PROPS: Record<TemplateBlockType, TemplateBlock['props']> = {
  text: { text: '{{partner.legalName}}', size: 12, weight: 400, align: 'left' },
  image: { src: null, width: 160, align: 'left' },
  spacer: { height: 16 },
  divider: { color: '#D9D9D3', thickness: 1 },
  'page-number': { align: 'right' },
  'line-items': { showQuantity: true, showUnitPrice: true },
  tasks: { showRate: true },
  totals: { align: 'right', showTax: true },
  notes: { label: 'Notes' },
}

/** The "Swiss ledger" house look: graphite ink, hairlines, a green rule on the total. */
export const DEFAULT_CSS = `
body { font-family: 'Instrument Sans', 'Noto Sans Georgian', system-ui, sans-serif; color: #1F2124; font-size: 11.5px; line-height: 1.5; margin: 0; }
.page { padding: 44px 52px; }
h1 { font-size: 24px; margin: 0; letter-spacing: -0.02em; font-weight: 650; }
h3 { font-size: 10.5px; letter-spacing: 0.06em; color: #6A6C70; margin: 22px 0 6px; font-weight: 600; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th { text-align: left; font-weight: 600; color: #6A6C70; border-bottom: 1px solid #1F2124; padding: 6px 4px; font-size: 10.5px; }
td { border-bottom: 1px solid #E4E4DE; padding: 6px 4px; vertical-align: top; }
tfoot td { border-bottom: 0; color: #6A6C70; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.totals { width: 300px; margin-left: auto; margin-top: 18px; }
.totals td { border-bottom: 1px solid #E4E4DE; }
.totals .grand td { font-weight: 700; font-size: 13px; color: #1F2124; border-top: 2px solid #2A7A2E; border-bottom: 0; padding-top: 8px; }
.notes { margin-top: 22px; color: #6A6C70; white-space: pre-line; }
footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #D9D9D3; color: #6A6C70; }
`.trim()

export const DEFAULT_LAYOUT: TemplateBlock[] = [
  { id: 'blk_a', type: 'text', props: { text: 'Invoice {{invoice.invoiceNumber}}', size: 24, weight: 700, align: 'left' } },
  { id: 'blk_b', type: 'text', props: { text: '{{billing.accountHolder}}\n{{billing.address}}', size: 11, weight: 400, align: 'right' } },
  { id: 'blk_c', type: 'divider', props: { color: '#1F2124', thickness: 1 } },
  {
    id: 'blk_d',
    type: 'text',
    props: { text: 'Bill to: {{partner.legalName}} ({{partner.name}})\nPeriod: {{invoice.periodLabel}}\nIssued {{invoice.issuedAtFmt}} · Due {{invoice.dueAtFmt}}', size: 12, weight: 400, align: 'left' },
  },
  { id: 'blk_e', type: 'spacer', props: { height: 12 } },
  { id: 'blk_f', type: 'line-items', props: { showQuantity: true, showUnitPrice: true } },
  { id: 'blk_g', type: 'tasks', props: { showRate: true } },
  { id: 'blk_h', type: 'totals', props: { align: 'right', showTax: true } },
  { id: 'blk_i', type: 'notes', props: { label: 'Notes' } },
  { id: 'blk_j', type: 'text', props: { text: '{{billing.bankName}} · IBAN {{billing.iban}} · SWIFT {{billing.swift}}', size: 10, weight: 400, align: 'left' } },
  { id: 'blk_k', type: 'page-number', props: { align: 'right' } },
]

/* ------------------------------------------------------------ compiler */

const str = (v: unknown, fallback = ''): string => (v === null || v === undefined ? fallback : String(v))
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const align = (v: unknown): string => (v === 'center' || v === 'right' ? v : 'left')
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
/** Colours are user input that lands in a style attribute: allow hex only. */
const color = (v: unknown, fallback: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(str(v)) ? str(v) : fallback)

/** Keep `{{tokens}}` intact, escape everything else, newlines become <br>. */
function textWithTokens(text: string): string {
  return text
    .split(/(\{\{\{?[^}]*\}?\}\})/g)
    .map((part, i) => (i % 2 === 1 ? part : escapeHtml(part)))
    .join('')
    .replace(/\n/g, '<br>')
}

function compileBlock(block: TemplateBlock): string {
  const p = block.props
  switch (block.type) {
    case 'text': {
      const style = `text-align:${align(p.align)};font-size:${num(p.size, 12, 8, 48)}px;font-weight:${num(p.weight, 400, 100, 900)};margin:0 0 6px`
      return `<div class="rb-text" style="${style}">${textWithTokens(str(p.text))}</div>`
    }
    case 'image': {
      const src = str(p.src)
      if (!src.startsWith('data:image/')) return ''
      return `<div class="rb-image" style="text-align:${align(p.align)};margin:0 0 8px"><img src="${escapeHtml(src)}" alt="" style="width:${num(p.width, 160, 16, 700)}px;max-width:100%"></div>`
    }
    case 'spacer':
      return `<div class="rb-spacer" style="height:${num(p.height, 16, 0, 400)}px"></div>`
    case 'divider':
      return `<hr class="rb-divider" style="border:0;border-top:${num(p.thickness, 1, 1, 8)}px solid ${color(p.color, '#D9D9D3')};margin:10px 0">`
    case 'page-number':
      return `<div class="rb-page" style="text-align:${align(p.align)};color:#6A6C70;font-size:10px;margin-top:12px">{{labels.page}} <span class="rb-page-n">1</span> {{labels.of}} 1</div>`
    case 'line-items': {
      const q = bool(p.showQuantity, true)
      const u = bool(p.showUnitPrice, true)
      const cols = 2 + (q ? 1 : 0) + (u ? 1 : 0)
      return `<table class="lines">
<thead><tr><th>{{labels.description}}</th>${q ? '<th class="num">{{labels.qty}}</th>' : ''}${u ? '<th class="num">{{labels.unitPrice}}</th>' : ''}<th class="num">{{labels.amount}}</th></tr></thead>
<tbody>{{#lineItems}}<tr><td>{{description}}</td>${q ? '<td class="num">{{quantityFmt}}</td>' : ''}${u ? '<td class="num">{{unitPriceFmt}}</td>' : ''}<td class="num">{{amountFmt}}</td></tr>{{/lineItems}}{{^lineItems}}<tr><td colspan="${cols}">{{labels.noLines}}</td></tr>{{/lineItems}}</tbody>
<tfoot><tr><td colspan="${cols - 1}">{{labels.lineItemsSubtotal}}</td><td class="num">{{totals.lineItemsSubtotalFmt}}</td></tr></tfoot>
</table>`
    }
    case 'tasks': {
      const r = bool(p.showRate, true)
      const span = r ? 5 : 4
      return `{{#hasTasks}}<h3>{{labels.tasksBilled}}</h3>
<table class="tasks">
<thead><tr><th>{{labels.task}}</th><th>{{labels.type}}</th><th>{{labels.finished}}</th><th class="num">{{labels.points}}</th>${r ? '<th class="num">{{labels.rate}}</th>' : ''}<th class="num">{{labels.amount}}</th></tr></thead>
<tbody>{{#tasks}}<tr><td><span class="mono">{{number}}</span> {{title}}</td><td>{{templateName}}</td><td>{{finishedAtFmt}}</td><td class="num">{{totalPointsFmt}}</td>${r ? '<td class="num">{{rateFmt}}</td>' : ''}<td class="num">{{grossAmountFmt}}</td></tr>{{/tasks}}</tbody>
<tfoot>
<tr><td colspan="${span}">{{labels.totalPoints}} ({{taskBilling.totalPointsFmt}} {{labels.pts}})</td><td class="num">{{taskBilling.grossAmountFmt}}</td></tr>
<tr><td colspan="${span}">{{labels.freeAllowance}} ({{taskBilling.freePointsFmt}} {{labels.pts}})</td><td class="num">-{{taskBilling.freeDeductionAmountFmt}}</td></tr>
<tr><td colspan="${span}">{{labels.tasksSubtotal}}</td><td class="num">{{taskBilling.subtotalFmt}}</td></tr>
</tfoot>
</table>{{/hasTasks}}`
    }
    case 'totals': {
      const a = align(p.align)
      const margin = a === 'left' ? 'margin-right:auto;margin-left:0' : a === 'center' ? 'margin-left:auto;margin-right:auto' : 'margin-left:auto'
      const tax = bool(p.showTax, true)
      return `<table class="totals" style="${margin}">
<tr><td>{{labels.lineItemsSubtotal}}</td><td class="num">{{totals.lineItemsSubtotalFmt}}</td></tr>
{{#hasTasks}}<tr><td>{{labels.tasksSubtotal}}</td><td class="num">{{totals.tasksSubtotalFmt}}</td></tr>{{/hasTasks}}
${tax ? '<tr><td>{{labels.subtotal}}</td><td class="num">{{totals.subtotalFmt}}</td></tr><tr><td>{{labels.vat}}</td><td class="num">{{totals.taxFmt}}</td></tr>' : ''}
<tr class="grand"><td>{{totals.totalLabel}}</td><td class="num">{{totals.totalFmt}}</td></tr>
</table>`
    }
    case 'notes':
      return `{{#invoice.notes}}<div class="notes"><h3>${escapeHtml(str(p.label, 'Notes'))}</h3>{{invoice.notes}}</div>{{/invoice.notes}}`
    default:
      return ''
  }
}

export function compileBlocks(layout: TemplateBlock[]): string {
  return `<div class="page">\n${layout.map(compileBlock).filter(Boolean).join('\n')}\n</div>`
}

/* ------------------------------------------------------------ document */

function absolute(url: string): string {
  try {
    return typeof document === 'undefined' ? url : new URL(url, document.baseURI).href
  } catch {
    return url
  }
}

function fontFaces(): string {
  return `
@font-face { font-family: 'Noto Sans Georgian'; src: url('${absolute(georgianWoff2)}') format('woff2'); font-weight: 100 900; font-style: normal; unicode-range: U+0589, U+10A0-10FF, U+1C90-1CBA, U+1CBD-1CBF, U+2D00-2D2F; }
@font-face { font-family: 'Instrument Sans'; src: url('${absolute(instrumentWoff2)}') format('woff2'); font-weight: 400 700; font-style: normal; }
@font-face { font-family: 'JetBrains Mono'; src: url('${absolute(monoWoff2)}') format('woff2'); font-weight: 100 800; font-style: normal; }`
}

function pageCss(lang: DocLang, pageNumbers: boolean): string {
  const l = DOC_LABELS[lang]
  return `
@page { size: A4; margin: 0; }
html, body { background: #fff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
img { max-width: 100%; }
tr, img, .rb-sign { break-inside: avoid; }
.rb-sign { margin-top: 28px; width: 240px; }
.rb-sign img { display: block; width: 240px; height: 80px; object-fit: contain; }
.rb-sign div { border-top: 1px solid #1F2124; padding-top: 4px; font-size: 10px; color: #6A6C70; }
${
  pageNumbers
    ? `@media print {
  @page { margin: 0 0 12mm 0; @bottom-right { content: "${l.page} " counter(page) " ${l.of} " counter(pages); font: 9px 'Instrument Sans', 'Noto Sans Georgian', sans-serif; color: #6A6C70; margin-right: 14mm; } }
  .rb-page { visibility: hidden; }
}`
    : ''
}`
}

function signatureHtml(dataUrl: string, lang: DocLang): string {
  return `<div class="page" style="padding-top:0"><div class="rb-sign"><img src="${escapeHtml(dataUrl)}" alt=""><div>${escapeHtml(DOC_LABELS[lang].signature)}</div></div></div>`
}

/**
 * Render a template to a complete, self-contained HTML document.
 * Throws `TemplateSyntaxError` (from the mustache parser) on malformed tags.
 */
export function renderDocument(source: TemplateSource, view: InvoiceView, options: { lang: DocLang; title: string }): string {
  const signature = source.signatureDataUrl && source.signatureDataUrl.startsWith('data:image/') ? source.signatureDataUrl : ''
  const body = source.mode === 'blocks' ? compileBlocks(source.layout) : source.html
  let rendered = renderMustache(body, { ...view, signature })
  const handlesSignature = source.mode === 'html' && /\{\{\{?\s*[#^&]?\s*signature\b/.test(source.html)
  if (signature && !handlesSignature) rendered += signatureHtml(signature, options.lang)
  const pageNumbers = source.mode === 'blocks' ? source.layout.some((b) => b.type === 'page-number') : /rb-page/.test(source.html)
  return `<!doctype html>
<html lang="${options.lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(options.title)}</title>
<style>${fontFaces()}
${pageCss(options.lang, pageNumbers)}
${source.css}
</style>
</head>
<body>
${rendered}
</body>
</html>`
}
