/**
 * Admin live endpoints (owner: admin-live): the dashboard snapshot, the
 * Conversations lists (Live / Pending / Inactive / Today), spectate actions
 * (intervention, admin message, end chat) and "Clear waiting queue".
 *
 * Reads are open to admins and supervisors; every write is admin-only (a
 * supervisor gets 403). Engine mutations log their own audit rows
 * (admin_intervention_*, admin_end_session); this file logs the rest.
 */
import { DemoApiError, conflict } from '@portfolio/demo-kit'

import type { ChatSession, Message, OperatorBrief, SessionSummary } from '@/types'

import { api } from '../api'
import { currentTenantId, findSession, requireRole, tenantSettings } from '../context'
import { endSession, logActivity, operatorBrief, operatorLoad, postMessage, sessionDetail, setIntervention, toSummaries, toSummary } from '../engine'
import { store } from '../store'
import type { AdminSessionTab, AdminSessionsResponse, DashboardResponse } from '@/features/admin-live/types'

const MAX_LENGTH = 4000
/** Asia/Tbilisi has no DST; "today" starts at local midnight. */
const TBILISI_OFFSET_MS = 4 * 3_600_000

function startOfTodayMs(now = Date.now()): number {
  const local = now + TBILISI_OFFSET_MS
  return local - (local % 86_400_000) - TBILISI_OFFSET_MS
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0)
const byRecent = (left: ChatSession, right: ChatSession) => time(right.lastActivity) - time(left.lastActivity)
const byOldest = (left: ChatSession, right: ChatSession) => time(left.startedAt) - time(right.startedAt)

function tenantSessions(tenantId: string): ChatSession[] {
  return store.data.sessions.filter((row) => row.tenantId === tenantId)
}

function groups(tenantId: string) {
  const all = tenantSessions(tenantId)
  const today = startOfTodayMs()
  return {
    all,
    live: all.filter((row) => row.status === 'active').sort(byRecent),
    pending: all.filter((row) => row.status === 'waiting').sort(byOldest),
    inactive: all.filter((row) => row.status === 'inactive').sort(byRecent),
    today: all
      .filter((row) => row.status === 'ended' && time(row.endedAt) >= today)
      .sort((left, right) => time(right.endedAt) - time(left.endedAt)),
    startedToday: all.filter((row) => time(row.startedAt) >= today).length,
  }
}

api.register('GET', '/admin/dashboard', (): DashboardResponse => {
  requireRole('admin', 'supervisor')
  const tenantId = currentTenantId()
  const g = groups(tenantId)
  const staff = store.data.operators.filter((row) => row.tenantId === tenantId)
  const count = (status: string) => staff.filter((row) => row.status === status).length
  const rank = { online: 0, away: 1, offline: 2 } as const
  const operators: (OperatorBrief & { activeChatCount: number })[] = [...staff]
    .sort((left, right) => rank[left.status] - rank[right.status] || left.nickname.localeCompare(right.nickname))
    .map((row) => ({ ...operatorBrief(row), activeChatCount: operatorLoad(row.id) }))
  const open = [...g.live, ...g.inactive, ...g.pending].sort(byRecent).slice(0, 5)
  return {
    stats: {
      operators: { total: staff.length, online: count('online'), away: count('away'), offline: count('offline') },
      customers: { active: g.live.length, waiting: g.pending.length, inactive: g.inactive.length },
      sessions: { total: g.all.length, today: g.startedToday, ended: g.all.filter((row) => row.status === 'ended').length },
    },
    operators,
    openSessions: toSummaries(open),
    limit: tenantSettings(tenantId).operatorChatLimit,
  }
})

function isTab(value: unknown): value is AdminSessionTab {
  return value === 'live' || value === 'pending' || value === 'inactive' || value === 'today'
}

api.register('GET', '/admin/sessions', ({ params }): AdminSessionsResponse => {
  requireRole('admin', 'supervisor')
  const g = groups(currentTenantId())
  const tab: AdminSessionTab = isTab(params.tab) ? params.tab : 'live'
  const rows: SessionSummary[] = toSummaries(g[tab])
  return { rows, counts: { live: g.live.length, pending: g.pending.length, inactive: g.inactive.length, today: g.today.length } }
})

api.register('POST', '/admin/sessions/:id/intervention', ({ path, body }) => {
  const admin = requireRole('admin')
  const session = findSession(path.id as string)
  const active = (body as { active?: unknown } | null)?.active
  if (typeof active !== 'boolean') throw DemoApiError.validation({ active: 'Say whether to start or stop the intervention.' })
  if (active && !session.operatorId) throw conflict('You can step in only when an operator is assigned.')
  setIntervention(session.id, active ? admin.staffId : null)
  return sessionDetail(session.id)
})

api.register('POST', '/admin/sessions/:id/messages', ({ path, body }): Message => {
  const admin = requireRole('admin')
  const session = findSession(path.id as string)
  const content = String((body as { content?: unknown } | null)?.content ?? '').trim()
  if (!content) throw DemoApiError.validation({ content: 'Write a message first.' })
  if (content.length > MAX_LENGTH) throw DemoApiError.validation({ content: `Messages can be up to ${MAX_LENGTH} characters.` })
  if (session.status === 'ended') throw conflict('This chat has ended.')
  if (!session.adminInterventionActive) throw conflict('Start the intervention before writing to the customer.')
  if (session.interventionAdminId && session.interventionAdminId !== admin.staffId) throw conflict('Another admin is handling this chat.')
  const record = store.data.admins.find((row) => row.id === admin.staffId)
  const message = postMessage(session.id, {
    sender: 'admin',
    senderId: admin.staffId,
    senderName: record?.nickname ?? admin.name,
    content,
    sentByAdmin: true,
  })
  logActivity({ action: 'admin_send_message', tenantId: session.tenantId, targetId: session.id, targetLabel: session.customerName })
  return message
})

api.register('POST', '/admin/sessions/:id/end', ({ path }) => {
  requireRole('admin')
  const session = findSession(path.id as string)
  if (session.status === 'ended') throw conflict('This chat has already ended.')
  endSession(session.id, 'admin', 'manual')
  return toSummary(findSession(session.id))
})

api.register('POST', '/admin/queue/clear', () => {
  requireRole('admin')
  const tenantId = currentTenantId()
  const waiting = tenantSessions(tenantId).filter((row) => row.status === 'waiting')
  if (waiting.length === 0) throw conflict('The waiting queue is already empty.')
  for (const row of waiting) endSession(row.id, 'system', 'queue_cleared')
  logActivity({ action: 'admin_clear_queue', tenantId, metadata: { count: waiting.length } })
  return { cleared: waiting.length }
})
