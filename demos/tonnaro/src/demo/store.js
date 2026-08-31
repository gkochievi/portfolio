/**
 * The demo's database.
 *
 * A deep copy of the JSON seed, rebased so the archive always reads as if the
 * yard had been dispatching trucks right up to this morning, held in memory
 * for the life of the tab. Nothing here touches localStorage, sessionStorage
 * or IndexedDB: every visitor opens the same pristine fleet, and a reload puts
 * it back.
 *
 * The rows are the shapes the *database* held, not the shapes the API
 * returned. `status_display`, the `*_detail` expansions, `image_count`,
 * `is_cancellable`, `is_busy`, `active_orders_count` and every absolute media
 * URL are serializer work and live in the handler modules. `schema.md` is the
 * field-by-field contract; three of its conventions are the ones actually
 * worth restating here, because they are what a reader trips over:
 *
 *   · Foreign keys are `_id` scalars and many-to-manys are `_ids` arrays —
 *     `Order.assigned_vehicle` is `assigned_vehicle_id`, `Service.car_categories`
 *     is `car_category_ids`.
 *   · `Order.route_stops` is a JSON **string**, because Django kept it in a
 *     TextField. The detail serializer parses it on read and an admin PATCH
 *     writes it back as a string; holding the string is what makes that
 *     asymmetry reproducible rather than accidental.
 *   · Decimal columns are strings at the model's precision, as
 *     `COERCE_DECIMAL_TO_STRING` left them, so a capacity that rendered as
 *     '12.50' upstream is '12.50' here and not a float that prints as 12.5.
 *
 * Image fields hold a bare path under `public/media/` rather than a URL, so
 * the seed survives a change of base path — `demo/base.js:mediaUrl()` builds
 * the URL. Once someone uploads a photo the same field holds an object URL
 * instead, which `mediaUrl()` passes through untouched and `resetStore()`
 * revokes.
 *
 * This module and `./auth.js` import each other. The cycle is safe because
 * neither touches the other's binding while the modules are evaluating —
 * `auth.js` only reads `store` inside its functions, and `clearBlacklist` is
 * a hoisted declaration this file calls only from `resetStore()`.
 */
import { clearBlacklist } from './auth'
import { dateKey, shiftDayKey, todayKey, TIME_ZONE } from './query'

import carOwnerRows from './seed/car-owners.json'
import categoryRows from './seed/categories.json'
import companyContractRows from './seed/company-contracts.json'
import driverRows from './seed/drivers.json'
import landingRow from './seed/landing.json'
import orderEditHistoryRows from './seed/order-edit-history.json'
import orderImageRows from './seed/order-images.json'
import orderRows from './seed/orders.json'
import orderStatusHistoryRows from './seed/order-status-history.json'
import pricingConfigRow from './seed/pricing-config.json'
import pricingElevationRows from './seed/pricing-elevation.json'
import pricingEquipmentRows from './seed/pricing-equipment.json'
import pricingPumpMixerRows from './seed/pricing-pump-mixer.json'
import pricingRateRows from './seed/pricing-rates.json'
import pricingZoneRows from './seed/pricing-zones.json'
import restrictedTimeWindowRows from './seed/restricted-time-windows.json'
import seoRow from './seed/seo.json'
import serviceRows from './seed/services.json'
import siteSettingsRow from './seed/site-settings.json'
import termsRow from './seed/terms.json'
import userRows from './seed/users.json'
import vehicleImageRows from './seed/vehicle-images.json'
import vehicleRows from './seed/vehicles.json'
import verificationTokenRows from './seed/verification-tokens.json'

const DAY = 86_400_000
const MINUTE = 60_000

/**
 * The seed tables, keyed the way the store exposes them. Four of them are
 * singletons rather than lists — Django pinned each to pk=1 and `get_instance()`
 * could never 404, so they are objects here and `nextId()` refuses them.
 */
const SEED = {
  users: userRows,
  companyContracts: companyContractRows,
  verificationTokens: verificationTokenRows,
  categories: categoryRows,
  restrictedTimeWindows: restrictedTimeWindowRows,
  services: serviceRows,
  carOwners: carOwnerRows,
  vehicles: vehicleRows,
  vehicleImages: vehicleImageRows,
  drivers: driverRows,
  orders: orderRows,
  orderImages: orderImageRows,
  orderStatusHistory: orderStatusHistoryRows,
  orderEditHistory: orderEditHistoryRows,
  pricingConfig: pricingConfigRow,
  pricingZones: pricingZoneRows,
  pricingRates: pricingRateRows,
  pricingElevation: pricingElevationRows,
  pricingPumpMixer: pricingPumpMixerRows,
  pricingEquipment: pricingEquipmentRows,
  landingSettings: landingRow,
  siteSettings: siteSettingsRow,
  seoSettings: seoRow,
  terms: termsRow,
}

/* --------------------------------------------------------------- lifecycle */

/**
 * Mirrors of the class attributes on `orders.models.Order`. They describe the
 * data rather than any one endpoint, and three handler modules plus the
 * relation walks below all need the same answer to "does this order hold a
 * truck", so there is one copy and it lives with the rows.
 */
export const STATUS_PROGRESSION = [
  'new', 'under_review', 'offer_sent', 'approved', 'in_progress', 'completed',
]
export const CANCELLABLE_STATUSES = ['new', 'under_review', 'offer_sent']
/** An outstanding offer occupies the vehicle too — admins must not double-book
 *  a truck while the customer is still deciding. */
export const ACTIVE_STATUSES = ['offer_sent', 'approved', 'in_progress']
export const RELEASED_STATUSES = ['completed', 'rejected', 'cancelled']

const ACTIVE = new Set(ACTIVE_STATUSES)
const TERMINAL = new Set(RELEASED_STATUSES)

export function isActiveStatus(status) {
  return ACTIVE.has(status)
}

/** `completed`, `rejected` and `cancelled` freeze the row: every write 400s. */
export function isTerminalStatus(status) {
  return TERMINAL.has(status)
}

/* ------------------------------------------------------------------- clock */

/*
 * Every day boundary the demo draws is drawn in `Asia/Tbilisi`, the zone
 * Django ran in, not the visitor's. Upstream the server bucketed by `__date`
 * in that zone and the page printed the result in it; bucketing locally
 * instead would have a dashboard opened in Auckland report "3 orders today"
 * over a list whose newest nine rows all read today's date. `query.js` owns
 * `dateKey`/`todayKey`/`shiftDayKey` so the filters and the rebase below
 * cannot drift apart.
 */

/** Whole days between two `YYYY-MM-DD` keys, in milliseconds. */
function dayKeyDistance(from, to) {
  const utc = (key) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return utc(to) - utc(from)
}

const ZONE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Milliseconds to add to UTC to reach wall-clock time in Tbilisi at `at`. */
function zoneOffset(at) {
  const parts = ZONE_PARTS.formatToParts(at)
  const part = (type) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  // `hour12: false` renders midnight as 24 on some engines; fold it back to 0.
  const wall = Date.UTC(
    part('year'), part('month') - 1, part('day'),
    part('hour') % 24, part('minute'), part('second'),
  )
  return wall - at
}

/** The instant local midnight opens on `key`. */
function dayStartMs(key) {
  const [year, month, day] = key.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day)
  // Guess with the offset read at the wall time, then re-read it at the guess,
  // so a zone that shifts overnight still lands on the right instant.
  return wall - zoneOffset(wall - zoneOffset(wall))
}

/* ------------------------------------------------------------------ rebase */

/**
 * Timestamps that record something which has already happened. These are
 * shifted, squeezed into the elapsed part of today, and finally clamped so
 * nothing in the archive is newer than the moment it is read.
 */
const PAST_FIELDS = {
  users: ['created_at', 'updated_at', 'last_login', 'accepted_terms_at'],
  companyContracts: ['created_at'],
  verificationTokens: ['created_at', 'last_sent_at', 'used_at'],
  categories: ['created_at', 'updated_at'],
  restrictedTimeWindows: ['created_at', 'updated_at'],
  services: ['created_at', 'updated_at'],
  carOwners: ['created_at', 'updated_at'],
  vehicles: ['created_at', 'updated_at'],
  vehicleImages: ['created_at'],
  drivers: ['created_at', 'updated_at'],
  orders: [
    'created_at', 'updated_at', 'last_event_at', 'customer_accepted_at', 'admin_edited_at',
  ],
  orderImages: ['created_at'],
  orderStatusHistory: ['created_at'],
  orderEditHistory: ['changed_at'],
  pricingZones: ['updated_at'],
  pricingRates: ['updated_at'],
  pricingEquipment: ['updated_at'],
}

/**
 * Timestamps that name a moment still to come. A booked slot is *supposed* to
 * be in the future, so these get the day shift and nothing else — squeezing a
 * job scheduled for 15:00 into the part of the day that has already elapsed
 * would move a real booking, and clamping it to now would delete the booking
 * window entirely.
 */
const FUTURE_FIELDS = {
  orders: ['scheduled_from', 'scheduled_to'],
  verificationTokens: ['expires_at'],
}

/**
 * Date columns whose meaning is relative to today, shifted by the same whole
 * number of days. `date_of_birth` is deliberately absent: a birth date is a
 * fact about a person rather than a position relative to now, and sliding it
 * every time the demo is opened would be the wrong kind of realism.
 */
const DAY_FIELDS = {
  orders: ['requested_date'],
  drivers: ['license_expiry', 'hire_date'],
}

const SINGLETONS = ['pricingConfig', 'landingSettings', 'siteSettings', 'seoSettings']

function shiftIso(value, offset) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed + offset).toISOString() : value
}

function eachRow(data, table, apply) {
  const rows = data[table]
  if (Array.isArray(rows)) rows.forEach(apply)
  else if (rows) apply(rows)
}

/**
 * Slide the whole world so the newest order was placed today.
 *
 * The seed carries absolute dates, so without this the dashboard's seven-day
 * trend, the "requested today" tab, the licence-expiry warnings and the
 * scheduling windows all go stale the first time the demo is opened on a later
 * day than it was written — and staler every month after that. The offset is a
 * whole number of days measured in Tbilisi, so every row keeps its time of day
 * and the seed's mornings stay mornings.
 */
function rebase(data) {
  let newest = Number.NEGATIVE_INFINITY
  for (const order of data.orders) {
    const parsed = Date.parse(order.created_at)
    if (Number.isFinite(parsed) && parsed > newest) newest = parsed
  }

  if (Number.isFinite(newest)) {
    const offset = dayKeyDistance(dateKey(newest), todayKey())
    if (offset !== 0) {
      const days = Math.round(offset / DAY)

      for (const [table, fields] of Object.entries(PAST_FIELDS)) {
        eachRow(data, table, (row) => {
          for (const field of fields) {
            if (row[field]) row[field] = shiftIso(row[field], offset)
          }
        })
      }
      for (const [table, fields] of Object.entries(FUTURE_FIELDS)) {
        eachRow(data, table, (row) => {
          for (const field of fields) {
            if (row[field]) row[field] = shiftIso(row[field], offset)
          }
        })
      }
      for (const [table, fields] of Object.entries(DAY_FIELDS)) {
        eachRow(data, table, (row) => {
          for (const field of fields) {
            if (row[field]) row[field] = shiftDayKey(row[field], days)
          }
        })
      }
      for (const table of SINGLETONS) {
        if (data[table]?.updated_at) {
          data[table].updated_at = shiftIso(data[table].updated_at, offset)
        }
      }
    }
  }

  compressToday(data)
  rearmTokens(data)
  spreadRequestedDates(data)
}

/**
 * Pull today's rows back into the part of the day that has actually happened.
 *
 * The shift above moves whole days, so every row keeps its time of day — which
 * means the anchor day's afternoon rows land in the *future* for anyone opening
 * the demo before then, i.e. all of European and US business hours. Django
 * could not produce that: `created_at` is `auto_now_add` and `last_event_at`
 * follows it. Squeezing the anchor day into the elapsed fraction of today keeps
 * the ordering and the spread while putting nothing after now.
 */
function compressToday(data) {
  const today = todayKey()
  const dayStart = dayStartMs(today)
  const now = Date.now()
  const scale = Math.min(Math.max(now - dayStart, 0) / DAY, 1)

  const squeeze = (value) => {
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return value
    const at = dateKey(parsed) === today ? dayStart + (parsed - dayStart) * scale : parsed
    // Belt and braces: a row whose day survived the shift ahead of the anchor
    // still may not be newer than the moment it is read.
    return new Date(Math.min(at, now)).toISOString()
  }

  for (const [table, fields] of Object.entries(PAST_FIELDS)) {
    eachRow(data, table, (row) => {
      for (const field of fields) {
        if (row[field]) row[field] = squeeze(row[field])
      }
    })
  }
  for (const table of SINGLETONS) {
    if (data[table]?.updated_at) data[table].updated_at = squeeze(data[table].updated_at)
  }

  // The clamp can collapse two timestamps that used to be minutes apart onto
  // the same instant, and an order that was touched after it was placed must
  // still read that way.
  for (const order of data.orders) {
    if (Date.parse(order.updated_at) < Date.parse(order.created_at)) {
      order.updated_at = order.created_at
    }
    if (Date.parse(order.last_event_at) < Date.parse(order.created_at)) {
      order.last_event_at = order.created_at
    }
  }
}

/**
 * Re-arm the verification and password-reset codes against the real clock.
 *
 * These rows exist so the "check your email" screens can be walked end to end
 * in a demo that has no email, and their whole point is a short window — ten
 * minutes to confirm an address, thirty to reset a password. A whole-day shift
 * preserves the window's *length* but not its position: it lands wherever the
 * seed's authoring hour was, which is expired the rest of the day. So an unused
 * token is re-issued as if it had been sent ninety seconds ago, which is also
 * far enough back to clear the thirty-second resend cooldown.
 */
function rearmTokens(data) {
  const now = Date.now()
  const ttl = { verify_email: 10 * MINUTE, password_reset: 30 * MINUTE }

  for (const token of data.verificationTokens) {
    if (token.used_at) continue
    token.created_at = new Date(now - 90_000).toISOString()
    token.last_sent_at = token.created_at
    token.expires_at = new Date(now + (ttl[token.purpose] ?? 10 * MINUTE)).toISOString()
  }
}

const TODAY_TARGET = 3
const FUTURE_TARGET = 3

/**
 * Arrange the requested dates so the demo always opens on a working week.
 *
 * A uniform shift preserves the spread but not the *mix*: a seed written on a
 * quiet Tuesday rebases into "nothing due today", which empties the admin's
 * Today tab and zeroes a view count that ought to be the busiest number on the
 * page. Rather than reshuffle statuses — which would contradict every price,
 * assignment and history row hanging off them — only the dates move, and only
 * as far as they must.
 *
 * Two invariants come first, because they are correctness rather than
 * presentation: nothing is requested for a day before it was ordered, and a
 * finished, rejected or cancelled job is never dated in the future.
 */
function spreadRequestedDates(data) {
  const today = todayKey()

  for (const order of data.orders) {
    const placed = dateKey(order.created_at)
    if (order.requested_date < placed) order.requested_date = placed
    if (isTerminalStatus(order.status) && order.requested_date > today) {
      order.requested_date = today
    }
  }

  const live = data.orders.filter((order) => !isTerminalStatus(order.status))
  const spoken = new Set()
  const claim = (order) => spoken.add(order.id)

  const ahead = live.filter((order) => order.requested_date > today)
  ahead.forEach(claim)
  nearest(live, spoken, today, FUTURE_TARGET - ahead.length, statusesOf(ahead)).forEach(
    (order, index) => {
      order.requested_date = shiftDayKey(today, index + 1)
      claim(order)
    },
  )

  const onToday = live.filter((order) => order.requested_date === today && !spoken.has(order.id))
  onToday.forEach(claim)
  nearest(live, spoken, today, TODAY_TARGET - onToday.length, statusesOf(onToday)).forEach(
    (order) => {
      order.requested_date = today
      claim(order)
    },
  )
}

function statusesOf(orders) {
  return new Set(orders.map((order) => order.status))
}

/**
 * The `need` unclaimed orders whose dates are closest to `today` — moving the
 * nearest one is the least visible nudge. A status the bucket already holds is
 * a weaker candidate than one it does not, so filling the Today tab produces a
 * mixed list rather than three identical `new` rows.
 */
function nearest(orders, spoken, today, need, covered = new Set()) {
  if (need <= 0) return []

  return orders
    .filter((order) => !spoken.has(order.id))
    .map((order) => ({
      order,
      duplicate: covered.has(order.status) ? 1 : 0,
      distance: Math.abs(dayKeyDistance(order.requested_date, today)),
    }))
    .sort((a, b) => a.duplicate - b.duplicate || a.distance - b.distance)
    .slice(0, need)
    .map((entry) => entry.order)
}

/* ------------------------------------------------------------------- store */

function hydrate() {
  const data = structuredClone(SEED)
  rebase(data)
  return data
}

/**
 * Live binding: `resetStore()` refills this object rather than replacing it,
 * so every module that imported it keeps looking at the right data. The
 * corollary is that a handler must read `store.orders` at call time — a module
 * that hoists the array into a local goes stale on the next reset.
 */
export const store = hydrate()

/* --------------------------------------------------------------------- ids */

let counters = highestIds(store)

/** Derived from whatever arrays the store holds, so adding a table needs no
 *  edit here. */
function highestIds(data) {
  const counts = {}
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue
    counts[table] = rows.reduce((max, row) => Math.max(max, row.id ?? 0), 0) + 1
  }
  return counts
}

/** Ids continue from the seed's highest and are never reused, like a sequence. */
export function nextId(table) {
  if (!(table in counters)) throw new Error(`No id sequence for "${table}"`)
  const id = counters[table]
  counters[table] = id + 1
  return id
}

/** `Order.public_id` — the non-sequential identifier customer URLs use so the
 *  numeric id, and the order volume it leaks, stays out of them. */
export function newPublicId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

/* ------------------------------------------------------------- object URLs */

/** Minted for uploaded photos and avatars, so a reset can free them. */
const objectUrls = new Set()

export function trackObjectUrl(url) {
  objectUrls.add(url)
  return url
}

/** Revokes a tracked URL; safe to call with a seed path, a null or a blank. */
export function releaseObjectUrl(url) {
  if (url && objectUrls.delete(url)) URL.revokeObjectURL(url)
}

export function resetStore() {
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.clear()
  Object.assign(store, hydrate())
  counters = highestIds(store)
  // Tokens minted before the reset still name real rows, so the sign-in
  // survives — but a refresh token spent against the old world should not be
  // dead in the new one.
  clearBlacklist()
}

/* ----------------------------------------------------------------- lookups
 *
 * Linear scans over twenty-nine orders and eighteen trucks: cheaper than the
 * indexes that would have to be kept honest across every mutation, and honest
 * about what the numbers actually are.
 */

function byId(rows, id) {
  return id === null || id === undefined ? undefined : rows.find((row) => row.id === id)
}

export function userById(id) { return byId(store.users, id) }
export function orderById(id) { return byId(store.orders, id) }
export function categoryById(id) { return byId(store.categories, id) }
export function serviceById(id) { return byId(store.services, id) }
export function vehicleById(id) { return byId(store.vehicles, id) }
export function driverById(id) { return byId(store.drivers, id) }
export function carOwnerById(id) { return byId(store.carOwners, id) }
export function contractById(id) { return byId(store.companyContracts, id) }
export function zoneById(id) { return byId(store.pricingZones, id) }
export function rateById(id) { return byId(store.pricingRates, id) }
export function equipmentById(id) { return byId(store.pricingEquipment, id) }

/** `email__iexact` — every lookup upstream is case-insensitive even though the
 *  unique constraint underneath it is not. */
export function userByEmail(email) {
  const wanted = String(email ?? '').trim().toLowerCase()
  if (!wanted) return undefined
  return store.users.find((user) => user.email.toLowerCase() === wanted)
}

/** The customer routes accept either the UUID or the legacy numeric pk, because
 *  navigation writes `public_id || id` and old bookmarks carry the number. */
export function orderByLookup(lookup) {
  const key = String(lookup ?? '')
  const numeric = Number(key)
  return store.orders.find(
    (order) => order.public_id === key || (Number.isInteger(numeric) && order.id === numeric),
  )
}

export function zoneBySlug(slug) {
  return store.pricingZones.find((zone) => zone.slug === slug)
}

/** `unique_together = ('type', 'zone')`. */
export function rateFor(type, zone) {
  return store.pricingRates.find((rate) => rate.type === type && rate.zone === zone)
}

export function pumpRateFor(kind) {
  return store.pricingPumpMixer.find((rate) => rate.kind === kind)
}

/* --------------------------------------------------------- relation walks */

export function ordersForUser(userId) {
  return store.orders.filter((order) => order.user_id === userId)
}

export function contractsForUser(userId) {
  return store.companyContracts
    .filter((contract) => contract.user_id === userId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

/** The newest unused token of a purpose. Issuing a new one marks the older
 *  rows used, so at most one is ever live per (user, purpose). */
export function activeTokenFor(userId, purpose) {
  const now = Date.now()
  return store.verificationTokens.find(
    (token) => token.user_id === userId
      && token.purpose === purpose
      && !token.used_at
      && Date.parse(token.expires_at) > now,
  )
}

export function imagesForOrder(orderId) {
  return store.orderImages.filter((image) => image.order_id === orderId)
}

/**
 * `Meta.ordering = ['-created_at']`. The seed files are written oldest-first
 * because that is how a history reads on the page; the reversal happens here
 * so both the customer timeline and the admin undo banner — which takes
 * `status_history[0]` as "latest" — see what Django gave them.
 */
export function statusHistoryForOrder(orderId) {
  return store.orderStatusHistory
    .filter((entry) => entry.order_id === orderId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

/** `Meta.ordering = ['-changed_at']`, same reasoning. */
export function editHistoryForOrder(orderId) {
  return store.orderEditHistory
    .filter((entry) => entry.order_id === orderId)
    .sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at))
}

export function windowsForCategory(categoryId) {
  return store.restrictedTimeWindows.filter((window) => window.category_id === categoryId)
}

export function categoriesForService(service) {
  return (service?.car_category_ids ?? [])
    .map((id) => categoryById(id))
    .filter(Boolean)
}

export function servicesForCategory(categoryId) {
  return store.services.filter((service) => service.car_category_ids.includes(categoryId))
}

export function categoriesForVehicle(vehicle) {
  return (vehicle?.category_ids ?? []).map((id) => categoryById(id)).filter(Boolean)
}

export function vehiclesForCategory(categoryId) {
  return store.vehicles.filter((vehicle) => vehicle.category_ids.includes(categoryId))
}

/** Django owns this m2m on Driver; `Vehicle.drivers` is the reverse accessor. */
export function vehiclesForDriver(driver) {
  return (driver?.vehicle_ids ?? []).map((id) => vehicleById(id)).filter(Boolean)
}

export function driversForVehicle(vehicleId) {
  return store.drivers.filter((driver) => driver.vehicle_ids.includes(vehicleId))
}

/** `['-is_primary', 'order', 'created_at']` — the primary photo first, so
 *  `images[0]` is the one the landing page and the row tile show. */
export function imagesForVehicle(vehicleId) {
  return store.vehicleImages
    .filter((image) => image.vehicle_id === vehicleId)
    .sort((a, b) => (
      Number(b.is_primary) - Number(a.is_primary)
      || a.order - b.order
      || Date.parse(a.created_at) - Date.parse(b.created_at)
    ))
}

export function vehiclesForOwner(ownerId) {
  return store.vehicles.filter((vehicle) => vehicle.owner_id === ownerId)
}

/** Every order a car owner earns from, walked through the vehicles they own —
 *  there is no direct link, which is why the owner metrics are annotations
 *  upstream rather than columns. */
export function ordersForOwner(ownerId) {
  const owned = new Set(vehiclesForOwner(ownerId).map((vehicle) => vehicle.id))
  return store.orders.filter((order) => owned.has(order.assigned_vehicle_id))
}

/** The orders holding a vehicle right now — what `active_orders_count`, the
 *  Busy tag and the double-booking guard all count. */
export function activeOrdersForVehicle(vehicleId) {
  return store.orders.filter(
    (order) => order.assigned_vehicle_id === vehicleId && ACTIVE.has(order.status),
  )
}

export function activeOrdersForDriver(driverId) {
  return store.orders.filter(
    (order) => order.assigned_driver_id === driverId && ACTIVE.has(order.status),
  )
}
