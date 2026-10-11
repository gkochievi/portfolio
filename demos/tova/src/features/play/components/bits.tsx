/** Small pieces of the game screen: top bar, timer ring, score, flake burst, count-up, item labels. */
import { motion } from 'framer-motion'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { FlakeGlyph, Lockup } from '@/components/brand'
import { useLang } from '@/i18n'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { LanguageToggle } from '@/shell/controls'

/** Localised item names (sponsor brands keep their own spelling in English). */
export function useItemLabel(): (name: string) => string {
  const { t, i18n } = useTranslation('play')
  return useMemo(() => {
    const map = t('itemNames', { returnObjects: true }) as Record<string, string> | string
    return (name: string) => (typeof map === 'object' && map[name]) || name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language])
}

/** Logo home link + KA/EN toggle, shown outside the live round. */
export function PlayTopBar({ className }: { className?: string }) {
  const { t } = useTranslation('play')
  const lang = useLang()
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Link to="/" aria-label={t('home')} className="rounded-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <Lockup size={28} lang={lang} compact />
      </Link>
      <LanguageToggle />
    </div>
  )
}

const RING_R = 22
export const RING_C = 2 * Math.PI * RING_R

/**
 * The round timer, top-left: a glacier ring that depletes clockwise, turns
 * persimmon and pulses in the last 10 s. The ring's arc is driven per frame
 * through the forwarded ref (no re-render); under reduced motion it is a number only.
 */
export const TimerRing = forwardRef<SVGCircleElement, { seconds: number; reducedMotion: boolean }>(function TimerRing(
  { seconds, reducedMotion },
  ref,
) {
  const { t, i18n } = useTranslation('play')
  const hot = seconds <= 10
  if (reducedMotion) {
    return (
      <div className="rounded-card border-[1.5px] border-line bg-panel px-3 py-1.5 shadow-card" role="timer" aria-label={t('hud.secondsLeft', { count: seconds })}>
        <div className="text-[11px] font-semibold text-muted">{t('hud.time')}</div>
        <div className={cn('font-mono text-2xl font-bold tabular-nums leading-tight', hot ? 'text-accent-ink' : 'text-ink')}>
          {formatNumber(seconds, i18n.language)}
        </div>
      </div>
    )
  }
  return (
    <div
      className={cn('relative grid size-[60px] place-items-center rounded-full bg-panel shadow-card', hot && 'animate-timer-pulse')}
      role="timer"
      aria-label={t('hud.secondsLeft', { count: seconds })}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={RING_R} fill="none" strokeWidth="5" className="stroke-sunken" />
        <circle
          ref={ref}
          cx="28"
          cy="28"
          r={RING_R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={`${RING_C} ${RING_C}`}
          strokeDashoffset={0}
          className={cn('transition-colors', hot ? 'stroke-accent' : 'stroke-primary')}
        />
      </svg>
      <span className={cn('relative font-mono text-lg font-bold tabular-nums', hot ? 'text-accent-ink' : 'text-ink')}>{seconds}</span>
    </div>
  )
})

export function ScoreBox({ score }: { score: number }) {
  const { t, i18n } = useTranslation('play')
  return (
    <div className="min-w-[96px] rounded-card border-[1.5px] border-line bg-panel px-3 py-1.5 text-right shadow-card">
      <div className="text-[11px] font-semibold text-muted">{t('hud.score')}</div>
      <div className={cn('font-mono text-2xl font-bold tabular-nums leading-tight', score < 0 ? 'text-danger' : 'text-ink')}>
        {score < 0 ? '−' : ''}
        {formatNumber(Math.abs(score), i18n.language)}
      </div>
    </div>
  )
}

/** A one-shot burst of at most 40 flakes (one persimmon disc) from the centre. */
export function FlakeBurst({ count = 36 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: Math.min(40, count) }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
        const dist = 110 + Math.random() * 170
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.8 + 40,
          rotate: (Math.random() - 0.5) * 360,
          size: 10 + Math.random() * 12,
          delay: Math.random() * 0.12,
          duration: 0.9 + Math.random() * 0.6,
          persimmon: i === 0,
        }
      }),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[34%] z-0 flex justify-center" aria-hidden>
      {flakes.map((f) => (
        <motion.span
          key={f.id}
          className={cn('absolute', f.persimmon ? 'text-accent' : 'text-primary')}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: f.x, y: f.y, opacity: 0, rotate: f.rotate, scale: 1 }}
          transition={{ duration: f.duration, delay: f.delay, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {f.persimmon ? (
            <span className="block rounded-full bg-accent" style={{ width: f.size, height: f.size }} />
          ) : (
            <FlakeGlyph size={f.size} />
          )}
        </motion.span>
      ))}
    </div>
  )
}

/** Count up to `target` over ~0.9 s (ease-out); instant under reduced motion. */
export function useCountUp(target: number, animate: boolean): number {
  const [value, setValue] = useState(animate ? 0 : target)
  useEffect(() => {
    if (!animate) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, animate])
  return value
}
