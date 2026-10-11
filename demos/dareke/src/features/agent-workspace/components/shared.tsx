import { useEffect, useState, type ReactNode } from 'react'
import {
  BookOpen,
  CircleDot,
  ClipboardCheck,
  Coffee,
  Headset,
  PhoneCall,
  PowerOff,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { TFunction } from 'i18next'

import { cn } from '@/lib/cn'
import { toneClasses } from '@/lib/tone'
import type { AgentStatus, Tone } from '@/types'

export const ICON = { size: 18, strokeWidth: 1.75 } as const

/** A clock that re-renders every `ms` (UI timers are computed from timestamps). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Keys typed into a field never trigger workspace hotkeys. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)
  }
  return target.closest('[role="listbox"],[role="combobox"],[role="menu"]') !== null
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  available: Headset,
  on_call: PhoneCall,
  wrap_up: ClipboardCheck,
  break: Coffee,
  lunch: UtensilsCrossed,
  meeting: Users,
  training: BookOpen,
  offline: PowerOff,
}

export function statusIcon(status: Pick<AgentStatus, 'name'> | null | undefined, size = 14): ReactNode {
  const Icon = (status && STATUS_ICONS[status.name]) || CircleDot
  return <Icon size={size} strokeWidth={1.75} aria-hidden />
}

export function statusPattern(status: Pick<AgentStatus, 'name' | 'type'>): 'solid' | 'hatch' | 'outline' | 'call' {
  if (status.name === 'on_call') return 'call'
  if (status.type === 'paused') return 'hatch'
  if (status.type === 'offline') return 'outline'
  return 'solid'
}

/** "15 min" / "1 h" / "20 s" for a status timeout. */
export function formatLimit(seconds: number, t: TFunction): string {
  if (seconds <= 0) return t('topbar.noTimeout')
  if (seconds % 3600 === 0) return t('units.hours', { count: seconds / 3600 })
  if (seconds % 60 === 0) return t('units.minutes', { count: seconds / 60 })
  return t('units.seconds', { count: seconds })
}

/** Overtime for a paused status past its timeout (seconds over, or 0). */
export function overtimeSeconds(status: AgentStatus, elapsed: number): number {
  if (status.type !== 'paused' || status.timeoutSeconds <= 0) return 0
  return Math.max(0, elapsed - status.timeoutSeconds)
}

/** Avatar with a status-tone ring (the source's StatusRing, in the new brand). */
export function StatusRing({ name, tone, size = 64, pulse }: { name: string; tone: Tone; size?: number; pulse?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const classes = toneClasses(tone)
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <span className={cn('absolute inset-0 rounded-full border-[3px]', classes.border, pulse && 'animate-ring')} />
      <span
        className="flex items-center justify-center rounded-full bg-carbon font-display font-extrabold text-on-carbon"
        style={{ width: size - 12, height: size - 12, fontSize: Math.round(size * 0.38) }}
      >
        {initial}
      </span>
      <span className={cn('absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-panel', classes.dot)} />
    </span>
  )
}

/** Human label for a customData key, translated where the seed uses it. */
export function fieldLabel(key: string, t: TFunction): string {
  const fallback = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
  return t(`fields.${key}`, { defaultValue: fallback })
}
