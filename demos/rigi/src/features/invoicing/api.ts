/**
 * Invoicing query hooks + DTOs. Owner: invoicing.
 * Every key starts with a ChangedEntity, so the shell's bus listener refreshes
 * these views whenever any group mutates invoices (dispute, payments...).
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { printHtml } from '@/features/invoice-templates/lib/print'
import { http } from '@/lib/api'
import type { Currency, Invoice, InvoiceDisplayStatus, InvoiceLineItem, InvoiceStatus, OutboxEmail } from '@/types'

/* ------------------------------------------------------------------ DTOs */

export interface InvoiceRow extends Invoice {
  partnerName: string
  displayStatus: InvoiceDisplayStatus
}

export interface PartnerOption {
  id: string
  name: string
  legalName: string
  currency: Currency
  isActive: boolean
}

export interface MoneyByCurrency {
  currency: Currency
  amount: number
}

export interface AccountantDashboard {
  activePartners: { value: number; trend: number[] }
  drafts: { value: number; trend: number[] }
  unpaid: { value: number; trend: number[]; byCurrency: MoneyByCurrency[] }
  revenue: { byCurrency: MoneyByCurrency[]; count: number; trend: number[] }
  queues: { drafts: InvoiceRow[]; overdue: InvoiceRow[]; recentlyPaid: InvoiceRow[] }
  counts: { drafts: number; overdue: number }
}

export interface TaskBilledRow {
  taskId: string
  number: number
  title: string
  finishedAt: string | null
  verifiedAt: string | null
  template: string | null
  points: number
  freePoints: number
  chargeablePoints: number
  rate: number
  amount: number
}

export interface TasksBilled {
  rows: TaskBilledRow[]
  totalPoints: number
  grossAmount: number
  freePoints: number
  freeDeductionAmount: number
  net: number
}

export interface InvoiceDetail {
  invoice: InvoiceRow
  lines: InvoiceLineItem[]
  tasksBilled: TasksBilled
  partner: {
    id: string
    name: string
    legalName: string
    currency: Currency
    billingEmail: string
    billingEmails: string[]
    contactEmail: string
    isActive: boolean
  } | null
  template: { id: string; name: string } | null
  outbox: OutboxEmail[]
}

export interface TemplateOption {
  id: string
  name: string
  partnerId: string | null
  isDefault: boolean
}

export interface InvoiceFilters {
  partnerId?: string
  year?: string
  month?: string
  status?: InvoiceStatus | ''
}

export interface LineInput {
  description: string
  quantity: number
  unitPrice: number
}

export interface GenerateInput {
  partnerId: string | null
  year: number
  month: number
  templateId: string | null
  allowDuplicate?: boolean
}

export interface AdhocInput {
  partnerId: string
  templateId: string | null
  title: string
  notes: string
  lines: LineInput[]
}

/* --------------------------------------------------------------- queries */

const clean = (filters: InvoiceFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string>

export function useAccountantDashboard() {
  return useQuery({
    queryKey: ['invoices', 'accountant-dashboard'],
    queryFn: () => http.get<AccountantDashboard>('/accountant/dashboard'),
  })
}

export function useInvoices(filters: InvoiceFilters, enabled = true) {
  const params = clean(filters)
  return useQuery({
    queryKey: ['invoices', 'list', params],
    queryFn: () => http.get<{ items: InvoiceRow[]; total: number }>('/invoices', params),
    enabled,
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'detail', id],
    queryFn: () => http.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
  })
}

export function usePartnerOptions() {
  return useQuery({
    queryKey: ['partners', 'invoicing-options'],
    queryFn: () => http.get<PartnerOption[]>('/invoicing/partners'),
    staleTime: 30_000,
  })
}

/** Global templates plus the chosen partner's. Tolerates either an array or `{items}`. */
export function useTemplateOptions(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: ['invoice-templates', 'options', partnerId ?? null],
    queryFn: async () => {
      const res = await http.get<unknown>('/invoice-templates', partnerId ? { partnerId } : undefined)
      const list = (Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? [])) as TemplateOption[]
      return list.filter((t) => t.partnerId === null || t.partnerId === partnerId)
    },
    enabled: !!partnerId,
    retry: false,
  })
}

/* ------------------------------------------------------------- mutations */
/* No manual invalidation: handlers emit `changed` and the shell refetches. */

export function useGenerateInvoices() {
  return useMutation({
    mutationFn: (input: GenerateInput) => http.post<InvoiceRow | { enqueued: number; skipped: number }>('/invoices/generate', input),
  })
}

export function useCreateAdhoc() {
  return useMutation({ mutationFn: (input: AdhocInput) => http.post<InvoiceRow>('/invoices/adhoc', input) })
}

export function usePatchInvoice(id: string) {
  return useMutation({
    mutationFn: (input: { vatInclusive?: boolean; notes?: string; templateId?: string | null }) => http.patch<InvoiceRow>(`/invoices/${id}`, input),
  })
}

export function useReplaceLines(id: string) {
  return useMutation({ mutationFn: (lines: LineInput[]) => http.put<InvoiceRow>(`/invoices/${id}/lines`, { lines }) })
}

export function useRegenerate(id: string) {
  return useMutation({ mutationFn: () => http.post<InvoiceRow>(`/invoices/${id}/regenerate`) })
}

export function useIssueInvoice(id: string) {
  return useMutation({
    mutationFn: (input: { issuedAt?: string; dueAt?: string }) => http.post<InvoiceRow>(`/invoices/${id}/issue`, input),
  })
}

export function useMarkPaid(id: string) {
  return useMutation({ mutationFn: (paidAt: string) => http.post<InvoiceRow>(`/invoices/${id}/mark-paid`, { paidAt }) })
}

export function useVoidInvoice(id: string) {
  return useMutation({ mutationFn: (reason: string) => http.post<InvoiceRow>(`/invoices/${id}/void`, { reason }) })
}

export function useEmailInvoice(id: string) {
  return useMutation({
    mutationFn: (input: { to: string[]; cc: string[] }) => http.post<OutboxEmail>(`/invoices/${id}/email`, input),
  })
}

export function useDownloadPdf(id: string) {
  return useMutation({
    mutationFn: async () => {
      const doc = await http.get<{ html: string; filename?: string }>(`/invoices/${id}/document`)
      printHtml(doc.html, doc.filename ?? 'Invoice')
      return doc
    },
  })
}
