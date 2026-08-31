/**
 * Pricing — the rate tables the admin edits, and the engine every price in the
 * demo comes out of.
 *
 * Upstream this was three Django modules: `pricing/models.py` (the rows),
 * `pricing/pricing_engine.py` (pure maths over a frozen snapshot, no Django
 * imports) and `pricing/order_pricing.py` (the bridge that turns an Order into
 * engine arguments). The split survives here as three sections, because it is
 * what makes the one guarantee this file owes the rest of the demo checkable:
 * the number the Calculator tab predicts and the number an order is priced at
 * are produced by the same code, from the same rows, with the same rounding.
 * `quote(order)` at the bottom is what the orders handler imports for
 * `/orders/preview-price/` and `/orders/admin/<id>/recalculate-price/`.
 *
 * The shape of the calculation, in the order the results panel lists it:
 *
 *   weight_revenue   = max(weight, min_kg) × per_kg
 *   distance_revenue = CEIL₁₀(distance × per_km × elevation_multiplier)
 *   fixed_revenue    = max(0, min_fix − distance × km_fix)
 *   total_revenue    = CEIL₁₀(the three above)
 *   company_fee      = total × fee_pct        driver_gross = total − fee
 *   fuel_cost        = CEIL₁₀(distance × fuel_per_km × elevation_multiplier)
 *   driver_net       = driver_gross − fuel_cost
 *
 * VAT and driver VAT hang off the side: both are informational, neither flows
 * into driver_net. That is not an oversight ported from a bug — the spreadsheet
 * this replaced showed them as obligations to be aware of, not deductions.
 *
 * Two things a reader looking for a "zone multiplier" or an "urgency
 * multiplier" should know, because their absence is deliberate. The zone does
 * not scale anything: it *selects a row* from the type × zone rate table, and
 * every number in the calculation comes from that row, so two zones differ in
 * their whole rate card rather than by a coefficient. And urgency has never
 * touched price here — it is a dispatch signal the admin sorts by. What does
 * scale the total is `cargo_days` (only when the chosen service enables the
 * days field) plus a flat per-order floor surcharge from the service.
 *
 * Money arrives and leaves as strings, exactly as `COERCE_DECIMAL_TO_STRING`
 * left it, but the middle of the calculation is float where Django's was exact
 * Decimal. That departure has one place it could bite and it is not rounding
 * error in the last displayed digit: the CEIL₁₀ steps, where a total that
 * should be 420 arriving as 420.00000000000006 rounds up to 430 and is wrong by
 * a visible ten lari. `ceilToTen` quantises to nine decimal places before it
 * rounds up — far past anything a rate column can hold, far short of where the
 * noise lives — and that is the whole of the mitigation.
 */
import { DemoApiError, notFound, register } from '../router'
import {
  categoryById,
  driverById,
  equipmentById,
  nextId,
  pumpRateFor,
  rateById,
  rateFor,
  serviceById,
  store,
  zoneById,
} from '../store'

/* ------------------------------------------------------------- vocabulary */

const RATE_TYPES = ['hiab', 'trailer', 'cart']
const ZONE_KINDS = ['keyword', 'distance']
const ZONE_SCOPES = ['within', 'crossing']
const PUMP_KINDS = ['pump', 'pump_mixer']

/* ---------------------------------------------------------------- numbers */

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Quantise away the last few bits of float noise without touching any digit
 *  a rate column could actually hold — `per_kg` is the deepest at six places. */
function round(value, places = 9) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** Excel's `CEILING(value, 10)`, which the spreadsheet applied to the two
 *  revenue lines and the fuel line and the customer therefore expects. */
function ceilToTen(value) {
  return Math.ceil(round(value) / 10) * 10
}

/**
 * A computed number on its way out of the engine. Trailing zeros go because
 * these values have no column behind them to fix a scale — unlike the rate
 * fields, which are passed through at the precision the store holds them at so
 * the rates table keeps rendering `0.1500` rather than `0.15`.
 */
function dec(value, places = 6) {
  const text = round(value, places).toFixed(places)
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

/* ------------------------------------------------------- field validation */

/** Aggregated the way a DRF serializer aggregates: every bad field at once. */
class FieldError extends Error {}

function coerce(rule, raw, field) {
  const blank = raw === null || raw === undefined || raw === ''
  if (blank && rule.nullable) return null
  if (blank && rule.kind !== 'text' && rule.kind !== 'boolean') {
    throw new FieldError('This field may not be null.')
  }

  switch (rule.kind) {
    case 'choice':
      if (!rule.choices.includes(raw)) {
        throw new FieldError(`"${raw}" is not a valid choice.`)
      }
      return raw

    case 'text': {
      const text = raw === null || raw === undefined ? '' : String(raw)
      if (rule.maxLength && text.length > rule.maxLength) {
        throw new FieldError(`Ensure this field has no more than ${rule.maxLength} characters.`)
      }
      return text
    }

    // The multilingual JSONFields. Django validated nothing beyond "is it
    // JSON", and the I18nInput control can only produce {en, ka, ru}, so the
    // only thing worth rejecting is a scalar where an object belongs.
    case 'i18n':
      if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new FieldError('Expected a dictionary of items.')
      }
      return { ...raw }

    case 'boolean':
      return Boolean(raw)

    case 'integer': {
      const value = Number(raw)
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new FieldError('A valid integer is required.')
      }
      // Every integer column here is a PositiveIntegerField.
      if (value < 0) throw new FieldError('Ensure this value is greater than or equal to 0.')
      return value
    }

    case 'decimal': {
      const value = Number(raw)
      if (!Number.isFinite(value)) throw new FieldError('A valid number is required.')
      const min = rule.min ?? 0
      if (value < min) {
        throw new FieldError(`Ensure this value is greater than or equal to ${min}.`)
      }
      if (rule.max !== undefined && value > rule.max) {
        throw new FieldError(`Ensure this value is less than or equal to ${rule.max}.`)
      }
      // Fixed to the column's scale, so what the table renders after a save is
      // what it rendered before one.
      return value.toFixed(rule.places)
    }

    default:
      throw new Error(`Unknown field kind "${rule.kind}" on ${field}`)
  }
}

/**
 * Write a request body onto a row through a field spec. `partial` is the PATCH
 * path: absent keys are left alone rather than reset to their default, which is
 * the whole difference between DRF's PATCH and PUT.
 */
function applyFields(spec, body, row, { partial }) {
  const source = body && typeof body === 'object' ? body : {}
  const errors = {}

  for (const [field, rule] of Object.entries(spec)) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      if (partial) continue
      if (rule.required) {
        errors[field] = 'This field is required.'
        continue
      }
      row[field] = typeof rule.default === 'function' ? rule.default() : rule.default
      continue
    }
    try {
      row[field] = coerce(rule, source[field], field)
    } catch (error) {
      if (error instanceof FieldError) errors[field] = error.message
      else throw error
    }
  }

  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return row
}

const now = () => new Date().toISOString()

/** Codepoint order, which is what Postgres gave `Meta.ordering` on a slug. */
function byText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

/* --------------------------------------------------------- the rate tables */

const ZONE_FIELDS = {
  name: { kind: 'i18n', default: () => ({}) },
  kind: { kind: 'choice', choices: ZONE_KINDS, default: 'distance' },
  keywords: { kind: 'text', default: '' },
  keyword_scope: { kind: 'choice', choices: ZONE_SCOPES, default: 'within' },
  max_distance_km: { kind: 'integer', nullable: true, default: null },
  order: { kind: 'integer', default: 0 },
  is_active: { kind: 'boolean', default: true },
}

const RATE_FIELDS = {
  type: { kind: 'choice', choices: RATE_TYPES, required: true },
  zone: { kind: 'text', maxLength: 40, required: true },
  min_fix: { kind: 'decimal', places: 4, required: true },
  per_kg: { kind: 'decimal', places: 6, required: true },
  max_kg: { kind: 'integer', required: true },
  min_kg: { kind: 'integer', default: 0 },
  per_km: { kind: 'decimal', places: 4, required: true },
  fixed_price: { kind: 'decimal', places: 4, default: '0.0000' },
  fixed_radius: { kind: 'integer', default: 0 },
  fee_pct: { kind: 'decimal', places: 4, max: 1, default: '0.1500' },
  km_fix: { kind: 'decimal', places: 4, required: true },
  fuel_per_km: { kind: 'decimal', places: 4, default: '1.2600' },
}

const ELEVATION_FIELDS = {
  max_gradient: { kind: 'decimal', places: 4, nullable: true, default: null },
  multiplier: { kind: 'decimal', places: 4, min: 0.0001, required: true },
  order: { kind: 'integer', default: 0 },
}

const PUMP_FIELDS = {
  kind: { kind: 'choice', choices: PUMP_KINDS, required: true },
  per_m3: { kind: 'decimal', places: 4, required: true },
  fixed: { kind: 'decimal', places: 4, default: '0.0000' },
  max_m3: { kind: 'integer', default: 100 },
}

const EQUIPMENT_FIELDS = {
  name: { kind: 'i18n', default: () => ({}) },
  unit: { kind: 'i18n', default: () => ({}) },
  price: { kind: 'decimal', places: 2, required: true },
  order: { kind: 'integer', default: 0 },
  is_active: { kind: 'boolean', default: true },
}

/** `Zone.Meta.ordering`, and the order `_detect_zone` evaluates in. */
function orderedZones() {
  return [...store.pricingZones].sort((a, b) => a.order - b.order || byText(a.slug, b.slug))
}

function orderedRates() {
  return [...store.pricingRates].sort((a, b) => byText(a.type, b.type) || byText(a.zone, b.zone))
}

/**
 * `['order', 'max_gradient']` with Postgres's NULLS LAST, which matters more
 * than the ordering usually does: the engine takes the first bucket whose cap
 * the gradient fits under, and a null cap fits everything. Sorting the
 * open-ended bucket to the front would flatten the whole table to one
 * multiplier.
 */
function orderedElevation() {
  return [...store.pricingElevation].sort((a, b) => (
    a.order - b.order
    || (a.max_gradient === null ? 1 : 0) - (b.max_gradient === null ? 1 : 0)
    || toNumber(a.max_gradient) - toNumber(b.max_gradient)
  ))
}

function orderedPumpRates() {
  return [...store.pricingPumpMixer].sort((a, b) => byText(a.kind, b.kind))
}

function orderedEquipment() {
  return [...store.pricingEquipment].sort((a, b) => a.order - b.order || a.id - b.id)
}

/**
 * Django's `slugify`, which drops non-ASCII rather than transliterating it. A
 * zone named only in Georgian therefore slugifies to nothing and falls through
 * to `zone`, `zone-2`, … — the same unhelpful-but-stable result the real admin
 * got, and the reason the zones table prints the slug under the name.
 */
function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueZoneSlug(desired) {
  const base = (desired || 'zone').slice(0, 40)
  const taken = (candidate) => store.pricingZones.some((zone) => zone.slug === candidate)
  if (!taken(base)) return base
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base.slice(0, 40 - String(suffix).length - 1)}-${suffix}`
    if (!taken(candidate)) return candidate
  }
}

/* ------------------------------------------------------------- the engine */

/**
 * The stepped elevation multiplier: the first bucket whose cap the m/km
 * gradient fits under. Deleting the open-ended bucket is a supported thing for
 * an admin to do, and the fallback is deliberately 1 rather than the last
 * bucket's value — a gradient off the end of a table nobody finished
 * configuring should not silently inherit the steepest surcharge.
 *
 * Returns the column's own string, not a number, because it is echoed straight
 * back out: the panel is showing the admin which row of their table fired, and
 * `1.1000` is the row they will go looking for.
 */
function elevationMultiplier(gradient) {
  for (const bucket of orderedElevation()) {
    if (bucket.max_gradient === null || gradient <= toNumber(bucket.max_gradient)) {
      return bucket.multiplier
    }
  }
  return '1'
}

/**
 * One hauling quote. `rate` is the store row itself, so every rate value in the
 * result keeps the exact string the column holds; only the computed lines are
 * numbers. Returns null when the type × zone pair has no row — the caller
 * decides whether that is a 404 or an error breakdown.
 */
function runQuote({ type, zone, weightKg, distanceKm, elevationM, driverVatRate }) {
  const rate = rateFor(type, zone)
  if (!rate) return null

  const weight = toNumber(weightKg)
  const distance = toNumber(distanceKm)
  const elevation = toNumber(elevationM)

  const perKg = toNumber(rate.per_kg)
  const perKm = toNumber(rate.per_km)
  const minFix = toNumber(rate.min_fix)
  const kmFix = toNumber(rate.km_fix)
  const feePct = toNumber(rate.fee_pct)
  const fuelPerKm = toNumber(rate.fuel_per_km)
  const maxKg = toNumber(rate.max_kg)
  const minKg = toNumber(rate.min_kg)
  const fixedRadius = toNumber(rate.fixed_radius)

  const gradient = distance === 0 ? 0 : elevation / distance
  const multiplierRaw = elevationMultiplier(gradient)
  const multiplier = toNumber(multiplierRaw, 1)

  // Cargo under the rate's minimum bills as if it weighed the minimum. min_kg
  // defaults to 0, which makes this a no-op on most rows.
  const effectiveWeight = Math.max(weight, minKg)
  const weightRevenue = effectiveWeight * perKg
  const distanceRevenue = ceilToTen(distance * perKm * multiplier)
  // The fixed component is a floor that a long enough run erodes to nothing,
  // not a surcharge: min_fix is what a job is worth before distance pays for
  // itself, and km_fix is the rate at which distance takes over.
  const fixedRevenue = Math.max(0, minFix - distance * kmFix)

  // Rounded here, not only at display time, so company_fee, VAT, driver_gross
  // and driver_net are all percentages of the number the customer actually
  // pays rather than of a total they never see.
  const totalRevenue = ceilToTen(weightRevenue + distanceRevenue + fixedRevenue)

  const companyFee = totalRevenue * feePct
  const driverGross = totalRevenue - companyFee
  const fuelCost = ceilToTen(distance * fuelPerKm * multiplier)
  const vatRate = toNumber(store.pricingConfig.vat)
  const driverNet = driverGross - fuelCost

  const warnings = []
  if (maxKg && weight > maxKg) warnings.push('weight_exceeds_max')
  if (fixedRadius && distance > fixedRadius) warnings.push('distance_exceeds_fixed_radius')

  return {
    // Echoed verbatim: strings stay at the column's precision, the three
    // integer columns stay integers. The two serializers below differ on
    // exactly that point.
    rate: {
      type,
      zone,
      min_fix: rate.min_fix,
      per_kg: rate.per_kg,
      max_kg: rate.max_kg,
      min_kg: rate.min_kg,
      per_km: rate.per_km,
      fixed_price: rate.fixed_price,
      fixed_radius: rate.fixed_radius,
      fee_pct: rate.fee_pct,
      km_fix: rate.km_fix,
      fuel_per_km: rate.fuel_per_km,
    },
    gradient,
    elevation_multiplier: multiplierRaw,
    fuel_per_km: rate.fuel_per_km,
    min_kg: minKg,
    effective_weight_kg: effectiveWeight,
    weight_min_applied: effectiveWeight > weight,
    weight_revenue: weightRevenue,
    distance_revenue: distanceRevenue,
    fixed_revenue: fixedRevenue,
    total_revenue: totalRevenue,
    company_fee: companyFee,
    driver_gross: driverGross,
    fuel_cost: fuelCost,
    // Equal to driver_net by definition since fuel stopped being deducted
    // twice. Kept because breakdowns written before that fix still carry it
    // and the panel reads whatever it finds.
    profit_before_vat: driverNet,
    vat: totalRevenue * vatRate,
    vat_rate: store.pricingConfig.vat,
    driver_vat: driverGross * driverVatRate,
    driver_vat_rate: driverVatRate,
    driver_net: driverNet,
    warnings,
  }
}

/**
 * What `POST /pricing/quote/` returns. Every value is a string, including the
 * three integer rate columns — the view stringified the whole `rate` dict
 * indiscriminately, and the Calculator only reads `rate.fee_pct` out of it, so
 * nothing upstream ever noticed. `min_kg` at the top level escapes as a number
 * because it is read separately, and the results panel divides it by 1000.
 */
function serializeQuote(quoted) {
  return {
    rate: Object.fromEntries(
      Object.entries(quoted.rate).map(([key, value]) => [key, String(value)]),
    ),
    gradient: dec(quoted.gradient),
    elevation_multiplier: String(quoted.elevation_multiplier),
    fuel_per_km: String(quoted.fuel_per_km),
    min_kg: quoted.min_kg,
    weight_min_applied: quoted.weight_min_applied,
    weight_revenue: dec(quoted.weight_revenue),
    distance_revenue: dec(quoted.distance_revenue),
    fixed_revenue: dec(quoted.fixed_revenue),
    total_revenue: dec(quoted.total_revenue),
    company_fee: dec(quoted.company_fee),
    driver_gross: dec(quoted.driver_gross),
    fuel_cost: dec(quoted.fuel_cost),
    profit_before_vat: dec(quoted.profit_before_vat),
    vat: dec(quoted.vat),
    vat_rate: String(quoted.vat_rate),
    driver_vat: dec(quoted.driver_vat),
    driver_vat_rate: quoted.driver_vat_rate.toFixed(4),
    driver_net: dec(quoted.driver_net),
    warnings: quoted.warnings,
  }
}

/**
 * The same quote as it was stored on `Order.pricing_breakdown`. Upstream this
 * went through a recursive Decimal→str walk, which left integers alone — so
 * `rate.max_kg`, `rate.min_kg`, `rate.fixed_radius` and `min_kg` are numbers
 * here and strings in the response above. The divergence is not worth
 * smoothing over: the price panel and the calculator read different keys, and
 * reproducing it keeps a seeded breakdown and a freshly computed one identical.
 */
function breakdownQuote(quoted) {
  return {
    rate: { ...quoted.rate },
    gradient: dec(quoted.gradient),
    elevation_multiplier: String(quoted.elevation_multiplier),
    fuel_per_km: String(quoted.fuel_per_km),
    min_kg: quoted.min_kg,
    effective_weight_kg: dec(quoted.effective_weight_kg),
    weight_min_applied: quoted.weight_min_applied,
    weight_revenue: dec(quoted.weight_revenue),
    distance_revenue: dec(quoted.distance_revenue),
    fixed_revenue: dec(quoted.fixed_revenue),
    total_revenue: dec(quoted.total_revenue),
    company_fee: dec(quoted.company_fee),
    driver_gross: dec(quoted.driver_gross),
    fuel_cost: dec(quoted.fuel_cost),
    profit_before_vat: dec(quoted.profit_before_vat),
    vat: dec(quoted.vat),
    vat_rate: String(quoted.vat_rate),
    driver_vat: dec(quoted.driver_vat),
    driver_vat_rate: quoted.driver_vat_rate.toFixed(4),
    driver_net: dec(quoted.driver_net),
    warnings: quoted.warnings,
  }
}

/* ----------------------------------------------------- the order → engine */

/** `Order.route_stops` is a TextField holding JSON, so anything unparseable is
 *  the same as no route at all rather than an error. */
function routeStops(order) {
  const raw = order?.route_stops
  if (raw && typeof raw === 'object') return raw
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Every address the job touches, lowercased, for keyword zone matching.
 * Multi-stop orders carry the full list inside `route_stops`; single-stop ones
 * only fill the flat `pickup_location` / `destination_location` pair. Blanks
 * are dropped, because an empty string contains no keyword and would fail the
 * "every stop is inside the zone" test on a technicality.
 */
function stopAddresses(order) {
  const stops = routeStops(order)
  const addresses = []

  const collect = (list, flat) => {
    const entries = Array.isArray(list) ? list : []
    if (entries.length) {
      for (const stop of entries) {
        const address = String((stop && stop.address) || '').trim().toLowerCase()
        if (address) addresses.push(address)
      }
      return
    }
    const fallback = String(flat || '').toLowerCase()
    if (fallback) addresses.push(fallback)
  }

  collect(stops.pickups, order?.pickup_location)
  collect(stops.destinations, order?.destination_location)
  return addresses
}

function distanceKmFor(order) {
  // ORS reports metres.
  return toNumber(routeStops(order).distance) / 1000
}

function elevationMFor(order) {
  return toNumber(routeStops(order).ascent)
}

/**
 * First active zone that matches, in admin drag order.
 *
 * A keyword zone reads every stop, and `keyword_scope` decides what "matches"
 * means: `within` wants all of them inside the zone (a Tbilisi↔Tbilisi run),
 * `crossing` wants at least one outside it (a run that leaves town). That pair
 * is why the seed's first two zones share a keyword list and still price
 * differently. A distance zone matches under its cap, or unconditionally when
 * the cap is null — which is what makes the last zone a catch-all.
 *
 * Returns null when nothing matched, which normally means someone deleted or
 * deactivated the catch-all.
 */
function detectZone(order) {
  const addresses = stopAddresses(order)
  const distance = distanceKmFor(order)

  for (const zone of orderedZones()) {
    if (!zone.is_active) continue

    if (zone.kind === 'keyword') {
      const keywords = String(zone.keywords || '')
        .split(',')
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean)
      if (!keywords.length || !addresses.length) continue

      const inside = addresses.map((address) => keywords.some((word) => address.includes(word)))
      if (zone.keyword_scope === 'crossing') {
        if (!inside.every(Boolean)) return zone.slug
      } else if (inside.every(Boolean)) {
        return zone.slug
      }
      continue
    }

    if (zone.max_distance_km === null || zone.max_distance_km === undefined) return zone.slug
    if (distance <= toNumber(zone.max_distance_km)) return zone.slug
  }
  return null
}

/**
 * The days multiplier is opt-in twice over: the service has to have switched
 * the days field on, and the customer has to have filled it in. An order with
 * only a category — no service — gets no multiplier, because nothing said the
 * job is priced by the day.
 */
function daysMultiplier(order, service) {
  if (!service) return 1
  const mode = (service.cargo_field_config || {}).days || 'off'
  if (mode === 'off') return 1
  const days = toNumber(order?.cargo_days)
  return days > 0 ? Math.trunc(days) : 1
}

/** Flat, once per order, not per floor — the service sets the price of having
 *  to carry anything upstairs at all. */
function floorSurcharge(order, service) {
  if (!service) return 0
  if (toNumber(order?.cargo_floor) <= 0) return 0
  return Math.max(0, toNumber(service.floor_price))
}

/**
 * Price an order. Exported because `/orders/preview-price/` and
 * `/orders/admin/<id>/recalculate-price/` must agree with the pricing screen to
 * the lari, and the only way to guarantee that is for all three to be this
 * function.
 *
 * `order` is a store row, or the transient object the preview endpoint builds
 * from the wizard's payload — anything carrying `final_category_id` /
 * `selected_category_id`, the matching service ids, `route_stops`,
 * `pickup_location`, `destination_location`, `cargo_weight_kg`, `cargo_days`,
 * `cargo_floor` and `assigned_driver_id`.
 *
 * Returns `{price, breakdown, computed}`. `price` is already rounded up to the
 * next multiple of ten and is what belongs in `Order.price`; `breakdown.total`
 * keeps the exact figure, so the two legitimately disagree by up to ten lari
 * and the panel shows both. When the price cannot be computed at all, `price`
 * is null and `breakdown` carries the reason — that is a real state an admin
 * sees, not an error, so it is never thrown.
 */
export function quote(order) {
  // The admin's final_* assignments win over the customer's selected_* ones:
  // once an admin has decided which vehicle type does the job, that is what it
  // is priced as. Categories decide *how* a price is computed; services decide
  // which inputs the customer was asked for.
  const category = categoryById(order?.final_category_id ?? order?.selected_category_id)
  const service = serviceById(order?.final_service_id ?? order?.selected_service_id)

  if (!category) {
    return { price: null, breakdown: { mode: 'unknown', error: 'no_category' }, computed: false }
  }

  const days = daysMultiplier(order, service)
  const surcharge = floorSurcharge(order, service)

  if (category.pricing_mode === 'fixed') {
    const base = toNumber(category.fixed_price)
    const total = base * days + surcharge
    return {
      price: ceilToTen(total),
      breakdown: {
        mode: 'fixed',
        base: dec(base),
        days_multiplier: days,
        floor_surcharge: dec(surcharge),
        total: dec(total),
      },
      computed: true,
    }
  }

  if (category.pricing_mode === 'calculator') {
    const type = String(category.pricing_type || '').trim()
    if (!type) {
      return {
        price: null,
        breakdown: { mode: 'calculator', error: 'missing_pricing_type' },
        computed: false,
      }
    }

    const zone = detectZone(order)
    if (!zone) {
      return {
        price: null,
        breakdown: { mode: 'calculator', error: 'no_zone_matched', type },
        computed: false,
      }
    }

    const weightKg = toNumber(order?.cargo_weight_kg)
    const distanceKm = distanceKmFor(order)
    const elevationM = elevationMFor(order)
    // The driver's tax tier, not the company's: VAT-registered drivers sit at
    // 18%, small-business ones at 1%. An unassigned order quotes at 18%, which
    // is the Driver model's own default for a new hire.
    const driver = driverById(order?.assigned_driver_id)
    const driverVatRate = !driver || driver.vat_18_percent ? 0.18 : 0.01

    const quoted = runQuote({ type, zone, weightKg, distanceKm, elevationM, driverVatRate })
    if (!quoted) {
      return {
        price: null,
        breakdown: { mode: 'calculator', error: 'no_rate_for_type_zone', type, zone },
        computed: false,
      }
    }

    const total = quoted.total_revenue * days + surcharge
    return {
      price: ceilToTen(total),
      breakdown: {
        mode: 'calculator',
        type,
        zone,
        weight_kg: dec(weightKg),
        effective_weight_kg: dec(quoted.effective_weight_kg),
        distance_km: dec(distanceKm),
        elevation_m: dec(elevationM),
        days_multiplier: days,
        breakdown: breakdownQuote(quoted),
        floor_surcharge: dec(surcharge),
        total: dec(total),
      },
      computed: true,
    }
  }

  return {
    price: null,
    breakdown: { mode: category.pricing_mode || 'unknown', error: 'unsupported_mode' },
    computed: false,
  }
}

/* ---------------------------------------------------------- quote endpoints */

register('POST', '/pricing/quote/', (req) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const input = applyFields({
    type: { kind: 'choice', choices: RATE_TYPES, required: true },
    zone: { kind: 'text', maxLength: 40, required: true },
    weight_kg: { kind: 'decimal', places: 4, required: true },
    distance_km: { kind: 'decimal', places: 4, required: true },
    elevation_m: { kind: 'decimal', places: 4, default: '0.0000' },
    driver_vat_rate: { kind: 'decimal', places: 4, max: 1, default: '0.1800' },
  }, body, {}, { partial: false })

  if (!input.zone.trim()) {
    throw DemoApiError.validation({ zone: 'This field may not be blank.' })
  }

  const quoted = runQuote({
    type: input.type,
    zone: input.zone,
    weightKg: input.weight_kg,
    distanceKm: input.distance_km,
    elevationM: input.elevation_m,
    driverVatRate: Number(input.driver_vat_rate),
  })
  // The calculator fires on every keystroke against a zone dropdown that can
  // name a zone with no rate row, so this 404 is a normal state: the page
  // clears the panel and waits.
  if (!quoted) throw notFound('No rate configured for this type × zone combination.')

  return serializeQuote(quoted)
}, { auth: 'admin' })

register('POST', '/pricing/pump-quote/', (req) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const input = applyFields({
    kind: { kind: 'choice', choices: PUMP_KINDS, required: true },
    volume_m3: { kind: 'decimal', places: 4, required: true },
  }, body, {}, { partial: false })

  const rate = pumpRateFor(input.kind)
  if (!rate) throw notFound('No pump-mixer rate configured for this kind.')

  // Concrete pumping is the one service with no distance, weight or elevation
  // in it: volume × rate, plus a call-out fee on the mixer variant.
  const volume = Number(input.volume_m3)
  const perM3 = toNumber(rate.per_m3)
  const fixed = toNumber(rate.fixed)
  const maxM3 = toNumber(rate.max_m3)

  return {
    kind: rate.kind,
    volume_m3: dec(volume),
    per_m3: rate.per_m3,
    fixed: rate.fixed,
    max_m3: rate.max_m3,
    total: dec(volume * perM3 + fixed),
    warnings: maxM3 && volume > maxM3 ? ['volume_exceeds_max'] : [],
  }
}, { auth: 'admin' })

/* ------------------------------------------------------------ read-only lists
 *
 * Both of these were `IsAdmin` upstream despite the un-prefixed paths: the
 * calculator is an internal tool and nothing customer-facing ever asked for a
 * rate card. The names are what they are because they were written before that
 * was settled, and renaming a URL the front end hardcodes buys nothing.
 */

register('GET', '/pricing/zones/', () => (
  orderedZones().filter((zone) => zone.is_active)
), { auth: 'admin' })

register('GET', '/pricing/equipment/', () => (
  orderedEquipment().filter((item) => item.is_active)
), { auth: 'admin' })

/* ------------------------------------------------------------------ config */

register('GET', '/pricing/admin/config/', () => store.pricingConfig, { auth: 'admin' })

register('PATCH', '/pricing/admin/config/', (req) => {
  // `get_or_create(pk=1)` — a singleton that cannot 404, so there is no
  // create path and no delete.
  applyFields(
    { vat: { kind: 'decimal', places: 4, max: 1 } },
    req.body,
    store.pricingConfig,
    { partial: true },
  )
  store.pricingConfig.updated_at = now()
  return store.pricingConfig
}, { auth: 'admin' })

/* ------------------------------------------------------------------- zones */

register('GET', '/pricing/admin/zones/', () => orderedZones(), { auth: 'admin' })

register('POST', '/pricing/admin/zones/', (req) => {
  const row = { id: nextId('pricingZones') }
  applyFields(ZONE_FIELDS, req.body, row, { partial: false })
  // Derived from the English name, and locked from here on: `PricingRate.zone`
  // stores this string with no foreign key behind it, so a rename would orphan
  // every rate row that names it.
  const requested = slugify(req.body?.slug) || slugify(row.name?.en)
  row.slug = uniqueZoneSlug(requested)
  row.updated_at = now()
  store.pricingZones.push(row)
  return row
}, { auth: 'admin' })

/**
 * Drag-and-drop order, sent as `{ids: [...]}` — note the key, which is `order`
 * on the category and service reorder endpoints. Zones missing from the list
 * keep whatever position they had.
 */
register('POST', '/pricing/admin/zones/reorder/', (req) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
    throw new DemoApiError(400, 'Body must be {"ids": [int, int, ...]}.')
  }
  if (ids.length > 1000) {
    throw new DemoApiError(400, 'Reorder list exceeds maximum length of 1000.')
  }
  ids.forEach((id, index) => {
    const zone = zoneById(id)
    if (zone) zone.order = index
  })
  return { ok: true, count: ids.length }
}, { auth: 'admin' })

register('GET', '/pricing/admin/zones/:id/', (req) => {
  const zone = zoneById(Number(req.path.id))
  if (!zone) throw notFound()
  return zone
}, { auth: 'admin' })

register('PATCH', '/pricing/admin/zones/:id/', (req) => {
  const zone = zoneById(Number(req.path.id))
  if (!zone) throw notFound()
  applyFields(ZONE_FIELDS, req.body, zone, { partial: true })
  zone.updated_at = now()
  return zone
}, { auth: 'admin' })

register('DELETE', '/pricing/admin/zones/:id/', (req) => {
  const index = store.pricingZones.findIndex((zone) => zone.id === Number(req.path.id))
  if (index < 0) throw notFound()
  // No cascade, on purpose: rates hold the slug as plain text, so deleting a
  // zone leaves them pointing at a name nothing resolves and the rates table
  // falls back to printing the raw slug. That is what the real schema does,
  // and hiding it would hide the reason the slug is locked.
  store.pricingZones.splice(index, 1)
}, { auth: 'admin' })

/* ------------------------------------------------------------------- rates */

/** `unique_together = ('type', 'zone')`, reported the way DRF's
 *  UniqueTogetherValidator reported it. */
function assertRatePairFree(type, zone, exceptId = null) {
  const clash = store.pricingRates.find(
    (rate) => rate.type === type && rate.zone === zone && rate.id !== exceptId,
  )
  if (clash) {
    throw DemoApiError.validation({
      non_field_errors: 'The fields type, zone must make a unique set.',
    })
  }
}

/** The one cross-field rule the serializer carried: a minimum billable weight
 *  above the rate's ceiling could never be satisfied. */
function assertWeightBounds(row) {
  if (row.max_kg !== null && row.min_kg !== null && row.min_kg > row.max_kg) {
    throw DemoApiError.validation({
      min_kg: 'Minimum billable weight cannot exceed max_kg.',
    })
  }
}

register('GET', '/pricing/admin/rates/', () => orderedRates(), { auth: 'admin' })

register('POST', '/pricing/admin/rates/', (req) => {
  const row = { id: nextId('pricingRates') }
  applyFields(RATE_FIELDS, req.body, row, { partial: false })
  assertRatePairFree(row.type, row.zone)
  assertWeightBounds(row)
  row.updated_at = now()
  store.pricingRates.push(row)
  return row
}, { auth: 'admin' })

register('GET', '/pricing/admin/rates/:id/', (req) => {
  const rate = rateById(Number(req.path.id))
  if (!rate) throw notFound()
  return rate
}, { auth: 'admin' })

register('PATCH', '/pricing/admin/rates/:id/', (req) => {
  const rate = rateById(Number(req.path.id))
  if (!rate) throw notFound()
  // Validated against a copy so a rejected patch leaves nothing half-applied.
  const draft = applyFields(RATE_FIELDS, req.body, { ...rate }, { partial: true })
  assertRatePairFree(draft.type, draft.zone, rate.id)
  assertWeightBounds(draft)
  Object.assign(rate, draft, { updated_at: now() })
  return rate
}, { auth: 'admin' })

register('DELETE', '/pricing/admin/rates/:id/', (req) => {
  const index = store.pricingRates.findIndex((rate) => rate.id === Number(req.path.id))
  if (index < 0) throw notFound()
  store.pricingRates.splice(index, 1)
}, { auth: 'admin' })

/* --------------------------------------------------------------- elevation */

register('GET', '/pricing/admin/elevation/', () => orderedElevation(), { auth: 'admin' })

register('POST', '/pricing/admin/elevation/', (req) => {
  const row = { id: nextId('pricingElevation') }
  applyFields(ELEVATION_FIELDS, req.body, row, { partial: false })
  store.pricingElevation.push(row)
  return row
}, { auth: 'admin' })

register('GET', '/pricing/admin/elevation/:id/', (req) => {
  const bucket = store.pricingElevation.find((row) => row.id === Number(req.path.id))
  if (!bucket) throw notFound()
  return bucket
}, { auth: 'admin' })

register('PATCH', '/pricing/admin/elevation/:id/', (req) => {
  const bucket = store.pricingElevation.find((row) => row.id === Number(req.path.id))
  if (!bucket) throw notFound()
  applyFields(ELEVATION_FIELDS, req.body, bucket, { partial: true })
  return bucket
}, { auth: 'admin' })

register('DELETE', '/pricing/admin/elevation/:id/', (req) => {
  const index = store.pricingElevation.findIndex((row) => row.id === Number(req.path.id))
  if (index < 0) throw notFound()
  store.pricingElevation.splice(index, 1)
}, { auth: 'admin' })

/* -------------------------------------------------------------- pump mixer */

register('GET', '/pricing/admin/pump-mixer/', () => orderedPumpRates(), { auth: 'admin' })

register('POST', '/pricing/admin/pump-mixer/', (req) => {
  const row = { id: nextId('pricingPumpMixer') }
  applyFields(PUMP_FIELDS, req.body, row, { partial: false })
  // `kind` is unique, which caps this table at two rows — the table in the UI
  // has an edit action and no delete for exactly that reason.
  if (pumpRateFor(row.kind)) {
    throw DemoApiError.validation({
      kind: 'pump mixer rate with this kind already exists.',
    })
  }
  store.pricingPumpMixer.push(row)
  return row
}, { auth: 'admin' })

register('GET', '/pricing/admin/pump-mixer/:id/', (req) => {
  const rate = store.pricingPumpMixer.find((row) => row.id === Number(req.path.id))
  if (!rate) throw notFound()
  return rate
}, { auth: 'admin' })

register('PATCH', '/pricing/admin/pump-mixer/:id/', (req) => {
  const rate = store.pricingPumpMixer.find((row) => row.id === Number(req.path.id))
  if (!rate) throw notFound()
  const draft = applyFields(PUMP_FIELDS, req.body, { ...rate }, { partial: true })
  const clash = store.pricingPumpMixer.find(
    (row) => row.kind === draft.kind && row.id !== rate.id,
  )
  if (clash) {
    throw DemoApiError.validation({
      kind: 'pump mixer rate with this kind already exists.',
    })
  }
  Object.assign(rate, draft)
  return rate
}, { auth: 'admin' })

register('DELETE', '/pricing/admin/pump-mixer/:id/', (req) => {
  const index = store.pricingPumpMixer.findIndex((row) => row.id === Number(req.path.id))
  if (index < 0) throw notFound()
  store.pricingPumpMixer.splice(index, 1)
}, { auth: 'admin' })

/* --------------------------------------------------------------- equipment */

register('GET', '/pricing/admin/equipment/', () => orderedEquipment(), { auth: 'admin' })

register('POST', '/pricing/admin/equipment/', (req) => {
  const row = { id: nextId('pricingEquipment') }
  applyFields(EQUIPMENT_FIELDS, req.body, row, { partial: false })
  row.updated_at = now()
  store.pricingEquipment.push(row)
  return row
}, { auth: 'admin' })

register('GET', '/pricing/admin/equipment/:id/', (req) => {
  const item = equipmentById(Number(req.path.id))
  if (!item) throw notFound()
  return item
}, { auth: 'admin' })

register('PATCH', '/pricing/admin/equipment/:id/', (req) => {
  const item = equipmentById(Number(req.path.id))
  if (!item) throw notFound()
  applyFields(EQUIPMENT_FIELDS, req.body, item, { partial: true })
  item.updated_at = now()
  return item
}, { auth: 'admin' })

register('DELETE', '/pricing/admin/equipment/:id/', (req) => {
  const index = store.pricingEquipment.findIndex((item) => item.id === Number(req.path.id))
  if (index < 0) throw notFound()
  // Equipment is a flat price list with nothing pointing at it — deleting a
  // row really is just deleting a row.
  store.pricingEquipment.splice(index, 1)
}, { auth: 'admin' })
