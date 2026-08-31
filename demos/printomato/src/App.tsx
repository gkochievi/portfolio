import { Component, Suspense, lazy } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { APP_BASE } from '@/lib/bootstrap'
import { ApiError } from '@/lib/api'
import { useSession } from '@/lib/queries'
import { AppShell } from '@/components/layout/AppShell'
import { DemoBanner } from '@/components/demo/DemoBanner'
import { ToastProvider } from '@/components/ui/Toast'
import { Button, Spinner } from '@/components/ui/primitives'

import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'

// Route-level code splitting: the dashboard and login ship in the entry chunk,
// everything else loads on first visit.
const DevicesPage = lazy(() => import('@/pages/DevicesPage').then((m) => ({ default: m.DevicesPage })))
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage').then((m) => ({ default: m.CampaignsPage })))
const PhotosPage = lazy(() => import('@/pages/PhotosPage').then((m) => ({ default: m.PhotosPage })))
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
)
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const AccountPage = lazy(() => import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Never retry an auth or validation failure — only transient ones.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

/* ------------------------------------------------------------- ErrorBoundary */

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Console crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <CrashScreen error={this.state.error} />
  }
}

function CrashScreen({ error }: { error: Error }) {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="panel max-w-md px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-ink">{t('errors.crashTitle')}</h1>
        <p className="mt-2 text-sm text-ink-faint">{t('errors.crashBody')}</p>
        <pre className="mt-4 max-h-32 overflow-auto rounded-control border border-hairline bg-void/60 p-3 text-left text-[11px] break-words whitespace-pre-wrap text-danger/80">
          {error.message}
        </pre>
        <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Router */

/**
 * `VITE_ROUTER=hash` is the escape hatch for a static host that cannot serve
 * index.html for unknown paths. A hash router carries its own base in the
 * fragment, so it takes no basename; the browser router reads its one from the
 * build's base path.
 */
function DemoRouter({ children }: { children: ReactNode }) {
  if (__DEMO_ROUTER__ === 'hash') return <HashRouter>{children}</HashRouter>
  return <BrowserRouter basename={APP_BASE || '/'}>{children}</BrowserRouter>
}

/* ---------------------------------------------------------------- Auth gate */

function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data, isPending, isError } = useSession()

  if (isPending) return <FullPageSpinner />
  if (isError || !data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}

/* ---------------------------------------------------------------- NotFound */

function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="grid min-h-[55vh] place-items-center text-center">
      <div>
        <p className="numeral text-6xl font-semibold text-gold/25">404</p>
        <h1 className="mt-3 text-xl font-semibold text-ink">{t('errors.notFoundTitle')}</h1>
        <p className="mt-1.5 text-sm text-ink-faint">{t('errors.notFoundBody')}</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>
          {t('errors.backHome')}
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- App */

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <DemoBanner />
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route
                  path="devices"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <DevicesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="campaigns"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <CampaignsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="photos"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <PhotosPage scope="all" />
                    </Suspense>
                  }
                />
                <Route
                  path="devices/:deviceId/photos"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <PhotosPage scope="device" />
                    </Suspense>
                  }
                />
                <Route
                  path="campaigns/:campaignId/photos"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <PhotosPage scope="campaign" />
                    </Suspense>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <NotificationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="devices/:deviceId/notifications"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <NotificationsPage scoped />
                    </Suspense>
                  }
                />
                <Route
                  path="payments"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <PaymentsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="account"
                  element={
                    <Suspense fallback={<FullPageSpinner />}>
                      <AccountPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </DemoRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
