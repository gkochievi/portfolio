import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, VenetianMask } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { signInAs, useAccount, useImpersonation } from '@/lib/account'
import { Button } from '@/components/ui'
import { accountName } from '../session'

/** Shown while the super admin is "logged in as" a tenant member (same tab). */
export function ImpersonationBanner() {
  const { t, i18n } = useTranslation('shell')
  const imp = useImpersonation()
  const account = useAccount()
  const navigate = useNavigate()
  const qc = useQueryClient()
  if (!imp || !account) return null
  return (
    <div role="status" className="relative z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-on-primary bg-primary px-4 py-2 text-[13px] text-on-primary">
      <span className="inline-flex items-center gap-2">
        <VenetianMask size={16} strokeWidth={1.75} />
        {t('impersonation.banner', { name: accountName(account, i18n.language), role: t(`common:role.${account.role}`) })}
      </span>
      <Button
        size="xs"
        variant="secondary"
        className="border-on-primary text-on-primary hover:bg-on-primary/10"
        leftIcon={<ArrowLeft />}
        onClick={() => {
          const back = signInAs(imp.by.id)
          qc.clear()
          navigate(back.homeRoute)
        }}
      >
        {t('impersonation.back')}
      </Button>
    </div>
  )
}
