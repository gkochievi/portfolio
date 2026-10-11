/** Auth endpoints (data-core): login by email or username, logout, me. */
import { DemoApiError } from '@portfolio/demo-kit'

import type { ActivityAction, Role } from '@/types'

import { api } from '../api'
import { findTenant, requireAccount, tenantSettings } from '../context'
import { getOperator, logActivity, setOperatorStatus, workingHoursStatus } from '../engine'
import { accountByLogin, signInAs, signOutDemo } from '../session'

const LOGIN_ACTION: Partial<Record<Role, ActivityAction>> = {
  operator: 'operator_login',
  admin: 'admin_login',
  supervisor: 'supervisor_login',
}
const LOGOUT_ACTION: Partial<Record<Role, ActivityAction>> = {
  operator: 'operator_logout',
  admin: 'admin_logout',
}

api.register('POST', '/auth/login', ({ body }) => {
  const input = (body ?? {}) as { login?: string; email?: string; username?: string; password?: string }
  const login = (input.login ?? input.email ?? input.username ?? '').trim()
  const password = input.password ?? ''
  const errors: Record<string, string> = {}
  if (!login) errors.login = 'Enter your email or username.'
  if (!password) errors.password = 'Enter your password.'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)

  const account = accountByLogin(login)
  if (!account || account.password !== password) {
    throw DemoApiError.validation({ non_field_errors: 'Wrong email, username or password.' })
  }
  if (account.tenantId && account.role !== 'customer') {
    const tenant = findTenant(account.tenantId)
    if (tenant.deletedAt) throw new DemoApiError(403, 'This organization has been deleted.')
    if (tenant.disabled) throw new DemoApiError(403, 'This organization is disabled. Contact the platform administrator.')
  }

  signInAs(account.id)
  if (account.role === 'operator') {
    const operator = getOperator(account.staffId)
    if (operator && operator.status === 'offline') setOperatorStatus(operator.id, 'online', 'self')
  }
  const action = LOGIN_ACTION[account.role]
  if (action) logActivity({ action })
  return account
})

api.register('POST', '/auth/logout', () => {
  const account = requireAccount()
  if (account.role === 'operator') {
    const operator = getOperator(account.staffId)
    // Chats stay assigned; simulators/core returns them to the queue after the logout grace (when set).
    if (operator && operator.status !== 'offline') setOperatorStatus(operator.id, 'offline', 'self')
  }
  const action = LOGOUT_ACTION[account.role]
  if (action) logActivity({ action })
  signOutDemo()
  return null
})

api.register('GET', '/auth/me', () => {
  const account = requireAccount()
  if (!account.tenantId) return { account, tenant: null, settings: null, workingHours: null, operator: null }
  return {
    account,
    tenant: findTenant(account.tenantId),
    settings: tenantSettings(account.tenantId),
    workingHours: workingHoursStatus(account.tenantId),
    operator: account.role === 'operator' ? (getOperator(account.staffId) ?? null) : null,
  }
})
