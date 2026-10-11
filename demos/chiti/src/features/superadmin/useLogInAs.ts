import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { api } from '@/api/client'
import { toast } from '@/components/ui'
import { signInAs, useAccount } from '@/lib/account'

import { useImpersonate, useSuperErrors } from './api'
import type { MemberRole, MembersResponse } from './types'

/**
 * "Log in as": ask the API for the account, switch the session (the shell then
 * shows the impersonation banner) and land on that account's home route, in the
 * same tab.
 */
export function useLogInAs() {
  const { t } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const me = useAccount()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const impersonate = useImpersonate()
  const [busy, setBusy] = useState(false)

  const logInAs = async (role: MemberRole, memberId: string) => {
    if (!me || busy) return
    setBusy(true)
    try {
      const result = await impersonate.mutateAsync({ role, memberId })
      signInAs(result.accountId, { impersonatedBy: me.id })
      qc.clear()
      navigate(result.homeRoute)
    } catch (failure) {
      toast.error(errors.text(failure))
      setBusy(false)
    }
  }

  const logInAsFirstAdmin = async (tenantId: string) => {
    try {
      const members = await api.get<MembersResponse>(`/superadmin/tenants/${tenantId}/members`)
      const admin = members.admins[0]
      if (!admin) {
        toast.warning(t('errors.no_admin'))
        return
      }
      await logInAs('admin', admin.id)
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  return { logInAs, logInAsFirstAdmin, busy }
}
