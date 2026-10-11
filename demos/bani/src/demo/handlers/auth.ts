/** Session endpoints (shell agent owns this file). */
import { DemoApiError } from '@portfolio/demo-kit'

import { allowedCdrSources, allowedFeatures } from '@/lib/rbac'
import type { LoginRequest, MeResponse, Persona } from '@/types'
import { api, bus, currentPersona, jitter, session, sleep, store } from '../core'
import { TENANT } from '../seed/personas'

function publicPersona(p: Persona): MeResponse['persona'] {
  return {
    id: p.id,
    username: p.username,
    name: p.name,
    nameKa: p.nameKa,
    email: p.email,
    role: p.role,
    roleLabel: p.roleLabel,
    description: p.description,
    avatarColor: p.avatarColor,
  }
}

export function buildMe(p: Persona): MeResponse {
  const overrides = store.data.rbacOverrides
  const user = store.data.users.find((u) => u.username === p.username)
  return {
    persona: publicPersona(p),
    role: p.role,
    features: allowedFeatures(p.role, overrides),
    cdrSources: allowedCdrSources(p.role),
    allowedCampaigns: p.role === 'cc-admin' && user && user.allowedCampaigns.length > 0 ? [...user.allowedCampaigns] : null,
    tenant: TENANT,
  }
}

export function register(): void {
  api.register('POST', '/auth/login', ({ body }) => {
    const input = (body ?? {}) as Partial<LoginRequest>
    const username = (input.username ?? '').trim().toLowerCase()
    const password = (input.password ?? '').trim()
    if (!username || !password) throw new DemoApiError(400, 'Invalid username or password')
    const match =
      session.accounts.find((p) => p.username === username || p.email.toLowerCase() === username) ?? session.accounts[0]
    if (!match) throw new DemoApiError(400, 'Invalid username or password')
    session.signIn(match.id)
    bus.emit('session:changed')
    return publicPersona(match)
  })

  api.register('POST', '/auth/logout', () => {
    session.signOut()
    bus.emit('session:changed')
  })

  api.register('GET', '/me', () => buildMe(currentPersona()))

  api.register(
    'POST',
    '/auth/verify-password',
    async ({ body }) => {
      currentPersona()
      await sleep(jitter(300, 700))
      const password = ((body ?? {}) as { password?: string }).password ?? ''
      if (!password.trim()) throw DemoApiError.validation({ password: 'Enter your password.' })
      return { ok: true }
    },
    { requiresAuth: true },
  )
}
