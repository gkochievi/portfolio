/**
 * The mock backend's singletons: store, session, api, bus. Owned by the shell
 * agent. Handler modules import from here; UI code imports from `@/demo`.
 */
import { createEventBus, createMockApi, createSession, createStore, rebaseDates } from '@portfolio/demo-kit'

import type { DemoDb, DemoEvents } from '@/types'
import { accounts } from './accounts'
import { generateUsage } from './generators/usage'
import { seed, SEED_DATE } from './seed'

export const store = createStore<DemoDb>(seed, {
  prepare: (copy) => {
    // `^at$` catches `AiConnection.last_test.at`, which the default key pattern misses.
    const db = rebaseDates(copy, { anchor: SEED_DATE, keys: /(At|Date|_at|date|time|Time|^at)$/ })
    db.llmUsage = db.llmUsage.concat(generateUsage(db))
    return db
  },
})

/** Starts signed out: the first screen is the public voice-tools page. */
export const session = createSession(accounts, { initial: null })

export const api = createMockApi({
  prefix: '/api',
  isAuthenticated: session.isSignedIn,
  publicPrefixes: ['/auth/', '/public/'],
})

export const bus = createEventBus<DemoEvents>()
