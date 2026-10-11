/** Route `/`: send each persona to their home. Owner: shell. */
import { Navigate } from 'react-router-dom'
import { useSession } from '@portfolio/demo-kit'

import { session } from '@/demo/runtime'

export default function HomeRedirect() {
  const me = useSession(session)
  return <Navigate to={me ? me.home : '/login'} replace />
}
