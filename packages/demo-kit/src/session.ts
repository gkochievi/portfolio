/**
 * Who the visitor is pretending to be.
 *
 * Every demo ships a handful of seeded accounts (an owner, a cashier, a
 * customer…) and lets the visitor hop between them from the demo bar, so a
 * role-based product can be seen from every side in a minute. The session is
 * in memory only — a reload returns to `initial`, like everything else.
 */
import { useSyncExternalStore } from 'react'

import { DemoApiError, notFound } from './mock/api'

/** One seeded, sign-in-able account. Extend it with demo-specific fields. */
export interface DemoAccount {
  id: string
  name: string
  email: string
  /** Shown on the login helper; it is a demo, the point is that it is guessable. */
  password: string
  /** Machine role the handlers check (`'owner'`, `'cashier'`); narrow it with a union. */
  role: string
  /** Human label for the role, already localised (`'Owner'`, `'მფლობელი'`). */
  roleLabel?: string | undefined
  /** One line on what this account is for — "Sees every branch's takings". */
  description?: string | undefined
  /** Avatar background; any CSS colour. Falls back to the Boulder palette. */
  avatarColor?: string | undefined
}

/** Configuration for `createSession()`. */
export interface SessionOptions {
  /**
   * The account a fresh tab starts signed in as. Default: the first account,
   * so a first-time visitor lands in the product rather than on a login form.
   * Pass `null` to start signed out.
   */
  initial?: string | null | undefined
}

/** The object `createSession()` returns. Methods are free functions — safe to pass around unbound. */
export interface DemoSession<A extends DemoAccount> {
  /** Every account, in seed order. */
  readonly accounts: readonly A[]
  /** The signed-in account, or null. Stable identity until the next change. */
  current(): A | null
  /** Shorthand for `current() !== null` — fits `createMockApi({isAuthenticated})`. */
  isSignedIn(): boolean
  /** Become this account (the demo bar's one-click switch). Throws a 404 `DemoApiError` for an unknown id. */
  signIn(id: string): A
  /**
   * The login form's path: any account whose email matches (case- and
   * whitespace-insensitive) and whose password is exactly `password`.
   * Throws a 400 `DemoApiError` with a `non_field_errors` entry on mismatch.
   */
  signInWith(email: string, password: string): A
  /** Sign out. A no-op when already signed out. */
  signOut(): void
  /** Called after every change of account. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

/** Create a demo's session over its seeded accounts. */
export function createSession<A extends DemoAccount>(
  accounts: readonly A[],
  options: SessionOptions = {},
): DemoSession<A> {
  const byId = (id: string): A | undefined => accounts.find((account) => account.id === id)

  const initialId = options.initial === undefined ? (accounts[0]?.id ?? null) : options.initial
  if (initialId !== null && !byId(initialId)) {
    throw new Error(`createSession: initial account "${initialId}" is not in the accounts list`)
  }

  let current: A | null = initialId === null ? null : (byId(initialId) ?? null)
  const listeners = new Set<() => void>()

  const become = (next: A | null): void => {
    if (next === current) return
    current = next
    for (const listener of [...listeners]) listener()
  }

  return {
    accounts,
    current: () => current,
    isSignedIn: () => current !== null,
    signIn(id) {
      const account = byId(id)
      if (!account) throw notFound(`No demo account "${id}".`)
      become(account)
      return account
    },
    signInWith(email, password) {
      const wanted = email.trim().toLowerCase()
      const account = accounts.find(
        (candidate) => candidate.email.trim().toLowerCase() === wanted && candidate.password === password,
      )
      if (!account) {
        throw DemoApiError.validation({ non_field_errors: 'Unable to log in with provided credentials.' })
      }
      become(account)
      return account
    },
    signOut() {
      become(null)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The signed-in account, re-rendering whenever it changes. */
export function useSession<A extends DemoAccount>(session: DemoSession<A>): A | null {
  return useSyncExternalStore(session.subscribe, session.current, session.current)
}

/** The avatar letter for a name: its first character, upper-cased where the script has case. */
export function accountInitial(name: string): string {
  const first = Array.from(name.trim())[0]
  return first ? first.toLocaleUpperCase() : '?'
}
