/**
 * Bani: shared entity contract.
 *
 * Every agent builds against these types. Rules that keep the mock honest:
 * - Timestamps are ISO strings, never Date objects (requests and responses are
 *   structured-cloned like a wire would).
 * - Every stored timestamp key ends in `At`, `Date`, `date`, `time` or `Time`, which is
 *   what demo-kit's `rebaseDates` shifts on load and on reset.
 * - Platform vocabulary is neutral: `core` = Core Cluster, `edge` = Edge PBX.
 */
import type { DemoAccount } from '@portfolio/demo-kit'

/* ------------------------------------------------------------------ basics */

export type Lang = 'en' | 'ka'
/** e.g. '2026-09-02T11:30:00.000Z' */
export type ISODateTime = string
/** e.g. '2026-09-02' (tenant calendar day) */
export type ISODate = string

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type JobStatus = 'running' | 'completed' | 'failed' | 'canceled'

/* ------------------------------------------------------- roles and access */

export type RoleId =
  | 'superadmin'
  | 'admin'
  | 'cc-admin'
  | 'tel-admin'
  | 'cc-operator'
  | 'tel-operator'
  | 'it-support'
  | 'user'

/** Roles that appear as columns in the permission matrix (superadmin never does). */
export type RbacRole = Exclude<RoleId, 'superadmin'>

/** A console user's role; api_service accounts have no UI. */
export type UserRole = RoleId | 'api_service'

export type FeatureKey =
  | 'cdr'
  | 'cc_campaigns'
  | 'cc_agents'
  | 'cc_nodes'
  | 'extensions'
  | 'systems_sync'
  | 'logs'
  | 'health'
  | 'settings'
  | 'users'
  | 'rbac'

export type RbacOverrides = Partial<Record<RbacRole, Partial<Record<FeatureKey, boolean>>>>

/** One-click demo persona. `id` is the username. */
export interface Persona extends DemoAccount {
  id: string
  username: string
  role: RoleId
  /** Georgian spelling for the chrome when the UI is in ka. */
  nameKa: string
}

export interface Tenant {
  name: string
  nameKa: string
  timeZone: 'Asia/Tbilisi'
  domain: string
}

export interface MeResponse {
  persona: Omit<Persona, 'password'>
  role: RoleId
  features: FeatureKey[]
  cdrSources: CdrSource[]
  /** cc-admin campaign scoping; null = every campaign. */
  allowedCampaigns: string[] | null
  tenant: Tenant
}

export interface LoginRequest {
  username: string
  password: string
}

/* ------------------------------------------------------------------- calls */

export type CdrSource = 'core' | 'edge'
export type CdrSourceFilter = CdrSource | 'both'
export type CallStatus = 'completed' | 'no_answer' | 'busy' | 'failed' | 'unknown'
export type TransferReason =
  | 'transfer'
  | 'blindTransfer'
  | 'attendedTransfer'
  | 'forward'
  | 'conference'
  | 'redirect'

export interface TransferHop {
  from: string
  fromPartition?: string
  to: string
  toPartition?: string
  reason: TransferReason
}

export interface TransferInfo {
  wasTransferred: boolean
  transferCount: number
  transferFrom?: string
  transferTo?: string
  reason?: TransferReason
  /** Ordered party path, e.g. ['0322004417', '2000', '2104', '2190']. */
  chain: string[]
  hops: TransferHop[]
}

/**
 * One raw Core Cluster call leg (enterprise call manager detail record,
 * generic field names). Legs of one call share `callId` (and leg ids).
 */
export interface CoreLeg {
  id: string
  clusterNodeId: number
  callId: number
  origLegId: number
  destLegId: number
  originatedAt: ISODateTime
  connectedAt: ISODateTime | null
  disconnectedAt: ISODateTime
  callingNumber: string
  callingPartition: string
  originalCalledNumber: string
  originalCalledPartition: string
  finalCalledNumber: string
  finalCalledPartition: string
  lastRedirectNumber: string
  /** Redirect reason code (0 none, 2 forward busy, 15 forward no answer, 98 conference, …). */
  lastRedirectReason: number
  /** 4 = transfer, 10 = redirect via hunt, 0 = none. */
  lastRedirectOnBehalfOf: number
  origDevice: string
  destDevice: string
  origCause: number
  /** 16 normal clearing, 17 busy, 19 no answer, 393216 = leg ended by a transfer. */
  destCause: number
  huntPilot: string
  durationSec: number
  accountCode: string
  /** Demo flag: the Voice Archive holds audio for this leg. */
  hasRecording: boolean
}

/** One raw Edge PBX call leg (open-source PBX detail-record columns). */
export interface EdgeLeg {
  id: string
  calldate: ISODateTime
  clid: string
  src: string
  dst: string
  dcontext: string
  /** e.g. 'SIP/5104-0000a1b2' */
  channel: string
  dstchannel: string
  /** 'Dial' | 'Queue' | 'Transfer' | 'BlindTransfer' | 'AttendedTransfer' | 'ConfBridge' | 'Hangup' */
  lastapp: string
  lastdata: string
  duration: number
  billsec: number
  disposition: 'ANSWERED' | 'NO ANSWER' | 'BUSY' | 'FAILED'
  accountcode: string
  uniqueid: string
  userfield: string
  did: string
  /** Recording filename, '' when none. */
  recordingfile: string
  cnum: string
  /** Shared by every leg of one logical call. */
  linkedid: string
  /** Orders legs within a linkedid. */
  sequence: number
  /** Channel that drove the hangup, 'dialplan/…', or '' when not yet backfilled. */
  hangupsource: string
  hasRecording: boolean
}

/** One searchable call row (a leg, or a merged call when segmentCount > 1). Derived, never stored. */
export interface UnifiedCdr {
  id: string
  timestamp: ISODateTime
  source: CdrSource
  callerNumber: string
  calledNumber: string
  finalNumber?: string
  /** Seconds; wall-clock across legs for merged calls. */
  duration: number
  billableSeconds: number
  status: CallStatus
  disposition: string
  originatingDevice?: string
  terminatingDevice?: string
  accountCode?: string
  context?: string
  hangupBy?: string
  rawData: CoreLeg | EdgeLeg
  transfer?: TransferInfo
  segmentCount?: number
  segments?: UnifiedCdr[]
  agentTalkSeconds?: number
  searchBlob?: string
  hasRecording: boolean
}

export interface CdrSearchRequest {
  /** Partial number; matches caller OR called. Empty = all. */
  number?: string
  /** Recording filename; when set number and dates are ignored. */
  recordingFile?: string
  dateFrom: ISODateTime
  dateTo: ISODateTime
  source: CdrSourceFilter
}

export interface CdrSourceInfo {
  count: number
  available: boolean
  error?: string
}

export interface CdrSearchResponse {
  results: UnifiedCdr[]
  total: number
  warnings: string[]
  sources: Record<CdrSource, CdrSourceInfo>
  /** After role clamping. */
  searchedSource: CdrSourceFilter
  elapsedMs: number
}

/* -------------------------------------------------------------- recordings */

export type RecordingFormat = 'opus' | 'wav' | 'mp3' | 'gsm'
export type RecordingSourceKind = 'voice_archive' | 'voice_archive_backup' | 'edge_primary' | 'edge_backup'

/** A bundled synthetic audio file the recordings point at. */
export interface RecordingAsset {
  id: 'rec-a' | 'rec-b' | 'rec-c'
  /** BASE_URL-relative, e.g. 'media/recordings/rec-a.mp3'. */
  path: string
  durationSec: number
  sizeBytes: number
  /** 64 normalised peaks (0..1) for the waveform; precomputed, never decoded at runtime. */
  peaks: number[]
}

export interface RecordingResult {
  id: string
  assetId: RecordingAsset['id']
  source: RecordingSourceKind
  sourceLabel: string
  /** Path inside the source share, shown as a caption. */
  path: string
  format: RecordingFormat
  confidence: 'exact' | 'fuzzy'
  /** BASE_URL-relative; the UI prefixes import.meta.env.BASE_URL. */
  streamUrl: string
  fileSizeBytes: number
  durationSec: number
  peaks: number[]
}

export interface RecordingLookupRequest {
  callId: string
  source: CdrSource
}

export interface RecordingLookupResponse {
  found: boolean
  recordings: RecordingResult[]
  reason?: string
  searchTimeMs: number
}

export interface RecordingBundleRequest {
  callIds: string[]
  format: 'original' | 'mp3'
}

export interface RecordingBundleResponse {
  included: { callId: string; recordingId: string; assetId: RecordingAsset['id']; fileName: string }[]
  skipped: { callId: string; reason: string }[]
}

/* ----------------------------------------------------------------- archive */

export type SyncType = 'local' | 'scheduled' | 'reconcile' | 'full'

export interface SyncRun {
  id: string
  status: JobStatus
  syncType: SyncType
  triggeredBy: string
  fromDate: ISODate | null
  toDate: ISODate | null
  filesFound: number
  filesSkipped: number
  filesProcessed: number
  recordsImported: number
  gapFilesFound: number
  gapFilesFilled: number
  errors: string[]
  durationMs: number | null
  startedAt: ISODateTime
  completedAt: ISODateTime | null
}

export interface SyncRunsResponse extends Paged<SyncRun> {
  summary: { totalRuns: number; recordsImported: number; lastSuccessAt: ISODateTime | null }
}

export interface CoreImportStatus {
  available: boolean
  totalRecords: number
  totalFiles: number
  oldestRecordAt: ISODateTime | null
  newestRecordAt: ISODateTime | null
  localFilesAvailable: number
  lastSync: {
    id: string
    status: JobStatus
    completedAt: ISODateTime | null
    filesProcessed: number
    recordsImported: number
  } | null
  isRunning: boolean
  cronRunning: boolean
  dropListenerRunning: boolean
}

export interface MirrorCheckResult {
  fromDate: ISODate
  toDate: ISODate
  total: number
  distinct: number
  duplicates: number
  mirror: number
  missing: number
  checkedAt: ISODateTime
}

export interface EdgeMirrorStatus {
  enabled: boolean
  configured: boolean
  syncIntervalMinutes: number
  totalRecords: number
  oldestRecordAt: ISODateTime | null
  newestRecordAt: ISODateTime | null
  lastCheck: MirrorCheckResult | null
  isRunning: boolean
}

export interface MirrorSyncRun {
  id: string
  status: JobStatus
  trigger: 'interval' | 'manual' | 'reconcile'
  fromDate: ISODate | null
  toDate: ISODate | null
  fetched: number
  inserted: number
  durationMs: number | null
  error: string | null
  startedAt: ISODateTime
  completedAt: ISODateTime | null
}

export interface HangupBackfillStatus {
  eventTablePresent: boolean
  carriesHangupSource: boolean
  rowsWithHangupBy: number
  notYetChecked: number
  running: boolean
  lastResult: {
    fromDate: ISODate
    toDate: ISODate
    scanned: number
    filled: number
    noSource: number
    completedAt: ISODateTime
  } | null
}

export type BackupFlow = 'voice_archive' | 'edge_pbx'
export type BackupSourceKey = 'primary' | 'secondary' | null

export interface BackupRun {
  id: string
  flow: BackupFlow
  sourceKey: BackupSourceKey
  status: JobStatus
  /** 'cron' | 'manual:<username>' | 'verify:<verifyRunId>' */
  triggeredBy: string
  fromDate: ISODate
  toDate: ISODate
  filesListed: number
  filesCopied: number
  filesSkipped: number
  filesFailed: number
  bytesCopied: number
  errors: string[]
  durationMs: number | null
  cancelRequested: boolean
  startedAt: ISODateTime
  completedAt: ISODateTime | null
}

export interface FlowSummary {
  flow: BackupFlow
  sourceKey: BackupSourceKey
  lastRunId: string | null
  openGaps: number
  backedUpTotal: number
  bytesTotal: number
  cronEnabled: boolean
}

export interface BackupOverview {
  flows: (FlowSummary & { lastRun: BackupRun | null })[]
  /** e.g. 'daily 02:00' */
  schedule: string
  retryDays: number
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEvent {
  id: string
  runId: string | null
  flow: BackupFlow
  level: LogLevel
  /** e.g. 'file_copied', 'file_skipped', 'run_started', 'share_timeout' */
  event: string
  /** e.g. '2026/09/01' */
  dateDir: string
  relativePath: string
  sizeBytes: number | null
  durationMs: number | null
  message: string
  createdAt: ISODateTime
}

export interface MissingFile {
  name: string
  rawRelativePath: string
  sourceSizeBytes: number
}

/** Seeded per-day archive inventory that verify runs are computed from. */
export interface ArchiveDayInventory {
  flow: BackupFlow
  sourceKey: BackupSourceKey
  date: ISODate
  sourceCount: number
  destCount: number
  missingFromDest: MissingFile[]
  missingFromSource: MissingFile[]
}

export interface VerifyDayRow {
  date: ISODate
  sourcePath: string
  destPath: string
  sourceCount: number
  destCount: number
  presentOnBoth: number
  missingFromDest: MissingFile[]
  missingFromSource: MissingFile[]
  durationMs: number | null
  error: string | null
  status: 'pending' | 'ok' | 'mismatch' | 'failed'
}

export interface VerifyRun {
  id: string
  flow: BackupFlow
  sourceKey: BackupSourceKey
  fromDate: ISODate
  toDate: ISODate
  status: JobStatus
  daysTotal: number
  daysCompleted: number
  daysWithMismatch: number
  daysFailed: number
  sourceCount: number
  destCount: number
  presentOnBoth: number
  missingFromDest: number
  missingFromSource: number
  cancelRequested: boolean
  backfillRunId: string | null
  startedAt: ISODateTime
  completedAt: ISODateTime | null
  days: VerifyDayRow[]
}

/* ---------------------------------------------------------- contact centre */

export interface Team {
  id: string
  name: string
}

export interface Skill {
  id: string
  name: string
}

export interface SkillWithCount extends Skill {
  assignedCount: number
}

export interface Agent {
  /** Login id, e.g. 'tbakradze' */
  userId: string
  firstName: string
  lastName: string
  extension: string
  isSupervisor: boolean
  teamId: string
  /** skillId → competency 1-10 */
  skillLevels: Record<string, number>
}

export interface AgentUpdate {
  teamId: string
  skillLevels: Record<string, number>
}

export interface RosterChange {
  userId: string
  /** 1-10 to assign or change; null to unassign. */
  level: number | null
}

export interface RosterApplyResult {
  assigned: number
  unassigned: number
  levelChanged: number
  unchanged: number
  failed: { userId: string; name: string; reason: string }[]
}

export type CampaignType = 'ivrProgressive' | 'agentProgressive' | 'ivrPredictive' | 'agentPredictive' | 'preview'

export interface Campaign {
  id: string
  name: string
  enabled: boolean
  type: CampaignType
  /** Only meaningful for progressive / predictive types. */
  numDedicatedPorts: number
  /** 1.0-3.0, step 0.1; progressive / predictive only. */
  linesPerPort: number
  maxDialAttempts: 1 | 2 | 3
  timeZone: string
  updatedAt: ISODateTime
}

export interface CampaignUpdate {
  enabled?: boolean
  numDedicatedPorts?: number
  linesPerPort?: number
  maxDialAttempts?: 1 | 2 | 3
}

export interface CampaignSettings {
  isSuperAdmin: boolean
  maxDedicatedPortsNonSuperAdmin: number
}

export type CcActivityAction =
  | 'campaign_change'
  | 'campaign_view'
  | 'campaign_error'
  | 'skills_update'
  | 'skills_bulk_update'
  | 'skills_error'
  | 'dedicated_ports_above_limit'

export interface CcActivity {
  id: string
  username: string
  action: CcActivityAction
  details: string
  createdAt: ISODateTime
}

export interface CcNode {
  id: string
  label: string
  host: string
  sysName: string
  status: 'up' | 'down'
  error: string | null
  cpuPct: number | null
  memory: { totalMB: number; availableMB: number; usedPct: number } | null
  uptimeSeconds: number | null
  updatedAt: ISODateTime
}

/* -------------------------------------------------------------- extensions */

export interface Extension {
  /** Same as `number`. */
  id: string
  number: string
  name: string
  email: string
  /** Obviously fake, `word-####`. */
  secret: string
  createdBy: string
  createdAt: ISODateTime
}

export interface ExtensionLock {
  id: string
  extension: string
  username: string
  createdAt: ISODateTime
  expiresAt: ISODateTime
}

export type ExtensionAction = 'create_start' | 'create_finish' | 'create_abort' | 'create_error' | 'purge_logs' | 'disconnect'

export interface ExtensionActivity {
  id: string
  username: string
  action: ExtensionAction
  details: string
  createdAt: ISODateTime
}

export interface NextExtensionResponse {
  next: string
  reserved: string[]
  range: { from: string; to: string }
}

export interface CreateExtensionRequest {
  email: string
  /** Display name is derived from the email's local part when omitted. */
  name?: string
  secret: string
}

/* ------------------------------------------------------- platform / health */

export type TestCategory = 'core' | 'cron' | 'filesystem' | 'integration'
export type TestStatus = 'passed' | 'failed' | 'skipped'

export interface TestResult {
  id: string
  category: TestCategory
  /** Neutral key, e.g. 'voice_archive_backup' (see PLAN 9b). */
  testKey: string
  testName: string
  status: TestStatus
  message: string
  durationMs: number
}

export interface TestRun {
  id: string
  status: 'passed' | 'degraded' | 'failed'
  /** 'schedule' or a username */
  triggeredBy: string
  total: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
  startedAt: ISODateTime
  completedAt: ISODateTime
  results: TestResult[]
}

export interface SelfTestOverview {
  latest: TestRun | null
  history: Paged<TestRun>
  collectorRunning: boolean
  nextRunAt: ISODateTime
}

export interface HostMetricRow {
  recordedAt: ISODateTime
  bucketStartAt: ISODateTime
  bucketEndAt: ISODateTime
  sampleCount: number
  cpuPctAvg: number
  cpuPctMax: number
  cpuPctMin: number
  memUsedBytesAvg: number
  memUsedBytesMax: number
  memUsedBytesMin: number
  memTotalBytes: number
  diskFreeBytes: number
  diskTotalBytes: number
  diskUsedPct: number
  netRxBytesPerSecAvg: number
  netRxBytesPerSecMax: number
  netTxBytesPerSecAvg: number
  netTxBytesPerSecMax: number
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
  processCount: number
}

export interface HostLiveSample {
  sampledAt: ISODateTime
  cpuPct: number
  memUsedBytes: number
  memTotalBytes: number
  diskFreeBytes: number
  diskTotalBytes: number
  netRxBytesPerSec: number
  netTxBytesPerSec: number
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
  processCount: number
  uptimeSeconds: number
  collectorRunning: boolean
}

export interface PingRow {
  recordedAt: ISODateTime
  /** 'Core Cluster' | 'Edge PBX' | 'Voice Archive' | 'Directory' */
  label: string
  target: string
  packetsSent: number
  packetsReceived: number
  packetLossPct: number
  rttAvgMs: number | null
  rttMinMs: number | null
  rttMaxMs: number | null
  rttMdevMs: number | null
  reachable: boolean
  error: string | null
}

export interface HealthSnapshot {
  requestedAt: ISODateTime
  windowSec: number
  metrics: HostMetricRow | null
  pings: PingRow[]
}

/* ------------------------------------------------------------------ people */

export type UserType = 'ldap' | 'internal' | 'api_service'

export interface ConsoleUser {
  id: string
  username: string
  email: string | null
  displayName: string | null
  role: UserRole
  userType: UserType
  isActive: boolean
  accessMode: 'direct' | 'group'
  description: string
  /** Default format for API recording downloads. */
  downloadFormat: 'mp3' | 'original'
  /** Campaign ids a cc-admin may manage; [] = all. */
  allowedCampaigns: string[]
  lastLoginAt: ISODateTime | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface CreateUserRequest {
  userType: UserType
  role: UserRole
  username: string
  displayName?: string
  email?: string
  /** internal / api_service only; omitted = generate. */
  password?: string
  accessMode?: 'direct' | 'group'
  description?: string
  isActive?: boolean
  downloadFormat?: 'mp3' | 'original'
  allowedCampaigns?: string[]
}

export interface CreateUserResponse {
  user: ConsoleUser
  /** Present when the server generated the password; shown once. */
  generatedPassword?: string
}

export type UpdateUserRequest = Partial<Omit<CreateUserRequest, 'userType' | 'username'>>

export interface DirectoryEntry {
  username: string
  displayName: string
  email: string
  /** Derived from users at read time. */
  alreadyRegistered: boolean
}

export interface LdapRoleMapping {
  groupDn: string
  role: RoleId
}

export interface LdapRoleMappingConfig {
  mappings: LdapRoleMapping[]
  nestedGroups: boolean
}

/* ------------------------------------------------------------------ access */

export interface RbacMatrixResponse {
  roles: RbacRole[]
  features: { key: FeatureKey; overridable: boolean }[]
  defaults: Record<RbacRole, FeatureKey[]>
  overrides: RbacOverrides
  yourRole: RoleId
}

export type ConnectionKey =
  | 'directory'
  | 'edge_api'
  | 'core_admin_api'
  | 'voice_archive'
  | 'edge_recordings_a'
  | 'edge_recordings_b'
  | 'backup_target_a'
  | 'backup_target_b'
  | 'backup_schedule'
  | 'extension_provisioning'
  | 'contact_centre'
  | 'record_mirror'
  | 'transfer_detection'

export type ConnectionSection = 'core' | 'recordings' | 'extensions' | 'contact_centre' | 'record_store'

/** The literal the API returns in place of a stored secret; sending it back keeps the secret. */
export const UNCHANGED_SECRET = '__UNCHANGED__'

export interface ServiceConfig {
  key: ConnectionKey
  section: ConnectionSection
  enabled: boolean
  configured: boolean
  value: Record<string, string | number | boolean>
  updatedAt: ISODateTime
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  latencyMs: number
}

/* ------------------------------------------------------------- demo store */

export interface DemoDb {
  // people and access
  users: ConsoleUser[]
  directory: Omit<DirectoryEntry, 'alreadyRegistered'>[]
  ldapRoleMappings: LdapRoleMappingConfig
  rbacOverrides: RbacOverrides
  // calls
  coreLegs: CoreLeg[]
  edgeLegs: EdgeLeg[]
  recordingAssets: RecordingAsset[]
  // archive
  coreImport: CoreImportStatus
  syncRuns: SyncRun[]
  edgeMirror: EdgeMirrorStatus
  mirrorRuns: MirrorSyncRun[]
  hangupBackfill: HangupBackfillStatus
  backupRuns: BackupRun[]
  flowSummaries: FlowSummary[]
  backupEvents: LogEvent[]
  archiveInventory: ArchiveDayInventory[]
  verifyRuns: VerifyRun[]
  // contact centre
  teams: Team[]
  skills: Skill[]
  agents: Agent[]
  campaigns: Campaign[]
  campaignSettings: { maxDedicatedPortsNonSuperAdmin: number }
  ccActivity: CcActivity[]
  nodes: CcNode[]
  // extensions
  extensions: Extension[]
  reservedExtensions: string[]
  extensionLocks: ExtensionLock[]
  extensionActivity: ExtensionActivity[]
  // platform
  testRuns: TestRun[]
  hostMetrics: HostMetricRow[]
  pings: PingRow[]
  connections: ServiceConfig[]
}

/** Events on the in-browser bus (`bus` from '@/demo/core'). */
export interface DemoEvents {
  'demo:reset': undefined
  'session:changed': undefined
  'rbac:changed': undefined
  'users:changed': undefined
  'archive:changed': { kind: 'core-sync' | 'mirror' | 'hangup' | 'backup' | 'verify'; id?: string }
  'archive:event': LogEvent
  'health:sample': HostLiveSample
  'selftest:completed': TestRun
  'cc:activity': CcActivity
  'cc:nodes': CcNode[]
  'extensions:changed': undefined
  'extensions:activity': ExtensionActivity
}
