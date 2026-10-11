/**
 * Public widget endpoints (owner: widget group). Everything here works signed
 * out: the tenant is found by `:slug`, the visitor's session by its id.
 * Mutations go through the engine, which broadcasts the matching events.
 */
import { conflict, DemoApiError, notFound } from '@portfolio/demo-kit'

import type {
  ChatSession,
  Customer,
  CustomField,
  ContentLang,
  FaqStep,
  Feedback,
  LocalizedText,
  Message,
  MessageFile,
  MessageLocation,
  OperatorBrief,
  TenantSettings,
  ThemePreset,
  WidgetPosition,
  WorkingHoursStatus,
  FaqTree,
  Tenant,
} from '@/types'

import { api } from '../api'
import { broadcast } from '../bus'
import { nowIso } from '../clock'
import { findTenantBySlug, tenantSettings, tenantWorkingHours } from '../context'
import {
  createWidgetSession,
  endSession,
  getCustomer,
  getOperator,
  getSession,
  handoff,
  markSeen,
  messagesOf,
  operatorBrief,
  pickContent,
  postMessage,
  setTyping,
  workingHoursStatus,
  acknowledgeWarning,
} from '../engine'
import { BOT_DISPLAY_NAME, BOT_LINES, buildBriefing, topicOf } from '../content/widget'
import { newId, store } from '../store'

/* --------------------------------------------------------------- shapes */

export type TenantAvailability = 'active' | 'disabled' | 'not_found'
export type HoursMode = 'auto' | 'open' | 'closed' | 'temporary'

export interface WidgetConfig {
  state: TenantAvailability
  slug: string
  tenantName: LocalizedText | null
  chatTitle: LocalizedText | null
  clientTheme: ThemePreset
  widgetPosition: WidgetPosition
  faq: { enabled: boolean; showOperatorButton: boolean; tree: FaqTree }
  fields: CustomField[]
  hours: WorkingHoursStatus & {
    isTemporarilyClosed: boolean
    temporaryClosedMessage: LocalizedText | null
    nextAvailableMessage: LocalizedText | null
    mode: HoursMode
  }
  aiBotEnabled: boolean
  requestFeedback: boolean
  typingTransparency: boolean
}

export interface WidgetLoginResult {
  token: string
  customer: Customer
  session: ChatSession
  messages: Message[]
}

export interface WidgetRestore {
  session: ChatSession
  messages: Message[]
  operator: OperatorBrief | null
  customer: Customer | null
}

const EMPTY_TREE: FaqTree = { rootIds: [], nodes: {} }

/* -------------------------------------------------------------- helpers */

function emptyConfig(slug: string, state: TenantAvailability): WidgetConfig {
  return {
    state,
    slug,
    tenantName: null,
    chatTitle: null,
    clientTheme: 'canary',
    widgetPosition: 'right',
    faq: { enabled: false, showOperatorButton: false, tree: EMPTY_TREE },
    fields: [],
    hours: {
      isOpen: true,
      reason: 'schedule',
      nextOpen: null,
      todayStart: null,
      todayEnd: null,
      isTemporarilyClosed: false,
      temporaryClosedMessage: null,
      nextAvailableMessage: null,
      mode: 'auto',
    },
    aiBotEnabled: false,
    requestFeedback: false,
    typingTransparency: false,
  }
}

function availability(tenant: Tenant | undefined): TenantAvailability {
  if (!tenant || tenant.deletedAt) return 'not_found'
  if (tenant.disabled) return 'disabled'
  return 'active'
}

function hoursMode(demoOverride: 'auto' | 'open' | 'closed', temporarilyClosed: boolean): HoursMode {
  if (demoOverride === 'open') return 'open'
  if (demoOverride === 'closed') return 'closed'
  return temporarilyClosed ? 'temporary' : 'auto'
}

function buildConfig(slug: string): WidgetConfig {
  const tenant = findTenantBySlug(slug)
  const state = availability(tenant)
  if (!tenant || state === 'not_found') return emptyConfig(slug, 'not_found')
  if (state === 'disabled') {
    const base = emptyConfig(slug, 'disabled')
    base.tenantName = tenant.name
    return base
  }
  const settings = tenantSettings(tenant.id)
  const hours = tenantWorkingHours(tenant.id)
  const status = workingHoursStatus(tenant.id)
  const fields = store.data.customFields
    .filter((field) => field.tenantId === tenant.id && field.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  return {
    state: 'active',
    slug,
    tenantName: tenant.name,
    chatTitle: settings.chatTitle,
    clientTheme: settings.clientTheme,
    widgetPosition: settings.widgetPosition,
    faq: { enabled: settings.faqEnabled, showOperatorButton: settings.faqShowOperatorButton, tree: settings.faqTree },
    fields,
    hours: {
      ...status,
      isTemporarilyClosed: hours.isTemporarilyClosed,
      temporaryClosedMessage: hours.temporaryClosedMessage,
      nextAvailableMessage: hours.nextAvailableMessage,
      mode: hoursMode(hours.demoOverride, hours.isTemporarilyClosed),
    },
    aiBotEnabled: settings.aiBotEnabled,
    requestFeedback: settings.requestFeedback,
    typingTransparency: settings.typingTransparency,
  }
}

function activeTenant(slug: string): Tenant {
  const tenant = findTenantBySlug(slug)
  if (!tenant || tenant.deletedAt) throw notFound('Organization not found.')
  if (tenant.disabled) throw new DemoApiError(403, 'This chat is not available.', { code: 'TENANT_DISABLED' })
  return tenant
}

function liveSession(sessionId: string): ChatSession {
  const session = getSession(sessionId)
  if (session.channel !== 'web_widget') throw notFound('Chat not found.')
  return session
}

function openSession(sessionId: string): ChatSession {
  const session = liveSession(sessionId)
  if (session.status === 'ended') throw conflict('This chat has ended.')
  return session
}

function contentLang(value: unknown): ContentLang {
  return value === 'ka' || value === 'ru' ? value : 'en'
}

/** Digits only for phone-like values, trimmed lower-case otherwise. */
function normalise(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const digits = trimmed.replace(/[\s()+-]/g, '')
  return /^\d{6,}$/.test(digits) ? digits : trimmed
}

function isBanned(tenantId: string, fields: Record<string, string>, clientIp: string): boolean {
  return store.data.bans.some((ban) => {
    if (ban.tenantId !== tenantId) return false
    if (ban.type === 'ip') return ban.value === clientIp
    const value = ban.fieldId ? fields[ban.fieldId] : undefined
    return !!value && normalise(value) === normalise(ban.value)
  })
}

function validateFields(definitions: CustomField[], fields: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of definitions) {
    const value = (fields[field.id] ?? '').trim()
    if (!value) {
      if (field.required) errors[field.id] = 'This field is required.'
      continue
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.id] = 'Enter a valid email address.'
    if (field.type === 'phone' && value.replace(/\D/g, '').length < 7) errors[field.id] = 'Enter a valid phone number.'
    if (field.type === 'number' && Number.isNaN(Number(value))) errors[field.id] = 'Enter a number.'
    if (field.type === 'select' && !field.options.some((option) => option.value === value)) errors[field.id] = 'Choose one of the options.'
  }
  return errors
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function operatorOf(session: ChatSession): OperatorBrief | null {
  const operator = getOperator(session.operatorId)
  return operator ? operatorBrief(operator) : null
}

/* ----------------------------------------------------------- endpoints */

api.register('GET', '/widget/:slug/config', ({ path }) => buildConfig(path.slug ?? ''))

api.register('POST', '/widget/:slug/login', async ({ path, body }) => {
  const tenant = activeTenant(path.slug ?? '')
  const input = (body ?? {}) as { fields?: Record<string, string>; faqPath?: FaqStep[]; language?: string; clientIp?: string }
  await wait(600)

  const settings: TenantSettings = tenantSettings(tenant.id)
  const language = contentLang(input.language)
  const fields = Object.fromEntries(Object.entries(input.fields ?? {}).map(([key, value]) => [key, String(value ?? '').trim()]))
  const clientIp = input.clientIp || store.data.demo.simulatedIp

  if (!workingHoursStatus(tenant.id).isOpen) {
    const hours = tenantWorkingHours(tenant.id)
    throw new DemoApiError(403, 'We are offline right now.', {
      code: 'OFFLINE',
      message: pickContent(hours.isTemporarilyClosed ? hours.temporaryClosedMessage : hours.nextAvailableMessage, language),
    })
  }
  if (isBanned(tenant.id, fields, clientIp)) {
    throw new DemoApiError(403, 'This chat is not available to you.', {
      code: 'CLIENT_BANNED',
      bannedMessage: pickContent(settings.bannedMessage, language),
    })
  }
  const definitions = store.data.customFields.filter((field) => field.tenantId === tenant.id && field.enabled)
  const errors = validateFields(definitions, fields)
  if (Object.keys(errors).length > 0) {
    throw new DemoApiError(400, 'Please fill in the required fields.', { code: 'MISSING_FIELDS', ...errors })
  }

  const faqPath = (input.faqPath ?? []).slice(0, 12).map((step) => ({
    nodeId: String(step.nodeId ?? ''),
    question: String(step.question ?? '').slice(0, 400),
    answer: String(step.answer ?? '').slice(0, 400),
  }))
  const { customer, session } = createWidgetSession({ tenantId: tenant.id, fields, faqPath, language, clientIp, origin: 'visitor' })

  if (session.aiState === 'bot') {
    postMessage(session.id, { sender: 'bot', senderName: BOT_DISPLAY_NAME, content: BOT_LINES.greeting(customer.name, language) })
  }
  const result: WidgetLoginResult = {
    token: `tok_${session.id}`,
    customer,
    session: getSession(session.id),
    messages: messagesOf(session.id),
  }
  return result
})

api.register('GET', '/widget/sessions/:sessionId', ({ path }) => {
  const session = liveSession(path.sessionId ?? '')
  const restore: WidgetRestore = {
    session,
    messages: messagesOf(session.id),
    operator: operatorOf(session),
    customer: getCustomer(session.customerId) ?? null,
  }
  return restore
})

api.register('POST', '/widget/sessions/:sessionId/messages', ({ path, body }) => {
  const session = openSession(path.sessionId ?? '')
  const input = (body ?? {}) as { content?: string; type?: string; file?: MessageFile | null; location?: MessageLocation | null }
  const content = String(input.content ?? '').trim()
  const file = input.file ?? null
  const location = input.location ?? null
  if (!content && !file && !location) throw DemoApiError.validation({ content: 'Write a message first.' })
  if (content.length > 2000) throw DemoApiError.validation({ content: 'Messages are limited to 2000 characters.' })
  if (file && (!file.url || !file.name)) throw DemoApiError.validation({ file: 'The file could not be read.' })
  if (location && (typeof location.lat !== 'number' || typeof location.lng !== 'number')) throw DemoApiError.validation({ location: 'The location is invalid.' })

  // Writing again clears a pending inactivity warning.
  if (session.warningIssuedAt) acknowledgeWarning(session.id)
  return postMessage(session.id, {
    sender: 'user',
    senderId: session.customerId,
    senderName: session.customerName,
    content: content || file?.name || location?.label || '',
    file,
    location,
  })
})

api.register('POST', '/widget/sessions/:sessionId/typing', ({ path, body }) => {
  const session = openSession(path.sessionId ?? '')
  const input = (body ?? {}) as { isTyping?: boolean; draft?: string }
  const transparency = tenantSettings(session.tenantId).typingTransparency
  setTyping({
    sessionId: session.id,
    who: 'customer',
    isTyping: !!input.isTyping,
    draft: input.isTyping && transparency ? String(input.draft ?? '').slice(0, 300) : null,
    name: session.customerName,
  })
  return { ok: true }
})

api.register('POST', '/widget/sessions/:sessionId/seen', ({ path }) => {
  const session = liveSession(path.sessionId ?? '')
  markSeen(session.id, 'customer')
  return { ok: true }
})

api.register('POST', '/widget/sessions/:sessionId/request-human', ({ path }) => {
  const session = openSession(path.sessionId ?? '')
  if (session.aiState !== 'bot') return session
  const lang = session.clientLanguage
  const lastUser = [...messagesOf(session.id)].reverse().find((message) => message.sender === 'user' && !message.isPreChat)
  const brief = buildBriefing({
    name: session.customerName,
    topic: session.topic !== 'other' ? session.topic : (topicOf(lastUser?.content ?? '') ?? 'other'),
    lastMessage: lastUser?.content ?? null,
    lang,
    reason: 'request',
  })
  postMessage(session.id, { sender: 'bot', senderName: BOT_DISPLAY_NAME, content: BOT_LINES.handoff.customer_request(lang) })
  return handoff(session.id, 'customer_request', brief.summary, brief.goal)
})

api.register('POST', '/widget/sessions/:sessionId/acknowledge-warning', ({ path }) => {
  const session = liveSession(path.sessionId ?? '')
  if (session.status === 'ended') return session
  return acknowledgeWarning(session.id)
})

api.register('POST', '/widget/sessions/:sessionId/end', ({ path }) => {
  const session = liveSession(path.sessionId ?? '')
  const ended = session.status === 'ended' ? session : endSession(session.id, 'customer', 'manual')
  return { session: ended, requestFeedback: tenantSettings(session.tenantId).requestFeedback }
})

api.register('POST', '/widget/sessions/:sessionId/feedback', ({ path, body }) => {
  const session = liveSession(path.sessionId ?? '')
  const input = (body ?? {}) as { rating?: number; comment?: string }
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw DemoApiError.validation({ rating: 'Choose a rating from 1 to 5.' })
  if (store.data.feedback.some((row) => row.sessionId === session.id)) throw conflict('Thank you, feedback was already sent.')
  const feedback: Feedback = {
    id: newId('fb_'),
    tenantId: session.tenantId,
    sessionId: session.id,
    customerId: session.customerId,
    operatorId: session.operatorId,
    rating: rating as Feedback['rating'],
    comment: String(input.comment ?? '').trim().slice(0, 500) || null,
    submittedAt: nowIso(),
  }
  store.data.feedback.push(feedback)
  broadcast('feedback:new', feedback)
  broadcast('session:upsert', session)
  return feedback
})

/* ------------------------------------------------- storefront demo panel */

const THEMES: ThemePreset[] = ['canary', 'olive', 'clay', 'plum', 'moss', 'slate', 'night', 'paper']
const POSITIONS: WidgetPosition[] = ['right', 'left']
const HOURS_MODES: HoursMode[] = ['auto', 'open', 'closed', 'temporary']

/**
 * Demo chrome: the storefront panel changes the same settings the admin
 * console edits (widget position, theme, bot, working-hours override).
 */
api.register('PATCH', '/demo/widget-controls', ({ body }) => {
  const input = (body ?? {}) as { slug?: string; widgetPosition?: string; clientTheme?: string; aiBotEnabled?: boolean; hoursMode?: string }
  const tenant = activeTenant(input.slug || 'vazi')
  const settings = tenantSettings(tenant.id)
  const hours = tenantWorkingHours(tenant.id)

  if (input.widgetPosition !== undefined) {
    if (!POSITIONS.includes(input.widgetPosition as WidgetPosition)) throw DemoApiError.validation({ widgetPosition: 'Choose left or right.' })
    settings.widgetPosition = input.widgetPosition as WidgetPosition
  }
  if (input.clientTheme !== undefined) {
    if (!THEMES.includes(input.clientTheme as ThemePreset)) throw DemoApiError.validation({ clientTheme: 'Unknown theme.' })
    settings.clientTheme = input.clientTheme as ThemePreset
  }
  if (typeof input.aiBotEnabled === 'boolean') settings.aiBotEnabled = input.aiBotEnabled
  broadcast('settings:update', settings)

  if (input.hoursMode !== undefined) {
    if (!HOURS_MODES.includes(input.hoursMode as HoursMode)) throw DemoApiError.validation({ hoursMode: 'Unknown mode.' })
    const mode = input.hoursMode as HoursMode
    hours.demoOverride = mode === 'open' ? 'open' : mode === 'closed' ? 'closed' : 'auto'
    hours.isTemporarilyClosed = mode === 'temporary'
    hours.temporaryClosedFrom = mode === 'temporary' ? new Date(Date.now() - 60_000).toISOString() : null
    hours.temporaryClosedUntil = mode === 'temporary' ? new Date(Date.now() + 24 * 3_600_000).toISOString() : null
    broadcast('working-hours:update', hours)
  }
  return buildConfig(tenant.slug)
})
