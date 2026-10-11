/**
 * Id provider for the pure domain modules. Owner: seed.
 *
 * Domain helpers (applyTransition, debitOnVerify, buildMonthlyInvoice...) create
 * records, so they need fresh ids, but they must not import the store (the seed
 * builds data with them before the store exists). `runtime.ts` installs
 * `store.nextId` once the store is up; `buildSeed` swaps in its own counter for
 * the duration of a build and restores the previous provider afterwards.
 */
export type IdFn = (prefix: string) => string

let provider: IdFn | null = null

export function setIdProvider(fn: IdFn | null): void {
  provider = fn
}

export function newId(prefix: string): string {
  if (!provider) throw new Error('No id provider installed (domain/ids.ts)')
  return provider(prefix)
}

/** Run `work` with `fn` as the id provider, then restore the previous one. */
export function withIdProvider<T>(fn: IdFn, work: () => T): T {
  const previous = provider
  provider = fn
  try {
    return work()
  } finally {
    provider = previous
  }
}

/** A simple per-prefix counter (`tsk_1`, `tsk_2`...), used by the seed. */
export function createCounterIds(start: Record<string, number> = {}): IdFn {
  const counters = new Map<string, number>(Object.entries(start))
  return (prefix) => {
    const n = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, n)
    return `${prefix}${n}`
  }
}
