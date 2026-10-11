import { QueryClient } from '@tanstack/react-query'

/** One client for the whole demo; the DemoBar reset clears it (owner: shell agent). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})
