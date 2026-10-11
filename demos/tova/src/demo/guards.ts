/**
 * Role checks for handlers. Throw, never return, errors; messages are i18n keys.
 */
import { DemoApiError } from '@portfolio/demo-kit'

import { canEditRole, isStaffRole, isSuperRole } from '@/lib/roles'
import type { SessionUser, User } from '@/types'
import { auth } from './auth'
import { store } from './store'

export function currentUser(): User | null {
  const id = auth.currentId()
  if (!id) return null
  return store.data.users.find((user) => user.id === id) ?? null
}

/** 401 when signed out, 403 when suspended. */
export function requireUser(): User {
  const user = currentUser()
  if (!user) throw new DemoApiError(401, 'common:errors.signInRequired')
  if (user.disabled) throw new DemoApiError(403, 'common:errors.accountDisabled')
  return user
}

export function requireStaff(): User {
  const user = requireUser()
  if (!isStaffRole(user.role)) throw new DemoApiError(403, 'common:errors.forbidden')
  return user
}

export function requireEditor(): User {
  const user = requireUser()
  if (!canEditRole(user.role)) throw new DemoApiError(403, 'common:errors.forbidden')
  return user
}

export function requireSuper(): User {
  const user = requireUser()
  if (!isSuperRole(user.role)) throw new DemoApiError(403, 'common:errors.forbidden')
  return user
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company,
    role: user.role,
    isStaff: isStaffRole(user.role),
    canEdit: canEditRole(user.role),
    isSuper: isSuperRole(user.role),
  }
}
