/**
 * Handlers for the team feature group (owner: team agent): staff chat
 * (room + DMs), the operator profile, profile statistics and own chats.
 * Everything is scoped to the caller's tenant; the superadmin has no tenant
 * and is refused.
 */
import { DemoApiError, createRandom, forbidden, notFound } from '@portfolio/demo-kit'

import type { ConversationRow, MessagesPage, ProfileResponse, RosterEntry } from '@/features/team/types'
import type {
  Admin,
  ChatSession,
  EndCategory,
  Operator,
  OperatorProfileStats,
  OperatorStatus,
  Paginated,
  PersonName,
  ReleaseReason,
  SessionSummary,
  StaffConversation,
  StaffMember,
  StaffMessage,
  StaffRole,
  Supervisor,
} from '@/types'

import { api } from '../api'
import { broadcast, bus } from '../bus'
import { currentTenantId, findTenant, requireRole } from '../context'
import { toSummaries } from '../engine'
import { newId, store } from '../store'

/* ------------------------------------------------------------------ people */

/** Presence for admins and supervisors (operators use their real status). Cleared on reset. */
export const presenceOverride = new Map<string, OperatorStatus>()
bus.on('demo:reset', () => presenceOverride.clear())

const DEFAULT_PRESENCE: Record<string, OperatorStatus> = { adm_giorgi: 'online', adm_eka: 'online', sup_nino: 'offline' }

interface Person {
  role: StaffRole
  id: string
  name: PersonName
  nickname: string
  number: string
  avatarId: string | null
  avatarUrl: string | null
  presence: OperatorStatus
}

function presenceOf(role: StaffRole, id: string, operator?: Operator): OperatorStatus {
  if (operator) return operator.status
  return presenceOverride.get(id) ?? DEFAULT_PRESENCE[id] ?? (role === 'admin' ? 'online' : 'offline')
}

function directory(tenantId: string): Person[] {
  const { operators, admins, supervisors } = store.data
  const ops: Person[] = operators
    .filter((row) => row.tenantId === tenantId)
    .map((row) => ({ role: 'operator', id: row.id, name: row.name, nickname: row.nickname, number: row.operatorNumber, avatarId: row.avatarId, avatarUrl: row.avatarUrl, presence: presenceOf('operator', row.id, row) }))
  const adms: Person[] = admins
    .filter((row: Admin) => row.tenantId === tenantId)
    .map((row) => ({ role: 'admin', id: row.id, name: row.name, nickname: row.nickname, number: row.adminNumber, avatarId: null, avatarUrl: null, presence: presenceOf('admin', row.id) }))
  const sups: Person[] = supervisors
    .filter((row: Supervisor) => row.tenantId === tenantId)
    .map((row) => ({ role: 'supervisor', id: row.id, name: row.name, nickname: row.nickname, number: row.supervisorNumber, avatarId: null, avatarUrl: null, presence: presenceOf('supervisor', row.id) }))
  return [...adms, ...ops, ...sups]
}

export function findPerson(tenantId: string, role: StaffRole, id: string): Person | undefined {
  return directory(tenantId).find((row) => row.role === role && row.id === id)
}

interface Me {
  role: StaffRole
  id: string
  tenantId: string
}

function me(): Me {
  const account = requireRole('operator', 'admin', 'supervisor')
  return { role: account.role as StaffRole, id: account.staffId, tenantId: currentTenantId() }
}

/* ----------------------------------------------------------- conversations */

const MAX_TEXT = 2000

function dmKeyOf(a: { role: StaffRole; id: string }, b: { role: StaffRole; id: string }): string {
  return [`${a.role}:${a.id}`, `${b.role}:${b.id}`].sort().join('|')
}

function sameMember(member: StaffMember, who: { role: StaffRole; id: string }): boolean {
  return member.role === who.role && member.memberId === who.id
}

function roomOf(tenantId: string): StaffConversation | undefined {
  return store.data.staffConversations.find((row) => row.tenantId === tenantId && row.kind === 'room')
}

/** The caller's conversations: the room (not for supervisors) and DMs they belong to. */
function mine(who: Me): StaffConversation[] {
  const room = roomOf(who.tenantId)
  if (room && who.role !== 'supervisor' && !room.members.some((member) => sameMember(member, who))) {
    const person = findPerson(who.tenantId, who.role, who.id)
    if (person) {
      room.members.push({ role: who.role, memberId: who.id, name: { ...person.name }, lastReadAt: room.lastMessageAt })
    }
  }
  return store.data.staffConversations.filter(
    (row) => row.tenantId === who.tenantId && row.members.some((member) => sameMember(member, who)),
  )
}

function conversationFor(who: Me, id: string): StaffConversation {
  const found = mine(who).find((row) => row.id === id)
  if (!found) throw notFound('Conversation not found.')
  return found
}

function unreadOf(conv: StaffConversation, who: Me): number {
  const member = conv.members.find((row) => sameMember(row, who))
  const since = member?.lastReadAt ? Date.parse(member.lastReadAt) : 0
  let count = 0
  for (const message of store.data.staffMessages) {
    if (message.conversationId !== conv.id || message.pending || message.failed) continue
    if (message.senderRole === who.role && message.senderId === who.id) continue
    if (Date.parse(message.timestamp) > since) count += 1
  }
  return count
}

function lastMessageOf(conv: StaffConversation): StaffMessage | undefined {
  let last: StaffMessage | undefined
  for (const message of store.data.staffMessages) {
    if (message.conversationId !== conv.id) continue
    if (!last || Date.parse(message.timestamp) >= Date.parse(last.timestamp)) last = message
  }
  return last
}

function toEntry(person: Person, conv: StaffConversation | undefined, who: Me): RosterEntry {
  return {
    role: person.role,
    id: person.id,
    name: { ...person.name },
    nickname: person.nickname,
    number: person.number,
    avatarId: person.avatarId,
    avatarUrl: person.avatarUrl,
    presence: person.presence,
    conversationId: conv?.id ?? null,
    unread: conv ? unreadOf(conv, who) : 0,
    lastMessageText: conv?.lastMessageText ?? null,
    lastMessageAt: conv?.lastMessageAt ?? null,
  }
}

function rowOf(conv: StaffConversation, who: Me): ConversationRow {
  let peer: RosterEntry | null = null
  if (conv.kind === 'direct') {
    const other = conv.members.find((member) => !sameMember(member, who))
    const person = other ? findPerson(who.tenantId, other.role, other.memberId) : undefined
    if (person) peer = toEntry(person, conv, who)
  }
  const last = lastMessageOf(conv)
  return {
    id: conv.id,
    kind: conv.kind,
    title: conv.title ? { ...conv.title } : null,
    peer,
    memberCount: conv.members.length,
    unread: unreadOf(conv, who),
    lastMessageText: conv.lastMessageText,
    lastMessageAt: conv.lastMessageAt,
    lastSenderName: last ? { ...last.senderName } : null,
  }
}

function sortRows(rows: ConversationRow[]): ConversationRow[] {
  return rows.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'room' ? -1 : 1
    return Date.parse(right.lastMessageAt ?? '1970-01-01') - Date.parse(left.lastMessageAt ?? '1970-01-01')
  })
}

/* ---------------------------------------------------------------- messages */

export interface NewStaffMessage {
  content: string
  type?: StaffMessage['type']
  clientId?: string | null
  fileUrl?: string | null
  fileName?: string | null
}

/** Create + store a message (confirmed immediately unless `pending`), update the conversation and notify. */
export function createStaffMessage(conv: StaffConversation, sender: { role: StaffRole; id: string; name: PersonName }, input: NewStaffMessage, pending = false): StaffMessage {
  const message: StaffMessage = {
    id: newId('smsg_'),
    tenantId: conv.tenantId,
    conversationId: conv.id,
    senderRole: sender.role,
    senderId: sender.id,
    senderName: { ...sender.name },
    type: input.type ?? 'text',
    content: input.content,
    fileUrl: input.fileUrl ?? null,
    fileName: input.fileName ?? null,
    timestamp: new Date().toISOString(),
    pending,
    failed: false,
    clientId: input.clientId ?? null,
  }
  store.data.staffMessages.push(message)
  conv.lastMessageText = message.content || message.fileName || null
  conv.lastMessageAt = message.timestamp
  const member = conv.members.find((row) => row.role === sender.role && row.memberId === sender.id)
  if (member) member.lastReadAt = message.timestamp
  broadcast('staff:message', message)
  broadcast('staff:conversation', conv)
  if (pending) {
    const delay = 150 + Math.floor(Math.random() * 150)
    setTimeout(() => {
      const stored = store.data.staffMessages.find((row) => row.id === message.id)
      if (!stored) return
      stored.pending = false
      broadcast('staff:message', stored)
    }, delay)
  }
  return message
}

function markRead(conv: StaffConversation, who: { role: StaffRole; id: string }): void {
  const member = conv.members.find((row) => sameMember(row, who))
  if (!member) return
  member.lastReadAt = new Date().toISOString()
  broadcast('staff:conversation', conv)
}

api.register('GET', '/team/roster', () => {
  const who = me()
  const convs = mine(who)
  const entries = directory(who.tenantId)
    .filter((person) => !(person.role === who.role && person.id === who.id))
    .map((person) => {
      const key = dmKeyOf(who, person)
      return toEntry(person, convs.find((row) => row.dmKey === key), who)
    })
  return entries.sort((left, right) => {
    const a = left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0
    const b = right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0
    if (a !== b) return b - a
    return left.name.en.localeCompare(right.name.en)
  })
})

api.register('GET', '/team/conversations', () => {
  const who = me()
  return sortRows(mine(who).map((conv) => rowOf(conv, who)))
})

api.register('POST', '/team/conversations/direct', ({ body }) => {
  const who = me()
  const input = (body ?? {}) as { role?: StaffRole; memberId?: string }
  if (!input.role || !input.memberId) throw DemoApiError.validation({ memberId: 'Choose a colleague.' })
  if (input.role === who.role && input.memberId === who.id) throw DemoApiError.validation({ memberId: 'You cannot message yourself.' })
  const person = findPerson(who.tenantId, input.role, input.memberId)
  if (!person) throw notFound('Colleague not found.')
  const key = dmKeyOf(who, person)
  let conv = store.data.staffConversations.find((row) => row.tenantId === who.tenantId && row.dmKey === key)
  if (!conv) {
    const myself = findPerson(who.tenantId, who.role, who.id)
    const now = new Date().toISOString()
    conv = {
      id: newId('conv_dm_'),
      tenantId: who.tenantId,
      kind: 'direct',
      title: null,
      dmKey: key,
      members: [
        { role: who.role, memberId: who.id, name: { ...(myself?.name ?? person.name) }, lastReadAt: now },
        { role: person.role, memberId: person.id, name: { ...person.name }, lastReadAt: null },
      ],
      lastMessageText: null,
      lastMessageAt: null,
    }
    store.data.staffConversations.push(conv)
    broadcast('staff:conversation', conv)
  }
  return rowOf(conv, who)
})

api.register('GET', '/team/conversations/:id/messages', ({ path, params }) => {
  const who = me()
  const conv = conversationFor(who, path.id ?? '')
  const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100)
  const before = params.before ? Date.parse(params.before) : Number.POSITIVE_INFINITY
  const all = store.data.staffMessages
    .filter((row) => row.conversationId === conv.id && Date.parse(row.timestamp) < before)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const page: MessagesPage = { messages: all.slice(-limit), hasMore: all.length > limit }
  return page
})

api.register('POST', '/team/conversations/:id/messages', ({ path, body }) => {
  const who = me()
  const conv = conversationFor(who, path.id ?? '')
  const input = (body ?? {}) as Partial<NewStaffMessage>
  const type = input.type ?? 'text'
  if (type !== 'text' && type !== 'image' && type !== 'file') throw DemoApiError.validation({ type: 'Unsupported message type.' })
  const content = (input.content ?? '').trim()
  if (type === 'text' && !content) throw DemoApiError.validation({ content: 'Write a message first.' })
  if (content.length > MAX_TEXT) throw DemoApiError.validation({ content: `Messages are limited to ${MAX_TEXT} characters.` })
  if (type !== 'text' && !input.fileUrl) throw DemoApiError.validation({ fileUrl: 'Attach a file first.' })
  const person = findPerson(who.tenantId, who.role, who.id)
  if (!person) throw forbidden()
  return createStaffMessage(
    conv,
    { role: who.role, id: who.id, name: person.name },
    { content, type, clientId: input.clientId ?? null, fileUrl: input.fileUrl ?? null, fileName: input.fileName ?? null },
    true,
  )
})

api.register('POST', '/team/conversations/:id/read', ({ path }) => {
  const who = me()
  const conv = conversationFor(who, path.id ?? '')
  markRead(conv, who)
  return rowOf(conv, who)
})

api.register('POST', '/team/conversations/:id/typing', ({ path, body }) => {
  const who = me()
  const conv = conversationFor(who, path.id ?? '')
  const person = findPerson(who.tenantId, who.role, who.id)
  if (!person) throw forbidden()
  const isTyping = !!(body as { isTyping?: boolean } | null)?.isTyping
  broadcast('staff:typing', { conversationId: conv.id, memberId: who.id, name: { ...person.name }, isTyping })
  return null
})

/* ----------------------------------------------------------------- profile */

/** The operator behind the caller: an operator, or an admin with a linked operator profile. */
function profileOperator(): Operator {
  const account = requireRole('operator', 'admin')
  const operatorId = account.role === 'operator'
    ? account.staffId
    : store.data.admins.find((row) => row.id === account.staffId)?.operatorId
  const operator = operatorId ? store.data.operators.find((row) => row.id === operatorId) : undefined
  if (!operator) throw forbidden('This account has no operator profile.')
  return operator
}

api.register('GET', '/operator/profile', () => {
  const operator = profileOperator()
  const tenant = findTenant(operator.tenantId)
  const response: ProfileResponse = { operator: { ...operator }, tenant: { id: tenant.id, name: { ...tenant.name } } }
  return response
})

api.register('PATCH', '/operator/profile', ({ body }) => {
  const operator = profileOperator()
  const input = (body ?? {}) as Partial<Pick<Operator, 'nickname' | 'avatarId' | 'avatarUrl' | 'language' | 'pushEnabled'>>
  const errors: Record<string, string> = {}
  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim()
    if (!nickname) errors.nickname = 'Enter a nickname.'
    else if (nickname.length > 24) errors.nickname = 'Nicknames are limited to 24 characters.'
  }
  if (input.language !== undefined && !['ka', 'en', 'ru'].includes(input.language)) errors.language = 'Choose a supported language.'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  if (input.nickname !== undefined) operator.nickname = input.nickname.trim()
  if (input.avatarId !== undefined) operator.avatarId = input.avatarId
  if (input.avatarUrl !== undefined) operator.avatarUrl = input.avatarUrl
  if (input.language !== undefined) operator.language = input.language
  if (input.pushEnabled !== undefined) operator.pushEnabled = !!input.pushEnabled
  broadcast('operator:upsert', operator)
  return { ...operator }
})

/* ------------------------------------------------------------- statistics */

const TBILISI_OFFSET_MS = 4 * 3_600_000
const DAY_MS = 86_400_000
const MAX_RANGE_DAYS = 92

function dayKey(ms: number): string {
  return new Date(ms + TBILISI_OFFSET_MS).toISOString().slice(0, 10)
}

function dayStartMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`) - TBILISI_OFFSET_MS
}

function parseKey(value: string | undefined, fallback: string): string {
  const key = (value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(Date.parse(`${key}T00:00:00Z`)) ? key : fallback
}

/** Sessions the operator took part in, with the moment they picked them up. */
function handledBy(operatorId: string): { session: ChatSession; handledAt: number; transfers: { reason: ReleaseReason; at: number }[] }[] {
  const mineAssignments = store.data.assignments.filter((row) => row.operatorId === operatorId)
  const bySession = new Map<string, typeof mineAssignments>()
  for (const row of mineAssignments) bySession.set(row.sessionId, [...(bySession.get(row.sessionId) ?? []), row])
  const out: ReturnType<typeof handledBy> = []
  for (const session of store.data.sessions) {
    const assigned = bySession.get(session.id)
    if (session.operatorId !== operatorId && !assigned) continue
    const first = assigned?.map((row) => Date.parse(row.assignedAt)).sort((a, b) => a - b)[0]
    const transfers = (assigned ?? [])
      .filter((row): row is typeof row & { releaseReason: ReleaseReason; releasedAt: string } => !!row.releaseReason && !!row.releasedAt)
      .map((row) => ({ reason: row.releaseReason, at: Date.parse(row.releasedAt) }))
    out.push({ session, handledAt: first ?? Date.parse(session.startedAt), transfers })
  }
  return out
}

function emptyCategories(): Record<EndCategory, number> {
  return { operator: 0, customer: 0, system: 0, missed: 0 }
}
function emptyTransfers(): Record<ReleaseReason, number> {
  return { response_timeout: 0, logout_grace: 0, operator_removed: 0, reassigned: 0 }
}

function categoryOf(session: ChatSession): EndCategory | null {
  if (session.status !== 'ended') return null
  if (!session.firstStaffReplyAt) return 'missed'
  if (session.endedBy === 'customer') return 'customer'
  if (session.endedBy === 'system') return 'system'
  return 'operator'
}

function sessionMessageSplit(session: ChatSession, operatorId: string): { operator: number; customer: number } {
  if (session.transcript === 'summary') {
    const operator = Math.round(session.messageCount * 0.52)
    return { operator, customer: Math.max(0, session.messageCount - operator) }
  }
  let operator = 0
  let customer = 0
  for (const message of store.data.messages) {
    if (message.sessionId !== session.id || message.isPreChat || message.isAutoGreeting) continue
    if (message.sender === 'user') customer += 1
    else if (message.sender === 'operator' && message.senderId === operatorId) operator += 1
  }
  return { operator, customer }
}

function profileStats(operator: Operator, fromKey: string, toKey: string): OperatorProfileStats {
  const fromMs = dayStartMs(fromKey)
  const toMs = dayStartMs(toKey) + DAY_MS - 1
  const days: string[] = []
  for (let ms = fromMs; ms <= toMs; ms += DAY_MS) days.push(dayKey(ms + 3_600_000))
  const daily = new Map(days.map((date) => [date, { date, chats: 0, messages: 0 }]))

  let chatsHandled = 0
  let chatsEndedByMe = 0
  let messagesSent = 0
  let customerMessages = 0
  let firstSum = 0
  let firstN = 0
  let handleSum = 0
  let handleN = 0
  let ratingSum = 0
  let ratingCount = 0
  const endCategories = emptyCategories()
  const transfersAway = emptyTransfers()

  const rated = new Map(store.data.feedback.filter((row) => row.operatorId === operator.id).map((row) => [row.sessionId, row]))
  let earliestHistory = Number.POSITIVE_INFINITY
  for (const row of store.data.sessions) {
    if (row.tenantId === operator.tenantId) earliestHistory = Math.min(earliestHistory, Date.parse(row.startedAt))
  }

  for (const { session, handledAt, transfers } of handledBy(operator.id)) {
    for (const transfer of transfers) {
      if (transfer.at >= fromMs && transfer.at <= toMs) transfersAway[transfer.reason] += 1
    }
    if (handledAt < fromMs || handledAt > toMs) continue
    chatsHandled += 1
    const bucket = daily.get(dayKey(handledAt))
    const split = sessionMessageSplit(session, operator.id)
    messagesSent += split.operator
    customerMessages += split.customer
    if (bucket) {
      bucket.chats += 1
      bucket.messages += split.operator
    }
    if (session.firstStaffReplyAt) {
      firstSum += Math.max(5, (Date.parse(session.firstStaffReplyAt) - handledAt) / 1000)
      firstN += 1
    }
    if (session.status === 'ended' && session.endedAt) {
      handleSum += Math.max(1, (Date.parse(session.endedAt) - handledAt) / 60_000)
      handleN += 1
      if (session.endedBy === 'operator' && session.operatorId === operator.id) chatsEndedByMe += 1
      const category = categoryOf(session)
      if (category) endCategories[category] += 1
    }
    const feedback = rated.get(session.id)
    if (feedback) {
      ratingSum += feedback.rating
      ratingCount += 1
    }
  }

  /* Days older than the seeded history are filled from a seeded PRNG so 92-day ranges look lived-in. */
  const hired = Date.parse(operator.createdAt)
  for (const date of days) {
    const startMs = dayStartMs(date)
    if (startMs >= earliestHistory || startMs + DAY_MS <= hired || startMs > Date.now()) continue
    const weekday = new Date(startMs + TBILISI_OFFSET_MS).getUTCDay()
    const rnd = createRandom(`${operator.id}:${date}`)
    const weekend = weekday === 0 || weekday === 6
    if (rnd.chance(weekend ? 0.55 : 0.12)) continue
    const chats = weekend ? rnd.int(1, 4) : rnd.int(3, 9)
    const own = chats * rnd.int(7, 12)
    const theirs = Math.round(own * (0.8 + rnd.next() * 0.3))
    chatsHandled += chats
    messagesSent += own
    customerMessages += theirs
    const bucket = daily.get(date)
    if (bucket) {
      bucket.chats += chats
      bucket.messages += own
    }
    firstSum += chats * rnd.int(35, 110)
    firstN += chats
    handleSum += chats * rnd.int(6, 17)
    handleN += chats
    const byMe = Math.round(chats * (0.55 + rnd.next() * 0.2))
    chatsEndedByMe += byMe
    const customerEnds = Math.round((chats - byMe) * 0.7)
    const missed = rnd.chance(0.12) ? 1 : 0
    endCategories.operator += byMe
    endCategories.customer += customerEnds
    endCategories.system += Math.max(0, chats - byMe - customerEnds - missed)
    endCategories.missed += missed
    if (rnd.chance(0.1)) transfersAway[rnd.pick<ReleaseReason>(['response_timeout', 'logout_grace', 'reassigned'])] += 1
    const ratings = Math.round(chats * 0.55)
    ratingCount += ratings
    ratingSum += ratings * (4.1 + rnd.next() * 0.8)
  }

  const activeNow = store.data.sessions.filter(
    (row) => row.operatorId === operator.id && (row.status === 'active' || row.status === 'inactive'),
  ).length

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    timezone: 'Asia/Tbilisi',
    chatsHandled,
    chatsEndedByMe,
    activeNow,
    messagesSent,
    customerMessages,
    avgFirstResponseSeconds: firstN > 0 ? Math.round(firstSum / firstN) : null,
    avgHandlingMinutes: handleN > 0 ? Math.round((handleSum / handleN) * 10) / 10 : null,
    transfersAway,
    endCategories,
    ratingAverage: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    ratingCount,
    daily: days.map((date) => daily.get(date) ?? { date, chats: 0, messages: 0 }),
  }
}

api.register('GET', '/operator/profile/stats', ({ params }) => {
  const operator = profileOperator()
  const today = dayKey(Date.now())
  const toKey = parseKey(params.to, today)
  const fromKey = parseKey(params.from, dayKey(dayStartMs(toKey) - 6 * DAY_MS + 3_600_000))
  const span = Math.round((dayStartMs(toKey) - dayStartMs(fromKey)) / DAY_MS) + 1
  if (span < 1) throw DemoApiError.validation({ from: 'The start date must not be after the end date.' })
  if (span > MAX_RANGE_DAYS) throw DemoApiError.validation({ from: `Pick a range of at most ${MAX_RANGE_DAYS} days.` })
  return profileStats(operator, fromKey, toKey)
})

const PAGE_SIZE = 8

api.register('GET', '/operator/profile/chats', ({ params }) => {
  const operator = profileOperator()
  const q = (params.q ?? '').trim().toLowerCase()
  const page = Math.max(1, Number(params.page) || 1)
  const rows = toSummaries(
    handledBy(operator.id)
      .map((entry) => entry.session)
      .sort((left, right) => Date.parse(right.lastActivity) - Date.parse(left.lastActivity)),
  ).filter((row: SessionSummary) => {
    if (!q) return true
    return [row.customerName, row.customerNumber, row.endSummary, row.secondaryLine, row.lastMessage?.text]
      .some((value) => !!value && value.toLowerCase().includes(q))
  })
  const result: Paginated<SessionSummary> = {
    rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: rows.length,
    page,
    pageSize: PAGE_SIZE,
  }
  return result
})
