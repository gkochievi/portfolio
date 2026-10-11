/**
 * Mock API + simulators for the "archive" feature group (PLAN section 6).
 *
 * Every job (Core Cluster sync, Edge PBX mirror reconcile, "Hangup by"
 * backfill, recording backup, verify) lives in `store.data` with a status
 * machine; a 1 s tick advances running jobs, appends log events and emits
 * `archive:changed` / `archive:event`. Only the per-job progress targets are
 * kept in memory, and they are dropped on `demo:reset`.
 */
import { DemoApiError, every, notFound, type DemoParams } from '@portfolio/demo-kit'

import type {
  ArchiveDayInventory,
  BackupFlow,
  BackupOverview,
  BackupRun,
  BackupSourceKey,
  CoreImportStatus,
  HangupBackfillStatus,
  LogEvent,
  LogLevel,
  MirrorCheckResult,
  MirrorSyncRun,
  MissingFile,
  SyncRun,
  SyncRunsResponse,
  SyncType,
  VerifyDayRow,
  VerifyRun,
} from '@/types'
import { api, bus, currentPersona, jitter, nowIso, paginate, requireFeature, sleep, store } from '../core'
import { BACKUP_RETRY_DAYS, BACKUP_SCHEDULE, destPathFor, sourcePathFor } from '../seed/archive'

/* ------------------------------------------------------------------ helpers */

const DAY_MS = 86_400_000
const TZ_MS = 4 * 3_600_000
const MAX_RANGE_DAYS = 31
const MAX_EVENTS = 1_500
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const tenantDay = (ms: number): string => new Date(ms + TZ_MS).toISOString().slice(0, 10)
const todayTenant = (): string => tenantDay(Date.now())

function daysIn(from: string, to: string): string[] {
  const out: string[] = []
  for (let ms = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); ms <= end; ms += DAY_MS) {
    out.push(new Date(ms).toISOString().slice(0, 10))
  }
  return out
}

/** Stable 32-bit hash (FNV-1a) so simulated numbers are deterministic per input. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const between = (seed: number, min: number, max: number): number => min + (seed % (max - min + 1))
const isWeekendDay = (day: string): boolean => {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}
const sinceMs = (iso: string): number => Math.max(0, Date.now() - Date.parse(iso))

function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

/** Validate a {fromDate, toDate} pair of tenant days. */
function readRange(body: unknown, opts: { allowToday?: boolean } = {}): { fromDate: string; toDate: string; days: string[] } {
  const b = bodyOf(body)
  const fromDate = typeof b.fromDate === 'string' ? b.fromDate : ''
  const toDate = typeof b.toDate === 'string' ? b.toDate : ''
  const errors: Record<string, string> = {}
  if (!ISO_DAY.test(fromDate)) errors.fromDate = 'Pick a start date.'
  if (!ISO_DAY.test(toDate)) errors.toDate = 'Pick an end date.'
  if (!errors.fromDate && !errors.toDate) {
    const today = todayTenant()
    if (toDate < fromDate) errors.toDate = 'The end date must be on or after the start date.'
    else if (opts.allowToday === false ? toDate >= today : toDate > today) {
      errors.toDate = opts.allowToday === false ? 'Pick yesterday or earlier.' : 'The end date cannot be in the future.'
    } else if (daysIn(fromDate, toDate).length > MAX_RANGE_DAYS) errors.toDate = `Pick a range of ${MAX_RANGE_DAYS} days or fewer.`
  }
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return { fromDate, toDate, days: daysIn(fromDate, toDate) }
}

interface SourceDef {
  flow: BackupFlow
  sourceKey: BackupSourceKey
}

const SOURCES: SourceDef[] = [
  { flow: 'voice_archive', sourceKey: 'primary' },
  { flow: 'edge_pbx', sourceKey: 'primary' },
  { flow: 'edge_pbx', sourceKey: 'secondary' },
]

function readSources(body: unknown): SourceDef[] {
  const b = bodyOf(body)
  if (b.flow === 'all') return SOURCES
  const match = SOURCES.find((s) => s.flow === b.flow && s.sourceKey === (b.sourceKey ?? 'primary'))
  if (!match) throw DemoApiError.validation({ flow: 'Pick a source.' })
  return [match]
}

const sameSource = (a: SourceDef, b: SourceDef): boolean => a.flow === b.flow && a.sourceKey === b.sourceKey
const sourceLabel = (s: SourceDef): string =>
  s.flow === 'voice_archive' ? 'Voice Archive' : `Edge PBX (${s.sourceKey ?? 'primary'})`

/** Inventory row for one source + day; days outside the seeded window get an estimate with no gaps. */
function inventoryFor(source: SourceDef, date: string): ArchiveDayInventory {
  const row = store.data.archiveInventory.find((r) => sameSource(r, source) && r.date === date)
  if (row) return row
  const seed = hash(`${source.flow}:${source.sourceKey}:${date}`)
  const weekend = isWeekendDay(date)
  const base = source.flow === 'voice_archive' ? (weekend ? [210, 420] : [920, 1560]) : source.sourceKey === 'primary' ? (weekend ? [40, 110] : [160, 380]) : weekend ? [15, 50] : [60, 170]
  const count = between(seed, base[0] ?? 0, base[1] ?? 0)
  return { flow: source.flow, sourceKey: source.sourceKey, date, sourceCount: count, destCount: count, missingFromDest: [], missingFromSource: [] }
}

function pushEvent(event: Omit<LogEvent, 'id' | 'createdAt'> & { createdAt?: string }): void {
  const full: LogEvent = { ...event, id: store.nextId('evt-'), createdAt: event.createdAt ?? nowIso() }
  store.data.backupEvents.unshift(full)
  if (store.data.backupEvents.length > MAX_EVENTS) store.data.backupEvents.length = MAX_EVENTS
  bus.emit('archive:event', full)
}

const dirOf = (day: string): string => day.replace(/-/g, '/')

/* ------------------------------------------------------- in-memory job plans */

interface CorePlan {
  ticks: number
  done: number
  toProcess: number
  toSkip: number
  records: number
  gaps: number
}
interface MirrorPlan {
  ticks: number
  done: number
  fetched: number
  inserted: number
}
interface HangupPlan {
  ticks: number
  done: number
  fromDate: string
  toDate: string
}
interface BackupPlan {
  ticks: number
  done: number
  listed: number
  toCopy: (MissingFile & { date: string })[]
  toSkip: number
  avgBytes: number
  verifyId: string | null
}

const corePlans = new Map<string, CorePlan>()
const mirrorPlans = new Map<string, MirrorPlan>()
const backupPlans = new Map<string, BackupPlan>()
let hangupPlan: HangupPlan | null = null
/** Edge legs a backfill checked but found no hangup source for. */
const checkedNoSource = new Set<string>()

/* -------------------------------------------------------- Core Cluster sync */

function coreStatus(): CoreImportStatus {
  const data = store.data.coreImport
  data.isRunning = store.data.syncRuns.some((r) => r.status === 'running')
  return data
}

function startCoreRun(syncType: SyncType, triggeredBy: string): SyncRun {
  const ci = store.data.coreImport
  const today = todayTenant()
  let plan: CorePlan
  let fromDate: string | null = null
  let toDate: string | null = null
  if (syncType === 'local') {
    const files = ci.localFilesAvailable
    plan = { ticks: Math.max(2, Math.min(8, Math.ceil(files / 3))), done: 0, toProcess: files, toSkip: 0, records: files * jitter(55, 95), gaps: 0 }
  } else if (syncType === 'scheduled') {
    const files = jitter(1, 2)
    plan = { ticks: 6, done: 0, toProcess: files, toSkip: 0, records: files * jitter(40, 70), gaps: 0 }
  } else if (syncType === 'reconcile') {
    const found = 7 * 27
    const gaps = ci.totalRecords === 0 ? 0 : jitter(0, 4)
    fromDate = tenantDay(Date.now() - 7 * DAY_MS)
    toDate = today
    plan = { ticks: 8, done: 0, toProcess: gaps, toSkip: found - gaps, records: gaps * jitter(55, 95), gaps }
  } else {
    // full history: re-read every file on disk; only records not yet in the archive are imported.
    const onDisk = Math.max(ci.totalFiles, 38_406) + ci.localFilesAvailable
    const fresh = ci.totalRecords === 0 ? onDisk * 33 + jitter(0, 900) : ci.localFilesAvailable * jitter(55, 95)
    fromDate = tenantDay(Date.now() - 730 * DAY_MS)
    toDate = today
    plan = { ticks: 36, done: 0, toProcess: onDisk, toSkip: 0, records: fresh, gaps: 0 }
  }
  const run: SyncRun = {
    id: store.nextId('sync-'),
    status: 'running',
    syncType,
    triggeredBy,
    fromDate,
    toDate,
    filesFound: plan.toProcess + plan.toSkip,
    filesSkipped: 0,
    filesProcessed: 0,
    recordsImported: 0,
    gapFilesFound: plan.gaps,
    gapFilesFilled: 0,
    errors: [],
    durationMs: null,
    startedAt: nowIso(),
    completedAt: null,
  }
  store.data.syncRuns.unshift(run)
  corePlans.set(run.id, plan)
  ci.isRunning = true
  return run
}

function tickCore(run: SyncRun): void {
  const plan = corePlans.get(run.id)
  if (!plan) return
  plan.done += 1
  const f = Math.min(1, plan.done / plan.ticks)
  run.filesProcessed = Math.round(plan.toProcess * f)
  run.filesSkipped = Math.round(plan.toSkip * f)
  run.recordsImported = Math.round(plan.records * f)
  run.gapFilesFilled = Math.round(plan.gaps * f)
  if (f < 1) return
  const ci = store.data.coreImport
  run.status = 'completed'
  run.completedAt = nowIso()
  run.durationMs = sinceMs(run.startedAt)
  corePlans.delete(run.id)
  const newFiles = run.syncType === 'full' ? Math.max(0, plan.toProcess - ci.totalFiles) : plan.toProcess
  ci.totalFiles += newFiles
  ci.totalRecords += run.recordsImported
  if (run.syncType === 'local' || run.syncType === 'full') ci.localFilesAvailable = 0
  if (run.recordsImported > 0) {
    ci.newestRecordAt = new Date(Date.now() - jitter(60, 240) * 1000).toISOString()
    ci.oldestRecordAt ??= run.syncType === 'full' ? new Date(Date.now() - 730 * DAY_MS).toISOString() : ci.newestRecordAt
  }
  ci.lastSync = { id: run.id, status: run.status, completedAt: run.completedAt, filesProcessed: run.filesProcessed, recordsImported: run.recordsImported }
  ci.isRunning = store.data.syncRuns.some((r) => r.status === 'running')
}

/* ---------------------------------------------------------- Edge PBX mirror */

function mirrorCovered(day: string): boolean {
  return store.data.mirrorRuns.some(
    (r) => r.status === 'completed' && r.trigger !== 'interval' && r.fromDate !== null && r.toDate !== null && r.fromDate <= day && day <= r.toDate,
  )
}

function mirrorDay(day: string): { total: number; duplicates: number; missing: number } {
  const seed = hash(`mirror:${day}`)
  const total = isWeekendDay(day) ? between(seed, 120, 200) : between(seed, 480, 620)
  const duplicates = seed % 4 === 0 ? between(seed >>> 4, 1, 3) : 0
  const missing = mirrorCovered(day) ? 0 : (seed >>> 8) % 3 === 0 ? between(seed >>> 12, 1, 6) : 0
  return { total, duplicates, missing }
}

function checkMirror(fromDate: string, toDate: string, days: string[]): MirrorCheckResult {
  let total = 0
  let duplicates = 0
  let missing = 0
  for (const day of days) {
    const d = mirrorDay(day)
    total += d.total
    duplicates += d.duplicates
    missing += d.missing
  }
  const distinct = total - duplicates
  return { fromDate, toDate, total, distinct, duplicates, mirror: distinct - missing, missing, checkedAt: nowIso() }
}

function startMirrorRun(trigger: MirrorSyncRun['trigger'], range: { fromDate: string; toDate: string; days: string[] } | null): MirrorSyncRun {
  let plan: MirrorPlan
  if (range) {
    const check = checkMirror(range.fromDate, range.toDate, range.days)
    plan = { ticks: Math.max(4, Math.min(15, Math.ceil(range.days.length * 1.2))), done: 0, fetched: check.total, inserted: check.missing }
  } else {
    const fetched = jitter(0, 18)
    plan = { ticks: 2, done: 0, fetched, inserted: fetched }
  }
  const run: MirrorSyncRun = {
    id: store.nextId('mirror-'),
    status: 'running',
    trigger,
    fromDate: range?.fromDate ?? null,
    toDate: range?.toDate ?? null,
    fetched: 0,
    inserted: 0,
    durationMs: null,
    error: null,
    startedAt: nowIso(),
    completedAt: null,
  }
  store.data.mirrorRuns.unshift(run)
  mirrorPlans.set(run.id, plan)
  store.data.edgeMirror.isRunning = true
  return run
}

function tickMirror(run: MirrorSyncRun): void {
  const plan = mirrorPlans.get(run.id)
  if (!plan) return
  plan.done += 1
  const f = Math.min(1, plan.done / plan.ticks)
  run.fetched = Math.round(plan.fetched * f)
  run.inserted = Math.round(plan.inserted * f)
  if (f < 1) return
  run.status = 'completed'
  run.completedAt = nowIso()
  run.durationMs = sinceMs(run.startedAt)
  mirrorPlans.delete(run.id)
  const m = store.data.edgeMirror
  m.totalRecords += run.inserted
  if (run.trigger === 'interval') m.newestRecordAt = nowIso()
  // A reconcile fills the gaps a previous check reported for the same days.
  if (run.fromDate && run.toDate && m.lastCheck && m.lastCheck.fromDate >= run.fromDate && m.lastCheck.toDate <= run.toDate) {
    m.lastCheck = { ...m.lastCheck, mirror: m.lastCheck.distinct, missing: 0 }
  }
  m.isRunning = store.data.mirrorRuns.some((r) => r.status === 'running')
}

/* ------------------------------------------------------ "Hangup by" backfill */

const legDay = (calldate: string): string => tenantDay(Date.parse(calldate))

function hangupStatus(): HangupBackfillStatus {
  const s = store.data.hangupBackfill
  const legs = store.data.edgeLegs
  s.rowsWithHangupBy = legs.filter((l) => l.hangupsource !== '').length
  s.notYetChecked = legs.filter((l) => l.hangupsource === '' && !checkedNoSource.has(l.id)).length
  s.running = hangupPlan !== null
  return s
}

function tickHangup(): boolean {
  const plan = hangupPlan
  if (!plan) return false
  plan.done += 1
  if (plan.done < plan.ticks) return true
  const inRange = store.data.edgeLegs.filter((l) => {
    const day = legDay(l.calldate)
    return day >= plan.fromDate && day <= plan.toDate
  })
  let filled = 0
  let noSource = 0
  for (const leg of inRange) {
    if (leg.hangupsource !== '') continue
    const seed = hash(`hangup:${leg.id}`)
    if (seed % 6 === 0) {
      noSource += 1
      checkedNoSource.add(leg.id)
      continue
    }
    const choices = [leg.channel, leg.dstchannel, 'dialplan/builtin'].filter(Boolean)
    leg.hangupsource = choices[seed % choices.length] ?? leg.channel
    filled += 1
  }
  hangupPlan = null
  store.data.hangupBackfill.lastResult = { fromDate: plan.fromDate, toDate: plan.toDate, scanned: inRange.length, filled, noSource, completedAt: nowIso() }
  hangupStatus()
  return true
}

/* ---------------------------------------------------------- recording backup */

function avgBytesFor(source: SourceDef): number {
  return source.flow === 'voice_archive' ? 410_000 : source.sourceKey === 'primary' ? 1_150_000 : 1_020_000
}

function startBackupRun(
  source: SourceDef,
  fromDate: string,
  toDate: string,
  triggeredBy: string,
  files: { listed: number; toCopy: (MissingFile & { date: string })[]; verifyId: string | null },
): BackupRun {
  const plan: BackupPlan = {
    ticks: Math.max(5, Math.min(20, 3 + Math.ceil(files.toCopy.length / 2) + daysIn(fromDate, toDate).length)),
    done: 0,
    listed: files.listed,
    toCopy: files.toCopy,
    toSkip: Math.max(0, files.listed - files.toCopy.length),
    avgBytes: avgBytesFor(source),
    verifyId: files.verifyId,
  }
  const run: BackupRun = {
    id: store.nextId('backup-'),
    flow: source.flow,
    sourceKey: source.sourceKey,
    status: 'running',
    triggeredBy,
    fromDate,
    toDate,
    filesListed: files.listed,
    filesCopied: 0,
    filesSkipped: 0,
    filesFailed: 0,
    bytesCopied: 0,
    errors: [],
    durationMs: null,
    cancelRequested: false,
    startedAt: nowIso(),
    completedAt: null,
  }
  store.data.backupRuns.unshift(run)
  backupPlans.set(run.id, plan)
  const range = fromDate === toDate ? dirOf(fromDate) : `${dirOf(fromDate)} – ${dirOf(toDate)}`
  pushEvent({
    runId: run.id, flow: run.flow, level: 'info', event: 'run_started', dateDir: dirOf(fromDate), relativePath: '', sizeBytes: null, durationMs: null,
    message: `${sourceLabel(source)}: ${triggeredBy.startsWith('verify:') ? 'backfill of missing files' : 'manual backfill'} started, ${files.listed} files listed for ${range}`,
  })
  return run
}

function finishBackup(run: BackupRun, plan: BackupPlan): void {
  run.completedAt = nowIso()
  run.durationMs = sinceMs(run.startedAt)
  backupPlans.delete(run.id)
  if (run.status !== 'completed') return
  const summary = store.data.flowSummaries.find((s) => sameSource(s, run))
  if (summary) {
    summary.lastRunId = run.id
    summary.backedUpTotal += run.filesCopied
    summary.bytesTotal += run.bytesCopied
  }
  // Copied files are now in the file archive: close the inventory gaps.
  const days = new Set(plan.toCopy.map((f) => f.date))
  for (const row of store.data.archiveInventory) {
    if (!sameSource(row, run) || !days.has(row.date)) continue
    row.missingFromDest = []
    row.destCount = row.sourceCount + row.missingFromSource.length
  }
  if (plan.verifyId) {
    const verify = store.data.verifyRuns.find((v) => v.id === plan.verifyId)
    if (verify) {
      for (const day of verify.days) {
        if (!days.has(day.date) || day.missingFromDest.length === 0) continue
        day.destCount += day.missingFromDest.length
        day.presentOnBoth += day.missingFromDest.length
        day.missingFromDest = []
        if (day.status === 'mismatch' && day.missingFromSource.length === 0) day.status = 'ok'
      }
      recomputeVerify(verify)
    }
  }
}

function tickBackup(run: BackupRun): void {
  const plan = backupPlans.get(run.id)
  if (!plan) return
  if (run.cancelRequested) {
    run.status = 'canceled'
    pushEvent({
      runId: run.id, flow: run.flow, level: 'warn', event: 'run_canceled', dateDir: dirOf(run.fromDate), relativePath: '', sizeBytes: null,
      durationMs: sinceMs(run.startedAt), message: `${sourceLabel(run)}: run canceled by an operator, ${run.filesCopied} copied, ${run.filesSkipped} skipped`,
    })
    finishBackup(run, plan)
    return
  }
  plan.done += 1
  const f = Math.min(1, plan.done / plan.ticks)
  const copiedTarget = Math.round(plan.toCopy.length * f)
  for (let i = run.filesCopied; i < copiedTarget; i++) {
    const file = plan.toCopy[i]
    if (!file) continue
    run.bytesCopied += file.sourceSizeBytes
    if (i - run.filesCopied < 4) {
      pushEvent({
        runId: run.id, flow: run.flow, level: 'info', event: 'file_copied', dateDir: dirOf(file.date), relativePath: file.rawRelativePath,
        sizeBytes: file.sourceSizeBytes, durationMs: jitter(40, 900), message: `Copied ${file.name}`,
      })
    }
  }
  run.filesCopied = copiedTarget
  const skippedTarget = Math.round(plan.toSkip * f)
  if (skippedTarget > run.filesSkipped) {
    pushEvent({
      runId: run.id, flow: run.flow, level: 'debug', event: 'files_skipped', dateDir: dirOf(run.fromDate), relativePath: '', sizeBytes: null, durationMs: null,
      message: `Skipped ${skippedTarget - run.filesSkipped} files already in the file archive with the same size`,
    })
  }
  run.filesSkipped = skippedTarget
  if (f < 1) return
  run.status = 'completed'
  pushEvent({
    runId: run.id, flow: run.flow, level: 'info', event: 'run_completed', dateDir: dirOf(run.fromDate), relativePath: '', sizeBytes: null,
    durationMs: sinceMs(run.startedAt), message: `${sourceLabel(run)}: backup completed, ${run.filesCopied} copied, ${run.filesSkipped} skipped`,
  })
  finishBackup(run, plan)
}

function backupOverview(): BackupOverview {
  return {
    flows: store.data.flowSummaries.map((s) => {
      const own = store.data.backupRuns.filter((r) => sameSource(r, s))
      const lastRun = own.find((r) => r.status === 'running') ?? own[0] ?? null
      const openGaps = store.data.archiveInventory.filter((r) => sameSource(r, s) && r.missingFromDest.length > 0).length
      return { ...s, openGaps, lastRun }
    }),
    schedule: BACKUP_SCHEDULE,
    retryDays: BACKUP_RETRY_DAYS,
  }
}

/* -------------------------------------------------------------------- verify */

function recomputeVerify(run: VerifyRun): void {
  const done = run.days.filter((d) => d.status !== 'pending')
  const sum = (pick: (d: VerifyDayRow) => number) => done.reduce((s, d) => s + pick(d), 0)
  run.daysCompleted = done.length
  run.daysWithMismatch = done.filter((d) => d.status === 'mismatch').length
  run.daysFailed = done.filter((d) => d.status === 'failed').length
  run.sourceCount = sum((d) => d.sourceCount)
  run.destCount = sum((d) => d.destCount)
  run.presentOnBoth = sum((d) => d.presentOnBoth)
  run.missingFromDest = sum((d) => d.missingFromDest.length)
  run.missingFromSource = sum((d) => d.missingFromSource.length)
}

function tickVerify(run: VerifyRun): void {
  if (run.cancelRequested) {
    run.status = 'canceled'
    run.completedAt = nowIso()
    recomputeVerify(run)
    return
  }
  const perTick = Math.max(1, Math.ceil(run.daysTotal / 12))
  for (let i = 0; i < perTick; i++) {
    const day = run.days.find((d) => d.status === 'pending')
    if (!day) break
    const inv = inventoryFor(run, day.date)
    day.sourceCount = inv.sourceCount
    day.destCount = inv.destCount
    day.missingFromDest = inv.missingFromDest.map((f) => ({ ...f }))
    day.missingFromSource = inv.missingFromSource.map((f) => ({ ...f }))
    day.presentOnBoth = inv.sourceCount - inv.missingFromDest.length
    day.durationMs = jitter(800, 4_200)
    day.status = day.missingFromDest.length || day.missingFromSource.length ? 'mismatch' : 'ok'
  }
  recomputeVerify(run)
  if (run.daysCompleted >= run.daysTotal) {
    run.status = 'completed'
    run.completedAt = nowIso()
  }
}

function verifySummary(run: VerifyRun): VerifyRun {
  return { ...run, days: [] }
}

/* ---------------------------------------------------------------- simulators */

let ambientCountdown = 20

function ambient(): void {
  if (!store.data.syncRuns.some((r) => r.status === 'running')) startCoreRun('scheduled', 'cron')
  if (!store.data.mirrorRuns.some((r) => r.status === 'running')) startMirrorRun('interval', null)
  const flow: BackupFlow = Math.random() < 0.5 ? 'voice_archive' : 'edge_pbx'
  const yesterday = tenantDay(Date.now() - DAY_MS)
  pushEvent({
    runId: null, flow, level: 'debug', event: 'retry_scan', dateDir: dirOf(yesterday), relativePath: '', sizeBytes: null, durationMs: jitter(200, 1_400),
    message: `Retry window scanned: no open gaps inside the ${BACKUP_RETRY_DAYS}-day retry window`,
  })
  if (Math.random() < 0.4) {
    pushEvent({
      runId: null, flow, level: 'info', event: 'share_check', dateDir: dirOf(yesterday), relativePath: '', sizeBytes: null, durationMs: jitter(30, 260),
      message: 'File archive share reachable, write test passed',
    })
  }
}

function tick(): void {
  const changed = new Set<'core-sync' | 'mirror' | 'hangup' | 'backup' | 'verify'>()
  for (const run of store.data.syncRuns) {
    if (run.status !== 'running') continue
    if (!corePlans.has(run.id)) corePlans.set(run.id, { ticks: 2, done: 1, toProcess: run.filesProcessed, toSkip: run.filesSkipped, records: run.recordsImported, gaps: run.gapFilesFilled })
    tickCore(run)
    changed.add('core-sync')
  }
  for (const run of store.data.mirrorRuns) {
    if (run.status !== 'running') continue
    if (!mirrorPlans.has(run.id)) mirrorPlans.set(run.id, { ticks: 2, done: 1, fetched: run.fetched, inserted: run.inserted })
    tickMirror(run)
    changed.add('mirror')
  }
  if (tickHangup()) changed.add('hangup')
  for (const run of store.data.backupRuns) {
    if (run.status !== 'running') continue
    if (!backupPlans.has(run.id)) {
      backupPlans.set(run.id, { ticks: 2, done: 1, listed: run.filesListed, toCopy: [], toSkip: Math.max(0, run.filesListed - run.filesCopied), avgBytes: 0, verifyId: null })
    }
    tickBackup(run)
    changed.add('backup')
  }
  for (const run of store.data.verifyRuns) {
    if (run.status !== 'running') continue
    tickVerify(run)
    changed.add('verify')
  }
  ambientCountdown -= 1
  if (ambientCountdown <= 0) {
    ambientCountdown = jitter(40, 50)
    ambient()
    changed.add('core-sync')
    changed.add('mirror')
  }
  if (changed.size === 0) return
  store.notify()
  for (const kind of changed) bus.emit('archive:changed', { kind })
}

/* -------------------------------------------------------------------- routes */

const F = 'systems_sync' as const

function pagedRuns<T>(items: readonly T[], params: DemoParams) {
  return paginate(items, params, 25)
}

export function register(): void {
  /* Core Cluster import */
  api.register('GET', '/archive/core/status', () => {
    requireFeature(F)
    return coreStatus()
  })

  api.register('POST', '/archive/core/sync', async ({ body }) => {
    const persona = requireFeature(F)
    const mode = bodyOf(body).mode
    if (mode !== 'local' && mode !== 'reconcile' && mode !== 'full' && mode !== 'reset') throw DemoApiError.validation({ mode: 'Unknown sync mode.' })
    if (store.data.syncRuns.some((r) => r.status === 'running')) throw new DemoApiError(409, 'A Core Cluster sync is already running.')
    if (mode === 'reset') {
      await sleep(jitter(300, 700))
      const ci = store.data.coreImport
      // Forget which drop files were imported: the next sync re-reads the recent drop folder.
      ci.lastSync = null
      ci.localFilesAvailable += 7 * 27
      store.notify()
      bus.emit('archive:changed', { kind: 'core-sync' })
      return { ok: true as const, status: coreStatus() }
    }
    const run = startCoreRun(mode, `manual:${persona.id}`)
    store.notify()
    bus.emit('archive:changed', { kind: 'core-sync', id: run.id })
    return run
  })

  api.register('DELETE', '/archive/core/records', async () => {
    requireFeature(F)
    if (store.data.syncRuns.some((r) => r.status === 'running')) throw new DemoApiError(409, 'Wait for the running sync to finish first.')
    await sleep(jitter(400, 900))
    const ci = store.data.coreImport
    const deleted = ci.totalRecords
    ci.totalRecords = 0
    ci.totalFiles = 0
    ci.oldestRecordAt = null
    ci.newestRecordAt = null
    ci.lastSync = null
    store.notify()
    bus.emit('archive:changed', { kind: 'core-sync' })
    return { deleted }
  })

  api.register('GET', '/archive/core/runs', ({ params }) => {
    requireFeature(F)
    const runs = params.type ? store.data.syncRuns.filter((r) => r.syncType === params.type) : store.data.syncRuns
    const completed = store.data.syncRuns.filter((r) => r.status === 'completed')
    const response: SyncRunsResponse = {
      ...pagedRuns(runs, params),
      summary: {
        totalRuns: store.data.syncRuns.length,
        recordsImported: completed.reduce((s, r) => s + r.recordsImported, 0),
        lastSuccessAt: completed[0]?.completedAt ?? null,
      },
    }
    return response
  })

  /* Edge PBX mirror */
  api.register('GET', '/archive/edge/mirror', () => {
    requireFeature(F)
    const m = store.data.edgeMirror
    m.isRunning = store.data.mirrorRuns.some((r) => r.status === 'running')
    return m
  })

  api.register('POST', '/archive/edge/mirror/check', async ({ body }) => {
    requireFeature(F)
    const range = readRange(body)
    await sleep(jitter(500, 1_300))
    const result = checkMirror(range.fromDate, range.toDate, range.days)
    store.data.edgeMirror.lastCheck = result
    store.notify()
    bus.emit('archive:changed', { kind: 'mirror' })
    return result
  })

  api.register('POST', '/archive/edge/mirror/reconcile', ({ body }) => {
    requireFeature(F)
    const range = readRange(body)
    if (store.data.mirrorRuns.some((r) => r.status === 'running' && r.trigger !== 'interval')) {
      throw new DemoApiError(409, 'A mirror backfill is already running.')
    }
    const run = startMirrorRun('reconcile', range)
    store.notify()
    bus.emit('archive:changed', { kind: 'mirror', id: run.id })
    return run
  })

  api.register('GET', '/archive/edge/mirror/runs', ({ params }) => {
    requireFeature(F)
    return pagedRuns(store.data.mirrorRuns, params)
  })

  /* "Hangup by" backfill */
  api.register('GET', '/archive/hangup', () => {
    requireFeature(F)
    return hangupStatus()
  })

  api.register('POST', '/archive/hangup/backfill', ({ body }) => {
    requireFeature(F)
    const range = readRange(body)
    if (hangupPlan) throw new DemoApiError(409, 'A backfill is already running.')
    hangupPlan = { ticks: Math.max(3, Math.min(10, 2 + Math.ceil(range.days.length / 3))), done: 0, fromDate: range.fromDate, toDate: range.toDate }
    const status = hangupStatus()
    bus.emit('archive:changed', { kind: 'hangup' })
    return status
  })

  /* Recording backup */
  api.register('GET', '/archive/backup', () => {
    requireFeature(F)
    return backupOverview()
  })

  api.register('GET', '/archive/backup/runs', ({ params }) => {
    requireFeature(F)
    const runs = params.flow ? store.data.backupRuns.filter((r) => r.flow === params.flow) : store.data.backupRuns
    return pagedRuns(runs, params)
  })

  api.register('GET', '/archive/backup/runs/:id', ({ path }) => {
    requireFeature(F)
    const run = store.data.backupRuns.find((r) => r.id === path.id)
    if (!run) throw notFound('Backup run not found.')
    return run
  })

  api.register('POST', '/archive/backup/runs', ({ body }) => {
    const persona = requireFeature(F)
    const sources = readSources(body)
    const range = readRange(body)
    const busy = sources.find((s) => store.data.backupRuns.some((r) => r.status === 'running' && sameSource(r, s)))
    if (busy) throw new DemoApiError(409, `${sourceLabel(busy)} already has a running backup.`)
    const runs = sources.map((source) => {
      const rows = range.days.map((day) => inventoryFor(source, day))
      const toCopy = rows.flatMap((row) => row.missingFromDest.map((f) => ({ ...f, date: row.date })))
      const listed = rows.reduce((s, r) => s + r.sourceCount, 0)
      return startBackupRun(source, range.fromDate, range.toDate, `manual:${persona.id}`, { listed, toCopy, verifyId: null })
    })
    store.notify()
    bus.emit('archive:changed', { kind: 'backup' })
    return runs
  })

  api.register('POST', '/archive/backup/runs/:id/cancel', ({ path }) => {
    requireFeature(F)
    const run = store.data.backupRuns.find((r) => r.id === path.id)
    if (!run) throw notFound('Backup run not found.')
    if (run.status !== 'running') throw new DemoApiError(409, 'Only a running backup can be canceled.')
    run.cancelRequested = true
    bus.emit('archive:changed', { kind: 'backup', id: run.id })
    return run
  })

  api.register('GET', '/archive/backup/events', ({ params }) => {
    requireFeature(F)
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const min = order.indexOf((params.minLevel as LogLevel) ?? 'debug')
    const limit = Math.min(500, Math.max(1, Number(params.limit) || 50))
    return store.data.backupEvents
      .filter((e) => (!params.flow || params.flow === 'all' || e.flow === params.flow) && order.indexOf(e.level) >= Math.max(0, min))
      .slice(0, limit)
  })

  /* Verify */
  api.register('GET', '/archive/verify', () => {
    requireFeature(F)
    return [...store.data.verifyRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12).map(verifySummary)
  })

  api.register('POST', '/archive/verify', ({ body }) => {
    requireFeature(F)
    const sources = readSources(body)
    const range = readRange(body, { allowToday: false })
    const busy = sources.find((s) => store.data.verifyRuns.some((r) => r.status === 'running' && sameSource(r, s)))
    if (busy) throw new DemoApiError(409, `${sourceLabel(busy)} already has a verify in progress.`)
    const startedAt = nowIso()
    const runs = sources.map((source): VerifyRun => ({
      id: store.nextId('verify-'),
      flow: source.flow,
      sourceKey: source.sourceKey,
      fromDate: range.fromDate,
      toDate: range.toDate,
      status: 'running',
      daysTotal: range.days.length,
      daysCompleted: 0,
      daysWithMismatch: 0,
      daysFailed: 0,
      sourceCount: 0,
      destCount: 0,
      presentOnBoth: 0,
      missingFromDest: 0,
      missingFromSource: 0,
      cancelRequested: false,
      backfillRunId: null,
      startedAt,
      completedAt: null,
      days: range.days.map((date) => ({
        date,
        sourcePath: sourcePathFor(source.flow, source.sourceKey, date),
        destPath: destPathFor(source.flow, source.sourceKey, date),
        sourceCount: 0,
        destCount: 0,
        presentOnBoth: 0,
        missingFromDest: [],
        missingFromSource: [],
        durationMs: null,
        error: null,
        status: 'pending',
      })),
    }))
    store.data.verifyRuns.unshift(...runs)
    store.notify()
    bus.emit('archive:changed', { kind: 'verify' })
    return runs
  })

  api.register('GET', '/archive/verify/:id', ({ path }) => {
    requireFeature(F)
    const run = store.data.verifyRuns.find((r) => r.id === path.id)
    if (!run) throw notFound('Verify run not found.')
    return run
  })

  api.register('POST', '/archive/verify/:id/cancel', ({ path }) => {
    requireFeature(F)
    const run = store.data.verifyRuns.find((r) => r.id === path.id)
    if (!run) throw notFound('Verify run not found.')
    if (run.status !== 'running') throw new DemoApiError(409, 'Only a running verify can be canceled.')
    run.cancelRequested = true
    bus.emit('archive:changed', { kind: 'verify', id: run.id })
    return run
  })

  api.register('POST', '/archive/verify/:id/backfill', ({ path }) => {
    const persona = currentPersona()
    requireFeature(F)
    const run = store.data.verifyRuns.find((r) => r.id === path.id)
    if (!run) throw notFound('Verify run not found.')
    if (run.status === 'running') throw new DemoApiError(409, 'Wait for the verify to finish first.')
    const existing = run.backfillRunId ? store.data.backupRuns.find((r) => r.id === run.backfillRunId) : undefined
    if (existing?.status === 'running') throw new DemoApiError(409, 'A backfill for this verify is already running.')
    const toCopy = run.days.flatMap((d) => d.missingFromDest.map((f) => ({ ...f, date: d.date })))
    if (toCopy.length === 0) throw new DemoApiError(409, 'Nothing is missing from the file archive for this range.')
    if (store.data.backupRuns.some((r) => r.status === 'running' && sameSource(r, run))) {
      throw new DemoApiError(409, `${sourceLabel(run)} already has a running backup.`)
    }
    const backup = startBackupRun(run, run.fromDate, run.toDate, `verify:${run.id}`, { listed: toCopy.length, toCopy, verifyId: run.id })
    void persona
    run.backfillRunId = backup.id
    store.notify()
    bus.emit('archive:changed', { kind: 'backup', id: backup.id })
    bus.emit('archive:changed', { kind: 'verify', id: run.id })
    return backup
  })

  every(1000, tick)

  bus.on('demo:reset', () => {
    corePlans.clear()
    mirrorPlans.clear()
    backupPlans.clear()
    hangupPlan = null
    checkedNoSource.clear()
    ambientCountdown = 20
  })
}
