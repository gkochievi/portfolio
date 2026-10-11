/** Rounding helpers shared by the money/points modules. Owner: seed. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sum(values: readonly number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0))
}
