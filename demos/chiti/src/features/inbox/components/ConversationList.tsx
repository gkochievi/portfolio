import { useState } from 'react'
import { Bot, Clock, FileText, Image as ImageIcon, MapPin, Mic, Sparkles, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChannelGlyph, WaitTimer } from '@/components/chat'
import { Avatar, Button, EmptyState, ErrorState, SkeletonRow, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime, formatWait } from '@/lib/format'
import { useNow } from '@/lib/realtime'
import type { SessionSummary } from '@/types'

import { matchesFilter, previewOf, type PreviewIcon } from '../lib'
import type { ChannelFilter, InboxResponse } from '../types'

const QUEUE_VISIBLE = 3

export interface ConversationListProps {
  data: InboxResponse | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  filter: ChannelFilter
  selectedId: string | null
  onSelect: (sessionId: string) => void
  onTake: (sessionId: string) => void
  takingId: string | null
}

const PREVIEW_ICON: Record<Exclude<PreviewIcon, null>, typeof ImageIcon> = {
  image: ImageIcon,
  file: FileText,
  location: MapPin,
  audio: Mic,
}

function AiChip({ session }: { session: SessionSummary }) {
  const { t } = useTranslation('inbox')
  if (session.aiState === 'bot') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bot px-1.5 py-px text-[10px] font-semibold text-accent">
        <Bot size={11} strokeWidth={2} aria-hidden />
        {t('row.bot')}
      </span>
    )
  }
  if (session.aiState === 'handed_off') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-1.5 py-px text-[10px] font-semibold text-muted ring-1 ring-line">
        <Sparkles size={11} strokeWidth={2} aria-hidden />
        {t('row.handedOver')}
      </span>
    )
  }
  return null
}

function PreviewLine({ session, lines = 2 }: { session: SessionSummary; lines?: 1 | 2 }) {
  const { t } = useTranslation('inbox')
  const { icon, text, fromStaff } = previewOf(session)
  const Icon = icon ? PREVIEW_ICON[icon] : null
  const label = icon && !text ? t(`row.preview.${icon}`) : text
  return (
    <p className={cn('text-[13px] leading-[1.35] text-muted', lines === 2 ? 'line-clamp-2' : 'truncate')}>
      {fromStaff ? <span className="text-ink/70">{t('row.you')} </span> : null}
      {Icon ? <Icon size={13} strokeWidth={1.75} aria-hidden className="mr-1 inline -translate-y-px" /> : null}
      {label}
    </p>
  )
}

/* ------------------------------------------------------------------ queue */

function QueueCard({
  session,
  canTake,
  atLimit,
  autoAssign,
  selected,
  taking,
  onSelect,
  onTake,
}: {
  session: SessionSummary
  canTake: boolean
  atLimit: boolean
  autoAssign: boolean
  selected: boolean
  taking: boolean
  onSelect: () => void
  onTake: () => void
}) {
  const { t } = useTranslation(['inbox', 'common'])
  const botOwned = session.aiState === 'bot'
  return (
    <li>
      <div
        className={cn(
          'rounded-ui border bg-panel p-2.5 transition-colors',
          selected ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong',
        )}
      >
        <button type="button" onClick={onSelect} className="flex w-full items-start gap-2.5 rounded-ui text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Avatar name={session.customerName} avatarId={session.externalContact?.avatarId} size="md" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">{session.customerName}</span>
              <ChannelGlyph channel={session.channel} size={14} />
            </span>
            <span className="mt-0.5 block">
              <PreviewLine session={session} lines={1} />
            </span>
          </span>
          <WaitTimer since={session.startedAt} />
        </button>
        <div className="mt-2 flex items-center justify-between gap-2">
          {botOwned ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-accent">
              <Bot size={13} strokeWidth={1.75} aria-hidden />
              <span className="truncate">{t('inbox:queue.botHandling')}</span>
            </span>
          ) : (
            <span className="min-w-0 truncate text-xs text-muted">{session.secondaryLine ?? t(`common:channel.${session.channel}`)}</span>
          )}
          {canTake && !autoAssign ? (
            <Tooltip content={t('inbox:queue.atLimit')} disabled={!atLimit}>
              <span>
                <Button size="xs" variant="accent" disabled={atLimit} loading={taking} onClick={onTake}>
                  {t('inbox:queue.take')}
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function QueueBand({ props }: { props: ConversationListProps }) {
  const { t } = useTranslation('inbox')
  const now = useNow(1_000)
  const [expanded, setExpanded] = useState(false)
  const data = props.data
  if (!data) return null
  const all = data.queue
  const queue = all.filter((row) => matchesFilter(row, props.filter))
  const oldest = all[0]
  const longest = oldest ? formatWait(oldest.startedAt, now) : null
  const atLimit = data.limit > 0 && data.activeCount >= data.limit
  const visible = expanded ? queue : queue.slice(0, QUEUE_VISIBLE)
  const hidden = queue.length - visible.length
  return (
    <section aria-labelledby="inbox-queue-title" className="border-b border-line px-3 pb-3 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="inbox-queue-title" className="font-display text-[15px] font-semibold text-ink">
          {t('queue.title')}
        </h2>
        <span
          className={cn(
            'tabular inline-flex items-center rounded-full px-2 py-px text-xs font-semibold',
            all.length > 0 ? 'bg-primary text-on-primary' : 'bg-sunken text-muted ring-1 ring-line',
          )}
        >
          {t('queue.waiting', { count: all.length })}
        </span>
        {longest ? (
          <span
            className={cn(
              'tabular ml-auto inline-flex items-center gap-1 text-xs',
              longest.tier === 'late' ? 'text-danger' : longest.tier === 'amber' ? 'text-warning' : 'text-muted',
            )}
          >
            <Clock size={12} strokeWidth={1.75} aria-hidden />
            {t('queue.longest', { time: longest.label })}
          </span>
        ) : null}
      </div>
      {data.autoAssign ? (
        <p className="mb-2 flex items-start gap-1.5 rounded-ui bg-accent-soft px-2.5 py-2 text-xs text-accent">
          <Users size={14} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
          {t('queue.autoNotice')}
        </p>
      ) : null}
      {queue.length === 0 ? (
        <p className="rounded-ui border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          {all.length === 0 ? t('queue.empty') : t('queue.emptyFiltered')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((session) => (
            <QueueCard
              key={session.id}
              session={session}
              canTake
              atLimit={atLimit}
              autoAssign={data.autoAssign}
              selected={props.selectedId === session.id}
              taking={props.takingId === session.id}
              onSelect={() => props.onSelect(session.id)}
              onTake={() => props.onTake(session.id)}
            />
          ))}
        </ul>
      )}
      {queue.length > QUEUE_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="link mt-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? t('queue.showLess') : t('queue.showMore', { count: hidden })}
        </button>
      ) : null}
    </section>
  )
}

/* --------------------------------------------------------------- my chats */

function ChatRow({ session, selected, onSelect }: { session: SessionSummary; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation('inbox')
  const unread = session.unreadCount > 0 && !selected
  const last = session.lastMessage?.timestamp ?? session.lastActivity
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'relative flex h-16 w-full items-center gap-2.5 px-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          selected ? 'bg-accent-soft' : 'hover:bg-hover',
        )}
      >
        {unread ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" /> : null}
        <Avatar name={session.customerName} avatarId={session.externalContact?.avatarId} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn('truncate text-sm text-ink', unread ? 'font-semibold' : 'font-medium')}>{session.customerName}</span>
            <ChannelGlyph channel={session.channel} size={13} />
            <AiChip session={session} />
            {session.status === 'inactive' ? (
              <Tooltip content={t('row.inactive')}>
                <Clock size={13} strokeWidth={1.75} className="shrink-0 text-warning" aria-label={t('row.inactive')} />
              </Tooltip>
            ) : null}
            <span className="tabular ml-auto shrink-0 text-[11px] text-muted">{formatTime(last)}</span>
          </span>
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <PreviewLine session={session} />
            </span>
            {session.unreadCount > 0 ? (
              <span
                className={cn(
                  'tabular mt-0.5 grid min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-5',
                  selected ? 'bg-sunken text-muted' : 'bg-primary text-on-primary',
                )}
                aria-label={t('row.unread', { count: session.unreadCount })}
              >
                {session.unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  )
}

function MyChats({ props }: { props: ConversationListProps }) {
  const { t } = useTranslation('inbox')
  const data = props.data
  if (!data) return null
  const rows = data.mine.filter((row) => matchesFilter(row, props.filter))
  const atLimit = data.limit > 0 && data.activeCount >= data.limit
  return (
    <section aria-labelledby="inbox-mine-title" className="pt-3">
      <div className="mb-1 flex items-center gap-2 px-3">
        <h2 id="inbox-mine-title" className="font-display text-[15px] font-semibold text-ink">
          {t('mine.title')}
        </h2>
        <span
          className={cn('tabular ml-auto text-xs font-medium', atLimit ? 'text-danger' : 'text-muted')}
          aria-label={data.limit > 0 ? t('mine.counterLabel', { active: data.activeCount, limit: data.limit }) : undefined}
        >
          {data.limit > 0 ? t('mine.counter', { active: data.activeCount, limit: data.limit }) : t('mine.counterUnlimited', { active: data.activeCount })}
        </span>
      </div>
      {atLimit ? (
        <p role="status" className="mx-3 mb-2 rounded-ui bg-danger-soft px-2.5 py-2 text-xs text-danger">
          {t('mine.limitWarning', { limit: data.limit })}
        </p>
      ) : null}
      {rows.length === 0 ? (
        data.mine.length === 0 ? (
          <EmptyState compact illustration="nest" title={t('empty.title')} description={t('empty.mine')} />
        ) : (
          <p className="px-3 py-4 text-center text-xs text-muted">{t('mine.emptyFiltered')}</p>
        )
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((session) => (
            <ChatRow key={session.id} session={session} selected={props.selectedId === session.id} onSelect={() => props.onSelect(session.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function ConversationList(props: ConversationListProps) {
  const { t } = useTranslation('inbox')
  if (props.loading && !props.data) {
    return (
      <div className="space-y-1 p-3" aria-busy="true" aria-label={t('loading')}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    )
  }
  if (props.error && !props.data) {
    return <ErrorState title={t('error.list')} onRetry={props.onRetry} retryLabel={t('error.retry')} />
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
      <QueueBand props={props} />
      <MyChats props={props} />
    </div>
  )
}
