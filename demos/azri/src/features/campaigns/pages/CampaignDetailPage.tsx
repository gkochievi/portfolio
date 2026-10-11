/**
 * Campaign (/console/campaigns/:campaignId): KPIs, trend, per-question stats,
 * by-branch table, latest comments and the read-only survey settings.
 * Admin only (route guard + handler). Owner: feature group campaigns.
 */
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Section,
  Skeleton,
  StatTile,
  TenantMark,
  Tooltip,
} from '@/components/ui'
import { DistributionBars, Meter, TrendChart, TrendLegend } from '@/components/ui/charts'
import { useLang } from '@/hooks/useLang'
import { ApiError } from '@/lib/api'
import { formatDate, formatNumber, formatPercent, formatRating } from '@/lib/format'
import { lt } from '@/lib/utils'
import { useCampaignDetail } from '../api'
import { BranchTable, CommentList, QuestionCard, SettingsPanel } from '../components/DetailParts'
import { readWindow, useParamState, WindowControl } from '../components/shared'

const ICON = { size: 16, strokeWidth: 1.75 } as const

export default function CampaignDetailPage() {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const navigate = useNavigate()
  const { campaignId = '' } = useParams()
  const [params, setParams] = useParamState()
  const days = readWindow(params)
  const query = useCampaignDetail(campaignId, Number(days))

  if (query.isPending) return <DetailSkeleton />

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          framed
          illustration="not-found"
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundDescription')}
          action={
            <Button asChild variant="primary" leftIcon={<ArrowLeft {...ICON} />}>
              <Link to="/console/campaigns">{t('detail.backToList')}</Link>
            </Button>
          }
        />
      )
    }
    return <ErrorState description={t('common:errors.loadFailed')} onRetry={() => void query.refetch()} />
  }

  const { campaign, tenant, kpis, trend, distribution, questions, byBranch, latestComments, sampleLinkId } = query.data
  const otherLang = lang === 'ka' ? 'en' : 'ka'
  const hasRatings = distribution.some((n) => n > 0)

  const sampleButton = (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<ExternalLink {...ICON} />}
      disabled={!sampleLinkId}
      onClick={() => sampleLinkId && navigate(`/?id=${encodeURIComponent(sampleLinkId)}`)}
    >
      {t('detail.sampleLink')}
    </Button>
  )

  return (
    <div className={query.isPlaceholderData ? 'space-y-8 opacity-70 transition-opacity' : 'space-y-8 transition-opacity'}>
      {/* Header */}
      <header className="space-y-4">
        <Link
          to="/console/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <ArrowLeft {...ICON} aria-hidden />
          {t('detail.back')}
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="lg" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted">
                {lt(tenant.name, lang)} · {lt(campaign.touchpoint, lang)}
              </p>
              <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">{lt(campaign.title, lang)}</h1>
              <p className="max-w-2xl text-[15px] text-ink/85">{lt(campaign.description, lang)}</p>
              <div lang={otherLang} className="max-w-2xl border-l-2 border-border pl-3 text-sm text-muted">
                <span className="mr-2 text-xs">{t('detail.inOtherLang')}</span>
                <span className="font-medium">{campaign.title[otherLang]}</span>
                <span className="block">{campaign.description[otherLang]}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge icon={<CalendarDays size={12} strokeWidth={1.75} />}>
                  {t('detail.created', { date: formatDate(campaign.createdAt, lang) })}
                </Badge>
                <Badge icon={<Clock3 size={12} strokeWidth={1.75} />}>
                  {t('detail.ttl', { count: campaign.linkTtlDays })}
                </Badge>
                <Badge mono variant="outline">
                  {tenant.smsSender}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <WindowControl value={days} onChange={(value) => setParams({ days: value === '30' ? null : value })} />
            <Tooltip content={sampleLinkId ? t('detail.sampleLinkHint') : t('detail.sampleLinkNone')}>
              {sampleLinkId ? sampleButton : <span tabIndex={0}>{sampleButton}</span>}
            </Tooltip>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('common:kpi.sent')}
          value={formatNumber(kpis.sent, lang)}
          hint={t('detail.kpiSentHint', {
            completed: formatNumber(kpis.completed, lang),
            expired: formatNumber(kpis.expired, lang),
            pending: formatNumber(kpis.pending, lang),
          })}
        />
        <StatTile
          label={t('common:kpi.responseRate')}
          value={formatPercent(kpis.responseRate, lang)}
          hint={t('common:kpi.responseRateHint')}
          chart={<Meter value={kpis.responseRate} tone="accent" />}
        />
        <StatTile
          label={t('common:kpi.avgRating')}
          value={hasRatings ? formatRating(kpis.avgRating, lang) : '—'}
          unit={hasRatings ? '/ 5' : undefined}
        />
        <StatTile
          label={t('common:kpi.csat')}
          value={hasRatings ? formatPercent(kpis.csat, lang) : '—'}
          hint={t('common:kpi.csatHint')}
        />
      </div>

      {/* Trend + distribution */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <Card>
          <CardHeader title={t('detail.trendTitle')} description={t('detail.trendDescription')} actions={<TrendLegend />} />
          <TrendChart data={trend} className="mt-4" />
        </Card>
        <Card>
          <CardHeader title={t('detail.distributionTitle')} description={t('detail.distributionDescription')} />
          <div className="mt-4">
            {hasRatings ? (
              <DistributionBars distribution={distribution} />
            ) : (
              <p className="text-sm text-muted">{t('common:empty.noData')}</p>
            )}
          </div>
        </Card>
      </div>

      {/* Questions */}
      <Section title={t('detail.questionsTitle')} description={t('detail.questionsDescription')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {questions.map((stat, i) => (
            <QuestionCard key={stat.questionId} stat={stat} index={i} />
          ))}
        </div>
      </Section>

      {/* Branches + comments */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title={t('detail.byBranchTitle')} description={t('detail.byBranchDescription')} />
          <div className="mt-4">
            <BranchTable rows={byBranch} />
          </div>
        </Card>
        <Card>
          <CardHeader
            icon={<MessageSquareText size={20} strokeWidth={1.75} />}
            title={t('detail.commentsTitle')}
            description={t('detail.commentsDescription')}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to={`/console/responses?campaignId=${encodeURIComponent(campaign.id)}&tenantId=${encodeURIComponent(tenant.id)}`}>
                  {t('detail.allResponses')}
                </Link>
              </Button>
            }
          />
          <div className="mt-2">
            <CommentList rows={latestComments} />
          </div>
        </Card>
      </div>

      <SettingsPanel campaign={campaign} tenant={tenant} questions={questions} />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
