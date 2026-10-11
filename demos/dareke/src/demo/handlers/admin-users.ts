/**
 * Mock API handlers for "admin-users":
 * GET /admin/dashboard, GET/POST /users, PATCH /users/:id,
 * POST /users/:id/reset-password | active | grant-super-admin.
 *
 * Error messages are keys of the `people` namespace (`errors.*`), translated by the UI.
 * The role matrix lives in `@/features/admin-users/rules` and is enforced here.
 */
import { DemoApiError, conflict, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'

import {
  EMAIL_RE,
  EXTENSION_RE,
  MIN_PASSWORD,
  ROLE_ORDER,
  USERNAME_RE,
  assignableRoles,
  canChangeRole,
  canEdit,
  canGrantSuperAdmin,
  canSee,
  canToggleActive,
} from '@/features/admin-users/rules'
import type { AdminDashboardData, Localized, Role, User } from '@/types'
import { DEMO_PASSWORD } from '../accounts'
import { agentStateOf, changed, nowIso, requireRole, setAgentStatus, startOfToday, statusIdByName, withStats } from '../domain'
import { store } from '../store'

/** The dashboard payload plus the campaign the "Upload numbers" quick action opens. */
export interface AdminDashboardResponse extends AdminDashboardData {
  uploadCampaign: { id: string; name: Localized } | null
}

export interface UserInput {
  username?: unknown
  displayName?: { en?: unknown; ka?: unknown }
  email?: unknown
  role?: unknown
  sipExtension?: unknown
  password?: unknown
  confirmPassword?: unknown
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLE_ORDER as string[]).includes(value)

function findVisible(actor: User, id: string): User {
  const target = store.data.users.find((user) => user.id === id)
  // An admin must not learn that a super_admin exists: answer 404, not 403.
  if (!target || !canSee(actor, target)) throw notFound('errors.notFound')
  return target
}

function editable(actor: User, id: string): User {
  const target = findVisible(actor, id)
  if (!canEdit(actor, target)) throw forbidden('errors.forbidden')
  return target
}

/** Shared field checks for create and edit. Returns the cleaned values. */
function validateProfile(input: UserInput, self: User | null) {
  const fields: Record<string, string> = {}
  const nameEn = str(input.displayName?.en)
  const nameKa = str(input.displayName?.ka)
  const email = str(input.email).toLowerCase()
  const ext = str(input.sipExtension)

  if (!nameEn) fields['displayName.en'] = 'errors.nameRequired'
  if (!email) fields.email = 'errors.emailRequired'
  else if (!EMAIL_RE.test(email)) fields.email = 'errors.emailInvalid'
  else if (store.data.users.some((user) => user.email.toLowerCase() === email && user.id !== self?.id)) fields.email = 'errors.emailTaken'
  if (ext && !EXTENSION_RE.test(ext)) fields.sipExtension = 'errors.extensionInvalid'
  else if (ext && store.data.users.some((user) => user.sipExtension === ext && user.id !== self?.id)) fields.sipExtension = 'errors.extensionTaken'

  const displayName: Localized = { en: nameEn, ka: nameKa || nameEn }
  return { fields, displayName, email, sipExtension: ext || null }
}

function newUserId(username: string): string {
  const base = `u_${username.replace(/[^a-z0-9]/g, '_')}`
  let id = base
  for (let n = 2; store.data.users.some((user) => user.id === id); n += 1) id = `${base}_${n}`
  return id
}

export function register(api: MockApi): void {
  api.register('GET', '/admin/dashboard', () => {
    const actor = requireRole('admin', 'super_admin')
    const campaigns = store.data.campaigns
    const since = startOfToday()
    const recent = campaigns
      .filter((campaign) => campaign.status !== 'archived')
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5)
    const firstActive = campaigns.find((campaign) => campaign.status === 'active') ?? null
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      totalUsers: store.data.users.filter((user) => canSee(actor, user)).length,
      activeOperators: store.data.users.filter((user) => user.role === 'operator' && user.isActive).length,
      callsToday: store.data.calls.filter((call) => Date.parse(call.callInitiatedAt) >= since).length,
      recentCampaigns: recent.map(withStats),
      uploadCampaign: firstActive ? { id: firstActive.id, name: firstActive.name } : null,
    } satisfies AdminDashboardResponse
  })

  api.register('GET', '/users', ({ params }) => {
    const actor = requireRole('admin', 'super_admin')
    const role = str(params.role)
    const q = str(params.q).toLowerCase()
    const active = str(params.active)
    return store.data.users
      .filter((user) => canSee(actor, user))
      .filter((user) => !role || role === 'all' || user.role === role)
      .filter((user) => (active === 'active' ? user.isActive : active === 'inactive' ? !user.isActive : true))
      .filter((user) => {
        if (!q) return true
        const hay = [user.username, user.email, user.displayName.en, user.displayName.ka, user.sipExtension ?? ''].join(' ').toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.displayName.en.localeCompare(b.displayName.en))
  })

  api.register('POST', '/users', ({ body }) => {
    const actor = requireRole('admin', 'super_admin')
    const input = (body ?? {}) as UserInput
    const { fields, displayName, email, sipExtension } = validateProfile(input, null)
    const username = str(input.username).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    const confirm = typeof input.confirmPassword === 'string' ? input.confirmPassword : ''

    if (!username) fields.username = 'errors.usernameRequired'
    else if (!USERNAME_RE.test(username)) fields.username = 'errors.usernameInvalid'
    else if (store.data.users.some((user) => user.username === username)) fields.username = 'errors.usernameTaken'
    if (!isRole(input.role) || !assignableRoles(actor).includes(input.role)) fields.role = 'errors.roleNotAllowed'
    if (!password) fields.password = 'errors.passwordRequired'
    else if (password.length < MIN_PASSWORD) fields.password = 'errors.passwordShort'
    if (password && confirm !== password) fields.confirmPassword = 'errors.passwordMismatch'
    if (Object.keys(fields).length > 0) throw DemoApiError.validation(fields)

    const user: User = {
      id: newUserId(username),
      username,
      displayName,
      email,
      role: input.role as Role,
      sipExtension,
      isActive: true,
      createdAt: nowIso(),
      lastLoginAt: null,
    }
    store.data.users.push(user)
    // Operators need a live state row so the wall and assignment screens can show them.
    if (user.role === 'operator') setAgentStatus(user.id, statusIdByName('offline'))
    changed('users', 'agents', 'metrics', 'campaigns')
    return user
  })

  api.register('PATCH', '/users/:id', ({ path, body }) => {
    const actor = requireRole('admin', 'super_admin')
    const target = editable(actor, path.id)
    const input = (body ?? {}) as UserInput
    if (input.username !== undefined && str(input.username).toLowerCase() !== target.username) {
      throw DemoApiError.validation({ username: 'errors.usernameLocked' })
    }
    const { fields, displayName, email, sipExtension } = validateProfile(input, target)
    let role = target.role
    if (input.role !== undefined && input.role !== target.role) {
      if (!canChangeRole(actor, target)) fields.role = 'errors.ownRole'
      else if (!isRole(input.role) || !assignableRoles(actor).includes(input.role)) fields.role = 'errors.roleNotAllowed'
      else role = input.role
    }
    if (Object.keys(fields).length > 0) throw DemoApiError.validation(fields)
    if (role !== target.role && target.role === 'operator' && agentStateOf(target.id)?.currentCallId) {
      throw conflict('errors.onCall')
    }

    const wasOperator = target.role === 'operator'
    Object.assign(target, { displayName, email, sipExtension, role })
    if (!wasOperator && role === 'operator' && !agentStateOf(target.id)) setAgentStatus(target.id, statusIdByName('offline'))
    if (wasOperator && role !== 'operator') {
      store.data.campaignAgents = store.data.campaignAgents.filter((link) => link.agentId !== target.id)
      store.data.agentStates = store.data.agentStates.filter((state) => state.agentId !== target.id)
    }
    changed('users', 'agents', 'metrics', 'campaigns', 'me')
    return target
  })

  api.register('POST', '/users/:id/reset-password', ({ path, body }) => {
    const actor = requireRole('admin', 'super_admin')
    editable(actor, path.id)
    const { password, confirmPassword } = (body ?? {}) as { password?: unknown; confirmPassword?: unknown }
    const fields: Record<string, string> = {}
    const pwd = typeof password === 'string' ? password : ''
    if (!pwd) fields.password = 'errors.passwordRequired'
    else if (pwd.length < MIN_PASSWORD) fields.password = 'errors.passwordShort'
    if (pwd && confirmPassword !== pwd) fields.confirmPassword = 'errors.passwordMismatch'
    if (Object.keys(fields).length > 0) throw DemoApiError.validation(fields)
    // Demo: every account keeps the shared demo password, so nothing is stored.
    return { ok: true }
  })

  api.register('POST', '/users/:id/active', ({ path, body }) => {
    const actor = requireRole('admin', 'super_admin')
    const target = editable(actor, path.id)
    if (!canToggleActive(actor, target)) throw conflict('errors.ownActive')
    const isActive = Boolean((body as { isActive?: unknown } | null)?.isActive)
    if (target.isActive === isActive) return target
    if (!isActive && target.role === 'operator') {
      const state = agentStateOf(target.id)
      if (state?.currentCallId) throw conflict('errors.onCall')
      setAgentStatus(target.id, statusIdByName('offline'))
    }
    target.isActive = isActive
    changed('users', 'agents', 'metrics', 'campaigns')
    return target
  })

  api.register('POST', '/users/:id/grant-super-admin', ({ path, body }) => {
    const actor = requireRole('super_admin')
    const target = findVisible(actor, path.id)
    const { confirmPassword } = (body ?? {}) as { confirmPassword?: unknown }
    if (typeof confirmPassword !== 'string' || !confirmPassword) {
      throw DemoApiError.validation({ confirmPassword: 'errors.confirmRequired' })
    }
    if (confirmPassword !== DEMO_PASSWORD) throw DemoApiError.validation({ confirmPassword: 'errors.confirmWrong' })
    if (!canGrantSuperAdmin(actor, target)) throw conflict(target.role === 'super_admin' ? 'errors.alreadySuper' : 'errors.inactiveTarget')
    if (target.role === 'operator') {
      if (agentStateOf(target.id)?.currentCallId) throw conflict('errors.onCall')
      store.data.campaignAgents = store.data.campaignAgents.filter((link) => link.agentId !== target.id)
      store.data.agentStates = store.data.agentStates.filter((state) => state.agentId !== target.id)
    }
    target.role = 'super_admin'
    changed('users', 'agents', 'metrics', 'campaigns')
    return target
  })
}
