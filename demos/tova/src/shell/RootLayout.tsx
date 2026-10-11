/**
 * Root of every route: the DemoBar (one-click role switch, sign out, reset),
 * the toaster, scroll-to-top on navigation, and query resets when the
 * signed-in user changes.
 */
import { DEMO_BAR_STRINGS, DemoBar } from '@portfolio/demo-kit'
import { MotionConfig } from 'framer-motion'
import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Toaster, toastError } from '@/components/ui'
import { auth, useAuthUserId } from '@/demo/auth'
import { DEMO_ACCOUNTS } from '@/demo/seed/accounts'
import { bus, store } from '@/demo/store'
import { http } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { useLang } from '@/i18n'
import type { SessionUser } from '@/types'
import { roleHome, useDemoAccounts } from './session'

export function RootLayout() {
  const lang = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const userId = useAuthUserId()
  const accounts = useDemoAccounts()

  // Whoever is signed in owns every cached answer: refetch on a switch.
  useEffect(
    () =>
      auth.subscribe(() => {
        void queryClient.resetQueries()
      }),
    [],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const onSwitch = (id: string) => {
    http
      .post<SessionUser>('/auth/demo', { accountId: id })
      .then((user) => navigate(roleHome(user.role)))
      .catch(toastError)
  }

  const onSignOut = () => {
    auth.signOut()
    navigate('/', { replace: true })
  }

  const onReset = () => {
    store.reset()
    queryClient.removeQueries({ type: 'inactive' })
    void queryClient.resetQueries()
    bus.emit('demo:reset')
    const current = auth.currentId()
    if (current && !store.data.users.some((user) => user.id === current && !user.disabled)) {
      auth.signOut()
      navigate('/', { replace: true })
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <Outlet />
      <Toaster />
      <DemoBar
        product="Tova"
        accounts={accounts}
        currentId={userId && DEMO_ACCOUNTS.some((account) => account.id === userId) ? userId : null}
        onSwitch={onSwitch}
        onSignOut={onSignOut}
        onReset={onReset}
        strings={DEMO_BAR_STRINGS[lang]}
        baseUrl={import.meta.env.BASE_URL}
      />
    </MotionConfig>
  )
}
