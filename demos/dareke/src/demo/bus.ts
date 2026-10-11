/**
 * The in-browser event bus that replaces the source's WebSocket, plus cross-tab mirroring over BroadcastChannel('dareke-demo').
 *
 * Mirrored: `sync:patch` (records the human operator created or changed) and
 * the human operator's `call:event`s, tagged with this tab's id. On receive
 * the record is upserted (agentStates by agentId, the rest by id) or deleted,
 * re-emitted locally (never re-posted) and the matching scopes invalidated.
 * Not mirrored: floor-simulator activity; each tab runs its own floor.
 * Nothing is persisted: a reload restores the seed.
 */
import { createEventBus } from '@portfolio/demo-kit'

import type { CallEvent, DataScope, DemoData, DemoEvents, SyncCollection, SyncPatch } from '@/types'
import { session, store } from './store'

export const bus = createEventBus<DemoEvents>()

/** A short random tag per tab: tells our own messages apart and keeps human-made ids unique across tabs. */
export const TAB_ID: string = Math.random().toString(36).slice(2, 7)

const CHANNEL = 'dareke-demo'

type Message = { tab: string; kind: 'patch'; patch: SyncPatch } | { tab: string; kind: 'event'; event: CallEvent }

/** Which query scopes a mirrored collection touches. */
export const SYNC_SCOPES: Record<SyncCollection, DataScope[]> = {
  agentStates: ['agents', 'me', 'metrics', 'dialer'],
  calls: ['calls', 'me', 'metrics', 'reports', 'campaigns'],
  numbers: ['numbers', 'campaigns', 'dialer'],
  dnc: ['dnc', 'numbers'],
  callEvents: ['metrics'],
  agentStateLogs: ['agents'],
}

const COLLECTIONS: readonly SyncCollection[] = ['agentStates', 'calls', 'numbers', 'dnc', 'callEvents', 'agentStateLogs']

let applyingRemote = false

/** Upsert or delete one mirrored record in the local store. */
function applyPatch(patch: SyncPatch): void {
  const data: DemoData = store.data
  if (patch.collection === 'agentStates') {
    const list = data.agentStates
    const index = list.findIndex((state) => state.agentId === patch.key)
    if (patch.record === null) {
      if (index >= 0) list.splice(index, 1)
    } else if (index >= 0) list[index] = patch.record as (typeof list)[number]
    else list.push(patch.record as (typeof list)[number])
    return
  }
  const list = data[patch.collection] as Array<{ id: string }>
  const index = list.findIndex((record) => record.id === patch.key)
  if (patch.record === null) {
    if (index >= 0) list.splice(index, 1)
    return
  }
  const record = patch.record as { id: string }
  if (index >= 0) list[index] = record
  else if (patch.collection === 'callEvents') {
    list.unshift(record)
    if (list.length > 50) list.length = 50
  } else list.push(record)
}

function receive(message: Message): void {
  applyingRemote = true
  try {
    if (message.kind === 'patch') {
      applyPatch(message.patch)
      bus.emit('sync:patch', message.patch)
      if (message.patch.collection === 'agentStates') bus.emit('agent:state', { agentId: message.patch.key })
      bus.emit('data:changed', { scopes: SYNC_SCOPES[message.patch.collection] })
    } else {
      const events = store.data.callEvents
      if (!events.some((event) => event.id === message.event.id)) {
        events.unshift(message.event)
        if (events.length > 50) events.length = 50
      }
      bus.emit('call:event', message.event)
    }
    store.notify()
  } finally {
    applyingRemote = false
  }
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<Message> & { patch?: Partial<SyncPatch>; event?: Partial<CallEvent> }
  if (typeof message.tab !== 'string' || message.tab === TAB_ID) return false
  if (message.kind === 'patch') {
    const patch = message.patch
    return !!patch && typeof patch.key === 'string' && COLLECTIONS.includes(patch.collection as SyncCollection) && patch.record !== undefined
  }
  return message.kind === 'event' && !!message.event && typeof message.event.id === 'string'
}

/** Start cross-tab mirroring. Returns the stop function. A no-op where BroadcastChannel is missing. */
export function startTabSync(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  let channel: BroadcastChannel
  try {
    channel = new BroadcastChannel(CHANNEL)
  } catch {
    return () => {}
  }
  const post = (message: Message) => {
    try {
      channel.postMessage(message)
    } catch {
      // A record that cannot be cloned is simply not mirrored.
    }
  }
  const offPatch = bus.on('sync:patch', (patch) => {
    if (!applyingRemote) post({ tab: TAB_ID, kind: 'patch', patch })
  })
  const offEvent = bus.on('call:event', (event) => {
    if (applyingRemote) return
    const me = session.current()
    if (me && event.agentId === me.userId) post({ tab: TAB_ID, kind: 'event', event })
  })
  channel.onmessage = (message: MessageEvent<unknown>) => {
    if (isMessage(message.data)) receive(message.data)
  }
  return () => {
    offPatch()
    offEvent()
    channel.onmessage = null
    try {
      channel.close()
    } catch {
      // already closed
    }
  }
}
