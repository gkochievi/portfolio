/**
 * The typed realtime bus (replaces the original socket events). Every data
 * event carries the FULL entity so the BroadcastChannel mirror can upsert it
 * in another tab. Payloads are cloned, so listeners never alias the store.
 */
import { createEventBus, type EventBus } from '@portfolio/demo-kit'

import type { ChitiEvents } from '@/types'

export const bus: EventBus<ChitiEvents> = createEventBus<ChitiEvents>()

type Outbound = (event: keyof ChitiEvents, payload: unknown) => void
let outbound: Outbound | null = null

/** The mirror plugs in here; nothing else should call it. */
export function setOutbound(fn: Outbound | null): void {
  outbound = fn
}

/** Emit in this tab only (the mirror uses it for events received from other tabs). */
export function emitLocal<K extends keyof ChitiEvents>(event: K, payload: ChitiEvents[K]): void {
  const emit = bus.emit as unknown as (type: string, payload?: unknown) => void
  emit(event, payload)
}

/** Emit locally AND mirror to the other open tabs. */
export function broadcast<K extends keyof ChitiEvents>(event: K, payload: ChitiEvents[K]): void {
  const copy = (payload === undefined ? payload : structuredClone(payload)) as ChitiEvents[K]
  emitLocal(event, copy)
  outbound?.(event, copy)
}
