import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListOrPaginated } from '@/lib/list';
import { toPaginated, withPage, type Paginated } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

export type StaffRole = 'admin' | 'barber';

export const STAFF_ROLES: StaffRole[] = ['admin', 'barber'];

/** Shape of StaffUserOutSerializer (backend/apps/admin_api/serializers/users.py). */
export interface AdminStaffUser {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: StaffRole;
  is_active: boolean;
  date_joined: string;
  barber_id: number | null;
}

export interface UsersFilters {
  role?: StaffRole;
  search?: string;
  active?: 'true' | 'false';
}

export interface StaffUserCreateInput {
  phone: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: StaffRole;
  password: string;
}

function qs(filters: UsersFilters): string {
  const parts: string[] = [];
  if (filters.role) parts.push(`role=${filters.role}`);
  if (filters.search) parts.push(`search=${encodeURIComponent(filters.search)}`);
  if (filters.active) parts.push(`active=${filters.active}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Server-paged staff accounts (admin role only — backend IsAdmin). */
export function useAdminUsers(filters: UsersFilters = {}, page = 1) {
  return useQuery<Paginated<AdminStaffUser>>({
    queryKey: ['admin-users', filters, page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminStaffUser>>(
          withPage(`/admin/users/${qs(filters)}`, page),
        ),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminCreateUser() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: StaffUserCreateInput) => api.post<AdminStaffUser>('/admin/users/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      // A new barber account also creates a bookable Barber row.
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      first_name?: string;
      last_name?: string;
      email?: string | null;
      role?: StaffRole;
    }) => {
      const { id, ...body } = vars;
      return api.patch<AdminStaffUser>(`/admin/users/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-barbers'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

/** Admin sets a new password; the target's sessions are all revoked. */
export function useAdminResetUserPassword() {
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; new_password: string }) =>
      api.post<void>(`/admin/users/${vars.id}/reset-password/`, {
        new_password: vars.new_password,
      }),
    onSuccess: () => feedback.success('toast.password_reset'),
    onError: feedback.error,
  });
}

export function useAdminActivateUser() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminStaffUser>(`/admin/users/${id}/activate/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      feedback.success('toast.user_activated');
    },
    onError: feedback.error,
  });
}

export function useAdminDeactivateUser() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminStaffUser>(`/admin/users/${id}/deactivate/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      feedback.success('toast.user_deactivated');
    },
    onError: feedback.error,
  });
}
