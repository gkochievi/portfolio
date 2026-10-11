/**
 * Light 232px staff sidebar: logo, nav groups, the "now serving" rule on the
 * active item. Rendered fixed on desktop and inside a drawer on mobile.
 * Owner: shell.
 */
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { isNavActive, navFor } from '@/app/nav'
import { Logo } from '@/components/brand'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/cn'
import { localName } from '@/lib/format'
import { useMe } from '@/lib/session'
import type { StaffArea } from '@/types'

export function SidebarContent({ area, onNavigate }: { area: StaffArea; onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const { pathname, search } = useLocation()
  const me = useMe()
  const groups = navFor(area, me)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <Link to={me?.home ?? '/'} onClick={onNavigate} className="rounded-md" aria-label={t('chrome.home')}>
          <Logo size={26} />
        </Link>
      </div>
      <div className="px-4 pb-2 pt-1">
        <div className="eyebrow">{t(`nav.areas.${area}`)}</div>
      </div>
      <nav aria-label={t('nav.mainLabel')} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-5')}>
            {group.label ? <div className="eyebrow mb-1 px-2">{t(`nav.${group.label}`)}</div> : null}
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active = group.label === 'roleAreas' ? pathname === item.to || pathname.startsWith(`${item.to}/`) : isNavActive(item, pathname, search)
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150 ease-rigi',
                        active
                          ? 'serving bg-panel font-semibold text-ink ring-1 ring-hairline'
                          : 'text-muted hover:bg-ink/5 hover:text-ink',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0 stroke-[1.75]', active ? 'text-ink' : 'text-subtle')} aria-hidden />
                      <span className="truncate">{t(`nav.${item.label}`)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      {me ? (
        <div className="flex shrink-0 items-center gap-2.5 border-t border-hairline px-4 py-3">
          <Avatar name={me.name} size="sm" color={me.avatarColor} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium">{localName(me)}</p>
            <p className="truncate text-[11px] text-muted">{t(`role.${me.role}`)}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function Sidebar({ area }: { area: StaffArea }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-hairline bg-surface lg:block">
      <SidebarContent area={area} />
    </aside>
  )
}
