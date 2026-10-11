/** Pure helpers: series binning, lane state, number formatting for the status view. */
import { fmtBytes } from '@/lib/format'
import type { PingRow } from '@/types'

/** Voice-lane order, fixed (proper names, never translated). */
export const LANE_ORDER = ['Core Cluster', 'Edge PBX', 'Voice Archive', 'Directory'] as const

/** Average equal chunks down to at most `bins` points. */
export function downsample(values: readonly number[], bins = 96): number[] {
  if (values.length <= bins) return [...values]
  const size = values.length / bins
  const out: number[] = []
  for (let i = 0; i < bins; i++) {
    const from = Math.floor(i * size)
    const to = Math.max(from + 1, Math.floor((i + 1) * size))
    let sum = 0
    for (let j = from; j < to; j++) sum += values[j] ?? 0
    out.push(sum / (to - from))
  }
  return out
}

export interface LaneBin {
  rtt: number | null
  loss: number
  down: boolean
}

/** Bin ping rows onto a fixed time axis so every lane shares the same x scale. */
export function binPings(rows: readonly PingRow[], from: number, to: number, bins = 144): LaneBin[] {
  const acc = Array.from({ length: bins }, () => ({ n: 0, sum: 0, loss: 0, down: 0, rows: 0 }))
  const span = to - from
  for (const r of rows) {
    const i = Math.floor(((Date.parse(r.recordedAt) - from) / span) * bins)
    const b = acc[i]
    if (!b) continue
    b.rows++
    b.loss = Math.max(b.loss, r.packetLossPct)
    if (!r.reachable) b.down++
    if (r.rttAvgMs != null) {
      b.n++
      b.sum += r.rttAvgMs
    }
  }
  return acc.map((b) => ({ rtt: b.n ? b.sum / b.n : null, loss: b.loss, down: b.rows > 0 && b.down === b.rows }))
}

export type LaneState = 'healthy' | 'degraded' | 'down'

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

/** unreachable -> down; any loss or a round-trip well above the 24 h median -> degraded. */
export function laneState(latest: PingRow | undefined, baselineRtt: number): LaneState {
  if (!latest) return 'healthy'
  if (!latest.reachable) return 'down'
  const rtt = latest.rttAvgMs ?? 0
  if (latest.packetLossPct > 0) return 'degraded'
  if (baselineRtt > 0 && rtt > baselineRtt * 2.5 && rtt - baselineRtt > 2) return 'degraded'
  return 'healthy'
}

export function fmtRtt(ms: number | null | undefined): string {
  if (ms == null) return '-'
  return `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '-'
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}

export const fmtRate = (bytesPerSec: number): string => `${fmtBytes(bytesPerSec)}/s`

/** Series colours: bronze, pine, brass, steel, sage (dark values are lifted for contrast). */
export function chartColors(theme: 'light' | 'dark'): string[] {
  return theme === 'dark'
    ? ['#E08A55', '#6FA793', '#E3B341', '#8FB3CC', '#9DB8A8']
    : ['#A3441A', '#2F5D4E', '#D9A33B', '#3F6178', '#8AA394']
}
