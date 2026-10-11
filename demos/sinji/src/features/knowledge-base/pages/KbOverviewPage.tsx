import { AlertTriangle, BookOpen, Boxes, Clock, FileText, Globe2, Hash, Layers, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { Button, Callout, EmptyState, Meter, Panel, Skeleton, StatTile } from '@/components/ui'
import { errorMessage } from '@/api/client'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import { useKbStats } from '../api'
import { KB_DOC_TYPES } from '../types'

/** KB stats: tiles, doc-type breakdown, coverage, refresh. OWNED BY: knowledge-base. */
export default function KbOverviewPage() {
  const { t } = useTranslation('kb')
  const fmt = useFormat()
  const navigate = useNavigate()
  const canEdit = useCanEdit()
  const stats = useKbStats()
  const data = stats.data

  const refresh = (
    <Button variant="secondary" size="sm" icon={<RefreshCw className={stats.isFetching ? 'animate-spin' : undefined} />} onClick={() => void stats.refetch()} disabled={stats.isFetching}>
      {t('actions.refresh')}
    </Button>
  )

  if (stats.isError) {
    return (
      <Callout tone="danger" title={t('overview.loadFailed')} action={<Button size="sm" onClick={() => void stats.refetch()}>{t('actions.retry')}</Button>}>
        {errorMessage(stats.error)}
      </Callout>
    )
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[108px]" />
        ))}
      </div>
    )
  }

  if (data.documents === 0) {
    return (
      <EmptyState
        title={t('overview.emptyTitle')}
        body={t('overview.emptyBody')}
        action={
          canEdit ? (
            <Button asChild variant="primary" icon={<Upload />}>
              <Link to="/workspace/kb/import">{t('overview.importFirst')}</Link>
            </Button>
          ) : undefined
        }
      />
    )
  }

  const maxType = Math.max(1, ...KB_DOC_TYPES.map((k) => data.by_type[k] ?? 0))
  const coverageTone = data.embedding_coverage >= 99.5 ? 'success' : data.embedding_coverage >= 80 ? 'warning' : 'danger'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{data.in_progress > 0 ? t('overview.updating', { count: data.in_progress }) : t('overview.upToDate')}</p>
        {refresh}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('overview.documents')} value={fmt.number(data.documents)} icon={<FileText />} onClick={() => navigate('/workspace/kb/documents')} />
        <StatTile label={t('overview.publicDocuments')} value={fmt.number(data.public_documents)} hint={t('overview.publicHint')} icon={<Globe2 />} onClick={() => navigate('/workspace/kb/documents?visibility=public')} />
        <StatTile label={t('overview.chunks')} value={fmt.number(data.chunks)} icon={<Boxes />} onClick={() => navigate('/workspace/kb/chunks')} />
        <StatTile label={t('overview.coverage')} value={fmt.percent(data.embedding_coverage, { ratio: false, digits: 1 })} hint={t('overview.coverageHint')} icon={<Layers />} tone={coverageTone} />
        <StatTile
          label={t('overview.failed')}
          value={fmt.number(data.failed)}
          icon={<AlertTriangle />}
          tone={data.failed > 0 ? 'danger' : undefined}
          onClick={data.failed > 0 ? () => navigate('/workspace/kb/documents?status=error') : undefined}
        />
        <StatTile
          label={t('overview.inProgress')}
          value={fmt.number(data.in_progress)}
          icon={<Loader2 className={data.in_progress > 0 ? 'animate-spin' : undefined} />}
          tone={data.in_progress > 0 ? 'info' : undefined}
          onClick={data.in_progress > 0 ? () => navigate('/workspace/kb/documents?status=in_progress') : undefined}
        />
        <StatTile label={t('overview.tokens')} value={fmt.tokens(data.approx_tokens)} hint={t('overview.tokensHint')} icon={<Hash />} />
        <StatTile label={t('overview.lastUpdated')} value={data.last_updated ? fmt.relative(data.last_updated) : '-'} hint={data.last_updated ? fmt.dateTime(data.last_updated) : undefined} icon={<Clock />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Panel title={t('overview.byType')} description={t('overview.byTypeHint')} icon={<BookOpen />}>
          <ul className="flex flex-col gap-3">
            {KB_DOC_TYPES.map((type) => {
              const count = data.by_type[type] ?? 0
              return (
                <li key={type}>
                  <Link
                    to={`/workspace/kb/documents?doc_type=${type}`}
                    className="group grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3rem]"
                  >
                    <span className="truncate text-ink group-hover:text-primary">{t(`docTypes.${type}`)}</span>
                    <span className="h-2 overflow-hidden rounded-pill bg-sunken" aria-hidden>
                      <span className="block h-full rounded-pill bg-primary/70 transition-[width]" style={{ width: `${(count / maxType) * 100}%` }} />
                    </span>
                    <span className="tabular text-right text-muted">{fmt.number(count)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title={t('overview.health')} description={t('overview.healthHint')}>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-muted">{t('overview.coverage')}</span>
                <span className="tabular font-display text-xl">{fmt.percent(data.embedding_coverage, { ratio: false, digits: 1 })}</span>
              </div>
              <Meter value={data.embedding_coverage} />
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-muted">{t('overview.publicShare')}</span>
                <span className="tabular font-display text-xl">{fmt.number(data.public_documents)} / {fmt.number(data.documents)}</span>
              </div>
              <Meter value={(data.public_documents / Math.max(1, data.documents)) * 100} tone="primary" />
            </div>
            {data.public_documents === 0 ? <Callout tone="warning">{t('overview.noPublic')}</Callout> : null}
          </div>
        </Panel>
      </div>
    </div>
  )
}
