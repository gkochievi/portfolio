import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, HeartPulse, KeyRound, Plug } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Logo } from '@/components/brand'
import { useRouteGuard } from '../components/Guard'
import { HeaderControls } from '../components/HeaderControls'

const ic = { strokeWidth: 1.75 }
const NAV = [
  { to: '/superadmin', labelKey: 'nav.tenants', icon: <Building2 {...ic} />, end: true },
  { to: '/superadmin/platform', labelKey: 'nav.platform', icon: <Plug {...ic} /> },
  { to: '/superadmin/health', labelKey: 'nav.health', icon: <HeartPulse {...ic} /> },
  { to: '/superadmin/ai', labelKey: 'nav.aiKey', icon: <KeyRound {...ic} /> },
]

/** Super-admin console: plain header + horizontal nav. */
export function SuperAdminLayout() {
  const guard = useRouteGuard()
  const { t } = useTranslation('shell')
  if (guard) return guard
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <NavLink to="/superadmin" aria-label="Chiti" className="rounded-ui focus-visible:outline-2 focus-visible:outline-accent">
            <Logo size={28} />
          </NavLink>
          <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />
          <span className="hidden text-[13px] font-medium text-muted sm:inline">{t('surface.superadmin')}</span>
          <nav aria-label={t('nav.main')} className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} label={t(n.labelKey)} />
            ))}
          </nav>
          <div className="flex-1" />
          <HeaderControls />
        </div>
        <nav aria-label={t('nav.main')} className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} label={t(n.labelKey)} />
          ))}
        </nav>
      </header>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex h-8 shrink-0 items-center gap-2 rounded-ui px-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
          isActive ? 'bg-ink text-bg' : 'text-muted hover:bg-hover hover:text-ink',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
