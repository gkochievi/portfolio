/** React Query hooks + DTOs for the licensing group. Every key starts with a ChangedEntity. */
import { useMutation, useQuery } from '@tanstack/react-query'

import { http } from '@/lib/api'
import type {
  Currency,
  InvoiceDisplayStatus,
  InvoiceKind,
  InvoiceStatus,
  License,
  LicenseKind,
  PartnerApiKey,
  PartnerUser,
  SeatAllocation,
} from '@/types'

/* ---------------------------------------------------------------- DTOs */

export interface LicenseRow extends License {
  seatsAllocated: number
}

export interface LicenseInput {
  name: string
  kind: LicenseKind
  unitPrice: number
  currency: Currency
  isActive: boolean
}

export interface SeatRow {
  licenseId: string
  name: string
  code: string
  kind: LicenseKind
  isActive: boolean
  unitPrice: number
  catalogPrice: number
  isOverride: boolean
  seats: number
  taggedUsers: number
  monthlyCost: number
}

export interface SeatHistoryRow extends SeatAllocation {
  licenseName: string
  licenseCode: string
}

export interface SeatsResponse {
  currency: Currency
  rows: SeatRow[]
  totals: { seats: number; perUserSeats: number; taggedUsers: number; monthlyCost: number }
  unassignedCount: number
  activeUsers: number
  billedUsers: number
  history: SeatHistoryRow[]
}

export interface OverrideRow {
  licenseId: string
  name: string
  code: string
  kind: LicenseKind
  isActive: boolean
  defaultPrice: number
  override: number | null
}

export interface PartnerUserRow extends PartnerUser {
  licenseName: string | null
  licenseCode: string | null
}

export interface MapperCard {
  licenseId: string
  name: string
  code: string
  isActive: boolean
  seats: number
  used: number
  unitPrice: number
  users: PartnerUserRow[]
}

export interface MapperResponse {
  currency: Currency
  licenses: MapperCard[]
  unmapped: PartnerUserRow[]
  addons: Array<{ licenseId: string; name: string; code: string; seats: number; unitPrice: number }>
}

export interface ApiKeyRow extends PartnerApiKey {
  partnerName: string
}

export interface AccountantInvoiceRow {
  id: string
  invoiceNumber: string
  kind: InvoiceKind
  title: string | null
  periodYear: number
  periodMonth: number
  status: InvoiceStatus
  displayStatus: InvoiceDisplayStatus
  currency: Currency
  total: number
  issuedAt: string | null
  dueAt: string | null
  paidAt: string | null
}

export interface AccountantPartnerProfile {
  partner: {
    id: string
    name: string
    legalName: string
    currency: Currency
    isActive: boolean
    companyId: string
    billingEmail: string
    invoiceGenerationDay: number
  }
  rateCard: { ratePerPoint: number; freeAllowance: number; effectiveFrom: string | null }
  users: { latest: number | null; day: string | null; history: number[]; active: number; billed: number }
  points: {
    year: number
    month: number
    allowance: number
    freeUsed: number
    freeUsedPct: number
    chargeablePoints: number
    chargeableAmount: number
    remaining: number
    adjustments: number
    usedPoints: number
    ratePerPoint: number
  }
  license: {
    rows: Array<{
      licenseId: string
      name: string
      code: string
      kind: LicenseKind
      seats: number
      taggedUsers: number
      unitPrice: number
      monthlyCost: number
      isOverride: boolean
    }>
    totals: { seats: number; perUserSeats: number; taggedUsers: number; monthlyCost: number }
    unassignedCount: number
  }
  invoices: AccountantInvoiceRow[]
}

/* ------------------------------------------------------------- catalog */

export function useLicenses() {
  return useQuery({ queryKey: ['licenses', 'list'], queryFn: () => http.get<LicenseRow[]>('/licenses') })
}

export function useCreateLicense() {
  return useMutation({ mutationFn: (input: LicenseInput) => http.post<License>('/licenses', input) })
}

export function useUpdateLicense() {
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<LicenseInput> & { id: string }) => http.patch<License>(`/licenses/${id}`, input),
  })
}

export function useDeleteLicense() {
  return useMutation({ mutationFn: (id: string) => http.del<{ ok: true }>(`/licenses/${id}`) })
}

/* --------------------------------------------------- seats + overrides */

export function useSeats(partnerId: string) {
  return useQuery({ queryKey: ['seats', partnerId], queryFn: () => http.get<SeatsResponse>(`/partners/${partnerId}/seats`) })
}

export function useSetSeats(partnerId: string) {
  return useMutation({
    mutationFn: (input: { licenseId: string; quantity: number; effectiveFrom: string; note: string }) =>
      http.post<{ from: number; to: number; delta: number }>(`/partners/${partnerId}/seats`, input),
  })
}

export function useOverrides(partnerId: string) {
  return useQuery({
    queryKey: ['seats', partnerId, 'overrides'],
    queryFn: () => http.get<OverrideRow[]>(`/partners/${partnerId}/license-overrides`),
  })
}

export function useSaveOverride(partnerId: string) {
  return useMutation({
    mutationFn: ({ licenseId, unitPrice }: { licenseId: string; unitPrice: number }) =>
      http.put(`/partners/${partnerId}/license-overrides/${licenseId}`, { unitPrice }),
  })
}

export function useClearOverride(partnerId: string) {
  return useMutation({ mutationFn: (licenseId: string) => http.del(`/partners/${partnerId}/license-overrides/${licenseId}`) })
}

/* -------------------------------------------------------------- mapper */

export function useMapper(partnerId: string) {
  return useQuery({
    queryKey: ['partner-users', partnerId, 'mapper'],
    queryFn: () => http.get<MapperResponse>(`/partners/${partnerId}/mapper`),
  })
}

export function useAssignUser(partnerId: string) {
  return useMutation({
    mutationFn: (input: { userId: string; licenseId: string }) => http.post<PartnerUserRow>(`/partners/${partnerId}/mapper/assign`, input),
  })
}

export function useUnmapUser(partnerId: string) {
  return useMutation({ mutationFn: (userId: string) => http.post<PartnerUserRow>(`/partners/${partnerId}/mapper/unmap`, { userId }) })
}

export function useSwapUsers(partnerId: string) {
  return useMutation({
    mutationFn: (input: { userIdA: string; userIdB: string }) => http.post(`/partners/${partnerId}/mapper/swap`, input),
  })
}

/* --------------------------------------------------------------- users */

export function usePartnerUsers(partnerId: string) {
  return useQuery({
    queryKey: ['partner-users', partnerId, 'roster'],
    queryFn: () => http.get<PartnerUserRow[]>(`/partners/${partnerId}/users`),
  })
}

export function useSetBilling(partnerId: string) {
  return useMutation({
    mutationFn: (input: { userIds: string[]; billingEnabled: boolean }) =>
      http.patch<{ updated: number }>(`/partners/${partnerId}/users/billing`, input),
  })
}

export function useSimulateSync(partnerId: string) {
  return useMutation({
    mutationFn: () => http.post<{ created: number; deactivated: number; active: number }>(`/partners/${partnerId}/sync/simulate`),
  })
}

/* ------------------------------------------------------------ API keys */

export function useAllApiKeys(showRevoked: boolean) {
  return useQuery({
    queryKey: ['api-keys', 'all', { showRevoked }],
    queryFn: () => http.get<ApiKeyRow[]>('/api-keys', { showRevoked }),
  })
}

export function useRevokeKey() {
  return useMutation({ mutationFn: (id: string) => http.post<PartnerApiKey>(`/api-keys/${id}/revoke`) })
}

/* ---------------------------------------------- accountant partner page */

/**
 * The billing profile spans several entities, so the page reads the same
 * endpoint under three roots: partners (profile, seats, users), invoices and points.
 */
export function useAccountantPartner(partnerId: string, root: 'partners' | 'invoices' | 'points' = 'partners') {
  return useQuery({
    queryKey: [root, 'accountant-profile', partnerId],
    queryFn: () => http.get<AccountantPartnerProfile>(`/accountant/partners/${partnerId}`),
  })
}
