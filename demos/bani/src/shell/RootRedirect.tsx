/** `/` sends each persona to its first allowed route (spec order). */
import { Navigate } from 'react-router-dom'

import { Skeleton } from '@/components/ui'
import { firstPathFor } from './nav'
import { useMe } from './useMe'
import { ForbiddenPage } from './ForbiddenPage'

export function RootRedirect() {
  const { me } = useMe()
  if (!me) return <Skeleton className="h-8 w-56" />
  const to = firstPathFor(me.features)
  if (to === '/login') return <ForbiddenPage />
  return <Navigate to={to} replace />
}
