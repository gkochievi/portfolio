import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Skeleton } from './primitives'

/* ------------------------------------------------------------------- Table */

export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-hairline px-4 py-2.5 text-left',
        'text-[11px] font-semibold tracking-[0.09em] text-ink-faint uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-hairline px-4 py-3 align-middle text-ink-muted', className)} {...props}>
      {children}
    </td>
  )
}

export function Tr({
  className,
  interactive,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        interactive && 'cursor-pointer hover:bg-white/[0.035]',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: cols }, (_, colIndex) => (
            <td key={colIndex} className="border-b border-hairline px-4 py-3.5">
              <Skeleton className={cn('h-3.5', colIndex === 0 ? 'w-32' : 'w-20')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/* -------------------------------------------------------------- Pagination */

function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set<number>([1, total, current])
  for (let offset = 1; offset <= 1; offset++) {
    if (current - offset > 1) pages.add(current - offset)
    if (current + offset < total) pages.add(current + offset)
  }
  if (current <= 3) [2, 3, 4].forEach((page) => page < total && pages.add(page))
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => page > 1 && pages.add(page))

  const ordered = [...pages].sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  let previous = 0
  for (const page of ordered) {
    if (previous && page - previous > 1) result.push('gap')
    result.push(page)
    previous = page
  }
  return result
}

export function Pagination({
  page,
  numPages,
  count,
  pageSize,
  onChange,
  className,
}: {
  page: number
  numPages: number
  count: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}) {
  const { t } = useTranslation()
  if (numPages <= 1) {
    return count > 0 ? (
      <p className={cn('numeral py-3 text-center text-xs text-ink-faint', className)}>
        {t('common.showing', { from: 1, to: count, total: count })}
      </p>
    ) : null
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between', className)}
    >
      <p className="numeral order-2 text-xs text-ink-faint sm:order-1">
        {t('common.showing', { from, to, total: count })}
      </p>

      <ul className="order-1 flex items-center gap-1 sm:order-2">
        <li>
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label={t('common.previous')}
            className="grid size-8 place-items-center rounded-[8px] border border-hairline text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>
        </li>

        {pageWindow(page, numPages).map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} className="px-1 text-xs text-ink-faint">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                onClick={() => onChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'numeral grid h-8 min-w-8 place-items-center rounded-[8px] border px-2 text-xs transition-colors',
                  entry === page
                    ? 'border-gold/50 bg-gold/12 font-semibold text-gold'
                    : 'border-hairline text-ink-muted hover:border-hairline-strong hover:text-ink',
                )}
              >
                {entry}
              </button>
            </li>
          ),
        )}

        <li>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= numPages}
            aria-label={t('common.next')}
            className="grid size-8 place-items-center rounded-[8px] border border-hairline text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
