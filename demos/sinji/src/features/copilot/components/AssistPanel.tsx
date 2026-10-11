/**
 * The right-hand drawer of the harness: the tier ladder (stage chips with
 * measured ms), the grounding verdict, tier-1 passages, streamed drafts,
 * the handoff card and the blocked panel. OWNED BY: copilot.
 */
import { AlertTriangle, ArrowRightLeft, BookOpenCheck, Check, Gauge, Lock, PenLine, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Callout, Dialog, EmptyState, KeyValue, Meter, Panel, StatusChip, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/format'
import type { AutopilotBlock, Citation, Handoff, RetrievalHit, Suggestion, TurnEnvelope } from '@/types'
import { CitedText } from './ThreadParts'

export interface DraftState {
  index: number
  kind: Suggestion['kind']
  text: string
  citations: Citation[]
  status: 'streaming' | 'idle' | 'busy' | 'inserted' | 'edited' | 'ignored'
}

export interface RunState {
  turnId: string
  mode: 'copilot' | 'autopilot'
  phase: 'grounding' | 'tier1' | 'drafts' | 'done' | 'error'
  /** Measured ms per stage, filled as the stream delivers it. */
  stages: Partial<Record<'grounding' | 'tier1' | 'suggestions' | 'reply', number>>
  grounding?: TurnEnvelope['grounding']
  tier1?: RetrievalHit[]
  drafts: DraftState[]
  handoff?: Handoff
  envelope?: TurnEnvelope
  error?: string
}

type StageKey = 'grounding' | 'tier1' | 'drafts' | 'done'

function StageChips({ run }: { run: RunState }) {
  const { t } = useTranslation('copilot')
  const f = useFormat()
  const order: StageKey[] = ['grounding', 'tier1', 'drafts', 'done']
  const rank: Record<RunState['phase'], number> = { grounding: 0, tier1: 1, drafts: 2, done: 4, error: 4 }
  const current = rank[run.phase]
  const last = run.mode === 'copilot' ? run.stages.suggestions : run.stages.reply
  const ms = (key: StageKey): number | undefined =>
    key === 'grounding' ? run.stages.grounding : key === 'tier1' ? run.stages.tier1 : key === 'drafts' ? last : (run.stages.grounding ?? 0) + (run.stages.tier1 ?? 0) + (last ?? 0)
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={t('panel.stages')}>
      {order.map((key, i) => {
        const done = i < current
        const active = i === current && run.phase !== 'done'
        const value = done ? ms(key) : undefined
        return (
          <li
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs',
              done ? 'border-success/30 bg-success/8 text-ink' : active ? 'border-primary/40 bg-primary/8 text-ink' : 'border-line text-subtle',
            )}
          >
            {done ? <Check className="size-3 text-success" aria-hidden /> : active ? <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> : <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />}
            <span className="font-medium">{key === 'drafts' && run.mode === 'autopilot' ? t('panel.stage.reply') : t(`panel.stage.${key}`)}</span>
            {value !== undefined ? <span className="tabular font-mono text-[11px] text-muted">{f.number(value)} ms</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

function GroundingCard({ run }: { run: RunState }) {
  const { t } = useTranslation('copilot')
  const f = useFormat()
  const g = run.grounding
  if (!g) return null
  return (
    <Panel
      title={t('grounding.title')}
      icon={<BookOpenCheck />}
      actions={<StatusChip tone={g.grounded ? 'success' : 'warning'}>{g.grounded ? t('grounding.grounded') : g.kb_present ? t('grounding.notGrounded') : t('grounding.noKb')}</StatusChip>}
    >
      <KeyValue
        columns={2}
        items={[
          { label: t('grounding.topScore'), value: <span className="tabular">{g.top_score.toFixed(2)}</span> },
          { label: t('grounding.hits'), value: <span className="tabular">{g.hits}</span> },
          { label: t('grounding.triage'), value: <Badge size="sm" tone={g.triage === 'business' ? 'success' : g.triage === 'risky' ? 'danger' : g.triage === 'off_topic' ? 'warning' : 'neutral'}>{t(`triage.${g.triage}`)}</Badge> },
          { label: t('grounding.tokens'), value: run.envelope ? <span className="tabular">{f.number(run.envelope.usage.total_tokens)}</span> : '-' },
        ]}
      />
      {run.envelope && run.envelope.usage.total_tokens === 0 ? <p className="mt-3 text-xs text-muted">{t('grounding.noModel')}</p> : null}
    </Panel>
  )
}

function Tier1Card({ hits, onOpen }: { hits: RetrievalHit[]; onOpen: (hit: RetrievalHit) => void }) {
  const { t } = useTranslation('copilot')
  return (
    <Panel title={t('tier1.title')} description={t('tier1.hint')} icon={<Gauge />}>
      {hits.length === 0 ? (
        <p className="text-sm text-muted">{t('tier1.none')}</p>
      ) : (
        <ul className="space-y-2.5">
          {hits.map((hit) => (
            <li key={hit.chunk_id}>
              <button
                type="button"
                onClick={() => onOpen(hit)}
                className="block w-full rounded-ctl border border-line bg-sunken/40 p-3 text-left hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{hit.title}</span>
                  {hit.visibility === 'internal' ? <Badge size="sm" tone="warning" icon={<Lock className="size-3" />}>{t('tier1.internal')}</Badge> : null}
                  <span className="tabular font-mono text-xs text-muted">{hit.score.toFixed(2)}</span>
                </div>
                <Meter value={Math.round(hit.score * 100)} ticks={16} className="mt-2" />
                <p className="mt-2 line-clamp-3 text-[13px] text-muted">{hit.snippet}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function DraftCard({
  draft,
  onCitation,
  onAct,
}: {
  draft: DraftState
  onCitation: (citation: Citation) => void
  onAct: (action: 'inserted' | 'edited' | 'ignored', finalText?: string) => void
}) {
  const { t } = useTranslation('copilot')
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(draft.text)
  const settled = draft.status === 'inserted' || draft.status === 'edited' || draft.status === 'ignored'
  const streaming = draft.status === 'streaming'
  return (
    <li className={cn('rounded-card border bg-panel p-3.5 animate-panel-in', settled ? 'border-line opacity-80' : 'border-accent/35')}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge size="sm" tone="accent" shape="tag">{t('drafts.tag')}</Badge>
        <Badge size="sm" tone="neutral">{t(`drafts.kind.${draft.kind}`)}</Badge>
        {settled ? <Badge size="sm" tone={draft.status === 'ignored' ? 'neutral' : 'success'}>{t(`drafts.status.${draft.status}`)}</Badge> : null}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label={t('drafts.editLabel')} maxLength={2000} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!text.trim()}
              loading={draft.status === 'busy'}
              onClick={() => {
                onAct('edited', text)
                setEditing(false)
              }}
            >
              {t('drafts.sendEdited')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('drafts.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-[14px] leading-relaxed">
            <CitedText text={draft.text} citations={draft.citations} onOpen={onCitation} />
            {streaming ? <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current" /> : null}
          </div>
          {!streaming && !settled ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" loading={draft.status === 'busy'} onClick={() => onAct('inserted')}>
                {t('drafts.insert')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<PenLine className="size-3.5" />}
                onClick={() => {
                  setText(draft.text)
                  setEditing(true)
                }}
              >
                {t('drafts.edit')}
              </Button>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => onAct('ignored')}>
                {t('drafts.ignore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </li>
  )
}

export function HandoffCard({ handoff }: { handoff: Handoff }) {
  const { t } = useTranslation('copilot')
  return (
    <Callout tone="warning" icon={<ArrowRightLeft />} title={t('handoff.title')}>
      <dl className="mt-1.5 space-y-2 text-[13px]">
        <div>
          <dt className="caps text-[10.5px] font-semibold text-subtle">{t('handoff.reasonLabel')}</dt>
          <dd>{t(`handoff.reason.${handoff.reason}`)}</dd>
        </div>
        {handoff.summary ? (
          <div>
            <dt className="caps text-[10.5px] font-semibold text-subtle">{t('handoff.summary')}</dt>
            <dd>{handoff.summary}</dd>
          </div>
        ) : null}
        <div>
          <dt className="caps text-[10.5px] font-semibold text-subtle">{t('handoff.goal')}</dt>
          <dd>{handoff.goal}</dd>
        </div>
      </dl>
    </Callout>
  )
}

export function BlockedPanel({ reason, canManage, isOperator }: { reason: AutopilotBlock; canManage: boolean; isOperator: boolean }) {
  const { t } = useTranslation('copilot')
  const fix =
    reason === 'killed' ? (isOperator ? { to: '/console/bot-control', label: t('blocked.fixControl') } : null) : reason === 'no_public_docs' ? { to: '/workspace/kb/documents', label: t('blocked.fixKb') } : canManage ? { to: '/workspace/bot', label: t('blocked.fixBot') } : null
  return (
    <Callout
      tone="danger"
      icon={<ShieldAlert />}
      title={t('blocked.title')}
      action={
        fix ? (
          <Button asChild size="sm" variant="secondary">
            <Link to={fix.to}>{fix.label}</Link>
          </Button>
        ) : undefined
      }
    >
      {t(`blocked.${reason}`)}
    </Callout>
  )
}

export function CitationDialog({ citation, hit, onClose, canOpenKb }: { citation: Citation | null; hit?: RetrievalHit | null; onClose: () => void; canOpenKb: boolean }) {
  const { t } = useTranslation('copilot')
  const item = citation ?? (hit ? { n: 0, document_id: hit.document_id, chunk_id: hit.chunk_id, title: hit.title, score: hit.score, snippet: hit.snippet } : null)
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      title={item?.title ?? ''}
      description={t('citation.description')}
      footer={
        <>
          {item && canOpenKb ? (
            <Button asChild variant="secondary">
              <Link to={`/workspace/kb/chunks?doc=${encodeURIComponent(item.document_id)}`} onClick={onClose}>
                {t('citation.openChunks')}
              </Link>
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            {t('citation.close')}
          </Button>
        </>
      }
    >
      {item ? (
        <div className="space-y-4">
          <KeyValue
            columns={2}
            items={[
              { label: t('citation.document'), value: item.document_id, mono: true },
              { label: t('citation.chunk'), value: item.chunk_id, mono: true },
              { label: t('citation.score'), value: <span className="tabular">{item.score.toFixed(2)}</span> },
              ...(item.n > 0 ? [{ label: t('citation.marker'), value: `[${item.n}]` }] : []),
            ]}
          />
          <blockquote className="rounded-ctl border-l-2 border-accent bg-sunken/60 px-3.5 py-2.5 text-[14px] leading-relaxed">{item.snippet}</blockquote>
        </div>
      ) : null}
    </Dialog>
  )
}

export function AssistPanel({
  run,
  mode,
  blocked,
  onCitation,
  onHit,
  onAct,
  canManage,
  isOperator,
}: {
  run: RunState | null
  mode: 'copilot' | 'autopilot'
  blocked: AutopilotBlock | null
  onCitation: (citation: Citation) => void
  onHit: (hit: RetrievalHit) => void
  onAct: (draft: DraftState, action: 'inserted' | 'edited' | 'ignored', finalText?: string) => void
  canManage: boolean
  isOperator: boolean
}) {
  const { t } = useTranslation('copilot')
  const f = useFormat()
  const envelopeBlocked = run?.envelope?.reply?.kind === 'blocked' ? run.envelope.reply.blocked : null
  return (
    <aside aria-label={t('panel.title')} className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <h2 className="font-sans text-[15px] font-semibold">{mode === 'copilot' ? t('panel.titleCopilot') : t('panel.titleAutopilot')}</h2>
      </div>

      {!run ? (
        <EmptyState compact title={t('panel.emptyTitle')} body={mode === 'copilot' ? t('panel.emptyCopilot') : t('panel.emptyAutopilot')} />
      ) : (
        <>
          {envelopeBlocked ? null : <StageChips run={run} />}
          {run.error ? <Callout tone="danger" icon={<AlertTriangle />} title={t('panel.error')}>{run.error}</Callout> : null}
          {envelopeBlocked ? <BlockedPanel reason={envelopeBlocked} canManage={canManage} isOperator={isOperator} /> : null}
          {envelopeBlocked ? null : <GroundingCard run={run} />}
          {run.tier1 ? <Tier1Card hits={run.tier1} onOpen={onHit} /> : null}
          {run.mode === 'copilot' && run.drafts.length > 0 ? (
            <section aria-label={t('drafts.title')}>
              <h3 className="mb-2 font-sans text-[13px] font-semibold text-muted">{t('drafts.title')}</h3>
              <ul className="space-y-3">
                {run.drafts.map((draft) => (
                  <DraftCard key={draft.index} draft={draft} onCitation={onCitation} onAct={(action, text) => onAct(draft, action, text)} />
                ))}
              </ul>
            </section>
          ) : null}
          {run.handoff ? <HandoffCard handoff={run.handoff} /> : null}
          {run.envelope ? (
            <p className="tabular text-xs text-subtle">
              {t('panel.usage', { input: f.number(run.envelope.usage.input_tokens), output: f.number(run.envelope.usage.output_tokens) })}
            </p>
          ) : null}
        </>
      )}
      {mode === 'autopilot' && blocked && !envelopeBlocked ? <BlockedPanel reason={blocked} canManage={canManage} isOperator={isOperator} /> : null}
    </aside>
  )
}
