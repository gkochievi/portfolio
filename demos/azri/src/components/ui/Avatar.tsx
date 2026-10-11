/**
 * Identity atoms: Avatar (initials on a colour) and TenantMark (a tenant's
 * monogram tile in its own colours, bubble-shaped). Owner: design-system agent.
 */
import { cn } from '@/lib/utils'

/** "Mariam Lomidze" -> "ML"; "ნინო გელაშვილი" -> "ნგ". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters
    .map((part) => Array.from(part ?? '')[0] ?? '')
    .join('')
    .toLocaleUpperCase()
}

/** Pick ink or white text for a hex background (WCAG relative luminance). */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return '#FFFFFF'
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  return lum > 0.4 ? '#24161F' : '#FFFFFF'
}

const avatarSizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base', xl: 'size-16 text-xl' } as const

export interface AvatarProps {
  name: string
  /** Background (hex). Default: mulberry soft tint. */
  color?: string
  size?: keyof typeof avatarSizes
  className?: string
  /** Small status dot at the bottom right (e.g. unread SMS). */
  badge?: boolean
}

export function Avatar({ name, color, size = 'md', className, badge }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-grid shrink-0 select-none place-items-center rounded-full font-semibold leading-none',
        !color && 'bg-primary-soft text-on-primary-soft',
        avatarSizes[size],
        className,
      )}
      style={color ? { background: color, color: readableOn(color) } : undefined}
    >
      {initials(name)}
      {badge && <span className="absolute -right-0.5 -top-0.5 size-3 animate-live rounded-full border-2 border-panel bg-mint" />}
    </span>
  )
}

const markSizes = { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 } as const

export interface TenantMarkProps {
  monogram: string
  /** Tenant primary (hex). */
  primary: string
  onPrimary?: string
  size?: keyof typeof markSizes
  /** Accessible name (tenant name). Omit when the name is printed next to it. */
  title?: string
  className?: string
}

/** Monogram tile, e.g. "NB" on Nergi green, in the bubble shape (sharp bottom-left). */
export function TenantMark({ monogram, primary, onPrimary = '#FFFFFF', size = 'md', title, className }: TenantMarkProps) {
  const px = markSizes[size]
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('inline-grid shrink-0 select-none place-items-center font-display font-semibold leading-none tracking-tight', className)}
      style={{
        width: px,
        height: px,
        background: primary,
        color: onPrimary,
        fontSize: px * 0.4,
        borderRadius: `${px * 0.3}px ${px * 0.3}px ${px * 0.3}px ${Math.max(2, px * 0.08)}px`,
      }}
    >
      {monogram}
    </span>
  )
}
