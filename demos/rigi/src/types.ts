/**
 * Rigi entity types: the shape of every record the in-browser mock stores.
 *
 * Money is a plain number in MAJOR units (12.50 = twelve and a half lari),
 * rounded to 2 decimals. Timestamps are ISO-8601 strings (`ISODateTime`);
 * calendar days are `YYYY-MM-DD` (`ISODate`). Ids are short prefixed strings
 * (`prt_zemo`, `tsk_41`), never real UUIDs.
 *
 * The support-work unit is the "point" (pts / ქულა).
 */

export type ID = string
export type ISODateTime = string
export type ISODate = string
export type Currency = 'GEL' | 'USD' | 'EUR'
export type Lang = 'en' | 'ka'

/* ------------------------------------------------------------------ people */

export type StaffRole = 'superadmin' | 'accountant' | 'l1_employee' | 'technician'
export type TechnicianType = 'webdeveloper' | 'voip_engineer' | 'both'
export type AccountRole = StaffRole | 'partner_admin'
/** The four staff route prefixes: /admin, /accountant, /l1, /technician. */
export type StaffArea = 'admin' | 'accountant' | 'l1' | 'technician'

export interface StaffUser {
  id: ID
  email: string
  fullName: string
  /** Georgian spelling of the name, shown when the UI is in ka. */
  fullNameKa: string
  role: StaffRole
  technicianType: TechnicianType | null
  isActive: boolean
  lastLoginAt: ISODateTime | null
  createdAt: ISODateTime
  deletedAt: ISODateTime | null
}

/* ---------------------------------------------------------------- partners */

export type Architecture = 'cloud' | 'hybrid' | 'onprem'
export type ContactRole = 'technical' | 'management' | 'financial' | 'legal'

export interface PartnerContact {
  role: ContactRole
  name: string
  phone: string
  email: string
}

export interface Partner {
  id: ID
  name: string
  /** Registered name, usually Georgian (e.g. `შპს ზემო სისტემსი`). */
  legalName: string
  /** 9-digit Georgian company id. */
  companyId: string
  city: string
  contactEmail: string
  /** Primary billing email (first of billingEmails). */
  billingEmail: string
  /** Up to 20. */
  billingEmails: string[]
  currency: Currency
  /** Price of one chargeable point, in the partner's currency. Default 20. */
  ratePerPoint: number
  /** Free points per calendar month. Default 10. */
  freeMonthlyAllowance: number
  isActive: boolean
  onboardedAt: ISODateTime
  contractStartOn: ISODate | null
  contractEndOn: ISODate | null
  /** Day of month (1-28) the daily autodraft job drafts this partner's invoice. */
  invoiceGenerationDay: number
  pbxServerIp: string
  webServerIp: string
  webServerDomain: string
  architecture: Architecture
  vpnType: string
  /** Up to 50. */
  phoneNumbers: string[]
  /** Exactly four slots, one per ContactRole. */
  contacts: PartnerContact[]
  notes: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  /** Soft delete: set together with isActive=false. */
  deletedAt: ISODateTime | null
}

export interface PartnerRateHistory {
  id: ID
  partnerId: ID
  ratePerPoint: number
  freeAllowance: number
  effectiveFrom: ISODate
  /** Null for the open (current) row. */
  effectiveTo: ISODate | null
  createdByName: string | null
  createdAt: ISODateTime
}

export type DocumentKind = 'contract' | 'technical'

export interface DocumentVersion {
  id: ID
  versionNo: number
  filename: string
  sizeBytes: number
  mimeType: string
  note: string
  createdAt: ISODateTime
  uploadedByName: string
  /** Bundled sample under public/, relative to BASE_URL (e.g. `samples/contract.pdf`). */
  sampleFile: string
}

export interface PartnerDocument {
  id: ID
  partnerId: ID
  kind: DocumentKind
  title: string
  createdAt: ISODateTime
  /** Ascending by versionNo; the last one is current. */
  versions: DocumentVersion[]
}

export type ApiKeyScope = 'user_count:write' | 'user_count:read'

export interface PartnerApiKey {
  id: ID
  partnerId: ID
  /** Public half, e.g. `demo_7F3K29QD`. The secret is never stored. */
  keyId: string
  label: string
  scopes: ApiKeyScope[]
  createdAt: ISODateTime
  createdByName: string | null
  lastUsedAt: ISODateTime | null
  revokedAt: ISODateTime | null
}

/** A partner-portal login (separate realm from staff). */
export interface PartnerAdmin {
  id: ID
  partnerId: ID
  username: string
  email: string | null
  fullName: string
  isActive: boolean
  lastLoginAt: ISODateTime | null
  createdAt: ISODateTime
}

/* ---------------------------------------------------------------- licenses */

export type LicenseKind = 'per_user' | 'addon'

export interface License {
  id: ID
  /** UPPER_SNAKE, immutable after create (e.g. AGENT_PRO). */
  code: string
  name: string
  kind: LicenseKind
  /** Catalog price per seat per month. Treated as the partner's currency unless overridden. */
  unitPrice: number
  currency: Currency
  isActive: boolean
  createdAt: ISODateTime
}

export interface PartnerLicenseOverride {
  partnerId: ID
  licenseId: ID
  unitPrice: number
}

export type SeatAllocationReason = 'cutover' | 'set' | 'split'

/** One batch of seats. The pool for a license = sum of open batches (effectiveTo null). */
export interface SeatAllocation {
  id: ID
  partnerId: ID
  licenseId: ID
  quantity: number
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
  note: string
  reason: SeatAllocationReason | null
  createdByName: string | null
  createdAt: ISODateTime
}

/** A call-centre user synced from the partner's own telephony system. */
export interface PartnerUser {
  id: ID
  partnerId: ID
  externalId: string
  username: string
  fullName: string
  /** Free text from the partner system: agent, supervisor, quality analyst, admin. */
  role: string
  email: string
  /** Free text status label from the partner system ("Available", "On break"). */
  status: string
  statusCode: number
  billingEnabled: boolean
  /** Null = unmapped ("Users without a license"). Never an addon license. */
  licenseId: ID | null
  isActive: boolean
  syncedAt: ISODateTime
  createdAt: ISODateTime
  deactivatedAt: ISODateTime | null
}

export type MembershipReason = 'created' | 'reactivated' | 'deleted' | 'disabled' | 'cutover'

/** Billable presence of a user on a license; drives subscription user-days. */
export interface MembershipPeriod {
  id: ID
  partnerId: ID
  partnerUserId: ID
  licenseId: ID | null
  startedOn: ISODate
  endedOn: ISODate | null
  reason: MembershipReason
}

export interface UserCountDaily {
  partnerId: ID
  day: ISODate
  userCount: number
}

/* ----------------------------------------------------------- task catalog */

export interface TaskTemplate {
  id: ID
  /** UPPER_SNAKE of the name, numeric suffix on collision, immutable. */
  code: string
  name: string
  /** Shown to partners in the catalogue. */
  description: string
  /** Null for the freeform "Other problem" template. */
  defaultPoints: number | null
  isFreeform: boolean
  isActive: boolean
  sortOrder: number
  archivedAt: ISODateTime | null
  createdAt: ISODateTime
}

/** Per-partner catalogue override; also the "partner price" rows on the template page. */
export interface PartnerTemplateOverride {
  id: ID
  templateId: ID
  partnerId: ID
  isHidden: boolean
  points: number | null
  nameOverride: string | null
  descriptionOverride: string | null
}

/* ------------------------------------------------------------------- tasks */

export type TaskState = 'accepted' | 'in_progress' | 'pending' | 'testing' | 'finished' | 'verified' | 'cancelled'

export interface Task {
  id: ID
  /** Display number, shown as TCK-1187. */
  number: number
  /** Null = Internal task. */
  partnerId: ID | null
  templateId: ID | null
  projectId: ID | null
  title: string
  description: string
  state: TaskState
  points: number | null
  /** Freeform tasks wait for staff to set points; cannot be finished while true. */
  pricingPending: boolean
  deadline: ISODateTime | null
  createdById: ID | null
  createdByPartnerAdminId: ID | null
  finishedAt: ISODateTime | null
  verifiedAt: ISODateTime | null
  /** A mail arrived on a linked thread since staff last opened the task. */
  hasNewReplies: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface TaskAssignee {
  taskId: ID
  userId: ID
  assignedById: ID | null
  assignedAt: ISODateTime
}

export interface TaskStateChange {
  id: ID
  taskId: ID
  /** Null for the creation row. */
  fromState: TaskState | null
  toState: TaskState
  /** Null = the partner (portal) made the move. */
  changedById: ID | null
  changedByName: string
  changedAt: ISODateTime
  note: string | null
}

export type MessageAuthorKind = 'internal' | 'partner'

export interface TaskMessage {
  id: ID
  taskId: ID
  authorKind: MessageAuthorKind
  authorId: ID | null
  authorName: string
  body: string
  /** Staff-only note; never returned by /portal endpoints. */
  internalOnly: boolean
  createdAt: ISODateTime
}

export interface TaskMailLink {
  taskId: ID
  mailId: ID
  linkedAt: ISODateTime
  linkedById: ID | null
}

export interface TaskThreadLink {
  taskId: ID
  threadId: ID
  linkedAt: ISODateTime
  linkedById: ID | null
}

/* ---------------------------------------------------------------- projects */

export type ProjectState = 'open' | 'completed' | 'cancelled'

export interface Project {
  id: ID
  number: number
  partnerId: ID
  name: string
  description: string
  state: ProjectState
  /** Fixed price in the partner's currency; null while pricing is pending. */
  price: number | null
  pricingPending: boolean
  priceAdjustNote: string | null
  requestedByPartner: boolean
  createdAt: ISODateTime
  completedAt: ISODateTime | null
  cancelledAt: ISODateTime | null
  billedInvoiceId: ID | null
}

/* ------------------------------------------------------------ point ledger */

export type PointTransactionKind = 'debit_free' | 'debit_chargeable' | 'adjustment_credit' | 'adjustment_debit'

export interface PointTransaction {
  id: ID
  partnerId: ID
  taskId: ID | null
  periodYear: number
  /** 1-12 */
  periodMonth: number
  points: number
  kind: PointTransactionKind
  /** Snapshot of the rate effective on day 1 of the period. */
  ratePerPoint: number
  /** points x rate for chargeable rows; 0 for free rows. */
  amount: number
  /** Set once an invoice has billed this row (points_overflow line). */
  invoiceLineItemId: ID | null
  createdByName: string | null
  note: string | null
  createdAt: ISODateTime
}

/* ---------------------------------------------------------------- invoices */

export type InvoiceKind = 'monthly' | 'adhoc'
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'
/** What the partner portal shows; derived, never stored. */
export type InvoiceDisplayStatus = 'pending' | 'overdue' | 'paid' | 'void' | 'disputed'

export interface Invoice {
  id: ID
  partnerId: ID
  /** INV-YYYY-MM-NNNNNN, a global per-period sequence. Null on drafts is NOT used: drafts get a number too. */
  invoiceNumber: string
  kind: InvoiceKind
  /** Ad-hoc subject (<=200); null for monthly. */
  title: string | null
  periodYear: number
  periodMonth: number
  status: InvoiceStatus
  currency: Currency
  subtotal: number
  tax: number
  total: number
  /** true: line prices already include VAT; false: VAT is added on top. */
  vatInclusive: boolean
  /** 0.18 (Georgian VAT). */
  vatRate: number
  notes: string
  issuedAt: ISODateTime | null
  dueAt: ISODateTime | null
  paidAt: ISODateTime | null
  voidedAt: ISODateTime | null
  voidReason: string | null
  disputedAt: ISODateTime | null
  disputeReason: string | null
  templateId: ID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type InvoiceLineKind = 'subscription' | 'points_overflow' | 'adhoc' | 'discount' | 'project'

export interface InvoiceLineMetadata {
  licenseCode?: string
  sumUserDays?: number
  daysInMonth?: number
  projectId?: ID
  points?: number
}

export interface InvoiceLineItem {
  id: ID
  invoiceId: ID
  kind: InvoiceLineKind
  description: string
  quantityNumerator: number
  quantityDenominator: number
  unitPrice: number
  amount: number
  sortOrder: number
  metadata: InvoiceLineMetadata
}

export type TemplateBlockType =
  | 'text'
  | 'image'
  | 'spacer'
  | 'divider'
  | 'page-number'
  | 'line-items'
  | 'tasks'
  | 'totals'
  | 'notes'

export interface TemplateBlock {
  id: ID
  type: TemplateBlockType
  /** Block-specific settings: text (may hold {{tokens}}), image data URL, height, align... */
  props: Record<string, string | number | boolean | null>
}

export type TemplateMode = 'blocks' | 'html'

export interface InvoiceTemplate {
  id: ID
  name: string
  /** Null = Global. */
  partnerId: ID | null
  mode: TemplateMode
  /** Mustache-style HTML; used when mode = 'html' and generated from blocks otherwise. */
  html: string
  css: string
  layout: TemplateBlock[]
  /** Signature image (PNG data URL) drawn on the 600x200 pad; null when none. */
  signatureDataUrl: string | null
  isDefault: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface OutboxEmail {
  id: ID
  invoiceId: ID
  to: string[]
  cc: string[]
  subject: string
  sentAt: ISODateTime
  sentByName: string
}

/* -------------------------------------------------------------------- mail */

export type MailStatus = 'new' | 'triaged' | 'task_created' | 'followup' | 'ignored'

export interface Mail {
  id: ID
  threadId: ID
  /** RFC 5322 Message-ID, e.g. `<a1b2@mail.zemo.example>`. */
  messageId: string
  subject: string
  fromAddr: string
  fromName: string
  toAddrs: string[]
  ccAddrs: string[]
  bodyText: string
  /** Static, sanitized HTML; rendered in a sandboxed iframe. */
  bodyHtml: string | null
  receivedAt: ISODateTime
  ingestedAt: ISODateTime
  status: MailStatus
  inReplyTo: string | null
  references: string[]
  attachmentIds: ID[]
  /** Matched from the sender's domain; null for unknown senders. */
  partnerId: ID | null
}

export interface MailThread {
  id: ID
  subject: string
  subjectNormalized: string
  participantAddrs: string[]
  firstMessageAt: ISODateTime
  lastMessageAt: ISODateTime
  messageCount: number
  /** Rolled up from its mails: followup > new > triaged > task_created > ignored. */
  status: MailStatus
  partnerId: ID | null
}

export interface Attachment {
  id: ID
  mailId: ID
  filename: string
  mimeType: string
  sizeBytes: number
  /** Bundled sample under public/, relative to BASE_URL (e.g. `samples/call-log.csv`). */
  sampleFile: string
}

/** A mail waiting on the fake IMAP server; "Poll now" / the poll job ingests these. */
export interface PendingMail extends Omit<Mail, 'threadId' | 'ingestedAt' | 'status'> {
  /** Seconds after load at which the timed injector may deliver it (null = only on Poll now). */
  deliverAfterSec: number | null
}

/* ---------------------------------------------------------------- ops */

export type AuditEntityType = 'task' | 'user' | 'invoice' | 'partner' | 'mail' | 'license' | 'settings' | 'template' | 'project'

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace'
  path: string
  value?: unknown
}

export interface ActivityLog {
  id: ID
  createdAt: ISODateTime
  actorUserId: ID
  actorName: string
  actorEmail: string
  actorRole: StaffRole
  actorIp: string
  /** e.g. task.transition, invoice.issue, partner.set_seats. */
  action: string
  entityType: AuditEntityType
  entityId: ID
  partnerId: ID | null
  before: unknown
  after: unknown
  diff: JsonPatchOp[]
  requestId: string
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface SystemLog {
  id: ID
  createdAt: ISODateTime
  level: LogLevel
  /** e.g. partner.user_sync.sync, partner.auth.token, jobs.run, http.exception. */
  source: string
  message: string
  partnerId: ID | null
  requestId: string | null
  context: Record<string, unknown> | null
  payload: unknown
}

export type HealthDependency = 'postgres' | 'jobqueue' | 'smtp' | 'imap' | 'attachments'
export type ServiceStatus = 'ok' | 'degraded' | 'down'

export interface HealthIncident {
  id: ID
  dependency: HealthDependency
  startedAt: ISODateTime
  endedAt: ISODateTime | null
  reason: string
}

export interface ServiceHealth {
  dependency: HealthDependency
  status: ServiceStatus
  latencyMs: number | null
  reason: string | null
  /** Rolling, newest last (max 60). */
  sparkline: number[]
  lastCheckedAt: ISODateTime
}

export interface HealthSnapshot {
  takenAt: ISODateTime
  services: ServiceHealth[]
  resources: {
    cpuLoad: [number, number, number]
    eventLoopP50Ms: number
    eventLoopP99Ms: number
    rssMb: number
    diskFreePct: number
    nodeVersion: string
    uptimeSec: number
    pid: number
  }
  backlog: {
    queuedJobs: number
    failedJobs24h: number
    staleSyncPartners: number
    errors15m: number
  }
}

export interface HealthHistoryPoint {
  bucketAt: ISODateTime
  avg: number
  min: number
  max: number
}

export interface BillingDetails {
  bankName: string
  accountHolder: string
  iban: string
  swift: string
  address: string
  notes: string
}

export interface SystemSettings {
  imap: { host: string; port: number; user: string; password: string; tls: boolean }
  smtp: { host: string; port: number; user: string; password: string; from: string; tls: boolean }
  appBaseUrl: string
  billing: BillingDetails
  retention: { healthDays: number; systemLogDays: number }
}

export type BackfillState = 'running' | 'completed' | 'cancelled' | 'failed'

export interface MailBackfillRun {
  id: ID
  state: BackfillState
  cancelRequested: boolean
  totalCount: number
  processedCount: number
  ingestedCount: number
  skippedCount: number
  errorCount: number
  lastError: string | null
  startedAt: ISODateTime
  finishedAt: ISODateTime | null
  startedByName: string
  limit: number | null
}

export type SchedulerJobName =
  | 'mail.imap.poll'
  | 'points.month.close'
  | 'invoices.generate.month'
  | 'invoices.autodraft.daily'
  | 'usercount.snapshot.daily'

export interface SchedulerRun {
  id: ID
  job: SchedulerJobName
  startedAt: ISODateTime
  finishedAt: ISODateTime
  ok: boolean
  /** Human summary, e.g. "4 mails ingested, 0 skipped". */
  summary: string
  triggeredByName: string
}

/* ---------------------------------------------------------- the whole store */

export interface DemoData {
  staffUsers: StaffUser[]
  partners: Partner[]
  partnerRates: PartnerRateHistory[]
  partnerDocuments: PartnerDocument[]
  apiKeys: PartnerApiKey[]
  partnerAdmins: PartnerAdmin[]
  licenses: License[]
  licenseOverrides: PartnerLicenseOverride[]
  seatAllocations: SeatAllocation[]
  partnerUsers: PartnerUser[]
  membershipPeriods: MembershipPeriod[]
  userCountDaily: UserCountDaily[]
  taskTemplates: TaskTemplate[]
  templateOverrides: PartnerTemplateOverride[]
  tasks: Task[]
  taskAssignees: TaskAssignee[]
  taskHistory: TaskStateChange[]
  taskMessages: TaskMessage[]
  taskMailLinks: TaskMailLink[]
  taskThreadLinks: TaskThreadLink[]
  projects: Project[]
  pointTransactions: PointTransaction[]
  invoices: Invoice[]
  invoiceLines: InvoiceLineItem[]
  invoiceTemplates: InvoiceTemplate[]
  outbox: OutboxEmail[]
  mails: Mail[]
  threads: MailThread[]
  pendingMails: PendingMail[]
  attachments: Attachment[]
  activityLog: ActivityLog[]
  systemLogs: SystemLog[]
  incidents: HealthIncident[]
  settings: SystemSettings
  backfillRuns: MailBackfillRun[]
  schedulerRuns: SchedulerRun[]
}

/* ------------------------------------------------------------ API helpers */

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
