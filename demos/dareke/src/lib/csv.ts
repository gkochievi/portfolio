/**
 * CSV in and out. Parsing handles quotes, escaped
 * quotes, CRLF and a BOM. Download builds a Blob URL: no network.
 */

export type CsvValue = string | number | boolean | null | undefined

/** Parse CSV text into rows of cells. Use `parseCsvObjects` for header-keyed records. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Header row -> keys (trimmed, lower-cased). */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text)
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase())
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])))
}

function escapeCell(value: CsvValue): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Rows (first row = header) or records (keys = header) -> CSV text. */
export function toCsv(rows: CsvValue[][] | Record<string, CsvValue>[]): string {
  if (rows.length === 0) return ''
  if (Array.isArray(rows[0])) return (rows as CsvValue[][]).map((r) => r.map(escapeCell).join(',')).join('\r\n')
  const records = rows as Record<string, CsvValue>[]
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))))
  return [keys.map(escapeCell).join(','), ...records.map((r) => keys.map((k) => escapeCell(r[k])).join(','))].join('\r\n')
}

/** Save a file in the browser (Blob + object URL). */
export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Build and download a CSV (with a BOM so Excel reads Georgian). */
export function downloadCsv(filename: string, rows: CsvValue[][] | Record<string, CsvValue>[]): void {
  downloadText(filename.endsWith('.csv') ? filename : `${filename}.csv`, `﻿${toCsv(rows)}`, 'text/csv;charset=utf-8')
}

/** Read a picked/dropped File as text. */
export function readFileText(file: File): Promise<string> {
  return file.text()
}
