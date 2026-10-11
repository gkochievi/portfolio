/**
 * Owner: group people (see PLAN.md). Endpoints:
 *   GET|POST /admin/users, PATCH|DELETE /admin/users/:userId, GET /admin/participants
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { ParticipantRow, Role, User } from '@/types'
import { requireStaff, requireSuper } from '../guards'
import { bus, nowIso, store } from '../store'

const ROLES: readonly Role[] = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR', 'PLAYER']
const ROLE_ORDER: Record<Role, number> = { SUPERADMIN: 0, ADMIN: 1, SUPERVISOR: 2, PLAYER: 3 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as readonly string[]).includes(value)
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function findUser(userId: string | undefined): User {
  const user = store.data.users.find((candidate) => candidate.id === userId)
  if (!user) throw new DemoApiError(404, 'common:errors.notFound')
  return user
}

function sortedUsers(): User[] {
  return [...store.data.users].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.localeCompare(b.createdAt),
  )
}

/** Best single round across every play (0 when none, as the source's export) and the play count. */
function playStats(): Map<string, { best: number; plays: number }> {
  const stats = new Map<string, { best: number; plays: number }>()
  for (const play of store.data.plays) {
    const current = stats.get(play.userId) ?? { best: 0, plays: 0 }
    current.best = Math.max(current.best, play.score)
    current.plays += 1
    stats.set(play.userId, current)
  }
  return stats
}

export function registerPeople(api: MockApi): void {
  api.register('GET', '/admin/users', () => {
    requireSuper()
    return sortedUsers()
  })

  api.register('POST', '/admin/users', ({ body }) => {
    requireSuper()
    const input = (body ?? {}) as Record<string, unknown>
    const firstName = str(input.firstName)
    const lastName = str(input.lastName)
    const email = str(input.email).toLowerCase()
    const username = str(input.username).toLowerCase()
    const role = input.role

    const errors: Record<string, string> = {}
    if (!firstName) errors.firstName = 'common:errors.required'
    if (!lastName) errors.lastName = 'common:errors.required'
    if (!email) errors.email = 'common:errors.required'
    else if (!EMAIL_RE.test(email)) errors.email = 'common:errors.invalidEmail'
    if (username && !USERNAME_RE.test(username)) errors.username = 'people:errors.usernameInvalid'
    if (!isRole(role)) errors.role = 'common:errors.required'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)

    if (store.data.users.some((user) => user.email.toLowerCase() === email)) {
      throw new DemoApiError(409, 'people:errors.emailTaken', { email: 'people:errors.emailTaken' })
    }
    if (username && store.data.users.some((user) => user.username?.toLowerCase() === username)) {
      throw new DemoApiError(409, 'people:errors.usernameTaken', { username: 'people:errors.usernameTaken' })
    }

    const validRole = role as Role
    const user: User = {
      id: store.nextId('usr_'),
      email,
      username: username || null,
      firstName,
      lastName,
      phone: '',
      company: '',
      position: '',
      role: validRole,
      isAdmin: validRole === 'SUPERADMIN' || validRole === 'ADMIN',
      disabled: false,
      guest: false,
      createdAt: nowIso(),
    }
    store.data.users.push(user)
    store.notify()
    bus.emit('user:changed', { userId: user.id })
    return user
  })

  api.register('PATCH', '/admin/users/:userId', ({ path, body }) => {
    const me = requireSuper()
    const user = findUser(path.userId)
    const input = (body ?? {}) as { role?: unknown; disabled?: unknown }

    if (input.role !== undefined) {
      if (!isRole(input.role)) throw DemoApiError.validation({ role: 'common:errors.required' })
      if (user.id === me.id && input.role !== user.role) throw new DemoApiError(403, 'people:errors.cannotChangeSelf')
      user.role = input.role
      user.isAdmin = input.role === 'SUPERADMIN' || input.role === 'ADMIN'
    }
    if (input.disabled !== undefined) {
      const disabled = Boolean(input.disabled)
      if (disabled && user.id === me.id) throw new DemoApiError(403, 'people:errors.cannotSuspendSelf')
      if (disabled && user.role === 'SUPERADMIN') throw new DemoApiError(403, 'people:errors.superProtected')
      user.disabled = disabled
    }

    store.notify()
    bus.emit('user:changed', { userId: user.id })
    return user
  })

  api.register('DELETE', '/admin/users/:userId', ({ path }) => {
    const me = requireSuper()
    const user = findUser(path.userId)
    if (user.id === me.id) throw new DemoApiError(403, 'people:errors.cannotDeleteSelf')
    if (user.role === 'SUPERADMIN') throw new DemoApiError(403, 'people:errors.superProtected')

    const db = store.data
    db.plays = db.plays.filter((play) => play.userId !== user.id)
    db.answers = db.answers.filter((answer) => answer.userId !== user.id)
    db.users = db.users.filter((candidate) => candidate.id !== user.id)
    store.notify()
    bus.emit('user:changed', { userId: user.id })
    return { ok: true }
  })

  api.register('GET', '/admin/participants', ({ params }) => {
    requireStaff()
    const q = (params.q ?? '').trim().toLowerCase()
    const stats = playStats()
    return store.data.users
      .filter((user) => user.role === 'PLAYER')
      .filter(
        (user) =>
          !q ||
          [user.firstName, user.lastName, user.email, user.company, user.position, user.phone, user.username ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map<ParticipantRow>((user) => {
        const stat = stats.get(user.id)
        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          company: user.company,
          position: user.position,
          best: stat?.best ?? 0,
          plays: stat?.plays ?? 0,
          createdAt: user.createdAt,
        }
      })
  })
}
