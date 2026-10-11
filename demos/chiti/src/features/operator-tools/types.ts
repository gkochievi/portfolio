/** Shared shapes of the operator-tools API (used by the handlers and the query hooks). */
import type {
  ContentLang,
  Customer,
  ExternalContact,
  FaqStep,
  ISODate,
  CopilotDraft,
  LocalizedText,
  Paginated,
  QuickReplyCategory,
  SessionFieldValue,
  SessionSummary,
  WhatsAppTemplate,
} from '@/types'

/** GET /api/sessions/:id/context */
export interface ContextResponse {
  customer: Customer
  /** Custom field values captured by the pre-chat form. */
  fields: SessionFieldValue[]
  /** null when the tenant has client IP display switched off. */
  clientIp: string | null
  faqPath: FaqStep[]
  externalContact: ExternalContact | null
  lastInboundAt: ISODate | null
  /** The field that links previous chats (e.g. the phone number). */
  groupBy: { fieldId: string; label: LocalizedText; value: string } | null
  previousChats: SessionSummary[]
  notesEnabled: boolean
  clientIpEnabled: boolean
}

/** GET /api/quick-replies (content already picked in the customer's language, then the operator's). */
export interface QuickReplyView {
  id: string
  category: QuickReplyCategory
  title: string
  content: string
  /** Language `content` is written in. */
  lang: ContentLang
  sortOrder: number
}

/** GET /api/whatsapp/templates */
export interface TemplatesResponse {
  templates: WhatsAppTemplate[]
  syncedAt: ISODate | null
}

/** GET /api/sessions/:id/copilot */
export interface CopilotResponse {
  /** null = nothing was generated for this chat yet. */
  draft: CopilotDraft | null
  /** The simulated AI outage is active (circuit open). */
  outage: boolean
  outageUntil: ISODate | null
}

export type TemplateErrorCode = 'missing_values' | 'template_unsendable' | 'wrong_channel'

export type HistoryResponse = Paginated<SessionSummary>
