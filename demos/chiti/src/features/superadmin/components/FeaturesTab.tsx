import { useTranslation } from 'react-i18next'
import { Camera, MessageCircle, Music2, Phone, Send } from 'lucide-react'
import type { ReactNode } from 'react'

import { Switch, toast } from '@/components/ui'
import type { ChannelFeatures } from '@/types'

import { useSuperErrors, useUpdateFeatures } from '../api'
import type { TenantRow } from '../types'

export const FEATURE_CHANNELS: { key: keyof ChannelFeatures; icon: ReactNode; defaultOn: boolean }[] = [
  { key: 'facebook_messenger', icon: <MessageCircle />, defaultOn: true },
  { key: 'instagram', icon: <Camera />, defaultOn: true },
  { key: 'whatsapp', icon: <Phone />, defaultOn: true },
  { key: 'telegram', icon: <Send />, defaultOn: false },
  { key: 'tiktok', icon: <Music2 />, defaultOn: false },
]

/** Channel switches: the same flags as the platform access grid. */
export function FeaturesTab({ tenant }: { tenant: TenantRow }) {
  const { t } = useTranslation('superadmin')
  const errors = useSuperErrors()
  const update = useUpdateFeatures()
  const locked = tenant.state === 'deleted'

  const toggle = async (key: keyof ChannelFeatures, value: boolean) => {
    try {
      await update.mutateAsync({ id: tenant.id, [key]: value })
      toast.success(t(value ? 'features.enabled' : 'features.disabled', { channel: t(`common:channel.${key}`) }))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">{t('features.description')}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-modal border border-line bg-panel">
        {FEATURE_CHANNELS.map((channel) => (
          <li key={channel.key} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-ui bg-sunken text-accent [&_svg]:size-[18px]" aria-hidden>
              {channel.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{t(`common:channel.${channel.key}`)}</p>
              <p className="text-[12px] text-muted">{channel.defaultOn ? t('features.defaultOn') : t('features.defaultOff')}</p>
            </div>
            <Switch
              checked={tenant.features[channel.key]}
              onCheckedChange={(value) => void toggle(channel.key, value)}
              disabled={locked || update.isPending}
              aria-label={t('features.switch', { channel: t(`common:channel.${channel.key}`) })}
            />
          </li>
        ))}
      </ul>
      {locked && <p className="text-[13px] text-warning">{t('features.locked')}</p>}
    </div>
  )
}
