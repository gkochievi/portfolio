/**
 * Tone -> classes. Features never write hex: a status or
 * disposition carries a `Tone`, and this maps it to the brand palette.
 * Lime is never used as text on light surfaces (it is a fill there).
 */
import type { Tone } from '@/types'

export interface ToneClassSet {
  /** Small filled dot / bar fill. */
  dot: string
  /** Foreground text in the tone (readable on panel and paper). */
  text: string
  /** Tinted pill/badge: soft background + readable text. */
  soft: string
  /** Solid fill with its on-colour text. */
  solid: string
  /** 1px border in the tone. */
  border: string
  /** 4px left edge for tiles (`border-l-4` + colour). */
  edge: string
}

const TONES: Record<Tone, ToneClassSet> = {
  lime: {
    dot: 'bg-lime',
    text: 'text-ink dark:text-lime',
    soft: 'bg-lime/45 text-on-lime dark:bg-lime/15 dark:text-lime',
    solid: 'bg-lime text-on-lime',
    border: 'border-lime',
    edge: 'border-l-4 border-l-lime',
  },
  success: {
    dot: 'bg-success',
    text: 'text-success',
    soft: 'bg-success/12 text-success dark:bg-success/15',
    solid: 'bg-success text-white dark:text-paper',
    border: 'border-success',
    edge: 'border-l-4 border-l-success',
  },
  info: {
    dot: 'bg-info',
    text: 'text-info',
    soft: 'bg-info/12 text-info dark:bg-info/15',
    solid: 'bg-info text-white dark:text-paper',
    border: 'border-info',
    edge: 'border-l-4 border-l-info',
  },
  warning: {
    dot: 'bg-warning',
    text: 'text-warning',
    soft: 'bg-warning/12 text-warning dark:bg-warning/15',
    solid: 'bg-warning text-white dark:text-paper',
    border: 'border-warning',
    edge: 'border-l-4 border-l-warning',
  },
  danger: {
    dot: 'bg-danger',
    text: 'text-danger',
    soft: 'bg-danger/10 text-danger dark:bg-danger/15',
    solid: 'bg-danger text-white dark:text-paper',
    border: 'border-danger',
    edge: 'border-l-4 border-l-danger',
  },
  muted: {
    dot: 'bg-muted',
    text: 'text-muted',
    soft: 'bg-muted/12 text-muted dark:bg-muted/15',
    solid: 'bg-muted text-white dark:text-paper',
    border: 'border-muted',
    edge: 'border-l-4 border-l-muted',
  },
  ink: {
    dot: 'bg-ink',
    text: 'text-ink',
    soft: 'bg-transparent text-ink ring-1 ring-inset ring-ink/60',
    solid: 'bg-ink text-paper',
    border: 'border-ink',
    edge: 'border-l-4 border-l-ink',
  },
}

export const TONE_LIST: Tone[] = ['lime', 'success', 'info', 'warning', 'danger', 'muted', 'ink']

export function toneClasses(tone: Tone | null | undefined): ToneClassSet {
  return TONES[tone ?? 'muted'] ?? TONES.muted
}

/** CSS colour (a var) for charts, SVG strokes and inline styles. */
export function toneColor(tone: Tone | null | undefined): string {
  switch (tone) {
    case 'lime':
      return 'var(--color-lime)'
    case 'success':
      return 'var(--color-success)'
    case 'info':
      return 'var(--color-info)'
    case 'warning':
      return 'var(--color-warning)'
    case 'danger':
      return 'var(--color-danger)'
    case 'ink':
      return 'var(--color-ink)'
    default:
      return 'var(--color-muted)'
  }
}

/** A fixed, theme-aware series palette for charts (recharts `fill`/`stroke`). */
export const CHART_SERIES = [
  'var(--color-ink)',
  'var(--color-lime)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-muted)',
]
