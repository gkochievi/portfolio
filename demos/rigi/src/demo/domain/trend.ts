/**
 * Dashboard sparklines. Owner: seed. Mirrors the original synthetic function:
 * a cosine drift plus a linear ramp whose last point equals `base`.
 * `inverse` = the metric was falling towards `base` (e.g. open tickets going down).
 */
export function syntheticTrend(base: number, spread: number, inverse = false, points = 12): number[] {
  const out: number[] = []
  const n = Math.max(2, points)
  for (let i = 0; i < n; i += 1) {
    const remaining = 1 - i / (n - 1)
    const ramp = (inverse ? 1 : -1) * spread * remaining
    const drift = Math.cos(i * 1.3 + base * 0.07) * spread * 0.35 * remaining
    out.push(Math.max(0, Math.round((base + ramp + drift) * 100) / 100))
  }
  out[n - 1] = base
  return out
}
