import { useCallback, useEffect, useRef, useState } from 'react'

import { subscribe } from '@/demo/live'

export type SocketState = 'connecting' | 'open' | 'closed'

interface SocketOptions {
  /** Skip connecting entirely (e.g. while signed out). */
  enabled?: boolean
  onMessage: (data: unknown) => void
}

/**
 * A handshake takes a moment even against localhost, and the live indicator in
 * the header is built to show it. Going straight to `open` would read as a
 * painted-on badge.
 */
const HANDSHAKE_MS = 500

/**
 * The console's websocket, wired to the in-process event bus instead of a
 * server. Same signature, same `{state, send}`, same lifecycle — the callback
 * lives in a ref so re-renders never detach the subscription.
 */
export function useSocket(path: string, { enabled = true, onMessage }: SocketOptions) {
  const [state, setState] = useState<SocketState>('closed')
  const handlerRef = useRef(onMessage)
  const openRef = useRef(false)

  handlerRef.current = onMessage

  // Nothing is listening on the other end — the mock pushes, it never answers —
  // but the return value still reports whether it could have been sent.
  const send = useCallback((_payload: unknown) => openRef.current, [])

  useEffect(() => {
    if (!enabled) {
      openRef.current = false
      setState('closed')
      return
    }

    setState('connecting')
    const timer = window.setTimeout(() => {
      openRef.current = true
      setState('open')
    }, HANDSHAKE_MS)

    const unsubscribe = subscribe(path, (message) => handlerRef.current(message))

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      openRef.current = false
      setState('closed')
    }
  }, [path, enabled])

  return { state, send }
}
