/**
 * Azri identity: the speech-bubble mark with five rising signal bars, and the
 * lowercase Fraunces wordmark whose "i" carries a mint bubble tittle.
 * Owner: design-system agent.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/** The bubble: three round corners, sharp bottom-left tail (48x48 grid). */
export const AZRI_BUBBLE_PATH = 'M12 0H36A12 12 0 0 1 48 12V36A12 12 0 0 1 36 48H0V12A12 12 0 0 1 12 0Z'
/** The five bars: x positions and heights, bottoms aligned at y=38. */
export const AZRI_BARS = [
  { x: 10, h: 8 },
  { x: 16.5, h: 13 },
  { x: 23, h: 18 },
  { x: 29.5, h: 23 },
  { x: 36, h: 28 },
] as const

export type AzriMarkVariant = 'auto' | 'color' | 'inverse' | 'mono'

export interface AzriMarkProps {
  size?: number
  /**
   * auto: mulberry bubble + mint bars (mint bubble + plum bars in dark mode);
   * color: always mulberry + mint; inverse: mint bubble + mulberry bars (for
   * mulberry backgrounds); mono: currentColor bubble with the bars knocked out.
   */
  variant?: AzriMarkVariant
  /** Bars rise one after another on mount. */
  animated?: boolean
  className?: string
  title?: string
}

export function AzriMark({ size = 32, variant = 'auto', animated = false, className, title }: AzriMarkProps) {
  const maskId = useId()
  const bubble =
    variant === 'inverse'
      ? 'fill-mint'
      : variant === 'mono'
        ? 'fill-current'
        : variant === 'color'
          ? 'fill-mulberry'
          : 'fill-mulberry dark:fill-mint'
  const bars = variant === 'inverse' ? 'fill-mulberry' : variant === 'color' ? 'fill-mint' : 'fill-mint dark:fill-plum'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {variant === 'mono' ? (
        <>
          <mask id={maskId}>
            <rect width="48" height="48" fill="white" />
            {AZRI_BARS.map((bar) => (
              <rect key={bar.x} x={bar.x} y={38 - bar.h} width="4.5" height={bar.h} rx="2.25" fill="black" />
            ))}
          </mask>
          <path d={AZRI_BUBBLE_PATH} className={bubble} mask={`url(#${maskId})`} />
        </>
      ) : (
        <>
          <path d={AZRI_BUBBLE_PATH} className={bubble} />
          {AZRI_BARS.map((bar, index) => (
            <rect
              key={bar.x}
              x={bar.x}
              y={38 - bar.h}
              width="4.5"
              height={bar.h}
              rx="2.25"
             
              className={cn(bars, animated && 'origin-bars animate-rise')}
              style={animated ? { animationDelay: `${index * 40}ms` } : undefined}
            />
          ))}
        </>
      )}
    </svg>
  )
}

export interface AzriLogoProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number
  variant?: AzriMarkVariant
  /** Force the Latin or Georgian lockup; defaults to the UI language. */
  script?: 'latin' | 'georgian'
  /** Hide the wordmark (mark only). */
  markOnly?: boolean
  animated?: boolean
  className?: string
}

/**
 * Mark + wordmark lockup. Latin: "azri" with the mint bubble tittle.
 * Georgian: "აზრი" in Noto Serif Georgian.
 */
export function AzriLogo({ size = 28, variant = 'auto', script, markOnly = false, animated, className }: AzriLogoProps) {
  const { i18n } = useTranslation()
  const georgian = (script ?? (i18n.language === 'ka' ? 'georgian' : 'latin')) === 'georgian'
  const wordColor =
    variant === 'inverse' ? 'text-mist' : variant === 'mono' ? 'text-current' : 'text-plum dark:text-mist'

  return (
    <span className={cn('inline-flex items-end', className)} style={{ gap: size * 0.3 }} aria-label="Azri" role="img">
      <AzriMark size={size} variant={variant} animated={animated} />
      {!markOnly &&
        (georgian ? (
          <span
            lang="ka"
            aria-hidden="true"
            className={cn('font-display font-semibold leading-none', wordColor)}
            style={{ fontSize: size * 0.82, marginBottom: size * 0.06 }}
          >
            აზრი
          </span>
        ) : (
          <span
            aria-hidden="true"
            lang="en"
            className={cn('font-display font-semibold leading-none tracking-[-0.01em]', wordColor)}
            style={{ fontSize: size * 1.02, marginBottom: size * 0.02 }}
          >
            azr
            <span className="relative inline-block">
              {'ı'}
              <span
                className="absolute left-1/2 rounded-bubble-sm bg-mint"
                style={{ width: '0.22em', height: '0.22em', top: '0.04em', transform: 'translateX(-46%)', borderRadius: '0.08em 0.08em 0.08em 0.02em' }}
              />
            </span>
          </span>
        ))}
    </span>
  )
}
