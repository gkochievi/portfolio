import { useTranslation } from 'react-i18next'

import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { useInvalidateOn } from '@/lib/live'
import { accessKeys, useRbacMatrix } from '../api'
import { RbacMatrix } from '../components/RbacMatrix'

function MatrixSkeleton() {
  return (
    <Card className="p-4" aria-busy="true">
      <Skeleton className="mb-4 h-5 w-48" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-line py-3">
          <Skeleton className="h-4 w-44" />
          <div className="ml-auto flex gap-6">
            {Array.from({ length: 7 }, (_, j) => (
              <Skeleton key={j} className="h-8 w-8" />
            ))}
          </div>
        </div>
      ))}
    </Card>
  )
}

export default function RolesPage() {
  const { t } = useTranslation('access')
  const query = useRbacMatrix()
  useInvalidateOn('rbac:changed', accessKeys.rbac)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('roles.title')} subtitle={t('roles.subtitle')} />
      {query.isLoading ? (
        <MatrixSkeleton />
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <RbacMatrix data={query.data} />
      )}
    </div>
  )
}
