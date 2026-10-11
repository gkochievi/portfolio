import { cn } from '@/lib/cn'

/**
 * Brand hero: five abstract channel birds/bubbles fly in along dotted paths and land in one nest.
 * Generic shapes only (no real channel logos).
 */
export function FlightPaths({ className }: { className?: string }) {
  const starts = [
    { x: 30, y: 40, fill: '#F2C12E', shape: 'bubble' },
    { x: 18, y: 110, fill: '#4E5C17', shape: 'bird' },
    { x: 34, y: 180, fill: '#F3EDDC', shape: 'plane' },
    { x: 20, y: 250, fill: '#B02A1F', shape: 'bubble' },
    { x: 36, y: 318, fill: '#F2C12E', shape: 'bird' },
  ] as const
  const nest = { x: 300, y: 196 }
  return (
    <svg viewBox="0 0 400 360" fill="none" aria-hidden className={cn('text-[#F3EDDC]', className)}>
      {starts.map((s, i) => (
        <path
          key={`p${i}`}
          d={`M${s.x + 16} ${s.y} C ${150} ${s.y + (i - 2) * -6}, ${220} ${nest.y - 60 + i * 20}, ${nest.x - 6} ${nest.y - 10}`}
          stroke="#C3D06E"
          strokeWidth={2}
          className="flight-path"
          opacity={0.75}
        />
      ))}
      {starts.map((s, i) => (
        <g key={`s${i}`} transform={`translate(${s.x - 12} ${s.y - 12})`}>
          {s.shape === 'bubble' ? (
            <>
              <circle cx="12" cy="12" r="11" fill={s.fill} />
              <path d="M4 18 L1 25 L10 21 Z" fill={s.fill} />
            </>
          ) : s.shape === 'bird' ? (
            <>
              <circle cx="12" cy="12" r="11" fill={s.fill} />
              <path d="M22 9 L27 12 L22 15 Z" fill="#F3EDDC" />
              <circle cx="16" cy="9" r="1.6" fill="#1E1B12" />
            </>
          ) : (
            <path d="M2 12 L24 3 L17 23 L12 15 Z" fill={s.fill} />
          )}
        </g>
      ))}
      {/* the nest */}
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" transform={`translate(${nest.x - 70} ${nest.y - 20})`}>
        <path d="M10 30 Q70 88 130 30" />
        <path d="M16 28 Q70 76 124 28" opacity={0.7} />
        <path d="M6 34 Q56 70 106 44" opacity={0.85} />
        <path d="M30 44 Q84 72 134 34" opacity={0.85} />
        <path d="M4 30 L136 30" />
      </g>
      <g transform={`translate(${nest.x - 34} ${nest.y - 66}) scale(1.4)`}>
        <path d="M9 31 L5 43 L18 37 Z" fill="#F2C12E" />
        <circle cx="22" cy="22" r="17" fill="#F2C12E" />
        <path d="M38 17 L46 21 L38 25 Z" fill="#1E1B12" />
        <circle cx="28" cy="17" r="2.5" fill="#1E1B12" />
        <rect x="12" y="23" width="16" height="3" rx="1.5" fill="#4E5C17" />
        <rect x="12" y="29" width="10" height="3" rx="1.5" fill="#4E5C17" />
      </g>
    </svg>
  )
}
