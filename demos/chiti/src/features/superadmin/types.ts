/** View models of the super-admin console (what the handlers return). */
import type { Admin, ChannelFeatures, Operator, PlatformSettings, StaffConversation, StaffMessage, Supervisor, SystemHealthSample, Tenant, TenantState } from '@/types'

export type MemberRole = 'admin' | 'operator' | 'supervisor'
export type Member = Admin | Operator | Supervisor
export type HealthRange = 'live' | '1h' | '24h' | '7d'

export interface TenantRow extends Tenant {
  state: TenantState
}

export interface Overview {
  tenants: { total: number; active: number; disabled: number; deleted: number }
  admins: number
  operators: number
  supervisors: number
  customers: number
  sessions: number
}

export interface MembersResponse {
  admins: Admin[]
  operators: Operator[]
  supervisors: Supervisor[]
}

export interface MemberInput {
  name: string | { en: string; ka: string }
  nickname: string
  email: string
  username: string
  /** Required on create; blank on edit keeps the current one. */
  password: string
  number: string
  isExternal: boolean
}

export interface CheckResult {
  id: string
  ok: boolean
  /** Short machine value the UI formats (ms, a count, a list). */
  value?: string | number | null
}

export interface ChecksResponse {
  ok: boolean
  checks: CheckResult[]
}

export interface PlatformTenant {
  id: string
  slug: string
  name: Tenant['name']
  state: TenantState
  features: ChannelFeatures
}

export interface PlatformResponse {
  settings: PlatformSettings
  tenants: PlatformTenant[]
  webhook: { expectedUrl: string; registeredUrl: string | null; registeredAt: string | null; inSync: boolean }
}

export interface HealthResponse {
  range: HealthRange
  samples: SystemHealthSample[]
  current: SystemHealthSample
  retentionMonths: number
}

export interface AiTenantRef {
  id: string
  slug: string
  name: Tenant['name']
  aiClientId: string | null
}

export interface AiKeyResponse {
  source: 'db' | 'env' | 'none'
  keyId: string | null
  keyPreview: string | null
  baseUrl: string
  suggestedBaseUrl: string
  mappedTenants: AiTenantRef[]
  botEnabledTenants: AiTenantRef[]
}

export interface ImpersonateResponse {
  accountId: string
  homeRoute: string
}

export type { StaffConversation, StaffMessage }
