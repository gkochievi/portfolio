import { useSession } from '@portfolio/demo-kit'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { session } from '@/demo'
import type { Role } from '@/types'

/** Gate a subtree by role: guests go to /login, the wrong role goes home. OWNED BY: shell. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const account = useSession(session)
  const location = useLocation()
  if (!account) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (!roles.includes(account.role)) return <Navigate to={account.home} replace />
  return <Outlet />
}
