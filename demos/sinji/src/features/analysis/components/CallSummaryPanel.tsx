import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, FileText, ListChecks } from 'lucide-react'

import { ScorePill } from '@/components/brand'
import { Badge, Button, Card, EmptyState, Skeleton, Spinner, StatusChip } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { pillTone } from '@/lib/scoring'
import { useSummaries } from '../api'
import { SummariseButton } from './SummariseButton'
import type { AnalysisPanelProps } from './types'

const sentimentTone = { positive: 'success', neutral: 'neutral', negative: 'danger', mixed: 'warning' } as const

/** The call's structured analysis (summary, topics, key points) and the digests that include it. */
export function CallSummaryPanel({ recording }: AnalysisPanelProps) {
  const { t } = useTranslation('analysis')
  const gloss = useGloss()
  const fmt = useFormat()
  const digests = useSummaries(recording.id)
  const a = recording.analysis
  const running = recording.running.length > 0 && !a
  const hasTranscript = recording.segments.length > 0

  return (
    <div className="space-y-4" data-panel="CallSummaryPanel">
      {a ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">{t('summary.title')}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={sentimentTone[a.sentiment]}>{t(`common:tones.${a.sentiment}`)}</Badge>
              <Badge tone="neutral" shape="tag">
                {t(`summary.language.${a.language}`)}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                {t('summary.quality')} <ScorePill score={a.quality_score} tone={pillTone(a.quality_score)} />
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink/90">{gloss.pick(a.summary, a.summary_en)}</p>
          {a.topics.length > 0 ? (
            <div className="space-y-1.5">
              <p className="caps text-[11px] font-medium text-subtle">{t('summary.topics')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {a.topics.map((topic, i) => (
                  <li key={`${topic}-${i}`}>
                    <Badge tone="primary" shape="tag">
                      {gloss.pick(topic, a.topics_en?.[i])}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.key_points.length > 0 ? (
            <div className="space-y-1.5">
              <p className="caps text-[11px] font-medium text-subtle">{t('summary.keyPoints')}</p>
              <ul className="space-y-2">
                {a.key_points.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink/90">
                    <span className="tabular mt-0.5 font-display text-accent">{i + 1}</span>
                    <span>{gloss.pick(point, a.key_points_en?.[i])}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : running ? (
        <Card className="space-y-3" aria-busy>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner size={16} /> {t('summary.running')}
          </div>
          <Skeleton className="h-16 w-full" />
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<FileText className="size-8 text-subtle" aria-hidden />} title={t('summary.empty.title')} body={t('summary.empty.body')} />
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <ListChecks className="size-4 text-subtle" aria-hidden /> {t('summary.digests.title')}
            </h3>
            <p className="text-xs text-muted">{t('summary.digests.hint')}</p>
          </div>
          <SummariseButton recordingIds={[recording.id]} disabled={!hasTranscript} />
        </div>

        {digests.isPending ? (
          <Skeleton className="h-14 w-full" />
        ) : digests.isError ? (
          <p className="text-sm text-danger">
            {t('summary.digests.error')}{' '}
            <Button size="xs" variant="link" onClick={() => void digests.refetch()}>
              {t('common:actions.retry')}
            </Button>
          </p>
        ) : digests.data.length === 0 ? (
          <p className="text-sm text-muted">{t('summary.digests.none')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {digests.data.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/workspace/summaries/${d.id}`}
                  className="flex items-start justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block truncate font-medium text-ink">{gloss.pick(d.title, d.title_en) || t('summary.digests.untitled')}</span>
                    <span className="block text-xs text-muted">
                      {t('summary.digests.calls', { count: d.job_ids.length })} · {fmt.relative(d.created_at)} · {d.created_by}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {d.status === 'running' ? <StatusChip tone="info" pulse>{t('summary.digests.running')}</StatusChip> : null}
                    {d.status === 'error' ? <StatusChip tone="danger">{t('summary.digests.failed')}</StatusChip> : null}
                    <ArrowUpRight className="size-4 text-subtle" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
