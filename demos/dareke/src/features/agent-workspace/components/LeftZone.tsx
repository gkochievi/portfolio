import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, History, Phone, UserRound } from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DescriptionList,
  EmptyState,
  Field,
  IconButton,
  Input,
  Panel,
  Skeleton,
  Stat,
  StatusPill,
  ToneDot,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatDuration, formatPercent, formatPhone, maskPhone, secondsSince } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { AgentStateView, AgentTodayKpis, CampaignWithStats, OperatorCall } from '@/types'
import { useLeadHistory } from '../api'
import { ICON, StatusRing, fieldLabel, formatLimit, overtimeSeconds, statusIcon, statusPattern, useNow } from './shared'

/* ---------------------------------------------------------------- status */

export function StatusCard({ state, name }: { state: AgentStateView | undefined; name: string }) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const now = useNow()
  if (!state) return <Skeleton className="h-[148px] rounded-card" />
  const { status } = state
  const elapsed = secondsSince(state.stateSince, now)
  const over = overtimeSeconds(status, elapsed)
  const wrapLeft = status.autoReturn && status.timeoutSeconds > 0 && status.type === 'working' ? Math.max(0, status.timeoutSeconds - elapsed) : null
  return (
    <section
      aria-label={t('status.title')}
      className={cn('rounded-card border bg-panel p-4', over > 0 ? 'border-danger bg-danger/8' : 'border-hairline')}
    >
      <div className="flex items-center gap-4">
        <StatusRing name={name} tone={over > 0 ? 'danger' : status.color} pulse={status.name === 'on_call'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight text-ink">{name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {state.agent.sipExtension ? t('status.ext', { ext: state.agent.sipExtension }) : t('status.noExt')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill
              tone={over > 0 ? 'danger' : status.color}
              label={l(status.displayName)}
              icon={statusIcon(status)}
              pattern={statusPattern(status)}
              size="sm"
            />
            <span className="font-mono text-sm tabular text-ink" aria-label={t('status.timeInStatus')}>
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>
      </div>
      {over > 0 && (
        <p className="mt-3 text-sm font-medium text-danger" role="status">
          {t('status.overtime', { limit: formatLimit(status.timeoutSeconds, t), over: formatDuration(over) })}
        </p>
      )}
      {wrapLeft !== null && (
        <p className="mt-3 text-sm text-info" role="status">
          {t('status.wrapUpReturn', { seconds: wrapLeft })}
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------- softphone */

export function SoftphoneChip({ extension }: { extension: string | null }) {
  const { t } = useTranslation('agent')
  const [open, setOpen] = useState(false)
  const [ext, setExt] = useState(extension ?? '')
  const [password, setPassword] = useState('')
  const [registered, setRegistered] = useState(extension ?? '1101')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = ext.trim() || registered
    setRegistered(value)
    setOpen(false)
    setPassword('')
    toast.success(t('softphone.registered', { ext: value }))
  }
  return (
    <div className="flex items-center gap-2 rounded-card border border-hairline bg-panel px-3 py-2">
      <ToneDot tone="success" pulse />
      <p className="min-w-0 flex-1 truncate text-sm text-ink">
        {t('softphone.connected')} <span className="text-muted">· {t('softphone.ext', { ext: registered })}</span>
      </p>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        {t('softphone.register')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t('softphone.registerTitle')}
        description={t('softphone.registerHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="dial" type="submit" form="softphone-register">
              {t('softphone.register')}
            </Button>
          </>
        }
      >
        <form id="softphone-register" className="grid gap-3" onSubmit={submit}>
          <Field label={t('softphone.extension')} htmlFor="sp-ext">
            <Input id="sp-ext" mono inputMode="numeric" value={ext} onChange={(e) => setExt(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('softphone.password')} htmlFor="sp-pass">
            <Input id="sp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </Field>
        </form>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ KPIs */

export function KpiCard({ kpis }: { kpis: AgentTodayKpis | undefined }) {
  const { t } = useTranslation('agent')
  return (
    <Panel title={t('kpis.title')} padded={false}>
      <div className="grid grid-cols-2 gap-px bg-hairline">
        {(
          [
            ['calls', kpis ? String(kpis.calls) : null],
            ['avgDuration', kpis ? formatDuration(kpis.avgDurationSeconds) : null],
            ['conversions', kpis ? String(kpis.conversions) : null],
            ['conversionRate', kpis ? formatPercent(kpis.conversionRate, 1) : null],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="bg-panel p-3">
            {value === null ? <Skeleton className="h-12" /> : <Stat bare size="sm" label={t(`kpis.${key}`)} value={value} tone={key === 'conversions' ? 'success' : undefined} />}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ lead */

function CopyNumber({ phone }: { phone: string }) {
  const { t } = useTranslation('agent')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      toast.success(t('lead.copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.info(formatPhone(phone))
    }
  }
  return (
    <IconButton
      size="sm"
      label={t('lead.copy')}
      icon={copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
      onClick={() => void copy()}
    />
  )
}

export function LeadCard({
  call,
  live,
  campaign,
}: {
  call: OperatorCall | null
  /** False when showing the last lead after the call was dispositioned. */
  live: boolean
  campaign: CampaignWithStats | undefined
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const history = useLeadHistory(call?.numberId)
  if (!call) {
    return (
      <Panel title={t('lead.title')} icon={<UserRound {...ICON} />}>
        <EmptyState compact title={t('lead.empty')} description={t('lead.emptyHint')} />
      </Panel>
    )
  }
  const connected = call.answeredAt !== null || call.phase === 'ended'
  const calls = history.data ?? []
  const attempts = calls.filter((c) => c.campaignNumberId === call.numberId).length + (live && call.phase !== 'ended' ? 1 : 0)
  const fields = Object.entries(call.customData)
  return (
    <Panel
      title={live ? t('lead.title') : t('lead.lastLead')}
      icon={<UserRound {...ICON} />}
      actions={<Badge tone={call.mode === 'AUTO' ? 'info' : 'muted'}>{t(`mode.${call.mode}`)}</Badge>}
    >
      <p className="font-display text-xl font-bold leading-tight text-ink">{l(call.customerName) || t('lead.unknown')}</p>
      <div className="mt-1 flex items-center gap-1">
        <Phone size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
        <span className="font-mono text-sm tabular text-ink">{connected ? formatPhone(call.destinationNumber) : maskPhone(call.destinationNumber)}</span>
        {connected && <CopyNumber phone={call.destinationNumber} />}
      </div>
      {!connected && <p className="mt-1 text-xs text-muted">{t('lead.masked')}</p>}
      <DescriptionList
        className="mt-4"
        items={[
          { label: t('lead.campaign'), value: campaign ? l(campaign.name) : '—' },
          { label: t('lead.client'), value: campaign ? l(campaign.clientName) : '—' },
          { label: t('lead.attempts'), value: String(Math.max(attempts, 1)), mono: true },
          ...fields.map(([key, value]) => ({ label: fieldLabel(key, t), value: l(value) || '—' })),
        ]}
      />
      <div className="mt-4 border-t border-hairline pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <History size={14} strokeWidth={1.75} aria-hidden />
          {t('lead.history')}
        </p>
        {history.isLoading ? (
          <Skeleton className="h-16" />
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted">{t('lead.noHistory')}</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {calls.slice(0, 6).map((item) => (
              <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs tabular text-muted">{formatDateTime(item.callInitiatedAt)}</span>{' '}
                  <span className="text-ink">{l(item.campaignName)}</span>
                </span>
                {item.dispositionName ? (
                  <Badge size="sm" tone={item.dispositionColor ?? 'muted'}>
                    {l(item.dispositionName)}
                  </Badge>
                ) : (
                  <Badge size="sm" tone="muted" variant="outline">
                    {t(`common:callOutcome.${item.outcome}`)}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted">{t('common:demoDataNote')}</p>
    </Panel>
  )
}
