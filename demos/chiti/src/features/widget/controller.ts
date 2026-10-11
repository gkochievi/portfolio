/**
 * The widget's conversation state: a module-level store per tenant slug, so the
 * chat survives navigation between `/`, `/widget` and `/live` (not reloads).
 * It listens to the event bus for the visitor's own session and talks to the
 * mock API through the public widget endpoints.
 */
import { useSyncExternalStore } from 'react'

import { bus } from '@/demo/bus'
import { errorMessage, isApiError, request } from '@/lib/api'
import { pickText } from '@/lib/format'
import type {
  ChatSession,
  FaqOption,
  FaqStep,
  FaqTree,
  Lang,
  Message,
  MessageFile,
  OperatorBrief,
  TypingState,
} from '@/types'

import type { WidgetConfig } from './api'
import type { WidgetLoginResult, WidgetRestore } from '@/demo/handlers/widget'

export type WidgetStage = 'faq' | 'form' | 'chat'
export type FeedbackPhase = 'none' | 'asking' | 'sent'

export interface LoginFailure {
  code: 'OFFLINE' | 'CLIENT_BANNED' | 'MISSING_FIELDS' | 'TENANT_DISABLED' | 'GENERIC'
  message: string
  bannedMessage?: string
  fieldErrors: Record<string, string>
}

export interface WidgetState {
  slug: string
  open: boolean
  stage: WidgetStage
  faqNodeId: string | null
  faqStack: string[]
  faqPath: FaqStep[]
  formStepPushed: boolean
  values: Record<string, string>
  prefilled: boolean
  submitting: boolean
  failure: LoginFailure | null
  sessionId: string | null
  session: ChatSession | null
  messages: Message[]
  operator: OperatorBrief | null
  typing: { who: TypingState['who']; name: string | null } | null
  warning: { disconnectAt: string } | null
  humanRequested: boolean
  requestingHuman: boolean
  unread: number
  feedback: FeedbackPhase
  /** Hopped once already (first load only). */
  hopped: boolean
}

const TBILISI = { lat: 41.6938, lng: 44.8015, label: 'Rustaveli Avenue, Tbilisi' }
const MAX_FILE_BYTES = 10 * 1024 * 1024

function initialState(slug: string, open = false): WidgetState {
  return {
    slug,
    open,
    stage: 'faq',
    faqNodeId: null,
    faqStack: [],
    faqPath: [],
    formStepPushed: false,
    values: {},
    prefilled: false,
    submitting: false,
    failure: null,
    sessionId: null,
    session: null,
    messages: [],
    operator: null,
    typing: null,
    warning: null,
    humanRequested: false,
    requestingHuman: false,
    unread: 0,
    feedback: 'none',
    hopped: false,
  }
}

function upsertMessage(list: Message[], message: Message): Message[] {
  const index = list.findIndex((row) => row.id === message.id)
  if (index >= 0) {
    const next = list.slice()
    next[index] = message
    return next
  }
  return [...list, message].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

export class WidgetController {
  private state: WidgetState
  private readonly listeners = new Set<() => void>()
  private typingClear: ReturnType<typeof setTimeout> | null = null
  private typingIdle: ReturnType<typeof setTimeout> | null = null
  private lastTypingSent = 0
  private typingOn = false
  private seenInFlight = false
  private operatorFor: string | null = null
  requestFeedback = false
  lang: Lang = 'en'

  constructor(readonly slug: string) {
    this.state = initialState(slug)
    bus.on('message:upsert', (message) => this.onMessage(message))
    bus.on('session:upsert', (session) => this.onSession(session))
    bus.on('typing:update', (typing) => this.onTyping(typing))
    bus.on('inactivity:warning', (warning) => {
      if (warning.sessionId === this.state.sessionId) this.set({ warning: { disconnectAt: warning.disconnectAt } })
    })
    bus.on('demo:reset', () => this.reset(true))
  }

  /* ------------------------------------------------------------- store */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): WidgetState => this.state

  private set(patch: Partial<WidgetState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of [...this.listeners]) listener()
  }

  /** Fresh start (after feedback, "start a new chat" or a demo reset). */
  reset(keepOpen = true): void {
    this.clearTimers()
    this.operatorFor = null
    this.set({ ...initialState(this.slug, keepOpen ? this.state.open : false), hopped: this.state.hopped })
  }

  private clearTimers(): void {
    if (this.typingClear) clearTimeout(this.typingClear)
    if (this.typingIdle) clearTimeout(this.typingIdle)
    this.typingClear = null
    this.typingIdle = null
    this.typingOn = false
  }

  /* ------------------------------------------------------- bus handlers */

  private onMessage(message: Message): void {
    if (message.sessionId !== this.state.sessionId) return
    const known = this.state.messages.some((row) => row.id === message.id)
    const incoming = message.sender !== 'user' && !message.isPreChat
    this.set({
      messages: upsertMessage(this.state.messages, message),
      typing: incoming && !known ? null : this.state.typing,
      unread: incoming && !known && !this.state.open ? this.state.unread + 1 : this.state.unread,
    })
    if (incoming && !message.seenAt && this.state.open) this.markSeen()
  }

  private onSession(session: ChatSession): void {
    if (session.id !== this.state.sessionId) return
    const ended = session.status === 'ended'
    const patch: Partial<WidgetState> = { session }
    if (ended) {
      patch.typing = null
      patch.warning = null
      if (this.state.feedback === 'none' && this.requestFeedback) patch.feedback = 'asking'
    } else if (!session.warningIssuedAt && this.state.warning) {
      patch.warning = null
    }
    this.set(patch)
    if ((session.operatorId ?? null) !== this.operatorFor) void this.refreshOperator(session.operatorId)
  }

  private onTyping(typing: TypingState): void {
    if (typing.sessionId !== this.state.sessionId || typing.who === 'customer') return
    if (this.typingClear) clearTimeout(this.typingClear)
    if (!typing.isTyping) {
      this.set({ typing: null })
      return
    }
    this.set({ typing: { who: typing.who, name: typing.name } })
    this.typingClear = setTimeout(() => this.set({ typing: null }), 6_000)
  }

  private async refreshOperator(operatorId: string | null): Promise<void> {
    this.operatorFor = operatorId ?? null
    const sessionId = this.state.sessionId
    if (!sessionId) return
    if (!operatorId) {
      this.set({ operator: null })
      return
    }
    try {
      const restored = await request<WidgetRestore>('GET', `/widget/sessions/${sessionId}`)
      if (this.state.sessionId === sessionId) this.set({ operator: restored.operator })
    } catch {
      // The status line falls back to the generic text.
    }
  }

  /* ------------------------------------------------------------ actions */

  setOpen(open: boolean): void {
    if (open === this.state.open) return
    this.set({ open, unread: open ? 0 : this.state.unread })
    if (open) this.markSeen()
  }

  markHopped(): void {
    if (!this.state.hopped) this.set({ hopped: true })
  }

  setValue(fieldId: string, value: string): void {
    this.set({ values: { ...this.state.values, [fieldId]: value }, failure: this.state.failure?.code === 'MISSING_FIELDS' ? null : this.state.failure })
  }

  /** Prefill the form once (the customer persona), without overwriting what the visitor typed. */
  prefill(values: Record<string, string>): void {
    if (this.state.prefilled || this.state.sessionId) return
    this.set({ prefilled: true, values: { ...values, ...this.state.values } })
  }

  /* ---- FAQ walk */

  chooseOption(tree: FaqTree, option: FaqOption): void {
    const node = this.state.faqNodeId ? tree.nodes[this.state.faqNodeId] : tree.nodes[tree.rootIds[0] ?? '']
    if (!node) return this.resetFaq()
    const step: FaqStep = { nodeId: node.id, question: pickText(node.text, this.lang), answer: pickText(option.label, this.lang) }
    const path = [...this.state.faqPath, step]
    const stack = [...this.state.faqStack, node.id]
    if (option.transferToOperator) {
      this.set({ faqPath: path, faqStack: stack, stage: 'form', formStepPushed: true })
      return
    }
    if (!option.nextId || !tree.nodes[option.nextId]) {
      this.resetFaq()
      return
    }
    this.set({ faqPath: path, faqStack: stack, faqNodeId: option.nextId })
  }

  /** The "Connect to operator" chip on an answer, or the header button. */
  connectToOperator(tree: FaqTree, label: string): void {
    const node = this.state.faqNodeId ? tree.nodes[this.state.faqNodeId] : null
    if (node && node.type === 'answer') {
      const step: FaqStep = { nodeId: node.id, question: pickText(node.text, this.lang), answer: label }
      this.set({ faqPath: [...this.state.faqPath, step], faqStack: [...this.state.faqStack, node.id], stage: 'form', formStepPushed: true })
      return
    }
    this.set({ stage: 'form', formStepPushed: false })
  }

  faqBack(): void {
    const stack = this.state.faqStack.slice()
    const previous = stack.pop()
    if (previous === undefined) return
    const rootLike = stack.length === 0
    this.set({ faqStack: stack, faqPath: this.state.faqPath.slice(0, -1), faqNodeId: rootLike ? null : previous })
  }

  resetFaq(): void {
    this.set({ faqNodeId: null, faqStack: [], faqPath: [], stage: 'faq', formStepPushed: false })
  }

  backFromForm(): void {
    if (this.state.formStepPushed) {
      const stack = this.state.faqStack.slice()
      const previous = stack.pop()
      this.set({
        stage: 'faq',
        formStepPushed: false,
        faqPath: this.state.faqPath.slice(0, -1),
        faqStack: stack,
        faqNodeId: previous === undefined || stack.length === 0 ? null : previous,
        failure: null,
      })
      return
    }
    this.set({ stage: 'faq', failure: null })
  }

  /* ---- login */

  async startChat(): Promise<boolean> {
    if (this.state.submitting) return false
    this.set({ submitting: true, failure: null })
    try {
      const result = await request<WidgetLoginResult>('POST', `/widget/${encodeURIComponent(this.slug)}/login`, {
        body: { fields: this.state.values, faqPath: this.state.faqPath, language: this.lang },
      })
      this.operatorFor = result.session.operatorId ?? null
      this.set({
        submitting: false,
        stage: 'chat',
        sessionId: result.session.id,
        session: result.session,
        messages: result.messages,
        operator: null,
        humanRequested: false,
        feedback: 'none',
        warning: null,
        typing: null,
      })
      if (result.session.operatorId) void this.refreshOperator(result.session.operatorId)
      return true
    } catch (error) {
      this.set({ submitting: false, failure: toFailure(error) })
      return false
    }
  }

  clearFailure(): void {
    this.set({ failure: null })
  }

  /* ---- conversation */

  private async post(path: string, body?: unknown): Promise<void> {
    const sessionId = this.state.sessionId
    if (!sessionId) return
    await request('POST', `/widget/sessions/${sessionId}/${path}`, { body })
  }

  async sendText(text: string): Promise<string | null> {
    const content = text.trim()
    if (!content) return null
    return this.send({ content })
  }

  async sendFile(file: File): Promise<string | null> {
    if (file.size > MAX_FILE_BYTES) return 'FILE_TOO_LARGE'
    const attached: MessageFile = { url: URL.createObjectURL(file), name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size }
    return this.send({ content: file.name, file: attached })
  }

  async sendLocation(): Promise<string | null> {
    return this.send({ content: TBILISI.label, location: { lat: TBILISI.lat, lng: TBILISI.lng, label: TBILISI.label } })
  }

  private async send(body: { content: string; file?: MessageFile; location?: { lat: number; lng: number; label: string | null } }): Promise<string | null> {
    this.stopTyping()
    try {
      await this.post('messages', body)
      return null
    } catch (error) {
      return errorMessage(error)
    }
  }

  /** Throttled "customer is typing" with the draft (typing transparency). */
  notifyTyping(draft: string): void {
    if (!this.state.sessionId || this.state.session?.status === 'ended') return
    if (!draft.trim()) return this.stopTyping()
    const now = Date.now()
    if (now - this.lastTypingSent > 1_000) {
      this.lastTypingSent = now
      this.typingOn = true
      void this.post('typing', { isTyping: true, draft }).catch(() => undefined)
    }
    if (this.typingIdle) clearTimeout(this.typingIdle)
    this.typingIdle = setTimeout(() => this.stopTyping(), 2_500)
  }

  stopTyping(): void {
    if (this.typingIdle) clearTimeout(this.typingIdle)
    this.typingIdle = null
    if (!this.typingOn) return
    this.typingOn = false
    this.lastTypingSent = 0
    void this.post('typing', { isTyping: false, draft: '' }).catch(() => undefined)
  }

  markSeen(): void {
    if (this.seenInFlight || !this.state.sessionId) return
    const pending = this.state.messages.some((row) => row.sender !== 'user' && !row.seenAt)
    if (!pending) return
    this.seenInFlight = true
    void this.post('seen')
      .catch(() => undefined)
      .finally(() => {
        this.seenInFlight = false
      })
  }

  async requestHuman(): Promise<string | null> {
    if (this.state.requestingHuman || this.state.humanRequested) return null
    this.set({ requestingHuman: true })
    try {
      await this.post('request-human')
      this.set({ humanRequested: true, requestingHuman: false })
      return null
    } catch (error) {
      this.set({ requestingHuman: false })
      return errorMessage(error)
    }
  }

  async acknowledgeWarning(): Promise<void> {
    this.set({ warning: null })
    await this.post('acknowledge-warning').catch(() => undefined)
  }

  async endChat(): Promise<string | null> {
    try {
      const result = await request<{ requestFeedback: boolean }>('POST', `/widget/sessions/${this.state.sessionId}/end`)
      this.requestFeedback = result.requestFeedback
      // The session:upsert event already moved the widget to its ended state.
      if (this.state.session?.status === 'ended' && this.state.feedback === 'none' && result.requestFeedback) this.set({ feedback: 'asking' })
      return null
    } catch (error) {
      return errorMessage(error)
    }
  }

  async sendFeedback(rating: number, comment: string): Promise<string | null> {
    try {
      await this.post('feedback', { rating, comment })
      this.set({ feedback: 'sent' })
      return null
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        this.set({ feedback: 'sent' })
        return null
      }
      return errorMessage(error)
    }
  }

  skipFeedback(): void {
    this.set({ feedback: 'sent' })
  }
}

function toFailure(error: unknown): LoginFailure {
  if (!isApiError(error)) return { code: 'GENERIC', message: errorMessage(error), fieldErrors: {} }
  const fields = error.fieldErrors
  const code = fields.code?.[0] as LoginFailure['code'] | undefined
  const fieldErrors: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key !== 'code' && key !== 'message' && key !== 'bannedMessage' && value[0]) fieldErrors[key] = value[0]
  }
  const failure: LoginFailure = {
    code: code && ['OFFLINE', 'CLIENT_BANNED', 'MISSING_FIELDS', 'TENANT_DISABLED'].includes(code) ? code : 'GENERIC',
    message: fields.message?.[0] ?? error.message,
    fieldErrors,
  }
  const banned = fields.bannedMessage?.[0]
  if (banned) failure.bannedMessage = banned
  return failure
}

/* ------------------------------------------------------------ registry */

const controllers = new Map<string, WidgetController>()

export function getWidget(slug: string): WidgetController {
  const key = slug.toLowerCase()
  let controller = controllers.get(key)
  if (!controller) {
    controller = new WidgetController(key)
    controllers.set(key, controller)
  }
  return controller
}

export function useWidget(slug: string): [WidgetState, WidgetController] {
  const controller = getWidget(slug)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return [state, controller]
}

export function lastStaffName(state: WidgetState): string | null {
  return state.operator?.nickname ?? null
}

/** Re-exported for the config-driven view. */
export type { WidgetConfig }
