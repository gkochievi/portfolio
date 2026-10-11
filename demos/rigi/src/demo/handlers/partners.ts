/**
 * Mock API handlers. Owner: partners. Patterns are registered WITHOUT the
 * /api prefix. Also runs a small simulator: partner telephony systems call
 * the machine API with their keys, so `lastUsedAt` moves while the demo is open.
 */
import { createRandom, DemoApiError, every, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'
import type { ZodError, ZodTypeAny } from 'zod'

import en from '@/features/partners/locales/en/partners.json'
import {
  apiKeySchema,
  CONTACT_ROLES,
  documentUploadSchema,
  documentVersionSchema,
  partnerCreateSchema,
  partnerUpdateSchema,
  portalAdminSchema,
  rateSchema,
} from '@/features/partners/lib/schema'
import type { DocumentKind, DocumentVersion, Partner, PartnerApiKey, PartnerDocument } from '@/types'

import { DEMO_PASSWORD } from '../accounts'
import { emitChanged, nowIso, recordAudit, requireStaff, writeSystemLog } from '../ctx'
import { addDays, isoDate } from '../domain/dates'
import { seatSummary } from '../domain/seats'
import { bus, store } from '../runtime'

/* -------------------------------------------------------------- helpers */

const messages = (en as { validation?: Record<string, string> }).validation ?? {}

function englishMessage(key: string): string {
  const short = key.startsWith('validation.') ? key.slice('validation.'.length) : key
  return messages[short] ?? key
}

function fieldErrors(error: ZodError): DemoApiError {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'non_field_errors'
    if (!fields[path]) fields[path] = englishMessage(issue.message)
  }
  return DemoApiError.validation(fields)
}

function parse<S extends ZodTypeAny>(schema: S, body: unknown): S['_output'] {
  const result = schema.safeParse(body ?? {})
  if (!result.success) throw fieldErrors(result.error)
  return result.data
}

function requireSuperadmin() {
  const me = requireStaff()
  if (me.role !== 'superadmin') throw forbidden()
  return me
}

function findPartner(id: string): Partner {
  const partner = store.data.partners.find((p) => p.id === id)
  if (!partner) throw notFound('Partner not found.')
  return partner
}

function checkPassword(body: unknown) {
  const password = (body as { password?: unknown } | null)?.password
  if (typeof password !== 'string' || password.length === 0) {
    throw DemoApiError.validation({ password: englishMessage('validation.required') })
  }
  if (password !== DEMO_PASSWORD) throw DemoApiError.validation({ password: englishMessage('validation.wrongPassword') })
}

function today(): string {
  return isoDate(new Date())
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function contractExpiry(partner: Partner) {
  if (!partner.contractEndOn) return { state: 'none' as const, daysLeft: null }
  const daysLeft = daysBetween(today(), partner.contractEndOn)
  const state = daysLeft < 0 ? ('expired' as const) : daysLeft <= 30 ? ('expiring' as const) : ('ok' as const)
  return { state, daysLeft }
}

function snapshot(partner: Partner) {
  const { createdAt: _c, updatedAt: _u, ...rest } = partner
  return rest
}

function sampleFor(mimeType: string, filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'samples/network-diagram.png'
  if (mimeType === 'text/csv' || ext === 'csv') return 'samples/call-log.csv'
  if (mimeType.startsWith('text/') || ['txt', 'log', 'md'].includes(ext)) return 'samples/ivr-flow.txt'
  if (mimeType.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'samples/handover.docx'
  return 'samples/service-agreement.pdf'
}

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SECRET_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomString(alphabet: string, length: number): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function emitAccess(partner: Partner) {
  bus.emit('partner.access', { partnerId: partner.id, isActive: partner.isActive })
}

/* ----------------------------------------------------------- simulator */

let stopSimulator: (() => void) | null = null

function startKeyUsageSimulator() {
  stopSimulator?.()
  const random = createRandom('rigi-partner-keys')
  stopSimulator = every(40_000, () => {
    const live = store.data.apiKeys.filter((k) => {
      if (k.revokedAt || !k.scopes.includes('user_count:write')) return false
      return store.data.partners.some((p) => p.id === k.partnerId && p.isActive)
    })
    if (live.length === 0 || !random.chance(0.75)) return
    const key = random.pick(live)
    key.lastUsedAt = nowIso()
    emitChanged('api-keys')
  })
}

/* ------------------------------------------------------------- routes */

export function register(api: MockApi): void {
  /* list */
  api.register('GET', '/partners', ({ params }) => {
    requireSuperadmin()
    const q = (params.q ?? '').trim().toLowerCase()
    const status = params.status ?? 'all'
    const all = store.data.partners
    const items = all
      .filter((p) => (status === 'active' ? p.isActive : status === 'inactive' ? !p.isActive : true))
      .filter((p) =>
        q
          ? [p.name, p.legalName, p.companyId, p.city, p.contactEmail, p.id].some((v) => v.toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        legalName: p.legalName,
        city: p.city,
        currency: p.currency,
        ratePerPoint: p.ratePerPoint,
        freeMonthlyAllowance: p.freeMonthlyAllowance,
        isActive: p.isActive,
        contractEndOn: p.contractEndOn,
      }))
    return { items, total: all.length }
  })

  /* pickers everywhere */
  api.register('GET', '/partners/options', () => {
    requireStaff()
    return store.data.partners
      .filter((p) => !p.deletedAt)
      .map((p) => ({ id: p.id, name: p.name, currency: p.currency, isActive: p.isActive }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  /* create */
  api.register('POST', '/partners', ({ body }) => {
    const me = requireSuperadmin()
    const input = parse(partnerCreateSchema, body)
    const at = nowIso()
    const partner: Partner = {
      id: store.nextId('prt_'),
      name: input.name,
      legalName: input.legalName,
      companyId: input.companyId,
      city: '',
      contactEmail: input.contactEmail,
      billingEmail: input.billingEmails[0] ?? input.contactEmail,
      billingEmails: input.billingEmails,
      currency: input.currency,
      ratePerPoint: input.ratePerPoint,
      freeMonthlyAllowance: input.freeMonthlyAllowance,
      isActive: true,
      onboardedAt: input.onboardedAt ? `${input.onboardedAt}T09:00:00.000Z` : at,
      contractStartOn: input.contractStartOn || null,
      contractEndOn: input.contractEndOn || null,
      invoiceGenerationDay: input.invoiceGenerationDay,
      pbxServerIp: input.pbxServerIp,
      webServerIp: input.webServerIp,
      webServerDomain: input.webServerDomain,
      architecture: input.architecture,
      vpnType: input.vpnType,
      phoneNumbers: input.phoneNumbers,
      contacts: CONTACT_ROLES.map((role) => {
        const c = input.contacts.find((x) => x.role === role)
        return { role, name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '' }
      }),
      notes: input.notes,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    }
    store.data.partners.push(partner)
    store.data.partnerRates.push({
      id: store.nextId('rate_'),
      partnerId: partner.id,
      ratePerPoint: partner.ratePerPoint,
      freeAllowance: partner.freeMonthlyAllowance,
      effectiveFrom: isoDate(partner.onboardedAt),
      effectiveTo: null,
      createdByName: me.name,
      createdAt: at,
    })
    recordAudit({ action: 'partner.create', entityType: 'partner', entityId: partner.id, partnerId: partner.id, after: snapshot(partner) })
    writeSystemLog({ level: 'info', source: 'partners', message: `Partner created: ${partner.name}`, partnerId: partner.id })
    emitChanged('partners', 'partner-rates', 'dashboards', 'audit', 'system-logs')
    return partner
  })

  /* detail */
  api.register('GET', '/partners/:id', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const summary = seatSummary(store.data, partner.id)
    return {
      ...partner,
      licenseSummary: {
        ...summary,
        rows: summary.rows.map((r) => ({
          license: { id: r.license.id, code: r.license.code, name: r.license.name, kind: r.license.kind, isActive: r.license.isActive },
          unitPrice: r.unitPrice,
          isOverride: r.isOverride,
          seats: r.seats,
          taggedUsers: r.taggedUsers,
          monthlyCost: r.monthlyCost,
        })),
      },
      contractExpiry: contractExpiry(partner),
    }
  })

  /* edit profile */
  api.register('PATCH', '/partners/:id', ({ path, body }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    const input = parse(partnerUpdateSchema, body)
    const before = snapshot(partner)
    const wasActive = partner.isActive
    Object.assign(partner, {
      name: input.name,
      legalName: input.legalName,
      companyId: input.companyId,
      currency: input.currency,
      onboardedAt: input.onboardedAt ? `${input.onboardedAt}T09:00:00.000Z` : partner.onboardedAt,
      contractStartOn: input.contractStartOn || null,
      contractEndOn: input.contractEndOn || null,
      invoiceGenerationDay: input.invoiceGenerationDay,
      contactEmail: input.contactEmail,
      billingEmails: input.billingEmails,
      billingEmail: input.billingEmails[0] ?? input.contactEmail,
      pbxServerIp: input.pbxServerIp,
      webServerIp: input.webServerIp,
      webServerDomain: input.webServerDomain,
      architecture: input.architecture,
      vpnType: input.vpnType,
      phoneNumbers: input.phoneNumbers,
      contacts: CONTACT_ROLES.map((role) => {
        const c = input.contacts.find((x) => x.role === role)
        return { role, name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '' }
      }),
      notes: input.notes,
      isActive: input.isActive,
      deletedAt: input.isActive ? null : partner.deletedAt,
      updatedAt: nowIso(),
    } satisfies Partial<Partner>)
    recordAudit({ action: 'partner.update', entityType: 'partner', entityId: partner.id, partnerId: partner.id, before, after: snapshot(partner) })
    if (wasActive !== partner.isActive) emitAccess(partner)
    emitChanged('partners', 'dashboards', 'audit', 'me')
    return partner
  })

  /* enable / disable / delete (password re-auth) */
  const setActive = (id: string, active: boolean, body: unknown) => {
    requireSuperadmin()
    const partner = findPartner(id)
    checkPassword(body)
    const before = snapshot(partner)
    partner.isActive = active
    if (active) partner.deletedAt = null
    partner.updatedAt = nowIso()
    recordAudit({ action: 'partner.update', entityType: 'partner', entityId: partner.id, partnerId: partner.id, before, after: snapshot(partner) })
    writeSystemLog({
      level: active ? 'info' : 'warn',
      source: 'partners',
      message: active ? `Partner enabled: ${partner.name}` : `Partner disabled, portal sessions revoked: ${partner.name}`,
      partnerId: partner.id,
    })
    emitAccess(partner)
    emitChanged('partners', 'dashboards', 'audit', 'system-logs', 'me')
    return partner
  }
  api.register('POST', '/partners/:id/activate', ({ path, body }) => setActive(path.id!, true, body))
  api.register('POST', '/partners/:id/deactivate', ({ path, body }) => setActive(path.id!, false, body))

  api.register('DELETE', '/partners/:id', ({ path, body }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    checkPassword(body)
    const before = snapshot(partner)
    partner.isActive = false
    partner.deletedAt = nowIso()
    partner.updatedAt = partner.deletedAt
    recordAudit({ action: 'partner.delete', entityType: 'partner', entityId: partner.id, partnerId: partner.id, before, after: snapshot(partner) })
    writeSystemLog({ level: 'warn', source: 'partners', message: `Partner deleted (deactivated): ${partner.name}`, partnerId: partner.id })
    emitAccess(partner)
    emitChanged('partners', 'dashboards', 'audit', 'system-logs', 'me')
    return { ok: true }
  })

  /* rates */
  api.register('GET', '/partners/:id/rates', ({ path }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    const history = store.data.partnerRates
      .filter((r) => r.partnerId === partner.id)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    const open = history.find((r) => r.effectiveTo === null)
    return {
      current: { ratePerPoint: partner.ratePerPoint, freeAllowance: partner.freeMonthlyAllowance, effectiveFrom: open?.effectiveFrom ?? null },
      history,
    }
  })

  api.register('POST', '/partners/:id/rates', ({ path, body }) => {
    const me = requireSuperadmin()
    const partner = findPartner(path.id!)
    const input = parse(rateSchema, body)
    const open = store.data.partnerRates.find((r) => r.partnerId === partner.id && r.effectiveTo === null)
    if (open && input.effectiveFrom <= open.effectiveFrom) {
      throw DemoApiError.validation({ effectiveFrom: englishMessage('validation.effectiveAfterOpen') })
    }
    if (open) open.effectiveTo = addDays(input.effectiveFrom, -1)
    const row = {
      id: store.nextId('rate_'),
      partnerId: partner.id,
      ratePerPoint: input.ratePerPoint,
      freeAllowance: input.freeAllowance,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      createdByName: me.name,
      createdAt: nowIso(),
    }
    store.data.partnerRates.push(row)
    const before = { ratePerPoint: partner.ratePerPoint, freeMonthlyAllowance: partner.freeMonthlyAllowance }
    partner.ratePerPoint = input.ratePerPoint
    partner.freeMonthlyAllowance = input.freeAllowance
    partner.updatedAt = nowIso()
    recordAudit({
      action: 'partner.set_rate',
      entityType: 'partner',
      entityId: partner.id,
      partnerId: partner.id,
      before,
      after: { ratePerPoint: partner.ratePerPoint, freeMonthlyAllowance: partner.freeMonthlyAllowance, effectiveFrom: input.effectiveFrom },
    })
    emitChanged('partner-rates', 'partners', 'points', 'reports', 'dashboards', 'audit')
    return row
  })

  /* documents */
  api.register('GET', '/partners/:id/documents', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const docs = store.data.partnerDocuments.filter((d) => d.partnerId === partner.id)
    const kinds: DocumentKind[] = ['contract', 'technical']
    return kinds.map((kind) => ({
      kind,
      documents: docs
        .filter((d) => d.kind === kind)
        .sort((a, b) => (b.versions.at(-1)?.createdAt ?? b.createdAt).localeCompare(a.versions.at(-1)?.createdAt ?? a.createdAt)),
    }))
  })

  const makeVersion = (versionNo: number, input: { filename: string; sizeBytes: number; mimeType: string; note: string }, by: string): DocumentVersion => ({
    id: store.nextId('ver_'),
    versionNo,
    filename: input.filename,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType || 'application/octet-stream',
    note: input.note,
    createdAt: nowIso(),
    uploadedByName: by,
    sampleFile: sampleFor(input.mimeType, input.filename),
  })

  api.register('POST', '/partners/:id/documents', ({ path, body }) => {
    const me = requireStaff('accountant')
    const partner = findPartner(path.id!)
    const input = parse(documentUploadSchema, body)
    const doc: PartnerDocument = {
      id: store.nextId('doc_'),
      partnerId: partner.id,
      kind: input.kind,
      title: input.title,
      createdAt: nowIso(),
      versions: [makeVersion(1, input, me.name)],
    }
    store.data.partnerDocuments.push(doc)
    emitChanged('documents')
    return doc
  })

  api.register('POST', '/partners/:id/documents/:docId/versions', ({ path, body }) => {
    const me = requireStaff('accountant')
    const partner = findPartner(path.id!)
    const doc = store.data.partnerDocuments.find((d) => d.id === path.docId && d.partnerId === partner.id)
    if (!doc) throw notFound('Document not found.')
    const input = parse(documentVersionSchema, body)
    const next = (doc.versions.at(-1)?.versionNo ?? 0) + 1
    doc.versions.push(makeVersion(next, input, me.name))
    emitChanged('documents')
    return doc
  })

  api.register('DELETE', '/partners/:id/documents/:docId', ({ path }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    const index = store.data.partnerDocuments.findIndex((d) => d.id === path.docId && d.partnerId === partner.id)
    if (index < 0) throw notFound('Document not found.')
    store.data.partnerDocuments.splice(index, 1)
    emitChanged('documents')
    return { ok: true }
  })

  /* API keys */
  api.register('GET', '/partners/:id/api-keys', ({ path }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    return store.data.apiKeys
      .filter((k) => k.partnerId === partner.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  api.register('POST', '/partners/:id/api-keys', ({ path, body }) => {
    const me = requireSuperadmin()
    const partner = findPartner(path.id!)
    const input = parse(apiKeySchema, body)
    const key: PartnerApiKey = {
      id: store.nextId('key_'),
      partnerId: partner.id,
      keyId: `demo_${randomString(KEY_ALPHABET, 8)}`,
      label: input.label,
      scopes: Array.from(new Set(input.scopes)),
      createdAt: nowIso(),
      createdByName: me.name,
      lastUsedAt: null,
      revokedAt: null,
    }
    store.data.apiKeys.push(key)
    recordAudit({ action: 'partner.create_api_key', entityType: 'partner', entityId: partner.id, partnerId: partner.id, after: { keyId: key.keyId, label: key.label, scopes: key.scopes } })
    emitChanged('api-keys', 'audit')
    // The secret goes out once and is never stored.
    return { key, secret: `rgs_${randomString(SECRET_ALPHABET, 40)}` }
  })

  /* portal admins */
  api.register('GET', '/partners/:id/admins', ({ path }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    return store.data.partnerAdmins
      .filter((a) => a.partnerId === partner.id)
      .sort((a, b) => a.username.localeCompare(b.username))
  })

  api.register('POST', '/partners/:id/admins', ({ path, body }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    const input = parse(portalAdminSchema, body)
    const username = input.username.toLowerCase()
    if (store.data.partnerAdmins.some((a) => a.username.toLowerCase() === username)) {
      throw DemoApiError.validation({ username: englishMessage('validation.usernameTaken') })
    }
    const admin = {
      id: store.nextId('padm_'),
      partnerId: partner.id,
      username,
      email: input.email || null,
      fullName: input.fullName,
      isActive: true,
      lastLoginAt: null,
      createdAt: nowIso(),
    }
    store.data.partnerAdmins.push(admin)
    emitChanged('portal-admins')
    return admin
  })

  api.register('PATCH', '/partners/:id/admins/:adminId', ({ path, body }) => {
    requireSuperadmin()
    const partner = findPartner(path.id!)
    const admin = store.data.partnerAdmins.find((a) => a.id === path.adminId && a.partnerId === partner.id)
    if (!admin) throw notFound('Portal admin not found.')
    const isActive = (body as { isActive?: unknown } | null)?.isActive
    if (typeof isActive !== 'boolean') throw DemoApiError.validation({ isActive: englishMessage('validation.required') })
    admin.isActive = isActive
    // A deactivated admin is locked out at once: the portal guard refetches `me`.
    emitChanged('portal-admins', 'me')
    return admin
  })

  startKeyUsageSimulator()
}
