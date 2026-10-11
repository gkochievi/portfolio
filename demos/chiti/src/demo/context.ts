/**
 * Request context for handlers: who is calling, which tenant, role checks and
 * tenant-scoped lookups. Every lookup throws a DemoApiError instead of
 * returning undefined, so handlers stay declarative.
 */
import { DemoApiError, forbidden, notFound } from '@portfolio/demo-kit'

import type { Admin, ChatSession, ChitiAccount, Operator, Role, Supervisor, Tenant, TenantSettings, WorkingHours } from '@/types'

import { session } from './session'
import { store } from './store'

export function currentAccount(): ChitiAccount | null {
  return session.current()
}

export function requireAccount(): ChitiAccount {
  const account = session.current()
  if (!account) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  return account
}

/** The current account when its role is one of `roles` (any role when empty); 401/403 otherwise. */
export function requireRole(...roles: Role[]): ChitiAccount {
  const account = requireAccount()
  if (roles.length > 0 && !roles.includes(account.role)) throw forbidden()
  return account
}

/** Tenant of the current staff account (403 for the superadmin, who has none). */
export function currentTenantId(): string {
  const account = requireAccount()
  if (!account.tenantId) throw forbidden('This account is not attached to a tenant.')
  return account.tenantId
}

export function findTenant(tenantId: string): Tenant {
  const tenant = store.data.tenants.find((row) => row.id === tenantId)
  if (!tenant) throw notFound('Tenant not found.')
  return tenant
}

export function findTenantBySlug(slug: string): Tenant | undefined {
  return store.data.tenants.find((row) => row.slug === slug.toLowerCase())
}

export function tenantSettings(tenantId: string = currentTenantId()): TenantSettings {
  const settings = store.data.settings.find((row) => row.tenantId === tenantId)
  if (!settings) throw notFound('Tenant settings not found.')
  return settings
}

export function tenantWorkingHours(tenantId: string = currentTenantId()): WorkingHours {
  const hours = store.data.workingHours.find((row) => row.tenantId === tenantId)
  if (!hours) throw notFound('Working hours not found.')
  return hours
}

/** A session of the given tenant (default: the caller's). */
export function findSession(sessionId: string, tenantId: string = currentTenantId()): ChatSession {
  const found = store.data.sessions.find((row) => row.id === sessionId)
  if (!found || found.tenantId !== tenantId) throw notFound('Chat not found.')
  return found
}

export function findOperator(operatorId: string, tenantId?: string): Operator {
  const operator = store.data.operators.find((row) => row.id === operatorId)
  if (!operator || (tenantId && operator.tenantId !== tenantId)) throw notFound('Operator not found.')
  return operator
}

/** The operator record of the signed-in operator (403 for other roles). */
export function currentOperator(): Operator {
  const account = requireRole('operator')
  return findOperator(account.staffId)
}

export function currentAdmin(): Admin {
  const account = requireRole('admin')
  const admin = store.data.admins.find((row) => row.id === account.staffId)
  if (!admin) throw notFound('Admin not found.')
  return admin
}

export function currentSupervisor(): Supervisor {
  const account = requireRole('supervisor')
  const supervisor = store.data.supervisors.find((row) => row.id === account.staffId)
  if (!supervisor) throw notFound('Supervisor not found.')
  return supervisor
}

/** The fake client IP the widget uses (demo control). */
export function simulatedClientIp(): string {
  return store.data.demo.simulatedIp
}

/** The staff IP shown in activity rows (stable per account, from TEST-NET-1). */
export function staffIp(account: { id: string } | null = session.current()): string | null {
  if (!account) return null
  let n = 0
  for (const char of account.id) n = (n * 31 + char.charCodeAt(0)) % 200
  return `192.0.2.${10 + n}`
}
