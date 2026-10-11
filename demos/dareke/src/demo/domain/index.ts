/**
 * Shared domain operations over the store. Feature
 * handlers and simulators call THESE instead of re-implementing the state
 * machines, so the operator workspace, the floor simulator, the auto-dialer,
 * campaigns and reports all agree.
 *
 * Rules
 * - The helpers emit `call:event` and `agent:state` themselves.
 * - Callers call `changed(...scopes)` once after a batch of writes.
 * - Records created for the signed-in (human) operator get tab-unique ids and
 *   are mirrored to other open tabs with `syncOut` by the helpers themselves.
 */
import { DemoApiError, conflict, forbidden, notFound } from '@portfolio/demo-kit'

import type {
  AgentCurrentState,
  AgentStateView,
  AgentStatus,
  Campaign,
  CallEvent,
  CallEventType,
  CallMode,
  CallRecord,
  CallRecordView,
  CampaignNumber,
  CampaignStats,
  CampaignWithStats,
  DataScope,
  Disposition,
  DncEntry,
  DncSource,
  HangupBy,
  Localized,
  NumberStatus,
  Role,
  SyncCollection,
  User,
  UserSummary,
} from '@/types'
import { TAB_ID, bus } from '../bus'
import { HANGUP_CAUSE_TEXT } from '../seed'
import { currentUser, session, store } from '../store'

export { HANGUP_CAUSE_TEXT }

const SEC = 1000
const MIN = 60 * SEC

/* ------------------------------------------------------------------ basics */

/** The signed-in User or a 401 DemoApiError. */
export const requireUser = (): User => {
  const user = currentUser()
  if (!user) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  if (!user.isActive) throw forbidden('This account is disabled.')
  return user
}

/** The signed-in User if their role is listed, else a 403 (forbidden()). */
export const requireRole = (...roles: Role[]): User => {
  const user = requireUser()
  if (!roles.includes(user.role)) throw forbidden()
  return user
}

/** Current time as ISO. */
export const nowIso = (): string => new Date().toISOString()

/** Local midnight today, in ms. */
export const startOfToday = (): number => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const seconds = (fromIso: string | null, to: number): number => (fromIso ? Math.max(0, Math.round((to - Date.parse(fromIso)) / SEC)) : 0)

/** The signed-in user's id when they are an operator (the human on the floor). */
export const humanAgentId = (): string | null => {
  const account = session.current()
  return account && account.role === 'operator' ? account.userId : null
}

/** Is this agent the visitor (signed in as them in this tab)? */
export const isHuman = (agentId: string | null | undefined): boolean => agentId != null && session.current()?.userId === agentId

/** Ids for human-made records carry this tab's tag so mirrored rows never collide with another tab's own. */
const newId = (prefix: string, human: boolean): string => store.nextId(human ? `${prefix}${TAB_ID}_` : prefix)

/* ----------------------------------------------------------------- lookups */

export const userById = (id: string | null | undefined): User | undefined => (id ? store.data.users.find((user) => user.id === id) : undefined)
export const campaignById = (id: string): Campaign | undefined => store.data.campaigns.find((campaign) => campaign.id === id)
export const numberById = (id: string): CampaignNumber | undefined => store.data.numbers.find((lead) => lead.id === id)
export const callById = (id: string): CallRecord | undefined => store.data.calls.find((call) => call.id === id)
export const statusById = (id: string): AgentStatus | undefined => store.data.agentStatuses.find((status) => status.id === id)
export const dispositionByCode = (code: string | null | undefined): Disposition | undefined =>
  code ? store.data.dispositions.find((disposition) => disposition.code === code) : undefined
export const agentStateOf = (agentId: string): AgentCurrentState | undefined => store.data.agentStates.find((state) => state.agentId === agentId)

/** A user's bilingual display name, or null for an unknown id. */
export const userName = (userId: string | null): Localized | null => userById(userId)?.displayName ?? null

export const userSummary = (user: User): UserSummary => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  sipExtension: user.sipExtension,
})

/* ------------------------------------------------------------------ phones */

/**
 * Normalise a raw phone to E.164 (+995...) or null when invalid. Accepts a
 * 9-digit national number, 995..., +995..., 00995..., with spaces, dashes,
 * dots or brackets; other international numbers with a leading + (8-15 digits).
 */
export const normalizePhone = (raw: string): string | null => {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  if (/[^\d\s+().-]/.test(trimmed)) return null
  const plus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (!plus && digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 9 && /^[3-7]/.test(digits)) return `+995${digits}`
  if (digits.length === 12 && digits.startsWith('995')) return `+${digits}`
  if ((plus || trimmed.startsWith('00')) && digits.length >= 8 && digits.length <= 15 && !digits.startsWith('995')) return `+${digits}`
  return null
}

/** Is this E.164 number on the global DNC list? */
export const isOnDnc = (phone: string): boolean => store.data.dnc.some((entry) => entry.phoneNumber === phone)

/** Add a number to the DNC list (no-op when it is already there). Returns the entry. */
export const addToDnc = (phone: string, input: { reason: string; source: DncSource; addedById: string | null }): DncEntry => {
  const existing = store.data.dnc.find((entry) => entry.phoneNumber === phone)
  if (existing) return existing
  const human = isHuman(input.addedById)
  const entry: DncEntry = {
    id: newId('dnc_', human),
    phoneNumber: phone,
    reason: input.reason,
    source: input.source,
    addedById: input.addedById,
    createdAt: nowIso(),
  }
  store.data.dnc.push(entry)
  if (human) syncOut('dnc', entry.id, entry)
  return entry
}

/* --------------------------------------------------------------- campaigns */

const RETRYABLE: NumberStatus[] = ['PENDING', 'NO_ANSWER', 'BUSY']

/** Can this lead be dialled right now (PENDING or a due NO_ANSWER/BUSY retry)? */
export const isDialable = (lead: CampaignNumber, campaign: Campaign, now = Date.now()): boolean =>
  RETRYABLE.includes(lead.status) &&
  lead.attempts < campaign.maxAttempts &&
  (lead.nextAttemptAt === null || Date.parse(lead.nextAttemptAt) <= now)

/** Derived counters for one campaign. */
export const campaignStats = (campaignId: string): CampaignStats => {
  const campaign = campaignById(campaignId)
  const now = Date.now()
  const maxAttempts = campaign?.maxAttempts ?? 3
  const connectedIds = new Set<string>()
  let sales = 0
  for (const call of store.data.calls) {
    if (call.campaignId !== campaignId) continue
    if (call.callAnsweredAt && (call.outcome === 'ANSWERED' || call.outcome === 'IN_PROGRESS')) connectedIds.add(call.campaignNumberId)
    if (call.dispositionCode === 'SALE') sales += 1
  }
  let total = 0
  let dialed = 0
  let connected = 0
  let pending = 0
  let completed = 0
  let failed = 0
  let dnc = 0
  let callbacks = 0
  for (const lead of store.data.numbers) {
    if (lead.campaignId !== campaignId) continue
    total += 1
    if (lead.attempts > 0) dialed += 1
    // Recycled leads (attempts reset to 0) do not count as connected again.
    if (lead.attempts > 0 && (connectedIds.has(lead.id) || lead.status === 'CONNECTED')) connected += 1
    switch (lead.status) {
      case 'PENDING':
        pending += 1
        break
      case 'NO_ANSWER':
      case 'BUSY':
        if (lead.attempts < maxAttempts) pending += 1
        break
      case 'CALLBACK_SCHEDULED':
        callbacks += 1
        if (lead.nextAttemptAt && Date.parse(lead.nextAttemptAt) <= now) pending += 1
        break
      case 'COMPLETED':
        completed += 1
        break
      case 'FAILED':
        failed += 1
        break
      case 'DNC':
        dnc += 1
        break
      default:
        break
    }
  }
  const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.min(100, Math.round((part / whole) * 1000) / 10))
  return {
    totalNumbers: total,
    dialed,
    connected,
    pending,
    completed,
    failed,
    dnc,
    callbacks,
    sales,
    progress: pct(dialed, total),
    answerRate: pct(connected, dialed),
    conversionRate: pct(sales, connected),
  }
}

/** Campaign + stats + agentCount. */
export const withStats = (campaign: Campaign): CampaignWithStats => ({
  ...campaign,
  stats: campaignStats(campaign.id),
  agentCount: store.data.campaignAgents.filter((link) => link.campaignId === campaign.id).length,
})

/** Recycle finished leads to PENDING so a visitor never runs a campaign dry. */
function refill(campaign: Campaign): void {
  const leads = store.data.numbers.filter((lead) => lead.campaignId === campaign.id)
  const now = Date.now()
  const left = leads.filter((lead) => isDialable(lead, campaign, now)).length
  if (left >= 20) return
  // Unreached leads first, then finished non-sales, and customers who already bought last.
  const rank = (lead: CampaignNumber) => (lead.status === 'COMPLETED' ? (lead.lastDispositionCode === 'SALE' ? 2 : 1) : 0)
  const recyclable = leads
    .filter((lead) => lead.status === 'COMPLETED' || lead.status === 'FAILED' || ((lead.status === 'NO_ANSWER' || lead.status === 'BUSY') && lead.attempts >= campaign.maxAttempts))
    .filter((lead) => !isOnDnc(lead.phoneNumber))
    .sort((a, b) => rank(a) - rank(b) || (a.lastAttemptAt ?? '').localeCompare(b.lastAttemptAt ?? ''))
    .slice(0, 60)
  for (const lead of recyclable) {
    lead.status = 'PENDING'
    lead.attempts = 0
    lead.nextAttemptAt = null
    lead.lastDispositionCode = null
  }
}

/**
 * Next dialable lead (source getNextNumber): PENDING (or a retryable
 * NO_ANSWER/BUSY) with attempts < maxAttempts and nextAttemptAt null/due,
 * ordered by nextAttemptAt (due retries first) then createdAt; a DNC hit is
 * marked DNC and skipped; falls back to due CALLBACK_SCHEDULED. Refills the
 * campaign when fewer than 20 remain. Null when nothing is eligible.
 * Does not check campaign status; callers do.
 */
export const getNextNumber = (campaignId: string): CampaignNumber | null => {
  const campaign = campaignById(campaignId)
  if (!campaign) return null
  refill(campaign)
  const now = Date.now()
  const candidates = store.data.numbers
    .filter((lead) => lead.campaignId === campaignId && isDialable(lead, campaign, now))
    .sort((a, b) => {
      if (a.nextAttemptAt !== b.nextAttemptAt) {
        if (a.nextAttemptAt === null) return 1
        if (b.nextAttemptAt === null) return -1
        return a.nextAttemptAt.localeCompare(b.nextAttemptAt)
      }
      return a.createdAt.localeCompare(b.createdAt)
    })
  for (const lead of candidates) {
    if (isOnDnc(lead.phoneNumber)) {
      lead.status = 'DNC'
      lead.nextAttemptAt = null
      continue
    }
    return lead
  }
  const callback = store.data.numbers
    .filter(
      (lead) =>
        lead.campaignId === campaignId &&
        lead.status === 'CALLBACK_SCHEDULED' &&
        lead.nextAttemptAt !== null &&
        Date.parse(lead.nextAttemptAt) <= now &&
        !isOnDnc(lead.phoneNumber),
    )
    .sort((a, b) => (a.nextAttemptAt ?? '').localeCompare(b.nextAttemptAt ?? ''))[0]
  return callback ?? null
}

/* ------------------------------------------------------------------- calls */

/** Hold start per live call (ms), to accumulate holdDuration. */
const holdStarted = new Map<string, number>()
bus.on('demo:reset', () => holdStarted.clear())

const touchAgent = (agentId: string): void => {
  bus.emit('agent:state', { agentId })
  if (isHuman(agentId)) {
    const state = agentStateOf(agentId)
    if (state) syncOut('agentStates', agentId, state)
  }
}

const syncCall = (call: CallRecord, lead?: CampaignNumber): void => {
  if (!isHuman(call.agentId)) return
  syncOut('calls', call.id, call)
  if (lead) syncOut('numbers', lead.id, lead)
}

/** Bind a call to an agent: On call status, current call and campaign, phase. */
function bindAgent(agentId: string, call: CallRecord, phase: 'ringing' | 'answered'): void {
  const onCall = statusIdByName('on_call')
  const state = agentStateOf(agentId)
  if (!state || state.statusId !== onCall) setAgentStatus(agentId, onCall, { campaignId: call.campaignId, callId: call.id, silent: true })
  const bound = agentStateOf(agentId)
  if (!bound) return
  bound.currentCallId = call.id
  bound.currentCampaignId = call.campaignId
  bound.callPhase = phase
  touchAgent(agentId)
}

/** Start a call: number -> DIALING (attempts+1, lastAttemptAt); CallRecord IN_PROGRESS; agent state callPhase 'ringing' (+ On call status) when agentId is set; emits 'ringing'. */
export const startCall = (input: { campaignId: string; numberId: string; agentId: string | null; mode: CallMode }): CallRecord => {
  const campaign = campaignById(input.campaignId)
  if (!campaign) throw notFound('Campaign not found')
  const lead = numberById(input.numberId)
  if (!lead) throw notFound('Number not found')
  const now = nowIso()
  lead.status = 'DIALING'
  lead.attempts += 1
  lead.lastAttemptAt = now
  lead.nextAttemptAt = null
  const call: CallRecord = {
    id: newId('call_', isHuman(input.agentId)),
    campaignId: campaign.id,
    campaignNumberId: lead.id,
    agentId: input.agentId,
    callerId: campaign.callerId,
    destinationNumber: lead.phoneNumber,
    customerName: lead.customerName,
    mode: input.mode,
    outcome: 'IN_PROGRESS',
    callInitiatedAt: now,
    callAnsweredAt: null,
    callEndedAt: null,
    ringDuration: 0,
    talkDuration: 0,
    holdDuration: 0,
    totalDuration: 0,
    dispositionCode: null,
    dispositionNote: null,
    hangupCause: null,
    hangupCauseText: null,
    hangupBy: null,
    recordingUrl: null,
    recordingDuration: null,
    callbackScheduledAt: null,
    callbackNote: null,
  }
  store.data.calls.push(call)
  if (input.agentId) bindAgent(input.agentId, call, 'ringing')
  syncCall(call, lead)
  emitCallEvent(call, 'ringing')
  return call
}

/** Customer answered: number CONNECTED, callAnsweredAt, ringDuration; agent callPhase 'answered'; emits 'answered'. Pass agentId to bind an AUTO call to an agent. */
export const answerCall = (callId: string, agentId?: string | null): CallRecord => {
  const call = callById(callId)
  if (!call) throw notFound('Call not found')
  if (call.outcome !== 'IN_PROGRESS') throw conflict('This call has already ended')
  const now = Date.now()
  if (agentId) call.agentId = agentId
  if (!call.callAnsweredAt) {
    call.callAnsweredAt = new Date(now).toISOString()
    call.ringDuration = seconds(call.callInitiatedAt, now)
  }
  const lead = numberById(call.campaignNumberId)
  if (lead) lead.status = 'CONNECTED'
  if (call.agentId) bindAgent(call.agentId, call, 'answered')
  syncCall(call, lead)
  emitCallEvent(call, 'answered')
  return call
}

/** Hold / resume: accumulates holdDuration; agent callPhase 'hold'/'answered'; emits 'hold'/'unhold'. */
export const setHold = (callId: string, onHold: boolean): CallRecord => {
  const call = callById(callId)
  if (!call) throw notFound('Call not found')
  if (call.outcome !== 'IN_PROGRESS' || !call.callAnsweredAt) throw conflict('Only a connected call can be put on hold')
  const holding = holdStarted.has(callId)
  if (onHold === holding) return call
  if (onHold) holdStarted.set(callId, Date.now())
  else {
    const started = holdStarted.get(callId) ?? Date.now()
    holdStarted.delete(callId)
    call.holdDuration += Math.round((Date.now() - started) / SEC)
  }
  const state = call.agentId ? agentStateOf(call.agentId) : undefined
  if (state && state.currentCallId === callId) {
    state.callPhase = onHold ? 'hold' : 'answered'
    touchAgent(state.agentId)
  }
  syncCall(call)
  emitCallEvent(call, onHold ? 'hold' : 'unhold')
  return call
}

/** Seconds the call has been on hold so far (live), for timers. */
export const holdSecondsOf = (call: CallRecord): number => {
  const started = holdStarted.get(call.id)
  return call.holdDuration + (started ? Math.round((Date.now() - started) / SEC) : 0)
}

/** Put a lead back on the retry path after an unanswered attempt. */
function retryLead(lead: CampaignNumber, campaign: Campaign | undefined, status: 'NO_ANSWER' | 'BUSY' | 'PENDING'): void {
  const maxAttempts = campaign?.maxAttempts ?? 3
  if (lead.attempts >= maxAttempts) {
    lead.status = 'FAILED'
    lead.nextAttemptAt = null
    return
  }
  lead.status = status
  lead.nextAttemptAt = new Date(Date.now() + (campaign?.retryDelayMinutes ?? 60) * MIN).toISOString()
}

/**
 * End a call. Answered calls: outcome ANSWERED, talkDuration. Unanswered:
 * outcome NO_ANSWER (cause 19) / BUSY (17) / FAILED (34) / ABANDONED, number
 * back to retryable with nextAttemptAt = now + retryDelayMinutes (or FAILED
 * when attempts >= maxAttempts). Clears the agent's call; emits 'ended' /
 * 'no_answer' / 'busy' / 'abandoned'. Does NOT change the agent's status.
 * Idempotent: ending an ended call returns it unchanged.
 */
export const endCall = (
  callId: string,
  input: { hangupBy: HangupBy; cause: number; outcome?: 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'ABANDONED' },
): CallRecord => {
  const call = callById(callId)
  if (!call) throw notFound('Call not found')
  if (call.outcome !== 'IN_PROGRESS') return call
  const now = Date.now()
  if (holdStarted.has(callId)) {
    call.holdDuration += Math.round((now - (holdStarted.get(callId) ?? now)) / SEC)
    holdStarted.delete(callId)
  }
  const lead = numberById(call.campaignNumberId)
  const campaign = campaignById(call.campaignId)
  let event: CallEventType
  if (call.callAnsweredAt && !input.outcome) {
    call.outcome = 'ANSWERED'
    call.talkDuration = seconds(call.callAnsweredAt, now)
    event = 'ended'
  } else {
    const outcome = input.outcome ?? (input.cause === 17 ? 'BUSY' : input.cause === 34 ? 'FAILED' : 'NO_ANSWER')
    call.outcome = outcome
    if (!call.callAnsweredAt) call.ringDuration = seconds(call.callInitiatedAt, now)
    call.talkDuration = 0
    if (lead) retryLead(lead, campaign, outcome === 'BUSY' ? 'BUSY' : outcome === 'NO_ANSWER' ? 'NO_ANSWER' : 'PENDING')
    event = outcome === 'NO_ANSWER' ? 'no_answer' : outcome === 'BUSY' ? 'busy' : outcome === 'ABANDONED' ? 'abandoned' : 'ended'
  }
  call.callEndedAt = new Date(now).toISOString()
  call.totalDuration = seconds(call.callInitiatedAt, now)
  call.hangupCause = input.cause
  call.hangupCauseText = HANGUP_CAUSE_TEXT[input.cause] ?? null
  call.hangupBy = input.hangupBy
  if (call.agentId) {
    const state = agentStateOf(call.agentId)
    if (state && state.currentCallId === callId) {
      state.currentCallId = null
      state.callPhase = null
      touchAgent(state.agentId)
    }
  }
  syncCall(call, lead)
  emitCallEvent(call, event)
  return call
}

/**
 * Forced disposition (source setDisposition). Writes the code/note/callback on
 * the CallRecord; number -> COMPLETED (isFinal), CALLBACK_SCHEDULED
 * (scheduleCallback; nextAttemptAt = callbackAt), DNC (addToDnc; upserts a
 * DncEntry with source DISPOSITION, addedById = actorId), or back to the retry
 * path for NO_ANSWER/BUSY/VOICEMAIL. Throws DemoApiError.validation when a
 * callback date is required but missing or in the past. A call still in
 * progress is ended first (agent hang-up).
 */
export const applyDisposition = (
  callId: string,
  input: { code: string; note?: string | null; callbackAt?: string | null; actorId: string },
): CallRecord => {
  const call = callById(callId)
  if (!call) throw notFound('Call not found')
  const disposition = dispositionByCode(input.code)
  if (!disposition || !disposition.isActive) throw DemoApiError.validation({ code: 'Choose a disposition' })
  let callbackAt: string | null = null
  if (disposition.scheduleCallback) {
    const at = input.callbackAt ? Date.parse(input.callbackAt) : Number.NaN
    if (!Number.isFinite(at)) throw DemoApiError.validation({ callbackAt: 'Choose a callback date and time' })
    if (at < Date.now() - MIN) throw DemoApiError.validation({ callbackAt: 'The callback time cannot be in the past' })
    callbackAt = new Date(at).toISOString()
  }
  if (call.outcome === 'IN_PROGRESS') endCall(callId, { hangupBy: 'AGENT', cause: 16 })

  const note = input.note?.trim() ? input.note.trim() : null
  call.dispositionCode = disposition.code
  call.dispositionNote = note
  call.callbackScheduledAt = callbackAt
  call.callbackNote = callbackAt ? note : null

  const lead = numberById(call.campaignNumberId)
  if (lead) {
    lead.lastDispositionCode = disposition.code
    if (disposition.addToDnc) {
      lead.status = 'DNC'
      lead.nextAttemptAt = null
      addToDnc(lead.phoneNumber, { reason: 'Customer asked not to be called again', source: 'DISPOSITION', addedById: input.actorId })
    } else if (disposition.scheduleCallback) {
      lead.status = 'CALLBACK_SCHEDULED'
      lead.nextAttemptAt = callbackAt
    } else if (disposition.isFinal) {
      lead.status = 'COMPLETED'
      lead.nextAttemptAt = null
    } else {
      retryLead(lead, campaignById(call.campaignId), disposition.code === 'BUSY' ? 'BUSY' : 'NO_ANSWER')
    }
  }
  syncCall(call, lead)
  return call
}

/* ------------------------------------------------------------ agent state */

/** Status id by machine key ('available', 'on_call', 'wrap_up', 'break', 'offline', ...). */
export const statusIdByName = (name: string): string => {
  const status = store.data.agentStatuses.find((candidate) => candidate.name === name)
  if (!status) throw new Error(`Unknown agent status "${name}"`)
  return status.id
}

/** The default (Available) status id. */
export const defaultStatusId = (): string =>
  store.data.agentStatuses.find((status) => status.isDefault)?.id ?? statusIdByName('available')

/**
 * Change an agent's status: closes the open AgentStateLog, opens a new one,
 * sets stateSince and (optionally) the focused campaign; emits 'agent:state'.
 * Setting the same status again only updates the campaign.
 */
export const setAgentStatus = (
  agentId: string,
  statusId: string,
  options: { campaignId?: string | null; callId?: string | null; silent?: boolean } = {},
): AgentCurrentState => {
  if (!statusById(statusId)) throw notFound('Unknown status')
  const now = nowIso()
  const human = isHuman(agentId)
  let state = agentStateOf(agentId)
  if (!state) {
    state = { agentId, statusId: statusIdByName('offline'), stateSince: now, currentCallId: null, currentCampaignId: null, callPhase: null }
    store.data.agentStates.push(state)
  }
  if (options.campaignId !== undefined) state.currentCampaignId = options.campaignId
  if (state.statusId !== statusId) {
    const open = store.data.agentStateLogs.find((log) => log.agentId === agentId && log.endedAt === null)
    if (open) {
      open.endedAt = now
      if (human) syncOut('agentStateLogs', open.id, open)
    }
    const log = {
      id: newId('log_', human),
      agentId,
      statusId,
      previousStatusId: state.statusId,
      startedAt: now,
      endedAt: null,
      campaignId: state.currentCampaignId,
      callRecordId: options.callId ?? null,
    }
    store.data.agentStateLogs.push(log)
    if (human) syncOut('agentStateLogs', log.id, log)
    state.statusId = statusId
    state.stateSince = now
  }
  if (!options.silent) touchAgent(agentId)
  return state
}

/** Join an AgentCurrentState into the view every screen renders. */
export const agentStateView = (state: AgentCurrentState): AgentStateView => {
  const user = userById(state.agentId)
  const status =
    statusById(state.statusId) ?? store.data.agentStatuses.find((candidate) => candidate.name === 'offline') ?? store.data.agentStatuses[0]
  if (!status) throw new Error('No agent statuses in the store')
  const campaign = state.currentCampaignId ? campaignById(state.currentCampaignId) : undefined
  const call = state.currentCallId ? callById(state.currentCallId) : undefined
  return {
    agent: user
      ? userSummary(user)
      : { id: state.agentId, username: state.agentId, displayName: { en: state.agentId, ka: state.agentId }, role: 'operator', sipExtension: null },
    status,
    stateSince: state.stateSince,
    campaign: campaign ? { id: campaign.id, name: campaign.name, dialingMode: campaign.dialingMode } : null,
    currentCall:
      call && call.outcome === 'IN_PROGRESS'
        ? {
            id: call.id,
            destinationNumber: call.destinationNumber,
            customerName: call.customerName,
            initiatedAt: call.callInitiatedAt,
            answeredAt: call.callAnsweredAt,
            phase: state.callPhase ?? (call.callAnsweredAt ? 'answered' : 'ringing'),
          }
        : null,
  }
}

/** Join a CallRecord with agent / campaign / disposition names. */
export const toCallView = (call: CallRecord): CallRecordView => {
  const disposition = dispositionByCode(call.dispositionCode)
  return {
    ...call,
    agentName: userName(call.agentId),
    campaignName: campaignById(call.campaignId)?.name ?? { en: call.campaignId, ka: call.campaignId },
    dispositionName: disposition?.name ?? null,
    dispositionColor: disposition?.color ?? null,
  }
}

/* ------------------------------------------------------------ bus helpers */

const END_EVENTS: CallEventType[] = ['ended', 'no_answer', 'busy', 'abandoned']

/** Push a CallEvent into store.callEvents (newest first, cap 50) and emit 'call:event'. */
export const emitCallEvent = (call: CallRecord, event: CallEventType): CallEvent => {
  const withCause = END_EVENTS.includes(event)
  const entry: CallEvent = {
    id: newId('evt_', isHuman(call.agentId)),
    callId: call.id,
    agentId: call.agentId,
    agentName: userName(call.agentId),
    phoneNumber: call.destinationNumber,
    customerName: call.customerName,
    campaignId: call.campaignId,
    event,
    cause: withCause ? call.hangupCause : null,
    causeText: withCause ? call.hangupCauseText : null,
    timestamp: nowIso(),
  }
  const events = store.data.callEvents
  events.unshift(entry)
  if (events.length > 50) events.length = 50
  bus.emit('call:event', entry)
  return entry
}

/** store.notify() + bus 'data:changed' for these scopes. Call after every write. */
export const changed = (...scopes: DataScope[]): void => {
  store.notify()
  if (scopes.length > 0) bus.emit('data:changed', { scopes: [...new Set(scopes)] })
}

/** Mirror a human action's record to other open tabs (bus 'sync:patch'). */
export const syncOut = (collection: SyncCollection, key: string, record: unknown): void => {
  bus.emit('sync:patch', { collection, key, record })
}
