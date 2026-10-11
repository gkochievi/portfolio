import { useState } from 'react'
import { Check, Copy, FileText, History, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar } from '@/components/Avatar'
import { Badge, ErrorState, IconButton, Skeleton, toast } from '@/components/ui'
import { TranscriptDialog } from '@/features/admin-insights/TranscriptDialog'
import { useAccount } from '@/lib/account'
import { formatRelative, formatSmartDate, hueFromString, pickText } from '@/lib/format'

import { useSessionContext } from '../api'
import { NotesPanel } from './NotesPanel'
import { ChannelTag, SectionLabel, copyText } from './shared'

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation('operatorTools')
  const [done, setDone] = useState(false)
  return (
    <IconButton
      size="xs"
      variant="muted"
      label={done ? t('customer.copied') : label}
      icon={done ? <Check /> : <Copy />}
      onClick={() => {
        void copyText(value).then((ok) => {
          if (!ok) return toast.error(t('customer.copyFailed'))
          setDone(true)
          window.setTimeout(() => setDone(false), 1_500)
        })
      }}
    />
  )
}

export function CustomerTab({ sessionId }: { sessionId: string }) {
  const { t, i18n } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const account = useAccount()
  const context = useSessionContext(sessionId)
  const [transcriptId, setTranscriptId] = useState<string | null>(null)

  if (context.isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }
  if (context.isError || !context.data) {
    return <ErrorState title={t('customer.loadError')} onRetry={() => void context.refetch()} retryLabel={tc('actions.retry')} />
  }

  const data = context.data
  const contact = data.externalContact
  const displayName = contact?.displayName ?? data.customer.name
  const canWriteNotes = account?.role === 'operator' || account?.role === 'admin'

  return (
    <div className="space-y-4 p-4">
      <section aria-label={t('customer.contact')} className="flex items-start gap-3">
        <Avatar name={displayName} avatarId={contact?.avatarId ?? null} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink">{displayName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <ChannelTag channel={data.customer.channel} />
            {contact?.username ? <span className="font-mono text-xs text-muted">{contact.username}</span> : null}
            {contact?.locale ? (
              <Badge tone="muted" size="sm">
                {t('customer.locale')}: {contact.locale}
              </Badge>
            ) : null}
          </div>
          {data.lastInboundAt ? (
            <p className="mt-1 text-xs text-muted">
              {t('customer.lastInbound')}: <span className="text-ink">{formatRelative(data.lastInboundAt, i18n.language)}</span>
            </p>
          ) : null}
        </div>
      </section>

      {data.clientIpEnabled && data.clientIp ? (
        <div className="flex items-center justify-between gap-2 rounded-ui border border-line bg-sunken px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <MapPin size={14} strokeWidth={1.75} aria-hidden />
            {t('customer.ip')}
          </span>
          <span className="flex items-center gap-1">
            <code className="font-mono text-xs text-ink">{data.clientIp}</code>
            <CopyButton value={data.clientIp} label={tc('actions.copy')} />
          </span>
        </div>
      ) : null}

      <section aria-label={t('customer.fields')}>
        <SectionLabel>{t('customer.fields')}</SectionLabel>
        {data.fields.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t('customer.noFields')}</p>
        ) : (
          <dl className="divide-y divide-line rounded-ui border border-line bg-panel">
            {data.fields.map((field) => (
              <div key={field.fieldId} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0">
                  <dt className="text-[11.5px] text-muted">{pickText(field.label, i18n.language)}</dt>
                  <dd className="break-words text-[13px] text-ink">{field.value}</dd>
                </div>
                <CopyButton value={field.value} label={tc('actions.copy')} />
              </div>
            ))}
          </dl>
        )}
      </section>

      {data.faqPath.length > 0 ? (
        <section aria-label={t('customer.faq')}>
          <SectionLabel>{t('customer.faq')}</SectionLabel>
          <ol className="space-y-1.5 border-l border-dashed border-line-strong pl-3">
            {data.faqPath.map((step, index) => (
              <li key={`${step.nodeId}-${index}`} className="text-[12.5px] leading-snug">
                <p className="font-medium text-ink">{step.question}</p>
                {step.answer ? <p className="mt-0.5 line-clamp-2 text-muted">{step.answer}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-label={t('customer.previous')}>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <History size={14} strokeWidth={1.75} aria-hidden />
            {t('customer.previous')}
          </span>
        </SectionLabel>
        {data.groupBy ? (
          <p className="mb-2 text-xs text-muted">
            {t('customer.sameField', { field: pickText(data.groupBy.label, i18n.language) })}: <span className="font-mono text-ink">{data.groupBy.value}</span>
          </p>
        ) : null}
        {data.previousChats.length === 0 ? (
          <p className="text-[12.5px] text-muted">{t('customer.noPrevious')}</p>
        ) : (
          <ul className="space-y-2">
            {data.previousChats.map((chat) => {
              const hue = chat.operator ? hueFromString(chat.operator.id) : null
              return (
                <li key={chat.id} className="rounded-ui border border-line bg-panel p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="tabular">{formatSmartDate(chat.startedAt, i18n.language)}</span>
                    <ChannelTag channel={chat.channel} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink">{chat.endSummary ?? chat.lastMessage?.text ?? t('customer.noPreview')}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: hue === null ? 'var(--c-line-strong, #B8B09A)' : `hsl(${hue} 48% 46%)` }}
                      />
                      <span className="truncate">{chat.operator ? chat.operator.nickname : t('customer.noOperator')}</span>
                    </span>
                    <button
                      type="button"
                      className="link inline-flex items-center gap-1 text-xs"
                      onClick={() => setTranscriptId(chat.id)}
                    >
                      <FileText size={13} strokeWidth={1.75} aria-hidden />
                      {t('customer.openTranscript')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {data.notesEnabled ? <NotesPanel sessionId={sessionId} canWrite={canWriteNotes} /> : null}

      <TranscriptDialog sessionId={transcriptId} onOpenChange={(open) => !open && setTranscriptId(null)} />
    </div>
  )
}
