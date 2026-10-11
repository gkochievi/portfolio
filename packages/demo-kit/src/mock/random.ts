/**
 * A seeded PRNG for generators.
 *
 * `Math.random()` would hand every visitor a different "live" feed and make a
 * bug report unreproducible. Seed one of these per generator instead
 * (`createRandom('orders')`) and the same seed always yields the same
 * sequence — on every machine, in every browser.
 *
 * mulberry32 over a 32-bit hash of the seed: tiny, fast, statistically fine
 * for fake data. Not for anything that needs to be unguessable.
 */

/** The object `createRandom()` returns. Every method advances the same stream. */
export interface Random {
  /** A float in `[0, 1)`. */
  next(): number
  /** An integer in `[min, max]`, both ends inclusive. */
  int(min: number, max: number): number
  /** One element, uniformly. Throws on an empty array. */
  pick<T>(items: readonly T[]): T
  /** One value, proportionally to its weight: `weighted([['paid', 8], ['refunded', 1]])`. */
  weighted<T>(pairs: ReadonlyArray<readonly [value: T, weight: number]>): T
  /** True with probability `p` (0–1). */
  chance(p: number): boolean
  /** A shuffled copy (Fisher–Yates); the input is left alone. */
  shuffle<T>(items: readonly T[]): T[]
  /** A v4-shaped UUID drawn from this stream — deterministic, unlike `crypto.randomUUID()`. */
  uuid(): string
}

/** FNV-1a over the seed's string form, then a murmur3 finaliser so that
 *  neighbouring seeds (`1`, `2`) start far apart. */
function hashSeed(seed: number | string): number {
  const text = String(seed)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

/** Create a deterministic random stream from a number or string seed. */
export function createRandom(seed: number | string): Random {
  let state = hashSeed(seed)

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }

  const int = (min: number, max: number): number => {
    const low = Math.ceil(Math.min(min, max))
    const high = Math.floor(Math.max(min, max))
    if (high < low) throw new RangeError(`random.int: no integer in [${min}, ${max}]`)
    return low + Math.floor(next() * (high - low + 1))
  }

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('random.pick: empty array')
      return items[int(0, items.length - 1)] as T
    },
    weighted<T>(pairs: ReadonlyArray<readonly [value: T, weight: number]>): T {
      let total = 0
      for (const [, weight] of pairs) {
        if (!Number.isFinite(weight) || weight < 0) throw new RangeError(`random.weighted: bad weight ${weight}`)
        total += weight
      }
      if (total <= 0) throw new RangeError('random.weighted: weights sum to zero')

      let roll = next() * total
      let last: T | undefined
      for (const [value, weight] of pairs) {
        if (weight === 0) continue
        if (roll < weight) return value
        roll -= weight
        last = value
      }
      // Only reachable through float rounding on the final bucket.
      return last as T
    },
    chance(p: number): boolean {
      return next() < p
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1))
        const held = copy[index] as T
        copy[index] = copy[swap] as T
        copy[swap] = held
      }
      return copy
    },
    uuid(): string {
      let hex = ''
      for (let index = 0; index < 16; index += 1) {
        let byte = Math.floor(next() * 256)
        if (index === 6) byte = (byte & 0x0f) | 0x40 // version 4
        if (index === 8) byte = (byte & 0x3f) | 0x80 // RFC 4122 variant
        hex += byte.toString(16).padStart(2, '0')
      }
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    },
  }
}
