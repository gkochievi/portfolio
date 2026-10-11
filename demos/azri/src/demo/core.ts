/**
 * The mock backend's singletons: store, session, API, event bus and demo clock.
 * Handler modules (src/demo/handlers/*.ts) import from here and register routes;
 * nothing in here imports a handler, so there is no cycle.
 *
 * Owner: seed agent (the architect wrote this contract; keep the exports).
 */
import {
  createEventBus,
  createMockApi,
  createRandom,
  createSession,
  createStore,
  DemoApiError,
  rebaseDates,
} from '@portfolio/demo-kit'

import type { AzriAccount, DemoEvents, Role, Seed } from '@/types'
import { accounts, RESERVED_TOKENS, seed, SEED_DATE, TOKEN_ALPHABET } from './seed'

/** In-memory data. `store.reset()` restores the pristine (rebased) seed. */
export const store = createStore<Seed>(seed, {
  prepare: (copy) => rebaseDates(copy, { anchor: SEED_DATE }),
})

/** Who the visitor is pretending to be. Starts as the respondent (accounts[0]). */
export const session = createSession<AzriAccount>(accounts)

/**
 * The in-browser API. Routes are registered WITHOUT a trailing slash.
 * Public (no session needed): /auth/, /surveys/, /inbox/, /playground/, /meta.
 * Everything under /console/ needs a session; handlers then call requireRole().
 */
export const api = createMockApi({
  prefix: '/api',
  // The survey calls are POSTs: 350-800 ms gives the validation spinner and the
  // submit animation time to read, as the spec asks (400-800 ms upstream).
  latency: { read: [120, 320], write: [350, 800] },
  isAuthenticated: session.isSignedIn,
  publicPrefixes: ['/auth/', '/surveys/', '/inbox/', '/playground/', '/meta'],
})

/** Stand-in for a websocket: handlers and simulators emit, the UI listens. */
export const bus = createEventBus<DemoEvents>()

/* ------------------------------------------------------------- demo clock */

let clockOffsetMs = 0

/**
 * Demo time. Everything that decides expiry or "today" must use `clock.now()`
 * instead of `new Date()`, so the playground's "time travel" control works.
 */
export const clock = {
  now: (): Date => new Date(Date.now() + clockOffsetMs),
  offsetMs: (): number => clockOffsetMs,
  setOffset(offsetMs: number): void {
    clockOffsetMs = offsetMs
    bus.emit('clock:changed', { offsetMs })
  },
}

/** Restore the pristine seed and the real clock (DemoBar "Reset demo"). */
export function resetDemoData(): void {
  clockOffsetMs = 0
  store.reset()
  bus.emit('store:reset')
}

/* ---------------------------------------------------------------- guards */

/** The signed-in account, or a 401. */
export function requireAccount(): AzriAccount {
  const me = session.current()
  if (!me) throw new DemoApiError(401, 'Authentication credentials were not provided.')
  return me
}

/** The signed-in account if its role is allowed, else 401/403. */
export function requireRole(...roles: Role[]): AzriAccount {
  const me = requireAccount()
  if (!roles.includes(me.role)) throw new DemoApiError(403, 'You do not have permission to perform this action.')
  return me
}

/* ---------------------------------------------------------------- tokens */

const tokenRandom = createRandom('azri-tokens')

/**
 * A fresh 6-character survey token (`?id=`) for a newly sent link. Drawn from
 * a seeded stream (same sequence on every visit), never one already in the
 * store or printed in a seed SMS. Also safe across `resetDemoData()`.
 */
export function generateToken(): string {
  const issued = new Set(store.data.links.map((link) => link.id))
  for (;;) {
    let token = ''
    for (let i = 0; i < 6; i += 1) token += tokenRandom.pick(TOKEN_ALPHABET.split(''))
    if (!issued.has(token) && !RESERVED_TOKENS.includes(token)) return token
  }
}
