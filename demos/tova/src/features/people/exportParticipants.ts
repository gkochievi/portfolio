/** Builds `participants-YYYY-MM-DD.xlsx` in the browser and hands it to the viewer. No network. */
import type { TFunction } from 'i18next'

import type { ParticipantRow } from '@/types'
import { asText, workbook } from './xlsx'

/** Local calendar date, `YYYY-MM-DD`. */
export function exportFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `participants-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`
}

export function participantsWorkbook(rows: readonly ParticipantRow[], t: TFunction): Blob {
  return workbook({
    sheet: t('people:participants.sheetName'),
    columns: [
      t('people:fields.firstName'),
      t('people:fields.lastName'),
      t('people:fields.email'),
      t('people:fields.phone'),
      t('people:fields.company'),
      t('people:fields.position'),
      t('people:participants.best'),
      t('people:participants.plays'),
      t('people:participants.registeredAt'),
    ],
    rows: rows.map((row) => [
      row.firstName,
      row.lastName,
      row.email,
      asText(row.phone),
      row.company,
      row.position,
      row.best,
      row.plays,
      new Date(row.createdAt),
    ]),
  })
}

/** Blob plus `<a download>`; the object URL is revoked once the click has been handled. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
