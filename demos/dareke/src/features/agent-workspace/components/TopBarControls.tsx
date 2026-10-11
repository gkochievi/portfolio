import { useTranslation } from 'react-i18next'
import { ChevronDown, Lock, Megaphone } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  StatusPill,
  ToneDot,
} from '@/components/ui'
import { formatDuration, secondsSince } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast, toastError } from '@/lib/toast'
import type { AgentStateView, AgentStatus, CampaignWithStats } from '@/types'
import { useSetCampaign, useSetStatus } from '../api'
import { formatLimit, overtimeSeconds, statusIcon, statusPattern, useNow } from './shared'

export function CampaignSwitcher({
  campaigns,
  state,
  locked,
}: {
  campaigns: CampaignWithStats[] | undefined
  state: AgentStateView | undefined
  locked: boolean
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const setCampaign = useSetCampaign()
  const list = campaigns ?? []
  const value = state?.campaign && list.some((c) => c.id === state.campaign?.id) ? state.campaign.id : ''
  return (
    <div className="w-[150px] sm:w-[260px]">
      <Select
        aria-label={t('topbar.campaign')}
        size="sm"
        value={value}
        disabled={locked || setCampaign.isPending || list.length === 0}
        placeholder={list.length === 0 ? t('topbar.noCampaigns') : t('topbar.campaignPlaceholder')}
        icon={<Megaphone size={16} strokeWidth={1.75} aria-hidden />}
        options={list.map((campaign) => ({
          value: campaign.id,
          label: l(campaign.name),
          description: `${l(campaign.clientName)} · ${t(`mode.${campaign.dialingMode}`)}`,
        }))}
        onValueChange={(id) =>
          setCampaign.mutate(id, {
            onSuccess: (view) => toast.success(t('topbar.campaignChanged', { name: l(view.campaign?.name) })),
            onError: (error) => toastError(error),
          })
        }
      />
    </div>
  )
}

export function AgentStateMenu({
  state,
  statuses,
  locked,
}: {
  state: AgentStateView | undefined
  statuses: AgentStatus[] | undefined
  locked: boolean
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const now = useNow()
  const setStatus = useSetStatus()
  if (!state) return <span className="h-8 w-28 animate-pulse rounded-full bg-sunken" aria-hidden />
  const elapsed = secondsSince(state.stateSince, now)
  const overtime = overtimeSeconds(state.status, elapsed) > 0
  const pickable = (statuses ?? []).filter((s) => s.isActive && !s.isSystem && s.type !== 'offline').sort((a, b) => a.sortOrder - b.sortOrder)
  const groups: Array<{ key: 'working' | 'paused'; items: AgentStatus[] }> = [
    { key: 'working', items: pickable.filter((s) => s.type === 'working') },
    { key: 'paused', items: pickable.filter((s) => s.type === 'paused') },
  ]
  const pick = (status: AgentStatus) => {
    if (status.id === state.status.id) return
    setStatus.mutate(status.id, {
      onSuccess: () => toast.success(t('topbar.statusChanged', { name: l(status.displayName) })),
      onError: (error) => toastError(error),
    })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={locked}>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed"
          aria-label={`${t('topbar.status')}: ${l(state.status.displayName)}`}
          title={locked ? t('topbar.lockedDuringCall') : undefined}
        >
          <StatusPill
            tone={overtime ? 'danger' : state.status.color}
            label={l(state.status.displayName)}
            icon={statusIcon(state.status)}
            pattern={statusPattern(state.status)}
            meta={formatDuration(elapsed)}
          />
          {locked ? (
            <Lock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
          ) : (
            <ChevronDown size={16} strokeWidth={1.75} className="text-muted" aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          {t('topbar.timeInStatus')}: <span className="font-mono tabular">{formatDuration(elapsed)}</span>
        </DropdownMenuLabel>
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.key}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t(`topbar.${group.key}`)}</DropdownMenuLabel>
              {group.items.map((status) => (
                <DropdownMenuItem
                  key={status.id}
                  icon={<ToneDot tone={status.color} />}
                  shortcut={formatLimit(status.timeoutSeconds, t)}
                  onSelect={() => pick(status)}
                >
                  <span className={status.id === state.status.id ? 'font-semibold' : undefined}>{l(status.displayName)}</span>
                </DropdownMenuItem>
              ))}
            </div>
          ),
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs text-muted">{t('topbar.systemNote')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
