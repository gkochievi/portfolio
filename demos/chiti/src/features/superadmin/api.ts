/**
 * Query hooks of the super-admin console. Every mutation invalidates the whole
 * `superadmin` key tree, so the tenant table, the manage page, the platform
 * grid and the KPI tiles always agree.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api, errorMessage, isApiError } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { ChannelFeatures, StaffConversation, StaffMessage } from '@/types'

import type {
  AiKeyResponse,
  ChecksResponse,
  HealthRange,
  HealthResponse,
  ImpersonateResponse,
  Member,
  MemberInput,
  MemberRole,
  MembersResponse,
  Overview,
  PlatformResponse,
  TenantRow,
} from './types'

export type TenantStateFilter = 'all' | 'active' | 'disabled' | 'deleted'

/* ------------------------------------------------------------------ queries */

export function useOverview() {
  const query = useQuery({ queryKey: queryKeys.superadmin.overview, queryFn: ({ signal }) => api.get<Overview>('/superadmin/overview', { signal }) })
  useInvalidateOn(['tenant:upsert', 'operator:upsert', 'demo:reset'], queryKeys.superadmin.all)
  return query
}

export function useTenants(params: { q?: string; state?: TenantStateFilter } = {}) {
  return useQuery({
    queryKey: queryKeys.superadmin.tenants({ q: params.q ?? '', state: params.state ?? 'all' }),
    queryFn: ({ signal }) =>
      api.get<TenantRow[]>('/superadmin/tenants', { params: { q: params.q || undefined, state: params.state && params.state !== 'all' ? params.state : undefined }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useMembers(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.superadmin.members(tenantId),
    queryFn: ({ signal }) => api.get<MembersResponse>(`/superadmin/tenants/${tenantId}/members`, { signal }),
  })
}

export function useStaffChats(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.superadmin.staffChats(tenantId),
    queryFn: ({ signal }) => api.get<StaffConversation[]>(`/superadmin/tenants/${tenantId}/staff-chats`, { signal }),
  })
}

export function useStaffChatMessages(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.superadmin.staffChatMessages(conversationId ?? ''),
    queryFn: ({ signal }) => api.get<StaffMessage[]>(`/superadmin/staff-chats/${conversationId}/messages`, { signal }),
    enabled: conversationId !== null,
  })
}

export function usePlatform() {
  return useQuery({ queryKey: queryKeys.superadmin.platform, queryFn: ({ signal }) => api.get<PlatformResponse>('/superadmin/platform', { signal }) })
}

/** Refreshes every 2 s (react-query pauses it while the tab is hidden). */
export function useHealth(range: HealthRange) {
  return useQuery({
    queryKey: queryKeys.superadmin.health(range),
    queryFn: ({ signal }) => api.get<HealthResponse>('/superadmin/health', { params: { range }, signal }),
    refetchInterval: range === 'live' ? 2_000 : 10_000,
    placeholderData: keepPreviousData,
  })
}

export function useAiKey() {
  return useQuery({ queryKey: queryKeys.superadmin.aiKey, queryFn: ({ signal }) => api.get<AiKeyResponse>('/superadmin/ai-key', { signal }) })
}

/* ---------------------------------------------------------------- mutations */

function useSuperMutation<TIn, TOut>(fn: (input: TIn) => Promise<TOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.superadmin.all }),
  })
}

export function useCreateTenant() {
  return useSuperMutation((name: string) => api.post<TenantRow>('/superadmin/tenants', { name }))
}

export function useUpdateTenant() {
  return useSuperMutation((input: { id: string; allowedOrigins?: string[]; name?: string }) => {
    const { id, ...patch } = input
    return api.patch<TenantRow>(`/superadmin/tenants/${id}`, patch)
  })
}

export type TenantAction = 'disable' | 'enable' | 'delete' | 'restore'

export function useTenantAction() {
  return useSuperMutation((input: { id: string; action: TenantAction }) => api.post<TenantRow>(`/superadmin/tenants/${input.id}/${input.action}`))
}

export function useEraseTenant() {
  return useSuperMutation((input: { id: string; password: string }) => api.post<{ id: string }>(`/superadmin/tenants/${input.id}/erase`, { password: input.password }))
}

export function useCreateMember() {
  return useSuperMutation((input: { tenantId: string; role: MemberRole } & MemberInput) => {
    const { tenantId, ...body } = input
    return api.post<Member>(`/superadmin/tenants/${tenantId}/members`, body)
  })
}

export function useUpdateMember() {
  return useSuperMutation((input: { role: MemberRole; id: string } & Partial<MemberInput>) => {
    const { role, id, ...body } = input
    return api.patch<Member>(`/superadmin/members/${role}/${id}`, body)
  })
}

export function useDeleteMember() {
  return useSuperMutation((input: { role: MemberRole; id: string }) => api.delete<{ id: string }>(`/superadmin/members/${input.role}/${input.id}`))
}

export function useUpdateFeatures() {
  return useSuperMutation((input: { id: string } & Partial<ChannelFeatures>) => {
    const { id, ...body } = input
    return api.patch<TenantRow>(`/superadmin/tenants/${id}/features`, body)
  })
}

export function useImpersonate() {
  return useMutation({ mutationFn: (input: { role: MemberRole; memberId: string }) => api.post<ImpersonateResponse>('/superadmin/impersonate', input) })
}

export function useSaveMeta() {
  return useSuperMutation((input: { appId: string; appSecret: string; oauthRedirectBase: string; loginConfigId: string; whatsappConfigId: string }) =>
    api.put<PlatformResponse>('/superadmin/platform/meta', input),
  )
}

export function useSaveTikTok() {
  return useSuperMutation((input: { appId: string; appSecret: string }) => api.put<PlatformResponse>('/superadmin/platform/tiktok', input))
}

export function useTestIntegrations() {
  return useMutation({ mutationFn: (target: 'meta' | 'tiktok') => api.post<ChecksResponse>('/superadmin/platform/test', { target }) })
}

export function useRegisterWebhook() {
  return useSuperMutation(() => api.post<PlatformResponse>('/superadmin/platform/tiktok/register-webhook'))
}

export function useSetRetention() {
  return useSuperMutation((months: number) => api.patch<{ retentionMonths: number }>('/superadmin/health/retention', { months }))
}

export function useSaveAiKey() {
  return useSuperMutation((input: { key: string; baseUrl: string }) => api.put<AiKeyResponse>('/superadmin/ai-key', input))
}

export function useTestAiKey() {
  return useMutation({ mutationFn: () => api.post<ChecksResponse>('/superadmin/ai-key/test') })
}

export function useRemoveAiKey() {
  return useSuperMutation(() => api.delete<AiKeyResponse>('/superadmin/ai-key'))
}

/* ------------------------------------------------------------------- errors */

/** Translate the machine codes the handlers attach to their errors. */
export function useSuperErrors() {
  const { t } = useTranslation('superadmin')
  return {
    /** A message fit for a toast. */
    text(error: unknown): string {
      const code = isApiError(error) ? error.fieldErrors.code?.[0] : undefined
      if (code && t(`errors.${code}`, { defaultValue: '' })) return t(`errors.${code}`)
      if (isApiError(error) && error.status === 403) return t('errors.forbidden')
      if (isApiError(error)) {
        const first = Object.values(error.fieldErrors)[0]?.[0]
        if (first && t(`errors.field.${first}`, { defaultValue: '' })) return t(`errors.field.${first}`)
      }
      return errorMessage(error, t('errors.generic'))
    },
    /** Server field errors -> { field: translated message }. */
    fields(error: unknown): Record<string, string> {
      if (!isApiError(error)) return {}
      const out: Record<string, string> = {}
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        if (field === 'code' || field === 'non_field_errors' || field === 'value') continue
        const code = messages[0] ?? ''
        out[field] = t(`errors.field.${code}`, { defaultValue: code, value: error.fieldErrors.value?.[0] ?? '' })
      }
      return out
    },
  }
}
