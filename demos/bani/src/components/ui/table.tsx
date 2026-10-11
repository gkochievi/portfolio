/** Table primitives, Pagination and a batteries-included DataTable. */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  type CSSProperties,
} from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { fmtNumber } from '@/lib/format'
import type { Lang } from '@/types'
import { Select } from './controls'
import { EmptyState, Skeleton } from './display'

export type SortDir = 'asc' | 'desc'
export type Align = 'left' | 'right' | 'center'

const DensityContext = createContext<'normal' | 'compact'>('normal')

/* ---------------------------------------------------------------- primitives */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** 34px rows instead of 40px. */
  compact?: boolean
  /** Classes for the scroll wrapper (e.g. max-h-[560px] for a sticky header inside). */
  wrapperClassName?: string
  wrapperStyle?: CSSProperties
}

export function Table({ compact, className, wrapperClassName, wrapperStyle, children, ...rest }: TableProps) {
  return (
    <DensityContext.Provider value={compact ? 'compact' : 'normal'}>
      <div className={cn('scrollbar-thin relative w-full overflow-auto', wrapperClassName)} style={wrapperStyle}>
        <table className={cn('w-full border-separate border-spacing-0 text-[13px]', className)} {...rest}>
          {children}
        </table>
      </div>
    </DensityContext.Provider>
  )
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-[1]', className)} {...rest} />
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
}

export function Tr({ selected, onClick, className, ...rest }: TrProps) {
  return (
    <tr
      onClick={onClick}
      aria-selected={selected || undefined}
      className={cn(
        'group/row transition-colors duration-[160ms]',
        onClick && 'cursor-pointer',
        selected ? 'bg-primary/8' : 'hover:bg-hover/60',
        className,
      )}
      {...rest}
    />
  )
}

export interface ThProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  sort?: SortDir | null
  onSort?: () => void
  align?: Align
}

export function Th({ sort, onSort, align = 'left', className, children, ...rest }: ThProps) {
  const density = useContext(DensityContext)
  const SortIcon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th
      scope="col"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
      className={cn(
        'whitespace-nowrap border-b border-line bg-sunken px-3 text-[12px] font-semibold text-muted first:pl-4 last:pr-4',
        density === 'compact' ? 'h-8' : 'h-9',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 rounded hover:text-ink',
            align === 'right' && 'flex-row-reverse',
            sort && 'text-ink',
          )}
        >
          {children}
          <SortIcon size={13} strokeWidth={2} className={cn(!sort && 'opacity-40')} aria-hidden />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export interface TdProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> {
  align?: Align
  mono?: boolean
  muted?: boolean
}

export function Td({ align = 'left', mono, muted, className, ...rest }: TdProps) {
  const density = useContext(DensityContext)
  return (
    <td
      className={cn(
        'border-b border-line px-3 align-middle first:pl-4 last:pr-4',
        density === 'compact' ? 'h-[34px] py-1' : 'h-10 py-1.5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        mono && 'font-mono text-[12.5px] tabular',
        muted && 'text-muted',
        className,
      )}
      {...rest}
    />
  )
}

/* ---------------------------------------------------------------- Pagination */

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: readonly number[]
  className?: string
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [25, 50, 100],
  className,
}: PaginationProps) {
  const { t, i18n } = useTranslation('common')
  const lang: Lang = i18n.language === 'ka' ? 'ka' : 'en'
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-hover hover:text-ink disabled:opacity-40 disabled:pointer-events-none'
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-muted', className)}>
      <div className="flex items-center gap-3">
        <span className="tabular">
          {t('ui.pagination.range', { from: fmtNumber(from, lang), to: fmtNumber(to, lang), total: fmtNumber(total, lang) })}
        </span>
        {onPageSizeChange && (
          <span className="inline-flex items-center gap-2">
            <span className="hidden sm:inline">{t('ui.pagination.rows')}</span>
            <Select
              size="sm"
              className="w-[76px]"
              aria-label={t('ui.pagination.rows')}
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
            />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label={t('ui.pagination.first')}>
          <ChevronsLeft size={16} aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t('ui.pagination.prev')}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="px-2 tabular text-ink">{t('ui.pagination.page', { page, pages })}</span>
        <button type="button" className={btn} onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label={t('ui.pagination.next')}>
          <ChevronRight size={16} aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => onPageChange(pages)} disabled={page >= pages} aria-label={t('ui.pagination.last')}>
          <ChevronsRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- DataTable */

export interface Column<T> {
  /** Stable id; also the sort key. */
  id: string
  header: ReactNode
  /** Cell renderer. Defaults to String(row[id]). */
  cell?: (row: T, index: number) => ReactNode
  /** Value used for client-side sorting; presence makes the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Server-side sorting: mark sortable without sortValue (use with sort/onSortChange). */
  sortable?: boolean
  align?: Align
  mono?: boolean
  width?: number | string
  className?: string
  headerClassName?: string
  /** Hide below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface SortState {
  id: string
  dir: SortDir
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[]
  rows: readonly T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  /** Shown when rows is empty and not loading. */
  empty?: ReactNode
  emptyTitle?: ReactNode
  emptyBody?: ReactNode
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  compact?: boolean
  /** Client pagination page size (0 = no pagination). Ignored when `paging` is given. */
  pageSize?: number
  pageSizes?: readonly number[]
  /** Server pagination: you own page state and `total`. */
  paging?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void }
  /** Controlled sort (server-side); otherwise sorted locally with sortValue. */
  sort?: SortState | null
  onSortChange?: (sort: SortState | null) => void
  defaultSort?: SortState | null
  /** Render extra content under a row (expanded rows). */
  renderExpanded?: (row: T) => ReactNode
  expandedKeys?: ReadonlySet<string>
  className?: string
  /** Max height of the scroll area (sticky header inside). */
  maxHeight?: number | string
  skeletonRows?: number
  rowClassName?: (row: T) => string | undefined
}

const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  emptyTitle,
  emptyBody,
  onRowClick,
  selectedKey,
  compact,
  pageSize: initialPageSize = 0,
  pageSizes,
  paging,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  renderExpanded,
  expandedKeys,
  className,
  maxHeight,
  skeletonRows = 8,
  rowClassName,
}: DataTableProps<T>) {
  const { t } = useTranslation('common')
  const [localSort, setLocalSort] = useState<SortState | null>(defaultSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const sort = controlledSort !== undefined ? controlledSort : localSort

  const sorted = useMemo(() => {
    const list = rows ? [...rows] : []
    if (!sort || controlledSort !== undefined) return list
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sortValue) return list
    const get = col.sortValue
    list.sort((a, b) => compareValues(get(a), get(b)) * (sort.dir === 'asc' ? 1 : -1))
    return list
  }, [rows, sort, columns, controlledSort])

  const total = paging ? paging.total : sorted.length
  const effPageSize = paging ? paging.pageSize : pageSize
  const pages = effPageSize > 0 ? Math.max(1, Math.ceil(total / effPageSize)) : 1
  const curPage = paging ? paging.page : Math.min(page, pages)
  const visible = !paging && effPageSize > 0 ? sorted.slice((curPage - 1) * effPageSize, curPage * effPageSize) : sorted

  const toggleSort = (id: string) => {
    const next: SortState | null =
      sort?.id !== id ? { id, dir: 'asc' } : sort.dir === 'asc' ? { id, dir: 'desc' } : null
    if (onSortChange) onSortChange(next)
    if (controlledSort === undefined) setLocalSort(next)
    if (!paging) setPage(1)
  }

  const showEmpty = !loading && sorted.length === 0

  return (
    <div className={cn('min-w-0', className)}>
      <Table
        compact={compact}
        wrapperStyle={maxHeight !== undefined ? { maxHeight } : undefined}
        aria-busy={loading || undefined}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.id} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <THead>
          <tr>
            {columns.map((c) => {
              const canSort = Boolean(c.sortValue) || Boolean(c.sortable)
              return (
                <Th
                  key={c.id}
                  align={c.align}
                  sort={sort?.id === c.id ? sort.dir : null}
                  onSort={canSort ? () => toggleSort(c.id) : undefined}
                  className={cn(c.hideBelow && hideClass[c.hideBelow], c.headerClassName)}
                >
                  {c.header}
                </Th>
              )
            })}
          </tr>
        </THead>
        <TBody>
          {loading && sorted.length === 0
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c, j) => (
                    <Td key={c.id} className={cn(c.hideBelow && hideClass[c.hideBelow])}>
                      <Skeleton className="h-3.5" style={{ width: `${55 + ((i * 7 + j * 13) % 40)}%` }} />
                    </Td>
                  ))}
                </tr>
              ))
            : visible.map((row, i) => {
                const key = rowKey(row)
                const expanded = renderExpanded && expandedKeys?.has(key)
                return (
                  <RowFragment key={key}>
                    <Tr
                      selected={selectedKey === key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(loading && 'opacity-60', rowClassName?.(row))}
                    >
                      {columns.map((c) => (
                        <Td
                          key={c.id}
                          align={c.align}
                          mono={c.mono}
                          className={cn(c.hideBelow && hideClass[c.hideBelow], c.className)}
                        >
                          {c.cell ? c.cell(row, i) : String((row as Record<string, unknown>)[c.id] ?? '-')}
                        </Td>
                      ))}
                    </Tr>
                    {expanded && (
                      <tr>
                        <td colSpan={columns.length} className="border-b border-line bg-sunken/60 px-4 py-3">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </RowFragment>
                )
              })}
        </TBody>
      </Table>
      {showEmpty && (empty ?? <EmptyState compact title={emptyTitle ?? t('states.noResults')} body={emptyBody} />)}
      {(paging || effPageSize > 0) && total > 0 && (
        <Pagination
          className="border-t border-line"
          page={curPage}
          pageSize={effPageSize}
          total={total}
          pageSizes={pageSizes}
          onPageChange={paging ? paging.onPageChange : setPage}
          onPageSizeChange={
            paging
              ? paging.onPageSizeChange
              : (s) => {
                  setPageSize(s)
                  setPage(1)
                }
          }
        />
      )}
    </div>
  )
}

function RowFragment({ children }: { children: ReactNode }) {
  return <>{children}</>
}
