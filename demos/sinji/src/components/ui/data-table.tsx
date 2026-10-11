import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Checkbox } from './form'
import { Pagination } from './nav'
import { EmptyState, Skeleton } from './surface'

export interface Column<T> {
  /** Unique key; also the default sort field (`row[key]`). */
  key: string
  header: ReactNode
  /** Cell renderer; defaults to `String(row[key])`. */
  cell?: (row: T, index: number) => ReactNode
  /** Enable sorting; pass a function to sort by a derived value. */
  sortable?: boolean | ((row: T) => string | number | null | undefined)
  align?: 'left' | 'right' | 'center'
  /** CSS width, e.g. 120 or '30%'. */
  width?: number | string
  className?: string
  /** Hide on narrow screens: 'sm' | 'md' | 'lg' breakpoint below which the column is hidden. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

export interface DataTableProps<T> {
  rows: T[] | undefined
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  /** Shown instead of rows when not loading and rows are empty. */
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Highlight a row (e.g. the open one). */
  activeKey?: string | null
  /** Enable checkbox selection. */
  selectedKeys?: string[]
  onSelectionChange?: (keys: string[]) => void
  /** Client-side pagination page size (ignored when `serverPagination` is given). 0 = no paging. */
  pageSize?: number
  /** Server-side paging: the table shows `rows` as-is and renders the pager. */
  serverPagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void }
  defaultSort?: SortState
  /** Controlled sort (for server-side sorting); rows are then not sorted locally. */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  dense?: boolean
  className?: string
  /** Remove the outer border/radius (when already inside a Panel flush). */
  bare?: boolean
  rowClassName?: (row: T) => string | undefined
  caption?: string
}

const hideCls = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

function readValue<T>(row: T, col: Column<T>): unknown {
  if (typeof col.sortable === 'function') return col.sortable(row)
  return (row as Record<string, unknown>)[col.key]
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  activeKey,
  selectedKeys,
  onSelectionChange,
  pageSize = 25,
  serverPagination,
  defaultSort = null,
  sort: controlledSort,
  onSortChange,
  dense,
  className,
  bare,
  rowClassName,
  caption,
}: DataTableProps<T>) {
  const { t } = useTranslation('common')
  const [localSort, setLocalSort] = useState<SortState>(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : localSort
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)

  const sorted = useMemo(() => {
    const list = rows ?? []
    if (!sort || controlledSort !== undefined) return list
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return list
    const out = [...list].sort((a, b) => compare(readValue(a, col), readValue(b, col)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [rows, sort, columns, controlledSort])

  const total = sorted.length
  const paged = !serverPagination && size > 0
  const pages = paged ? Math.max(1, Math.ceil(total / size)) : 1
  useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])
  const visible = paged ? sorted.slice((page - 1) * size, page * size) : sorted

  const toggleSort = (key: string) => {
    const next: SortState = sort?.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null
    if (controlledSort === undefined) setLocalSort(next)
    onSortChange?.(next)
    setPage(1)
  }

  const selectable = !!onSelectionChange
  const selected = new Set(selectedKeys ?? [])
  const visibleKeys = visible.map(rowKey)
  const allOn = visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k))
  const someOn = visibleKeys.some((k) => selected.has(k))
  const toggleAll = () => {
    const next = new Set(selected)
    if (allOn) visibleKeys.forEach((k) => next.delete(k))
    else visibleKeys.forEach((k) => next.add(k))
    onSelectionChange?.([...next])
  }
  const toggleOne = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange?.([...next])
  }

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-2.5'
  const alignCls = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  const showEmpty = !loading && (rows?.length ?? 0) === 0

  return (
    <div className={cn(!bare && 'overflow-hidden rounded-card border border-line bg-panel', className)}>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              {selectable ? (
                <th className="w-10 px-4 py-2">
                  <Checkbox checked={allOn ? true : someOn ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label={t('actions.selectAll')} />
                </th>
              ) : null}
              {columns.map((col) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'h-10 whitespace-nowrap text-xs font-medium text-muted',
                      dense ? 'px-3' : 'px-4',
                      alignCls(col.align),
                      col.hideBelow && hideCls[col.hideBelow],
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn('inline-flex items-center gap-1 rounded hover:text-ink', active && 'text-ink', col.align === 'right' && 'flex-row-reverse')}
                        aria-label={typeof col.header === 'string' ? `${col.header}: ${active && sort?.dir === 'asc' ? t('table.sortDesc') : t('table.sortAsc')}` : undefined}
                      >
                        {col.header}
                        {active ? (
                          sort?.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-11 border-b border-line last:border-0">
                    {selectable ? <td className="px-4" /> : null}
                    {columns.map((col) => (
                      <td key={col.key} className={cn(cellPad, col.hideBelow && hideCls[col.hideBelow])}>
                        <Skeleton className="h-3.5" style={{ width: `${50 + ((i * 13 + col.key.length * 7) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row, i) => {
                  const key = rowKey(row)
                  const isSel = selected.has(key)
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row)
                            }
                          : undefined
                      }
                      tabIndex={onRowClick ? 0 : undefined}
                      data-active={activeKey === key || undefined}
                      className={cn(
                        'h-11 border-b border-line transition-colors last:border-0',
                        onRowClick && 'cursor-pointer hover:bg-sunken/70 focus-visible:bg-sunken/70 focus-visible:outline-none',
                        (isSel || activeKey === key) && 'bg-primary/6',
                        rowClassName?.(row),
                      )}
                    >
                      {selectable ? (
                        <td className="w-10 px-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggleOne(key)} aria-label={t('actions.select')} />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(cellPad, 'align-middle', alignCls(col.align), col.hideBelow && hideCls[col.hideBelow], col.className)}
                        >
                          {col.cell ? col.cell(row, i) : String((row as Record<string, unknown>)[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {showEmpty ? <div className="border-t border-line first:border-0">{empty ?? <EmptyState compact />}</div> : null}
      {serverPagination && serverPagination.total > 0 ? (
        <Pagination
          className="border-t border-line px-4 py-2.5"
          page={serverPagination.page}
          pageSize={serverPagination.pageSize}
          total={serverPagination.total}
          onPageChange={serverPagination.onPageChange}
          onPageSizeChange={serverPagination.onPageSizeChange}
        />
      ) : paged && total > size ? (
        <Pagination
          className="border-t border-line px-4 py-2.5"
          page={page}
          pageSize={size}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setSize(s)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
}
