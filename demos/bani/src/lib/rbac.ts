/**
 * Central access rules. Pure: the shell (nav, route guards), the mock API (403s)
 * and the Roles page all read from here, so one override flips a feature everywhere.
 *
 * Layering, lowest to highest priority:
 *   1. DEFAULTS: what each role ships with.
 *   2. overrides: edited on the Roles page (store.data.rbacOverrides).
 *   3. superadmin: always allowed, never shown in the matrix.
 * `users` and `rbac` are not overridable: granting them would be an escalation path.
 */
import type { CdrSource, CdrSourceFilter, FeatureKey, RbacOverrides, RbacRole, RoleId, UserRole } from '@/types'

export const FEATURES: readonly { key: FeatureKey; overridable: boolean }[] = [
  { key: 'cdr', overridable: true },
  { key: 'cc_campaigns', overridable: true },
  { key: 'cc_agents', overridable: true },
  { key: 'cc_nodes', overridable: true },
  { key: 'extensions', overridable: true },
  { key: 'systems_sync', overridable: true },
  { key: 'logs', overridable: true },
  { key: 'health', overridable: true },
  { key: 'settings', overridable: true },
  { key: 'users', overridable: false },
  { key: 'rbac', overridable: false },
]

export const FEATURE_KEYS: readonly FeatureKey[] = FEATURES.map((f) => f.key)

/** Every console role, most privileged first (also the persona order). */
export const ROLE_IDS: readonly RoleId[] = [
  'superadmin',
  'admin',
  'cc-admin',
  'tel-admin',
  'cc-operator',
  'tel-operator',
  'it-support',
  'user',
]

/** Columns of the permission matrix. superadmin is never restricted, so never shown. */
export const RBAC_ROLES: readonly RbacRole[] = [
  'admin',
  'user',
  'cc-admin',
  'tel-admin',
  'cc-operator',
  'tel-operator',
  'it-support',
]

/** Every role a console user can hold, for pickers (People). */
export const USER_ROLES: readonly UserRole[] = [...ROLE_IDS, 'api_service']

const DEFAULTS: Record<FeatureKey, readonly RbacRole[]> = {
  cdr: ['admin', 'user', 'cc-admin', 'tel-admin', 'cc-operator', 'tel-operator'],
  cc_campaigns: ['admin', 'cc-admin'],
  cc_agents: ['admin', 'cc-admin'],
  cc_nodes: ['admin', 'cc-admin'],
  extensions: ['admin', 'it-support'],
  systems_sync: ['admin'],
  logs: ['admin'],
  health: ['admin'],
  settings: ['admin'],
  users: [],
  rbac: ['admin'],
}

export function isRbacRole(role: string): role is RbacRole {
  return (RBAC_ROLES as readonly string[]).includes(role)
}

export function isOverridable(feature: FeatureKey): boolean {
  return FEATURES.find((f) => f.key === feature)?.overridable ?? false
}

/** Whether a role has a feature by default (ignores overrides and superadmin). */
export function defaultAllows(role: string, feature: FeatureKey): boolean {
  return (DEFAULTS[feature] as readonly string[]).includes(role)
}

/** Defaults per matrix role, for the Roles page. */
export function defaultsByRole(): Record<RbacRole, FeatureKey[]> {
  const out = {} as Record<RbacRole, FeatureKey[]>
  for (const role of RBAC_ROLES) out[role] = FEATURE_KEYS.filter((f) => defaultAllows(role, f))
  return out
}

/** The core decision. */
export function roleCan(role: string | null | undefined, feature: FeatureKey, overrides?: RbacOverrides | null): boolean {
  if (role === 'superadmin') return true
  if (!role) return false
  if (isOverridable(feature) && isRbacRole(role)) {
    const override = overrides?.[role]?.[feature]
    if (typeof override === 'boolean') return override
  }
  return defaultAllows(role, feature)
}

export function allowedFeatures(role: string | null | undefined, overrides?: RbacOverrides | null): FeatureKey[] {
  return FEATURE_KEYS.filter((f) => roleCan(role, f, overrides))
}

/**
 * Keep only known matrix roles, overridable features and boolean values. A
 * non-superadmin's edits to its own row are dropped (the stored row is kept).
 */
export function sanitizeOverrides(input: unknown, actorRole: RoleId, current: RbacOverrides): RbacOverrides {
  const out: RbacOverrides = {}
  if (typeof input !== 'object' || input === null) return out
  for (const [role, features] of Object.entries(input as Record<string, unknown>)) {
    if (!isRbacRole(role)) continue
    if (actorRole !== 'superadmin' && role === actorRole) {
      if (current[role]) out[role] = { ...current[role] }
      continue
    }
    if (typeof features !== 'object' || features === null) continue
    const row: Partial<Record<FeatureKey, boolean>> = {}
    for (const [feature, value] of Object.entries(features as Record<string, unknown>)) {
      if (!(FEATURE_KEYS as readonly string[]).includes(feature)) continue
      if (!isOverridable(feature as FeatureKey) || typeof value !== 'boolean') continue
      row[feature as FeatureKey] = value
    }
    if (Object.keys(row).length > 0) out[role] = row
  }
  return out
}

/* ---------------------------------------------------------- call sources */

/** Which call-record sources a role may query. Empty = no call access at all. */
export function allowedCdrSources(role: string | null | undefined): CdrSource[] {
  switch (role) {
    case 'superadmin':
    case 'admin':
    case 'user':
      return ['core', 'edge']
    case 'cc-admin':
    case 'cc-operator':
      return ['core']
    case 'tel-admin':
    case 'tel-operator':
      return ['edge']
    default:
      return []
  }
}

/**
 * Clamp a requested source to what the role may see. Roles granted `cdr` by an
 * override but with no source of their own get both. Null = no call access.
 */
export function effectiveCdrSource(
  role: string | null | undefined,
  requested: CdrSourceFilter,
  overrides?: RbacOverrides | null,
): CdrSourceFilter | null {
  if (!roleCan(role, 'cdr', overrides)) return null
  const allowed = allowedCdrSources(role)
  if (allowed.length === 0 || allowed.length === 2) return requested
  return allowed[0] ?? null
}

/** The extension activity log is for administrators only (IT support creates, but does not audit). */
export function canSeeExtensionActivity(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin'
}

/* --------------------------------------------------------------- routing */

/** Root-redirect order (spec): the first allowed one wins. */
export const ROUTE_FEATURES: readonly { path: string; feature: FeatureKey }[] = [
  { path: '/calls', feature: 'cdr' },
  { path: '/campaigns', feature: 'cc_campaigns' },
  { path: '/agents', feature: 'cc_agents' },
  { path: '/nodes', feature: 'cc_nodes' },
  { path: '/extensions', feature: 'extensions' },
  { path: '/archive', feature: 'systems_sync' },
  { path: '/activity', feature: 'logs' },
  { path: '/status', feature: 'health' },
  { path: '/connections', feature: 'settings' },
  { path: '/people', feature: 'users' },
  { path: '/roles', feature: 'rbac' },
]

/** Where `/` sends this role. '/login' when it may see nothing. */
export function firstAllowedPath(role: string | null | undefined, overrides?: RbacOverrides | null): string {
  return ROUTE_FEATURES.find((r) => roleCan(role, r.feature, overrides))?.path ?? '/login'
}
