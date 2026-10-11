/**
 * Every route in the demo. Owner: shell agent (feature groups never edit this;
 * each group replaces only its own page files). Pages are lazy: one chunk each.
 * Paths are relative to the router basename (BASE_URL) or the hash.
 */
import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'

import { AdminShell } from '@/shell/AdminShell'
import { BootFallback } from '@/shell/BootFallback'
import { PlayerShell } from '@/shell/PlayerShell'
import { RequireAuth, RequireRole } from '@/shell/guards'
import { RootLayout } from '@/shell/RootLayout'
import { RouteError } from '@/shell/RouteError'

type PageModule = { default: ComponentType }

const page = (load: () => Promise<PageModule>) => ({
  lazy: async () => ({ Component: (await load()).default }),
})

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: BootFallback,
    children: [
      // Public, full-bleed
      { index: true, ...page(() => import('@/features/player-hub/pages/LandingPage')) },
      { path: 'login', ...page(() => import('@/features/auth/pages/LoginPage')) },
      { path: 'register', ...page(() => import('@/features/auth/pages/RegisterPage')) },

      // The game: full-viewport sky frame, signed in
      {
        element: <RequireAuth />,
        children: [{ path: 'play', ...page(() => import('@/features/play/pages/PlayPage')) }],
      },

      // Player column with header nav
      {
        element: <PlayerShell />,
        children: [
          { path: 'leaderboard', ...page(() => import('@/features/standings/pages/StandingsPage')) },
          { path: 'awards', ...page(() => import('@/features/player-hub/pages/PrizesPage')) },
          {
            element: <RequireAuth />,
            children: [{ path: 'me', ...page(() => import('@/features/player-hub/pages/MyCardPage')) }],
          },
        ],
      },

      // Organiser console
      {
        path: 'admin',
        element: <RequireRole allow="staff" />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { index: true, ...page(() => import('@/features/events/pages/AdminDashboardPage')) },
              { path: 'leaderboard', ...page(() => import('@/features/standings/pages/AdminStandingsPage')) },
              { path: 'participants', ...page(() => import('@/features/people/pages/ParticipantsPage')) },
              { path: 'insights', ...page(() => import('@/features/insights/pages/InsightsPage')) },
              {
                element: <RequireRole allow="editor" />,
                children: [
                  { path: 'events', ...page(() => import('@/features/events/pages/EventsPage')) },
                  { path: 'events/:eventId', ...page(() => import('@/features/events/pages/EventSettingsPage')) },
                  { path: 'events/:eventId/items', ...page(() => import('@/features/event-content/pages/ItemsPage')) },
                  { path: 'events/:eventId/trivia', ...page(() => import('@/features/event-content/pages/TriviaPage')) },
                  {
                    path: 'events/:eventId/prizes',
                    ...page(() => import('@/features/event-content/pages/PrizesAdminPage')),
                  },
                ],
              },
              {
                element: <RequireRole allow="super" />,
                children: [{ path: 'people', ...page(() => import('@/features/people/pages/PeoplePage')) }],
              },
            ],
          },
        ],
      },

      { path: '*', ...page(() => import('@/shell/NotFoundPage')) },
    ],
  },
]
