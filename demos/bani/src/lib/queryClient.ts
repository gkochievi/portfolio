import { QueryClient } from '@tanstack/react-query'
import { DemoApiError } from '@portfolio/demo-kit'

/** The one query client. Reset and persona switches clear it. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // The mock never flakes by accident: a failure is a deliberate demo state, so show it at once.
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})

/** True when `error` came from the mock API (typed status, message, fieldErrors). */
export function isApiError(error: unknown): error is DemoApiError {
  return error instanceof DemoApiError
}
