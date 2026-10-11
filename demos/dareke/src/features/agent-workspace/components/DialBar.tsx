import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff, Pause, PhoneForwarded, PhoneOff, Play } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDuration, secondsSince } from '@/lib/format'
import { toneClasses } from '@/lib/tone'
import type { AgentStateView, OperatorCall } from '@/types'
import { useNow } from './shared'

function BarButton({
  label,
  hotkey,
  icon,
  onClick,
  disabled,
  active,
  danger,
}: {
  label: string
  hotkey?: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-keyshortcuts={hotkey}
      className={cn(
        'flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-control px-2 text-[11px] font-semibold text-lime transition-colors sm:min-w-16',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:cursor-not-allowed disabled:opacity-35',
        active ? 'bg-lime text-on-lime' : danger ? cn(toneClasses('danger').solid, 'hover:opacity-90') : 'hover:bg-white/10',
      )}
    >
      {icon}
      <span className="hidden leading-none sm:block">
        {label}
        {hotkey && <span className="ml-1 opacity-60">{hotkey}</span>}
      </span>
    </button>
  )
}

function TransferPopover({ onTransfer, onClose, pending }: { onTransfer: (ext: string) => void; onClose: () => void; pending: boolean }) {
  const { t } = useTranslation('agent')
  const [ext, setExt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{3,6}$/.test(ext.trim())) {
      setError(t('dialbar.extensionInvalid'))
      return
    }
    onTransfer(ext.trim())
  }
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('dialbar.transferTitle')}
      className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-card border border-hairline bg-panel p-3 text-ink shadow-pop"
    >
      <form onSubmit={submit} className="grid gap-2">
        <label htmlFor="transfer-ext" className="text-sm font-semibold">
          {t('dialbar.transferTitle')}
        </label>
        <input
          id="transfer-ext"
          autoFocus
          inputMode="numeric"
          value={ext}
          onChange={(event) => {
            setExt(event.target.value)
            setError(null)
          }}
          placeholder="1201"
          className="h-9 rounded-control border border-hairline bg-panel px-2.5 font-mono text-sm text-ink outline-none focus:border-ink"
        />
        <p className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>{error ?? t('dialbar.transferHint')}</p>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-control bg-carbon text-sm font-semibold text-lime hover:opacity-90 disabled:opacity-50"
        >
          {t('dialbar.transferDo')}
        </button>
      </form>
    </div>
  )
}

export function DialBar({
  call,
  state,
  muted,
  onMute,
  onHold,
  onHangup,
  onTransfer,
  transferPending,
}: {
  call: OperatorCall | null
  state: AgentStateView | undefined
  muted: boolean
  onMute: () => void
  onHold: () => void
  onHangup: () => void
  onTransfer: (ext: string) => Promise<boolean>
  transferPending: boolean
}) {
  const { t } = useTranslation('agent')
  const now = useNow(250)
  const [transferOpen, setTransferOpen] = useState(false)
  const connected = call?.phase === 'answered'
  const ringing = !!call && ['requesting', 'dialing', 'ringing', 'incoming'].includes(call.phase)
  useEffect(() => {
    if (!connected) setTransferOpen(false)
  }, [connected])

  let timer = 0
  if (call?.answeredAt) timer = secondsSince(call.answeredAt, call.endedAt ? Date.parse(call.endedAt) : now)
  else if (call && call.phase !== 'ended') timer = secondsSince(call.initiatedAt, now)

  const status = state?.status
  const wrap =
    !call && status && status.autoReturn && status.timeoutSeconds > 0 && status.type === 'working' && state
      ? { total: status.timeoutSeconds, elapsed: Math.min(status.timeoutSeconds, (now - Date.parse(state.stateSince)) / 1000) }
      : null

  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 mt-6 flex h-16 items-center gap-2 bg-carbon px-3 text-lime sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-8 lg:px-8"
      role="toolbar"
      aria-label={t('dialbar.label')}
    >
      <div className="min-w-[64px]">
        <p className="hidden text-[10px] font-semibold uppercase tracking-wider text-lime/70 sm:block">{t('dialbar.timer')}</p>
        <p className="font-mono text-xl tabular text-lime sm:text-2xl" aria-live="off">
          {formatDuration(timer)}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
        <BarButton
          label={muted ? t('dialbar.unmute') : t('dialbar.mute')}
          hotkey="M"
          icon={muted ? <MicOff size={18} strokeWidth={1.75} /> : <Mic size={18} strokeWidth={1.75} />}
          onClick={onMute}
          disabled={!connected}
          active={muted && connected}
        />
        <BarButton
          label={call?.onHold ? t('dialbar.resume') : t('dialbar.hold')}
          hotkey="H"
          icon={call?.onHold ? <Play size={18} strokeWidth={1.75} /> : <Pause size={18} strokeWidth={1.75} />}
          onClick={onHold}
          disabled={!connected}
          active={!!call?.onHold}
        />
        <div className="relative">
          <BarButton
            label={t('dialbar.transfer')}
            icon={<PhoneForwarded size={18} strokeWidth={1.75} />}
            onClick={() => setTransferOpen((open) => !open)}
            disabled={!connected}
            active={transferOpen}
          />
          {transferOpen && connected && (
            <TransferPopover
              pending={transferPending}
              onClose={() => setTransferOpen(false)}
              onTransfer={(ext) =>
                void onTransfer(ext).then((ok) => {
                  if (ok) setTransferOpen(false)
                })
              }
            />
          )}
        </div>
        <BarButton
          label={t('dialbar.hangup')}
          hotkey="E"
          icon={<PhoneOff size={18} strokeWidth={1.75} />}
          onClick={onHangup}
          disabled={!(connected || ringing)}
          danger={connected || ringing}
        />
      </div>

      <div className="w-24 sm:w-56">
        {wrap ? (
          <div>
            <p className="truncate text-[11px] font-semibold text-lime">
              {t('dialbar.nextIn', { seconds: Math.max(0, Math.ceil(wrap.total - wrap.elapsed)) })}
            </p>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={wrap.total}
              aria-valuenow={Math.round(wrap.elapsed)}
            >
              <div className="h-full rounded-full bg-lime transition-[width] duration-200" style={{ width: `${(wrap.elapsed / wrap.total) * 100}%` }} />
            </div>
          </div>
        ) : (
          <p className="truncate text-right text-[11px] font-semibold text-lime/80">
            {call?.awaitingDisposition
              ? t('dialbar.awaiting')
              : call
                ? t(`dialbar.phase.${call.phase}`)
                : t('dialbar.idle')}
          </p>
        )}
      </div>
    </div>
  )
}
