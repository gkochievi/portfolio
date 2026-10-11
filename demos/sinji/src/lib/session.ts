/**
 * Session hooks every screen uses. Owned by the shell agent; feature groups import only.
 */
import { useSyncExternalStore } from 'react'
import { useSession } from '@portfolio/demo-kit'

import { bus, getActingTenantId, session } from '@/demo'
import type { Id, SinjiAccount } from '@/types'

/** The signed-in account (re-renders on switch), or null for a guest. */
export function useAccount(): SinjiAccount | null {
  return useSession(session)
}

/** Owners and the operator may edit workspace settings; members see a read-only note. */
export function useCanEdit(): boolean {
  const account = useAccount()
  return account?.role === 'owner' || account?.role === 'operator'
}

const subscribeActing = (listener: () => void) => bus.on('acting-tenant:changed', listener)

/** The operator's act-as tenant (re-renders when the switcher changes it). */
export function useActingTenantId(): Id | null {
  return useSyncExternalStore(subscribeActing, getActingTenantId, getActingTenantId)
}

/** The tenant workspace screens are scoped to: own tenant, or the operator's act-as choice. */
export function useTenantId(): Id | null {
  const account = useAccount()
  const acting = useActingTenantId()
  if (!account) return null
  return account.role === 'operator' ? acting : account.tenantId
}
