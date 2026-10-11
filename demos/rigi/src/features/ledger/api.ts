/**
 * Ledger query hooks + DTOs. Owner: ledger.
 * Every key starts with a ChangedEntity, so the shell's bus listener refreshes
 * these views whenever any group mutates invoices, points or seats.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { bus } from '@/demo/runtime'
import { printHtml } from '@/features/invoice-templates/lib/print'
import { http } from '@/lib/api'
import type { Currency, InvoiceDisplayStatus, InvoiceKind, InvoiceLineKind, LicenseKind } from '@/types'

/* ------------------------------------------------------------------ DTOs */

export interface PortalLicenseRow {
  id: string
  code: string
  name: string
  kind: LicenseKind
  unitPrice: number
  seats: number
  users: number
  monthlyCost: number
  isOverride: boolean
}

export interface PortalRosterRow {
  id: string
  username: string
  fullName: string
  role: string
  status: string
  statusCode: number
  licenseId: string | null
  licenseCode: string | null
  licenseName: string | null
  /** Null unless the user is billing-enabled and holds a license. */
  cost: number | null
}

export interface PortalAccount {
  currency: Currency
  kpis: { activeUsers: number; licensedUsers: number; licenseTypes: number; monthlyCost: number }
  licenses: PortalLicenseRow[]
  roster: PortalRosterRow[]
}

export interface PortalInvoiceRow {
  id: string
  invoiceNumber: string
  kind: InvoiceKind
  title: string | null
  periodYear: number
  periodMonth: number
  displayStatus: InvoiceDisplayStatus
  issuedAt: string | null
  dueAt: string | null
  total: number
  currency: Currency
  vatInclusive: boolean
}

export interface PortalInvoiceLine {
  id: string
  kind: InvoiceLineKind
  description: string
  amount: number
}

export interface PortalInvoice extends PortalInvoiceRow {
  subtotal: number
  tax: number
  vatRate: number
  notes: string
  paidAt: string | null
  voidedAt: string | null
  disputedAt: string | null
  disputeReason: string | null
  lines: PortalInvoiceLine[]
  partner: { name: string; legalName: string }
  canDispute: boolean
}

export interface PointsMonth {
  year: number
  month: number
  allowance: number
  freeUsed: number
  freeUsedPct: number
  remaining: number
  resetOn: string
  billable: { points: number; rate: number; amount: number }
}

export interface PointsHistoryRow {
  year: number
  month: number
  allowance: number
  used: number
  freeUsed: number
  billablePoints: number
  rate: number
  cost: number
}

export interface PortalPoints {
  currency: Currency
  current: PointsMonth
  history: PointsHistoryRow[]
}

export interface MoneyByCurrency {
  currency: Currency
  amount: number
}

export interface PaymentsReport {
  year: number
  month: number | null
  totals: Array<{ currency: Currency; paid: number; invoiceCount: number }>
  rows: Array<{ partnerId: string; partnerName: string; currency: Currency; paid: number; invoiceCount: number }>
}

export interface UnusedAllowanceReport {
  year: number
  month: number
  totals: Array<{ currency: Currency; unused: number; equivalent: number }>
  rows: Array<{
    partnerId: string
    partnerName: string
    currency: Currency
    allowance: number
    used: number
    unused: number
    ratePerPoint: number
    equivalent: number
  }>
}

/* ----------------------------------------------------------------- hooks */

export function usePortalAccount() {
  return useQuery({ queryKey: ['seats', 'portal'], queryFn: ({ signal }) => http.get<PortalAccount>('/portal/account', undefined, signal) })
}

export function usePortalInvoices() {
  return useQuery({
    queryKey: ['invoices', 'portal-list'],
    queryFn: ({ signal }) => http.get<PortalInvoiceRow[]>('/portal/invoices', undefined, signal),
  })
}

export function usePortalInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'portal-detail', id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => http.get<PortalInvoice>(`/portal/invoices/${id}`, undefined, signal),
  })
}

export function useDisputeInvoice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => http.post<PortalInvoice>(`/portal/invoices/${id}/dispute`, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDownloadPortalPdf(id: string) {
  return useMutation({
    mutationFn: async () => {
      const doc = await http.get<{ html: string; filename?: string }>(`/portal/invoices/${id}/document`)
      printHtml(doc.html, doc.filename ?? 'Invoice')
      return doc
    },
  })
}

export function usePortalPoints() {
  return useQuery({ queryKey: ['points', 'portal'], queryFn: ({ signal }) => http.get<PortalPoints>('/portal/points', undefined, signal) })
}

export function usePaymentsReport(year: number, month: number | null) {
  return useQuery({
    queryKey: ['reports', 'payments', { year, month }],
    queryFn: ({ signal }) => http.get<PaymentsReport>('/reports/payments', { year, month }, signal),
  })
}

export function useUnusedAllowanceReport(year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'unused-allowance', { year, month }],
    queryFn: ({ signal }) => http.get<UnusedAllowanceReport>('/reports/unused-allowance', { year, month }, signal),
  })
}

/**
 * Reports are derived from invoices and points, whose owners emit their own
 * change events; this keeps an open report in step with a payment or a
 * verified task made elsewhere in the demo.
 */
export function useReportsLive() {
  const qc = useQueryClient()
  useEffect(() => {
    const handler = ({ entities }: { entities: string[] }) => {
      if (entities.includes('invoices') || entities.includes('points') || entities.includes('partners')) {
        void qc.invalidateQueries({ queryKey: ['reports'] })
      }
    }
    bus.on('changed', handler)
    return () => {
      bus.off('changed', handler)
    }
  }, [qc])
}

/* --------------------------------------------------------------- helpers */

/** Years offered by the report filters, newest first. */
export function reportYears(now = new Date()): number[] {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3]
}
