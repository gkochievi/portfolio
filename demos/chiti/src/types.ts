/**
 * Chiti entity types: the contract between the seed, the mock API handlers,
 * the realtime bus and every screen. Owned by the architect; changes go
 * through the data-core agent and must be announced in its final message.
 *
 * Conventions
 * - Every timestamp is an ISO string (`ISODate`). The seed is authored as of
 *   SEED_ANCHOR and rebased to "now" on every store reset.
 * - Every tenant-scoped row carries `tenantId`.
 * - UI language is `Lang` (en | ka). Tenant CONTENT (titles, FAQ, quick
 *   replies, field labels, greetings) is stored per content language
 *   (`LocalizedText`, ka/en required, ru optional), as in the real product.
 */

/* ------------------------------------------------------------------ basics */

export type ISODate = string
export type Lang = 'en' | 'ka'
export type ContentLang = 'ka' | 'en' | 'ru'

export interface LocalizedText {
  ka: string
  en: string
  ru?: string
}

/** Staff display names in both scripts: `{ en: 'Luka Beridze', ka: 'ლუკა ბერიძე' }`. */
export interface PersonName {
  en: string
  ka: string
}

export type Channel = 'web_widget' | 'facebook_messenger' | 'instagram' | 'whatsapp' | 'telegram' | 'tiktok'
export type ExternalChannel = Exclude<Channel, 'web_widget'>
export const CHANNELS: readonly Channel[] = [
  'web_widget',
  'whatsapp',
  'telegram',
  'facebook_messenger',
  'instagram',
  'tiktok',
]

export type StaffRole = 'operator' | 'admin' | 'supervisor' | 'superadmin'
export type Role = StaffRole | 'customer'

/* ----------------------------------------------------------------- tenants */

export interface ChannelFeatures {
  facebook_messenger: boolean
  instagram: boolean
  whatsapp: boolean
  telegram: boolean
  tiktok: boolean
}

export type TenantState = 'active' | 'disabled' | 'deleted'

export interface Tenant {
  id: string
  slug: string
  name: LocalizedText
  /** One line for the super-admin table: "Online wine shop". */
  industry: LocalizedText
  allowedOrigins: string[]
  disabled: boolean
  disabledAt: ISODate | null
  deletedAt: ISODate | null
  createdAt: ISODate
  features: ChannelFeatures
  /** Seeded headline counters (the rich tenant's are recomputed live by handlers). */
  counts: { operators: number; admins: number; supervisors: number; customers: number; sessions: number }
}

/** Eight widget/console theme presets (own palette, never the client's). */
export type ThemePreset = 'canary' | 'olive' | 'clay' | 'plum' | 'moss' | 'slate' | 'night' | 'paper'
export type DistributionStrategy = 'ordered' | 'round_robin' | 'random' | 'least_busy'
export type WidgetPosition = 'right' | 'left'

export interface TenantSettings {
  tenantId: string
  chatTitle: LocalizedText
  clientTheme: ThemePreset
  operatorTheme: ThemePreset
  adminTheme: ThemePreset
  /** Auto-assign: chats go straight to an operator instead of waiting in the queue. */
  operatorEnterDirectly: boolean
  chatDistributionStrategy: DistributionStrategy
  /** 0 = unlimited. */
  operatorChatLimit: number
  /** Operators see the customer's draft while they type. */
  typingTransparency: boolean
  requestFeedback: boolean
  inactiveWarningMinutes: number
  inactiveDisconnectMinutes: number
  /** 0 = off. Unanswered chat returns to the queue and excludes the operator. */
  operatorResponseMinutes: number
  /** 0 = off. Chats of a logged-out operator return to the queue after the grace. */
  operatorLogoutGraceMinutes: number
  chatRetentionDays: number
  faqEnabled: boolean
  faqShowOperatorButton: boolean
  faqTree: FaqTree
  messageNotesEnabled: boolean
  clientIpEnabled: boolean
  autoGreetingEnabled: boolean
  autoGreeting: LocalizedText
  bannedMessage: LocalizedText
  aiBotEnabled: boolean
  widgetPosition: WidgetPosition
}

export interface DaySchedule {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  enabled: boolean
  /** 'HH:mm' in the tenant timezone. */
  start: string
  end: string
}

export interface WorkingHours {
  tenantId: string
  timezone: string
  weeklySchedule: DaySchedule[]
  isTemporarilyClosed: boolean
  temporaryClosedFrom: ISODate | null
  temporaryClosedUntil: ISODate | null
  temporaryClosedMessage: LocalizedText
  nextAvailableMessage: LocalizedText
  /** Demo control: 'open' (default for the rich tenant) ignores the schedule. */
  demoOverride: 'auto' | 'open' | 'closed'
}

export interface WorkingHoursStatus {
  isOpen: boolean
  reason: 'schedule' | 'temporary_closure' | 'demo_override'
  /** Next opening, when closed. */
  nextOpen: ISODate | null
  /** Today's hours, 'HH:mm', for the out-of-hours panel. */
  todayStart: string | null
  todayEnd: string | null
}

/* ------------------------------------------------------------------- staff */

export type OperatorStatus = 'online' | 'away' | 'offline'

export interface Operator {
  id: string
  tenantId: string
  name: PersonName
  nickname: string
  username: string
  email: string
  /** 3–4 digit staff number, shown as #1205. */
  operatorNumber: string
  isExternal: boolean
  /** Locally generated preset avatar id (e.g. 'nest-07'), or null for initials. */
  avatarId: string | null
  /** Object URL of an uploaded image (session only), or null. */
  avatarUrl: string | null
  status: OperatorStatus
  /** Set when an admin force-paused the operator. */
  pausedAt: ISODate | null
  pausedBy: 'self' | 'admin' | null
  activeChatCount: number
  language: ContentLang
  pushEnabled: boolean
  lastSeen: ISODate
  createdAt: ISODate
}

export interface Admin {
  id: string
  tenantId: string
  name: PersonName
  nickname: string
  username: string
  email: string
  adminNumber: string
  isExternal: boolean
  language: ContentLang
  /** Linked operator profile ("become operator"), or null. */
  operatorId: string | null
  createdAt: ISODate
}

export interface Supervisor {
  id: string
  tenantId: string
  name: PersonName
  nickname: string
  username: string
  email: string
  supervisorNumber: string
  isExternal: boolean
  language: ContentLang
  createdAt: ISODate
}

export interface SuperAdmin {
  id: string
  name: PersonName
  username: string
  email: string
  language: ContentLang
}

/**
 * A sign-in-able account (demo-kit `DemoAccount` + Chiti fields). One per
 * staff record of every tenant, plus the superadmin and the customer persona.
 * Only the five headline accounts are shown in the DemoBar.
 */
export interface ChitiAccount {
  id: string
  name: string
  email: string
  password: string
  role: Role
  roleLabel?: string | undefined
  description?: string | undefined
  avatarColor?: string | undefined
  /** Georgian display name for the ka UI. */
  nameKa: string
  username: string
  /** Staff record id (operator/admin/supervisor/superadmin id); the customer persona uses its own id. */
  staffId: string
  /** null for the superadmin. */
  tenantId: string | null
  /** Where this account lands after sign-in. */
  homeRoute: string
  /** Listed in the DemoBar switcher. */
  headline: boolean
}

/* --------------------------------------------------------------- customers */

export type CustomerStatus = 'waiting' | 'connected' | 'disconnected'

export interface ExternalContact {
  id: string
  channel: ExternalChannel
  externalUserId: string
  displayName: string
  /** '@handle' where the channel has one (Instagram, TikTok, Telegram). */
  username: string | null
  /** Local preset avatar id; never a remote URL. */
  avatarId: string | null
  locale: string | null
}

export interface Customer {
  id: string
  tenantId: string
  name: string
  /** Unique per tenant: `anon-…` for the widget, `wa:…`/`fb:…`/`ig:…`/`tg:…`/`tt:…` for channels. */
  number: string
  channel: Channel
  status: CustomerStatus
  activeSessionId: string | null
  /** customFieldId → value. */
  fields: Record<string, string>
  externalContact: ExternalContact | null
  language: ContentLang
  createdAt: ISODate
}

/* ---------------------------------------------------------------- sessions */

export type SessionStatus = 'waiting' | 'active' | 'inactive' | 'ended'
export type EndedBy = 'customer' | 'operator' | 'admin' | 'system'
export type EndReason = 'manual' | 'inactivity' | 'customer_return' | 'queue_cleared' | 'stale_waiting'
/** End category used by history filters and profile stats. */
export type EndCategory = 'operator' | 'customer' | 'system' | 'missed'
export type AiState = 'bot' | 'handed_off' | 'copilot' | 'closed' | null
export type HandoffReason =
  | 'customer_request'
  | 'operator_claim'
  | 'ai_recommended'
  | 'unsupported_content'
  | 'no_answer'
  | 'circuit_open'
  | 'bot_paused'
  | 'delivery_failed'
export type SessionTopic = 'delivery' | 'order_status' | 'returns' | 'payment' | 'pairing' | 'gift' | 'corporate' | 'other'
/** Where a session came from: the seed, the background spawner, or the visitor's own widget. */
export type SessionOrigin = 'seed' | 'spawner' | 'visitor'

export interface AiHandoff {
  at: ISODate
  reason: HandoffReason
  /** Written in the customer's language. */
  summary: string
  goal: string
  source: 'bot' | 'customer' | 'operator' | 'system'
}

export interface FaqStep {
  nodeId: string
  question: string
  answer: string
}

export interface SessionFieldValue {
  fieldId: string
  label: LocalizedText
  value: string
}

export interface ChatSession {
  id: string
  tenantId: string
  customerId: string
  customerName: string
  customerNumber: string
  channel: Channel
  status: SessionStatus
  origin: SessionOrigin
  topic: SessionTopic
  startedAt: ISODate
  lastActivity: ISODate
  endedAt: ISODate | null
  endedBy: EndedBy | null
  endReason: EndReason | null
  /** Short summary shown on history rows ("Delivery moved to Friday"). */
  endSummary: string | null
  warningIssuedAt: ISODate | null
  inactiveSince: ISODate | null
  operatorId: string | null
  excludedOperatorIds: string[]
  clientIp: string | null
  clientLanguage: ContentLang
  faqPath: FaqStep[]
  customFields: SessionFieldValue[]
  firstStaffReplyAt: ISODate | null
  /** Last customer message; drives the channel reply window. */
  lastInboundAt: ISODate | null
  /** Business messages sent since the customer last wrote (TikTok cap is 10). */
  consecutiveBusinessMessages: number
  externalThreadId: string | null
  adminInterventionActive: boolean
  interventionAdminId: string | null
  aiState: AiState
  aiHandoff: AiHandoff | null
  /** Unread customer messages for the assigned operator. */
  unreadCount: number
  messageCount: number
  /** 'summary' sessions get a generated transcript on first read. */
  transcript: 'full' | 'summary'
}

export type MessageSender = 'user' | 'operator' | 'admin' | 'bot' | 'system'
export type MessageType = 'text' | 'file' | 'image' | 'location' | 'audio' | 'template'
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type FailureKind = 'window_closed' | 'cap_reached' | 'unsupported_media' | 'network'

export interface MessageFile {
  /** `${BASE_URL}media/…` for seeded files, an object URL for uploads. */
  url: string
  name: string
  mimeType: string
  size: number
}

export interface MessageLocation {
  lat: number
  lng: number
  label: string | null
}

export interface CopilotRef {
  draftId: string
  variantIndex: number
  action: 'sent_asis' | 'edited_sent'
}

export interface TemplatePreview {
  header: string | null
  body: string
  footer: string | null
  buttons: string[]
}

export interface Message {
  id: string
  tenantId: string
  sessionId: string
  sender: MessageSender
  senderId: string | null
  senderName: string | null
  type: MessageType
  content: string
  file: MessageFile | null
  location: MessageLocation | null
  /** Written by an admin during an intervention. */
  sentByAdmin: boolean
  timestamp: ISODate
  deliveryStatus: DeliveryStatus
  failureKind: FailureKind | null
  seenAt: ISODate | null
  reactionEmoji: string | null
  channel: Channel
  /** Part of the pre-chat FAQ walk. */
  isPreChat: boolean
  isAutoGreeting: boolean
  /** Bot answer citations (knowledge titles). */
  citations: string[]
  copilotRef: CopilotRef | null
  template: { templateId: string; name: string; preview: TemplatePreview } | null
}

export type AssignedVia = 'auto_assign' | 'claim' | 'admin'
export type ReleaseReason = 'response_timeout' | 'logout_grace' | 'operator_removed' | 'reassigned'

export interface SessionAssignment {
  id: string
  sessionId: string
  operatorId: string
  operatorName: PersonName
  assignedVia: AssignedVia
  assignedAt: ISODate
  releasedAt: ISODate | null
  releaseReason: ReleaseReason | null
}

export interface ChatNote {
  id: string
  tenantId: string
  sessionId: string
  authorRole: StaffRole
  authorId: string
  authorName: string
  content: string
  createdAt: ISODate
}

export interface Feedback {
  id: string
  tenantId: string
  sessionId: string
  customerId: string
  operatorId: string | null
  rating: 1 | 2 | 3 | 4 | 5
  comment: string | null
  submittedAt: ISODate
}

/* ------------------------------------------------------- tenant content */

export type CustomFieldType = 'text' | 'number' | 'email' | 'phone' | 'select'

export interface CustomField {
  id: string
  tenantId: string
  label: LocalizedText
  type: CustomFieldType
  required: boolean
  placeholder: LocalizedText
  options: { value: string; label: LocalizedText }[]
  sortOrder: number
  enabled: boolean
  /** The key that links a customer's previous chats (e.g. phone). */
  groupBy: boolean
}

export interface FaqOption {
  id: string
  label: LocalizedText
  nextId: string | null
  transferToOperator: boolean
}

export interface FaqNode {
  id: string
  type: 'question' | 'answer'
  text: LocalizedText
  position: { x: number; y: number }
  options: FaqOption[]
}

export interface FaqTree {
  rootIds: string[]
  nodes: Record<string, FaqNode>
}

export type QuickReplyCategory = 'greetings' | 'delivery' | 'payment' | 'closing'

export interface QuickReply {
  id: string
  tenantId: string
  title: LocalizedText
  content: LocalizedText
  category: QuickReplyCategory
  sortOrder: number
  enabled: boolean
}

export interface BannedClient {
  id: string
  tenantId: string
  type: 'ip' | 'customField'
  value: string
  fieldId: string | null
  fieldLabel: string | null
  reason: string
  createdBy: string
  createdAt: ISODate
}

/* --------------------------------------------------------- channel extras */

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED'

export interface TemplateSlot {
  key: string
  component: 'header' | 'body' | 'button'
  kind: 'text' | 'media' | 'url_suffix' | 'payload' | 'coupon' | 'location'
  position: number
  label: string
  example: string
  buttonIndex: number | null
  mediaFormat: 'image' | 'document' | 'video' | null
}

export interface WhatsAppTemplate {
  id: string
  tenantId: string
  externalId: string
  name: string
  language: ContentLang
  category: TemplateCategory
  status: TemplateStatus
  qualityScore: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
  sendable: boolean
  unsendableReasons: string[]
  recommendedForReengagement: boolean
  slots: TemplateSlot[]
  /** Body text uses {{1}}, {{2}} placeholders matching slot positions. */
  preview: TemplatePreview
  syncedAt: ISODate
}

/** Free-form reply window state for a session (computed by the engine). */
export interface ChannelWindowState {
  channel: Channel
  open: boolean
  /** Hours of the effective free-form window for this channel (null = no window, e.g. widget). */
  windowHours: number | null
  closesAt: ISODate | null
  /** What the operator can still do once closed. */
  remedy: 'none' | 'template' | null
  /** TikTok consecutive-message cap; null on other channels. */
  capLimit: number | null
  capRemaining: number | null
  /** Channel media matrix. */
  allowsLocation: boolean
  allowsPdf: boolean
  allowsReactions: boolean
  /** Bot-first is not allowed on Telegram and TikTok. */
  botAllowed: boolean
}

export type MetaAuthStatus =
  | 'not_configured'
  | 'disabled'
  | 'connected'
  | 'invalid_credentials'
  | 'network_error'
  | 'saved_untested'

export interface MetaIntegration {
  channel: 'facebook_messenger' | 'instagram' | 'whatsapp'
  enabled: boolean
  displayName: string | null
  /** Page id, IG account id or WhatsApp phone-number id. */
  routingId: string | null
  accessTokenPreview: string | null
  hasAppSecret: boolean
  verifyToken: string | null
  webhookUrl: string
  authStatus: MetaAuthStatus
  lastTestedAt: ISODate | null
  lastTestError: string | null
}

export interface TelegramIntegration {
  state: 'not_configured' | 'awaiting_business_connection' | 'connected'
  botUsername: string | null
  businessAccount: string | null
  connectedAt: ISODate | null
}

export interface TikTokIntegration {
  state: 'not_configured' | 'connected' | 'unverified' | 'blocked' | 'needs_reauth'
  account: { name: string; username: string; avatarId: string | null } | null
  euInboundDropped: number
  connectedAt: ISODate | null
}

export interface TenantIntegrations {
  tenantId: string
  meta: MetaIntegration[]
  telegram: TelegramIntegration
  tiktok: TikTokIntegration
}

export interface PageComment {
  id: string
  tenantId: string
  channel: 'facebook_messenger' | 'instagram'
  externalPostId: string
  postCaption: string
  parentExternalId: string | null
  authorName: string
  authorAvatarId: string | null
  text: string
  permalink: string
  isHidden: boolean
  isDeleted: boolean
  repliedAt: ISODate | null
  replyText: string | null
  repliedByName: string | null
  externalCreatedAt: ISODate
}

/* --------------------------------------------------------------- AI layer */

export type CopilotTransform = 'shorter' | 'warmer' | 'formal' | 'to_ru' | 'to_ka' | 'to_en'
export type CopilotState = 'running' | 'ready' | 'refused' | 'error' | 'not_found' | 'rate_limited'

export interface KnowledgeCard {
  n: number
  title: string
  snippet: string
  documentId: string
  score: number
}

export interface CopilotSuggestion {
  index: number
  kind: 'answer' | 'clarify' | 'escalate'
  /** May contain citation markers like [1]; they are stripped on insert. */
  text: string
  citations: number[]
}

export interface CopilotDraft {
  id: string
  tenantId: string
  sessionId: string
  /** The customer message this draft answers. */
  turnMessageId: string | null
  state: CopilotState
  retryAfterMs: number | null
  knowledge: KnowledgeCard[]
  suggestions: CopilotSuggestion[]
  handoff: { recommended: boolean; reason: HandoffReason | null; summary: string; goal: string } | null
  grounded: boolean
  /** The draft promises something (refund, date) the operator should double-check. */
  commitmentWarning: boolean
  transform: CopilotTransform | null
  createdAt: ISODate
}

export interface CopilotFeedback {
  id: string
  sessionId: string
  draftId: string
  action: 'shown' | 'inserted' | 'edited_sent' | 'sent_asis' | 'ignored'
  variantIndex: number | null
  finalText: string | null
  at: ISODate
}

export interface AiLinkStatus {
  tenantId: string
  serverConfigured: boolean
  /** The tenant's client UUID on the AI service. */
  aiClientId: string | null
  aiBotEnabled: boolean
  autopilotEnabled: boolean
  circuit: { state: 'closed' | 'open' | 'half_open'; failures: number; lastReason: string | null; openUntil: ISODate | null }
  botPause: { until: ISODate; reason: string } | null
  lastTestAt: ISODate | null
  lastTestOk: boolean | null
}

/* ------------------------------------------------------------- team chat */

export interface StaffMember {
  role: StaffRole
  memberId: string
  name: PersonName
  lastReadAt: ISODate | null
}

export interface StaffConversation {
  id: string
  tenantId: string
  kind: 'direct' | 'room'
  /** Room title; null for DMs. */
  title: LocalizedText | null
  /** Sorted `role:id|role:id` for DMs. */
  dmKey: string | null
  members: StaffMember[]
  lastMessageText: string | null
  lastMessageAt: ISODate | null
}

export interface StaffMessage {
  id: string
  tenantId: string
  conversationId: string
  senderRole: StaffRole
  senderId: string
  senderName: PersonName
  type: 'text' | 'image' | 'file'
  content: string
  fileUrl: string | null
  fileName: string | null
  timestamp: ISODate
  pending: boolean
  failed: boolean
  /** Optimistic id the client generated; pending bubbles reconcile on it. */
  clientId: string | null
}

/* ------------------------------------------------------------ audit trail */

export type ActivitySection = 'auth' | 'users' | 'chats' | 'reports' | 'integrations'

export type ActivityAction =
  | 'operator_login'
  | 'operator_logout'
  | 'operator_pause'
  | 'operator_resume'
  | 'operator_claim_session'
  | 'operator_end_session'
  | 'operator_return_to_queue'
  | 'operator_send_template'
  | 'admin_login'
  | 'admin_logout'
  | 'supervisor_login'
  | 'admin_intervention_start'
  | 'admin_intervention_stop'
  | 'admin_send_message'
  | 'admin_end_session'
  | 'admin_clear_queue'
  | 'admin_force_operator_status'
  | 'admin_force_operator_logout'
  | 'admin_end_operator_chats'
  | 'admin_create_operator'
  | 'admin_update_operator'
  | 'admin_delete_operator'
  | 'admin_create_admin'
  | 'admin_update_admin'
  | 'admin_delete_admin'
  | 'admin_create_supervisor'
  | 'admin_update_supervisor'
  | 'admin_delete_supervisor'
  | 'admin_update_settings'
  | 'admin_update_working_hours'
  | 'admin_update_faq'
  | 'admin_ban_client'
  | 'admin_unban_client'
  | 'admin_purge_sessions'
  | 'admin_download_report'
  | 'admin_save_integration'
  | 'admin_test_integration'
  | 'admin_delete_integration'
  | 'admin_moderate_comment'
  | 'customer_login'
  | 'customer_disconnect'

export interface ActivityLog {
  id: string
  tenantId: string
  action: ActivityAction
  section: ActivitySection
  actorRole: Role | 'system'
  actorId: string | null
  actorName: string
  targetId: string | null
  targetLabel: string | null
  metadata: Record<string, string | number | boolean | null>
  ipAddress: string | null
  createdAt: ISODate
}

export interface OperatorAuditLog {
  id: string
  tenantId: string
  operatorId: string
  operatorEmail: string
  action: 'created' | 'updated' | 'deleted'
  performedBy: string
  changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }>
  createdAt: ISODate
}

/* ------------------------------------------------------------- platform */

export interface PlatformSettings {
  metaAppId: string
  metaOAuthRedirectBase: string
  hasMetaAppSecret: boolean
  metaAppSecretPreview: string | null
  metaLoginConfigId: string | null
  metaWhatsappConfigId: string | null
  tiktokAppId: string | null
  tiktokAppSecretPreview: string | null
  tiktokWebhookExpectedUrl: string
  tiktokWebhookRegisteredUrl: string | null
  tiktokWebhookRegisteredAt: ISODate | null
  systemHealthRetentionMonths: number
  ai: {
    source: 'db' | 'env' | 'none'
    keyId: string | null
    keyPreview: string | null
    baseUrl: string
    suggestedBaseUrl: string
  }
}

export interface SystemHealthSample {
  at: ISODate
  cpuPercent: number
  loadAvg1: number
  memUsedMb: number
  memTotalMb: number
  memPercent: number
  diskUsedGb: number
  diskTotalGb: number
  diskPercent: number
  netRxKbps: number
  netTxKbps: number
  eventLoopLagMs: number
  pingMs: number
  uptimeSeconds: number
}

/* ------------------------------------------------------------ demo state */

/** Knobs of the storefront demo panel and the debug switches (demo chrome, not product). */
export interface DemoControls {
  /** Inactivity timers run at warn 45 s / close 90 s instead of the scaled default. */
  fastInactivity: boolean
  /** Fake client IP the widget logs in with (one preset matches a ban). */
  simulatedIp: string
  /** Copilot and bot answer with the circuit open until this time. */
  aiOutageUntil: ISODate | null
  /** True while an operator inbox is mounted and the visitor plays the operator. */
  operatorDriving: boolean
  /** New waiting chats arrive every 25–40 s. */
  spawnerEnabled: boolean
  /** TikTok connect resolves to this state (debug switch). */
  tiktokConnectResult: 'connected' | 'needs_reauth' | 'blocked'
}

/** The whole in-memory database (`store.data`). */
export interface ChitiDb {
  tenants: Tenant[]
  settings: TenantSettings[]
  workingHours: WorkingHours[]
  operators: Operator[]
  admins: Admin[]
  supervisors: Supervisor[]
  superAdmins: SuperAdmin[]
  customers: Customer[]
  sessions: ChatSession[]
  messages: Message[]
  assignments: SessionAssignment[]
  notes: ChatNote[]
  feedback: Feedback[]
  customFields: CustomField[]
  quickReplies: QuickReply[]
  bans: BannedClient[]
  waTemplates: WhatsAppTemplate[]
  integrations: TenantIntegrations[]
  comments: PageComment[]
  staffConversations: StaffConversation[]
  staffMessages: StaffMessage[]
  activity: ActivityLog[]
  operatorAudit: OperatorAuditLog[]
  copilotDrafts: CopilotDraft[]
  copilotFeedback: CopilotFeedback[]
  aiLinks: AiLinkStatus[]
  platform: PlatformSettings
  healthSamples: SystemHealthSample[]
  demo: DemoControls
}

/* ---------------------------------------------------- API view models */

export interface OperatorBrief {
  id: string
  name: PersonName
  nickname: string
  operatorNumber: string
  avatarId: string | null
  avatarUrl: string | null
  status: OperatorStatus
}

export interface MessagePreview {
  type: MessageType
  sender: MessageSender
  /** Text, or the file name; the UI adds the image/file/location/audio glyph. */
  text: string
  timestamp: ISODate
}

/** A row in the queue, "My chats", admin chat lists and history. */
export interface SessionSummary extends ChatSession {
  operator: OperatorBrief | null
  lastMessage: MessagePreview | null
  /** First custom field value or the phone, for the card's second line. */
  secondaryLine: string | null
  externalContact: ExternalContact | null
  rating: number | null
}

/** GET /api/sessions/:id: everything the conversation pane needs. */
export interface SessionDetail {
  session: ChatSession
  customer: Customer
  operator: OperatorBrief | null
  assignments: SessionAssignment[]
  window: ChannelWindowState
  feedback: Feedback | null
  interventionAdmin: { id: string; name: PersonName } | null
}

export interface TypingState {
  sessionId: string
  who: 'customer' | 'operator' | 'admin' | 'bot'
  isTyping: boolean
  /** Live draft preview (typing transparency); customer only. */
  draft: string | null
  name: string | null
}

export interface AdminStats {
  operators: { total: number; online: number; away: number; offline: number }
  customers: { active: number; waiting: number; inactive: number }
  sessions: { total: number; today: number; ended: number }
}

export interface OperatorProfileStats {
  from: ISODate
  to: ISODate
  timezone: string
  chatsHandled: number
  chatsEndedByMe: number
  activeNow: number
  messagesSent: number
  customerMessages: number
  avgFirstResponseSeconds: number | null
  avgHandlingMinutes: number | null
  transfersAway: Record<ReleaseReason, number>
  endCategories: Record<EndCategory, number>
  ratingAverage: number | null
  ratingCount: number
  daily: { date: string; chats: number; messages: number }[]
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

/* --------------------------------------------------- realtime events */

/**
 * The typed event bus (`src/demo/bus.ts`). Events that change data carry the
 * FULL entity so the BroadcastChannel mirror can upsert it in another tab.
 * Names follow the original socket events where one existed.
 */
export interface ChitiEvents {
  'session:upsert': ChatSession
  'message:upsert': Message
  'typing:update': TypingState
  'note:upsert': ChatNote
  'note:deleted': { id: string; sessionId: string }
  'customer:upsert': Customer
  'assignment:upsert': SessionAssignment
  'feedback:new': Feedback
  'operator:upsert': Operator
  'operator:force-logout': { operatorId: string; by: string }
  'settings:update': TenantSettings
  'working-hours:update': WorkingHours
  'inactivity:warning': { sessionId: string; disconnectAt: ISODate }
  'copilot:update': CopilotDraft
  'staff:message': StaffMessage
  'staff:conversation': StaffConversation
  'staff:typing': { conversationId: string; memberId: string; name: PersonName; isTyping: boolean }
  'activity:new': ActivityLog
  'tenant:upsert': Tenant
  'integration:update': TenantIntegrations
  'comment:upsert': PageComment
  'health:tick': SystemHealthSample
  'demo:controls': DemoControls
  /** Store was reset to the seed (DemoBar "reset"). UIs drop local state. */
  'demo:reset': undefined
}
