/**
 * Everything outside the router: the kit's DemoBar (localised
 * role labels), the toaster, live query invalidation from the bus, and the
 * theme bootstrap.
 */
import { DemoBar, DEMO_BAR_STRINGS, useSession, type DemoRouter } from '@portfolio/demo-kit'
import '@portfolio/demo-kit/demo-kit.css'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Toaster } from '@/components/ui'
import { accountNameKa, resetDemo, session } from '@/demo'
import { useLiveInvalidation } from '@/lib/live'
import { queryClient } from '@/lib/queryClient'
import { useTheme } from './theme'

export function DemoChrome({ router }: { router: DemoRouter }) {
  const me = useSession(session)
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  useLiveInvalidation()

  const accounts = useMemo(
    () =>
      session.accounts.map((account) => ({
        ...account,
        name: lang === 'ka' ? (accountNameKa[account.id] ?? account.name) : account.name,
        roleLabel: t(`roles.${account.role}`),
        description: t(`login.accountHint.${account.role}`, { ns: 'shell' }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang],
  )

  return (
    <>
      <Toaster theme={theme} />
      <DemoBar
        product="Dareke"
        accounts={accounts}
        currentId={me?.id ?? null}
        onSwitch={(id) => {
          const account = session.signIn(id)
          queryClient.clear()
          void router.navigate(account.home)
        }}
        onSignOut={() => {
          session.signOut()
          queryClient.clear()
          void router.navigate('/login')
        }}
        onReset={() => {
          resetDemo()
          queryClient.clear()
        }}
        strings={DEMO_BAR_STRINGS[lang]}
        baseUrl={import.meta.env.BASE_URL}
      />
    </>
  )
}
