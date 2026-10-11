/** CDR detail drawer: timeline, durations, hangup, disposition, callback, recording, other calls. */
import { CalendarClock, PhoneCall, PhoneIncoming, PhoneOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, DescriptionList, Drawer, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatDuration, formatPhone, formatTime } from '@/lib/format'
import { useLocalized } from '@/lib/localized'

import { useCall } from '../api'
import { DispositionBadge, NoRecording, OutcomeBadge } from './shared'

const ICON = { size: 16, strokeWidth: 1.75 } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  )
}

export function CallDrawer({ callId, onClose, onOpenCall }: { callId: string | null; onClose: () => void; onOpenCall: (id: string) => void }) {
  const { t } = useTranslation('reports')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const query = useCall(callId)
  const call = query.data

  const timeline = call
    ? [
        { key: 'initiated', at: call.callInitiatedAt, icon: <PhoneCall {...ICON} />, label: t('drawer.initiated') },
        { key: 'answered', at: call.callAnsweredAt, icon: <PhoneIncoming {...ICON} />, label: t('drawer.answered') },
        { key: 'ended', at: call.callEndedAt, icon: <PhoneOff {...ICON} />, label: t('drawer.ended') },
      ]
    : []

  return (
    <Drawer
      open={callId != null}
      onOpenChange={(open) => !open && onClose()}
      eyebrow={t('drawer.eyebrow')}
      title={call ? formatPhone(call.destinationNumber) : t('drawer.loading')}
      description={call ? `${l(call.customerName) || t('drawer.unknownCustomer')} · ${l(call.campaignName)}` : undefined}
    >
      {query.isError ? (
        <Alert tone="danger" title={tc('states.error')} action={<Button size="sm" onClick={() => void query.refetch()}>{tc('actions.retry')}</Button>}>
          {errorMessage(query.error)}
        </Alert>
      ) : !call ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeBadge outcome={call.outcome} />
            <span className="text-xs text-muted">
              {tc(`callMode.${call.mode}`)} · {l(call.agentName) || t('table.noAgent')}
            </span>
          </div>

          <Section title={t('drawer.timeline')}>
            <ol className="relative space-y-3 pl-1">
              {timeline.map((step, i) => (
                <li key={step.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'relative grid size-8 shrink-0 place-items-center rounded-full border',
                      step.at ? 'border-ink bg-carbon text-on-carbon' : 'border-dashed border-hairline-strong text-muted',
                    )}
                  >
                    {step.icon}
                    {i < timeline.length - 1 && <span className="absolute top-8 left-1/2 h-3 w-px -translate-x-1/2 bg-hairline-strong" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{step.label}</span>
                  <span className="font-mono text-[13px] tabular text-muted">{step.at ? formatTime(step.at, true) : t('drawer.never')}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">{formatDate(call.callInitiatedAt)}</p>
          </Section>

          <Section title={t('drawer.durations')}>
            <div className="grid grid-cols-4 gap-2">
              {[
                ['ring', call.ringDuration],
                ['talk', call.talkDuration],
                ['hold', call.holdDuration],
                ['total', call.totalDuration],
              ].map(([key, value]) => (
                <div key={key} className="rounded-control border border-hairline bg-sunken px-2 py-2 text-center">
                  <div className="text-[11px] text-muted">{t(`drawer.${key}`)}</div>
                  <div className="mt-0.5 font-mono text-sm tabular text-ink">{formatDuration(value as number)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('drawer.hangup')}>
            <DescriptionList
              columns={2}
              items={[
                { label: t('drawer.cause'), value: call.hangupCause != null ? `${call.hangupCause} · ${call.hangupCauseText ?? ''}` : t('drawer.notYet'), mono: call.hangupCause != null },
                { label: t('drawer.hangupBy'), value: call.hangupBy ? tc(`hangupBy.${call.hangupBy}`) : t('drawer.notYet') },
                { label: t('drawer.callerId'), value: formatPhone(call.callerId), mono: true },
                { label: t('drawer.callId'), value: call.id, mono: true },
              ]}
            />
          </Section>

          <Section title={t('drawer.disposition')}>
            <div className="space-y-2">
              <DispositionBadge call={call} />
              <p className={cn('text-sm', call.dispositionNote ? 'text-ink' : 'text-muted')}>{call.dispositionNote || t('drawer.noNote')}</p>
              {call.callbackScheduledAt && (
                <div className="flex items-center gap-2 rounded-control border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
                  <CalendarClock {...ICON} />
                  <span>
                    {t('drawer.callback')}: <span className="font-mono tabular">{formatDateTime(call.callbackScheduledAt)}</span>
                  </span>
                </div>
              )}
            </div>
          </Section>

          <Section title={t('drawer.recording')}>
            <div className="rounded-control border border-dashed border-hairline-strong px-3 py-3">
              <NoRecording />
            </div>
          </Section>

          <Section title={t('drawer.otherCalls')}>
            {call.otherCalls.length === 0 ? (
              <p className="text-sm text-muted">{t('drawer.noOtherCalls')}</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-control border border-hairline">
                {call.otherCalls.map((other) => (
                  <li key={other.id}>
                    <button
                      type="button"
                      onClick={() => onOpenCall(other.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px] tabular">{formatDateTime(other.callInitiatedAt)}</span>
                        <span className="block truncate text-xs text-muted">
                          {l(other.campaignName)} · {l(other.agentName) || t('table.noAgent')}
                        </span>
                      </span>
                      <DispositionBadge call={other} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  )
}
