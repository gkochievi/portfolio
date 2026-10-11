import { Landmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/ui'

import { BillingDetailsForm } from '../components/BillingDetailsForm'

export default function BillingDetailsPage() {
  const { t } = useTranslation('ops')
  return (
    <>
      <PageHeader eyebrow={t('billing.eyebrow')} title={t('billing.pageTitle')} description={t('billing.pageDescription')} icon={<Landmark />} />
      <div className="max-w-3xl">
        <BillingDetailsForm embedded />
      </div>
    </>
  )
}
