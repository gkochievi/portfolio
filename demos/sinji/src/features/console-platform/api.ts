/** Query hooks for the operator console. Keys live in `@/api/queryKeys` under `console-platform`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api, isApiError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { AppUser, HealthRange, HealthSample, LimitsConfig, Tenant, TenantLoad, TenantUser } from '@/types'
import type {
  AnonymousPayload,
  ConsoleSummary,
  HealthOverview,
  PasswordResult,
  TenantInput,
  TenantUserInput,
  TenantWithKey,
  UserPatch,
  VoicesPayload,
} from './types'

const keys = queryKeys['console-platform']

/* ------------------------------------------------------------------ errors */

/** Turns an API failure into translated copy (handlers throw short codes). */
export function useErrorText() {
  const { t, i18n } = useTranslation('consolePlatform')
  const text = (error: unknown): string => {
    const code = isApiError(error) ? error.message : ''
    if (code && i18n.exists(`consolePlatform:errors.${code}`)) return t(`errors.${code}`)
    return t('errors.generic')
  }
  const fields = (error: unknown): Record<string, string> => {
    const out: Record<string, string> = {}
    if (!isApiError(error)) return out
    for (const [field, codes] of Object.entries(error.fieldErrors)) {
      const code = codes[0]
      if (code) out[field] = i18n.exists(`consolePlatform:errors.${code}`) ? t(`errors.${code}`) : code
    }
    return out
  }
  return { text, fields }
}

/* ----------------------------------------------------------------- queries */

export const useConsoleSummary = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<ConsoleSummary>('/admin/settings'), retry: false })

export const useTenants = () => useQuery({ queryKey: keys.tenants, queryFn: () => api.get<Tenant[]>('/admin/tenants') })

export const useTenantUsers = (tenantId: string | null) =>
  useQuery({
    queryKey: keys.tenantUsers(tenantId ?? ''),
    queryFn: () => api.get<TenantUser[]>(`/admin/tenants/${tenantId}/users`),
    enabled: Boolean(tenantId),
  })

export const useHealthOverview = () =>
  useQuery({ queryKey: keys.healthOverview, queryFn: () => api.get<HealthOverview>('/admin/health/overview'), staleTime: 0, refetchOnMount: 'always' })

export const useHealthSeries = (range: HealthRange) =>
  useQuery({
    queryKey: keys.healthSeries(range),
    queryFn: () => api.get<HealthSample[]>('/admin/health/series', { range }),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
  })

export const useHealthTenants = (range: HealthRange) =>
  useQuery({
    queryKey: keys.healthTenants(range),
    queryFn: () => api.get<TenantLoad[]>('/admin/health/tenants', { range }),
    staleTime: 0,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  })

export const useRegisteredUsers = (q: string) =>
  useQuery({
    queryKey: keys.users(q),
    queryFn: () => api.get<AppUser[]>('/admin/users', { q: q || undefined }),
    placeholderData: (previous) => previous,
  })

export const useRegisteredLimits = () =>
  useQuery({ queryKey: keys.limitsRegistered, queryFn: () => api.get<LimitsConfig>('/admin/limits/registered') })

export const useAnonymousLimits = () =>
  useQuery({ queryKey: keys.limitsAnonymous, queryFn: () => api.get<AnonymousPayload>('/admin/limits/anonymous') })

export const useStorage = () =>
  useQuery({ queryKey: keys.storage, queryFn: () => api.get<{ retention_days: number }>('/admin/storage') })

export const useVoices = () => useQuery({ queryKey: keys.voices, queryFn: () => api.get<VoicesPayload>('/admin/voices') })

/* --------------------------------------------------------------- mutations */

/** Everything the console shows is refetched after a write; workspace switchers too. */
function useRefresh() {
  const client = useQueryClient()
  return (alsoShell = false) => {
    void client.invalidateQueries({ queryKey: keys.all })
    if (alsoShell) void client.invalidateQueries({ queryKey: queryKeys.shell.all })
  }
}

export function useTenantMutations() {
  const refresh = useRefresh()
  return {
    create: useMutation({
      mutationFn: (input: TenantInput) => api.post<TenantWithKey>('/admin/tenants', input),
      onSuccess: () => refresh(true),
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string } & Partial<TenantInput> & { is_active?: boolean }) =>
        api.patch<Tenant>(`/admin/tenants/${id}`, patch),
      onSuccess: () => refresh(true),
    }),
    remove: useMutation({
      mutationFn: ({ id, confirm_slug }: { id: string; confirm_slug: string }) => api.delete(`/admin/tenants/${id}`, { confirm_slug }),
      onSuccess: () => refresh(true),
    }),
    rotate: useMutation({
      mutationFn: (id: string) => api.post<TenantWithKey>(`/admin/tenants/${id}/rotate-key`),
      onSuccess: () => refresh(),
    }),
  }
}

export function useTenantUserMutations(tenantId: string) {
  const refresh = useRefresh()
  return {
    add: useMutation({
      mutationFn: (input: TenantUserInput) => api.post<{ user: TenantUser } & PasswordResult>(`/admin/tenants/${tenantId}/users`, input),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string; role?: TenantUser['role']; is_active?: boolean; display_name?: string }) =>
        api.patch<TenantUser>(`/admin/tenant-users/${id}`, patch),
      onSuccess: () => refresh(),
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/admin/tenant-users/${id}`), onSuccess: () => refresh() }),
    resetPassword: useMutation({
      mutationFn: (id: string) => api.post<PasswordResult>(`/admin/tenant-users/${id}/reset-password`),
    }),
  }
}

export function useHealthSettingsMutation() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: { retention_days: number; sample_interval_s: number }) => api.put('/admin/health/settings', input),
    onSuccess: () => refresh(),
  })
}

export function useUserMutations() {
  const refresh = useRefresh()
  return {
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string } & UserPatch) => api.patch<AppUser>(`/admin/users/${id}`, patch),
      onSuccess: () => refresh(),
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/admin/users/${id}`), onSuccess: () => refresh() }),
    resetPassword: useMutation({ mutationFn: (id: string) => api.post<PasswordResult>(`/admin/users/${id}/reset-password`) }),
  }
}

export function useSaveRegisteredLimits() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (limits: LimitsConfig) => api.put<LimitsConfig>('/admin/limits/registered', limits),
    onSuccess: () => refresh(),
  })
}

export function useSaveAnonymous() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (payload: AnonymousPayload) => api.put<AnonymousPayload>('/admin/limits/anonymous', payload),
    onSuccess: () => refresh(),
  })
}

export function useSaveStorage() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (retention_days: number) => api.put<{ retention_days: number }>('/admin/storage', { retention_days }),
    onSuccess: () => refresh(),
  })
}

export function useSaveVoices() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: { mode: 'all' | 'allowlist'; voice_ids: string[] }) => api.put<VoicesPayload>('/admin/voices', input),
    onSuccess: () => refresh(),
  })
}
