import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Logo } from '@/components/brand'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAccount } from '@/lib/session'
import { LangToggle, ThemeToggle, UserMenu } from './controls'

/** Signed-out (and public) chrome for `/`, `/editor`, `/login`. */
export function PublicLayout() {
  const { t } = useTranslation('shell')
  const account = useAccount()
  const { pathname } = useLocation()
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-ctl px-3 py-1.5 text-[13.5px] font-medium transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink')
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Link to="/" className="mr-1 rounded-ctl" aria-label={t('common:brand.name')}>
            <Logo size={28} className="text-[22px]" />
          </Link>
          <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={linkCls}>
              {t('nav.voiceTools')}
            </NavLink>
            <NavLink to="/editor" className={linkCls}>
              {t('nav.editor')}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LangToggle />
            <ThemeToggle />
            {account ? (
              <>
                <Button asChild size="sm" variant="primary" className="hidden sm:inline-flex">
                  <Link to={account.home}>
                    <LayoutDashboard aria-hidden />
                    {t('topbar.openWorkspace')}
                  </Link>
                </Button>
                <UserMenu />
              </>
            ) : pathname !== '/login' ? (
              <Button asChild size="sm" variant="primary">
                <Link to="/login">{t('topbar.signIn')}</Link>
              </Button>
            ) : null}
          </div>
        </div>
        <nav aria-label={t('nav.main')} className="flex gap-1 border-t border-line px-4 py-1.5 md:hidden">
          <NavLink to="/" end className={linkCls}>
            {t('nav.voiceTools')}
          </NavLink>
          <NavLink to="/editor" className={linkCls}>
            {t('nav.editor')}
          </NavLink>
          {account ? (
            <Link to={account.home} className="ml-auto rounded-ctl px-3 py-1.5 text-[13.5px] font-medium text-primary sm:hidden">
              {t('topbar.openWorkspace')}
            </Link>
          ) : null}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          <Logo size={18} className="text-sm" />
          <span>{t('common:brand.tagline')}</span>
        </div>
      </footer>
    </div>
  )
}
