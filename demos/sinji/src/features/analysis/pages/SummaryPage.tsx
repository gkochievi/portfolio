import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, ClipboardList, Clock, Languages, ListChecks, Sparkles, Users } from 'lucide-react'

import { Badge, Button, Callout, Card, EmptyState, FilterChip, PageHeader, Skeleton, Spinner, StatusChip } from '@/components/ui'
import { SystemMessage } from '@/components/shell/SystemMessage'
import { isApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { CallSummary } from '@/types'
import { callGloss, useSummary } from '../api'

/** One multi-call digest: shared findings, action items, who spoke where, and a card per call. */
export default function SummaryPage() {
  const { summaryId } = useParams<{ summaryId: string }>()
  const { t } = useTranslation('analysis')
  const query = useSummary(summaryId)

  const back = (
    <Link to="/workspace/calls" className="inline-flex items-center gap-1.5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <ArrowLeft className="size-3.5" aria-hidden /> {t('digest.back')}
    </Link>
  )

  if (query.isPending) {
    return (
      <div aria-busy>
        <PageHeader back={back} title={<Skeleton className="h-8 w-2/3" />} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (query.isError) {
    if (isApiError(query.error) && (query.error.status === 404 || query.error.status === 403)) {
      return (
        <SystemMessage
          code={query.error.status}
          title={t('digest.notFound.title')}
          body={t('digest.notFound.body')}
          actions={
            <Button asChild>
              <Link to="/workspace/calls">{t('digest.back')}</Link>
            </Button>
          }
        />
      )
    }
    return (
      <div>
        <PageHeader back={back} title={t('digest.title')} />
        <Callout tone="danger" title={t('digest.error.title')} action={<Button size="sm" variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>}>
          {t('digest.error.body')}
        </Callout>
      </div>
    )
  }

  return <Digest summary={query.data} back={back} />
}

function Digest({ summary, back }: { summary: CallSummary; back: React.ReactNode }) {
  const { t } = useTranslation('analysis')
  const gloss = useGloss()
  const fmt = useFormat()
  const [active, setActive] = useState<number | null>(null)

  const running = summary.status === 'running'
  const failed = summary.status === 'error'
  const title = gloss.pick(summary.title, summary.title_en) || t('digest.untitled')
  const calls = useMemo(() => summary.calls.map(callGloss), [summary.calls])
  const shownCalls = active === null ? calls : calls.filter((c) => c.index === active)
  const perCallMs = summary.stages.find((s) => s.name === 'per_call')?.ms
  const mergeMs = summary.stages.find((s) => s.name === 'merge')?.ms
  const totalMs = (perCallMs ?? 0) + (mergeMs ?? 0)

  /** Simulator-generated labels ("Agent 2" / "ოპერატორი 2") follow the UI language; real names pass through. */
  const participantLabel = (label: string, role: string) => {
    const m = label.match(/^(?:Agent|Customer|ოპერატორი|მომხმარებელი) (\d+)$/)
    return m && (role === 'agent' || role === 'customer') ? t(`digest.generic.${role}`, { n: m[1] }) : label
  }

  const callLabel = (index: number) => {
    const call = calls.find((c) => c.index === index)
    return call ? call.title : `#${index}`
  }

  return (
    <div data-page="summary" className="animate-fade-in">
      <PageHeader
        back={back}
        eyebrow={t('digest.eyebrow')}
        title={running ? t('digest.building') : title}
        description={running ? t('digest.buildingHint', { count: summary.job_ids.length }) : gloss.pick(summary.short_summary, summary.short_summary_en) || undefined}
        meta={
          <>
            <Badge tone="neutral" shape="tag" icon={<ClipboardList className="size-3" aria-hidden />}>
              {t('digest.calls', { count: summary.job_ids.length })}
            </Badge>
            <Badge tone="neutral" shape="tag" icon={<Languages className="size-3" aria-hidden />}>
              {t(`summary.language.${summary.language}`)}
            </Badge>
            {running ? (
              <StatusChip tone="info" pulse>
                {t('summary.digests.running')}
              </StatusChip>
            ) : null}
            {failed ? <StatusChip tone="danger">{t('summary.digests.failed')}</StatusChip> : null}
            <span className="text-xs text-muted">
              {t('digest.createdBy', { name: summary.created_by })} · {fmt.dateTime(summary.created_at)}
            </span>
          </>
        }
      />

      {running ? <BuildProgress summary={summary} /> : null}

      {failed ? (
        <Callout tone="danger" title={t('digest.failed.title')} icon={<CircleAlert className="size-4" aria-hidden />}>
          {t('digest.failed.body')}
        </Callout>
      ) : null}

      {!running && !failed ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <Sparkles className="size-4 text-accent" aria-hidden /> {t('digest.keyPoints')}
                <span className="tabular text-xs font-normal text-subtle">{summary.key_points.length}</span>
              </h2>
              {summary.key_points.length === 0 ? (
                <p className="text-sm text-muted">{t('digest.noKeyPoints')}</p>
              ) : (
                <ol className="space-y-2.5">
                  {summary.key_points.map((point, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink/90">
                      <span className="tabular mt-0.5 w-5 shrink-0 text-right font-display text-accent">{i + 1}</span>
                      <span>{gloss.pick(point, summary.key_points_en?.[i])}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <ListChecks className="size-4 text-accent" aria-hidden /> {t('digest.actionItems')}
                <span className="tabular text-xs font-normal text-subtle">{summary.action_items.length}</span>
              </h2>
              {summary.action_items.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Check className="size-4 text-success" aria-hidden /> {t('digest.noActions')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {summary.action_items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-ctl border border-line bg-sunken px-3 py-2 text-sm text-ink/90">
                      <span aria-hidden className="mt-1 size-3.5 shrink-0 rounded-[4px] border border-line-strong bg-panel" />
                      <span>{gloss.pick(item, summary.action_items_en?.[i])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="min-w-0 space-y-4">
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <Users className="size-4 text-accent" aria-hidden /> {t('digest.participants')}
              </h2>
              {summary.participants.length === 0 ? (
                <p className="text-sm text-muted">{t('digest.noParticipants')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {summary.participants.map((p, i) => (
                    <li key={`${p.label}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-ink">{participantLabel(p.label, p.role)}</span>
                        <Badge tone={p.role === 'agent' ? 'primary' : p.role === 'customer' ? 'accent' : 'neutral'} shape="tag" size="sm">
                          {t(`digest.role.${p.role}`)}
                        </Badge>
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted">{t('digest.appearsIn')}</span>
                        {p.appears_in.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setActive(n)}
                            title={callLabel(n)}
                            className="tabular rounded-pill border border-line bg-panel px-2 py-0.5 text-xs text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            #{n}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Clock className="size-4 text-subtle" aria-hidden /> {t('digest.method.title')}
              </h2>
              <p className="text-xs leading-relaxed text-muted">{t('digest.method.body')}</p>
              <dl className="tabular grid grid-cols-3 gap-2 pt-1 text-sm">
                <div>
                  <dt className="text-[11px] text-subtle">{t('digest.method.perCall')}</dt>
                  <dd className="font-medium text-ink">{perCallMs !== undefined ? `${(perCallMs / 1000).toFixed(1)} s` : '-'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-subtle">{t('digest.method.merge')}</dt>
                  <dd className="font-medium text-ink">{mergeMs !== undefined ? `${(mergeMs / 1000).toFixed(1)} s` : '-'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-subtle">{t('digest.method.total')}</dt>
                  <dd className="font-medium text-ink">{totalMs ? `${(totalMs / 1000).toFixed(1)} s` : '-'}</dd>
                </div>
              </dl>
            </Card>
          </aside>
        </div>
      ) : null}

      {/* Per-call cards ------------------------------------------------------ */}
      {calls.length > 0 ? (
        <section className="mt-6 space-y-3" aria-label={t('digest.perCall.title')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{t('digest.perCall.title')}</h2>
            {calls.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('digest.switcher')}>
                <FilterChip active={active === null} onClick={() => setActive(null)} count={calls.length}>
                  {t('digest.allCalls')}
                </FilterChip>
                {calls.map((c) => (
                  <FilterChip key={c.index} active={active === c.index} onClick={() => setActive(active === c.index ? null : c.index)}>
                    #{c.index}
                  </FilterChip>
                ))}
              </div>
            ) : null}
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {shownCalls.map((c) => (
              <li key={c.recording_id} className={cn(shownCalls.length === 1 && 'md:col-span-2')}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border border-accent/50 bg-accent/10 font-display text-sm text-accent">{c.index}</span>
                      <h3 className="min-w-0 pt-0.5 font-medium text-ink">{c.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-ink/90">{gloss.pick(c.summary, c.summary_en)}</p>
                  <p className="rounded-ctl bg-sunken px-3 py-2 text-sm text-ink/90">
                    <span className="caps mr-1.5 text-[11px] font-medium text-subtle">{t('digest.outcome')}</span>
                    {gloss.pick(c.outcome, c.outcome_en)}
                  </p>
                  <div className="mt-auto pt-1">
                    <Button asChild size="sm" variant="secondary" iconRight={<ArrowUpRight className="size-3.5" aria-hidden />}>
                      <Link to={`/workspace/calls/${c.recording_id}`}>{t('digest.openCall')}</Link>
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : !running && !failed ? (
        <Card className="mt-6">
          <EmptyState title={t('digest.perCall.emptyTitle')} body={t('digest.perCall.emptyBody')} />
        </Card>
      ) : null}
    </div>
  )
}

/** Shown while the simulator runs the two stages (per call, then merge). */
function BuildProgress({ summary }: { summary: CallSummary }) {
  const { t } = useTranslation('analysis')
  const done = summary.stages.length
  const steps = [
    { key: 'per_call', label: t('summarise.stage.per_call', { count: summary.job_ids.length }) },
    { key: 'merge', label: t('summarise.stage.merge') },
  ]
  return (
    <Card className="mb-4 space-y-3" aria-busy aria-live="polite">
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.key} className={cn('flex items-center gap-2.5 text-sm', done >= i ? 'text-ink' : 'text-subtle')}>
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                done > i ? 'border-success bg-success/15 text-success' : done === i ? 'border-primary text-primary' : 'border-line',
              )}
            >
              {done > i ? <Check className="size-3" aria-hidden /> : done === i ? <Spinner size={12} /> : i + 1}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <Skeleton className="h-24 w-full" />
    </Card>
  )
}
