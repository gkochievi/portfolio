/**
 * Read-only transcript dialog for any chat of the tenant: header with the
 * customer, channel, times, operator and rating; the messages exactly as the
 * conversation pane draws them; a side column with the handover chain,
 * pre-chat path, custom fields and internal notes. Reused by the operator
 * profile chat list and the admin history.
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, Badge, ErrorState, LoadingBlock, Modal } from '@/components/ui'
import { ChannelBadge, HandoverChain, MessageBubble } from '@/components/chat'
import { formatDateTime, formatDay, formatDuration, formatTime, personName, pickText } from '@/lib/format'
import type { Message } from '@/types'

import { useTranscript } from './api'
import { Stars, EndCategoryBadge, useLang } from './shared'
import { durationSeconds, endCategoryOf } from './stats'

export interface TranscriptDialogProps {
  /** null = closed. */
  sessionId: string | null
  onOpenChange: (open: boolean) => void
}

function dayOf(iso: string): string {
  return new Date(iso).toDateString()
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 truncate text-sm text-ink">{children}</dd>
    </div>
  )
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-ui border border-line bg-panel p-3">
      <h3 className="mb-2 font-display text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

export function TranscriptDialog({ sessionId, onOpenChange }: TranscriptDialogProps) {
  const { t } = useTranslation('adminInsights')
  const { t: tc } = useTranslation()
  const lang = useLang()
  const query = useTranscript(sessionId)
  const data = query.data
  const session = data?.detail.session
  const feedback = data?.feedback ?? data?.detail.feedback ?? null
  const operator = data?.detail.operator ?? null
  const duration = session ? durationSeconds(session) : null
  const messages: Message[] = data?.messages ?? []

  return (
    <Modal
      open={sessionId !== null}
      onOpenChange={onOpenChange}
      size="xl"
      title={session ? session.customerName : t('transcript.title')}
      description={session ? `${session.customerNumber} · ${tc(`topic.${session.topic}`)}` : undefined}
    >
      {query.isLoading ? <LoadingBlock label={tc('states.loading')} /> : null}
      {query.isError ? <ErrorState title={tc('states.error')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} /> : null}
      {session && data ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-ui border border-line bg-sunken p-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label={t('transcript.channel')}>
              <ChannelBadge channel={session.channel} withLabel />
            </Fact>
            <Fact label={t('transcript.started')}>{formatDateTime(session.startedAt, lang)}</Fact>
            <Fact label={t('transcript.ended')}>{session.endedAt ? formatDateTime(session.endedAt, lang) : tc(`sessionStatus.${session.status}`)}</Fact>
            <Fact label={t('transcript.duration')}>
              <span className="tabular">{formatDuration(duration)}</span>
            </Fact>
            <Fact label={t('transcript.operator')}>
              {operator ? (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={personName(operator.name, lang)} avatarId={operator.avatarId ?? undefined} avatarUrl={operator.avatarUrl ?? undefined} size="xs" />
                  <span className="truncate">{personName(operator.name, lang)}</span>
                </span>
              ) : (
                <span className="text-muted">{t('transcript.noOperator')}</span>
              )}
            </Fact>
            <Fact label={t('transcript.outcome')}>
              <EndCategoryBadge category={endCategoryOf(session)} />
            </Fact>
          </dl>

          {session.endSummary || feedback ? (
            <div className="grid gap-3 md:grid-cols-2">
              {session.endSummary ? (
                <div className="rounded-ui border border-line p-3">
                  <p className="text-xs text-muted">{t('transcript.summary')}</p>
                  <p className="mt-1 text-sm text-ink">{session.endSummary}</p>
                </div>
              ) : null}
              {feedback ? (
                <div className="rounded-ui border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted">{t('transcript.rating')}</p>
                    <Stars rating={feedback.rating} />
                  </div>
                  <p className="mt-1 text-sm text-ink">{feedback.comment ?? <span className="text-muted">{t('transcript.noComment')}</span>}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-label={t('transcript.messages')} className="max-h-[56vh] min-h-[200px] overflow-y-auto rounded-ui border border-line bg-sunken p-3 sm:p-4">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">{t('transcript.noMessages')}</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {messages.map((message, index) => {
                    const previous = messages[index - 1]
                    const newDay = !previous || dayOf(previous.timestamp) !== dayOf(message.timestamp)
                    return (
                      <Fragment key={message.id}>
                        {newDay ? (
                          <li className="my-2 flex items-center gap-3 text-xs text-muted" aria-hidden>
                            <span className="h-px flex-1 bg-line" />
                            <span>{formatDay(message.timestamp, lang)}</span>
                            <span className="h-px flex-1 bg-line" />
                          </li>
                        ) : null}
                        <li className="flex flex-col" title={formatTime(message.timestamp)}>
                          <MessageBubble message={message} perspective="staff" showSender />
                        </li>
                      </Fragment>
                    )
                  })}
                </ol>
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-3">
              {data.detail.assignments.length > 0 || session.aiHandoff ? (
                <SideSection title={t('transcript.handover')}>
                  <HandoverChain assignments={data.detail.assignments} handoff={session.aiHandoff} />
                </SideSection>
              ) : null}

              <SideSection title={t('transcript.fields')}>
                {session.customFields.length === 0 ? (
                  <p className="text-sm text-muted">{t('transcript.noFields')}</p>
                ) : (
                  <dl className="flex flex-col gap-2">
                    {session.customFields.map((field) => (
                      <div key={field.fieldId}>
                        <dt className="text-xs text-muted">{pickText(field.label, lang)}</dt>
                        <dd className="break-words text-sm text-ink">{field.value || '-'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {session.clientIp ? (
                  <p className="mt-2 text-xs text-muted">
                    {t('transcript.ip')}: <span className="font-mono">{session.clientIp}</span>
                  </p>
                ) : null}
              </SideSection>

              {session.faqPath.length > 0 ? (
                <SideSection title={t('transcript.prechat')}>
                  <ol className="flex flex-col gap-2">
                    {session.faqPath.map((step, index) => (
                      <li key={`${step.nodeId}-${index}`} className="text-sm">
                        <p className="text-ink">{step.question}</p>
                        <p className="text-muted">{step.answer}</p>
                      </li>
                    ))}
                  </ol>
                </SideSection>
              ) : null}

              <SideSection title={t('transcript.notes')}>
                {data.notes.length === 0 ? (
                  <p className="text-sm text-muted">{t('transcript.noNotes')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.notes.map((note) => (
                      <li key={note.id} className="rounded-ui bg-sunken p-2 text-sm">
                        <p className="break-words text-ink">{note.content}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <Badge size="sm" tone="outline">
                            {tc(`role.${note.authorRole}`)}
                          </Badge>
                          {note.authorName} · {formatDateTime(note.createdAt, lang)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </SideSection>
            </aside>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
