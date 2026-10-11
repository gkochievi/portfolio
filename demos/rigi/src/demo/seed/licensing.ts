/** License catalogue, overrides, seat pools, synced users, membership periods, daily counts. */
import { addDays, diffDays, firstDayOfPeriod, isoDate, parseIsoDate } from '@/demo/domain/dates'
import { newId } from '@/demo/domain/ids'
import type { ISODate, MembershipPeriod, PartnerUser, SeatAllocation } from '@/types'

import type { SeedCtx } from './ctx'
import { suspendedAt } from './people'
import { FIRST_NAMES, LAST_NAMES, LICENSE_OVERRIDES, LICENSES, PARTNERS, VAKE_ONBOARD_DAYS, type PartnerProfile } from './static'

const STATUSES: ReadonlyArray<readonly [readonly [string, number], number]> = [
  [['Available', 1], 5],
  [['In call', 2], 4],
  [['Wrap-up', 3], 1],
  [['On break', 4], 2],
  [['Offline', 0], 3],
]

function dayTime(ctx: SeedCtx, day: ISODate, hour: number, minute: number): string {
  const d = parseIsoDate(day)
  d.setHours(hour, minute, 0, 0)
  return ctx.clamp(d)
}

export function seedLicensing(ctx: SeedCtx): void {
  const { data, rng } = ctx
  LICENSES.forEach((l, i) => {
    data.licenses.push({
      id: newId('lic_'),
      code: l.code,
      name: l.name,
      kind: l.kind,
      unitPrice: l.unitPrice,
      currency: 'GEL',
      isActive: l.isActive,
      createdAt: ctx.at(l.code === 'LEGACY_SEAT' ? -1300 : -1200 + i * 25, 10, 0),
    })
  })
  const licId = (code: string) => data.licenses.find((l) => l.code === code)?.id ?? ''
  for (const [partnerId, code, unitPrice] of LICENSE_OVERRIDES) data.licenseOverrides.push({ partnerId, licenseId: licId(code), unitPrice })

  const today = ctx.day(0)
  const p6 = ctx.period(-6)
  const cutoverFrom = firstDayOfPeriod(p6.year, p6.month)
  /** Cutover memberships start the day before, so day 1 of P-6 is billed (hotel nights). */
  const cutoverDay = addDays(cutoverFrom, -1)
  const daysSinceCutover = diffDays(today, cutoverDay)

  for (const profile of PARTNERS) seedPartnerUsers(profile)

  function seedPartnerUsers(p: PartnerProfile): void {
    const lateOnboard = p.key === 'vake'
    const onboardDay = lateOnboard ? ctx.day(-VAKE_ONBOARD_DAYS) : cutoverDay
    const suspended = p.isActive ? null : suspendedAt(ctx)
    const usedUsernames = new Set<string>()
    let extSeq = 1000 + rng.int(0, 400)
    const lateJoins = new Map<string, ISODate[]>()

    const makeUser = (licenseCode: string | null, opts: { joinDay: ISODate; cutover: boolean; leftDay?: ISODate | null; role?: string; billing?: boolean; name?: [string, string] }): PartnerUser => {
      const [fl, fk] = opts.name ? [opts.name[0], opts.name[1]] : rng.pick(FIRST_NAMES)
      const [ll, lk] = opts.name ? ['', ''] : rng.pick(LAST_NAMES)
      let username = opts.name ? fl.toLowerCase().replace(/\s+/g, '.') : `${fl}.${ll}`.toLowerCase()
      let n = 2
      while (usedUsernames.has(username)) username = `${username.replace(/\d+$/, '')}${n++}`
      usedUsernames.add(username)
      const fullName = opts.name ? (p.georgianNames ? fk : fl) : p.georgianNames ? `${fk} ${lk}` : `${fl} ${ll}`
      const license = LICENSES.find((l) => l.code === licenseCode)
      const [status, statusCode] = opts.leftDay ? ['Deleted', 9] : rng.weighted(STATUSES)
      const createdAt = opts.cutover
        ? dayTime(ctx, addDays(onboardDay, -rng.int(5, Math.max(6, Math.min(400, -p.contractStartDays - 30)))), 9 + rng.int(0, 8), rng.int(0, 59))
        : dayTime(ctx, opts.joinDay, 9 + rng.int(0, 8), rng.int(0, 59))
      extSeq += 1 + rng.int(0, 3)
      const user: PartnerUser = {
        id: newId('pu_'),
        partnerId: p.id,
        externalId: String(extSeq),
        username,
        fullName,
        role: opts.role ?? license?.userRole ?? 'agent',
        email: `${username}@${p.domain}`,
        status,
        statusCode,
        billingEnabled: opts.billing ?? !rng.chance(0.03),
        licenseId: opts.leftDay ? null : licenseCode ? licId(licenseCode) : null,
        isActive: !opts.leftDay,
        syncedAt: suspended ?? ctx.ago(rng.next() * 0.4),
        createdAt,
        deactivatedAt: opts.leftDay ? dayTime(ctx, opts.leftDay, 18, rng.int(0, 59)) : null,
      }
      data.partnerUsers.push(user)
      return user
    }

    const period = (user: PartnerUser, licenseCode: string | null, startedOn: ISODate, endedOn: ISODate | null, reason: MembershipPeriod['reason']) =>
      data.membershipPeriods.push({ id: newId('mp_'), partnerId: p.id, partnerUserId: user.id, licenseId: licenseCode ? licId(licenseCode) : null, startedOn, endedOn, reason })

    const perUserCodes = Object.keys(p.seats).filter((code) => LICENSES.find((l) => l.code === code)?.kind === 'per_user')
    const perUserSeats = perUserCodes.reduce((acc, code) => acc + p.seats[code], 0)

    for (const code of perUserCodes) {
      const seats = p.seats[code]
      const free = p.free?.[code] ?? (seats >= 10 ? rng.int(0, 2) : rng.int(0, 1))
      const mapped = Math.max(0, seats - free)
      const joins: ISODate[] = []
      for (let i = 0; i < mapped; i += 1) {
        const late = !lateOnboard && p.isActive && code !== 'LEGACY_SEAT' && rng.chance(0.12)
        const joinDay = late ? ctx.day(-rng.int(8, daysSinceCutover - 5)) : onboardDay
        const user = makeUser(code, { joinDay, cutover: !late && !lateOnboard })
        if (late) joins.push(joinDay)
        // A few agents were promoted from Agent Basic to Agent Pro mid-history.
        if (!late && !lateOnboard && code === 'AGENT_PRO' && p.seats.AGENT_BASIC && rng.chance(0.18)) {
          const changeDay = ctx.day(-rng.int(20, daysSinceCutover - 20))
          period(user, 'AGENT_BASIC', onboardDay, changeDay, 'cutover')
          period(user, 'AGENT_PRO', changeDay, null, 'created')
        } else {
          period(user, code, joinDay, null, late || lateOnboard ? 'created' : 'cutover')
        }
      }
      lateJoins.set(code, joins.sort())
    }

    // Users without a license (new hires, not mapped yet) + one training account on big tenants.
    const unmapped = Math.max(1, Math.round(perUserSeats * 0.06))
    for (let i = 0; i < unmapped; i += 1) {
      const joinDay = p.isActive ? ctx.day(-rng.int(2, 45)) : onboardDay
      const user = makeUser(null, { joinDay, cutover: false })
      period(user, null, joinDay, null, 'created')
    }
    if (perUserSeats >= 45) {
      const user = makeUser(null, { joinDay: onboardDay, cutover: true, role: 'admin', billing: false, name: ['Training account', 'სატრენინგო ანგარიში'] })
      period(user, null, onboardDay, null, 'cutover')
    }

    // People who left during the history window.
    if (!lateOnboard) {
      const left = Math.max(1, Math.round(perUserSeats * 0.05))
      for (let i = 0; i < left; i += 1) {
        const code = rng.pick(perUserCodes)
        const leftDay = p.isActive ? ctx.day(-rng.int(10, daysSinceCutover - 10)) : isoDate(suspended ?? today)
        const user = makeUser(code, { joinDay: onboardDay, cutover: true, leftDay })
        period(user, code, onboardDay, leftDay, rng.chance(0.7) ? 'deleted' : 'disabled')
      }
    }

    // Seat pools.
    const firstFrom = lateOnboard ? onboardDay : cutoverFrom
    const allocation = (code: string, quantity: number, effectiveFrom: ISODate, effectiveTo: ISODate | null, reason: SeatAllocation['reason'], note: string, by = 'Nino Kapanadze') =>
      data.seatAllocations.push({ id: newId('seat_'), partnerId: p.id, licenseId: licId(code), quantity, effectiveFrom, effectiveTo, note, reason, createdByName: by, createdAt: dayTime(ctx, effectiveFrom, 10, 15) })
    for (const code of Object.keys(p.seats)) {
      const seats = p.seats[code]
      const joins = lateJoins.get(code) ?? []
      const k = joins.length
      const firstReason: SeatAllocation['reason'] = lateOnboard ? 'set' : 'cutover'
      const firstNote = lateOnboard ? 'Initial allocation' : 'Cutover from user tags'
      const lowered = (p.key === 'lukma' && code === 'AGENT_BASIC') || (p.key === 'talgha' && code === 'LEGACY_SEAT')
      if (lowered) {
        const extra = p.key === 'lukma' ? 4 : 6
        const p3 = ctx.period(-3)
        const lowerDay = addDays(firstDayOfPeriod(p3.year, p3.month), 9)
        allocation(code, seats - k + extra, firstFrom, addDays(lowerDay, -1), firstReason, firstNote)
        allocation(code, seats - k, lowerDay, null, 'split', `Pool lowered by ${extra} seats`, 'Levan Abashidze')
      } else {
        allocation(code, seats - k, firstFrom, null, firstReason, firstNote)
      }
      if (k > 0) allocation(code, k, joins[0], null, 'set', `Raised by ${k} for new agents`, rng.chance(0.5) ? 'Levan Abashidze' : 'Nino Kapanadze')
    }
  }

  // Daily user counts: 90 days x active partners, from the roster itself.
  for (const p of PARTNERS) {
    if (!p.isActive) continue
    const users = data.partnerUsers.filter((u) => u.partnerId === p.id)
    for (let offset = -89; offset <= 0; offset += 1) {
      const day = ctx.day(offset)
      const userCount = users.filter((u) => isoDate(u.createdAt) <= day && (!u.deactivatedAt || isoDate(u.deactivatedAt) > day)).length
      data.userCountDaily.push({ partnerId: p.id, day, userCount })
    }
  }
}
