/**
 * Owner: data agent. The simulated-realtime bus, re-exported for UI code:
 * `bus.on('play:created', ...)` to invalidate queries when a round lands.
 * Defined in `store.ts` so handlers and simulators share one instance.
 */
export { bus, resetDemo } from './store'
export type { DemoEvents } from '@/types'
