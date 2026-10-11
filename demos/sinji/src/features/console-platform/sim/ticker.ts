/**
 * The live part of server health: while the Health tab is mounted, a new
 * sample is emitted on the bus every `sample_interval_s`. `every()` pauses it
 * while the browser tab is hidden. Nothing is persisted.
 */
import { every } from '@portfolio/demo-kit'

import { bus, store } from '@/demo'
import { sampleAt } from './health'

export function runningJobs(): number {
  return store.data.recordings.filter((r) => r.running.length > 0 || r.status === 'transcribing' || r.status === 'analyzing').length
}

/** Start emitting `health:sample`; returns the stop function. */
export function startHealthTicker(intervalS: number): () => void {
  const seconds = Math.min(300, Math.max(5, intervalS || 15))
  return every(seconds * 1000, () => {
    bus.emit('health:sample', { sample: sampleAt(Date.now(), { jobsNow: runningJobs() }) })
  })
}
