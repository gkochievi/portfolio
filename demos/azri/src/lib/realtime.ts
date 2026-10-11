/**
 * Bridges the mock event bus to React Query: any live event invalidates the
 * console and inbox caches. Survey queries (key ['survey', ...]) are NEVER
 * invalidated here: re-validating a just-submitted link would bounce the
 * respondent to the "already answered" page.
 *
 * Query-key convention: every key starts with its feature group id.
 * Owner: seed agent.
 */
import type { QueryClient } from '@tanstack/react-query'

import { bus } from '@/demo/core'

const LIVE_SCOPES = ['launcher', 'insights', 'campaigns', 'staff', 'meta'] as const

export function connectRealtime(queryClient: QueryClient): () => void {
  const invalidate = () => {
    for (const scope of LIVE_SCOPES) void queryClient.invalidateQueries({ queryKey: [scope] })
  }
  const offs = [
    bus.on('link:updated', invalidate),
    bus.on('response:created', invalidate),
    bus.on('sms:received', invalidate),
    bus.on('clock:changed', invalidate),
    bus.on('store:reset', () => void queryClient.resetQueries()),
  ]
  return () => {
    for (const off of offs) off()
  }
}
