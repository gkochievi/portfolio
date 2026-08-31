import { QueryClient } from '@tanstack/react-query';

/**
 * Per-domain staleness (spec: reception desk must see new bookings without a
 * hard reload — focus refetch only fires on STALE queries, so `Infinity` here
 * would disable it entirely):
 *
 * - STALE_FAST: bookings list, walk-in availability — near-live data.
 * - STALE_KPI: dashboard/analytics aggregates.
 * - default (STALE_SLOW): catalogs and configuration (services, barbers,
 *   templates, settings, audit) — minutes are fine.
 * - auth/me keeps its own long staleTime in auth/hooks.ts.
 */
export const STALE_FAST = 15_000;
export const STALE_KPI = 30_000;
export const STALE_SLOW = 3 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: STALE_SLOW,
      refetchOnWindowFocus: true,
    },
  },
});
