import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  History as HistoryIcon,
  Lock,
  MoreVertical,
  PanelRight,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ChannelBadge, Composer, MessageBubble, StatusDot, TypingDots } from '@/components/chat'
import { NestIllustration } from '@/components/brand'
import { Avatar, Button, ConfirmDialog, ErrorState, IconButton, Menu, Skeleton, Spinner, toast } from '@/components/ui'
import { ComposerTools } from '@/features/operator-tools'
import { useAccount } from '@/lib/account'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDay, personName, pickText } from '@/lib/format'
import { useBusEvent } from '@/lib/realtime'
import type { CopilotRef, Message, MessageFile, MessageLocation, SessionDetail, TypingState } from '@/types'

import {
  useFinishChat,
  useMarkSeen,
  useReactToMessage,
  useRetryMessage,
  useSendMessage,
  useSessionDetail,
  useSimulateTimeout,
  useThreadMessages,
  useTypingSignal,
} from '../api'
import { draftStore } from '../lib'
import type { InboxResponse } from '../types'

export interface InsertRequest {
  nonce: number
  text: string
  /** Copilot draft the text came from; the send is then tagged sent_asis / edited_sent. */
  ref?: Omit<CopilotRef, 'action'>
  /** Quick replies append to what is typed; copilot drafts replace it. */
  mode: 'replace' | 'append'
}

export interface ThreadPaneProps {
  sessionId: string | null
  inbox: InboxResponse | undefined
  embedded?: boolean
  /** Stacked (mobile) layout: shows a back button. */
  stacked?: boolean
  drawerOpen: boolean
  historyOpen: boolean
  onToggleDrawer: () => void
  onToggleHistory: () => void
  onBack?: () => void
  insert: InsertRequest | null
  onTake: (sessionId: string) => void
  takingId: string | null
  /** The chat was finished or sent back to the queue. */
  onClosed: () => void
}

const TBILISI: MessageLocation = { lat: 41.7151, lng: 44.8271, label: 'Tbilisi' }

/* ---------------------------------------------------------------- typing */

function useTypingStates(): Record<string, TypingState> {
  const [states, setStates] = useState<Record<string, TypingState>>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useBusEvent('typing:update', (payload) => {
    const existing = timers.current.get(payload.sessionId)
    if (existing) clearTimeout(existing)
    if (payload.isTyping) {
      timers.current.set(
        payload.sessionId,
        setTimeout(() => setStates((current) => omit(current, payload.sessionId)), 8_000),
      )
      setStates((current) => ({ ...current, [payload.sessionId]: payload }))
    } else {
      timers.current.delete(payload.sessionId)
      setStates((current) => omit(current, payload.sessionId))
    }
  })
  useEffect(() => {
    const map = timers.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
      map.clear()
    }
  }, [])
  return states
}

function omit(record: Record<string, TypingState>, key: string): Record<string, TypingState> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

/* ----------------------------------------------------------- small pieces */

function DayLabel({ iso }: { iso: string }) {
  const { i18n } = useTranslation()
  return (
    <div className="my-3 flex items-center gap-3" role="separator" aria-label={formatDay(iso, i18n.language)}>
      <span className="h-px flex-1 bg-line" />
      <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">{formatDay(iso, i18n.language)}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

function PreChatPath({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation('inbox')
  const [open, setOpen] = useState(false)
  const steps = detail.session.faqPath
  if (steps.length === 0) return null
  return (
    <div className="mb-3 rounded-ui border border-dashed border-line-strong bg-sunken/60 text-xs text-muted">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span className="font-medium text-ink">{t('thread.preChat')}</span>
        <span className="truncate">{steps.map((step) => step.answer).join(' › ')}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ol className="space-y-1.5 border-t border-dashed border-line-strong px-3 py-2">
          {steps.map((step) => (
            <li key={step.nodeId}>
              <span className="block text-muted">{step.question}</span>
              <span className="block font-medium text-ink">{step.answer}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function Banner({ tone, icon, title, children, action }: { tone: 'info' | 'warning' | 'danger' | 'accent'; icon: React.ReactNode; title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const toneClass = {
    info: 'bg-sunken text-ink',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-accent-soft text-accent',
  }[tone]
  return (
    <div role="status" className={cn('flex items-start gap-2.5 border-b border-line px-4 py-2.5 text-[13px]', toneClass)}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title ? 'mt-0.5' : '', tone === 'info' ? 'text-muted' : '')}>{children}</div>
      </div>
      {action}
    </div>
  )
}

function HandoffBriefing({ detail }: { detail: SessionDetail }) {
  const { t } = useTranslation(['inbox', 'common'])
  const [open, setOpen] = useState(true)
  const handoff = detail.session.aiHandoff
  if (detail.session.aiState !== 'handed_off' || !handoff) return null
  return (
    <div className="border-b border-line bg-bot px-4 py-2.5 text-[13px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Sparkles size={15} strokeWidth={1.75} aria-hidden />
        <span className="font-semibold">{t('inbox:banner.handoffTitle')}</span>
        <span className="truncate text-xs text-muted">{t(`common:handoffReason.${handoff.reason}`)}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <dl className="mt-1.5 space-y-1 text-ink">
          <div>
            <dt className="sr-only">{t('inbox:banner.summary')}</dt>
            <dd>{handoff.summary}</dd>
          </div>
          {handoff.goal ? (
            <div className="text-muted">
              <dt className="inline font-medium text-ink">{t('inbox:banner.goal')}: </dt>
              <dd className="inline">{handoff.goal}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ pane */

export function ThreadPane(props: ThreadPaneProps) {
  const { sessionId, inbox, embedded, stacked } = props
  const { t, i18n } = useTranslation(['inbox', 'common'])
  const account = useAccount()
  const detailQuery = useSessionDetail(sessionId)
  const detail = detailQuery.data && detailQuery.data.session.id === sessionId ? detailQuery.data : undefined
  const thread = useThreadMessages(sessionId)
  const typingStates = useTypingStates()

  const session = detail?.session
  const mine = !!session && session.operatorId === account?.staffId && session.status !== 'ended'
  const ended = session?.status === 'ended'
  const waiting = session?.status === 'waiting'
  const window = detail?.window

  useMarkSeen(mine ? sessionId : null, session?.unreadCount ?? 0)
  const typingSignal = useTypingSignal(mine ? sessionId : null)

  const send = useSendMessage(sessionId)
  const finish = useFinishChat()
  const retry = useRetryMessage(sessionId)
  const react = useReactToMessage(sessionId)
  const timeout = useSimulateTimeout()
  const [confirmFinish, setConfirmFinish] = useState(false)

  /* ---- composer value, per-chat drafts, copilot ref ---- */
  const [value, setValueState] = useState('')
  const [copilot, setCopilot] = useState<{ ref: Omit<CopilotRef, 'action'>; text: string } | null>(null)
  const valueRef = useRef(value)
  const setValue = useCallback(
    (next: string) => {
      valueRef.current = next
      setValueState(next)
      if (sessionId) draftStore.set(sessionId, next)
    },
    [sessionId],
  )
  useEffect(() => {
    const restored = sessionId ? draftStore.get(sessionId) : ''
    valueRef.current = restored
    setValueState(restored)
    setCopilot(null)
  }, [sessionId])

  const lastInsert = useRef(0)
  useEffect(() => {
    const insert = props.insert
    if (!insert || insert.nonce === lastInsert.current) return
    lastInsert.current = insert.nonce
    const current = valueRef.current
    const next = insert.mode === 'append' && current.trim() ? `${current.replace(/\s+$/, '')} ${insert.text}` : insert.text
    setValue(next)
    setCopilot(insert.ref ? { ref: insert.ref, text: insert.text } : null)
  }, [props.insert, setValue])

  const onChange = (next: string) => {
    setValue(next)
    if (!next.trim()) setCopilot(null)
    if (next.trim()) typingSignal.ping()
    else typingSignal.stop()
  }

  const submit = (extra?: { file?: MessageFile; location?: MessageLocation }) => {
    if (!sessionId) return
    const text = extra ? '' : valueRef.current.trim()
    if (!extra && !text) return
    const ref: CopilotRef | null =
      !extra && copilot
        ? { ...copilot.ref, action: text === copilot.text.trim() ? 'sent_asis' : 'edited_sent' }
        : null
    const previous = valueRef.current
    if (!extra) {
      setValue('')
      setCopilot(null)
    }
    typingSignal.stop()
    send.mutate(
      { content: text, file: extra?.file ?? null, location: extra?.location ?? null, copilotRef: ref },
      {
        onError: (error) => {
          if (!extra) setValue(previous)
          toast.error(errorMessage(error, t('inbox:error.send')))
        },
      },
    )
  }

  const onAttach = (input: unknown) => {
    const first = Array.isArray(input) ? input[0] : input
    let file: MessageFile | null = null
    if (typeof File !== 'undefined' && first instanceof File) {
      file = { url: URL.createObjectURL(first), name: first.name, mimeType: first.type || 'application/octet-stream', size: first.size }
    } else if (first && typeof first === 'object' && 'url' in first) {
      const candidate = first as Partial<MessageFile>
      file = {
        url: String(candidate.url),
        name: candidate.name ?? 'file',
        mimeType: candidate.mimeType ?? 'application/octet-stream',
        size: candidate.size ?? 0,
      }
    }
    if (file) submit({ file })
  }

  const onLocation = (input?: unknown) => {
    const candidate = input as Partial<MessageLocation> | undefined
    const location =
      candidate && typeof candidate.lat === 'number' && typeof candidate.lng === 'number'
        ? { lat: candidate.lat, lng: candidate.lng, label: candidate.label ?? null }
        : TBILISI
    submit({ location })
  }

  /* ---- scrolling ---- */
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const restoreFrom = useRef<number | null>(null)
  const typing = sessionId ? typingStates[sessionId] : undefined

  useEffect(() => {
    stick.current = true
    restoreFrom.current = null
  }, [sessionId])

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (!node) return
    if (restoreFrom.current !== null) {
      node.scrollTop += node.scrollHeight - restoreFrom.current
      restoreFrom.current = null
    } else if (stick.current) {
      node.scrollTop = node.scrollHeight
    }
  }, [thread.messages.length, sessionId, typing?.isTyping, typing?.draft, detail?.session.id])

  const loadOlder = useCallback(() => {
    const node = scrollRef.current
    if (!node || !thread.hasMore || thread.loadingOlder) return
    restoreFrom.current = node.scrollHeight
    void thread.loadOlder().then((count) => {
      if (!count) restoreFrom.current = null
    })
  }, [thread])

  const onScroll = () => {
    const node = scrollRef.current
    if (!node) return
    stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
    if (node.scrollTop < 60) loadOlder()
  }

  /* ---- derived chrome ---- */
  const allowsReactions = !!window?.allowsReactions && mine
  const locked = {
    intervention: !!session?.adminInterventionActive,
    windowClosed: !!window && !window.open,
    capReached: window?.capRemaining === 0,
  }
  const composerDisabled = !mine || locked.intervention || locked.windowClosed || locked.capReached || send.isPending
  const interventionName = detail?.interventionAdmin ? personName(detail.interventionAdmin.name, i18n.language).split(' ')[0] : t('inbox:banner.anAdmin')

  const placeholder = !mine
    ? ''
    : locked.intervention
      ? t('inbox:composer.lockedIntervention', { name: interventionName })
      : locked.windowClosed
        ? window?.remedy === 'template'
          ? t('inbox:composer.lockedTemplate')
          : t('inbox:composer.lockedWindow')
        : locked.capReached
          ? t('inbox:composer.lockedCap')
          : t('inbox:composer.placeholder')

  const rows = useMemo(() => {
    const out: { message: Message; day: string | null; showSender: boolean }[] = []
    let previousDay = ''
    let previousSender = ''
    for (const message of thread.messages) {
      const label = new Date(message.timestamp).toDateString()
      const showDay = label !== previousDay
      previousDay = label
      const senderKey = `${message.sender}:${message.senderId ?? ''}`
      out.push({ message, day: showDay ? message.timestamp : null, showSender: senderKey !== previousSender })
      previousSender = senderKey
    }
    return out
  }, [thread.messages])

  /* ---- empty / loading / error ---- */
  if (!sessionId) {
    const nobody = !inbox || inbox.queue.length + inbox.mine.length === 0
    return (
      <div className="grid h-full min-h-0 flex-1 place-items-center bg-bg p-6 text-center">
        <div className="max-w-xs">
          <NestIllustration className="mx-auto mb-4 h-32 w-auto" withBird />
          <h2 className="font-display text-lg font-semibold text-ink">{nobody ? t('inbox:empty.title') : t('inbox:thread.pick')}</h2>
          <p className="mt-1 text-sm text-muted">{nobody ? t('inbox:empty.description') : t('inbox:thread.pickHint')}</p>
        </div>
      </div>
    )
  }
  if (detailQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-bg">
        {stacked ? (
          <div className="border-b border-line bg-panel p-2">
            <IconButton label={t('common:actions.back')} icon={<ArrowLeft />} onClick={props.onBack} />
          </div>
        ) : null}
        <ErrorState title={t('inbox:error.thread')} onRetry={() => void detailQuery.refetch()} retryLabel={t('inbox:error.retry')} />
      </div>
    )
  }
  if (!detail || !session) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-bg" aria-busy="true" aria-label={t('inbox:loading')}>
        <div className="flex h-14 items-center gap-3 border-b border-line bg-panel px-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
          <Skeleton className="h-10 w-3/5" />
        </div>
      </div>
    )
  }

  const customer = detail.customer
  const fieldValues = session.customFields.filter((field) => field.value).slice(0, 2)
  const presence = customer.status === 'connected' ? 'online' : customer.status === 'waiting' ? 'away' : 'offline'
  const atLimit = !!inbox && inbox.limit > 0 && inbox.activeCount >= inbox.limit
  const canTimeout = mine && (session.status === 'active' || session.status === 'inactive')

  return (
    <section aria-label={t('inbox:thread.label', { name: session.customerName })} className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-bg">
      {/* header */}
      <header className={cn('flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3', embedded ? 'h-14' : 'h-16')}>
        {stacked ? <IconButton label={t('common:actions.back')} icon={<ArrowLeft />} onClick={props.onBack} /> : null}
        <Avatar name={session.customerName} avatarId={customer.externalContact?.avatarId} size={embedded ? 'md' : 'lg'} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="truncate font-display text-[15px] font-semibold text-ink">{session.customerName}</h2>
            <ChannelBadge channel={session.channel} withLabel />
            {session.aiState === 'bot' ? (
              <span className="rounded-full bg-bot px-1.5 py-px text-[10px] font-semibold text-accent">{t('inbox:row.bot')}</span>
            ) : session.aiState === 'handed_off' ? (
              <span className="rounded-full bg-sunken px-1.5 py-px text-[10px] font-semibold text-muted ring-1 ring-line">{t('inbox:row.handedOver')}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={presence} />
              {t(`inbox:presence.${customer.status}`)}
            </span>
            {fieldValues.map((field) => (
              <span key={field.fieldId} className="truncate" title={pickText(field.label, i18n.language)}>
                {field.value}
              </span>
            ))}
            {session.clientIp ? (
              <span className="rounded bg-sunken px-1.5 font-mono text-[11px] text-ink/80 ring-1 ring-line" title={t('inbox:thread.clientIp')}>
                IP {session.clientIp}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={t('inbox:thread.toggleDrawer')}
            icon={<PanelRight />}
            variant="muted"
            active={props.drawerOpen}
            aria-pressed={props.drawerOpen}
            onClick={props.onToggleDrawer}
          />
          <IconButton
            label={t('inbox:thread.toggleHistory')}
            icon={<HistoryIcon />}
            variant="muted"
            active={props.historyOpen}
            aria-pressed={props.historyOpen}
            onClick={props.onToggleHistory}
          />
          {mine ? (
            <Button size="sm" variant="danger-outline" className="ml-1" onClick={() => setConfirmFinish(true)}>
              <span className="max-sm:hidden">{t('inbox:thread.finish')}</span>
              <CheckCheck className="sm:hidden" size={16} aria-label={t('inbox:thread.finish')} />
            </Button>
          ) : null}
          {canTimeout ? (
            <Menu
              label={t('inbox:thread.demoActions')}
              trigger={<IconButton label={t('common:actions.more')} icon={<MoreVertical />} variant="muted" />}
              items={[
                {
                  label: t('inbox:thread.simulateTimeout'),
                  icon: <Timer size={16} strokeWidth={1.75} />,
                  onSelect: () =>
                    timeout.mutate(session.id, {
                      onSuccess: () => {
                        toast.info(t('inbox:thread.timeoutToast'))
                        props.onClosed()
                      },
                      onError: (error) => toast.error(errorMessage(error)),
                    }),
                },
              ]}
            />
          ) : null}
        </div>
      </header>

      {/* banners */}
      <HandoffBriefing detail={detail} />
      {locked.intervention ? (
        <Banner tone="warning" icon={<ShieldAlert size={16} strokeWidth={1.75} />} title={t('inbox:banner.interventionTitle', { name: interventionName })}>
          {t('inbox:banner.interventionBody')}
        </Banner>
      ) : null}
      {locked.windowClosed && !ended ? (
        <Banner tone="warning" icon={<Lock size={16} strokeWidth={1.75} />} title={t('inbox:banner.windowClosedTitle', { channel: t(`common:channel.${session.channel}`), hours: window?.windowHours ?? 24 })}>
          {window?.remedy === 'template' ? t('inbox:banner.windowTemplate') : t('inbox:banner.windowNoRemedy')}
        </Banner>
      ) : null}
      {window?.capLimit != null && !ended && !locked.windowClosed ? (
        <Banner
          tone={locked.capReached ? 'danger' : (window.capRemaining ?? 0) <= 3 ? 'warning' : 'info'}
          icon={<Lock size={16} strokeWidth={1.75} />}
        >
          {locked.capReached
            ? t('inbox:banner.capReached', { limit: window.capLimit })
            : t('inbox:banner.capLeft', { left: window.capRemaining ?? 0, limit: window.capLimit })}
        </Banner>
      ) : null}

      {/* messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        role="log"
        aria-live="polite"
        aria-label={t('inbox:thread.messages')}
      >
        {thread.hasMore ? (
          <div className="mb-3 flex justify-center">
            <Button size="xs" variant="subtle" loading={thread.loadingOlder} onClick={loadOlder}>
              {t('inbox:thread.loadOlder')}
            </Button>
          </div>
        ) : null}
        {thread.query.isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner label={t('inbox:loading')} />
          </div>
        ) : null}
        {thread.query.isError ? (
          <ErrorState title={t('inbox:error.messages')} onRetry={() => void thread.query.refetch()} retryLabel={t('inbox:error.retry')} />
        ) : null}
        {!thread.hasMore && !thread.query.isLoading ? <PreChatPath detail={detail} /> : null}
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ message, day, showSender }) => (
            <li key={message.id} className="flex flex-col">
              {day ? <DayLabel iso={day} /> : null}
              <MessageBubble
                message={message}
                perspective="staff"
                showSender={showSender}
                onRetry={mine ? () => retry.mutate(message.id, { onError: (error) => toast.error(errorMessage(error)) }) : undefined}
                onReact={
                  allowsReactions && message.sender === 'user'
                    ? (emoji: string) => react.mutate({ messageId: message.id, emoji }, { onError: (error) => toast.error(errorMessage(error)) })
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
        {typing && typing.isTyping ? (
          <div className="mt-2 flex flex-col items-start gap-1.5" aria-live="polite">
            <TypingDots label={t('inbox:typing.who', { name: typing.name ?? session.customerName })} />
            {typing.who === 'customer' && typing.draft && inbox?.typingTransparency ? (
              <div className="max-w-[80%] rounded-bubble rounded-bl-[4px] border border-dashed border-line-strong bg-sunken px-3 py-2 text-sm text-muted">
                <span className="mb-0.5 block text-[10px] font-semibold text-accent">{t('inbox:typing.livePreview')}</span>
                <span className="italic">{typing.draft}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {!thread.query.isLoading && thread.messages.length === 0 && !thread.query.isError ? (
          <p className="py-10 text-center text-sm text-muted">{t('inbox:thread.noMessages')}</p>
        ) : null}
      </div>

      {/* footer: take / ended / composer */}
      {waiting ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-panel px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-muted">
            {inbox?.autoAssign ? t('inbox:thread.waitingAuto') : atLimit ? t('inbox:queue.atLimit') : t('inbox:thread.waitingTake')}
          </p>
          {inbox?.autoAssign ? null : (
            <Button variant="primary" disabled={atLimit} loading={props.takingId === session.id} onClick={() => props.onTake(session.id)}>
              {t('inbox:thread.takeChat')}
            </Button>
          )}
        </div>
      ) : ended ? (
        <div className="shrink-0 border-t border-line bg-sunken px-4 py-3 text-center text-sm text-muted">{t('inbox:thread.ended')}</div>
      ) : !mine ? (
        <div className="shrink-0 border-t border-line bg-sunken px-4 py-3 text-center text-sm text-muted">{t('inbox:thread.readOnly')}</div>
      ) : (
        <div className="shrink-0 border-t border-line bg-panel px-3 py-2.5">
          <Composer
            value={value}
            onChange={onChange}
            onSend={() => submit()}
            onAttach={onAttach}
            onLocation={window?.allowsLocation ? onLocation : undefined}
            disabled={composerDisabled}
            placeholder={placeholder}
            maxRows={5}
            toolbar={
              <ComposerTools
                detail={detail}
                onInsert={(text) => {
                  const current = valueRef.current
                  setValue(current.trim() ? `${current.replace(/\s+$/, '')} ${text}` : text)
                  setCopilot(null)
                }}
              />
            }
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        tone="danger"
        title={t('inbox:finish.title', { name: session.customerName })}
        description={t('inbox:finish.description')}
        confirmLabel={t('inbox:finish.confirm')}
        cancelLabel={t('common:actions.cancel')}
        onConfirm={async () => {
          try {
            await finish.mutateAsync(session.id)
            toast.success(t('inbox:finish.done', { name: session.customerName }))
            props.onClosed()
          } catch (error) {
            toast.error(errorMessage(error))
            throw error
          }
        }}
      />
    </section>
  )
}
