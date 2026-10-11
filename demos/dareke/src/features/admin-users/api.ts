/** React Query hooks for the admin dashboard and users (keys start with 'users', 'campaigns', 'metrics'). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AdminDashboardResponse } from '@/demo/handlers/admin-users'
import { get, post, patch } from '@/lib/api'
import type { Localized, RealtimeMetrics, Role, User } from '@/types'

export type ActiveFilter = 'all' | 'active' | 'inactive'

export interface UserFilters {
  role: Role | 'all'
  q: string
  active: ActiveFilter
}

export interface UserFormValues {
  username: string
  displayName: Localized
  email: string
  role: Role
  sipExtension: string
  password?: string
  confirmPassword?: string
}

export const peopleKeys = {
  // 'campaigns' scope: the dashboard is mostly campaign numbers, and the campaigns group invalidates it.
  dashboard: () => ['campaigns', 'admin-dashboard'] as const,
  users: (filters?: UserFilters) => (filters ? (['users', 'list', filters] as const) : (['users'] as const)),
  metrics: () => ['metrics', 'admin-strip'] as const,
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: peopleKeys.dashboard(),
    queryFn: () => get<AdminDashboardResponse>('/admin/dashboard'),
    refetchInterval: 15_000,
  })
}

/** The compact live strip: polled while the dashboard is open; silent when unavailable. */
export function useLiveStrip() {
  return useQuery({
    queryKey: peopleKeys.metrics(),
    queryFn: () => get<RealtimeMetrics>('/supervisor/metrics'),
    refetchInterval: 5_000,
    retry: false,
  })
}

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: peopleKeys.users(filters),
    queryFn: () => get<User[]>('/users', { role: filters.role, q: filters.q.trim() || undefined, active: filters.active }),
    placeholderData: keepPreviousData,
  })
}

function useInvalidatePeople() {
  const qc = useQueryClient()
  return () => {
    for (const scope of ['users', 'campaigns', 'metrics', 'agents', 'me'] as const) void qc.invalidateQueries({ queryKey: [scope] })
  }
}

export function useCreateUser() {
  const invalidate = useInvalidatePeople()
  return useMutation({
    mutationFn: (values: UserFormValues) => post<User>('/users', values),
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidatePeople()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Omit<UserFormValues, 'password' | 'confirmPassword'> }) => patch<User>(`/users/${id}`, values),
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password, confirmPassword }: { id: string; password: string; confirmPassword: string }) =>
      post<{ ok: true }>(`/users/${id}/reset-password`, { password, confirmPassword }),
  })
}

export function useSetActive() {
  const invalidate = useInvalidatePeople()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => post<User>(`/users/${id}/active`, { isActive }),
    onSuccess: invalidate,
  })
}

export function useGrantSuperAdmin() {
  const invalidate = useInvalidatePeople()
  return useMutation({
    mutationFn: ({ id, confirmPassword }: { id: string; confirmPassword: string }) => post<User>(`/users/${id}/grant-super-admin`, { confirmPassword }),
    onSuccess: invalidate,
  })
}
