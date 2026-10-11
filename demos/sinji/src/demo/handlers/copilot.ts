/**
 * Mock handlers for the `copilot` group: the copilot / autopilot harness
 * (conversations, turns, the streamed tier ladder, feedback, voice-in), the
 * workspace bot configuration, the global default bot and the bot control
 * (kill switch). OWNED BY: copilot.
 *
 * `streamTurn(ticket)` is the "SSE stream": an async generator the harness
 * page iterates. Order is always open -> grounding -> tier1 -> suggestion /
 * reply deltas -> handoff? -> done, with `performance.now()` per stage.
 */
import { conflict, DemoApiError, forbidden, notFound } from '@portfolio/demo-kit'

import {
  buildHandoff,
  byeText,
  classify,
  clarifyText,
  composeAnswer,
  cutoffText,
  disclosureFor,
  docTitle,
  escalateText,
  introText,
  isWithinHours,
  limitText,
  readSignals,
  retrieve,
  thanksText,
  toCitation,
  toHit,
  tooFastText,
  warnText,
  wordChunks,
  type Pooled,
} from '@/features/copilot/engine'
import { startersFor } from '@/features/copilot/copy'
import type {
  BotConfigView,
  BotControl,
  ControlRow,
  ConversationView,
  FeedbackBody,
  FeedbackResult,
  NewConversationBody,
  SttBody,
  SttResult,
  TurnTicket,
  WorkspaceRow,
} from '@/features/copilot/types'
import { issueMessage, validateBot } from '@/features/copilot/validate'
import type {
  AutopilotBlock,
  BotConfig,
  ChatConversation,
  ChatTurn,
  Citation,
  ContentLang,
  CopilotFeedback,
  CopilotStreamEvent,
  Handoff,
  Id,
  KillState,
  Suggestion,
  Tenant,
  TurnEnvelope,
} from '@/types'
import { api, bus, store } from '../core'
import { currentAccount, requireOperator, requireRole, requireWorkspaceEditor, tenantScope } from '../guards'
import { estimateTokens, hashString } from '../lib/text'
import { logUsage } from '../lib/usage-log'
import { demoEpoch } from '../store'

const now = () => new Date().toISOString()
const clone = <T>(value: T): T => structuredClone(value)

/* ----------------------------------------------------------------- config */

function defaultBot(): BotConfig {
  const found = store.data.botConfigs.find((b) => b.client_id === null)
  if (!found) throw new DemoApiError(500, 'The default bot configuration is missing.')
  return found
}

/** The workspace's own config, or the default re-labelled for it (never stored until saved). */
function configFor(tenantId: Id): BotConfig {
  const own = store.data.botConfigs.find((b) => b.client_id === tenantId)
  if (own) return own
  return { ...clone(defaultBot()), client_id: tenantId, is_default: false, autopilot_enabled: false, version: 1 }
}

function saveTenantConfig(config: BotConfig): void {
  const index = store.data.botConfigs.findIndex((b) => b.client_id === config.client_id)
  if (index >= 0) store.data.botConfigs[index] = config
  else store.data.botConfigs.push(config)
}

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const INHERIT_PATHS = [
  'persona',
  'greeting',
  'refusal_copy',
  'languages',
  'canned',
  'min_score',
  'min_hits',
  'top_k',
  'suggestion_count',
  'settings.answer_policy',
  'settings.business_scope',
  'settings.hours',
  'settings.off_topic_handling',
  'settings.off_topic_warn_after',
  'settings.off_topic_cutoff_after',
  'settings.handoff_notice',
  'settings.handoff_summary',
  'settings.disclosure_mode',
  'settings.limits',
  'settings.escalation_keywords',
  'settings.max_reply_chars',
]

function inheritedPaths(config: BotConfig, defaults: BotConfig): string[] {
  return INHERIT_PATHS.filter((path) => same(get(config, path), get(defaults, path)))
}

/** Merge a submitted form onto a config; unknown keys are ignored. */
function applyBody(base: BotConfig, input: unknown): BotConfig {
  const b = (input ?? {}) as Partial<BotConfig>
  const next = clone(base)
  if (typeof b.persona === 'string') next.persona = b.persona
  if (b.greeting) next.greeting = { ...next.greeting, ...b.greeting }
  if (b.refusal_copy) next.refusal_copy = { ...next.refusal_copy, ...b.refusal_copy }
  if (Array.isArray(b.languages)) next.languages = [...new Set(b.languages)]
  if (Array.isArray(b.canned)) next.canned = b.canned.map((c) => ({ trigger: String(c.trigger ?? ''), reply: String(c.reply ?? '') }))
  for (const key of ['min_score', 'min_hits', 'top_k', 'suggestion_count'] as const) {
    if (b[key] !== undefined) next[key] = Number(b[key])
  }
  if (b.settings) {
    const s = b.settings
    const merged = { ...next.settings, ...s }
    merged.limits = {
      ...next.settings.limits,
      ...(s.limits ?? {}),
      per_channel: { ...next.settings.limits.per_channel, ...(s.limits?.per_channel ?? {}) },
    }
    merged.hours = { ...next.settings.hours, ...(s.hours ?? {}) }
    merged.handoff_notice = { ...next.settings.handoff_notice, ...(s.handoff_notice ?? {}) }
    merged.escalation_keywords = [
      ...new Set((s.escalation_keywords ?? next.settings.escalation_keywords).map((k) => String(k).trim()).filter(Boolean)),
    ]
    for (const key of ['off_topic_warn_after', 'off_topic_cutoff_after', 'max_reply_chars'] as const) merged[key] = Number(merged[key])
    for (const key of ['per_minute', 'per_conversation'] as const) merged.limits[key] = Number(merged.limits[key])
    next.settings = merged
  }
  return next
}

function throwIssues(config: BotConfig, isDefault: boolean, extra: Record<string, string> = {}): void {
  const issues = validateBot(config, { isDefault })
  const fields: Record<string, string> = { ...extra }
  for (const [path, issue] of Object.entries(issues)) fields[path] = issueMessage(issue)
  if (Object.keys(fields).length) throw DemoApiError.validation(fields)
}

/* ------------------------------------------------------------ kb + status */

function publicDocCount(tenantId: Id): number {
  return store.data.kbDocuments.filter((d) => d.client_id === tenantId && d.status === 'ready' && d.visibility === 'public').length
}

function chunkPool(tenantId: Id, publicOnly: boolean): Pooled[] {
  const docs = new Map(
    store.data.kbDocuments
      .filter((d) => d.client_id === tenantId && d.status === 'ready' && (!publicOnly || d.visibility === 'public'))
      .map((d) => [d.id, d]),
  )
  const out: Pooled[] = []
  for (const chunk of store.data.kbChunks) {
    if (chunk.client_id !== tenantId) continue
    const doc = docs.get(chunk.document_id)
    if (doc) out.push({ ...chunk, doc })
  }
  return out
}

const isKilled = (tenantId: Id): boolean => store.data.killState.global_disabled || store.data.killState.disabled_clients.includes(tenantId)

function autopilotBlock(tenantId: Id, config: BotConfig): AutopilotBlock | null {
  if (isKilled(tenantId)) return 'killed'
  if (!config.autopilot_enabled) return 'off'
  if (publicDocCount(tenantId) === 0) return 'no_public_docs'
  if (!config.settings.business_scope.trim()) return 'missing_scope'
  return null
}

function tenantById(id: Id): Tenant {
  const tenant = store.data.tenants.find((t) => t.id === id)
  if (!tenant) throw notFound('Workspace not found.')
  return tenant
}

function assertTenantAccess(clientId: Id): void {
  const account = requireRole('operator', 'owner', 'member')
  if (account.role !== 'operator' && account.tenantId !== clientId) throw forbidden()
}

/* ----------------------------------------------------------- bot config */

function configView(tenantId: Id): BotConfigView {
  const tenant = tenantById(tenantId)
  const config = configFor(tenantId)
  const defaults = defaultBot()
  const account = currentAccount()
  return {
    config: clone(config),
    defaults: clone(defaults),
    inherited: inheritedPaths(config, defaults),
    kill: {
      global_disabled: store.data.killState.global_disabled,
      tenant_disabled: store.data.killState.disabled_clients.includes(tenantId),
      state: clone(store.data.killState),
    },
    public_docs: publicDocCount(tenantId),
    blocked: autopilotBlock(tenantId, config),
    tenant: { id: tenant.id, name: tenant.name, name_ka: tenant.name_ka },
    can_edit: account.role === 'owner' || account.role === 'operator',
  }
}

api.register('GET', '/bot/config', () => {
  requireRole('operator', 'owner', 'member')
  return configView(tenantScope())
})

api.register('PUT', '/bot/config', ({ body }) => {
  const account = requireWorkspaceEditor()
  const tenantId = tenantScope()
  const current = configFor(tenantId)
  const next = applyBody(current, body)
  const wanted = (body as Partial<BotConfig> | undefined)?.autopilot_enabled
  if (typeof wanted === 'boolean') next.autopilot_enabled = wanted
  const extra: Record<string, string> = {}
  if (next.autopilot_enabled && !current.autopilot_enabled && publicDocCount(tenantId) === 0) {
    extra.autopilot_enabled = 'Autopilot needs at least one public document in the knowledge base.'
  }
  throwIssues(next, false, extra)
  next.client_id = tenantId
  next.is_default = false
  next.version = current.version + 1
  next.updated_at = now()
  next.updated_by = account.name
  saveTenantConfig(next)
  store.notify()
  return configView(tenantId)
})

api.register('GET', '/admin/bot/default', () => {
  requireOperator()
  return clone(defaultBot())
})

api.register('PUT', '/admin/bot/default', ({ body }) => {
  const account = requireOperator()
  const current = defaultBot()
  const next = applyBody(current, body)
  next.autopilot_enabled = false
  throwIssues(next, true)
  next.client_id = null
  next.is_default = true
  next.version = current.version + 1
  next.updated_at = now()
  next.updated_by = account.name
  const index = store.data.botConfigs.findIndex((b) => b.client_id === null)
  store.data.botConfigs[index] = next
  store.notify()
  return clone(next)
})

/* ------------------------------------------------------------ bot control */

function controlRow(tenant: Tenant): ControlRow {
  const config = configFor(tenant.id)
  const disabled = store.data.killState.disabled_clients.includes(tenant.id)
  const docs = publicDocCount(tenant.id)
  return {
    id: tenant.id,
    name: tenant.name,
    name_ka: tenant.name_ka,
    is_active: tenant.is_active,
    autopilot: config.autopilot_enabled,
    disabled,
    reachable: tenant.is_active && autopilotBlock(tenant.id, config) === null,
    public_docs: docs,
  }
}

const controlView = (): BotControl => ({
  kill: clone(store.data.killState),
  rows: store.data.tenants.map(controlRow),
})

function touchKill(account: { name: string }): KillState {
  const state = store.data.killState
  state.updated_at = now()
  state.updated_by = account.name
  store.notify()
  bus.emit('bot:kill-changed', { state: clone(state) })
  return state
}

api.register('GET', '/admin/bot/control', () => {
  requireOperator()
  return controlView()
})

api.register('PUT', '/admin/bot/kill', ({ body }) => {
  const account = requireOperator()
  const wanted = (body as { global_disabled?: unknown } | undefined)?.global_disabled
  if (typeof wanted !== 'boolean') throw DemoApiError.validation({ global_disabled: 'Choose on or off.' })
  store.data.killState.global_disabled = wanted
  touchKill(account)
  return controlView()
})

api.register('PUT', '/admin/bot/tenants/:tenantId', ({ path, body }) => {
  const account = requireOperator()
  const tenant = tenantById(path.tenantId ?? '')
  const input = (body ?? {}) as { disabled?: unknown; autopilot_enabled?: unknown }
  if (typeof input.disabled !== 'boolean' && typeof input.autopilot_enabled !== 'boolean') {
    throw DemoApiError.validation({ disabled: 'Nothing to change.' })
  }
  if (typeof input.autopilot_enabled === 'boolean') {
    const config = clone(configFor(tenant.id))
    if (input.autopilot_enabled && !config.autopilot_enabled && publicDocCount(tenant.id) === 0) {
      throw conflict('Autopilot needs at least one public document in this workspace.')
    }
    if (config.autopilot_enabled !== input.autopilot_enabled) {
      config.autopilot_enabled = input.autopilot_enabled
      config.version += 1
      config.updated_at = now()
      config.updated_by = account.name
      saveTenantConfig(config)
    }
  }
  if (typeof input.disabled === 'boolean') {
    const list = store.data.killState.disabled_clients
    const has = list.includes(tenant.id)
    if (input.disabled && !has) list.push(tenant.id)
    if (!input.disabled && has) store.data.killState.disabled_clients = list.filter((id) => id !== tenant.id)
  }
  touchKill(account)
  return controlRow(tenant)
})

/* -------------------------------------------------------------- workspaces */

function workspaceRow(tenant: Tenant): WorkspaceRow {
  const config = configFor(tenant.id)
  return {
    id: tenant.id,
    name: tenant.name,
    name_ka: tenant.name_ka,
    industry: tenant.industry,
    autopilot_enabled: config.autopilot_enabled,
    public_docs: publicDocCount(tenant.id),
    kb_chunks: chunkPool(tenant.id, false).length,
    killed: isKilled(tenant.id),
    blocked: autopilotBlock(tenant.id, config),
    min_score: config.min_score,
    greeting: config.greeting,
    languages: config.languages,
    disclosure_mode: config.settings.disclosure_mode,
    off_topic_warn_after: config.settings.off_topic_warn_after,
    off_topic_cutoff_after: config.settings.off_topic_cutoff_after,
  }
}

api.register('GET', '/copilot/workspaces', () => {
  const account = requireRole('operator', 'owner', 'member')
  const tenants =
    account.role === 'operator' ? store.data.tenants.filter((t) => t.is_active) : store.data.tenants.filter((t) => t.id === account.tenantId)
  return tenants.map(workspaceRow)
})

/* ----------------------------------------------------------- conversations */

const CHANNELS = ['web', 'instagram', 'messenger', 'whatsapp'] as const
const LOCALES: ContentLang[] = ['ka', 'en', 'ru']

function findConversation(id: Id): ChatConversation {
  const conv = store.data.conversations.find((c) => c.id === id)
  if (!conv) throw notFound('Conversation not found.')
  assertTenantAccess(conv.client_id)
  return conv
}

api.register('POST', '/copilot/conversations', ({ body }) => {
  const account = requireRole('operator', 'owner', 'member')
  const input = (body ?? {}) as Partial<NewConversationBody>
  const errors: Record<string, string> = {}
  if (!input.client_id) errors.client_id = 'Choose a workspace.'
  if (!input.channel || !CHANNELS.includes(input.channel)) errors.channel = 'Choose a channel.'
  if (!input.locale || !LOCALES.includes(input.locale)) errors.locale = 'Choose a language.'
  if (input.mode !== 'copilot' && input.mode !== 'autopilot') errors.mode = 'Choose a mode.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  const tenant = tenantById(input.client_id as Id)
  if (account.role !== 'operator' && account.tenantId !== tenant.id) throw forbidden()
  if (!tenant.is_active) throw conflict('This workspace is inactive.')
  const id = store.nextId('cnv_')
  const conversation: ChatConversation = {
    id,
    client_id: tenant.id,
    external_ref: `harness-${id.slice(-6)}`,
    channel: input.channel as ChatConversation['channel'],
    locale: input.locale as ContentLang,
    mode: input.mode as ChatConversation['mode'],
    state: 'open',
    subject: '',
    off_topic_count: 0,
    created_at: now(),
    last_message_at: now(),
  }
  store.data.conversations.push(conversation)
  store.notify()
  return clone(conversation)
})

api.register('GET', '/copilot/conversations/:id', ({ path }) => {
  const conversation = findConversation(path.id ?? '')
  const turns = store.data.turns.filter((t) => t.conversation_id === conversation.id)
  const view: ConversationView = { conversation: clone(conversation), turns: clone(turns) }
  return view
})

interface Job {
  conversationId: Id
  turnId: Id
  content: string
}
const tickets = new Map<string, Job>()
let ticketSeq = 0

const newTurn = (conversationId: Id, role: ChatTurn['role'], content: string, extra: Partial<ChatTurn> = {}): ChatTurn => {
  const turn: ChatTurn = {
    id: store.nextId('trn_'),
    conversation_id: conversationId,
    role,
    content,
    grounded: null,
    method: null,
    top_score: null,
    citations: [],
    tokens: 0,
    created_at: now(),
    ...extra,
  }
  store.data.turns.push(turn)
  return turn
}

api.register('POST', '/copilot/conversations/:id/turns', ({ path, body }) => {
  const conversation = findConversation(path.id ?? '')
  const content = String((body as { content?: unknown } | undefined)?.content ?? '').trim()
  if (!content) throw DemoApiError.validation({ content: 'Type a message first.' })
  if (content.length > 2000) throw DemoApiError.validation({ content: 'A message can be at most 2,000 characters.' })
  const turn = newTurn(conversation.id, 'customer', content)
  if (!conversation.subject) conversation.subject = content.length > 70 ? `${content.slice(0, 67)}…` : content
  conversation.last_message_at = turn.created_at
  ticketSeq += 1
  const ticket = `tk_${ticketSeq.toString(36)}${Math.random().toString(36).slice(2, 8)}`
  tickets.set(ticket, { conversationId: conversation.id, turnId: turn.id, content })
  store.notify()
  const result: TurnTicket = { turn_id: turn.id, ticket }
  return result
})

/* --------------------------------------------------------------- feedback */

const lastSuggestions = new Map<string, Suggestion[]>()
const suggestionKey = (turnId: Id) => `${demoEpoch()}:${turnId}`

api.register('POST', '/copilot/feedback', ({ body }) => {
  const input = (body ?? {}) as Partial<FeedbackBody>
  const customerTurn = store.data.turns.find((t) => t.id === input.turn_id)
  if (!customerTurn) throw notFound('Turn not found.')
  const conversation = findConversation(customerTurn.conversation_id)
  const action = input.action
  if (action !== 'inserted' && action !== 'edited' && action !== 'ignored') {
    throw DemoApiError.validation({ action: 'Choose insert, edit or ignore.' })
  }
  const suggestion = (lastSuggestions.get(suggestionKey(customerTurn.id)) ?? [])[input.suggestion_index ?? -1]
  if (!suggestion) throw notFound('This draft is no longer available.')
  const finalText = (input.final_text ?? '').trim()
  if (action === 'edited' && !finalText) throw DemoApiError.validation({ final_text: 'The edited reply cannot be empty.' })
  if (action !== 'ignored' && finalText.length > 2000) throw DemoApiError.validation({ final_text: 'A reply can be at most 2,000 characters.' })

  const sent = action === 'ignored' ? null : finalText || suggestion.text
  const feedback: CopilotFeedback = {
    id: store.nextId('fb_'),
    conversation_id: conversation.id,
    turn_id: customerTurn.id,
    suggestion_index: suggestion.index,
    action,
    final_text: sent,
    created_at: now(),
  }
  store.data.copilotFeedback.push(feedback)
  let turn: ChatTurn | null = null
  if (sent) {
    turn = newTurn(conversation.id, 'operator', sent, {
      grounded: suggestion.kind === 'answer' ? true : null,
      method: suggestion.kind === 'answer' ? 'vector' : null,
      top_score: customerTurn.top_score,
      citations: suggestion.citations,
    })
    conversation.last_message_at = turn.created_at
  }
  store.notify()
  const result: FeedbackResult = { feedback: clone(feedback), turn: turn ? clone(turn) : null }
  return result
})

/* -------------------------------------------------------------- voice in */

api.register('POST', '/copilot/stt', ({ body }) => {
  requireRole('operator', 'owner', 'member')
  const input = (body ?? {}) as Partial<SttBody>
  const locale: ContentLang = input.locale && LOCALES.includes(input.locale) ? input.locale : 'en'
  const tenant = store.data.tenants.find((t) => t.id === input.client_id)
  const samples = startersFor(tenant?.industry, locale).filter((s) => s.expect === 'answer')
  const pick = samples[hashString(`${input.size ?? 0}:${Math.round((input.duration_s ?? 0) * 10)}:${store.data.copilotFeedback.length}`) % Math.max(1, samples.length)]
  const duration = Math.max(1.2, Math.min(30, input.duration_s ?? 3.4))
  const wait = 1000 + (hashString(String(input.size ?? 1)) % 900)
  return new Promise<SttResult>((resolve) => {
    setTimeout(() => {
      logUsage({
        feature: 'transcribe',
        group: 'transcription',
        capability: 'stt',
        client_id: tenant?.id ?? null,
        audio_seconds: Math.round(duration * 10) / 10,
        provider: 'sinji-voice',
        model: 'sinji-stt-v2',
        latency_ms: wait,
      })
      resolve({ transcript: pick?.text ?? '', language: locale, duration_s: Math.round(duration * 10) / 10 })
    }, wait)
  })
})

/* ---------------------------------------------------------------- stream */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const jitter = (base: number, spread: number) => base + Math.round((Math.random() - 0.5) * 2 * spread)
const round = (n: number) => Math.round(n)

type ForcedReply = { kind: 'refusal' | 'handoff'; text: string }

/**
 * One turn of the tier ladder as an async generator. Reads the ticket
 * `POST /copilot/conversations/:id/turns` issued and persists the bot turn,
 * the usage rows and the "shown" feedback as it goes.
 */
export async function* streamTurn(ticket: string): AsyncGenerator<CopilotStreamEvent> {
  const job = tickets.get(ticket)
  if (!job) throw new DemoApiError(404, 'This reply stream has expired. Send the message again.')
  tickets.delete(ticket)
  const epoch = demoEpoch()
  const stale = () => demoEpoch() !== epoch

  const conv = store.data.conversations.find((c) => c.id === job.conversationId)
  if (!conv) throw new DemoApiError(404, 'Conversation not found.')
  const { content } = job
  const tenantId = conv.client_id
  const locale = conv.locale
  const copilot = conv.mode === 'copilot'
  const config = configFor(tenantId)
  const s = config.settings

  yield { type: 'open', turn_id: job.turnId }

  /* Autopilot is blocked before anything else runs. */
  if (!copilot) {
    const blocked = autopilotBlock(tenantId, config)
    if (blocked) {
      const envelope: TurnEnvelope = {
        turn_id: job.turnId,
        grounding: { grounded: false, kb_present: publicDocCount(tenantId) > 0, hits: 0, top_score: 0, triage: 'business' },
        tier1: [],
        citations: [],
        suggestions: [],
        reply: { text: '', kind: 'blocked', blocked },
        handoff: null,
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        stages: [],
      }
      yield { type: 'done', envelope }
      return
    }
  }

  /* ---- stage 1: grounding (~40 ms) ---- */
  const t0 = performance.now()
  const signals = readSignals(content, config)
  const fullPool = chunkPool(tenantId, false)
  const publicPool = fullPool.filter((c) => c.doc.visibility === 'public')
  const rankedAll = retrieve(content, copilot ? fullPool : publicPool)
  const rankedPublic = copilot ? rankedAll.filter((r) => r.item.doc.visibility === 'public') : rankedAll
  const topPublic = rankedPublic[0]?.score ?? 0
  const topAll = rankedAll[0]
  const quotable = rankedPublic.filter((r) => r.score >= config.min_score).slice(0, config.top_k)
  const internalTop = copilot && !!topAll && topAll.item.doc.visibility === 'internal' && topAll.score >= config.min_score && topAll.score > topPublic + 0.03
  const kbPresent = publicPool.length > 0
  const grounded = kbPresent && quotable.length >= config.min_hits && topPublic >= config.min_score && !signals.internalProbe && !internalTop && !signals.chitchat
  const triage = signals.internalProbe || internalTop ? 'risky' : classify(signals, grounded)
  await sleep(jitter(40, 10))
  if (stale()) return
  const groundingMs = round(performance.now() - t0)
  const grounding = { grounded, kb_present: kbPresent, hits: quotable.length, top_score: Math.round(topPublic * 100) / 100, triage }
  yield { type: 'grounding', grounding, ms: groundingMs }

  /* ---- stage 2: tier-1 passages, no model call (80-300 ms) ---- */
  const t1 = performance.now()
  await sleep(jitter(140, 60) + Math.min(80, rankedAll.length))
  if (stale()) return
  const shown = rankedAll.filter((r) => r.score >= 0.4).slice(0, 3)
  const tier1 = shown.map((r) => toHit(r, content, locale))
  const tier1Ms = round(performance.now() - t1)
  yield { type: 'tier1', passages: tier1, ms: tier1Ms }

  const citeSource = quotable.slice(0, 3)
  const citations: Citation[] = grounded ? citeSource.map((r, i) => toCitation(i + 1, r, content, locale)) : []
  const topTitle = citeSource[0] ? docTitle(citeSource[0].item.doc, locale) : ''

  const open = isWithinHours(s.hours, s.timezone)
  const handoffReasonFor = (base: Handoff['reason']): Handoff['reason'] => ((base === 'low_score' || base === 'requested') && !open ? 'out_of_hours' : base)
  const info = { query: content, topScore: topPublic, minScore: config.min_score }

  const t2 = performance.now()
  let input_tokens = 0
  let output_tokens = 0
  let handoff: Handoff | null = null

  /* ============================ COPILOT ============================ */
  if (copilot) {
    let suggestions: Suggestion[]
    if (!grounded) {
      const reason: Handoff['reason'] =
        signals.internalProbe || internalTop || signals.escalation || signals.risky ? 'risky' : signals.requested ? 'requested' : 'low_score'
      suggestions = [{ index: 0, kind: 'escalate', text: config.refusal_copy[locale], citations: [] }]
      handoff = buildHandoff(handoffReasonFor(reason), locale, info)
    } else {
      const answer = composeAnswer(locale, content, citeSource, config.min_score, s.max_reply_chars)
      const spoken = store.data.turns.some((t) => t.conversation_id === conv.id && t.role === 'operator')
      const drafts: Array<{ kind: Suggestion['kind']; text: string; cites: number[] }> = [
        { kind: 'answer', text: `${spoken ? '' : introText(locale)}${answer.text}`, cites: answer.cites },
        { kind: 'clarify', text: clarifyText(locale, topTitle), cites: [] },
        { kind: 'escalate', text: escalateText(locale), cites: [] },
      ]
      suggestions = drafts.slice(0, Math.max(1, config.suggestion_count)).map((d, index) => ({
        index,
        kind: d.kind,
        text: d.text,
        citations: d.cites.map((n) => citations[n - 1]).filter((c): c is Citation => !!c),
      }))
      if (signals.commitment) handoff = buildHandoff('commitment', locale, info)
      else if (signals.requested) handoff = buildHandoff(handoffReasonFor('requested'), locale, info)
      else if (signals.escalation || signals.risky) handoff = buildHandoff('risky', locale, info)
      input_tokens = 120 + estimateTokens(content) + citeSource.reduce((sum, r) => sum + estimateTokens(r.item.content), 0)
      output_tokens = suggestions.reduce((sum, x) => sum + estimateTokens(x.text), 0)
    }
    for (const suggestion of suggestions) {
      for (const delta of wordChunks(suggestion.text)) {
        await sleep(jitter(30, 8))
        if (stale()) return
        yield { type: 'suggestion', index: suggestion.index, kind: suggestion.kind, delta }
      }
      await sleep(40)
    }
    if (handoff) yield { type: 'handoff', handoff }
    const stageMs = round(performance.now() - t2)
    const total = input_tokens + output_tokens
    lastSuggestions.set(suggestionKey(job.turnId), suggestions)
    const turnRow = store.data.turns.find((t) => t.id === job.turnId)
    if (turnRow) {
      turnRow.grounded = grounded
      turnRow.method = grounded ? 'vector' : 'none'
      turnRow.top_score = grounding.top_score
      turnRow.citations = citations
      turnRow.tokens = total
    }
    const base = { client_id: tenantId, conversation_id: conv.id, turn_id: job.turnId }
    logUsage({ ...base, feature: 'triage', group: 'bot', capability: 'llm', input_tokens: grounded ? 70 + estimateTokens(content) : 0, output_tokens: grounded ? 12 : 0, latency_ms: groundingMs })
    logUsage({ ...base, feature: 'copilot', group: 'bot', capability: 'llm', input_tokens, output_tokens, latency_ms: stageMs })
    if (handoff) logUsage({ ...base, feature: 'handoff', group: 'bot', capability: 'llm', input_tokens: grounded && s.handoff_summary ? 160 : 0, output_tokens: grounded && s.handoff_summary ? 70 : 0, latency_ms: 0 })
    for (const suggestion of suggestions) {
      store.data.copilotFeedback.push({
        id: store.nextId('fb_'),
        conversation_id: conv.id,
        turn_id: job.turnId,
        suggestion_index: suggestion.index,
        action: 'shown',
        final_text: null,
        created_at: now(),
      })
    }
    if (handoff && conv.state === 'open') conv.state = 'handoff'
    conv.last_message_at = now()
    store.notify()
    yield {
      type: 'done',
      envelope: {
        turn_id: job.turnId,
        grounding,
        tier1,
        citations,
        suggestions,
        reply: null,
        handoff,
        usage: { input_tokens, output_tokens, total_tokens: total },
        stages: [
          { name: 'grounding', ms: groundingMs },
          { name: 'tier1', ms: tier1Ms },
          { name: 'suggestions', ms: stageMs },
        ],
      },
    }
    return
  }

  /* ============================ AUTOPILOT ============================ */
  const lower = content.toLowerCase()
  const priorBot = store.data.turns.filter((t) => t.conversation_id === conv.id && t.role === 'bot').length
  const recent = store.data.turns.filter((t) => t.conversation_id === conv.id && t.role === 'customer' && Date.now() - Date.parse(t.created_at) < 60_000).length
  const customerTurns = store.data.turns.filter((t) => t.conversation_id === conv.id && t.role === 'customer').length

  let kind: 'answer' | 'refusal' | 'handoff' = 'refusal'
  let text = ''
  let method: ChatTurn['method'] = 'none'
  let replyCites: Citation[] = []
  let ended = false
  let forced: ForcedReply | null = null
  let modelCall = false

  if (conv.state === 'resolved' && conv.off_topic_count >= s.off_topic_cutoff_after) {
    forced = { kind: 'refusal', text: cutoffText(locale) }
    ended = true
  } else if (customerTurns > s.limits.per_conversation) forced = { kind: 'refusal', text: limitText(locale) }
  else if (recent > s.limits.per_minute) forced = { kind: 'refusal', text: tooFastText(locale) }

  const canned = config.canned.find((c) => c.trigger.trim() && lower.includes(c.trigger.trim().toLowerCase()))

  if (forced) {
    ;({ kind, text } = forced)
  } else if (canned) {
    kind = 'answer'
    text = canned.reply
    method = 'canned'
  } else if (signals.chitchat) {
    kind = 'answer'
    method = 'canned'
    text = signals.chitchat === 'greeting' ? config.greeting[locale] : signals.chitchat === 'thanks' ? thanksText(locale) : byeText(locale)
  } else if (signals.internalProbe) {
    text = config.refusal_copy[locale]
  } else if (signals.escalation || signals.risky) {
    kind = 'handoff'
    text = s.handoff_notice[locale]
    handoff = buildHandoff('risky', locale, info)
  } else if (signals.commitment) {
    kind = 'handoff'
    text = s.handoff_notice[locale]
    handoff = buildHandoff('commitment', locale, info)
  } else if (signals.requested) {
    kind = 'handoff'
    text = s.handoff_notice[locale]
    handoff = buildHandoff(handoffReasonFor('requested'), locale, info)
  } else if (grounded) {
    const answer = composeAnswer(locale, content, citeSource, config.min_score, s.max_reply_chars)
    kind = 'answer'
    text = answer.text
    method = 'vector'
    replyCites = answer.cites.map((n) => citations[n - 1]).filter((c): c is Citation => !!c)
    modelCall = true
  } else if (triage === 'off_topic') {
    conv.off_topic_count += 1
    if (conv.off_topic_count >= s.off_topic_cutoff_after) {
      kind = 'refusal'
      text = cutoffText(locale)
      conv.state = 'resolved'
      ended = true
    } else if (s.off_topic_handling === 'handoff') {
      kind = 'handoff'
      text = s.handoff_notice[locale]
      handoff = buildHandoff('off_topic', locale, info)
    } else {
      text = config.refusal_copy[locale]
      if (s.off_topic_handling === 'warn' && conv.off_topic_count >= s.off_topic_warn_after) text = `${text} ${warnText(locale)}`
    }
  } else {
    text = config.refusal_copy[locale]
    handoff = buildHandoff(handoffReasonFor('low_score'), locale, info)
  }

  if (handoff && !s.handoff_summary) handoff = { ...handoff, summary: '', goal: handoff.goal }
  const disclosure = ended ? null : disclosureFor(s.disclosure_mode, locale, priorBot)
  const fullText = disclosure ? `${text}\n\n${disclosure}` : text

  for (const delta of wordChunks(fullText)) {
    await sleep(jitter(30, 8))
    if (stale()) return
    yield { type: 'reply', delta }
  }
  if (handoff) yield { type: 'handoff', handoff }

  const stageMs = round(performance.now() - t2)
  if (modelCall) {
    input_tokens = 110 + estimateTokens(content) + citeSource.reduce((sum, r) => sum + estimateTokens(r.item.content), 0)
    output_tokens = estimateTokens(text)
  }
  const total = input_tokens + output_tokens
  const base = { client_id: tenantId, conversation_id: conv.id, turn_id: job.turnId }
  const usedModel = modelCall
  logUsage({ ...base, feature: 'triage', group: 'bot', capability: 'llm', input_tokens: usedModel ? 70 + estimateTokens(content) : 0, output_tokens: usedModel ? 12 : 0, latency_ms: groundingMs })
  logUsage({ ...base, feature: 'autopilot', group: 'bot', capability: 'llm', input_tokens, output_tokens, latency_ms: stageMs })
  if (handoff) logUsage({ ...base, feature: 'handoff', group: 'bot', capability: 'llm', input_tokens: s.handoff_summary ? 150 : 0, output_tokens: s.handoff_summary ? 64 : 0, latency_ms: 0 })

  const turnRow = store.data.turns.find((t) => t.id === job.turnId)
  if (turnRow) {
    turnRow.grounded = grounded
    turnRow.top_score = grounding.top_score
  }
  newTurn(conv.id, 'bot', fullText, {
    grounded: method === 'canned' ? null : grounded && kind === 'answer',
    method,
    top_score: method === 'canned' ? null : grounding.top_score,
    citations: replyCites,
    tokens: total,
  })
  if (handoff && !ended) conv.state = 'handoff'
  conv.last_message_at = now()
  store.notify()

  yield {
    type: 'done',
    envelope: {
      turn_id: job.turnId,
      grounding,
      tier1,
      citations: kind === 'answer' && method === 'vector' ? citations : [],
      suggestions: [],
      reply: { text: fullText, kind },
      handoff,
      usage: { input_tokens, output_tokens, total_tokens: total },
      stages: [
        { name: 'grounding', ms: groundingMs },
        { name: 'tier1', ms: tier1Ms },
        { name: 'reply', ms: stageMs },
      ],
    },
  }
}
