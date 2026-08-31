import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ServiceItem {
  id: number;
  name: string;
  name_en?: string;
  description: string;
  description_en?: string;
  duration_minutes: number;
  price: string;
  image?: string | null;
  icon_key?: string;
}

export interface ServiceCategory {
  id: number;
  name: string;
  name_en?: string;
  display_order: number;
  services: ServiceItem[];
}

export interface BarberItem {
  id: number;
  first_name: string;
  last_name: string;
  bio: string;
  photo: string | null;
  specialties: { id: number; name: string }[];
  services: {
    id: number;
    name: string;
    name_en?: string;
    duration_minutes: number;
    price: string;
  }[];
  display_order: number;
}

export interface AvailabilitySlot {
  start_at: string;
  end_at: string;
}

export interface AvailabilityResponse {
  barber_id: number;
  service_id: number;
  date: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityDaySummary {
  date: string;
  has_service_slot: boolean;
  has_any_slot: boolean;
}

export interface AvailabilitySummaryResponse {
  barber_id: number;
  service_id: number;
  from: string;
  to: string;
  days: AvailabilityDaySummary[];
}

export interface BookingItem {
  id: number;
  barber: number;
  barber_name: string;
  service: number;
  service_name: string;
  service_name_en?: string;
  service_image?: string | null;
  service_icon_key?: string;
  start_at: string;
  end_at: string;
  price_at_booking: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  created_at: string;
  updated_at: string;
  /** Optional (newer backends): whether the cancellation window is still open. */
  can_cancel?: boolean;
  /** Optional (newer backends): ISO deadline after which cancellation closes. */
  cancellable_until?: string | null;
}

/**
 * Availability is a live resource — other customers book slots while a tab
 * sits open. Override the app-wide `staleTime: Infinity` so slot data
 * refreshes on remount/focus after a short window.
 */
const AVAILABILITY_STALE_MS = 30_000;

export function useServices(barberId?: number | null) {
  return useQuery<{ categories: ServiceCategory[] }>({
    queryKey: ['services', barberId ?? null],
    queryFn: () =>
      api.get<{ categories: ServiceCategory[] }>(
        `/services/${barberId ? `?barber_id=${barberId}` : ''}`,
      ),
  });
}

export function useBarbers() {
  return useQuery<{ barbers: BarberItem[] }>({
    queryKey: ['barbers'],
    queryFn: () => api.get<{ barbers: BarberItem[] }>('/barbers/'),
  });
}

export function useAvailability(
  barberId: number | null,
  serviceId: number | null,
  date: string | null,
) {
  return useQuery<AvailabilityResponse>({
    queryKey: ['availability', barberId, serviceId, date],
    queryFn: () =>
      api.get<AvailabilityResponse>(
        `/barbers/${barberId}/availability/?date=${date}&service_id=${serviceId}`,
      ),
    enabled: Boolean(barberId && serviceId && date),
    staleTime: AVAILABILITY_STALE_MS,
  });
}

export function useAvailabilitySummary(
  barberId: number | null,
  serviceId: number | null,
  from: string | null,
  to: string | null,
) {
  return useQuery<AvailabilitySummaryResponse>({
    queryKey: ['availability-summary', barberId, serviceId, from, to],
    queryFn: () =>
      api.get<AvailabilitySummaryResponse>(
        `/barbers/${barberId}/availability-summary/?from=${from}&to=${to}&service_id=${serviceId}`,
      ),
    enabled: Boolean(barberId && serviceId && from && to),
    staleTime: AVAILABILITY_STALE_MS,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      barber_id: number;
      service_id: number;
      start_at: string;
      notes?: string;
      promo_code?: string;
    }) => api.post<BookingItem>('/bookings/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['my-bookings-stats'] });
      // The just-booked slot must stop rendering as free on re-entry.
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['availability-summary'] });
    },
  });
}

export interface MyBookingsStats {
  total_bookings: number;
  completed_bookings: number;
  upcoming_bookings: number;
  total_spent: string;
  last_visit_at: string | null;
}

export function useMyBookingsStats() {
  return useQuery<MyBookingsStats>({
    queryKey: ['my-bookings-stats'],
    queryFn: () => api.get<MyBookingsStats>('/bookings/me/stats/'),
  });
}

export type MyBookingsStatus = 'upcoming' | 'past' | 'cancelled';

export interface MyBookingsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: BookingItem[];
}

/**
 * GET /bookings/me/ is DRF-paginated (PageNumberPagination, 25/page).
 * `keepPreviousData` keeps the current page on screen while the next one
 * loads so paging doesn't flash an empty list.
 */
export function useMyBookings(status: MyBookingsStatus = 'upcoming', page = 1) {
  return useQuery<MyBookingsPage>({
    queryKey: ['my-bookings', status, page],
    queryFn: () => api.get<MyBookingsPage>(`/bookings/me/?status=${status}&page=${page}`),
    placeholderData: keepPreviousData,
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/bookings/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['my-bookings-stats'] });
    },
  });
}
