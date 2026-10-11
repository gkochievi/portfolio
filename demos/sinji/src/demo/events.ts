/**
 * The simulated realtime channel (the stand-in for a socket): a typed bus
 * over `DemoEvents` from `@/types`. Handlers `emit` after a timed write; the
 * UI subscribes where a real app would have opened a stream.
 */
import { bus } from './core'

export { bus, bus as events }
export type { DemoEvents } from '@/types'
