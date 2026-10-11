import { ArrowLeft, ExternalLink, Layers } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { actAs } from '@/components/shell/actions'
import { Badge, Button, Callout, Card, EmptyState, KeyValue, PageHeader, Panel, ProgressBar, Skeleton, StatTile, toast } from '@/components/ui'
import { formatDateTime, formatDuration, formatNumber, formatTokens } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import { isApiError } from '@/api/client'
import { useRecording } from '../api'
import { CallsTable, useLabels } from '../components/parts'

/** One recording's AI usage: totals, per-analyser cards, every call, and the digests that include it. */
export default function UsageRecordingDetailPage() {
  const { recordingId = '' } = useParams()
  const L = useLabels()
  const { t, lang } = L
  const gloss = useGloss()
  const navigate = useNavigate()
  const state = useLocation().state as { search?: string } | null
  const back = `/usage/recordings${state?.search ?? ''}`
  const query = useRecording(recordingId)
  const data = query.data

  const backLink = (
    <Link to={back} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
      {t('recording.back')}
    </Link>
  )

  if (query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404
    return (
      <div>
        {backLink}
        <div className="mt-6">
          <EmptyState title={missing ? t('recording.notFound') : t('error.title')} body={missing ? t('recording.notFoundBody') : t('error.body')} action={<Button asChild><Link to={back}>{t('recording.back')}</Link></Button>} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        {backLink}
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px]" />)}</div>
        <Skeleton className="h-[260px]" />
      </div>
    )
  }

  const { recording: rec, totals } = data
  const workspace = L.workspace(rec)

  const openCall = () => {
    if (!rec.client_id) return
    actAs(rec.client_id)
    toast.success(t('recording.openedAs', { name: workspace }))
    navigate(`/workspace/calls/${rec.id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={backLink}
        title={rec.filename}
        description={t('recording.description')}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{workspace}</Badge>
            <Badge tone="neutral">{rec.created_by}</Badge>
            {rec.language ? <Badge tone="neutral">{rec.language.toUpperCase()}</Badge> : null}
          </div>
        }
        actions={
          rec.client_id ? (
            <Button variant="secondary" icon={<ExternalLink className="size-4" />} onClick={openCall}>
              {t('recording.openCall')}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('tiles.total')} value={formatTokens(totals.total, lang)} hint={t('tiles.totalHint', { n: formatNumber(totals.total, lang) })} />
        <StatTile label={t('tiles.input')} value={formatTokens(totals.input, lang)} hint={t('tiles.cachedShort', { n: formatTokens(totals.cache_read, lang) })} />
        <StatTile label={t('tiles.output')} value={formatTokens(totals.output, lang)} />
        <StatTile
          label={t('tiles.calls')}
          value={formatNumber(totals.calls, lang)}
          hint={totals.failed ? t('recording.failedHint', { n: totals.failed }) : t('recording.allOk')}
          tone={totals.failed ? 'danger' : undefined}
        />
      </div>

      <Panel title={t('recording.details')} flush={false}>
        <KeyValue
          columns={3}
          items={[
            { label: t('recording.fields.workspace'), value: workspace },
            { label: t('recording.fields.uploaded'), value: formatDateTime(rec.created_at, lang) },
            { label: t('recording.fields.duration'), value: rec.duration_s ? formatDuration(rec.duration_s, lang) : '-' },
            { label: t('recording.fields.status'), value: rec.status },
            { label: t('recording.fields.audio'), value: formatDuration(totals.audio_seconds, lang) },
            { label: t('recording.fields.id'), value: rec.id, mono: true },
          ]}
        />
      </Panel>

      <section aria-labelledby="usage-groups">
        <h2 id="usage-groups" className="mb-3 text-[15px] font-semibold">{t('recording.groups')}</h2>
        {data.groups.length === 0 ? (
          <EmptyState compact title={t('recording.noCalls')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.groups.map((g) => (
              <Card key={g.group} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-muted">{L.group(g.group)}</div>
                    <div className="font-display tabular text-[28px] leading-none">{g.total > 0 ? formatTokens(g.total, lang) : g.audio_seconds > 0 ? formatDuration(g.audio_seconds, lang) : formatNumber(g.characters, lang)}</div>
                    <div className="mt-1 text-[12px] text-muted">{g.total > 0 ? t('recording.tokens') : g.audio_seconds > 0 ? t('recording.audioSeconds') : t('recording.charactersUnit')}</div>
                  </div>
                  <div className="text-right text-[12px] text-muted">
                    <div className="tabular">{t('recording.callsCount', { count: g.calls, n: formatNumber(g.calls, lang) })}</div>
                    {g.failed > 0 ? <Badge tone="danger" size="sm">{t('recording.failedCount', { n: g.failed })}</Badge> : null}
                  </div>
                </div>
                {g.total > 0 ? <ProgressBar value={g.total} max={Math.max(totals.total, 1)} label={t('recording.shareOfRecording')} /> : null}
                <div className="flex flex-wrap gap-1.5">
                  {g.models.map((m) => (
                    <span key={m} className="rounded-pill bg-sunken px-2 py-0.5 font-mono text-[11.5px] text-muted">{m}</span>
                  ))}
                </div>
                {g.total > 0 ? (
                  <div className="flex gap-4 text-[12px] text-muted">
                    <span>{t('chart.input')}: <span className="tabular font-mono text-ink">{formatTokens(g.input, lang)}</span></span>
                    <span>{t('chart.output')}: <span className="tabular font-mono text-ink">{formatTokens(g.output, lang)}</span></span>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Panel title={t('recording.callsTitle')} description={t('recording.callsDescription')} flush>
        <CallsTable rows={data.calls} compact bare empty={<EmptyState compact title={t('recording.noCalls')} />} />
      </Panel>

      <Panel title={t('recording.digests')} description={t('recording.digestsDescription')} icon={<Layers className="size-4" />}>
        {data.digests.length === 0 ? (
          <p className="text-[13px] text-muted">{t('recording.noDigests')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.digests.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{gloss.pick(d.title, d.title_en)}</div>
                  <div className="text-[12px] text-muted">
                    {formatDateTime(d.created_at, lang)} - {t('recording.digestRecordings', { count: d.recordings, n: d.recordings })}
                  </div>
                </div>
                <div className="tabular font-mono text-[12.5px]">{t('recording.digestTokens', { n: formatNumber(d.tokens, lang) })}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {totals.byo_calls > 0 ? <Callout tone="info" title={t('byo.title')}>{t('byo.recording', { n: totals.byo_calls })}</Callout> : null}
    </div>
  )
}
