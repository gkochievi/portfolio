/**
 * Owner: data agent. Query keys under the PLAN's prefixes (`['auth']`,
 * `['core']`, `['play']`, `['hub']`, `['standings']`, `['events']`,
 * `['content']`, `['people']`, `['insights']`). Invalidate a whole group with
 * its `all` key, e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.standings.all })`.
 */
export const queryKeys = {
  auth: { all: ['auth'] as const, me: () => ['auth', 'me'] as const },
  core: { all: ['core'] as const, current: () => ['core', 'current'] as const },
  play: { all: ['play'] as const, config: () => ['play', 'config'] as const },
  hub: {
    all: ['hub'] as const,
    card: () => ['hub', 'card'] as const,
    trivia: () => ['hub', 'trivia'] as const,
    prizes: () => ['hub', 'prizes'] as const,
  },
  standings: {
    all: ['standings'] as const,
    board: (eventId: string | null) => ['standings', eventId ?? 'current'] as const,
    player: (userId: string, eventId: string | null) => ['standings', 'player', userId, eventId ?? 'current'] as const,
  },
  events: {
    all: ['events'] as const,
    dashboard: () => ['events', 'dashboard'] as const,
    list: () => ['events', 'list'] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
  },
  content: {
    all: ['content'] as const,
    items: (eventId: string) => ['content', 'items', eventId] as const,
    trivia: (eventId: string) => ['content', 'trivia', eventId] as const,
    prizes: (eventId: string) => ['content', 'prizes', eventId] as const,
  },
  people: {
    all: ['people'] as const,
    users: () => ['people', 'users'] as const,
    participants: (q = '') => ['people', 'participants', q] as const,
  },
  insights: { all: ['insights'] as const, stats: () => ['insights', 'stats'] as const },
} as const
