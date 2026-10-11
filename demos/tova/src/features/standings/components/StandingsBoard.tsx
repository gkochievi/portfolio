/**
 * The standings board. Wide screens get the booth/TV layout: a podium of the
 * top three (left 40%) beside the ranked list (right 60%). Phones get the list
 * alone. Rows reorder with FLIP (framer-motion `layout`, 300 ms), new entries
 * slide in, and a score that just went up floats a "+N" chip.
 */
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { flip, slideIn, useReducedMotion } from '@/lib/motion'
import type { LeaderRow } from '@/types'

type KeyedRow = LeaderRow & { key: string }

/** Stable keys: the user id for staff, else name+company (deduped). */
function keyRows(rows: LeaderRow[]): KeyedRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const base = row.userId ?? `${row.name}|${row.company}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return { ...row, key: count ? `${base}#${count}` : base }
  })
}

/** Score increases since the previous board, shown for ~1.6 s. */
function useScoreDeltas(rows: KeyedRow[]): Record<string, number> {
  const previous = useRef<Map<string, number> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  useEffect(() => {
    const next: Record<string, number> = {}
    const before = previous.current
    if (before) {
      for (const row of rows) {
        const old = before.get(row.key)
        if (old !== undefined && row.score > old) next[row.key] = row.score - old
      }
    }
    previous.current = new Map(rows.map((row) => [row.key, row.score]))
    if (Object.keys(next).length > 0) {
      setDeltas(next)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDeltas({}), 1600)
    }
  }, [rows])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return deltas
}

const RANK_DISC = [
  'bg-accent text-on-accent',
  'bg-primary text-on-primary',
  'bg-ink text-surface',
] as const

function RankDisc({ rank }: { rank: number }) {
  const top = rank <= 3
  return (
    <span
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full font-mono text-sm font-bold tabular-nums',
        top ? RANK_DISC[rank - 1] : 'bg-sunken text-muted',
      )}
    >
      {rank}
    </span>
  )
}

const GRID = 'grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[3rem_minmax(0,1.25fr)_minmax(0,1fr)_6.5rem]'

export interface StandingsBoardProps {
  rows: LeaderRow[] | undefined
  loading?: boolean
  /** Staff only: makes rows (and podium steps) open the drill-down. */
  onSelect?: (row: LeaderRow) => void
  /** Show the podium beside the list on wide screens. */
  podium?: boolean
  className?: string
}

export function StandingsBoard({ rows, loading, onSelect, podium = true, className }: StandingsBoardProps) {
  const { t } = useTranslation('standings')
  const keyed = useMemo(() => keyRows(rows ?? []), [rows])
  const deltas = useScoreDeltas(keyed)

  if (loading || !rows) return <BoardSkeleton podium={podium} />

  return (
    <LayoutGroup>
      <div className={cn(podium && 'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-8', className)}>
        {podium && <Podium rows={keyed.slice(0, 3)} onSelect={onSelect} deltas={deltas} />}
        <section aria-label={t('boardLabel', { count: rows.length })} className="min-w-0">
          <div className={cn(GRID, 'border-b-[1.5px] border-line px-3 pb-2 text-xs font-semibold text-muted sm:px-4')} aria-hidden>
            <span>{t('columns.rank')}</span>
            <span>{t('columns.entrant')}</span>
            <span className="hidden sm:block">{t('columns.company')}</span>
            <span className="text-right">{t('columns.points')}</span>
          </div>
          <ol className="relative">
            <AnimatePresence initial={false}>
              {keyed.map((row) => (
                <BoardRow key={row.key} row={row} delta={deltas[row.key]} onSelect={onSelect} />
              ))}
            </AnimatePresence>
          </ol>
        </section>
      </div>
    </LayoutGroup>
  )
}

function DeltaChip({ value }: { value: number | undefined }) {
  const { i18n } = useTranslation()
  if (!value) return null
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-3 right-0 animate-float-up rounded-chip bg-accent px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-on-accent"
    >
      +{formatNumber(value, i18n.language)}
    </span>
  )
}

function BoardRow({ row, delta, onSelect }: { row: KeyedRow; delta: number | undefined; onSelect?: (row: LeaderRow) => void }) {
  const { t, i18n } = useTranslation('standings')
  const reduced = useReducedMotion()
  const top = row.rank <= 3

  const cells: ReactNode = (
    <>
      <RankDisc rank={row.rank} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate', top ? 'font-bold' : 'font-semibold')}>{row.name}</span>
          {row.isMe && (
            <Badge tone="accent" size="sm">
              {t('you')}
            </Badge>
          )}
        </span>
        <span className="block truncate text-xs text-muted sm:hidden">{row.company}</span>
      </span>
      <span className="hidden truncate text-sm text-muted sm:block">{row.company}</span>
      <span className="relative flex items-center justify-end gap-1">
        <span className={cn('font-mono tabular-nums', top ? 'text-lg font-bold' : 'text-base font-semibold')}>
          {formatNumber(row.score, i18n.language)}
        </span>
        <DeltaChip value={delta} />
        {onSelect && <ChevronRight className="-mr-1 size-4 text-muted" aria-hidden />}
      </span>
    </>
  )

  const rowClass = cn(
    GRID,
    'min-h-14 w-full border-b border-line px-3 py-2 text-left sm:px-4',
    row.isMe ? 'bg-own-row' : top ? 'bg-sunken/60' : '',
  )

  return (
    <motion.li
      layout={reduced ? false : 'position'}
      transition={flip}
      variants={slideIn}
      initial={reduced ? false : 'hidden'}
      animate="show"
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
      aria-current={row.isMe ? 'true' : undefined}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(row)}
          aria-label={t('rowAction', { name: row.name })}
          className={cn(rowClass, 'cursor-pointer transition-colors hover:bg-primary-soft focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary')}
        >
          {cells}
        </button>
      ) : (
        <div className={rowClass}>{cells}</div>
      )}
    </motion.li>
  )
}

/* ---------------------------------------------------------------- podium */

const STEP = {
  1: { order: 'order-2', height: 'h-52', fill: 'bg-accent text-on-accent' },
  2: { order: 'order-1', height: 'h-40', fill: 'bg-primary text-on-primary' },
  3: { order: 'order-3', height: 'h-28', fill: 'bg-ink text-surface' },
} as const

function Podium({
  rows,
  onSelect,
  deltas,
}: {
  rows: KeyedRow[]
  onSelect?: (row: LeaderRow) => void
  deltas: Record<string, number>
}) {
  const { t, i18n } = useTranslation('standings')
  const reduced = useReducedMotion()
  return (
    <section aria-label={t('podium')} className="mb-8 hidden lg:mb-0 lg:block">
      <div className="flex items-end gap-3">
        {([1, 2, 3] as const).map((place) => {
          const row = rows[place - 1]
          const step = STEP[place]
          const label = (
            <div className="relative mb-3 min-h-[5.5rem] px-1 text-center">
              {row ? (
                <>
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="truncate text-xs text-muted">{row.company}</p>
                  <p className="relative mt-1 inline-flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-bold tabular-nums">{formatNumber(row.score, i18n.language)}</span>
                    <span className="text-xs text-muted">{t('pts')}</span>
                    <DeltaChip value={deltas[row.key]} />
                  </p>
                  {row.isMe && (
                    <div className="mt-1">
                      <Badge tone="accent" size="sm">
                        {t('you')}
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                <p className="pt-10 text-sm text-muted">—</p>
              )}
            </div>
          )
          const bar = (
            <motion.div
              layout={reduced ? false : true}
              transition={flip}
              className={cn(
                'flex w-full items-start justify-center rounded-t-hero pt-3',
                step.height,
                row ? step.fill : 'border-[1.5px] border-dashed border-line bg-transparent text-muted',
              )}
            >
              <span className="font-display text-7xl leading-none tabular-nums" aria-hidden>
                {place}
              </span>
            </motion.div>
          )
          const content = (
            <>
              {label}
              {bar}
            </>
          )
          return (
            <div key={place} className={cn('flex min-w-0 flex-1 flex-col', step.order)}>
              <span className="sr-only">{t('place', { rank: place })}</span>
              {row && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  aria-label={t('rowAction', { name: row.name })}
                  className="flex w-full cursor-pointer flex-col rounded-t-hero transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </div>
          )
        })}
      </div>
      <div className="h-1.5 rounded-full bg-line" aria-hidden />
    </section>
  )
}

function BoardSkeleton({ podium }: { podium: boolean }) {
  return (
    <div className={cn(podium && 'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-end lg:gap-8')} aria-busy="true">
      {podium && (
        <div className="hidden items-end gap-3 lg:flex">
          <Skeleton className="h-40 flex-1" />
          <Skeleton className="h-52 flex-1" />
          <Skeleton className="h-28 flex-1" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
