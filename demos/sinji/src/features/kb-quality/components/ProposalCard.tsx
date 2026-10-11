import { Check, Globe, Instagram, MessageCircle, PencilLine, Phone, Smartphone, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Checkbox, Tooltip, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { CurationEvidence, CurationProposal } from '@/types'
import { DiffView } from './DiffView'

const CHANNEL_ICON: Record<CurationEvidence['channel'], LucideIcon> = {
  web: Globe,
  instagram: Instagram,
  messenger: MessageCircle,
  whatsapp: Smartphone,
  call: Phone,
}
const OP_TONE: Record<CurationProposal['op'], Tone> = { add: 'success', update: 'info', remove: 'danger' }
const PRIORITY_TONE: Record<CurationProposal['priority'], Tone> = { high: 'danger', medium: 'warning', low: 'neutral' }
const RISK_TONE: Record<CurationProposal['risk'], Tone> = { low: 'success', medium: 'warning', high: 'danger' }

export interface ProposalCardProps {
  proposal: CurationProposal
  canEdit: boolean
  selected: boolean
  onSelect: (selected: boolean) => void
  onAccept: () => void
  onEdit: () => void
  onDecline: () => void
  busy: boolean
}

function Evidence({ item }: { item: CurationEvidence }) {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const Icon = CHANNEL_ICON[item.channel] ?? Globe
  return (
    <li className="rounded-ctl border border-line bg-sunken/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Icon className="size-3.5" aria-hidden />
        <span>{t(`curation.channels.${item.channel}`)}</span>
        <Badge tone="neutral" shape="tag" size="sm">
          {item.locale.toUpperCase()}
        </Badge>
        <span>{f.date(item.occurred_at)}</span>
        <span className="ml-auto text-subtle">{t(`curation.sources.${item.source_kind}`)}</span>
      </div>
      <p className="text-sm">
        <span className="caps mr-1.5 text-[11px] text-muted">{t('curation.customer')}</span>
        {item.question}
      </p>
      <p className="mt-1.5 text-sm text-ink/80">
        <span className="caps mr-1.5 text-[11px] text-muted">{t('curation.answer')}</span>
        {item.answer}
      </p>
    </li>
  )
}

export function ProposalCard({ proposal: p, canEdit, selected, onSelect, onAccept, onEdit, onDecline, busy }: ProposalCardProps) {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const { pick } = useGloss()
  const [showAll, setShowAll] = useState(false)
  const pending = p.state === 'pending'
  const bulkable = pending && canEdit && p.op !== 'remove'
  const evidence = showAll ? p.evidence : p.evidence.slice(0, 2)
  const title = pick(p.title, p.title_en)

  return (
    <article className={cn('rounded-card border bg-panel p-4 sm:p-5', selected ? 'border-primary/50' : 'border-line')} aria-label={title}>
      <header className="flex items-start gap-3">
        {bulkable ? (
          <div className="pt-0.5">
            <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={t('curation.select', { title })} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={OP_TONE[p.op]}>{t(`curation.ops.${p.op}`)}</Badge>
            <Badge tone={PRIORITY_TONE[p.priority]} outline>
              {t('curation.priority')}: {t(`curation.levels.${p.priority}`)}
            </Badge>
            {!pending ? (
              <Badge tone={p.state === 'accepted' ? 'success' : 'neutral'}>{t(`curation.states.${p.state}`)}</Badge>
            ) : null}
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold leading-snug">{title}</h3>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
        <Metric label={t('curation.confidence')} value={`${Math.round(p.confidence * 100)}%`} />
        <Metric
          label={t('curation.risk')}
          value={
            <Badge tone={RISK_TONE[p.risk]} size="sm">
              {t(`curation.levels.${p.risk}`)}
            </Badge>
          }
        />
        <Metric label={t('curation.occurrences')} value={String(p.occurrences)} />
        <Metric label={t('curation.distinctSources')} value={String(p.distinct_sources)} />
        <Metric
          label={t('curation.signal')}
          value={
            <Tooltip content={t(`curation.signals.${p.signal}.meaning`)}>
              <span tabIndex={0} className="inline-flex cursor-help items-center gap-1.5">
                <Badge tone="accent" shape="tag" size="sm">
                  {p.signal}
                </Badge>
                <span className="text-xs text-muted">{t(`curation.signals.${p.signal}.name`)}</span>
              </span>
            </Tooltip>
          }
        />
      </dl>

      <p className="mt-3 text-sm text-ink/90">{pick(p.rationale, p.rationale_en)}</p>

      {p.target ? (
        <p className="mt-3 text-xs text-muted">
          {t('curation.target')}: <span className="font-medium text-ink">{p.target.title}</span>
        </p>
      ) : null}

      <div className="mt-3">
        {p.op === 'update' && p.target ? (
          <DiffView current={p.target.content} proposed={p.proposed_content} />
        ) : p.op === 'remove' ? (
          <div>
            <p className="mb-2 rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{t('curation.removeNote')}</p>
            {p.target ? <p className="whitespace-pre-wrap rounded-ctl border border-line px-3 py-2.5 text-sm text-muted line-through decoration-danger/50">{p.target.content}</p> : null}
          </div>
        ) : (
          <div className="rounded-ctl border border-success/30 bg-success/8">
            <div className="border-b border-success/20 px-3 py-1.5 text-xs font-medium text-success">{t('curation.newDocument')}</div>
            <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed">{p.proposed_content}</p>
          </div>
        )}
      </div>

      {p.suggested_tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t('curation.tags')}</span>
          {p.suggested_tags.map((tag) => (
            <Badge key={tag} shape="tag" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {p.evidence.length > 0 ? (
        <section className="mt-4">
          <h4 className="mb-2 text-sm font-medium">{t('curation.evidence', { count: p.evidence.length })}</h4>
          <ul className="space-y-2">
            {evidence.map((item, i) => (
              <Evidence key={i} item={item} />
            ))}
          </ul>
          {p.evidence.length > 2 ? (
            <Button variant="link" size="xs" className="mt-1" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('curation.showFewer') : t('curation.showAll', { count: p.evidence.length })}
            </Button>
          ) : null}
        </section>
      ) : null}

      {p.apply_error ? <p className="mt-3 text-sm text-danger">{p.apply_error}</p> : null}

      {pending ? (
        canEdit ? (
          <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="primary" size="sm" loading={busy} icon={<Check className="size-4" />} onClick={onAccept}>
              {t('curation.accept')}
            </Button>
            {p.op !== 'remove' ? (
              <Button variant="secondary" size="sm" disabled={busy} icon={<PencilLine className="size-4" />} onClick={onEdit}>
                {t('curation.acceptEdit')}
              </Button>
            ) : null}
            <Button variant="danger-ghost" size="sm" disabled={busy} icon={<X className="size-4" />} onClick={onDecline}>
              {t('curation.declineButton')}
            </Button>
          </footer>
        ) : null
      ) : (
        <footer className="mt-4 border-t border-line pt-3 text-xs text-muted">
          {p.state === 'accepted'
            ? t('curation.acceptedBy', { name: p.decided_by ?? '-', when: f.dateTime(p.decided_at) })
            : t('curation.declinedBy', { name: p.decided_by ?? '-', when: f.dateTime(p.decided_at) })}
          {p.decline_reason ? <span className="mt-1 block text-ink/80">{t('curation.reason')}: {p.decline_reason}</span> : null}
        </footer>
      )}
    </article>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="caps text-[11px] text-muted">{label}</dt>
      <dd className="tabular mt-0.5">{value}</dd>
    </div>
  )
}
