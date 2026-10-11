/** CSV export helpers. Owner: design-system. Pure, no network. */

export interface CsvColumn<T> {
  key: string
  header: string
  /** Defaults to `row[key]`. */
  value?: (row: T) => unknown
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Rows -> RFC 4180 CSV (CRLF, header row first). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]))
      .join(','),
  )
  return [head, ...body].join('\r\n')
}

/** Save text as a file in the browser (Blob + object URL; nothing leaves the page). */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([mime.startsWith('text/csv') ? `﻿${text}` : text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
