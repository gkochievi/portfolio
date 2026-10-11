/**
 * Mock API handlers. Owner: admin-catalog.
 * Admin dashboard, the task catalogue (templates, partner prices, per-partner
 * catalogue overrides) and staff users. Patterns are registered WITHOUT /api.
 */
import { DemoApiError, notFound, type MockApi } from '@portfolio/demo-kit'

import { emitChanged, nowIso, recordAudit, requireStaff } from '@/demo/ctx'
import { diffDays, isoDate } from '@/demo/domain/dates'
import { syntheticTrend } from '@/demo/domain/trend'
import { store } from '@/demo/runtime'
import type {
  ActivityLog,
  Currency,
  Invoice,
  PartnerTemplateOverride,
  StaffRole,
  StaffUser,
  TaskState,
  TaskTemplate,
  TechnicianType,
} from '@/types'

/* ------------------------------------------------------------------ DTOs */

export interface DashboardKpi {
  value: number
  delta: number
  trend: number[]
}

export interface AdminDashboard {
  kpis: {
    activePartners: DashboardKpi
    perUserSeats: DashboardKpi
    syncedUsers: DashboardKpi
    unpaidInvoices: DashboardKpi
  }
  expiring: Array<{ partnerId: string; partnerName: string; contractEndOn: string; daysLeft: number; isActive: boolean }>
  overdue: Array<{ id: string; invoiceNumber: string; partnerId: string; partnerName: string; total: number; currency: Currency; dueAt: string; daysOverdue: number }>
  openTasks: Array<{ id: string; number: number; title: string; partnerId: string | null; partnerName: string | null; state: TaskState; createdAt: string; pricingPending: boolean }>
  audit: ActivityLog[]
  generatedAt: string
}

export interface TemplateListRow extends TaskTemplate {
  overrideCount: number
  taskCount: number
}

export interface TemplatePartnerPrice {
  partnerId: string
  partnerName: string
  currency: Currency
  points: number
  overrideId: string
}

export interface TemplateDetail {
  template: TaskTemplate
  taskCount: number
  partnerPrices: TemplatePartnerPrice[]
  /** Partners without a price override yet (the Add override select). */
  availablePartners: Array<{ id: string; name: string; currency: Currency }>
}

export interface PartnerCatalogueRow {
  templateId: string
  code: string
  name: string
  description: string
  defaultPoints: number | null
  isFreeform: boolean
  isActive: boolean
  isHidden: boolean
  nameOverride: string | null
  descriptionOverride: string | null
  pointsOverride: number | null
  effectiveName: string
  effectiveDescription: string
  effectivePoints: number | null
  hasOverride: boolean
}

/* -------------------------------------------------------------- helpers */

const OPEN_STATES: TaskState[] = ['accepted', 'in_progress', 'pending', 'testing']
const ROLES: StaffRole[] = ['superadmin', 'accountant', 'l1_employee', 'technician']
const TECH_TYPES: TechnicianType[] = ['webdeveloper', 'voip_engineer', 'both']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function kpi(value: number, spread: number, inverse = false): DashboardKpi {
  const trend = syntheticTrend(value, spread, inverse)
  const prev = trend[trend.length - 2] ?? value
  return { value, trend, delta: Math.round(value - prev) }
}

function isUnpaid(inv: Invoice): boolean {
  return inv.status === 'issued' && !inv.paidAt
}

function partnerName(id: string | null): string | null {
  if (!id) return null
  return store.data.partners.find((p) => p.id === id)?.name ?? null
}

function findTemplate(id: string): TaskTemplate {
  const tpl = store.data.taskTemplates.find((t) => t.id === id)
  if (!tpl) throw notFound()
  return tpl
}

function taskCountOf(templateId: string): number {
  return store.data.tasks.filter((t) => t.templateId === templateId).length
}

/** UPPER_SNAKE of the name; `_2`, `_3`… on collision. Georgian-only names fall back to TEMPLATE. */
export function slugTemplateCode(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'TEMPLATE'
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function pointsValue(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100) / 100
}

interface TemplateInput {
  name?: unknown
  description?: unknown
  isFreeform?: unknown
  defaultPoints?: unknown
  isActive?: unknown
}

function validateTemplate(input: TemplateInput, existing?: TaskTemplate) {
  const name = input.name === undefined && existing ? existing.name : str(input.name)
  const description = input.description === undefined && existing ? existing.description : str(input.description)
  const isFreeform = input.isFreeform === undefined && existing ? existing.isFreeform : input.isFreeform === true
  const isActive = input.isActive === undefined ? (existing?.isActive ?? true) : input.isActive === true
  const rawPoints = pointsValue(input.defaultPoints)
  const points = rawPoints === undefined ? (existing?.defaultPoints ?? null) : rawPoints
  const errors: Record<string, string> = {}
  if (!name) errors.name = 'required'
  else if (name.length > 200) errors.name = 'too_long'
  if (description.length > 4000) errors.description = 'too_long'
  if (!isFreeform) {
    if (points === null) errors.defaultPoints = 'required'
    else if (Number.isNaN(points) || points < 0) errors.defaultPoints = 'points_min'
  }
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return { name, description, isFreeform, isActive, defaultPoints: isFreeform ? null : points }
}

function overrideIsEmpty(o: PartnerTemplateOverride): boolean {
  return !o.isHidden && o.points === null && o.nameOverride === null && o.descriptionOverride === null
}

function partnerCatalogue(partnerId: string): PartnerCatalogueRow[] {
  const data = store.data
  return data.taskTemplates
    .filter((t) => !t.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((t) => {
      const o = data.templateOverrides.find((x) => x.templateId === t.id && x.partnerId === partnerId)
      const pointsOverride = t.isFreeform ? null : (o?.points ?? null)
      return {
        templateId: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        defaultPoints: t.defaultPoints,
        isFreeform: t.isFreeform,
        isActive: t.isActive,
        isHidden: o?.isHidden ?? false,
        nameOverride: o?.nameOverride ?? null,
        descriptionOverride: o?.descriptionOverride ?? null,
        pointsOverride,
        effectiveName: o?.nameOverride ?? t.name,
        effectiveDescription: o?.descriptionOverride ?? t.description,
        effectivePoints: t.isFreeform ? null : (pointsOverride ?? t.defaultPoints),
        hasOverride: Boolean(o && !overrideIsEmpty(o)),
      }
    })
}

function safeUser(u: StaffUser): StaffUser {
  return { ...u }
}

function findUser(id: string): StaffUser {
  const u = store.data.staffUsers.find((x) => x.id === id && !x.deletedAt)
  if (!u) throw notFound()
  return u
}

function activeSuperadmins(): StaffUser[] {
  return store.data.staffUsers.filter((u) => u.role === 'superadmin' && u.isActive && !u.deletedAt)
}

interface UserInput {
  email?: unknown
  fullName?: unknown
  fullNameKa?: unknown
  role?: unknown
  technicianType?: unknown
  password?: unknown
  isActive?: unknown
}

function validateUser(input: UserInput, existing?: StaffUser) {
  const email = (input.email === undefined && existing ? existing.email : str(input.email)).toLowerCase()
  const fullName = input.fullName === undefined && existing ? existing.fullName : str(input.fullName)
  const fullNameKa = input.fullNameKa === undefined && existing ? existing.fullNameKa : str(input.fullNameKa)
  const role = (input.role === undefined && existing ? existing.role : input.role) as StaffRole
  const rawType = input.technicianType === undefined && existing ? existing.technicianType : input.technicianType
  const technicianType = (rawType === '' || rawType === null || rawType === undefined ? null : rawType) as TechnicianType | null
  const isActive = input.isActive === undefined ? (existing?.isActive ?? true) : input.isActive === true
  const password = typeof input.password === 'string' ? input.password : ''
  const errors: Record<string, string> = {}
  if (!email) errors.email = 'required'
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'email_invalid'
  else if (store.data.staffUsers.some((u) => !u.deletedAt && u.id !== existing?.id && u.email.toLowerCase() === email))
    errors.email = 'email_taken'
  if (!fullName) errors.fullName = 'required'
  else if (fullName.length > 200) errors.fullName = 'too_long'
  if (fullNameKa.length > 200) errors.fullNameKa = 'too_long'
  if (!ROLES.includes(role)) errors.role = 'required'
  if (role === 'technician' && (!technicianType || !TECH_TYPES.includes(technicianType))) errors.technicianType = 'required'
  if (!existing && password.length < 8) errors.password = 'password_min'
  if (existing && password.length > 0 && password.length < 8) errors.password = 'password_min'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return {
    email,
    fullName,
    fullNameKa,
    role,
    technicianType: role === 'technician' ? technicianType : null,
    isActive,
  }
}

/* ------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* ---------------------------------------------------------- dashboard */
  api.register('GET', '/admin/dashboard', () => {
    requireStaff('superadmin')
    const data = store.data
    const today = isoDate(new Date())
    const nowMs = Date.now()
    const activePartners = data.partners.filter((p) => p.isActive)
    const activeIds = new Set(activePartners.map((p) => p.id))
    const perUserIds = new Set(data.licenses.filter((l) => l.kind === 'per_user').map((l) => l.id))
    const seats = data.seatAllocations
      .filter((a) => a.effectiveTo === null && activeIds.has(a.partnerId) && perUserIds.has(a.licenseId))
      .reduce((acc, a) => acc + a.quantity, 0)
    const synced = data.partnerUsers.filter((u) => u.isActive && activeIds.has(u.partnerId)).length
    const unpaid = data.invoices.filter(isUnpaid)

    const expiring = data.partners
      .filter((p) => p.contractEndOn)
      .map((p) => ({
        partnerId: p.id,
        partnerName: p.name,
        contractEndOn: p.contractEndOn as string,
        daysLeft: diffDays(p.contractEndOn as string, today),
        isActive: p.isActive,
      }))
      .filter((r) => r.daysLeft <= 30 && r.daysLeft >= -90)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    const overdue = unpaid
      .filter((i) => i.dueAt && new Date(i.dueAt).getTime() < nowMs)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        partnerId: i.partnerId,
        partnerName: partnerName(i.partnerId) ?? '',
        total: i.total,
        currency: i.currency,
        dueAt: i.dueAt as string,
        daysOverdue: Math.max(1, Math.floor((nowMs - new Date(i.dueAt as string).getTime()) / 86_400_000)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)

    const openTasks = data.tasks
      .filter((t) => OPEN_STATES.includes(t.state))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        partnerId: t.partnerId,
        partnerName: partnerName(t.partnerId),
        state: t.state,
        createdAt: t.createdAt,
        pricingPending: t.pricingPending,
      }))

    const audit = [...data.activityLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)

    const result: AdminDashboard = {
      kpis: {
        activePartners: kpi(activePartners.length, 2),
        perUserSeats: kpi(seats, Math.max(4, Math.round(seats * 0.12))),
        syncedUsers: kpi(synced, Math.max(4, Math.round(synced * 0.1))),
        unpaidInvoices: kpi(unpaid.length, 3, true),
      },
      expiring,
      overdue,
      openTasks,
      audit,
      generatedAt: nowIso(),
    }
    return result
  })

  /* ---------------------------------------------------------- templates */
  api.register('GET', '/task-templates', ({ params }) => {
    requireStaff()
    const includeArchived = params.includeArchived === 'true' || params.includeArchived === '1'
    const rows: TemplateListRow[] = store.data.taskTemplates
      .filter((t) => includeArchived || !t.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((t) => ({
        ...t,
        overrideCount: store.data.templateOverrides.filter((o) => o.templateId === t.id && o.points !== null).length,
        taskCount: taskCountOf(t.id),
      }))
    return rows
  })

  api.register('POST', '/task-templates', ({ body }) => {
    requireStaff('superadmin')
    const v = validateTemplate((body ?? {}) as TemplateInput)
    const taken = new Set(store.data.taskTemplates.map((t) => t.code))
    const maxOrder = store.data.taskTemplates.reduce((m, t) => Math.max(m, t.sortOrder), 0)
    const tpl: TaskTemplate = {
      id: store.nextId('tpl_'),
      code: slugTemplateCode(v.name, taken),
      name: v.name,
      description: v.description,
      defaultPoints: v.defaultPoints,
      isFreeform: v.isFreeform,
      isActive: v.isActive,
      sortOrder: maxOrder + 1,
      archivedAt: null,
      createdAt: nowIso(),
    }
    store.data.taskTemplates.push(tpl)
    emitChanged('task-templates')
    return tpl
  })

  api.register('GET', '/task-templates/:id', ({ path }) => {
    requireStaff('superadmin')
    const template = findTemplate(path.id)
    const partnerPrices: TemplatePartnerPrice[] = store.data.templateOverrides
      .filter((o) => o.templateId === template.id && o.points !== null)
      .map((o) => {
        const p = store.data.partners.find((x) => x.id === o.partnerId)
        return {
          overrideId: o.id,
          partnerId: o.partnerId,
          partnerName: p?.name ?? o.partnerId,
          currency: p?.currency ?? 'GEL',
          points: o.points as number,
        }
      })
      .sort((a, b) => a.partnerName.localeCompare(b.partnerName))
    const priced = new Set(partnerPrices.map((r) => r.partnerId))
    const availablePartners = store.data.partners
      .filter((p) => !priced.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, currency: p.currency }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const result: TemplateDetail = { template, taskCount: taskCountOf(template.id), partnerPrices, availablePartners }
    return result
  })

  api.register('PATCH', '/task-templates/:id', ({ path, body }) => {
    requireStaff('superadmin')
    const tpl = findTemplate(path.id)
    if (tpl.archivedAt) throw new DemoApiError(400, 'template_archived')
    const v = validateTemplate((body ?? {}) as TemplateInput, tpl)
    Object.assign(tpl, v)
    if (tpl.isFreeform) {
      for (const o of store.data.templateOverrides) if (o.templateId === tpl.id) o.points = null
      store.data.templateOverrides = store.data.templateOverrides.filter((o) => !(o.templateId === tpl.id && overrideIsEmpty(o)))
    }
    emitChanged('task-templates')
    return tpl
  })

  api.register('DELETE', '/task-templates/:id', ({ path }) => {
    requireStaff('superadmin')
    const tpl = findTemplate(path.id)
    if (tpl.archivedAt) throw new DemoApiError(400, 'template_already_archived')
    if (taskCountOf(tpl.id) > 0) {
      tpl.archivedAt = nowIso()
      tpl.isActive = false
      emitChanged('task-templates')
      return { deleted: false, archived: true }
    }
    store.data.taskTemplates = store.data.taskTemplates.filter((t) => t.id !== tpl.id)
    store.data.templateOverrides = store.data.templateOverrides.filter((o) => o.templateId !== tpl.id)
    emitChanged('task-templates')
    return { deleted: true, archived: false }
  })

  api.register('POST', '/task-templates/:id/partner-rates', ({ path, body }) => {
    requireStaff('superadmin')
    const tpl = findTemplate(path.id)
    if (tpl.isFreeform) throw new DemoApiError(400, 'freeform_pricing_immutable')
    const input = (body ?? {}) as { partnerId?: unknown; points?: unknown }
    const partnerId = str(input.partnerId)
    const points = pointsValue(input.points)
    const errors: Record<string, string> = {}
    if (!partnerId || !store.data.partners.some((p) => p.id === partnerId)) errors.partnerId = 'required'
    if (points === null || points === undefined) errors.points = 'required'
    else if (Number.isNaN(points) || points < 0) errors.points = 'points_min'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const existing = store.data.templateOverrides.find((o) => o.templateId === tpl.id && o.partnerId === partnerId)
    if (existing && existing.points !== null) throw new DemoApiError(409, 'override_exists')
    if (existing) existing.points = points as number
    else
      store.data.templateOverrides.push({
        id: store.nextId('tov_'),
        templateId: tpl.id,
        partnerId,
        isHidden: false,
        points: points as number,
        nameOverride: null,
        descriptionOverride: null,
      })
    emitChanged('task-templates')
    return { ok: true }
  })

  api.register('DELETE', '/task-templates/:id/partner-rates/:partnerId', ({ path }) => {
    requireStaff('superadmin')
    const tpl = findTemplate(path.id)
    const o = store.data.templateOverrides.find((x) => x.templateId === tpl.id && x.partnerId === path.partnerId)
    if (!o || o.points === null) throw notFound()
    o.points = null
    if (overrideIsEmpty(o)) store.data.templateOverrides = store.data.templateOverrides.filter((x) => x.id !== o.id)
    emitChanged('task-templates')
    return { ok: true }
  })

  /* ------------------------------------------------- partner catalogue */
  const requirePartner = (id: string) => {
    if (!store.data.partners.some((p) => p.id === id)) throw notFound()
  }

  api.register('GET', '/partners/:id/task-templates', ({ path }) => {
    requireStaff('superadmin')
    requirePartner(path.id)
    return partnerCatalogue(path.id)
  })

  api.register('PUT', '/partners/:id/task-templates/:templateId', ({ path, body }) => {
    requireStaff('superadmin')
    requirePartner(path.id)
    const tpl = findTemplate(path.templateId)
    if (tpl.archivedAt) throw notFound()
    const input = (body ?? {}) as { isHidden?: unknown; nameOverride?: unknown; descriptionOverride?: unknown; points?: unknown }
    let o = store.data.templateOverrides.find((x) => x.templateId === tpl.id && x.partnerId === path.id)
    const next: PartnerTemplateOverride = o
      ? { ...o }
      : { id: '', templateId: tpl.id, partnerId: path.id, isHidden: false, points: null, nameOverride: null, descriptionOverride: null }
    const errors: Record<string, string> = {}
    if (input.isHidden !== undefined) next.isHidden = input.isHidden === true
    if (input.nameOverride !== undefined) {
      const v = input.nameOverride === null ? '' : str(input.nameOverride)
      if (v.length > 200) errors.nameOverride = 'too_long'
      next.nameOverride = v || null
    }
    if (input.descriptionOverride !== undefined) {
      const v = input.descriptionOverride === null ? '' : str(input.descriptionOverride)
      if (v.length > 4000) errors.descriptionOverride = 'too_long'
      next.descriptionOverride = v || null
    }
    if (input.points !== undefined) {
      const p = pointsValue(input.points)
      if (p !== null && p !== undefined && tpl.isFreeform) errors.points = 'freeform_pricing_immutable'
      else if (p !== null && p !== undefined && (Number.isNaN(p) || p < 0)) errors.points = 'points_min'
      else next.points = p ?? null
    }
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    if (overrideIsEmpty(next)) {
      store.data.templateOverrides = store.data.templateOverrides.filter((x) => !(x.templateId === tpl.id && x.partnerId === path.id))
    } else if (o) {
      Object.assign(o, next)
    } else {
      o = { ...next, id: store.nextId('tov_') }
      store.data.templateOverrides.push(o)
    }
    emitChanged('task-templates')
    return partnerCatalogue(path.id)
  })

  api.register('DELETE', '/partners/:id/task-templates/:templateId', ({ path }) => {
    requireStaff('superadmin')
    requirePartner(path.id)
    store.data.templateOverrides = store.data.templateOverrides.filter(
      (x) => !(x.templateId === path.templateId && x.partnerId === path.id),
    )
    emitChanged('task-templates')
    return partnerCatalogue(path.id)
  })

  /* --------------------------------------------------------------- users */
  api.register('GET', '/users', () => {
    requireStaff('superadmin')
    const order = (r: StaffRole) => ROLES.indexOf(r)
    return store.data.staffUsers
      .filter((u) => !u.deletedAt)
      .sort((a, b) => order(a.role) - order(b.role) || a.fullName.localeCompare(b.fullName))
      .map(safeUser)
  })

  api.register('GET', '/users/:id', ({ path }) => {
    requireStaff('superadmin')
    return safeUser(findUser(path.id))
  })

  api.register('POST', '/users', ({ body }) => {
    requireStaff('superadmin')
    const v = validateUser((body ?? {}) as UserInput)
    const user: StaffUser = {
      id: store.nextId('usr_'),
      ...v,
      lastLoginAt: null,
      createdAt: nowIso(),
      deletedAt: null,
    }
    store.data.staffUsers.push(user)
    recordAudit({ action: 'user.create', entityType: 'user', entityId: user.id, after: user })
    emitChanged('staff-users', 'audit')
    return safeUser(user)
  })

  api.register('PATCH', '/users/:id', ({ path, body }) => {
    const me = requireStaff('superadmin')
    const user = findUser(path.id)
    const v = validateUser((body ?? {}) as UserInput, user)
    if (user.id === me.id && (!v.isActive || v.role !== 'superadmin')) throw new DemoApiError(400, 'cannot_demote_self')
    const losesSuperadmin = user.role === 'superadmin' && user.isActive && (v.role !== 'superadmin' || !v.isActive)
    if (losesSuperadmin && activeSuperadmins().length <= 1) throw new DemoApiError(400, 'last_superadmin')
    const before = { ...user }
    Object.assign(user, v)
    recordAudit({ action: 'user.update', entityType: 'user', entityId: user.id, before, after: { ...user } })
    emitChanged('staff-users', 'audit')
    return safeUser(user)
  })

  api.register('DELETE', '/users/:id', ({ path }) => {
    const me = requireStaff('superadmin')
    const user = findUser(path.id)
    if (user.id === me.id) throw new DemoApiError(400, 'cannot_delete_self')
    if (user.role === 'superadmin' && user.isActive && activeSuperadmins().length <= 1) throw new DemoApiError(400, 'last_superadmin')
    const before = { ...user }
    user.deletedAt = nowIso()
    user.isActive = false
    recordAudit({ action: 'user.delete', entityType: 'user', entityId: user.id, before, after: null })
    emitChanged('staff-users', 'audit')
    return { ok: true }
  })
}
