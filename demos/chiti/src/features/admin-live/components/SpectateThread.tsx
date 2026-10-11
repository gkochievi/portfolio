import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, Globe, Info, Lock, NotebookText, Send, ShieldCheck, ShieldOff, XCircle } from 'lucide-react'

import { Avatar, Badge, Button, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, ErrorState, IconButton, LoadingBlock, Textarea, toast } from '@/components/ui'
import { ChannelBadge, HandoverChain, MessageBubble } from '@/components/chat'
import { errorMessage } from '@/api/client'
import { cn } from '@/lib/cn'
import { formatDay, formatDateTime, personName, pickText } from '@/lib/format'
import { useAccount } from '@/lib/account'
import { useBusEvent } from '@/lib/realtime'
import type { ChatNote, Lang, Message, SessionDetail, TypingState } from '@/types'

import { useEndSession, useSendAdminMessage, useSetIntervention, useSpectateDetail, useSpectateMessages, useSpectateNotes } from '../api'

interface SpectateThreadProps {
  sessionId: string
  /** Admin: can step in, write as admin and end the chat. Supervisor: read-only. */
  canAct: boolean
  onBack?: () => void
  className?: string
}

function DayBreak({ iso, lang }: { iso: string; lang: string }) {
  return (
    <div className="my-3 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span>{formatDay(iso, lang)}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

function TypingLine({ typing, label }: { typing: TypingState; label: string }) {
  return (
    <div className="flex items-start gap-2 px-1 text-sm text-muted" aria-live="polite">
      <span className="mt-1.5 flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-dot-hop rounded-full bg-muted" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
      <span className="min-w-0">
        <span>{label}</span>
        {typing.draft ? <span className="mt-0.5 block truncate italic">{typing.draft}</span> : null}
      </span>
    </div>
  )
}

function NotesList({ notes }: { notes: ChatNote[] }) {
  const { t, i18n } = useTranslation(['adminLive', 'common'])
  if (notes.length === 0) return <p className="px-4 py-3 text-sm text-muted">{t('thread.notesEmpty')}</p>
  return (
    <ul className="divide-y divide-line">
      {notes.map((note) => (
        <li key={note.id} className="px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="font-medium text-ink">{note.authorName}</span>
            <span>{t(`common:role.${note.authorRole}`)}</span>
            <span className="tabular">{formatDateTime(note.createdAt, i18n.language)}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-ink">{note.content}</p>
        </li>
      ))}
    </ul>
  )
}

function CustomerDetails({ detail, lang }: { detail: SessionDetail; lang: Lang }) {
  const { t } = useTranslation(['adminLive', 'common'])
  const { session, customer } = detail
  const contact = customer.externalContact
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" leftIcon={<Info size={16} strokeWidth={1.75} />} rightIcon={<ChevronDown size={14} strokeWidth={1.75} />}>
          {t('thread.details')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">{t('thread.customerId')}</dt>
          <dd className="truncate font-mono text-xs text-ink">{customer.number}</dd>
          <dt className="text-muted">{t('thread.language')}</dt>
          <dd className="text-ink">{t(`common:lang.${session.clientLanguage}`)}</dd>
          {session.clientIp ? (
            <>
              <dt className="text-muted">{t('thread.ipAddress')}</dt>
              <dd className="font-mono text-xs text-ink">{session.clientIp}</dd>
            </>
          ) : null}
        </dl>
        <p className="mb-1 mt-3 text-xs font-medium text-muted">{t('thread.formAnswers')}</p>
        {session.customFields.length === 0 ? (
          <p className="text-sm text-muted">{t('thread.noFormAnswers')}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {session.customFields.map((field) => (
              <div key={field.fieldId} className="contents">
                <dt className="text-muted">{pickText(field.label, lang)}</dt>
                <dd className="break-words text-ink">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {contact ? (
          <>
            <p className="mb-1 mt-3 text-xs font-medium text-muted">{t('thread.channelProfile')}</p>
            <p className="text-sm text-ink">
              {contact.displayName}
              {contact.username ? <span className="text-muted"> · @{contact.username}</span> : null}
            </p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SpectateThread({ sessionId, canAct, onBack, className }: SpectateThreadProps) {
  const { t, i18n } = useTranslation(['adminLive', 'common'])
  const lang: Lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  const account = useAccount()
  const detailQuery = useSpectateDetail(sessionId)
  const messagesQuery = useSpectateMessages(sessionId)
  const notesQuery = useSpectateNotes(sessionId)
  const intervention = useSetIntervention(sessionId)
  const send = useSendAdminMessage(sessionId)
  const endChat = useEndSession(sessionId)

  const [typing, setTyping] = useState<TypingState | null>(null)
  const [draft, setDraft] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    setTyping(null)
    setDraft('')
    setNotesOpen(false)
    stick.current = true
  }, [sessionId])

  useBusEvent('typing:update', (state) => {
    if (state.sessionId !== sessionId) return
    setTyping(state.isTyping ? state : null)
  })
  // A typing hint that never gets its "stopped" event should not linger.
  useEffect(() => {
    if (!typing) return
    const timer = setTimeout(() => setTyping(null), 7_000)
    return () => clearTimeout(timer)
  }, [typing])

  const messages = useMemo(
    () => (messagesQuery.data ?? []).filter((row) => row.sender !== 'system' || row.content),
    [messagesQuery.data],
  )
  const notes = useMemo(() => {
    const raw: unknown = notesQuery.data
    const list = Array.isArray(raw) ? raw : ((raw as { notes?: ChatNote[] } | undefined)?.notes ?? [])
    return [...(list as ChatNote[])].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  }, [notesQuery.data])

  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages.length, typing, detailQuery.data?.session.adminInterventionActive])

  if (detailQuery.isPending) return <LoadingBlock label={t('common:states.loading')} />
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState title={t('thread.loadError')} description={errorMessage(detailQuery.error)} onRetry={() => void detailQuery.refetch()} retryLabel={t('common:actions.retry')} />
  }

  const detail = detailQuery.data
  const { session, operator, interventionAdmin } = detail
  const ended = session.status === 'ended'
  const intervened = session.adminInterventionActive && !ended
  const mine = !interventionAdmin || interventionAdmin.id === account?.staffId
  const operatorName = operator?.nickname ?? ''
  const typingName = typing?.who === 'customer' ? t('thread.typingCustomer') : t('thread.typing', { name: typing?.name || (typing?.who === 'bot' ? t('common:chat.aiLabel') : operatorName) })

  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const toggleIntervention = () => {
    const next = !(session.adminInterventionActive && mine)
    intervention.mutate(next, {
      onSuccess: () => toast.success(next ? t('thread.toastStepIn') : t('thread.toastHandBack')),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const submit = () => {
    const content = draft.trim()
    if (!content || send.isPending) return
    stick.current = true
    send.mutate(content, {
      onSuccess: () => setDraft(''),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const rows: React.ReactNode[] = []
  let lastDay = ''
  for (const message of messages as Message[]) {
    const day = new Date(message.timestamp).toDateString()
    if (day !== lastDay) {
      rows.push(<DayBreak key={`day-${message.id}`} iso={message.timestamp} lang={i18n.language} />)
      lastDay = day
    }
    rows.push(<MessageBubble key={message.id} message={message} perspective="staff" showSender />)
  }

  return (
    <section className={cn('flex min-h-0 flex-col bg-panel', className)} aria-label={session.customerName}>
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {onBack ? <IconButton label={t('thread.back')} icon={<ArrowLeft size={18} strokeWidth={1.75} />} variant="ghost" onClick={onBack} className="-ml-2 lg:hidden" /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-semibold text-ink">{session.customerName}</h2>
              <ChannelBadge channel={session.channel} withLabel />
              <Badge tone={ended ? 'neutral' : session.status === 'waiting' ? 'warning' : session.status === 'active' ? 'success' : 'muted'} size="sm" dot>
                {t(`common:sessionStatus.${session.status}`)}
              </Badge>
              {session.clientIp ? (
                <Badge tone="outline" size="sm" icon={<Globe size={12} strokeWidth={1.75} />} className="font-mono">
                  {session.clientIp}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted">
              {operator ? (
                <>
                  <Avatar name={personName(operator.name, lang)} avatarId={operator.avatarId} avatarUrl={operator.avatarUrl} size="xs" status={operator.status} />
                  <span className="truncate text-ink">{operator.nickname}</span>
                  <span className="tabular">#{operator.operatorNumber}</span>
                </>
              ) : (
                <span>{t('thread.noOperator')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomerDetails detail={detail} lang={lang} />
          <Button
            variant="outline"
            size="sm"
            aria-expanded={notesOpen}
            leftIcon={<NotebookText size={16} strokeWidth={1.75} />}
            onClick={() => setNotesOpen((open) => !open)}
          >
            {t('thread.notes')}
            <span className="tabular text-muted">{notes.length}</span>
          </Button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {!canAct ? (
              <Badge tone="muted" size="sm" icon={<Lock size={12} strokeWidth={1.75} />}>
                {t('thread.readOnly')}
              </Badge>
            ) : null}
            {canAct && !ended ? (
              <>
                <Button
                  variant={intervened && mine ? 'secondary' : 'primary'}
                  size="sm"
                  loading={intervention.isPending}
                  disabled={!operator}
                  title={!operator ? t('thread.needsOperator') : undefined}
                  leftIcon={intervened && mine ? <ShieldOff size={16} strokeWidth={1.75} /> : <ShieldCheck size={16} strokeWidth={1.75} />}
                  onClick={toggleIntervention}
                >
                  {intervened && mine ? t('thread.stopIntervention') : t('thread.startIntervention')}
                </Button>
                <Button variant="danger-outline" size="sm" leftIcon={<XCircle size={16} strokeWidth={1.75} />} onClick={() => setConfirmEnd(true)}>
                  {t('thread.endChat')}
                </Button>
              </>
            ) : null}
          </span>
        </div>

        {detail.assignments.length > 0 || session.aiHandoff ? (
          <HandoverChain assignments={detail.assignments} handoff={session.aiHandoff} />
        ) : null}
      </header>

      {notesOpen ? (
        <div className="max-h-48 overflow-y-auto border-b border-line bg-sunken">
          <NotesList notes={notes} />
        </div>
      ) : null}

      {intervened ? (
        <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-sm text-ink" role="status">
          <ShieldCheck size={16} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
          <span>
            {interventionAdmin && !mine
              ? t('thread.bannerOther', { admin: personName(interventionAdmin.name, lang), operator: operatorName })
              : t('thread.bannerYou', { operator: operatorName })}
          </span>
        </div>
      ) : null}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-4">
        {messagesQuery.isPending ? (
          <LoadingBlock label={t('common:states.loading')} />
        ) : messagesQuery.isError ? (
          <ErrorState title={t('thread.loadError')} description={errorMessage(messagesQuery.error)} onRetry={() => void messagesQuery.refetch()} retryLabel={t('common:actions.retry')} />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t('thread.empty')}</p>
        ) : (
          rows
        )}
        {typing ? <TypingLine typing={typing} label={typingName} /> : null}
      </div>

      {ended ? (
        <footer className="border-t border-line bg-sunken px-4 py-3 text-sm">
          <p className="font-medium text-ink">{t('thread.ended')}</p>
          <p className="text-muted">
            {t('thread.endedLine', {
              who: session.endedBy ? t(`common:endedBy.${session.endedBy}`) : '—',
              reason: session.endReason ? t(`common:endReason.${session.endReason}`) : '—',
            })}
          </p>
          {session.endSummary ? <p className="mt-1 text-ink">{session.endSummary}</p> : null}
        </footer>
      ) : canAct && intervened ? (
        <footer className="flex items-end gap-2 border-t border-line p-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
            autoGrow
            maxRows={5}
            rows={1}
            maxLength={4000}
            aria-label={t('thread.composerLabel')}
            placeholder={t('thread.composerPlaceholder', { name: session.customerName })}
            className="flex-1"
          />
          <Button variant="primary" loading={send.isPending} disabled={!draft.trim()} leftIcon={<Send size={16} strokeWidth={1.75} />} onClick={submit}>
            {t('thread.send')}
          </Button>
        </footer>
      ) : canAct && !operator ? (
        <footer className="border-t border-line bg-sunken px-4 py-3 text-sm text-muted">{t('thread.needsOperator')}</footer>
      ) : !canAct ? (
        <footer className="border-t border-line bg-sunken px-4 py-3 text-sm text-muted">{t('thread.readOnlyHint')}</footer>
      ) : null}

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        tone="danger"
        title={t('thread.endTitle')}
        description={t('thread.endDescription', { name: session.customerName })}
        confirmLabel={t('thread.endConfirm')}
        cancelLabel={t('common:actions.cancel')}
        onConfirm={async () => {
          try {
            await endChat.mutateAsync()
            toast.success(t('thread.toastEnded'))
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </section>
  )
}
