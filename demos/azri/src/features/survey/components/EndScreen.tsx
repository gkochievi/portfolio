import type { ReactNode } from 'react'

import { Illustration, type IllustrationKind } from '@/components/ui'
import { cn } from '@/lib/utils'

interface EndScreenProps {
  illustration: IllustrationKind
  animated?: boolean
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}

/** Shared layout of the flow's end states: flat two-colour art, polite copy, next steps. */
export function EndScreen({ illustration, animated, eyebrow, title, description, children, className }: EndScreenProps) {
  return (
    <section className={cn('flex min-h-[62vh] flex-col items-center justify-center py-8 text-center', className)}>
      <Illustration kind={illustration} size={208} animated={animated} className="animate-fade-in" />
      {eyebrow && <p className="mt-6 text-sm font-semibold text-brand">{eyebrow}</p>}
      <h1 className={cn('font-display text-[28px] leading-tight font-semibold text-ink text-balance', eyebrow ? 'mt-1.5' : 'mt-6')}>{title}</h1>
      {description && <p className="mt-3 max-w-[34ch] text-muted text-pretty">{description}</p>}
      {children && <div className="mt-7 flex w-full flex-col items-stretch gap-3">{children}</div>}
    </section>
  )
}
