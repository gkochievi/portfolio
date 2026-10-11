/**
 * Rigi logo: a graphite tile holding a small queue of three squares, with the
 * signal square stepping up and forward ("now serving"). Wordmark: lowercase
 * "rigi" whose i-tittles are signal squares. Owner: design-system.
 */
import { useId } from 'react'

import { cn } from '@/lib/cn'

export interface LogoProps {
  /** `partner` turns the leading square ochre on a stone tile. */
  variant?: 'staff' | 'partner'
  withWordmark?: boolean
  /** Mark height in px. Default 28. */
  size?: number
  className?: string
  title?: string
}

export function LogoMark({ variant = 'staff', size = 28, className, title }: Omit<LogoProps, 'withWordmark'>) {
  const id = useId()
  const partner = variant === 'partner'
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? id : undefined}
    >
      {title ? <title id={id}>{title}</title> : null}
      <rect
        width="32"
        height="32"
        rx="7"
        className={partner ? 'fill-[#E7E4DA] stroke-[#D6D2C4] dark:fill-[#2A2925] dark:stroke-[#3A3933]' : 'fill-[#1A1B1E] dark:stroke-[#2A2B30]'}
        strokeWidth="1"
      />
      <g className={partner ? 'fill-[#1A1B1E] dark:fill-[#ECECE7]' : 'fill-[#ECECE7]'}>
        <rect x="5" y="18" width="4" height="4" opacity="0.4" />
        <rect x="11" y="18" width="4" height="4" opacity="0.7" />
        <rect x="17" y="18" width="4" height="4" />
      </g>
      <rect
        x="23.5"
        y="10.5"
        width="5"
        height="5"
        className={partner ? 'fill-[#8A6400] stroke-[#E0B54A]' : 'fill-[#2A7A2E] stroke-[#7BD483]'}
        strokeWidth="1"
      />
    </svg>
  )
}

/** The wordmark: lowercase "rigi" whose i-tittles are square signal dots on one line. */
export function Wordmark({ variant = 'staff', height = 20, className }: { variant?: 'staff' | 'partner'; height?: number; className?: string }) {
  const dot = variant === 'partner' ? 'bg-[#8A6400] dark:bg-[#E0B54A]' : 'bg-[#2A7A2E] dark:bg-[#7BD483]'
  const I = () => (
    <span className="relative inline-block">
      {'\u0131'}
      <span className={cn('absolute left-1/2 top-[0.06em] block h-[0.18em] w-[0.18em] -translate-x-1/2', dot)} />
    </span>
  )
  return (
    <span
      aria-hidden
      className={cn('inline-block font-display font-extrabold leading-none tracking-[-0.03em] text-[#1A1B1E] dark:text-[#ECECE7]', className)}
      style={{ fontSize: height * 1.05 }}
    >
      r<I />g<I />
    </span>
  )
}

export function Logo({ variant = 'staff', withWordmark = true, size = 28, className, title = 'Rigi' }: LogoProps) {
  if (!withWordmark) return <LogoMark variant={variant} size={size} className={className} title={title} />
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.4 }} role="img" aria-label={title}>
      <LogoMark variant={variant} size={size} />
      <Wordmark variant={variant} height={size * 0.8} />
    </span>
  )
}
