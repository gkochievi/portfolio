import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'

// boulder.ge's vertical-page tuning: an element counts as "in view" once a
// quarter of it has cleared the bottom 12% of the viewport — early enough
// that the reveal reads as the content arriving with the scroll, late enough
// that it does not fire for a sliver peeking in under the fold.
const VERTICAL_OPTIONS: IntersectionObserverInit = { rootMargin: '0px 0px -12% 0px', threshold: 0.25 }

type RevealTag = 'div' | 'section' | 'header' | 'article' | 'li' | 'ul' | 'p' | 'span' | 'h1' | 'h2' | 'h3'

type RevealProps = Omit<HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children'> & {
  as?: RevealTag
  /** Staggers a small extra delay per element, so a group cascades in. */
  index?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Wraps a piece of content so it rises in as it scrolls into view (motion.css
 * `.reveal`), once per element, then stays put — a "you've arrived" moment,
 * not a loop. Without IntersectionObserver it is simply visible: an
 * animation is worth losing, the content is not.
 */
export default function Reveal({ as = 'div', index = 0, className = '', style, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true)
        observer.disconnect()
      }
    }, VERTICAL_OPTIONS)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // One element type for the ref; the tag itself is whatever was asked for.
  const Tag = as as 'div'
  return (
    <Tag
      ref={ref}
      className={`reveal${inView ? ' reveal--visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: `${Math.min(index, 6) * 70}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export { Reveal }
