/**
 * React Query hooks and response types for the tasks group. Owner: tasks.
 * Every query key starts with a ChangedEntity so the shell refetches it when a
 * handler emits `changed`; mutations therefore need no manual invalidation.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { errorMessage, fieldErrorsOf } from '@/api/client'
import { http } from '@/lib/api'
import type { ID, ISODateTime, MailStatus, TaskMessage, TaskState, TaskStateChange, TechnicianType } from '@/types'

export { errorMessage, fieldErrorsOf }

/* ------------------------------------------------------------------- types */

export interface AssigneeDto {
  id: ID
  fullName: string
  fullNameKa: string
  technicianType: TechnicianType | null
  assignedAt: ISODateTime
}

export interface TechnicianDto {
  id: ID
  fullName: string
  fullNameKa: string
  technicianType: TechnicianType | null
}

export interface TemplateOption {
  id: ID
  code: string
  name: string
  description: string
  defaultPoints: number | null
  isFreeform: boolean
}

export interface TaskRow {
  id: ID
  number: number
  title: string
  state: TaskState
  partnerId: ID | null
  partnerName: string | null
  templateId: ID | null
  projectId: ID | null
  points: number | null
  pricingPending: boolean
  deadline: ISODateTime | null
  isOverdue: boolean
  hasNewReplies: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
  finishedAt: ISODateTime | null
  assignees: AssigneeDto[]
  mailCount: number
  threadCount: number
}

export interface TaskListResponse {
  rows: TaskRow[]
  total: number
}

export interface TaskFilters {
  state?: string
  partnerId?: string
  q?: string
  mine?: boolean
  tab?: 'mine' | 'unassigned' | 'all'
}

export interface LinkedMail {
  id: ID
  threadId: ID
  subject: string
  fromName: string
  fromAddr: string
  receivedAt: ISODateTime
  status: MailStatus
  linkedAt: ISODateTime
}

export interface LinkedThread {
  id: ID
  subject: string
  messageCount: number
  lastMessageAt: ISODateTime
  status: MailStatus
  linkedAt: ISODateTime
}

export interface TaskHistoryDto extends TaskStateChange {
  changedByNameKa: string | null
}

export interface TaskDetail extends TaskRow {
  description: string
  verifiedAt: ISODateTime | null
  createdBy: { kind: 'staff' | 'partner'; name: string; nameKa: string | null } | null
  template: { id: ID; name: string; isFreeform: boolean } | null
  project: { id: ID; number: number; name: string } | null
  allowedTransitions: TaskState[]
  /** -> finished is hidden from allowedTransitions while the price is pending; show it disabled. */
  finishBlocked: boolean
  mails: LinkedMail[]
  threads: LinkedThread[]
  history: TaskHistoryDto[]
}

export interface TaskDashboard {
  technicianType: TechnicianType | null
  myOpen: number
  finishedThisMonth: number
  unassigned: number
  allOpen: number
  trends: { myOpen: number[]; finishedThisMonth: number[]; unassigned: number[]; allOpen: number[] }
  plate: TaskRow[]
}

export interface TaskMessageDto extends TaskMessage {
  authorNameKa: string | null
}

export interface MailLite {
  id: ID
  threadId: ID
  subject: string
  fromName: string
  fromAddr: string
  receivedAt: ISODateTime
  status: MailStatus
  partnerName: string | null
}

export interface ThreadLite {
  id: ID
  subject: string
  messageCount: number
  lastMessageAt: ISODateTime
  latestFromName: string
  status: MailStatus
}

export interface CreateTaskInput {
  templateId?: string | null
  title: string
  partnerId: string | null
  points?: number | null
  description: string
  deadline?: string | null
  assigneeIds: string[]
  mailIds: string[]
  threadId?: string | null
}

export interface UpdateTaskInput {
  title?: string
  partnerId?: string | null
  description?: string
  deadline?: string | null
  points?: number | null
}

interface Paged<T> {
  rows: T[]
  total: number
}

/* ---------------------------------------------------------------- queries */

function clean(filters: TaskFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (filters.state && filters.state !== 'all') out.state = filters.state
  if (filters.partnerId && filters.partnerId !== 'all') out.partnerId = filters.partnerId
  if (filters.q) out.q = filters.q
  if (filters.mine) out.mine = 'true'
  if (filters.tab) out.tab = filters.tab
  return out
}

export const useTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: ['tasks', 'list', filters],
    queryFn: ({ signal }) => http.get<TaskListResponse>('/tasks', clean(filters), signal),
    placeholderData: keepPreviousData,
  })

export const useTask = (id: string) =>
  useQuery({ queryKey: ['tasks', 'detail', id], queryFn: ({ signal }) => http.get<TaskDetail>(`/tasks/${id}`, undefined, signal) })

export const useTechnicianDashboard = () =>
  useQuery({ queryKey: ['dashboards', 'technician'], queryFn: ({ signal }) => http.get<TaskDashboard>('/technician/dashboard', undefined, signal) })

export const useTechnicians = () =>
  useQuery({ queryKey: ['staff-users', 'technicians'], queryFn: ({ signal }) => http.get<TechnicianDto[]>('/technicians', undefined, signal) })

export const useTaskTemplates = () =>
  useQuery({ queryKey: ['task-templates', 'create-form'], queryFn: ({ signal }) => http.get<TemplateOption[]>('/tasks/templates', undefined, signal) })

/** Latest mails for the create form's checkbox list. */
export const useRecentMails = () =>
  useQuery({
    queryKey: ['mails', 'list', { source: 'task-create' }],
    queryFn: async ({ signal }) => (await http.get<Paged<MailLite>>('/mails', { pageSize: 15, sort: 'receivedAt', dir: 'desc' }, signal)).rows,
  })

export const useMailLite = (id: string | null) =>
  useQuery({
    queryKey: ['mails', 'detail', id, 'task-lite'],
    enabled: Boolean(id),
    queryFn: async ({ signal }): Promise<MailLite> => {
      const res = await http.get<{ mail: Omit<MailLite, 'partnerName'> }>(`/mails/${id}`, undefined, signal)
      const m = res.mail
      return { id: m.id, threadId: m.threadId, subject: m.subject, fromName: m.fromName, fromAddr: m.fromAddr, receivedAt: m.receivedAt, status: m.status, partnerName: null }
    },
  })

export const useThreadLite = (id: string | null) =>
  useQuery({
    queryKey: ['threads', 'detail', id, 'task-lite'],
    enabled: Boolean(id),
    queryFn: async ({ signal }): Promise<ThreadLite> => (await http.get<{ thread: ThreadLite }>(`/threads/${id}`, undefined, signal)).thread,
  })

/** Debounced mail search for linking (>= 2 characters). */
export const useMailSearch = (q: string) =>
  useQuery({
    queryKey: ['mails', 'list', { source: 'task-link', q }],
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => (await http.get<Paged<MailLite>>('/mails', { q: q.trim(), pageSize: 20 }, signal)).rows,
  })

export const useThreadSearch = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ['threads', 'list', { source: 'task-link', q }],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => (await http.get<Paged<ThreadLite>>('/threads', { q: q.trim() || undefined, pageSize: 20 }, signal)).rows,
  })

export const useTaskMessages = (taskId: string, realm: 'staff' | 'partner') =>
  useQuery({
    queryKey: ['task-messages', taskId, realm],
    queryFn: ({ signal }) =>
      http.get<TaskMessageDto[]>(realm === 'staff' ? `/tasks/${taskId}/messages` : `/portal/tasks/${taskId}/messages`, undefined, signal),
  })

/* -------------------------------------------------------------- mutations */

export const useCreateTask = () => useMutation({ mutationFn: (input: CreateTaskInput) => http.post<TaskDetail>('/tasks', input) })

export function useTaskActions(id: string) {
  return {
    update: useMutation({ mutationFn: (input: UpdateTaskInput) => http.patch<TaskDetail>(`/tasks/${id}`, input) }),
    transition: useMutation({ mutationFn: (input: { to: TaskState; note?: string }) => http.post<TaskDetail>(`/tasks/${id}/transition`, input) }),
    addAssignee: useMutation({ mutationFn: (userId: string) => http.post<TaskDetail>(`/tasks/${id}/assignees`, { userId }) }),
    removeAssignee: useMutation({ mutationFn: (userId: string) => http.del<TaskDetail>(`/tasks/${id}/assignees/${userId}`) }),
    selfAssign: useMutation({ mutationFn: () => http.post<TaskDetail>(`/tasks/${id}/self-assign`) }),
    linkMail: useMutation({ mutationFn: (mailId: string) => http.post<TaskDetail>(`/tasks/${id}/mails`, { mailId }) }),
    unlinkMail: useMutation({ mutationFn: (mailId: string) => http.del<TaskDetail>(`/tasks/${id}/mails/${mailId}`) }),
    linkThread: useMutation({ mutationFn: (threadId: string) => http.post<TaskDetail>(`/tasks/${id}/threads`, { threadId }) }),
    unlinkThread: useMutation({ mutationFn: (threadId: string) => http.del<TaskDetail>(`/tasks/${id}/threads/${threadId}`) }),
  }
}

export const useSendTaskMessage = (taskId: string, realm: 'staff' | 'partner') =>
  useMutation({
    mutationFn: (input: { body: string; internalOnly?: boolean }) =>
      realm === 'staff'
        ? http.post<TaskMessageDto>(`/tasks/${taskId}/messages`, input)
        : http.post<TaskMessageDto>(`/portal/tasks/${taskId}/messages`, { body: input.body }),
  })
