import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

// === Service categories ===

export interface AdminServiceCategory {
  id: number;
  name: string;
  name_en: string;
  display_order: number;
  service_count: number;
}

export function useAdminServiceCategories() {
  // All pages: category grouping and form dropdowns need the complete list.
  return useQuery<AdminServiceCategory[]>({
    queryKey: ['admin-service-categories'],
    queryFn: () => fetchAllPages<AdminServiceCategory>('/admin/service-categories/'),
  });
}

export function useAdminCreateServiceCategory() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { name: string; name_en?: string; display_order?: number }) =>
      api.post<AdminServiceCategory>('/admin/service-categories/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateServiceCategory() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; name?: string; name_en?: string; display_order?: number }) => {
      const { id, ...body } = vars;
      return api.patch<AdminServiceCategory>(`/admin/service-categories/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteServiceCategory() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/service-categories/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// === Services ===

export interface AdminService {
  id: number;
  category: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  duration_minutes: number;
  price: string;
  image: string | null;
  icon_key: string;
  is_active: boolean;
  display_order: number;
}

export function useAdminCreateService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      category: number;
      name: string;
      name_en?: string;
      description?: string;
      description_en?: string;
      duration_minutes: number;
      price: string;
      icon_key?: string;
      is_active?: boolean;
      display_order?: number;
    }) => api.post<AdminService>('/admin/services/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: Partial<AdminService> & { id: number }) => {
      const { id, ...body } = vars;
      return api.patch<AdminService>(`/admin/services/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/services/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      qc.invalidateQueries({ queryKey: ['admin-service-categories'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

export function useAdminUploadServiceImage() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; blob: Blob; filename?: string }) => {
      const form = new FormData();
      form.append('image', vars.blob, vars.filename ?? 'service.jpg');
      return api.postMultipart<AdminService>(`/admin/services/${vars.id}/image/`, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteServiceImage() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<AdminService>(`/admin/services/${id}/image/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// === Barbers (full) ===

export interface AdminBarberDetail {
  id: number;
  user: number;
  user_phone: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string | null;
  bio: string;
  photo: string | null;
  specialties: { id: number; name: string }[];
  display_order: number;
  is_active: boolean;
}

export function useAdminBarberDetail(id: number | null) {
  return useQuery<AdminBarberDetail>({
    queryKey: ['admin-barber', id],
    queryFn: () => api.get<AdminBarberDetail>(`/admin/barbers/${id}/`),
    enabled: !!id,
  });
}

export function useAdminCreateBarber() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      phone: string;
      first_name: string;
      last_name: string;
      email?: string | null;
      password: string;
      bio?: string;
      specialties?: number[];
      display_order?: number;
    }) => api.post<AdminBarberDetail>('/admin/barbers/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateBarber() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      bio?: string;
      specialties?: number[];
      display_order?: number;
      is_active?: boolean;
    }) => {
      const { id, ...body } = vars;
      return api.patch<AdminBarberDetail>(`/admin/barbers/${id}/`, body);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      qc.invalidateQueries({ queryKey: ['admin-barber', vars.id] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminToggleBarberActive() {
  /** Lightweight inline toggle — invalidates the list so the row re-renders. */
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; is_active: boolean }) =>
      api.patch<AdminBarberDetail>(`/admin/barbers/${vars.id}/`, { is_active: vars.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeactivateBarber() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/barbers/${id}/`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      qc.invalidateQueries({ queryKey: ['admin-barber', id] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminUploadBarberPhoto() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; blob: Blob; filename?: string }) => {
      const form = new FormData();
      form.append('photo', vars.blob, vars.filename ?? 'photo.jpg');
      return api.postMultipart<AdminBarberDetail>(`/admin/barbers/${vars.id}/photo/`, form);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      qc.invalidateQueries({ queryKey: ['admin-barber', vars.id] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteBarberPhoto() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<AdminBarberDetail>(`/admin/barbers/${id}/photo/`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      qc.invalidateQueries({ queryKey: ['admin-barber', id] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// === WorkingHours ===

export interface AdminWorkingHours {
  id: number;
  barber: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export function useAdminWorkingHours(barberId: number | null) {
  return useQuery<AdminWorkingHours[]>({
    queryKey: ['admin-working-hours', barberId],
    queryFn: async () => {
      // The endpoint has no barber filter and paginates at 25 rows — with
      // more than ~4 barbers a single page silently drops working days.
      // Fetch every page, then filter client-side.
      const all = await fetchAllPages<AdminWorkingHours>('/admin/working-hours/');
      return all.filter((wh) => wh.barber === barberId);
    },
    enabled: !!barberId,
  });
}

export function useAdminCreateWorkingHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { barber: number; weekday: number; start_time: string; end_time: string }) =>
      api.post<AdminWorkingHours>('/admin/working-hours/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-working-hours'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateWorkingHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; start_time?: string; end_time?: string }) => {
      const { id, ...body } = vars;
      return api.patch<AdminWorkingHours>(`/admin/working-hours/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-working-hours'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteWorkingHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/working-hours/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-working-hours'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// === ShopHours ===
// Backend: /admin/shop-hours/ (AdminShopHoursViewSet) — IsAdmin-only.
// Weekday is unique; a CLOSED day is expressed as "no row for that weekday"
// (matches seed_demo: Mon–Sat rows, Sunday absent).

export interface AdminShopHours {
  id: number;
  /** 0=Monday … 6=Sunday (backend WEEKDAY_CHOICES). */
  weekday: number;
  /** 'HH:MM:SS' from DRF TimeField. */
  start_time: string;
  end_time: string;
}

export function useAdminShopHours(enabled = true) {
  return useQuery<AdminShopHours[]>({
    queryKey: ['admin-shop-hours'],
    queryFn: () => fetchAllPages<AdminShopHours>('/admin/shop-hours/'),
    enabled,
  });
}

// The three mutations below deliberately skip the per-op success toast:
// the Settings shop-hours section saves a diff of up to 7 rows in one go
// and fires a single "Saved" itself. Errors still toast individually.

export function useAdminCreateShopHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { weekday: number; start_time: string; end_time: string }) =>
      api.post<AdminShopHours>('/admin/shop-hours/', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-hours'] }),
    onError: feedback.error,
  });
}

export function useAdminUpdateShopHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; start_time?: string; end_time?: string }) => {
      const { id, ...body } = vars;
      return api.patch<AdminShopHours>(`/admin/shop-hours/${id}/`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-hours'] }),
    onError: feedback.error,
  });
}

export function useAdminDeleteShopHours() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/shop-hours/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shop-hours'] }),
    onError: feedback.error,
  });
}

// === TimeOff ===

export interface AdminTimeOff {
  id: number;
  barber: number | null;
  start_datetime: string;
  end_datetime: string;
  reason: string;
}

export function useAdminTimeOff(barberId: number | null) {
  return useQuery<AdminTimeOff[]>({
    queryKey: ['admin-time-off', barberId],
    queryFn: async () => {
      const all = await fetchAllPages<AdminTimeOff>('/admin/time-off/');
      // Show barber-specific + shop-wide entries.
      return all.filter((t) => t.barber === barberId || t.barber === null);
    },
    enabled: barberId !== null,
  });
}

export function useAdminAllTimeOff() {
  // Complete data: the TimeOff page filters (scope/barber/kind) and computes
  // stats client-side, so a single 25-row server page would lie.
  return useQuery<AdminTimeOff[]>({
    queryKey: ['admin-time-off', 'all'],
    queryFn: () => fetchAllPages<AdminTimeOff>('/admin/time-off/'),
  });
}

export function useAdminCreateTimeOff() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      barber: number | null;
      start_datetime: string;
      end_datetime: string;
      reason?: string;
    }) => api.post<AdminTimeOff>('/admin/time-off/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-time-off'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteTimeOff() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/time-off/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-time-off'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// === Specialties (for barber editor) ===

export interface AdminSpecialty {
  id: number;
  name: string;
}

// Re-using barbers' nested specialties for now — Phase 4 may add a dedicated endpoint.
