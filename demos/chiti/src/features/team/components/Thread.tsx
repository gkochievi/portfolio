import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowLeft, Loader2, MessagesSquare, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isSameDay } from 'date-fns'

import { Avatar } from '@/components/Avatar'
import { Badge, Button, EmptyState, ErrorState, IconButton, Skeleton } from '@/components/ui'
import { useAccount } from '@/lib/account'
import { cn } from '@/lib/cn'
import { formatDay, personName, pickText } from '@/lib/format'

import { useMarkRead, useThread, useTypingNames, useTypingSender } from '../api'
import type { ConversationRow, RosterEntry } from '../types'
import { Bubble } from './Bubble'
import { Composer } from './Composer'
import { TypingDots } from './TypingDots'

interface ThreadProps {
  conversation: ConversationRow
  people: Map<string, RosterEntry>
  onBack?: () => void
}

export function ThreadHeader({ conversation, onBack }: { conversation: ConversationRow; onBack?: (() => void) | undefined }) {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const peer = conversation.peer
  return (
    <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-3">
      {onBack ? <IconButton label={t('thread.back')} icon={<ArrowLeft size={18} strokeWidth={1.75} />} size="sm" onClick={onBack} /> : null}
      {conversation.kind === 'room' ? (
        <>
          <span className="grid size-9 place-items-center rounded-full bg-primary text-on-primary" aria-hidden>
            <UsersRound size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold">{pickText(conversation.title, lang)}</h2>
            <p className="text-xs text-muted">{t('room.members', { count: conversation.memberCount })}</p>
          </div>
        </>
      ) : peer ? (
        <>
          <Avatar name={personName(peer.name, lang)} avatarId={peer.avatarId} avatarUrl={peer.avatarUrl} size="md" status={peer.presence} />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-display text-base font-semibold">
              {personName(peer.name, lang)}
              <Badge size="sm" tone="muted">{t(`role.${peer.role}`)}</Badge>
            </h2>
            <p className="truncate text-xs text-muted">
              {peer.nickname} · #{peer.number} · {t(`presence.${peer.presence}`)}
            </p>
          </div>
        </>
      ) : null}
    </header>
  )
}

export function Thread({ conversation, people, onBack }: ThreadProps) {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const account = useAccount()
  const thread = useThread(conversation.id)
  const typingNames = useTypingNames(conversation.id)
  const typingSender = useTypingSender(conversation.id)
  const markRead = useMarkRead()
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const prevHeight = useRef<number | null>(null)
  const readFor = useRef<string | null>(null)

  const messages = thread.messages
  const last = messages[messages.length - 1]
  const isMine = (m: { senderRole: string; senderId: string }) => !!account && m.senderRole === account.role && m.senderId === account.staffId

  // Mark read on open and whenever someone else's message arrives while the thread is open.
  const lastForeign = [...messages].reverse().find((m) => !m.local && !isMine(m))
  useEffect(() => {
    const marker = `${conversation.id}:${lastForeign?.id ?? 'none'}`
    if (thread.isLoading || readFor.current === marker) return
    readFor.current = marker
    if (conversation.unread > 0 || lastForeign) markRead.mutate(conversation.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, lastForeign?.id, thread.isLoading])

  // Keep pinned to the bottom for new messages; keep position when older ones are prepended.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current
      prevHeight.current = null
      return
    }
    if (stick.current || (last && isMine(last))) el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typingNames.length, thread.isLoading])

  const loadOlder = () => {
    prevHeight.current = scroller.current?.scrollHeight ?? null
    void thread.loadOlder()
  }

  const rows: { key: string; node: React.ReactNode }[] = []
  messages.forEach((message, index) => {
    const prev = messages[index - 1]
    const newDay = !prev || !isSameDay(new Date(prev.timestamp), new Date(message.timestamp))
    const mine = isMine(message)
    const startsRun = !prev || newDay || prev.senderId !== message.senderId || prev.senderRole !== message.senderRole
    if (newDay) {
      rows.push({
        key: `day_${message.id}`,
        node: (
          <div className="my-2 flex items-center gap-3 text-[11px] font-medium text-muted" role="separator">
            <span className="h-px flex-1 bg-line" />
            {formatDay(message.timestamp, lang)}
            <span className="h-px flex-1 bg-line" />
          </div>
        ),
      })
    }
    const person = people.get(`${message.senderRole}:${message.senderId}`)
    rows.push({
      key: message.id,
      node: (
        <div className={cn(startsRun ? 'mt-2' : '-mt-1')}>
          <Bubble
            message={message}
            mine={mine}
            showSender={startsRun && conversation.kind === 'room'}
            sender={person ? { avatarId: person.avatarId, avatarUrl: person.avatarUrl } : null}
            onRetry={thread.retry}
            onDiscard={thread.discard}
          />
        </div>
      ),
    })
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader conversation={conversation} onBack={onBack} />
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-3"
        onScroll={(event) => {
          const el = event.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        aria-live="polite"
        aria-label={t('thread.messages')}
      >
        {thread.isLoading ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : thread.isError ? (
          <ErrorState title={t('thread.error')} onRetry={() => void thread.refetch()} retryLabel={t('thread.retry')} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare size={22} strokeWidth={1.75} />}
            title={t('thread.emptyTitle')}
            description={conversation.kind === 'direct' && conversation.peer ? t('thread.emptyDm', { name: conversation.peer.nickname }) : t('thread.emptyRoom')}
            illustration="none"
            compact
          />
        ) : (
          <>
            {thread.hasMore ? (
              <div className="mb-2 flex justify-center">
                <Button variant="subtle" size="xs" onClick={loadOlder} disabled={thread.loadingOlder} leftIcon={thread.loadingOlder ? <Loader2 size={12} className="animate-spin" /> : undefined}>
                  {t('thread.loadOlder')}
                </Button>
              </div>
            ) : null}
            {rows.map((row) => (
              <Fragment key={row.key}>{row.node}</Fragment>
            ))}
          </>
        )}
      </div>
      <div className="h-6 shrink-0 bg-bg px-4 text-xs text-muted" aria-live="polite">
        {typingNames.length > 0 ? (
          <span className="inline-flex items-center gap-2">
            {t('thread.typing', { name: personName(typingNames[0], lang), count: typingNames.length })}
            <TypingDots />
          </span>
        ) : null}
      </div>
      <Composer onSend={thread.post} onTyping={typingSender.typed} onStopTyping={typingSender.stopped} />
    </div>
  )
}
