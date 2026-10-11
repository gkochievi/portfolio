/**
 * Deterministic mapping from a call leg to its bundled synthetic recording,
 * shared by the mock handler and the row's mini waveform.
 */
import type { RecordingAsset } from '@/types'
import { RECORDING_ASSETS } from '../media/assets'

/** FNV-1a, 32 bit. */
export function hash(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function assetForLeg(legId: string, shift = 0): RecordingAsset {
  return RECORDING_ASSETS[(hash(legId) + shift) % RECORDING_ASSETS.length]!
}

/** 1 in 6 recorded legs has a second copy in the backup share. */
export const hasBackupCopy = (legId: string): boolean => hash(legId) % 6 === 0
/** 1 in 9 recorded legs is only found by a fuzzy (time + parties) match. */
export const isFuzzyMatch = (legId: string): boolean => hash(legId) % 9 === 4

/** Downsample the 64 peaks to `n` bars. */
export function miniPeaks(peaks: number[], n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * peaks.length) / n)
    const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / n))
    let m = 0
    for (let j = from; j < to; j++) m = Math.max(m, peaks[j] ?? 0)
    out.push(m)
  }
  return out
}
