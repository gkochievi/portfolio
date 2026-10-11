/** The signed-in account for components, and the switch/sign-out actions. */
import { useSyncExternalStore } from 'react'
import { useSession } from '@portfolio/demo-kit'

import {
  endImpersonation,
  findAccount,
  headlineAccounts,
  impersonation,
  roleHome,
  session,
  signInAs as signInAsImpl,
  signOutDemo,
  subscribeImpersonation,
} from '@/demo/session'
import type { ChitiAccount } from '@/types'

export function useAccount(): ChitiAccount | null {
  return useSession(session)
}

/**
 * Become `accountId` (DemoBar, login cards, /live, impersonation). For the
 * super admin's "log in as", pass `{ impersonatedBy: <superadmin account id> }`.
 */
export function signInAs(accountId: string, options: { impersonatedBy?: string | null } = {}): ChitiAccount {
  return signInAsImpl(accountId, options)
}

export function signOut(): void {
  signOutDemo()
}

export function useImpersonation(): { by: ChitiAccount } | null {
  return useSyncExternalStore(subscribeImpersonation, impersonation, impersonation)
}

export { endImpersonation, findAccount, headlineAccounts, impersonation, roleHome }
