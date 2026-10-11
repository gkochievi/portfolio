/**
 * The users role matrix. Pure functions shared by the
 * mock handlers (enforcement) and the UI (what to show), so both agree.
 *
 * - An admin never sees super_admins and edits only operators and supervisors.
 * - A super_admin sees and edits everyone, but cannot demote or disable themselves.
 * - The super_admin role is given only through "Grant super admin".
 */
import type { Role, User } from '@/types'

type Actor = Pick<User, 'id' | 'role'>
type Target = Pick<User, 'id' | 'role'>

export const ROLE_ORDER: Role[] = ['super_admin', 'admin', 'supervisor', 'operator']

export const isAdminRole = (role: Role | null | undefined): boolean => role === 'admin' || role === 'super_admin'

/** Can the actor see this user in the list at all. */
export function canSee(actor: Actor, target: Target): boolean {
  if (actor.role === 'super_admin') return true
  if (actor.role === 'admin') return target.role !== 'super_admin'
  return false
}

/** Can the actor open the edit modal / reset the password of this user. */
export function canEdit(actor: Actor, target: Target): boolean {
  if (actor.role === 'super_admin') return true
  if (actor.role === 'admin') return target.role === 'operator' || target.role === 'supervisor'
  return false
}

/** Can the actor enable or disable this user. Nobody disables themselves. */
export function canToggleActive(actor: Actor, target: Target): boolean {
  return canEdit(actor, target) && actor.id !== target.id
}

/** Can the actor change the role of this user. Nobody changes their own role. */
export function canChangeRole(actor: Actor, target: Target): boolean {
  return canEdit(actor, target) && actor.id !== target.id
}

/** Grant super admin: super_admin only, to someone who is not one yet and is active. */
export function canGrantSuperAdmin(actor: Actor, target: Target & { isActive?: boolean }): boolean {
  return actor.role === 'super_admin' && target.role !== 'super_admin' && target.isActive !== false
}

/**
 * Roles the actor may pick in the create/edit modal. super_admin is never
 * pickable (it is granted), but stays listed when the target already holds it.
 */
export function assignableRoles(actor: Actor, currentRole?: Role): Role[] {
  const roles: Role[] = actor.role === 'super_admin' ? ['operator', 'supervisor', 'admin'] : actor.role === 'admin' ? ['operator', 'supervisor'] : []
  if (currentRole && !roles.includes(currentRole)) return [...roles, currentRole]
  return roles
}

/** Roles the actor may filter by (the super_admin option only for super_admin). */
export function filterableRoles(actor: Actor): Role[] {
  return actor.role === 'super_admin' ? ROLE_ORDER : ROLE_ORDER.filter((role) => role !== 'super_admin')
}

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EXTENSION_RE = /^\d{3,6}$/
export const MIN_PASSWORD = 8
