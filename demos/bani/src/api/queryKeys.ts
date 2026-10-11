/**
 * Query-key roots. Every group's keys start with its group id (PLAN section 5),
 * so `invalidateQueries({ queryKey: queryKeys.archive.all })` never touches
 * another group. Groups extend their own root:
 *
 *   queryKeys.calls.all                      -> ['calls']
 *   queryKeys.calls.key('search', request)   -> ['calls', 'search', request]
 */
const group = <G extends string>(name: G) => ({
  all: [name] as const,
  key: <P extends readonly unknown[]>(...parts: P) => [name, ...parts] as const,
})

export const queryKeys = {
  me: ['me'] as const,
  calls: group('calls'),
  archive: group('archive'),
  agents: group('agents'),
  campaigns: group('campaigns'),
  extensions: group('extensions'),
  health: group('health'),
  people: group('people'),
  access: group('access'),
} as const
