import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface Crumb {
  label: ReactNode
  to?: string
}

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Right-aligned actions (buttons). Wrap under the title on phones. */
  actions?: ReactNode
  breadcrumbs?: Crumb[]
  /** Small olive line above the title. */
  eyebrow?: ReactNode
  /** Inline content after the title (status badge). */
  meta?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, breadcrumbs, eyebrow, meta, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-muted">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden /> : null}
                {c.to ? (
                  <Link to={c.to} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="mb-1 text-[13px] font-medium text-accent">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {meta}
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Section title inside a page (h2). */
export function SectionTitle({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  )
}
