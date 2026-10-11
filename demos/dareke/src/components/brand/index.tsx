/**
 * Dareke brand: the outbound-ring Mark, the Logo lockup,
 * the RingPulse call indicator and the DialMotif illustration. Inline SVG only.
 */
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

const LIME = '#C2EF4A'
const CARBON = '#1C2523'
const PAPER = '#F5F3EC'

const INNER_ARC = 'M13 17 A10 10 0 0 1 23 27'
const OUTER_ARC = 'M13 10 A17 17 0 0 1 30 27'

export interface MarkProps {
  size?: number
  /** `reversed`: carbon dot + arcs on a lime tile (for lime grounds). */
  variant?: 'default' | 'reversed'
  className?: string
  title?: string
}

/** The outbound ring: a dot sending two quarter-arcs to the upper right, on a carbon tile. */
export function Mark({ size = 32, variant = 'default', className, title }: MarkProps) {
  const reversed = variant === 'reversed'
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="8.6"
        fill={reversed ? LIME : CARBON}
        className={reversed ? undefined : 'stroke-transparent dark:stroke-[#22332F]'}
        strokeWidth="1"
      />
      <path d={OUTER_ARC} fill="none" stroke={reversed ? CARBON : LIME} strokeWidth="3.5" strokeLinecap="round" />
      <path d={INNER_ARC} fill="none" stroke={reversed ? CARBON : PAPER} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="13" cy="27" r="5" fill={reversed ? CARBON : LIME} />
    </svg>
  )
}

export interface LogoProps {
  /** Mark size in px; the wordmark scales with it. */
  size?: number
  /** Hide the wordmark (rail collapsed, favicons). */
  markOnly?: boolean
  /** Force a lockup; default follows the UI language. */
  lang?: 'en' | 'ka'
  className?: string
  wordmarkClassName?: string
}

/** Mark + lowercase wordmark ("dareke" / "დარეკე"). */
export function Logo({ size = 28, markOnly = false, lang, className, wordmarkClassName }: LogoProps) {
  const { i18n } = useTranslation()
  const lng = lang ?? (i18n.language === 'ka' ? 'ka' : 'en')
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.4 }}>
      <Mark size={size} title={markOnly ? 'Dareke' : undefined} />
      {!markOnly && (
        <span
          lang={lng}
          className={cn(
            'font-display leading-none text-ink',
            lng === 'ka' ? 'font-bold' : 'font-extrabold tracking-[-0.03em]',
            wordmarkClassName,
          )}
          style={{ fontSize: size * (lng === 'ka' ? 0.72 : 0.86) }}
        >
          {lng === 'ka' ? 'დარეკე' : 'dareke'}
        </span>
      )}
    </span>
  )
}

export type RingState = 'idle' | 'ringing' | 'connected'

export interface RingPulseProps {
  state?: RingState
  size?: number
  className?: string
  label?: string
}

/**
 * The call indicator. `ringing`: two arcs scale 0.6 -> 1 and fade over 1.2s
 * (a static double ring under reduced motion). `connected`: a solid lime ring.
 * Drawn on a carbon disc so it reads on paper and on dark panels alike.
 */
export function RingPulse({ state = 'ringing', size = 64, className, label }: RingPulseProps) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full bg-carbon ring-1 ring-hairline', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 40 40" width={size * 0.78} height={size * 0.78} overflow="visible">
        {state === 'connected' ? (
          <>
            <circle cx="20" cy="20" r="13" fill="none" stroke={LIME} strokeWidth="3.5" />
            <circle cx="20" cy="20" r="6" fill={LIME} />
          </>
        ) : (
          <g>
            <path
              d={OUTER_ARC}
              fill="none"
              stroke={LIME}
              strokeWidth="3.5"
              strokeLinecap="round"
              className={cn(state === 'ringing' && 'dk-ring-arc is-outer')}
              opacity={state === 'idle' ? 0.35 : 1}
            />
            <path
              d={INNER_ARC}
              fill="none"
              stroke={PAPER}
              strokeWidth="3.5"
              strokeLinecap="round"
              className={cn(state === 'ringing' && 'dk-ring-arc')}
              opacity={state === 'idle' ? 0.45 : 1}
            />
            <circle cx="13" cy="27" r="5" fill={LIME} />
          </g>
        )}
      </svg>
    </span>
  )
}

/**
 * The brand illustration for empty states and brand panels: a faint 3x4
 * dial-pad grid breaking apart into scattered leads, with the outbound ring
 * in carbon line work (currentColor) and a single lime dot.
 */
export function DialMotif({ className, size = 120, litLeads = 1 }: { className?: string; size?: number; litLeads?: number }) {
  const grid: Array<[number, number]> = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) grid.push([70 + c * 12, 18 + r * 12])
  const scattered: Array<[number, number]> = [
    [112, 30],
    [118, 54],
    [104, 72],
    [124, 16],
    [96, 88],
  ]
  return (
    <svg viewBox="0 0 140 110" width={size} height={(size * 110) / 140} className={cn('text-ink', className)} aria-hidden="true">
      {grid.map(([x, y], i) => (
        <circle key={`g${i}`} cx={x} cy={y} r="2.2" fill="currentColor" opacity={i % 4 === 1 ? 0.12 : 0.22} />
      ))}
      {scattered.map(([x, y], i) => (
        <circle
          key={`s${i}`}
          cx={x}
          cy={y}
          r="3"
          fill={i < litLeads ? LIME : 'currentColor'}
          stroke={i < litLeads ? CARBON : 'none'}
          strokeWidth="1"
          opacity={i < litLeads ? 1 : 0.3}
        />
      ))}
      <path d="M26 54 A30 30 0 0 1 56 84" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M26 38 A46 46 0 0 1 72 84" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <path d="M26 22 A62 62 0 0 1 88 84" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <circle cx="26" cy="84" r="8" fill={LIME} stroke={CARBON} strokeWidth="1.5" />
    </svg>
  )
}
