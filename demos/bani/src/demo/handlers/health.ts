/**
 * Mock API + simulators for the "health" feature group (PLAN section 6).
 *
 * The host collector is simulated: a 5 s live sample (random walk around the
 * last 60 s bucket), a new 60 s HostMetricRow and one PingRow per target each
 * minute, trimmed to 24 h. Self-test runs are built from the shared catalogue;
 * "Run tests now" takes 1.5 to 3 s and prepends a run, and a scheduled run is
 * added at :05 every hour. All state lives in `store.data`, so Reset restores
 * the seed; only the random-walk cursors are kept in memory and re-synced on
 * `demo:reset`.
 */
import { DemoApiError, every } from '@portfolio/demo-kit'

import type { HealthSnapshot, HostLiveSample, HostMetricRow, PingRow, SelfTestOverview, TestResult, TestRun } from '@/types'
import { api, bus, jitter, nowIso, paginate, requireFeature, sleep, store } from '../core'
import { DISK_TOTAL, MEM_TOTAL, PING_TARGETS, TEST_CATALOGUE } from '../seed/platform'

const SECOND = 1_000
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const KEEP_MS = DAY + 10 * MINUTE
const SNAPSHOT_WINDOW_SEC = 90
const PING_WINDOW_SEC = 180

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const rnd = (): number => Math.random()
const r1 = (n: number): number => Math.round(n * 10) / 10
const r2 = (n: number): number => Math.round(n * 100) / 100
const avg = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/* ----------------------------------------------------------- simulator state */

interface Episode {
  until: number
  loss: number
  rttMul: number
}

interface Acc {
  cpu: number[]
  mem: number[]
  rx: number[]
  tx: number[]
}

interface Sim {
  live: HostLiveSample
  bucketStart: number
  nextPingAt: number
  acc: Acc
  episodes: Map<string, Episode>
  initAt: number
}

const UPTIME_BASE_SEC = 17 * 86_400 + 6 * 3_600 + 12 * 60
let sim: Sim | null = null
let runInProgress = false
let runSeq = 0

const emptyAcc = (): Acc => ({ cpu: [], mem: [], rx: [], tx: [] })

function lastMetric(): HostMetricRow | undefined {
  return store.data.hostMetrics[store.data.hostMetrics.length - 1]
}

function initSim(now: number): Sim {
  const last = lastMetric()
  const lastPing = store.data.pings.reduce((m, p) => Math.max(m, Date.parse(p.recordedAt)), 0)
  const live: HostLiveSample = {
    sampledAt: new Date(now).toISOString(),
    cpuPct: last?.cpuPctAvg ?? 18,
    memUsedBytes: last?.memUsedBytesAvg ?? MEM_TOTAL * 0.62,
    memTotalBytes: MEM_TOTAL,
    diskFreeBytes: last?.diskFreeBytes ?? DISK_TOTAL * 0.29,
    diskTotalBytes: DISK_TOTAL,
    netRxBytesPerSec: last?.netRxBytesPerSecAvg ?? 800_000,
    netTxBytesPerSec: last?.netTxBytesPerSecAvg ?? 600_000,
    loadAvg1: last?.loadAvg1 ?? 1.4,
    loadAvg5: last?.loadAvg5 ?? 1.3,
    loadAvg15: last?.loadAvg15 ?? 1.2,
    processCount: last?.processCount ?? 312,
    uptimeSeconds: UPTIME_BASE_SEC,
    collectorRunning: true,
  }
  return {
    live,
    bucketStart: last ? Date.parse(last.bucketEndAt) : Math.floor(now / MINUTE) * MINUTE,
    nextPingAt: lastPing ? lastPing + MINUTE : now,
    acc: emptyAcc(),
    episodes: new Map(),
    initAt: now,
  }
}

/** One 5 s collector tick: a gentle random walk around the last stored bucket. */
function stepLive(s: Sim, now: number): void {
  const prev = s.live
  const ref = lastMetric()
  const cpuTarget = ref?.cpuPctAvg ?? prev.cpuPct
  const cpu = clamp(prev.cpuPct * 0.72 + cpuTarget * 0.28 + (rnd() - 0.5) * 7, 1.5, 97)
  const mem = clamp(prev.memUsedBytes + (rnd() - 0.5) * 48 * 1024 ** 2, MEM_TOTAL * 0.45, MEM_TOTAL * 0.9)
  const rxTarget = ref?.netRxBytesPerSecAvg ?? prev.netRxBytesPerSec
  const txTarget = ref?.netTxBytesPerSecAvg ?? prev.netTxBytesPerSec
  const rx = Math.max(2_000, prev.netRxBytesPerSec * 0.6 + rxTarget * 0.4 * (0.7 + rnd() * 0.6))
  const tx = Math.max(2_000, prev.netTxBytesPerSec * 0.6 + txTarget * 0.4 * (0.7 + rnd() * 0.6))
  const load1 = clamp(prev.loadAvg1 * 0.8 + (cpu / 100) * 8 * 0.2 + (rnd() - 0.5) * 0.15, 0.05, 16)
  s.live = {
    sampledAt: new Date(now).toISOString(),
    cpuPct: r1(cpu),
    memUsedBytes: Math.round(mem),
    memTotalBytes: MEM_TOTAL,
    diskFreeBytes: Math.max(0, Math.round(prev.diskFreeBytes - rnd() * 90_000)),
    diskTotalBytes: DISK_TOTAL,
    netRxBytesPerSec: Math.round(rx),
    netTxBytesPerSec: Math.round(tx),
    loadAvg1: r2(load1),
    loadAvg5: r2(prev.loadAvg5 * 0.97 + load1 * 0.03),
    loadAvg15: r2(prev.loadAvg15 * 0.99 + load1 * 0.01),
    processCount: clamp(prev.processCount + Math.round((rnd() - 0.5) * 4), 280, 420),
    uptimeSeconds: UPTIME_BASE_SEC + Math.round((now - s.initAt) / SECOND),
    collectorRunning: true,
  }
  s.acc.cpu.push(s.live.cpuPct)
  s.acc.mem.push(s.live.memUsedBytes)
  s.acc.rx.push(s.live.netRxBytesPerSec)
  s.acc.tx.push(s.live.netTxBytesPerSec)
}

/** Close the current 60 s bucket into a HostMetricRow. */
function flushBucket(s: Sim): void {
  if (!s.acc.cpu.length) for (let i = 0; i < 4; i++) stepLive(s, s.bucketStart + (i + 1) * 12 * SECOND)
  const a = s.acc
  const l = s.live
  const start = s.bucketStart
  const end = start + MINUTE
  const iso = (ms: number): string => new Date(ms).toISOString()
  const mx = (xs: number[]): number => Math.max(...xs)
  const mn = (xs: number[]): number => Math.min(...xs)
  store.data.hostMetrics.push({
    recordedAt: iso(end + 1_000),
    bucketStartAt: iso(start),
    bucketEndAt: iso(end),
    sampleCount: a.cpu.length,
    cpuPctAvg: r1(avg(a.cpu)),
    cpuPctMax: r1(mx(a.cpu)),
    cpuPctMin: r1(mn(a.cpu)),
    memUsedBytesAvg: Math.round(avg(a.mem)),
    memUsedBytesMax: mx(a.mem),
    memUsedBytesMin: mn(a.mem),
    memTotalBytes: MEM_TOTAL,
    diskFreeBytes: l.diskFreeBytes,
    diskTotalBytes: DISK_TOTAL,
    diskUsedPct: r1((1 - l.diskFreeBytes / DISK_TOTAL) * 100),
    netRxBytesPerSecAvg: Math.round(avg(a.rx)),
    netRxBytesPerSecMax: mx(a.rx),
    netTxBytesPerSecAvg: Math.round(avg(a.tx)),
    netTxBytesPerSecMax: mx(a.tx),
    loadAvg1: l.loadAvg1,
    loadAvg5: l.loadAvg5,
    loadAvg15: l.loadAvg15,
    processCount: l.processCount,
  })
  s.acc = emptyAcc()
  s.bucketStart = end
}

const EPISODE_CHANCE: Record<string, number> = { 'Edge PBX': 0.05, Directory: 0.012, 'Core Cluster': 0.004, 'Voice Archive': 0.006 }

function buildPing(label: string, target: string, baseRtt: number, at: number, ep: Episode | undefined): PingRow {
  const sent = 10
  const loss = ep?.loss ?? 0
  const received = Math.round(sent * (1 - loss / 100))
  const jit = baseRtt * (0.15 + rnd() * 0.35)
  const mean = baseRtt * (0.9 + rnd() * 0.25) * (ep && loss < 100 ? ep.rttMul : 1)
  return {
    recordedAt: new Date(at).toISOString(),
    label,
    target,
    packetsSent: sent,
    packetsReceived: received,
    packetLossPct: loss,
    rttAvgMs: received ? r2(mean) : null,
    rttMinMs: received ? r2(Math.max(0.05, mean - jit)) : null,
    rttMaxMs: received ? r2(mean + jit * 2.2) : null,
    rttMdevMs: received ? r2(jit / 2) : null,
    reachable: received > 0,
    error: received ? null : '100% packet loss (10 sent, 0 received)',
  }
}

function addPingRound(s: Sim, at: number): void {
  for (const t of PING_TARGETS) {
    let ep = s.episodes.get(t.label)
    if (ep && ep.until < at) {
      s.episodes.delete(t.label)
      ep = undefined
    }
    if (!ep && rnd() < (EPISODE_CHANCE[t.label] ?? 0.004)) {
      const down = t.label === 'Directory' && rnd() < 0.25
      ep = { until: at + (2 + Math.floor(rnd() * 3)) * MINUTE, loss: down ? 100 : [10, 20, 30, 50][Math.floor(rnd() * 4)]!, rttMul: 2 + rnd() * 2 }
      s.episodes.set(t.label, ep)
    }
    store.data.pings.push(buildPing(t.label, t.target, t.rtt, at, ep))
  }
}

function trim(now: number): void {
  const cutoff = now - KEEP_MS
  const m = store.data.hostMetrics
  let i = 0
  while (i < m.length && Date.parse(m[i]!.bucketEndAt) < cutoff) i++
  if (i) m.splice(0, i)
  const p = store.data.pings
  let j = 0
  while (j < p.length && Date.parse(p[j]!.recordedAt) < cutoff) j++
  if (j) p.splice(0, j)
}

/** Next scheduled self-test: :05 past the hour, tenant time (offset is whole hours). */
function nextScheduledAt(now: number): number {
  return Math.ceil((now - 5 * MINUTE) / HOUR) * HOUR + 5 * MINUTE
}

/** Bring the simulation up to `now`. Cheap; also called by reads so a hidden tab catches up. */
function advance(now: number, announce: boolean): Sim {
  if (!sim) sim = initSim(now)
  const s = sim
  if (now - Date.parse(s.live.sampledAt) >= 4_500) {
    stepLive(s, now)
    if (announce) bus.emit('health:sample', s.live)
  }
  let guard = 0
  while (now >= s.bucketStart + MINUTE && guard++ < 180) flushBucket(s)
  if (now >= s.bucketStart + MINUTE) s.bucketStart = Math.floor(now / MINUTE) * MINUTE
  guard = 0
  while (now >= s.nextPingAt && guard++ < 180) {
    addPingRound(s, s.nextPingAt)
    s.nextPingAt += MINUTE
  }
  if (now >= s.nextPingAt) s.nextPingAt = now + MINUTE
  trim(now)
  scheduledRunIfDue(now)
  return s
}

/* ---------------------------------------------------------------- self-test */

const FAILURES: { testKey: string; message: string; durationMs: [number, number] }[] = [
  { testKey: 'core_shell', message: 'Login to the Core Cluster shell timed out after 10 s', durationMs: [9_800, 10_100] },
  { testKey: 'edge_api', message: 'Edge PBX API answered 503 Service Unavailable', durationMs: [420, 900] },
  { testKey: 'directory', message: 'Directory bind refused: no answer from the server on port 636', durationMs: [5_000, 5_300] },
  { testKey: 'core_admin_api', message: 'Core Cluster admin API did not answer within 8 s', durationMs: [7_900, 8_200] },
]
const SKIPS: { testKey: string; message: string }[] = [
  { testKey: 'core_shell', message: 'Skipped: the Core Cluster is in a maintenance window' },
  { testKey: 'edge_api', message: 'Skipped: a previous check is still running' },
]

function buildRun(triggeredBy: string, startedAtMs: number): TestRun {
  runSeq += 1
  const id = `test-run-${Date.now().toString(36)}-${runSeq}`
  const roll = rnd()
  const failure = roll < 0.16 ? FAILURES[Math.floor(rnd() * FAILURES.length)] : undefined
  const skip = !failure && roll > 0.9 ? SKIPS[Math.floor(rnd() * SKIPS.length)] : undefined
  const results: TestResult[] = TEST_CATALOGUE.map((t) => {
    let status: TestResult['status'] = t.testKey === 'record_mirror' ? 'skipped' : 'passed'
    let message = t.okMessage
    let durationMs = t.slow[0] + Math.round(rnd() * (t.slow[1] - t.slow[0]))
    if (failure && t.testKey === failure.testKey) {
      status = 'failed'
      message = failure.message
      durationMs = failure.durationMs[0] + Math.round(rnd() * (failure.durationMs[1] - failure.durationMs[0]))
    } else if (skip && t.testKey === skip.testKey) {
      status = 'skipped'
      message = skip.message
      durationMs = 0
    }
    return { id: `${id}-${t.testKey}`, category: t.category, testKey: t.testKey, testName: t.testName, status, message, durationMs }
  })
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const durationMs = results.reduce((sum, r) => sum + r.durationMs, 0) + 180 + Math.round(rnd() * 240)
  return {
    id,
    status: failed ? 'degraded' : 'passed',
    triggeredBy,
    total: results.length,
    passed: results.length - failed - skipped,
    failed,
    skipped,
    durationMs,
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(startedAtMs + durationMs).toISOString(),
    results,
  }
}

function recordRun(run: TestRun): void {
  const runs = store.data.testRuns
  runs.unshift(run)
  if (runs.length > 120) runs.length = 120
  bus.emit('selftest:completed', run)
}

/** The hourly scheduled run lands without delay once its :05 slot has passed. */
function scheduledRunIfDue(now: number): void {
  const latest = store.data.testRuns[0]
  if (!latest || runInProgress) return
  const slot = Math.floor((now - 5 * MINUTE) / HOUR) * HOUR + 5 * MINUTE
  if (slot > Date.parse(latest.startedAt) + MINUTE && now >= slot) recordRun(buildRun('schedule', slot))
}

/* -------------------------------------------------------------------- routes */

function hoursParam(value: string | undefined): number {
  return clamp(Number(value) || 24, 1, 48)
}

function nearest<T>(rows: T[], at: number, time: (r: T) => number, windowMs: number): T | null {
  let best: T | null = null
  let bestD = Infinity
  for (const r of rows) {
    const d = Math.abs(time(r) - at)
    if (d < bestD) {
      best = r
      bestD = d
    }
  }
  return best && bestD <= windowMs ? best : null
}

export function register(): void {
  advance(Date.now(), false)

  api.register('GET', '/health/metrics', ({ params }) => {
    requireFeature('health')
    advance(Date.now(), false)
    const from = Date.now() - hoursParam(params.hours) * HOUR
    return store.data.hostMetrics.filter((m) => Date.parse(m.bucketEndAt) >= from)
  })

  api.register('GET', '/health/live', () => {
    requireFeature('health')
    return { ...advance(Date.now(), false).live, sampledAt: nowIso() } satisfies HostLiveSample
  })

  api.register('GET', '/health/pings', ({ params }) => {
    requireFeature('health')
    advance(Date.now(), false)
    const from = Date.now() - hoursParam(params.hours) * HOUR
    return store.data.pings.filter((p) => Date.parse(p.recordedAt) >= from)
  })

  api.register('GET', '/health/snapshot', ({ params }) => {
    requireFeature('health')
    advance(Date.now(), false)
    const at = Date.parse(params.at ?? '')
    if (!Number.isFinite(at)) throw new DemoApiError(400, 'Pick a valid date and time.', { at: ['Pick a valid date and time.'] })
    if (at > Date.now() + MINUTE) throw new DemoApiError(400, 'The time cannot be in the future.', { at: ['The time cannot be in the future.'] })
    const metrics = nearest(store.data.hostMetrics, at, (m) => Date.parse(m.bucketStartAt) + MINUTE / 2, SNAPSHOT_WINDOW_SEC * SECOND)
    const pings: PingRow[] = []
    for (const t of PING_TARGETS) {
      const row = nearest(
        store.data.pings.filter((p) => p.label === t.label),
        at,
        (p) => Date.parse(p.recordedAt),
        PING_WINDOW_SEC * SECOND,
      )
      if (row) pings.push(row)
    }
    return { requestedAt: new Date(at).toISOString(), windowSec: SNAPSHOT_WINDOW_SEC, metrics, pings } satisfies HealthSnapshot
  })

  api.register('GET', '/selftest', ({ params }) => {
    requireFeature('health')
    advance(Date.now(), false)
    const runs = store.data.testRuns
    return {
      latest: runs[0] ?? null,
      history: paginate(runs, params, 10),
      collectorRunning: true,
      nextRunAt: new Date(nextScheduledAt(Date.now())).toISOString(),
    } satisfies SelfTestOverview
  })

  api.register('POST', '/selftest', async () => {
    const persona = requireFeature('health')
    if (runInProgress) throw new DemoApiError(409, 'A test run is already in progress.')
    runInProgress = true
    try {
      const startedAt = Date.now()
      await sleep(jitter(1_500, 3_000))
      const run = buildRun(persona.username, startedAt)
      // The run "took" the sum of its checks and finished just now.
      const end = Date.now()
      run.completedAt = new Date(end).toISOString()
      run.startedAt = new Date(end - run.durationMs).toISOString()
      recordRun(run)
      return run
    } finally {
      runInProgress = false
    }
  })

  every(5_000, () => {
    advance(Date.now(), true)
  })

  bus.on('demo:reset', () => {
    sim = null
    runInProgress = false
    advance(Date.now(), false)
  })
}
