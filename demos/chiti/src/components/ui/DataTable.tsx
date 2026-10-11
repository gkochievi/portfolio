import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  /** Makes the column sortable (client-side). */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right' | 'center'
  /** CSS width, e.g. 120 or '20%'. */
  width?: number | string
  /** Hide the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg'
  className?: string
  headerClassName?: string
}

export type SortState = { id: string; dir: 'asc' | 'desc' } | null

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: readonly T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  /** Empty-state content: a node, or { title, description, action }. */
  empty?: ReactNode | { title: ReactNode; description?: ReactNode; action?: ReactNode; nest?: boolean }
  /** Client-side page size (default 10). 0 disables paging. Ignored when `total` is set (server paging). */
  pageSize?: number
  /** Controlled page (1-based). */
  page?: number
  onPageChange?: (page: number) => void
  /** Server-side paging: total row count; `rows` is then the current page. */
  total?: number
  initialSort?: SortState
  /** Controlled sort (server-side sorting). */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  /** 40px rows instead of 52px. */
  dense?: boolean
  /** Extra classes per row (e.g. muted for soft-deleted). */
  rowClassName?: (row: T) => string | undefined
  caption?: string
  className?: string
}

const hideCls = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const
const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Sortable, paginated table with loading skeleton rows and an empty state. Scrolls horizontally on phones. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  pageSize = 10,
  page: pageProp,
  onPageChange,
  total,
  initialSort = null,
  sort: sortProp,
  onSortChange,
  onRowClick,
  selectedKey,
  dense,
  rowClassName,
  caption,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [sortLocal, setSortLocal] = useState<SortState>(initialSort)
  const [pageLocal, setPageLocal] = useState(1)
  const sort = sortProp !== undefined ? sortProp : sortLocal
  const page = pageProp ?? pageLocal
  const serverPaged = total !== undefined
  const serverSorted = sortProp !== undefined

  const setPage = (p: number) => {
    if (pageProp === undefined) setPageLocal(p)
    onPageChange?.(p)
  }
  const toggleSort = (id: string) => {
    const next: SortState = sort?.id !== id ? { id, dir: 'asc' } : sort.dir === 'asc' ? { id, dir: 'desc' } : null
    if (sortProp === undefined) setSortLocal(next)
    onSortChange?.(next)
    if (!serverPaged) setPage(1)
  }

  const sorted = useMemo(() => {
    const list = rows ? [...rows] : []
    if (!sort || serverSorted) return list
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortValue) return list
    const get = col.sortValue
    list.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, sort, columns, serverSorted])

  const count = serverPaged ? total : sorted.length
  const paged = !serverPaged && pageSize > 0
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(count / pageSize)) : 1
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount])
  const visible = paged ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted
  const rowH = dense ? 'h-10' : 'h-[52px]'

  let emptyNode: ReactNode = null
  if (!loading && visible.length === 0) {
    if (empty && typeof empty === 'object' && 'title' in (empty as object)) {
      const e = empty as { title: ReactNode; description?: ReactNode; action?: ReactNode; nest?: boolean }
      emptyNode = <EmptyState compact title={e.title} description={e.description} action={e.action} illustration={e.nest ? 'nest' : 'none'} />
    } else {
      emptyNode = (empty as ReactNode) ?? <EmptyState compact title={t('states.empty')} />
    }
  }

  return (
    <div className={cn('min-w-0 overflow-hidden rounded-ui border border-line bg-panel', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              {columns.map((c) => {
                const active = sort?.id === c.id
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={{ width: c.width }}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('h-10 whitespace-nowrap px-4 text-[12px] font-medium text-muted', alignCls[c.align ?? 'left'], c.hideBelow && hideCls[c.hideBelow], c.headerClassName)}
                  >
                    {c.sortValue || (serverSorted && onSortChange) ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        className={cn('inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-accent', active && 'text-ink', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        {active ? sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ChevronsUpDown size={13} className="opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: Math.min(pageSize || 6, 6) }, (_, i) => (
                  <tr key={`sk-${i}`} className={cn('border-b border-line last:border-0', rowH)}>
                    {columns.map((c) => (
                      <td key={c.id} className={cn('px-4', c.hideBelow && hideCls[c.hideBelow])}>
                        <div className="h-3 rounded bg-sunken" style={{ width: `${45 + ((i * 17 + c.id.length * 7) % 45)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row, i) => {
                  const key = rowKey(row)
                  const selected = selectedKey === key
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row)) : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-selected={onRowClick ? selected : undefined}
                      className={cn(
                        'border-b border-line transition-colors last:border-0',
                        rowH,
                        onRowClick && 'cursor-pointer hover:bg-hover/60 focus-visible:bg-hover focus-visible:outline-none',
                        selected && 'bg-accent-soft/60 shadow-[inset_3px_0_0_var(--c-accent)]',
                        rowClassName?.(row),
                      )}
                    >
                      {columns.map((c) => (
                        <td key={c.id} className={cn('px-4 py-2 align-middle text-ink', alignCls[c.align ?? 'left'], c.hideBelow && hideCls[c.hideBelow], c.className)}>
                          {c.cell(row, i)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {emptyNode}
      {(paged || serverPaged) && pageSize > 0 && count > pageSize ? (
        <div className="border-t border-line px-4 py-2">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={count} pageSize={pageSize} />
        </div>
      ) : null}
    </div>
  )
}

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** With pageSize, shows "21-40 of 132". */
  total?: number
  pageSize?: number
  className?: string
}

export function Pagination({ page, pageCount, onPageChange, total, pageSize, className }: PaginationProps) {
  const { t } = useTranslation()
  const pages = useMemo(() => {
    const out: (number | '…')[] = []
    for (let p = 1; p <= pageCount; p++) {
      if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) out.push(p)
      else if (out[out.length - 1] !== '…') out.push('…')
    }
    return out
  }, [page, pageCount])
  const btn = 'grid h-8 min-w-8 place-items-center rounded-ui px-2 text-[13px] tabular transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40'
  return (
    <nav aria-label={t('pagination.label')} className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <span className="text-xs text-muted tabular">
        {total !== undefined && pageSize
          ? t('pagination.range', { from: Math.min(total, (page - 1) * pageSize + 1), to: Math.min(total, page * pageSize), total })
          : t('pagination.page', { page, count: pageCount })}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(btn, 'hover:bg-hover')} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t('pagination.previous')}>
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(btn, p === page ? 'bg-ink font-semibold text-bg' : 'hover:bg-hover')}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={cn(btn, 'hover:bg-hover')} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label={t('pagination.next')}>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}
