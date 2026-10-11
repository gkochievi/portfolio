/**
 * The in-memory database: a deep copy of the seed, rebased to "now" on every
 * reset. Nothing is persisted; a reload restores the pristine seed.
 */
import { createStore, rebaseDates, type DemoStore } from '@portfolio/demo-kit'

import type { ChitiDb } from '@/types'

import { SEED_ANCHOR, TIMESTAMP_KEYS } from './clock'
import { seed } from './seed'

export const store: DemoStore<ChitiDb> = createStore<ChitiDb>(seed, {
  prepare: (copy) => rebaseDates(copy, { anchor: SEED_ANCHOR, keys: TIMESTAMP_KEYS }),
})

/** Short per-tab tag so ids minted in two mirrored tabs never collide. */
export const TAB_TAG = Math.random().toString(36).slice(2, 6)

/** A fresh id for a runtime row: `${prefix}${tab}_${n}` (e.g. `msg_k3x9_12`). */
export function newId(prefix: string): string {
  return store.nextId(`${prefix}${TAB_TAG}_`)
}

/** Throw the working copy away and re-clone the seed (the DemoBar reset). */
export function resetDemo(): void {
  store.reset()
}
