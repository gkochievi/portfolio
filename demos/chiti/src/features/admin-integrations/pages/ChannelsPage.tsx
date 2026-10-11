import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/client'
import { ErrorState, PageHeader, Skeleton } from '@/components/ui'

import { useIntegrations } from '../api'
import { MetaCard } from '../components/MetaCard'
import { BackLink } from '../components/shared'
import { TelegramCard } from '../components/TelegramCard'
import { TikTokCard } from '../components/TikTokCard'
import { META_CHANNELS } from '../types'

export default function ChannelsPage() {
  const { t } = useTranslation(['adminIntegrations', 'common'])
  const query = useIntegrations()
  const data = query.data

  const header = (
    <>
      <BackLink />
      <PageHeader title={t('channels.title')} description={t('channels.description')} />
    </>
  )

  if (query.isError && !data) {
    return (
      <div>
        {header}
        <ErrorState title={t('channels.loadError')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={t('common:actions.retry')} />
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {META_CHANNELS.map((channel) => {
          const integration = data.meta.find((row) => row.channel === channel)
          return integration ? <MetaCard key={channel} integration={integration} allowed={data.features[channel]} /> : null
        })}
        <TelegramCard integration={data.telegram} allowed={data.features.telegram} />
        <TikTokCard integration={data.tiktok} allowed={data.features.tiktok} pending={data.tiktokPending} />
      </div>
    </div>
  )
}
