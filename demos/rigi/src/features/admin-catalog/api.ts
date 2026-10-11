/**
 * React Query hooks for the admin-catalog group. Every key starts with a
 * ChangedEntity, so the shell's bus listener refreshes these views after any
 * mutation anywhere in the app.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'

import { bus } from '@/demo'
import type { ChangedEntity } from '@/demo/events'
import { ApiError, http } from '@/lib/api'
import type { StaffRole, StaffUser, TaskTemplate, TechnicianType } from '@/types'
import type {
  AdminDashboard,
  PartnerCatalogueRow,
  TemplateDetail,
  TemplateListRow,
} from '@/demo/handlers/admin-catalog'

export type { AdminDashboard, PartnerCatalogueRow, TemplateDetail, TemplateListRow }

/* ------------------------------------------------------------ dashboard */

const DASHBOARD_SOURCES: ChangedEntity[] = ['partners', 'seats', 'partner-users', 'licenses', 'invoices', 'tasks', 'audit', 'dashboards']

export function useAdminDashboard() {
  const qc = useQueryClient()
  useEffect(
    () =>
      bus.on('changed', ({ entities }) => {
        if (entities.some((e) => DASHBOARD_SOURCES.includes(e))) void qc.invalidateQueries({ queryKey: ['dashboards', 'admin'] })
      }),
    [qc],
  )
  return useQuery({ queryKey: ['dashboards', 'admin'], queryFn: () => http.get<AdminDashboard>('/admin/dashboard') })
}

/* ------------------------------------------------------------ templates */

export interface TemplateFormValues {
  name: string
  description: string
  isFreeform: boolean
  defaultPoints: number | null
  isActive: boolean
}

export function useTaskTemplates(includeArchived = false) {
  return useQuery({
    queryKey: ['task-templates', 'list', { includeArchived }],
    queryFn: () => http.get<TemplateListRow[]>('/task-templates', { includeArchived: includeArchived ? 'true' : undefined }),
  })
}

export function useTaskTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['task-templates', 'detail', id],
    queryFn: () => http.get<TemplateDetail>(`/task-templates/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateTemplate() {
  return useMutation({ mutationFn: (v: TemplateFormValues) => http.post<TaskTemplate>('/task-templates', v) })
}

export function useUpdateTemplate(id: string) {
  return useMutation({ mutationFn: (v: Partial<TemplateFormValues>) => http.patch<TaskTemplate>(`/task-templates/${id}`, v) })
}

export function useDeleteTemplate(id: string) {
  return useMutation({ mutationFn: () => http.del<{ deleted: boolean; archived: boolean }>(`/task-templates/${id}`) })
}

export function useAddPartnerRate(id: string) {
  return useMutation({
    mutationFn: (v: { partnerId: string; points: number }) => http.post<{ ok: true }>(`/task-templates/${id}/partner-rates`, v),
  })
}

export function useRemovePartnerRate(id: string) {
  return useMutation({
    mutationFn: (partnerId: string) => http.del<{ ok: true }>(`/task-templates/${id}/partner-rates/${partnerId}`),
  })
}

/* --------------------------------------------------- partner catalogue */

export interface CatalogueOverrideInput {
  isHidden?: boolean
  nameOverride?: string | null
  descriptionOverride?: string | null
  points?: number | null
}

export function usePartnerCatalogue(partnerId: string) {
  return useQuery({
    queryKey: ['task-templates', 'partner', partnerId],
    queryFn: () => http.get<PartnerCatalogueRow[]>(`/partners/${partnerId}/task-templates`),
  })
}

export function useSaveCatalogueOverride(partnerId: string) {
  return useMutation({
    mutationFn: ({ templateId, ...v }: CatalogueOverrideInput & { templateId: string }) =>
      http.put<PartnerCatalogueRow[]>(`/partners/${partnerId}/task-templates/${templateId}`, v),
  })
}

export function useResetCatalogueOverride(partnerId: string) {
  return useMutation({
    mutationFn: (templateId: string) => http.del<PartnerCatalogueRow[]>(`/partners/${partnerId}/task-templates/${templateId}`),
  })
}

/* ---------------------------------------------------------------- users */

export interface StaffUserFormValues {
  email: string
  fullName: string
  fullNameKa: string
  role: StaffRole
  technicianType: TechnicianType | null
  password?: string
  isActive: boolean
}

export function useStaffUsers() {
  return useQuery({ queryKey: ['staff-users', 'list'], queryFn: () => http.get<StaffUser[]>('/users') })
}

export function useStaffUser(id: string | undefined) {
  return useQuery({
    queryKey: ['staff-users', 'detail', id],
    queryFn: () => http.get<StaffUser>(`/users/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateStaffUser() {
  return useMutation({ mutationFn: (v: StaffUserFormValues) => http.post<StaffUser>('/users', v) })
}

export function useUpdateStaffUser(id: string) {
  return useMutation({ mutationFn: (v: Partial<StaffUserFormValues>) => http.patch<StaffUser>(`/users/${id}`, v) })
}

export function useDeleteStaffUser() {
  return useMutation({ mutationFn: (id: string) => http.del<{ ok: true }>(`/users/${id}`) })
}

/* --------------------------------------------------------------- errors */

/** Translate a handler error code (`email_taken`, `last_superadmin`…) into this namespace's text. */
export function errorText(t: TFunction, code: string | undefined): string {
  if (!code) return t('errors.generic')
  return t(`errors.${code}`, { defaultValue: code })
}

export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) return errorText(t, error.message)
  return t('errors.generic')
}

/** Push server field errors into react-hook-form; returns true when any field claimed the error. */
export function applyFieldErrors(
  t: TFunction,
  error: unknown,
  setError: (name: never, e: { type: string; message: string }) => void,
): boolean {
  if (!(error instanceof ApiError)) return false
  const entries = Object.entries(error.fieldErrors)
  for (const [field, messages] of entries) {
    setError(field as never, { type: 'server', message: errorText(t, messages[0]) })
  }
  return entries.length > 0
}

/** Staff name in the current UI language (Georgian spelling when present). */
export function staffName(u: Pick<StaffUser, 'fullName' | 'fullNameKa'>, lang: string): string {
  return lang === 'ka' && u.fullNameKa ? u.fullNameKa : u.fullName
}
