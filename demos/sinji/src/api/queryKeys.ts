/**
 * TanStack Query keys, one namespace per feature group. Every key starts with
 * the group id (`['workbench', ...]`, `['kb', ...]` for knowledge-base), so a
 * group can invalidate all of its own queries with `queryKeys.<group>.all`.
 * Act-as changes clear the whole cache (shell), so keys need not carry the tenant.
 * Helpers only: a group may build ad-hoc keys as long as they share its prefix.
 */
import type { UsageFilters } from '@/types'

type Params = Record<string, unknown> | undefined

const p = (params: Params) => params ?? {}

export const queryKeys = {
  shell: {
    all: ['shell'] as const,
    me: ['shell', 'me'] as const,
    tenants: ['shell', 'tenants'] as const,
  },

  'voice-tools': {
    all: ['voice-tools'] as const,
    health: ['voice-tools', 'health'] as const,
    limits: ['voice-tools', 'limits'] as const,
    ttsCatalog: ['voice-tools', 'tts-catalog'] as const,
    convertFormats: ['voice-tools', 'convert-formats'] as const,
    batch: (id: string) => ['voice-tools', 'batch', id] as const,
  },

  workbench: {
    all: ['workbench'] as const,
    recordings: (params?: Params) => ['workbench', 'recordings', p(params)] as const,
    recording: (id: string) => ['workbench', 'recording', id] as const,
  },

  analysis: {
    all: ['analysis'] as const,
    summaries: (recordingId?: string) => ['analysis', 'summaries', recordingId ?? null] as const,
    summary: (id: string) => ['analysis', 'summary', id] as const,
  },

  /** Knowledge base (group id `knowledge-base`, prefix `kb`). */
  kb: {
    all: ['kb'] as const,
    stats: ['kb', 'stats'] as const,
    tags: ['kb', 'tags'] as const,
    documents: (filters?: Params) => ['kb', 'documents', p(filters)] as const,
    document: (id: string) => ['kb', 'document', id] as const,
    chunks: (documentId: string) => ['kb', 'chunks', documentId] as const,
  },

  'kb-quality': {
    all: ['kb-quality'] as const,
    retrieval: (params?: Params) => ['kb-quality', 'retrieval', p(params)] as const,
    search: (q: string) => ['kb-quality', 'search', q] as const,
    duplicates: ['kb-quality', 'duplicates'] as const,
    events: (action?: string) => ['kb-quality', 'events', action ?? null] as const,
    reembedJob: ['kb-quality', 'reembed-job'] as const,
    proposals: (state?: string) => ['kb-quality', 'proposals', state ?? 'pending'] as const,
    curationSummary: ['kb-quality', 'curation-summary'] as const,
  },

  'workspace-settings': {
    all: ['workspace-settings'] as const,
    rubric: ['workspace-settings', 'rubric'] as const,
    rubricImport: (jobId: string) => ['workspace-settings', 'rubric-import', jobId] as const,
    bands: ['workspace-settings', 'bands'] as const,
    sentiment: ['workspace-settings', 'sentiment'] as const,
    transcription: ['workspace-settings', 'transcription'] as const,
    ai: ['workspace-settings', 'ai'] as const,
    defaultRubric: ['workspace-settings', 'default-rubric'] as const,
  },

  copilot: {
    all: ['copilot'] as const,
    botConfig: ['copilot', 'bot-config'] as const,
    defaultBot: ['copilot', 'default-bot'] as const,
    botControl: ['copilot', 'bot-control'] as const,
    workspaces: ['copilot', 'workspaces'] as const,
    conversation: (id: string) => ['copilot', 'conversation', id] as const,
  },

  'console-platform': {
    all: ['console-platform'] as const,
    settings: ['console-platform', 'settings'] as const,
    tenants: ['console-platform', 'tenants'] as const,
    tenantUsers: (tenantId: string) => ['console-platform', 'tenant-users', tenantId] as const,
    healthOverview: ['console-platform', 'health-overview'] as const,
    healthSeries: (range: string) => ['console-platform', 'health-series', range] as const,
    healthTenants: (range: string) => ['console-platform', 'health-tenants', range] as const,
    users: (q?: string) => ['console-platform', 'users', q ?? ''] as const,
    limitsRegistered: ['console-platform', 'limits-registered'] as const,
    limitsAnonymous: ['console-platform', 'limits-anonymous'] as const,
    storage: ['console-platform', 'storage'] as const,
    voices: ['console-platform', 'voices'] as const,
  },

  'console-ai': {
    all: ['console-ai'] as const,
    catalog: ['console-ai', 'catalog'] as const,
    connections: (includeInactive = false) => ['console-ai', 'connections', includeInactive] as const,
    assignments: ['console-ai', 'assignments'] as const,
    tenant: (tenantId: string) => ['console-ai', 'tenant', tenantId] as const,
    instructions: ['console-ai', 'instructions'] as const,
    transcriptionDefault: ['console-ai', 'transcription-default'] as const,
    integrations: ['console-ai', 'integrations'] as const,
    embeddings: ['console-ai', 'embeddings'] as const,
  },

  usage: {
    all: ['usage'] as const,
    facets: ['usage', 'facets'] as const,
    overview: (filters: Partial<UsageFilters>) => ['usage', 'overview', filters] as const,
    recordings: (filters: Partial<UsageFilters>, page?: Params) => ['usage', 'recordings', filters, p(page)] as const,
    recording: (id: string) => ['usage', 'recording', id] as const,
    conversations: (filters: Partial<UsageFilters>, page?: Params) => ['usage', 'conversations', filters, p(page)] as const,
    conversation: (id: string) => ['usage', 'conversation', id] as const,
    calls: (filters: Partial<UsageFilters>, page?: Params) => ['usage', 'calls', filters, p(page)] as const,
  },
} as const
