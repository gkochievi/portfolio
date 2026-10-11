/**
 * Owner: shell. Sign-in endpoints (port of the source's login, guest and
 * one-time-code flows). Every route here is public by the `/auth/` prefix.
 *
 *   POST /auth/login        {identifier, password}  -> SessionUser
 *   POST /auth/demo         {accountId}             -> SessionUser
 *   POST /auth/otp/request  {email}                 -> {sent: true}
 *   POST /auth/otp/verify   {email, code}           -> SessionUser
 *   POST /auth/register     RegisterBody            -> SessionUser (PLAYER)
 *   POST /auth/logout                               -> 204
 *   GET  /auth/me                                   -> SessionUser | null
 *
 * A seeded email or username needs the demo password; any other well-formed
 * email signs in as a new guest PLAYER. The one-time code is always DEMO_OTP.
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { SessionUser, User } from '@/types'
import { auth } from '../auth'
import { currentUser, toSessionUser } from '../guards'
import { DEMO_ACCOUNTS, DEMO_OTP, DEMO_PASSWORD } from '../seed/accounts'
import { bus, nowIso, store } from '../store'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function str(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function findUser(identifier: string): User | undefined {
  const needle = identifier.toLowerCase()
  return store.data.users.find(
    (user) => user.email.toLowerCase() === needle || (user.username ?? '').toLowerCase() === needle,
  )
}

let sequence = 0
function newUserId(): string {
  sequence += 1
  return `usr_${Date.now().toString(36)}${sequence.toString(36)}`
}

function signIn(user: User): SessionUser {
  if (user.disabled) throw new DemoApiError(403, 'auth:errors.accountDisabled')
  auth.signInAs(user.id)
  return toSessionUser(user)
}

/** A well-formed email nobody registered: a guest PLAYER with empty contacts. */
function createGuest(email: string): User {
  const handle = (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'visitor'
  let username = `guest-${handle}`
  for (let n = 2; store.data.users.some((user) => user.username === username); n += 1) username = `guest-${handle}${n}`
  const user: User = {
    id: newUserId(),
    email: email.toLowerCase(),
    username,
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    position: '',
    role: 'PLAYER',
    isAdmin: false,
    disabled: false,
    guest: true,
    createdAt: nowIso(),
  }
  store.data.users.push(user)
  store.notify()
  bus.emit('user:changed', { userId: user.id })
  return user
}

export function registerAuth(api: MockApi): void {
  api.register('POST', '/auth/login', ({ body }) => {
    const identifier = str(body, 'identifier')
    const password = typeof (body as { password?: unknown } | null)?.password === 'string' ? (body as { password: string }).password : ''
    const fields: Record<string, string> = {}
    if (!identifier) fields.identifier = 'auth:errors.required'
    if (!password) fields.password = 'auth:errors.required'
    if (Object.keys(fields).length) throw DemoApiError.validation(fields)

    const user = findUser(identifier)
    if (user) {
      if (password !== DEMO_PASSWORD) throw new DemoApiError(401, 'auth:errors.badCredentials')
      return signIn(user)
    }
    if (!EMAIL.test(identifier)) throw new DemoApiError(401, 'auth:errors.badCredentials')
    return signIn(createGuest(identifier))
  })

  api.register('POST', '/auth/demo', ({ body }) => {
    const accountId = str(body, 'accountId')
    const account = DEMO_ACCOUNTS.find((candidate) => candidate.id === accountId)
    const user = account ? store.data.users.find((candidate) => candidate.id === account.id) : undefined
    if (!user) throw new DemoApiError(404, 'common:errors.notFound')
    return signIn(user)
  })

  api.register('POST', '/auth/otp/request', ({ body }) => {
    const email = str(body, 'email')
    if (!EMAIL.test(email)) throw DemoApiError.validation({ email: 'auth:errors.invalidEmail' })
    const user = findUser(email)
    if (user?.disabled) throw new DemoApiError(403, 'auth:errors.accountDisabled')
    return { sent: true }
  })

  api.register('POST', '/auth/otp/verify', ({ body }) => {
    const email = str(body, 'email')
    const code = str(body, 'code').replace(/\s+/g, '')
    if (!EMAIL.test(email)) throw DemoApiError.validation({ email: 'auth:errors.invalidEmail' })
    if (code !== DEMO_OTP) throw new DemoApiError(400, 'auth:errors.badCode', { code: 'auth:errors.badCode' })
    return signIn(findUser(email) ?? createGuest(email))
  })

  api.register('POST', '/auth/register', ({ body }) => {
    const input = {
      firstName: str(body, 'firstName'),
      lastName: str(body, 'lastName'),
      phone: str(body, 'phone'),
      email: str(body, 'email').toLowerCase(),
      company: str(body, 'company'),
      position: str(body, 'position'),
      password: typeof (body as { password?: unknown } | null)?.password === 'string' ? (body as { password: string }).password : '',
    }
    const fields: Record<string, string> = {}
    for (const key of ['firstName', 'lastName', 'phone', 'company', 'position'] as const) {
      if (!input[key]) fields[key] = 'auth:errors.required'
    }
    if (!input.email) fields.email = 'auth:errors.required'
    else if (!EMAIL.test(input.email)) fields.email = 'auth:errors.invalidEmail'
    if (input.password.length < 6) fields.password = 'auth:errors.passwordShort'
    if (Object.keys(fields).length) throw DemoApiError.validation(fields)
    if (findUser(input.email)) {
      throw new DemoApiError(409, 'auth:errors.emailTaken', { email: 'auth:errors.emailTaken' })
    }

    const user: User = {
      id: newUserId(),
      email: input.email,
      username: null,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      company: input.company,
      position: input.position,
      role: 'PLAYER',
      isAdmin: false,
      disabled: false,
      guest: false,
      createdAt: nowIso(),
    }
    store.data.users.push(user)
    store.notify()
    bus.emit('user:changed', { userId: user.id })
    return signIn(user)
  })

  api.register('POST', '/auth/logout', () => {
    auth.signOut()
    return undefined
  })

  api.register('GET', '/auth/me', () => {
    const user = currentUser()
    if (!user || user.disabled) return null
    return toSessionUser(user)
  })
}
