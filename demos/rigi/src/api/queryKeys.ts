/**
 * Query-key helpers. Owner: data core.
 *
 * The one rule: the first segment of every key is a `ChangedEntity`
 * (`src/demo/events.ts`). The shell invalidates by that root whenever a
 * handler calls `emitChanged(...)`, so a mutation anywhere refreshes every
 * view built on the same entity. Use these helpers so keys stay identical
 * between a hook and whatever invalidates or seeds it; the shapes mirror the
 * keys the feature hooks already use.
 */
import type { ChangedEntity } from '@/demo/events'

type Key<E extends ChangedEntity, R extends readonly unknown[]> = readonly [E, ...R]

function key<E extends ChangedEntity, R extends readonly unknown[]>(root: E, ...rest: R): Key<E, R> {
  return [root, ...rest] as unknown as Key<E, R>
}

type Filters = Record<string, unknown> | undefined

export const queryKeys = {
  me: { staff: () => key('me'), portal: () => key('me', 'portal') },

  partners: {
    all: () => key('partners'),
    list: (filters?: Filters) => key('partners', 'list', filters),
    options: () => key('partners', 'options'),
    invoicingOptions: () => key('partners', 'invoicing-options'),
    detail: (id: string) => key('partners', 'detail', id),
    accountantProfile: (id: string) => key('partners', 'accountant-profile', id),
  },
  partnerRates: (partnerId: string) => key('partner-rates', partnerId),
  documents: {
    partner: (partnerId: string) => key('documents', 'partner', partnerId),
    portal: () => key('documents', 'portal'),
  },
  apiKeys: {
    all: (showRevoked = false) => key('api-keys', 'all', { showRevoked }),
    partner: (partnerId: string) => key('api-keys', 'partner', partnerId),
  },
  portalAdmins: (partnerId: string) => key('portal-admins', partnerId),

  licenses: { list: () => key('licenses', 'list') },
  seats: {
    partner: (partnerId: string) => key('seats', partnerId),
    overrides: (partnerId: string) => key('seats', partnerId, 'overrides'),
    portal: () => key('seats', 'portal'),
  },
  partnerUsers: {
    roster: (partnerId: string) => key('partner-users', partnerId, 'roster'),
    mapper: (partnerId: string) => key('partner-users', partnerId, 'mapper'),
  },

  taskTemplates: {
    list: (includeArchived = false) => key('task-templates', 'list', { includeArchived }),
    detail: (id: string) => key('task-templates', 'detail', id),
    partner: (partnerId: string) => key('task-templates', 'partner', partnerId),
    portal: () => key('task-templates', 'portal'),
  },
  staffUsers: {
    list: () => key('staff-users', 'list'),
    detail: (id: string) => key('staff-users', 'detail', id),
    technicians: () => key('staff-users', 'technicians'),
  },

  tasks: {
    all: () => key('tasks'),
    list: (filters?: Filters) => key('tasks', 'list', filters),
    detail: (id: string) => key('tasks', 'detail', id),
    portalList: (filters?: Filters) => key('tasks', 'portal-list', filters),
    portalDetail: (id: string) => key('tasks', 'portal-detail', id),
  },
  taskMessages: (taskId: string, realm: 'staff' | 'partner') => key('task-messages', taskId, realm),

  mails: {
    list: (filters?: Filters) => key('mails', 'list', filters),
    detail: (id: string) => key('mails', 'detail', id),
  },
  threads: {
    list: (filters?: Filters) => key('threads', 'list', filters),
    detail: (id: string) => key('threads', 'detail', id),
  },
  projects: {
    list: (filters?: Filters) => key('projects', 'list', filters),
    detail: (id: string) => key('projects', 'detail', id),
    portalList: () => key('projects', 'portal-list'),
    portalDetail: (id: string) => key('projects', 'portal-detail', id),
  },

  points: { portal: () => key('points', 'portal') },
  invoices: {
    all: () => key('invoices'),
    list: (filters?: Filters) => key('invoices', 'list', filters),
    detail: (id: string) => key('invoices', 'detail', id),
    accountantDashboard: () => key('invoices', 'accountant-dashboard'),
    document: (id: string) => key('invoices', 'document', id),
    portalList: () => key('invoices', 'portal-list'),
    portalDetail: (id: string) => key('invoices', 'portal-detail', id),
  },
  invoiceTemplates: {
    list: (partnerId?: string | null) => key('invoice-templates', 'list', partnerId ?? null),
    options: (partnerId?: string | null) => key('invoice-templates', 'options', partnerId ?? null),
    detail: (id: string) => key('invoice-templates', 'detail', id),
  },
  outbox: () => key('outbox'),

  audit: (filters?: Filters) => key('audit', 'list', filters),
  systemLogs: {
    list: (filters?: Filters) => key('system-logs', 'list', filters),
    retention: () => key('system-logs', 'retention'),
  },
  health: {
    snapshot: () => key('health', 'snapshot'),
    history: (metric: string, range: string) => key('health', 'history', metric, range),
    incidents: () => key('health', 'incidents'),
  },
  settings: {
    system: () => key('settings', 'system'),
    billing: () => key('settings', 'billing'),
  },
  backfill: () => key('backfill'),
  scheduler: () => key('scheduler', 'jobs'),

  dashboards: {
    admin: () => key('dashboards', 'admin'),
    l1: () => key('dashboards', 'l1'),
    technician: () => key('dashboards', 'technician'),
  },
  reports: {
    payments: (filters?: Filters) => key('reports', 'payments', filters),
    unusedAllowance: (filters?: Filters) => key('reports', 'unused-allowance', filters),
  },
} as const

/** The entity a key belongs to (its first segment). */
export function rootOf(queryKey: readonly unknown[]): ChangedEntity | undefined {
  return queryKey[0] as ChangedEntity | undefined
}
