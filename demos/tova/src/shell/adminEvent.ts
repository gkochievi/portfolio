/**
 * The event the admin console is looking at: the route `:eventId`, else
 * `?event=`, else the active/current event. The AdminShell switcher writes it.
 */
import { matchPath, useLocation, useSearchParams } from 'react-router-dom'

import { useCurrentEvents } from '@/lib/queries'

export function eventIdFromPath(pathname: string): string | null {
  const match = matchPath('/admin/events/:eventId/*', pathname) ?? matchPath('/admin/events/:eventId', pathname)
  return match?.params.eventId ?? null
}

export function useAdminEventId(): string | null {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { data } = useCurrentEvents()
  return eventIdFromPath(pathname) ?? params.get('event') ?? data?.active?.id ?? data?.current?.id ?? null
}
