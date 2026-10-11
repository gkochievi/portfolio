import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { TagBox, type FrameTone } from './CardFrame'

/**
 * One department's pile of work — boulder.ge's WorksDecks, laid flat.
 *
 * boulder.ge stacks each department's cards into a tilted deck that fans on
 * hover, named by a label block above it. The portal keeps the label (the
 * same tilted block, `.works-deck__label`, in the department's colour) and
 * deals the cards out into a grid instead: a visitor here has come to read
 * every card, and a deck hides all but the top one.
 *
 * The label rises a little whenever any card in the deck is hovered or
 * focused (works.css), which is the deck's own hover, kept.
 *
 * Two and four cards deal into pairs rather than a row of three with one
 * left over; anything else fills rows of three on a wide screen.
 */
export function WorksDeck({
  label,
  tone = 'tech',
  count,
  aside,
  children,
}: {
  label: ReactNode
  tone?: FrameTone
  /** How many cards are dealt, which decides the column count. */
  count: number
  /** Anything that belongs on the label's line, right-aligned. */
  aside?: ReactNode
  children: ReactNode
}) {
  const labelId = useId()
  const pairs = count === 2 || count === 4

  return (
    <div className={cn('works-deck-grid', `works-deck-grid--${tone}`)}>
      <div className="works-deck-grid__head">
        <TagBox tone={tone} size="large" className="works-deck__label" id={labelId}>
          {label}
        </TagBox>
        {aside}
      </div>
      <ul className={cn('works-grid', pairs && 'works-grid--pairs')} aria-labelledby={labelId}>
        {children}
      </ul>
    </div>
  )
}
