/** Query hooks for the people group. Keys all start with 'people'. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import type {
  Campaign,
  ConsoleUser,
  CreateUserRequest,
  CreateUserResponse,
  DirectoryEntry,
  LdapRoleMappingConfig,
  UpdateUserRequest,
} from '@/types'

export const peopleKeys = {
  all: queryKeys.people.all,
  users: [...queryKeys.people.all, 'users'] as const,
  directory: (search: string) => [...queryKeys.people.all, 'directory', search] as const,
  mappings: [...queryKeys.people.all, 'role-mappings'] as const,
  campaigns: [...queryKeys.people.all, 'campaigns'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: peopleKeys.users,
    queryFn: ({ signal }) => http.get<ConsoleUser[]>('/users', undefined, signal),
  })
}

export function useDirectory(search: string, enabled = true) {
  return useQuery({
    queryKey: peopleKeys.directory(search),
    queryFn: ({ signal }) => http.get<DirectoryEntry[]>('/directory', { search: search || undefined }, signal),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCampaignOptions(enabled: boolean) {
  return useQuery({
    queryKey: peopleKeys.campaigns,
    queryFn: ({ signal }) => http.get<Campaign[]>('/cc/campaigns', undefined, signal),
    enabled,
    staleTime: 60_000,
    select: (campaigns) => campaigns.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
  })
}

export function useRoleMappings() {
  return useQuery({
    queryKey: peopleKeys.mappings,
    queryFn: ({ signal }) => http.get<LdapRoleMappingConfig>('/directory/role-mappings', undefined, signal),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserRequest) => http.post<CreateUserResponse>('/users', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: UpdateUserRequest }) =>
      http.patch<ConsoleUser>(`/users/${encodeURIComponent(id)}`, update),
    onSuccess: (user) => {
      qc.setQueryData<ConsoleUser[]>(peopleKeys.users, (prev) => prev?.map((u) => (u.id === user.id ? user : u)))
      void qc.invalidateQueries({ queryKey: peopleKeys.all })
    },
  })
}

export function useRegeneratePassword() {
  return useMutation({
    mutationFn: (id: string) => http.post<{ password: string }>(`/users/${encodeURIComponent(id)}/password`),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.del<void>(`/users/${encodeURIComponent(id)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useSaveRoleMappings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: LdapRoleMappingConfig) => http.put<LdapRoleMappingConfig>('/directory/role-mappings', config),
    onSuccess: (saved) => {
      qc.setQueryData(peopleKeys.mappings, saved)
      void qc.invalidateQueries({ queryKey: peopleKeys.all })
    },
  })
}
