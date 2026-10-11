import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { MapPin, Paperclip, SendHorizontal, Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

const EMOJI = ['😀', '😊', '😂', '😍', '🙏', '👍', '👌', '🎉', '🍷', '🥂', '🍇', '🧀', '🎁', '❤️', '😅', '🤔', '👋', '🙌', '✅', '📦', '🚚', '⭐', '🔥', '😢']

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  /** Called with the picked file(s). Omit to hide the attach button. */
  onAttach?: (files: File[]) => void
  /** Omit to hide the location button (channels that cannot carry a location). */
  onLocation?: () => void
  disabled?: boolean
  placeholder?: string
  /** Auto-grow ceiling in lines (default 5). */
  maxRows?: number
  /** Extra buttons above the input (quick replies, templates). */
  toolbar?: ReactNode
  className?: string
}

const LINE = 20

export function Composer({ value, onChange, onSend, onAttach, onLocation, disabled, placeholder, maxRows = 5, toolbar, className }: ComposerProps) {
  const { t } = useTranslation('common')
  const area = useRef<HTMLTextAreaElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, LINE * maxRows + 16)}px`
  }, [value, maxRows])

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
    const picked = Array.from(event.target.files ?? [])
    if (picked.length > 0) onAttach?.(picked)
    event.target.value = ''
  }

  const tool =
    'grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40'

  return (
    <div ref={root} className={cn('relative flex flex-col gap-1.5', className)}>
      {toolbar ? <div className="flex flex-wrap items-center gap-1.5">{toolbar}</div> : null}
      {emojiOpen ? (
        <div
          role="dialog"
          aria-label={t('chat.emoji')}
          className="absolute bottom-full left-0 z-10 mb-1 grid w-[236px] grid-cols-8 gap-0.5 rounded-ui border border-line bg-panel p-1.5 shadow-pop animate-pop-in"
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
      ) : null}
      <div className="flex items-end gap-1">
        <button type="button" className={tool} aria-label={t('chat.emoji')} aria-expanded={emojiOpen} disabled={disabled} onClick={() => setEmojiOpen((open) => !open)}>
          <Smile size={19} strokeWidth={1.75} />
        </button>
        {onAttach ? (
          <>
            <button type="button" className={tool} aria-label={t('chat.attach')} disabled={disabled} onClick={() => files.current?.click()}>
              <Paperclip size={19} strokeWidth={1.75} />
            </button>
            <input ref={files} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" onChange={onPick} tabIndex={-1} aria-hidden />
          </>
        ) : null}
        {onLocation ? (
          <button type="button" className={tool} aria-label={t('chat.location')} disabled={disabled} onClick={onLocation}>
            <MapPin size={19} strokeWidth={1.75} />
          </button>
        ) : null}
        <textarea
          ref={area}
          value={value}
          rows={1}
          maxLength={2000}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder ?? t('chat.compose')}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-9 min-w-0 flex-1 resize-none rounded-[18px] border border-line-strong bg-bg px-3 py-[7px] text-sm leading-5 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          aria-label={t('actions.send')}
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
