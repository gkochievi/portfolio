import { AlertCircle, Clock, Download, FileText, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime, personName } from '@/lib/format'
import type { Operator, StaffMessage } from '@/types'

import type { ThreadMessage } from '../api'

interface BubbleProps {
  message: ThreadMessage
  mine: boolean
  /** Show the sender's avatar + name above (rooms, first message of a run). */
  showSender: boolean
  /** Hide the avatar slot but keep the alignment (follow-up in a run). */
  sender: { avatarId: string | null; avatarUrl: string | null; presence?: Operator['status'] } | null
  onRetry: (clientId: string) => void
  onDiscard: (clientId: string) => void
}

function Attachment({ message, mine }: { message: StaffMessage; mine: boolean }) {
  const { t } = useTranslation('team')
  if (!message.fileUrl) return null
  if (message.type === 'image') {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-ui">
        <img src={message.fileUrl} alt={message.fileName ?? t('thread.image')} className="max-h-56 w-full max-w-[260px] object-cover" />
      </a>
    )
  }
  return (
    <a
      href={message.fileUrl}
      download={message.fileName ?? undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-ui border px-3 py-2 text-sm no-underline',
        mine ? 'border-ink/20 bg-ink/5 text-on-primary' : 'border-line bg-sunken text-ink',
      )}
    >
      <FileText size={18} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{message.fileName ?? t('thread.file')}</span>
      <Download size={16} strokeWidth={1.75} aria-hidden />
    </a>
  )
}

export function Bubble({ message, mine, showSender, sender, onRetry, onDiscard }: BubbleProps) {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const failed = message.failed
  return (
    <div className={cn('flex items-end gap-2 animate-hop', mine ? 'flex-row-reverse' : 'flex-row')}>
      {!mine ? (
        <div className="w-7 shrink-0 self-end">
          {showSender ? <Avatar name={personName(message.senderName, lang)} avatarId={sender?.avatarId ?? null} avatarUrl={sender?.avatarUrl ?? null} size="sm" /> : null}
        </div>
      ) : null}
      <div className={cn('flex max-w-[82%] flex-col gap-1', mine ? 'items-end' : 'items-start')}>
        {showSender && !mine ? <span className="px-1 text-xs font-medium text-muted">{personName(message.senderName, lang)}</span> : null}
        <div
          className={cn(
            'rounded-bubble px-3.5 py-2 text-sm leading-relaxed',
            mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md border border-line bg-panel text-ink',
            message.pending && 'opacity-70',
            failed && 'border border-danger bg-danger-soft text-ink',
          )}
        >
          {message.type !== 'text' ? <Attachment message={message} mine={mine && !failed} /> : null}
          {message.content && !(message.type === 'file' && message.content === message.fileName) ? (
            <p className={cn('whitespace-pre-wrap break-words', message.type !== 'text' && 'mt-1.5')}>{message.content}</p>
          ) : null}
        </div>
        <div className={cn('flex items-center gap-2 px-1 text-[11px] text-muted tabular', mine && 'flex-row-reverse')}>
          {failed ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium text-danger">
                <AlertCircle size={12} strokeWidth={1.75} aria-hidden />
                {t('thread.notDelivered')}
              </span>
              {message.clientId ? (
                <>
                  <Button variant="link" size="xs" leftIcon={<RotateCcw size={12} />} onClick={() => onRetry(message.clientId as string)}>
                    {t('thread.retry')}
                  </Button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-muted hover:text-ink"
                    onClick={() => onDiscard(message.clientId as string)}
                    aria-label={t('thread.discard')}
                  >
                    <X size={12} strokeWidth={1.75} aria-hidden />
                    {t('thread.discard')}
                  </button>
                </>
              ) : null}
            </>
          ) : message.pending ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} strokeWidth={1.75} aria-hidden />
              {t('thread.sending')}
            </span>
          ) : (
            <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
          )}
        </div>
      </div>
    </div>
  )
}
