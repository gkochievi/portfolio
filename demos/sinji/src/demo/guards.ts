/**
 * Role checks every handler uses. Shared; owned by the shell agent.
 */
import { DemoApiError, forbidden } from '@portfolio/demo-kit'

import type { Id, Role, SinjiAccount } from '@/types'
import { getActingTenantId } from './context'
import { session } from './core'

/** The signed-in account, or a 401. */
export function currentAccount(): SinjiAccount {
  const account = session.current()
  if (!account) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  return account
}

/** The signed-in account, or null for a guest (public endpoints). */
export function maybeAccount(): SinjiAccount | null {
  return session.current()
}

export function requireRole(...roles: Role[]): SinjiAccount {
  const account = currentAccount()
  if (!roles.includes(account.role)) throw forbidden()
  return account
}

export const requireOperator = (): SinjiAccount => requireRole('operator')

/** The tenant a workspace request is scoped to: own tenant, or the operator's act-as choice. */
export function tenantScope(): Id {
  const account = currentAccount()
  if (account.role === 'operator') {
    const acting = getActingTenantId()
    if (!acting) throw forbidden('Pick a workspace to act as.')
    return acting
  }
  if (!account.tenantId) throw forbidden()
  return account.tenantId
}

/** Owners and the operator may change workspace settings; members are read-only. */
export function canEditWorkspace(account: SinjiAccount | null = session.current()): boolean {
  return account?.role === 'owner' || account?.role === 'operator'
}

export function requireWorkspaceEditor(): SinjiAccount {
  const account = currentAccount()
  if (!canEditWorkspace(account)) throw forbidden('This setting is read-only for members.')
  return account
}

/** Display name written into `actor` / `created_by` / `edited_by` fields. */
export function actorName(): string {
  return session.current()?.name ?? 'guest'
}
