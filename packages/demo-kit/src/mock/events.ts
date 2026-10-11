/**
 * A typed in-memory event bus — the stand-in for a websocket or SSE stream.
 *
 * Handlers `emit('order:created', order)` after a write; the UI subscribes
 * exactly where it would have opened a socket. Declare the event map once:
 *
 * ```ts
 * interface Events { 'order:created': Order; 'feed:tick': undefined }
 * export const bus = createEventBus<Events>()
 * bus.emit('feed:tick')                       // payload optional for undefined events
 * ```
 *
 * The constraint is `{ [K in keyof Events]: unknown }` rather than
 * `Record<string, unknown>` so a plain `interface` (which has no index
 * signature) is accepted as the event map.
 */

/** A listener for one event type. */
export type BusListener<P> = (payload: P) => void

/** `emit()`'s payload argument: optional when the event carries `undefined`. */
export type EmitArgs<P> = [P] extends [undefined | void] ? [payload?: P] : [payload: P]

/** The object `createEventBus()` returns. */
export interface EventBus<Events extends { [K in keyof Events]: unknown }> {
  /** Subscribe; returns the unsubscribe. */
  on<K extends keyof Events & string>(type: K, listener: BusListener<Events[K]>): () => void
  /** Unsubscribe a listener added with `on()` or `once()`. */
  off<K extends keyof Events & string>(type: K, listener: BusListener<Events[K]>): void
  /** Subscribe for the next event only; returns the unsubscribe. */
  once<K extends keyof Events & string>(type: K, listener: BusListener<Events[K]>): () => void
  /** Deliver synchronously to every current listener of `type`. */
  emit<K extends keyof Events & string>(type: K, ...args: EmitArgs<Events[K]>): void
  /** Drop every listener — for a demo reset that should silence old screens. */
  clear(): void
}

interface Entry {
  listener: BusListener<never>
  once: boolean
}

/** Surface a listener's error without letting it starve the listeners after it. */
function report(error: unknown): void {
  if (typeof reportError === 'function') reportError(error)
  else console.error(error)
}

/** Create a typed event bus. One per demo is the norm. */
export function createEventBus<Events extends { [K in keyof Events]: unknown }>(): EventBus<Events> {
  const channels = new Map<string, Set<Entry>>()

  function add(type: string, listener: BusListener<never>, once: boolean): () => void {
    let entries = channels.get(type)
    if (!entries) {
      entries = new Set()
      channels.set(type, entries)
    }
    const entry: Entry = { listener, once }
    entries.add(entry)
    return () => {
      entries.delete(entry)
    }
  }

  function off(type: string, listener: BusListener<never>): void {
    const entries = channels.get(type)
    if (!entries) return
    for (const entry of entries) if (entry.listener === listener) entries.delete(entry)
  }

  return {
    on: (type, listener) => add(type, listener as BusListener<never>, false),
    once: (type, listener) => add(type, listener as BusListener<never>, true),
    off: (type, listener) => off(type, listener as BusListener<never>),
    emit(type, ...args) {
      const entries = channels.get(type)
      if (!entries || entries.size === 0) return
      const payload = args[0]
      // Iterate a copy: a listener may subscribe or unsubscribe while we deliver.
      for (const entry of [...entries]) {
        if (entry.once) entries.delete(entry)
        try {
          ;(entry.listener as BusListener<unknown>)(payload)
        } catch (error) {
          report(error)
        }
      }
    },
    clear() {
      channels.clear()
    },
  }
}
