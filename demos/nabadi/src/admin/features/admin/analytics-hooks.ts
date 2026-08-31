import { useQuery } from '@tanstack/react-query';
import { api, apiDownload } from '@/lib/api';
import { STALE_KPI } from '@/lib/query-client';

export interface AnalyticsSummary {
  date_from: string;
  date_to: string;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_show_bookings: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
  revenue_completed: string;
  avg_ticket_size: string;
  unique_customers: number;
}

export interface RevenuePoint {
  date: string;
  revenue: string;
  count: number;
}

export interface StatusRow {
  status: string;
  count: number;
}

export interface TopServiceRow {
  service_id: number;
  service_name: string;
  service_name_en: string;
  count: number;
  revenue: string;
}

export interface TopBarberRow {
  barber_id: number;
  first_name: string;
  last_name: string;
  count: number;
  revenue: string;
}

export interface BarberAnalyticsDetail {
  barber_id: number;
  first_name: string;
  last_name: string;
  summary: AnalyticsSummary;
  revenue: RevenuePoint[];
  by_status: StatusRow[];
  top_services: TopServiceRow[];
}

export interface AnalyticsRange {
  date_from?: string;
  date_to?: string;
  barber_id?: number | null;
}

function qs(range: AnalyticsRange): string {
  const parts: string[] = [];
  if (range.date_from) parts.push(`date_from=${range.date_from}`);
  if (range.date_to) parts.push(`date_to=${range.date_to}`);
  if (range.barber_id !== undefined && range.barber_id !== null) {
    parts.push(`barber_id=${range.barber_id}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function useAnalyticsSummary(range: AnalyticsRange) {
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary', range],
    queryFn: () => api.get<AnalyticsSummary>(`/admin/analytics/summary/${qs(range)}`),
    staleTime: STALE_KPI,
  });
}

export function useAnalyticsRevenue(range: AnalyticsRange) {
  return useQuery<RevenuePoint[]>({
    queryKey: ['analytics-revenue', range],
    queryFn: () => api.get<RevenuePoint[]>(`/admin/analytics/revenue/${qs(range)}`),
    staleTime: STALE_KPI,
  });
}

export function useAnalyticsByStatus(range: AnalyticsRange) {
  return useQuery<StatusRow[]>({
    queryKey: ['analytics-status', range],
    queryFn: () => api.get<StatusRow[]>(`/admin/analytics/bookings-by-status/${qs(range)}`),
    staleTime: STALE_KPI,
  });
}

export function useAnalyticsTopServices(range: AnalyticsRange) {
  return useQuery<TopServiceRow[]>({
    queryKey: ['analytics-top-services', range],
    queryFn: () => api.get<TopServiceRow[]>(`/admin/analytics/top-services/${qs(range)}`),
    staleTime: STALE_KPI,
  });
}

export function useAnalyticsTopBarbers(range: AnalyticsRange) {
  return useQuery<TopBarberRow[]>({
    queryKey: ['analytics-top-barbers', range],
    queryFn: () => api.get<TopBarberRow[]>(`/admin/analytics/top-barbers/${qs(range)}`),
    staleTime: STALE_KPI,
  });
}

export function useAnalyticsBarberDetail(barberId: number | null, range: AnalyticsRange) {
  return useQuery<BarberAnalyticsDetail>({
    queryKey: ['analytics-barber', barberId, range],
    queryFn: () =>
      api.get<BarberAnalyticsDetail>(`/admin/analytics/barber/${barberId}/${qs(range)}`),
    enabled: barberId !== null,
    staleTime: STALE_KPI,
  });
}

export function downloadAnalyticsXlsx(range: AnalyticsRange): Promise<void> {
  // Refresh-aware download: expired tokens retry once instead of failing silently.
  return apiDownload(`/admin/analytics/export-xlsx/${qs(range)}`, 'analytics.xlsx');
}
