/**
 * Partner portal (work): React Query hooks + DTOs. Every key starts with a
 * ChangedEntity so the shell refetches after any mutation in any group.
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import type { PartnerDocument, TaskMessage } from '@/types'

import type {
  PortalCatalogueItem,
  PortalLinkedEmail,
  PortalHistoryRow,
  PortalProjectDetail,
  PortalProjectRow,
  PortalTaskDetail,
  PortalTaskRow,
  PortalVerifyPreview,
} from '@/demo/handlers/portal'

export type {
  PortalCatalogueItem,
  PortalLinkedEmail,
  PortalHistoryRow,
  PortalProjectDetail,
  PortalProjectRow,
  PortalTaskDetail,
  PortalTaskRow,
  PortalVerifyPreview,
}

export interface NewTaskInput {
  templateId: string
  title: string
  description: string
  /** `YYYY-MM-DD`, stored as 23:59:59. */
  deadline: string | null
}

export interface TaskPatchInput {
  title?: string
  description?: string
  deadline?: string | null
}

export interface NewProjectInput {
  name: string
  description: string
}

/* ----------------------------------------------------------------- reads */

export function usePortalTasks() {
  return useQuery({ queryKey: queryKeys.tasks.portalList(), queryFn: () => http.get<PortalTaskRow[]>('/portal/tasks') })
}

export function usePortalCatalogue() {
  return useQuery({ queryKey: queryKeys.taskTemplates.portal(), queryFn: () => http.get<PortalCatalogueItem[]>('/portal/task-templates') })
}

export function usePortalTask(id: string) {
  return useQuery({ queryKey: queryKeys.tasks.portalDetail(id), queryFn: () => http.get<PortalTaskDetail>(`/portal/tasks/${id}`) })
}

export function usePortalProjects() {
  return useQuery({ queryKey: queryKeys.projects.portalList(), queryFn: () => http.get<PortalProjectRow[]>('/portal/projects') })
}

export function usePortalProject(id: string) {
  return useQuery({ queryKey: queryKeys.projects.portalDetail(id), queryFn: () => http.get<PortalProjectDetail>(`/portal/projects/${id}`) })
}

export function usePortalDocuments() {
  return useQuery({ queryKey: queryKeys.documents.portal(), queryFn: () => http.get<PartnerDocument[]>('/portal/documents') })
}

/* ------------------------------------------------------------- mutations */
/* Handlers emit `changed`, which refetches every dependent query. */

export function useCreatePortalTask() {
  return useMutation({ mutationFn: (input: NewTaskInput) => http.post<PortalTaskDetail>('/portal/tasks', input) })
}

export function useUpdatePortalTask(id: string) {
  return useMutation({ mutationFn: (patch: TaskPatchInput) => http.patch<PortalTaskDetail>(`/portal/tasks/${id}`, patch) })
}

export function useCancelPortalTask(id: string) {
  return useMutation({ mutationFn: (note: string) => http.post<PortalTaskDetail>(`/portal/tasks/${id}/cancel`, { note }) })
}

export function useVerifyPortalTask(id: string) {
  return useMutation({ mutationFn: () => http.post<PortalTaskDetail>(`/portal/tasks/${id}/verify`) })
}

export function useSendBackPortalTask(id: string) {
  return useMutation({ mutationFn: (comment: string) => http.post<PortalTaskDetail>(`/portal/tasks/${id}/send-back`, { comment }) })
}

export function useCreatePortalProject() {
  return useMutation({ mutationFn: (input: NewProjectInput) => http.post<PortalProjectRow>('/portal/projects', input) })
}

export type { TaskMessage }
