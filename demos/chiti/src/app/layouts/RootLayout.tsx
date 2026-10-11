import { useEffect, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { DemoBar, DEMO_BAR_STRINGS } from '@portfolio/demo-kit'
import '@portfolio/demo-kit/demo-kit.css'

import '@/styles/theme'
import { headlineAccounts } from '@/demo/session'
import { resetDemo } from '@/demo'
import { signInAs, useAccount } from '@/lib/account'
import { Toaster, TooltipProvider, toast } from '@/components/ui'
import { ImpersonationBanner } from '../components/ImpersonationBanner'
import { useSignOut } from '../session'

const TITLE_KEYS: [RegExp, string][] = [
  [/^\/operator\/profile/, 'nav.profile'],
  [/^\/operator/, 'nav.inbox'],
  [/^\/admin\/chats/, 'nav.chats'],
  [/^\/admin\/team/, 'nav.team'],
  [/^\/admin\/history/, 'nav.history'],
  [/^\/admin\/operators/, 'nav.operators'],
  [/^\/admin\/admins/, 'nav.admins'],
  [/^\/admin\/supervisors/, 'nav.supervisors'],
  [/^\/admin\/statistics/, 'nav.statistics'],
  [/^\/admin\/activity/, 'nav.activity'],
  [/^\/admin\/settings/, 'nav.settings'],
  [/^\/admin/, 'nav.dashboard'],
  [/^\/superadmin\/platform/, 'nav.platform'],
  [/^\/superadmin\/health/, 'nav.health'],
  [/^\/superadmin\/ai/, 'nav.aiKey'],
  [/^\/superadmin/, 'nav.tenants'],
  [/^\/live/, 'nav.liveDesk'],
  [/^\/widget/, 'nav.widget'],
  [/^\/login/, 'login.submit'],
]

/** Root of every route: DemoBar, toaster, tooltips, impersonation banner, document title. */
export function RootLayout() {
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const doSignOut = useSignOut()
  const lang = i18n.language?.startsWith('ka') ? 'ka' : 'en'

  // Document title follows the route + language.
  useEffect(() => {
    const key = TITLE_KEYS.find(([re]) => re.test(location.pathname))?.[1]
    document.title = key ? `${t(key)} · ${t('title.suffix')}` : t('title.suffix')
  }, [location.pathname, t, lang])

  // A different account sees different data: refetch whatever is on screen.
  useEffect(() => {
    void qc.invalidateQueries()
  }, [account?.id, qc])

  const accounts = useMemo(
    () =>
      headlineAccounts.map((a) => ({
        ...a,
        name: lang === 'ka' ? a.nameKa || a.name : a.name,
        roleLabel: t(`common:role.${a.role}`),
      })),
    [lang, t],
  )

  return (
    <TooltipProvider>
      <ImpersonationBanner />
      <Outlet />
      <Toaster />
      <DemoBar
        product="Chiti"
        accounts={accounts}
        currentId={account?.id ?? null}
        onSwitch={(id) => {
          const next = signInAs(id)
          qc.clear()
          navigate(next.homeRoute)
        }}
        onSignOut={() => void doSignOut({ silent: true })}
        onReset={() => {
          resetDemo()
          qc.clear()
          toast.success(t('toast.resetDone'))
        }}
        strings={DEMO_BAR_STRINGS[lang]}
        baseUrl={import.meta.env.BASE_URL}
        position="bottom-left"
      />
    </TooltipProvider>
  )
}
