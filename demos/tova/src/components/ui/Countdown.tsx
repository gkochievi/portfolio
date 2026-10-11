import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatCountdown } from '@/lib/format'

type Target = string | number | Date | null | undefined

function toMs(target: Target): number | null {
  if (target === null || target === undefined) return null
  const ms = target instanceof Date ? target.getTime() : typeof target === 'number' ? target : Date.parse(target)
  return Number.isFinite(ms) ? ms : null
}

/** Milliseconds left until `target`, ticking every `intervalMs` (default 1s). Never negative. */
export function useCountdown(target: Target, intervalMs = 1000): number {
  const end = toMs(target)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (end === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [end, intervalMs])
  return end === null ? 0 : Math.max(0, end - now)
}

export interface CountdownProps {
  to: Target
  /** Fires once when it reaches zero. */
  onDone?: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl', xl: 'text-4xl sm:text-5xl' } as const

/** `Dd HH:MM:SS` in JetBrains Mono; shows zeros at or after the target. */
export function Countdown({ to, onDone, size = 'md', className }: CountdownProps) {
  const { i18n } = useTranslation()
  const left = useCountdown(to)
  const [fired, setFired] = useState(false)
  useEffect(() => {
    if (left === 0 && toMs(to) !== null && !fired) {
      setFired(true)
      onDone?.()
    }
    if (left > 0 && fired) setFired(false)
  }, [left, to, fired, onDone])
  return (
    <span className={cn('font-mono font-bold tabular-nums tracking-tight', SIZES[size], className)} role="timer" aria-live="off">
      {formatCountdown(left, i18n.language)}
    </span>
  )
}
