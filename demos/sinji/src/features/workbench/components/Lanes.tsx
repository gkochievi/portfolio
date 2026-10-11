import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FilterChip, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { SpanLevel } from '@/types'
import type { Lane, LaneSpan } from '../lib'

const levelCls: Record<SpanLevel, string> = {
  good: 'bg-success/65 hover:bg-success',
  mid: 'bg-warning/75 hover:bg-warning',
  bad: 'bg-danger/80 hover:bg-danger',
}
const dotCls: Record<SpanLevel, string> = { good: 'bg-success/65', mid: 'bg-warning/75', bad: 'bg-danger/80' }

export function Lanes({
  lanes,
  duration,
  time,
  onSeek,
}: {
  lanes: Lane[]
  duration: number
  time: number
  onSeek: (seconds: number, segmentIndex?: number) => void
}) {
  const { t } = useTranslation('workbench')
  const { pick } = useGloss()
  const defaults = useMemo(
    () => new Set(lanes.filter((l) => l.kind !== 'dimension' || l.spans.some((s) => s.level === 'bad')).map((l) => l.id)),
    [lanes],
  )
  const [chosen, setChosen] = useState<Set<string> | null>(null)
  const enabled = chosen ?? defaults

  const laneName = (lane: Lane) => (lane.kind === 'dimension' ? pick(lane.name, lane.name_en) : t(`lanes.${lane.kind}`))
  const toggle = (id: string) => {
    const next = new Set(enabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
  }

  if (lanes.length === 0 || duration <= 0) return null
  const visible = lanes.filter((l) => enabled.has(l.id))

  const tip = (lane: Lane, span: LaneSpan) => (
    <div className="max-w-64 space-y-0.5 text-xs">
      <div className="font-medium">
        {laneName(lane)} <span className="font-mono text-muted">{formatClock(span.start)}-{formatClock(span.end)}</span>
      </div>
      <div className="text-muted">
        {t(`levels.${span.level}`)}
        {span.label && lane.kind !== 'dimension' ? ` · ${lane.kind === 'factcheck' ? t(`common:verdicts.${span.label}`, { defaultValue: span.label }) : span.label}` : ''}
        {lane.kind === 'dimension' ? ` · ${span.label}` : ''}
      </div>
      {span.detail ? <div className="line-clamp-4">{span.detail}</div> : null}
    </div>
  )

  return (
    <section aria-label={t('lanes.title')} className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-sm font-medium">{t('lanes.title')}</h3>
        {lanes.map((l) => (
          <FilterChip key={l.id} active={enabled.has(l.id)} onClick={() => toggle(l.id)}>
            {laneName(l)}
          </FilterChip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          {visible.map((l) => (
            <div key={l.id} className="flex h-4 items-center truncate text-[11px] leading-none text-muted" title={laneName(l)}>
              <span className="truncate">{laneName(l)}</span>
            </div>
          ))}
        </div>
        <div className="relative space-y-1.5">
          {visible.map((lane) => (
            <div key={lane.id} className="relative h-4 rounded-sm bg-sunken" role="group" aria-label={laneName(lane)}>
              {lane.spans.map((span, idx) => (
                <Tooltip key={idx} content={tip(lane, span)} side="top">
                  <button
                    type="button"
                    onClick={() => onSeek(span.start, span.segments[0])}
                    className={cn('absolute inset-y-0 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1', levelCls[span.level])}
                    style={{ left: `${(span.start / duration) * 100}%`, width: `${Math.max(0.6, ((span.end - span.start) / duration) * 100)}%` }}
                    aria-label={`${laneName(lane)} ${formatClock(span.start)} ${t(`levels.${span.level}`)}`}
                  />
                </Tooltip>
              ))}
            </div>
          ))}
          {visible.length > 0 ? (
            <span className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: `${Math.min(100, (time / duration) * 100)}%` }} />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {(['good', 'mid', 'bad'] as const).map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', dotCls[level])} />
            {t(`levels.${level}`)}
          </span>
        ))}
      </div>
    </section>
  )
}
