/**
 * A falling item as a coin token: ink ring = sponsor item, persimmon ring =
 * bonus, danger ring with a slash + glyph = hazard. Used by the items admin,
 * drill-downs, the intro legend and the landing.
 */
import { CloudLightning } from 'lucide-react'

import { cn } from '@/lib/cn'
import { assetUrl } from '@/lib/assets'
import type { ItemType } from '@/types'

function IcicleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 4h18l-3.2 3.4-1.6 8.6-1.9-6.6-1.6 11.6-1.9-11.6-1.7 5.4-1.4-7.4z" fill="currentColor" />
    </svg>
  )
}

export interface ItemTokenProps {
  type: ItemType
  imageUrl?: string | null
  name: string
  /** Pixel diameter. Default 40. */
  size?: number
  /** Enhanced (x1.5 / x2) sponsor coin: persimmon ring. */
  bonus?: boolean
  className?: string
}

export function ItemToken({ type, imageUrl, name, size = 40, bonus, className }: ItemTokenProps) {
  const good = type === 'GOOD'
  const src = assetUrl(imageUrl)
  const ring = Math.max(2, Math.round(size * 0.07))
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-solid bg-panel',
        good ? (bonus ? 'border-accent' : 'border-ink') : 'border-danger',
        className,
      )}
      style={{ width: size, height: size, borderWidth: ring }}
    >
      {src ? (
        <img src={src} alt="" draggable={false} className="size-full rounded-full object-cover" />
      ) : good ? (
        <span className="font-display font-extrabold text-primary" style={{ fontSize: size * 0.42 }}>
          {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
        </span>
      ) : type === 'MAJOR' ? (
        <CloudLightning className="text-danger" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2} aria-hidden />
      ) : (
        <span className="text-danger" style={{ width: size * 0.5, height: size * 0.5 }}>
          <IcicleGlyph className="size-full" />
        </span>
      )}
      {!good && (
        <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <line x1="8" y1="32" x2="32" y2="8" className="stroke-panel" strokeWidth="6" strokeLinecap="round" />
          <line x1="8" y1="32" x2="32" y2="8" className="stroke-danger" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}
