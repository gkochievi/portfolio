/**
 * Every mutation of chat state goes through here. Each function mutates
 * `store.data`, broadcasts the matching ChitiEvents with full entities (so
 * other tabs mirror them) and logs activity where the product does:
 * customer_login, operator_claim_session, operator/admin_end_session,
 * customer_disconnect, operator_return_to_queue, admin_intervention_start/stop,
 * operator_pause/resume and admin_force_operator_status. Handlers log the rest.
 */
import { conflict, DemoApiError, notFound } from '@portfolio/demo-kit'

import { BOT_ALLOWED, computeWindow, NUMBER_PREFIX, TIKTOK_CAP } from '@/lib/channels'
import { computeStatus } from '@/lib/workingHours'
import type {
  ActivityAction,
  ActivityLog,
  AssignedVia,
  Channel,
  ChannelWindowState,
  ChatSession,
  ContentLang,
  CopilotRef,
  Customer,
  DeliveryStatus,
  DemoControls,
  EndedBy,
  EndReason,
  FailureKind,
  FaqStep,
  HandoffReason,
  LocalizedText,
  Message,
  MessageFile,
  MessageLocation,
  MessagePreview,
  MessageSender,
  MessageType,
  Operator,
  OperatorBrief,
  OperatorStatus,
  ReleaseReason,
  SessionDetail,
  SessionOrigin,
  SessionSummary,
  SessionTopic,
  TypingState,
  WorkingHoursStatus,
} from '@/types'

import { broadcast } from './bus'
import { nowIso } from './clock'
import { currentAccount, staffIp, tenantSettings } from './context'
import { buildTranscript, endSummaryFor, handoffBrief, sectionOf } from './seed'
import { newId, store } from './store'

const db = () => store.data

/* ----------------------------------------------------------------- lookups */

export function getSession(sessionId: string): ChatSession {
  const session = db().sessions.find((row) => row.id === sessionId)
  if (!session) throw notFound('Chat not found.')
  return session
}

export function getOperator(operatorId: string | null | undefined): Operator | undefined {
  return operatorId ? db().operators.find((row) => row.id === operatorId) : undefined
}

export function getCustomer(customerId: string): Customer | undefined {
  return db().customers.find((row) => row.id === customerId)
}

export function operatorBrief(operator: Operator): OperatorBrief {
  return {
    id: operator.id,
    name: { ...operator.name },
    nickname: operator.nickname,
    operatorNumber: operator.operatorNumber,
    avatarId: operator.avatarId,
    avatarUrl: operator.avatarUrl,
    status: operator.status,
  }
}

/** Tenant content in a content language, falling back to en, then ka. */
export function pickContent(text: LocalizedText, lang: ContentLang): string {
  return (lang === 'ru' ? text.ru : text[lang]) || text.en || text.ka
}

export function messagesOf(sessionId: string): Message[] {
  return db().messages.filter((row) => row.sessionId === sessionId).sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

export function aiOutageActive(now = Date.now()): boolean {
  const until = db().demo.aiOutageUntil
  return !!until && Date.parse(until) > now
}

/** Chats the operator currently holds (active + inactive). */
export function operatorLoad(operatorId: string): number {
  return db().sessions.filter((row) => row.operatorId === operatorId && (row.status === 'active' || row.status === 'inactive')).length
}

function syncLoad(operatorId: string | null | undefined): void {
  const operator = getOperator(operatorId)
  if (!operator) return
  const load = operatorLoad(operator.id)
  if (operator.activeChatCount === load) return
  operator.activeChatCount = load
  broadcast('operator:upsert', operator)
}

/* ---------------------------------------------------------------- activity */

export type ActivityInput = Pick<ActivityLog, 'action'> & Partial<Omit<ActivityLog, 'id' | 'createdAt' | 'action'>>

/**
 * Append an audit row. Only `action` is required: section comes from the
 * action, actor and tenant from the signed-in account, IP from the account.
 */
export function logActivity(input: ActivityInput): ActivityLog {
  const account = currentAccount()
  const row: ActivityLog = {
    id: newId('act_'),
    tenantId: input.tenantId ?? account?.tenantId ?? '',
    action: input.action,
    section: input.section ?? sectionOf(input.action),
    actorRole: input.actorRole ?? account?.role ?? 'system',
    actorId: input.actorId !== undefined ? input.actorId : (account?.staffId ?? null),
    actorName: input.actorName ?? account?.name ?? 'System',
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress !== undefined ? input.ipAddress : staffIp(account),
    createdAt: nowIso(),
  }
  db().activity.unshift(row)
  broadcast('activity:new', row)
  return row
}

/** Operator actions are attributed to the operator (also when a timer triggers them); others to the caller or the system. */
function actorFor(operator: Operator | undefined, action: ActivityAction): ActivityInput {
  if (operator) return { action, actorRole: 'operator', actorId: operator.id, actorName: operator.name.en, tenantId: operator.tenantId, ipAddress: staffIp(operator) }
  const account = currentAccount()
  if (account && account.role !== 'customer') return { action }
  return { action, actorRole: 'system', actorId: null, actorName: 'System', ipAddress: null }
}

/* ------------------------------------------------------------ view models */

export function workingHoursStatus(tenantId: string): WorkingHoursStatus {
  const hours = db().workingHours.find((row) => row.tenantId === tenantId)
  if (!hours) return { isOpen: true, reason: 'schedule', nextOpen: null, todayStart: null, todayEnd: null }
  return computeStatus(hours, new Date())
}

export function channelWindow(session: ChatSession): ChannelWindowState {
  return computeWindow(session)
}

function previewOf(message: Message | undefined, session: ChatSession): MessagePreview | null {
  if (message) {
    return {
      type: message.type,
      sender: message.sender,
      text: message.content || message.file?.name || (message.location?.label ?? ''),
      timestamp: message.timestamp,
    }
  }
  if (session.endSummary) {
    return { type: 'text', sender: 'system', text: session.endSummary, timestamp: session.endedAt ?? session.lastActivity }
  }
  return null
}

function secondaryLine(session: ChatSession, customer: Customer | undefined): string | null {
  const phone = session.customFields.find((field) => field.fieldId.endsWith('phone'))
  if (phone) return phone.value
  const other = session.customFields.find((field) => field.value && field.value !== session.customerName)
  if (other) return other.value
  return customer?.externalContact?.username ?? customer?.externalContact?.displayName ?? null
}

/** Summaries for many sessions at once (one pass over messages/feedback). */
export function toSummaries(sessions: ChatSession[]): SessionSummary[] {
  const wanted = new Set(sessions.map((session) => session.id))
  const last = new Map<string, Message>()
  for (const message of db().messages) {
    if (!wanted.has(message.sessionId) || message.isPreChat) continue
    const previous = last.get(message.sessionId)
    if (!previous || Date.parse(previous.timestamp) <= Date.parse(message.timestamp)) last.set(message.sessionId, message)
  }
  const ratings = new Map<string, number>()
  for (const row of db().feedback) if (wanted.has(row.sessionId)) ratings.set(row.sessionId, row.rating)
  const customers = new Map(db().customers.map((row) => [row.id, row]))
  const operators = new Map(db().operators.map((row) => [row.id, row]))
  return sessions.map((session) => {
    const customer = customers.get(session.customerId)
    const operator = session.operatorId ? operators.get(session.operatorId) : undefined
    return {
      ...session,
      operator: operator ? operatorBrief(operator) : null,
      lastMessage: previewOf(last.get(session.id), session),
      secondaryLine: secondaryLine(session, customer),
      externalContact: customer?.externalContact ?? null,
      rating: ratings.get(session.id) ?? null,
    }
  })
}

export function toSummary(session: ChatSession): SessionSummary {
  return toSummaries([session])[0] as SessionSummary
}

export function sessionDetail(sessionId: string): SessionDetail {
  const session = getSession(sessionId)
  const customer = getCustomer(session.customerId)
  if (!customer) throw notFound('Customer not found.')
  const operator = getOperator(session.operatorId)
  const admin = session.interventionAdminId ? db().admins.find((row) => row.id === session.interventionAdminId) : undefined
  return {
    session,
    customer,
    operator: operator ? operatorBrief(operator) : null,
    assignments: db().assignments.filter((row) => row.sessionId === sessionId).sort((left, right) => Date.parse(left.assignedAt) - Date.parse(right.assignedAt)),
    window: computeWindow(session),
    feedback: db().feedback.find((row) => row.sessionId === sessionId) ?? null,
    interventionAdmin: admin ? { id: admin.id, name: { ...admin.name } } : null,
  }
}

/**
 * Messages of a session, oldest first. History sessions stored as
 * `transcript: 'summary'` get a deterministic transcript generated and cached
 * on first read (same ids in every tab, so it is not broadcast).
 */
export function ensureTranscript(sessionId: string): Message[] {
  const session = getSession(sessionId)
  const existing = messagesOf(sessionId)
  if (session.transcript === 'full' || existing.length > 0) return existing
  const operator = getOperator(session.operatorId)
  const settings = tenantSettings(session.tenantId)
  const greeting = operator && settings.autoGreetingEnabled ? pickContent(settings.autoGreeting, session.clientLanguage) : null
  const generated = buildTranscript(session, operator ? { id: operator.id, nickname: operator.nickname } : null, greeting)
  db().messages.push(...generated)
  session.transcript = 'full'
  session.messageCount = generated.length
  return generated
}

/* ----------------------------------------------------------- widget entry */

const TOPIC_FROM_FIELD: Record<string, SessionTopic> = {
  delivery: 'delivery', order: 'order_status', returns: 'returns', payment: 'payment', other: 'other',
}

function anonNumber(): string {
  return `anon-${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
}

/** Is the AI bot allowed to answer first on this tenant + channel right now? */
export function botFirst(tenantId: string, channel: Channel): boolean {
  const settings = tenantSettings(tenantId)
  const link = db().aiLinks.find((row) => row.tenantId === tenantId)
  return settings.aiBotEnabled && BOT_ALLOWED[channel] && !!link?.aiClientId && link.aiBotEnabled && !aiOutageActive()
}

export function createWidgetSession(input: {
  tenantId: string
  fields: Record<string, string>
  faqPath: FaqStep[]
  language: ContentLang
  clientIp: string
  origin: SessionOrigin
  channel?: Channel
  customerName?: string
}): { customer: Customer; session: ChatSession } {
  const settings = tenantSettings(input.tenantId)
  const definitions = db().customFields
    .filter((field) => field.tenantId === input.tenantId && field.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const customFields = definitions
    .filter((field) => (input.fields[field.id] ?? '').trim())
    .map((field) => ({ fieldId: field.id, label: { ...field.label }, value: (input.fields[field.id] ?? '').trim() }))
  const channel: Channel = input.channel ?? 'web_widget'
  const name = input.customerName?.trim() || customFields[0]?.value || 'Visitor'
  const now = nowIso()
  const sessionId = newId('ses_')
  const phone = customFields.find((field) => field.fieldId.endsWith('phone'))?.value ?? ''
  const number = channel === 'web_widget'
    ? anonNumber()
    : `${NUMBER_PREFIX[channel]}:${phone.replace(/\D/g, '') || Math.floor(Math.random() * 1e12)}`

  const customer: Customer = {
    id: newId('cus_'),
    tenantId: input.tenantId,
    name,
    number,
    channel,
    status: 'waiting',
    activeSessionId: sessionId,
    fields: { ...input.fields },
    externalContact: null,
    language: input.language,
    createdAt: now,
  }
  const bot = botFirst(input.tenantId, channel)
  const topicValue = input.fields.cf_topic ?? Object.entries(input.fields).find(([key]) => key.endsWith('topic'))?.[1]
  const session: ChatSession = {
    id: sessionId,
    tenantId: input.tenantId,
    customerId: customer.id,
    customerName: name,
    customerNumber: number,
    channel,
    status: 'waiting',
    origin: input.origin,
    topic: (topicValue && TOPIC_FROM_FIELD[topicValue]) || 'other',
    startedAt: now,
    lastActivity: now,
    endedAt: null,
    endedBy: null,
    endReason: null,
    endSummary: null,
    warningIssuedAt: null,
    inactiveSince: null,
    operatorId: null,
    excludedOperatorIds: [],
    clientIp: settings.clientIpEnabled ? input.clientIp : null,
    clientLanguage: input.language,
    faqPath: input.faqPath.map((step) => ({ ...step })),
    customFields,
    firstStaffReplyAt: null,
    lastInboundAt: channel === 'web_widget' ? null : now,
    consecutiveBusinessMessages: 0,
    externalThreadId: channel === 'web_widget' ? null : `thr_${sessionId}`,
    adminInterventionActive: false,
    interventionAdminId: null,
    aiState: bot ? 'bot' : null,
    aiHandoff: null,
    unreadCount: 0,
    messageCount: 0,
    transcript: 'full',
  }
  db().customers.push(customer)
  db().sessions.push(session)
  broadcast('customer:upsert', customer)
  broadcast('session:upsert', session)

  // The FAQ walk is stored as pre-chat bubbles (bot question, customer answer).
  const startMs = Date.now() - input.faqPath.length * 2_000
  input.faqPath.forEach((step, index) => {
    const at = startMs + index * 2_000
    pushMessage(session, { sender: 'bot', senderName: 'Chiti Assistant', content: step.question, isPreChat: true }, new Date(at).toISOString())
    pushMessage(session, { sender: 'user', senderId: customer.id, senderName: name, content: step.answer, isPreChat: true }, new Date(at + 1_000).toISOString())
  })
  broadcast('session:upsert', session)

  logActivity({
    action: 'customer_login', tenantId: input.tenantId, actorRole: 'customer', actorId: customer.id, actorName: name,
    targetId: session.id, targetLabel: name, metadata: { channel }, ipAddress: input.clientIp,
  })
  if (!bot) autoAssign(input.tenantId)
  return { customer, session }
}

/* ---------------------------------------------------------------- messages */

export interface PostMessageInput {
  sender: MessageSender
  senderId?: string | null
  senderName?: string | null
  type?: MessageType
  content: string
  file?: MessageFile | null
  location?: MessageLocation | null
  citations?: string[]
  copilotRef?: CopilotRef | null
  template?: Message['template']
  isPreChat?: boolean
  isAutoGreeting?: boolean
  sentByAdmin?: boolean
}

function inferType(input: PostMessageInput): MessageType {
  if (input.type) return input.type
  if (input.template) return 'template'
  if (input.location) return 'location'
  if (input.file) {
    if (input.file.mimeType.startsWith('image/')) return 'image'
    if (input.file.mimeType.startsWith('audio/')) return 'audio'
    return 'file'
  }
  return 'text'
}

/** Where a staff send fails on this channel right now (window closed, TikTok cap), or null. */
export function sendBlocker(session: ChatSession, type: MessageType): FailureKind | null {
  if (session.channel === 'web_widget') return null
  const window = computeWindow(session)
  if (!window.open && type !== 'template') return 'window_closed'
  if (session.channel === 'tiktok' && session.consecutiveBusinessMessages >= TIKTOK_CAP) return 'cap_reached'
  return null
}

function pushMessage(session: ChatSession, input: PostMessageInput, timestamp = nowIso()): Message {
  const type = inferType(input)
  const staff = input.sender === 'operator' || input.sender === 'admin'
  const failure = staff && !input.isAutoGreeting ? sendBlocker(session, type) : null
  const deliveryStatus: DeliveryStatus = failure ? 'failed' : input.sender === 'user' ? 'delivered' : 'sent'
  const message: Message = {
    id: newId('msg_'),
    tenantId: session.tenantId,
    sessionId: session.id,
    sender: input.sender,
    senderId: input.senderId ?? null,
    senderName: input.senderName ?? null,
    type,
    content: input.content,
    file: input.file ?? null,
    location: input.location ?? null,
    sentByAdmin: input.sentByAdmin ?? input.sender === 'admin',
    timestamp,
    deliveryStatus,
    failureKind: failure,
    seenAt: null,
    reactionEmoji: null,
    channel: session.channel,
    isPreChat: input.isPreChat ?? false,
    isAutoGreeting: input.isAutoGreeting ?? false,
    citations: input.citations ?? [],
    copilotRef: input.copilotRef ?? null,
    template: input.template ?? null,
  }
  db().messages.push(message)

  session.lastActivity = timestamp
  session.messageCount += 1
  session.warningIssuedAt = null
  if (input.sender === 'user' && !message.isPreChat) {
    session.lastInboundAt = timestamp
    session.consecutiveBusinessMessages = 0
    session.unreadCount += 1
    if (session.status === 'inactive') {
      session.status = 'active'
      session.inactiveSince = null
    }
  }
  if (staff && !failure) {
    session.consecutiveBusinessMessages += 1
    if (!session.firstStaffReplyAt && !message.isAutoGreeting) session.firstStaffReplyAt = timestamp
    if (session.status === 'inactive') {
      session.status = 'active'
      session.inactiveSince = null
    }
  }
  broadcast('message:upsert', message)
  return message
}

/**
 * Add a message and update the session counters (lastActivity, lastInboundAt,
 * consecutiveBusinessMessages, unreadCount, firstStaffReplyAt, messageCount;
 * resets inactivity). Staff sends on a closed window / at the TikTok cap are
 * stored as `failed` with a failureKind. 423 while an admin intervention is
 * active and the operator tries to write.
 */
export function postMessage(sessionId: string, input: PostMessageInput): Message {
  const session = getSession(sessionId)
  if (session.status === 'ended') throw conflict('This chat has ended.')
  if (input.sender === 'operator' && session.adminInterventionActive && !input.isAutoGreeting) {
    throw new DemoApiError(423, 'An admin has taken over this chat. Your composer is locked until they hand it back.')
  }
  const message = pushMessage(session, input)
  broadcast('session:upsert', session)
  return message
}

export function getMessage(messageId: string): Message {
  const message = db().messages.find((row) => row.id === messageId)
  if (!message) throw notFound('Message not found.')
  return message
}

export function setMessageStatus(messageId: string, status: DeliveryStatus): Message {
  const message = getMessage(messageId)
  message.deliveryStatus = status
  if (status === 'read' && !message.seenAt) message.seenAt = nowIso()
  if (status !== 'failed') message.failureKind = null
  broadcast('message:upsert', message)
  return message
}

/** Retry a failed staff send: re-checks the window/cap; 'sent' when it now goes through. */
export function retryMessage(messageId: string): Message {
  const message = getMessage(messageId)
  const session = getSession(message.sessionId)
  if (message.deliveryStatus !== 'failed') return message
  const failure = message.failureKind === 'network' ? null : sendBlocker(session, message.type)
  if (failure) {
    message.failureKind = failure
    broadcast('message:upsert', message)
    return message
  }
  message.deliveryStatus = 'sent'
  message.failureKind = null
  message.timestamp = nowIso()
  session.consecutiveBusinessMessages += 1
  session.lastActivity = message.timestamp
  broadcast('message:upsert', message)
  broadcast('session:upsert', session)
  return message
}

export function setReaction(messageId: string, emoji: string | null): Message {
  const message = getMessage(messageId)
  message.reactionEmoji = emoji
  broadcast('message:upsert', message)
  return message
}

/** Typing indicators are not stored, only broadcast (to other tabs too). */
export function setTyping(state: TypingState): void {
  broadcast('typing:update', state)
}

/** 'customer' marks staff/bot messages read; 'staff' clears the operator's unread count. */
export function markSeen(sessionId: string, by: 'customer' | 'staff'): void {
  const session = getSession(sessionId)
  const now = nowIso()
  for (const message of db().messages) {
    if (message.sessionId !== sessionId || message.seenAt) continue
    const fromStaff = message.sender !== 'user'
    if ((by === 'customer' && fromStaff) || (by === 'staff' && !fromStaff)) {
      message.seenAt = now
      if (by === 'customer' && message.deliveryStatus !== 'failed') message.deliveryStatus = 'read'
      broadcast('message:upsert', message)
    }
  }
  if (by === 'staff' && session.unreadCount !== 0) {
    session.unreadCount = 0
    broadcast('session:upsert', session)
  }
}

/* ---------------------------------------------------------------- routing */

function greet(session: ChatSession, operator: Operator): void {
  const settings = tenantSettings(session.tenantId)
  if (!settings.autoGreetingEnabled) return
  if (session.channel !== 'web_widget' && !computeWindow(session).open) return
  pushMessage(session, {
    sender: 'operator', senderId: operator.id, senderName: operator.nickname,
    content: pickContent(settings.autoGreeting, session.clientLanguage), isAutoGreeting: true,
  })
}

/**
 * Give a waiting chat to an operator. `claim` enforces the chat limit (409);
 * bot-owned chats are handed off with reason operator_claim; writes the
 * assignment row and sends the auto-greeting.
 */
export function claimSession(sessionId: string, operatorId: string, via: AssignedVia): ChatSession {
  const session = getSession(sessionId)
  if (session.status !== 'waiting') throw conflict('Someone already took this chat.')
  const operator = getOperator(operatorId)
  if (!operator || operator.tenantId !== session.tenantId) throw notFound('Operator not found.')
  const settings = tenantSettings(session.tenantId)
  if (via === 'claim' && settings.operatorChatLimit > 0 && operatorLoad(operator.id) >= settings.operatorChatLimit) {
    throw conflict(`You are at your limit of ${settings.operatorChatLimit} chats. Finish one to take another.`)
  }
  const now = nowIso()
  if (session.aiState === 'bot') {
    const brief = handoffBrief(session)
    session.aiState = 'handed_off'
    session.aiHandoff = { at: now, reason: 'operator_claim', summary: brief.summary, goal: brief.goal, source: 'operator' }
  }
  session.status = 'active'
  session.operatorId = operator.id
  session.inactiveSince = null
  session.warningIssuedAt = null
  session.lastActivity = now

  const assignment = {
    id: newId('asg_'), sessionId, operatorId: operator.id, operatorName: { ...operator.name }, assignedVia: via,
    assignedAt: now, releasedAt: null, releaseReason: null,
  }
  db().assignments.push(assignment)
  const customer = getCustomer(session.customerId)
  if (customer) {
    customer.status = 'connected'
    customer.activeSessionId = session.id
    broadcast('customer:upsert', customer)
  }
  greet(session, operator)
  broadcast('session:upsert', session)
  broadcast('assignment:upsert', assignment)
  syncLoad(operator.id)
  if (via === 'claim') {
    logActivity({ ...actorFor(operator, 'operator_claim_session'), tenantId: session.tenantId, targetId: session.id, targetLabel: session.customerName })
  }
  return session
}

/** Bot → human: aiState bot → handed_off with the briefing; the chat stays in the queue. */
export function handoff(sessionId: string, reason: HandoffReason, summary?: string, goal?: string): ChatSession {
  const session = getSession(sessionId)
  if (session.aiState !== 'bot') return session
  const brief = handoffBrief(session)
  const source = reason === 'customer_request' ? 'customer' : reason === 'operator_claim' ? 'operator'
    : reason === 'circuit_open' || reason === 'bot_paused' || reason === 'delivery_failed' ? 'system' : 'bot'
  session.aiState = 'handed_off'
  session.aiHandoff = { at: nowIso(), reason, summary: summary ?? brief.summary, goal: goal ?? brief.goal, source }
  broadcast('session:upsert', session)
  autoAssign(session.tenantId)
  return session
}

export function endSession(sessionId: string, by: EndedBy, reason: EndReason): ChatSession {
  const session = getSession(sessionId)
  if (session.status === 'ended') return session
  const operator = getOperator(session.operatorId)
  const now = nowIso()
  session.status = 'ended'
  session.endedAt = now
  session.endedBy = by
  session.endReason = reason
  session.lastActivity = now
  session.endSummary ??= endSummaryFor(session.topic, session.clientLanguage, !session.operatorId ? 'missed' : reason === 'inactivity' ? 'silent' : 'done')
  if (session.aiState) session.aiState = 'closed'
  session.adminInterventionActive = false
  session.interventionAdminId = null
  session.warningIssuedAt = null
  session.unreadCount = 0
  const customer = getCustomer(session.customerId)
  if (customer) {
    customer.status = 'disconnected'
    customer.activeSessionId = null
    broadcast('customer:upsert', customer)
  }
  broadcast('session:upsert', session)
  syncLoad(operator?.id)

  const target = { tenantId: session.tenantId, targetId: session.id, targetLabel: session.customerName, metadata: { reason } }
  if (by === 'operator') logActivity({ ...actorFor(operator, 'operator_end_session'), ...target })
  else if (by === 'admin') logActivity({ action: 'admin_end_session', ...target })
  else if (by === 'customer') {
    logActivity({ action: 'customer_disconnect', ...target, actorRole: 'customer', actorId: session.customerId, actorName: session.customerName, ipAddress: session.clientIp })
  }
  autoAssign(session.tenantId)
  return session
}

/** Back to the queue (response timeout, logout grace, removed operator, reassignment). */
export function requeueSession(sessionId: string, reason: ReleaseReason, excludeOperator: boolean): ChatSession {
  const session = getSession(sessionId)
  if (session.status === 'ended') throw conflict('This chat has ended.')
  const previous = getOperator(session.operatorId)
  const now = nowIso()
  for (const assignment of db().assignments) {
    if (assignment.sessionId !== sessionId || assignment.releasedAt) continue
    assignment.releasedAt = now
    assignment.releaseReason = reason
    broadcast('assignment:upsert', assignment)
  }
  if (excludeOperator && previous && !session.excludedOperatorIds.includes(previous.id)) session.excludedOperatorIds.push(previous.id)
  session.operatorId = null
  session.status = 'waiting'
  session.adminInterventionActive = false
  session.interventionAdminId = null
  session.inactiveSince = null
  session.warningIssuedAt = null
  session.lastActivity = now
  const customer = getCustomer(session.customerId)
  if (customer) {
    customer.status = 'waiting'
    broadcast('customer:upsert', customer)
  }
  broadcast('session:upsert', session)
  syncLoad(previous?.id)
  logActivity({
    ...actorFor(previous, 'operator_return_to_queue'), tenantId: session.tenantId, targetId: session.id, targetLabel: session.customerName,
    metadata: { reason, excluded: excludeOperator },
  })
  autoAssign(session.tenantId)
  return session
}

/** Admin takes over (adminId) or hands back (null). Needs an assigned operator. */
export function setIntervention(sessionId: string, adminId: string | null): ChatSession {
  const session = getSession(sessionId)
  if (adminId && !session.operatorId) throw conflict('You can step in only when an operator is assigned.')
  if (session.status === 'ended') throw conflict('This chat has ended.')
  const active = adminId !== null
  if (session.adminInterventionActive === active && session.interventionAdminId === adminId) return session
  session.adminInterventionActive = active
  session.interventionAdminId = adminId
  broadcast('session:upsert', session)
  logActivity({
    action: active ? 'admin_intervention_start' : 'admin_intervention_stop', tenantId: session.tenantId,
    targetId: session.id, targetLabel: session.customerName,
  })
  return session
}

/** Clear the inactivity warning (customer pressed "Got it" or wrote again). */
export function acknowledgeWarning(sessionId: string): ChatSession {
  const session = getSession(sessionId)
  session.warningIssuedAt = null
  session.lastActivity = nowIso()
  if (session.status === 'inactive') {
    session.status = 'active'
    session.inactiveSince = null
  }
  broadcast('session:upsert', session)
  return session
}

export function setOperatorStatus(operatorId: string, status: OperatorStatus, by: 'self' | 'admin'): Operator {
  const operator = getOperator(operatorId)
  if (!operator) throw notFound('Operator not found.')
  const previous = operator.status
  const now = nowIso()
  operator.status = status
  operator.lastSeen = now
  if (status === 'away') {
    operator.pausedAt = now
    operator.pausedBy = by
  } else {
    operator.pausedAt = null
    operator.pausedBy = null
  }
  broadcast('operator:upsert', operator)
  if (previous !== status) {
    const target = { tenantId: operator.tenantId, targetId: operator.id, targetLabel: operator.name.en, metadata: { from: previous, to: status } }
    if (by === 'admin') logActivity({ action: 'admin_force_operator_status', ...target })
    else if (status === 'away') logActivity({ ...actorFor(operator, 'operator_pause'), ...target })
    else if (status === 'online' && previous === 'away') logActivity({ ...actorFor(operator, 'operator_resume'), ...target })
  }
  if (status === 'online') autoAssign(operator.tenantId)
  return operator
}

const lastAssigned = new Map<string, string>()

/**
 * Auto-assignment (only when operatorEnterDirectly): waiting, non-bot chats,
 * oldest first, to online operators under the limit and not excluded,
 * picked by ordered | round_robin | random | least_busy.
 */
export function autoAssign(tenantId: string): void {
  const settings = tenantSettings(tenantId)
  if (!settings.operatorEnterDirectly) return
  const waiting = db().sessions
    .filter((row) => row.tenantId === tenantId && row.status === 'waiting' && row.aiState !== 'bot')
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  for (const session of waiting) {
    const candidates = db().operators
      .filter((row) => row.tenantId === tenantId && row.status === 'online' && !session.excludedOperatorIds.includes(row.id))
      .filter((row) => settings.operatorChatLimit === 0 || operatorLoad(row.id) < settings.operatorChatLimit)
      .sort((left, right) => left.operatorNumber.localeCompare(right.operatorNumber))
    if (candidates.length === 0) continue
    let chosen = candidates[0] as Operator
    if (settings.chatDistributionStrategy === 'round_robin') {
      const lastIndex = candidates.findIndex((row) => row.id === lastAssigned.get(tenantId))
      chosen = candidates[(lastIndex + 1) % candidates.length] as Operator
    } else if (settings.chatDistributionStrategy === 'random') {
      chosen = candidates[Math.floor(Math.random() * candidates.length)] as Operator
    } else if (settings.chatDistributionStrategy === 'least_busy') {
      const today = (id: string) => db().assignments.filter((row) => row.operatorId === id && Date.parse(row.assignedAt) >= startOfDay.getTime()).length
      chosen = [...candidates].sort((left, right) => today(left.id) - today(right.id) || operatorLoad(left.id) - operatorLoad(right.id))[0] as Operator
    }
    lastAssigned.set(tenantId, chosen.id)
    claimSession(session.id, chosen.id, 'auto_assign')
  }
}

export function updateDemoControls(patch: Partial<DemoControls>): DemoControls {
  Object.assign(db().demo, patch)
  broadcast('demo:controls', db().demo)
  return db().demo
}
