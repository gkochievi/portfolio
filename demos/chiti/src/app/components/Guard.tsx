import { useEffect, type ReactElement } from 'react'
import { Navigate, useLocation, useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { RouteHandle } from '@/routes'
import { useAccount } from '@/lib/account'
import { toast } from '@/components/ui'

function RedirectHome({ to }: { to: string }) {
  const { t } = useTranslation('shell')
  useEffect(() => {
    toast.warning(t('toast.noAccess'), { id: 'no-access' })
  }, [t])
  return <Navigate to={to} replace />
}

/**
 * Role guard for the console layouts: the deepest matched `handle.roles` wins.
 * Signed out (or the customer persona) -> /login?next=…; wrong role -> the account's home with a toast.
 * Returns null when access is fine.
 */
export function useRouteGuard(): ReactElement | null {
  const matches = useMatches()
  const account = useAccount()
  const location = useLocation()
  const roles = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.roles).find((r) => r && r.length)
  if (!roles) return null
  if (!account || account.role === 'customer') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (!roles.includes(account.role)) return <RedirectHome to={account.homeRoute} />
  return null
}
