/** Tiny client-side CSV helpers: parsing, the Q/A header check and Blob downloads. */

/** RFC 4180-ish parser: quoted fields, doubled quotes, CRLF, `,` or `;` delimiter. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  return rows
}

const QUESTION_HEADERS = ['question', 'კითხვა']
const ANSWER_HEADERS = ['answer', 'პასუხი']

export interface QaParse {
  rows: { question: string; answer: string }[]
  skipped: number
  /** Set when the header row is missing the question / answer columns. */
  error: 'no_header' | 'empty' | null
}

/** Header must be question/answer or კითხვა/პასუხი (any order, any other columns ignored). */
export function parseQaCsv(text: string): QaParse {
  const table = parseCsv(text)
  if (table.length === 0) return { rows: [], skipped: 0, error: 'empty' }
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase())
  const q = header.findIndex((h) => QUESTION_HEADERS.includes(h))
  const a = header.findIndex((h) => ANSWER_HEADERS.includes(h))
  if (q < 0 || a < 0) return { rows: [], skipped: 0, error: 'no_header' }
  const rows: { question: string; answer: string }[] = []
  let skipped = 0
  for (const cells of table.slice(1)) {
    const question = (cells[q] ?? '').trim()
    const answer = (cells[a] ?? '').trim()
    if (question && answer) rows.push({ question, answer })
    else skipped += 1
  }
  return { rows, skipped, error: rows.length === 0 ? 'empty' : null }
}

const csvCell = (value: string): string => (/[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** The downloadable KB template: header plus three example rows, in the chosen language. */
export function buildTemplate(lang: 'ka' | 'en'): { filename: string; content: string } {
  const rows =
    lang === 'ka'
      ? [
          ['კითხვა', 'პასუხი'],
          ['რა სამუშაო საათები აქვს ფილიალს?', 'ფილიალი მუშაობს ორშაბათიდან პარასკევამდე 10:00-დან 18:00-მდე.'],
          ['როგორ შევცვალო საკონტაქტო ნომერი?', 'ნომრის შეცვლა შესაძლებელია აპლიკაციაში პროფილის გვერდზე ან ცხელ ხაზზე, პირადობის დადასტურებით.'],
          ['რამდენ ხანში განიხილება განაცხადი?', 'განაცხადი განიხილება 1-3 სამუშაო დღეში; შედეგს მიიღებთ SMS-ით.'],
        ]
      : [
          ['question', 'answer'],
          ['What are the branch opening hours?', 'Branches are open Monday to Friday, 10:00 to 18:00.'],
          ['How do I change my contact number?', 'Change it on the profile page in the app, or on the hotline after identity verification.'],
          ['How long does an application take?', 'Applications are reviewed within 1-3 business days; you will get the result by SMS.'],
        ]
  return {
    filename: lang === 'ka' ? 'sinji-kb-sabloni-ka.csv' : 'sinji-kb-template-en.csv',
    content: `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`,
  }
}

/** Save text as a file entirely in the browser (Blob + object URL). */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
