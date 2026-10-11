/** Query hooks for the access group. Keys all start with 'access'. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import { ME_QUERY_KEY } from '@/shell/useMe'
import type { ConnectionKey, ConnectionTestResult, RbacMatrixResponse, RbacOverrides, ServiceConfig } from '@/types'
import type { FieldValue } from './schema'

export const accessKeys = {
  all: queryKeys.access.all,
  rbac: [...queryKeys.access.all, 'rbac'] as const,
  connections: [...queryKeys.access.all, 'connections'] as const,
}

/* -------------------------------------------------------------------- rbac */

export function useRbacMatrix() {
  return useQuery({
    queryKey: accessKeys.rbac,
    queryFn: ({ signal }) => http.get<RbacMatrixResponse>('/rbac', undefined, signal),
  })
}

/** Save the overrides, then refresh `me` so nav and route guards follow at once. */
export function useSaveRbac() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (overrides: RbacOverrides) => http.put<RbacMatrixResponse>('/rbac', { overrides }),
    onSuccess: (data) => {
      qc.setQueryData(accessKeys.rbac, data)
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
    },
  })
}

/* ------------------------------------------------------------- connections */

export function useConnections() {
  return useQuery({
    queryKey: accessKeys.connections,
    queryFn: ({ signal }) => http.get<ServiceConfig[]>('/connections', undefined, signal),
  })
}

export interface SaveConnectionInput {
  key: ConnectionKey
  enabled: boolean
  value: Record<string, FieldValue>
}

export function useSaveConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, enabled, value }: SaveConnectionInput) => http.put<ServiceConfig>(`/connections/${key}`, { enabled, value }),
    onSuccess: (saved) => {
      qc.setQueryData<ServiceConfig[]>(accessKeys.connections, (list) => list?.map((c) => (c.key === saved.key ? saved : c)))
      // The contact-centre port cap is shared with the campaign editor.
      if (saved.key === 'contact_centre') void qc.invalidateQueries({ queryKey: queryKeys.campaigns.all })
    },
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: ({ key, value }: { key: ConnectionKey; value: Record<string, FieldValue> }) =>
      http.post<ConnectionTestResult>(`/connections/${key}/test`, { value }),
  })
}
