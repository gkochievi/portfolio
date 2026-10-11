/**
 * Pure helpers for the admin-insights screens: end category, the statistics
 * reducer and the CSV builder. No React, no store: easy to reason about.
 */
import type { Channel, ChatSession, EndCategory, Lang, OperatorBrief, SessionSummary } from '@/types'

/** Above this many sessions the server cuts the list and the UI warns. */
export const STATS_SESSION_LIMIT = 2000

/** How a chat ended, for history filters and statistics. `null` while it is still open. */
export function endCategoryOf(session: Pick<ChatSession, 'status' | 'operatorId' | 'endedBy' | 'firstStaffReplyAt'>): EndCategory | null {
  if (session.status !== 'ended') return null
  if (!session.operatorId && !session.firstStaffReplyAt) return 'missed'
  if (session.endedBy === 'customer') return 'customer'
  if (session.endedBy === 'system') return 'system'
  return 'operator'
}

export function durationSeconds(session: Pick<ChatSession, 'startedAt' | 'endedAt'>): number | null {
  if (!session.endedAt) return null
  const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt)
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null
}

/* ------------------------------------------------------------- statistics */

export interface OperatorRow {
  id: string
  operator: OperatorBrief | null
  total: number
  finished: number
  avgDurationSeconds: number | null
  completion: number
}

export interface ChatMark {
  id: string
  customerName: string
  at: string
}

export interface StatsResult {
  total: number
  liveNow: number
  avgDurationSeconds: number | null
  abandoned: number
  hourly: number[]
  peakHour: number | null
  closedBy: { operator: number; customer: number; system: number }
  first: ChatMark | null
  last: ChatMark | null
  perOperator: OperatorRow[]
}

export function computeStats(sessions: readonly SessionSummary[]): StatsResult {
  const hourly = new Array<number>(24).fill(0)
  const closedBy = { operator: 0, customer: 0, system: 0 }
  let liveNow = 0
  let abandoned = 0
  let durationSum = 0
  let durationCount = 0
  let first: SessionSummary | null = null
  let last: SessionSummary | null = null
  const byOperator = new Map<string, { operator: OperatorBrief | null; total: number; finished: number; durSum: number; durCount: number }>()

  for (const session of sessions) {
    const started = new Date(session.startedAt)
    hourly[started.getHours()] = (hourly[started.getHours()] ?? 0) + 1
    if (!first || session.startedAt < first.startedAt) first = session
    if (!last || session.startedAt > last.startedAt) last = session
    const category = endCategoryOf(session)
    if (category === null) liveNow += 1
    else if (category === 'missed') abandoned += 1
    else closedBy[category] += 1
    const duration = durationSeconds(session)
    if (category !== null && category !== 'missed' && duration !== null) {
      durationSum += duration
      durationCount += 1
    }
    if (session.operatorId) {
      const row = byOperator.get(session.operatorId) ?? { operator: session.operator, total: 0, finished: 0, durSum: 0, durCount: 0 }
      row.total += 1
      if (category !== null) {
        row.finished += 1
        if (duration !== null) {
          row.durSum += duration
          row.durCount += 1
        }
      }
      byOperator.set(session.operatorId, row)
    }
  }

  const max = Math.max(...hourly)
  const mark = (session: SessionSummary | null): ChatMark | null => (session ? { id: session.id, customerName: session.customerName, at: session.startedAt } : null)
  return {
    total: sessions.length,
    liveNow,
    avgDurationSeconds: durationCount ? Math.round(durationSum / durationCount) : null,
    abandoned,
    hourly,
    peakHour: max > 0 ? hourly.indexOf(max) : null,
    closedBy,
    first: mark(first),
    last: mark(last),
    perOperator: [...byOperator.entries()]
      .map(([id, row]) => ({
        id,
        operator: row.operator,
        total: row.total,
        finished: row.finished,
        avgDurationSeconds: row.durCount ? Math.round(row.durSum / row.durCount) : null,
        completion: row.total ? row.finished / row.total : 0,
      }))
      .sort((left, right) => right.total - left.total),
  }
}

/* -------------------------------------------------------------------- CSV */

export interface CsvLabels {
  headers: {
    id: string
    customer: string
    number: string
    channel: string
    operator: string
    status: string
    topic: string
    started: string
    ended: string
    duration: string
    category: string
    reason: string
    summary: string
    messages: string
    rating: string
  }
  channel: (channel: Channel) => string
  status: (status: string) => string
  category: (category: EndCategory) => string
  reason: (reason: string) => string
  topic: (topic: string) => string
  operatorName: (operator: OperatorBrief) => string
  fieldLabel: (label: SessionSummary['customFields'][number]['label']) => string
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  // Neutralise spreadsheet formulas coming from visitor-typed text.
  if (typeof value === 'string' && /^(?:[=@\t\r]|[+-](?![\d\s(]))/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** UTF-8 CSV with a BOM (Excel-friendly Georgian) and one column per custom field. */
export function buildCsv(sessions: readonly SessionSummary[], labels: CsvLabels, _lang: Lang): string {
  const fieldColumns = new Map<string, string>()
  for (const session of sessions) {
    for (const field of session.customFields) {
      if (!fieldColumns.has(field.fieldId)) fieldColumns.set(field.fieldId, labels.fieldLabel(field.label))
    }
  }
  const h = labels.headers
  const header = [h.id, h.customer, h.number, h.channel, h.operator, h.status, h.topic, h.started, h.ended, h.duration, h.category, h.reason, h.summary, h.messages, h.rating, ...fieldColumns.values()]
  const lines = [header.map(cell).join(',')]
  for (const session of sessions) {
    const category = endCategoryOf(session)
    const values = new Map(session.customFields.map((field) => [field.fieldId, field.value]))
    lines.push(
      [
        session.id,
        session.customerName,
        session.customerNumber,
        labels.channel(session.channel),
        session.operator ? labels.operatorName(session.operator) : '',
        labels.status(session.status),
        labels.topic(session.topic),
        session.startedAt,
        session.endedAt ?? '',
        durationSeconds(session),
        category ? labels.category(category) : '',
        session.endReason ? labels.reason(session.endReason) : '',
        session.endSummary ?? '',
        session.messageCount,
        session.rating,
        ...[...fieldColumns.keys()].map((id) => values.get(id) ?? ''),
      ]
        .map(cell)
        .join(','),
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Offline download through a Blob URL. */
export function downloadTextFile(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
