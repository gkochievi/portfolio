/**
 * DataTable (sortable, paginated, loading / empty states, live-row flash) and
 * Pagination. Console density: 14px text, 40px rows, 12px radius.
 * Owner: design-system agent.
 */
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatNumber } from '@/lib/format'
import { asLang, cn } from '@/lib/utils'
import { EmptyState, Skeleton } from './Card'

export type SortDir = 'asc' | 'desc'
export interface SortState {
  id: string
  dir: SortDir
}

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  /** Makes the column sortable (client-side) by this value. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Server-side sortable (with `onSortChange`) even without sortValue. */
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  /** CSS width, e.g. '120px' or '20%'. */
  width?: string
  className?: string
  headerClassName?: string
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  getRowId: (row: T) => string
  loading?: boolean
  /** Shown instead of rows when `rows` is empty. Node, or EmptyState props. */
  empty?: ReactNode | { title: ReactNode; description?: ReactNode; action?: ReactNode }
  onRowClick?: (row: T) => void
  /** Row is "selected" (e.g. open in a drawer). */
  isRowActive?: (row: T) => boolean
  rowClassName?: (row: T) => string | undefined
  /** Row ids to flash mint (new live rows). */
  highlightIds?: ReadonlySet<string> | readonly string[]
  /** Initial client sort. */
  defaultSort?: SortState
  /** Controlled sort (server-side): the table will not reorder rows itself. */
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
  /** Client-side pagination page size (omit for no pagination). */
  pageSize?: number
  /** Server-side pagination (1-based page). */
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }
  skeletonRows?: number
  /** Accessible caption (visually hidden). */
  caption?: string
  /** Remove the outer border/radius (when inside a Card). */
  bare?: boolean
  className?: string
}

const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const
const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function isEmptyProps(value: unknown): value is { title: ReactNode; description?: ReactNode; action?: ReactNode } {
  return typeof value === 'object' && value !== null && 'title' in value && !('$$typeof' in value)
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  empty,
  onRowClick,
  isRowActive,
  rowClassName,
  highlightIds,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  pageSize,
  pagination,
  skeletonRows = 6,
  caption,
  bare,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation('common')
  const [localSort, setLocalSort] = useState<SortState | null>(defaultSort ?? null)
  const [localPage, setLocalPage] = useState(1)
  const serverSort = Boolean(onSortChange)
  const sort = serverSort ? (controlledSort ?? null) : localSort
  const highlights = useMemo(() => new Set(highlightIds ?? []), [highlightIds])

  const sorted = useMemo(() => {
    const list = rows ?? []
    if (serverSort || !sort) return list
    const column = columns.find((c) => c.id === sort.id)
    if (!column?.sortValue) return list
    const value = column.sortValue
    const out = [...list].sort((a, b) => compare(value(a), value(b)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, columns, sort, serverSort])

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  useEffect(() => {
    if (localPage > pageCount) setLocalPage(pageCount)
  }, [localPage, pageCount])
  const visible = pageSize ? sorted.slice((localPage - 1) * pageSize, localPage * pageSize) : sorted

  const toggleSort = (column: Column<T>) => {
    const next: SortState =
      sort?.id === column.id ? { id: column.id, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { id: column.id, dir: 'desc' }
    if (serverSort) onSortChange?.(next)
    else setLocalSort(next)
  }

  const showSkeleton = loading && (!rows || rows.length === 0)
  const isEmpty = !showSkeleton && sorted.length === 0

  return (
    <div className={cn(!bare && 'overflow-hidden rounded-[12px] border border-border bg-panel', className)}>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-panel-2">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue) || (serverSort && column.sortable)
                const active = sort?.id === column.id
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'h-10 whitespace-nowrap px-3 text-xs font-semibold text-muted first:pl-4 last:pr-4',
                      alignClass[column.align ?? 'left'],
                      column.hideBelow && hideClass[column.hideBelow],
                      column.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md hover:text-ink [&_svg]:size-3.5',
                          active && 'text-ink',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                        title={active && sort?.dir === 'desc' ? t('table.sortAsc') : t('table.sortDesc')}
                      >
                        {column.header}
                        {active ? sort?.dir === 'asc' ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown className="opacity-40" />}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk${i}`} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.id} className={cn('h-10 px-3 first:pl-4 last:pr-4', column.hideBelow && hideClass[column.hideBelow])}>
                      <Skeleton className="h-3.5 w-[70%]" />
                    </td>
                  ))}
                </tr>
              ))}
            {isEmpty && (
              <tr>
                <td colSpan={columns.length}>
                  {isEmptyProps(empty) ? (
                    <EmptyState compact title={empty.title} description={empty.description} action={empty.action} />
                  ) : (
                    (empty ?? <EmptyState compact title={t('table.noResults')} description={t('table.noResultsHint')} />)
                  )}
                </td>
              </tr>
            )}
            {!showSkeleton &&
              visible.map((row, index) => {
                const id = getRowId(row)
                const active = isRowActive?.(row) ?? false
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-selected={isRowActive ? active : undefined}
                    className={cn(
                      'border-b border-border transition-colors last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-ink/[.03] focus-visible:bg-ink/[.04] focus-visible:outline-none',
                      active && 'bg-primary-soft hover:bg-primary-soft',
                      highlights.has(id) && 'animate-flash',
                      loading && 'opacity-60',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'h-10 px-3 py-2 align-middle text-ink first:pl-4 last:pr-4',
                          alignClass[column.align ?? 'left'],
                          column.align === 'right' && 'tabular',
                          column.hideBelow && hideClass[column.hideBelow],
                          column.className,
                        )}
                      >
                        {column.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      {pageSize && sorted.length > pageSize && (
        <Pagination className="border-t border-border px-4 py-2.5" page={localPage} pageSize={pageSize} total={sorted.length} onPageChange={setLocalPage} />
      )}
      {pagination && pagination.total > 0 && (
        <Pagination className="border-t border-border px-4 py-2.5" {...pagination} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- Pagination */

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

function pageWindow(page: number, count: number): Array<number | '…'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const out: Array<number | '…'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(count - 1, page + 1)
  if (start > 2) out.push('…')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < count - 1) out.push('…')
  out.push(count)
  return out
}

/** "21–40 of 248" + prev / pages / next. */
export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const { t, i18n } = useTranslation('common')
  const lang = asLang(i18n.language)
  const count = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const btn =
    'grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] font-medium tabular transition-colors hover:bg-ink/6 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'
  return (
    <nav aria-label={t('pagination.label')} className={cn('flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted', className)}>
      <span className="tabular">
        {t('pagination.range', { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) })}
      </span>
      <span className="flex items-center gap-0.5">
        <button type="button" className={btn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t('pagination.previous')}>
          <ChevronLeft strokeWidth={1.75} />
        </button>
        <span className="hidden items-center gap-0.5 sm:flex">
          {pageWindow(page, count).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(btn, p === page && 'bg-primary-soft text-on-primary-soft hover:bg-primary-soft')}
              >
                {p}
              </button>
            ),
          )}
        </span>
        <span className="px-2 sm:hidden">
          {page} / {count}
        </span>
        <button type="button" className={btn} onClick={() => onPageChange(page + 1)} disabled={page >= count} aria-label={t('pagination.next')}>
          <ChevronRight strokeWidth={1.75} />
        </button>
      </span>
    </nav>
  )
}
