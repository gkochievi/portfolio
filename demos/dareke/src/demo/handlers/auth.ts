/**
 * Auth and the small shared reads:
 * POST /auth/login, POST /auth/logout, GET /auth/me, GET /dialer/status,
 * GET /lookups/campaigns. Paths are registered WITHOUT the "/api" prefix.
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import type { CampaignStatus, DarekeAccount, DialingMode, Localized, User } from '@/types'
import { changed, nowIso, requireUser } from '../domain'
import { session, store } from '../store'

export interface LoginResponse {
  user: User
  account: DarekeAccount
}

export interface DialerStatus {
  connected: boolean
  activeCalls: number
}

export interface CampaignLookup {
  id: string
  name: Localized
  status: CampaignStatus
  dialingMode: DialingMode
}

export function register(api: MockApi): void {
  api.register('POST', '/auth/login', ({ body }) => {
    const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown }
    const fields: Record<string, string> = {}
    if (typeof email !== 'string' || !email.trim()) fields.email = 'Enter your email'
    if (typeof password !== 'string' || !password) fields.password = 'Enter your password'
    if (Object.keys(fields).length > 0) throw DemoApiError.validation(fields)
    const wanted = String(email).trim().toLowerCase()
    const account = session.accounts.find((candidate) => candidate.email.toLowerCase() === wanted)
    const user = account ? store.data.users.find((candidate) => candidate.id === account.userId) : undefined
    if (account && user && !user.isActive && account.password === password) {
      throw DemoApiError.validation({ non_field_errors: 'This account is disabled.' })
    }
    const signedIn = session.signInWith(String(email), String(password))
    const me = store.data.users.find((candidate) => candidate.id === signedIn.userId)
    if (!me) throw new DemoApiError(500, 'The demo account has no user record.')
    me.lastLoginAt = nowIso()
    changed('users', 'me')
    return { user: me, account: signedIn } satisfies LoginResponse
  })

  api.register(
    'POST',
    '/auth/logout',
    () => {
      session.signOut()
      return { ok: true }
    },
    { requiresAuth: false },
  )

  api.register('GET', '/auth/me', () => requireUser())

  api.register('GET', '/dialer/status', () => {
    requireUser()
    const activeCalls = store.data.calls.filter((call) => call.outcome === 'IN_PROGRESS').length
    return { connected: true, activeCalls } satisfies DialerStatus
  })

  api.register('GET', '/lookups/campaigns', () => {
    requireUser()
    return store.data.campaigns.map(
      (campaign): CampaignLookup => ({ id: campaign.id, name: campaign.name, status: campaign.status, dialingMode: campaign.dialingMode }),
    )
  })
}
