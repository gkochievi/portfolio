/**
 * A demo's database: a deep copy of its seed, held in memory for the life of
 * the tab.
 *
 * Nothing here touches localStorage, sessionStorage or IndexedDB — every
 * visitor gets the same pristine data, and a reload (or `reset()`) puts it
 * back. Handlers mutate `store.data` in place and call `notify()` when a
 * change should reach subscribers (an event feed, a live counter).
 *
 * `data` is a getter: `reset()` swaps in a fresh copy, so read through
 * `store.data` every time and never hold on to a nested array across a reset.
 */

/** Configuration for `createStore()`. */
export interface StoreOptions<T> {
  /**
   * Runs on every fresh copy — at creation and on each `reset()` — before
   * anyone can see it. The place for `rebaseDates`, so a tab left open past
   * midnight resets onto today rather than onto the day it was opened.
   */
  prepare?: ((copy: T) => T) | undefined
}

/** The object `createStore()` returns. */
export interface DemoStore<T extends object> {
  /** The mutable working copy. Replaced wholesale by `reset()`. */
  readonly data: T
  /** Bumps on every `notify()`; a ready-made `getSnapshot` for `useSyncExternalStore`. */
  readonly version: number
  /** Throw the working copy away, re-clone the seed, and notify. */
  reset(): void
  /** A deep copy of the current working copy, safe to hand out and mutate. */
  snapshot(): T
  /**
   * A fresh id: `${prefix}${n}`. Continues past the highest seeded id of the
   * same shape (`nextId('ord_')` after `ord_1041` is `ord_1042`), never
   * collides with any `id` in the seed, and never repeats for the life of the
   * tab — not even across `reset()`, so a stale cache entry can't alias a
   * new row.
   */
  nextId(prefix?: string): string
  /** Called after every `notify()` (and so after `reset()`). Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  /** Tell subscribers the data changed. */
  notify(): void
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Every value under an `id` key anywhere in the tree, as a string. */
function collectIds(node: unknown, into: Set<string>, seen: WeakSet<object>): Set<string> {
  if (node === null || typeof node !== 'object' || seen.has(node)) return into
  seen.add(node)
  if (Array.isArray(node)) {
    for (const item of node) collectIds(item, into, seen)
    return into
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'id' && (typeof value === 'string' || typeof value === 'number')) into.add(String(value))
    else collectIds(value, into, seen)
  }
  return into
}

/**
 * Create a demo's in-memory store from its seed. The seed itself is never
 * mutated — it is the pristine copy every reset starts over from.
 */
export function createStore<T extends object>(seed: T, options: StoreOptions<T> = {}): DemoStore<T> {
  const hydrate = (): T => {
    const copy = structuredClone(seed)
    return options.prepare ? options.prepare(copy) : copy
  }

  let data = hydrate()
  let version = 0
  const listeners = new Set<() => void>()

  // Seeded ids, plus every id handed out since — the collision check.
  const taken = collectIds(data, new Set<string>(), new WeakSet())
  const counters = new Map<string, number>()

  function highestSeeded(prefix: string): number {
    const shape = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`)
    let highest = 0
    for (const id of taken) {
      const digits = shape.exec(id)?.[1]
      if (digits !== undefined) highest = Math.max(highest, Number(digits))
    }
    return highest
  }

  function notify(): void {
    version += 1
    // A snapshot of the set, so a listener that unsubscribes mid-loop is safe.
    for (const listener of [...listeners]) listener()
  }

  return {
    get data() {
      return data
    },
    get version() {
      return version
    },
    reset() {
      data = hydrate()
      notify()
    },
    snapshot() {
      return structuredClone(data)
    },
    nextId(prefix = '') {
      let n = counters.get(prefix) ?? highestSeeded(prefix) + 1
      let candidate = `${prefix}${n}`
      while (taken.has(candidate)) {
        n += 1
        candidate = `${prefix}${n}`
      }
      counters.set(prefix, n + 1)
      taken.add(candidate)
      return candidate
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify,
  }
}
