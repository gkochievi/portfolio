/**
 * Dareke - shared entity types. This file is the data contract between the
 * mock backend (`src/demo`) and the UI: feature-only types go in
 * `src/features/<id>/types.ts`, shared shapes live here.
 *
 * Conventions
 * - Every timestamp is an ISO-8601 string (UTC), every duration is in seconds
 *   unless the field name says otherwise (`dialIntervalMs`).
 * - Seeded labels are bilingual `Localized` pairs; text a visitor types is
 *   stored as `{ en: value, ka: value }`. Render with `useLocalized()`.
 * - Phone numbers are stored E.164 (`+995500012345`) and formatted in the UI.
 */
import type { DemoAccount } from '@portfolio/demo-kit'

/* ------------------------------------------------------------------ basics */

export type Lang = 'en' | 'ka'

export interface Localized {
  en: string
  ka: string
}

/** Free-form text that may or may not be bilingual (CSV custom fields). */
export type LText = string | Localized

/**
 * The 7 swatches every status/disposition colour is picked from. Mapped to
 * classes by the design system (`src/lib/tone.ts`); never a raw hex.
 */
export type Tone = 'lime' | 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'ink'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------------------------------------------- users */

export type Role = 'super_admin' | 'admin' | 'supervisor' | 'operator'

export interface User {
  id: string
  username: string
  displayName: Localized
  email: string
  role: Role
  /** PJSIP extension; null shows a "No extension" warning where it matters. */
  sipExtension: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

export type UserSummary = Pick<User, 'id' | 'username' | 'displayName' | 'role' | 'sipExtension'>

/** A sign-in-able demo account (the DemoBar switcher and the login tiles). */
export interface DarekeAccount extends DemoAccount {
  role: Role
  /** The `User.id` this account signs in as. */
  userId: string
  /** Where `/` sends this role. */
  home: string
}

/* ----------------------------------------------------------- agent statuses */

export type AgentStatusType = 'working' | 'paused' | 'offline'

export interface AgentStatus {
  id: string
  /** Machine key: available | on_call | wrap_up | break | lunch | meeting | training | offline | custom_* */
  name: string
  displayName: Localized
  type: AgentStatusType
  /** 0 = no timeout. Paused statuses turn "overtime" after it. */
  timeoutSeconds: number
  /** When true and timeoutSeconds > 0, the agent returns to the default status on timeout. */
  autoReturn: boolean
  color: Tone
  sortOrder: number
  /** Cannot be deleted (API refuses with "Cannot delete default status"). */
  isDefault: boolean
  /** Set by the dialer itself (On call, Offline); not offered in the status dropdown. */
  isSystem: boolean
  isActive: boolean
}

/* ------------------------------------------------------------- dispositions */

export interface Disposition {
  id: string
  /** Upper-case code: SALE, INTERESTED, NOT_INTERESTED, DNC, WRONG_NUMBER, VOICEMAIL, NO_ANSWER, BUSY, CALLBACK_LATER */
  code: string
  name: Localized
  description: Localized | null
  /** The number will not be retried. */
  isFinal: boolean
  /** Requires a callback date; number becomes CALLBACK_SCHEDULED. */
  scheduleCallback: boolean
  /** Adds the number to the global DNC list (source DISPOSITION). */
  addToDnc: boolean
  color: Tone
  sortOrder: number
  isActive: boolean
}

/* ---------------------------------------------------------------- campaigns */

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type DialingMode = 'MANUAL' | 'AUTO' | 'PREDICTIVE'

/** One step of the call script shown in the operator's centre column. */
export interface ScriptStep {
  id: string
  title: Localized
  body: Localized
}

export interface Campaign {
  id: string
  name: Localized
  /** The fictional client the campaign runs for (Tsitsinatela Telecom, ...). */
  clientName: Localized
  description: Localized
  status: CampaignStatus
  dialingMode: DialingMode
  callerId: string
  /** PBX queue answered calls are placed in; null = "Not configured". */
  queueName: string | null
  /** 'HH:mm' local time. Shown, but relaxed (not enforced) in the demo. */
  workingHoursStart: string
  workingHoursEnd: string
  maxAttempts: number
  retryDelayMinutes: number
  /** AUTO pacing: target concurrent calls = floor(availableAgents x dialRatio). */
  dialRatio: number
  maxConcurrentCalls: number
  dialIntervalMs: number
  script: ScriptStep[]
  createdById: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface CampaignStats {
  totalNumbers: number
  /** Numbers with attempts > 0. */
  dialed: number
  /** Numbers that reached CONNECTED at least once (answered calls). */
  connected: number
  /** PENDING + due CALLBACK_SCHEDULED + retryable NO_ANSWER/BUSY. */
  pending: number
  completed: number
  failed: number
  dnc: number
  callbacks: number
  sales: number
  /** 0-100, dialed / total. */
  progress: number
  /** 0-100, connected / dialed. */
  answerRate: number
  /** 0-100, SALE / connected. */
  conversionRate: number
}

export interface CampaignWithStats extends Campaign {
  stats: CampaignStats
  agentCount: number
}

export interface CampaignAgent {
  campaignId: string
  agentId: string
  assignedAt: string
}

export type NumberStatus =
  | 'PENDING'
  | 'DIALING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'FAILED'
  | 'DNC'
  | 'CALLBACK_SCHEDULED'

/** A lead: one phone number in one campaign. */
export interface CampaignNumber {
  id: string
  campaignId: string
  /** E.164, synthetic block +995 500 0X XX XX. */
  phoneNumber: string
  customerName: Localized | null
  /** Whole CSV row (lower-cased keys) or seeded fields: city, plan, policyExpires... */
  customData: Record<string, LText>
  status: NumberStatus
  attempts: number
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  lastDispositionCode: string | null
  /** > 1 only for duplicates imported with "Allow duplicates". */
  instanceNumber: number
  createdAt: string
}

/* -------------------------------------------------------------------- calls */

export type HangupBy = 'AGENT' | 'CUSTOMER' | 'SYSTEM'
export type CallMode = 'MANUAL' | 'AUTO'
export type CallOutcome = 'IN_PROGRESS' | 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'ABANDONED'

export interface CallRecord {
  id: string
  campaignId: string
  campaignNumberId: string
  /** null for an AUTO call abandoned before an agent took it. */
  agentId: string | null
  callerId: string
  destinationNumber: string
  customerName: Localized | null
  mode: CallMode
  outcome: CallOutcome
  callInitiatedAt: string
  callAnsweredAt: string | null
  callEndedAt: string | null
  ringDuration: number
  talkDuration: number
  holdDuration: number
  totalDuration: number
  dispositionCode: string | null
  dispositionNote: string | null
  /** Q.850: 16 normal clearing, 17 busy, 19 no answer, 21 rejected, 34 congestion. */
  hangupCause: number | null
  hangupCauseText: string | null
  hangupBy: HangupBy | null
  /** Always null in the demo (no recordings shipped); the UI says so. */
  recordingUrl: string | null
  recordingDuration: number | null
  callbackScheduledAt: string | null
  callbackNote: string | null
}

/** A CallRecord joined with the names the tables show. */
export interface CallRecordView extends CallRecord {
  agentName: Localized | null
  campaignName: Localized
  dispositionName: Localized | null
  dispositionColor: Tone | null
}

/* ---------------------------------------------------------------------- DNC */

export type DncSource = 'MANUAL' | 'CUSTOMER_REQUEST' | 'DISPOSITION' | 'IMPORT'

export interface DncEntry {
  id: string
  phoneNumber: string
  reason: string
  source: DncSource
  addedById: string | null
  createdAt: string
}

export interface DncEntryView extends DncEntry {
  addedByName: Localized | null
}

/* ------------------------------------------------------------- agent state */

export type LiveCallPhase = 'ringing' | 'answered' | 'hold'

/** One row per operator; the single source for the wall and the workspace. */
export interface AgentCurrentState {
  agentId: string
  /** An AgentStatus id; the 'offline' status when signed out. */
  statusId: string
  stateSince: string
  currentCallId: string | null
  currentCampaignId: string | null
  callPhase: LiveCallPhase | null
}

/** The joined shape every screen renders (one shape, unlike the source's two). */
export interface AgentStateView {
  agent: UserSummary
  status: AgentStatus
  stateSince: string
  campaign: { id: string; name: Localized; dialingMode: DialingMode } | null
  currentCall: {
    id: string
    destinationNumber: string
    customerName: Localized | null
    initiatedAt: string
    answeredAt: string | null
    phase: LiveCallPhase
  } | null
}

export interface AgentStateLog {
  id: string
  agentId: string
  statusId: string
  previousStatusId: string | null
  startedAt: string
  endedAt: string | null
  campaignId: string | null
  callRecordId: string | null
}

/* -------------------------------------------------------------- call events */

export type CallEventType = 'ringing' | 'answered' | 'ended' | 'hold' | 'unhold' | 'no_answer' | 'busy' | 'abandoned'

/** The supervisor's live feed (rolling buffer of the last 50 in the store). */
export interface CallEvent {
  id: string
  callId: string
  agentId: string | null
  agentName: Localized | null
  phoneNumber: string
  customerName: Localized | null
  campaignId: string
  event: CallEventType
  cause: number | null
  causeText: string | null
  timestamp: string
}

/* ------------------------------------------------- settings and integrations */

export interface SystemSettings {
  dialer: {
    baseDialRatio: number
    maxDialRatio: number
    minDialRatio: number
    /** Percent. */
    targetAbandonRate: number
  }
  wrapup: {
    defaultWrapupTime: number
    maxWrapupTime: number
  }
  workingHours: {
    startTime: string
    endTime: string
    /** ISO weekday numbers, 1 = Monday ... 7 = Sunday. */
    workingDays: number[]
  }
}

export interface AppConfig {
  port: number
  host: string
  jwtExpiresIn: string
  corsOrigin: string
  recordingsPath: string
  dialerMockMode: boolean
}

export interface ClientConfig {
  apiUrl: string
  wsUrl: string
  webrtcEnabled: boolean
  sipWssUrl: string
  sipDomain: string
  /** One per line. */
  iceServers: string
  useMockData: boolean
}

/** Secrets are never returned: only whether one is set. Fake hosts only (*.demo.local). */
export interface PbxConfig {
  host: string
  port: number
  username: string
  secretSet: boolean
  trunk: string
  context: string
  enabled: boolean
}

export interface LdapConfig {
  url: string
  bindDn: string
  bindPasswordSet: boolean
  baseDn: string
  /** Contains `{{username}}`. */
  userSearchFilter: string
  enabled: boolean
}

export interface SystemConfig {
  app: AppConfig
  client: ClientConfig
  pbx: PbxConfig
  ldap: LdapConfig
  updatedAt: string
  updatedById: string | null
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  latencyMs: number | null
}

/* -------------------------------------------------------------- auto-dialer */

export interface AutoDialerCampaignState {
  campaignId: string
  isRunning: boolean
  availableAgents: number
  dialRatio: number
  /** floor(availableAgents x dialRatio). */
  target: number
  /** Numbers currently DIALING or CONNECTED. */
  inFlight: number
  maxConcurrentCalls: number
  dialIntervalMs: number
  consecutiveErrors: number
  /** Set after 5 consecutive errors: 30 s pause. */
  backoffUntil: string | null
  lastDialAt: string | null
  dialedThisSession: number
  /** Percent of AUTO calls today answered with no free agent. */
  abandonRate: number
}

export interface AutoDialerRuntime {
  /** Global engine switch (Start/Stop). */
  enabled: boolean
  campaigns: Record<string, AutoDialerCampaignState>
}

export interface AutoDialerOverview {
  enabled: boolean
  targetAbandonRate: number
  campaigns: Array<AutoDialerCampaignState & { campaignName: Localized; dialingMode: DialingMode; status: CampaignStatus }>
}

/* ------------------------------------------------------------ derived views */

export interface RealtimeMetrics {
  activeCalls: number
  agentsWorking: number
  agentsPaused: number
  agentsOnCall: number
  agentsOffline: number
  callsThisHour: number
  avgWaitSeconds: number
  dialedToday: number
  connectedToday: number
  /** Percent. */
  abandonRate: number
  updatedAt: string
}

export interface CampaignProgress extends CampaignStats {
  campaignId: string
}

export interface HourlyCallData {
  /** 0-23, local time. */
  hour: number
  /** 'HH:00'. */
  label: string
  dialed: number
  connected: number
}

export interface AgentPerformanceRow {
  agentId: string
  agentName: Localized
  callsHandled: number
  talkTime: number
  avgCallDuration: number
  sales: number
  callbacks: number
  notInterested: number
}

export interface DispositionBreakdown {
  code: string
  name: Localized
  color: Tone
  count: number
}

export interface CampaignReport {
  campaignId: string
  campaignName: Localized
  from: string
  to: string
  totalDialed: number
  answered: number
  answerRate: number
  conversionRate: number
  avgTalkTime: number
  breakdown: DispositionBreakdown[]
}

export interface AgentTodayKpis {
  calls: number
  answered: number
  avgDurationSeconds: number
  talkTimeSeconds: number
  /** Count of SALE today. */
  conversions: number
  /** 0-100, SALE / answered. */
  conversionRate: number
  /** The operator's last 3 distinct disposition codes, newest first. */
  recentDispositionCodes: string[]
}

export interface AdminDashboardData {
  totalCampaigns: number
  activeCampaigns: number
  totalUsers: number
  activeOperators: number
  callsToday: number
  recentCampaigns: CampaignWithStats[]
}

export interface ImportResult {
  inserted: number
  /** Already in the campaign (skipped). */
  skipped: number
  /** Added as extra instances because "Allow duplicates" was on. */
  duplicates: number
  /** Inserted with status DNC because the number is on the DNC list. */
  dncMarked: number
  invalid: number
}

export interface DncImportResult {
  imported: number
  duplicates: number
  invalid: number
}

/* ------------------------------------------------------ operator call engine */

export type OperatorCallPhase = 'requesting' | 'dialing' | 'ringing' | 'incoming' | 'answered' | 'ended'
export type OperatorEndReason = 'AGENT' | 'CUSTOMER' | 'NO_ANSWER' | 'BUSY' | 'REJECTED' | 'TRANSFERRED'

/** The signed-in operator's live call, owned by `src/demo/sim/operator.ts`. */
export interface OperatorCall {
  callId: string
  agentId: string
  campaignId: string
  numberId: string
  mode: CallMode
  phase: OperatorCallPhase
  destinationNumber: string
  customerName: Localized | null
  customData: Record<string, LText>
  initiatedAt: string
  answeredAt: string | null
  endedAt: string | null
  onHold: boolean
  holdSeconds: number
  endReason: OperatorEndReason | null
  /** Pre-selected disposition code after NO_ANSWER / BUSY. */
  suggestedDisposition: string | null
  /** True until the forced disposition is submitted. */
  awaitingDisposition: boolean
}

/** The AUTO dialer handing an answered customer to the signed-in operator. */
export interface DialerOffer {
  callId: string
  agentId: string
  campaignId: string
  numberId: string
}

/* ------------------------------------------------------------ the event bus */

/**
 * Query-cache scopes. Every query key starts with one of these, and
 * `data:changed` invalidates by scope.
 */
export type DataScope =
  | 'me'
  | 'agents'
  | 'calls'
  | 'campaigns'
  | 'numbers'
  | 'users'
  | 'statuses'
  | 'dispositions'
  | 'dnc'
  | 'settings'
  | 'config'
  | 'dialer'
  | 'metrics'
  | 'reports'

/** Collections that are mirrored to other open tabs (human actions only). */
export type SyncCollection = 'agentStates' | 'calls' | 'numbers' | 'dnc' | 'callEvents' | 'agentStateLogs'

export interface SyncPatch {
  collection: SyncCollection
  /** `id` of the record (`agentId` for agentStates). */
  key: string
  /** The full record to upsert, or null to delete. */
  record: unknown
}

export interface DemoEvents {
  /** A call changed phase (feed, wall tiles, hourly chart). */
  'call:event': CallEvent
  /** The signed-in operator's call changed (workspace UI). */
  'operator:call': { agentId: string; call: OperatorCall | null }
  /** AUTO dialer offers a connected customer to the signed-in operator. */
  'dialer:offer': DialerOffer
  /** An agent's status/call changed. */
  'agent:state': { agentId: string }
  /** Invalidate every query whose key starts with one of these scopes. */
  'data:changed': { scopes: DataScope[] }
  /** store.reset() happened: drop timers and local state. */
  'demo:reset': undefined
  /** Mirrored across tabs over BroadcastChannel; receivers upsert into their store. */
  'sync:patch': SyncPatch
}

/* ----------------------------------------------------------- the store root */

export interface DemoData {
  users: User[]
  agentStatuses: AgentStatus[]
  dispositions: Disposition[]
  campaigns: Campaign[]
  campaignAgents: CampaignAgent[]
  numbers: CampaignNumber[]
  calls: CallRecord[]
  dnc: DncEntry[]
  agentStates: AgentCurrentState[]
  agentStateLogs: AgentStateLog[]
  /** Newest first, capped at 50. */
  callEvents: CallEvent[]
  settings: SystemSettings
  systemConfig: SystemConfig
  autoDialer: AutoDialerRuntime
}
