/**
 * Inbox endpoints (owner: inbox): the operator's queue + "My chats", the
 * conversation pane (detail, messages, send, typing, seen, finish, retry,
 * reactions) and the "simulate response timeout" demo button.
 */
import { DemoApiError, conflict, forbidden, notFound } from '@portfolio/demo-kit'

import type { ChatSession, CopilotRef, Message, MessageFile, MessageLocation, SessionSummary } from '@/types'
import type { ChannelFilter, InboxResponse, MessagesResponse, SendMessageBody } from '@/features/inbox/types'
import { CHANNEL_MEDIA } from '@/lib/channels'

import { api } from '../api'
import { currentOperator, currentTenantId, findSession, requireRole, tenantSettings } from '../context'
import { nowIso } from '../clock'
import {
  ensureTranscript,
  endSession,
  claimSession,
  getMessage,
  markSeen,
  operatorLoad,
  postMessage,
  requeueSession,
  retryMessage,
  sessionDetail,
  setReaction,
  setTyping,
  toSummaries,
  toSummary,
} from '../engine'
import { newId, store } from '../store'

const PAGE_SIZE = 40
const MAX_LENGTH = 4000

/** A chat the signed-in operator holds (403 otherwise). */
function ownSession(sessionId: string): ChatSession {
  const operator = currentOperator()
  const session = findSession(sessionId)
  if (session.operatorId !== operator.id) throw forbidden('This chat is assigned to someone else.')
  return session
}

const byStart = (left: ChatSession, right: ChatSession) => Date.parse(left.startedAt) - Date.parse(right.startedAt)
const byActivity = (left: ChatSession, right: ChatSession) => Date.parse(right.lastActivity) - Date.parse(left.lastActivity)

function emptyCounts(): Record<ChannelFilter, number> {
  return { all: 0, web_widget: 0, whatsapp: 0, telegram: 0, facebook_messenger: 0, instagram: 0, tiktok: 0, bot: 0 }
}

api.register('GET', '/operator/inbox', (): InboxResponse => {
  const operator = currentOperator()
  const tenantId = currentTenantId()
  const settings = tenantSettings(tenantId)
  const sessions = store.data.sessions.filter((row) => row.tenantId === tenantId)
  const waiting = sessions
    .filter((row) => row.status === 'waiting' && !row.excludedOperatorIds.includes(operator.id))
    .sort(byStart)
  const mine = sessions
    .filter((row) => row.operatorId === operator.id && (row.status === 'active' || row.status === 'inactive'))
    .sort(byActivity)
  const counts = emptyCounts()
  for (const row of [...waiting, ...mine]) {
    counts.all += 1
    counts[row.channel] += 1
    if (row.aiState === 'bot') counts.bot += 1
  }
  const summaries = toSummaries([...waiting, ...mine])
  const queue: SessionSummary[] = summaries.slice(0, waiting.length)
  return {
    queue,
    mine: summaries.slice(waiting.length),
    channelCounts: counts,
    limit: settings.operatorChatLimit,
    activeCount: operatorLoad(operator.id),
    autoAssign: settings.operatorEnterDirectly,
    typingTransparency: settings.typingTransparency,
    strategy: settings.chatDistributionStrategy,
  }
})

/** Shared read: operators see their own, waiting and ended chats; admins and supervisors any chat of the tenant. */
function readableSession(sessionId: string): ChatSession {
  const account = requireRole('operator', 'admin', 'supervisor')
  const session = findSession(sessionId)
  if (account.role === 'operator') {
    const mineOrOpen = session.operatorId === account.staffId || session.status === 'waiting' || session.status === 'ended'
    if (!mineOrOpen) throw forbidden('This chat is assigned to someone else.')
  }
  return session
}

api.register('GET', '/sessions/:id', ({ path }) => {
  const session = readableSession(path.id as string)
  return sessionDetail(session.id)
})

api.register('GET', '/sessions/:id/messages', ({ path, params }): MessagesResponse => {
  const session = readableSession(path.id as string)
  const limit = Math.min(100, Math.max(1, Number(params.limit) || PAGE_SIZE))
  const before = params.before ? Date.parse(params.before) : Number.POSITIVE_INFINITY
  const all = [...ensureTranscript(session.id)].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const older = all.filter((row) => Date.parse(row.timestamp) < before)
  return { messages: older.slice(-limit), hasMore: older.length > limit }
})

api.register('POST', '/sessions/:id/claim', ({ path }) => {
  const operator = currentOperator()
  const session = findSession(path.id as string)
  if (operator.status !== 'online') throw conflict('You are away. Go online to take chats.')
  if (session.excludedOperatorIds.includes(operator.id)) throw forbidden('This chat was returned to the queue from you.')
  claimSession(session.id, operator.id, 'claim')
  return toSummary(session)
})

function parseFile(value: unknown): MessageFile | null {
  if (!value) return null
  const file = value as Partial<MessageFile>
  if (typeof file.url !== 'string' || typeof file.name !== 'string' || typeof file.mimeType !== 'string') {
    throw DemoApiError.validation({ file: 'This file could not be attached.' })
  }
  return { url: file.url, name: file.name, mimeType: file.mimeType, size: Number(file.size) || 0 }
}

function parseLocation(value: unknown): MessageLocation | null {
  if (!value) return null
  const location = value as Partial<MessageLocation>
  if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw DemoApiError.validation({ location: 'This location could not be shared.' })
  }
  return { lat: location.lat, lng: location.lng, label: typeof location.label === 'string' ? location.label : null }
}

function parseCopilotRef(value: unknown): CopilotRef | null {
  if (!value) return null
  const ref = value as Partial<CopilotRef>
  if (typeof ref.draftId !== 'string') return null
  return {
    draftId: ref.draftId,
    variantIndex: Number(ref.variantIndex) || 0,
    action: ref.action === 'edited_sent' ? 'edited_sent' : 'sent_asis',
  }
}

api.register('POST', '/sessions/:id/messages', ({ path, body }): Message => {
  const operator = currentOperator()
  const session = ownSession(path.id as string)
  const input = (body ?? {}) as Partial<SendMessageBody>
  const content = (input.content ?? '').trim()
  const file = parseFile(input.file)
  const location = parseLocation(input.location)
  if (!content && !file && !location) throw DemoApiError.validation({ content: 'Write a message first.' })
  if (content.length > MAX_LENGTH) throw DemoApiError.validation({ content: `Messages can be up to ${MAX_LENGTH} characters.` })
  const media = CHANNEL_MEDIA[session.channel]
  if (location && !media.location) throw DemoApiError.validation({ location: 'This channel does not support sharing a location.' })
  if (file && file.mimeType === 'application/pdf' && !media.pdf) throw DemoApiError.validation({ file: 'This channel does not accept PDF files.' })
  const copilotRef = parseCopilotRef(input.copilotRef)

  const message = postMessage(session.id, {
    sender: 'operator',
    senderId: operator.id,
    senderName: operator.nickname,
    content,
    file,
    location,
    copilotRef,
  })
  if (copilotRef) {
    store.data.copilotFeedback.push({
      id: newId('cpf_'),
      sessionId: session.id,
      draftId: copilotRef.draftId,
      action: copilotRef.action,
      variantIndex: copilotRef.variantIndex,
      finalText: content,
      at: nowIso(),
    })
  }
  return message
})

api.register('POST', '/sessions/:id/typing', ({ path, body }) => {
  const operator = currentOperator()
  const session = ownSession(path.id as string)
  const isTyping = !!(body as { isTyping?: boolean } | null)?.isTyping
  setTyping({ sessionId: session.id, who: 'operator', isTyping, draft: null, name: operator.nickname })
  return { ok: true }
})

api.register('POST', '/sessions/:id/seen', ({ path }) => {
  const session = ownSession(path.id as string)
  markSeen(session.id, 'staff')
  return { ok: true }
})

api.register('POST', '/sessions/:id/finish', ({ path }) => {
  const session = ownSession(path.id as string)
  if (session.status === 'ended') throw conflict('This chat has already ended.')
  endSession(session.id, 'operator', 'manual')
  return toSummary(session)
})

api.register('POST', '/sessions/:id/messages/:messageId/retry', ({ path }): Message => {
  const session = ownSession(path.id as string)
  const message = getMessage(path.messageId as string)
  if (message.sessionId !== session.id) throw notFound('Message not found.')
  if (message.sender !== 'operator' && message.sender !== 'admin') throw forbidden('Only staff messages can be sent again.')
  return retryMessage(message.id)
})

api.register('POST', '/sessions/:id/messages/:messageId/reaction', ({ path, body }): Message => {
  const session = ownSession(path.id as string)
  const message = getMessage(path.messageId as string)
  if (message.sessionId !== session.id) throw notFound('Message not found.')
  if (!CHANNEL_MEDIA[session.channel].reactions) throw DemoApiError.validation({ emoji: 'Reactions are not available on this channel.' })
  const emoji = (body as { emoji?: string | null } | null)?.emoji ?? null
  if (emoji !== null && (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 16)) {
    throw DemoApiError.validation({ emoji: 'Pick an emoji.' })
  }
  return setReaction(message.id, message.reactionEmoji === emoji ? null : emoji)
})

api.register('POST', '/demo/sessions/:id/simulate-timeout', ({ path }) => {
  const session = ownSession(path.id as string)
  if (session.status !== 'active' && session.status !== 'inactive') throw conflict('Only a chat you are handling can time out.')
  requeueSession(session.id, 'response_timeout', true)
  return toSummary(session)
})
