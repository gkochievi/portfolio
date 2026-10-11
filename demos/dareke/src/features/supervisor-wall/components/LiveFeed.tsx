/** Live call activity feed (the last 50 call events, newest first). */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Pause, PhoneCall, PhoneMissed, PhoneOff, PhoneOutgoing, Play, Ban, UserX } from 'lucide-react'

import { Badge, EmptyState, Panel, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRelative, formatTime, maskPhone } from '@/lib/format'
import { useLang, useLocalized } from '@/lib/localized'
import { toneClasses } from '@/lib/tone'
import type { CallEventType, Tone } from '@/types'
import { useWallEvents } from '../api'
import { ICON, QueryError, useNow } from './shared'

const EVENT_LOOK: Record<CallEventType, { tone: Tone; icon: ReactNode }> = {
  ringing: { tone: 'info', icon: <PhoneOutgoing {...ICON} /> },
  answered: { tone: 'success', icon: <PhoneCall {...ICON} /> },
  ended: { tone: 'muted', icon: <PhoneOff {...ICON} /> },
  hold: { tone: 'warning', icon: <Pause {...ICON} /> },
  unhold: { tone: 'info', icon: <Play {...ICON} /> },
  no_answer: { tone: 'warning', icon: <PhoneMissed {...ICON} /> },
  busy: { tone: 'warning', icon: <Ban {...ICON} /> },
  abandoned: { tone: 'danger', icon: <UserX {...ICON} /> },
}

const FIVE_MINUTES = 5 * 60 * 1000

export function LiveFeed({ className }: { className?: string }) {
  const { t } = useTranslation('wall')
  const l = useLocalized()
  const lang = useLang()
  const events = useWallEvents()
  const now = useNow(5000)

  const recent = (events.data ?? []).filter((event) => now - Date.parse(event.timestamp) <= FIVE_MINUTES)
  const answered = recent.filter((event) => event.event === 'answered').length
  const ended = recent.filter((event) => event.event === 'ended').length

  return (
    <Panel
      className={cn('flex flex-col', className)}
      bodyClassName="flex-1 min-h-0"
      title={t('feed.title')}
      description={t('feed.description')}
      icon={<Activity {...ICON} />}
      actions={
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="success">{t('feed.answered5', { count: answered })}</Badge>
          <Badge tone="muted">{t('feed.ended5', { count: ended })}</Badge>
        </div>
      }
    >
      {events.isError && !events.data ? (
        <QueryError error={events.error} onRetry={() => void events.refetch()} />
      ) : !events.data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-control" />
          ))}
        </div>
      ) : events.data.length === 0 ? (
        <EmptyState compact title={t('feed.empty')} description={t('feed.emptyHint')} />
      ) : (
        <ol className="-mx-2 max-h-[560px] space-y-0.5 overflow-y-auto px-2" aria-live="polite">
          {events.data.map((event) => {
            const look = EVENT_LOOK[event.event]
            const who = event.customerName ? l(event.customerName) : maskPhone(event.phoneNumber)
            return (
              <li key={event.id} className="flex items-start gap-3 rounded-control px-2 py-2 hover:bg-sunken">
                <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-control [&_svg]:size-4', toneClasses(look.tone).soft)} aria-hidden>
                  {look.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm">
                      <span className={cn('font-semibold', toneClasses(look.tone).text)}>{t(`feed.events.${event.event}`)}</span>
                      <span className="text-muted"> · </span>
                      <span>{who}</span>
                    </p>
                    <time className="shrink-0 text-xs text-muted" dateTime={event.timestamp} title={formatTime(event.timestamp, true)}>
                      {formatRelative(event.timestamp, lang)}
                    </time>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {event.agentName ? l(event.agentName) : t('feed.noAgent')}
                    {event.customerName && <span className="font-mono"> · {maskPhone(event.phoneNumber)}</span>}
                    {event.cause != null && event.event !== 'ended' && (
                      <span> · {t(`feed.cause.${event.cause}`, { defaultValue: event.causeText ?? String(event.cause) })}</span>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
