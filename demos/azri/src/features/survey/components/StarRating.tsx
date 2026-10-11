import { motion, useReducedMotion } from 'framer-motion'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { STAR_SVG_PATH } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface StarRatingProps {
  /** 0 = not rated yet. */
  value: number
  onChange: (value: number) => void
  /** Accessible name of the group (the question text). */
  label: string
  disabled?: boolean
  max?: number
}

/**
 * Interactive 1-5 star control for the respondent form.
 * - five 52px targets; outline stars when inactive, 1..N filled with var(--brand);
 * - hover / focus preview, arrow keys, Home / End (radiogroup with roving tabindex);
 * - a 1 -> 1.15 -> 1 pulse on the chosen star (opacity-only under reduced motion);
 * - like the source, a rating can be changed but never cleared back to 0.
 */
export function StarRating({ value, onChange, label, disabled, max = 5 }: StarRatingProps) {
  const { t } = useTranslation(['survey', 'common'])
  const reduceMotion = useReducedMotion()
  const [preview, setPreview] = useState(0)
  const [pulse, setPulse] = useState(0)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const shown = preview || value
  const focusIndex = value > 0 ? value - 1 : 0

  const choose = (next: number, focus = false) => {
    if (disabled) return
    const clamped = Math.min(max, Math.max(1, next))
    if (clamped !== value) {
      onChange(clamped)
      setPulse((count) => count + 1)
    }
    if (focus) refs.current[clamped - 1]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
    const base = value || star
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = base + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = base - 1
    else if (event.key === 'Home') next = 1
    else if (event.key === 'End') next = max
    else if (event.key === ' ' || event.key === 'Enter') next = star
    if (next === null) return
    event.preventDefault()
    setPreview(0)
    choose(next, true)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className="flex w-full items-center justify-between gap-1"
      onMouseLeave={() => setPreview(0)}
    >
      {Array.from({ length: max }, (_, index) => {
        const star = index + 1
        const filled = star <= shown
        const isPreview = preview > 0 && preview !== value && star <= preview
        const pulsing = star === value && pulse > 0
        return (
          <button
            key={star}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={t('survey:question.star', { count: star, label: t(`common:rating.${star}`) })}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => choose(star)}
            onKeyDown={(event) => onKeyDown(event, star)}
            onMouseEnter={() => !disabled && setPreview(star)}
            onFocus={() => !disabled && value === 0 && setPreview(star)}
            onBlur={() => setPreview(0)}
            className={cn(
              'group grid size-[52px] shrink-0 place-items-center rounded-2xl outline-none transition-colors duration-150 ease-azri',
              'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel',
              'hover:bg-brand-tint disabled:cursor-not-allowed',
            )}
          >
            <motion.svg
              key={pulsing ? `pulse-${pulse}` : 'still'}
              viewBox="0 0 24 24"
              width={36}
              height={36}
              aria-hidden="true"
              initial={false}
              animate={
                pulsing
                  ? reduceMotion
                    ? { opacity: [0.55, 1] }
                    : { scale: [1, 1.15, 1] }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: reduceMotion ? 0.2 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-visible"
            >
              <path
                d={STAR_SVG_PATH}
                strokeWidth={1.75}
                strokeLinejoin="round"
                className={cn(
                  'transition-[fill,stroke,opacity] duration-150 ease-azri',
                  filled ? 'fill-brand stroke-brand' : 'fill-transparent stroke-subtle group-hover:stroke-brand',
                  isPreview && 'opacity-55',
                )}
              />
            </motion.svg>
          </button>
        )
      })}
    </div>
  )
}
