/**
 * Query hooks for staff management. Lists stay fresh through the event bus
 * (operator status and load change live); every mutation invalidates every
 * screen that shows staff (admin lists, team roster, inbox).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { Admin, ContentLang, Operator, OperatorAuditLog, Supervisor } from '@/types'

export type StaffKind = 'operator' | 'admin' | 'supervisor'
export type StaffRecord = Operator | Admin | Supervisor

export interface StaffInput {
  name: { en: string; ka: string }
  nickname: string
  email: string
  username: string
  /** Required on create; blank or omitted on edit keeps the current one. */
  password?: string
  /** 3-4 digits, blank = auto-generate. */
  number: string
  language: ContentLang
  isExternal: boolean
  avatarId?: string | null
  avatarUrl?: string | null
}

const BASE = { operator: '/admin/operators', admin: '/admin/admins', supervisor: '/admin/supervisors' } as const

export function staffNumber(kind: StaffKind, row: StaffRecord): string {
  if (kind === 'operator') return (row as Operator).operatorNumber
  if (kind === 'admin') return (row as Admin).adminNumber
  return (row as Supervisor).supervisorNumber
}

/* ------------------------------------------------------------------ queries */

export function useOperators(q: string) {
  const query = useQuery({
    queryKey: queryKeys.admin.operators(q),
    queryFn: ({ signal }) => api.get<Operator[]>(BASE.operator, { params: { q: q || undefined }, signal }),
    placeholderData: keepPreviousData,
  })
  // Status flips, chat load and new operators arrive over the bus.
  useInvalidateOn(['operator:upsert', 'assignment:upsert', 'demo:reset'], ['admin', 'operators'])
  return query
}

export function useAdmins() {
  return useQuery({ queryKey: queryKeys.admin.admins, queryFn: ({ signal }) => api.get<Admin[]>(BASE.admin, { signal }) })
}

export function useSupervisors() {
  return useQuery({ queryKey: queryKeys.admin.supervisors, queryFn: ({ signal }) => api.get<Supervisor[]>(BASE.supervisor, { signal }) })
}

export function useOperatorAudit(operatorId: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.operatorAudit(operatorId ?? ''),
    queryFn: ({ signal }) => api.get<OperatorAuditLog[]>(`${BASE.operator}/${operatorId}/audit`, { signal }),
    enabled: !!operatorId,
  })
}

/* ---------------------------------------------------------------- mutations */

/** Everything that shows staff reads from one of these. */
function useRefreshStaff() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.all })
    void client.invalidateQueries({ queryKey: queryKeys.team.all })
    void client.invalidateQueries({ queryKey: queryKeys.inbox })
    void client.invalidateQueries({ queryKey: queryKeys.me })
  }
}

export function useSaveStaff(kind: StaffKind) {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: StaffInput }) =>
      id ? api.patch<StaffRecord>(`${BASE[kind]}/${id}`, input) : api.post<StaffRecord>(BASE[kind], input),
    onSuccess: refresh,
  })
}

export function useDeleteStaff(kind: StaffKind) {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string; requeued?: number }>(`${BASE[kind]}/${id}`),
    onSuccess: refresh,
  })
}

export function useForceStatus() {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) => api.post<Operator>(`${BASE.operator}/${id}/force-status`, { paused }),
    onSuccess: refresh,
  })
}

export function useForceLogout() {
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: (id: string) => api.post<Operator>(`${BASE.operator}/${id}/force-logout`),
    onSuccess: refresh,
  })
}

export function useEndOperatorChats() {
  const client = useQueryClient()
  const refresh = useRefreshStaff()
  return useMutation({
    mutationFn: (id: string) => api.post<{ ended: number; operator: Operator }>(`${BASE.operator}/${id}/end-chats`),
    onSuccess: () => {
      refresh()
      void client.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
