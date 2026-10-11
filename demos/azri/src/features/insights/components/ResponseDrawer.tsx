import { MessageSquareOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  BubbleCard,
  Button,
  DescriptionList,
  Drawer,
  ErrorState,
  ScorePill,
  Skeleton,
  SkeletonText,
  Stars,
} from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { isApiError } from '@/api/client'
import { formatDateTime, formatRating } from '@/lib/format'
import { lt } from '@/lib/utils'
import { useResponseDetail } from '../api'
import { isJustNow, JustNowBadge, LangTag, TenantMarkFor } from './shared'

interface Props {
  responseId: string | null
  onClose: () => void
}

/** Right sheet with one response: every question, the comment verbatim, masked phone and link times. */
export function ResponseDrawer({ responseId, onClose }: Props) {
  const { t } = useTranslation('insights')
  const lang = useLang()
  const detail = useResponseDetail(responseId)
  const data = detail.data

  const notFound = isApiError(detail.error) && detail.error.status === 404

  return (
    <Drawer
      open={Boolean(responseId)}
      onOpenChange={(open) => !open && onClose()}
      width="md"
      eyebrow={
        data ? (
          <div className="flex items-center gap-2">
            <TenantMarkFor tenantId={data.tenantId} size="xs" />
            <span className="text-sm text-muted">{lt(data.tenantName, lang)}</span>
            {isJustNow(data) && <JustNowBadge />}
          </div>
        ) : undefined
      }
      title={data ? lt(data.campaignTitle, lang) : t('detail.title')}
      description={
        data ? `${lt(data.branchName, lang)} · ${lt(data.staffName, lang)}` : undefined
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
      }
    >
      {detail.isLoading && (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-8 w-40" />
          <SkeletonText lines={5} />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {detail.isError && (
        <ErrorState
          title={notFound ? t('detail.notFound') : undefined}
          description={notFound ? t('detail.notFoundHint') : undefined}
          onRetry={notFound ? undefined : () => void detail.refetch()}
          compact
        />
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <ScorePill value={data.avgRating} showLabel />
            <span className="text-sm text-muted">
              {t('detail.answered', { answered: data.answeredCount, total: data.questionCount })}
            </span>
          </div>

          <section aria-labelledby="insights-detail-questions">
            <h3 id="insights-detail-questions" className="mb-2 text-sm font-semibold text-ink">
              {t('detail.questions')}
            </h3>
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {data.answers.map((answer, index) => (
                <li key={answer.questionId} className="flex items-start gap-3 bg-panel px-3 py-2.5">
                  <span className="tabular mt-0.5 w-5 shrink-0 text-xs text-subtle">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-sm text-ink">{lt(answer.text, lang)}</span>
                  {answer.rate == null ? (
                    <Badge tone="neutral" variant="outline" size="sm">
                      {t('common:rating.skipped')}
                    </Badge>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Stars value={answer.rate} size={14} className="text-primary" />
                      <span className="tabular text-xs font-medium text-muted">{answer.rate}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="insights-detail-comment">
            <div className="mb-2 flex items-center gap-2">
              <h3 id="insights-detail-comment" className="text-sm font-semibold text-ink">
                {t('detail.comment')}
              </h3>
              {data.comment.trim() && <LangTag lang={data.commentLang} />}
            </div>
            {data.comment.trim() ? (
              <BubbleCard tone="tint" padding="md">
                <p lang={data.commentLang} className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {data.comment}
                </p>
              </BubbleCard>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <MessageSquareOff size={16} strokeWidth={1.75} aria-hidden />
                {t('detail.noComment')}
              </p>
            )}
          </section>

          <section aria-labelledby="insights-detail-link">
            <h3 id="insights-detail-link" className="mb-2 text-sm font-semibold text-ink">
              {t('detail.link')}
            </h3>
            <DescriptionList
              items={[
                ...(data.recipientName
                  ? [{ label: t('detail.recipient'), value: lt(data.recipientName, lang) }]
                  : []),
                { label: t('detail.phone'), value: data.phoneMasked || '—', mono: true },
                { label: t('detail.token'), value: data.surveyId, mono: true },
                { label: t('detail.interactionAt'), value: formatDateTime(data.link.interactionAt, lang) },
                { label: t('detail.sentAt'), value: formatDateTime(data.link.sentAt, lang) },
                { label: t('detail.expiresAt'), value: formatDateTime(data.link.expiresAt, lang) },
                { label: t('detail.answeredAt'), value: formatDateTime(data.submittedAt, lang) },
                {
                  label: t('detail.source'),
                  value: t(`source.${data.source}`),
                },
                { label: t('detail.average'), value: formatRating(data.avgRating, lang) },
              ]}
            />
          </section>
        </div>
      )}
    </Drawer>
  )
}
