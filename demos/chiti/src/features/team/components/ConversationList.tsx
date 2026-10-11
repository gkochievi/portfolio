import { useMemo, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar } from '@/components/Avatar'
import { Badge, CountBubble, EmptyState, ErrorState, SearchInput, SkeletonRow } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatSmartDate, personName, pickText } from '@/lib/format'

import type { ConversationRow, RosterEntry } from '../types'

interface ConversationListProps {
  room: ConversationRow | undefined
  roster: RosterEntry[]
  loading: boolean
  error: boolean
  onRetry: () => void
  selectedId: string | null
  onOpenConversation: (conversationId: string) => void
  onStartDirect: (entry: RosterEntry) => void
  pendingId: string | null
}

export function ConversationList({ room, roster, loading, error, onRetry, selectedId, onOpenConversation, onStartDirect, pendingId }: ConversationListProps) {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const { talking, others } = useMemo(() => {
    const matches = roster.filter((entry) => {
      if (!q) return true
      return [entry.name.en, entry.name.ka, entry.nickname, entry.number].some((value) => value.toLowerCase().includes(q))
    })
    return { talking: matches.filter((entry) => entry.conversationId), others: matches.filter((entry) => !entry.conversationId) }
  }, [roster, q])

  const row = (entry: RosterEntry) => {
    const active = entry.conversationId !== null && entry.conversationId === selectedId
    return (
      <li key={`${entry.role}:${entry.id}`}>
        <button
          type="button"
          onClick={() => (entry.conversationId ? onOpenConversation(entry.conversationId) : onStartDirect(entry))}
          disabled={pendingId === `${entry.role}:${entry.id}`}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-ui px-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent',
            active && 'bg-hover',
          )}
        >
          <Avatar name={personName(entry.name, lang)} avatarId={entry.avatarId} avatarUrl={entry.avatarUrl} size="md" status={entry.presence} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cn('truncate text-sm', entry.unread > 0 ? 'font-semibold' : 'font-medium')}>{personName(entry.name, lang)}</span>
              <Badge size="sm" tone={entry.role === 'operator' ? 'muted' : entry.role === 'admin' ? 'accent' : 'info'}>{t(`role.${entry.role}`)}</Badge>
              {entry.lastMessageAt ? <span className="ml-auto shrink-0 text-[11px] text-muted tabular">{formatSmartDate(entry.lastMessageAt, lang)}</span> : null}
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <span className={cn('min-w-0 flex-1 truncate text-xs', entry.unread > 0 ? 'text-ink' : 'text-muted')}>
                {entry.lastMessageText ?? `${entry.nickname} · ${t(`presence.${entry.presence}`)}`}
              </span>
              <CountBubble count={entry.unread} tone="primary" />
            </span>
          </span>
        </button>
      </li>
    )
  }

  if (error) return <ErrorState title={t('list.error')} onRetry={onRetry} retryLabel={t('thread.retry')} />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <SearchInput value={query} onChange={setQuery} placeholder={t('list.search')} size="sm" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <>
            {room ? (
              <section aria-label={t('list.room')}>
                <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide text-muted">{t('list.room')}</h3>
                <button
                  type="button"
                  onClick={() => onOpenConversation(room.id)}
                  aria-current={selectedId === room.id ? 'true' : undefined}
                  className={cn('flex w-full items-center gap-3 rounded-ui px-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent', selectedId === room.id && 'bg-hover')}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-hidden>
                    <UsersRound size={18} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate text-sm', room.unread > 0 ? 'font-semibold' : 'font-medium')}>{pickText(room.title, lang)}</span>
                      {room.lastMessageAt ? <span className="ml-auto shrink-0 text-[11px] text-muted tabular">{formatSmartDate(room.lastMessageAt, lang)}</span> : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn('min-w-0 flex-1 truncate text-xs', room.unread > 0 ? 'text-ink' : 'text-muted')}>
                        {room.lastMessageText ? `${room.lastSenderName ? `${personName(room.lastSenderName, lang).split(' ')[0]}: ` : ''}${room.lastMessageText}` : t('room.members', { count: room.memberCount })}
                      </span>
                      <CountBubble count={room.unread} tone="primary" />
                    </span>
                  </span>
                </button>
              </section>
            ) : null}

            <section aria-label={t('list.direct')}>
              <h3 className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-muted">{t('list.direct')}</h3>
              {talking.length === 0 && others.length === 0 ? (
                <EmptyState title={t('list.noResults')} illustration="none" compact />
              ) : (
                <ul className="space-y-0.5">{talking.map(row)}</ul>
              )}
            </section>

            {others.length > 0 ? (
              <section aria-label={t('list.colleagues')}>
                <h3 className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-muted">{t('list.colleagues')}</h3>
                <ul className="space-y-0.5">{others.map(row)}</ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
