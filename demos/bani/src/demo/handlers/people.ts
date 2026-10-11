/**
 * Mock API + simulators for the "people" feature group (PLAN section 6):
 * console users (directory, local and API accounts), the directory they are
 * picked from, and the group -> role mapping. Every route requires the `users`
 * feature, which only the superadmin holds.
 * Import store/api/bus helpers from '../core' only.
 */
import { DemoApiError, every, notFound } from '@portfolio/demo-kit'

import { ROLE_IDS, USER_ROLES } from '@/lib/rbac'
import type {
  ConsoleUser,
  CreateUserRequest,
  CreateUserResponse,
  DirectoryEntry,
  LdapRoleMapping,
  LdapRoleMappingConfig,
  UpdateUserRequest,
  UserRole,
  UserType,
} from '@/types'
import { api, bus, nowIso, requireFeature, store } from '../core'

const FEATURE = 'users' as const
const USER_TYPES: readonly UserType[] = ['ldap', 'internal', 'api_service']
const USERNAME_RE = /^[a-z0-9][a-z0-9._@-]*$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
/** Roles a directory group can grant (an API account is never granted by group). */
const MAPPABLE_ROLES: readonly string[] = ROLE_IDS

/* ----------------------------------------------------------------- helpers */

/** 16 characters without look-alikes (no 0/O, 1/l/I), at least one of each class. */
const PASSWORD_ALPHABET = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digit: '23456789',
  symbol: '#$%&*+-=?@',
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return (buf[0] ?? 0) % max
}

export function generatePassword(length = 16): string {
  const classes = Object.values(PASSWORD_ALPHABET)
  const all = classes.join('')
  const chars: string[] = classes.map((set) => set.charAt(randomInt(set.length)))
  while (chars.length < length) chars.push(all.charAt(randomInt(all.length)))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j] as string, chars[i] as string]
  }
  return chars.join('')
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const lower = (v: string): string => v.toLowerCase()

function toUser(u: ConsoleUser): ConsoleUser {
  return { ...u, allowedCampaigns: [...u.allowedCampaigns] }
}

function findUser(id: string): ConsoleUser {
  const user = store.data.users.find((u) => u.id === id)
  if (!user) throw notFound(`User ${id} was not found.`)
  return user
}

function registeredNames(): Set<string> {
  return new Set(store.data.users.map((u) => lower(u.username)))
}

function validCampaigns(ids: unknown, errors: Record<string, string>): string[] {
  if (ids === undefined) return []
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) {
    errors.allowedCampaigns = 'Invalid campaign list.'
    return []
  }
  const known = new Set(store.data.campaigns.map((c) => c.id))
  const unique = [...new Set(ids as string[])]
  if (unique.some((id) => !known.has(id))) errors.allowedCampaigns = 'One or more campaigns do not exist.'
  return unique.filter((id) => known.has(id))
}

function checkEmail(email: string, errors: Record<string, string>): void {
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
}

function checkPassword(password: string, errors: Record<string, string>): void {
  if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`
}

function fail(errors: Record<string, string>): void {
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
}

function changed(): void {
  bus.emit('users:changed')
}

/* ---------------------------------------------------------------- simulator */

/**
 * Directory users keep signing in around the console: now and then an active
 * directory or local account gets a fresh "last login", so the table feels live.
 */
function simulateSignIn(): void {
  const candidates = store.data.users.filter((u) => u.isActive && u.userType !== 'api_service' && u.username !== 'breakglass')
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  if (!pick) return
  const now = nowIso()
  pick.lastLoginAt = now
  changed()
}

/* ----------------------------------------------------------------- register */

export function register(): void {
  api.register('GET', '/users', () => {
    requireFeature(FEATURE)
    return store.data.users.map(toUser).sort((a, b) => a.username.localeCompare(b.username))
  })

  api.register('POST', '/users', ({ body }): CreateUserResponse => {
    requireFeature(FEATURE)
    const input = (body ?? {}) as Partial<CreateUserRequest>
    const errors: Record<string, string> = {}

    const role = input.role as UserRole | undefined
    if (!role || !USER_ROLES.includes(role)) errors.role = 'Choose a role.'
    let userType = input.userType as UserType | undefined
    if (!userType || !USER_TYPES.includes(userType)) errors.userType = 'Choose a user type.'
    // An API account is the one role that forces its own user type, and vice versa.
    if (role === 'api_service') userType = 'api_service'
    else if (userType === 'api_service') errors.userType = 'API accounts must use the API account role.'

    const username = clean(input.username)
    if (!username) errors.username = 'Username is required.'
    else if (username.length < 3 || username.length > 64 || !USERNAME_RE.test(username)) {
      errors.username = 'Use 3-64 letters, digits, dots, dashes or underscores.'
    } else if (registeredNames().has(lower(username))) errors.username = 'This username is already registered.'

    let displayName = clean(input.displayName)
    let email = clean(input.email)
    checkEmail(email, errors)
    if (displayName.length > 120) errors.displayName = 'Use at most 120 characters.'

    let password = ''
    let generated = false
    if (userType === 'ldap') {
      const entry = store.data.directory.find((d) => lower(d.username) === lower(username))
      if (username && !errors.username && !entry) errors.username = 'This username was not found in the directory.'
      if (entry) {
        displayName = displayName || entry.displayName
        email = email || entry.email
      }
    } else if (userType) {
      password = typeof input.password === 'string' ? input.password : ''
      if (password) checkPassword(password, errors)
      else {
        password = generatePassword()
        generated = true
      }
    }

    const accessMode = userType === 'ldap' && input.accessMode === 'group' ? 'group' : 'direct'
    const allowedCampaigns = role === 'cc-admin' ? validCampaigns(input.allowedCampaigns, errors) : []
    fail(errors)

    const now = nowIso()
    const user: ConsoleUser = {
      id: store.nextId('usr-'),
      username: userType === 'ldap' ? (store.data.directory.find((d) => lower(d.username) === lower(username))?.username ?? username) : username,
      email: email || null,
      displayName: displayName || null,
      role: role as UserRole,
      userType: userType as UserType,
      isActive: input.isActive !== false,
      accessMode,
      description: clean(input.description),
      downloadFormat: input.downloadFormat === 'original' ? 'original' : 'mp3',
      allowedCampaigns,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    }
    store.data.users.push(user)
    changed()
    return { user: toUser(user), ...(generated ? { generatedPassword: password } : {}) }
  })

  api.register('PATCH', '/users/:id', ({ path, body }): ConsoleUser => {
    const me = requireFeature(FEATURE)
    const user = findUser(path.id ?? '')
    const input = (body ?? {}) as UpdateUserRequest & { accessMode?: string }
    const errors: Record<string, string> = {}
    const isSelf = lower(user.username) === lower(me.username)

    let role = user.role
    if (input.role !== undefined && input.role !== user.role) {
      if (!USER_ROLES.includes(input.role)) errors.role = 'Choose a role.'
      else if (user.userType === 'api_service') errors.role = 'The role of an API account cannot be changed.'
      else if (input.role === 'api_service') errors.role = 'Create an API account instead of converting a user.'
      else if (isSelf) errors.role = 'You cannot change your own role.'
      else role = input.role
    }

    if (input.isActive === false && isSelf) errors.isActive = 'You cannot disable your own account.'

    if (input.email !== undefined) checkEmail(clean(input.email), errors)
    if (input.displayName !== undefined && clean(input.displayName).length > 120) errors.displayName = 'Use at most 120 characters.'
    if (input.description !== undefined && clean(input.description).length > 280) errors.description = 'Use at most 280 characters.'

    if (input.password) {
      if (user.userType === 'ldap') errors.password = 'Directory accounts sign in with their directory password.'
      else checkPassword(input.password, errors)
    }

    const campaigns = role === 'cc-admin' ? validCampaigns(input.allowedCampaigns ?? user.allowedCampaigns, errors) : []
    fail(errors)

    user.role = role
    if (input.displayName !== undefined) user.displayName = clean(input.displayName) || null
    if (input.email !== undefined) user.email = clean(input.email) || null
    if (input.description !== undefined) user.description = clean(input.description)
    if (input.isActive !== undefined) user.isActive = Boolean(input.isActive)
    if (input.downloadFormat !== undefined && user.userType === 'api_service') {
      user.downloadFormat = input.downloadFormat === 'original' ? 'original' : 'mp3'
    }
    if (user.userType === 'ldap' && (input.accessMode === 'direct' || input.accessMode === 'group')) {
      user.accessMode = input.accessMode
    }
    user.allowedCampaigns = campaigns
    user.updatedAt = nowIso()
    changed()
    return toUser(user)
  })

  api.register('POST', '/users/:id/password', ({ path }): { password: string } => {
    requireFeature(FEATURE)
    const user = findUser(path.id ?? '')
    if (user.userType === 'ldap') {
      throw DemoApiError.validation({ password: 'Directory accounts sign in with their directory password.' })
    }
    user.updatedAt = nowIso()
    changed()
    return { password: generatePassword() }
  })

  api.register('DELETE', '/users/:id', ({ path }) => {
    const me = requireFeature(FEATURE)
    const user = findUser(path.id ?? '')
    if (user.role === 'superadmin') throw new DemoApiError(400, 'The superadmin account cannot be deleted.')
    if (lower(user.username) === lower(me.username)) throw new DemoApiError(400, 'You cannot delete your own account.')
    store.data.users = store.data.users.filter((u) => u.id !== user.id)
    changed()
    return undefined
  })

  api.register('GET', '/directory', ({ params }): DirectoryEntry[] => {
    requireFeature(FEATURE)
    const needle = lower(params.search ?? '').trim()
    const taken = registeredNames()
    return store.data.directory
      .filter((d) => !needle || lower(`${d.username} ${d.displayName} ${d.email}`).includes(needle))
      .map((d) => ({ ...d, alreadyRegistered: taken.has(lower(d.username)) }))
  })

  api.register('GET', '/directory/role-mappings', (): LdapRoleMappingConfig => {
    requireFeature(FEATURE)
    const { mappings, nestedGroups } = store.data.ldapRoleMappings
    return { mappings: mappings.map((m) => ({ ...m })), nestedGroups }
  })

  api.register('PUT', '/directory/role-mappings', ({ body }): LdapRoleMappingConfig => {
    requireFeature(FEATURE)
    const input = (body ?? {}) as Partial<LdapRoleMappingConfig>
    const errors: Record<string, string> = {}
    const rows = Array.isArray(input.mappings) ? input.mappings : []
    if (!Array.isArray(input.mappings)) errors.mappings = 'Invalid mapping list.'
    const seen = new Set<string>()
    const mappings: LdapRoleMapping[] = []
    rows.forEach((row, i) => {
      const groupDn = clean(row?.groupDn)
      const role = row?.role
      if (!groupDn) errors[`mappings.${i}.groupDn`] = 'Enter a group distinguished name.'
      else if (!groupDn.includes('=')) errors[`mappings.${i}.groupDn`] = 'Use a distinguished name such as CN=group,OU=Groups,DC=example.'
      else if (seen.has(lower(groupDn))) errors[`mappings.${i}.groupDn`] = 'This group is already mapped.'
      if (!role || !MAPPABLE_ROLES.includes(role)) errors[`mappings.${i}.role`] = 'Choose a role.'
      seen.add(lower(groupDn))
      mappings.push({ groupDn, role: role as LdapRoleMapping['role'] })
    })
    fail(errors)
    store.data.ldapRoleMappings = { mappings, nestedGroups: Boolean(input.nestedGroups) }
    changed()
    return { mappings: mappings.map((m) => ({ ...m })), nestedGroups: Boolean(input.nestedGroups) }
  })

  // Ambient: someone signs in every ~40 s (paused while the tab is hidden).
  every(40_000, simulateSignIn)
}
