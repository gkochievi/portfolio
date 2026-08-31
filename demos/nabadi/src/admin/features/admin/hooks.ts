import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiDownload } from '@/lib/api';
import { unwrap, type ListOrPaginated } from '@/lib/list';
import { fetchAllPages, toPaginated, withPage, type Paginated } from '@/lib/paginated';
import { STALE_FAST } from '@/lib/query-client';
import { useMutationFeedback } from './mutation-feedback';

export interface AdminBooking {
  id: number;
  customer: number | null;
  customer_phone: string | null;
  customer_name: string;
  walk_in_name: string;
  walk_in_phone: string;
  walk_in_email: string;
  barber: number;
  barber_name: string;
  service: number;
  service_name: string;
  service_name_en: string;
  start_at: string;
  end_at: string;
  price_at_booking: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  cancellation_reason: string;
  cancelled_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCustomer {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  notes: string;
  is_active: boolean;
  date_joined: string;
  booking_count: number;
  last_visit_at: string | null;
  total_spent: string | null;
}

export interface CustomersFilters {
  search?: string;
  active?: 'true' | 'false';
  has_bookings?: 'true';
}

export interface AdminBarberSummary {
  id: number;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  user_email: string | null;
  bio: string;
  photo: string | null;
  specialties: { id: number; name: string }[];
  display_order: number;
  is_active: boolean;
  service_count: number;
}

export interface AdminServiceSummary {
  id: number;
  name: string;
  name_en: string;
  duration_minutes: number;
  price: string;
  category: number;
  is_active: boolean;
  description: string;
  description_en: string;
  image: string | null;
  icon_key: string;
  display_order: number;
}

export interface BookingsFilters {
  status?: string;
  barber_id?: number;
  service_id?: number;
  customer_phone?: string;
  date_from?: string;
  date_to?: string;
}

function qs(filters: BookingsFilters): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== null) {
      parts.push(`${k}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function useAdminBookings(filters: BookingsFilters = {}) {
  return useQuery<AdminBooking[]>({
    queryKey: ['admin-bookings', filters],
    queryFn: async () =>
      unwrap(await api.get<ListOrPaginated<AdminBooking>>(`/admin/bookings/${qs(filters)}`)),
    // Reception freshness: new customer bookings must show up without a reload.
    staleTime: STALE_FAST,
  });
}

/**
 * Server-paged bookings with the full DRF envelope — the customer-detail
 * booking history needs `count` (e.g. no-show totals), not just the rows.
 * Shares the 'admin-bookings' prefix so booking mutations invalidate it too.
 */
export function useAdminBookingsPage(filters: BookingsFilters = {}, page = 1, enabled = true) {
  return useQuery<Paginated<AdminBooking>>({
    queryKey: ['admin-bookings', 'page', filters, page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminBooking>>(
          withPage(`/admin/bookings/${qs(filters)}`, page),
        ),
      ),
    placeholderData: keepPreviousData,
    staleTime: STALE_FAST,
    // The Bookings page pauses the list query while the calendar view is up.
    enabled,
  });
}

/**
 * Every booking of one Tbilisi calendar day — the calendar view renders the
 * complete day, so it walks all envelope pages instead of taking page 1.
 * Shares the 'admin-bookings' prefix so booking mutations invalidate it too.
 */
export function useAdminBookingsDay(date: string | null) {
  return useQuery<AdminBooking[]>({
    queryKey: ['admin-bookings', 'day', date],
    queryFn: () =>
      fetchAllPages<AdminBooking>(`/admin/bookings/?date_from=${date}&date_to=${date}`),
    enabled: !!date,
    staleTime: STALE_FAST,
  });
}

export function downloadBookingsXlsx(filters: BookingsFilters): Promise<void> {
  // Refresh-aware download: expired tokens retry once instead of failing silently.
  return apiDownload(`/admin/bookings/export-xlsx/${qs(filters)}`, 'bookings.xlsx');
}

export function useAdminBookingComplete() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminBooking>(`/admin/bookings/${id}/complete/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      feedback.success('toast.booking_completed');
    },
    onError: feedback.error,
  });
}

export function useAdminBookingNoShow() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminBooking>(`/admin/bookings/${id}/no-show/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      feedback.success('toast.booking_no_show');
    },
    onError: feedback.error,
  });
}

export function useAdminBookingCancel() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    // With a reason: PATCH {status, cancellation_reason} — the committed
    // partial_update sets cancelled_by exactly like destroy does, and stores
    // the reason. Without one: plain DELETE (existing cancel path).
    mutationFn: async (vars: { id: number; reason?: string }): Promise<void> => {
      const reason = vars.reason?.trim();
      if (reason) {
        await api.patch<AdminBooking>(`/admin/bookings/${vars.id}/`, {
          status: 'cancelled',
          cancellation_reason: reason,
        });
        return;
      }
      await api.delete<void>(`/admin/bookings/${vars.id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      feedback.success('toast.booking_cancelled');
    },
    onError: feedback.error,
  });
}

/** pending → confirmed. Backend PATCH accepts a bare status change. */
export function useAdminBookingConfirm() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) =>
      api.patch<AdminBooking>(`/admin/bookings/${id}/`, { status: 'confirmed' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      feedback.success('toast.booking_confirmed');
    },
    onError: feedback.error,
  });
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

export function useAdminAvailability(
  barberId: number | null,
  serviceId: number | null,
  date: string | null,
) {
  return useQuery<AvailabilityResponse>({
    queryKey: ['admin-availability', barberId, serviceId, date],
    queryFn: () =>
      api.get<AvailabilityResponse>(
        `/barbers/${barberId}/availability/?date=${date}&service_id=${serviceId}`,
      ),
    enabled: Boolean(barberId && serviceId && date),
    // Slots go stale the moment someone else books — keep near-live.
    staleTime: STALE_FAST,
  });
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

export function useAdminAvailabilitySummary(
  barberId: number | null,
  serviceId: number | null,
  from: string | null,
  to: string | null,
) {
  return useQuery<AvailabilitySummaryResponse>({
    queryKey: ['admin-availability-summary', barberId, serviceId, from, to],
    queryFn: () =>
      api.get<AvailabilitySummaryResponse>(
        `/barbers/${barberId}/availability-summary/?from=${from}&to=${to}&service_id=${serviceId}`,
      ),
    enabled: Boolean(barberId && serviceId && from && to),
    staleTime: STALE_FAST,
  });
}

export function useAdminBookingUpdate() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      start_at?: string;
      status?: AdminBooking['status'];
      notes?: string;
      cancellation_reason?: string;
    }) => {
      const { id, ...body } = vars;
      return api.patch<AdminBooking>(`/admin/bookings/${id}/`, body);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      if (vars.start_at !== undefined) {
        feedback.success('toast.booking_rescheduled');
      } else if (vars.status === 'confirmed') {
        feedback.success('toast.booking_confirmed');
      } else {
        feedback.saved();
      }
    },
    onError: feedback.error,
  });
}

export function useAdminCreateBooking() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      customer_id?: number | null;
      walk_in_name?: string;
      walk_in_phone?: string;
      walk_in_email?: string;
      barber_id: number;
      service_id: number;
      start_at: string;
      notes?: string;
    }) => api.post<AdminBooking>('/admin/bookings/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      feedback.success('toast.booking_created');
    },
    onError: feedback.error,
  });
}

function customersQs(filters: CustomersFilters): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`search=${encodeURIComponent(filters.search)}`);
  if (filters.active) parts.push(`active=${filters.active}`);
  if (filters.has_bookings) parts.push(`has_bookings=${filters.has_bookings}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function useAdminCustomers(filters: CustomersFilters | string = {}) {
  // Backwards-compat: a bare string is treated as a search term.
  const f: CustomersFilters = typeof filters === 'string' ? { search: filters } : filters;
  return useQuery<AdminCustomer[]>({
    queryKey: ['admin-customers', f],
    queryFn: async () =>
      unwrap(await api.get<ListOrPaginated<AdminCustomer>>(`/admin/customers/${customersQs(f)}`)),
    // Keep showing the previous result while a new (debounced) search loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * Server-paged customers with the DRF envelope — the Customers page pager
 * needs `count`, not just the rows. Same 'admin-customers' invalidation
 * prefix as the legacy full-list hook.
 */
export function useAdminCustomersPage(filters: CustomersFilters = {}, page = 1) {
  return useQuery<Paginated<AdminCustomer>>({
    queryKey: ['admin-customers', 'page', filters, page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminCustomer>>(
          withPage(`/admin/customers/${customersQs(filters)}`, page),
        ),
      ),
    placeholderData: keepPreviousData,
  });
}

export function downloadCustomersXlsx(filters: CustomersFilters): Promise<void> {
  // Refresh-aware download: expired tokens retry once instead of failing silently.
  return apiDownload(`/admin/customers/export-xlsx/${customersQs(filters)}`, 'customers.xlsx');
}

/** Single customer for the /customers/:id detail page. */
export function useAdminCustomerDetail(id: number | null) {
  return useQuery<AdminCustomer>({
    queryKey: ['admin-customers', 'detail', id],
    queryFn: () => api.get<AdminCustomer>(`/admin/customers/${id}/`),
    enabled: !!id,
  });
}

export function useAdminUpdateCustomer() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      first_name?: string;
      last_name?: string;
      email?: string | null;
      notes?: string;
      is_active?: boolean;
    }) => {
      const { id, ...body } = vars;
      return api.patch<AdminCustomer>(`/admin/customers/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

// Lightweight barbers + services lookups for filter dropdowns and walk-in form.
// (/admin/barbers/ returns a bare array today; fetchAllPages handles either
// shape and guarantees completeness if the backend starts paginating.)
export function useAdminBarbers() {
  return useQuery<AdminBarberSummary[]>({
    queryKey: ['admin-barbers'],
    queryFn: () => fetchAllPages<AdminBarberSummary>('/admin/barbers/'),
  });
}

export function useAdminServices() {
  return useQuery<AdminServiceSummary[]>({
    queryKey: ['admin-services'],
    queryFn: () => fetchAllPages<AdminServiceSummary>('/admin/services/'),
  });
}

/** Server-paged services for the Services management page. */
export function useAdminServicesPage(page: number) {
  return useQuery<Paginated<AdminServiceSummary>>({
    queryKey: ['admin-services', 'page', page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminServiceSummary>>(withPage('/admin/services/', page)),
      ),
    placeholderData: keepPreviousData,
  });
}
