import { useEffect, useRef, useState } from 'react'

/**
 * Fires once, when the element first crosses into view.
 *
 * Once is deliberate: a card that faded back out on scroll-up would re-animate
 * every time the grid passed the fold, which reads as a glitch rather than a
 * reveal. The observer disconnects itself on the first hit.
 *
 * Falls back to visible when `IntersectionObserver` is missing, so the content
 * is never stuck at `opacity: 0` — an animation is worth losing, the page is
 * not.
 */
export function useInView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      // A little before the edge, so a card has finished settling by the time
      // it is properly on screen rather than animating under the reader's eye.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, seen]
}
