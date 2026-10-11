import { memo, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { HoverCard } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { Claim, Recording, Segment, SpanLevel } from '@/types'
import { claimClass, piecesFor, worstLevels, worstVerdict } from '../lib'
import { EvidenceBlock, VerdictBadge } from './claimParts'

const stripCls: Record<SpanLevel, string> = { good: 'bg-success/55', mid: 'bg-warning/80', bad: 'bg-danger/85' }

interface RowProps {
  seg: Segment
  role: 'agent' | 'customer'
  text: string
  claims: Claim[]
  level: SpanLevel | null
  active: boolean
  timed: boolean
  claimText: (c: Claim) => string
  onSeek: (seconds: number | null, index: number) => void
  speakerLabel: string
  glossOn: boolean
}

const Row = memo(function Row({ seg, role, text, claims, level, active, timed, claimText, onSeek, speakerLabel }: RowProps) {
  const { t } = useTranslation('workbench')
  const pieces = useMemo(() => (claims.length > 0 ? piecesFor(text, claims, claimText) : null), [text, claims, claimText])
  return (
    <div
      id={`seg-${seg.i}`}
      role="button"
      tabIndex={0}
      onClick={() => onSeek(seg.start, seg.i)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSeek(seg.start, seg.i)
      }}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative flex cursor-pointer gap-3 rounded-ctl py-2 pr-3 pl-3.5 transition-colors hover:bg-sunken/70',
        role === 'customer' && 'sm:ml-10',
        active && 'bg-primary/10 hover:bg-primary/10',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-1.5 left-0 w-1 rounded-full', level ? stripCls[level] : 'bg-line')}
        title={level ? t(`levels.${level}`) : undefined}
      />
      <span className="w-11 shrink-0 pt-0.5 text-right font-mono text-[11px] tabular text-subtle">
        {timed ? formatClock(seg.start) : `#${seg.i + 1}`}
      </span>
      <span aria-hidden className={cn('w-0.5 shrink-0 rounded-full', role === 'agent' ? 'bg-primary' : 'bg-line-strong')} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-[11px] font-medium', role === 'agent' ? 'text-primary' : 'text-muted')}>{speakerLabel}</div>
        <p className={cn('text-sm leading-relaxed', role === 'agent' ? 'text-ink' : 'text-ink/75')}>
          {pieces
            ? pieces.map((piece, idx) =>
                piece.claims.length === 0 ? (
                  <span key={idx}>{piece.text}</span>
                ) : (
                  <HoverCard
                    key={idx}
                    width={340}
                    trigger={
                      <span tabIndex={0} className={cn('cursor-help rounded-sm', claimClass[worstVerdict(piece.claims)])}>
                        {piece.text}
                      </span>
                    }
                  >
                    <div className="space-y-3">
                      {piece.claims.map((c) => (
                        <div key={c.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <VerdictBadge verdict={c.verdict} />
                            <span className="text-[11px] text-muted">{c.category}</span>
                          </div>
                          <p className="text-xs text-ink">{claimText(c)}</p>
                          <EvidenceBlock claim={c} />
                        </div>
                      ))}
                    </div>
                  </HoverCard>
                ),
              )
            : text}
        </p>
      </div>
    </div>
  )
})

export function Transcript({
  rec,
  activeIndex,
  focus,
  onSeek,
}: {
  rec: Recording
  activeIndex: number | null
  /** Scroll request: the same index twice still scrolls because `n` changes. */
  focus: { i: number; n: number } | null
  onSeek: (seconds: number | null, index: number) => void
}) {
  const { t } = useTranslation('workbench')
  const { pick, active: glossActive } = useGloss()
  const levels = useMemo(() => worstLevels(rec), [rec])
  const agent = rec.scoring?.operator_speaker ?? 'speaker_0'
  const timed = rec.source === 'audio' && rec.segments.some((s) => s.start !== null)
  const claimsBySeg = useMemo(() => {
    const map = new Map<number, Claim[]>()
    for (const claim of rec.kb_check?.claims ?? []) {
      for (const i of claim.segments.slice(0, 1)) map.set(i, [...(map.get(i) ?? []), claim])
    }
    return map
  }, [rec.kb_check])
  const claimText = useMemo(() => (c: Claim) => pick(c.claim, c.claim_en), [pick])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focus) return
    listRef.current?.querySelector<HTMLElement>(`#seg-${focus.i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])

  return (
    <section aria-label={t('transcript.title')} className="rounded-card border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-sm font-medium">{t('transcript.title')}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className={cn('claim-supported')}>{t('transcript.legendSupported')}</span>
          <span className="claim-contradicted">{t('transcript.legendContradicted')}</span>
          <span className="claim-not-in-kb">{t('transcript.legendNotInKb')}</span>
        </div>
      </header>
      <div ref={listRef} className="p-2">
        {rec.segments.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t('transcript.empty')}</p>
        ) : (
          rec.segments.map((seg) => {
            const role = seg.speaker === agent ? 'agent' : 'customer'
            return (
              <Row
                key={seg.i}
                seg={seg}
                role={role}
                text={pick(seg.text, seg.text_en)}
                claims={claimsBySeg.get(seg.i) ?? EMPTY}
                level={levels.get(seg.i) ?? null}
                active={activeIndex === seg.i}
                timed={timed}
                claimText={claimText}
                onSeek={onSeek}
                speakerLabel={t(`common:speakers.${role}`)}
                glossOn={glossActive}
              />
            )
          })
        )}
      </div>
    </section>
  )
}

const EMPTY: Claim[] = []
