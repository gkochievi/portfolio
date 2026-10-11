import { QueryClient } from '@tanstack/react-query'
import { DemoApiError } from '@portfolio/demo-kit'

/** The one QueryClient. Reset demo data calls `queryClient.clear()` after `store.reset()`. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof DemoApiError && error.status < 500) return false
        return failureCount < 1
      },
    },
  },
})
