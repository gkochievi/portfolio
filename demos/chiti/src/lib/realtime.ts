/** React glue for the realtime bus. */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'

import { bus } from '@/demo/bus'
import type { ChitiEvents } from '@/types'

/** Subscribe to one bus event for the life of the component (the latest handler is always called). */
export function useBusEvent<K extends keyof ChitiEvents>(event: K, handler: (payload: ChitiEvents[K]) => void): void {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => bus.on(event, (payload) => ref.current(payload)), [event])
}

/** Invalidate `queryKey` when any of `events` fires (throttled to one refetch per ~150 ms). */
export function useInvalidateOn(events: (keyof ChitiEvents)[], queryKey: QueryKey): void {
  const client = useQueryClient()
  const keyRef = useRef(queryKey)
  useEffect(() => {
    keyRef.current = queryKey
  })
  const eventsKey = events.join('|')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const fire = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void client.invalidateQueries({ queryKey: keyRef.current })
      }, 150)
    }
    const names = eventsKey.split('|').filter(Boolean) as (keyof ChitiEvents)[]
    const offs = names.map((name) => bus.on(name, fire))
    return () => {
      for (const off of offs) off()
      if (timer) clearTimeout(timer)
    }
  }, [client, eventsKey])
}

/** A `Date.now()` that re-renders every `intervalMs` (wait timers, relative times). */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
