import { useTranslation } from 'react-i18next'
import { MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'

import { Avatar, Badge, type BadgeTone } from '@/components/ui'
import { ChannelBadge } from '@/components/chat'
import { cn } from '@/lib/cn'
import { formatWait } from '@/lib/format'
import type { Lang, SessionStatus, SessionSummary } from '@/types'

const STATUS_TONE: Record<SessionStatus, BadgeTone> = {
  waiting: 'warning',
  active: 'success',
  inactive: 'muted',
  ended: 'neutral',
}

const WAIT_CLASS = { fresh: 'text-muted', amber: 'text-warning', late: 'text-danger' } as const

/** The first two form answers (or the phone/second line) that identify the customer. */
export function fieldsLine(session: SessionSummary, lang: Lang): string {
  const values = session.customFields
    .map((field) => field.value)
    .filter((value) => value && value !== session.customerName)
    .slice(0, 2)
  void lang
  return values.length > 0 ? values.join(' · ') : (session.secondaryLine ?? '')
}

interface SessionRowProps {
  session: SessionSummary
  nowMs: number
  selected?: boolean
  /** `compact` is the dashboard variant (no end summary, tighter). */
  compact?: boolean
  showEndSummary?: boolean
  onSelect: (id: string) => void
}

export function SessionRow({ session, nowMs, selected, compact, showEndSummary, onSelect }: SessionRowProps) {
  const { t, i18n } = useTranslation(['adminLive', 'common'])
  const lang: Lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  const operator = session.operator
  const wait = session.status === 'waiting' ? formatWait(session.startedAt, nowMs) : null
  const line = fieldsLine(session, lang)
  const endSummary = showEndSummary && session.status === 'ended' ? session.endSummary : null

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full min-w-0 flex-col gap-1.5 border-b border-line px-4 text-left transition-colors last:border-b-0 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
        compact ? 'py-3' : 'py-3.5',
        selected && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-ink">{session.customerName}</span>
        <ChannelBadge channel={session.channel} />
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {session.adminInterventionActive && session.status !== 'ended' ? (
            <Badge tone="primary" size="sm" icon={<ShieldCheck size={12} strokeWidth={1.75} />}>
              {t('chats.row.adminIn')}
            </Badge>
          ) : null}
          <Badge tone={STATUS_TONE[session.status]} size="sm" dot>
            {t(`common:sessionStatus.${session.status}`)}
          </Badge>
        </span>
      </span>

      {line ? <span className="truncate text-sm text-muted">{line}</span> : null}

      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {operator ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={operator.nickname} avatarId={operator.avatarId} avatarUrl={operator.avatarUrl} size="xs" />
            <span className="truncate text-ink">{operator.nickname}</span>
            <span className="tabular">#{operator.operatorNumber}</span>
          </span>
        ) : (
          <span>{t('chats.row.unassigned')}</span>
        )}
        <span className="flex items-center gap-1 tabular">
          <MessageSquare size={13} strokeWidth={1.75} aria-hidden />
          {t('chats.row.messages', { count: session.messageCount })}
        </span>
        {wait ? (
          <span className={cn('tabular font-medium', WAIT_CLASS[wait.tier])}>{t('chats.row.waitingFor', { time: wait.label })}</span>
        ) : null}
        {session.aiState === 'bot' ? (
          <Badge tone="accent" size="sm" icon={<Sparkles size={12} strokeWidth={1.75} />}>
            {t('chats.row.ai')}
          </Badge>
        ) : null}
      </span>

      {endSummary ? (
        <span className="text-sm text-ink">
          {endSummary}
          {session.endedBy ? (
            <span className="text-muted"> · {t('chats.row.endedBy', { who: t(`common:endedBy.${session.endedBy}`) })}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  )
}
