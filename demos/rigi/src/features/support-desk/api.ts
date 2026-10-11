/**
 * Support desk: React Query hooks + response DTOs. Every key starts with a
 * ChangedEntity, so the shell refetches after any mutation or simulator tick.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { ApiError, http } from '@/lib/api'
import type { Attachment, Currency, ID, ISODateTime, Mail, MailStatus, Project, TaskState } from '@/types'

/* ------------------------------------------------------------------- types */

export interface TaskLite {
  id: ID
  number: number
  title: string
  state: TaskState
  points: number | null
  partnerId: ID | null
  partnerName: string | null
  projectId: ID | null
  hasNewReplies: boolean
  deadline: ISODateTime | null
  linkedAt: ISODateTime | null
}

export interface PartnerLite {
  id: ID
  name: string
  currency: Currency
}

export interface ThreadRow {
  id: ID
  subject: string
  preview: string
  latestMailId: ID | null
  latestFromName: string
  latestFromAddr: string
  participantCount: number
  messageCount: number
  hasAttachments: boolean
  firstMessageAt: ISODateTime
  lastMessageAt: ISODateTime
  status: MailStatus
  partnerId: ID | null
  partnerName: string | null
  linkedTaskCount: number
}

export interface MailRow {
  id: ID
  threadId: ID
  subject: string
  preview: string
  fromName: string
  fromAddr: string
  receivedAt: ISODateTime
  status: MailStatus
  hasAttachments: boolean
  partnerId: ID | null
  partnerName: string | null
}

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export interface InboxFilters {
  status?: MailStatus | ''
  q?: string
  from?: string
  since?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
}

export interface L1Dashboard {
  newMails: number
  triagedMails: number
  followups: number
  openTasks: number
  myAssigned: number
  newReplies: number
  openProjects: number
  pendingInbox: number
  trends: { newMails: number[]; triagedMails: number[]; openTasks: number[]; myAssigned: number[] }
  nextUp: ThreadRow[]
}

export interface MailDetail {
  mail: Mail
  attachments: Attachment[]
  linkedTasks: TaskLite[]
  thread: { id: ID; subject: string; messageCount: number; status: MailStatus } | null
  partner: PartnerLite | null
  raw: string
}

export interface ThreadMailDto extends Mail {
  attachments: Attachment[]
}

export interface ThreadDetail {
  thread: ThreadRow
  participants: string[]
  mails: ThreadMailDto[]
  linkedTasks: TaskLite[]
  partner: PartnerLite | null
}

export interface ProjectRow extends Project {
  partnerName: string
  currency: Currency
  taskCount: number
}

export interface ProjectList {
  rows: ProjectRow[]
  partners: PartnerLite[]
}

export interface ProjectDetail {
  project: ProjectRow
  partner: PartnerLite | null
  tasks: TaskLite[]
  candidates: TaskLite[]
  billedInvoice: { id: ID; invoiceNumber?: string } | null
}

export interface PollResult {
  ingested: number
  skipped: number
  remaining: number
  mailIds: ID[]
}

/* ----------------------------------------------------------------- helpers */

export function clean<T extends object>(filters: T): Record<string, string | number> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number>
}

/** First message per field from a mock validation error. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(error.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? '']))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/* ------------------------------------------------------------------ queries */

export const useL1Dashboard = () =>
  useQuery({ queryKey: ['dashboards', 'l1'], queryFn: () => http.get<L1Dashboard>('/l1/dashboard') })

export const useThreads = (filters: InboxFilters, enabled = true) =>
  useQuery({
    queryKey: ['threads', 'list', filters],
    queryFn: () => http.get<Paged<ThreadRow>>('/threads', clean(filters)),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useMails = (filters: InboxFilters, enabled = true) =>
  useQuery({
    queryKey: ['mails', 'list', filters],
    queryFn: () => http.get<Paged<MailRow>>('/mails', clean(filters)),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useMail = (id: string) => useQuery({ queryKey: ['mails', 'detail', id], queryFn: () => http.get<MailDetail>(`/mails/${id}`) })

export const useThread = (id: string) =>
  useQuery({ queryKey: ['threads', 'detail', id], queryFn: () => http.get<ThreadDetail>(`/threads/${id}`) })

export const useProjects = () => useQuery({ queryKey: ['projects', 'list'], queryFn: () => http.get<ProjectList>('/projects') })

export const useProject = (id: string) =>
  useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => http.get<ProjectDetail>(`/projects/${id}`) })

/** Task picker: GET /api/tasks?q=. Tolerates an array, `{rows}` or `{items}` response. */
export function useTaskSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['tasks', 'search', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TaskLite[]> => {
      const res = await http.get<unknown>('/tasks', clean({ q }))
      const list = Array.isArray(res)
        ? res
        : ((res as { rows?: unknown[]; items?: unknown[] } | null)?.rows ?? (res as { items?: unknown[] } | null)?.items ?? [])
      return (list as Partial<TaskLite>[]).map((r) => ({
        id: String(r.id),
        number: Number(r.number ?? 0),
        title: String(r.title ?? ''),
        state: (r.state ?? 'accepted') as TaskState,
        points: r.points ?? null,
        partnerId: r.partnerId ?? null,
        partnerName: r.partnerName ?? null,
        projectId: r.projectId ?? null,
        hasNewReplies: Boolean(r.hasNewReplies),
        deadline: r.deadline ?? null,
        linkedAt: null,
      }))
    },
  })
}

/* ---------------------------------------------------------------- mutations */

export const useIgnoreMail = () => useMutation({ mutationFn: (id: string) => http.post<MailRow>(`/mails/${id}/ignore`) })
export const useTriageMail = () => useMutation({ mutationFn: (id: string) => http.post<MailRow>(`/mails/${id}/triage`) })
export const usePollNow = () => useMutation({ mutationFn: () => http.post<PollResult>('/mail/poll') })

export const useLinkThreadTask = (threadId: string) =>
  useMutation({ mutationFn: (taskId: string) => http.post<{ ok: true }>(`/threads/${threadId}/tasks`, { taskId }) })
export const useUnlinkThreadTask = (threadId: string) =>
  useMutation({ mutationFn: (taskId: string) => http.del<void>(`/threads/${threadId}/tasks/${taskId}`) })

export interface CreateProjectInput {
  partnerId: string
  name: string
  description: string
  price: number | null
}
export const useCreateProject = () => useMutation({ mutationFn: (input: CreateProjectInput) => http.post<ProjectRow>('/projects', input) })

export function useProjectActions(id: string) {
  return {
    update: useMutation({ mutationFn: (b: { name: string; description: string }) => http.patch<ProjectDetail>(`/projects/${id}`, b) }),
    addTask: useMutation({ mutationFn: (taskId: string) => http.post<ProjectDetail>(`/projects/${id}/tasks`, { taskId }) }),
    removeTask: useMutation({ mutationFn: (taskId: string) => http.del<void>(`/projects/${id}/tasks/${taskId}`) }),
    setPrice: useMutation({ mutationFn: (price: number) => http.post<ProjectDetail>(`/projects/${id}/price`, { price }) }),
    complete: useMutation({
      mutationFn: (b: { finalPrice: number; adjustNote: string }) => http.post<ProjectDetail>(`/projects/${id}/complete`, b),
    }),
    cancel: useMutation({ mutationFn: () => http.post<ProjectDetail>(`/projects/${id}/cancel`) }),
  }
}
