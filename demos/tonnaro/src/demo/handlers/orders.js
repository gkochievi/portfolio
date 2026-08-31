/**
 * The orders app, both sides of it — a port of `orders/views.py`,
 * `orders/serializers.py`, `orders/assignment.py` and `orders/auto_assign.py`.
 *
 * This is the only module in the demo where reads are not reads. Two of the
 * GETs upstream mutate, and both mutations are load-bearing:
 *
 *   · `GET /orders/<lookup>/` clears the customer's unread flag, which is what
 *     makes the red dot on their orders list go away.
 *   · `GET /orders/admin/<id>/` marks the order read for the admin, flips a
 *     fresh `new` order to `under_review` behind an `is_auto_promotion` history
 *     row the page then offers to undo for sixty seconds, runs the
 *     auto-assigner, and can re-price the order. A read-only mock leaves every
 *     freshly created demo order sitting unassigned and unpriced with an undo
 *     banner that can never arm.
 *
 * The other thing to state up front is the event stamp. `last_event_at` is the
 * demo's entire realtime story: five pages poll a notifications endpoint, diff
 * `latest_event_at` against what they last saw, and silently refetch when it
 * moves forward. So every write here goes through `stampEvent()`, and nothing
 * that changes an order may skip it — including a bare verify-checkmark toggle,
 * which upstream also marks the order unread for the customer. `stampEvent` is
 * where that asymmetry lives: a customer action marks the order unread for the
 * admin, an admin action for the customer, and neither ever marks it unread for
 * whoever performed it.
 *
 * Three shapes to keep straight:
 *
 *   · `route_stops` is a JSON **string** on the row and in every write, but a
 *     parsed **object** in `OrderDetail`. `OrderDetailSerializer.get_route_stops`
 *     json.loads it and the admin edit modal JSON.stringifies it back, so both
 *     directions have to be handled or the modal writes `[object Object]` into
 *     the field.
 *   · `price` is a positive integer rounded *up* to the next multiple of ten
 *     while `pricing_breakdown.total` keeps the exact figure. They disagree by
 *     design, and the breakdown panel prints both.
 *   · Both history tables come back newest-first. The customer timeline renders
 *     array order top to bottom and the admin undo banner reads
 *     `status_history[0]` as "latest", so a chronological array breaks both.
 */
import { file, notFound, register, DemoApiError } from '../router'
import {
  applyDateRange,
  applyFilters,
  applyMultiFilter,
  applyOrdering,
  applySearch,
  paginate,
  todayKey,
  TIME_ZONE,
} from '../query'
import { NoRouteError, routeSummaryFor, synthesizeRoute } from '../routing'
import {
  hasField,
  mediaField,
  orderStatusDisplay,
  readBody,
  readFiles,
  storeUpload,
} from '../serialize'
import {
  ACTIVE_STATUSES,
  CANCELLABLE_STATUSES,
  STATUS_PROGRESSION,
  categoryById,
  driverById,
  editHistoryForOrder,
  imagesForOrder,
  isTerminalStatus,
  newPublicId,
  nextId,
  orderById,
  serviceById,
  statusHistoryForOrder,
  store,
  userById,
  vehicleById,
} from '../store'
// The nested payloads an order embeds are, field for field, the ones the
// catalog endpoints serve — an order's `assigned_vehicle_detail` *is* a row of
// `/vehicles/admin/`. Importing them rather than re-deriving them is what stops
// the two drifting the day someone adds a column.
import {
  serializeCategoryPublic,
  serializeServicePublic,
  serializeVehicleList,
} from './catalog'
import { serializeUser } from './auth'
// One pricing engine for the whole demo: the wizard's preview, the price
// stamped at creation and the admin's Recalculate all go through it, which is
// the only way three screens agree to the lari.
import { quote } from './pricing'

const MAX_ORDER_IMAGES = 10
const UNDO_WINDOW_MS = 60_000

/** The five statuses both notification endpoints count as "active" — wider
 *  than `ACTIVE_STATUSES`, which is about holding a truck rather than being
 *  live. */
const OPEN_STATUSES = ['new', 'under_review', 'offer_sent', 'approved', 'in_progress']

const ORDER_STATUSES = [
  'new', 'under_review', 'offer_sent', 'approved',
  'rejected', 'in_progress', 'completed', 'cancelled',
]

/** `get_urgency_display()`. Nothing outside this module renders it — the UI
 *  translates `urgency` itself — but the CSV export prints it, so it is the
 *  label rather than the key. */
const URGENCY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
const URGENCIES = Object.keys(URGENCY_LABELS)

const DRIVER_STATUS_LABELS = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' }

function nowIso() {
  return new Date().toISOString()
}

function num(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** `User.full_name` — a property, and unlike `Driver`'s it does not strip, so a
 *  user with no surname serialises with the trailing space Django gave it. */
function userFullName(row) {
  return row ? `${row.first_name} ${row.last_name}` : ''
}

function driverFullName(row) {
  return row ? `${row.first_name} ${row.last_name}`.trim() : ''
}

/* ---------------------------------------------------------- field parsing
 *
 * Enough of DRF's fields to produce the errors the forms render. Every one
 * answers `{value}` or `{error}` and never both, so a whole serializer's worth
 * of failures can be collected and reported in one 400 the way Django reported
 * them — rather than one per round trip.
 *
 * Multipart matters here: the order form posts `FormData`, so every value
 * arrives as a string ('true', '4200', '') and a field the client chose not to
 * send is absent rather than null. Absent-versus-null is the distinction a
 * PATCH lives on, which is why `hasField()` is asked separately from the value.
 */

const REQUIRED = 'This field is required.'
const BLANK = 'This field may not be blank.'
const NOT_NULL = 'This field may not be null.'

function charField(raw, { required = true, allowBlank = false, maxLength } = {}) {
  if (raw === undefined) return required ? { error: REQUIRED } : {}
  if (raw === null) return allowBlank ? { value: '' } : { error: NOT_NULL }
  const value = String(raw).trim()
  if (!value && !allowBlank) return { error: BLANK }
  if (maxLength && value.length > maxLength) {
    return { error: `Ensure this field has no more than ${maxLength} characters.` }
  }
  return { value }
}

function floatField(raw, { min, max } = {}) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const value = Number(raw)
  if (!Number.isFinite(value)) return { error: 'A valid number is required.' }
  if (min !== undefined && value < min) {
    return { error: `Ensure this value is greater than or equal to ${min}.` }
  }
  if (max !== undefined && value > max) {
    return { error: `Ensure this value is less than or equal to ${max}.` }
  }
  return { value }
}

function intField(raw, { min, max } = {}) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const value = Number(raw)
  if (!Number.isInteger(value)) return { error: 'A valid integer is required.' }
  if (min !== undefined && value < min) {
    return { error: `Ensure this value is greater than or equal to ${min}.` }
  }
  if (max !== undefined && value > max) {
    return { error: `Ensure this value is less than or equal to ${max}.` }
  }
  return { value }
}

/** `BooleanField` over multipart, where the wizard sends the words 'true' and
 *  'false' because `FormData` cannot carry a boolean. */
function boolField(raw, fallback = false) {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw === 'boolean') return raw
  return ['true', 'True', '1', 'on'].includes(String(raw))
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATE_FORMAT = 'Date has wrong format. Use one of these formats instead: YYYY-MM-DD.'

function dateField(raw, { required = false } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    return required ? { error: REQUIRED } : { value: null }
  }
  const value = String(raw).trim()
  if (!DATE_PATTERN.test(value)) return { error: DATE_FORMAT }
  const [year, month, day] = value.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1, day))
  const real = at.getUTCMonth() === month - 1 && at.getUTCDate() === day
  return real ? { value } : { error: DATE_FORMAT }
}

/**
 * `TimeField`. The wizard sends `HH:mm` and the admin edit modal `HH:mm:ss`;
 * both are stored — and re-serialised — with seconds, because that is what
 * DRF's ISO time rendering produced and the UI slices to five characters
 * itself. The admin list's `requested_time` filter comes through here too,
 * which is why it can only ever match rows whose seconds are `00`.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

function timeField(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const match = TIME_PATTERN.exec(String(raw).trim())
  if (!match) {
    return { error: 'Time has wrong format. Use one of these formats instead: hh:mm[:ss[.uuuuuu]].' }
  }
  return { value: `${match[1]}:${match[2]}:${match[3] ?? '00'}` }
}

function dateTimeField(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const parsed = Date.parse(String(raw))
  if (!Number.isFinite(parsed)) {
    return {
      error: 'Datetime has wrong format. Use one of these formats instead: '
        + 'YYYY-MM-DDThh:mm[:ss[.uuuuuu]][+HH:MM|-HH:MM|Z].',
    }
  }
  return { value: new Date(parsed).toISOString() }
}

/** A `DecimalField` column, held as the fixed-point string
 *  `COERCE_DECIMAL_TO_STRING` left it — `'2400.00'`, never `2400`. */
function decimalField(raw, { places = 2, min, max } = {}) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const value = Number(raw)
  if (!Number.isFinite(value)) return { error: 'A valid number is required.' }
  if (min !== undefined && value < min) {
    return { error: `Ensure this value is greater than or equal to ${min}.` }
  }
  if (max !== undefined && value > max) {
    return { error: `Ensure this value is less than or equal to ${max}.` }
  }
  return { value: value.toFixed(places) }
}

/** `PrimaryKeyRelatedField`, with DRF's own wording and quotes. */
function relatedField(raw, lookup) {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  const id = Number(raw)
  if (!Number.isInteger(id)) return { error: `Incorrect type. Expected pk value, received ${typeof raw}.` }
  if (!lookup(id)) return { error: `Invalid pk "${id}" - object does not exist.` }
  return { value: id }
}

function choiceField(raw, choices, { fallback } = {}) {
  if (raw === undefined || raw === null || raw === '') return { value: fallback ?? null }
  const value = String(raw)
  if (!choices.includes(value)) return { error: `"${value}" is not a valid choice.` }
  return { value }
}

/** `config/validators.py:phone_validator`. Blank passes — whether blank is
 *  allowed at all is the field's own business. */
const PHONE_PATTERN = /^(\+?\d[\d\s\-()]{5,30}\d)?$/

function raiseIfInvalid(errors) {
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

/** Collects `{value}` / `{error}` results into one field-error dict. */
function collector(errors) {
  return (name, result) => {
    if (result.error) {
      errors[name] = result.error
      return undefined
    }
    return result.value
  }
}

/* --------------------------------------------------------- serialisation */

/**
 * The taxonomy fallback that keeps the old field names alive. Customers pick a
 * `Service`; the payload fields are still called `selected_category_*` because
 * that is what they were called before services existed, and the value comes
 * from the service with the legacy `TransportCategory` behind it. Both sides
 * have to resolve or a pre-services order renders with no icon and no colour.
 */
function primarySelected(order) {
  return serviceById(order.selected_service_id) ?? categoryById(order.selected_category_id)
}

function primaryFinal(order) {
  return serviceById(order.final_service_id) ?? categoryById(order.final_category_id)
}

function parseRouteStops(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function routeStopsData(order) {
  return parseRouteStops(order.route_stops) ?? {}
}

function serializeOrderImage(row) {
  return { id: row.id, image: mediaField(row.image), created_at: row.created_at }
}

function serializeStatusHistory(row) {
  return {
    id: row.id,
    old_status: row.old_status,
    new_status: row.new_status,
    changed_by: row.changed_by,
    changed_by_name: userFullName(userById(row.changed_by)),
    comment: row.comment,
    created_at: row.created_at,
    is_auto_promotion: row.is_auto_promotion,
  }
}

function serializeEditHistory(row) {
  return {
    id: row.id,
    field_name: row.field_name,
    old_value: row.old_value,
    new_value: row.new_value,
    changed_by: row.changed_by,
    changed_by_name: userFullName(userById(row.changed_by)),
    changed_at: row.changed_at,
  }
}

/** `OrderAssignedDriverSerializer` — deliberately thinner than the fleet's own
 *  driver row, because this one is shown to the customer. */
function serializeAssignedDriver(row) {
  if (!row) return null
  return {
    id: row.id,
    full_name: driverFullName(row),
    phone: row.phone,
    license_number: row.license_number,
    license_categories: row.license_categories,
    status: row.status,
    status_display: DRIVER_STATUS_LABELS[row.status] ?? row.status,
    photo: mediaField(row.photo),
  }
}

/**
 * `OrderListSerializer`.
 *
 * `is_unread` is the one field whose value depends on who asked: an admin reads
 * `is_read_by_admin`, the owning customer `is_read_by_customer`, and anybody
 * else gets false. There is no reads table — those two booleans on the row are
 * the whole notification-read surface.
 */
function serializeOrderList(order, viewer) {
  const selected = primarySelected(order)
  const final = primaryFinal(order)
  const user = userById(order.user_id)

  let isUnread = false
  if (viewer?.role === 'admin') isUnread = !order.is_read_by_admin
  else if (viewer && order.user_id === viewer.id) isUnread = !order.is_read_by_customer

  return {
    id: order.id,
    public_id: order.public_id,
    pickup_location: order.pickup_location,
    destination_location: order.destination_location,
    requested_date: order.requested_date,
    requested_time: order.requested_time,
    contact_name: order.contact_name,
    contact_phone: order.contact_phone,
    user_full_name: userFullName(user),
    user_email: user?.email ?? '',
    user_phone: user?.phone_number ?? '',
    status: order.status,
    status_display: orderStatusDisplay(order.status),
    urgency: order.urgency,
    urgency_display: URGENCY_LABELS[order.urgency] ?? order.urgency,
    selected_category_name: selected?.name ?? '',
    // Both defaults matter. The tile falls back to a car glyph, and the cards
    // concatenate '12'/'14' alpha suffixes onto the colour, so it has to stay a
    // six-digit hex rather than a CSS colour name.
    selected_category_icon: selected?.icon || 'car',
    selected_category_image: mediaField(selected?.image),
    selected_category_color: selected?.color || '#1677ff',
    final_category_name: final?.name ?? '',
    is_cancellable: CANCELLABLE_STATUSES.includes(order.status),
    image_count: imagesForOrder(order.id).length,
    created_at: order.created_at,
    is_unread: isUnread,
    last_event_at: order.last_event_at,
    last_event_type: order.last_event_type,
    price: order.price,
    customer_accepted_at: order.customer_accepted_at,
  }
}

/** `OrderDetailSerializer`. Every `*_detail` is a nested read-only serializer
 *  that comes back null when its FK is null, and `route_stops` arrives parsed. */
function serializeOrderDetail(order) {
  return {
    id: order.id,
    public_id: order.public_id,
    user: order.user_id,
    user_detail: serializeUser(userById(order.user_id)),

    suggested_service: order.suggested_service_id,
    suggested_service_detail: serializeServicePublic(serviceById(order.suggested_service_id)),
    selected_service: order.selected_service_id,
    selected_service_detail: serializeServicePublic(serviceById(order.selected_service_id)),
    final_service: order.final_service_id,
    final_service_detail: serializeServicePublic(serviceById(order.final_service_id)),

    suggested_category: order.suggested_category_id,
    suggested_category_detail: serializeCategoryPublic(categoryById(order.suggested_category_id)),
    selected_category: order.selected_category_id,
    selected_category_detail: serializeCategoryPublic(categoryById(order.selected_category_id)),
    final_category: order.final_category_id,
    final_category_detail: serializeCategoryPublic(categoryById(order.final_category_id)),

    assigned_vehicle: order.assigned_vehicle_id,
    assigned_vehicle_detail: serializeVehicleList(vehicleById(order.assigned_vehicle_id)),
    assigned_driver: order.assigned_driver_id,
    assigned_driver_detail: serializeAssignedDriver(driverById(order.assigned_driver_id)),

    scheduled_from: order.scheduled_from,
    scheduled_to: order.scheduled_to,
    pickup_location: order.pickup_location,
    pickup_lat: order.pickup_lat,
    pickup_lng: order.pickup_lng,
    destination_location: order.destination_location,
    destination_lat: order.destination_lat,
    destination_lng: order.destination_lng,
    requested_date: order.requested_date,
    requested_time: order.requested_time,
    contact_name: order.contact_name,
    contact_phone: order.contact_phone,
    description: order.description,
    cargo_details: order.cargo_details,
    cargo_weight_kg: order.cargo_weight_kg,
    cargo_days: order.cargo_days,
    cargo_floor: order.cargo_floor,
    cargo_fragile: order.cargo_fragile,
    cargo_insured: order.cargo_insured,
    cargo_insurance: order.cargo_insurance,
    urgency: order.urgency,
    urgency_display: URGENCY_LABELS[order.urgency] ?? order.urgency,
    status: order.status,
    status_display: orderStatusDisplay(order.status),
    admin_comment: order.admin_comment,
    user_note: order.user_note,
    route_stops: parseRouteStops(order.route_stops),
    price: order.price,
    pricing_breakdown: order.pricing_breakdown,
    customer_accepted_at: order.customer_accepted_at,
    admin_edited_at: order.admin_edited_at,
    admin_edited_by: order.admin_edited_by,
    admin_edited_by_name: userFullName(userById(order.admin_edited_by)),
    admin_verified_service: order.admin_verified_service,
    admin_verified_category: order.admin_verified_category,
    admin_verified_vehicle: order.admin_verified_vehicle,
    admin_verified_driver: order.admin_verified_driver,
    admin_verified_price: order.admin_verified_price,
    is_cancellable: CANCELLABLE_STATUSES.includes(order.status),
    images: imagesForOrder(order.id).map(serializeOrderImage),
    status_history: statusHistoryForOrder(order.id).map(serializeStatusHistory),
    edit_history: editHistoryForOrder(order.id).map(serializeEditHistory),
    created_at: order.created_at,
    updated_at: order.updated_at,
  }
}

/* ------------------------------------------------------------ event stamp
 *
 * `_stamp_event` in `orders/views.py`, and the most consequential function in
 * this module. `latest_event_at` is the max of `last_event_at` across the
 * viewer's orders, the poller diffs it, and a forward move is what makes
 * AppHome, both orders lists, both detail pages and the dashboard refetch.
 * Nothing that changes an order may return without calling this.
 */
function stampEvent(order, eventType, { customerUnread = false, adminUnread = false } = {}) {
  const now = nowIso()
  order.last_event_at = now
  order.last_event_type = eventType
  order.updated_at = now
  if (adminUnread) order.is_read_by_admin = false
  if (customerUnread) order.is_read_by_customer = false
  return now
}

function addStatusHistory(order, { oldStatus, newStatus, actorId, comment = '', isAutoPromotion = false }) {
  const row = {
    id: nextId('orderStatusHistory'),
    order_id: order.id,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: actorId ?? null,
    comment,
    created_at: nowIso(),
    is_auto_promotion: isAutoPromotion,
  }
  store.orderStatusHistory.push(row)
  return row
}

/** Values are `str()` of the model value, which is why a `route_stops` row's
 *  old and new are whole JSON strings and an empty field logs as `''`. */
function addEditHistory(order, fieldName, oldValue, newValue, actorId) {
  const text = (value) => (value === null || value === undefined || value === '' ? '' : String(value))
  store.orderEditHistory.push({
    id: nextId('orderEditHistory'),
    order_id: order.id,
    field_name: fieldName,
    old_value: text(oldValue),
    new_value: text(newValue),
    changed_by: actorId ?? null,
    changed_at: nowIso(),
  })
}

/* ---------------------------------------------------------------- pricing */

/**
 * `apply_price_to_order`. The breakdown is always written — an error breakdown
 * is how the admin finds out why no price came through — and `price` only when
 * one was actually computed, so a failed recalculation leaves the previous
 * number alone rather than blanking it.
 */
function applyPriceToOrder(order) {
  const result = quote(order)
  order.pricing_breakdown = result.breakdown
  if (result.computed && result.price !== null) order.price = result.price
  return result
}

/**
 * `_backfill_route_summary_from_coords`. The customer's own routing call can
 * lose the race against their Submit click, and an order that arrives with
 * `ascent: null` prices several per cent low on a hilly route because the
 * elevation multiplier silently collapses to 1.0. So the coordinates are re-run
 * here before pricing. Distance present *and* ascent not null is the success
 * condition — an ascent of zero is a legitimate answer for a flat city hop.
 */
function backfillRouteSummary(order) {
  const data = routeStopsData(order)
  if (data.distance && data.ascent !== null && data.ascent !== undefined) return false

  const coords = []
  for (const key of ['pickups', 'destinations']) {
    for (const stop of Array.isArray(data[key]) ? data[key] : []) {
      if (!stop || typeof stop !== 'object') continue
      if (stop.lat === null || stop.lat === undefined) continue
      if (stop.lng === null || stop.lng === undefined) continue
      coords.push([Number(stop.lng), Number(stop.lat)])
    }
  }
  const flat = [order.pickup_lng, order.pickup_lat, order.destination_lng, order.destination_lat]
  if (!coords.length && flat.every((value) => value !== null && value !== undefined)) {
    coords.push([Number(order.pickup_lng), Number(order.pickup_lat)])
    coords.push([Number(order.destination_lng), Number(order.destination_lat)])
  }
  if (coords.length < 2) return false

  const summary = routeSummaryFor(coords)
  if (summary.distance === null && summary.ascent === null) return false

  const merged = { ...data }
  if (summary.distance !== null) merged.distance = summary.distance
  if (summary.duration !== null) merged.duration = summary.duration
  if (summary.ascent !== null) merged.ascent = summary.ascent
  order.route_stops = JSON.stringify(merged)
  return true
}

/* ------------------------------------------------------------- assignment
 *
 * `orders/assignment.py` and `orders/auto_assign.py`.
 *
 * The rules keep Order, Vehicle and Driver consistent with one another: a
 * driver has to be on the vehicle's roster and hold every licence class it
 * needs, neither resource may be double-booked while the order occupies it, and
 * `Vehicle.status` is derived rather than free — it follows whether any order
 * is holding the truck and never overrides an admin's maintenance or retired.
 */

function licenceSet(raw) {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  )
}

/**
 * Do two booking windows collide?
 *
 * Two open-ended bookings do, because nothing separates them. One open-ended
 * and one scheduled does *not*: the admin has not committed a time on the open
 * side yet, and treating that as a clash would make a brand-new offer collide
 * with every scheduled order on the same truck, so the price could never be
 * sent. Two scheduled windows get the ordinary half-open comparison.
 */
function windowsOverlap(aFrom, aTo, bFrom, bTo) {
  const aOpen = !aFrom && !aTo
  const bOpen = !bFrom && !bTo
  if (aOpen && bOpen) return true
  if (aOpen || bOpen) return false
  const at = (value) => (value ? Date.parse(value) : null)
  if (at(aTo) !== null && at(bFrom) !== null && at(aTo) <= at(bFrom)) return false
  if (at(bTo) !== null && at(aFrom) !== null && at(bTo) <= at(aFrom)) return false
  return true
}

function activeOrdersOnVehicle(vehicleId, excludeId) {
  return store.orders.filter((order) => order.assigned_vehicle_id === vehicleId
    && ACTIVE_STATUSES.includes(order.status)
    && order.id !== excludeId)
}

function activeOrdersOnDriver(driverId, excludeId) {
  return store.orders.filter((order) => order.assigned_driver_id === driverId
    && ACTIVE_STATUSES.includes(order.status)
    && order.id !== excludeId)
}

function firstConflict(candidates, from, to) {
  return candidates.find((other) => windowsOverlap(from, to, other.scheduled_from, other.scheduled_to))
}

/** Only blocks when a real comparison is possible, and only on a strict excess
 *  — a 10 t load on a 10 t truck is allowed. */
function cargoExceedsCapacity(capacityTonnes, cargoWeightKg) {
  if (capacityTonnes === null || capacityTonnes === undefined) return false
  if (cargoWeightKg === null || cargoWeightKg === undefined) return false
  return num(cargoWeightKg) / 1000 > num(capacityTonnes)
}

/**
 * `validate_assignment`, run against the merged post-patch state — the caller
 * resolves each value from the incoming body or the existing row first, so an
 * admin can change the driver and the schedule in one PATCH and have both
 * checked together. Throws the field-error dict the assignment selects render
 * inline underneath themselves.
 */
function validateAssignment(order, {
  vehicle, driver, scheduledFrom, scheduledTo, targetStatus, cargoWeightKg,
}) {
  const errors = {}

  if (scheduledFrom && scheduledTo && Date.parse(scheduledTo) <= Date.parse(scheduledFrom)) {
    errors.scheduled_to = 'End time must be after start time.'
  }

  if (vehicle) {
    if (!vehicle.is_active) {
      errors.assigned_vehicle = 'Selected vehicle is inactive.'
    } else if (vehicle.status === 'maintenance' || vehicle.status === 'retired') {
      errors.assigned_vehicle = `Vehicle is ${vehicle.status} and cannot be assigned.`
    }
    const weight = cargoWeightKg === undefined ? order.cargo_weight_kg : cargoWeightKg
    if (cargoExceedsCapacity(vehicle.capacity, weight)) {
      errors.assigned_vehicle = `Vehicle capacity (${vehicle.capacity} t) is below the `
        + `cargo weight (${(num(weight) / 1000).toFixed(2)} t).`
    }
  }

  if (driver) {
    if (!driver.is_active) errors.assigned_driver = 'Selected driver is inactive.'
    else if (driver.status !== 'active') {
      errors.assigned_driver = `Driver is ${driver.status === 'on_leave' ? 'on leave' : 'inactive'} `
        + 'and cannot be assigned.'
    }
  }

  if (vehicle && driver) {
    if (!(driver.vehicle_ids ?? []).includes(vehicle.id)) {
      errors.assigned_driver = 'Driver is not assigned to operate this vehicle. '
        + 'Link them in driver management first.'
    }
    const required = licenceSet(vehicle.license_categories)
    const covered = licenceSet(driver.license_categories)
    const missing = [...required].filter((code) => !covered.has(code)).sort()
    if (missing.length) errors.assigned_driver = `Driver license missing: ${missing.join(', ')}.`
  }

  // The overlap check only matters while the order will actually hold the
  // resource — a rejected or cancelled order releases both.
  if (ACTIVE_STATUSES.includes(targetStatus || order.status)) {
    if (vehicle) {
      const clash = firstConflict(activeOrdersOnVehicle(vehicle.id, order.id), scheduledFrom, scheduledTo)
      if (clash) {
        errors.assigned_vehicle = `Vehicle is already booked on order #${clash.id} for an overlapping time.`
      }
    }
    if (driver) {
      const clash = firstConflict(activeOrdersOnDriver(driver.id, order.id), scheduledFrom, scheduledTo)
      if (clash) {
        errors.assigned_driver = `Driver is already booked on order #${clash.id} for an overlapping time.`
      }
    }
  }

  raiseIfInvalid(errors)
}

/** Keeps `Vehicle.status` in step with whether anything is holding the truck.
 *  Maintenance and retired are admin decisions and are never overwritten. */
function syncVehicleStatus(vehicle) {
  if (!vehicle) return
  if (vehicle.status === 'maintenance' || vehicle.status === 'retired') return
  const target = activeOrdersOnVehicle(vehicle.id, null).length ? 'in_use' : 'available'
  if (vehicle.status !== target) {
    vehicle.status = target
    vehicle.updated_at = nowIso()
  }
}

function pickVehicle(order) {
  if (!order.final_category_id) return null
  return store.vehicles
    .filter((vehicle) => (vehicle.category_ids ?? []).includes(order.final_category_id))
    .filter((vehicle) => vehicle.is_active)
    .filter((vehicle) => vehicle.status !== 'maintenance' && vehicle.status !== 'retired')
    .sort((a, b) => a.id - b.id)
    .find((vehicle) => !firstConflict(
      activeOrdersOnVehicle(vehicle.id, order.id),
      order.scheduled_from,
      order.scheduled_to,
    )) ?? null
}

function pickDriver(order) {
  if (!order.final_category_id && !order.assigned_vehicle_id) return null

  let candidates = store.drivers.filter((driver) => driver.status === 'active' && driver.is_active)

  const vehicle = vehicleById(order.assigned_vehicle_id)
  if (vehicle) {
    // Roster membership and licence coverage — the same two rules
    // `validateAssignment` would apply to the admin's own choice.
    const required = licenceSet(vehicle.license_categories)
    candidates = candidates
      .filter((driver) => (driver.vehicle_ids ?? []).includes(vehicle.id))
      .filter((driver) => {
        const covered = licenceSet(driver.license_categories)
        return [...required].every((code) => covered.has(code))
      })
  }

  return candidates
    .filter((driver) => !firstConflict(
      activeOrdersOnDriver(driver.id, order.id),
      order.scheduled_from,
      order.scheduled_to,
    ))
    .sort((a, b) => a.id - b.id)[0] ?? null
}

/**
 * `auto_assign_on_first_open`, which in fact runs on every admin open — it is
 * idempotent, filling only empty fields, so orders created before the feature
 * existed pick it up too.
 *
 * The re-price at the end is deliberately narrow: only when there is no price
 * yet, or when the stored breakdown still carries an error. Once an admin has a
 * clean number they may have overridden it by hand, and the Recalculate button
 * is the explicit refresh path.
 */
function autoAssignOnOpen(order) {
  if (!order.final_service_id && order.selected_service_id) {
    order.final_service_id = order.selected_service_id
  }
  if (!order.final_category_id && order.selected_category_id) {
    order.final_category_id = order.selected_category_id
  }
  // The customer chose "let the admin decide", or a service whose picker had no
  // category. Borrow the service's first category so the engine has a pricing
  // mode to work with at all.
  if (!order.final_category_id) {
    const service = serviceById(order.final_service_id) ?? serviceById(order.selected_service_id)
    const first = (service?.car_category_ids ?? [])
      .map((id) => categoryById(id))
      .filter(Boolean)
      .sort((a, b) => a.id - b.id)[0]
    if (first) order.final_category_id = first.id
  }

  if (!order.assigned_vehicle_id) {
    const vehicle = pickVehicle(order)
    if (vehicle) order.assigned_vehicle_id = vehicle.id
  }
  if (!order.assigned_driver_id) {
    const driver = pickDriver(order)
    if (driver) order.assigned_driver_id = driver.id
  }

  const breakdown = order.pricing_breakdown
  const hasErrorBreakdown = Boolean(breakdown && typeof breakdown === 'object' && breakdown.error)
  if (order.price === null || order.price === undefined || hasErrorBreakdown) {
    backfillRouteSummary(order)
    applyPriceToOrder(order)
  }
}

/* ------------------------------------------------------- customer: lists */

/**
 * Customer routes resolve **either** identifier. Navigation writes
 * `public_id || id`, so a fresh link carries the UUID while an old bookmark
 * holds the numeric pk, and both have to keep working. Always scoped to the
 * caller: a lookup naming somebody else's order is a 404, not a 403, because
 * the customer has no business learning it exists.
 */
function customerOrder(user, lookup) {
  const key = String(lookup ?? '')
  const numeric = Number(key)
  const order = store.orders.find((row) => row.user_id === user.id
    && (row.public_id === key || (Number.isInteger(numeric) && row.id === numeric)))
  if (!order) throw notFound('Order not found.')
  return order
}

function byNewestFirst(rows) {
  return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

register('GET', '/orders/', (req) => {
  let rows = byNewestFirst(store.orders.filter((order) => order.user_id === req.user.id))
  const status = (req.params.status ?? '').trim()
  if (status) rows = rows.filter((order) => order.status === status)
  return paginate(rows, req.params, '/orders/', (order) => serializeOrderList(order, req.user))
})

register('GET', '/orders/active/', (req) => {
  const rows = byNewestFirst(store.orders.filter((order) => order.user_id === req.user.id
    && OPEN_STATUSES.includes(order.status)))
  return paginate(rows, req.params, '/orders/active/', (order) => serializeOrderList(order, req.user))
})

/* ------------------------------------------------------ customer: create */

/**
 * An `OrderImage` per uploaded file. The row holds an object URL rather than a
 * media path, because there is nowhere to write one — `mediaUrl()` passes those
 * through and `resetStore()` revokes them.
 */
function attachImages(order, files) {
  return files.map((image) => {
    const row = {
      id: nextId('orderImages'),
      order_id: order.id,
      image: storeUpload(image),
      created_at: nowIso(),
    }
    store.orderImages.push(row)
    return row
  })
}

/** Start inclusive, end exclusive, and it may wrap past midnight — which is
 *  what a 22:00–06:00 city ban looks like. */
function windowCoversTime(window, time) {
  if (!time) return false
  if (window.start_time <= window.end_time) {
    return time >= window.start_time && time < window.end_time
  }
  return time >= window.start_time || time < window.end_time
}

/**
 * `RestrictedTimeWindow` enforcement against the customer's chosen *category*.
 * Every address on the order counts, so one stop in a restricted city is enough
 * to block the time.
 *
 * Worth knowing: the wizard reads `restricted_time_windows` off the selected
 * *service*, which never carries the field, so its warning banner is inert and
 * this check is the only place the rule is applied. It has to stay accurate or
 * a legitimate submission 400s with nothing on screen explaining why.
 */
function restrictedTimeError(categoryId, time, addresses) {
  if (!time || !categoryId) return null
  const windows = store.restrictedTimeWindows.filter((window) => window.category_id === categoryId
    && window.is_active)
  for (const window of windows) {
    if (!windowCoversTime(window, time)) continue
    const keyword = String(window.location_keyword ?? '').toLowerCase().trim()
    if (!keyword) continue
    if (!addresses.some((address) => String(address ?? '').toLowerCase().includes(keyword))) continue
    return window.description
      || `Special transport is not allowed in ${window.location_keyword} `
        + `between ${window.start_time.slice(0, 5)} and ${window.end_time.slice(0, 5)}.`
  }
  return null
}

/** `validate_route_stops` — shape only, never completeness, so an empty payload
 *  and an admin-patched one both survive. */
function routeStopsField(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: '' }
  const text = String(raw)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'route_stops must be a valid JSON string.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'route_stops must be a JSON object (dict), not a list or scalar.' }
  }
  for (const key of ['pickups', 'destinations']) {
    if (key in parsed && !Array.isArray(parsed[key])) {
      return { error: `route_stops.${key} must be a list.` }
    }
  }
  return { value: text }
}

register('POST', '/orders/create/', (req) => {
  const body = readBody(req.body)
  const errors = {}
  const take = collector(errors)

  const attrs = {
    selected_service_id: take('selected_service', relatedField(body.selected_service, serviceById)),
    suggested_service_id: take('suggested_service', relatedField(body.suggested_service, serviceById)),
    selected_category_id: take('selected_category', relatedField(body.selected_category, categoryById)),
    suggested_category_id: take('suggested_category', relatedField(body.suggested_category, categoryById)),
    pickup_location: take('pickup_location', charField(body.pickup_location, { maxLength: 500 })),
    pickup_lat: take('pickup_lat', floatField(body.pickup_lat, { min: -90, max: 90 })),
    pickup_lng: take('pickup_lng', floatField(body.pickup_lng, { min: -180, max: 180 })),
    destination_location: take('destination_location', charField(body.destination_location, {
      required: false, allowBlank: true, maxLength: 500,
    })) ?? '',
    destination_lat: take('destination_lat', floatField(body.destination_lat, { min: -90, max: 90 })),
    destination_lng: take('destination_lng', floatField(body.destination_lng, { min: -180, max: 180 })),
    requested_date: take('requested_date', dateField(body.requested_date, { required: true })),
    requested_time: take('requested_time', timeField(body.requested_time)),
    contact_name: take('contact_name', charField(body.contact_name, { maxLength: 200 })),
    contact_phone: take('contact_phone', charField(body.contact_phone, { maxLength: 20 })),
    description: take('description', charField(body.description)),
    cargo_details: take('cargo_details', charField(body.cargo_details, {
      required: false, allowBlank: true,
    })) ?? '',
    cargo_weight_kg: take('cargo_weight_kg', decimalField(body.cargo_weight_kg, {
      min: 0.01, max: 1_000_000,
    })),
    cargo_days: take('cargo_days', intField(body.cargo_days, { min: 1 })),
    cargo_floor: take('cargo_floor', intField(body.cargo_floor, { min: 0 })),
    cargo_fragile: boolField(body.cargo_fragile),
    cargo_insured: boolField(body.cargo_insured),
    cargo_insurance: boolField(body.cargo_insurance),
    urgency: take('urgency', choiceField(body.urgency, URGENCIES, { fallback: 'normal' })),
    user_note: take('user_note', charField(body.user_note, { required: false, allowBlank: true })) ?? '',
    route_stops: take('route_stops', routeStopsField(body.route_stops)) ?? '',
  }

  // `validate_contact_name` runs after the field itself, so a blank name has
  // already failed above; this only catches a real but too-short one.
  if (!errors.contact_name && attrs.contact_name && attrs.contact_name.length < 2) {
    errors.contact_name = 'Contact name must be at least 2 characters.'
  }
  if (!errors.contact_phone && !PHONE_PATTERN.test(attrs.contact_phone ?? '')) {
    errors.contact_phone = 'Enter a valid phone number.'
  }
  raiseIfInvalid(errors)

  // Defence in depth: a helper-card row means "I deferred", so the FK is nulled
  // rather than left pointing at a placeholder no admin can fulfil.
  if (serviceById(attrs.selected_service_id)?.is_helper_card) attrs.selected_service_id = null
  if (categoryById(attrs.selected_category_id)?.is_helper_card) attrs.selected_category_id = null

  const service = serviceById(attrs.selected_service_id)
  if (service?.requires_destination && !attrs.destination_location.trim()) {
    throw DemoApiError.validation({
      destination_location: 'This service requires a destination address.',
    })
  }
  if (attrs.cargo_floor !== null) {
    const cap = service?.floor_max || 200
    if (attrs.cargo_floor > cap) {
      throw DemoApiError.validation({
        cargo_floor: `Floor cannot exceed ${cap} for the selected service.`,
      })
    }
  }
  if (attrs.cargo_days !== null) {
    const cap = service?.days_max || 365
    if (attrs.cargo_days > cap) {
      throw DemoApiError.validation({
        cargo_days: `Days cannot exceed ${cap} for the selected service.`,
      })
    }
  }

  const parsedStops = parseRouteStops(attrs.route_stops) ?? {}
  const addresses = [attrs.pickup_location, attrs.destination_location]
  for (const key of ['pickups', 'destinations']) {
    for (const stop of Array.isArray(parsedStops[key]) ? parsedStops[key] : []) {
      if (stop && typeof stop === 'object' && stop.address) addresses.push(String(stop.address))
    }
  }
  const timeProblem = restrictedTimeError(attrs.selected_category_id, attrs.requested_time, addresses)
  if (timeProblem) throw DemoApiError.validation({ requested_time: timeProblem })

  const now = nowIso()
  const order = {
    id: nextId('orders'),
    public_id: newPublicId(),
    user_id: req.user.id,
    ...attrs,
    final_service_id: null,
    final_category_id: null,
    assigned_vehicle_id: null,
    assigned_driver_id: null,
    scheduled_from: null,
    scheduled_to: null,
    pricing_breakdown: null,
    admin_verified_service: false,
    admin_verified_category: false,
    admin_verified_vehicle: false,
    admin_verified_driver: false,
    admin_verified_price: false,
    status: 'new',
    admin_comment: '',
    price: null,
    customer_accepted_at: null,
    // The customer has just read what they typed; the admin has not seen it.
    is_read_by_admin: false,
    is_read_by_customer: true,
    last_event_at: now,
    last_event_type: 'created',
    admin_edited_at: null,
    admin_edited_by: null,
    created_at: now,
    updated_at: now,
  }
  store.orders.push(order)

  // No cap here. The ten-image limit lives on the upload endpoint alone, and
  // the wizard's picker sets no `maxCount`, so a thirty-photo submission is a
  // legitimate one.
  attachImages(order, readFiles(req.body, 'images'))
  addStatusHistory(order, {
    oldStatus: '',
    newStatus: 'new',
    actorId: req.user.id,
    comment: 'Order created',
  })

  // Priced immediately so the admin opens a quote rather than a blank field. A
  // pricing failure must never cost the customer their order — the reason lands
  // in the breakdown and the 201 goes out regardless.
  try {
    backfillRouteSummary(order)
    applyPriceToOrder(order)
  } catch {
    // Same convention as upstream: never let the engine block a creation.
  }

  // `OrderCreateSerializer`, not the detail shape — `route_stops` echoes back
  // as the raw string here, and `images` is write-only so it is absent.
  return {
    id: order.id,
    public_id: order.public_id,
    selected_service: order.selected_service_id,
    suggested_service: order.suggested_service_id,
    selected_category: order.selected_category_id,
    suggested_category: order.suggested_category_id,
    pickup_location: order.pickup_location,
    pickup_lat: order.pickup_lat,
    pickup_lng: order.pickup_lng,
    destination_location: order.destination_location,
    destination_lat: order.destination_lat,
    destination_lng: order.destination_lng,
    requested_date: order.requested_date,
    requested_time: order.requested_time,
    contact_name: order.contact_name,
    contact_phone: order.contact_phone,
    description: order.description,
    cargo_details: order.cargo_details,
    cargo_weight_kg: order.cargo_weight_kg,
    cargo_days: order.cargo_days,
    cargo_floor: order.cargo_floor,
    cargo_fragile: order.cargo_fragile,
    cargo_insured: order.cargo_insured,
    cargo_insurance: order.cargo_insurance,
    urgency: order.urgency,
    user_note: order.user_note,
    route_stops: order.route_stops,
  }
})

/* ------------------------------------------------------ customer: detail */

register('GET', '/orders/:lookup/', (req) => {
  const order = customerOrder(req.user, req.path.lookup)
  // The read that clears the red dot. Deliberately not an event: a customer
  // catching up on their own order is not news to anybody.
  if (!order.is_read_by_customer) order.is_read_by_customer = true
  return serializeOrderDetail(order)
})

register('POST', '/orders/:lookup/cancel/', (req) => {
  const order = customerOrder(req.user, req.path.lookup)
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new DemoApiError(400, 'This order cannot be cancelled in its current status.')
  }

  const reason = String(req.body?.reason ?? '').trim().slice(0, 500)
  if (reason.length < 10) {
    throw new DemoApiError(400, 'A cancellation reason of at least 10 characters is required.', {
      detail: 'A cancellation reason of at least 10 characters is required.',
      reason: 'min_length',
    })
  }

  const oldStatus = order.status
  // The same modal is relabelled "Reject offer" once a price is on the table,
  // and the history comment follows the label so an admin reading it later can
  // tell a refused quote from an abandoned request.
  const label = oldStatus === 'offer_sent' ? 'Offer rejected by customer' : 'Cancelled by customer'
  order.status = 'cancelled'
  addStatusHistory(order, {
    oldStatus,
    newStatus: 'cancelled',
    actorId: req.user.id,
    comment: `${label}: ${reason}`,
  })
  stampEvent(order, 'cancelled', { adminUnread: true })
  syncVehicleStatus(vehicleById(order.assigned_vehicle_id))

  return { detail: 'Order cancelled successfully.' }
})

register('POST', '/orders/:lookup/accept/', (req) => {
  const order = customerOrder(req.user, req.path.lookup)
  if (order.status !== 'offer_sent') {
    throw new DemoApiError(400, 'Offer can only be accepted while waiting for your approval.')
  }
  if (order.price === null || order.price === undefined || order.price <= 0) {
    throw new DemoApiError(400, 'No price has been set for this order yet.')
  }

  order.status = 'approved'
  order.customer_accepted_at = nowIso()
  addStatusHistory(order, {
    oldStatus: 'offer_sent',
    newStatus: 'approved',
    actorId: req.user.id,
    comment: 'Customer accepted the price offer',
  })
  stampEvent(order, 'status:approved', { adminUnread: true })

  return serializeOrderDetail(order)
})

/**
 * No caller in the shipped customer UI — photos only ever arrive through the
 * multipart create — but this is the one place the ten-image cap is enforced,
 * so it is reproduced rather than dropped.
 */
register('POST', '/orders/:lookup/upload/', (req) => {
  const order = customerOrder(req.user, req.path.lookup)
  const files = readFiles(req.body, 'images')
  if (!files.length) throw new DemoApiError(400, 'No images provided.')
  if (imagesForOrder(order.id).length + files.length > MAX_ORDER_IMAGES) {
    throw new DemoApiError(400, `Maximum ${MAX_ORDER_IMAGES} images per order.`)
  }
  // Pillow's `verify()` upstream; the browser's own MIME sniff here.
  if (!files.every((upload) => String(upload.type ?? '').startsWith('image/'))) {
    throw new DemoApiError(400, 'One or more files are not valid images.')
  }

  const created = attachImages(order, files)
  stampEvent(order, 'images_added', { adminUnread: true })
  return created.map(serializeOrderImage)
})

/* ----------------------------------------------- customer: notifications */

function notificationPayload(rows, viewer) {
  const unread = rows.filter((order) => (viewer.role === 'admin'
    ? !order.is_read_by_admin
    : !order.is_read_by_customer))
  const recent = [...unread]
    .sort((a, b) => Date.parse(b.last_event_at) - Date.parse(a.last_event_at))
    .slice(0, 15)
  // The value the poller diffs. It is the max across *all* the viewer's orders
  // rather than the unread ones, because marking everything read would
  // otherwise move it backwards and the next real event would read as history.
  const latest = rows.reduce((newest, order) => {
    const at = Date.parse(order.last_event_at)
    return Number.isFinite(at) && at > newest ? at : newest
  }, Number.NEGATIVE_INFINITY)

  return {
    unread_count: unread.length,
    active_orders_count: rows.filter((order) => OPEN_STATUSES.includes(order.status)).length,
    recent_unread: recent.map((order) => serializeOrderList(order, viewer)),
    latest_event_at: Number.isFinite(latest) ? new Date(latest).toISOString() : null,
    server_time: nowIso(),
  }
}

function markRead(rows, body, flag) {
  const ids = Array.isArray(body?.ids) && body.ids.length ? new Set(body.ids.map(Number)) : null
  let marked = 0
  for (const order of rows) {
    if (order[flag]) continue
    if (ids && !ids.has(order.id)) continue
    order[flag] = true
    marked += 1
  }
  return { marked }
}

register('GET', '/orders/notifications/', (req) => notificationPayload(
  store.orders.filter((order) => order.user_id === req.user.id),
  req.user,
))

register('POST', '/orders/notifications/mark-read/', (req) => markRead(
  store.orders.filter((order) => order.user_id === req.user.id),
  req.body,
  'is_read_by_customer',
))

/* ----------------------------------------------------------- admin: list */

const ORDER_SEARCH_FIELDS = [
  (order) => userById(order.user_id)?.first_name,
  (order) => userById(order.user_id)?.last_name,
  (order) => userById(order.user_id)?.email,
  (order) => userById(order.user_id)?.phone_number,
  (order) => userById(order.user_id)?.company_name,
  (order) => order.contact_name,
  (order) => order.contact_phone,
]

const ORDER_ORDERING_FIELDS = {
  id: (order) => order.id,
  created_at: (order) => Date.parse(order.created_at),
  requested_date: (order) => order.requested_date,
  status: (order) => order.status,
  urgency: (order) => order.urgency,
}

const ORDER_FILTER_FIELDS = {
  urgency: (order) => order.urgency,
  selected_service: (order) => order.selected_service_id,
  final_service: (order) => order.final_service_id,
  selected_category: (order) => order.selected_category_id,
  final_category: (order) => order.final_category_id,
  assigned_vehicle: (order) => order.assigned_vehicle_id,
}

/**
 * The saved-view shortcuts behind the admin's tabs. Each resolves to a single
 * canned filter so the URL stays readable (`?view=awaiting_price`) and the
 * frontend never has to know which statuses a tab means. `all` — and anything
 * unrecognised — is no filter at all, which is why the All tab's badge (which
 * counts only non-terminal orders) is legitimately lower than the table's own
 * total. That mismatch is upstream's and is kept.
 */
function applySavedView(rows, view) {
  switch (view) {
    case 'unread': return rows.filter((order) => !order.is_read_by_admin)
    case 'awaiting_price': return rows.filter((order) => ['new', 'under_review'].includes(order.status))
    case 'pending_customer': return rows.filter((order) => order.status === 'offer_sent')
    case 'today': return rows.filter((order) => order.requested_date === todayKey()
      && !isTerminalStatus(order.status))
    case 'in_progress': return rows.filter((order) => order.status === 'in_progress')
    default: return rows
  }
}

/** The filter pass the list and the CSV export share, so the two cannot drift
 *  apart about what a given query string selects. */
function filterAdminOrders(rows, params, paramsAll) {
  let out = rows

  // django-filter would let a repeated `status` resolve to the last value;
  // ORing them is a superset the single-valued UI cannot tell apart, and it
  // leaves room for a multi-select tab without a second code path.
  out = applyMultiFilter(out, paramsAll, 'status', (order) => order.status)
  out = applyFilters(out, params, ORDER_FILTER_FIELDS)

  // A non-numeric `user_id` is ignored rather than fatal — the drill-down link
  // from the users page is hand-editable, and a typo emptying the list would be
  // worse than a typo doing nothing.
  const userId = Number(params.user_id)
  if (params.user_id && Number.isInteger(userId)) {
    out = out.filter((order) => order.user_id === userId)
  }

  out = applyDateRange(out, params, (order) => order.created_at)
  out = applyDateRange(out, params, (order) => order.requested_date, {
    from: 'requested_date_from', to: 'requested_date_to',
  })

  // The filter sends `HH:mm` and Django coerced it to a time before matching,
  // so this only ever finds rows whose seconds are 00 — which every row the
  // wizard writes is.
  const time = timeField(params.requested_time)
  if (params.requested_time && time.value) {
    out = out.filter((order) => order.requested_time === time.value)
  }

  return applySearch(out, params, ORDER_SEARCH_FIELDS)
}

register('GET', '/orders/admin/', (req) => {
  let rows = filterAdminOrders(store.orders, req.params, req.paramsAll)
  rows = applySavedView(rows, req.params.view)
  rows = applyOrdering(rows, req.params, ORDER_ORDERING_FIELDS, ['-created_at'])
  return paginate(rows, req.params, '/orders/admin/', (order) => serializeOrderList(order, req.user))
}, { auth: 'admin' })

function adminOrder(id) {
  const order = orderById(Number(id))
  if (!order) throw notFound('Order not found.')
  return order
}

/* --------------------------------------------------------- admin: detail */

register('GET', '/orders/admin/:id/', (req) => {
  const order = adminOrder(req.path.id)

  if (!order.is_read_by_admin) order.is_read_by_admin = true

  // First admin open moves the order into review so the customer can see
  // somebody has picked it up. The history row carries `is_auto_promotion`,
  // which is the only thing that arms the sixty-second undo banner — and the
  // reason a seeded auto-promotion row would be dead data.
  if (order.status === 'new') {
    order.status = 'under_review'
    addStatusHistory(order, {
      oldStatus: 'new',
      newStatus: 'under_review',
      actorId: req.user.id,
      comment: 'Opened by admin',
      isAutoPromotion: true,
    })
    stampEvent(order, 'status:under_review', { customerUnread: true })
  }

  // Best-effort, idempotent, and skipped on a closed record.
  if (!isTerminalStatus(order.status)) {
    try {
      autoAssignOnOpen(order)
    } catch {
      // A failure on one field must not cost the admin the whole page.
    }
  }

  return serializeOrderDetail(order)
}, { auth: 'admin' })

/* ---------------------------------------------------------- admin: patch */

/** `AdminOrderUpdateSerializer.CUSTOMER_EDITABLE_FIELDS` — the customer's own
 *  data, which an admin may fix on their behalf and which is logged per field
 *  so the customer can see exactly what changed. */
const CUSTOMER_EDITABLE_FIELDS = [
  'pickup_location', 'pickup_lat', 'pickup_lng',
  'destination_location', 'destination_lat', 'destination_lng',
  'requested_date', 'requested_time',
  'contact_name', 'contact_phone',
  'description', 'cargo_details',
  'urgency', 'route_stops',
]

/**
 * Change any of these and the engine re-quotes on the way out.
 *
 * The vehicle has no effect on the arithmetic today — the driver does, through
 * the VAT tier — but it is in the set so "any major assignment change
 * re-quotes" stays true and survives a future per-vehicle rate. Workflow fields
 * are deliberately absent: an admin who typed a price by hand must not lose it
 * to a checkbox.
 */
const PRICE_AFFECTING_FIELDS = [
  'final_category_id', 'final_service_id',
  'assigned_driver_id', 'assigned_vehicle_id',
  'cargo_weight_kg', 'cargo_days',
  'pickup_location', 'destination_location',
  'pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng',
  'route_stops',
]

/** Payload field name → row column, for the four FKs the row keeps as `_id`. */
const PATCH_COLUMN = {
  final_service: 'final_service_id',
  final_category: 'final_category_id',
  assigned_vehicle: 'assigned_vehicle_id',
  assigned_driver: 'assigned_driver_id',
}

function readAdminPatch(raw) {
  const body = readBody(raw)
  const errors = {}
  const take = collector(errors)
  const data = {}

  const has = (name) => hasField(raw, name)
  const set = (name, result) => {
    const value = take(name, result)
    if (!(name in errors)) data[name] = value
  }
  /** A column that is `null=False`: present-but-null is an error rather than a
   *  no-op, which is what stops an emptied date picker wiping the field. */
  const setNotNull = (name, parse) => {
    if (body[name] === null || body[name] === undefined) {
      errors[name] = NOT_NULL
      return
    }
    set(name, parse(body[name]))
  }

  if (has('final_service')) set('final_service', relatedField(body.final_service, serviceById))
  if (has('final_category')) set('final_category', relatedField(body.final_category, categoryById))
  if (has('assigned_vehicle')) set('assigned_vehicle', relatedField(body.assigned_vehicle, vehicleById))
  if (has('assigned_driver')) set('assigned_driver', relatedField(body.assigned_driver, driverById))
  if (has('scheduled_from')) set('scheduled_from', dateTimeField(body.scheduled_from))
  if (has('scheduled_to')) set('scheduled_to', dateTimeField(body.scheduled_to))
  if (has('admin_comment')) {
    set('admin_comment', charField(body.admin_comment, { required: false, allowBlank: true }))
  }
  if (has('status')) setNotNull('status', (value) => choiceField(value, ORDER_STATUSES))
  if (has('urgency')) setNotNull('urgency', (value) => choiceField(value, URGENCIES))
  if (has('price')) set('price', intField(body.price, { min: 0, max: 100_000_000 }))
  for (const flag of ['service', 'category', 'vehicle', 'driver', 'price']) {
    const name = `admin_verified_${flag}`
    if (has(name)) data[name] = boolField(body[name])
  }
  if (has('pickup_location')) {
    setNotNull('pickup_location', (value) => charField(value, { maxLength: 500 }))
  }
  if (has('destination_location')) {
    setNotNull('destination_location', (value) => charField(value, {
      allowBlank: true, maxLength: 500,
    }))
  }
  if (has('pickup_lat')) set('pickup_lat', floatField(body.pickup_lat, { min: -90, max: 90 }))
  if (has('pickup_lng')) set('pickup_lng', floatField(body.pickup_lng, { min: -180, max: 180 }))
  if (has('destination_lat')) set('destination_lat', floatField(body.destination_lat, { min: -90, max: 90 }))
  if (has('destination_lng')) set('destination_lng', floatField(body.destination_lng, { min: -180, max: 180 }))
  if (has('requested_date')) setNotNull('requested_date', (value) => dateField(value, { required: true }))
  if (has('requested_time')) set('requested_time', timeField(body.requested_time))
  if (has('contact_name')) setNotNull('contact_name', (value) => charField(value, { maxLength: 200 }))
  if (has('contact_phone')) setNotNull('contact_phone', (value) => charField(value, { maxLength: 20 }))
  if (has('description')) setNotNull('description', (value) => charField(value))
  if (has('cargo_details')) {
    set('cargo_details', charField(body.cargo_details, { required: false, allowBlank: true }))
  }
  if (has('cargo_insured')) data.cargo_insured = boolField(body.cargo_insured)
  if (has('cargo_insurance')) data.cargo_insurance = boolField(body.cargo_insurance)
  if (has('route_stops')) set('route_stops', routeStopsField(body.route_stops))

  if (!errors.contact_phone && data.contact_phone !== undefined
    && !PHONE_PATTERN.test(data.contact_phone)) {
    errors.contact_phone = 'Enter a valid phone number.'
  }
  raiseIfInvalid(errors)
  return data
}

/**
 * The lifecycle gate, run against the merged state so an admin can verify a
 * field and send the offer in the same PATCH.
 *
 * Two of these are asymmetries worth naming. `cancelled` belongs to the
 * customer — an admin ends an order with `rejected` — and so does `approved`,
 * which means "the customer accepted"; the admin's move is `offer_sent` and the
 * customer's Accept button is what advances it. `rejected` itself stays
 * reachable from anywhere non-terminal, because it is an exit rather than a
 * rewind.
 */
function guardStatusChange(order, target, { price, verified }) {
  if (isTerminalStatus(order.status)) {
    throw DemoApiError.validation({
      status: `Order is ${orderStatusDisplay(order.status).toLowerCase()} and cannot be modified.`,
    })
  }
  if (!target || target === order.status) return

  if (target === 'cancelled') {
    throw DemoApiError.validation({
      status: 'Cancellation is reserved for the customer. Use "rejected" to end the order.',
    })
  }
  if (target === 'approved') {
    throw DemoApiError.validation({
      status: 'Approved is reserved for customer acceptance. Use "offer sent" to send a price offer.',
    })
  }
  if (target === 'new') {
    throw DemoApiError.validation({ status: 'Orders cannot be moved back to "new".' })
  }
  if (target === 'offer_sent') {
    if (price === null || price === undefined || price <= 0) {
      throw DemoApiError.validation({ price: 'Set a price before sending the offer to the customer.' })
    }
    // `verified` is null on the status endpoint, which deliberately does not
    // check the four flags — that gate is client-side only, and tightening it
    // here would make the mock stricter than the product.
    if (verified) {
      const missing = ['admin_verified_service', 'admin_verified_vehicle',
        'admin_verified_driver', 'admin_verified_price'].filter((flag) => !verified[flag])
      if (missing.length) {
        // Two keys, and the readable one has to come first: the page surfaces
        // `Object.values(data).flat()[0]`.
        throw DemoApiError.validation({
          status: 'Verify service, vehicle, driver, and price '
            + 'before sending the offer to the customer.',
          missing_verifications: missing,
        })
      }
    }
  }
  if (target === 'in_progress' && order.status !== 'approved') {
    throw DemoApiError.validation({ status: 'Customer must accept the offer before starting the job.' })
  }
  if (target === 'completed' && order.status !== 'in_progress') {
    throw DemoApiError.validation({ status: 'Only an in-progress order can be marked as completed.' })
  }

  const from = STATUS_PROGRESSION.indexOf(order.status)
  const to = STATUS_PROGRESSION.indexOf(target)
  if (from >= 0 && to >= 0 && to < from) {
    throw DemoApiError.validation({ status: 'Orders cannot be moved backward to an earlier status.' })
  }
}

/** Compared as parsed structures, so a re-serialised `route_stops` that means
 *  the same thing does not log a phantom edit on every save. */
function sameRouteStops(left, right) {
  return JSON.stringify(parseRouteStops(left)) === JSON.stringify(parseRouteStops(right))
}

register('PATCH', '/orders/admin/:id/', (req) => {
  const order = adminOrder(req.path.id)
  const data = readAdminPatch(req.body)

  const resolved = (name) => (name in data ? data[name] : order[PATCH_COLUMN[name] ?? name])

  guardStatusChange(order, data.status, {
    price: resolved('price'),
    verified: {
      admin_verified_service: resolved('admin_verified_service'),
      admin_verified_vehicle: resolved('admin_verified_vehicle'),
      admin_verified_driver: resolved('admin_verified_driver'),
      admin_verified_price: resolved('admin_verified_price'),
    },
  })

  validateAssignment(order, {
    vehicle: vehicleById(resolved('assigned_vehicle')),
    driver: driverById(resolved('assigned_driver')),
    scheduledFrom: resolved('scheduled_from'),
    scheduledTo: resolved('scheduled_to'),
    targetStatus: resolved('status'),
    cargoWeightKg: order.cargo_weight_kg,
  })

  const oldVehicle = vehicleById(order.assigned_vehicle_id)

  // Re-base the pricing category onto the newly assigned truck when the current
  // one is not among its categories, so the calculator follows the vehicle that
  // will actually do the job. One vehicle click can therefore change the
  // category, the price and the whole breakdown at once.
  if ('assigned_vehicle' in data && data.assigned_vehicle
    && data.assigned_vehicle !== order.assigned_vehicle_id) {
    const vehicle = vehicleById(data.assigned_vehicle)
    const currentFinal = 'final_category' in data ? data.final_category : order.final_category_id
    const covered = currentFinal !== null && (vehicle?.category_ids ?? []).includes(currentFinal)
    if (!covered) {
      const first = [...(vehicle?.category_ids ?? [])].sort((a, b) => a - b)[0]
      if (first !== undefined) data.final_category = first
    }
  }

  // Snapshot the customer-visible deltas before anything is written.
  const editChanges = []
  for (const field of CUSTOMER_EDITABLE_FIELDS) {
    if (!(field in data)) continue
    const before = order[field]
    const after = data[field]
    if (field === 'route_stops' && sameRouteStops(before, after)) continue
    if (before !== after) editChanges.push([field, before, after])
  }

  const statusChanged = Boolean(data.status) && data.status !== order.status
  const before = Object.fromEntries(PRICE_AFFECTING_FIELDS.map((field) => [field, order[field]]))

  if (statusChanged) {
    addStatusHistory(order, {
      oldStatus: order.status,
      newStatus: data.status,
      actorId: req.user.id,
      comment: data.admin_comment ?? '',
    })
  }

  for (const [name, value] of Object.entries(data)) {
    order[PATCH_COLUMN[name] ?? name] = value
  }

  if (editChanges.length) {
    order.admin_edited_at = nowIso()
    order.admin_edited_by = req.user.id
    for (const [field, oldValue, newValue] of editChanges) {
      addEditHistory(order, field, oldValue, newValue, req.user.id)
    }
  }

  // Even a bare verify-checkmark is news for the customer; only a genuinely
  // empty body is silent.
  if (statusChanged) stampEvent(order, `status:${data.status}`, { customerUnread: true })
  else if (Object.keys(data).length) {
    stampEvent(order, editChanges.length ? 'edited' : 'updated', { customerUnread: true })
  }

  syncVehicleStatus(oldVehicle)
  const newVehicle = vehicleById(order.assigned_vehicle_id)
  if (newVehicle && newVehicle !== oldVehicle) syncVehicleStatus(newVehicle)

  if (PRICE_AFFECTING_FIELDS.some((field) => order[field] !== before[field])) {
    try {
      backfillRouteSummary(order)
      applyPriceToOrder(order)
    } catch {
      // The admin's save must not fail because the engine did; the reason lands
      // in the breakdown and Recalculate is the retry.
    }
  }

  return serializeOrderDetail(order)
}, { auth: 'admin' })

/* --------------------------------------------------------- admin: status */

/**
 * The dedicated status endpoint the Send-for-Approval bar posts to. Same rules
 * as the PATCH gate, reported as `{detail}` because this view answers with a
 * sentence rather than a field-error dict — except the assignment re-check,
 * which does come back per field because it names a specific select.
 */
register('POST', '/orders/admin/:id/status/', (req) => {
  const order = adminOrder(req.path.id)
  if (isTerminalStatus(order.status)) {
    throw new DemoApiError(400, `Order is ${orderStatusDisplay(order.status).toLowerCase()} and cannot be modified.`)
  }

  const target = req.body?.status
  const comment = String(req.body?.comment ?? '')
  if (!ORDER_STATUSES.includes(target)) throw new DemoApiError(400, 'Invalid status.')

  try {
    guardStatusChange(order, target, { price: order.price, verified: null })
  } catch (error) {
    const first = error instanceof DemoApiError && error.data
      ? Object.values(error.data).flat()[0]
      : null
    throw new DemoApiError(400, String(first ?? 'Invalid status.'))
  }

  if (ACTIVE_STATUSES.includes(target) && target !== order.status) {
    validateAssignment(order, {
      vehicle: vehicleById(order.assigned_vehicle_id),
      driver: driverById(order.assigned_driver_id),
      scheduledFrom: order.scheduled_from,
      scheduledTo: order.scheduled_to,
      targetStatus: target,
    })
  }

  const oldStatus = order.status
  order.status = target
  if (comment) order.admin_comment = comment
  addStatusHistory(order, { oldStatus, newStatus: target, actorId: req.user.id, comment })
  stampEvent(order, `status:${target}`, { customerUnread: true })
  syncVehicleStatus(vehicleById(order.assigned_vehicle_id))

  return serializeOrderDetail(order)
}, { auth: 'admin' })

/* ---------------------------------------------------------- admin: price */

register('POST', '/orders/admin/:id/recalculate-price/', (req) => {
  const order = adminOrder(req.path.id)

  // The drift sync posts a fresh route summary when the live route disagrees
  // with what the order stored. Merging rather than replacing keeps the stops —
  // only the three numbers are refreshed, and a negative or unparseable one is
  // dropped rather than written.
  const summary = req.body?.route_summary
  if (summary && typeof summary === 'object') {
    const merged = routeStopsData(order)
    for (const key of ['distance', 'duration', 'ascent']) {
      if (!(key in summary)) continue
      const value = Number(summary[key])
      if (Number.isFinite(value) && value >= 0) merged[key] = value
    }
    order.route_stops = JSON.stringify(merged)
  }

  const { breakdown, computed } = applyPriceToOrder(order)
  // `price` comes off the row rather than the quote: when nothing could be
  // computed the stored number is what the admin still has, and the toast
  // compares old against new.
  return { price: order.price, pricing_breakdown: breakdown, computed }
}, { auth: 'admin' })

register('POST', '/orders/admin/:id/undo-auto-promotion/', (req) => {
  const order = adminOrder(req.path.id)
  if (order.status !== 'under_review') {
    throw new DemoApiError(400, 'Only orders currently under review can be undone.')
  }

  const latest = statusHistoryForOrder(order.id)[0]
  if (!latest || !latest.is_auto_promotion) {
    throw new DemoApiError(400, 'No auto-promotion to undo.')
  }
  if (Date.now() - Date.parse(latest.created_at) > UNDO_WINDOW_MS) {
    throw new DemoApiError(400, 'Undo window has expired.')
  }

  store.orderStatusHistory = store.orderStatusHistory.filter((row) => row.id !== latest.id)
  order.status = 'new'
  // `is_read_by_customer` is deliberately left alone: the notification has
  // already gone out, and pretending otherwise would be the lie. A customer who
  // refetches simply sees "New" again.

  return serializeOrderDetail(order)
}, { auth: 'admin' })

/* -------------------------------------------------- admin: notifications */

register('GET', '/orders/admin/notifications/', (req) => {
  const rows = store.orders
  const today = todayKey()
  return {
    ...notificationPayload(rows, req.user),
    new_orders_count: rows.filter((order) => order.status === 'new').length,
    // The badges on the saved-view tabs.
    view_counts: {
      all: rows.filter((order) => !isTerminalStatus(order.status)).length,
      unread: rows.filter((order) => !order.is_read_by_admin).length,
      awaiting_price: rows.filter((order) => ['new', 'under_review'].includes(order.status)).length,
      pending_customer: rows.filter((order) => order.status === 'offer_sent').length,
      today: rows.filter((order) => order.requested_date === today
        && !isTerminalStatus(order.status)).length,
      in_progress: rows.filter((order) => order.status === 'in_progress').length,
      history: rows.filter((order) => order.status === 'completed').length,
    },
  }
}, { auth: 'admin' })

register('POST', '/orders/admin/notifications/mark-read/', (req) => markRead(
  store.orders,
  req.body,
  'is_read_by_admin',
), { auth: 'admin' })

/* ------------------------------------------------------------ CSV export
 *
 * Two endpoints, one row builder: the bulk export is a row per order and the
 * single-order export is that same row transposed into (Field, Value) pairs, so
 * the two cannot disagree about what a column means.
 */

const ORDER_EXPORT_COLUMNS = [
  'ID', 'Created', 'Status', 'Urgency',
  'Customer name', 'Customer email', 'Customer phone', 'Company',
  'Contact name', 'Contact phone',
  'Pickup location', 'Pickup lat', 'Pickup lng',
  'Destination location', 'Destination lat', 'Destination lng',
  'Requested date', 'Requested time',
  'Service', 'Category',
  'Assigned vehicle', 'Vehicle plate', 'Assigned driver',
  'Scheduled from', 'Scheduled to',
  'Price', 'Customer accepted at',
  'Description', 'Cargo details', 'Admin comment', 'User note',
]

/**
 * CSV injection. A cell opening with `=`, `+`, `-`, `@`, a tab or a carriage
 * return is a formula to Excel and Sheets, and a third of these columns hold
 * text a customer typed. Prefixing with an apostrophe is what the real backend
 * does; it costs nothing and is worth keeping visible.
 */
const CSV_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

function safeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return text && CSV_INJECTION_PREFIXES.includes(text[0]) ? `'${text}` : text
}

/** `csv.writer` with QUOTE_MINIMAL and CRLF endings, including the terminator
 *  after the final row — `writerow` always writes one. */
function toCsv(rows) {
  const cell = (value) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`
}

const EXPORT_STAMP = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * `YYYY-MM-DD HH:MM`, in Tbilisi.
 *
 * Django's `strftime` on the stored UTC datetime printed UTC here, four hours
 * away from everything else in the product. The demo prints the zone the rest
 * of the app speaks, because a Created column that disagrees with the row above
 * it reads as a bug rather than as a quirk.
 */
function stampMinutes(iso) {
  if (!iso) return ''
  const parts = EXPORT_STAMP.formatToParts(new Date(iso))
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}

/** A multilingual field flattened for the spreadsheet: English, or the first
 *  language that has anything in it. */
function multilingualEn(value) {
  if (value && typeof value === 'object') {
    return value.en || Object.values(value).find(Boolean) || ''
  }
  return value || ''
}

function exportRow(order) {
  const user = userById(order.user_id)
  const service = serviceById(order.final_service_id) ?? serviceById(order.selected_service_id)
  const category = categoryById(order.final_category_id) ?? categoryById(order.selected_category_id)
  const vehicle = vehicleById(order.assigned_vehicle_id)
  const driver = driverById(order.assigned_driver_id)
  const optional = (value) => (value === null || value === undefined ? '' : value)

  return [
    order.id,
    stampMinutes(order.created_at),
    orderStatusDisplay(order.status),
    URGENCY_LABELS[order.urgency] ?? order.urgency,
    safeCell(userFullName(user)),
    safeCell(user?.email ?? ''),
    safeCell(user?.phone_number ?? ''),
    safeCell(user?.company_name ?? ''),
    safeCell(order.contact_name),
    safeCell(order.contact_phone),
    safeCell(order.pickup_location),
    optional(order.pickup_lat),
    optional(order.pickup_lng),
    safeCell(order.destination_location),
    optional(order.destination_lat),
    optional(order.destination_lng),
    order.requested_date ?? '',
    order.requested_time ? order.requested_time.slice(0, 5) : '',
    service ? multilingualEn(service.name) : '',
    category ? multilingualEn(category.name) : '',
    vehicle?.name ?? '',
    vehicle?.plate_number ?? '',
    driver ? driverFullName(driver) : '',
    stampMinutes(order.scheduled_from),
    stampMinutes(order.scheduled_to),
    optional(order.price),
    stampMinutes(order.customer_accepted_at),
    safeCell(order.description),
    safeCell(order.cargo_details),
    safeCell(order.admin_comment),
    safeCell(order.user_note),
  ]
}

/** The byte-order mark is what makes Excel open Georgian and Cyrillic text as
 *  UTF-8 instead of mojibake, which for this data set is most of it. */
function csvFile(filename, rows) {
  return file(new Blob(['\uFEFF', toCsv(rows)], { type: 'text/csv; charset=utf-8' }), filename)
}

function fileStamp() {
  return stampMinutes(nowIso()).replace(/[-:]/g, '').replace(' ', '_')
}

register('GET', '/orders/admin/export/', (req) => {
  // The export takes both spellings of two params — the list page sends
  // `selected_service` and `assigned_vehicle`, older links `service` and
  // `vehicle` — and ignores `ordering` and `view` entirely, always writing
  // newest first.
  const params = { ...req.params }
  if (!params.selected_service && params.service) params.selected_service = params.service
  if (!params.assigned_vehicle && params.vehicle) params.assigned_vehicle = params.vehicle

  const rows = byNewestFirst(filterAdminOrders(store.orders, params, req.paramsAll))

  let range = ''
  if (params.date_from || params.date_to) {
    // A malformed bound is dropped from the filter, so the filename says
    // 'start'/'end' rather than embedding a string the query ignored.
    const from = dateField(params.date_from).value ? params.date_from : 'start'
    const to = dateField(params.date_to).value ? params.date_to : 'end'
    range = `_${from}_to_${to}`
  }

  return csvFile(`orders${range}_${fileStamp()}.csv`, [ORDER_EXPORT_COLUMNS, ...rows.map(exportRow)])
}, { auth: 'admin' })

register('GET', '/orders/admin/:id/export/', (req) => {
  const order = adminOrder(req.path.id)
  const values = exportRow(order)
  const rows = [
    ['Field', 'Value'],
    ...ORDER_EXPORT_COLUMNS.map((column, index) => [column, values[index]]),
  ]
  return csvFile(`order_${order.id}.csv`, rows)
}, { auth: 'admin' })

/* --------------------------------------------------------- route profile */

/**
 * The routing proxy. Upstream this hid an OpenRouteService key behind the
 * server; here `synthesizeRoute` builds the same GeoJSON from the coordinates
 * alone — deterministically, so what it returns for a seeded order's stops
 * matches the `route_stops` numbers that order already carries and the admin
 * page's drift sync stays quiet instead of re-pricing on every open.
 *
 * The error contract is `{code, detail}` rather than `{detail}`, and both
 * callers read `code`. A pin in the sea or outside the country is the one
 * failure the synthesiser can have, and it maps to ORS's `no_route`.
 */
register('POST', '/orders/route-profile/', (req) => {
  const coords = req.body?.coordinates
  const invalid = (detail) => new DemoApiError(400, detail, { code: 'invalid_input', detail })

  if (!Array.isArray(coords) || coords.length < 2) {
    throw invalid('coordinates must be a list of >=2 [lng, lat] pairs.')
  }

  const normalised = []
  for (const pair of coords) {
    if (!Array.isArray(pair) || pair.length !== 2
      || !pair.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw invalid('Each coordinate must be [lng, lat] as numbers.')
    }
    const [lng, lat] = pair
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) throw invalid('Coordinate out of range.')
    normalised.push([lng, lat])
  }

  try {
    return synthesizeRoute(normalised)
  } catch (error) {
    if (!(error instanceof NoRouteError)) throw error
    throw new DemoApiError(404, error.message, { code: 'no_route', detail: error.message })
  }
})

/* --------------------------------------------------------- price preview */

/**
 * The wizard's live estimate. Builds a transient order — never stored — and
 * runs it through the same engine the admin's first open will, so the number
 * the customer is shown on the review step is the number that gets saved.
 *
 * An out-of-range weight, day count or floor is silently dropped rather than
 * rejected: this fires as the customer types, and a half-entered value should
 * mean "no contribution", not a red toast.
 */
register('POST', '/orders/preview-price/', (req) => {
  const data = readBody(req.body)

  const bounded = (raw, low, high) => {
    const value = Number(raw)
    return Number.isFinite(value) && value >= low && value <= high ? value : null
  }
  const nonNegative = (raw) => {
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : null
  }

  const weight = bounded(data.cargo_weight_kg, 0.01, 1_000_000)
  const days = bounded(data.cargo_days, 1, 365)
  const floor = bounded(data.cargo_floor, 0, 200)

  const summary = data.route_summary && typeof data.route_summary === 'object' ? data.route_summary : {}
  // Addresses only — the engine reads them for keyword-zone matching, and
  // forwarding a whole stop would imply coordinates the preview does not have.
  const addressesOnly = (raw) => (Array.isArray(raw) ? raw : [])
    .filter((stop) => stop && typeof stop === 'object' && stop.address)
    .map((stop) => ({ address: String(stop.address) }))

  const service = serviceById(Number(data.service_id))
  // The customer picked "let the admin decide" but did choose a service: fall
  // back to the service's first category, exactly as the auto-assigner will, so
  // the preview and the stored price agree.
  let category = categoryById(Number(data.category_id))
  if (!category && service) {
    category = (service.car_category_ids ?? [])
      .map((id) => categoryById(id))
      .filter(Boolean)
      .sort((a, b) => a.id - b.id)[0]
  }
  if (!category) {
    return { price: null, computed: false, breakdown: { mode: 'unknown', error: 'no_category' } }
  }

  const transient = {
    id: null,
    selected_service_id: service?.id ?? null,
    selected_category_id: category.id,
    // Populated on the `final_*` side too, so the engine takes the preview
    // values directly rather than treating them as hints awaiting confirmation.
    final_service_id: service?.id ?? null,
    final_category_id: category.id,
    assigned_driver_id: null,
    cargo_weight_kg: weight,
    cargo_days: days,
    cargo_floor: floor,
    pickup_location: String(data.pickup_location ?? '').trim(),
    destination_location: String(data.destination_location ?? '').trim(),
    pickup_lat: null,
    pickup_lng: null,
    destination_lat: null,
    destination_lng: null,
    route_stops: JSON.stringify({
      distance: nonNegative(summary.distance),
      duration: nonNegative(summary.duration),
      ascent: nonNegative(summary.ascent),
      pickups: addressesOnly(summary.pickups),
      destinations: addressesOnly(summary.destinations),
    }),
  }

  backfillRouteSummary(transient)
  const { price, breakdown, computed } = quote(transient)
  return { price, breakdown, computed }
})
