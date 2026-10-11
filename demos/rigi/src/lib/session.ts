/**
 * Session hooks and actions for the UI. Owner: shell.
 * The session lives in memory (demo-kit); a reload signs in as the initial persona.
 */
import { useSession } from '@portfolio/demo-kit'

import type { RigiAccount } from '@/demo/accounts'
import { session } from '@/demo/runtime'
import { http } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { StaffArea, StaffRole } from '@/types'

export type { RigiAccount }

export function useMe(): RigiAccount | null {
  return useSession(session)
}

/** The signed-in staff account, or null for partners / signed out. */
export function useStaffMe(): (RigiAccount & { role: StaffRole }) | null {
  const me = useMe()
  return me && me.realm === 'staff' && me.role !== 'partner_admin' ? (me as RigiAccount & { role: StaffRole }) : null
}

/** Area -> the non-superadmin role that may open it (ROUTE_ROLES). */
export const AREA_ROLE: Record<StaffArea, StaffRole | null> = {
  admin: null,
  accountant: 'accountant',
  l1: 'l1_employee',
  technician: 'technician',
}

export function canOpenArea(me: RigiAccount | null, area: StaffArea): boolean {
  if (!me || me.realm !== 'staff') return false
  if (me.role === 'superadmin') return true
  return AREA_ROLE[area] === me.role
}

async function go(path: string): Promise<void> {
  const { router } = await import('@/router')
  await router.navigate(path)
}

/** Drop every cached query (another persona must not see the last one's data). */
export function clearData(): void {
  queryClient.removeQueries()
}

/** Sign out and land on `path` (default: the right sign-in screen for the realm). */
export async function signOutTo(path?: string): Promise<void> {
  const realm = session.current()?.realm
  try {
    await http.post('/auth/logout')
  } catch {
    session.signOut()
  }
  clearData()
  await go(path ?? (realm === 'partner' ? '/partner/login' : '/login'))
}

/** One-click persona switch (DemoBar, persona cards): sign in and go home. */
export async function switchAccount(id: string, next?: string): Promise<RigiAccount> {
  const account = session.signIn(id)
  clearData()
  await go(next ?? account.home)
  return account
}
