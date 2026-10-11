/**
 * Live query invalidation from the in-browser bus. The
 * shell mounts `useLiveInvalidation()` once (DemoChrome).
 *
 * - `data:changed` invalidates its scopes (coalesced per tick).
 * - `call:event` invalidates agents, metrics, calls, me and dialer.
 * - `agent:state` invalidates agents, me and metrics.
 * The last two are throttled to one flush per 500 ms, so a busy floor does not
 * refetch every query on every ring.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { bus } from '@/demo/bus'
import type { DataScope } from '@/types'

const CALL_SCOPES: DataScope[] = ['agents', 'metrics', 'calls', 'me', 'dialer']
const AGENT_SCOPES: DataScope[] = ['agents', 'me', 'metrics']

export function useLiveInvalidation(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const invalidate = (scopes: Iterable<DataScope>) => {
      for (const scope of new Set(scopes)) void queryClient.invalidateQueries({ queryKey: [scope] })
    }

    // data:changed: coalesce writes made in the same tick.
    const immediate = new Set<DataScope>()
    let microtaskQueued = false
    const flushImmediate = () => {
      microtaskQueued = false
      const scopes = [...immediate]
      immediate.clear()
      invalidate(scopes)
    }

    // call:event / agent:state: at most one flush per 500 ms.
    const throttled = new Set<DataScope>()
    let timer: ReturnType<typeof setTimeout> | null = null
    const flushThrottled = () => {
      timer = null
      const scopes = [...throttled]
      throttled.clear()
      invalidate(scopes)
    }
    const schedule = (scopes: DataScope[]) => {
      for (const scope of scopes) throttled.add(scope)
      if (timer === null) timer = setTimeout(flushThrottled, 500)
    }

    const offs = [
      bus.on('data:changed', ({ scopes }) => {
        for (const scope of scopes) immediate.add(scope)
        if (!microtaskQueued) {
          microtaskQueued = true
          queueMicrotask(flushImmediate)
        }
      }),
      bus.on('call:event', () => schedule(CALL_SCOPES)),
      bus.on('agent:state', () => schedule(AGENT_SCOPES)),
    ]

    return () => {
      for (const off of offs) off()
      if (timer !== null) clearTimeout(timer)
    }
  }, [queryClient])
}
