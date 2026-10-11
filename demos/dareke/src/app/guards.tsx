/**
 * Route guards: `RequireAuth`, `RequireRole` and the `/` redirect (routes.tsx uses them).
 */
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@portfolio/demo-kit'

import { session } from '@/demo/store'
import type { Role } from '@/types'

/** Signed out -> /login?next=...; otherwise renders children (or the nested routes). */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const me = useSession(session)
  const location = useLocation()
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children ?? <Outlet />}</>
}

/** Wrong role -> the role's own home (or a "no access" panel, shell's choice). */
export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const me = useSession(session)
  if (!me) return <Navigate to="/login" replace />
  if (!roles.includes(me.role)) return <Navigate to={me.home} replace />
  return <>{children ?? <Outlet />}</>
}

/** `/`: send each role to its home (operator /agent, supervisor /supervisor, admins /admin). */
export function RoleRedirect() {
  const me = useSession(session)
  return <Navigate to={me ? me.home : '/login'} replace />
}
