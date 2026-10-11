/** Status card: ENABLED / DISABLED with a breathing dot, the port-cap note and the power switch (saves at once). */
import { useTranslation } from 'react-i18next'

import { Badge, Card, CardBody, CardHeader, DescriptionList, LiveDot, Mono, Spinner, Switch, toast } from '@/components/ui'
import { messageOf } from '@/api/client'
import { cn } from '@/lib/cn'
import { fmtDateTime } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { Campaign, CampaignSettings, CampaignType } from '@/types'
import { useUpdateCampaign } from '../api'

export const typeTone = (type: CampaignType) => (type.startsWith('ivr') ? 'info' : type === 'preview' ? 'neutral' : 'bronze')

export function CampaignStatusCard({ campaign, settings }: { campaign: Campaign; settings: CampaignSettings | undefined }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const update = useUpdateCampaign()

  const pending = update.isPending ? update.variables?.update.enabled : undefined
  const enabled = pending ?? campaign.enabled

  const toggle = (next: boolean) => {
    update.mutate(
      { id: campaign.id, update: { enabled: next } },
      {
        onSuccess: () => toast.success(t(next ? 'status.toastEnabled' : 'status.toastDisabled', { name: campaign.name })),
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader title={t('status.title')} />
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <LiveDot tone={enabled ? 'success' : 'neutral'} still={!enabled} className="h-2.5 w-2.5" />
              <span
                className={cn('text-[26px] font-bold leading-none tracking-wide', enabled ? 'text-success' : 'text-muted')}
                aria-live="polite"
              >
                {enabled ? t('status.enabled') : t('status.disabled')}
              </span>
              {update.isPending && <Spinner size={14} />}
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {settings
                ? settings.isSuperAdmin
                  ? t('status.noCap')
                  : t('status.cap', { n: settings.maxDedicatedPortsNonSuperAdmin })
                : ' '}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={update.isPending}
            aria-label={t('status.power', { name: campaign.name })}
          />
        </div>

        <DescriptionList
          columns={1}
          items={[
            { label: t('status.id'), value: <Mono>{campaign.id}</Mono> },
            { label: t('status.type'), value: <Badge tone={typeTone(campaign.type)}>{t(`types.${campaign.type}`)}</Badge> },
            { label: t('status.timeZone'), value: campaign.timeZone },
            { label: t('status.updated'), value: fmtDateTime(campaign.updatedAt, lang) },
          ]}
        />
      </CardBody>
    </Card>
  )
}
