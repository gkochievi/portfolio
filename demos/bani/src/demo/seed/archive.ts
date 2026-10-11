/**
 * Archive jobs: Core Cluster record import runs, the Edge PBX record mirror,
 * the "Hangup by" backfill, daily recording backups into the file archive,
 * their log events, and the per-day inventory that verify runs diff.
 */
import type {
  ArchiveDayInventory,
  BackupFlow,
  BackupRun,
  BackupSourceKey,
  CoreImportStatus,
  EdgeMirrorStatus,
  FlowSummary,
  HangupBackfillStatus,
  LogEvent,
  LogLevel,
  MirrorSyncRun,
  MissingFile,
  SyncRun,
  VerifyDayRow,
  VerifyRun,
} from '@/types'
import { edgeLegs } from './calls'
import { roster } from './contactCentre'
import {
  ANCHOR_MS,
  DAY,
  MINUTE,
  dateDir,
  fakeNumber,
  fileStamp,
  iso,
  isWeekend,
  rngFor,
  tenantDay,
  tenantMs,
} from './util'

const rng = rngFor(2)
const ADMINS = ['giorgi.beridze', 'ana.lomidze'] as const

/* ---------------------------------------------------- Core Cluster import */

function buildSyncRuns(): SyncRun[] {
  const runs: Omit<SyncRun, 'id'>[] = []
  const failedDays = new Set([12, 47, 71])
  const dailyRecords = (d: number) => (isWeekend(d) ? rng.int(420, 860) : rng.int(1450, 2650))
  // Nightly scheduled import of the previous day's record files.
  for (let d = 0; d < 90; d++) {
    const start = tenantMs(d, 1, 15, rng.int(0, 40))
    const failed = failedDays.has(d)
    const filesFound = rng.int(24, 30)
    const filesSkipped = rng.int(0, 2)
    const filesProcessed = failed ? rng.int(3, 12) : filesFound - filesSkipped
    const records = failed ? Math.round((dailyRecords(d + 1) * filesProcessed) / filesFound) : dailyRecords(d + 1)
    const duration = failed ? rng.int(30_000, 90_000) : rng.int(38_000, 140_000)
    runs.push({
      status: failed ? 'failed' : 'completed',
      syncType: 'scheduled',
      triggeredBy: 'cron',
      fromDate: tenantDay(start - DAY),
      toDate: tenantDay(start - DAY),
      filesFound,
      filesSkipped,
      filesProcessed,
      recordsImported: records,
      gapFilesFound: 0,
      gapFilesFilled: 0,
      errors: failed
        ? [
            d === 12
              ? 'Record file core_records_n1_1100.csv: unexpected end of file (truncated upload)'
              : d === 47
                ? 'Drop folder unreachable: connection reset by peer after 3 retries'
                : 'Import aborted: archive database lock wait timeout (50 s)',
          ]
        : [],
      durationMs: duration,
      startedAt: iso(start),
      completedAt: iso(start + duration),
    })
  }
  // Drop-folder pickups during the day.
  for (let i = 0; i < 20; i++) {
    const d = rng.int(0, 60)
    const start = d === 0 ? ANCHOR_MS - rng.int(40, 300) * MINUTE : tenantMs(d, rng.int(9, 18), rng.int(0, 59))
    const files = rng.int(1, 4)
    const duration = rng.int(2_000, 9_000)
    runs.push({
      status: 'completed', syncType: 'local', triggeredBy: 'drop_listener', fromDate: null, toDate: null,
      filesFound: files, filesSkipped: 0, filesProcessed: files, recordsImported: files * rng.int(40, 110),
      gapFilesFound: 0, gapFilesFilled: 0, errors: [], durationMs: duration, startedAt: iso(start), completedAt: iso(start + duration),
    })
  }
  // Weekly reconcile passes (gap detection) and two historic full syncs.
  for (let w = 0; w < 8; w++) {
    const d = 3 + w * 11
    const start = tenantMs(d, rng.int(10, 17), rng.int(0, 59))
    const gaps = rng.int(0, 4)
    const duration = rng.int(60_000, 240_000)
    runs.push({
      status: 'completed', syncType: 'reconcile', triggeredBy: rng.pick(ADMINS), fromDate: tenantDay(start - 14 * DAY), toDate: tenantDay(start - DAY),
      filesFound: 14 * 26, filesSkipped: 14 * 26 - gaps, filesProcessed: gaps, recordsImported: gaps * rng.int(60, 120),
      gapFilesFound: gaps, gapFilesFilled: gaps, errors: [], durationMs: duration, startedAt: iso(start), completedAt: iso(start + duration),
    })
  }
  for (const d of [62, 88]) {
    const start = tenantMs(d, 20, 5)
    const duration = rng.int(1_800_000, 3_000_000)
    runs.push({
      status: 'completed', syncType: 'full', triggeredBy: 'ana.lomidze', fromDate: tenantDay(start - 730 * DAY), toDate: tenantDay(start - DAY),
      filesFound: 18_960, filesSkipped: 18_402, filesProcessed: 558, recordsImported: 41_206, gapFilesFound: 558, gapFilesFilled: 558,
      errors: [], durationMs: duration, startedAt: iso(start), completedAt: iso(start + duration),
    })
  }
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return runs.map((run, i) => ({ id: `sync-${1000 + runs.length - i}`, ...run }))
}

export const syncRuns: SyncRun[] = buildSyncRuns()

const lastCompletedSync = syncRuns.find((r) => r.status === 'completed') ?? null

export const coreImport: CoreImportStatus = {
  available: true,
  totalRecords: 1_284_512,
  totalFiles: 38_406,
  oldestRecordAt: iso(tenantMs(731, 8, 2, 11)),
  newestRecordAt: iso(ANCHOR_MS - 3 * MINUTE),
  localFilesAvailable: 12,
  lastSync: lastCompletedSync && {
    id: lastCompletedSync.id,
    status: lastCompletedSync.status,
    completedAt: lastCompletedSync.completedAt,
    filesProcessed: lastCompletedSync.filesProcessed,
    recordsImported: lastCompletedSync.recordsImported,
  },
  isRunning: false,
  cronRunning: true,
  dropListenerRunning: true,
}

/* -------------------------------------------------------- Edge PBX mirror */

function buildMirrorRuns(): MirrorSyncRun[] {
  const runs: Omit<MirrorSyncRun, 'id'>[] = []
  // The last 40 five-minute interval runs.
  for (let i = 0; i < 40; i++) {
    const start = ANCHOR_MS - (i * 5 + 1) * MINUTE - rng.int(0, 20) * 1000
    const failed = i === 17
    const fetched = failed ? 0 : rng.int(0, 18)
    const duration = failed ? 30_000 : rng.int(400, 2_600)
    runs.push({
      status: failed ? 'failed' : 'completed', trigger: 'interval', fromDate: null, toDate: null, fetched,
      inserted: Math.max(0, fetched - rng.int(0, 1)), durationMs: duration,
      error: failed ? 'Edge PBX record store did not answer within 30 s' : null,
      startedAt: iso(start), completedAt: iso(start + duration),
    })
  }
  // Manual backfills and reconcile passes over the last two weeks.
  for (let i = 0; i < 10; i++) {
    const d = rng.int(1, 14)
    const start = tenantMs(d, rng.int(9, 18), rng.int(0, 59))
    const span = rng.int(1, 7)
    const reconcile = i % 3 === 0
    const fetched = reconcile ? rng.int(1_200, 4_800) : rng.int(80, 900)
    const duration = rng.int(8_000, 95_000)
    runs.push({
      status: 'completed', trigger: reconcile ? 'reconcile' : 'manual', fromDate: tenantDay(start - span * DAY), toDate: tenantDay(start - DAY),
      fetched, inserted: reconcile ? rng.int(0, 12) : rng.int(0, Math.round(fetched / 20)), durationMs: duration, error: null,
      startedAt: iso(start), completedAt: iso(start + duration),
    })
  }
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return runs.map((run, i) => ({ id: `mirror-${1000 + runs.length - i}`, ...run }))
}

export const mirrorRuns: MirrorSyncRun[] = buildMirrorRuns()

export const edgeMirror: EdgeMirrorStatus = {
  enabled: true,
  configured: true,
  syncIntervalMinutes: 5,
  totalRecords: 412_880,
  oldestRecordAt: iso(tenantMs(729, 9, 41, 3)),
  newestRecordAt: iso(ANCHOR_MS - 2 * MINUTE),
  lastCheck: {
    fromDate: tenantDay(ANCHOR_MS - 8 * DAY),
    toDate: tenantDay(ANCHOR_MS - DAY),
    total: 4_318,
    distinct: 4_309,
    duplicates: 9,
    mirror: 4_304,
    missing: 5,
    checkedAt: iso(tenantMs(1, 16, 42, 7)),
  },
  isRunning: false,
}

/* ------------------------------------------------------ "Hangup by" backfill */

const missingHangup = edgeLegs.filter((l) => l.hangupsource === '').length

export const hangupBackfill: HangupBackfillStatus = {
  eventTablePresent: true,
  carriesHangupSource: true,
  rowsWithHangupBy: edgeLegs.length - missingHangup,
  notYetChecked: missingHangup,
  running: false,
  lastResult: {
    fromDate: tenantDay(ANCHOR_MS - 9 * DAY),
    toDate: tenantDay(ANCHOR_MS - 3 * DAY),
    scanned: 214,
    filled: 203,
    noSource: 11,
    completedAt: iso(tenantMs(2, 11, 8, 30)),
  },
}

/* ------------------------------------------------------------ backups */

interface FlowDef {
  flow: BackupFlow
  sourceKey: BackupSourceKey
  weekday: [number, number]
  weekend: [number, number]
  avgBytes: number
}

const FLOWS: FlowDef[] = [
  { flow: 'voice_archive', sourceKey: 'primary', weekday: [920, 1560], weekend: [210, 420], avgBytes: 410_000 },
  { flow: 'edge_pbx', sourceKey: 'primary', weekday: [160, 380], weekend: [40, 110], avgBytes: 1_150_000 },
  { flow: 'edge_pbx', sourceKey: 'secondary', weekday: [60, 170], weekend: [15, 50], avgBytes: 1_020_000 },
]

/** Failed nightly runs: [flowIndex, daysAgo, error]. Two Voice Archive ones are still open gaps. */
const FAILED_RUNS: [number, number, string][] = [
  [0, 2, 'File archive share timed out after 120 s (\\\\nas-1.vake.bani.example\\voice-archive)'],
  [0, 17, 'Source listing interrupted: Voice Archive returned HTTP 503 for 2 minutes'],
  [2, 41, 'Authentication to the Batumi recordings share failed (account locked)'],
  [2, 66, 'File archive share timed out after 120 s (\\\\nas-2.rustavi.bani.example\\edge-secondary)'],
]

/** Missing-file counts per inventory day: open gaps from failures plus late-arriving files. */
export const MISMATCH_DAYS: { flowIndex: number; day: number; missing: number }[] = [
  { flowIndex: 0, day: 3, missing: 17 },
  { flowIndex: 0, day: 18, missing: 9 },
  { flowIndex: 1, day: 9, missing: 4 },
  { flowIndex: 2, day: 22, missing: 2 },
]

const dayCount = (def: FlowDef, day: number) => (isWeekend(day) ? rng.int(...def.weekend) : rng.int(...def.weekday))

/** Files per (flow, tenant day backed up), shared by backups and the inventory. */
const fileCounts = new Map<string, number>()
function filesFor(flowIndex: number, day: number): number {
  const key = `${flowIndex}:${day}`
  let n = fileCounts.get(key)
  if (n === undefined) {
    n = dayCount(FLOWS[flowIndex] as FlowDef, day)
    fileCounts.set(key, n)
  }
  return n
}

function buildBackupRuns(): BackupRun[] {
  const runs: Omit<BackupRun, 'id'>[] = []
  FLOWS.forEach((def, fi) => {
    for (let d = 0; d < 90; d++) {
      const start = tenantMs(d, 2, 0, rng.int(2, 50) + fi * 3)
      const backedUpDay = d + 1
      const listed = filesFor(fi, backedUpDay)
      const failure = FAILED_RUNS.find(([f, day]) => f === fi && day === d)
      const mismatch = MISMATCH_DAYS.find((m) => m.flowIndex === fi && m.day === backedUpDay)
      const failedFiles = failure ? (mismatch?.missing ?? rng.int(2, 17)) : 0
      const skipped = rng.int(0, 3)
      const copied = listed - skipped - failedFiles
      const duration = Math.round(copied * rng.int(90, 160)) + rng.int(4_000, 9_000)
      runs.push({
        flow: def.flow, sourceKey: def.sourceKey, status: failure ? 'failed' : 'completed', triggeredBy: 'cron',
        fromDate: tenantDay(start - DAY), toDate: tenantDay(start - DAY), filesListed: listed, filesCopied: copied,
        filesSkipped: skipped, filesFailed: failedFiles, bytesCopied: copied * Math.round(def.avgBytes * (0.85 + rng.next() * 0.3)),
        errors: failure ? [failure[2]] : [], durationMs: duration, cancelRequested: false,
        startedAt: iso(start), completedAt: iso(start + duration),
      })
    }
  })
  // Manual retries of the two closed Edge PBX gaps, and one canceled manual backfill.
  for (const [fi, d] of [[2, 41], [2, 66]] as const) {
    const def = FLOWS[fi] as FlowDef
    const start = tenantMs(d, 10, 22)
    const missing = rng.int(3, 9)
    runs.push({
      flow: def.flow, sourceKey: def.sourceKey, status: 'completed', triggeredBy: 'manual:giorgi.beridze',
      fromDate: tenantDay(start - DAY), toDate: tenantDay(start - DAY), filesListed: filesFor(fi, d + 1), filesCopied: missing,
      filesSkipped: filesFor(fi, d + 1) - missing, filesFailed: 0, bytesCopied: missing * def.avgBytes, errors: [],
      durationMs: 41_000, cancelRequested: false, startedAt: iso(start), completedAt: iso(start + 41_000),
    })
  }
  {
    const start = tenantMs(25, 14, 3)
    runs.push({
      flow: 'edge_pbx', sourceKey: 'primary', status: 'canceled', triggeredBy: 'manual:ana.lomidze',
      fromDate: tenantDay(start - 30 * DAY), toDate: tenantDay(start - DAY), filesListed: 7_410, filesCopied: 0,
      filesSkipped: 2_388, filesFailed: 0, bytesCopied: 0, errors: ['Canceled by ana.lomidze'], durationMs: 96_000,
      cancelRequested: true, startedAt: iso(start), completedAt: iso(start + 96_000),
    })
    const start2 = tenantMs(6, 11, 40)
    runs.push({
      flow: 'voice_archive', sourceKey: 'primary', status: 'completed', triggeredBy: 'manual:giorgi.beridze',
      fromDate: tenantDay(start2 - 7 * DAY), toDate: tenantDay(start2 - DAY), filesListed: 7_904, filesCopied: 12,
      filesSkipped: 7_892, filesFailed: 0, bytesCopied: 12 * 410_000, errors: [], durationMs: 212_000,
      cancelRequested: false, startedAt: iso(start2), completedAt: iso(start2 + 212_000),
    })
  }
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return runs.map((run, i) => ({ id: `backup-${1000 + runs.length - i}`, ...run }))
}

export const backupRuns: BackupRun[] = buildBackupRuns()

export const flowSummaries: FlowSummary[] = FLOWS.map((def, fi) => {
  const own = backupRuns.filter((r) => r.flow === def.flow && r.sourceKey === def.sourceKey)
  return {
    flow: def.flow,
    sourceKey: def.sourceKey,
    lastRunId: own[0]?.id ?? null,
    openGaps: fi === 0 ? 2 : 0,
    backedUpTotal: 1_840_000 * (fi === 0 ? 3 : 1) + own.reduce((sum, r) => sum + r.filesCopied, 0),
    bytesTotal: 702_000_000_000 * (fi === 0 ? 1 : 2) + own.reduce((sum, r) => sum + r.bytesCopied, 0),
    cronEnabled: true,
  }
})

/* ------------------------------------------------------------ file names */

const hqExtensions = roster.filter((a) => a.extension.startsWith('2')).map((a) => a.extension)
const branchExt = () => String(rng.pick([5012, 5014, 5021, 5104, 5110, 5108, 5117, 5203, 5211]))

/** A plausible recording file recorded on tenant day `day` (days before the anchor). */
function recordingFile(flow: BackupFlow, day: number): { name: string; dir: string; size: number } {
  const at = tenantMs(day, rng.int(9, 18), rng.int(0, 59), rng.int(0, 59))
  const stamp = fileStamp(at)
  const name =
    flow === 'voice_archive'
      ? `va-${rng.pick(hqExtensions)}-${stamp}.opus`
      : rng.chance(0.6)
        ? `in-${branchExt()}-${fakeNumber(rng)}-${stamp}.wav`
        : `out-${fakeNumber(rng)}-${branchExt()}-${stamp}.wav`
  const size = flow === 'voice_archive' ? rng.int(60_000, 1_400_000) : rng.int(180_000, 4_600_000)
  return { name, dir: dateDir(at), size }
}

/* ------------------------------------------------------------ log events */

function buildBackupEvents(): LogEvent[] {
  const events: Omit<LogEvent, 'id'>[] = []
  const windowStart = ANCHOR_MS - 3 * DAY
  const recent = backupRuns.filter((r) => Date.parse(r.startedAt) >= windowStart && r.triggeredBy === 'cron')
  for (const run of recent) {
    const fi = FLOWS.findIndex((f) => f.flow === run.flow && f.sourceKey === run.sourceKey)
    const start = Date.parse(run.startedAt)
    const end = Date.parse(run.completedAt ?? run.startedAt)
    // Runs start at 02:00 on day d and back up day d + 1.
    const day = Math.round((tenantMs(0, 2) - start) / DAY) + 1
    const base = { runId: run.id, flow: run.flow, sizeBytes: null, durationMs: null }
    const label = `${run.flow === 'voice_archive' ? 'Voice Archive' : 'Edge PBX'}${run.sourceKey ? ` (${run.sourceKey})` : ''}`
    const sampleDir = recordingFile(run.flow, day).dir
    events.push({ ...base, level: 'info', event: 'run_started', dateDir: sampleDir, relativePath: '', message: `${label}: nightly backup started, ${run.filesListed} files listed for ${sampleDir}`, createdAt: iso(start + 1_200) })
    const copiedSamples = fi === 0 ? 36 : 30
    for (let i = 0; i < copiedSamples; i++) {
      const file = recordingFile(run.flow, day)
      const at = start + Math.round(((i + 1) / (copiedSamples + 2)) * (end - start))
      const level: LogLevel = rng.chance(0.75) ? 'debug' : 'info'
      events.push({ ...base, level, event: 'file_copied', dateDir: file.dir, relativePath: `${file.dir}/${file.name}`, sizeBytes: file.size, durationMs: rng.int(40, 900), message: `Copied ${file.name}`, createdAt: iso(at) })
    }
    for (let i = 0; i < Math.min(run.filesSkipped, 3); i++) {
      const file = recordingFile(run.flow, day)
      events.push({ ...base, level: 'debug', event: 'file_skipped', dateDir: file.dir, relativePath: `${file.dir}/${file.name}`, sizeBytes: file.size, message: `Skipped ${file.name}: already in the file archive with the same size`, createdAt: iso(start + rng.int(2_000, Math.max(3_000, end - start))) })
    }
    if (rng.chance(0.5)) {
      const file = recordingFile(run.flow, day)
      events.push({ ...base, level: 'warn', event: 'slow_copy', dateDir: file.dir, relativePath: `${file.dir}/${file.name}`, sizeBytes: file.size, durationMs: rng.int(8_000, 21_000), message: `Slow copy: ${file.name} took longer than 8 s`, createdAt: iso(start + rng.int(5_000, Math.max(6_000, end - start))) })
    }
    if (run.status === 'failed') {
      for (let i = 0; i < Math.min(run.filesFailed, 6); i++) {
        const file = recordingFile(run.flow, day)
        events.push({ ...base, level: 'error', event: 'file_failed', dateDir: file.dir, relativePath: `${file.dir}/${file.name}`, sizeBytes: file.size, message: `Copy failed for ${file.name}: share did not respond`, createdAt: iso(end - (6 - i) * 20_000) })
      }
      events.push({ ...base, level: 'error', event: 'share_timeout', dateDir: sampleDir, relativePath: '', message: run.errors[0] ?? 'File archive share timed out', createdAt: iso(end - 1_000) })
      events.push({ ...base, level: 'error', event: 'run_failed', dateDir: sampleDir, relativePath: '', durationMs: run.durationMs, message: `${label}: backup failed, ${run.filesCopied} copied, ${run.filesFailed} failed`, createdAt: iso(end) })
    } else {
      events.push({ ...base, level: 'info', event: 'run_completed', dateDir: sampleDir, relativePath: '', durationMs: run.durationMs, message: `${label}: backup completed, ${run.filesCopied} copied, ${run.filesSkipped} skipped`, createdAt: iso(end) })
    }
  }
  // Retry scheduler chatter between runs.
  for (let i = 0; i < 70; i++) {
    const at = ANCHOR_MS - rng.int(10, 3 * 24 * 60) * MINUTE
    const flow: BackupFlow = rng.chance(0.5) ? 'voice_archive' : 'edge_pbx'
    events.push({ runId: null, flow, level: 'debug', event: 'retry_scan', dateDir: dateDir(at - DAY), relativePath: '', sizeBytes: null, durationMs: rng.int(200, 1_400), message: 'Retry window scanned: no open gaps inside the 3-day retry window', createdAt: iso(at) })
  }
  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return events.map((e, i) => ({ id: `evt-${1000 + events.length - i}`, ...e }))
}

export const backupEvents: LogEvent[] = buildBackupEvents()

/* ------------------------------------------------------- inventory + verify */

function missingFiles(flow: BackupFlow, day: number, count: number): MissingFile[] {
  return Array.from({ length: count }, () => {
    const file = recordingFile(flow, day)
    return { name: file.name, rawRelativePath: `${file.dir}/${file.name}`, sourceSizeBytes: file.size }
  })
}

function buildInventory(): ArchiveDayInventory[] {
  const rows: ArchiveDayInventory[] = []
  FLOWS.forEach((def, fi) => {
    for (let day = 1; day <= 30; day++) {
      const sourceCount = filesFor(fi, day)
      const mismatch = MISMATCH_DAYS.find((m) => m.flowIndex === fi && m.day === day)
      const missingFromDest = mismatch ? missingFiles(def.flow, day, mismatch.missing) : []
      // One file pruned from the source by its own retention but still in the archive.
      const missingFromSource = fi === 1 && day === 27 ? missingFiles(def.flow, day, 1) : []
      rows.push({
        flow: def.flow,
        sourceKey: def.sourceKey,
        date: tenantDay(tenantMs(day, 12)),
        sourceCount,
        destCount: sourceCount - missingFromDest.length + missingFromSource.length,
        missingFromDest,
        missingFromSource,
      })
    }
  })
  return rows
}

export const archiveInventory: ArchiveDayInventory[] = buildInventory()

export function sourcePathFor(flow: BackupFlow, sourceKey: BackupSourceKey, date: string): string {
  const dir = date.replace(/-/g, '/')
  if (flow === 'voice_archive') return `vault-1.vake.bani.example:/recordings/${dir}`
  return sourceKey === 'secondary' ? `edge-pbx-2.batumi.bani.example:/recordings/${dir}` : `edge-pbx-1.kutaisi.bani.example:/recordings/${dir}`
}

export function destPathFor(flow: BackupFlow, sourceKey: BackupSourceKey, date: string): string {
  const dir = date.replace(/-/g, '\\')
  return flow === 'voice_archive'
    ? `\\\\nas-1.vake.bani.example\\voice-archive\\${dir}`
    : `\\\\nas-2.rustavi.bani.example\\edge-${sourceKey ?? 'primary'}\\${dir}`
}

function buildVerifyRuns(): VerifyRun[] {
  const rows = archiveInventory
    .filter((r) => r.flow === 'edge_pbx' && r.sourceKey === 'primary')
    .filter((r) => r.date >= tenantDay(tenantMs(14, 12)) && r.date <= tenantDay(tenantMs(8, 12)))
    .sort((a, b) => a.date.localeCompare(b.date))
  const startedAt = tenantMs(5, 9, 14, 2)
  const days: VerifyDayRow[] = rows.map((r) => ({
    date: r.date,
    sourcePath: sourcePathFor(r.flow, r.sourceKey, r.date),
    destPath: destPathFor(r.flow, r.sourceKey, r.date),
    sourceCount: r.sourceCount,
    destCount: r.destCount,
    presentOnBoth: r.sourceCount - r.missingFromDest.length,
    missingFromDest: r.missingFromDest,
    missingFromSource: r.missingFromSource,
    durationMs: rng.int(1_800, 6_400),
    error: null,
    status: r.missingFromDest.length || r.missingFromSource.length ? 'mismatch' : 'ok',
  }))
  const sum = (pick: (d: VerifyDayRow) => number) => days.reduce((s, d) => s + pick(d), 0)
  const duration = sum((d) => d.durationMs ?? 0)
  return [
    {
      id: 'verify-1001',
      flow: 'edge_pbx',
      sourceKey: 'primary',
      fromDate: days[0]?.date ?? tenantDay(tenantMs(14, 12)),
      toDate: days[days.length - 1]?.date ?? tenantDay(tenantMs(8, 12)),
      status: 'completed',
      daysTotal: days.length,
      daysCompleted: days.length,
      daysWithMismatch: days.filter((d) => d.status === 'mismatch').length,
      daysFailed: 0,
      sourceCount: sum((d) => d.sourceCount),
      destCount: sum((d) => d.destCount),
      presentOnBoth: sum((d) => d.presentOnBoth),
      missingFromDest: sum((d) => d.missingFromDest.length),
      missingFromSource: sum((d) => d.missingFromSource.length),
      cancelRequested: false,
      backfillRunId: null,
      startedAt: iso(startedAt),
      completedAt: iso(startedAt + duration),
      days,
    },
  ]
}

export const verifyRuns: VerifyRun[] = buildVerifyRuns()

/** For the archive group's BackupOverview. */
export const BACKUP_SCHEDULE = 'daily 02:00'
export const BACKUP_RETRY_DAYS = 3
