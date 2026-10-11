/** View models shared by the team handlers and the team UI. */
import type { LocalizedText, Operator, OperatorStatus, PersonName, StaffRole } from '@/types'

export interface RosterEntry {
  role: StaffRole
  id: string
  name: PersonName
  nickname: string
  number: string
  avatarId: string | null
  avatarUrl: string | null
  presence: OperatorStatus
  /** Existing DM with this person, if any. */
  conversationId: string | null
  unread: number
  lastMessageText: string | null
  lastMessageAt: string | null
}

export interface ConversationRow {
  id: string
  kind: 'direct' | 'room'
  title: LocalizedText | null
  /** The other person of a DM. */
  peer: RosterEntry | null
  memberCount: number
  unread: number
  lastMessageText: string | null
  lastMessageAt: string | null
  /** Who wrote the last message (shown as a prefix in the room row). */
  lastSenderName: PersonName | null
}

export interface MessagesPage {
  messages: import('@/types').StaffMessage[]
  hasMore: boolean
}

export interface ProfileResponse {
  operator: Operator
  tenant: { id: string; name: LocalizedText }
}
