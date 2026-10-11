import { AudioLines, Cable, CircleAlert, Database, Download, KeyRound, Layers, ChartLine, Type, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, EmptyState, Panel, Skeleton, StatTile } from '@/components/ui'
import { formatDuration, formatNumber, formatPercent, formatTokens } from '@/lib/format'
import { useOverview } from '../api'
import { BreakdownTables } from '../components/BreakdownTables'
import { TokenChart } from '../components/TokenChart'
import { WindowLabel } from '../components/parts'
import { useUsageParams } from '../params'

/** Overview: stat tiles, the token chart and the breakdown tables. */
export default function UsageOverviewPage() {
  const { t, i18n } = useTranslation('usage')
  const lang = i18n.language
  const { filters, clearFilters, activeCount } = useUsageParams()
  const query = useOverview(filters)
  const data = query.data

  if (query.isError && !data) {
    return (
      <Callout tone="danger" title={t('error.title')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('error.retry')}</Button>}>
        {t('error.body')}
      </Callout>
    )
  }

  if (!data) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
        <Skeleton className="h-[340px]" />
        <Skeleton className="h-[280px]" />
      </div>
    )
  }

  const tot = data.totals
  const pct = (n: number, d: number) => formatPercent(d ? n / d : 0, lang, { digits: 0 })

  if (tot.calls === 0) {
    return (
      <EmptyState
        title={t('empty.title')}
        body={t('empty.body')}
        action={activeCount > 0 ? <Button onClick={clearFilters}>{t('filters.clear')}</Button> : undefined}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">
        <StatTile label={t('tiles.total')} value={formatTokens(tot.total, lang)} hint={t('tiles.totalHint', { n: formatNumber(tot.total, lang) })} icon={<Layers className="size-4" />} />
        <StatTile label={t('tiles.input')} value={formatTokens(tot.input, lang)} hint={t('tiles.share', { pct: pct(tot.input, tot.total) })} icon={<Upload className="size-4" />} />
        <StatTile label={t('tiles.output')} value={formatTokens(tot.output, lang)} hint={t('tiles.share', { pct: pct(tot.output, tot.total) })} icon={<Download className="size-4" />} />
        <StatTile
          label={t('tiles.cached')}
          value={formatTokens(tot.cache_read, lang)}
          hint={t('tiles.cachedHint', { pct: pct(tot.cache_read, tot.input), written: formatTokens(tot.cache_write, lang) })}
          icon={<Database className="size-4" />}
        />
        <StatTile label={t('tiles.calls')} value={formatNumber(tot.calls, lang)} hint={<WindowLabel from={data.window.from} to={data.window.to} lang={lang} />} icon={<Cable className="size-4" />} />
        <StatTile
          label={t('tiles.failed')}
          value={formatNumber(tot.failed, lang)}
          hint={t('tiles.failedHint', { pct: formatPercent(tot.calls ? tot.failed / tot.calls : 0, lang, { digits: 1 }) })}
          tone={tot.failed > 0 ? 'danger' : undefined}
          icon={<CircleAlert className="size-4" />}
        />
        <StatTile label={t('tiles.audio')} value={formatDuration(tot.audio_seconds, lang)} hint={t('tiles.audioHint')} icon={<AudioLines className="size-4" />} />
        <StatTile label={t('tiles.characters')} value={formatNumber(tot.characters, lang)} hint={t('tiles.charactersHint')} icon={<Type className="size-4" />} />
      </div>

      {data.byo_workspaces.length > 0 ? (
        <Callout tone="info" icon={<KeyRound className="size-4" />} title={t('byo.title')}>
          {t('byo.body', {
            calls: formatNumber(tot.byo_calls, lang),
            tokens: formatTokens(tot.byo_tokens, lang),
            names: data.byo_workspaces.map((w) => (lang === 'ka' ? w.name_ka : w.name)).join(', '),
          })}
        </Callout>
      ) : null}

      <Panel title={t('chart.title')} description={t('chart.description')} icon={<ChartLine className="size-4" />}>
        <TokenChart series={data.series} bucket={data.window.bucket} />
      </Panel>

      <Panel title={t('breakdown.title')} description={t('breakdown.description')}>
        <BreakdownTables data={data.breakdown} loading={query.isFetching} />
      </Panel>
    </div>
  )
}
