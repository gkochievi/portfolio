/**
 * Who is signed in. The session is created in `core.ts` over the four demo
 * accounts and starts SIGNED OUT, on the public voice-tools page `/`.
 */
import type { SinjiAccount } from '@/types'
import { accounts } from './accounts'
import { session } from './core'

export { session, accounts }

/** The first screen of a fresh tab: signed out, public voice tools (`?lang=ka` opens Georgian). */
export const FIRST_LOAD = { signedIn: false, path: '/' } as const

/** Where each persona lands after signing in (the operator never lands in a workspace). */
export const roleHome: Record<SinjiAccount['persona'], string> = {
  operator: '/console/tenants',
  owner: '/workspace/calls/rec_mtb_01',
  member: '/workspace/calls',
  agent: '/copilot',
}

/** The route to open right after signing in as `account`. */
export function homeFor(account: Pick<SinjiAccount, 'persona' | 'home'>): string {
  return account.home || roleHome[account.persona]
}
