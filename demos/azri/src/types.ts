/**
 * Azri domain types: the contract between the seed, the mock handlers and the UI.
 *
 * Shapes marked "wire" are what the mock API returns; everything else is the
 * in-memory store shape (`Seed`). Translatable seed copy is a `LocalizedText`;
 * handlers that serve the respondent microsite resolve it to a plain string
 * for the requested `lang`, exactly like the upstream CRM returned strings.
 *
 * Owner: architect. The seed agent may ADD fields; nobody removes or renames.
 */

/* ------------------------------------------------------------------ basics */

export type Lang = 'en' | 'ka'

/** Copy authored in both UI languages. */
export interface LocalizedText {
  en: string
  ka: string
}

/** ISO-8601 timestamp string (UTC). Seed timestamps are rebased to boot time. */
export type ISODate = string

/* --------------------------------------------------------------- accounts */

export type Role = 'admin' | 'agent' | 'respondent'

/** One-click demo account (extends demo-kit's `DemoAccount` structurally). */
export interface AzriAccount {
  id: string
  name: string
  nameKa: string
  email: string
  password: string
  role: Role
  roleLabel?: string
  description?: string
  avatarColor?: string
  /** Staff record this account is (agent only). */
  staffId: string | null
  /** Recipient persona this account is (respondent only). */
  recipientId: string | null
  /** Route the account lands on after sign-in / switch. */
  home: string
}

/* ------------------------------------------------------- white-label tenants */

export type TenantId = string
export type Industry = 'bank' | 'telecom' | 'auto' | 'clinic' | 'cafe'

/** A business that sends surveys through Azri. Its branding re-skins the microsite. */
export interface Tenant {
  id: TenantId
  name: LocalizedText
  /** Two-letter monogram drawn in the brand mark, e.g. "NB". */
  monogram: string
  industry: Industry
  /** Footer copyright holder, e.g. "Nergi Bank JSC". */
  copyrightName: string
  /** Alphanumeric SMS sender ID (max 11 chars), e.g. "NERGIBANK". */
  smsSender: string
  /** White-label primary (hex). Must give >= 4.5:1 with `onPrimary`. */
  primary: string
  /** Text/icon colour on `primary`. */
  onPrimary: string
  /** Light tint of the primary for chips and header bands (hex). */
  tint: string
  /** Primary to use on dark surfaces (hex). */
  primaryDark: string
}

/** The subset of a tenant the microsite needs to theme itself (wire). */
export type TenantBranding = Pick<
  Tenant,
  'id' | 'monogram' | 'copyrightName' | 'smsSender' | 'primary' | 'onPrimary' | 'tint' | 'primaryDark'
> & { name: string }

export interface Branch {
  id: string
  tenantId: TenantId
  name: LocalizedText
  city: LocalizedText
}

export interface Staff {
  id: string
  tenantId: TenantId
  branchId: string
  name: LocalizedText
  /** Job title, e.g. "Loan officer". */
  title: LocalizedText
  /** Demo account id when this staff member can sign in (Levan). */
  accountId: string | null
}

/* ----------------------------------------------------- campaigns & questions */

export interface Campaign {
  id: string
  tenantId: TenantId
  title: LocalizedText
  description: LocalizedText
  createdAt: ISODate
  /** Days a link stays valid after it is sent. */
  linkTtlDays: number
  /** The interaction the survey follows, shown on the intro, e.g. "Branch visit". */
  touchpoint: LocalizedText
}

/** Numeric ids in the upstream style (1101, 1102, ...). */
export interface Question {
  id: number
  campaignId: string
  order: number
  text: LocalizedText
}

/* ------------------------------------------------------ recipients & links */

/** An SMS recipient persona (demo-only; the source never knew who answered). */
export interface Recipient {
  id: string
  name: LocalizedText
  /** Always masked, e.g. "+995 5•• ••• 451". Never a full number. */
  phoneMasked: string
  avatarColor: string
}

export type LinkStatus = 'pending' | 'completed' | 'expired'

/** The one-time survey token (`?id=`). */
export interface SurveyLink {
  /** The `survey_id` token, e.g. "7KQ2M9". */
  id: string
  campaignId: string
  tenantId: TenantId
  branchId: string
  staffId: string
  /** Visible persona, or null for background (historical) recipients. */
  recipientId: string | null
  /** Masked phone for background recipients (persona links use the persona's). */
  phoneMasked: string
  /** When the interaction being rated happened. */
  interactionAt: ISODate
  sentAt: ISODate
  expiresAt: ISODate
  status: LinkStatus
  completedAt: ISODate | null
  responseId: string | null
  /** Who triggered the SMS: a staff id, or 'system' for CRM automations. */
  sentBy: string
}

/** Where an inbox SMS points. `unknown` = token not in the store, `missing` = no `?id` at all. */
export type SmsKind = 'survey' | 'unknown' | 'missing'

/** An SMS in a persona's inbox. */
export interface SmsMessage {
  id: string
  recipientId: string
  tenantId: TenantId
  sender: string
  /** Rendered SMS text including the short link, per language. */
  body: LocalizedText
  /** Short link as printed in the SMS, e.g. "azri.example/s/7KQ2M9". */
  shortLink: string
  /** In-app target, e.g. "/?id=7KQ2M9" or "/survey". */
  href: string
  /** Token the link carries (null for `missing`). */
  surveyId: string | null
  kind: SmsKind
  receivedAt: ISODate
}

/* --------------------------------------------------------------- responses */

export type ResponseSource = 'seed' | 'session' | 'simulated'

/** One answer, in the form's payload shape. `question_rate` null = skipped. */
export interface Answer {
  id: number
  question_rate: number | null
}

export interface SurveyResponse {
  id: string
  surveyId: string
  campaignId: string
  tenantId: TenantId
  branchId: string
  staffId: string
  answers: Answer[]
  comment: string
  /** Language the comment was written in (shown verbatim, never translated). */
  commentLang: Lang
  submittedAt: ISODate
  source: ResponseSource
}

/* ------------------------------------------------------------ store shape */

export interface Seed {
  tenants: Tenant[]
  branches: Branch[]
  staff: Staff[]
  campaigns: Campaign[]
  questions: Question[]
  recipients: Recipient[]
  links: SurveyLink[]
  messages: SmsMessage[]
  responses: SurveyResponse[]
}

/* ---------------------------------------------------- wire: survey API */

/** Envelope every `/api/surveys/*` call returns (HTTP 200 even on failure, like upstream). */
export type ApiEnvelope<T> =
  | { success: true; data: T }
  | {
      success: false
      message: string
      /** Demo extension: lets end-state pages stay tenant-branded. */
      meta?: { tenantId: TenantId; status: LinkStatus | 'unknown' }
    }

/** POST /api/surveys/validate  body: { survey_id, lang? } */
export interface ValidateRequest {
  survey_id: string
  lang?: Lang
}

export interface SurveyQuestionWire {
  id: number
  question_text: string
}

export interface ValidateData {
  campaign: { title: string; description: string }
  questions: SurveyQuestionWire[]
  /** Demo extension: white-label branding (upstream: per-deployment config). */
  tenant: TenantBranding
  /** Demo extension: what is being rated. */
  context: {
    touchpoint: string
    branch: string
    staff: string
    interactionAt: ISODate
    expiresAt: ISODate
  }
}

/** POST /api/surveys/responses  body (the form's shape, not the legacy test-page shape). */
export interface SubmitRequest {
  survey_id: string
  responses: Answer[]
  comment: string
}

/** POST /api/surveys/questions  body: { survey_id, lang? } */
export interface QuestionsData {
  questions: SurveyQuestionWire[]
}

/** Canonical failure messages (the UI branches on them like the source did). */
export const SURVEY_MESSAGES = {
  notFound: 'Survey not found',
  completed: 'Survey already completed',
  expired: 'Survey link expired',
} as const

/* ------------------------------------------------- wire: console analytics */

export interface ConsoleFilters {
  tenantId?: string
  branchId?: string
  staffId?: string
  campaignId?: string
  /** Look-back window in days (7 | 30 | 90). */
  days?: number
}

export interface KpiSet {
  /** Share of answered ratings that are 4 or 5, 0..100. */
  csat: number
  /** Mean of all answered ratings, 1..5. */
  avgRating: number
  /** completed / sent for links sent in the window, 0..100. */
  responseRate: number
  responsesToday: number
  sent: number
  completed: number
  expired: number
  pending: number
}

export interface TrendPoint {
  /** yyyy-MM-dd */
  date: string
  responses: number
  avgRating: number | null
}

/** Count of answers per rating value 1..5. */
export type Distribution = [number, number, number, number, number]

export interface QuestionStat {
  questionId: number
  text: LocalizedText
  avg: number | null
  answered: number
  skipped: number
  distribution: Distribution
}

/** A response joined with the names the console shows. */
export interface ResponseRow {
  id: string
  surveyId: string
  tenantId: TenantId
  tenantName: LocalizedText
  campaignTitle: LocalizedText
  branchName: LocalizedText
  staffName: LocalizedText
  phoneMasked: string
  recipientName: LocalizedText | null
  /** Mean of answered ratings. */
  avgRating: number | null
  answeredCount: number
  questionCount: number
  comment: string
  commentLang: Lang
  submittedAt: ISODate
  source: ResponseSource
}

export interface ResponseDetail extends ResponseRow {
  answers: Array<{ questionId: number; text: LocalizedText; rate: number | null }>
  link: Pick<SurveyLink, 'sentAt' | 'expiresAt' | 'completedAt' | 'interactionAt' | 'sentBy'>
}

/** A link joined with names for the dispatch log / sent list. */
export interface LinkRow extends SurveyLink {
  tenantName: LocalizedText
  campaignTitle: LocalizedText
  branchName: LocalizedText
  staffName: LocalizedText
  recipientName: LocalizedText | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/* ------------------------------------------------------------ demo meta */

/** GET /api/meta: lookups every console filter and the inbox share. */
export interface MetaLookups {
  tenants: Tenant[]
  branches: Branch[]
  staff: Staff[]
  campaigns: Campaign[]
}

/** Mock event bus map (see src/demo/events.ts). */
export interface DemoEvents {
  'link:updated': { surveyId: string; status: LinkStatus }
  'response:created': { responseId: string; surveyId: string; campaignId: string; source: ResponseSource }
  'sms:received': { messageId: string; recipientId: string; tenantId: TenantId }
  'clock:changed': { offsetMs: number }
  'store:reset': undefined
}
