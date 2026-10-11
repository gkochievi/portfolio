/**
 * Row model for the call table: the text each column shows (used for the
 * per-column filters, the global filter and the Excel export) and the value
 * each column sorts by. Pure.
 */
import { fmtDateTime, fmtDuration } from '@/lib/format'
import type { CallStatus, Lang, TransferReason, UnifiedCdr } from '@/types'

export type ColumnId =
  | 'timestamp'
  | 'caller'
  | 'called'
  | 'transferred'
  | 'transferFrom'
  | 'transferTo'
  | 'duration'
  | 'billable'
  | 'status'
  | 'disposition'
  | 'origDevice'
  | 'destDevice'
  | 'hangupBy'
  | 'source'

export const FILTER_COLUMNS: ColumnId[] = [
  'timestamp',
  'caller',
  'called',
  'transferred',
  'transferFrom',
  'transferTo',
  'duration',
  'billable',
  'status',
  'disposition',
  'origDevice',
  'destDevice',
  'hangupBy',
  'source',
]

export interface RowLabels {
  lang: Lang
  status: (s: CallStatus) => string
  reason: (r: TransferReason) => string
  source: (s: 'core' | 'edge') => string
}

export type ColumnFilters = Partial<Record<ColumnId, string>>
export interface SortState {
  column: ColumnId
  dir: 'asc' | 'desc'
}

export const DEFAULT_SORT: SortState = { column: 'timestamp', dir: 'desc' }

export function hopCount(row: UnifiedCdr): number {
  return row.transfer?.wasTransferred ? row.transfer.transferCount : 0
}

/** The text a cell shows, lower-risk to filter and export. */
export function cellText(row: UnifiedCdr, column: ColumnId, labels: RowLabels): string {
  switch (column) {
    case 'timestamp':
      return fmtDateTime(row.timestamp, labels.lang, { seconds: true })
    case 'caller':
      return row.callerNumber
    case 'called':
      return row.calledNumber
    case 'transferred':
      return row.transfer?.wasTransferred ? `${labels.reason(row.transfer.reason ?? 'transfer')} ${hopCount(row)}` : ''
    case 'transferFrom':
      return row.transfer?.wasTransferred ? (row.transfer.transferFrom ?? '') : ''
    case 'transferTo':
      return row.transfer?.wasTransferred ? (row.transfer.transferTo ?? '') : ''
    case 'duration':
      return fmtDuration(row.duration)
    case 'billable':
      return fmtDuration(row.agentTalkSeconds ?? row.billableSeconds)
    case 'status':
      return `${labels.status(row.status)} ${row.status}`
    case 'disposition':
      return row.disposition
    case 'origDevice':
      return row.originatingDevice ?? ''
    case 'destDevice':
      return row.terminatingDevice ?? ''
    case 'hangupBy':
      return row.hangupBy ?? ''
    case 'source':
      return `${labels.source(row.source)} ${row.source}`
  }
}

export function sortValue(row: UnifiedCdr, column: ColumnId, labels: RowLabels): string | number {
  switch (column) {
    case 'timestamp':
      return Date.parse(row.timestamp)
    case 'duration':
      return row.duration
    case 'billable':
      return row.agentTalkSeconds ?? row.billableSeconds
    case 'transferred':
      return hopCount(row)
    default:
      return cellText(row, column, labels).toLowerCase()
  }
}

export function filterRows(rows: UnifiedCdr[], global: string, columns: ColumnFilters, labels: RowLabels): UnifiedCdr[] {
  const g = global.trim().toLowerCase()
  const active = (Object.entries(columns) as [ColumnId, string][])
    .map(([id, v]) => [id, v.trim().toLowerCase()] as const)
    .filter(([, v]) => v !== '')
  if (!g && active.length === 0) return rows
  return rows.filter((row) => {
    for (const [id, v] of active) if (!cellText(row, id, labels).toLowerCase().includes(v)) return false
    if (!g) return true
    if (row.searchBlob?.toLowerCase().includes(g)) return true
    return FILTER_COLUMNS.some((id) => cellText(row, id, labels).toLowerCase().includes(g))
  })
}

export function sortRows(rows: UnifiedCdr[], sort: SortState, labels: RowLabels): UnifiedCdr[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  const keyed = rows.map((row, i) => ({ row, i, v: sortValue(row, sort.column, labels) }))
  keyed.sort((a, b) => {
    const cmp =
      typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), undefined, { numeric: true })
    return cmp * dir || a.i - b.i
  })
  return keyed.map((k) => k.row)
}

/** Next sort when a header is clicked: new column starts ascending (timestamp: descending), same column flips. */
export function nextSort(current: SortState, column: ColumnId): SortState {
  if (current.column !== column) return { column, dir: column === 'timestamp' ? 'desc' : 'asc' }
  return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}
