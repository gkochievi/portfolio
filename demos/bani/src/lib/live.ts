/** React glue for the in-browser event bus. */
import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'

import { bus } from '@/demo'
import type { DemoEvents } from '@/types'

/** Run `handler` whenever the bus emits `name`. The latest handler is always used. */
export function useDemoEvent<K extends keyof DemoEvents>(name: K, handler: (payload: DemoEvents[K]) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const listener = (payload: DemoEvents[K]) => ref.current(payload)
    bus.on(name, listener)
    return () => bus.off(name, listener)
  }, [name])
}

/** Invalidate `queryKey` whenever the bus emits `name`. */
export function useInvalidateOn<K extends keyof DemoEvents>(name: K, queryKey: QueryKey): void {
  const queryClient = useQueryClient()
  const key = JSON.stringify(queryKey)
  useDemoEvent(name, () => {
    void queryClient.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey })
  })
}
