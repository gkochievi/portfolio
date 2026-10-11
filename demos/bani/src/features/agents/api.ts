/** Query hooks for the agents group. Keys all start with 'agents'. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import type { Agent, AgentUpdate, RosterApplyResult, RosterChange, SkillWithCount, Team } from '@/types'

export const agentKeys = {
  all: queryKeys.agents.all,
  list: [...queryKeys.agents.all, 'list'] as const,
  skills: [...queryKeys.agents.all, 'skills'] as const,
  teams: [...queryKeys.agents.all, 'teams'] as const,
}

export function useAgents() {
  return useQuery({
    queryKey: agentKeys.list,
    queryFn: ({ signal }) => http.get<Agent[]>('/cc/agents', undefined, signal),
  })
}

export function useSkills() {
  return useQuery({
    queryKey: agentKeys.skills,
    queryFn: ({ signal }) => http.get<SkillWithCount[]>('/cc/skills', undefined, signal),
  })
}

export function useTeams() {
  return useQuery({
    queryKey: agentKeys.teams,
    queryFn: ({ signal }) => http.get<Team[]>('/cc/teams', undefined, signal),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, update }: { userId: string; update: AgentUpdate }) =>
      http.put<Agent>(`/cc/agents/${encodeURIComponent(userId)}`, update),
    onSuccess: (agent) => {
      qc.setQueryData<Agent[]>(agentKeys.list, (prev) => prev?.map((a) => (a.userId === agent.userId ? agent : a)))
      void qc.invalidateQueries({ queryKey: agentKeys.all })
    },
  })
}

export function useApplyRoster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ skillId, changes }: { skillId: string; changes: RosterChange[] }) =>
      http.post<RosterApplyResult>(`/cc/skills/${encodeURIComponent(skillId)}/roster`, { changes }),
    onSuccess: (result, { skillId, changes }) => {
      // Reflect what the server did right away (failed agents keep their old level), then re-read.
      const failed = new Set(result.failed.map((f) => f.userId))
      qc.setQueryData<Agent[]>(agentKeys.list, (prev) =>
        prev?.map((a) => {
          const change = changes.find((c) => c.userId === a.userId)
          if (!change || failed.has(a.userId)) return a
          const next = { ...a.skillLevels }
          if (change.level === null) delete next[skillId]
          else next[skillId] = change.level
          return { ...a, skillLevels: next }
        }),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  })
}

export const agentName = (a: Pick<Agent, 'firstName' | 'lastName'>): string => `${a.firstName} ${a.lastName}`.trim()
