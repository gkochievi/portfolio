import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { diffStats, diffWords, sideOf, type DiffRun } from '../lib/diff'

function Pane({ runs, side, label }: { runs: DiffRun[]; side: 'old' | 'new'; label: string }) {
  return (
    <div className="min-w-0 rounded-ctl border border-line">
      <div
        className={cn(
          'flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs font-medium',
          side === 'old' ? 'bg-danger/8 text-danger' : 'bg-success/10 text-success',
        )}
      >
        <span className={cn('size-2 rounded-full', side === 'old' ? 'bg-danger' : 'bg-success')} aria-hidden />
        {label}
      </div>
      <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-relaxed">
        {runs.map((run, i) =>
          run.op === '-' ? (
            <del key={i} className="rounded-sm bg-danger/15 text-danger decoration-danger/60">
              {run.text}
            </del>
          ) : run.op === '+' ? (
            <ins key={i} className="rounded-sm bg-success/15 text-ink no-underline">
              {run.text}
            </ins>
          ) : (
            <span key={i}>{run.text}</span>
          ),
        )}
      </p>
    </div>
  )
}

/** Current passage vs proposed text, with changed words marked on each side. */
export function DiffView({ current, proposed }: { current: string; proposed: string }) {
  const { t } = useTranslation('kbQuality')
  const runs = useMemo(() => diffWords(current, proposed), [current, proposed])
  const stats = useMemo(() => diffStats(runs), [runs])
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-2">
        <Pane runs={sideOf(runs, 'old')} side="old" label={t('curation.diff.current')} />
        <Pane runs={sideOf(runs, 'new')} side="new" label={t('curation.diff.proposed')} />
      </div>
      <p className="text-xs text-muted">{t('curation.diff.stats', { added: stats.added, removed: stats.removed })}</p>
    </div>
  )
}
