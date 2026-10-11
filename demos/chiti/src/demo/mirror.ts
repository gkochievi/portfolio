/**
 * BroadcastChannel('chiti-demo') mirror: keeps two open tabs of the demo in
 * sync without persisting anything. A receiving tab upserts the entity into
 * its own store and emits the event locally (never re-broadcasting).
 * Simulators run only in the leader tab (the oldest one, via hello/heartbeat).
 */
import type { ChitiDb, ChitiEvents, DemoControls } from '@/types'

import { emitLocal, setOutbound } from './bus'
import { store, TAB_TAG } from './store'

type EventName = keyof ChitiEvents
type Envelope =
  | { kind: 'event'; from: string; event: EventName; payload: unknown }
  | { kind: 'hello' | 'here' | 'beat'; from: string; bootedAt: number }
  | { kind: 'bye'; from: string }

const CHANNEL_NAME = 'chiti-demo'
const HEARTBEAT_MS = 2_000
const PEER_TIMEOUT_MS = 6_500

const UPSERT: Partial<Record<EventName, keyof ChitiDb>> = {
  'session:upsert': 'sessions',
  'message:upsert': 'messages',
  'note:upsert': 'notes',
  'customer:upsert': 'customers',
  'assignment:upsert': 'assignments',
  'feedback:new': 'feedback',
  'operator:upsert': 'operators',
  'copilot:update': 'copilotDrafts',
  'staff:message': 'staffMessages',
  'staff:conversation': 'staffConversations',
  'activity:new': 'activity',
  'tenant:upsert': 'tenants',
  'comment:upsert': 'comments',
}
const BY_TENANT: Partial<Record<EventName, 'settings' | 'workingHours' | 'integrations'>> = {
  'settings:update': 'settings',
  'working-hours:update': 'workingHours',
  'integration:update': 'integrations',
}

const bootedAt = Date.now()
const peers = new Map<string, { bootedAt: number; seen: number }>()
const leadershipListeners = new Set<(leader: boolean) => void>()
let channel: BroadcastChannel | null = null
let leader = true
let applyingRemote = false

function post(message: Envelope): void {
  try {
    channel?.postMessage(message)
  } catch (error) {
    console.warn('[chiti] mirror post failed', error)
  }
}

function upsertRow(collection: keyof ChitiDb, entity: { id: string }, prepend: boolean): void {
  const list = store.data[collection] as unknown as { id: string }[]
  const index = list.findIndex((row) => row.id === entity.id)
  if (index >= 0) list[index] = entity
  else if (prepend) list.unshift(entity)
  else list.push(entity)
}

function replaceByTenant(collection: 'settings' | 'workingHours' | 'integrations', entity: { tenantId: string }): void {
  const list = store.data[collection] as unknown as { tenantId: string }[]
  const index = list.findIndex((row) => row.tenantId === entity.tenantId)
  if (index >= 0) list[index] = entity
  else list.push(entity)
}

function apply(event: EventName, payload: unknown): void {
  if (event === 'demo:reset') {
    applyingRemote = true
    try {
      store.reset() // the reset hook in ./index emits 'demo:reset' locally
    } finally {
      applyingRemote = false
    }
    return
  }
  if (event === 'demo:controls') store.data.demo = payload as DemoControls
  else if (event === 'note:deleted') {
    const { id } = payload as { id: string }
    store.data.notes = store.data.notes.filter((note) => note.id !== id)
  } else {
    const byTenant = BY_TENANT[event]
    const collection = UPSERT[event]
    if (byTenant) replaceByTenant(byTenant, payload as { tenantId: string })
    else if (collection) upsertRow(collection, payload as { id: string }, event === 'activity:new')
  }
  emitLocal(event, payload as ChitiEvents[typeof event])
}

function recomputeLeader(): void {
  const now = Date.now()
  for (const [id, peer] of peers) if (now - peer.seen > PEER_TIMEOUT_MS) peers.delete(id)
  let next = true
  for (const [id, peer] of peers) {
    if (peer.bootedAt < bootedAt || (peer.bootedAt === bootedAt && id < TAB_TAG)) next = false
  }
  if (next === leader) return
  leader = next
  for (const listener of [...leadershipListeners]) listener(leader)
}

/** True while a remote reset is being applied (the reset hook must not re-broadcast it). */
export function isApplyingRemote(): boolean {
  return applyingRemote
}

/** True in the tab that runs the simulators. */
export function isLeader(): boolean {
  return leader
}

export function onLeadershipChange(listener: (leader: boolean) => void): () => void {
  leadershipListeners.add(listener)
  return () => {
    leadershipListeners.delete(listener)
  }
}

/** Tell the other tabs to reset too. */
export function postReset(): void {
  post({ kind: 'event', from: TAB_TAG, event: 'demo:reset', payload: undefined })
}

/** Open the channel (idempotent). Returns a stop function. */
export function startMirror(): () => void {
  if (channel || typeof BroadcastChannel === 'undefined') return () => {}
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent<Envelope>) => {
    const message = event.data
    if (!message || message.from === TAB_TAG) return
    if (message.kind === 'event') {
      apply(message.event, message.payload)
      return
    }
    if (message.kind === 'bye') {
      peers.delete(message.from)
    } else {
      peers.set(message.from, { bootedAt: message.bootedAt, seen: Date.now() })
      if (message.kind === 'hello') post({ kind: 'here', from: TAB_TAG, bootedAt })
    }
    recomputeLeader()
  }
  setOutbound((event, payload) => {
    if (!applyingRemote) post({ kind: 'event', from: TAB_TAG, event, payload })
  })
  post({ kind: 'hello', from: TAB_TAG, bootedAt })
  const heartbeat = setInterval(() => {
    post({ kind: 'beat', from: TAB_TAG, bootedAt })
    recomputeLeader()
  }, HEARTBEAT_MS)
  const bye = () => post({ kind: 'bye', from: TAB_TAG })
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('pagehide', bye)

  return () => {
    clearInterval(heartbeat)
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('pagehide', bye)
    bye()
    setOutbound(null)
    channel?.close()
    channel = null
  }
}
