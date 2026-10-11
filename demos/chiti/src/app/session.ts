/**
 * Shell helpers over the data-core session (owner: shell).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { ChitiAccount, Operator, Role, Tenant, TenantSettings, WorkingHoursStatus } from '@/types'
import { request } from '@/lib/api'
import { signOut, useAccount } from '@/lib/account'
import { useInvalidateOn } from '@/lib/realtime'
import { toast } from '@/components/ui'

export interface MeResponse {
  account: ChitiAccount
  tenant: Tenant | null
  settings: TenantSettings | null
  workingHours: WorkingHoursStatus | null
  /** The operator record (operators) or the admin's linked operator profile. */
  operator?: Operator | null
}

/** GET /api/auth/me for the signed-in staff account (cached per account). */
export function useMe() {
  const account = useAccount()
  const staff = !!account && account.role !== 'customer'
  useInvalidateOn(['operator:upsert', 'settings:update', 'working-hours:update', 'tenant:upsert'], ['me'])
  return useQuery({
    queryKey: ['me', account?.id ?? 'anon'],
    queryFn: () => request<MeResponse>('GET', '/auth/me'),
    enabled: staff,
  })
}

/** Signs out through the API (operator goes offline, activity is logged), then routes to /login. */
export function useSignOut() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation('shell')
  return async (options?: { silent?: boolean; message?: string }) => {
    try {
      await request('POST', '/auth/logout')
    } catch {
      /* already signed out on the mock side */
    }
    signOut()
    navigate('/login', { replace: true })
    qc.clear()
    if (!options?.silent) toast(options?.message ?? t('toast.signedOut'))
  }
}

/** Prefix of the console a role lives in. */
export function surfaceOf(role: Role): string {
  if (role === 'operator') return '/operator'
  if (role === 'admin' || role === 'supervisor') return '/admin'
  if (role === 'superadmin') return '/superadmin'
  return '/'
}

/** Localised display name of an account. */
export function accountName(account: Pick<ChitiAccount, 'name' | 'nameKa'>, lang: string): string {
  return lang.startsWith('ka') ? account.nameKa || account.name : account.name
}
