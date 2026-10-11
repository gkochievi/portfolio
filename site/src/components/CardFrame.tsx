import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The three departments boulder.ge colours its work by: tech coral, marketing
 * indigo, branding the ink that flips with the theme (`--frame-*` in
 * boulder.css). The portal's demos are all development work, so `tech` is
 * the default; a project `category` borrows one of the three so its tag and
 * its filter chip agree.
 */
export type FrameTone = 'tech' | 'marketing' | 'branding'

export const FRAME_TONES: readonly FrameTone[] = ['tech', 'marketing', 'branding']

/**
 * boulder.ge's v2 card: a ring of the department's colour with the
 * boulder-cut corner (`--card-notch`), alternated so a row is not one stamp.
 *
 * Two boxes rather than a border, because `clip-path` cuts a border off at the
 * notch: the outer box is the coloured ring, clipped; the inner one is the
 * card's surface, clipped to the same cut a ring's width in. The notch is a
 * custom property, so a hover can grow it and the clip-path transition (on
 * the site's bouncy curve) animates the corner.
 *
 * The frame is the positioned box: a stretched link inside it (ProjectCard)
 * covers exactly the card and nothing past the cut.
 */
export function CardFrame({
  tone = 'tech',
  alt = false,
  className,
  children,
}: {
  tone?: FrameTone
  alt?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('card-frame', `card-frame--${tone}`, alt && 'card-frame--alt', className)}>
      <div className="card-frame__inner">{children}</div>
    </div>
  )
}

/**
 * The bracketed tag box — "[development]" on a block of its department's
 * colour, the way boulder.ge names a deck. The brackets are in the copy, not
 * added here, so a translator can keep or drop them.
 */
export function TagBox({
  tone = 'tech',
  size = 'small',
  className,
  id,
  children,
}: {
  tone?: FrameTone
  size?: 'small' | 'large'
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <span id={id} className={cn('tag-box', `tag-box--${tone}`, size === 'large' && 'tag-box--large', className)}>
      {children}
    </span>
  )
}
