/**
 * Who the visitor is. One account per staff record of every tenant, plus the
 * superadmin and the customer persona; the first load is the customer `cus_ana`.
 * Impersonation ("log in as" from the super-admin console) lives here too.
 */
import { createSession, type DemoSession } from '@portfolio/demo-kit'

import type { ChitiAccount, Role } from '@/types'

import { ROLE_HOME, seedAccounts } from './seed'

/** Mutable on purpose: the super admin can add staff (and so accounts) at runtime. */
export const accounts: ChitiAccount[] = seedAccounts.map((account) => ({ ...account }))

export const session: DemoSession<ChitiAccount> = createSession(accounts, { initial: 'cus_ana' })

/** The five accounts the DemoBar lists (customer, operator, admin, supervisor, superadmin). */
export const headlineAccounts: ChitiAccount[] = accounts.filter((account) => account.headline)

export const roleHome: Record<Role, string> = { ...ROLE_HOME }

export function findAccount(id: string): ChitiAccount | undefined {
  return accounts.find((account) => account.id === id)
}

/** Email or username, case-insensitive. */
export function accountByLogin(login: string): ChitiAccount | undefined {
  const wanted = login.trim().toLowerCase()
  if (!wanted) return undefined
  return accounts.find((account) => account.email.toLowerCase() === wanted || account.username.toLowerCase() === wanted)
}

/** Add or replace an account (super-admin "create member"). */
export function addAccount(account: ChitiAccount): void {
  const index = accounts.findIndex((row) => row.id === account.id)
  if (index >= 0) accounts[index] = account
  else accounts.push(account)
}

/** Drop an account (staff deleted). Signs out if it was the current one. */
export function removeAccount(id: string): void {
  const index = accounts.findIndex((row) => row.id === id)
  if (index < 0) return
  accounts.splice(index, 1)
  if (session.current()?.id === id) signOutDemo()
}

/** Back to the seeded accounts (store reset). Keeps the current account when it still exists. */
export function resetAccounts(): void {
  const current = session.current()
  // Keep the current account's object so the session (and its subscribers) see no change.
  const fresh = seedAccounts.map((account) => (current && account.id === current.id ? current : { ...account }))
  accounts.splice(0, accounts.length, ...fresh)
  if (current && !findAccount(current.id)) signInAs('cus_ana')
}

/* ----------------------------------------------------------- impersonation */

let impersonationState: { by: ChitiAccount } | null = null
const impersonationListeners = new Set<() => void>()
const notifyImpersonation = () => {
  for (const listener of [...impersonationListeners]) listener()
}

/**
 * Switch the session to `accountId`. Pass `impersonatedBy` (the superadmin's
 * account id) for "log in as"; any other switch ends an impersonation.
 */
export function signInAs(accountId: string, options: { impersonatedBy?: string | null } = {}): ChitiAccount {
  const by = options.impersonatedBy ? (findAccount(options.impersonatedBy) ?? null) : null
  const account = session.signIn(accountId)
  const next = by ? { by } : null
  if (next?.by.id !== impersonationState?.by.id) {
    impersonationState = next
    notifyImpersonation()
  }
  return account
}

export function signOutDemo(): void {
  session.signOut()
  if (impersonationState) {
    impersonationState = null
    notifyImpersonation()
  }
}

/** The impersonating superadmin, or null. Stable identity until it changes. */
export function impersonation(): { by: ChitiAccount } | null {
  return impersonationState
}

/** "Back to super admin": sign in as the impersonator again. */
export function endImpersonation(): ChitiAccount | null {
  const by = impersonationState?.by ?? null
  if (!by) return null
  return signInAs(by.id)
}

export function subscribeImpersonation(listener: () => void): () => void {
  impersonationListeners.add(listener)
  return () => {
    impersonationListeners.delete(listener)
  }
}
