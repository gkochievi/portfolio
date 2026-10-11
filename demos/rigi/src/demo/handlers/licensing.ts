/**
 * Mock API handlers. Owner: licensing.
 * License catalog, partner seat pools, price overrides, the license mapper,
 * the synced user roster (+ partner sync simulation), API keys and the
 * accountant's partner billing profile. Patterns are registered WITHOUT /api.
 */
import { conflict, createRandom, DemoApiError, notFound, type MockApi } from '@portfolio/demo-kit'

import { currentAccount, emitChanged, nowIso, recordAudit, requireStaff, writeSystemLog } from '@/demo/ctx'
import { displayStatus } from '@/demo/domain/billing'
import { addDays, isoDate, periodOf } from '@/demo/domain/dates'
import { round2 } from '@/demo/domain/money'
import { periodUsage, rateForPeriod } from '@/demo/domain/points'
import { effectiveLicensePrice, seatPool, seatSummary, taggedUsers } from '@/demo/domain/seats'
import { registerJob } from '@/demo/jobs'
import { store } from '@/demo/runtime'
import { FIRST_NAMES, LAST_NAMES } from '@/demo/seed/static'
import type { Currency, License, LicenseKind, Partner, PartnerUser, SeatAllocation } from '@/types'

/* ------------------------------------------------------------- helpers */

const CURRENCIES: Currency[] = ['GEL', 'USD', 'EUR']
const KINDS: LicenseKind[] = ['per_user', 'addon']

function data() {
  return store.data
}

function findPartner(id: string): Partner {
  const p = data().partners.find((x) => x.id === id && !x.deletedAt)
  if (!p) throw notFound('Partner not found.')
  return p
}

function findLicense(id: string): License {
  const l = data().licenses.find((x) => x.id === id)
  if (!l) throw notFound('License not found.')
  return l
}

function findUser(partnerId: string, userId: unknown): PartnerUser {
  const u = data().partnerUsers.find((x) => x.id === userId && x.partnerId === partnerId && x.isActive)
  if (!u) throw notFound('User not found.')
  return u
}

function actorName(): string {
  return currentAccount()?.name ?? 'System'
}

export function toUpperSnake(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()
}

function obj(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

function parsePrice(value: unknown, field = 'unitPrice'): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw DemoApiError.validation({ [field]: 'Enter a price of 0 or more.' })
  return round2(n)
}

/** Close the user's open membership period today and open a new one on `licenseId`. */
function moveMembership(user: PartnerUser, licenseId: string | null): void {
  const today = isoDate(new Date())
  for (const m of data().membershipPeriods) {
    if (m.partnerUserId === user.id && m.endedOn === null) m.endedOn = today
  }
  data().membershipPeriods.push({
    id: store.nextId('mp_'),
    partnerId: user.partnerId,
    partnerUserId: user.id,
    licenseId,
    startedOn: today,
    endedOn: null,
    reason: 'created',
  })
}

function userDto(u: PartnerUser) {
  const lic = u.licenseId ? data().licenses.find((l) => l.id === u.licenseId) : undefined
  return { ...u, licenseName: lic?.name ?? null, licenseCode: lic?.code ?? null }
}

export type PartnerUserDto = ReturnType<typeof userDto>

/* --------------------------------------------------------- user count job */

function snapshotUserCounts(): number {
  const day = isoDate(new Date())
  let n = 0
  for (const p of data().partners) {
    if (!p.isActive || p.deletedAt) continue
    const count = data().partnerUsers.filter((u) => u.partnerId === p.id && u.isActive).length
    upsertUserCount(p.id, day, count)
    n += 1
  }
  return n
}

function upsertUserCount(partnerId: string, day: string, userCount: number): void {
  const row = data().userCountDaily.find((r) => r.partnerId === partnerId && r.day === day)
  if (row) row.userCount = userCount
  else data().userCountDaily.push({ partnerId, day, userCount })
}

/* -------------------------------------------------------------- register */

export function register(api: MockApi): void {
  registerJob('usercount.snapshot.daily', () => {
    const n = snapshotUserCounts()
    emitChanged('partners', 'partner-users', 'dashboards')
    return { ok: true, summary: `User count snapshot written for ${n} active partners` }
  })

  /* ---------------------------------------------------- license catalog */

  api.register('GET', '/licenses', () => {
    requireStaff()
    const allocations = data().seatAllocations
    return [...data().licenses]
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
      .map((l) => ({
        ...l,
        seatsAllocated: allocations.filter((a) => a.licenseId === l.id && a.effectiveTo === null).reduce((s, a) => s + a.quantity, 0),
      }))
  })

  api.register('POST', '/licenses', ({ body }) => {
    requireStaff('superadmin')
    const b = obj(body)
    const name = String(b.name ?? '').trim()
    const errors: Record<string, string> = {}
    if (!name) errors.name = 'This field is required.'
    else if (name.length > 120) errors.name = 'At most 120 characters.'
    if (!KINDS.includes(b.kind as LicenseKind)) errors.kind = 'Choose a kind.'
    if (!CURRENCIES.includes(b.currency as Currency)) errors.currency = 'Choose a currency.'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const unitPrice = parsePrice(b.unitPrice)
    const code = toUpperSnake(name)
    if (!code) throw DemoApiError.validation({ name: 'Use Latin letters or digits.' })
    if (data().licenses.some((l) => l.code === code)) throw DemoApiError.validation({ name: `A license with code ${code} already exists.` })
    const license: License = {
      id: store.nextId('lic_'),
      code,
      name,
      kind: b.kind as LicenseKind,
      unitPrice,
      currency: b.currency as Currency,
      isActive: b.isActive !== false,
      createdAt: nowIso(),
    }
    data().licenses.push(license)
    recordAudit({ action: 'license.create', entityType: 'license', entityId: license.id, after: license })
    emitChanged('licenses', 'seats', 'audit')
    return license
  })

  api.register('PATCH', '/licenses/:id', ({ path, body }) => {
    requireStaff('superadmin')
    const license = findLicense(path.id!)
    const before = { ...license }
    const b = obj(body)
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) throw DemoApiError.validation({ name: 'This field is required.' })
      if (name.length > 120) throw DemoApiError.validation({ name: 'At most 120 characters.' })
      license.name = name
    }
    if (b.kind !== undefined) {
      if (!KINDS.includes(b.kind as LicenseKind)) throw DemoApiError.validation({ kind: 'Choose a kind.' })
      if (b.kind === 'addon' && license.kind === 'per_user' && data().partnerUsers.some((u) => u.licenseId === license.id && u.isActive)) {
        throw conflict('license_has_mapped_users')
      }
      license.kind = b.kind as LicenseKind
    }
    if (b.unitPrice !== undefined) license.unitPrice = parsePrice(b.unitPrice)
    if (b.currency !== undefined) {
      if (!CURRENCIES.includes(b.currency as Currency)) throw DemoApiError.validation({ currency: 'Choose a currency.' })
      license.currency = b.currency as Currency
    }
    if (b.isActive !== undefined) license.isActive = Boolean(b.isActive)
    recordAudit({ action: 'license.update', entityType: 'license', entityId: license.id, before, after: { ...license } })
    emitChanged('licenses', 'seats', 'partner-users', 'partners', 'audit')
    return license
  })

  api.register('DELETE', '/licenses/:id', ({ path }) => {
    requireStaff('superadmin')
    const license = findLicense(path.id!)
    const inUse =
      data().seatAllocations.some((a) => a.licenseId === license.id) || data().partnerUsers.some((u) => u.licenseId === license.id)
    if (inUse) throw conflict('license_in_use')
    data().licenses = data().licenses.filter((l) => l.id !== license.id)
    data().licenseOverrides = data().licenseOverrides.filter((o) => o.licenseId !== license.id)
    recordAudit({ action: 'license.delete', entityType: 'license', entityId: license.id, before: license })
    emitChanged('licenses', 'seats', 'audit')
    return { ok: true }
  })

  /* --------------------------------------------------------- seat pools */

  api.register('GET', '/partners/:id/seats', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const summary = seatSummary(data(), partner.id)
    const present = new Set(summary.rows.map((r) => r.license.id))
    const rows = summary.rows.map((r) => ({
      licenseId: r.license.id,
      name: r.license.name,
      code: r.license.code,
      kind: r.license.kind,
      isActive: r.license.isActive,
      unitPrice: r.unitPrice,
      catalogPrice: r.catalogPrice,
      isOverride: r.isOverride,
      seats: r.seats,
      taggedUsers: r.taggedUsers,
      monthlyCost: r.monthlyCost,
    }))
    for (const l of data().licenses) {
      if (present.has(l.id) || !l.isActive) continue
      rows.push({
        licenseId: l.id,
        name: l.name,
        code: l.code,
        kind: l.kind,
        isActive: l.isActive,
        unitPrice: effectiveLicensePrice(data(), partner.id, l.id),
        catalogPrice: l.unitPrice,
        isOverride: false,
        seats: 0,
        taggedUsers: 0,
        monthlyCost: 0,
      })
    }
    rows.sort((a, b) => Number(a.kind === 'addon') - Number(b.kind === 'addon') || b.seats - a.seats || a.name.localeCompare(b.name))
    const history = data()
      .seatAllocations.filter((a) => a.partnerId === partner.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.effectiveFrom.localeCompare(a.effectiveFrom))
      .map((a) => {
        const l = data().licenses.find((x) => x.id === a.licenseId)
        return { ...a, licenseName: l?.name ?? '—', licenseCode: l?.code ?? '' }
      })
    return {
      currency: partner.currency,
      rows,
      totals: summary.totals,
      unassignedCount: summary.unassignedCount,
      activeUsers: summary.activeUsers,
      billedUsers: summary.billedUsers,
      history,
    }
  })

  api.register('POST', '/partners/:id/seats', ({ path, body }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const b = obj(body)
    const license = findLicense(String(b.licenseId ?? ''))
    const quantity = Number(b.quantity)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw DemoApiError.validation({ quantity: 'Enter a whole number of 0 or more.' })
    const effectiveFrom = String(b.effectiveFrom ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw DemoApiError.validation({ effectiveFrom: 'Choose a date.' })
    const note = String(b.note ?? '').trim().slice(0, 500)
    const current = seatPool(data(), partner.id, license.id)
    const delta = quantity - current
    if (delta === 0) throw DemoApiError.validation({ quantity: 'The pool already has this many seats.' })
    if (license.kind === 'per_user' && quantity < taggedUsers(data(), partner.id, license.id)) throw conflict('seats_below_mapped')
    const createdByName = actorName()
    const createdAt = nowIso()
    if (delta > 0) {
      data().seatAllocations.push({
        id: store.nextId('seat_'),
        partnerId: partner.id,
        licenseId: license.id,
        quantity: delta,
        effectiveFrom,
        effectiveTo: null,
        note,
        reason: 'set',
        createdByName,
        createdAt,
      })
    } else {
      let remove = -delta
      const open = data()
        .seatAllocations.filter((a) => a.partnerId === partner.id && a.licenseId === license.id && a.effectiveTo === null)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt))
      for (const batch of open) {
        if (remove <= 0) break
        const closeOn = batch.effectiveFrom > effectiveFrom ? batch.effectiveFrom : effectiveFrom
        if (batch.quantity <= remove) {
          batch.effectiveTo = closeOn
          remove -= batch.quantity
        } else {
          batch.effectiveTo = closeOn
          const rest: SeatAllocation = {
            id: store.nextId('seat_'),
            partnerId: partner.id,
            licenseId: license.id,
            quantity: batch.quantity - remove,
            effectiveFrom: addDays(closeOn, 0),
            effectiveTo: null,
            note,
            reason: 'split',
            createdByName,
            createdAt,
          }
          data().seatAllocations.push(rest)
          remove = 0
        }
      }
    }
    recordAudit({
      action: 'partner.set_seats',
      entityType: 'partner',
      entityId: partner.id,
      partnerId: partner.id,
      before: { licenseCode: license.code, seats: current },
      after: { licenseCode: license.code, seats: quantity, effectiveFrom, note },
    })
    emitChanged('seats', 'partner-users', 'partners', 'dashboards', 'audit')
    return { licenseId: license.id, from: current, to: quantity, delta }
  })

  /* ----------------------------------------------------- price overrides */

  api.register('GET', '/partners/:id/license-overrides', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    return data()
      .licenses.map((l) => {
        const o = data().licenseOverrides.find((x) => x.partnerId === partner.id && x.licenseId === l.id)
        return { licenseId: l.id, name: l.name, code: l.code, kind: l.kind, isActive: l.isActive, defaultPrice: l.unitPrice, override: o ? o.unitPrice : null }
      })
      .filter((r) => r.isActive || r.override !== null)
      .sort((a, b) => Number(a.kind === 'addon') - Number(b.kind === 'addon') || a.name.localeCompare(b.name))
  })

  api.register('PUT', '/partners/:id/license-overrides/:licenseId', ({ path, body }) => {
    requireStaff('superadmin')
    const partner = findPartner(path.id!)
    const license = findLicense(path.licenseId!)
    const unitPrice = parsePrice(obj(body).unitPrice)
    const existing = data().licenseOverrides.find((o) => o.partnerId === partner.id && o.licenseId === license.id)
    const before = existing ? { ...existing } : null
    if (existing) existing.unitPrice = unitPrice
    else data().licenseOverrides.push({ partnerId: partner.id, licenseId: license.id, unitPrice })
    recordAudit({
      action: 'license.set_partner_rate',
      entityType: 'license',
      entityId: license.id,
      partnerId: partner.id,
      before,
      after: { partnerId: partner.id, licenseId: license.id, unitPrice },
    })
    emitChanged('seats', 'partners', 'audit')
    return { licenseId: license.id, unitPrice }
  })

  api.register('DELETE', '/partners/:id/license-overrides/:licenseId', ({ path }) => {
    requireStaff('superadmin')
    const partner = findPartner(path.id!)
    const license = findLicense(path.licenseId!)
    const existing = data().licenseOverrides.find((o) => o.partnerId === partner.id && o.licenseId === license.id)
    if (!existing) throw notFound('No override.')
    data().licenseOverrides = data().licenseOverrides.filter((o) => o !== existing)
    recordAudit({ action: 'license.delete_partner_rate', entityType: 'license', entityId: license.id, partnerId: partner.id, before: existing })
    emitChanged('seats', 'partners', 'audit')
    return { ok: true }
  })

  /* ------------------------------------------------------------- mapper */

  api.register('GET', '/partners/:id/mapper', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const users = data().partnerUsers.filter((u) => u.partnerId === partner.id && u.isActive)
    const byName = (a: PartnerUser, b: PartnerUser) => a.username.localeCompare(b.username)
    const licenses = data()
      .licenses.filter((l) => l.kind === 'per_user')
      .map((l) => {
        const mapped = users.filter((u) => u.licenseId === l.id).sort(byName)
        return {
          licenseId: l.id,
          name: l.name,
          code: l.code,
          isActive: l.isActive,
          seats: seatPool(data(), partner.id, l.id),
          used: mapped.length,
          unitPrice: effectiveLicensePrice(data(), partner.id, l.id),
          users: mapped.map(userDto),
        }
      })
      .filter((c) => c.seats > 0 || c.used > 0)
      .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name))
    const addons = data()
      .licenses.filter((l) => l.kind === 'addon')
      .map((l) => ({ licenseId: l.id, name: l.name, code: l.code, seats: seatPool(data(), partner.id, l.id), unitPrice: effectiveLicensePrice(data(), partner.id, l.id) }))
      .filter((a) => a.seats > 0)
    return {
      currency: partner.currency,
      licenses,
      unmapped: users.filter((u) => u.licenseId === null).sort(byName).map(userDto),
      addons,
    }
  })

  api.register('POST', '/partners/:id/mapper/assign', ({ path, body }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const b = obj(body)
    const user = findUser(partner.id, b.userId)
    const license = findLicense(String(b.licenseId ?? ''))
    if (license.kind === 'addon') throw new DemoApiError(400, 'addon_not_mappable')
    if (user.licenseId === license.id) return userDto(user)
    const used = taggedUsers(data(), partner.id, license.id)
    if (used >= seatPool(data(), partner.id, license.id)) throw conflict('No free seat')
    const before = { userId: user.id, licenseId: user.licenseId }
    user.licenseId = license.id
    moveMembership(user, license.id)
    recordAudit({
      action: 'partner.map_user_license',
      entityType: 'partner',
      entityId: partner.id,
      partnerId: partner.id,
      before,
      after: { userId: user.id, licenseId: license.id },
    })
    emitChanged('partner-users', 'seats', 'partners', 'audit')
    return userDto(user)
  })

  api.register('POST', '/partners/:id/mapper/unmap', ({ path, body }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const user = findUser(partner.id, obj(body).userId)
    if (user.licenseId === null) return userDto(user)
    const before = { userId: user.id, licenseId: user.licenseId }
    user.licenseId = null
    moveMembership(user, null)
    recordAudit({
      action: 'partner.map_user_license',
      entityType: 'partner',
      entityId: partner.id,
      partnerId: partner.id,
      before,
      after: { userId: user.id, licenseId: null },
    })
    emitChanged('partner-users', 'seats', 'partners', 'audit')
    return userDto(user)
  })

  api.register('POST', '/partners/:id/mapper/swap', ({ path, body }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const b = obj(body)
    const a = findUser(partner.id, b.userIdA)
    const c = findUser(partner.id, b.userIdB)
    if (!a.licenseId || !c.licenseId) throw new DemoApiError(400, 'swap_needs_two_mapped_users')
    if (a.licenseId === c.licenseId) throw new DemoApiError(400, 'swap_same_license')
    const before = { [a.id]: a.licenseId, [c.id]: c.licenseId }
    const la = a.licenseId
    a.licenseId = c.licenseId
    c.licenseId = la
    moveMembership(a, a.licenseId)
    moveMembership(c, c.licenseId)
    recordAudit({
      action: 'partner.swap_user_licenses',
      entityType: 'partner',
      entityId: partner.id,
      partnerId: partner.id,
      before,
      after: { [a.id]: a.licenseId, [c.id]: c.licenseId },
    })
    emitChanged('partner-users', 'seats', 'partners', 'audit')
    return { a: userDto(a), b: userDto(c) }
  })

  /* --------------------------------------------------------- user roster */

  api.register('GET', '/partners/:id/users', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    return data()
      .partnerUsers.filter((u) => u.partnerId === partner.id)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.username.localeCompare(b.username))
      .map(userDto)
  })

  api.register('PATCH', '/partners/:id/users/billing', ({ path, body }) => {
    requireStaff('superadmin')
    const partner = findPartner(path.id!)
    const b = obj(body)
    const ids = Array.isArray(b.userIds) ? b.userIds.map(String) : []
    if (ids.length === 0) throw DemoApiError.validation({ userIds: 'Select at least one user.' })
    const enabled = Boolean(b.billingEnabled)
    let updated = 0
    for (const u of data().partnerUsers) {
      if (u.partnerId === partner.id && ids.includes(u.id) && u.billingEnabled !== enabled) {
        u.billingEnabled = enabled
        updated += 1
      }
    }
    emitChanged('partner-users', 'seats', 'partners', 'dashboards')
    return { updated }
  })

  let syncRun = 0
  api.register('POST', '/partners/:id/sync/simulate', ({ path }) => {
    requireStaff('superadmin')
    const partner = findPartner(path.id!)
    syncRun += 1
    const rng = createRandom(`rigi-sync-${partner.id}-${syncRun}`)
    const at = nowIso()
    const today = isoDate(new Date())
    const key = data().apiKeys.find((k) => k.partnerId === partner.id && !k.revokedAt && k.scopes.includes('user_count:write'))
    const keyId = key?.keyId ?? 'demo_SYNCKEY0'
    if (key) key.lastUsedAt = at

    writeSystemLog({
      level: 'info',
      source: 'partner.auth.token',
      message: `Issued access token for ${keyId}`,
      partnerId: partner.id,
      context: { keyId, grant: 'client_credentials', expiresIn: 3600 },
    })

    const active = data().partnerUsers.filter((u) => u.partnerId === partner.id && u.isActive)
    const usernames = new Set(data().partnerUsers.filter((u) => u.partnerId === partner.id).map((u) => u.username))
    const events: Array<{ type: string; externalId: string; username: string }> = []

    const createdCount = rng.int(1, 3)
    for (let i = 0; i < createdCount; i += 1) {
      const [first] = rng.pick(FIRST_NAMES)
      const [last] = rng.pick(LAST_NAMES)
      let username = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '')
      while (usernames.has(username)) username = `${username}${rng.int(2, 9)}`
      usernames.add(username)
      const externalId = String(rng.int(5000, 9999))
      const user: PartnerUser = {
        id: store.nextId('pu_'),
        partnerId: partner.id,
        externalId,
        username,
        fullName: `${first} ${last}`,
        role: rng.pick(['agent', 'agent', 'agent', 'supervisor', 'quality analyst']),
        email: `${username}@${partner.name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
        status: 'Available',
        statusCode: 1,
        billingEnabled: true,
        licenseId: null,
        isActive: true,
        syncedAt: at,
        createdAt: at,
        deactivatedAt: null,
      }
      data().partnerUsers.push(user)
      data().membershipPeriods.push({
        id: store.nextId('mp_'),
        partnerId: partner.id,
        partnerUserId: user.id,
        licenseId: null,
        startedOn: today,
        endedOn: null,
        reason: 'created',
      })
      events.push({ type: 'user.created', externalId, username })
    }

    const deactivatedCount = Math.min(rng.int(0, 2), Math.max(0, active.length - 1))
    const pool = [...active]
    for (let i = 0; i < deactivatedCount; i += 1) {
      const idx = rng.int(0, pool.length - 1)
      const user = pool.splice(idx, 1)[0]!
      user.isActive = false
      user.deactivatedAt = at
      user.licenseId = null
      user.status = 'Offline'
      user.statusCode = 0
      user.syncedAt = at
      for (const m of data().membershipPeriods) {
        if (m.partnerUserId === user.id && m.endedOn === null) m.endedOn = today
      }
      events.push({ type: 'user.disabled', externalId: user.externalId, username: user.username })
    }

    const STATUSES: Array<[string, number]> = [
      ['Available', 1],
      ['In call', 2],
      ['Wrap-up', 3],
      ['On break', 4],
      ['Offline', 0],
    ]
    for (const u of pool) {
      if (rng.int(0, 2) === 0) {
        const [label, code] = rng.pick(STATUSES)
        u.status = label
        u.statusCode = code
      }
      u.syncedAt = at
    }

    writeSystemLog({
      level: 'info',
      source: 'partner.user_sync.events',
      message: `Received ${events.length} user events`,
      partnerId: partner.id,
      context: { keyId, count: events.length },
      payload: { events },
    })
    const activeNow = data().partnerUsers.filter((u) => u.partnerId === partner.id && u.isActive).length
    upsertUserCount(partner.id, today, activeNow)
    writeSystemLog({
      level: 'info',
      source: 'partner.user_sync.sync',
      message: `User sync complete: ${createdCount} created, ${deactivatedCount} deactivated, ${activeNow} active`,
      partnerId: partner.id,
      context: { keyId, created: createdCount, deactivated: deactivatedCount, active: activeNow },
    })
    emitChanged('partner-users', 'seats', 'partners', 'system-logs', 'api-keys', 'dashboards')
    return { created: createdCount, deactivated: deactivatedCount, active: activeNow }
  })

  /* ------------------------------------------------------------ API keys */

  api.register('GET', '/api-keys', ({ params }) => {
    requireStaff('superadmin')
    const showRevoked = String(params.showRevoked) === 'true'
    return data()
      .apiKeys.filter((k) => showRevoked || !k.revokedAt)
      .sort((a, b) => Number(Boolean(a.revokedAt)) - Number(Boolean(b.revokedAt)) || b.createdAt.localeCompare(a.createdAt))
      .map((k) => ({ ...k, partnerName: data().partners.find((p) => p.id === k.partnerId)?.name ?? '—' }))
  })

  api.register('POST', '/api-keys/:id/revoke', ({ path }) => {
    requireStaff('superadmin')
    const key = data().apiKeys.find((k) => k.id === path.id)
    if (!key) throw notFound('Key not found.')
    if (key.revokedAt) throw conflict('key_already_revoked')
    const before = { ...key }
    key.revokedAt = nowIso()
    recordAudit({ action: 'partner.revoke_api_key', entityType: 'partner', entityId: key.partnerId, partnerId: key.partnerId, before, after: { ...key } })
    emitChanged('api-keys', 'audit')
    return key
  })

  /* ------------------------------------------- accountant billing profile */

  api.register('GET', '/accountant/partners/:id', ({ path }) => {
    requireStaff('accountant')
    const partner = findPartner(path.id!)
    const now = new Date()
    const { year, month } = periodOf(now)
    const rate = rateForPeriod(data(), partner.id, year, month)
    const rateRow = data()
      .partnerRates.filter((r) => r.partnerId === partner.id)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
    const counts = data()
      .userCountDaily.filter((r) => r.partnerId === partner.id)
      .sort((a, b) => a.day.localeCompare(b.day))
    const since = addDays(isoDate(now), -89)
    const recent = counts.filter((r) => r.day >= since)
    const latest = counts[counts.length - 1] ?? null
    const invoices = data()
      .invoices.filter((i) => i.partnerId === partner.id)
      .sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth || b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        kind: i.kind,
        title: i.title,
        periodYear: i.periodYear,
        periodMonth: i.periodMonth,
        status: i.status,
        displayStatus: displayStatus(i, now),
        currency: i.currency,
        total: i.total,
        issuedAt: i.issuedAt,
        dueAt: i.dueAt,
        paidAt: i.paidAt,
      }))
    const summary = seatSummary(data(), partner.id)
    return {
      partner: {
        id: partner.id,
        name: partner.name,
        legalName: partner.legalName,
        currency: partner.currency,
        isActive: partner.isActive,
        companyId: partner.companyId,
        billingEmail: partner.billingEmail,
        invoiceGenerationDay: partner.invoiceGenerationDay,
      },
      rateCard: { ratePerPoint: rate.ratePerPoint, freeAllowance: rate.freeAllowance, effectiveFrom: rateRow?.effectiveFrom ?? null },
      users: {
        latest: latest?.userCount ?? null,
        day: latest?.day ?? null,
        history: recent.map((r) => r.userCount),
        active: summary.activeUsers,
        billed: summary.billedUsers,
      },
      points: { year, month, ...periodUsage(data(), partner.id, year, month) },
      license: {
        rows: summary.rows.map((r) => ({
          licenseId: r.license.id,
          name: r.license.name,
          code: r.license.code,
          kind: r.license.kind,
          seats: r.seats,
          taggedUsers: r.taggedUsers,
          unitPrice: r.unitPrice,
          monthlyCost: r.monthlyCost,
          isOverride: r.isOverride,
        })),
        totals: summary.totals,
        unassignedCount: summary.unassignedCount,
      },
      invoices,
    }
  })
}
