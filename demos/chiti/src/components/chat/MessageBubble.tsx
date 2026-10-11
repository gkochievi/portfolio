import { useState } from 'react'
import { AlertCircle, Check, CheckCheck, Clock, FileText, Lock, MapPin, RotateCcw, SmilePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/format'
import type { Message } from '@/types'

const REACTIONS = ['👍', '❤️', '😂', '🙏', '🎉']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Drawn map card: no tiles, no network. */
function LocationCard({ label, lat, lng }: { label: string | null; lat: number; lng: number }) {
  const { t } = useTranslation('common')
  return (
    <figure className="m-0 w-56 overflow-hidden rounded-ui border border-line bg-panel text-ink">
      <svg viewBox="0 0 224 96" className="block h-24 w-full bg-sunken" role="img" aria-label={t('chat.location')}>
        <g fill="none" stroke="var(--c-line)" strokeWidth="6" strokeLinecap="round">
          <path d="M-4 66 C40 58 70 32 118 38 S190 66 232 46" />
          <path d="M60 -4 C70 28 66 64 88 100" />
          <path d="M150 -4 C148 28 170 56 160 100" />
        </g>
        <g transform="translate(112 48)">
          <circle r="16" fill="var(--c-primary)" opacity=".28" />
          <path d="M0 -18c-8 0-14 6-14 14 0 10 14 23 14 23s14-13 14-23c0-8-6-14-14-14Z" fill="var(--c-primary)" stroke="var(--c-ink)" strokeWidth="1.5" />
          <circle cy="-4" r="4.5" fill="var(--c-ink)" />
        </g>
      </svg>
      <figcaption className="px-2.5 py-2 text-[12.5px] leading-tight">
        <span className="flex items-center gap-1 font-medium">
          <MapPin size={13} strokeWidth={1.75} aria-hidden />
          {label ?? t('chat.location')}
        </span>
        <span className="tabular text-[11px] text-muted">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      </figcaption>
    </figure>
  )
}

export interface MessageBubbleProps {
  message: Message
  /** Staff views: customer on the left, the business (operator, admin, AI) on the right. */
  perspective?: 'staff'
  /** Name line above business messages. */
  showSender?: boolean
  /** Shown on a failed outgoing message. */
  onRetry?: () => void
  /** When set, a reaction picker appears on hover / focus. */
  onReact?: (emoji: string) => void
  className?: string
}

export function MessageBubble({ message, showSender = true, onRetry, onReact, className }: MessageBubbleProps) {
  const { t } = useTranslation('common')
  const [picker, setPicker] = useState(false)

  if (message.sender === 'system') {
    return <p className="mx-auto my-1 max-w-[90%] text-center text-xs text-muted">{message.content}</p>
  }

  const customer = message.sender === 'user'
  const bot = message.sender === 'bot'
  const failed = message.deliveryStatus === 'failed'
  const pending = message.deliveryStatus === 'pending'
  const read = !customer && (message.deliveryStatus === 'read' || !!message.seenAt)
  const hasCaption = !!message.content && !(message.type !== 'text' && message.content === message.file?.name)

  return (
    <div className={cn('group flex w-full flex-col', customer ? 'items-start' : 'items-end', className)}>
      {!customer && showSender ? (
        <span className="mb-0.5 flex items-center gap-1.5 px-1 text-[11.5px] text-muted">
          {bot ? <BirdBadge size={16} /> : null}
          <span className="font-medium text-ink">{bot ? t('aiState.bot') : (message.senderName ?? '')}</span>
          {bot ? <span className="rounded-full border border-line px-1.5 text-[10px] font-semibold leading-4 text-accent">{t('chat.aiLabel')}</span> : null}
          {message.sentByAdmin ? <span className="rounded-full bg-sunken px-1.5 text-[10px] leading-4">{t('chat.sentByAdmin')}</span> : null}
        </span>
      ) : null}

      <div className={cn('relative flex max-w-[82%] items-end gap-1', customer ? 'flex-row' : 'flex-row-reverse')}>
        <div
          className={cn(
            'min-w-0 break-words rounded-bubble px-3 py-2 text-sm leading-[1.4]',
            customer && 'rounded-bl-[4px] border border-line bg-panel text-ink',
            message.sender === 'operator' && 'rounded-br-[4px] bg-primary text-on-primary',
            message.sender === 'admin' && 'rounded-br-[4px] bg-primary text-on-primary',
            bot && 'rounded-br-[4px] border border-line bg-bot text-ink',
            message.type === 'image' && 'p-1.5',
            pending && 'opacity-70',
            failed && 'border border-danger bg-danger-soft text-ink',
          )}
        >
          {message.type === 'image' && message.file ? (
            <a href={message.file.url} target="_blank" rel="noreferrer" className="block">
              <img src={message.file.url} alt={message.file.name} className="max-h-60 w-full rounded-ui object-cover" loading="lazy" />
            </a>
          ) : null}
          {message.type === 'file' && message.file ? (
            <a
              href={message.file.url}
              target="_blank"
              rel="noreferrer"
              download={message.file.name}
              className="flex min-w-0 items-center gap-2.5 rounded-ui bg-sunken/70 px-2.5 py-2 text-ink no-underline"
            >
              <FileText size={22} strokeWidth={1.75} aria-hidden className="shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{message.file.name}</span>
                <span className="tabular text-[11px] text-muted">{formatBytes(message.file.size)}</span>
              </span>
            </a>
          ) : null}
          {message.type === 'audio' && message.file ? (
            <audio controls src={message.file.url} className="h-9 max-w-full" preload="none" aria-label={t('chat.audio')} />
          ) : null}
          {message.type === 'location' && message.location ? (
            <LocationCard label={message.location.label} lat={message.location.lat} lng={message.location.lng} />
          ) : null}
          {message.type === 'template' && message.template ? (
            <div className="w-60 max-w-full">
              <p className="m-0 mb-1 text-[10px] font-semibold text-muted">{message.template.name}</p>
              {message.template.preview.header ? <p className="m-0 mb-1 font-display text-[13px] font-semibold">{message.template.preview.header}</p> : null}
              <p className="m-0 whitespace-pre-wrap">{message.template.preview.body}</p>
              {message.template.preview.footer ? <p className="m-0 mt-1.5 text-[11px] text-muted">{message.template.preview.footer}</p> : null}
              {message.template.preview.buttons.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1">
                  {message.template.preview.buttons.map((button) => (
                    <span key={button} className="rounded-ui border border-ink/20 bg-panel/70 px-2 py-1 text-center text-xs font-medium">
                      {button}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {message.type === 'text' || message.type === 'image' || message.type === 'file' || message.type === 'audio' || message.type === 'location' ? (
            hasCaption ? (
              <p className={cn('m-0 whitespace-pre-wrap', message.type !== 'text' && 'mt-1.5', message.type === 'image' && 'px-1.5 pb-0.5')}>{message.content}</p>
            ) : null
          ) : null}
          {bot && message.citations.length > 0 ? (
            <p className="m-0 mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted">
              {message.citations.map((citation) => (
                <span key={citation} className="rounded-full border border-line bg-panel px-2 py-0.5 text-ink">
                  {citation}
                </span>
              ))}
            </p>
          ) : null}
        </div>

        {onReact ? (
          <span className="relative mb-1 shrink-0">
            <button
              type="button"
              aria-label={t('chat.react')}
              aria-expanded={picker}
              onClick={() => setPicker((open) => !open)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setPicker(false)
              }}
              className="grid size-6 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent group-hover:opacity-100"
            >
              <SmilePlus size={15} strokeWidth={1.75} />
            </button>
            {picker ? (
              <span
                role="group"
                aria-label={t('chat.react')}
                className={cn('absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-line bg-panel p-1 shadow-pop animate-pop-in', customer ? 'left-0' : 'right-0')}
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="grid size-7 place-items-center rounded-full text-[16px] hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => {
                      onReact(emoji)
                      setPicker(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {message.reactionEmoji ? (
        <span className={cn('-mt-1.5 rounded-full border border-line bg-panel px-1.5 text-sm leading-5 shadow-sm', customer ? 'ml-3' : 'mr-3')} aria-label={t('chat.react')}>
          {message.reactionEmoji}
        </span>
      ) : null}

      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 px-1 text-[10.5px] text-muted">
        {message.isPreChat ? (
          <span className="inline-flex items-center gap-0.5">
            <Lock size={10} strokeWidth={1.75} aria-hidden />
            {t('chat.preChat')}
          </span>
        ) : null}
        <span className="tabular">{formatTime(message.timestamp)}</span>
        {!customer && !failed ? (
          pending ? (
            <Clock size={12} strokeWidth={1.75} aria-label={t('deliveryStatus.pending')} />
          ) : read ? (
            <CheckCheck size={13} strokeWidth={2} className="text-accent" aria-label={t('chat.seen')} />
          ) : (
            <Check size={13} strokeWidth={2} aria-label={t('chat.delivered')} />
          )
        ) : null}
        {failed ? (
          <>
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <AlertCircle size={12} strokeWidth={1.75} aria-hidden />
              {message.failureKind ? t(`chat.failure.${message.failureKind}`) : t('chat.failed')}
            </span>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">
                <RotateCcw size={11} strokeWidth={2} aria-hidden />
                {t('chat.retry')}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
