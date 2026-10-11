/** Call detail: player + finding lanes + transcript (left), result tabs (right). OWNED BY: workbench. */
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge, Button, Callout, EmptyState, IconButton, Skeleton, Tabs, toast } from '@/components/ui'
import { CallSummaryPanel, ScorecardPanel, TonePanel, type AnalysisPanelProps } from '@/features/analysis'
import { formatDate, formatDuration, formatPercent } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { useCanEdit } from '@/lib/session'
import type { Recording } from '@/types'
import { useBands, useRecording, useRecordingEvents, useRecordings, useRunAnalysers, type ResultKey, type RunKey } from '../api'
import { FactcheckPanel } from '../components/FactcheckPanel'
import { Lanes } from '../components/Lanes'
import { Player } from '../components/Player'
import { RESULT_ICON, RunBar } from '../components/RunBar'
import { Transcript } from '../components/Transcript'
import { usePlayer } from '../components/usePlayer'
import { AgreementBadge, BandPill, RecordingStatusChip, SourceIcon } from '../components/status'
import { buildLanes } from '../lib'

export default function CallDetailPage() {
  const { callId } = useParams()
  const { t, i18n } = useTranslation('workbench')
  useRecordingEvents()
  const query = useRecording(callId)

  if (query.isLoading) return <DetailSkeleton />
  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="py-10">
        <EmptyState
          title={notFound ? t('detail.notFoundTitle') : t('detail.errorTitle')}
          body={notFound ? t('detail.notFoundBody') : t('common:errors.load')}
          action={
            <div className="flex gap-2">
              {!notFound ? (
                <Button variant="secondary" onClick={() => void query.refetch()}>
                  {t('common:actions.retry')}
                </Button>
              ) : null}
              <Button asChild variant="primary">
                <Link to="/workspace/calls">{t('detail.backToCalls')}</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }
  void i18n
  return <Detail rec={query.data} />
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}

function Detail({ rec }: { rec: Recording }) {
  const { t, i18n } = useTranslation('workbench')
  const navigate = useNavigate()
  const canEdit = useCanEdit()
  const bands = useBands()
  const list = useRecordings({})
  const runMutation = useRunAnalysers(rec.id)
  const [tab, setTab] = useState<ResultKey>('score')
  const [manual, setManual] = useState<number | null>(null)
  const [focus, setFocus] = useState<{ i: number; n: number } | null>(null)

  const isAudio = rec.source === 'audio'
  const hasAudioView = isAudio && rec.segments.length > 0 && (rec.duration_s ?? 0) > 0
  const player = usePlayer(rec.audio_url, rec.duration_s ?? 0, hasAudioView)
  const lanes = useMemo(() => (hasAudioView ? buildLanes(rec) : []), [rec, hasAudioView])

  const activeFromTime = useMemo(() => {
    if (!hasAudioView || (player.time === 0 && !player.playing)) return null
    const seg = rec.segments.find((s) => s.start !== null && s.end !== null && player.time >= s.start && player.time < s.end)
    return seg?.i ?? null
  }, [hasAudioView, player.time, player.playing, rec.segments])
  const activeIndex = hasAudioView && (player.playing || activeFromTime !== null) ? activeFromTime ?? manual : manual

  const onSeek = useCallback(
    (seconds: number | null, index?: number) => {
      if (seconds !== null && hasAudioView) player.seek(seconds)
      if (index !== undefined) {
        setManual(index)
        setFocus((f) => ({ i: index, n: (f?.n ?? 0) + 1 }))
      }
    },
    [hasAudioView, player],
  )

  const run = (keys: RunKey[]) => {
    runMutation.mutate(keys, {
      onError: (error) => toast.error(error instanceof Error ? error.message : t('run.failed')),
    })
  }

  const rows = list.data ?? []
  const idx = rows.findIndex((r) => r.id === rec.id)
  const prev = idx > 0 ? rows[idx - 1] : undefined
  const next = idx >= 0 ? rows[idx + 1] : undefined

  const panelProps: AnalysisPanelProps = { recording: rec, onSeek, canEdit }
  const runningKeys: string[] = rec.running
  const summaryReady = Boolean(rec.analysis)
  const has: Record<ResultKey, boolean> = {
    score: Boolean(rec.scoring),
    factcheck: Boolean(rec.kb_check),
    semantic: Boolean(rec.semantic),
    summary: summaryReady,
  }
  const tabBody = (key: ResultKey, body: ReactNode): ReactNode => {
    if (runningKeys.includes(key)) {
      return (
        <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" />
          {t('detail.running', { name: t(`analysers.${key}`) })}
        </div>
      )
    }
    if (!has[key]) {
      const Icon = RESULT_ICON[key]
      return (
        <EmptyState
          compact
          icon={<Icon className="size-5" />}
          title={t('detail.notRunTitle', { name: t(`analysers.${key}`) })}
          body={rec.segments.length === 0 ? t('run.needsTranscript') : t('detail.notRunBody')}
          action={
            <Button variant="primary" size="sm" disabled={rec.segments.length === 0 || rec.status === 'transcribing'} onClick={() => run([key])}>
              {t('run.run', { name: t(`analysers.${key}`) })}
            </Button>
          }
        />
      )
    }
    return body
  }

  const tabs = [
    { value: 'score', label: t('tabs.score'), content: tabBody('score', <ScorecardPanel {...panelProps} />) },
    { value: 'factcheck', label: t('tabs.factcheck'), content: tabBody('factcheck', <FactcheckPanel {...panelProps} />) },
    { value: 'semantic', label: t('tabs.tone'), content: tabBody('semantic', <TonePanel {...panelProps} />) },
    { value: 'summary', label: t('tabs.summary'), content: tabBody('summary', <CallSummaryPanel {...panelProps} />) },
  ]

  const score = rec.scoring?.weighted_total ?? null

  return (
    <div className="space-y-5">
      <div>
        <Link to="/workspace/calls" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          {t('detail.backToCalls')}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 break-all font-display text-2xl leading-tight sm:text-3xl">
              <SourceIcon source={rec.source} className="size-5 shrink-0 text-muted" />
              {rec.filename}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              <RecordingStatusChip status={rec.status} />
              {rec.language ? <span>{t(`lang.${rec.language}`)}</span> : null}
              {rec.duration_s ? <span className="tabular">{formatDuration(rec.duration_s, i18n.language)}</span> : null}
              <span>{rec.created_by}</span>
              <span>{formatDate(rec.created_at, i18n.language)}</span>
              {!isAudio ? <Badge size="sm" tone="neutral">{t('detail.textMode')}</Badge> : null}
            </div>
          </div>
          <nav className="flex items-center gap-1.5" aria-label={t('detail.switcher')}>
            {idx >= 0 ? (
              <span className="mr-1 text-xs tabular text-muted">{t('detail.position', { n: idx + 1, total: rows.length })}</span>
            ) : null}
            {prev ? (
              <IconButton label={t('detail.prev')} icon={<ChevronLeft className="size-4" />} variant="secondary" onClick={() => navigate(`/workspace/calls/${prev.id}`)} />
            ) : (
              <IconButton label={t('detail.prev')} icon={<ChevronLeft className="size-4" />} variant="secondary" disabled />
            )}
            {next ? (
              <IconButton label={t('detail.next')} icon={<ChevronRight className="size-4" />} variant="secondary" onClick={() => navigate(`/workspace/calls/${next.id}`)} />
            ) : (
              <IconButton label={t('detail.next')} icon={<ChevronRight className="size-4" />} variant="secondary" disabled />
            )}
          </nav>
        </div>

        {score !== null || rec.kb_check || rec.sentiment ? (
          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {score !== null ? (
              <div className="flex items-center gap-2">
                <dt className="text-muted">{t('detail.score')}</dt>
                <dd><BandPill score={score} bands={bands} size="lg" /></dd>
              </div>
            ) : null}
            {rec.kb_check?.accuracy_score != null ? (
              <div className="flex items-center gap-2">
                <dt className="text-muted">{t('detail.accuracy')}</dt>
                <dd className="tabular font-medium">{formatPercent(rec.kb_check.accuracy_score, i18n.language, { ratio: false })}</dd>
              </div>
            ) : null}
            {rec.sentiment ? (
              <div className="flex items-center gap-2">
                <dt className="text-muted">{t('detail.agreement')}</dt>
                <dd><AgreementBadge agreement={rec.sentiment.agreement} /></dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      {rec.status === 'transcribing' ? (
        <Callout tone="info" title={t('detail.transcribingTitle')}>
          {t('detail.transcribingBody')}
        </Callout>
      ) : null}
      {rec.status === 'error' ? (
        <Callout
          tone="danger"
          title={t('detail.errorStateTitle')}
          action={
            isAudio ? (
              <Button size="sm" variant="secondary" onClick={() => run(['transcribe'])}>
                {t('detail.retryTranscribe')}
              </Button>
            ) : undefined
          }
        >
          {rec.error ?? t('common:errors.generic')}
        </Callout>
      ) : null}

      <RunBar rec={rec} run={run} runningKeys={runningKeys} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          {hasAudioView ? (
            <>
              <Player rec={rec} player={player} />
              <Lanes lanes={lanes} duration={rec.duration_s ?? 0} time={player.time} onSeek={(s, i) => onSeek(s, i)} />
            </>
          ) : null}
          <Transcript rec={rec} activeIndex={activeIndex} focus={focus} onSeek={onSeek} />
        </div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
          <div className="rounded-card border border-line bg-panel p-4">
            <Tabs items={tabs} value={tab} onValueChange={(v) => setTab(v as ResultKey)} />
          </div>
        </aside>
      </div>
    </div>
  )
}
