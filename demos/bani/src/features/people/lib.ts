import type { ConsoleUser, UserRole } from '@/types'

export const MIN_PASSWORD = 8
export const USERNAME_RE = /^[a-z0-9][a-z0-9._@-]{2,63}$/i
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Roles a human console user can hold (an API account is created through its own role). */
export const HUMAN_ROLES = (roles: readonly UserRole[]): UserRole[] => roles.filter((r) => r !== 'api_service')

export const userLabel = (u: Pick<ConsoleUser, 'username' | 'displayName'>): string => u.displayName?.trim() || u.username
