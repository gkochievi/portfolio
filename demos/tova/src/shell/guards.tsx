/**
 * Layout-route guards: render <Outlet/> or redirect.
 * Signed out (or suspended) -> /login?next=<path>; signed in without the role -> that role's home.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { roleAllows, type Access } from '@/lib/roles'
import { roleHome, useCurrentUser } from './session'

function useLoginRedirect(): string {
  const location = useLocation()
  return `/login?next=${encodeURIComponent(location.pathname + location.search)}`
}

export function RequireAuth() {
  const user = useCurrentUser()
  const login = useLoginRedirect()
  if (!user || user.disabled) return <Navigate to={login} replace />
  return <Outlet />
}

export function RequireRole({ allow }: { allow: Access }) {
  const user = useCurrentUser()
  const login = useLoginRedirect()
  if (!user || user.disabled) return <Navigate to={login} replace />
  if (!roleAllows(user.role, allow)) return <Navigate to={roleHome(user.role)} replace />
  return <Outlet />
}
