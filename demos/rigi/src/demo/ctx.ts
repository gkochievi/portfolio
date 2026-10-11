/**
 * Helpers every handler module uses. Owner: seed (architect wrote the
 * contract; keep these signatures stable, extend freely).
 */
import { DemoApiError, forbidden } from '@portfolio/demo-kit'

import type {
  ActivityLog,
  AuditEntityType,
  LogLevel,
  Partner,
  StaffRole,
  StaffUser,
  SystemLog,
} from '@/types'

import type { RigiAccount } from './accounts'
import { shallowDiff } from './domain/diff'
import type { ChangedEntity, DemoNotice } from './events'
import { bus, session, store } from './runtime'

/* ------------------------------------------------------------------- time */

export function now(): Date {
  return new Date()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------- auth */

export function currentAccount(): RigiAccount | null {
  return session.current()
}

/**
 * The signed-in staff account, or a 401/403. `roles` lists who may call;
 * superadmin is always allowed (ROUTE_ROLES). No roles = any staff role.
 */
export function requireStaff(...roles: StaffRole[]): RigiAccount & { role: StaffRole } {
  const me = session.current()
  if (!me) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  if (me.realm !== 'staff' || me.role === 'partner_admin') throw forbidden()
  if (roles.length > 0 && me.role !== 'superadmin' && !roles.includes(me.role)) throw forbidden()
  return me as RigiAccount & { role: StaffRole }
}

/** The staff record behind the signed-in account. */
export function currentStaffUser(): StaffUser {
  const me = requireStaff()
  const user = store.data.staffUsers.find((u) => u.id === me.id)
  if (!user) throw forbidden()
  return user
}

/**
 * The signed-in partner admin and their partner. A disabled partner answers
 * 403 with the message `account_disabled`; the portal shell shows that state.
 */
export function requirePartnerAdmin(): { account: RigiAccount; partner: Partner } {
  const me = session.current()
  if (!me) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  if (me.realm !== 'partner' || !me.partnerId) throw forbidden()
  const partner = store.data.partners.find((p) => p.id === me.partnerId)
  if (!partner) throw forbidden()
  if (!partner.isActive) throw new DemoApiError(403, 'account_disabled')
  const admin = store.data.partnerAdmins.find((a) => a.id === me.id)
  if (admin && !admin.isActive) throw new DemoApiError(403, 'account_disabled')
  return { account: me, partner }
}

/* --------------------------------------------------------------- change */

/** Tell the UI which query roots to refetch. Call after every mutation. */
export function emitChanged(...entities: ChangedEntity[]): void {
  store.notify()
  bus.emit('changed', { entities })
}

/** Raise a toast from a handler or simulator. */
export function notify(notice: DemoNotice): void {
  bus.emit('notify', notice)
}

/* ---------------------------------------------------------------- audit */

let requestCounter = 0

export function requestId(): string {
  requestCounter += 1
  return `req_${Date.now().toString(36)}${requestCounter.toString(36).padStart(3, '0')}`
}

export interface AuditInput {
  /** e.g. `task.transition`, `invoice.issue`, `partner.set_seats`. */
  action: string
  entityType: AuditEntityType
  entityId: string
  partnerId?: string | null
  before?: unknown
  after?: unknown
}

/**
 * Append to the audit log. Deliberately SKIPPED when the actor is a
 * superadmin (the original product's rule); returns null in that case.
 */
export function recordAudit(input: AuditInput): ActivityLog | null {
  const me = session.current()
  if (!me || me.realm !== 'staff' || me.role === 'superadmin' || me.role === 'partner_admin') return null
  const entry: ActivityLog = {
    id: store.nextId('act_'),
    createdAt: nowIso(),
    actorUserId: me.id,
    actorName: me.name,
    actorEmail: me.email,
    actorRole: me.role,
    actorIp: '10.20.4.17',
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    partnerId: input.partnerId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    diff: shallowDiff(input.before, input.after),
    requestId: requestId(),
  }
  store.data.activityLog.unshift(entry)
  return entry
}

/* ----------------------------------------------------------- system log */

export interface SystemLogInput {
  level: LogLevel
  source: string
  message: string
  partnerId?: string | null
  context?: Record<string, unknown> | null
  payload?: unknown
}

export function writeSystemLog(input: SystemLogInput): SystemLog {
  const row: SystemLog = {
    id: store.nextId('log_'),
    createdAt: nowIso(),
    level: input.level,
    source: input.source,
    message: input.message,
    partnerId: input.partnerId ?? null,
    requestId: requestId(),
    context: input.context ?? null,
    payload: input.payload ?? null,
  }
  store.data.systemLogs.unshift(row)
  return row
}
