import { useTranslation } from 'react-i18next'
import { DEMO_BAR_STRINGS, DemoBar, useSession } from '@portfolio/demo-kit'

import { resetDemoData, session } from '@/demo/core'
import { router } from '@/router'
import { asLang } from '@/lib/utils'

/**
 * The demo-kit bar: account switcher (lands on the account's `home`), sign
 * out, reset. Owner: shell agent.
 */
export function DemoChrome() {
  const me = useSession(session)
  const { i18n } = useTranslation()
  const lang = asLang(i18n.language)
  return (
    <DemoBar
      product="Azri"
      accounts={session.accounts}
      currentId={me?.id ?? null}
      onSwitch={(id) => {
        const account = session.signIn(id)
        void router.navigate(account.home)
      }}
      onSignOut={() => {
        session.signOut()
        void router.navigate('/login')
      }}
      onReset={() => {
        resetDemoData()
        void router.navigate(session.current()?.home ?? '/')
      }}
      strings={DEMO_BAR_STRINGS[lang]}
      baseUrl={import.meta.env.BASE_URL}
    />
  )
}
