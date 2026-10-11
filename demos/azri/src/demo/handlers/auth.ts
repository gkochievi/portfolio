/**
 * Sign-in for the console login form (one-click accounts use session.signIn directly).
 *
 * Owner: shell agent. Endpoints (see PLAN.md):
 *   POST /api/auth/login  { email, password } -> AzriAccount (without password)
 *   POST /api/auth/logout -> null
 *   GET  /api/auth/me     -> AzriAccount | null
 */
import { DemoApiError } from '@portfolio/demo-kit'

import type { AzriAccount } from '@/types'
import { api, session } from '../core'

export type PublicAccount = Omit<AzriAccount, 'password'>

function publicAccount(account: AzriAccount): PublicAccount {
  const copy: Partial<AzriAccount> = { ...account }
  delete copy.password
  return copy as PublicAccount
}

api.register('POST', '/auth/login', ({ body }) => {
  const input = (body ?? {}) as { email?: unknown; password?: unknown }
  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const errors: Record<string, string> = {}
  if (!email) errors.email = 'This field is required.'
  if (!password) errors.password = 'This field is required.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return publicAccount(session.signInWith(email, password))
})

api.register('POST', '/auth/logout', () => {
  session.signOut()
  return null
})

api.register('GET', '/auth/me', () => {
  const me = session.current()
  return me ? publicAccount(me) : null
})
