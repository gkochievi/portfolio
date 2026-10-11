/**
 * Chat building blocks for the customer widget: message bubble, typing
 * indicator, composer (emoji, attach, location) and the drawn location card.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Check, CheckCheck, FileText, MapPin, Paperclip, SendHorizontal, Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/format'
import type { Message } from '@/types'

/* ----------------------------------------------------------------- helpers */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/* ---------------------------------------------------------- location card */

export function LocationCard({ label, lat, lng }: { label: string | null; lat: number; lng: number }) {
  const { t } = useTranslation('widget')
  return (
    <figure className="w-56 overflow-hidden rounded-ui border border-line bg-panel text-ink">
      <svg viewBox="0 0 224 104" className="block h-[104px] w-full bg-sunken" role="img" aria-label={t('bubble.location')}>
        <g fill="none" stroke="var(--c-line)" strokeWidth="6" strokeLinecap="round">
          <path d="M-4 70 C40 62 70 34 118 40 S190 70 232 48" />
          <path d="M60 -4 C70 30 66 70 88 108" />
          <path d="M150 -4 C148 30 170 60 160 108" />
        </g>
        <g fill="none" stroke="var(--c-line-strong)" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round" opacity=".6">
          <path d="M-4 20 C60 14 120 22 232 12" />
        </g>
        <g transform="translate(112 52)">
          <circle r="18" fill="var(--c-primary)" opacity=".28" />
          <path d="M0 -20c-9 0-15 6.600-15 15 0 11 15 25 15 25s15-14 15-25c0-8.400-6-15-15-15Z" fill="var(--c-primary)" stroke="var(--c-ink)" strokeWidth="1.5" />
          <circle cy="-5" r="5" fill="var(--c-ink)" />
        </g>
      </svg>
      <figcaption className="px-2.5 py-2 text-[12.5px] leading-tight">
        <span className="block font-medium">{label ?? t('bubble.location')}</span>
        <span className="tabular text-[11px] text-muted">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      </figcaption>
    </figure>
  )
}

/* ---------------------------------------------------------------- bubble */

export interface WidgetBubbleProps {
  message: Message
  /** Show the sender's name above staff messages. */
  showSender?: boolean
  /** Animate the bubble in (messages that arrive while the chat is open). */
  fresh?: boolean
  /** First bubble of the pre-chat walk: show the "Pre-chat" caption once. */
  preChatCaption?: boolean
}

export function WidgetBubble({ message, showSender = true, fresh = false, preChatCaption = false }: WidgetBubbleProps) {
  const { t } = useTranslation('widget')
  const mine = message.sender === 'user'
  const bot = message.sender === 'bot'
  const staff = message.sender === 'operator' || message.sender === 'admin'

  if (message.sender === 'system') {
    return <p className="mx-auto my-1 max-w-[90%] text-center text-[12px] text-muted">{message.content}</p>
  }

  const status = mine ? (message.seenAt || message.deliveryStatus === 'read' ? 'read' : 'delivered') : null

  return (
    <div className={cn('flex w-full flex-col', mine ? 'items-end' : 'items-start', fresh && 'animate-hop')}>
      {preChatCaption && (
        <span className="mx-auto mb-1.5 mt-1 text-[11px] text-muted">{t('bubble.preChat')}</span>
      )}
      {((bot && !message.isPreChat) || (staff && showSender)) && (
        <span className="mb-0.5 ml-1 flex items-center gap-1.5 text-[11.5px] text-muted">
          {bot && <BirdBadge size={16} />}
          <span className="font-medium text-ink">{bot ? t('typing.botName') : (message.senderName ?? '')}</span>
          {bot && (
            <span className="rounded-full border border-line px-1.5 text-[10px] font-semibold leading-4 text-accent">{t('bubble.ai')}</span>
          )}
          {message.sentByAdmin && (
            <span className="rounded-full bg-sunken px-1.5 text-[10px] leading-4">{t('bubble.admin')}</span>
          )}
        </span>
      )}
      <div
        className={cn(
          'max-w-[84%] break-words rounded-bubble px-3 py-2 text-[14px] leading-[1.4]',
          mine && 'rounded-br-[4px] bg-primary text-on-primary',
          bot && 'rounded-bl-[4px] border border-line bg-bot text-ink',
          staff && 'rounded-bl-[4px] border border-line bg-panel text-ink',
          message.type === 'image' && 'p-1.5',
        )}
      >
        {message.type === 'image' && message.file && (
          <a href={message.file.url} target="_blank" rel="noreferrer" className="block">
            <img src={message.file.url} alt={message.file.name} className="max-h-56 w-full rounded-ui object-cover" loading="lazy" />
          </a>
        )}
        {message.type === 'file' && message.file && (
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
        )}
        {message.type === 'audio' && message.file && (
          <audio controls src={message.file.url} className="h-9 max-w-full" preload="none" />
        )}
        {message.type === 'location' && message.location && (
          <LocationCard label={message.location.label} lat={message.location.lat} lng={message.location.lng} />
        )}
        {message.type === 'text' && <p className="m-0 whitespace-pre-wrap">{message.content}</p>}
        {message.type === 'image' && message.content && message.content !== message.file?.name && (
          <p className="m-0 whitespace-pre-wrap px-1.5 pb-0.5 pt-1.5">{message.content}</p>
        )}
        {bot && message.citations.length > 0 && (
          <p className="m-0 mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted">
            <span>{t('bubble.sources')}</span>
            {message.citations.map((citation) => (
              <span key={citation} className="rounded-full border border-line bg-panel px-2 py-0.5 text-ink">
                {citation}
              </span>
            ))}
          </p>
        )}
      </div>
      <span className={cn('mt-0.5 flex items-center gap-1 px-1 text-[10.5px] text-muted', mine ? 'flex-row' : 'flex-row')}>
        <span className="tabular">{formatTime(message.timestamp)}</span>
        {status === 'read' && <CheckCheck size={13} strokeWidth={2} className="text-accent" aria-label={t('bubble.seen')} />}
        {status === 'delivered' && <Check size={13} strokeWidth={2} aria-label={t('bubble.delivered')} />}
      </span>
    </div>
  )
}

/* ------------------------------------------------------- typing indicator */

export function TypingIndicator({ label, bot }: { label: string; bot?: boolean }) {
  return (
    <div className="flex items-center gap-2 pl-1 text-[12px] text-muted" role="status" aria-live="polite">
      {bot && <BirdBadge size={16} />}
      <span className="inline-flex items-end gap-[3px]" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span key={index} className="size-[6px] animate-dot-hop rounded-full bg-muted" style={{ animationDelay: `${index * 140}ms` }} />
        ))}
      </span>
      <span>{label}</span>
    </div>
  )
}

/* --------------------------------------------------------------- composer */

const EMOJI = ['😀', '😊', '😂', '😍', '🙏', '👍', '👌', '🎉', '🍷', '🥂', '🍇', '🧀', '🎁', '❤️', '😅', '🤔', '👋', '🙌', '✅', '📦', '🚚', '⭐', '🔥', '😢']

export interface WidgetComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onFile: (file: File) => void
  onLocation: () => void
  disabled?: boolean
  placeholder: string
}

export function WidgetComposer({ value, onChange, onSend, onFile, onLocation, disabled, placeholder }: WidgetComposerProps) {
  const { t } = useTranslation('widget')
  const area = useRef<HTMLTextAreaElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [value])

  useEffect(() => {
    if (!emojiOpen) return
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setEmojiOpen(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [emojiOpen])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (value.trim() && !disabled) onSend()
    }
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ''
  }

  const tool = 'grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40'

  return (
    <div ref={root} className="relative border-t border-line bg-panel px-2.5 py-2">
      {emojiOpen && (
        <div
          role="dialog"
          aria-label={t('chat.emoji')}
          className="absolute bottom-full left-2 z-10 mb-1 grid w-[236px] grid-cols-8 gap-0.5 rounded-ui border border-line bg-panel p-1.5 shadow-pop animate-pop-in"
        >
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid size-7 place-items-center rounded-md text-[17px] hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              onClick={() => {
                onChange(`${value}${emoji}`)
                setEmojiOpen(false)
                area.current?.focus()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1">
        <button type="button" className={tool} aria-label={t('chat.emoji')} aria-expanded={emojiOpen} disabled={disabled} onClick={() => setEmojiOpen((open) => !open)}>
          <Smile size={19} strokeWidth={1.75} />
        </button>
        <button type="button" className={tool} aria-label={t('chat.attach')} disabled={disabled} onClick={() => files.current?.click()}>
          <Paperclip size={19} strokeWidth={1.75} />
        </button>
        <button type="button" className={tool} aria-label={t('chat.location')} disabled={disabled} onClick={onLocation}>
          <MapPin size={19} strokeWidth={1.75} />
        </button>
        <input ref={files} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" onChange={onPick} tabIndex={-1} />
        <textarea
          ref={area}
          value={value}
          rows={1}
          maxLength={2000}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-24 min-h-9 min-w-0 flex-1 resize-none rounded-[18px] border border-line-strong bg-bg px-3 py-[7px] text-[14px] leading-[1.4] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50"
        />
        <button
          type="button"
          aria-label={t('chat.send')}
          disabled={disabled || !value.trim()}
          onClick={onSend}
          className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-primary text-on-primary transition-transform active:translate-y-px disabled:border-line disabled:bg-sunken disabled:text-muted"
        >
          <SendHorizontal size={17} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
