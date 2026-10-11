/**
 * Mock handlers for the `auth` group: sign in/out, who am I, the operator's
 * workspace switcher and act-as. OWNED BY: shell.
 */
import { forbidden, notFound } from '@portfolio/demo-kit'

import type { Id, Me, SinjiAccount, Tenant } from '@/types'
import { getActingTenantId, setActingTenantId } from '../context'
import { api, session, store } from '../core'

const publicAccount = (account: SinjiAccount): Omit<SinjiAccount, 'password'> => {
  const { password: _password, ...rest } = account
  return rest
}

function me(): Me {
  const account = session.current()
  if (!account) return { scope: 'guest', account: null, tenant: null, acting_tenant_id: null }
  const acting = account.role === 'operator' ? getActingTenantId() : account.tenantId
  const tenant = store.data.tenants.find((t: Tenant) => t.id === acting) ?? null
  return {
    scope: account.role === 'operator' ? 'admin' : 'tenant',
    account: publicAccount(account),
    tenant,
    acting_tenant_id: account.role === 'operator' ? acting : null,
  }
}

api.register('POST', '/auth/login', ({ body }) => {
  const input = (body ?? {}) as { email?: string; password?: string }
  session.signInWith(input.email ?? '', input.password ?? '')
  return me()
})

api.register('POST', '/auth/logout', () => {
  session.signOut()
  return { ok: true }
})

api.register('GET', '/auth/me', () => me())

api.register('GET', '/auth/tenants', () => {
  if (session.current()?.role !== 'operator') throw forbidden()
  return store.data.tenants.map((t: Tenant) => ({ id: t.id, name: t.name, name_ka: t.name_ka, slug: t.slug, is_active: t.is_active }))
})

api.register('PUT', '/auth/act-as', ({ body }) => {
  if (session.current()?.role !== 'operator') throw forbidden()
  const id = ((body ?? {}) as { tenant_id?: Id | null }).tenant_id ?? null
  if (id !== null && !store.data.tenants.some((t: Tenant) => t.id === id)) throw notFound()
  setActingTenantId(id)
  return me()
})
