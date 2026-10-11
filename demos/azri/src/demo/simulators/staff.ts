/**
 * SMS delivery bookkeeping for "Send survey SMS". The send handler schedules
 * each delivery here (~1.2 s, a plain timeout, not a sleep); a demo reset
 * cancels deliveries still in flight so a stale SMS never lands in the
 * pristine store.
 *
 * Owner: feature group staff.
 */
import { bus } from '../core'

const pending = new Set<ReturnType<typeof setTimeout>>()

/** Run `deliver` after `ms`, unless the demo is reset first. */
export function scheduleSmsDelivery(deliver: () => void, ms = 1200): void {
  const timer = setTimeout(() => {
    pending.delete(timer)
    deliver()
  }, ms)
  pending.add(timer)
}

function cancelAll(): void {
  for (const timer of pending) clearTimeout(timer)
  pending.clear()
}

export function startStaffSimulator(): () => void {
  const off = bus.on('store:reset', cancelAll)
  return () => {
    off()
    cancelAll()
  }
}
