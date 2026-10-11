/**
 * Every route in the demo. Pages are lazy chunks with a DEFAULT export.
 * Owner: architect (the shell agent may restyle wrappers; keep paths and files).
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { Navigate, useLocation, type RouteObject } from 'react-router-dom'

import { ConsoleLayout } from '@/components/layout/ConsoleLayout'
import { PageFallback } from '@/components/layout/PageFallback'
import { RequireRole } from '@/components/layout/RequireRole'
import { RespondentLayout } from '@/components/layout/RespondentLayout'
import { RouteError } from '@/components/layout/RouteError'
import { SiteLayout } from '@/components/layout/SiteLayout'
import type { Role } from '@/types'

// Public launcher (feature group: launcher)
const InboxPage = lazy(() => import('@/features/launcher/pages/InboxPage'))
const PlaygroundPage = lazy(() => import('@/features/launcher/pages/PlaygroundPage'))
// Respondent microsite (feature group: survey)
const SurveyPage = lazy(() => import('@/features/survey/pages/SurveyPage'))
const FinishedPage = lazy(() => import('@/features/survey/pages/FinishedPage'))
const ExpiredPage = lazy(() => import('@/features/survey/pages/ExpiredPage'))
const InvalidLinkPage = lazy(() => import('@/features/survey/pages/InvalidLinkPage'))
const NotFoundPage = lazy(() => import('@/features/survey/pages/NotFoundPage'))
// Sign-in (shell agent)
const LoginPage = lazy(() => import('@/pages/LoginPage'))
// Admin console (feature groups: insights, campaigns)
const OverviewPage = lazy(() => import('@/features/insights/pages/OverviewPage'))
const ResponsesPage = lazy(() => import('@/features/insights/pages/ResponsesPage'))
const CampaignsPage = lazy(() => import('@/features/campaigns/pages/CampaignsPage'))
const CampaignDetailPage = lazy(() => import('@/features/campaigns/pages/CampaignDetailPage'))
const LinksPage = lazy(() => import('@/features/campaigns/pages/LinksPage'))
// Branch staff (feature group: staff)
const MyScoresPage = lazy(() => import('@/features/staff/pages/MyScoresPage'))
const SendSurveyPage = lazy(() => import('@/features/staff/pages/SendSurveyPage'))

type LazyPage = LazyExoticComponent<ComponentType>

function page(Page: LazyPage) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  )
}

function guarded(roles: Role[], Page: LazyPage) {
  return <RequireRole roles={roles}>{page(Page)}</RequireRole>
}

/**
 * Source behaviour: an SMS link lands on `/?id=...` and is replaced by
 * `/survey?<every query param>`. Without an `id`, `/` is the SMS inbox launcher.
 */
function EntryGate() {
  const location = useLocation()
  if (new URLSearchParams(location.search).has('id')) {
    return <Navigate to={{ pathname: '/survey', search: location.search }} replace />
  }
  return page(InboxPage)
}

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <EntryGate /> },
          { path: 'playground', element: page(PlaygroundPage) },
          { path: '*', element: page(NotFoundPage) },
        ],
      },
      {
        element: <RespondentLayout />,
        children: [
          { path: 'survey', element: page(SurveyPage) },
          { path: 'finished', element: page(FinishedPage) },
          { path: 'expired', element: page(ExpiredPage) },
          { path: 'invalid', element: page(InvalidLinkPage) },
        ],
      },
      { path: 'login', element: page(LoginPage) },
      {
        path: 'console',
        element: (
          <RequireRole roles={['admin', 'agent']}>
            <ConsoleLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: guarded(['admin'], OverviewPage) },
          { path: 'responses', element: guarded(['admin'], ResponsesPage) },
          { path: 'campaigns', element: guarded(['admin'], CampaignsPage) },
          { path: 'campaigns/:campaignId', element: guarded(['admin'], CampaignDetailPage) },
          { path: 'links', element: guarded(['admin'], LinksPage) },
          { path: 'me', element: guarded(['agent'], MyScoresPage) },
          { path: 'send', element: guarded(['admin', 'agent'], SendSurveyPage) },
        ],
      },
    ],
  },
]
