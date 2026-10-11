/**
 * Query hooks for the console-ai group. Every mutation refreshes the whole
 * `console-ai` family (a connection edit changes the assignment matrix, the
 * self-test and the workspace editors) and the workspace-side AI screen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { del, get, patch, post, put } from '@/lib/api'
import type { AiConnection, AiProviderEntry, Id, Integration, SelfTestProbe } from '@/types'
import type {
  AssignmentsPayload,
  ConnectionInput,
  ConnectionPatch,
  ConnectionTestResult,
  DiagnoseResult,
  EmbeddingsInput,
  EmbeddingsPayload,
  EmbeddingsTestResult,
  InstructionsPayload,
  IntegrationCreateInput,
  IntegrationPatch,
  IntegrationSecretOnce,
  SelfTestMode,
  TenantAiInput,
  TenantAiPayload,
  TranscriptionDefaultPayload,
} from './types'

const keys = queryKeys['console-ai']

function useRefresh() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: keys.all })
    void qc.invalidateQueries({ queryKey: queryKeys['workspace-settings'].all })
  }
}

/* -------------------------------------------------------------- providers */

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => get<AiProviderEntry[]>('/admin/ai/catalog'), staleTime: 5 * 60_000 })

export const useConnections = (includeInactive = false) =>
  useQuery({
    queryKey: keys.connections(includeInactive),
    queryFn: () => get<AiConnection[]>('/admin/ai/connections', { include_inactive: includeInactive }),
  })

export function useCreateConnection() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: ConnectionInput) => post<AiConnection>('/admin/ai/connections', input),
    onSuccess: refresh,
  })
}

export function useUpdateConnection() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, ...input }: ConnectionPatch & { id: Id }) => patch<AiConnection>(`/admin/ai/connections/${id}`, input),
    onSuccess: refresh,
  })
}

export function useTestConnection() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: Id) => post<ConnectionTestResult>(`/admin/ai/connections/${id}/test`),
    onSuccess: refresh,
  })
}

export function useMakeDefault() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: Id) => post<AiConnection>(`/admin/ai/connections/${id}/default`),
    onSuccess: refresh,
  })
}

/* ------------------------------------------------------------ assignments */

export const useAssignments = () =>
  useQuery({ queryKey: keys.assignments, queryFn: () => get<AssignmentsPayload>('/admin/ai/assignments') })

export const useTenantAi = (tenantId: Id) =>
  useQuery({ queryKey: keys.tenant(tenantId), queryFn: () => get<TenantAiPayload>(`/admin/ai/tenants/${tenantId}`), retry: false })

export function useSaveTenantAi(tenantId: Id) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: TenantAiInput) => put<TenantAiPayload>(`/admin/ai/tenants/${tenantId}`, input),
    onSuccess: refresh,
  })
}

export function useRemoveLegacyKey(tenantId: Id) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: () => del<TenantAiPayload>(`/admin/ai/tenants/${tenantId}/legacy-key`),
    onSuccess: refresh,
  })
}

/* ----------------------------------------------------------- integrations */

export const useInstructions = () =>
  useQuery({ queryKey: keys.instructions, queryFn: () => get<InstructionsPayload>('/admin/integrations/instructions') })

export function useSaveInstructions() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (instructions: string) => put<InstructionsPayload>('/admin/integrations/instructions', { instructions }),
    onSuccess: refresh,
  })
}

export const useSelfTest = () =>
  useMutation({ mutationFn: (mode: SelfTestMode) => post<SelfTestProbe[]>('/admin/integrations/self-test', { mode }) })

export const useTranscriptionDefault = () =>
  useQuery({
    queryKey: keys.transcriptionDefault,
    queryFn: () => get<TranscriptionDefaultPayload>('/admin/transcription/default'),
  })

export function useSaveTranscriptionDefault() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: TranscriptionDefaultPayload['settings']) => put<TranscriptionDefaultPayload>('/admin/transcription/default', input),
    onSuccess: refresh,
  })
}

/** Polled: the web chat service keeps using its secrets, so "last used" moves. */
export const useIntegrations = () =>
  useQuery({
    queryKey: keys.integrations,
    queryFn: () => get<Integration[]>('/admin/chat/integrations'),
    refetchInterval: 15_000,
  })

export function useCreateIntegration() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: IntegrationCreateInput) =>
      post<{ integration: Integration; secret: IntegrationSecretOnce }>('/admin/chat/integrations', input),
    onSuccess: refresh,
  })
}

export function usePatchIntegration() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, ...input }: IntegrationPatch & { id: Id }) => patch<Integration>(`/admin/chat/integrations/${id}`, input),
    onSuccess: refresh,
  })
}

export function useRotateIntegration() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (id: Id) =>
      post<{ integration: Integration; secret: IntegrationSecretOnce; overlap_until: string }>(`/admin/chat/integrations/${id}/rotate`, {}),
    onSuccess: refresh,
  })
}

export function useRevokeSecret() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, keyId }: { id: Id; keyId: string }) => post<Integration>(`/admin/chat/integrations/${id}/secrets/${keyId}/revoke`, {}),
    onSuccess: refresh,
  })
}

export const useDiagnose = () =>
  useMutation({
    mutationFn: ({ id, ...input }: { id: Id; key_id: string; client_id: Id; scope?: string }) =>
      post<DiagnoseResult>(`/admin/chat/integrations/${id}/diagnose`, input),
  })

/* ------------------------------------------------------------- embeddings */

export const useEmbeddings = () =>
  useQuery({ queryKey: keys.embeddings, queryFn: () => get<EmbeddingsPayload>('/admin/embeddings') })

export function useSaveEmbeddings() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: EmbeddingsInput) => put<EmbeddingsPayload>('/admin/embeddings', input),
    onSuccess: refresh,
  })
}

export const useTestEmbeddings = () =>
  useMutation({
    mutationFn: (input: Partial<EmbeddingsInput>) => post<EmbeddingsTestResult>('/admin/embeddings/test', input),
  })
