/**
 * System health (owner: superadmin). The seed already holds 7 days of history
 * at 15-minute steps; this module adds a 1-minute tail for the last hour and a
 * live feed (one sample every 2 s, the last ~300 kept). The feed also catches
 * up lazily when a handler asks for it, so any tab (leader or not, visible or
 * not) always reads a believable, continuous series.
 */
import { createRandom, every, type Random } from '@portfolio/demo-kit'

import type { ChitiDb, SystemHealthSample } from '@/types'

import { emitLocal } from '../bus'
import { store } from '../store'

const LIVE_STEP_MS = 2_000
const LIVE_MAX = 300
const FINE_STEP_MS = 60_000
const FINE_MAX = 120

interface Feed {
  data: ChitiDb
  rnd: Random
  cpu: number
  mem: number
  lag: number
  ping: number
  live: SystemHealthSample[]
  fine: SystemHealthSample[]
  nextLiveAt: number
  nextFineAt: number
  last: SystemHealthSample
}

let feed: Feed | null = null

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits

function walk(feedState: Feed, value: number, min: number, max: number, spread: number): number {
  return Math.min(max, Math.max(min, value + (feedState.rnd.next() - 0.5) * spread))
}

function sampleAt(state: Feed, at: number): SystemHealthSample {
  const hour = (new Date(at).getUTCHours() + 4) % 24
  const busy = hour >= 11 && hour <= 21 ? 12 : 0
  state.cpu = walk(state, state.cpu, 10, 60, 7)
  state.mem = walk(state, state.mem, 40, 70, 2)
  state.lag = walk(state, state.lag, 1, 15, 3)
  state.ping = walk(state, state.ping, 20, 80, 12)
  const base = state.last
  const spike = state.rnd.chance(0.02) ? state.rnd.int(10, 25) : 0
  const memUsedMb = Math.round((base.memTotalMb * state.mem) / 100)
  const diskUsedGb = round(base.diskUsedGb + 0.0004, 3)
  const next: SystemHealthSample = {
    at: new Date(at).toISOString(),
    cpuPercent: round(Math.min(98, state.cpu + busy * 0.5 + spike)),
    loadAvg1: round(((state.cpu + busy) / 100) * 2, 2),
    memUsedMb,
    memTotalMb: base.memTotalMb,
    memPercent: round(state.mem),
    diskUsedGb,
    diskTotalGb: base.diskTotalGb,
    diskPercent: round((diskUsedGb / base.diskTotalGb) * 100),
    netRxKbps: Math.round(180 + busy * 30 + state.rnd.next() * 260 + spike * 20),
    netTxKbps: Math.round(140 + busy * 25 + state.rnd.next() * 200 + spike * 12),
    eventLoopLagMs: round(Math.min(40, state.lag + spike * 0.2)),
    pingMs: Math.round(state.ping),
    uptimeSeconds: base.uptimeSeconds + Math.max(1, Math.round((at - Date.parse(base.at)) / 1000)),
  }
  state.last = next
  return next
}

function build(): Feed {
  const history = store.data.healthSamples
  const seedLast = history[history.length - 1]
  const now = Date.now()
  const fallback: SystemHealthSample = {
    at: new Date(now).toISOString(),
    cpuPercent: 24,
    loadAvg1: 0.5,
    memUsedMb: 2100,
    memTotalMb: 4096,
    memPercent: 52,
    diskUsedGb: 31.5,
    diskTotalGb: 80,
    diskPercent: 39.4,
    netRxKbps: 300,
    netTxKbps: 220,
    eventLoopLagMs: 4,
    pingMs: 38,
    uptimeSeconds: 19 * 86_400,
  }
  const last = seedLast ?? fallback
  const state: Feed = {
    data: store.data,
    rnd: createRandom('chiti-health-live'),
    cpu: last.cpuPercent,
    mem: last.memPercent,
    lag: last.eventLoopLagMs,
    ping: last.pingMs,
    live: [],
    fine: [],
    nextLiveAt: now,
    nextFineAt: now,
    last: { ...last, at: new Date(Math.min(Date.parse(last.at), now - 61 * 60_000)).toISOString() },
  }
  // The seed ends "now"; slot the 1-minute tail and the first live minute after it.
  state.last = { ...last, at: new Date(now - 61 * 60_000).toISOString(), uptimeSeconds: Math.max(0, last.uptimeSeconds - 61 * 60) }
  for (let index = 59; index >= 1; index -= 1) state.fine.push(sampleAt(state, now - index * FINE_STEP_MS))
  for (let index = 29; index >= 1; index -= 1) state.live.push(sampleAt(state, now - index * LIVE_STEP_MS))
  state.nextLiveAt = now
  state.nextFineAt = now
  return state
}

function ensure(): Feed {
  if (!feed || feed.data !== store.data) feed = build()
  return feed
}

/** Add every sample that is due (catches up after a hidden tab or a lazy read). */
export function advanceHealth(now: number = Date.now()): SystemHealthSample {
  const state = ensure()
  let added = false
  if (now - state.nextLiveAt > LIVE_MAX * LIVE_STEP_MS) state.nextLiveAt = now - (LIVE_MAX - 1) * LIVE_STEP_MS
  while (state.nextLiveAt <= now) {
    state.live.push(sampleAt(state, state.nextLiveAt))
    state.nextLiveAt += LIVE_STEP_MS
    added = true
  }
  if (state.live.length > LIVE_MAX) state.live.splice(0, state.live.length - LIVE_MAX)
  if (now - state.nextFineAt > FINE_MAX * FINE_STEP_MS) state.nextFineAt = now - (FINE_MAX - 1) * FINE_STEP_MS
  while (state.nextFineAt + FINE_STEP_MS <= now) {
    state.nextFineAt += FINE_STEP_MS
    const nearest = state.live[state.live.length - 1]
    if (nearest) state.fine.push({ ...nearest, at: new Date(state.nextFineAt).toISOString() })
  }
  if (state.fine.length > FINE_MAX) state.fine.splice(0, state.fine.length - FINE_MAX)
  const latest = state.live[state.live.length - 1] ?? state.last
  if (added) emitLocal('health:tick', latest)
  return latest
}

export function liveSamples(): SystemHealthSample[] {
  advanceHealth()
  return ensure().live
}

export function fineSamples(): SystemHealthSample[] {
  advanceHealth()
  return ensure().fine
}

export function start(): () => void {
  feed = null
  advanceHealth()
  return every(LIVE_STEP_MS, () => {
    advanceHealth()
  })
}
