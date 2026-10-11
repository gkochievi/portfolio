/**
 * Who the visitor is pretending to be, plus where each role lands.
 *
 * First load: signed in as `accounts[0]` (Mariam, the respondent) on `/`, the
 * public SMS inbox launcher with her two pending links on top. The DemoBar
 * switches with `session.signIn(id)` and then navigates to `account.home`.
 *
 * Owner: seed agent.
 */
import type { AzriAccount, Role } from '@/types'

export { session } from './core'
export { accounts } from './seed'

/** Landing route per role (the same values as each account's `home`). */
export const roleHome: Record<Role, string> = {
  respondent: '/',
  admin: '/console',
  agent: '/console/me',
}

/** Where an account lands after sign-in or a DemoBar switch. */
export function homeFor(account: Pick<AzriAccount, 'role' | 'home'> | null): string {
  return account ? account.home || roleHome[account.role] : '/'
}
