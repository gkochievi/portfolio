/**
 * Owner: data agent. The in-memory database and the event bus. Handlers
 * mutate `store.data` in place, then call `store.notify()` and emit on `bus`.
 *
 * Nothing is persisted: a reload, or `resetDemo()`, restores the pristine
 * seed, rebased so every `...At` timestamp sits the same distance from "now"
 * as it did from SEED_ANCHOR when the seed was written.
 */
import { createEventBus, createStore, rebaseDates } from '@portfolio/demo-kit'

import type { DemoDb, DemoEvents } from '@/types'
import { seed, SEED_ANCHOR } from './seed'

export const store = createStore<DemoDb>(seed, {
  prepare: (copy) => rebaseDates(copy, { anchor: SEED_ANCHOR }),
})

export const bus = createEventBus<DemoEvents>()

/** Current time as the handlers see it. */
export const nowIso = (): string => new Date().toISOString()

/**
 * Back to the pristine (freshly rebased) seed, then tell listeners. The DemoBar
 * also clears the QueryClient and signs out a user who no longer exists.
 */
export function resetDemo(): void {
  store.reset()
  bus.emit('demo:reset')
}
