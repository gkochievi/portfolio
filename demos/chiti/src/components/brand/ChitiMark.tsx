import { cn } from '@/lib/cn'

export interface ChitiMarkProps {
  size?: number
  /** 'auto' strokes the body in ink on light surfaces and drops it in dark mode. */
  stroke?: 'auto' | 'always' | 'none'
  className?: string
  title?: string
}

/**
 * The mark: a speech bubble that is also a round bird (48x48 viewBox).
 * Body circle + bubble tail in canary, ink beak and eye, two olive bars (wing / text lines).
 */
export function ChitiMark({ size = 32, stroke = 'auto', className, title }: ChitiMarkProps) {
  const strokeCls = stroke === 'none' ? 'stroke-transparent' : stroke === 'always' ? 'stroke-[#1E1B12]' : 'stroke-[#1E1B12] dark:stroke-transparent'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} className={cn('shrink-0', className)}>
      <g className={strokeCls} strokeWidth={1.5} strokeLinejoin="round">
        <path d="M9 31 L5 43 L18 37 Z" fill="#F2C12E" />
        <circle cx="22" cy="22" r="17" fill="#F2C12E" />
      </g>
      {/* re-fill the seam so the tail reads as part of the body */}
      <path d="M10.2 30 L6.9 40.6 L17.2 35.9 Z" fill="#F2C12E" />
      <path d="M38 17 L46 21 L38 25 Z" fill="#1E1B12" />
      <circle cx="28" cy="17" r="2.5" fill="#1E1B12" />
      <rect x="12" y="23" width="16" height="3" rx="1.5" fill="#4E5C17" />
      <rect x="12" y="29" width="10" height="3" rx="1.5" fill="#4E5C17" />
    </svg>
  )
}

/** The mark alone on a 56px circle (launcher / app icon): cream with an ink ring, or ink with the bird. */
export function ChitiLauncherMark({ size = 56, tone = 'cream', className }: { size?: number; tone?: 'cream' | 'ink'; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full', tone === 'cream' ? 'border-[1.5px] border-[#1E1B12] bg-[#FBF7EE]' : 'bg-[#1E1B12]', className)}
      style={{ width: size, height: size }}
    >
      <ChitiMark size={Math.round(size * 0.66)} stroke={tone === 'cream' ? 'always' : 'none'} />
    </span>
  )
}
