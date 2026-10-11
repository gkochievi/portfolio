import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatIndex, formatNumber } from '@/lib/format'

import { Button } from './button'
import { EmptyState, Skeleton, type EmptyStateProps } from './display'
import { NativeSelect } from './form'

function isEmptyProps(v: unknown): v is EmptyStateProps {
  return typeof v === 'object' && v !== null && !('$$typeof' in v) && 'title' in v
}

function renderEmpty(empty: ReactNode | EmptyStateProps | undefined, fallback: string): ReactNode {
  if (empty === undefined || empty === null) return <EmptyState compact title={fallback} />
  if (isEmptyProps(empty)) return <EmptyState compact {...empty} />
  return empty as ReactNode
}

export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: string
  dir: SortDir
}

export interface Column<T> {
  key: string
  header: ReactNode
  /** Cell renderer; defaults to `row[key]`. */
  cell?: (row: T, index: number) => ReactNode
  sortable?: boolean
  /** Value used for client-side sorting; defaults to `row[key]`. */
  sortValue?: (row: T) => string | number | boolean | null | undefined
  align?: 'left' | 'right' | 'center'
  width?: number | string
  /** JetBrains Mono + tabular (ids, amounts). */
  mono?: boolean
  /** Hide below a breakpoint to keep phones scroll-free. */
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  /** undefined while loading. */
  rows: T[] | undefined
  getRowId: (row: T) => string
  loading?: boolean
  /** Shows an error state with Retry. */
  error?: unknown
  onRetry?: () => void
  /** Mono "01, 02…" gutter. */
  rowNumbers?: boolean
  selectable?: boolean
  selectedIds?: string[]
  onSelectedChange?: (ids: string[]) => void
  /** Row with the "now serving" rule. */
  activeRowId?: string | null
  onRowClick?: (row: T) => void
  /** Navigates on click / Enter. */
  rowHref?: (row: T) => string
  rowClassName?: (row: T) => string | undefined
  /** Replaces the default empty state: a node, or EmptyState props ({title, description?, action?}). */
  empty?: ReactNode | EmptyStateProps
  initialSort?: SortState
  /** Controlled sort (server-side): rows are NOT sorted locally. */
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
  /** Client-side pagination page size (default 25). 0 = show all (use <Pagination> for server paging). */
  pageSize?: number
  /** Rendered under the table (totals row etc.). */
  footer?: ReactNode
  className?: string
  /** Accessible table caption (visually hidden). */
  caption?: string
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const hideCls = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const

function defaultValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  rowNumbers,
  selectable,
  selectedIds,
  onSelectedChange,
  activeRowId,
  onRowClick,
  rowHref,
  rowClassName,
  empty,
  initialSort,
  sort: controlledSort,
  onSortChange,
  pageSize = 25,
  footer,
  className,
  caption,
}: DataTableProps<T>) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [localSort, setLocalSort] = useState<SortState | null>(initialSort ?? null)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)
  const controlled = controlledSort !== undefined
  const sort = controlled ? controlledSort : localSort

  const sorted = useMemo(() => {
    if (!rows) return undefined
    if (controlled || !sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.sortValue ?? ((r: T) => defaultValue(r, col.key) as string | number)
    const copy = [...rows]
    copy.sort((a, b) => compare(get(a), get(b)) * (sort.dir === 'asc' ? 1 : -1))
    return copy
  }, [rows, sort, columns, controlled])

  const total = sorted?.length ?? 0
  const paged = size > 0 && sorted ? sorted.slice((page - 1) * size, page * size) : sorted
  const offset = size > 0 ? (page - 1) * size : 0

  useEffect(() => {
    const pages = size > 0 ? Math.max(1, Math.ceil(total / size)) : 1
    if (page > pages) setPage(pages)
  }, [total, size, page])

  const toggleSort = (key: string) => {
    const next: SortState = sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    if (controlled) onSortChange?.(next)
    else {
      setLocalSort(next)
      onSortChange?.(next)
    }
  }

  const selected = new Set(selectedIds ?? [])
  const pageIds = (paged ?? []).map(getRowId)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPage = pageIds.some((id) => selected.has(id))
  const toggleAll = () => {
    const next = new Set(selected)
    if (allOnPage) pageIds.forEach((id) => next.delete(id))
    else pageIds.forEach((id) => next.add(id))
    onSelectedChange?.([...next])
  }
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange?.([...next])
  }

  const clickable = Boolean(onRowClick || rowHref)
  const activate = (row: T) => {
    if (onRowClick) onRowClick(row)
    else if (rowHref) navigate(rowHref(row))
  }
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) activate(row)
  }

  const colCount = columns.length + (rowNumbers ? 1 : 0) + (selectable ? 1 : 0)
  const showLoading = loading || (rows === undefined && !error)

  return (
    <div className={cn('overflow-hidden rounded-lg border border-hairline bg-panel', className)}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-[13px] leading-[18px]">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-hairline bg-sunken/60">
              {selectable ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={t('table.selectAll')}
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPage && someOnPage
                    }}
                    onChange={toggleAll}
                    className="size-4 cursor-pointer accent-[var(--primary)]"
                  />
                </th>
              ) : null}
              {rowNumbers ? <th className="w-10 px-3 py-2 text-left font-mono text-[11px] font-normal text-subtle">#</th> : null}
              {columns.map((col) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('h-9 whitespace-nowrap px-3 text-xs font-medium text-muted', alignCls[col.align ?? 'left'], col.hideBelow && hideCls[col.hideBelow])}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn('inline-flex items-center gap-1 rounded hover:text-ink', active && 'text-ink', col.align === 'right' && 'flex-row-reverse')}
                      >
                        {col.header}
                        {active ? (
                          sort!.dir === 'asc' ? <ArrowUp className="size-3.5 stroke-[1.75]" aria-hidden /> : <ArrowDown className="size-3.5 stroke-[1.75]" aria-hidden />
                        ) : (
                          <ChevronsUpDown className="size-3.5 stroke-[1.75] opacity-40" aria-hidden />
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
            {showLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="h-10 border-b border-hairline last:border-0">
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className="px-3">
                      <Skeleton className={cn('h-3.5', j === 0 ? 'w-8' : 'w-[70%]')} />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={colCount}>
                  <EmptyState
                    compact
                    title={t('states.error')}
                    description={error instanceof Error ? error.message : undefined}
                    action={onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>{t('actions.retry')}</Button> : undefined}
                  />
                </td>
              </tr>
            ) : paged && paged.length === 0 ? (
              <tr>
                <td colSpan={colCount}>{renderEmpty(empty, t('states.empty'))}</td>
              </tr>
            ) : (
              paged!.map((row, i) => {
                const id = getRowId(row)
                const isSel = selected.has(id)
                return (
                  <tr
                    key={id}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? (e) => {
                      if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return
                      activate(row)
                    } : undefined}
                    onKeyDown={clickable ? (e) => onKey(e, row) : undefined}
                    aria-selected={selectable ? isSel : undefined}
                    className={cn(
                      'h-10 border-b border-hairline transition-colors duration-150 last:border-0 hover:bg-row-hover',
                      clickable && 'cursor-pointer',
                      isSel && 'bg-row-hover',
                      activeRowId === id && 'serving bg-row-hover',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable ? (
                      <td className="w-10 px-3">
                        <input type="checkbox" aria-label={t('table.selectRow')} checked={isSel} onChange={() => toggleOne(id)} className="size-4 cursor-pointer accent-[var(--primary)]" />
                      </td>
                    ) : null}
                    {rowNumbers ? <td className="w-10 px-3 font-mono text-[11px] text-subtle">{formatIndex(offset + i + 1)}</td> : null}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2 align-middle',
                          alignCls[col.align ?? 'left'],
                          col.mono && 'num whitespace-nowrap font-mono text-[12px]',
                          col.align === 'right' && 'num',
                          col.hideBelow && hideCls[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row, offset + i) : (defaultValue(row, col.key) as ReactNode) ?? <span className="text-subtle">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-hairline">{footer}</div> : null}
      {size > 0 && total > size ? (
        <div className="border-t border-hairline px-3 py-2">
          <Pagination page={page} pageSize={size} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(1) }} />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------ Pagination */

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  className?: string
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [25, 50, 100], className }: PaginationProps) {
  const { t } = useTranslation('common')
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label={t('pagination.label')} className={cn('flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted', className)}>
      <span className="num">
        {t('pagination.range', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <NativeSelect
            size="sm"
            aria-label={t('pagination.perPage')}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="w-[76px]"
            options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
          />
        ) : null}
        <span className="num hidden sm:inline">{t('pagination.page', { page, pages })}</span>
        <Button variant="outline" size="sm" className="w-8 px-0" aria-label={t('actions.previous')} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="outline" size="sm" className="w-8 px-0" aria-label={t('actions.next')} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
