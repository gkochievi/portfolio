import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/ui'

import { PartnerForm } from '../components/PartnerForm'

export default function PartnerCreatePage() {
  const { t } = useTranslation('partners')
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('create.title')}
        description={t('create.description')}
        back={{ to: '/admin/partners', label: t('detail.backToList') }}
      />
      <PartnerForm />
    </div>
  )
}
