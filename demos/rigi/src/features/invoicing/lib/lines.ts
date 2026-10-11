/** Lines-editor helpers shared by the ad-hoc page and the detail page's "Edit lines". */
import type { InvoiceLineItem } from '@/types'

import type { LineInput } from '../api'

export interface LineDraft {
  key: string
  description: string
  quantity: string
  unitPrice: string
}

let seq = 0
export function blankLine(): LineDraft {
  seq += 1
  return { key: `l${Date.now().toString(36)}${seq}`, description: '', quantity: '1', unitPrice: '' }
}

export function fromInvoiceLines(lines: InvoiceLineItem[]): LineDraft[] {
  const rows = lines
    .filter((l) => l.kind === 'adhoc')
    .map((l) => ({ ...blankLine(), description: l.description, quantity: String(l.quantityNumerator), unitPrice: String(l.unitPrice) }))
  return rows.length > 0 ? rows : [blankLine()]
}

/** Accepts "1,5" as well as "1.5". */
export function parseDecimal(value: string): number {
  const v = value.trim().replace(',', '.')
  if (v === '' || !/^-?\d*(\.\d+)?$/.test(v)) return Number.NaN
  return Number(v)
}

export function rowAmount(line: LineDraft): number {
  const q = parseDecimal(line.quantity)
  const p = parseDecimal(line.unitPrice)
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0
  return Math.round(q * p * 100) / 100
}

export function linesTotal(lines: LineDraft[]): number {
  return Math.round(lines.filter((l) => l.description.trim()).reduce((acc, l) => acc + rowAmount(l), 0) * 100) / 100
}

export type LineErrorKey = 'quantity' | 'unitPrice' | 'description'
export interface LinesValidation {
  lines: LineInput[]
  /** row key -> field -> i18n key */
  rowErrors: Record<string, Partial<Record<LineErrorKey, string>>>
  /** i18n key for the whole editor */
  error?: string
}

/** Blank-description rows are dropped; the rest need qty > 0 and price >= 0. */
export function validateLines(drafts: LineDraft[]): LinesValidation {
  const rowErrors: LinesValidation['rowErrors'] = {}
  const lines: LineInput[] = []
  for (const d of drafts) {
    const description = d.description.trim()
    if (!description) continue
    const errs: Partial<Record<LineErrorKey, string>> = {}
    const quantity = parseDecimal(d.quantity)
    const unitPrice = parseDecimal(d.unitPrice)
    if (description.length > 500) errs.description = 'validation.max500'
    if (!Number.isFinite(quantity) || quantity <= 0) errs.quantity = 'validation.quantity'
    if (!Number.isFinite(unitPrice) || unitPrice < 0) errs.unitPrice = 'validation.price'
    if (Object.keys(errs).length) rowErrors[d.key] = errs
    else lines.push({ description, quantity, unitPrice })
  }
  const hasRowErrors = Object.keys(rowErrors).length > 0
  return { lines, rowErrors, error: !hasRowErrors && lines.length === 0 ? 'validation.noLines' : undefined }
}
