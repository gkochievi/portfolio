/**
 * AUTO campaign pacing loop,
 * ported from the source's in-process 1 s auto-dialer.
 *
 * Every second, for each ACTIVE AUTO campaign while the global engine is on:
 *   available = assigned, active operators with an extension, in a free
 *               working status, not on a call, focused on this campaign
 *               (the visitor's operator counts only while signed in here)
 *   target    = floor(available x dialRatio)
 *   inFlight  = live calls of the campaign (numbers DIALING or CONNECTED)
 *   toDial    = min(target - inFlight, maxConcurrent - inFlight), at most one
 *               originate per dialIntervalMs
 * Ring 2-5 s, outcomes 70/20/10. An answered customer goes round-robin to a
 * free agent: the visitor gets a 'dialer:offer', a fake agent is handed to the
 * floor simulator, and with nobody free the call is ABANDONED.
 * After 5 consecutive originate errors the campaign backs off for 30 s.
 * PREDICTIVE campaigns are never dialed ("Coming soon", as in the source).
 */
import { createRandom, every } from '@portfolio/demo-kit'

import { accounts } from '../accounts'
import { bus } from '../bus'
import { agentStateOf, answerCall, callById, campaignById, changed, endCall, getNextNumber, humanAgentId, startCall, statusById } from '../domain'
import { store } from '../store'
import type { AutoDialerCampaignState, Campaign } from '@/types'
import { adoptAutoCall, floorIsBusy, pickOutcome } from './floor'

const SEC = 1000
export const MAX_CONSECUTIVE_ERRORS = 5
export const ERROR_BACKOFF_MS = 30 * SEC
/** A "Simulate error" makes originates fail for this long, enough to reach the backoff. */
export const FORCED_FAILURE_MS = 10 * SEC
/** The visitor has this long to take an offered call before the dialer gives up on it. */
const OFFER_GRACE_MS = 20 * SEC

const rand = createRandom('dareke-autodialer')

interface Ringing {
  campaignId: string
  until: number
  outcome: 'answered' | 'no_answer' | 'busy'
}

const ringing = new Map<string, Ringing>()
/** callId -> the human agent it was offered to. */
const offers = new Map<string, { agentId: string; until: number }>()
const roundRobin = new Map<string, number>()
const forcedUntil = new Map<string, number>()

const loginAccountIds = new Set(accounts.map((account) => account.userId))

const isFreeStatus = (statusId: string): boolean => {
  const status = statusById(statusId)
  return !!status && status.type === 'working' && !status.isSystem && status.name !== 'wrap_up'
}

/** Agents the dialer may hand a call to right now, sorted for a stable round-robin. */
export function availableAgentsFor(campaignId: string): string[] {
  const human = humanAgentId()
  const offered = new Set([...offers.values()].map((offer) => offer.agentId))
  return store.data.campaignAgents
    .filter((link) => link.campaignId === campaignId)
    .map((link) => link.agentId)
    .filter((agentId) => {
      const user = store.data.users.find((candidate) => candidate.id === agentId)
      if (!user || !user.isActive || user.role !== 'operator' || !user.sipExtension) return false
      // A sign-in-able account (Mariam) counts only while the visitor is her in this tab.
      if (loginAccountIds.has(agentId) && agentId !== human) return false
      const state = agentStateOf(agentId)
      if (!state || state.currentCallId || state.currentCampaignId !== campaignId || !isFreeStatus(state.statusId)) return false
      if (offered.has(agentId)) return false
      return agentId === human || !floorIsBusy(agentId)
    })
    .sort()
}

const liveCallsOf = (campaignId: string): number =>
  store.data.calls.filter((call) => call.campaignId === campaignId && call.outcome === 'IN_PROGRESS').length

/** Percent of today's AUTO calls that were answered with no free agent. */
export function abandonRateOf(campaignId: string | null): number {
  const dayStart = new Date().setHours(0, 0, 0, 0)
  let abandoned = 0
  let reached = 0
  for (const call of store.data.calls) {
    if (call.mode !== 'AUTO' || (campaignId && call.campaignId !== campaignId)) continue
    if (Date.parse(call.callInitiatedAt) < dayStart) continue
    if (call.outcome === 'ABANDONED') {
      abandoned += 1
      reached += 1
    } else if (call.callAnsweredAt && call.agentId) reached += 1
  }
  return reached === 0 ? 0 : Math.round((abandoned / reached) * 1000) / 10
}

/** The runtime state of an AUTO/PREDICTIVE campaign, created on first sight and refreshed from the store. */
export function refreshState(campaign: Campaign): AutoDialerCampaignState {
  const runtime = store.data.autoDialer
  let state = runtime.campaigns[campaign.id]
  if (!state) {
    state = {
      campaignId: campaign.id,
      isRunning: false,
      availableAgents: 0,
      dialRatio: campaign.dialRatio,
      target: 0,
      inFlight: 0,
      maxConcurrentCalls: campaign.maxConcurrentCalls,
      dialIntervalMs: campaign.dialIntervalMs,
      consecutiveErrors: 0,
      backoffUntil: null,
      lastDialAt: null,
      dialedThisSession: 0,
      abandonRate: 0,
    }
    runtime.campaigns[campaign.id] = state
  }
  const auto = campaign.dialingMode === 'AUTO'
  const available = auto ? availableAgentsFor(campaign.id).length : 0
  state.isRunning = auto && campaign.status === 'active'
  state.availableAgents = available
  state.dialRatio = campaign.dialRatio
  state.target = Math.floor(available * campaign.dialRatio)
  state.inFlight = liveCallsOf(campaign.id)
  state.maxConcurrentCalls = campaign.maxConcurrentCalls
  state.dialIntervalMs = campaign.dialIntervalMs
  state.abandonRate = abandonRateOf(campaign.id)
  if (state.backoffUntil && Date.parse(state.backoffUntil) <= Date.now()) {
    state.backoffUntil = null
    state.consecutiveErrors = 0
  }
  return state
}

/** Record one originate error; the fifth in a row starts a 30 s backoff. */
export function recordError(state: AutoDialerCampaignState): void {
  state.consecutiveErrors += 1
  state.lastDialAt = new Date().toISOString()
  if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !state.backoffUntil) {
    state.backoffUntil = new Date(Date.now() + ERROR_BACKOFF_MS).toISOString()
  }
}

const inBackoff = (state: AutoDialerCampaignState) => !!state.backoffUntil && Date.parse(state.backoffUntil) > Date.now()

/** Originate one call. Returns 1 when a call was placed. */
function dialOne(campaign: Campaign, state: AutoDialerCampaignState): number {
  const now = Date.now()
  if ((forcedUntil.get(campaign.id) ?? 0) > now) {
    recordError(state)
    return 0
  }
  const lead = getNextNumber(campaign.id)
  if (!lead) return 0
  const call = startCall({ campaignId: campaign.id, numberId: lead.id, agentId: null, mode: 'AUTO' })
  state.lastDialAt = new Date(now).toISOString()
  state.dialedThisSession += 1
  state.consecutiveErrors = 0
  state.inFlight += 1
  ringing.set(call.id, { campaignId: campaign.id, until: now + rand.int(2, 5) * SEC, outcome: pickOutcome() })
  return 1
}

/**
 * One dial cycle for a campaign. `manual` (the "Trigger cycle" button) ignores
 * dialIntervalMs and the global switch and places every call the pacing allows.
 */
export function dialCycle(campaignId: string, manual = false): number {
  const campaign = campaignById(campaignId)
  if (!campaign || campaign.dialingMode !== 'AUTO' || campaign.status !== 'active') return 0
  const state = refreshState(campaign)
  if (inBackoff(state)) return 0
  if (!manual) {
    if (!store.data.autoDialer.enabled) return 0
    if (state.lastDialAt && Date.now() - Date.parse(state.lastDialAt) < campaign.dialIntervalMs) return 0
  }
  const toDial = Math.min(state.target - state.inFlight, campaign.maxConcurrentCalls - state.inFlight)
  if (toDial <= 0) return 0
  let dialed = 0
  for (let i = 0; i < (manual ? toDial : 1); i += 1) {
    if (inBackoff(state)) break
    dialed += dialOne(campaign, state)
  }
  return dialed
}

/** Clear errors, backoff and any simulated failure. */
export function resetCampaign(campaignId: string): void {
  forcedUntil.delete(campaignId)
  const state = store.data.autoDialer.campaigns[campaignId]
  if (state) {
    state.consecutiveErrors = 0
    state.backoffUntil = null
  }
}

/** Demo: record an originate error now and keep failing for a few seconds. */
export function simulateFailure(campaignId: string): void {
  const campaign = campaignById(campaignId)
  if (!campaign) return
  const state = refreshState(campaign)
  forcedUntil.set(campaignId, Date.now() + FORCED_FAILURE_MS)
  recordError(state)
}

/** The customer answered: route to a free agent or abandon. */
function routeAnswered(callId: string, campaignId: string): void {
  const agents = availableAgentsFor(campaignId)
  if (agents.length === 0) {
    endCall(callId, { hangupBy: 'SYSTEM', cause: 16, outcome: 'ABANDONED' })
    return
  }
  const index = (roundRobin.get(campaignId) ?? 0) % agents.length
  roundRobin.set(campaignId, index + 1)
  const agentId = agents[index]!
  const call = callById(callId)
  if (!call) return
  if (agentId === humanAgentId()) {
    offers.set(callId, { agentId, until: Date.now() + OFFER_GRACE_MS })
    bus.emit('dialer:offer', { callId, agentId, campaignId, numberId: call.campaignNumberId })
    return
  }
  answerCall(callId, agentId)
  adoptAutoCall(agentId, callId)
}

function tick(): void {
  const now = Date.now()
  let touched = false
  try {
    for (const [callId, ring] of [...ringing]) {
      if (now < ring.until) continue
      ringing.delete(callId)
      if (callById(callId)?.outcome !== 'IN_PROGRESS') continue
      touched = true
      if (ring.outcome === 'answered') routeAnswered(callId, ring.campaignId)
      else endCall(callId, { hangupBy: 'SYSTEM', cause: ring.outcome === 'busy' ? 17 : 19 })
    }
    for (const [callId, offer] of [...offers]) {
      const call = callById(callId)
      if (!call || call.outcome !== 'IN_PROGRESS' || call.agentId) {
        offers.delete(callId)
        continue
      }
      if (now >= offer.until) {
        offers.delete(callId)
        endCall(callId, { hangupBy: 'SYSTEM', cause: 16, outcome: 'ABANDONED' })
        touched = true
      }
    }
    for (const campaign of store.data.campaigns) {
      if (campaign.dialingMode !== 'AUTO' || (campaign.status !== 'active' && campaign.status !== 'paused')) continue
      const state = refreshState(campaign)
      const before = `${state.consecutiveErrors}|${state.backoffUntil}|${state.availableAgents}`
      const dialed = dialCycle(campaign.id)
      if (dialed > 0 || before !== `${state.consecutiveErrors}|${state.backoffUntil}|${state.availableAgents}`) touched = true
    }
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[auto-dialer] tick skipped', error)
  }
  if (touched) changed('dialer', 'calls', 'numbers', 'metrics', 'agents')
}

export function startAutoDialer(): () => void {
  const stop = every(1000, tick)
  const off = bus.on('demo:reset', () => {
    ringing.clear()
    offers.clear()
    roundRobin.clear()
    forcedUntil.clear()
  })
  return () => {
    stop()
    off()
  }
}
