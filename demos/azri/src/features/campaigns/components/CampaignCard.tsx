/**
 * One campaign on /console/campaigns. Owner: feature group campaigns.
 */
import { ChevronRight, Clock3, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, Stars, TenantMark } from '@/components/ui'
import { Meter, Sparkline } from '@/components/ui/charts'
import { useLang } from '@/hooks/useLang'
import { formatNumber, formatPercent, formatRating } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { CampaignSummary } from '../types'

const ICON = { size: 16, strokeWidth: 1.75 } as const

export function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const { t } = useTranslation('campaigns')
  const lang = useLang()
  const { campaign, tenant, kpis, trend, questionCount } = summary
  const hasRatings = kpis.avgRating > 0
  const sparkTotal = trend.reduce((sum, p) => sum + p.responses, 0)

  return (
    <Link
      to={`/console/campaigns/${campaign.id}`}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`${t('list.open')}: ${lt(campaign.title, lang)}`}
    >
      <Card interactive className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <TenantMark
            monogram={tenant.monogram}
            primary={tenant.primary}
            onPrimary={tenant.onPrimary}
            size="md"
            title={lt(tenant.name, lang)}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{lt(campaign.touchpoint, lang)}</p>
            <h3 className="font-display text-lg leading-snug text-ink">{lt(campaign.title, lang)}</h3>
          </div>
          <ChevronRight
            {...ICON}
            size={20}
            className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks {...ICON} aria-hidden />
            {t('common:units.questions', { count: questionCount })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 {...ICON} aria-hidden />
            {t('list.ttl', { count: campaign.linkTtlDays })}
          </span>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-panel-2 p-3 text-center">
          {(
            [
              ['sent', kpis.sent, 'text-ink'],
              ['completed', kpis.completed, 'text-success'],
              ['expired', kpis.expired, 'text-muted'],
            ] as const
          ).map(([key, value, tone]) => (
            <div key={key}>
              <dt className="text-xs text-muted">{t(`common:kpi.${key}`)}</dt>
              <dd className={`tabular text-lg font-semibold ${tone}`}>{formatNumber(value, lang)}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t('list.responseRate')}</p>
            <p className="tabular text-base font-semibold text-ink">{formatPercent(kpis.responseRate, lang)}</p>
            <Meter value={kpis.responseRate} tone="accent" label={t('list.responseRate')} className="mt-1.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">{t('list.average')}</p>
            {hasRatings ? (
              <div className="flex items-center gap-2">
                <span className="tabular text-base font-semibold text-ink">{formatRating(kpis.avgRating, lang)}</span>
                <Stars value={kpis.avgRating} size={13} />
              </div>
            ) : (
              <p className="text-sm text-subtle">{t('list.noResponses')}</p>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <p className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{t('list.spark')}</span>
            <span className="tabular">{formatNumber(sparkTotal, lang)}</span>
          </p>
          <Sparkline values={trend.map((p) => p.responses)} height={40} label={t('list.spark')} />
        </div>
      </Card>
    </Link>
  )
}
