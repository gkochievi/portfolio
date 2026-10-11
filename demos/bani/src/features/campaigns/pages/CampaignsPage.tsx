import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Banner, EmptyState, ErrorState, IconButton, PageHeader, Skeleton } from '@/components/ui'
import { useMe } from '@/shell/useMe'
import { useCampaign, useCampaigns, useCampaignSettings } from '../api'
import { CampaignEditor } from '../components/CampaignEditor'
import { CampaignPicker } from '../components/CampaignPicker'
import { CampaignStatusCard } from '../components/CampaignStatusCard'

export default function CampaignsPage() {
  const { t } = useTranslation('campaigns')
  const { me } = useMe()
  const [params, setParams] = useSearchParams()
  const list = useCampaigns()
  const settings = useCampaignSettings()

  const campaigns = list.data ?? []
  const requested = params.get('id')
  const validId = requested && campaigns.some((c) => c.id === requested) ? requested : null
  const selectedId = validId ?? (list.isSuccess ? (campaigns[0]?.id ?? null) : null)
  const detail = useCampaign(selectedId)

  const select = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('id', id)
    setParams(next, { replace: true })
  }

  // Mirror the selection into ?id= (also replaces an unknown id, e.g. one outside a cc-admin's scope).
  useEffect(() => {
    if (list.isSuccess && selectedId && requested !== selectedId) select(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.isSuccess, selectedId, requested])

  const scoped = me?.allowedCampaigns != null
  // Prefer the freshest copy: the list is patched on every save and toggle.
  const campaign = campaigns.find((c) => c.id === selectedId) ?? detail.data

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={scoped ? t('subtitleScoped', { n: campaigns.length }) : t('subtitle')}
        actions={
          <IconButton
            label={t('refresh')}
            icon={RefreshCw}
            variant="secondary"
            onClick={() => {
              void list.refetch()
              void detail.refetch()
            }}
          />
        }
      />

      {list.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full max-w-xl rounded-[8px]" />
          <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
            <Skeleton className="h-[320px] rounded-[10px]" />
            <Skeleton className="h-[320px] rounded-[10px]" />
          </div>
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : campaigns.length === 0 ? (
        <EmptyState title={t('empty')} body={scoped ? t('emptyScoped') : t('emptyBody')} />
      ) : (
        <div className="space-y-5">
          <div className="max-w-xl">
            <CampaignPicker campaigns={campaigns} value={selectedId} onChange={select} />
          </div>

          {!campaign && detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : !campaign ? (
            <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
              <Skeleton className="h-[320px] rounded-[10px]" />
              <Skeleton className="h-[320px] rounded-[10px]" />
            </div>
          ) : (
            <>
              {detail.isError && <Banner tone="warning">{t('staleNote')}</Banner>}
              <div className="grid items-start gap-4 lg:grid-cols-[5fr_7fr]">
                <CampaignStatusCard campaign={campaign} settings={settings.data} />
                <CampaignEditor key={campaign.id} campaign={campaign} settings={settings.data} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
