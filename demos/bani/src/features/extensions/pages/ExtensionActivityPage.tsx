import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Button, Card, CardBody, ConfirmDialog, PageHeader, Skeleton, toast } from '@/components/ui'
import { canSeeExtensionActivity } from '@/lib/rbac'
import { ForbiddenPage } from '@/shell/ForbiddenPage'
import { useMe } from '@/shell/useMe'
import { useExtensionActivity, usePurgeActivity } from '../api'
import { ActivityTable } from '../components/ActivityTable'

export default function ExtensionActivityPage() {
  const { t } = useTranslation('extensions')
  const { role, isLoading } = useMe()
  const allowed = canSeeExtensionActivity(role)
  const activity = useExtensionActivity(allowed)
  const purge = usePurgeActivity()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!allowed) return <ForbiddenPage feature="extensions" />

  const onPurge = () => {
    purge.mutate(undefined, {
      onSuccess: ({ deleted }) => {
        setConfirmOpen(false)
        if (deleted > 0) toast.success(t('activity.purged', { count: deleted }))
        else toast(t('activity.nothingToPurge'))
      },
      onError: (error) => {
        setConfirmOpen(false)
        toast.error(errorMessage(error))
      },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/extensions"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
        {t('activity.back')}
      </Link>
      <PageHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => void activity.refetch()}
              className={activity.isFetching ? '[&_svg]:animate-spin' : undefined}
            >
              {t('activity.refresh')}
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
              {t('activity.purge')}
            </Button>
          </>
        }
      />
      <Card>
        <CardBody>
          <ActivityTable
            rows={activity.data ?? []}
            loading={activity.isLoading}
            error={activity.isError ? activity.error : undefined}
            onRetry={() => void activity.refetch()}
          />
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('activity.purgeTitle')}
        body={t('activity.purgeBody')}
        confirmLabel={t('activity.purgeConfirm')}
        tone="danger"
        busy={purge.isPending}
        onConfirm={onPurge}
      />
    </div>
  )
}
