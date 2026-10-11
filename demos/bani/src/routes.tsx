/**
 * Every route of the demo. Pages load lazily. `handle.feature` is read by the
 * AppShell guard (redirects to the first allowed route); `handle.titleKey` feeds
 * breadcrumbs and the document title.
 */
import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'

import type { FeatureKey } from '@/types'
import { AppShell } from '@/shell/AppShell'
import NotFoundPage from '@/shell/NotFoundPage'
import { RootRedirect } from '@/shell/RootRedirect'
import { RouteError } from '@/shell/RouteError'

export interface RouteHandle {
  feature?: FeatureKey
  /** Extra gate on top of the feature (extension activity log). */
  adminOnly?: boolean
  titleKey: string
}

type PageModule = { default: ComponentType }

const page =
  (load: () => Promise<PageModule>): RouteObject['lazy'] =>
  async () => ({ Component: (await load()).default })

const handle = (h: RouteHandle): RouteHandle => h

export const routes: RouteObject[] = [
  {
    path: '/login',
    errorElement: <RouteError />,
    lazy: page(() => import('@/shell/LoginPage')),
    handle: handle({ titleKey: 'common:nav.login' }),
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: withErrors([
      { index: true, element: <RootRedirect /> },
      {
        path: 'calls',
        lazy: page(() => import('@/features/calls/pages/CallsPage')),
        handle: handle({ feature: 'cdr', titleKey: 'common:nav.calls' }),
      },
      {
        path: 'archive',
        lazy: page(() => import('@/features/archive/pages/ArchivePage')),
        handle: handle({ feature: 'systems_sync', titleKey: 'common:nav.archive' }),
      },
      {
        path: 'agents',
        lazy: page(() => import('@/features/agents/pages/AgentsPage')),
        handle: handle({ feature: 'cc_agents', titleKey: 'common:nav.agents' }),
      },
      {
        path: 'campaigns',
        lazy: page(() => import('@/features/campaigns/pages/CampaignsPage')),
        handle: handle({ feature: 'cc_campaigns', titleKey: 'common:nav.campaigns' }),
      },
      {
        path: 'nodes',
        lazy: page(() => import('@/features/campaigns/pages/NodesPage')),
        handle: handle({ feature: 'cc_nodes', titleKey: 'common:nav.nodes' }),
      },
      {
        path: 'extensions',
        lazy: page(() => import('@/features/extensions/pages/ExtensionsPage')),
        handle: handle({ feature: 'extensions', titleKey: 'common:nav.extensions' }),
      },
      {
        path: 'extensions/activity',
        lazy: page(() => import('@/features/extensions/pages/ExtensionActivityPage')),
        handle: handle({ feature: 'extensions', adminOnly: true, titleKey: 'common:nav.extensionActivity' }),
      },
      {
        path: 'status',
        lazy: page(() => import('@/features/health/pages/StatusPage')),
        handle: handle({ feature: 'health', titleKey: 'common:nav.status' }),
      },
      {
        path: 'activity',
        lazy: page(() => import('@/features/health/pages/ActivityPage')),
        handle: handle({ feature: 'logs', titleKey: 'common:nav.activity' }),
      },
      {
        path: 'people',
        lazy: page(() => import('@/features/people/pages/PeoplePage')),
        handle: handle({ feature: 'users', titleKey: 'common:nav.people' }),
      },
      {
        path: 'roles',
        lazy: page(() => import('@/features/access/pages/RolesPage')),
        handle: handle({ feature: 'rbac', titleKey: 'common:nav.roles' }),
      },
      {
        path: 'connections',
        lazy: page(() => import('@/features/access/pages/ConnectionsPage')),
        handle: handle({ feature: 'settings', titleKey: 'common:nav.connections' }),
      },
      {
        path: '*',
        Component: NotFoundPage,
        handle: handle({ titleKey: 'common:nav.notFound' }),
      },
    ]),
  },
]

/** Page errors render inside the shell, so the rail and top bar stay usable. */
function withErrors(children: RouteObject[]): RouteObject[] {
  return children.map((r) => ({ errorElement: <RouteError />, ...r }) as RouteObject)
}
