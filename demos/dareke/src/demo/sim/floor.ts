/**
 * Floor simulator.
 *
 * Drives the seeded FAKE operators so the supervisor wall is never still:
 * Available -> On call (ring 2-5 s; 70 % answered / 20 % no answer / 10 % busy)
 * -> talk 30-150 s (sometimes a short hold) -> weighted disposition ->
 * Wrap-up 10-25 s -> Available. About 5 % of the time an idle agent goes on
 * Break or Lunch for 60-180 s. It keeps roughly 4-6 agents on a call.
 *
 * - It dials MANUAL campaigns only; AUTO calls are handed over by the
 *   auto-dialer (`adoptAutoCall`), and the floor finishes them the same way.
 * - It never drives `u_mariam` (the visitor's operator account), whoever is
 *   signed in in this tab, or inactive users.
 * - All timers are due-times checked by one `every(1000)` loop, so the floor
 *   pauses while the tab is hidden. 'demo:reset' drops every plan.
 */
import { createRandom, every } from '@portfolio/demo-kit'

import { bus } from '../bus'
import {
  agentStateOf,
  answerCall,
  applyDisposition,
  callById,
  campaignById,
  changed,
  dispositionByCode,
  endCall,
  getNextNumber,
  isHuman,
  setAgentStatus,
  setHold,
  startCall,
  statusById,
  statusIdByName,
} from '../domain'
import { store } from '../store'
import type { DataScope } from '@/types'

const HUMAN_ACCOUNT = 'u_mariam'
const SEC = 1000

const rand = createRandom('dareke-floor')
const between = (min: number, max: number) => rand.int(min, max)

type Outcome = 'answered' | 'no_answer' | 'busy'

type Plan =
  | { kind: 'ring'; callId: string; until: number; outcome: Outcome }
  | { kind: 'talk'; callId: string; until: number; holdAt: number | null; holdUntil: number | null; onHold: boolean }
  | { kind: 'wrap'; until: number }
  | { kind: 'pause'; until: number }

const plans = new Map<string, Plan>()
/** Agents whose seeded state has already been picked up. */
const adopted = new Set<string>()
let nextAdvanceAt = 0
let onCallTarget = 5

/** Disposition weights for an answered call (normalised). */
const ANSWERED_WEIGHTS: Array<[string, number]> = [
  ['SALE', 15],
  ['INTERESTED', 12],
  ['CALLBACK_LATER', 8],
  ['NOT_INTERESTED', 30],
  ['VOICEMAIL', 10],
  ['WRONG_NUMBER', 5],
  ['DNC', 3],
]

function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rand.next() * total
  for (const [value, weight] of items) {
    roll -= weight
    if (roll <= 0) return value
  }
  return items[items.length - 1]![0]
}

export const pickOutcome = (): Outcome =>
  pickWeighted<Outcome>([
    ['answered', 70],
    ['no_answer', 20],
    ['busy', 10],
  ])

/** A seeded operator the floor may drive. */
export function isFakeAgent(agentId: string): boolean {
  if (agentId === HUMAN_ACCOUNT || isHuman(agentId)) return false
  const user = store.data.users.find((candidate) => candidate.id === agentId)
  return !!user && user.isActive && user.role === 'operator'
}

const fakeAgents = () => store.data.users.filter((user) => isFakeAgent(user.id))

/** Is the floor currently busy with this agent (ringing, talking, wrapping up, on a break)? */
export const floorIsBusy = (agentId: string): boolean => plans.has(agentId)

/** The auto-dialer handed an answered AUTO call to a fake agent: talk, disposition, wrap-up. */
export function adoptAutoCall(agentId: string, callId: string): void {
  if (!isFakeAgent(agentId)) return
  adopted.add(agentId)
  plans.set(agentId, talkPlan(callId, Date.now()))
}

function talkPlan(callId: string, now: number): Plan {
  const talk = between(30, 150) * SEC
  const holds = rand.chance(0.15)
  const holdAt = holds ? now + between(8, Math.max(9, Math.floor(talk / SEC / 2))) * SEC : null
  return { kind: 'talk', callId, until: now + talk, holdAt, holdUntil: holdAt ? holdAt + between(6, 20) * SEC : null, onHold: false }
}

const isCallLive = (callId: string) => callById(callId)?.outcome === 'IN_PROGRESS'

function startWrapUp(agentId: string, now: number): void {
  setAgentStatus(agentId, statusIdByName('wrap_up'))
  plans.set(agentId, { kind: 'wrap', until: now + between(10, 25) * SEC })
}

function dispose(agentId: string, callId: string, code: string): void {
  const disposition = dispositionByCode(code)
  const usable = disposition && disposition.isActive ? disposition : dispositionByCode('NOT_INTERESTED')
  if (!usable) return
  const callbackAt = usable.scheduleCallback ? new Date(Date.now() + between(20, 72) * 3_600_000).toISOString() : null
  try {
    applyDisposition(callId, { code: usable.code, note: null, callbackAt, actorId: agentId })
  } catch {
    /* a stale call (reset in between) is simply skipped */
  }
}

/** Pick up the seeded state of an agent the first time the floor sees them. */
function adopt(agentId: string, now: number): void {
  adopted.add(agentId)
  const state = agentStateOf(agentId)
  if (!state) return
  const status = statusById(state.statusId)
  const call = state.currentCallId ? callById(state.currentCallId) : undefined
  if (call && call.outcome === 'IN_PROGRESS') {
    if (call.callAnsweredAt) plans.set(agentId, talkPlan(call.id, now))
    else plans.set(agentId, { kind: 'ring', callId: call.id, until: now + between(2, 5) * SEC, outcome: pickOutcome() })
    return
  }
  if (!status) return
  if (status.name === 'wrap_up') plans.set(agentId, { kind: 'wrap', until: now + between(4, 15) * SEC })
  else if (status.type === 'paused') plans.set(agentId, { kind: 'pause', until: now + between(30, 120) * SEC })
}

/** Advance one plan whose time has come. Returns the scopes it touched. */
function step(agentId: string, plan: Plan, now: number): DataScope[] {
  switch (plan.kind) {
    case 'ring': {
      if (!isCallLive(plan.callId)) {
        plans.delete(agentId)
        return []
      }
      if (plan.outcome === 'answered') {
        answerCall(plan.callId, agentId)
        plans.set(agentId, talkPlan(plan.callId, now))
        return ['agents', 'calls', 'numbers', 'metrics']
      }
      const busy = plan.outcome === 'busy'
      endCall(plan.callId, { hangupBy: 'SYSTEM', cause: busy ? 17 : 19 })
      dispose(agentId, plan.callId, busy ? 'BUSY' : 'NO_ANSWER')
      startWrapUp(agentId, now)
      return ['agents', 'calls', 'numbers', 'metrics', 'campaigns']
    }
    case 'talk': {
      if (!isCallLive(plan.callId)) {
        plans.delete(agentId)
        return []
      }
      if (now >= plan.until) {
        if (plan.onHold) setHold(plan.callId, false)
        endCall(plan.callId, { hangupBy: rand.chance(0.5) ? 'CUSTOMER' : 'AGENT', cause: 16 })
        dispose(agentId, plan.callId, pickWeighted(ANSWERED_WEIGHTS))
        startWrapUp(agentId, now)
        return ['agents', 'calls', 'numbers', 'metrics', 'campaigns']
      }
      if (!plan.onHold && plan.holdAt !== null && now >= plan.holdAt) {
        setHold(plan.callId, true)
        plan.onHold = true
        plan.holdAt = null
        return ['agents', 'calls']
      }
      if (plan.onHold && plan.holdUntil !== null && now >= plan.holdUntil) {
        setHold(plan.callId, false)
        plan.onHold = false
        plan.holdUntil = null
        return ['agents', 'calls']
      }
      return []
    }
    case 'wrap':
    case 'pause': {
      if (now < plan.until) return []
      plans.delete(agentId)
      const state = agentStateOf(agentId)
      if (state && !state.currentCallId) setAgentStatus(agentId, statusIdByName('available'))
      return ['agents', 'metrics']
    }
  }
}

const nextDue = (plan: Plan): number => {
  if (plan.kind === 'talk') return Math.min(plan.until, plan.holdAt ?? Infinity, plan.holdUntil ?? Infinity)
  return plan.until
}

/** Is an AUTO campaign actually being dialed right now? */
const autoIsDialing = (campaignId: string | null): boolean => {
  if (!campaignId) return false
  const campaign = campaignById(campaignId)
  const runtime = store.data.autoDialer
  return (
    !!campaign &&
    campaign.status === 'active' &&
    campaign.dialingMode === 'AUTO' &&
    runtime.enabled &&
    runtime.campaigns[campaignId]?.isRunning !== false
  )
}

/** The MANUAL campaign this idle agent would dial, refocusing them when their AUTO campaign is idle. */
function manualCampaignFor(agentId: string, focused: string | null): string | null {
  const focus = focused ? campaignById(focused) : undefined
  if (focus && focus.status === 'active' && focus.dialingMode === 'MANUAL') return focus.id
  if (autoIsDialing(focused)) return null
  const link = store.data.campaignAgents.find((candidate) => {
    if (candidate.agentId !== agentId) return false
    const campaign = campaignById(candidate.campaignId)
    return campaign?.status === 'active' && campaign.dialingMode === 'MANUAL'
  })
  return link?.campaignId ?? null
}

/** Every 3-8 s: one idle fake agent starts a call or takes a break. */
function advanceOne(now: number): DataScope[] {
  const available = statusIdByName('available')
  const idle = fakeAgents().filter((user) => {
    const state = agentStateOf(user.id)
    return state && state.statusId === available && !state.currentCallId && !plans.has(user.id)
  })
  if (idle.length === 0) return []
  const agent = rand.pick(idle)

  if (rand.chance(0.05)) {
    setAgentStatus(agent.id, statusIdByName(rand.chance(0.6) ? 'break' : 'lunch'))
    plans.set(agent.id, { kind: 'pause', until: now + between(60, 180) * SEC })
    return ['agents', 'metrics']
  }

  const onCall = store.data.agentStates.filter((state) => state.currentCallId).length
  if (onCall >= onCallTarget) return []

  // Prefer an idle agent who can dial a MANUAL campaign.
  const dialers = idle
    .filter((user) => user.sipExtension)
    .map((user) => ({ user, campaignId: manualCampaignFor(user.id, agentStateOf(user.id)?.currentCampaignId ?? null) }))
    .filter((entry): entry is { user: typeof agent; campaignId: string } => entry.campaignId !== null)
  if (dialers.length === 0) return []
  const { user, campaignId } = rand.pick(dialers)
  const lead = getNextNumber(campaignId)
  if (!lead) return []
  const call = startCall({ campaignId, numberId: lead.id, agentId: user.id, mode: 'MANUAL' })
  plans.set(user.id, { kind: 'ring', callId: call.id, until: now + between(2, 5) * SEC, outcome: pickOutcome() })
  return ['agents', 'calls', 'numbers', 'metrics']
}

function tick(): void {
  const now = Date.now()
  const touched = new Set<DataScope>()
  try {
    for (const user of fakeAgents()) if (!adopted.has(user.id)) adopt(user.id, now)
    for (const [agentId, plan] of [...plans]) {
      if (!isFakeAgent(agentId)) {
        plans.delete(agentId)
        continue
      }
      if (now >= nextDue(plan)) for (const scope of step(agentId, plan, now)) touched.add(scope)
    }
    if (now >= nextAdvanceAt) {
      nextAdvanceAt = now + between(3, 8) * SEC
      if (rand.chance(0.15)) onCallTarget = between(4, 6)
      for (const scope of advanceOne(now)) touched.add(scope)
    }
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[floor] tick skipped', error)
  }
  if (touched.size > 0) changed(...touched)
}

export function startFloorSimulator(): () => void {
  const stop = every(1000, tick)
  const off = bus.on('demo:reset', () => {
    plans.clear()
    adopted.clear()
    nextAdvanceAt = 0
  })
  return () => {
    stop()
    off()
  }
}
