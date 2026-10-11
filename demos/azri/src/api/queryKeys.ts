/**
 * Query-key helpers. Every key starts with its feature-group scope, because
 * `src/lib/realtime.ts` invalidates whole scopes on bus events: launcher,
 * insights, campaigns, staff and meta are live; `survey` is NEVER invalidated
 * (re-validating a just-submitted token would bounce the respondent to the
 * "already answered" page).
 *
 * Owner: seed agent. Feature groups may use these or build the same shapes.
 */
import type { ConsoleFilters, Lang } from '@/types'

type Params = Record<string, string | number | boolean | null | undefined>

export const queryKeys = {
  meta: () => ['meta'] as const,

  survey: {
    all: () => ['survey'] as const,
    validate: (surveyId: string, lang: Lang) => ['survey', 'validate', surveyId, lang] as const,
    questions: (surveyId: string, lang: Lang) => ['survey', 'questions', surveyId, lang] as const,
  },

  launcher: {
    all: () => ['launcher'] as const,
    recipients: () => ['launcher', 'recipients'] as const,
    messages: (recipientId: string) => ['launcher', 'messages', recipientId] as const,
    branches: () => ['launcher', 'branches'] as const,
    routes: () => ['launcher', 'routes'] as const,
    clock: () => ['launcher', 'clock'] as const,
  },

  insights: {
    all: () => ['insights'] as const,
    overview: (filters: ConsoleFilters) => ['insights', 'overview', filters] as const,
    responses: (params: Params) => ['insights', 'responses', params] as const,
    response: (responseId: string) => ['insights', 'response', responseId] as const,
  },

  campaigns: {
    all: () => ['campaigns'] as const,
    list: (params: Params) => ['campaigns', 'list', params] as const,
    detail: (campaignId: string, params: Params) => ['campaigns', 'detail', campaignId, params] as const,
    links: (params: Params) => ['campaigns', 'links', params] as const,
  },

  staff: {
    all: () => ['staff'] as const,
    overview: (params: Params) => ['staff', 'overview', params] as const,
    responses: (params: Params) => ['staff', 'responses', params] as const,
    sendOptions: () => ['staff', 'send-options'] as const,
    links: (params: Params) => ['staff', 'links', params] as const,
  },
} as const
