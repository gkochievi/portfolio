/** Owner: shell. */
import { QueryClient } from '@tanstack/react-query'
import { DemoApiError } from '@portfolio/demo-kit'

import i18n from '@/i18n'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry an auth, permission or validation failure.
        if (error instanceof DemoApiError && error.status < 500) return false
        return failureCount < 1
      },
    },
  },
})

/**
 * API responses are localized on the way in (see `request` in `@/lib/api`), so a
 * language switch has to refetch: every cached payload is in the old language.
 * Compared by language so the initial `languageChanged` of `init` is a no-op, and
 * the listener is removed on hot reload so a re-evaluated module never stacks two.
 */
const lang = (language: string | undefined): 'en' | 'ka' => (language === 'ka' ? 'ka' : 'en')
let shownLang = lang(i18n.language ?? i18n.options?.lng)

const refetchOnLanguageChange = (language: string): void => {
  const next = lang(language)
  if (next === shownLang) return
  shownLang = next
  void queryClient.invalidateQueries()
}

i18n.on('languageChanged', refetchOnLanguageChange)
import.meta.hot?.dispose(() => i18n.off('languageChanged', refetchOnLanguageChange))
