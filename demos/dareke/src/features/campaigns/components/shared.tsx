/** Small pieces shared by the campaigns list and detail screens. */
import { CheckCircle2, CircleDashed, CircleSlash, Clock3, Pause, PhoneCall, PhoneMissed, PhoneOff, Play, Archive, Square, Ban, RotateCcw, Loader } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, ConfirmDialog, StatusPill } from '@/components/ui'
import { CAMPAIGN_ERRORS } from '@/demo/handlers/campaigns'
import { errorMessage } from '@/lib/api'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { CampaignStatus, CampaignWithStats, NumberStatus, Tone } from '@/types'

import { useLifecycle, type LifecycleAction } from '../api'

const ic = { size: 14, strokeWidth: 1.75 } as const

export const CAMPAIGN_TONE: Record<CampaignStatus, { tone: Tone; icon: ReactNode; pattern?: 'solid' | 'hatch' | 'outline' }> = {
  draft: { tone: 'muted', icon: <CircleDashed {...ic} />, pattern: 'outline' },
  active: { tone: 'success', icon: <Play {...ic} /> },
  paused: { tone: 'warning', icon: <Pause {...ic} />, pattern: 'hatch' },
  completed: { tone: 'info', icon: <CheckCircle2 {...ic} /> },
  archived: { tone: 'ink', icon: <Archive {...ic} />, pattern: 'outline' },
}

export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  const { t } = useTranslation()
  const s = CAMPAIGN_TONE[status]
  return <StatusPill tone={s.tone} icon={s.icon} label={t(`campaignStatus.${status}`)} pattern={s.pattern ?? 'solid'} size="sm" />
}

const NUMBER_TONE: Record<NumberStatus, { tone: Tone; icon: ReactNode; pattern?: 'solid' | 'hatch' | 'outline' | 'call' }> = {
  PENDING: { tone: 'muted', icon: <Clock3 {...ic} />, pattern: 'outline' },
  DIALING: { tone: 'lime', icon: <Loader {...ic} />, pattern: 'call' },
  CONNECTED: { tone: 'lime', icon: <PhoneCall {...ic} />, pattern: 'call' },
  COMPLETED: { tone: 'success', icon: <CheckCircle2 {...ic} /> },
  NO_ANSWER: { tone: 'warning', icon: <PhoneMissed {...ic} /> },
  BUSY: { tone: 'warning', icon: <PhoneOff {...ic} /> },
  FAILED: { tone: 'danger', icon: <CircleSlash {...ic} /> },
  DNC: { tone: 'ink', icon: <Ban {...ic} /> },
  CALLBACK_SCHEDULED: { tone: 'info', icon: <RotateCcw {...ic} /> },
}

export function NumberStatusPill({ status }: { status: NumberStatus }) {
  const { t } = useTranslation()
  const s = NUMBER_TONE[status]
  return <StatusPill tone={s.tone} icon={s.icon} label={t(`numberStatus.${status}`)} pattern={s.pattern ?? 'solid'} size="sm" />
}

const ERROR_KEYS = Object.fromEntries(Object.entries(CAMPAIGN_ERRORS).map(([key, message]) => [message, key])) as Record<string, string>

/** Translate a known API message; fall back to the raw message. */
export function useApiErrorText() {
  const { t } = useTranslation('campaigns')
  return (error: unknown) => {
    const message = errorMessage(error)
    const key = ERROR_KEYS[message]
    return key ? t(`errors.${key}`) : message
  }
}

export const canStart = (status: CampaignStatus) => status === 'draft' || status === 'paused'
export const canPause = (status: CampaignStatus) => status === 'active'
export const canStop = (status: CampaignStatus) => status !== 'completed' && status !== 'archived'

/** Start / Pause / Stop with toasts (Stop asks first). */
export function useLifecycleActions() {
  const { t } = useTranslation('campaigns')
  const l = useLocalized()
  const errText = useApiErrorText()
  const lifecycle = useLifecycle()
  const [stopping, setStopping] = useState<CampaignWithStats | null>(null)

  const run = (campaign: CampaignWithStats, action: LifecycleAction) =>
    lifecycle.mutate(
      { id: campaign.id, action },
      {
        onSuccess: () => {
          toast.success(t(`lifecycle.${action}Done`, { name: l(campaign.name) }))
          setStopping(null)
        },
        onError: (error) => {
          toast.error(t(`lifecycle.${action}Failed`), { description: errText(error) })
          setStopping(null)
        },
      },
    )

  const request = (campaign: CampaignWithStats, action: LifecycleAction) => (action === 'stop' ? setStopping(campaign) : run(campaign, action))

  const dialog = (
    <ConfirmDialog
      open={stopping !== null}
      onOpenChange={(open) => !open && setStopping(null)}
      title={t('lifecycle.stopTitle')}
      description={t('lifecycle.stopBody', { name: stopping ? l(stopping.name) : '' })}
      confirmLabel={t('lifecycle.stop')}
      tone="danger"
      loading={lifecycle.isPending}
      onConfirm={() => stopping && run(stopping, 'stop')}
    />
  )
  return { request, dialog, pending: lifecycle.isPending ? lifecycle.variables : undefined }
}

export function LifecycleButtons({ campaign, size = 'sm' }: { campaign: CampaignWithStats; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('campaigns')
  const { request, dialog, pending } = useLifecycleActions()
  const busy = (action: LifecycleAction) => pending?.id === campaign.id && pending.action === action
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canStart(campaign.status) && (
        <Button variant="dial" size={size} icon={<Play size={16} strokeWidth={1.75} />} loading={busy('start')} onClick={() => request(campaign, 'start')}>
          {campaign.status === 'paused' ? t('lifecycle.resume') : t('lifecycle.start')}
        </Button>
      )}
      {canPause(campaign.status) && (
        <Button variant="outline" size={size} icon={<Pause size={16} strokeWidth={1.75} />} loading={busy('pause')} onClick={() => request(campaign, 'pause')}>
          {t('lifecycle.pause')}
        </Button>
      )}
      {canStop(campaign.status) && (
        <Button variant="ghost" size={size} icon={<Square size={16} strokeWidth={1.75} />} onClick={() => request(campaign, 'stop')}>
          {t('lifecycle.stop')}
        </Button>
      )}
      {dialog}
    </div>
  )
}
