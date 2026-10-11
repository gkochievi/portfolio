import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { Button, Callout, PageHeader, Skeleton, TabNav, type TabNavItem } from '@/components/ui'
import { useConsoleSummary } from '../api'

/** Console shell: page header, the twelve route tabs, and a settings probe with a retry card. */
export default function ConsoleLayout() {
  const { t } = useTranslation('consolePlatform')
  const summary = useConsoleSummary()

  const items: TabNavItem[] = [
    { to: 'tenants', label: t('tabs.tenants'), count: summary.data?.tenants },
    { to: 'health', label: t('tabs.health') },
    { to: 'users', label: t('tabs.users'), count: summary.data?.registered_users },
    { to: 'ai-providers', label: t('tabs.aiProviders') },
    { to: 'integrations', label: t('tabs.integrations') },
    { to: 'embeddings', label: t('tabs.embeddings') },
    { to: 'default-rubric', label: t('tabs.defaultRubric') },
    { to: 'default-bot', label: t('tabs.defaultBot') },
    { to: 'bot-control', label: t('tabs.botControl') },
    { to: 'voices', label: t('tabs.voices') },
    { to: 'anonymous', label: t('tabs.anonymous') },
    { to: 'storage', label: t('tabs.storage') },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('title')} description={t('description')} />
      <TabNav aria-label={t('navLabel')} items={items} />
      {summary.isError ? (
        <Callout
          tone="danger"
          title={t('probe.failedTitle')}
          action={
            <Button size="sm" icon={<RefreshCw />} loading={summary.isFetching} onClick={() => void summary.refetch()}>
              {t('probe.retry')}
            </Button>
          }
        >
          {t('probe.failedBody')}
        </Callout>
      ) : summary.isLoading ? (
        <div role="status" aria-label={t('probe.loading')} className="space-y-3">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  )
}
