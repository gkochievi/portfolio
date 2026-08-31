import { useId, useMemo } from 'react'

import { cn } from '@/lib/cn'
import { seededRandom } from '@/lib/random'

interface Node {
  x: number
  y: number
  live: boolean
  r: number
}

/**
 * The card artwork.
 *
 * A screenshot of an admin console shrinks to grey mush at card size and goes
 * stale the moment the UI moves, so each project gets a generated constellation
 * instead — a hub with the things reporting to it, which is what all of this
 * work actually is. Seeded from the slug, so a new project gets its own shape
 * for free and the same project never reshuffles between visits.
 *
 * It draws in white at varying opacity because it sits on the brand's
 * coral-to-indigo tile; a brand colour here would fight the gradient rather
 * than sit on it.
 */
export function ProjectMark({ seed, className }: { seed: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const nodes = useMemo<Node[]>(() => {
    const random = seededRandom(seed)
    return Array.from({ length: 7 }, (_, index) => {
      const angle = (index / 7) * Math.PI * 2 + random() * 0.5
      const spread = 0.66 + random() * 0.34
      return {
        x: 200 + Math.cos(angle) * 152 * spread,
        y: 120 + Math.sin(angle) * 78 * spread,
        live: random() > 0.34,
        r: 3 + random() * 2.2,
      }
    })
  }, [seed])

  return (
    <svg
      viewBox="0 0 400 240"
      className={cn('h-full w-full', className)}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern id={`grid-${uid}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0v24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </pattern>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="52%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <rect width="400" height="240" fill={`url(#grid-${uid})`} />
      <rect width="400" height="240" fill={`url(#glow-${uid})`} />

      <g strokeLinecap="round">
        {nodes.map((node, index) => (
          <line
            key={index}
            x1="200"
            y1="120"
            x2={node.x}
            y2={node.y}
            stroke={node.live ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="1"
            strokeDasharray={node.live ? undefined : '3 5'}
          />
        ))}
      </g>

      {/* The slow sweep is the only motion on the card that is not a hover
          response — it keeps the tile from reading as a flat placeholder. */}
      <g
        className="motion-safe:animate-[spin_46s_linear_infinite]"
        style={{ transformBox: 'view-box', transformOrigin: '200px 120px' }}
      >
        <circle
          cx="200"
          cy="120"
          r="52"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="1"
          strokeDasharray="2 9"
        />
      </g>
      <circle cx="200" cy="120" r="30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {nodes.map((node, index) => (
        <circle
          key={index}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill="#ffffff"
          opacity={node.live ? 0.95 : 0.45}
        />
      ))}

      <circle cx="200" cy="120" r="12" fill="rgba(255,255,255,0.24)" />
      <circle cx="200" cy="120" r="6" fill="#ffffff" />
    </svg>
  )
}
