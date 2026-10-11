/** Seat pools and license prices. Owner: seed. */
import type { DemoData, License } from '@/types'

import { round2 } from './money'

/** Override ?? catalog price (catalog is read as the partner's currency). */
export function effectiveLicensePrice(data: DemoData, partnerId: string, licenseId: string): number {
  const override = data.licenseOverrides.find((o) => o.partnerId === partnerId && o.licenseId === licenseId)
  if (override) return override.unitPrice
  return data.licenses.find((l) => l.id === licenseId)?.unitPrice ?? 0
}

export function hasLicenseOverride(data: DemoData, partnerId: string, licenseId: string): boolean {
  return data.licenseOverrides.some((o) => o.partnerId === partnerId && o.licenseId === licenseId)
}

/** Seats in the pool = sum of the open batches (effectiveTo null). */
export function seatPool(data: DemoData, partnerId: string, licenseId: string): number {
  return data.seatAllocations
    .filter((a) => a.partnerId === partnerId && a.licenseId === licenseId && a.effectiveTo === null)
    .reduce((acc, a) => acc + a.quantity, 0)
}

/** Active synced users mapped onto this license. */
export function taggedUsers(data: DemoData, partnerId: string, licenseId: string): number {
  return data.partnerUsers.filter((u) => u.partnerId === partnerId && u.isActive && u.licenseId === licenseId).length
}

export interface SeatSummaryRow {
  license: License
  unitPrice: number
  catalogPrice: number
  isOverride: boolean
  seats: number
  taggedUsers: number
  freeSeats: number
  monthlyCost: number
}

export interface SeatSummary {
  rows: SeatSummaryRow[]
  totals: { seats: number; perUserSeats: number; taggedUsers: number; monthlyCost: number }
  /** Active users without a license ("Users without a license"). */
  unassignedCount: number
  activeUsers: number
  billedUsers: number
}

/** Every license the partner holds seats on, has users on, or has an override for. */
export function seatSummary(data: DemoData, partnerId: string): SeatSummary {
  const rows: SeatSummaryRow[] = []
  for (const license of data.licenses) {
    const seats = seatPool(data, partnerId, license.id)
    const tagged = license.kind === 'per_user' ? taggedUsers(data, partnerId, license.id) : 0
    const isOverride = data.licenseOverrides.some((o) => o.partnerId === partnerId && o.licenseId === license.id)
    if (seats === 0 && tagged === 0 && !isOverride) continue
    const unitPrice = effectiveLicensePrice(data, partnerId, license.id)
    rows.push({
      license,
      unitPrice,
      catalogPrice: license.unitPrice,
      isOverride,
      seats,
      taggedUsers: tagged,
      freeSeats: license.kind === 'per_user' ? Math.max(0, seats - tagged) : 0,
      monthlyCost: round2(seats * unitPrice),
    })
  }
  const users = data.partnerUsers.filter((u) => u.partnerId === partnerId && u.isActive)
  return {
    rows,
    totals: {
      seats: rows.reduce((a, r) => a + r.seats, 0),
      perUserSeats: rows.filter((r) => r.license.kind === 'per_user').reduce((a, r) => a + r.seats, 0),
      taggedUsers: rows.reduce((a, r) => a + r.taggedUsers, 0),
      monthlyCost: round2(rows.reduce((a, r) => a + r.monthlyCost, 0)),
    },
    unassignedCount: users.filter((u) => u.licenseId === null).length,
    activeUsers: users.length,
    billedUsers: users.filter((u) => u.billingEnabled).length,
  }
}
