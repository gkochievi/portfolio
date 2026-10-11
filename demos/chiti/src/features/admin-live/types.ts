import type { AdminStats, OperatorBrief, SessionSummary } from '@/types'

export type AdminSessionTab = 'live' | 'pending' | 'inactive' | 'today'

export type DashboardOperator = OperatorBrief & { activeChatCount: number }

/** GET /api/admin/dashboard */
export interface DashboardResponse {
  stats: AdminStats
  operators: DashboardOperator[]
  openSessions: SessionSummary[]
  /** Per-operator chat limit (0 = unlimited). */
  limit: number
}

/** GET /api/admin/sessions?tab= */
export interface AdminSessionsResponse {
  rows: SessionSummary[]
  counts: Record<AdminSessionTab, number>
}
