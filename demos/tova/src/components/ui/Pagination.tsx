import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { IconButton } from './Button'

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** With pageSize, shows "21–40 of 57". */
  total?: number
  pageSize?: number
  className?: string
}

function pageList(page: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const out: (number | 'gap')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(count - 1, page + 1)
  if (start > 2) out.push('gap')
  for (let p = start; p <= end; p += 1) out.push(p)
  if (end < count - 1) out.push('gap')
  out.push(count)
  return out
}

export function Pagination({ page, pageCount, onPageChange, total, pageSize, className }: PaginationProps) {
  const { t, i18n } = useTranslation()
  const from = total !== undefined && pageSize ? (page - 1) * pageSize + 1 : null
  const to = total !== undefined && pageSize ? Math.min(total, page * pageSize) : null
  return (
    <nav aria-label={t('common:pagination.label')} className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-sm text-muted tabular-nums">
        {from !== null && to !== null && total !== undefined
          ? t('common:pagination.range', {
              from: formatNumber(from, i18n.language),
              to: formatNumber(to, i18n.language),
              total: formatNumber(total, i18n.language),
            })
          : t('common:pagination.page', { page, count: pageCount })}
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          variant="outline"
          label={t('common:pagination.prev')}
          icon={<ChevronLeft />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <div className="hidden items-center gap-1 sm:flex">
          {pageList(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-chip px-2 text-sm font-semibold tabular-nums transition-colors',
                  p === page ? 'bg-primary text-on-primary' : 'text-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <IconButton
          size="sm"
          variant="outline"
          label={t('common:pagination.next')}
          icon={<ChevronRight />}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  )
}
