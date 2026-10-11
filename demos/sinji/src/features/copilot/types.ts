/** Wire shapes of the copilot group's endpoints. OWNED BY: copilot. */
import type {
  AutopilotBlock,
  BotConfig,
  Channel,
  ChatConversation,
  ChatTurn,
  ContentLang,
  CopilotFeedback,
  Id,
  Industry,
  KillState,
  LocalizedCopy,
} from '@/types'

export interface WorkspaceRow {
  id: Id
  name: string
  name_ka: string
  industry: Industry
  autopilot_enabled: boolean
  public_docs: number
  kb_chunks: number
  killed: boolean
  blocked: AutopilotBlock | null
  min_score: number
  greeting: LocalizedCopy
  languages: ContentLang[]
  disclosure_mode: BotConfig['settings']['disclosure_mode']
  off_topic_warn_after: number
  off_topic_cutoff_after: number
}

export interface BotConfigView {
  config: BotConfig
  /** The global default the workspace inherits from. */
  defaults: BotConfig
  /** Dotted paths whose value equals the default. */
  inherited: string[]
  kill: { global_disabled: boolean; tenant_disabled: boolean; state: KillState }
  public_docs: number
  blocked: AutopilotBlock | null
  tenant: { id: Id; name: string; name_ka: string }
  can_edit: boolean
}

export interface ControlRow {
  id: Id
  name: string
  name_ka: string
  is_active: boolean
  autopilot: boolean
  disabled: boolean
  reachable: boolean
  public_docs: number
}

export interface BotControl {
  kill: KillState
  rows: ControlRow[]
}

export interface ConversationView {
  conversation: ChatConversation
  turns: ChatTurn[]
}

export interface NewConversationBody {
  client_id: Id
  channel: Channel
  locale: ContentLang
  mode: ChatConversation['mode']
}

export interface TurnTicket {
  turn_id: Id
  ticket: string
}

export interface FeedbackBody {
  turn_id: Id
  suggestion_index: number
  action: Exclude<CopilotFeedback['action'], 'shown'>
  final_text?: string | null
}

export interface FeedbackResult {
  feedback: CopilotFeedback
  turn: ChatTurn | null
}

export interface SttBody {
  client_id?: Id
  locale: ContentLang
  size?: number
  duration_s?: number
}

export interface SttResult {
  transcript: string
  language: ContentLang
  duration_s: number
}
