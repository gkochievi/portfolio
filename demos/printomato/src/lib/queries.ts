import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { api, download, request } from './api'
import type {
  AppNotification,
  Campaign,
  Dashboard,
  Device,
  Options,
  Page,
  PaymentSession,
  PaymentSummary,
  Photo,
  SessionUser,
} from '@/types'

export type Filters = Record<string, string | number | boolean | null | undefined>

export const keys = {
  session: ['session'] as const,
  options: ['options'] as const,
  dashboard: (days: number) => ['dashboard', days] as const,
  devices: (filters: Filters) => ['devices', filters] as const,
  device: (id: number | string) => ['device', String(id)] as const,
  campaigns: (filters: Filters) => ['campaigns', filters] as const,
  campaign: (id: number | string) => ['campaign', String(id)] as const,
  photos: (filters: Filters) => ['photos', filters] as const,
  notifications: (filters: Filters) => ['notifications', filters] as const,
  unread: ['notifications', 'unread'] as const,
  payments: (filters: Filters) => ['payments', filters] as const,
  paymentSummary: (filters: Filters) => ['payments', 'summary', filters] as const,
}

/** Anything that can change when a device or campaign is written. */
export function invalidateFleet(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: ['devices'] })
  void client.invalidateQueries({ queryKey: ['campaigns'] })
  void client.invalidateQueries({ queryKey: ['dashboard'] })
  void client.invalidateQueries({ queryKey: keys.options })
}

// --------------------------------------------------------------------------- //
//  Session
// --------------------------------------------------------------------------- //

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: () =>
      // The probe itself must not trigger the redirect-on-401 helper; the
      // router handles an absent session with a client-side redirect.
      request<SessionUser>('/auth/session/', { allowUnauthenticated: true }),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      api.post<SessionUser>('/auth/login/', payload),
    onSuccess: (user) => {
      client.setQueryData(keys.session, user)
      void client.invalidateQueries()
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout/'),
    onSuccess: () => client.clear(),
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Pick<SessionUser, 'username' | 'email' | 'first_name' | 'last_name'>>) =>
      api.patch<SessionUser>('/auth/profile/', payload),
    onSuccess: (user) => client.setQueryData(keys.session, user),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { old_password: string; new_password1: string; new_password2: string }) =>
      api.post<void>('/auth/password/', payload),
  })
}

// --------------------------------------------------------------------------- //
//  Shared lookups
// --------------------------------------------------------------------------- //

export function useOptions(enabled = true) {
  return useQuery({
    queryKey: keys.options,
    queryFn: () => api.get<Options>('/options/'),
    staleTime: 5 * 60_000,
    enabled,
  })
}

// --------------------------------------------------------------------------- //
//  Dashboard
// --------------------------------------------------------------------------- //

export function useDashboard(days = 14) {
  return useQuery({
    queryKey: keys.dashboard(days),
    queryFn: () => api.get<Dashboard>('/dashboard/', { days }),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
}

// --------------------------------------------------------------------------- //
//  Devices
// --------------------------------------------------------------------------- //

export function useDevices(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.devices(filters),
    queryFn: () => api.get<Device[]>('/devices/', filters),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useSaveDevice() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number } & Record<string, unknown>) =>
      id ? api.patch<Device>(`/devices/${id}/`, payload) : api.post<Device>('/devices/', payload),
    onSuccess: () => invalidateFleet(client),
  })
}

export function useDeleteDevice() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/devices/${id}/`),
    onSuccess: () => invalidateFleet(client),
  })
}

export function useDeviceCommand() {
  return useMutation({
    mutationFn: ({ id, command }: { id: number; command: string }) =>
      api.post<{ delivered: boolean; device_id: string }>(`/devices/${id}/command/`, { command }),
  })
}

// --------------------------------------------------------------------------- //
//  Campaigns
// --------------------------------------------------------------------------- //

export function useCampaigns(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.campaigns(filters),
    queryFn: () => api.get<Page<Campaign>>('/campaigns/', filters),
    placeholderData: keepPreviousData,
  })
}

export function useSaveCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: FormData }) =>
      id
        ? api.patch<Campaign>(`/campaigns/${id}/`, body)
        : api.post<Campaign>('/campaigns/', body),
    onSuccess: () => invalidateFleet(client),
  })
}

export function useDeleteCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/campaigns/${id}/`),
    onSuccess: () => invalidateFleet(client),
  })
}

// --------------------------------------------------------------------------- //
//  Photos
// --------------------------------------------------------------------------- //

export function usePhotos(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.photos(filters),
    queryFn: () => api.get<Page<Photo>>('/photos/', filters),
    placeholderData: keepPreviousData,
  })
}

export function useDeletePhotos() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      ids.length === 1
        ? api.delete<void>(`/photos/${ids[0]}/`).then(() => ({ deleted: 1 }))
        : api.post<{ deleted: number }>('/photos/bulk-delete/', { ids }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['photos'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDownloadPhotos() {
  return useMutation({
    mutationFn: (input: { ids?: number[]; filters?: Filters }) =>
      input.ids?.length
        ? download('/photos/download/', { method: 'POST', body: { ids: input.ids } })
        : download('/photos/download-all/', { params: input.filters }),
  })
}

// --------------------------------------------------------------------------- //
//  Notifications
// --------------------------------------------------------------------------- //

export function useNotifications(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.notifications(filters),
    queryFn: () => api.get<Page<AppNotification>>('/notifications/', filters),
    placeholderData: keepPreviousData,
  })
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: keys.unread,
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count/'),
    refetchInterval: 60_000,
    enabled,
  })
}

export function useUpdateNotification() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      api.patch<AppNotification>(`/notifications/${id}/`, { status }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMarkAllRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/notifications/mark-all-read/'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// --------------------------------------------------------------------------- //
//  Payments
// --------------------------------------------------------------------------- //

export function usePayments(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.payments(filters),
    queryFn: () => api.get<Page<PaymentSession>>('/payment-sessions/', filters),
    placeholderData: keepPreviousData,
  })
}

export function usePaymentSummary(filters: Filters = {}) {
  return useQuery({
    queryKey: keys.paymentSummary(filters),
    queryFn: () => api.get<PaymentSummary>('/payment-sessions/summary/', filters),
    placeholderData: keepPreviousData,
  })
}
