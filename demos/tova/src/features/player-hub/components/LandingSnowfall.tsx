/**
 * The landing backdrop: a low-density drift of brand flakes plus a few
 * sponsor coins and hazard tokens. Tokens are hidden under reduced motion
 * (`motion-decor`); the flakes come to rest on their own.
 */
import type { CSSProperties } from 'react'

import { Flakes, ItemToken } from '@/components/brand'
import type { ItemType } from '@/types'

interface Token {
  name: string
  type: ItemType
  image: string | null
  left: number
  size: number
  duration: number
  delay: number
  drift: number
}

const TOKENS: Token[] = [
  { name: 'Kvamli Coffee', type: 'GOOD', image: 'media/items/kvamli-coffee.svg', left: 8, size: 44, duration: 17, delay: -3, drift: 18 },
  { name: 'Icicle', type: 'MINOR', image: null, left: 22, size: 34, duration: 14, delay: -9, drift: -14 },
  { name: 'Mzevali Tea', type: 'GOOD', image: 'media/items/mzevali-tea.svg', left: 36, size: 40, duration: 19, delay: -13, drift: 10 },
  { name: 'Lurji Velo', type: 'GOOD', image: 'media/items/lurji-velo.svg', left: 63, size: 46, duration: 16, delay: -6, drift: -20 },
  { name: 'Storm cloud', type: 'MAJOR', image: null, left: 78, size: 38, duration: 21, delay: -16, drift: 12 },
  { name: 'Arsiani Bakery', type: 'GOOD', image: 'media/items/arsiani-bakery.svg', left: 90, size: 40, duration: 18, delay: -1, drift: -10 },
  { name: 'Pinecone', type: 'MINOR', image: null, left: 50, size: 32, duration: 15, delay: -11, drift: 16 },
  { name: 'Tetri Kalami', type: 'GOOD', image: 'media/items/tetri-kalami.svg', left: 4, size: 38, duration: 20, delay: -15, drift: 8 },
]

export function LandingSnowfall() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Flakes count={10} speed={0.8} />
      <div className="motion-decor absolute inset-0">
        {TOKENS.map((token) => {
          const style = {
            left: `${token.left}%`,
            opacity: 0.35,
            '--flake-duration': `${token.duration}s`,
            '--flake-delay': `${token.delay}s`,
            '--flake-drift': `${token.drift}px`,
            '--flake-rest': '40%',
          } as CSSProperties
          return (
            <span key={token.name} className="tova-flake" style={style}>
              <ItemToken type={token.type} name={token.name} imageUrl={token.image} size={token.size} />
            </span>
          )
        })}
      </div>
    </div>
  )
}
