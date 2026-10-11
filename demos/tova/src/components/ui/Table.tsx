/**
 * Tables: 44px rows, sticky header, zebra. `DataTable` adds sorting,
 * pagination, loading skeletons and an empty state; the low-level
 * `Table/THead/TBody/TR/TH/TD` are there for custom layouts.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { EmptyState, Skeleton } from './Feedback'
import { Pagination } from './Pagination'

export function Table({ className, maxHeight, children, ...props }: HTMLAttributes<HTMLDivElement> & { maxHeight?: string }) {
  return (
    <div
      className={cn('relative w-full overflow-auto rounded-card border-[1.5px] border-line bg-panel shadow-card', className)}
      style={maxHeight ? { maxHeight } : undefined}
      {...props}
    >
      <table className="w-full border-collapse text-left text-[14px] tabular-nums">{children}</table>
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-[1] bg-sunken', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:nth-child(even)]:bg-zebra', className)} {...props} />
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-t border-line first:border-t-0', className)} {...props} />
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('h-10 whitespace-nowrap border-b-[1.5px] border-line px-3 text-xs font-semibold text-muted', className)}
      {...props}
    />
  )
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-11 px-3 py-1.5 align-middle text-ink', className)} {...props} />
}

type Align = 'left' | 'right' | 'center'
const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' }
const HIDE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number | boolean | null | undefined
  align?: Align
  /** CSS width, e.g. '120px' or '30%'. */
  width?: string
  /** Hide the column below this breakpoint (phones). */
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
  headerClassName?: string
}

export interface SortState {
  id: string
  dir: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  /** undefined while loading. */
  rows: T[] | undefined
  getRowId: (row: T) => string
  loading?: boolean
  /** Empty-state title; or pass a full node via `empty`. */
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  empty?: ReactNode
  /** Rows per page; 0 disables pagination. Default 20. */
  pageSize?: number
  initialSort?: SortState
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined | false
  /** Scroll container height so the header sticks, e.g. '70vh'. */
  maxHeight?: string
  /** Accessible table name. */
  caption?: string
  skeletonRows?: number
  className?: string
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  emptyTitle,
  emptyDescription,
  empty,
  pageSize = 20,
  initialSort,
  onRowClick,
  rowClassName,
  maxHeight,
  caption,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null)
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const list = rows ?? []
    if (!sort) return list
    const column = columns.find((c) => c.id === sort.id)
    if (!column?.sortValue) return list
    const get = column.sortValue
    const out = [...list].sort((a, b) => compare(get(a), get(b)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, sort, columns])

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  const visible = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted

  const toggleSort = (id: string) => {
    setPage(1)
    setSort((current) => {
      if (!current || current.id !== id) return { id, dir: 'asc' }
      if (current.dir === 'asc') return { id, dir: 'desc' }
      return null
    })
  }

  const isLoading = loading || rows === undefined
  const cellClass = (c: Column<T>) => cn(ALIGN[c.align ?? 'left'], c.hideBelow && HIDE[c.hideBelow], c.className)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Table maxHeight={maxHeight}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <THead>
          <tr>
            {columns.map((c) => {
              const active = sort?.id === c.id
              return (
                <TH
                  key={c.id}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(ALIGN[c.align ?? 'left'], c.hideBelow && HIDE[c.hideBelow], c.headerClassName)}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-[4px] hover:text-ink',
                        c.align === 'right' && 'flex-row-reverse',
                        active && 'text-ink',
                      )}
                      title={t('common:table.sort')}
                    >
                      {c.header}
                      {active ? (
                        sort?.dir === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TH>
              )
            })}
          </tr>
        </THead>
        <TBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, i) => (
              <TR key={`sk-${i}`}>
                {columns.map((c) => (
                  <TD key={c.id} className={cellClass(c)}>
                    <Skeleton className={cn('h-4', c.align === 'right' ? 'ml-auto w-12' : 'w-3/4')} />
                  </TD>
                ))}
              </TR>
            ))
          ) : visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {empty ?? <EmptyState compact title={emptyTitle ?? t('common:empty.title')} description={emptyDescription} />}
              </td>
            </tr>
          ) : (
            visible.map((row, index) => (
              <TR
                key={getRowId(row)}
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
                className={cn(onRowClick && 'cursor-pointer hover:bg-sunken focus-visible:bg-sunken', rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <TD key={c.id} className={cellClass(c)}>
                    {c.cell(row, (page - 1) * Math.max(pageSize, 0) + index)}
                  </TD>
                ))}
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {!isLoading && pageSize > 0 && sorted.length > pageSize && (
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={sorted.length} pageSize={pageSize} />
      )}
    </div>
  )
}
