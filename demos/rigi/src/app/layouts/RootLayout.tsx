/**
 * Root of every screen: toaster, DemoBar, bus listeners (store changed ->
 * refetch; simulator notices -> toasts), scroll restoration. Owner: shell.
 */
import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast, Toaster } from 'sonner'

import { useTheme } from '@/app/theme'
import { DemoChrome } from '@/components/demo/DemoChrome'
import type { ChangedEntity } from '@/demo/events'
import { bus } from '@/demo/runtime'
import { queryClient } from '@/lib/queryClient'

function useBusBridge(): void {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  useEffect(() => {
    const offChanged = bus.on('changed', ({ entities }) => {
      const set = new Set<ChangedEntity>(entities)
      void queryClient.invalidateQueries({ predicate: (q) => set.has(q.queryKey[0] as ChangedEntity) })
    })
    const offAccess = bus.on('partner.access', () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    })
    const offNotify = bus.on('notify', (notice) => {
      const title = i18n.exists(notice.title) ? t(notice.title, notice.values) : notice.title
      const description = notice.description && i18n.exists(notice.description) ? t(notice.description, notice.values) : notice.description
      const href = notice.href
      const show = notice.tone === 'error' ? toast.error : notice.tone === 'success' ? toast.success : notice.tone === 'warning' ? toast.warning : toast.info
      show(title, {
        description,
        action: href ? { label: t('common:actions.open'), onClick: () => navigate(href) } : undefined,
      })
    })
    return () => {
      offChanged()
      offAccess()
      offNotify()
    }
  }, [t, i18n, navigate])
}

export function RootLayout() {
  const { resolved } = useTheme()
  useBusBridge()
  return (
    <>
      <Outlet />
      <ScrollRestoration />
      <Toaster position="bottom-right" theme={resolved} offset={16} visibleToasts={4} closeButton />
      <DemoChrome />
    </>
  )
}
