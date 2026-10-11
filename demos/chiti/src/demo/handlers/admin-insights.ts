/**
 * Handlers for the admin-insights group: chat history search, transcript,
 * statistics source list + export log, and the activity (audit) log.
 */
import { DemoApiError } from '@portfolio/demo-kit'

import { endCategoryOf, STATS_SESSION_LIMIT } from '@/features/admin-insights/stats'
import type { ActivityLog, ActivitySection, ChatSession, EndCategory, Paginated, SessionStatus, SessionSummary } from '@/types'

import { api } from '../api'
import { currentTenantId, findSession, requireRole } from '../context'
import { ensureTranscript, logActivity, sessionDetail, toSummaries } from '../engine'
import { store } from '../store'

const HISTORY_PAGE_SIZE = 25
const ACTIVITY_PAGE_SIZE = 20
const DAY_MS = 86_400_000

type Query = Record<string, string | undefined>

const SECTIONS: ActivitySection[] = ['auth', 'users', 'chats', 'reports', 'integrations']
const STATUSES: SessionStatus[] = ['waiting', 'active', 'inactive', 'ended']
const CATEGORIES: EndCategory[] = ['operator', 'customer', 'system', 'missed']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** [startMs, endMs) for 'yyyy-MM-dd' bounds in the viewer's timezone; defaults to the last `defaultDays` days. */
function rangeOf(query: Query, defaultDays: number): { from: string; to: string; startMs: number; endMs: number } {
  const today = new Date()
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : dayKey(today)
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : dayKey(new Date(today.getTime() - (defaultDays - 1) * DAY_MS))
  const startMs = new Date(`${from}T00:00:00`).getTime()
  const endMs = new Date(`${to}T00:00:00`).getTime() + DAY_MS
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) throw DemoApiError.validation({ from: 'Enter a valid date range.' })
  if (startMs >= endMs) throw DemoApiError.validation({ to: 'The end date must not be before the start date.' })
  return { from, to, startMs, endMs }
}

function tenantSessions(tenantId: string): ChatSession[] {
  return store.data.sessions.filter((row) => row.tenantId === tenantId)
}

/* ------------------------------------------------------------ history */

api.register('GET', '/admin/history/filters', () => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  return {
    operators: store.data.operators.filter((row) => row.tenantId === tenantId).map((row) => ({ id: row.id, name: { ...row.name } })),
    fields: store.data.customFields.filter((row) => row.tenantId === tenantId && row.enabled).sort((left, right) => left.sortOrder - right.sortOrder),
  }
})

api.register('GET', '/admin/history', ({ params }): Paginated<SessionSummary> => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const query = params as Query
  const { startMs, endMs } = rangeOf(query, 7)
  const keyword = (query.q ?? '').trim().toLowerCase()
  const operatorId = query.operatorId && query.operatorId !== 'all' ? query.operatorId : null
  const channel = query.channel && query.channel !== 'all' ? query.channel : null
  const status = STATUSES.find((value) => value === query.status) ?? null
  const category = CATEGORIES.find((value) => value === query.endCategory) ?? null
  const fieldFilters = Object.entries(query)
    .filter(([key, value]) => key.startsWith('field.') && value && value !== 'all')
    .map(([key, value]) => [key.slice(6), String(value).trim().toLowerCase()] as const)

  const operatorsById = new Map(store.data.operators.map((row) => [row.id, row]))
  const assigned = new Map<string, Set<string>>()
  if (operatorId) {
    for (const row of store.data.assignments) {
      if (row.operatorId !== operatorId) continue
      const set = assigned.get(row.sessionId) ?? new Set<string>()
      set.add(row.operatorId)
      assigned.set(row.sessionId, set)
    }
  }

  const matches = tenantSessions(tenantId)
    .filter((session) => {
      const started = Date.parse(session.startedAt)
      if (started < startMs || started >= endMs) return false
      if (channel && session.channel !== channel) return false
      if (status && session.status !== status) return false
      if (category && endCategoryOf(session) !== category) return false
      if (operatorId && session.operatorId !== operatorId && !assigned.get(session.id)?.has(operatorId)) return false
      for (const [fieldId, wanted] of fieldFilters) {
        const value = session.customFields.find((field) => field.fieldId === fieldId)?.value.toLowerCase() ?? ''
        const field = store.data.customFields.find((row) => row.id === fieldId)
        if (field?.type === 'select' ? value !== wanted : !value.includes(wanted)) return false
      }
      if (keyword) {
        const operator = session.operatorId ? operatorsById.get(session.operatorId) : undefined
        const haystack = [
          session.customerName,
          session.customerNumber,
          session.endSummary ?? '',
          session.id,
          operator?.name.en ?? '',
          operator?.name.ka ?? '',
          operator?.nickname ?? '',
          ...session.customFields.map((field) => field.value),
        ]
          .join('\n')
          .toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))

  const pageCount = Math.max(1, Math.ceil(matches.length / HISTORY_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(query.page)) || 1))
  const slice = matches.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)
  return { rows: toSummaries(slice), total: matches.length, page, pageSize: HISTORY_PAGE_SIZE }
})

/** Transcript. Staff of the tenant may open it (operators from their profile / history panel). */
api.register('GET', '/admin/history/:id', ({ path }) => {
  requireRole('admin', 'supervisor', 'operator')
  const session = findSession(path.id as string)
  const messages = ensureTranscript(session.id)
  return {
    detail: sessionDetail(session.id),
    messages,
    notes: store.data.notes.filter((row) => row.sessionId === session.id).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    feedback: store.data.feedback.find((row) => row.sessionId === session.id) ?? null,
  }
})

/* --------------------------------------------------------- statistics */

api.register('GET', '/admin/statistics/sessions', ({ params }): SessionSummary[] => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const { startMs, endMs } = rangeOf(params as Query, 7)
  const inRange = tenantSessions(tenantId)
    .filter((session) => {
      const started = Date.parse(session.startedAt)
      return started >= startMs && started < endMs
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, STATS_SESSION_LIMIT)
  return toSummaries(inRange)
})

api.register('POST', '/admin/statistics/export-log', ({ body }) => {
  const account = requireRole('admin')
  const input = (body ?? {}) as { from?: string; to?: string; rows?: number; filename?: string }
  if (!input.from || !input.to) throw DemoApiError.validation({ from: 'The date range is required.' })
  logActivity({
    action: 'admin_download_report',
    actorId: account.staffId,
    targetLabel: input.filename ?? `chat-statistics-${input.from}-to-${input.to}.csv`,
    metadata: { from: input.from, to: input.to, rows: Number(input.rows) || 0, format: 'csv' },
  })
  return { ok: true }
})

/* ----------------------------------------------------------- activity */

api.register('GET', '/admin/activity', ({ params }): Paginated<ActivityLog> => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const query = params as Query
  const section = SECTIONS.find((value) => value === query.section) ?? 'auth'
  const role = query.role && query.role !== 'all' ? query.role : null
  const keyword = (query.q ?? '').trim().toLowerCase()
  const hasRange = Boolean(query.from || query.to)
  const range = hasRange ? rangeOf(query, 30) : null

  const rows = store.data.activity
    .filter((row) => {
      if (row.tenantId !== tenantId || row.section !== section) return false
      if (role && row.actorRole !== role) return false
      if (range) {
        const at = Date.parse(row.createdAt)
        if (at < range.startMs || at >= range.endMs) return false
      }
      if (keyword) {
        const haystack = [row.actorName, row.targetLabel ?? '', row.action.replace(/_/g, ' '), row.ipAddress ?? '', ...Object.values(row.metadata).map(String)].join('\n').toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))

  const pageCount = Math.max(1, Math.ceil(rows.length / ACTIVITY_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(query.page)) || 1))
  return { rows: rows.slice((page - 1) * ACTIVITY_PAGE_SIZE, page * ACTIVITY_PAGE_SIZE), total: rows.length, page, pageSize: ACTIVITY_PAGE_SIZE }
})
