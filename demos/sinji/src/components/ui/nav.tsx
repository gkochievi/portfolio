import * as RTabs from '@radix-ui/react-tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { Select } from './form'

/* ------------------------------------------------------------- Tabs */

export interface TabItem {
  value: string
  label: ReactNode
  icon?: ReactNode
  count?: number
  disabled?: boolean
  /** Panel content; omit to render panels yourself with <TabPanel>. */
  content?: ReactNode
}

const triggerCls =
  'relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-45 [&_svg]:size-4 [&_svg]:stroke-[1.75] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent'
const triggerActive = 'text-ink after:bg-primary'

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={cn('tabular rounded-pill px-1.5 text-[11px] leading-[18px]', active ? 'bg-primary/12 text-primary' : 'bg-ink/7 text-muted')}>{n}</span>
  )
}

/** In-page tabs (Radix). Underline style; pass `variant="pill"` for a compact segmented look. */
export function Tabs({
  items,
  value,
  onValueChange,
  defaultValue,
  className,
  listClassName,
  variant = 'underline',
  children,
}: {
  items: TabItem[]
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  className?: string
  listClassName?: string
  variant?: 'underline' | 'pill'
  /** Extra <TabPanel>s when items carry no `content`. */
  children?: ReactNode
}) {
  const ctrl = value !== undefined ? { value } : { defaultValue: defaultValue ?? items[0]?.value }
  return (
    <RTabs.Root {...ctrl} onValueChange={onValueChange} className={className}>
      <RTabs.List
        className={cn(
          'scrollbar-thin flex overflow-x-auto',
          variant === 'underline' ? 'gap-5 border-b border-line' : 'inline-flex gap-0.5 rounded-ctl border border-line bg-sunken p-0.5',
          listClassName,
        )}
      >
        {items.map((item) => (
          <RTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              variant === 'underline'
                ? cn(triggerCls, 'data-[state=active]:text-ink data-[state=active]:after:bg-primary')
                : 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-medium text-muted hover:text-ink data-[state=active]:bg-panel data-[state=active]:text-ink [&_svg]:size-4',
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null ? <Count n={item.count} active={value === item.value} /> : null}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((item) =>
        item.content !== undefined ? (
          <RTabs.Content key={item.value} value={item.value} className="pt-5 outline-none data-[state=active]:animate-panel-in">
            {item.content}
          </RTabs.Content>
        ) : null,
      )}
      {children}
    </RTabs.Root>
  )
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RTabs.Content value={value} className={cn('pt-5 outline-none data-[state=active]:animate-panel-in', className)}>
      {children}
    </RTabs.Content>
  )
}

/* ---------------------------------------------------------- TabNav */

export interface TabNavItem {
  /** Route path (relative or absolute). */
  to: string
  label: ReactNode
  icon?: ReactNode
  count?: number
  /** Match only the exact path (default false: nested paths stay active). */
  end?: boolean
  hidden?: boolean
}

/** Route tabs: each tab is a NavLink (path-based, never #hash). */
export function TabNav({ items, className, 'aria-label': ariaLabel }: { items: TabNavItem[]; className?: string; 'aria-label'?: string }) {
  return (
    <nav aria-label={ariaLabel} className={cn('scrollbar-thin -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div className="flex min-w-max gap-5 border-b border-line">
        {items
          .filter((i) => !i.hidden)
          .map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(triggerCls, isActive && triggerActive)}>
              {({ isActive }) => (
                <>
                  {item.icon}
                  {item.label}
                  {item.count != null ? <Count n={item.count} active={isActive} /> : null}
                </>
              )}
            </NavLink>
          ))}
      </div>
    </nav>
  )
}

/* ------------------------------------------------------- Pagination */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50],
  className,
}: {
  /** 1-based. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  className?: string
}) {
  const { t, i18n } = useTranslation('common')
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const nf = new Intl.NumberFormat(i18n.language === 'ka' ? 'ka-GE' : 'en-GB')
  const btn =
    'grid size-8 place-items-center rounded-ctl border border-line-strong bg-panel text-ink hover:bg-sunken disabled:opacity-40 disabled:pointer-events-none'
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted', className)}>
      <span className="tabular">{t('pagination.range', { from: nf.format(from), to: nf.format(to), total: nf.format(total) })}</span>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('pagination.perPage')}</span>
            <Select
              size="sm"
              className="w-[72px]"
              aria-label={t('pagination.perPage')}
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
            />
          </div>
        ) : null}
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t('pagination.previous')}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>
        <span className="tabular min-w-16 text-center">{t('pagination.page', { page, pages })}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label={t('pagination.next')}>
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
