/** Shell helpers: the signed-in User straight from the demo store (sync, no flash), and the demo accounts for the current language. */
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthUserId } from '@/demo/auth'
import { DEMO_ACCOUNTS } from '@/demo/seed/accounts'
import { store } from '@/demo/store'
import type { Role, TovaAccount, User } from '@/types'

export function useCurrentUser(): User | null {
  const id = useAuthUserId()
  useSyncExternalStore(store.subscribe, () => store.version, () => store.version)
  if (!id) return null
  return store.data.users.find((user) => user.id === id) ?? null
}

/** Where each role lands after a one-click switch. */
export function roleHome(role: Role): string {
  return role === 'PLAYER' ? '/me' : '/admin'
}

/** DEMO_ACCOUNTS localised for the DemoBar and the login cards. */
export function useDemoAccounts(): TovaAccount[] {
  const { t, i18n } = useTranslation()
  const ka = i18n.language === 'ka'
  return DEMO_ACCOUNTS.map((account) => ({
    ...account,
    name: ka ? account.nameKa : account.name,
    roleLabel: t(`common:roles.${account.role}`),
    description: t(`common:roleDescriptions.${account.role}`),
    // White initials never sit on persimmon: use the darker persimmon ink.
    avatarColor: account.role === 'PLAYER' ? '#C2410C' : account.avatarColor,
  }))
}

/** The one-click demo accounts keep their Georgian-script names in the Georgian UI; visitors keep what they typed. */
function demoNameKa(id: string | undefined, lang?: string | null): string | null {
  if (lang !== 'ka' || !id) return null
  return DEMO_ACCOUNTS.find((account) => account.id === id)?.nameKa ?? null
}

export function displayName(
  user: { id?: string; firstName: string; lastName: string; email: string },
  lang?: string | null,
): string {
  return demoNameKa(user.id, lang) ?? (`${user.firstName} ${user.lastName}`.trim() || user.email)
}

export function localizedFirstName(user: { id?: string; firstName: string }, lang?: string | null): string {
  return demoNameKa(user.id, lang)?.split(' ')[0] ?? user.firstName
}
