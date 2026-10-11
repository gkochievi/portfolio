import { useState } from 'react'

import { cn } from '@/lib/cn'
import { fromBase } from '@/lib/url'
import { ProjectMark } from './ProjectMark'

/**
 * A project's cover, laid over its host box (`.card-media`): the capture when
 * there is one and it loads, the generated `ProjectMark` on the brand's
 * coral-to-indigo tile (`.card-mark`) otherwise.
 *
 * "Otherwise" includes a cover that is named but not there. A project can be
 * added to the catalogue before its thumbnail is rendered, and the host may
 * answer a missing file with a 404 or with index.html; either way the image
 * fails to decode, `onError` fires, and the card shows its artwork instead of
 * an empty box. The failure is remembered per address, so a different cover
 * gets its own attempt.
 *
 * One component for every place a cover is drawn — the deck's cards, the
 * project page's hero, its prev/next squares and the 404's suggestions — so
 * they all fall back the same way. Decorative everywhere: the project's name
 * is always right beside it.
 */
export function ProjectCover({
  cover,
  seed,
  className,
  eager = false,
  width,
  height,
}: {
  /** The catalogue's base-relative `cover`, or null. */
  cover: string | null
  /** The slug: the mark's seed, so a project keeps its shape. */
  seed: string
  /** Extra classes for the image (not the fallback). */
  className?: string
  /** For the page's LCP candidates; everything else loads lazily. */
  eager?: boolean
  width?: number
  height?: number
}) {
  const src = cover ? fromBase(cover) : null
  const [failed, setFailed] = useState<string | null>(null)

  if (!src || failed === src) {
    return (
      <span className="card-media card-mark" aria-hidden="true">
        <ProjectMark seed={seed} />
      </span>
    )
  }

  return (
    <img
      className={cn('card-media', className)}
      src={src}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      width={width}
      height={height}
      onError={() => setFailed(src)}
    />
  )
}
