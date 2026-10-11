/** Platform health: hourly self-tests, 24 h of host metrics, ping "voice lanes", connections. */
import type { ConnectionKey, ConnectionSection, HostMetricRow, PingRow, ServiceConfig, TestCategory, TestResult, TestRun } from '@/types'
import { ANCHOR_MS, DAY, HOUR, MINUTE, iso, rngFor, tenantParts } from './util'

const rng = rngFor(6)

/* ------------------------------------------------------------- self-test */

export interface TestDef {
  category: TestCategory
  testKey: string
  testName: string
  okMessage: string
  slow: [number, number]
}

/** The self-test catalogue (neutral keys). The health group reuses it for "Run tests now". */
export const TEST_CATALOGUE: TestDef[] = [
  { category: 'core', testKey: 'db', testName: 'Archive database', okMessage: 'Connected, 41 tables, replication lag 0 s', slow: [4, 30] },
  { category: 'core', testKey: 'cache', testName: 'Cache round-trip', okMessage: 'Write, read and expire OK', slow: [1, 8] },
  { category: 'core', testKey: 'orm', testName: 'Data access layer', okMessage: 'Query plan cache warm, 0 pending migrations', slow: [3, 20] },
  { category: 'core', testKey: 'secrets', testName: 'Secrets store', okMessage: '13 connection secrets readable', slow: [2, 12] },
  { category: 'core', testKey: 'runtime', testName: 'Runtime and clock', okMessage: 'Clock offset 4 ms against the time source', slow: [1, 6] },
  { category: 'core', testKey: 'schema', testName: 'Schema version', okMessage: 'Schema 2026.08.3 matches the application', slow: [2, 10] },
  { category: 'cron', testKey: 'core_sync_cron', testName: 'Core Cluster import schedule', okMessage: 'Next run 01:15, last run completed', slow: [2, 9] },
  { category: 'cron', testKey: 'recent_sync', testName: 'Recent import ran', okMessage: 'Last successful import under 26 h ago', slow: [3, 14] },
  { category: 'cron', testKey: 'drop_listener', testName: 'Drop-folder listener', okMessage: 'Listening, 0 files waiting', slow: [2, 10] },
  { category: 'cron', testKey: 'record_spool', testName: 'Record spool drained', okMessage: 'Spool empty', slow: [3, 15] },
  { category: 'filesystem', testKey: 'voice_archive_active', testName: 'Voice Archive share (active)', okMessage: 'Listed today\'s folder, read 1 file', slow: [40, 420] },
  { category: 'filesystem', testKey: 'voice_archive_backup', testName: 'File archive share (backup)', okMessage: 'Write and delete of a probe file OK', slow: [60, 700] },
  { category: 'filesystem', testKey: 'edge_archive_share', testName: 'Edge PBX archive share', okMessage: 'Write and delete of a probe file OK', slow: [70, 800] },
  { category: 'filesystem', testKey: 'edge_recordings', testName: 'Edge PBX recordings share', okMessage: 'Listed today\'s folder on both branches', slow: [90, 900] },
  { category: 'integration', testKey: 'directory', testName: 'Directory bind', okMessage: 'Bound as service account, 2 groups resolved', slow: [30, 260] },
  { category: 'integration', testKey: 'core_admin_api', testName: 'Core Cluster admin API', okMessage: 'Version query answered', slow: [120, 900] },
  { category: 'integration', testKey: 'core_shell', testName: 'Core Cluster shell access', okMessage: 'Login and status command OK', slow: [400, 1800] },
  { category: 'integration', testKey: 'edge_api', testName: 'Edge PBX API', okMessage: 'Token issued, extension list readable', slow: [90, 600] },
  { category: 'integration', testKey: 'core_record_push', testName: 'Core Cluster record push', okMessage: 'Last pushed file 4 min ago', slow: [20, 160] },
  { category: 'integration', testKey: 'record_mirror', testName: 'Reporting replica', okMessage: 'Not configured', slow: [1, 3] },
]

const DEGRADED_HOURS = new Set([6, 13])

function buildTestRuns(): TestRun[] {
  const runs: TestRun[] = []
  for (let h = 0; h < 30; h++) {
    const id = `test-${1030 - h}`
    // Hourly at :05 tenant time; the anchor is 15:30, so the latest is 15:05.
    const startedAt = ANCHOR_MS - 25 * MINUTE - h * HOUR + rng.int(0, 8) * 1000
    const degraded = DEGRADED_HOURS.has(h)
    const results: TestResult[] = TEST_CATALOGUE.map((t) => {
      let status: TestResult['status'] = 'passed'
      let message = t.okMessage
      let durationMs = rng.int(t.slow[0], t.slow[1])
      if (t.testKey === 'record_mirror') status = 'skipped'
      if (degraded && t.testKey === 'voice_archive_backup') {
        status = 'failed'
        message = 'Share \\\\nas-1.vake.bani.example\\voice-archive did not answer within 10 s'
        durationMs = 10_000
      }
      return { id: `${id}-${t.testKey}`, category: t.category, testKey: t.testKey, testName: t.testName, status, message, durationMs }
    })
    const failed = results.filter((r) => r.status === 'failed').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const durationMs = results.reduce((s, r) => s + r.durationMs, 0) + rng.int(200, 600)
    runs.push({
      id,
      status: failed ? 'degraded' : 'passed',
      triggeredBy: 'schedule',
      total: results.length,
      passed: results.length - failed - skipped,
      failed,
      skipped,
      durationMs,
      startedAt: iso(startedAt),
      completedAt: iso(startedAt + durationMs),
      results,
    })
  }
  return runs
}

export const testRuns: TestRun[] = buildTestRuns()

/* ---------------------------------------------------------- host metrics */

const GiB = 1024 ** 3
export const MEM_TOTAL = 32 * GiB
export const DISK_TOTAL = 2_000_398_934_016

/** Daytime CPU curve for the console host, by tenant hour (percent). */
function cpuBaseline(hour: number, minute: number): number {
  const h = hour + minute / 60
  if (h >= 2 && h < 2.5) return 38 // nightly backup
  if (h < 7 || h >= 22) return 9
  const day = 14 + 22 * Math.exp(-((h - 11.2) ** 2) / 6) + 20 * Math.exp(-((h - 15.4) ** 2) / 5)
  return h >= 19 ? 12 + (22 - h) * 3 : day
}

function buildHostMetrics(): HostMetricRow[] {
  const rows: HostMetricRow[] = []
  let cpuNoise = 0
  let memNoise = 0
  const diskStart = 0.708
  for (let i = 0; i < 1440; i++) {
    const start = ANCHOR_MS - (1440 - i) * MINUTE
    const end = start + MINUTE
    const { h, mi } = tenantParts(start)
    cpuNoise = cpuNoise * 0.85 + (rng.next() - 0.5) * 6
    memNoise = memNoise * 0.97 + (rng.next() - 0.5) * 0.006
    const cpu = Math.max(2, Math.min(96, cpuBaseline(h, mi) + cpuNoise))
    const memPct = 0.62 + memNoise + (cpu - 20) / 2000
    const backup = h === 2 && mi < 30
    const rx = (backup ? 38_000_000 : 220_000 + cpu * 48_000) * (0.8 + rng.next() * 0.4)
    const tx = (backup ? 41_000_000 : 140_000 + cpu * 36_000) * (0.8 + rng.next() * 0.4)
    const mem = memPct * MEM_TOTAL
    const diskUsed = diskStart + (i / 1440) * 0.003
    const load1 = (cpu / 100) * 8 * (0.9 + rng.next() * 0.25)
    rows.push({
      recordedAt: iso(end + 1_000),
      bucketStartAt: iso(start),
      bucketEndAt: iso(end),
      sampleCount: 12,
      cpuPctAvg: round1(cpu),
      cpuPctMax: round1(Math.min(100, cpu + 4 + rng.next() * 12)),
      cpuPctMin: round1(Math.max(0.5, cpu - 3 - rng.next() * 6)),
      memUsedBytesAvg: Math.round(mem),
      memUsedBytesMax: Math.round(mem + rng.int(40, 400) * 1024 ** 2),
      memUsedBytesMin: Math.round(mem - rng.int(40, 400) * 1024 ** 2),
      memTotalBytes: MEM_TOTAL,
      diskFreeBytes: Math.round(DISK_TOTAL * (1 - diskUsed)),
      diskTotalBytes: DISK_TOTAL,
      diskUsedPct: round1(diskUsed * 100),
      netRxBytesPerSecAvg: Math.round(rx),
      netRxBytesPerSecMax: Math.round(rx * (1.3 + rng.next() * 0.8)),
      netTxBytesPerSecAvg: Math.round(tx),
      netTxBytesPerSecMax: Math.round(tx * (1.3 + rng.next() * 0.8)),
      loadAvg1: round2(load1),
      loadAvg5: round2(load1 * 0.92),
      loadAvg15: round2(load1 * 0.85),
      processCount: 298 + Math.round(cpu / 3) + rng.int(0, 9),
    })
  }
  return rows
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const hostMetrics: HostMetricRow[] = buildHostMetrics()

/* ---------------------------------------------------------------- pings */

export const PING_TARGETS: { label: string; target: string; rtt: number }[] = [
  { label: 'Core Cluster', target: 'core-node-a.vake.bani.example', rtt: 0.62 },
  { label: 'Edge PBX', target: 'edge-pbx-1.kutaisi.bani.example', rtt: 9.4 },
  { label: 'Voice Archive', target: 'vault-1.vake.bani.example', rtt: 0.48 },
  { label: 'Directory', target: 'ad-vake-1.bani.example', rtt: 0.81 },
]

/** Edge PBX loss spike about five hours ago: [rows ago, loss %]. */
const EDGE_SPIKE = new Map([
  [58, 20],
  [59, 60],
  [60, 100],
  [61, 10],
])

function buildPings(): PingRow[] {
  const rows: PingRow[] = []
  for (let i = 287; i >= 0; i--) {
    const at = ANCHOR_MS - i * 5 * MINUTE - 20_000
    for (const t of PING_TARGETS) {
      const loss = t.label === 'Edge PBX' ? (EDGE_SPIKE.get(i) ?? 0) : 0
      const sent = 10
      const received = Math.round(sent * (1 - loss / 100))
      const jitter = t.rtt * (0.15 + rng.next() * 0.35)
      const avg = t.rtt * (0.9 + rng.next() * 0.25) + (loss > 0 && loss < 100 ? t.rtt * 2.5 : 0)
      rows.push({
        recordedAt: iso(at),
        label: t.label,
        target: t.target,
        packetsSent: sent,
        packetsReceived: received,
        packetLossPct: loss,
        rttAvgMs: received ? round2(avg) : null,
        rttMinMs: received ? round2(Math.max(0.05, avg - jitter)) : null,
        rttMaxMs: received ? round2(avg + jitter * 2.2) : null,
        rttMdevMs: received ? round2(jitter / 2) : null,
        reachable: received > 0,
        error: received ? null : '100% packet loss (10 sent, 0 received)',
      })
    }
  }
  return rows
}

export const pings: PingRow[] = buildPings()

/* ----------------------------------------------------------- connections */

const conn = (
  key: ConnectionKey,
  section: ConnectionSection,
  value: ServiceConfig['value'],
  daysAgo: number,
  enabled = true,
  configured = true,
): ServiceConfig => ({ key, section, enabled, configured, value, updatedAt: iso(ANCHOR_MS - daysAgo * DAY - 3 * HOUR) })

/** Dummy secrets only: every value here is fictional. */
export const connections: ServiceConfig[] = [
  conn('directory', 'core', {
    url: 'ldaps://ad-vake-1.bani.example:636',
    baseDn: 'DC=bani,DC=example',
    bindDn: 'CN=svc-bani-bind,OU=Service Accounts,DC=bani,DC=example',
    bindPassword: 'demo-bind-secret',
    userFilter: '(sAMAccountName={username})',
    groupSearchBase: 'OU=Groups,DC=bani,DC=example',
  }, 64),
  conn('core_admin_api', 'core', {
    host: 'core-node-a.vake.bani.example',
    port: 8443,
    username: 'bani-api',
    password: 'demo-core-secret',
    verifyTls: true,
  }, 120),
  conn('edge_api', 'core', {
    baseUrl: 'https://edge-pbx-1.kutaisi.bani.example/api',
    clientId: 'bani-console',
    clientSecret: 'demo-edge-secret',
    timeoutSec: 15,
  }, 41),
  conn('transfer_detection', 'core', {
    operatorDevicePattern: '^Agent',
    mergeWindowMinutes: 60,
    huntPilots: '2000,2001,2010,2020,2030,2040',
  }, 12),
  conn('voice_archive', 'recordings', {
    host: 'vault-1.vake.bani.example',
    share: 'recordings',
    username: 'svc-archive',
    password: 'demo-vault-secret',
    format: 'opus',
  }, 210),
  conn('edge_recordings_a', 'recordings', {
    host: 'edge-pbx-1.kutaisi.bani.example',
    path: '/recordings',
    username: 'svc-recordings',
    password: 'demo-kutaisi-secret',
    format: 'wav',
  }, 88),
  conn('edge_recordings_b', 'recordings', {
    host: 'edge-pbx-2.batumi.bani.example',
    path: '/recordings',
    username: 'svc-recordings',
    password: 'demo-batumi-secret',
    format: 'wav',
  }, 88),
  conn('backup_target_a', 'recordings', {
    share: '\\\\nas-1.vake.bani.example\\voice-archive',
    username: 'svc-backup',
    password: 'demo-nas1-secret',
    retentionDays: 2555,
  }, 150),
  conn('backup_target_b', 'recordings', {
    share: '\\\\nas-2.rustavi.bani.example\\edge-primary',
    username: 'svc-backup',
    password: 'demo-nas2-secret',
    retentionDays: 1825,
  }, 150),
  conn('backup_schedule', 'recordings', {
    cron: '0 2 * * *',
    timeZone: 'Asia/Tbilisi',
    retryDays: 3,
    parallelCopies: 4,
  }, 30),
  conn('extension_provisioning', 'extensions', {
    rangeFrom: '5000',
    rangeTo: '5999',
    reserved: '5000,5100,5111,5200,5555,5999',
    lockMinutes: 10,
    defaultContext: 'internal',
  }, 75),
  conn('contact_centre', 'contact_centre', {
    baseUrl: 'https://cc-node-a.vake.bani.example:8445/admin',
    username: 'bani-cc-admin',
    password: 'demo-cc-secret',
    snmpCommunity: 'demo-community',
    pollSeconds: 30,
  }, 52),
  conn('record_mirror', 'record_store', {
    host: '',
    port: 5432,
    database: 'reporting_replica',
    username: '',
    password: '',
  }, 300, false, false),
]
