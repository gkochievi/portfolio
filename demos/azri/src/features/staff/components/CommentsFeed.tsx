import { MessageSquareText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clock } from '@/demo/core'
import {
  Badge,
  BubbleCard,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LiveDot,
  Pagination,
  ScorePill,
  SkeletonText,
  Switch,
} from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { formatRelative } from '@/lib/format'
import { cn, lt } from '@/lib/utils'
import type { ResponseRow } from '@/types'
import { useMyResponses } from '../api'

const JUST_NOW_MS = 10 * 60_000

/** A response submitted in this session within the last 10 minutes. */
export function isJustNow(row: Pick<ResponseRow, 'source' | 'submittedAt'>): boolean {
  return row.source === 'session' && clock.now().getTime() - new Date(row.submittedAt).getTime() < JUST_NOW_MS
}

export function CommentsFeed() {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const [page, setPage] = useState(1)
  const [withComment, setWithComment] = useState(true)
  const query = useMyResponses(page, withComment)

  // Flash rows that arrive after the first load (live answers).
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const items = query.data?.items
    if (!items) return
    if (!seen.current) {
      seen.current = new Set(items.map((r) => r.id))
      return
    }
    const added = items.filter((r) => !seen.current!.has(r.id)).map((r) => r.id)
    for (const id of added) seen.current.add(id)
    if (added.length) setFresh(new Set(added))
  }, [query.data])

  const data = query.data
  return (
    <Card padding="lg">
      <CardHeader
        icon={<MessageSquareText strokeWidth={1.75} />}
        title={t('scores.comments.title')}
        description={t('scores.comments.description')}
        actions={
          <Switch
            checked={withComment}
            onCheckedChange={(v) => {
              setWithComment(v)
              setPage(1)
            }}
            label={t('scores.comments.onlyWithComment')}
          />
        }
      />
      {query.isError ? (
        <ErrorState compact onRetry={() => void query.refetch()} />
      ) : !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonText key={i} lines={2} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          compact
          illustration="empty"
          title={t('scores.comments.emptyTitle')}
          description={t('scores.comments.emptyDescription')}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((row) => {
              const justNow = isJustNow(row)
              return (
                <li key={row.id}>
                  <BubbleCard
                    tone={justNow ? 'tint' : 'sunken'}
                    padding="md"
                    className={cn(fresh.has(row.id) && 'animate-flash')}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ScorePill value={row.avgRating} size="sm" />
                      {justNow && (
                        <Badge tone="accent" size="sm" icon={<LiveDot tone="accent" />}>
                          {t('common:status.justNow')}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted tabular">
                        {formatRelative(row.submittedAt, lang, clock.now())}
                      </span>
                    </div>
                    {row.comment ? (
                      <p lang={row.commentLang} className="mt-2 whitespace-pre-line break-words text-ink">
                        {row.comment}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm italic text-muted">{t('scores.comments.noComment')}</p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{lt(row.campaignTitle, lang)}</span>
                      <span className="font-mono">{row.phoneMasked}</span>
                      <span>{t('scores.comments.answered', { answered: row.answeredCount, total: row.questionCount })}</span>
                    </p>
                  </BubbleCard>
                </li>
              )
            })}
          </ul>
          {data.total > data.pageSize && (
            <div className="mt-4">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
