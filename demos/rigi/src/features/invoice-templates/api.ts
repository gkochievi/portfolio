/**
 * Invoice templates: React Query hooks + DTOs. Every key starts with the
 * `invoice-templates` ChangedEntity, so the shell refetches after any change
 * (no manual invalidation needed).
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { http } from '@/lib/api'
import type { Currency, InvoiceTemplate, TemplateBlock, TemplateMode } from '@/types'

export interface TemplateRow {
  id: string
  name: string
  partnerId: string | null
  partnerName: string | null
  mode: TemplateMode
  isDefault: boolean
  hasSignature: boolean
  createdAt: string
  updatedAt: string
}

export interface PartnerOption {
  id: string
  name: string
  legalName: string
  currency: Currency
  isActive: boolean
}

/** The editable body shared by create, save and preview. */
export interface TemplateDraft {
  name: string
  partnerId: string | null
  mode: TemplateMode
  html: string
  css: string
  layout: TemplateBlock[]
  signatureDataUrl: string | null
}

export function useTemplates() {
  return useQuery({
    queryKey: ['invoice-templates', 'list'],
    queryFn: () => http.get<TemplateRow[]>('/invoice-templates'),
  })
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['invoice-templates', 'detail', id],
    queryFn: () => http.get<InvoiceTemplate>(`/invoice-templates/${id}`),
    enabled: Boolean(id),
    retry: false,
  })
}

/** Partners an accountant may scope a template to. */
export function usePartnerOptions() {
  return useQuery({
    queryKey: ['partners', 'invoice-template-options'],
    queryFn: () => http.get<PartnerOption[]>('/invoicing/partners'),
    staleTime: 30_000,
  })
}

export function useCreateTemplate() {
  return useMutation({
    mutationFn: (input: TemplateDraft & { isDefault?: boolean }) => http.post<InvoiceTemplate>('/invoice-templates', input),
  })
}

export function useSaveTemplate(id: string) {
  return useMutation({
    mutationFn: (input: TemplateDraft) => http.patch<InvoiceTemplate>(`/invoice-templates/${id}`, input),
  })
}

export function useDeleteTemplate() {
  return useMutation({
    mutationFn: (id: string) => http.del<{ ok: true }>(`/invoice-templates/${id}`),
  })
}

export function useSetDefaultTemplate() {
  return useMutation({
    mutationFn: (id: string) => http.post<InvoiceTemplate>(`/invoice-templates/${id}/default`),
  })
}

export function previewTemplate(draft: Pick<TemplateDraft, 'mode' | 'html' | 'css' | 'layout' | 'signatureDataUrl'>, lang: 'en' | 'ka') {
  return http.post<{ html: string }>('/invoice-templates/preview', { ...draft, lang })
}
