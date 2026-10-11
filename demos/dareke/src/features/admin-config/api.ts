/** React Query hooks for the admin-config screens (statuses, dispositions, DNC, settings, system config). */
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'

import { del, get, patch, post, put } from '@/lib/api'
import { queryKeys } from '@/lib/queryClient'
import type {
  AgentStatus,
  AgentStatusType,
  ConnectionTestResult,
  Disposition,
  DncEntryView,
  DncImportResult,
  Localized,
  SystemConfig,
  SystemSettings,
  Tone,
} from '@/types'

export const configKeys = {
  statuses: queryKeys.statuses,
  dispositions: queryKeys.dispositions,
  dnc: () => ['dnc'] as const,
  settings: () => ['settings'] as const,
  config: () => ['config'] as const,
}

function useInvalidate() {
  const client = useQueryClient()
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

/* ------------------------------------------------------------------ statuses */

export interface StatusInput {
  displayName: Localized
  type: AgentStatusType
  timeoutSeconds: number
  autoReturn: boolean
  color: Tone
}

export const useStatuses = () => useQuery({ queryKey: configKeys.statuses(), queryFn: () => get<AgentStatus[]>('/agent-statuses') })

export function useSaveStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: StatusInput }) =>
      id ? patch<AgentStatus>(`/agent-statuses/${id}`, input) : post<AgentStatus>('/agent-statuses', input),
    onSettled: () => invalidate(['statuses'], ['agents'], ['me']),
  })
}

export function useDeleteStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/agent-statuses/${id}`),
    onSettled: () => invalidate(['statuses'], ['agents']),
  })
}

/* -------------------------------------------------------------- dispositions */

export interface DispositionInput {
  code: string
  name: Localized
  color: Tone
  isFinal: boolean
  scheduleCallback: boolean
  addToDnc: boolean
  sortOrder?: number
}

export const useDispositions = () => useQuery({ queryKey: configKeys.dispositions(), queryFn: () => get<Disposition[]>('/dispositions') })

export function useSaveDisposition() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DispositionInput }) =>
      id ? patch<Disposition>(`/dispositions/${id}`, input) : post<Disposition>('/dispositions', input),
    onSettled: () => invalidate(['dispositions'], ['calls'], ['reports']),
  })
}

export function useDeleteDisposition() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/dispositions/${id}`),
    onSettled: () => invalidate(['dispositions']),
  })
}

/* ----------------------------------------------------------------------- DNC */

export const useDnc = () => useQuery({ queryKey: configKeys.dnc(), queryFn: () => get<DncEntryView[]>('/dnc') })

export function useAddDnc() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { phoneNumber: string; reason: string }) => post<DncEntryView>('/dnc', input),
    onSuccess: () => invalidate(['dnc'], ['numbers'], ['campaigns']),
  })
}

export function useRemoveDnc() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/dnc/${id}`),
    onSettled: () => invalidate(['dnc'], ['numbers'], ['campaigns']),
  })
}

export function useImportDnc() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { text: string; filename: string }) => post<DncImportResult>('/dnc/import', input),
    onSuccess: () => invalidate(['dnc'], ['numbers'], ['campaigns']),
  })
}

/* ------------------------------------------------------------------ settings */

export const useSettings = () => useQuery({ queryKey: configKeys.settings(), queryFn: () => get<SystemSettings>('/settings') })

export function useSaveSettings() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: SystemSettings) => put<SystemSettings>('/settings', input),
    onSuccess: () => invalidate(['settings'], ['dialer']),
  })
}

/* ------------------------------------------------------------- system config */

export type ConfigSection = 'app' | 'client' | 'pbx' | 'ldap'

export const useSystemConfig = (enabled = true) =>
  useQuery({ queryKey: configKeys.config(), queryFn: () => get<SystemConfig>('/system-config'), enabled })

export function useSaveConfigSection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ section, input }: { section: ConfigSection; input: Record<string, unknown> }) => put<SystemConfig>(`/system-config/${section}`, input),
    onSuccess: (data) => {
      client.setQueryData(configKeys.config(), data)
      void client.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

export function useTestConnection(target: 'pbx' | 'ldap') {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => post<ConnectionTestResult>(`/system-config/${target}/test`, input),
  })
}
