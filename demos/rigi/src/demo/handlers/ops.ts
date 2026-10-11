/**
 * Mock API handlers. Owner: ops.
 * Audit log, system log, system health (simulated), settings, mail backfill,
 * mail storage purge and the scheduler panel. Patterns are registered WITHOUT
 * the /api prefix.
 */
import { createRandom, DemoApiError, every, notFound, type DemoParams, type MockApi } from '@portfolio/demo-kit'

import {
  HEALTH_DEPENDENCIES,
  HISTORY_RANGES,
  metricDef,
  type MetricDef,
} from '@/features/ops/lib/metrics'
import type {
  AuditPage,
  AuditRow,
  BackfillDto,
  ConnectionTestResult,
  HealthSnapshotDto,
  IncidentDto,
  MailSettingsDto,
  PurgeResult,
  SchedulerJobsDto,
  SystemLogPage,
  SystemLogRow,
} from '@/features/ops/lib/types'
import type {
  AuditEntityType,
  BillingDetails,
  HealthDependency,
  HealthHistoryPoint,
  LogLevel,
  MailBackfillRun,
  SchedulerJobName,
  SchedulerRun,
  ServiceHealth,
  ServiceStatus,
  SystemSettings,
} from '@/types'

import { emitChanged, notify, nowIso, recordAudit, requireStaff, writeSystemLog } from '../ctx'
import { hasJob, JOB_SCHEDULES, runJob } from '../jobs'
import { store } from '../runtime'

/* ================================================================ helpers */

const AUDIT_PAGE_SIZE = 50
const LOG_PAGE_SIZE = 50
const AUDIT_ENTITY_TYPES: AuditEntityType[] = ['task', 'user', 'invoice', 'partner', 'mail', 'license', 'settings', 'template', 'project']
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const JOB_NAMES = Object.keys(JOB_SCHEDULES) as SchedulerJobName[]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** xmur3-style string hash -> [0, 1). Deterministic noise without state. */
function h01(key: string): number {
  let h = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^= h >>> 16) >>> 0) / 4294967296
}

/** Smooth value noise in [-1, 1] over time. */
function smooth(seed: string, t: number, periodMs: number): number {
  const k = Math.floor(t / periodMs)
  const f = t / periodMs - k
  const s = f * f * (3 - 2 * f)
  const a = h01(`${seed}:${k}`)
  const b = h01(`${seed}:${k + 1}`)
  return (a + (b - a) * s) * 2 - 1
}

/** A random-walk-looking signal in roughly [-1, 1]. */
function walk(seed: string, t: number): number {
  return 0.6 * smooth(seed, t, 60_000) + 0.3 * smooth(`${seed}~`, t, 15_000) + 0.1 * smooth(`${seed}^`, t, 5_000)
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/** `YYYY-MM-DD` in the Tbilisi day (+04) -> ms bounds. */
function dayStart(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return Date.parse(`${value}T00:00:00+04:00`)
}
function dayEnd(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return Date.parse(`${value}T23:59:59.999+04:00`)
}

function pageOf(params: DemoParams): number {
  const page = Number(params.page ?? 1)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function partnerName(id: string | null): string | null {
  if (!id) return null
  return store.data.partners.find((p) => p.id === id)?.name ?? id
}

function partnersRef() {
  return store.data.partners.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name))
}

function obj(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

function parseRetention(body: unknown): number {
  const days = Number(obj(body).days)
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw DemoApiError.validation({ days: 'Retention must be a whole number of days between 1 and 3650.' })
  }
  return days
}

/* ============================================================ health sim */

const T0 = Date.now()
const UPTIME_AT_LOAD = 6 * 86_400 + 4 * 3_600 + 1_207

interface HealthWindow {
  dependency: Extract<HealthDependency, 'imap' | 'smtp'>
  status: Exclude<ServiceStatus, 'ok'>
  start: number
  end: number
  reason: string
}

const REASONS: Record<HealthWindow['dependency'], Record<HealthWindow['status'], string[]>> = {
  imap: {
    degraded: ['IMAP responses slower than 1500 ms', 'IMAP IDLE reconnecting repeatedly', 'Mailbox SELECT took 2.8 s'],
    down: ['IMAP login timed out after 10000 ms', 'IMAP connection reset by peer (ECONNRESET)'],
  },
  smtp: {
    degraded: ['SMTP greeting took 2.4 s', 'SMTP 421 try again later (rate limited)'],
    down: ['SMTP connect ECONNREFUSED', 'SMTP TLS handshake timed out'],
  },
}

/** Deterministic schedule of imap/smtp trouble, every few minutes after load. */
const WINDOWS: HealthWindow[] = (() => {
  const rng = createRandom('rigi-health')
  const out: HealthWindow[] = []
  let at = T0 + 80_000
  for (let i = 0; i < 240; i++) {
    const dependency = rng.chance(0.6) ? 'imap' : 'smtp'
    const status = rng.chance(0.35) ? 'down' : 'degraded'
    const duration = rng.int(35, 85) * 1000
    out.push({ dependency, status, start: at, end: at + duration, reason: rng.pick(REASONS[dependency][status]) })
    at += duration + rng.int(150, 300) * 1000
  }
  return out
})()

const handled = new Set<number>()
const openIncidents = new Map<number, string>()

function windowAt(dep: HealthDependency, t: number): HealthWindow | undefined {
  return WINDOWS.find((w) => w.dependency === dep && w.start <= t && t < w.end)
}

const DEP_BASE: Record<HealthDependency, number> = { postgres: 3.2, jobqueue: 6.5, smtp: 88, imap: 142, attachments: 1.8 }
const DEP_LABEL: Record<HealthDependency, string> = { postgres: 'Postgres', jobqueue: 'Job queue', smtp: 'SMTP', imap: 'IMAP', attachments: 'Attachments' }

function latencyAt(dep: HealthDependency, t: number): number | null {
  const w = windowAt(dep, t)
  if (w?.status === 'down') return null
  const base = DEP_BASE[dep] * (1 + 0.28 * walk(`lat-${dep}`, t))
  return round(w?.status === 'degraded' ? base * (9 + 4 * h01(`deg-${dep}-${Math.floor(t / 5000)}`)) : base, 1)
}

function serviceAt(dep: HealthDependency, t: number): ServiceHealth {
  const w = windowAt(dep, t)
  const sparkline: number[] = []
  for (let i = 59; i >= 0; i--) sparkline.push(latencyAt(dep, t - i * 5000) ?? 0)
  return {
    dependency: dep,
    status: w?.status ?? 'ok',
    latencyMs: latencyAt(dep, t),
    reason: w?.reason ?? null,
    sparkline,
    lastCheckedAt: new Date(t - Math.floor(h01(`chk-${dep}-${Math.floor(t / 5000)}`) * 4000)).toISOString(),
  }
}

function snapshot(): HealthSnapshotDto {
  const t = Date.now()
  const daily = Math.sin(((new Date(t).getUTCHours() + 4 - 9) / 24) * 2 * Math.PI)
  const load1 = Math.max(0.05, 0.62 + 0.18 * daily + 0.32 * walk('load1', t))
  const load5 = Math.max(0.05, 0.58 + 0.16 * daily + 0.14 * walk('load5', t))
  const load15 = Math.max(0.05, 0.55 + 0.14 * daily + 0.06 * walk('load15', t))
  const since24h = t - 86_400_000
  const since15m = t - 15 * 60_000
  const since48h = t - 48 * 3_600_000
  const logs = store.data.systemLogs
  const synced = new Set(
    logs.filter((l) => l.source.startsWith('partner.user_sync') && Date.parse(l.createdAt) >= since48h).map((l) => l.partnerId),
  )
  return {
    takenAt: new Date(t).toISOString(),
    services: HEALTH_DEPENDENCIES.map((dep) => serviceAt(dep, t)),
    resources: {
      cpuLoad: [round(load1), round(load5), round(load15)],
      eventLoopP50Ms: round(1.3 * (1 + 0.2 * walk('el50', t)), 2),
      eventLoopP99Ms: round(9.5 * (1 + 0.45 * walk('el99', t)), 2),
      rssMb: round(312 + 9 * walk('rss', t) + (t - T0) / 120_000, 1),
      diskFreePct: round(61.4 - (t - T0) / 86_400_000 + 0.05 * walk('disk', t), 1),
      nodeVersion: 'v22.11.0',
      uptimeSec: Math.floor(UPTIME_AT_LOAD + (t - T0) / 1000),
      pid: 41873,
    },
    backlog: {
      queuedJobs: Math.round(2 + 2.5 * Math.abs(walk('queue', t))),
      failedJobs24h: logs.filter((l) => l.source === 'jobs.run' && l.level === 'error' && Date.parse(l.createdAt) >= since24h).length,
      staleSyncPartners: store.data.partners.filter((p) => p.isActive && !synced.has(p.id)).length,
      errors15m: logs.filter((l) => l.level === 'error' && Date.parse(l.createdAt) >= since15m).length,
    },
    retentionDays: store.data.settings.retention.healthDays,
  }
}

/** Opens and closes incidents as the schedule passes. Runs every 5s while visible. */
function healthTick(): void {
  const t = Date.now()
  let changed = false
  WINDOWS.forEach((w, i) => {
    if (w.start > t) return
    if (!handled.has(i)) {
      handled.add(i)
      if (t >= w.end) return // passed while the tab was hidden
      const id = store.nextId('inc_')
      store.data.incidents.unshift({ id, dependency: w.dependency, startedAt: new Date(w.start).toISOString(), endedAt: null, reason: w.reason })
      openIncidents.set(i, id)
      writeSystemLog({
        level: w.status === 'down' ? 'error' : 'warn',
        source: 'health.monitor',
        message: `${DEP_LABEL[w.dependency]} ${w.status}: ${w.reason}`,
        context: { dependency: w.dependency, status: w.status, incidentId: id },
        payload: { latencyMs: latencyAt(w.dependency, t), checkedAt: new Date(t).toISOString() },
      })
      notify({
        tone: w.status === 'down' ? 'error' : 'warning',
        title: w.status === 'down' ? 'ops:notify.down' : 'ops:notify.degraded',
        description: w.reason,
        values: { service: DEP_LABEL[w.dependency] },
        href: '/admin/system-health',
      })
      changed = true
    }
    const openId = openIncidents.get(i)
    if (openId && t >= w.end) {
      openIncidents.delete(i)
      const incident = store.data.incidents.find((x) => x.id === openId)
      if (incident) {
        incident.endedAt = new Date(w.end).toISOString()
        writeSystemLog({
          level: 'info',
          source: 'health.monitor',
          message: `${DEP_LABEL[w.dependency]} recovered after ${Math.round((w.end - w.start) / 1000)} s`,
          context: { dependency: w.dependency, status: 'ok', incidentId: openId },
        })
        notify({ tone: 'success', title: 'ops:notify.recovered', values: { service: DEP_LABEL[w.dependency] }, href: '/admin/system-health' })
      }
      changed = true
    }
  })
  if (changed) emitChanged('health', 'system-logs', 'dashboards')
}

function overlapFraction(dep: HealthDependency, from: number, to: number): { down: number; degraded: number } {
  let down = 0
  let degraded = 0
  const add = (start: number, end: number, status: 'down' | 'degraded') => {
    const o = Math.min(end, to) - Math.max(start, from)
    if (o > 0) {
      if (status === 'down') down += o
      else degraded += o
    }
  }
  for (const inc of store.data.incidents) {
    if (inc.dependency !== dep) continue
    const start = Date.parse(inc.startedAt)
    // Live incidents come from the schedule (degraded or down); seeded ones count as outages.
    const status = WINDOWS.find((w) => w.dependency === dep && w.start === start)?.status ?? 'down'
    add(start, inc.endedAt ? Date.parse(inc.endedAt) : Date.now(), status)
  }
  const span = to - from
  return { down: down / span, degraded: degraded / span }
}

function history(def: MetricDef, rangeMs: number, bucketMs: number): HealthHistoryPoint[] {
  const end = Math.floor(Date.now() / bucketMs) * bucketMs
  const count = Math.round(rangeMs / bucketMs)
  const out: HealthHistoryPoint[] = []
  for (let k = count - 1; k >= 0; k--) {
    const b = end - k * bucketMs
    const hour = ((b / 3_600_000 + 4) % 24 + 24) % 24
    const daily = Math.sin(((hour - 9) / 24) * 2 * Math.PI)
    const n = h01(`${def.key}:${bucketMs}:${b}`) * 2 - 1
    let avg = def.base * (1 + daily * def.daily + n * def.noise * 0.5)
    let min = avg * (1 - def.noise * 0.6 * h01(`${def.key}:lo:${b}`))
    let max = avg * (1 + def.noise * 0.8 * h01(`${def.key}:hi:${b}`))
    if (def.dependency && (def.unit === 'up' || def.unit === 'ms')) {
      const o = overlapFraction(def.dependency, b, b + bucketMs)
      if (def.unit === 'up') {
        avg = 1 - o.down
        min = o.down > 0 ? 0 : 1
        max = 1
      } else if (o.down + o.degraded > 0) {
        avg *= 1 + 8 * o.degraded + 12 * o.down
        max *= 10
      }
    }
    if (def.unit === 'count') {
      avg = Math.max(0, avg)
      min = Math.max(0, Math.floor(min))
      max = Math.max(Math.ceil(max), Math.ceil(avg))
    }
    const digits = def.unit === 'bytes' ? 0 : 3
    out.push({ bucketAt: new Date(b).toISOString(), avg: round(Math.max(0, avg), digits), min: round(Math.max(0, min), digits), max: round(Math.max(0, max), digits) })
  }
  return out
}

/* ========================================================= mail backfill */

const BACKFILL_ERRORS = [
  'UID {uid}: malformed MIME boundary',
  'UID {uid}: attachment exceeds 25 MB, skipped body',
  'UID {uid}: invalid charset "x-unknown"',
]

function backfillTick(): void {
  const run = store.data.backfillRuns.find((r) => r.state === 'running')
  if (!run) return
  if (run.cancelRequested) {
    run.state = 'cancelled'
    run.finishedAt = nowIso()
    writeSystemLog({ level: 'warn', source: 'mail.backfill', message: `Backfill ${run.id} cancelled at ${run.processedCount}/${run.totalCount}`, context: { runId: run.id } })
    emitChanged('backfill', 'system-logs')
    return
  }
  const step = Math.min(run.totalCount - run.processedCount, 9 + Math.floor(h01(`${run.id}:${run.processedCount}`) * 9))
  for (let k = 0; k < step; k++) {
    const c = run.processedCount + k
    const r = h01(`bf:${run.id}:${c}`)
    if (r < 0.02) {
      run.errorCount += 1
      run.lastError = BACKFILL_ERRORS[c % BACKFILL_ERRORS.length]!.replace('{uid}', String(48_200 + c))
    } else if (r < 0.15) run.skippedCount += 1
    else run.ingestedCount += 1
  }
  run.processedCount += step
  if (run.processedCount >= run.totalCount) {
    run.state = 'completed'
    run.finishedAt = nowIso()
    writeSystemLog({
      level: run.errorCount > 0 ? 'warn' : 'info',
      source: 'mail.backfill',
      message: `Backfill ${run.id} completed: ${run.ingestedCount} ingested, ${run.skippedCount} duplicates skipped, ${run.errorCount} errors`,
      context: { runId: run.id, limit: run.limit },
      payload: { processed: run.processedCount, lastError: run.lastError },
    })
    notify({ tone: 'success', title: 'ops:notify.backfillDone', values: { ingested: run.ingestedCount, total: run.totalCount }, href: '/admin/settings' })
    emitChanged('backfill', 'system-logs')
    return
  }
  emitChanged('backfill')
}

/* ============================================================= settings */

function mailSettings(): MailSettingsDto {
  const { imap, smtp, appBaseUrl } = store.data.settings
  const { password: _ip, ...imapRest } = imap
  const { password: _sp, ...smtpRest } = smtp
  return { imap: { ...imapRest, hasPassword: imap.password.length > 0 }, smtp: { ...smtpRest, hasPassword: smtp.password.length > 0 }, appBaseUrl }
}

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function parsePort(v: unknown, field: string, errors: Record<string, string>): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 65535) errors[field] = 'Port must be between 1 and 65535.'
  return n
}

const EMAIL_IN = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/

async function connectionTest(kind: 'imap' | 'smtp', body: unknown): Promise<ConnectionTestResult> {
  requireStaff('superadmin')
  const input = obj(body)
  const host = str(input.host, 253)
  const started = Date.now()
  await sleep(800)
  const ok = host.includes('.')
  recordAudit({ action: `settings.test_${kind}`, entityType: 'settings', entityId: 'settings', before: null, after: { host, ok } })
  emitChanged('audit')
  return {
    ok,
    latencyMs: Date.now() - started,
    message: ok
      ? kind === 'imap'
        ? `Connected to ${host}:${Number(input.port) || 993}, INBOX selected`
        : `Connected to ${host}:${Number(input.port) || 587}, EHLO accepted`
      : 'Connection refused',
  }
}

/* ============================================================== register */

let simulatorsStarted = false

export function register(api: MockApi): void {
  /* ---------------------------------------------------------- audit */
  api.register('GET', '/audit', ({ params }) => {
    requireStaff('accountant')
    if (params.entityType && !AUDIT_ENTITY_TYPES.includes(params.entityType as AuditEntityType)) {
      throw DemoApiError.validation({ entityType: 'Unknown entity type.' })
    }
    const since = dayStart(params.since)
    const until = dayEnd(params.until)
    const rows = store.data.activityLog
      .filter((r) => !params.entityType || r.entityType === params.entityType)
      .filter((r) => !params.actorId || r.actorUserId === params.actorId)
      .filter((r) => !params.partnerId || r.partnerId === params.partnerId)
      .filter((r) => since === null || Date.parse(r.createdAt) >= since)
      .filter((r) => until === null || Date.parse(r.createdAt) <= until)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = pageOf(params)
    const users = store.data.staffUsers
    const items: AuditRow[] = rows.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE).map((r) => ({
      ...r,
      actorNameKa: users.find((u) => u.id === r.actorUserId)?.fullNameKa ?? null,
      partnerName: partnerName(r.partnerId),
    }))
    const actorIds = new Set(store.data.activityLog.map((r) => r.actorUserId))
    const result: AuditPage = {
      items,
      total: rows.length,
      page,
      pageSize: AUDIT_PAGE_SIZE,
      facets: {
        actors: users
          .filter((u) => actorIds.has(u.id))
          .map((u) => ({ id: u.id, name: u.fullName, nameKa: u.fullNameKa ?? null, role: u.role }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        partners: partnersRef(),
      },
    }
    return result
  })

  /* ----------------------------------------------------- system logs */
  api.register('GET', '/system-logs', ({ params }) => {
    requireStaff('superadmin')
    if (params.level && !LOG_LEVELS.includes(params.level as LogLevel)) throw DemoApiError.validation({ level: 'Unknown level.' })
    const since = dayStart(params.since)
    const until = dayEnd(params.until)
    const source = params.source?.toLowerCase()
    const q = params.q?.toLowerCase()
    const rid = params.requestId?.toLowerCase()
    const rows = store.data.systemLogs
      .filter((r) => !params.level || r.level === params.level)
      .filter((r) => !source || r.source.toLowerCase().includes(source))
      .filter((r) => !params.partnerId || r.partnerId === params.partnerId)
      .filter((r) => !rid || (r.requestId ?? '').toLowerCase().includes(rid))
      .filter((r) => !q || r.message.toLowerCase().includes(q))
      .filter((r) => since === null || Date.parse(r.createdAt) >= since)
      .filter((r) => until === null || Date.parse(r.createdAt) <= until)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const all = params.all === '1' || params.all === 'true'
    const pageSize = all ? Math.max(1, Math.min(rows.length, 5000)) : Math.min(200, Math.max(10, Number(params.pageSize) || LOG_PAGE_SIZE))
    const page = all ? 1 : pageOf(params)
    const items: SystemLogRow[] = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ ...r, partnerName: partnerName(r.partnerId) }))
    const result: SystemLogPage = {
      items,
      total: rows.length,
      page,
      pageSize,
      facets: { partners: partnersRef(), sources: [...new Set(store.data.systemLogs.map((r) => r.source))].sort() },
    }
    return result
  })

  api.register('GET', '/system-logs/retention', () => {
    requireStaff('superadmin')
    return { days: store.data.settings.retention.systemLogDays }
  })

  api.register('PUT', '/system-logs/retention', ({ body }) => {
    requireStaff('superadmin')
    const days = parseRetention(body)
    const before = { systemLogDays: store.data.settings.retention.systemLogDays }
    store.data.settings.retention.systemLogDays = days
    recordAudit({ action: 'settings.update', entityType: 'settings', entityId: 'retention', before, after: { systemLogDays: days } })
    emitChanged('system-logs', 'settings', 'audit')
    return { days }
  })

  /* ---------------------------------------------------- system health */
  api.register('GET', '/system-health/snapshot', () => {
    requireStaff('superadmin')
    return snapshot()
  })

  api.register('GET', '/system-health/history', ({ params }) => {
    requireStaff('superadmin')
    const def = metricDef(params.metric ?? '')
    const range = HISTORY_RANGES.find((r) => r.value === params.range) ?? HISTORY_RANGES[1]!
    if (!def) return []
    return history(def, range.ms, range.bucketMs)
  })

  api.register('GET', '/system-health/incidents', () => {
    requireStaff('superadmin')
    const items: IncidentDto[] = [...store.data.incidents]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((i) => ({ ...i, durationSec: i.endedAt ? Math.round((Date.parse(i.endedAt) - Date.parse(i.startedAt)) / 1000) : null }))
    return items
  })

  api.register('PUT', '/system-health/retention', ({ body }) => {
    requireStaff('superadmin')
    const days = parseRetention(body)
    const before = { healthDays: store.data.settings.retention.healthDays }
    store.data.settings.retention.healthDays = days
    recordAudit({ action: 'settings.update', entityType: 'settings', entityId: 'retention', before, after: { healthDays: days } })
    emitChanged('health', 'settings', 'audit')
    return { days }
  })

  /* ---------------------------------------------------------- settings */
  api.register('GET', '/settings', () => {
    requireStaff('superadmin')
    return mailSettings()
  })

  api.register('PUT', '/settings', ({ body }) => {
    requireStaff('superadmin')
    const input = obj(body)
    const imapIn = obj(input.imap)
    const smtpIn = obj(input.smtp)
    const errors: Record<string, string> = {}
    const current = store.data.settings
    const imap: SystemSettings['imap'] = {
      host: str(imapIn.host, 253),
      port: parsePort(imapIn.port, 'imap.port', errors),
      user: str(imapIn.user, 254),
      password: str(imapIn.password, 200) || current.imap.password,
      tls: imapIn.tls !== false,
    }
    const smtp: SystemSettings['smtp'] = {
      host: str(smtpIn.host, 253),
      port: parsePort(smtpIn.port, 'smtp.port', errors),
      user: str(smtpIn.user, 254),
      password: str(smtpIn.password, 200) || current.smtp.password,
      from: str(smtpIn.from, 254),
      tls: smtpIn.tls !== false,
    }
    const appBaseUrl = str(input.appBaseUrl, 500)
    if (!imap.host) errors['imap.host'] = 'This field is required.'
    if (!smtp.host) errors['smtp.host'] = 'This field is required.'
    if (!smtp.from || !EMAIL_IN.test(smtp.from)) errors['smtp.from'] = 'Enter a sender address.'
    if (!/^https?:\/\/[^\s/]+\.[^\s]+$/.test(appBaseUrl)) errors.appBaseUrl = 'Enter a full URL (https://…).'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const before = mailSettings()
    current.imap = imap
    current.smtp = smtp
    current.appBaseUrl = appBaseUrl
    recordAudit({ action: 'settings.update', entityType: 'settings', entityId: 'settings', before, after: mailSettings() })
    emitChanged('settings', 'audit')
    return mailSettings()
  })

  api.register('POST', '/settings/test-imap', ({ body }) => connectionTest('imap', body))
  api.register('POST', '/settings/test-smtp', ({ body }) => connectionTest('smtp', body))

  api.register('GET', '/settings/billing', () => {
    requireStaff('accountant')
    return store.data.settings.billing
  })

  api.register('PUT', '/settings/billing', ({ body }) => {
    requireStaff('accountant')
    const input = obj(body)
    const next: BillingDetails = {
      bankName: str(input.bankName, 200),
      accountHolder: str(input.accountHolder, 200),
      iban: str(input.iban, 34).replace(/\s+/g, '').toUpperCase(),
      swift: str(input.swift, 11).toUpperCase(),
      address: str(input.address, 500),
      notes: str(input.notes, 2000),
    }
    const errors: Record<string, string> = {}
    if (!next.bankName) errors.bankName = 'This field is required.'
    if (!next.accountHolder) errors.accountHolder = 'This field is required.'
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(next.iban)) errors.iban = 'Enter a valid IBAN.'
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(next.swift)) errors.swift = 'Enter an 8 or 11 character SWIFT/BIC.'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const before = { ...store.data.settings.billing }
    store.data.settings.billing = next
    recordAudit({ action: 'settings.update_billing', entityType: 'settings', entityId: 'billing', before, after: next })
    emitChanged('settings', 'invoices', 'audit')
    return next
  })

  /* ---------------------------------------------------- mail backfill */
  api.register('GET', '/mail-backfill', () => {
    requireStaff('superadmin')
    const history = [...store.data.backfillRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const result: BackfillDto = { latest: history[0] ?? null, history }
    return result
  })

  api.register('POST', '/mail-backfill', ({ body }) => {
    const me = requireStaff('superadmin')
    const raw = obj(body).limit
    let limit: number | null = null
    if (raw !== undefined && raw !== null && raw !== '') {
      limit = Number(raw)
      if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw DemoApiError.validation({ limit: 'Limit must be between 1 and 10000.' })
    }
    if (store.data.backfillRuns.some((r) => r.state === 'running')) throw new DemoApiError(409, 'backfill_already_running')
    const run: MailBackfillRun = {
      id: store.nextId('bf_'),
      state: 'running',
      cancelRequested: false,
      totalCount: limit ?? 240,
      processedCount: 0,
      ingestedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      lastError: null,
      startedAt: nowIso(),
      finishedAt: null,
      startedByName: me.name,
      limit,
    }
    store.data.backfillRuns.unshift(run)
    recordAudit({ action: 'mail.backfill', entityType: 'mail', entityId: run.id, before: null, after: { limit } })
    writeSystemLog({ level: 'info', source: 'mail.backfill', message: `Backfill ${run.id} started (${run.totalCount} messages)`, context: { runId: run.id, limit } })
    emitChanged('backfill', 'system-logs', 'audit')
    return run
  })

  api.register('POST', '/mail-backfill/cancel', () => {
    requireStaff('superadmin')
    const run = store.data.backfillRuns.find((r) => r.state === 'running')
    if (!run) throw new DemoApiError(409, 'backfill_not_running')
    run.cancelRequested = true
    emitChanged('backfill')
    return run
  })

  api.register('POST', '/mail/purge-storage', () => {
    requireStaff('superadmin')
    let purgedMails = 0
    for (const mail of store.data.mails) {
      if (mail.bodyText === '[purged]' && mail.bodyHtml === null) continue
      mail.bodyText = '[purged]'
      mail.bodyHtml = null
      purgedMails += 1
    }
    const purgedAttachments = store.data.attachments.length
    recordAudit({ action: 'mail.purge_storage', entityType: 'mail', entityId: 'storage', before: null, after: { purgedMails, purgedAttachments } })
    writeSystemLog({ level: 'warn', source: 'mail.storage', message: `Mail storage purged: ${purgedMails} bodies, ${purgedAttachments} attachment blobs`, context: { purgedMails, purgedAttachments } })
    emitChanged('mails', 'threads', 'system-logs', 'audit')
    const result: PurgeResult = { purgedMails, purgedAttachments }
    return result
  })

  /* --------------------------------------------------------- scheduler */
  api.register('GET', '/scheduler/jobs', () => {
    requireStaff('superadmin')
    const runs = [...store.data.schedulerRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const result: SchedulerJobsDto = {
      jobs: JOB_NAMES.map((name) => ({ name, cron: JOB_SCHEDULES[name], registered: hasJob(name), lastRun: runs.find((r) => r.job === name) ?? null })),
      recent: runs.slice(0, 10),
    }
    return result
  })

  api.register('POST', '/scheduler/jobs/:name/run', async ({ path }) => {
    const me = requireStaff('superadmin')
    const name = path.name as SchedulerJobName
    if (!JOB_NAMES.includes(name)) throw notFound(`Unknown job ${path.name}`)
    const startedAt = nowIso()
    const t = Date.now()
    let ok = false
    let summary = ''
    try {
      const result = await runJob(name)
      ok = result.ok
      summary = result.summary
    } catch (error) {
      summary = error instanceof Error ? error.message : String(error)
    }
    const run: SchedulerRun = { id: store.nextId('run_'), job: name, startedAt, finishedAt: nowIso(), ok, summary, triggeredByName: me.name }
    store.data.schedulerRuns.unshift(run)
    writeSystemLog({
      level: ok ? 'info' : 'error',
      source: 'jobs.run',
      message: `${name}: ${summary}`,
      context: { job: name, trigger: 'manual', durationMs: Date.now() - t },
      payload: { runId: run.id, ok },
    })
    emitChanged('scheduler', 'system-logs', 'health')
    return run
  })

  /* -------------------------------------------------------- simulators */
  if (!simulatorsStarted) {
    simulatorsStarted = true
    every(5000, healthTick)
    every(2000, backfillTick)
  }
}
