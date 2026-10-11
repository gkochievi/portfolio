/**
 * The signed-in operator's call engine.
 *
 * MANUAL: POST /dialer/next -> requesting (300 ms) -> dialing (0.8 s) ->
 * ringing (2-5 s) -> 85% answered / 10% no answer (cause 19) / 5% busy
 * (cause 17). An answered customer hangs up on their own after 45-120 s half
 * of the time (cause 16, CUSTOMER); otherwise the agent ends the call.
 * Every ended call waits for the forced disposition; then Wrap-up (its own
 * timeout, autoReturn) and back to Available.
 *
 * AUTO: the auto-dialer emits 'dialer:offer' for the signed-in operator; the
 * phase is 'incoming' with a 15 s auto-reject. Reject / timeout ends the call
 * ABANDONED (no disposition) and the lead goes back on the retry path.
 *
 * Timing is kept as deadlines and checked by a kit `every()` tick, so a
 * hidden tab pauses and catches up when the visitor returns.
 */
import { DemoApiError, conflict, every, notFound } from '@portfolio/demo-kit'

import type { CallRecord, DataScope, DialerOffer, OperatorCall, OperatorEndReason } from '@/types'
import { bus } from '../bus'
import {
  agentStateOf,
  answerCall,
  applyDisposition,
  callById,
  changed,
  defaultStatusId,
  endCall,
  getNextNumber,
  holdSecondsOf,
  humanAgentId,
  isHuman,
  numberById,
  setAgentStatus,
  setHold,
  startCall,
  statusById,
  statusIdByName,
  syncOut,
} from '../domain'

type Outcome = 'answer' | 'no_answer' | 'busy'

interface Live {
  call: OperatorCall
  /** When the current timed phase (requesting / dialing / ringing / incoming) ends. */
  until: number | null
  /** The pre-rolled result of the ring. */
  outcome: Outcome
  /** When the customer hangs up an answered call, or null when the agent ends it. */
  customerHangupAt: number | null
}

const SCOPES: DataScope[] = ['me', 'agents', 'calls', 'metrics', 'numbers', 'campaigns']
const INCOMING_TIMEOUT_MS = 15_000

/** One live call per operator (in practice: the visitor). */
const live = new Map<string, Live>()

const between = (min: number, max: number): number => min + Math.random() * (max - min)

function snapshot(entry: Live): OperatorCall {
  const record = callById(entry.call.callId)
  return {
    ...entry.call,
    customData: { ...entry.call.customData },
    holdSeconds: record ? holdSecondsOf(record) : entry.call.holdSeconds,
  }
}

function publish(agentId: string, override?: OperatorCall | null): void {
  const entry = live.get(agentId)
  bus.emit('operator:call', { agentId, call: override !== undefined ? override : entry ? snapshot(entry) : null })
  changed(...SCOPES)
}

function entryFor(agentId: string, callId: string): Live {
  const entry = live.get(agentId)
  if (!entry || entry.call.callId !== callId) throw notFound('Call not found')
  return entry
}

/** Re-sync the agent row after a manual edit (wall tile + other tabs). */
function touch(agentId: string): void {
  bus.emit('agent:state', { agentId })
  const state = agentStateOf(agentId)
  if (state && isHuman(agentId)) syncOut('agentStates', agentId, state)
}

/* ------------------------------------------------------------ public API */

/** The live call of an operator (null when idle). Read by GET /agent/me/call. */
export function getOperatorCall(agentId: string): OperatorCall | null {
  const entry = live.get(agentId)
  return entry ? snapshot(entry) : null
}

/** POST /dialer/next: pick the next lead and start ringing it. Campaign checks are the handler's. */
export function requestNext(agentId: string, campaignId: string): OperatorCall {
  const existing = live.get(agentId)
  if (existing) {
    throw conflict(existing.call.awaitingDisposition ? 'Submit the disposition for the last call first' : 'You are already on a call')
  }
  const lead = getNextNumber(campaignId)
  if (!lead) {
    changed('numbers', 'campaigns')
    throw notFound('No more numbers available in this campaign')
  }
  const record = startCall({ campaignId, numberId: lead.id, agentId, mode: 'MANUAL' })
  const roll = Math.random()
  const outcome: Outcome = roll < 0.85 ? 'answer' : roll < 0.95 ? 'no_answer' : 'busy'
  const entry: Live = {
    call: {
      callId: record.id,
      agentId,
      campaignId,
      numberId: lead.id,
      mode: 'MANUAL',
      phase: 'requesting',
      destinationNumber: lead.phoneNumber,
      customerName: lead.customerName,
      customData: { ...lead.customData },
      initiatedAt: record.callInitiatedAt,
      answeredAt: null,
      endedAt: null,
      onHold: false,
      holdSeconds: 0,
      endReason: null,
      suggestedDisposition: null,
      awaitingDisposition: false,
    },
    until: Date.now() + 300,
    outcome,
    customerHangupAt: null,
  }
  live.set(agentId, entry)
  publish(agentId)
  return snapshot(entry)
}

function markEnded(entry: Live, record: CallRecord, reason: OperatorEndReason, suggested: string | null): void {
  entry.call.phase = 'ended'
  entry.call.onHold = false
  entry.call.endedAt = record.callEndedAt
  entry.call.holdSeconds = record.holdDuration
  entry.call.endReason = reason
  entry.call.suggestedDisposition = suggested
  entry.call.awaitingDisposition = true
  entry.until = null
  entry.customerHangupAt = null
}

function connect(entry: Live, agentId: string): void {
  const record = answerCall(entry.call.callId, agentId)
  entry.call.phase = 'answered'
  entry.call.answeredAt = record.callAnsweredAt
  entry.until = null
  entry.customerHangupAt = Math.random() < 0.5 ? Date.now() + between(45_000, 120_000) : null
}

function resolveRing(agentId: string, entry: Live): void {
  if (entry.outcome === 'answer') connect(entry, agentId)
  else if (entry.outcome === 'no_answer') {
    const record = endCall(entry.call.callId, { hangupBy: 'SYSTEM', cause: 19, outcome: 'NO_ANSWER' })
    markEnded(entry, record, 'NO_ANSWER', 'NO_ANSWER')
  } else {
    const record = endCall(entry.call.callId, { hangupBy: 'SYSTEM', cause: 17, outcome: 'BUSY' })
    markEnded(entry, record, 'BUSY', 'BUSY')
  }
  publish(agentId)
}

/** End the live call from the agent or customer side; the disposition is still required. */
function finish(agentId: string, entry: Live, reason: 'AGENT' | 'CUSTOMER' | 'TRANSFERRED'): void {
  const { phase } = entry.call
  if (phase === 'ended') return
  if (phase === 'answered') {
    const record = endCall(entry.call.callId, { hangupBy: reason === 'CUSTOMER' ? 'CUSTOMER' : 'AGENT', cause: 16 })
    markEnded(entry, record, reason, null)
  } else {
    // Cancelled before the customer picked up.
    const record = endCall(entry.call.callId, { hangupBy: 'AGENT', cause: 16, outcome: 'NO_ANSWER' })
    markEnded(entry, record, 'AGENT', 'NO_ANSWER')
  }
  publish(agentId)
}

/** Reject or let an AUTO offer time out: ABANDONED, no disposition, back to Available. */
function decline(agentId: string, entry: Live): void {
  const record = endCall(entry.call.callId, { hangupBy: 'AGENT', cause: 21, outcome: 'ABANDONED' })
  const state = agentStateOf(agentId)
  if (state && state.currentCallId === entry.call.callId) {
    state.currentCallId = null
    state.callPhase = null
  }
  setAgentStatus(agentId, defaultStatusId(), { campaignId: state?.currentCampaignId ?? entry.call.campaignId })
  const last: OperatorCall = {
    ...snapshot(entry),
    phase: 'ended',
    endedAt: record.callEndedAt,
    endReason: 'REJECTED',
    awaitingDisposition: false,
  }
  live.delete(agentId)
  publish(agentId, last)
  bus.emit('operator:call', { agentId, call: null })
}

export function answerOffer(agentId: string, callId: string): OperatorCall {
  const entry = entryFor(agentId, callId)
  if (entry.call.phase !== 'incoming') throw conflict('This call is not waiting to be answered')
  connect(entry, agentId)
  publish(agentId)
  return snapshot(entry)
}

export function rejectOffer(agentId: string, callId: string): { rejected: true } {
  const entry = entryFor(agentId, callId)
  if (entry.call.phase !== 'incoming') throw conflict('This call is not waiting to be answered')
  decline(agentId, entry)
  return { rejected: true }
}

export function holdCall(agentId: string, callId: string, onHold: boolean): OperatorCall {
  const entry = entryFor(agentId, callId)
  if (entry.call.phase !== 'answered') throw conflict('Only a connected call can be put on hold')
  setHold(callId, onHold)
  entry.call.onHold = onHold
  publish(agentId)
  return snapshot(entry)
}

export function hangupCall(agentId: string, callId: string): OperatorCall | null {
  const entry = entryFor(agentId, callId)
  if (entry.call.phase === 'incoming') {
    decline(agentId, entry)
    return null
  }
  finish(agentId, entry, 'AGENT')
  return snapshot(entry)
}

export function transferCall(agentId: string, callId: string, extension: string): OperatorCall {
  const entry = entryFor(agentId, callId)
  if (entry.call.phase !== 'answered') throw conflict('Only a connected call can be transferred')
  if (!/^\d{3,6}$/.test(extension.trim())) throw DemoApiError.validation({ extension: 'Enter an extension (3-6 digits)' })
  finish(agentId, entry, 'TRANSFERRED')
  return snapshot(entry)
}

/** POST /calls/:id/disposition: the forced disposition, then Wrap-up. */
export function disposeCall(
  agentId: string,
  callId: string,
  input: { code: string; note?: string | null; callbackAt?: string | null },
): CallRecord {
  const entry = live.get(agentId)
  if (entry && entry.call.callId !== callId) throw conflict('Finish the current call first')
  if (entry && entry.call.phase !== 'ended' && entry.call.phase !== 'answered') throw conflict('Wait for the call to connect or hang up first')
  const record = callById(callId)
  if (!record || record.agentId !== agentId) throw notFound('Call not found')
  if (!entry && record.dispositionCode) throw conflict('This call already has a disposition')
  const result = applyDisposition(callId, { code: input.code, note: input.note ?? null, callbackAt: input.callbackAt ?? null, actorId: agentId })
  live.delete(agentId)
  const state = agentStateOf(agentId)
  if (state) {
    state.currentCallId = null
    state.callPhase = null
  }
  setAgentStatus(agentId, statusIdByName('wrap_up'), { campaignId: result.campaignId })
  publish(agentId)
  changed('dnc', 'reports')
  return result
}

/* --------------------------------------------------------------- engine */

function onOffer(offer: DialerOffer): void {
  const { agentId, callId } = offer
  if (!isHuman(agentId)) return
  const record = callById(callId)
  if (!record || record.outcome !== 'IN_PROGRESS') return
  if (live.has(agentId)) {
    // Busy after all: the customer is dropped (counts towards the abandon rate).
    endCall(callId, { hangupBy: 'SYSTEM', cause: 21, outcome: 'ABANDONED' })
    changed(...SCOPES)
    return
  }
  const lead = numberById(record.campaignNumberId)
  setAgentStatus(agentId, statusIdByName('on_call'), { campaignId: record.campaignId, callId, silent: true })
  const state = agentStateOf(agentId)
  if (state) {
    state.currentCallId = callId
    state.callPhase = 'ringing'
  }
  touch(agentId)
  live.set(agentId, {
    call: {
      callId,
      agentId,
      campaignId: record.campaignId,
      numberId: record.campaignNumberId,
      mode: 'AUTO',
      phase: 'incoming',
      destinationNumber: record.destinationNumber,
      customerName: record.customerName,
      customData: { ...(lead?.customData ?? {}) },
      initiatedAt: record.callInitiatedAt,
      answeredAt: null,
      endedAt: null,
      onHold: false,
      holdSeconds: 0,
      endReason: null,
      suggestedDisposition: null,
      awaitingDisposition: false,
    },
    until: Date.now() + INCOMING_TIMEOUT_MS,
    outcome: 'answer',
    customerHangupAt: null,
  })
  publish(agentId)
}

/** Wrap-up (and any autoReturn status) goes back to Available on its timeout. */
function autoReturn(now: number): void {
  const agentId = humanAgentId()
  if (!agentId || live.has(agentId)) return
  const state = agentStateOf(agentId)
  if (!state || state.currentCallId) return
  const status = statusById(state.statusId)
  if (!status || !status.autoReturn || status.timeoutSeconds <= 0 || status.type === 'offline') return
  if (now - Date.parse(state.stateSince) < status.timeoutSeconds * 1000) return
  setAgentStatus(agentId, defaultStatusId(), { campaignId: state.currentCampaignId })
  changed('me', 'agents', 'metrics', 'dialer')
}

function tick(): void {
  const now = Date.now()
  for (const [agentId, entry] of [...live]) {
    try {
      const { call } = entry
      if (call.phase === 'answered') {
        if (entry.customerHangupAt !== null && now >= entry.customerHangupAt) finish(agentId, entry, 'CUSTOMER')
        continue
      }
      if (entry.until === null || now < entry.until) continue
      if (call.phase === 'requesting') {
        call.phase = 'dialing'
        entry.until = now + 800
        publish(agentId)
      } else if (call.phase === 'dialing') {
        call.phase = 'ringing'
        entry.until = now + between(2000, 5000)
        publish(agentId)
      } else if (call.phase === 'ringing') resolveRing(agentId, entry)
      else if (call.phase === 'incoming') decline(agentId, entry)
    } catch {
      // The record vanished (reset / another tab): drop the call.
      live.delete(agentId)
      publish(agentId)
    }
  }
  try {
    autoReturn(now)
  } catch {
    // A status was deleted mid-flight; try again next tick.
  }
}

/** Start listening/ticking. Returns the stop function. */
export function startOperatorEngine(): () => void {
  const stopTick = every(250, tick)
  const offs = [
    bus.on('dialer:offer', (offer) => {
      try {
        onOffer(offer)
      } catch {
        // An offer for a call that no longer exists.
      }
    }),
    bus.on('demo:reset', () => {
      live.clear()
    }),
  ]
  return () => {
    stopTick()
    for (const off of offs) off()
    live.clear()
  }
}
