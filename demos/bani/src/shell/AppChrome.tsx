/** Router + global chrome: DemoBar, toasts, tooltips, theme. Mounted once. */
import { RouterProvider } from 'react-router-dom'
import { DEMO_BAR_STRINGS, DemoBar, useSession, type DemoRouter } from '@portfolio/demo-kit'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui'
import { session } from '@/demo'
import { resetDemo, signOut, switchPersona, useLang, useTheme } from './state'

export function AppChrome({ router }: { router: DemoRouter }) {
  const lang = useLang()
  const theme = useTheme()
  const me = useSession(session)
  const navigate = (to: string, opts?: { replace?: boolean }) => router.navigate(to, opts)

  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster
        theme={theme}
        position="top-right"
        closeButton
        offset={68}
        toastOptions={{ duration: 3800 }}
      />
      <DemoBar
        product={lang === 'ka' ? 'ბანი' : 'Bani'}
        accounts={session.accounts.map((p) => (lang === 'ka' ? { ...p, name: p.nameKa } : p))}
        currentId={me?.id ?? null}
        onSwitch={(id) => switchPersona(id, navigate)}
        onSignOut={() => signOut(navigate)}
        onReset={resetDemo}
        strings={DEMO_BAR_STRINGS[lang]}
        baseUrl={import.meta.env.BASE_URL}
        position="bottom-right"
      />
    </TooltipProvider>
  )
}
