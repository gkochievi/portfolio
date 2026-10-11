/**
 * Every route, lazily loaded. Each page lives in its feature folder.
 * Access: /agent operator; /supervisor supervisor+admin+super_admin;
 * /reports and /calls everyone but operator; /admin/* admin+super_admin;
 * /admin/integrations super_admin only.
 */
import { lazy, Suspense, type ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'

import { AppLayout } from '@/app/AppLayout'
import { RequireRole, RoleRedirect } from '@/app/guards'
import { PageFallback } from '@/app/PageFallback'
import { RouteError } from '@/app/RouteError'
import type { Role } from '@/types'

function page(loader: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(loader)
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  )
}

const SUPERVISION: Role[] = ['supervisor', 'admin', 'super_admin']
const ADMINS: Role[] = ['admin', 'super_admin']

export const routes: RouteObject[] = [
  { path: '/login', element: page(() => import('@/app/pages/LoginPage')), errorElement: <RouteError /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <RoleRedirect /> },
      {
        path: 'agent',
        element: <RequireRole roles={['operator']}>{page(() => import('@/features/agent-workspace/pages/AgentWorkspacePage'))}</RequireRole>,
      },
      {
        path: 'supervisor',
        element: <RequireRole roles={SUPERVISION}>{page(() => import('@/features/supervisor-wall/pages/SupervisorWallPage'))}</RequireRole>,
      },
      {
        path: 'reports',
        element: <RequireRole roles={SUPERVISION}>{page(() => import('@/features/reports/pages/ReportsPage'))}</RequireRole>,
      },
      {
        path: 'calls',
        element: <RequireRole roles={SUPERVISION}>{page(() => import('@/features/reports/pages/CallHistoryPage'))}</RequireRole>,
      },
      {
        path: 'admin',
        element: <RequireRole roles={ADMINS} />,
        children: [
          { index: true, element: page(() => import('@/features/admin-users/pages/AdminDashboardPage')) },
          { path: 'campaigns', element: page(() => import('@/features/campaigns/pages/CampaignsPage')) },
          { path: 'campaigns/:id', element: page(() => import('@/features/campaigns/pages/CampaignDetailPage')) },
          { path: 'users', element: page(() => import('@/features/admin-users/pages/UsersPage')) },
          { path: 'agent-statuses', element: page(() => import('@/features/admin-config/pages/AgentStatusesPage')) },
          { path: 'dispositions', element: page(() => import('@/features/admin-config/pages/DispositionsPage')) },
          { path: 'dnc', element: page(() => import('@/features/admin-config/pages/DncPage')) },
          { path: 'settings', element: page(() => import('@/features/admin-config/pages/DialerSettingsPage')) },
          {
            path: 'integrations',
            element: <RequireRole roles={['super_admin']}>{page(() => import('@/features/admin-config/pages/IntegrationsPage'))}</RequireRole>,
          },
        ],
      },
      { path: '*', element: page(() => import('@/app/pages/NotFoundPage')) },
    ],
  },
]
