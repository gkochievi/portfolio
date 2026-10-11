/**
 * The Tova mark ("flake turns prize"): a glacier tile, a six-spoke flake and
 * the persimmon disc it has just become. Colours come from tokens, so the
 * tile swaps to glacier #38B6D6 with dark strokes in dark mode.
 */
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

export interface LogoProps {
  /** Pixel size of the square mark. Minimum 20. */
  size?: number
  /** default = glacier tile; inverse = white tile with glacier flake (on a primary ground). */
  tone?: 'default' | 'inverse'
  className?: string
  /** Accessible name; omit when a visible wordmark sits beside it. */
  title?: string
}

export function Logo({ size = 40, tone = 'default', className, title }: LogoProps) {
  const s = Math.max(20, size)
  const small = s <= 20
  return (
    <svg
      viewBox="0 0 64 64"
      width={s}
      height={s}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="16" className={tone === 'inverse' ? 'fill-on-primary' : 'fill-primary'} />
      <g
        className={tone === 'inverse' ? 'stroke-primary' : 'stroke-on-primary'}
        strokeWidth={small ? 6 : 5}
        strokeLinecap="round"
        fill="none"
      >
        <path d="M32 12V36" />
        <path d="M21.6 18L42.4 30" />
        <path d="M42.4 18L21.6 30" />
      </g>
      <circle cx="32" cy="49" r="6" className="fill-accent" />
    </svg>
  )
}

export interface WordmarkProps {
  /** Defaults to the current UI language: "tova" or "თოვა". */
  lang?: 'en' | 'ka'
  className?: string
}

/** Lowercase "tova" in Unbounded 800 with a persimmon disc for the o; "თოვა" with a persimmon ო. */
export function Wordmark({ lang, className }: WordmarkProps) {
  const { i18n } = useTranslation()
  const ka = (lang ?? i18n.language) === 'ka'
  if (ka) {
    return (
      <span className={cn('inline-flex items-baseline font-display font-extrabold leading-none', className)} lang="ka">
        თ<span className="text-accent">ო</span>ვა
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-baseline font-display font-extrabold leading-none tracking-[-0.02em]', className)}>
      <span className="sr-only">tova</span>
      <span aria-hidden className="inline-flex items-baseline">
        t
        <span className="mx-[0.04em] inline-block size-[0.6em] rounded-full bg-accent" />
        va
      </span>
    </span>
  )
}

export interface LockupProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number
  tone?: 'default' | 'inverse'
  lang?: 'en' | 'ka'
  className?: string
  /** Hide the wordmark below the sm breakpoint. */
  compact?: boolean
}

/** Mark + wordmark, gap of half the mark height. */
export function Lockup({ size = 32, tone = 'default', lang, className, compact }: LockupProps) {
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.4 }}>
      <Logo size={size} tone={tone} />
      <span style={{ fontSize: Math.round(size * 0.72) }} className={cn('inline-flex', compact && 'hidden sm:inline-flex')}>
        <Wordmark lang={lang} className={tone === 'inverse' ? 'text-on-primary' : 'text-ink'} />
      </span>
    </span>
  )
}
