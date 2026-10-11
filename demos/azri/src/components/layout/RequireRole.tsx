import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@portfolio/demo-kit'

import { session } from '@/demo/core'
import type { Role } from '@/types'

/**
 * Route guard. Signed out (or the respondent) -> /login?next=...;
 * signed in with a console role that is not allowed here -> that account's home.
 * Owner: shell agent.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useSession(session)
  const location = useLocation()
  if (!me || me.role === 'respondent') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (!roles.includes(me.role)) return <Navigate to={me.home} replace />
  return <>{children}</>
}
