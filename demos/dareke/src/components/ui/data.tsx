import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button } from './button'
import { EmptyState, Skeleton } from './display'

/* -------------------------------------------------------- Table primitives */

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-[13px]', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-sunken/70 dark:bg-sunken', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:last-child]:border-b-0', className)} {...props} />
}

export function TR({ className, interactive, selected, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      className={cn(
        'h-10 border-b border-hairline transition-colors',
        interactive && 'cursor-pointer hover:bg-sunken/80 focus-visible:bg-sunken',
        selected && 'bg-lime/15 dark:bg-lime/8',
        className,
      )}
      {...props}
    />
  )
}

export function TH({ className, align = 'left', ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'h-9 whitespace-nowrap border-b border-hairline px-3 text-xs font-semibold text-muted first:pl-4 last:pr-4',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, align = 'left', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle first:pl-4 last:pr-4',
        align === 'right' ? 'text-right tabular' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------- Pagination */

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const { t } = useTranslation()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted', className)}>
      <span className="tabular">{t('table.showing', { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="px-0" aria-label={t('actions.previous')} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </Button>
        <span className="min-w-16 text-center font-mono tabular text-ink">
          {page} / {pageCount}
        </span>
        <Button variant="ghost" size="sm" className="px-0" aria-label={t('actions.next')} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- DataTable */

export interface Column<T> {
  /** Unique key; also the default sort key when `sortValue` is omitted and T has that field. */
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  /** Enables click-to-sort. Return a string/number/date-ish value. */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  /** CSS width (e.g. 120 or '20%'). */
  width?: number | string
  className?: string
  headerClassName?: string
  /** Hide below the `sm` breakpoint. */
  hideOnMobile?: boolean
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

export interface DataTableProps<T> {
  rows: T[] | undefined
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  /** Shown when there are no rows (default: generic EmptyState). */
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Highlights the matching row. */
  selectedKey?: string | null
  /** Client-side page size (default 10; 0 = no pagination). Ignored when `pagination` is given. */
  pageSize?: number
  /** Server-side pagination: rows are the current page. */
  pagination?: PaginationProps
  initialSort?: SortState
  /** Controlled sort (server-side sort): pair with onSortChange. */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  className?: string
  /** Extra classes per row. */
  rowClassName?: (row: T) => string | undefined
  /** Wrap in a card frame (default true). */
  framed?: boolean
  /** Number of skeleton rows while loading. */
  skeletonRows?: number
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Sortable, paginated table with loading and empty states. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  selectedKey,
  pageSize = 10,
  pagination,
  initialSort = null,
  sort: controlledSort,
  onSortChange,
  className,
  rowClassName,
  framed = true,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [innerSort, setInnerSort] = useState<SortState>(initialSort)
  const sort = controlledSort !== undefined ? controlledSort : innerSort
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const list = rows ?? []
    if (!sort || onSortChange) return list
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return list
    const get = col.sortValue
    const out = [...list].sort((a, b) => compare(get(a), get(b)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, sort, columns, onSortChange])

  const total = sorted.length
  const clientPaged = !pagination && pageSize > 0
  const pageCount = clientPaged ? Math.max(1, Math.ceil(total / pageSize)) : 1
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  const visible = clientPaged ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted

  function toggleSort(key: string) {
    const next: SortState = sort?.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null
    if (onSortChange) onSortChange(next)
    else setInnerSort(next)
    setPage(1)
  }

  const showSkeleton = loading && (!rows || rows.length === 0)

  return (
    <div className={cn(framed && 'overflow-hidden rounded-card border border-hairline bg-panel', className)}>
      <Table>
        <THead>
          <tr>
            {columns.map((col) => {
              const sortable = Boolean(col.sortValue) || Boolean(onSortChange && col.sortValue !== undefined)
              const active = sort?.key === col.key
              return (
                <TH
                  key={col.key}
                  align={col.align}
                  style={col.width != null ? { width: col.width } : undefined}
                  className={cn(col.hideOnMobile && 'hidden sm:table-cell', col.headerClassName)}
                  aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn('-mx-1 inline-flex items-center gap-1 rounded-[4px] px-1 hover:text-ink', active && 'text-ink', col.align === 'right' && 'flex-row-reverse')}
                    >
                      {col.header}
                      {active ? (
                        sort?.dir === 'asc' ? <ArrowUp size={13} strokeWidth={2} /> : <ArrowDown size={13} strokeWidth={2} />
                      ) : (
                        <ChevronsUpDown size={13} strokeWidth={1.75} className="opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TH>
              )
            })}
          </tr>
        </THead>
        <TBody>
          {showSkeleton &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <TR key={`sk${i}`}>
                {columns.map((col) => (
                  <TD key={col.key} className={cn(col.hideOnMobile && 'hidden sm:table-cell')}>
                    <Skeleton className={cn('h-3.5', i % 2 ? 'w-3/5' : 'w-4/5', col.align === 'right' && 'ml-auto')} />
                  </TD>
                ))}
              </TR>
            ))}
          {!showSkeleton &&
            visible.map((row, i) => {
              const key = rowKey(row)
              return (
                <TR
                  key={key}
                  interactive={Boolean(onRowClick)}
                  selected={selectedKey != null && selectedKey === key}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  className={rowClassName?.(row)}
                >
                  {columns.map((col) => (
                    <TD key={col.key} align={col.align} className={cn(col.hideOnMobile && 'hidden sm:table-cell', col.className)}>
                      {col.cell(row, i)}
                    </TD>
                  ))}
                </TR>
              )
            })}
        </TBody>
      </Table>
      {!showSkeleton && visible.length === 0 && (empty ?? <EmptyState compact title={t('states.empty')} description={t('states.emptyHint')} />)}
      {pagination ? (
        pagination.total > pagination.pageSize && <Pagination className="border-t border-hairline" {...pagination} />
      ) : (
        clientPaged && total > pageSize && <Pagination className="border-t border-hairline" page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}
    </div>
  )
}
