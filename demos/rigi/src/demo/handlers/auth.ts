/**
 * Auth handlers (staff + partner portal). Owner: shell.
 * Patterns are registered WITHOUT the /api prefix.
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import { accounts, DEMO_PASSWORD, type RigiAccount } from '../accounts'
import { requirePartnerAdmin } from '../ctx'
import { session, store } from '../runtime'

/** The account without its password, as the wire would carry it. */
function publicAccount(account: RigiAccount | null) {
  if (!account) return null
  const { password: _password, ...rest } = account as RigiAccount & { password?: string }
  return rest
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function register(api: MockApi): void {
  api.register('POST', '/auth/login', ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>
    const email = str(input.email).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    if (!email || !password) {
      throw DemoApiError.validation({
        ...(email ? {} : { email: 'This field is required.' }),
        ...(password ? {} : { password: 'This field is required.' }),
      })
    }
    const account = accounts.find((a) => a.realm === 'staff' && a.email.toLowerCase() === email)
    if (!account || password !== DEMO_PASSWORD) throw new DemoApiError(400, 'Invalid email or password')
    const user = store.data.staffUsers.find((u) => u.id === account.id)
    if (user && (!user.isActive || user.deletedAt)) throw new DemoApiError(400, 'Invalid email or password')
    return publicAccount(session.signIn(account.id))
  })

  api.register('POST', '/auth/switch', ({ body }) => {
    const id = str((body as Record<string, unknown> | null)?.accountId)
    const account = accounts.find((a) => a.id === id)
    if (!account) throw new DemoApiError(404, 'Unknown demo account')
    return publicAccount(session.signIn(account.id))
  })

  api.register('POST', '/auth/logout', () => {
    session.signOut()
    return { ok: true }
  })

  api.register('GET', '/auth/me', () => publicAccount(session.current()))

  api.register('POST', '/auth/forgot-password', ({ body }) => {
    const email = str((body as Record<string, unknown> | null)?.email)
    if (!email) throw DemoApiError.validation({ email: 'This field is required.' })
    return { ok: true }
  })

  api.register('POST', '/auth/reset-password', ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>
    const token = str(input.token)
    const password = typeof input.password === 'string' ? input.password : ''
    if (!token) throw new DemoApiError(400, 'Reset link is invalid or has expired')
    if (password.length < 8) throw DemoApiError.validation({ password: 'Use at least 8 characters.' })
    if (password !== input.confirm) throw DemoApiError.validation({ confirm: 'Passwords do not match.' })
    return { ok: true }
  })

  api.register('POST', '/portal/auth/login', ({ body }) => {
    const input = (body ?? {}) as Record<string, unknown>
    const username = str(input.username).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    const account = accounts.find(
      (a) => a.realm === 'partner' && (a.username?.toLowerCase() === username || a.email.toLowerCase() === username),
    )
    if (!account || password !== DEMO_PASSWORD) throw new DemoApiError(400, 'Invalid username or password')
    const partner = store.data.partners.find((p) => p.id === account.partnerId)
    const admin = store.data.partnerAdmins.find((a) => a.id === account.id)
    if (!partner || !partner.isActive || (admin && !admin.isActive)) throw new DemoApiError(403, 'account_disabled')
    return publicAccount(session.signIn(account.id))
  })

  api.register('GET', '/portal/me', () => {
    const { account, partner } = requirePartnerAdmin()
    return {
      account: publicAccount(account),
      partner: { id: partner.id, name: partner.name, legalName: partner.legalName, currency: partner.currency },
    }
  })
}
