import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { AzriLogo, AzriMark } from '@/components/brand/Logo'
import { LangSwitch, TenantMark, ThemeToggle } from '@/components/ui'
import type { TenantBranding } from '@/types'

/**
 * The white-label microsite frame: centred 420px column with 20px gutters on
 * warm mist (no device frame), tenant monogram header, language pill
 * top-right, footer "© {year} {copyrightName} · Powered by Azri".
 *
 * Survey pages tell it which tenant to wear via useRespondentTenant(); the
 * frame exposes the tenant colours as --brand / --on-brand / --brand-tint
 * (Tailwind: bg-brand, text-on-brand, bg-brand-tint, text-brand, border-brand),
 * switching to the tenant's primaryDark in dark mode.
 *
 * A tenant claimed on /survey carries over to /finished and /expired (the
 * flow's next screens) so the top bar does not flash while they look the
 * tenant up; any other route that does not claim one shows the Azri default.
 * Owner: shell agent (contract is final).
 */
interface Claim {
  tenant: TenantBranding
  path: string
}

interface RespondentBrand {
  tenant: TenantBranding | null
  claim: (tenant: TenantBranding, path: string) => void
}

const BrandContext = createContext<RespondentBrand>({ tenant: null, claim: () => {} })

/** Apply a tenant's branding to the respondent frame while the calling page is mounted. */
export function useRespondentTenant(tenant: TenantBranding | null | undefined): void {
  const { claim } = useContext(BrandContext)
  const { pathname } = useLocation()
  useEffect(() => {
    if (tenant) claim(tenant, pathname)
  }, [tenant, pathname, claim])
}

/** The tenant the frame currently wears (null = Azri default). */
export function useCurrentRespondentTenant(): TenantBranding | null {
  return useContext(BrandContext).tenant
}

const CARRY_OVER = new Set(['/finished', '/expired'])

export function RespondentLayout() {
  const { t } = useTranslation('shell')
  const { pathname } = useLocation()
  const [claimed, setClaimed] = useState<Claim | null>(null)
  const claim = useCallback((tenant: TenantBranding, path: string) => setClaimed({ tenant, path }), [])

  const tenant =
    claimed && (claimed.path === pathname || (claimed.path === '/survey' && CARRY_OVER.has(pathname))) ? claimed.tenant : null

  const value = useMemo(() => ({ tenant, claim }), [tenant, claim])
  const year = new Date().getFullYear()

  const style = tenant
    ? ({
        '--tenant-primary': tenant.primary,
        '--tenant-on-primary': tenant.onPrimary,
        '--tenant-tint': tenant.tint,
        '--tenant-primary-dark': tenant.primaryDark,
      } as CSSProperties)
    : undefined

  return (
    <BrandContext.Provider value={value}>
      <div className="brand-scope flex min-h-dvh flex-col bg-surface text-[17px] leading-relaxed text-ink" style={style}>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5">
          <header className="flex items-center justify-between gap-3 py-4">
            {tenant ? (
              <div className="flex min-w-0 items-center gap-2.5 animate-fade-in">
                <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size="sm" />
                <span className="truncate text-[15px] font-semibold">{tenant.name}</span>
              </div>
            ) : (
              <Link to="/" className="rounded-lg" aria-label={t('respondent.home')}>
                <AzriLogo size={26} />
              </Link>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle size="sm" />
              <LangSwitch />
            </div>
          </header>
          <main id="main" className="flex flex-1 flex-col">
            <Outlet />
          </main>
          <footer className="flex flex-col items-center gap-1 pb-24 pt-8 text-center text-[13px] text-muted">
            <span>{t('respondent.copyright', { year, holder: tenant?.copyrightName ?? 'Azri' })}</span>
            <span className="inline-flex items-center gap-1.5">
              {t('respondent.poweredBy')}
              <AzriMark size={14} />
              <span className="font-display font-semibold text-ink">Azri</span>
            </span>
          </footer>
        </div>
      </div>
    </BrandContext.Provider>
  )
}
