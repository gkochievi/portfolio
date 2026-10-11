/**
 * Partners: React Query hooks + response DTOs. Every key starts with a
 * ChangedEntity, so the shell's bus listener refetches after any mutation.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { http } from '@/lib/api'
import type {
  ApiKeyScope,
  Currency,
  LicenseKind,
  Partner,
  PartnerAdmin,
  PartnerApiKey,
  PartnerDocument,
  PartnerRateHistory,
  DocumentKind,
} from '@/types'

import type {
  ApiKeyInput,
  DocumentUploadInput,
  DocumentVersionInput,
  PartnerCreateInput,
  PartnerUpdateInput,
  PortalAdminInput,
  RateInput,
} from './lib/schema'

/* ----------------------------------------------------------------- DTOs */

export type PartnerStatusFilter = 'all' | 'active' | 'inactive'

export interface PartnerRow {
  id: string
  name: string
  legalName: string
  city: string
  currency: Currency
  ratePerPoint: number
  freeMonthlyAllowance: number
  isActive: boolean
  contractEndOn: string | null
}

export interface PartnerListResponse {
  items: PartnerRow[]
  total: number
}

export interface PartnerOption {
  id: string
  name: string
  currency: Currency
  isActive: boolean
}

export interface LicenseSummaryRow {
  license: { id: string; code: string; name: string; kind: LicenseKind; isActive: boolean }
  unitPrice: number
  isOverride: boolean
  seats: number
  taggedUsers: number
  monthlyCost: number
}

export interface LicenseSummary {
  rows: LicenseSummaryRow[]
  totals: { seats: number; perUserSeats: number; taggedUsers: number; monthlyCost: number }
  unassignedCount: number
  activeUsers: number
  billedUsers: number
}

export type ContractExpiryState = 'none' | 'ok' | 'expiring' | 'expired'

export interface PartnerDetail extends Partner {
  licenseSummary: LicenseSummary
  contractExpiry: { state: ContractExpiryState; daysLeft: number | null }
}

export interface PartnerRatesResponse {
  current: { ratePerPoint: number; freeAllowance: number; effectiveFrom: string | null }
  history: PartnerRateHistory[]
}

export interface DocumentGroup {
  kind: DocumentKind
  documents: PartnerDocument[]
}

export interface ApiKeyCreated {
  key: PartnerApiKey
  secret: string
}

export type { PartnerAdmin, PartnerApiKey, ApiKeyScope }

/* -------------------------------------------------------------- queries */

export function usePartners(filters: { q: string; status: PartnerStatusFilter }) {
  return useQuery({
    queryKey: ['partners', 'list', filters],
    queryFn: ({ signal }) =>
      http.get<PartnerListResponse>('/partners', { q: filters.q || undefined, status: filters.status }, signal),
    placeholderData: keepPreviousData,
  })
}

export function usePartnerOptions() {
  return useQuery({
    queryKey: ['partners', 'options'],
    queryFn: ({ signal }) => http.get<PartnerOption[]>('/partners/options', undefined, signal),
  })
}

export function usePartner(id: string | undefined) {
  return useQuery({
    queryKey: ['partners', 'detail', id],
    queryFn: ({ signal }) => http.get<PartnerDetail>(`/partners/${id}`, undefined, signal),
    enabled: Boolean(id),
  })
}

export function usePartnerRates(id: string) {
  return useQuery({
    queryKey: ['partner-rates', id],
    queryFn: ({ signal }) => http.get<PartnerRatesResponse>(`/partners/${id}/rates`, undefined, signal),
  })
}

export function usePartnerDocuments(id: string) {
  return useQuery({
    queryKey: ['documents', 'partner', id],
    queryFn: ({ signal }) => http.get<DocumentGroup[]>(`/partners/${id}/documents`, undefined, signal),
  })
}

export function usePartnerApiKeys(id: string) {
  return useQuery({
    queryKey: ['api-keys', 'partner', id],
    queryFn: ({ signal }) => http.get<PartnerApiKey[]>(`/partners/${id}/api-keys`, undefined, signal),
  })
}

export function usePartnerAdmins(id: string) {
  return useQuery({
    queryKey: ['portal-admins', id],
    queryFn: ({ signal }) => http.get<PartnerAdmin[]>(`/partners/${id}/admins`, undefined, signal),
  })
}

/* ------------------------------------------------------------ mutations */

export function useCreatePartner() {
  return useMutation({ mutationFn: (input: PartnerCreateInput) => http.post<Partner>('/partners', input) })
}

export function useUpdatePartner(id: string) {
  return useMutation({ mutationFn: (input: PartnerUpdateInput) => http.patch<Partner>(`/partners/${id}`, input) })
}

export function useSetPartnerActive(id: string) {
  return useMutation({
    mutationFn: ({ active, password }: { active: boolean; password: string }) =>
      http.post<Partner>(`/partners/${id}/${active ? 'activate' : 'deactivate'}`, { password }),
  })
}

export function useDeletePartner(id: string) {
  return useMutation({ mutationFn: (password: string) => http.del<{ ok: true }>(`/partners/${id}`, { password }) })
}

export function useAddRate(id: string) {
  return useMutation({ mutationFn: (input: RateInput) => http.post<PartnerRateHistory>(`/partners/${id}/rates`, input) })
}

export function useUploadDocument(id: string) {
  return useMutation({
    mutationFn: (input: DocumentUploadInput) => http.post<PartnerDocument>(`/partners/${id}/documents`, input),
  })
}

export function useUploadVersion(id: string) {
  return useMutation({
    mutationFn: ({ docId, ...input }: DocumentVersionInput & { docId: string }) =>
      http.post<PartnerDocument>(`/partners/${id}/documents/${docId}/versions`, input),
  })
}

export function useDeleteDocument(id: string) {
  return useMutation({ mutationFn: (docId: string) => http.del<{ ok: true }>(`/partners/${id}/documents/${docId}`) })
}

export function useCreateApiKey(id: string) {
  return useMutation({ mutationFn: (input: ApiKeyInput) => http.post<ApiKeyCreated>(`/partners/${id}/api-keys`, input) })
}

export function useCreatePortalAdmin(id: string) {
  return useMutation({
    mutationFn: (input: PortalAdminInput) => http.post<PartnerAdmin>(`/partners/${id}/admins`, input),
  })
}

export function useSetPortalAdminActive(id: string) {
  return useMutation({
    mutationFn: ({ adminId, isActive }: { adminId: string; isActive: boolean }) =>
      http.patch<PartnerAdmin>(`/partners/${id}/admins/${adminId}`, { isActive }),
  })
}
