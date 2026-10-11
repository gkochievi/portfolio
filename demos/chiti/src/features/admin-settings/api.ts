/**
 * Query hooks for the settings area. Lists stay fresh through the event bus
 * (a second tab, or another admin screen, changing hours or settings shows up
 * here); every mutation refreshes every screen that reads the same data: the
 * shell's Open/Closed pill, the widget config, the inbox quick replies.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { BannedClient, ContentLang, CustomField, CustomFieldType, LocalizedText, QuickReply, QuickReplyCategory, TenantSettings, WorkingHours, WorkingHoursStatus } from '@/types'

/* ------------------------------------------------------------------- inputs */

export interface WorkingHoursPayload {
  hours: WorkingHours
  status: WorkingHoursStatus
}

export type WorkingHoursInput = Pick<
  WorkingHours,
  'weeklySchedule' | 'isTemporarilyClosed' | 'temporaryClosedFrom' | 'temporaryClosedUntil' | 'temporaryClosedMessage' | 'nextAvailableMessage' | 'demoOverride'
>

export interface FieldInput {
  label: LocalizedText
  type: CustomFieldType
  placeholder: LocalizedText
  options: { value: string; label: LocalizedText }[]
  required: boolean
  enabled: boolean
  groupBy: boolean
}

export interface ReplyInput {
  title: LocalizedText
  content: LocalizedText
  category: QuickReplyCategory
  enabled: boolean
}

export interface BanInput {
  type: 'ip' | 'customField'
  value: string
  fieldId?: string
  reason: string
}

export interface PurgeResult {
  sessions: number
  messages: number
  files: number
}

export const LANGS: ContentLang[] = ['ka', 'en', 'ru']

/* ------------------------------------------------------------------ queries */

export function useSettings() {
  const query = useQuery({ queryKey: queryKeys.admin.settings, queryFn: ({ signal }) => api.get<TenantSettings>('/admin/settings', { signal }) })
  useInvalidateOn(['settings:update', 'demo:reset'], queryKeys.admin.settings)
  return query
}

export function useWorkingHours() {
  const query = useQuery({
    queryKey: queryKeys.admin.workingHours,
    queryFn: ({ signal }) => api.get<WorkingHoursPayload>('/admin/working-hours', { signal }),
    // The open/closed state follows the clock; react-query pauses this in hidden tabs.
    refetchInterval: 30_000,
  })
  useInvalidateOn(['working-hours:update', 'demo:reset'], queryKeys.admin.workingHours)
  return query
}

export function useCustomFields() {
  const query = useQuery({ queryKey: queryKeys.admin.customFields, queryFn: ({ signal }) => api.get<CustomField[]>('/admin/custom-fields', { signal }) })
  useInvalidateOn(['demo:reset'], queryKeys.admin.customFields)
  return query
}

export function useQuickReplies() {
  const query = useQuery({ queryKey: queryKeys.admin.quickReplies, queryFn: ({ signal }) => api.get<QuickReply[]>('/admin/quick-replies', { signal }) })
  useInvalidateOn(['demo:reset'], queryKeys.admin.quickReplies)
  return query
}

export function useBans() {
  const query = useQuery({ queryKey: queryKeys.admin.bans, queryFn: ({ signal }) => api.get<BannedClient[]>('/admin/bans', { signal }) })
  useInvalidateOn(['demo:reset'], queryKeys.admin.bans)
  return query
}

/* ---------------------------------------------------------------- mutations */

/** Everything outside this feature that shows tenant settings, hours, fields, replies or activity. */
function refreshElsewhere(client: QueryClient): void {
  for (const queryKey of [queryKeys.tenantSettings, queryKeys.me, ['widget'], ['quick-replies'], ['operator', 'inbox'], ['admin', 'activity']]) {
    void client.invalidateQueries({ queryKey })
  }
}

export function useUpdateSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<TenantSettings> & { password?: string }) => api.patch<TenantSettings>('/admin/settings', patch),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.admin.settings, settings)
      refreshElsewhere(client)
    },
  })
}

export function useSaveWorkingHours() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkingHoursInput) => api.put<WorkingHoursPayload>('/admin/working-hours', input),
    onSuccess: (payload) => {
      client.setQueryData(queryKeys.admin.workingHours, payload)
      refreshElsewhere(client)
    },
  })
}

export function useVerifyPassword() {
  return useMutation({ mutationFn: (password: string) => api.post<{ ok: true }>('/admin/verify-password', { password }) })
}

export function usePurge() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { from: string; to: string; password: string }) => api.post<PurgeResult>('/admin/purge', input),
    onSuccess: () => {
      for (const queryKey of [['admin'], ['operator'], ['sessions'], ['superadmin']]) void client.invalidateQueries({ queryKey })
    },
  })
}

export function useFieldMutations() {
  const client = useQueryClient()
  const done = () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.customFields })
    refreshElsewhere(client)
  }
  return {
    create: useMutation({ mutationFn: (input: FieldInput) => api.post<CustomField>('/admin/custom-fields', input), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<FieldInput> }) => api.patch<CustomField>(`/admin/custom-fields/${id}`, patch), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/custom-fields/${id}`), onSuccess: done }),
  }
}

export function useReplyMutations() {
  const client = useQueryClient()
  const done = () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.quickReplies })
    refreshElsewhere(client)
  }
  return {
    create: useMutation({ mutationFn: (input: ReplyInput) => api.post<QuickReply>('/admin/quick-replies', input), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<ReplyInput> }) => api.patch<QuickReply>(`/admin/quick-replies/${id}`, patch), onSuccess: done }),
    move: useMutation({ mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => api.post<QuickReply[]>(`/admin/quick-replies/${id}/move`, { direction }), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/quick-replies/${id}`), onSuccess: done }),
  }
}

export function useBanMutations() {
  const client = useQueryClient()
  const done = () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.bans })
    refreshElsewhere(client)
  }
  return {
    create: useMutation({ mutationFn: (input: BanInput) => api.post<BannedClient>('/admin/bans', input), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/bans/${id}`), onSuccess: done }),
  }
}
