/**
 * The in-memory event bus contract. Owner: seed (architect wrote the shape).
 *
 * `changed` is how the UI learns the store moved: the shell listens once and
 * invalidates every React Query whose queryKey[0] is one of `entities`.
 * So: every query key MUST start with a ChangedEntity, and every mutation or
 * simulator MUST call `emitChanged(...)` from `@/demo/ctx` afterwards.
 */
export const CHANGED_ENTITIES = [
  'me',
  'partners',
  'partner-rates',
  'documents',
  'api-keys',
  'portal-admins',
  'licenses',
  'seats',
  'partner-users',
  'task-templates',
  'staff-users',
  'tasks',
  'task-messages',
  'mails',
  'threads',
  'projects',
  'points',
  'invoices',
  'invoice-templates',
  'outbox',
  'audit',
  'system-logs',
  'health',
  'settings',
  'backfill',
  'scheduler',
  'dashboards',
  'reports',
] as const

export type ChangedEntity = (typeof CHANGED_ENTITIES)[number]

export interface DemoNotice {
  tone: 'info' | 'success' | 'warning' | 'error'
  /** i18n key (`ns:key`) or plain text. */
  title: string
  description?: string
  /** Interpolation values for the i18n key. */
  values?: Record<string, string | number>
  /** Optional in-app link, e.g. `/l1/mails/mail_120`. */
  href?: string
}

export interface DemoEvents {
  changed: { entities: ChangedEntity[] }
  /** Simulator-originated toast (new mail, chat reply, incident). Shown by the shell via sonner. */
  notify: DemoNotice
  /** Mail ingested by Poll now, the poll job or the timed injector. */
  'mail.received': { mailIds: string[]; threadIds: string[]; taskIds: string[] }
  /** A chat message was posted; the tasks simulator answers partner messages. */
  'task.message': { taskId: string; authorKind: 'internal' | 'partner'; messageId: string }
  /** A partner was enabled or disabled; the portal shell re-checks access. */
  'partner.access': { partnerId: string; isActive: boolean }
}
