/** Role predicates shared by handlers, guards and UI (port of the source's roles.ts). */
import type { Role } from '@/types'

export const STAFF_ROLES: readonly Role[] = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR']

/** SUPERADMIN, ADMIN, SUPERVISOR: console access, always see the standings. */
export const isStaffRole = (role: Role): boolean => role !== 'PLAYER'
/** SUPERADMIN, ADMIN: CRUD on events, items, trivia and prizes. */
export const canEditRole = (role: Role): boolean => role === 'SUPERADMIN' || role === 'ADMIN'
/** SUPERADMIN: the People page. */
export const isSuperRole = (role: Role): boolean => role === 'SUPERADMIN'

export type Access = 'staff' | 'editor' | 'super'

export function roleAllows(role: Role, access: Access): boolean {
  if (access === 'super') return isSuperRole(role)
  if (access === 'editor') return canEditRole(role)
  return isStaffRole(role)
}
