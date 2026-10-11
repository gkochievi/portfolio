/**
 * The demo's live singletons: store, session, event bus. Owner: seed.
 *
 * Kept apart from `./index` (which builds the API and registers handlers) so
 * handler modules can import these without an import cycle.
 */
import { createEventBus, createSession, createStore } from '@portfolio/demo-kit'

import type { DemoData } from '@/types'

import { accounts, INITIAL_ACCOUNT_ID, type RigiAccount } from './accounts'
import { setIdProvider } from './domain/ids'
import type { DemoEvents } from './events'
import { buildSeed } from './seed'

/**
 * Seeds are generated relative to the load time (periods, deadlines, expiry),
 * and regenerated on every reset so a long-open tab resets onto "now".
 */
let firstCopy = true
export const store = createStore<DemoData>(buildSeed(new Date()), {
  // The kit also runs `prepare` on the initial copy; skip a second build then.
  prepare: (copy) => {
    if (firstCopy) {
      firstCopy = false
      return copy
    }
    return buildSeed(new Date())
  },
})

/** Domain helpers (applyTransition, debitOnVerify, buildMonthlyInvoice...) draw ids from the store. */
setIdProvider((prefix) => store.nextId(prefix))

export const session = createSession<RigiAccount>(accounts, { initial: INITIAL_ACCOUNT_ID })

export const bus = createEventBus<DemoEvents>()
