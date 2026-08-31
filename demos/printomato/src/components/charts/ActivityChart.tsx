import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDayShort, formatNumber } from '@/lib/format'
import type { ActivityPoint } from '@/types'

/**
 * Daily print counts.
 *
 * Bars rather than an area: the days are discrete buckets and the operator's
 * question is "which day spiked", not "what is the trend curve". One series, so
 * no legend — the panel title names it — and only the peak carries a direct
 * label, per the selective-labelling rule.
 */
export function ActivityChart({ data, className }: { data: ActivityPoint[]; className?: string }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)

  const { max, peakIndex, total, ticks } = useMemo(() => {
    let maxValue = 0
    let peak = -1
    let sum = 0

    data.forEach((point, index) => {
      sum += point.count
      if (point.count > maxValue) {
        maxValue = point.count
        peak = index
      }
    })

    // Round the ceiling up to something a human reads off an axis.
    const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(Math.max(maxValue, 1))))
    const step = magnitude / 2 || 1
    // Kept even so the midpoint gridline is a whole number of prints: a peak of
    // 14 would otherwise label the axis 15 / 7.5 / 0.
    const rounded = Math.max(magnitude, Math.ceil(maxValue / step) * step)
    const ceiling = rounded % 2 ? rounded + 1 : rounded

    return {
      max: maxValue === 0 ? 1 : ceiling,
      peakIndex: maxValue === 0 ? -1 : peak,
      total: sum,
      ticks: [ceiling, ceiling / 2, 0],
    }
  }, [data])

  if (!data.length) return null

  const labelEvery = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className={cn('relative', className)}>
      {total === 0 && (
        <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-ink-faint">
          {t('dashboard.noActivity')}
        </p>
      )}

      <div className="flex gap-3">
        {/* Y axis — three recessive ticks, no axis line. */}
        <div className="numeral flex w-9 shrink-0 flex-col justify-between py-px text-right text-[10px] text-ink-faint/80">
          {ticks.map((tick) => (
            <span key={tick}>{formatNumber(tick)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="relative h-40 sm:h-48"
            onMouseLeave={() => setHovered(null)}
            role="img"
            aria-label={`Print activity across ${data.length} days, ${formatNumber(total)} prints in total`}
          >
            {/* Recessive gridlines behind the marks. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={cn('h-px w-full', tick === 0 ? 'bg-white/12' : 'bg-white/[0.045]')}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-end gap-[3px]">
              {data.map((point, index) => {
                const ratio = point.count / max
                const isHovered = hovered === index
                const isPeak = index === peakIndex && point.count > 0

                return (
                  <div
                    key={point.date}
                    className="group relative flex h-full flex-1 cursor-default items-end"
                    onMouseEnter={() => setHovered(index)}
                  >
                    {/* Full-height hit target so thin bars stay hoverable. */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-0 rounded-t-[4px] transition-colors duration-100',
                        isHovered ? 'bg-white/5' : 'bg-transparent',
                      )}
                    />
                    <div
                      className={cn(
                        'relative w-full rounded-t-[4px] transition-all duration-150',
                        point.count === 0 && 'bg-white/8',
                      )}
                      style={{
                        height: point.count === 0 ? '2px' : `${Math.max(ratio * 100, 2.5)}%`,
                        background:
                          point.count === 0
                            ? undefined
                            : isHovered || isPeak
                              ? 'linear-gradient(180deg, #ffd48a 0%, #f8be62 100%)'
                              : 'linear-gradient(180deg, rgba(248,190,98,0.85) 0%, rgba(248,190,98,0.40) 100%)',
                      }}
                    />

                    {(isHovered || (isPeak && hovered === null)) && point.count > 0 && (
                      <div
                        className={cn(
                          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2',
                          'rounded-md border border-hairline-strong bg-surface-3 px-2 py-1 shadow-raised',
                          'whitespace-nowrap',
                        )}
                      >
                        <span className="numeral text-xs font-semibold text-gold">
                          {formatNumber(point.count)}
                        </span>
                        <span className="ml-1.5 text-[10px] text-ink-faint">
                          {formatDayShort(point.date)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* X axis — thinned so labels never collide. */}
          <div className="mt-2 flex gap-[3px]">
            {data.map((point, index) => (
              <span
                key={point.date}
                className="numeral flex-1 truncate text-center text-[10px] text-ink-faint/75"
              >
                {index % labelEvery === 0 ? formatDayShort(point.date) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
