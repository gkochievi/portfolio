/**
 * Copilot simulator (owner: operator-tools). On every customer message of a
 * handed-off chat a draft is created `running`, then filled `ready` 0.8-1.5 s
 * later from the pre-written content (knowledge + 2-3 suggestions by topic and
 * the customer's language). Regenerate and the tone / language transforms reuse
 * the same code. While the AI outage switch is on, drafts end in `error`
 * (circuit open). Every phase is broadcast as `copilot:update`.
 */
import type { ChatSession, ContentLang, CopilotDraft, CopilotSuggestion, CopilotTransform, KnowledgeCard, Message, SessionTopic } from '@/types'

import { broadcast, bus } from '../bus'
import { nowIso } from '../clock'
import { aiOutageActive } from '../engine'
import { newId, store } from '../store'
import {
  ACK_RE,
  ESCALATE_CONTENT,
  ESCALATE_RE,
  TOPIC_CONTENT,
  applyTransform,
  suggestionText,
  type KnowledgeSpec,
  type SuggestionSpec,
  type Tone,
} from '../content/operator-tools'

interface DraftMeta {
  topic: SessionTopic
  lang: ContentLang
  tone: Tone
  escalate: boolean
  ack: boolean
  /** Order of the topic's suggestions (regenerate rotates it). */
  order: number[]
}

const MAX_DRAFTS_PER_SESSION = 5
const REGENERATE_WINDOW_MS = 20_000
const REGENERATE_LIMIT = 3
const RATE_LIMIT_RETRY_MS = 8_000

const meta = new Map<string, DraftMeta>()
const timers = new Set<ReturnType<typeof setTimeout>>()
const regenerations = new Map<string, number[]>()

function later(ms: number, fn: () => void): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    fn()
  }, ms)
  timers.add(timer)
}

const between = (min: number, max: number) => min + Math.random() * (max - min)

function sessionById(sessionId: string): ChatSession | undefined {
  return store.data.sessions.find((row) => row.id === sessionId)
}

/** The newest draft of a chat. */
export function latestDraft(sessionId: string): CopilotDraft | undefined {
  const drafts = store.data.copilotDrafts
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const draft = drafts[index] as CopilotDraft
    if (draft.sessionId === sessionId) return draft
  }
  return undefined
}

export function lastCustomerTurn(sessionId: string): Message | undefined {
  let last: Message | undefined
  for (const message of store.data.messages) {
    if (message.sessionId !== sessionId || message.sender !== 'user' || message.isPreChat || message.isAutoGreeting) continue
    if (!last || Date.parse(message.timestamp) >= Date.parse(last.timestamp)) last = message
  }
  return last
}

function baseOrder(topic: SessionTopic): number[] {
  return TOPIC_CONTENT[topic].suggestions.map((_, index) => index)
}

function metaOf(draft: CopilotDraft, session: ChatSession): DraftMeta {
  return (
    meta.get(draft.id) ?? {
      topic: session.topic,
      lang: session.clientLanguage,
      tone: 'base',
      escalate: draft.suggestions.length === 1 && draft.suggestions[0]?.kind === 'escalate',
      ack: false,
      order: baseOrder(session.topic),
    }
  )
}

function cards(specs: KnowledgeSpec[], lang: ContentLang): KnowledgeCard[] {
  const key = lang === 'ka' ? 'ka' : 'en'
  return specs.map((spec, index) => ({
    n: index + 1,
    title: spec.title[key],
    snippet: spec.snippet[key],
    documentId: spec.documentId,
    score: Math.round((0.86 - index * 0.06) * 100) / 100,
  }))
}

type Filled = Pick<CopilotDraft, 'knowledge' | 'suggestions' | 'handoff' | 'grounded' | 'commitmentWarning'>

function fill(session: ChatSession, state: DraftMeta): Filled {
  if (state.ack) return { knowledge: [], suggestions: [], handoff: null, grounded: false, commitmentWarning: false }
  const topic = TOPIC_CONTENT[state.topic]
  const specs: SuggestionSpec[] = state.escalate ? [ESCALATE_CONTENT.suggestion] : state.order.map((index) => topic.suggestions[index] as SuggestionSpec)
  const knowledgeSpecs = state.escalate ? ESCALATE_CONTENT.knowledge : topic.knowledge
  const key = state.lang === 'ka' ? 'ka' : 'en'
  const suggestions: CopilotSuggestion[] = specs.map((spec, index) => ({
    index,
    kind: spec.kind,
    text: suggestionText(spec, state.lang, state.tone),
    citations: spec.citations,
  }))
  return {
    knowledge: cards(knowledgeSpecs, state.lang),
    suggestions,
    handoff: state.escalate
      ? { recommended: true, reason: 'ai_recommended', summary: ESCALATE_CONTENT.summary[key], goal: ESCALATE_CONTENT.goal[key] }
      : { recommended: false, reason: null, summary: session.aiHandoff?.summary ?? '', goal: session.aiHandoff?.goal ?? '' },
    grounded: true,
    commitmentWarning: state.escalate ? true : topic.commitment,
  }
}

function pushDraft(draft: CopilotDraft): void {
  const drafts = store.data.copilotDrafts
  // Drop stale `running` drafts of the same chat and keep only the latest few.
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const row = drafts[index] as CopilotDraft
    if (row.sessionId === draft.sessionId && row.state === 'running') {
      drafts.splice(index, 1)
      meta.delete(row.id)
    }
  }
  drafts.push(draft)
  const mine = drafts.filter((row) => row.sessionId === draft.sessionId)
  for (const stale of mine.slice(0, Math.max(0, mine.length - MAX_DRAFTS_PER_SESSION))) {
    drafts.splice(drafts.indexOf(stale), 1)
    meta.delete(stale.id)
  }
  broadcast('copilot:update', draft)
}

function blankDraft(session: ChatSession, turnMessageId: string | null, transform: CopilotTransform | null): CopilotDraft {
  return {
    id: newId('cop_'),
    tenantId: session.tenantId,
    sessionId: session.id,
    turnMessageId,
    state: 'running',
    retryAfterMs: null,
    knowledge: [],
    suggestions: [],
    handoff: null,
    grounded: false,
    commitmentWarning: false,
    transform,
    createdAt: nowIso(),
  }
}

/** running -> ready (or error while the AI outage switch is on). */
function complete(draftId: string, state: DraftMeta, delayMs: number): void {
  later(delayMs, () => {
    const draft = store.data.copilotDrafts.find((row) => row.id === draftId)
    const session = draft ? sessionById(draft.sessionId) : undefined
    if (!draft || !session || draft.state !== 'running') return
    if (aiOutageActive()) {
      const until = store.data.demo.aiOutageUntil
      draft.state = 'error'
      draft.retryAfterMs = until ? Math.max(0, Date.parse(until) - Date.now()) : 45_000
      draft.handoff = { recommended: true, reason: 'circuit_open', summary: session.aiHandoff?.summary ?? '', goal: session.aiHandoff?.goal ?? '' }
    } else {
      Object.assign(draft, fill(session, state), { state: 'ready', retryAfterMs: null })
      meta.set(draft.id, state)
    }
    broadcast('copilot:update', draft)
  })
}

/** A fresh draft for the customer's latest turn. `regenerate` rotates the suggestions. */
export function startDraft(sessionId: string, options: { regenerate?: boolean } = {}): CopilotDraft | null {
  const session = sessionById(sessionId)
  if (!session) return null
  const turn = lastCustomerTurn(sessionId)
  if (!turn) return null
  const text = turn.type === 'text' ? turn.content.trim() : ''
  const previous = latestDraft(sessionId)
  const previousMeta = previous ? metaOf(previous, session) : undefined
  const base = baseOrder(session.topic)
  let order = base
  if (options.regenerate && previousMeta && base.length > 1) {
    const [first, ...rest] = previousMeta.order
    order = [...rest, first as number]
  }
  const state: DraftMeta = {
    topic: session.topic,
    lang: session.clientLanguage,
    tone: 'base',
    escalate: ESCALATE_RE.test(text),
    ack: !options.regenerate && text.length > 0 && text.length <= 30 && ACK_RE.test(text),
    order,
  }
  const draft = blankDraft(session, turn.id, null)
  pushDraft(draft)
  complete(draft.id, state, between(800, 1500))
  return draft
}

/** The regenerate button: rate limited after three presses in 20 s. */
export function regenerateDraft(sessionId: string): CopilotDraft | null {
  const now = Date.now()
  const recent = (regenerations.get(sessionId) ?? []).filter((at) => now - at < REGENERATE_WINDOW_MS)
  if (recent.length >= REGENERATE_LIMIT) {
    const session = sessionById(sessionId)
    if (!session) return null
    const draft: CopilotDraft = { ...blankDraft(session, lastCustomerTurn(sessionId)?.id ?? null, null), state: 'rate_limited', retryAfterMs: RATE_LIMIT_RETRY_MS }
    pushDraft(draft)
    return draft
  }
  recent.push(now)
  regenerations.set(sessionId, recent)
  return startDraft(sessionId, { regenerate: true })
}

/** Shorter / warmer / formal / to RU / to KA / to EN of the latest ready draft. */
export function transformDraft(sessionId: string, transform: CopilotTransform): CopilotDraft | null {
  const session = sessionById(sessionId)
  const previous = latestDraft(sessionId)
  if (!session || !previous || previous.state !== 'ready' || previous.suggestions.length === 0) return null
  const current = metaOf(previous, session)
  const next: DraftMeta = { ...current, ...applyTransform(current, transform) }
  const draft = blankDraft(session, previous.turnMessageId, transform)
  pushDraft(draft)
  complete(draft.id, next, between(450, 900))
  return draft
}

export function start(): () => void {
  meta.clear()
  regenerations.clear()
  const off = bus.on('message:upsert', (message) => {
    if (message.sender !== 'user' || message.isPreChat || message.isAutoGreeting) return
    const session = sessionById(message.sessionId)
    if (!session || session.status === 'ended') return
    if (session.aiState !== 'handed_off' && session.aiState !== 'copilot') return
    startDraft(session.id)
  })
  return () => {
    off()
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}
