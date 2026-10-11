import { DEMO_BAR_STRINGS, DemoBar } from '@portfolio/demo-kit'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui'
import { session } from '@/demo'
import { useAccount } from '@/lib/session'
import { resetDemo, signInAs, signOut } from './actions'
import { useTheme } from './theme'

/** Root of every route: tooltips, toaster, DemoBar, scroll restore. */
export function RootLayout() {
  const { i18n } = useTranslation()
  const account = useAccount()
  const { theme } = useTheme()
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const barAccounts = useMemo(
    () =>
      session.accounts.map((a) =>
        lang === 'ka' ? { ...a, name: a.name_ka, roleLabel: a.roleLabel_ka, description: a.description_ka } : a,
      ),
    [lang],
  )
  return (
    <TooltipProvider>
      <Outlet />
      <ScrollRestoration />
      <Toaster theme={theme} position="top-center" closeButton duration={4000} />
      <DemoBar
        product="Sinji"
        accounts={barAccounts}
        currentId={account?.id ?? null}
        onSwitch={(id) => signInAs(id)}
        onSignOut={signOut}
        onReset={resetDemo}
        strings={DEMO_BAR_STRINGS[lang]}
        baseUrl={import.meta.env.BASE_URL}
      />
    </TooltipProvider>
  )
}
