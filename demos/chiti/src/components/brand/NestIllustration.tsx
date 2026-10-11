import { cn } from '@/lib/cn'

/** Empty woven-arc nest ("All quiet in the nest"). Inherits ink from currentColor. */
export function NestIllustration({ className, withBird = false }: { className?: string; withBird?: boolean }) {
  return (
    <svg viewBox="0 0 160 100" fill="none" aria-hidden className={cn('text-ink', className)}>
      {/* flight path landing in the nest */}
      <path d="M8 20 C 40 6, 70 18, 80 48" stroke="#4E5C17" strokeWidth={2} className="flight-path dark:stroke-[#C3D06E]" />
      {/* woven arcs */}
      <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M30 56 Q80 100 130 56" />
        <path d="M34 54 Q80 90 126 54" opacity={0.7} />
        <path d="M26 60 Q70 86 112 66" opacity={0.85} />
        <path d="M48 66 Q92 88 134 60" opacity={0.85} />
        <path d="M38 70 Q80 92 122 70" opacity={0.6} />
        <path d="M24 56 L136 56" opacity={0.9} />
      </g>
      <rect x="52" y="52" width="22" height="3" rx="1.5" fill="#F2C12E" />
      <rect x="86" y="52" width="14" height="3" rx="1.5" fill="#4E5C17" className="dark:fill-[#C3D06E]" />
      {withBird ? (
        <g transform="translate(66 18) scale(0.6)">
          <circle cx="22" cy="22" r="17" fill="#F2C12E" />
          <path d="M38 17 L46 21 L38 25 Z" fill="#1E1B12" />
          <circle cx="28" cy="17" r="2.5" fill="#1E1B12" />
        </g>
      ) : null}
    </svg>
  )
}
