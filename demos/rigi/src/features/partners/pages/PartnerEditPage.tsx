import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Button, EmptyState, PageHeader, PageSkeleton } from '@/components/ui'

import { usePartner } from '../api'
import { PartnerForm } from '../components/PartnerForm'

export default function PartnerEditPage() {
  const { t } = useTranslation('partners')
  const { partnerId } = useParams()
  const query = usePartner(partnerId)
  const partner = query.data

  if (query.isLoading) return <PageSkeleton />
  if (!partner) {
    return (
      <EmptyState
        title={query.isError ? t('errors.load') : t('detail.notFoundTitle')}
        description={query.isError ? undefined : t('detail.notFoundDescription')}
        action={
          query.isError ? (
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('common:actions.retry')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('edit.title', { name: partner.name })}
        description={t('edit.description')}
        back={{ to: `/admin/partners/${partner.id}`, label: partner.name }}
      />
      <PartnerForm key={partner.updatedAt} partner={partner} />
    </div>
  )
}
