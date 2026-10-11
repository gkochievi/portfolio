/**
 * Building blocks for /console/campaigns/:campaignId. Owner: feature group campaigns.
 */
import { Lock, MessageSquareQuote } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Card,
  CardHeader,
  DataTable,
  DescriptionList,
  EmptyState,
  ScorePill,
  Stars,
  type Column,
} from '@/components/ui'
import { DistributionBars, Meter } from '@/components/ui/charts'
import { useLang } from '@/hooks/useLang'
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRating, formatRelative } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { Campaign, QuestionStat, ResponseRow, Tenant } from '@/types'
import type { BranchBreakdown } from '../types'

const ICON = { size: 20, strokeWidth: 1.75 } as const
const JUST_NOW_MS = 10 * 60_000

/* ------------------------------------------------------------ questions */

export function QuestionCard({ stat, index }: { stat: QuestionStat; index: number }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink">{t('detail.questionNumber', { n: index + 1 })}</span>
            <span className="font-mono">#{stat.questionId}</span>
          </p>
          <h3 className="mt-1 text-[15px] font-medium leading-snug text-ink">{lt(stat.text, lang)}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">{t('detail.mean')}</p>
          <p className="tabular font-display text-2xl leading-none text-ink">{formatRating(stat.avg, lang)}</p>
        </div>
      </div>
      <Stars value={stat.avg} size={16} />
      <DistributionBars distribution={stat.distribution} />
      <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="tabular">{t('detail.answered', { count: stat.answered })}</span>
        <span className="tabular">{t('detail.skipped', { count: stat.skipped })}</span>
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------ by branch */

export function BranchTable({ rows }: { rows: BranchBreakdown[] }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const columns: Column<BranchBreakdown>[] = [
    {
      id: 'branch',
      header: t('detail.colBranch'),
      cell: (row) => <span className="font-medium text-ink">{lt(row.name, lang)}</span>,
      sortValue: (row) => lt(row.name, lang),
    },
    {
      id: 'sent',
      header: t('detail.colSent'),
      align: 'right',
      cell: (row) => <span className="tabular">{formatNumber(row.sent, lang)}</span>,
      sortValue: (row) => row.sent,
    },
    {
      id: 'completed',
      header: t('detail.colCompleted'),
      align: 'right',
      cell: (row) => <span className="tabular">{formatNumber(row.completed, lang)}</span>,
      sortValue: (row) => row.completed,
    },
    {
      id: 'rate',
      header: t('detail.colRate'),
      align: 'right',
      hideBelow: 'sm',
      width: '110px',
      cell: (row) => {
        const rate = row.sent ? (row.completed / row.sent) * 100 : null
        return (
          <div className="ml-auto w-20">
            <span className="tabular">{formatPercent(rate, lang)}</span>
            <Meter value={rate} tone="accent" className="mt-1" />
          </div>
        )
      },
      sortValue: (row) => (row.sent ? row.completed / row.sent : null),
    },
    {
      id: 'avg',
      header: t('detail.colAvg'),
      align: 'right',
      cell: (row) =>
        row.avgRating === null ? (
          <span className="text-subtle">—</span>
        ) : (
          <span className="inline-flex items-center justify-end gap-1.5">
            <span className="tabular font-medium text-ink">{formatRating(row.avgRating, lang)}</span>
            <Stars value={row.avgRating} size={12} className="hidden sm:inline-flex" />
          </span>
        ),
      sortValue: (row) => row.avgRating,
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.branchId}
      defaultSort={{ id: 'sent', dir: 'desc' }}
      empty={{ title: t('detail.noBranches') }}
      caption={t('detail.byBranchTitle')}
    />
  )
}

/* ------------------------------------------------------------- comments */

export function CommentList({ rows }: { rows: ResponseRow[] }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  if (!rows.length) {
    return (
      <EmptyState
        compact
        illustration={null}
        icon={<MessageSquareQuote {...ICON} />}
        title={t('detail.noComments')}
        description={t('detail.noCommentsHint')}
      />
    )
  }
  const now = Date.now()
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const fresh = row.source === 'session' && now - new Date(row.submittedAt).getTime() < JUST_NOW_MS
        return (
          <li key={row.id} className={fresh ? 'animate-flash py-3' : 'py-3'}>
            <div className="flex flex-wrap items-center gap-2">
              <ScorePill value={row.avgRating} showLabel={false} />
              {fresh && (
                <Badge tone="accent" dot>
                  {t('common:status.justNow')}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted" title={formatDateTime(row.submittedAt, lang)}>
                {formatRelative(row.submittedAt, lang)}
              </span>
            </div>
            <p lang={row.commentLang} className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">
              {row.comment}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t('detail.commentMeta', { branch: lt(row.branchName, lang), staff: lt(row.staffName, lang) })}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------- settings panel */

export function SettingsPanel({ campaign, tenant, questions }: { campaign: Campaign; tenant: Tenant; questions: QuestionStat[] }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  return (
    <Card>
      <CardHeader
        icon={<Lock {...ICON} />}
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <Badge tone="info" icon={<Lock size={12} strokeWidth={1.75} />}>
            {t('settings.managed')}
          </Badge>
        }
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted">{t('settings.questions')}</h3>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={q.questionId} className="flex items-start gap-3 rounded-xl bg-panel-2 px-3 py-2.5">
                <span className="tabular mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1 text-[15px] text-ink">{lt(q.text, lang)}</span>
                <Badge mono variant="outline" className="shrink-0">
                  {t('settings.questionId', { id: q.questionId })}
                </Badge>
              </li>
            ))}
          </ol>
        </div>
        <DescriptionList
          items={[
            { label: t('settings.ttl'), value: t('common:units.days', { count: campaign.linkTtlDays }) },
            { label: t('settings.sender'), value: tenant.smsSender, mono: true },
            { label: t('settings.touchpoint'), value: lt(campaign.touchpoint, lang) },
            { label: t('settings.created'), value: formatDate(campaign.createdAt, lang) },
            { label: t('settings.campaignId'), value: campaign.id, mono: true },
          ]}
        />
      </div>
    </Card>
  )
}
