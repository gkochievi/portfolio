/**
 * Every route in Sinji. Each page is lazy-loaded from its owner group's
 * `src/features/<group>/pages/*.tsx` (default export). Architect-authored;
 * the shell agent owns it afterwards (guards, layouts). Groups do not edit it -
 * ask in your final message if you need a route added.
 *
 * Path-based tabs only (never `#hash` tabs): VITE_ROUTER=hash owns the hash.
 */
import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

import { AppShell } from '@/components/shell/AppShell'
import { PublicLayout } from '@/components/shell/PublicLayout'
import { RequireRole } from '@/components/shell/RequireRole'
import { RootLayout } from '@/components/shell/RootLayout'
import { RouteError } from '@/components/shell/RouteError'
import { RouteFallback } from '@/components/shell/RouteFallback'

type PageModule = { default: ComponentType }

function page(load: () => Promise<PageModule>) {
  const Page = lazy(load)
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  )
}

const redirect = (to: string): RouteObject => ({ index: true, element: <Navigate to={to} replace /> })

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      /* ---------------------------------------------- public (guest + all) */
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: page(() => import('@/features/voice-tools/pages/ToolsHomePage')) },
          { path: 'editor', element: page(() => import('@/features/voice-tools/pages/EditorPage')) },
          { path: 'login', element: page(() => import('@/features/auth/pages/LoginPage')) },
        ],
      },

      /* ------------------------------------------------------- signed in */
      {
        element: <RequireRole roles={['operator', 'owner', 'member']} />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: 'workspace',
                children: [
                  redirect('calls'),
                  { path: 'calls', element: page(() => import('@/features/workbench/pages/CallsPage')) },
                  { path: 'calls/:callId', element: page(() => import('@/features/workbench/pages/CallDetailPage')) },
                  { path: 'summaries/:summaryId', element: page(() => import('@/features/analysis/pages/SummaryPage')) },
                  {
                    path: 'kb',
                    element: page(() => import('@/features/knowledge-base/pages/KbLayout')),
                    children: [
                      redirect('overview'),
                      { path: 'overview', element: page(() => import('@/features/knowledge-base/pages/KbOverviewPage')) },
                      { path: 'documents', element: page(() => import('@/features/knowledge-base/pages/KbDocumentsPage')) },
                      { path: 'import', element: page(() => import('@/features/knowledge-base/pages/KbImportPage')) },
                      { path: 'chunks', element: page(() => import('@/features/knowledge-base/pages/KbChunksPage')) },
                      { path: 'retrieval', element: page(() => import('@/features/kb-quality/pages/KbRetrievalPage')) },
                      { path: 'duplicates', element: page(() => import('@/features/kb-quality/pages/KbDuplicatesPage')) },
                      { path: 'activity', element: page(() => import('@/features/kb-quality/pages/KbActivityPage')) },
                      { path: 'maintenance', element: page(() => import('@/features/kb-quality/pages/KbMaintenancePage')) },
                    ],
                  },
                  { path: 'curation', element: page(() => import('@/features/kb-quality/pages/CurationPage')) },
                  { path: 'rubric', element: page(() => import('@/features/workspace-settings/pages/RubricPage')) },
                  {
                    path: 'settings',
                    element: page(() => import('@/features/workspace-settings/pages/SettingsLayout')),
                    children: [
                      redirect('sentiment'),
                      { path: 'sentiment', element: page(() => import('@/features/workspace-settings/pages/SentimentSettingsPage')) },
                      { path: 'transcription', element: page(() => import('@/features/workspace-settings/pages/TranscriptionSettingsPage')) },
                      { path: 'ai', element: page(() => import('@/features/workspace-settings/pages/AiByoPage')) },
                    ],
                  },
                  { path: 'bot', element: page(() => import('@/features/copilot/pages/BotConfigPage')) },
                ],
              },
              { path: 'copilot', element: page(() => import('@/features/copilot/pages/CopilotPage')) },

              /* -------------------------------------------- operator only */
              {
                element: <RequireRole roles={['operator']} />,
                children: [
                  {
                    path: 'console',
                    element: page(() => import('@/features/console-platform/pages/ConsoleLayout')),
                    children: [
                      redirect('tenants'),
                      { path: 'tenants', element: page(() => import('@/features/console-platform/pages/TenantsPage')) },
                      { path: 'health', element: page(() => import('@/features/console-platform/pages/HealthPage')) },
                      { path: 'users', element: page(() => import('@/features/console-platform/pages/RegisteredUsersPage')) },
                      { path: 'storage', element: page(() => import('@/features/console-platform/pages/StoragePage')) },
                      { path: 'anonymous', element: page(() => import('@/features/console-platform/pages/AnonymousLimitsPage')) },
                      { path: 'voices', element: page(() => import('@/features/console-platform/pages/VoicesPage')) },
                      { path: 'ai-providers', element: page(() => import('@/features/console-ai/pages/AiProvidersPage')) },
                      { path: 'integrations', element: page(() => import('@/features/console-ai/pages/IntegrationsPage')) },
                      { path: 'embeddings', element: page(() => import('@/features/console-ai/pages/EmbeddingsPage')) },
                      { path: 'default-rubric', element: page(() => import('@/features/workspace-settings/pages/DefaultRubricPage')) },
                      { path: 'default-bot', element: page(() => import('@/features/copilot/pages/DefaultBotPage')) },
                      { path: 'bot-control', element: page(() => import('@/features/copilot/pages/BotControlPage')) },
                    ],
                  },
                  { path: 'ai-config', element: page(() => import('@/features/console-ai/pages/AiConfigPage')) },
                  { path: 'ai-config/:tenantId', element: page(() => import('@/features/console-ai/pages/AiConfigTenantPage')) },
                  {
                    path: 'usage',
                    element: page(() => import('@/features/usage/pages/UsageLayout')),
                    children: [
                      redirect('overview'),
                      { path: 'overview', element: page(() => import('@/features/usage/pages/UsageOverviewPage')) },
                      { path: 'recordings', element: page(() => import('@/features/usage/pages/UsageRecordingsPage')) },
                      { path: 'recordings/:recordingId', element: page(() => import('@/features/usage/pages/UsageRecordingDetailPage')) },
                      { path: 'conversations', element: page(() => import('@/features/usage/pages/UsageConversationsPage')) },
                      { path: 'conversations/:conversationId', element: page(() => import('@/features/usage/pages/UsageConversationDetailPage')) },
                      { path: 'calls', element: page(() => import('@/features/usage/pages/UsageCallsPage')) },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: page(() => import('@/features/auth/pages/NotFoundPage')) },
    ],
  },
]
