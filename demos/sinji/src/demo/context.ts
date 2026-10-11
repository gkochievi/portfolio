/**
 * Operator "act as tenant" (the source's X-Act-As header). In memory only.
 * The shell's tenant switcher calls `setActingTenantId`, then clears the query cache.
 */
import type { Id } from '@/types'
import { DEFAULT_TENANT_ID } from './accounts'
import { bus } from './core'

let actingTenantId: Id | null = DEFAULT_TENANT_ID

export function getActingTenantId(): Id | null {
  return actingTenantId
}

export function setActingTenantId(id: Id | null): void {
  if (id === actingTenantId) return
  actingTenantId = id
  bus.emit('acting-tenant:changed', { tenant_id: id })
}
