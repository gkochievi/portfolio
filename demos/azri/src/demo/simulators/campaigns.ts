/**
 * Expiry sweeper: flips pending links past expiresAt (clock.now()) to expired
 * every 30 s and on clock:changed, then emits link:updated per link.
 *
 * Time travel can also run backwards (the playground's "reset" returns to real
 * time), so the sweeper remembers the links IT expired and revives them when the
 * demo clock moves back before their expiry. Seeded expired links are never touched.
 *
 * Owner: feature group campaigns. `every()` pauses while the tab is hidden.
 */
import { every } from '@portfolio/demo-kit'

import { bus, clock, store } from '../core'

const SWEEP_MS = 30_000

/** Tokens the sweeper flipped from pending to expired (so it can undo them). */
const swept = new Set<string>()

/** Expire every pending link whose expiry has passed. Returns the tokens it flipped. */
export function sweepExpiredLinks(): string[] {
  const now = clock.now().getTime()
  const flipped: string[] = []
  for (const link of store.data.links) {
    if (link.status === 'pending' && new Date(link.expiresAt).getTime() <= now) {
      link.status = 'expired'
      swept.add(link.id)
      flipped.push(link.id)
    }
  }
  if (flipped.length) {
    store.notify()
    for (const surveyId of flipped) bus.emit('link:updated', { surveyId, status: 'expired' })
  }
  return flipped
}

/** Put back links the sweeper expired whose expiry is in the future again (clock moved back). */
export function reviveSweptLinks(): string[] {
  if (!swept.size) return []
  const now = clock.now().getTime()
  const revived: string[] = []
  for (const link of store.data.links) {
    if (!swept.has(link.id)) continue
    if (link.status !== 'expired') {
      swept.delete(link.id)
    } else if (new Date(link.expiresAt).getTime() > now) {
      link.status = 'pending'
      swept.delete(link.id)
      revived.push(link.id)
    }
  }
  if (revived.length) {
    store.notify()
    for (const surveyId of revived) bus.emit('link:updated', { surveyId, status: 'pending' })
  }
  return revived
}

export function startCampaignsSimulator(): () => void {
  sweepExpiredLinks()
  const stopTimer = every(SWEEP_MS, () => void sweepExpiredLinks())
  const offClock = bus.on('clock:changed', () => {
    reviveSweptLinks()
    sweepExpiredLinks()
  })
  const offReset = bus.on('store:reset', () => {
    swept.clear()
    sweepExpiredLinks()
  })
  return () => {
    stopTimer()
    offClock()
    offReset()
    swept.clear()
  }
}
