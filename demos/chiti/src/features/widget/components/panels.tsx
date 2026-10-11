/**
 * Full-body states of the widget card (offline, banned, disabled, not found)
 * and the in-card dialogs (inactivity warning, feedback, end-chat confirm).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Clock, Frown, MoonStar, ShieldOff, Star, Unplug } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatTime, pickText } from '@/lib/format'
import type { Lang } from '@/types'

import type { WidgetConfig } from '../api'

/* ----------------------------------------------------------- body states */

function PanelShell({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-7 py-8 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-line bg-sunken text-ink">{icon}</span>
      <h2 className="m-0 font-display text-[18px] font-semibold leading-tight">{title}</h2>
      <div className="max-w-[28ch] text-[14px] leading-snug text-muted">{children}</div>
      {action}
    </div>
  )
}

export function OfflinePanel({ config, lang, onClose }: { config: WidgetConfig; lang: Lang; onClose?: (() => void) | undefined }) {
  const { t } = useTranslation('widget')
  const { hours } = config
  const message = hours.isTemporarilyClosed && hours.mode === 'temporary' ? hours.temporaryClosedMessage : hours.nextAvailableMessage
  return (
    <PanelShell
      icon={<MoonStar size={26} strokeWidth={1.75} />}
      title={t('offline.title')}
      action={onClose ? <Button variant="secondary" size="sm" onClick={onClose}>{t('offline.close')}</Button> : undefined}
    >
      {message && <p className="m-0 mb-3">{pickText(message, lang)}</p>}
      <p className="m-0 flex items-center justify-center gap-1.5 text-ink">
        <Clock size={15} strokeWidth={1.75} aria-hidden />
        <span className="tabular">
          {hours.todayStart && hours.todayEnd ? t('offline.today', { start: hours.todayStart, end: hours.todayEnd }) : t('offline.closedToday')}
        </span>
      </p>
      {hours.nextOpen && <p className="m-0 mt-1 text-[12.5px]">{t('offline.nextOpen', { when: formatDateTime(hours.nextOpen, lang) })}</p>}
    </PanelShell>
  )
}

export function BannedPanel({ message, onClose }: { message: string; onClose?: (() => void) | undefined }) {
  const { t } = useTranslation('widget')
  return (
    <PanelShell
      icon={<ShieldOff size={26} strokeWidth={1.75} />}
      title={t('banned.title')}
      action={onClose ? <Button variant="secondary" size="sm" onClick={onClose}>{t('banned.close')}</Button> : undefined}
    >
      <p className="m-0">{message}</p>
    </PanelShell>
  )
}

export function DisabledCard() {
  const { t } = useTranslation('widget')
  return (
    <PanelShell icon={<Unplug size={26} strokeWidth={1.75} />} title={t('disabled.title')}>
      <p className="m-0">{t('disabled.body')}</p>
    </PanelShell>
  )
}

export function NotFoundCard({ slug }: { slug: string }) {
  const { t } = useTranslation('widget')
  return (
    <PanelShell icon={<Frown size={26} strokeWidth={1.75} />} title={t('notFound.title')}>
      <p className="m-0">{t('notFound.body', { slug })}</p>
    </PanelShell>
  )
}

/* ------------------------------------------------------------ in-card dialogs */

export function CardDialog({ title, children, actions, label }: { title: string; children?: ReactNode; actions: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [])
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[var(--c-overlay)] p-5 animate-fade-in">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        className="w-full max-w-[300px] rounded-modal border border-line bg-panel p-4 text-ink shadow-pop animate-pop-in"
      >
        <h2 className="m-0 font-display text-[17px] font-semibold leading-tight">{title}</h2>
        {children && <div className="mt-1.5 text-[14px] leading-snug text-muted">{children}</div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  )
}

export function InactivityDialog({ disconnectAt, onAcknowledge }: { disconnectAt: string; onAcknowledge: () => void }) {
  const { t } = useTranslation('widget')
  return (
    <CardDialog
      title={t('inactivity.title')}
      actions={<Button variant="primary" size="sm" data-autofocus onClick={onAcknowledge}>{t('inactivity.ok')}</Button>}
    >
      <p className="m-0">{t('inactivity.body', { time: formatTime(disconnectAt) })}</p>
    </CardDialog>
  )
}

export function EndChatDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation('widget')
  return (
    <CardDialog
      title={t('end.title')}
      actions={
        <>
          <Button variant="secondary" size="sm" data-autofocus onClick={onCancel}>{t('end.cancel')}</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{t('end.confirm')}</Button>
        </>
      }
    >
      <p className="m-0">{t('end.body')}</p>
    </CardDialog>
  )
}

export function FeedbackDialog({
  sent,
  onSend,
  onSkip,
}: {
  sent: boolean
  onSend: (rating: number, comment: string) => Promise<string | null>
  onSkip: () => void
}) {
  const { t } = useTranslation('widget')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <CardDialog title={t('feedback.thanksTitle')} actions={null}>
        <p className="m-0">{t('feedback.thanks')}</p>
      </CardDialog>
    )
  }

  const submit = async () => {
    if (!rating || busy) return
    setBusy(true)
    setError(await onSend(rating, comment))
    setBusy(false)
  }
  const shown = hover || rating

  return (
    <CardDialog
      title={t('feedback.title')}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onSkip}>{t('feedback.skip')}</Button>
          <Button variant="primary" size="sm" disabled={!rating} loading={busy} onClick={submit}>{t('feedback.send')}</Button>
        </>
      }
    >
      <p className="m-0">{t('feedback.subtitle')}</p>
      <div className="my-3 flex justify-center gap-1" role="radiogroup" aria-label={t('feedback.title')}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={t('feedback.stars', { count: value })}
            data-autofocus={value === 1 ? true : undefined}
            className="grid size-9 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(value)}
          >
            <Star size={26} strokeWidth={1.75} className={cn('transition-colors', value <= shown ? 'fill-primary text-ink' : 'text-line-strong')} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        maxLength={500}
        aria-label={t('feedback.comment')}
        placeholder={t('feedback.comment')}
        className="w-full resize-none rounded-ui border border-line-strong bg-bg px-3 py-2 text-[14px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {error && <p role="alert" className="m-0 mt-1.5 text-[12.5px] text-danger">{error}</p>}
    </CardDialog>
  )
}
