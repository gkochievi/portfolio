import type { ReactNode } from 'react'

import Reveal from './Reveal'

// boulder.ge's section header (components/SectionTitle.jsx): one huge
// lowercase word flush with the content's right edge, and a bracketed
// one-line subtitle in indigo tucked under its baseline — "works" over
// "[browse some of the cases we worked on]".
//
// The subtitle carries its own square brackets in the copy; they are words,
// not decoration, so a translator can keep or drop them.
//
// `children` is an optional third thing in the header, for a control that
// belongs beside the subtitle (boulder.ge's category filter). `as` picks the
// heading level, so a page whose first heading this is can make it the h1.
type SectionTitleProps = {
  title: ReactNode
  subtitle?: ReactNode
  index?: number
  as?: 'h1' | 'h2'
  id?: string
  children?: ReactNode
}

export default function SectionTitle({ title, subtitle, index = 0, as = 'h2', id, children }: SectionTitleProps) {
  const Heading = as
  return (
    <Reveal as="div" index={index} className="section-title">
      <Heading className="section-title__word" id={id}>
        {title}
      </Heading>
      {subtitle && <p className="section-title__sub">{subtitle}</p>}
      {children}
    </Reveal>
  )
}

export { SectionTitle }
