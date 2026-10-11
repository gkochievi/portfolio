/**
 * Link expired (/expired, ?t=<tenantId>). Owner: feature group survey.
 */
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useRespondentTenant } from '@/components/layout/RespondentLayout'
import { Button } from '@/components/ui'
import { useTenantFromParam } from '../api'
import { EndScreen } from '../components/EndScreen'

export default function ExpiredPage() {
  const { t } = useTranslation('survey')
  const { tenant } = useTenantFromParam()
  useRespondentTenant(tenant)

  return (
    <EndScreen
      illustration="expired"
      eyebrow={tenant?.name}
      title={t('expired.title')}
      description={
        <>
          {t('expired.description')}
          {tenant && <span className="mt-2 block">{t('expired.nextTenant', { tenant: tenant.name })}</span>}
        </>
      }
    >
      <Button asChild variant="brand" size="lg" fullWidth leftIcon={<Inbox strokeWidth={1.75} />}>
        <Link to="/">{t('demo.backToInbox')}</Link>
      </Button>
    </EndScreen>
  )
}
