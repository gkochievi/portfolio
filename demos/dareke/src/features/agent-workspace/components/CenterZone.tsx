import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Clock, PhoneForwarded, PhoneIncoming, PhoneOff, ScrollText } from 'lucide-react'

import { RingPulse } from '@/components/brand'
import { Alert, Badge, Button, Field, Kbd, Panel, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDuration, formatPhone, maskPhone, secondsSince } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { CampaignWithStats, OperatorCall, ScriptStep } from '@/types'
import { ICON, useNow } from './shared'

/* ---------------------------------------------------------------- idle */

export function IdleStage({
  campaign,
  error,
  pending,
  onNext,
}: {
  campaign: CampaignWithStats | undefined
  error: string | null
  pending: boolean
  onNext: () => void
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  return (
    <div className="dial-grid flex flex-col items-center gap-4 rounded-card border border-hairline bg-panel px-6 py-10 text-center">
      <RingPulse state="idle" size={72} />
      <div>
        <h2 className="font-display text-2xl font-extrabold text-ink">{t('stage.ready')}</h2>
        <p className="mt-1 text-sm text-muted">{t('stage.readyHint')}</p>
      </div>
      {campaign && (
        <p className="text-sm text-ink">
          {l(campaign.name)} <span className="text-muted">· {l(campaign.clientName)}</span>
        </p>
      )}
      <Button variant="call" size="lg" loading={pending} onClick={onNext} icon={<PhoneForwarded {...ICON} />}>
        {t('stage.nextLead')}
      </Button>
      {error && (
        <Alert tone="warning" className="w-full max-w-md text-left">
          {error}
        </Alert>
      )}
      {campaign && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock size={14} strokeWidth={1.75} aria-hidden />
          {t('stage.hoursNote', { start: campaign.workingHoursStart, end: campaign.workingHoursEnd })}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ progress */

export function ProgressStage({ call, onCancel, cancelling }: { call: OperatorCall; onCancel: () => void; cancelling: boolean }) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const now = useNow()
  const phase = call.phase as 'requesting' | 'dialing' | 'ringing'
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-hairline bg-panel px-6 py-10 text-center" aria-live="polite">
      <RingPulse state="ringing" size={96} label={t(`stage.${phase}`)} />
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t(`stage.${phase}`)}</h2>
        <p className="mt-1 text-sm text-muted">
          {l(call.customerName)} · <span className="font-mono tabular">{maskPhone(call.destinationNumber)}</span>
        </p>
        <p className="mt-1 font-mono text-xs tabular text-muted">{formatDuration(secondsSince(call.initiatedAt, now))}</p>
      </div>
      <ol className="flex items-center gap-2 text-xs text-muted" aria-hidden>
        {(['requesting', 'dialing', 'ringing'] as const).map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-hairline-strong" />}
            <span className={cn('rounded-full px-2 py-0.5', step === phase ? 'bg-carbon text-on-carbon' : 'bg-sunken')}>{t(`stage.step.${step}`)}</span>
          </li>
        ))}
      </ol>
      <Button variant="outline" onClick={onCancel} loading={cancelling} icon={<PhoneOff {...ICON} />}>
        {t('stage.cancel')}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------ incoming */

export function IncomingBanner({
  call,
  campaign,
  onAnswer,
  onReject,
  busy,
}: {
  call: OperatorCall
  campaign: CampaignWithStats | undefined
  onAnswer: () => void
  onReject: () => void
  busy: boolean
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const now = useNow(250)
  const [shownAt] = useState(() => Date.now())
  const left = Math.max(0, Math.ceil((15_000 - (now - shownAt)) / 1000))
  return (
    <div role="alertdialog" aria-label={t('stage.incoming')} className="overflow-hidden rounded-card border-2 border-carbon bg-panel">
      <div className="flex items-center gap-2 bg-carbon px-4 py-2 text-sm font-semibold text-on-carbon">
        <PhoneIncoming size={16} strokeWidth={1.75} aria-hidden />
        {t('stage.incoming')}
        <span className="ml-auto font-mono tabular">{t('stage.autoReject', { seconds: left })}</span>
      </div>
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:text-left">
        <RingPulse state="ringing" size={80} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-extrabold text-ink">{l(call.customerName) || maskPhone(call.destinationNumber)}</p>
          <p className="font-mono text-sm tabular text-muted">{maskPhone(call.destinationNumber)}</p>
          <p className="mt-1 text-sm text-muted">
            {campaign ? l(campaign.name) : ''} · {t('stage.incomingHint')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="danger" onClick={onReject} disabled={busy} icon={<PhoneOff {...ICON} />}>
            {t('stage.reject')}
          </Button>
          <Button variant="call" onClick={onAnswer} loading={busy} icon={<PhoneIncoming {...ICON} />}>
            {t('stage.answer')}
          </Button>
        </div>
      </div>
      <div className="h-1 bg-sunken">
        <div className="h-full bg-lime transition-[width] duration-200" style={{ width: `${(left / 15) * 100}%` }} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- script */

function ScriptSteps({ steps, callId }: { steps: ScriptStep[]; callId: string }) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [callId])
  if (steps.length === 0) return <p className="text-sm text-muted">{t('script.empty')}</p>
  return (
    <div>
      <ol className="grid gap-1.5">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'w-full rounded-control border-l-[3px] px-3 py-2 text-left transition-colors',
                i === index ? 'border-l-carbon bg-lime/25 dark:border-l-lime dark:bg-lime/10' : 'border-l-transparent hover:bg-sunken',
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-xs tabular text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className={cn('text-sm', i === index ? 'font-semibold text-ink' : 'text-muted')}>{l(step.title)}</span>
              </span>
              {i === index && <span className="mt-1 block text-[15px] leading-relaxed text-ink">{l(step.body)}</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} icon={<ChevronLeft size={16} strokeWidth={1.75} />}>
          {t('script.prev')}
        </Button>
        <span className="text-xs text-muted">{t('script.step', { n: index + 1, total: steps.length })}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={index >= steps.length - 1}
          onClick={() => setIndex((i) => i + 1)}
          iconRight={<ChevronRight size={16} strokeWidth={1.75} />}
        >
          {t('script.next')}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ waveform */

export function Waveform({ active, bars = 28 }: { active: boolean; bars?: number }) {
  const { t } = useTranslation('agent')
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: bars }, () => 0.15))
  useEffect(() => {
    if (!active) {
      setLevels(Array.from({ length: bars }, () => 0.08))
      return
    }
    const timer = setInterval(() => setLevels(Array.from({ length: bars }, () => 0.15 + Math.random() * 0.85)), 140)
    return () => clearInterval(timer)
  }, [active, bars])
  return (
    <div className="flex h-10 items-center gap-[3px]" role="img" aria-label={t('waveform.label')}>
      {levels.map((level, i) => (
        <span
          key={i}
          className={cn('w-1 rounded-full transition-[height] duration-150', active ? 'bg-ink dark:bg-lime' : 'bg-hairline-strong')}
          style={{ height: `${Math.round(level * 100)}%` }}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- in call */

export function InCallStage({
  call,
  campaign,
  notes,
  onNotes,
  muted,
}: {
  call: OperatorCall
  campaign: CampaignWithStats | undefined
  notes: string
  onNotes: (value: string) => void
  muted: boolean
}) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const now = useNow()
  const ended = call.phase === 'ended'
  const talk = call.answeredAt ? secondsSince(call.answeredAt, ended && call.endedAt ? Date.parse(call.endedAt) : now) : 0
  return (
    <div className="grid gap-4">
      <div className={cn('rounded-card border p-4', ended ? 'border-warning bg-warning/8' : 'border-hairline bg-panel')}>
        <div className="flex flex-wrap items-center gap-3">
          <RingPulse state={ended ? 'idle' : 'connected'} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-bold text-ink">{l(call.customerName) || formatPhone(call.destinationNumber)}</p>
            <p className="font-mono text-sm tabular text-muted">{formatPhone(call.destinationNumber)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ended ? (
              <Badge tone="warning">{t('stage.ended')}</Badge>
            ) : (
              <Badge tone="lime" variant="solid">
                {t('stage.inCall')}
              </Badge>
            )}
            {call.onHold && <Badge tone="warning">{t('stage.onHold')}</Badge>}
            {muted && !ended && <Badge tone="muted">{t('stage.muted')}</Badge>}
            {call.answeredAt && <span className="font-mono text-lg tabular text-ink">{formatDuration(talk)}</span>}
          </div>
        </div>
        {ended ? (
          <p className="mt-3 text-sm text-ink">
            <strong>{t(`endReason.${call.endReason ?? 'AGENT'}`)}</strong> · {t('stage.endedHint')}
          </p>
        ) : (
          <div className="mt-3">
            <Waveform active={!call.onHold && !muted} />
          </div>
        )}
      </div>

      <Panel title={t('script.title')} icon={<ScrollText {...ICON} />} description={campaign ? l(campaign.name) : undefined}>
        <ScriptSteps steps={campaign?.script ?? []} callId={call.callId} />
      </Panel>

      {ended ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Kbd>1-9</Kbd> {t('disposition.hotkeyHint')} <Kbd>Enter</Kbd>
        </p>
      ) : (
        <Field label={t('notes.label')} htmlFor="call-notes" hint={t('notes.hint')}>
          <Textarea
            id="call-notes"
            rows={3}
            value={notes}
            placeholder={t('notes.placeholder')}
            onChange={(event) => onNotes(event.target.value)}
          />
        </Field>
      )}
    </div>
  )
}
