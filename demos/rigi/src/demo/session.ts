/**
 * Who is signed in, and where each persona lands. Owner: data core.
 *
 * The session is built in `./runtime` from `./accounts` (the five brief
 * personas) and starts signed in as Nino, the superadmin. In memory only.
 */
import type { AccountRole } from '@/types'

import { accounts, INITIAL_ACCOUNT_ID, type RigiAccount } from './accounts'
import { session } from './runtime'

export { session }
export type { RigiAccount }

/** Role -> the route prefix its persona lands on after signing in. */
export const roleHome: Record<AccountRole, string> = {
  superadmin: '/admin',
  accountant: '/accountant',
  l1_employee: '/l1',
  technician: '/technician',
  partner_admin: '/partner',
}

/** Where `/` should send this account. */
export function homeFor(account: Pick<RigiAccount, 'role'>): string {
  return roleHome[account.role]
}

/** The first-load persona's home (`/admin`). */
export const INITIAL_HOME: string = roleHome[accounts.find((a) => a.id === INITIAL_ACCOUNT_ID)?.role ?? 'superadmin']
