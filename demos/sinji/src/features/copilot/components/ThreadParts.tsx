/**
 * Pieces of the harness thread: message bubbles, the [n] citation text, the
 * voice-out button and the composer with voice-in. OWNED BY: copilot.
 */
import { Bot, Loader2, Mic, SendHorizontal, Square, User, UserRound, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, IconButton, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/api/client'
import { formatClock } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import type { Citation, ContentLang } from '@/types'
import { synthesize, transcribe, useTtsCatalog } from '../api'

export interface Msg {
  key: string
  role: 'customer' | 'operator' | 'bot'
  text: string
  streaming?: boolean
  citations?: Citation[]
  /** Autopilot reply kind, for the tag under the bubble. */
  kind?: 'answer' | 'refusal' | 'handoff'
  at: number
}

const CITE = /\[(\d+)\]/g
export const stripCites = (text: string): string => text.replace(CITE, '').replace(/\s{2,}/g, ' ').trim()

/** Text with `[n]` markers rendered as small bronze chips that open the citation. */
export function CitedText({ text, citations, onOpen }: { text: string; citations?: Citation[]; onOpen?: (citation: Citation) => void }) {
  const { t } = useTranslation('copilot')
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(CITE)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const n = Number(match[1])
    const citation = citations?.find((c) => c.n === n)
    parts.push(
      citation && onOpen ? (
        <button
          key={`${at}-${n}`}
          type="button"
          onClick={() => onOpen(citation)}
          aria-label={t('citation.open', { n })}
          className="tabular mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-[5px] bg-accent/15 px-1 text-[11px] font-semibold text-accent hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {n}
        </button>
      ) : (
        <span key={`${at}-${n}`} className="tabular mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-accent/15 px-1 text-[11px] font-semibold text-accent">
          {n}
        </span>
      ),
    )
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <span className="whitespace-pre-wrap">{parts}</span>
}

/* ----------------------------------------------------------- voice out */

/** Plays the TTS clip for a piece of text (POST /public/tts). One clip at a time. */
export function useSpeaker(locale: ContentLang) {
  const { t } = useTranslation('copilot')
  const catalog = useTtsCatalog()
  const audio = useRef<HTMLAudioElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  const stop = useCallback(() => {
    audio.current?.pause()
    audio.current = null
    setPlaying(null)
  }, [])
  useEffect(() => stop, [stop])

  const speak = useCallback(
    async (id: string, text: string) => {
      if (playing === id) return stop()
      stop()
      const voice = catalog.data?.voices.find((v) => v.language === locale && v.is_default) ?? catalog.data?.voices.find((v) => v.language === locale)
      const model = catalog.data?.languages.find((l) => l.code === locale)?.model
      if (!voice || !model) return void toast.error(t('voice.noVoice'))
      setBusy(id)
      try {
        const clip = await synthesize(stripCites(text).slice(0, 2400), locale, voice.voice_id, model)
        const el = new Audio(mediaUrl(clip.audio_url))
        el.onended = () => setPlaying(null)
        el.onerror = () => {
          setPlaying(null)
          toast.error(t('voice.playError'))
        }
        audio.current = el
        setPlaying(id)
        await el.play()
      } catch (error) {
        setPlaying(null)
        toast.error(errorMessage(error, t('voice.playError')))
      } finally {
        setBusy(null)
      }
    },
    [catalog.data, locale, playing, stop, t],
  )
  return { speak, busy, playing }
}

/* ------------------------------------------------------------- bubbles */

export function Bubble({
  msg,
  onCitation,
  speaker,
}: {
  msg: Msg
  onCitation: (citation: Citation) => void
  speaker: ReturnType<typeof useSpeaker>
}) {
  const { t } = useTranslation('copilot')
  const mine = msg.role !== 'customer'
  const Icon = msg.role === 'customer' ? User : msg.role === 'bot' ? Bot : UserRound
  const speaking = speaker.playing === msg.key
  return (
    <li className={cn('flex gap-2.5 animate-panel-in', mine && 'flex-row-reverse')}>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
          msg.role === 'customer' ? 'bg-sunken text-muted' : msg.role === 'bot' ? 'bg-accent/15 text-accent' : 'bg-primary/12 text-primary',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', mine && 'items-end')}>
        <div className="caps text-[10.5px] font-semibold text-subtle">{t(`thread.role.${msg.role}`)}</div>
        <div
          className={cn(
            'rounded-card border px-3.5 py-2.5 text-[14.5px] leading-relaxed',
            msg.role === 'customer' && 'rounded-tl-[3px] border-line bg-sunken/60',
            msg.role === 'operator' && 'rounded-tr-[3px] border-primary/25 bg-primary/10',
            msg.role === 'bot' && 'rounded-tr-[3px] border-accent/30 bg-accent/8',
          )}
        >
          <CitedText text={msg.text} citations={msg.citations} onOpen={onCitation} />
          {msg.streaming ? <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current" /> : null}
        </div>
        {!msg.streaming && (msg.role !== 'customer' || msg.kind) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {msg.kind && msg.kind !== 'answer' ? (
              <Badge size="sm" tone={msg.kind === 'handoff' ? 'warning' : 'neutral'}>
                {t(`reply.${msg.kind}`)}
              </Badge>
            ) : null}
            {msg.role !== 'customer' && msg.text ? (
              <IconButton
                size="sm"
                variant="ghost"
                label={speaking ? t('voice.stopSpeaking') : t('voice.speak')}
                icon={speaker.busy === msg.key ? <Loader2 className="size-4 animate-spin" /> : speaking ? <Square className="size-3.5" /> : <Volume2 className="size-4" />}
                onClick={() => void speaker.speak(msg.key, msg.text)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------ composer */

type Phase = 'idle' | 'recording' | 'transcribing'

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  clientId,
  locale,
  placeholder,
  note,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  sending?: boolean
  clientId: string | undefined
  locale: ContentLang
  placeholder: string
  note?: ReactNode
}) {
  const { t } = useTranslation('copilot')
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const simulated = useRef(false)
  const startedAt = useRef(0)

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== 'inactive') {
        recorder.current.onstop = null
        recorder.current.stop()
      }
      release()
    },
    [release],
  )
  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200)
    return () => window.clearInterval(id)
  }, [phase])

  const finish = useCallback(
    async (size: number, seconds: number) => {
      setPhase('transcribing')
      try {
        const result = await transcribe({ client_id: clientId, locale, size, duration_s: seconds })
        onChange(result.transcript)
        toast.success(t('voice.transcribed'))
      } catch (error) {
        toast.error(errorMessage(error, t('voice.sttError')))
      } finally {
        setPhase('idle')
      }
    },
    [clientId, locale, onChange, t],
  )

  const start = async () => {
    setElapsed(0)
    startedAt.current = Date.now()
    simulated.current = false
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported')
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      chunks.current = []
      const rec = new MediaRecorder(media)
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        release()
        void finish(blob.size, Math.max(1, (Date.now() - startedAt.current) / 1000))
      }
      recorder.current = rec
      rec.start()
    } catch {
      // No microphone (or no permission inside the frame): record a sample take so the demo still flows.
      simulated.current = true
      toast.message(t('voice.micFallback'))
    }
    startedAt.current = Date.now()
    setPhase('recording')
  }

  const stop = () => {
    if (simulated.current) {
      const seconds = Math.max(1.4, (Date.now() - startedAt.current) / 1000)
      void finish(Math.round(seconds * 16000), seconds)
    } else recorder.current?.stop()
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!disabled && !sending && value.trim()) onSend()
    }
  }

  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
  return (
    <div className="border-t border-line bg-panel p-3 sm:p-4">
      {note}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Textarea
            rows={2}
            value={phase === 'transcribing' ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            disabled={disabled || phase !== 'idle'}
            placeholder={phase === 'transcribing' ? t('voice.transcribing') : phase === 'recording' ? t('voice.recording', { time: formatClock(elapsed) }) : placeholder}
            aria-label={t('composer.label')}
            maxLength={2000}
            lang={locale}
            className="max-h-40 resize-none"
          />
        </div>
        {phase === 'recording' ? (
          <Button variant="danger" icon={<Square className="size-4" />} onClick={stop} aria-label={t('voice.stop')}>
            <span className="tabular">{formatClock(elapsed)}</span>
          </Button>
        ) : (
          <IconButton
            label={t('voice.record')}
            variant="secondary"
            size="md"
            icon={phase === 'transcribing' ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
            disabled={disabled || phase === 'transcribing'}
            onClick={() => void start()}
          />
        )}
        <Button variant="primary" icon={<SendHorizontal className="size-4" />} loading={sending} disabled={disabled || !value.trim() || phase !== 'idle'} onClick={onSend}>
          <span className="hidden sm:inline">{t('composer.send')}</span>
          <span className="sr-only sm:hidden">{t('composer.send')}</span>
        </Button>
      </div>
      <p className="mt-1.5 hidden text-xs text-subtle sm:block">{t('composer.hint', { key: mac ? '⌘' : 'Ctrl' })}</p>
    </div>
  )
}
