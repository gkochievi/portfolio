import { Fragment, useEffect } from 'react'
import { AlertTriangle, ArrowRightLeft, BookOpen, CornerDownLeft, Languages, RefreshCw, Sparkles, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { Badge, Button, EmptyState, ErrorState, Skeleton, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAccount } from '@/lib/account'
import { errorMessage } from '@/api/client'
import { useNow } from '@/lib/realtime'
import type { CopilotDraft, CopilotRef, CopilotSuggestion, CopilotTransform } from '@/types'

import {
  sendCopilotFeedback,
  useCopilot,
  useDrawerSession,
  useRegenerateCopilot,
  useSimulateOutage,
  useTransformCopilot,
} from '../api'
import { SectionLabel, stripCitations } from './shared'

const shownDrafts = new Set<string>()

const TRANSFORMS: { key: CopilotTransform; icon?: 'lang' }[] = [
  { key: 'shorter' },
  { key: 'warmer' },
  { key: 'formal' },
  { key: 'to_ru', icon: 'lang' },
  { key: 'to_ka', icon: 'lang' },
  { key: 'to_en', icon: 'lang' },
]

const KIND_TONE = { answer: 'accent', clarify: 'info', escalate: 'warning' } as const

export interface CopilotTabProps {
  sessionId: string
  onInsert: (text: string, ref?: Omit<CopilotRef, 'action'>) => void
}

/** Text with `[n]` citation markers drawn as small superscript chips. */
function CitedText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
      {parts.map((part, index) =>
        /^\[\d+\]$/.test(part) ? (
          <sup key={index} className="mx-0.5 rounded-sm bg-accent-soft px-1 font-mono text-[10px] font-medium text-accent">
            {part.slice(1, -1)}
          </sup>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </p>
  )
}

export function CopilotTab({ sessionId, onInsert }: CopilotTabProps) {
  const { t } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const account = useAccount()
  const copilot = useCopilot(sessionId)
  const detail = useDrawerSession(sessionId)
  const regenerate = useRegenerateCopilot(sessionId)
  const transform = useTransformCopilot(sessionId)
  const outage = useSimulateOutage(sessionId)
  const now = useNow(1_000)

  const draft = copilot.data?.draft ?? null
  const session = detail.data?.session ?? null
  const canAct = account?.role === 'operator' && !!session && session.operatorId === account.staffId && session.status !== 'ended'
  const busy = regenerate.isPending || transform.isPending || outage.isPending || draft?.state === 'running'

  // Tell the (mock) AI service that a draft was shown, once per draft.
  const shownId = draft && draft.state === 'ready' && draft.suggestions.length > 0 ? draft.id : null
  useEffect(() => {
    if (!shownId || !canAct || shownDrafts.has(shownId)) return
    shownDrafts.add(shownId)
    sendCopilotFeedback({ sessionId, draftId: shownId, action: 'shown', variantIndex: null })
  }, [shownId, canAct, sessionId])

  const run = (action: () => Promise<unknown>) => {
    action().catch((error: unknown) => toast.error(errorMessage(error, t('copilot.actionFailed'))))
  }

  const insert = (suggestion: CopilotSuggestion, current: CopilotDraft) => {
    const text = stripCitations(suggestion.text)
    onInsert(text, { draftId: current.id, variantIndex: suggestion.index })
    sendCopilotFeedback({ sessionId, draftId: current.id, action: 'inserted', variantIndex: suggestion.index, finalText: text })
    toast.success(t('copilot.inserted'))
  }

  if (copilot.isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (copilot.isError) {
    return <ErrorState title={t('copilot.loadError')} onRetry={() => void copilot.refetch()} retryLabel={tc('actions.retry')} />
  }

  const handoff = session?.aiHandoff ?? null
  const retryLeft = draft?.retryAfterMs != null ? Math.max(0, Math.ceil((Date.parse(draft.createdAt) + draft.retryAfterMs - now) / 1000)) : 0
  const circuitOpen = draft?.state === 'error' && draft.handoff?.reason === 'circuit_open'
  const escalated = draft?.state === 'ready' && draft.handoff?.recommended === true && draft.handoff.reason === 'ai_recommended'

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-4">
        {handoff ? (
          <section className="rounded-ui border border-line bg-sunken p-3" aria-label={t('copilot.handoff.title')}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <SectionLabel className="mb-0">{t('copilot.handoff.title')}</SectionLabel>
              <Badge tone="accent" size="sm" icon={<ArrowRightLeft size={12} />}>
                {tc(`handoffReason.${handoff.reason}`)}
              </Badge>
            </div>
            <p className="text-[13px] leading-relaxed text-ink">{handoff.summary}</p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              <span className="font-medium text-ink">{t('copilot.handoff.goal')}: </span>
              {handoff.goal}
            </p>
          </section>
        ) : null}

        {!canAct && session && session.status !== 'ended' ? (
          <p className="rounded-ui border border-dashed border-line-strong px-3 py-2 text-xs text-muted">{t('copilot.claimHint')}</p>
        ) : null}

        {!draft || draft.state === 'not_found' ? (
          <EmptyState
            compact
            icon={<Sparkles size={22} strokeWidth={1.75} />}
            title={t('copilot.notFoundTitle')}
            description={t('copilot.notFoundBody')}
            action={
              canAct ? (
                <Button size="sm" variant="outline" loading={regenerate.isPending} onClick={() => run(() => regenerate.mutateAsync())}>
                  {t('copilot.generate')}
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {draft?.state === 'running' ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <BirdBadge size={20} />
              {t('copilot.reading')}
            </p>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {draft?.state === 'error' ? (
          <div role="alert" className="rounded-ui border border-danger/40 bg-danger-soft p-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
              <WifiOff size={16} strokeWidth={1.75} />
              {circuitOpen ? t('copilot.circuitTitle') : t('copilot.errorTitle')}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink">
              {circuitOpen ? t('copilot.circuitBody', { count: retryLeft }) : t('copilot.errorBody')}
            </p>
            {canAct ? (
              <Button className="mt-2" size="xs" variant="outline" loading={regenerate.isPending} onClick={() => run(() => regenerate.mutateAsync())}>
                {t('copilot.tryAgain')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {draft?.state === 'rate_limited' ? (
          <div role="alert" className="rounded-ui border border-warning/40 bg-warning-soft p-3">
            <p className="text-[13px] font-medium text-warning">{t('copilot.rateTitle')}</p>
            <p className="mt-1 text-[12.5px] text-ink">{t('copilot.rateBody', { count: retryLeft })}</p>
          </div>
        ) : null}

        {draft?.state === 'refused' ? (
          <EmptyState compact icon={<Sparkles size={22} strokeWidth={1.75} />} title={t('copilot.refusedTitle')} description={t('copilot.refusedBody')} />
        ) : null}

        {draft?.state === 'ready' ? (
          <>
            {escalated ? (
              <div role="status" className="rounded-ui border border-warning/40 bg-warning-soft p-3">
                <p className="flex items-center gap-2 text-[13px] font-medium text-warning">
                  <ArrowRightLeft size={16} strokeWidth={1.75} />
                  {t('copilot.escalatedTitle')}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{draft.handoff?.summary || t('copilot.escalatedBody')}</p>
              </div>
            ) : null}

            {draft.suggestions.length === 0 ? (
              <EmptyState compact icon={<Sparkles size={22} strokeWidth={1.75} />} title={t('copilot.emptyTitle')} description={t('copilot.emptyBody')} />
            ) : (
              <>
                {draft.commitmentWarning ? (
                  <div role="note" className="flex gap-2 rounded-ui border border-warning/40 bg-warning-soft p-2.5 text-[12.5px] leading-relaxed text-ink">
                    <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    {t('copilot.commitment')}
                  </div>
                ) : null}

                {draft.knowledge.length > 0 ? (
                  <section aria-label={t('copilot.knowledge')}>
                    <SectionLabel>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={14} strokeWidth={1.75} aria-hidden />
                        {t('copilot.knowledge')}
                      </span>
                    </SectionLabel>
                    <ul className="space-y-2">
                      {draft.knowledge.map((card) => (
                        <li key={card.n} className="rounded-ui border border-line bg-panel p-2.5">
                          <p className="flex items-start gap-2 text-[13px] font-medium text-ink">
                            <span className="mt-0.5 shrink-0 rounded-sm bg-accent-soft px-1 font-mono text-[10px] text-accent">{card.n}</span>
                            {card.title}
                          </p>
                          <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{card.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section aria-label={t('copilot.drafts')}>
                  <SectionLabel>{t('copilot.drafts')}</SectionLabel>
                  <ul className="space-y-2.5">
                    {draft.suggestions.map((suggestion) => {
                      const sources = suggestion.citations
                        .map((n) => draft.knowledge.find((card) => card.n === n)?.title)
                        .filter((title): title is string => !!title)
                      return (
                        <li key={`${draft.id}-${suggestion.index}`} className="animate-hop rounded-ui border border-dashed border-accent/70 bg-bot p-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <Badge tone={KIND_TONE[suggestion.kind]} size="sm">
                              {t(`copilot.kind.${suggestion.kind}`)}
                            </Badge>
                            <span className="font-mono text-[10.5px] text-muted">#{suggestion.index + 1}</span>
                          </div>
                          <CitedText text={suggestion.text} />
                          {sources.length > 0 ? (
                            <p className="mt-2 text-[11.5px] leading-snug text-muted">
                              {t('copilot.sources')}: {sources.join(' · ')}
                            </p>
                          ) : null}
                          {canAct ? (
                            <div className="mt-2.5 flex justify-end">
                              <Button size="xs" variant="outline" leftIcon={<CornerDownLeft size={14} />} onClick={() => insert(suggestion, draft)}>
                                {t('copilot.insert')}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </>
            )}
          </>
        ) : null}

        {canAct && draft && draft.state !== 'running' && draft.state !== 'not_found' ? (
          <section aria-label={t('copilot.transformLabel')} className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {draft.state === 'ready' && draft.suggestions.length > 0
                ? TRANSFORMS.map(({ key, icon }) => (
                    <Button
                      key={key}
                      size="xs"
                      variant={draft.transform === key ? 'subtle' : 'outline'}
                      disabled={busy}
                      leftIcon={icon ? <Languages size={13} /> : undefined}
                      aria-pressed={draft.transform === key}
                      onClick={() => run(() => transform.mutateAsync(key))}
                    >
                      {t(`copilot.transform.${key}`)}
                    </Button>
                  ))
                : null}
              <Button
                size="xs"
                variant="ghost"
                disabled={busy || (draft.state === 'rate_limited' && retryLeft > 0)}
                leftIcon={<RefreshCw size={13} />}
                onClick={() => run(() => regenerate.mutateAsync())}
              >
                {t('copilot.regenerate')}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      {account?.role === 'operator' ? (
        <footer className={cn('border-t border-dashed border-line-strong p-3')}>
          <Switch
            size="sm"
            checked={copilot.data?.outage ?? false}
            disabled={outage.isPending}
            onCheckedChange={(on) => run(() => outage.mutateAsync(on))}
            label={t('copilot.debug.simulate')}
            description={
              copilot.data?.outage && copilot.data.outageUntil
                ? t('copilot.debug.active', { count: Math.max(0, Math.ceil((Date.parse(copilot.data.outageUntil) - now) / 1000)) })
                : t('copilot.debug.hint')
            }
          />
        </footer>
      ) : null}
    </div>
  )
}
