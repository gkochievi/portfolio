/**
 * The demo-kit bar, mounted once: persona switcher (lands on the persona's
 * home), sign out, reset to the pristine seed. Owner: shell.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEMO_BAR_STRINGS, DemoBar } from '@portfolio/demo-kit'

import type { RigiAccount } from '@/demo/accounts'
import { session, store } from '@/demo/runtime'
import { queryClient } from '@/lib/queryClient'
import { signOutTo, switchAccount, useMe } from '@/lib/session'

export function DemoChrome() {
  const me = useMe()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  // The bar shows each persona's name, role and one-line blurb: localise them with the UI language.
  const accounts = useMemo(
    () =>
      session.accounts.map((account) => ({
        ...account,
        name: lang === 'ka' ? (account as RigiAccount).nameKa : account.name,
        roleLabel: i18n.t(`common:role.${(account as RigiAccount).role}`, { defaultValue: account.roleLabel }),
        description: i18n.t(`shell:personas.${account.id}`, { defaultValue: account.description }),
      })),
    [lang, i18n],
  )
  return (
    <DemoBar
      product="Rigi"
      accounts={accounts}
      currentId={me?.id ?? null}
      onSwitch={(id) => void switchAccount(id)}
      onSignOut={() => void signOutTo()}
      onReset={() => {
        store.reset()
        void queryClient.resetQueries()
        const current = session.current()
        if (current) navigate(current.home)
      }}
      strings={DEMO_BAR_STRINGS[lang]}
      baseUrl={import.meta.env.BASE_URL}
    />
  )
}
