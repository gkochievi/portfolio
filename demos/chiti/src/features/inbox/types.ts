/** Shared shapes of the inbox API (used by the handlers and the query hooks). */
import type { Channel, CopilotRef, DistributionStrategy, Message, MessageFile, MessageLocation, SessionSummary } from '@/types'

/** Rail filter: everything, one channel, or chats the AI assistant still owns. */
export type ChannelFilter = 'all' | Channel | 'bot'

/** GET /api/operator/inbox */
export interface InboxResponse {
  queue: SessionSummary[]
  mine: SessionSummary[]
  /** Counts across the queue and my chats; `all` and `bot` are included. */
  channelCounts: Record<ChannelFilter, number>
  /** 0 = unlimited. */
  limit: number
  activeCount: number
  autoAssign: boolean
  /** Operators see the customer's draft while they type. */
  typingTransparency: boolean
  strategy: DistributionStrategy
}

/** GET /api/sessions/:id/messages */
export interface MessagesResponse {
  messages: Message[]
  hasMore: boolean
}

/** POST /api/sessions/:id/messages */
export interface SendMessageBody {
  content: string
  file?: MessageFile | null
  location?: MessageLocation | null
  copilotRef?: CopilotRef | null
}
