/**
 * Query-key factories, so invalidation by prefix works across features
 * (e.g. invalidating `queryKeys.session(id)` also refreshes its messages).
 */
type Params = Record<string, string | number | boolean | null | undefined>

export const queryKeys = {
  me: ['auth', 'me'] as const,
  tenantSettings: ['tenant', 'settings'] as const,
  demoControls: ['demo', 'controls'] as const,

  widget: {
    config: (slug: string) => ['widget', slug, 'config'] as const,
    session: (sessionId: string) => ['widget', 'session', sessionId] as const,
  },

  inbox: ['operator', 'inbox'] as const,
  session: (sessionId: string) => ['sessions', sessionId] as const,
  messages: (sessionId: string) => ['sessions', sessionId, 'messages'] as const,
  context: (sessionId: string) => ['sessions', sessionId, 'context'] as const,
  notes: (sessionId: string) => ['sessions', sessionId, 'notes'] as const,
  copilot: (sessionId: string) => ['sessions', sessionId, 'copilot'] as const,
  quickReplies: (q = '') => ['quick-replies', q] as const,
  templates: ['whatsapp', 'templates'] as const,
  operatorHistory: (params: Params = {}) => ['operator', 'history', params] as const,

  team: {
    all: ['team'] as const,
    roster: ['team', 'roster'] as const,
    conversations: ['team', 'conversations'] as const,
    messages: (conversationId: string) => ['team', 'conversations', conversationId, 'messages'] as const,
  },
  profile: {
    all: ['operator', 'profile'] as const,
    stats: (params: Params = {}) => ['operator', 'profile', 'stats', params] as const,
    chats: (params: Params = {}) => ['operator', 'profile', 'chats', params] as const,
  },

  admin: {
    all: ['admin'] as const,
    dashboard: ['admin', 'dashboard'] as const,
    sessions: (tab: string) => ['admin', 'sessions', tab] as const,
    history: (params: Params = {}) => ['admin', 'history', params] as const,
    transcript: (sessionId: string) => ['admin', 'history', 'transcript', sessionId] as const,
    statistics: (params: Params = {}) => ['admin', 'statistics', params] as const,
    activity: (params: Params = {}) => ['admin', 'activity', params] as const,
    operators: (q = '') => ['admin', 'operators', q] as const,
    operatorAudit: (operatorId: string) => ['admin', 'operators', operatorId, 'audit'] as const,
    admins: ['admin', 'admins'] as const,
    supervisors: ['admin', 'supervisors'] as const,
    settings: ['admin', 'settings'] as const,
    workingHours: ['admin', 'working-hours'] as const,
    customFields: ['admin', 'custom-fields'] as const,
    quickReplies: ['admin', 'quick-replies'] as const,
    bans: ['admin', 'bans'] as const,
    faq: ['admin', 'faq'] as const,
    integrations: ['admin', 'integrations'] as const,
    telegram: ['admin', 'integrations', 'telegram'] as const,
    comments: (channel = 'all') => ['admin', 'comments', channel] as const,
    aiLink: ['admin', 'ai-link'] as const,
  },

  superadmin: {
    all: ['superadmin'] as const,
    overview: ['superadmin', 'overview'] as const,
    tenants: (params: Params = {}) => ['superadmin', 'tenants', params] as const,
    members: (tenantId: string) => ['superadmin', 'tenants', tenantId, 'members'] as const,
    staffChats: (tenantId: string) => ['superadmin', 'tenants', tenantId, 'staff-chats'] as const,
    staffChatMessages: (conversationId: string) => ['superadmin', 'staff-chats', conversationId] as const,
    platform: ['superadmin', 'platform'] as const,
    health: (range: string) => ['superadmin', 'health', range] as const,
    aiKey: ['superadmin', 'ai-key'] as const,
  },
} as const
