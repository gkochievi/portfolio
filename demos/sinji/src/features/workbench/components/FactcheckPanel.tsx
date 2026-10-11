import { Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, FilterChip, Meter } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatClock, formatPercent } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { AnalysisPanelProps } from '@/features/analysis'
import type { Claim, Verdict } from '@/types'
import { EvidenceBlock, VerdictBadge } from './claimParts'

const ORDER: Verdict[] = ['CONTRADICTED', 'PARTIALLY_SUPPORTED', 'NOT_IN_KB', 'SUPPORTED']

export function FactcheckPanel({ recording, onSeek }: AnalysisPanelProps) {
  const { t, i18n } = useTranslation('workbench')
  const { pick } = useGloss()
  const [filter, setFilter] = useState<Verdict | 'all'>('all')
  const fc = recording.kb_check
  if (!fc) return null

  const counts: Record<Verdict, number> = {
    SUPPORTED: fc.counts.supported,
    PARTIALLY_SUPPORTED: fc.counts.partially_supported,
    CONTRADICTED: fc.counts.contradicted,
    NOT_IN_KB: fc.counts.not_in_kb,
  }
  const claims = [...fc.claims].sort((a, b) => (a.start ?? a.segments[0] ?? 0) - (b.start ?? b.segments[0] ?? 0))
  const shown = filter === 'all' ? claims : claims.filter((c) => c.verdict === filter)

  const seekTo = (c: Claim) => onSeek(c.start, c.segments[0])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="caps text-subtle">{t('fact.accuracy')}</div>
          <div className="tabular font-display text-4xl leading-none">
            {fc.accuracy_score === null ? '-' : `${fc.accuracy_score}`}
            {fc.accuracy_score === null ? null : <span className="ml-0.5 text-lg text-muted">%</span>}
          </div>
        </div>
        <div className="w-32 pb-1.5">
          <Meter value={fc.accuracy_score ?? 0} />
        </div>
      </div>
      <p className="text-xs text-muted">{fc.accuracy_score === null ? t('fact.noScore') : t('fact.formula')}</p>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={fc.counts.total}>
          {t('common:all')}
        </FilterChip>
        {ORDER.map((v) => (
          <FilterChip key={v} active={filter === v} onClick={() => setFilter(filter === v ? 'all' : v)} count={counts[v]}>
            {t(`common:verdicts.${v}`)}
          </FilterChip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-ctl border border-dashed border-line p-4 text-center text-sm text-muted">
          {fc.counts.total === 0 ? t('fact.noClaims') : t('common:empty.noResults')}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <li
              key={c.id}
              className={cn(
                'rounded-card border p-3 transition-colors',
                c.verdict === 'CONTRADICTED' ? 'border-danger/45 bg-danger/6' : 'border-line bg-panel',
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <VerdictBadge verdict={c.verdict} />
                <Badge size="sm" tone="neutral" outline>
                  {t(`common:speakers.${c.speaker}`)}
                </Badge>
                <Badge size="sm" tone="neutral" outline>
                  {c.category}
                </Badge>
                <button
                  type="button"
                  onClick={() => seekTo(c)}
                  className="ml-auto inline-flex items-center gap-1 rounded-ctl px-1.5 py-0.5 font-mono text-[11px] tabular text-muted hover:bg-sunken hover:text-ink"
                  aria-label={t('fact.seek')}
                >
                  <Clock className="size-3" strokeWidth={1.75} />
                  {c.start === null ? `#${(c.segments[0] ?? 0) + 1}` : formatClock(c.start)}
                </button>
              </div>
              <button type="button" onClick={() => seekTo(c)} className="mt-2 block w-full text-left text-sm text-ink">
                {pick(c.claim, c.claim_en)}
              </button>
              <p className="mt-1.5 text-xs text-muted">{pick(c.rationale, c.rationale_en)}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <span>{t('fact.confidence')}</span>
                <span className="tabular font-mono text-ink">{formatPercent(c.confidence, i18n.language)}</span>
              </div>
              <div className="mt-2">
                <EvidenceBlock claim={c} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
