/**
 * Every route of the demo (owner: architect scaffold, then the shell agent).
 * Pages load lazily; each page file is owned by one feature group (PLAN.md).
 *
 * `handle.roles` lists who may open a route; layouts enforce it with
 * useMatches(). Routes without `handle.roles` are public.
 */
import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'

import type { Role } from '@/types'
import { RootLayout } from '@/app/layouts/RootLayout'
import { OperatorLayout } from '@/app/layouts/OperatorLayout'
import { AdminLayout } from '@/app/layouts/AdminLayout'
import { SuperAdminLayout } from '@/app/layouts/SuperAdminLayout'

export interface RouteHandle {
  roles?: Role[]
  /** i18n key (namespace:key) for the document title / breadcrumbs. */
  titleKey?: string
}

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

const STAFF_ADMIN: Role[] = ['admin', 'supervisor']
const ADMIN_ONLY: Role[] = ['admin']

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      /* ---- public: the customer surface (widget group) ---- */
      { index: true, lazy: page(() => import('@/features/widget/pages/StorefrontPage')) },
      { path: 'widget', lazy: page(() => import('@/features/widget/pages/WidgetPage')) },
      // Public: the page itself signs the visitor in as the operator Luka for the right-hand pane.
      { path: 'live', lazy: page(() => import('@/features/widget/pages/LiveDeskPage')) },

      /* ---- shell ---- */
      { path: 'login', lazy: page(() => import('@/app/pages/LoginPage')) },

      /* ---- operator console ---- */
      {
        path: 'operator',
        element: <OperatorLayout />,
        handle: { roles: ['operator'] } satisfies RouteHandle,
        children: [
          { index: true, lazy: page(() => import('@/features/inbox/pages/InboxPage')) },
          { path: 'profile', lazy: page(() => import('@/features/team/pages/ProfilePage')) },
        ],
      },

      /* ---- admin + supervisor console ---- */
      {
        path: 'admin',
        element: <AdminLayout />,
        handle: { roles: STAFF_ADMIN } satisfies RouteHandle,
        children: [
          { index: true, lazy: page(() => import('@/features/admin-live/pages/DashboardPage')) },
          { path: 'chats', lazy: page(() => import('@/features/admin-live/pages/ChatsPage')) },
          {
            path: 'team',
            handle: { roles: ADMIN_ONLY } satisfies RouteHandle,
            lazy: page(() => import('@/features/team/pages/TeamPage')),
          },
          { path: 'history', lazy: page(() => import('@/features/admin-insights/pages/HistoryPage')) },
          { path: 'operators', lazy: page(() => import('@/features/admin-staff/pages/OperatorsPage')) },
          {
            path: 'admins',
            handle: { roles: ADMIN_ONLY } satisfies RouteHandle,
            lazy: page(() => import('@/features/admin-staff/pages/AdminsPage')),
          },
          {
            path: 'supervisors',
            handle: { roles: ADMIN_ONLY } satisfies RouteHandle,
            lazy: page(() => import('@/features/admin-staff/pages/SupervisorsPage')),
          },
          { path: 'statistics', lazy: page(() => import('@/features/admin-insights/pages/StatisticsPage')) },
          {
            path: 'activity',
            handle: { roles: ADMIN_ONLY } satisfies RouteHandle,
            lazy: page(() => import('@/features/admin-insights/pages/ActivityPage')),
          },
          {
            path: 'settings',
            handle: { roles: ADMIN_ONLY } satisfies RouteHandle,
            children: [
              { index: true, lazy: page(() => import('@/features/admin-settings/pages/SettingsPage')) },
              { path: 'faq', lazy: page(() => import('@/features/admin-integrations/pages/FaqEditorPage')) },
              { path: 'channels', lazy: page(() => import('@/features/admin-integrations/pages/ChannelsPage')) },
              { path: 'comments', lazy: page(() => import('@/features/admin-integrations/pages/CommentsPage')) },
              { path: 'ai', lazy: page(() => import('@/features/admin-integrations/pages/AiLinkPage')) },
            ],
          },
        ],
      },

      /* ---- super-admin console ---- */
      {
        path: 'superadmin',
        element: <SuperAdminLayout />,
        handle: { roles: ['superadmin'] } satisfies RouteHandle,
        children: [
          { index: true, lazy: page(() => import('@/features/superadmin/pages/TenantsPage')) },
          { path: 'tenants/:tenantId', lazy: page(() => import('@/features/superadmin/pages/TenantDetailPage')) },
          { path: 'platform', lazy: page(() => import('@/features/superadmin/pages/PlatformPage')) },
          { path: 'health', lazy: page(() => import('@/features/superadmin/pages/HealthPage')) },
          { path: 'ai', lazy: page(() => import('@/features/superadmin/pages/AiKeyPage')) },
        ],
      },

      { path: '*', lazy: page(() => import('@/app/pages/NotFoundPage')) },
    ],
  },
]
