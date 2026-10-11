import { ArrowLeft } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title (event name, section). */
  eyebrow?: ReactNode
  /** Buttons on the right (wrap under the title on phones). */
  actions?: ReactNode
  /** Back link above the title. */
  back?: { to: string; label: string }
  /** player = Unbounded 32-44px headline; admin (default) = calmer 24-28px. */
  variant?: 'admin' | 'player'
  className?: string
}

export function PageHeader({ title, description, eyebrow, actions, back, variant = 'admin', className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 animate-drop-in">
        {back && (
          <Link
            to={back.to}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1 text-sm font-semibold text-muted">{eyebrow}</div>}
        <h1
          className={cn(
            'font-display leading-[1.1] text-ink [overflow-wrap:anywhere]',
            variant === 'player' ? 'text-[32px] sm:text-[44px]' : 'text-2xl sm:text-[28px]',
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Row of filters / search / actions above a table. Wraps on phones. */
export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)} {...props} />
}

export const FilterBar = Toolbar

/** Pushes following toolbar items to the right. */
export function ToolbarSpacer() {
  return <div className="hidden flex-1 sm:block" aria-hidden />
}

/** Titled section inside a page. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-8', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
