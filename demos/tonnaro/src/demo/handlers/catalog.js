/**
 * The catalog: transport categories, services, the fleet, its drivers, and the
 * people who own the trucks.
 *
 * Five Django apps in one module, because they are one screen's worth of admin
 * and they read each other constantly — a vehicle payload carries its
 * categories, a driver payload carries its vehicles, and an owner's numbers are
 * walked through both. Split five ways, every module would import the other
 * four's serializers.
 *
 * Three shapes recur and are worth naming before the code does:
 *
 *  · **Pagination is per route, not per app.** `/categories/`, `/services/`
 *    (public and admin alike) and `/car-owners/admin/` set
 *    `pagination_class = None` upstream and answer with a bare array, because
 *    those admin pages fetch the lot and filter client-side — and because
 *    paginating them would hide the system helper card. `/vehicles/admin/` and
 *    `/drivers/admin/` never overrode it, so they get DRF's envelope at page
 *    size 20. The seed keeps both fleets at 18 rows so the envelope stays
 *    honest and the assignment dropdowns stay complete.
 *
 *  · **List and detail serializers disagree on purpose.** A driver's
 *    `vehicles` is an array of objects on the list and an array of ids on the
 *    detail, where the objects move to `vehicles_detail`; a service's
 *    `car_categories` is ids on the admin serializer and whole nested
 *    categories on the public one. Both halves are load-bearing — the driver
 *    modal seeds its form from the *list* row and fetches the detail only for
 *    the active-jobs panel — so both are reproduced rather than reconciled.
 *
 *  · **Nothing derived is stored.** `active_orders_count`, `is_busy`,
 *    `status_display`, every car-owner metric and every absolute media URL is
 *    computed here, off rows that hold only what Postgres held.
 *
 * Writes stage into a `changes` object and land through `commit()` in one go,
 * so a payload that fails its fourth field cannot leave the first three
 * written — which is the one guarantee a serializer gives that a pile of
 * in-place assignments would quietly drop.
 */
import { applyFilters, applyMultiFilter, applySearch, paginate } from '../query'
import { DemoApiError, file, notFound, register } from '../router'
import {
  hasField,
  isUpload,
  mediaField,
  orderStatusDisplay,
  parseJsonField,
  readBody,
  readFiles,
  storeUpload,
} from '../serialize'
import {
  carOwnerById,
  categoriesForVehicle,
  categoryById,
  driverById,
  driversForVehicle,
  imagesForVehicle,
  isActiveStatus,
  nextId,
  ordersForOwner,
  releaseObjectUrl,
  store,
  vehicleById,
  vehiclesForDriver,
  vehiclesForOwner,
  windowsForCategory,
} from '../store'

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const PRICING_TYPES = ['hiab', 'trailer', 'cart']
const CATEGORY_PRICING_MODES = ['fixed', 'calculator']
const VEHICLE_STATUSES = ['available', 'in_use', 'maintenance', 'retired']
const VEHICLE_STATUS_LABELS = {
  available: 'Available',
  in_use: 'In Use',
  maintenance: 'Maintenance',
  retired: 'Retired',
}
const DRIVER_STATUSES = ['active', 'on_leave', 'inactive']
const DRIVER_STATUS_LABELS = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' }
const OWNER_TYPES = ['personal', 'company']
const OWNER_TYPE_LABELS = { personal: 'Physical person', company: 'Company' }

/** `config/validators.py LICENSE_CATEGORIES`, in the order the pickers show. */
const LICENSE_CODES = ['A1', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'T', 'S']

const MAX_VEHICLE_IMAGES = 5
/** `AdminDriverListCreateView` ignores an over-long contains filter rather than
 *  running it, on the grounds that no real search term is that long. */
const MAX_FILTER_LENGTH = 100

const PHONE_PATTERN = /^(\+?\d[\d\s\-()]{5,30}\d)?$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function now() {
  return new Date().toISOString()
}

/** DRF's `get_object_or_404`, down to the anonymous detail message. */
function findRow(rows, raw) {
  const id = Number(raw)
  const row = Number.isInteger(id) ? rows.find((entry) => entry.id === id) : undefined
  if (!row) throw notFound()
  return row
}

/**
 * Apply a validated patch in one step, freeing any object URL the write
 * replaced — an uploaded photo nothing references again would otherwise sit in
 * the tab's memory until reload.
 */
function commit(row, changes, mediaFields = []) {
  for (const field of mediaFields) {
    if (field in changes && changes[field] !== row[field]) releaseObjectUrl(row[field])
  }
  Object.assign(row, changes)
  row.updated_at = now()
  return row
}

/* ------------------------------------------------------------ field readers
 *
 * One function per DRF field type, each raising the message that field would
 * have raised. The messages matter more than they look: every modal in this
 * slice renders `Object.values(err.response.data).flat()[0]` and shows it only
 * when it is a string, so a 400 that is not `{field: ['text']}` degrades to a
 * generic "save failed" and the admin learns nothing.
 */

function readString(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function readRequiredString(value, field, { minLength = 0, message = null } = {}) {
  if (value === null || value === undefined) {
    throw DemoApiError.validation({ [field]: 'This field is required.' })
  }
  const text = String(value)
  if (!text.trim()) {
    throw DemoApiError.validation({ [field]: 'This field may not be blank.' })
  }
  if (text.trim().length < minLength) {
    throw DemoApiError.validation({ [field]: message })
  }
  return text
}

function readBool(value, field) {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  if (['true', 't', 'yes', 'y', 'on', '1'].includes(text)) return true
  if (['false', 'f', 'no', 'n', 'off', '0'].includes(text)) return false
  throw DemoApiError.validation({ [field]: 'Must be a valid boolean.' })
}

function readChoice(value, choices, field) {
  const text = String(value ?? '')
  if (!choices.includes(text)) {
    throw DemoApiError.validation({ [field]: `"${text}" is not a valid choice.` })
  }
  return text
}

function readInteger(value, field, { min = null, max = null, allowNull = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (allowNull) return null
    throw DemoApiError.validation({ [field]: 'This field may not be null.' })
  }
  const number = Number(value)
  if (!Number.isInteger(number)) {
    throw DemoApiError.validation({ [field]: 'A valid integer is required.' })
  }
  if (min !== null && number < min) {
    throw DemoApiError.validation({ [field]: `Ensure this value is greater than or equal to ${min}.` })
  }
  if (max !== null && number > max) {
    throw DemoApiError.validation({ [field]: `Ensure this value is less than or equal to ${max}.` })
  }
  return number
}

/**
 * A decimal column, rendered the way `COERCE_DECIMAL_TO_STRING` rendered it:
 * a string at the model's precision. A capacity that came in as the number
 * 12.5 has to leave as `'12.50'`, because the vehicles table prints it raw
 * into `` `${capacity} t` `` and 12.5 t is not what the real app showed.
 */
function readDecimal(value, field, { maxDigits, decimalPlaces, min = null, allowNull = false }) {
  if (value === null || value === undefined || value === '') {
    if (allowNull) return null
    throw DemoApiError.validation({ [field]: 'This field may not be null.' })
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw DemoApiError.validation({ [field]: 'A valid number is required.' })
  }
  if (min !== null && number < min) {
    throw DemoApiError.validation({ [field]: `Ensure this value is greater than or equal to ${min}.` })
  }
  const text = number.toFixed(decimalPlaces)
  const digits = text.replace(/[-.]/g, '').replace(/^0+(?=\d)/, '').length
  if (digits > maxDigits) {
    throw DemoApiError.validation({
      [field]: `Ensure that there are no more than ${maxDigits} digits in total.`,
    })
  }
  return text
}

/**
 * `YYYY-MM-DD`, plus the plausibility guard the driver serializer adds on top:
 * a year outside 1900–2100 is a typo (2099 for 2029, 1800 for 1980) rather
 * than a business-rule violation, so it is rejected with its own message and
 * nothing else about the date is second-guessed.
 */
function readDate(value, field, label) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const at = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
  const real = at && at.getMonth() === Number(match[2]) - 1 && at.getDate() === Number(match[3])
  if (!real) {
    throw DemoApiError.validation({
      [field]: 'Date has wrong format. Use one of these formats instead: YYYY-MM-DD.',
    })
  }
  const year = Number(match[1])
  if (year < 1900 || year > 2100) {
    throw DemoApiError.validation({ [field]: `${label} year must be between 1900 and 2100.` })
  }
  return text
}

function readTime(value, field) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim())
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw DemoApiError.validation({
      [field]: 'Time has wrong format. Use one of these formats instead: hh:mm[:ss[.uuuuuu]].',
    })
  }
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`
}

function readEmail(value, field) {
  const text = readString(value).trim()
  if (text && !EMAIL_PATTERN.test(text)) {
    throw DemoApiError.validation({ [field]: 'Enter a valid email address.' })
  }
  return text
}

function readPhone(value, field) {
  const text = readString(value).trim()
  if (!PHONE_PATTERN.test(text)) {
    throw DemoApiError.validation({ [field]: 'Enter a valid phone number.' })
  }
  return text
}

function readColor(value, field, message) {
  const text = readString(value)
  if (text && !HEX_COLOR.test(text)) throw DemoApiError.validation({ [field]: message })
  return text
}

/** The comma-joined codes go in unchanged — the validator checks them and hands
 *  back the raw string, so `'c, ce'` stays `'c, ce'` in the column. */
function readLicenseCategories(value, field) {
  const text = readString(value)
  const unknown = parseCodes(text).filter((code) => !LICENSE_CODES.includes(code))
  if (unknown.length) {
    throw DemoApiError.validation({ [field]: `Unknown license categories: ${unknown.join(', ')}.` })
  }
  return text
}

function parseCodes(raw) {
  return String(raw ?? '')
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
}

/** `{en, ka, ru}` — or, on rows the legacy seeder wrote, a bare string. Django
 *  only swapped in the parsed value when it was a dict, so a plain string
 *  survives as one and the localiser upstream still handles it. */
function readI18n(value) {
  const parsed = parseJsonField(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : value
}

/**
 * `image=''` clears the photo, a file replaces it, and omitting the key leaves
 * it alone. Categories and services share the convention because neither model
 * has a delete-image route — the empty string *is* the delete.
 */
function readImage(current, value) {
  if (isUpload(value)) return storeUpload(value)
  if (value === '' || value === null) return null
  return current
}

/* ------------------------------------------------------------------- slugs */

/**
 * `django.utils.text.slugify`, both halves of it.
 *
 * The ASCII pass is tried first and the unicode pass only if it came back
 * empty, which is exactly the fallback a Georgian-only name takes: `'ამწე'`
 * has no ASCII left after the strip, so the slug comes from the unicode pass
 * instead. That path is reachable from the UI — the EN tab blocks Georgian
 * characters, but nothing forces the EN tab to be filled at all.
 */
function slugify(value, allowUnicode) {
  let text = String(value ?? '')
  text = allowUnicode
    ? text.normalize('NFKC')
    : text.normalize('NFKD').replace(/[^\x20-\x7E]/g, '')
  text = text.toLowerCase().trim()
  text = allowUnicode ? text.replace(/[^\p{L}\p{N}\s_-]/gu, '') : text.replace(/[^\w\s-]/g, '')
  return text.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '')
}

function randomHex(length) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
  }
  return Math.random().toString(16).slice(2, 2 + length).padEnd(length, '0')
}

/**
 * `_make_unique_slug()`: en → ka → ru, ASCII → unicode, then a UUID stub if
 * every language was blank, with a numeric suffix on collision. Only ever
 * called at create — `save()` regenerates nothing once the column is filled,
 * so renaming a category keeps the slug it was born with.
 */
function makeSlug(rows, name, prefix) {
  const candidate = name && typeof name === 'object'
    ? (String(name.en ?? '').trim() || String(name.ka ?? '').trim() || String(name.ru ?? '').trim())
    : String(name ?? '').trim()

  const base = slugify(candidate, false) || slugify(candidate, true) || `${prefix}-${randomHex(8)}`
  const taken = new Set(rows.map((row) => row.slug))
  let slug = base
  let counter = 1
  while (taken.has(slug)) {
    slug = `${base}-${counter}`
    counter += 1
  }
  return slug
}

/* --------------------------------------------------------------- orderings */

function localName(value) {
  if (value && typeof value === 'object') return String(value.en ?? Object.values(value)[0] ?? '')
  return String(value ?? '')
}

/**
 * `Meta.ordering = ['position', 'name']`, shared by `TransportCategory` and
 * `Service`. Postgres was comparing the `name` jsonb on the tie; positions are
 * unique in the seed so the tie only arises for rows a partial reorder left
 * sharing one, and the English name is the answer a reader can predict.
 */
function byPosition(rows) {
  return [...rows].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
      || localName(a.name).localeCompare(localName(b.name)),
  )
}

/** `Vehicle.Meta.ordering = ['name']`. */
function byName(rows) {
  return [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

function newestEventFirst(rows) {
  return [...rows].sort((a, b) => Date.parse(b.last_event_at) - Date.parse(a.last_event_at))
}

/* -------------------------------------------------------------- categories */

function serializeWindow(row) {
  return {
    id: row.id,
    location_keyword: row.location_keyword,
    start_time: row.start_time,
    end_time: row.end_time,
    description: row.description,
    is_active: row.is_active,
  }
}

/** `RestrictedTimeWindow.Meta.ordering` within one category. The public
 *  serializer drops the disabled rows; the admin one keeps them, because the
 *  modal renders a disabled window at reduced opacity rather than hiding it. */
function windowsFor(categoryId, { activeOnly = false } = {}) {
  return windowsForCategory(categoryId)
    .filter((row) => !activeOnly || row.is_active)
    .sort(
      (a, b) => a.location_keyword.localeCompare(b.location_keyword)
        || a.start_time.localeCompare(b.start_time),
    )
    .map(serializeWindow)
}

function serializeCategoryAdmin(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    // DRF renders the raw ImageField as a URL too, so `image` and `image_url`
    // agree here — the modal reads one and the cards read the other.
    image: mediaField(row.image),
    image_url: mediaField(row.image),
    image_webp_url: mediaField(row.image_webp),
    color: row.color,
    is_active: row.is_active,
    is_helper_card: row.is_helper_card,
    position: row.position,
    suggestion_keywords: row.suggestion_keywords,
    pricing_mode: row.pricing_mode,
    fixed_price: row.fixed_price,
    pricing_type: row.pricing_type,
    restricted_time_windows: windowsFor(row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function serializeCategoryPublic(row) {
  // A nested serializer over a null FK yields null in DRF, not a crash. Orders
  // carry three optional service and three optional category FKs, and an order
  // that has not been triaged yet has most of them unset.
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    image_url: mediaField(row.image),
    image_webp_url: mediaField(row.image_webp),
    color: row.color,
    is_helper_card: row.is_helper_card,
    pricing_mode: row.pricing_mode,
    fixed_price: row.fixed_price,
    pricing_type: row.pricing_type,
    restricted_time_windows: windowsFor(row.id, { activeOnly: true }),
  }
}

function readPricingType(value) {
  const text = readString(value)
  if (text && !PRICING_TYPES.includes(text)) {
    throw DemoApiError.validation({
      pricing_type: `pricing_type must be one of: ${[...PRICING_TYPES].sort().join(', ')}.`,
    })
  }
  return text
}

/**
 * The window drafts the modal posts. DRF would have answered a bad row with a
 * list-of-dicts nested under the field, which the flat
 * `Object.values(data).flat()[0]` upstream renders as its generic fallback —
 * so the error is raised flat instead, under the field the admin was actually
 * editing. It is the one place this module tells the UI more than Django did.
 */
function readWindows(value) {
  const parsed = parseJsonField(value)
  if (!Array.isArray(parsed)) {
    throw DemoApiError.validation({
      restricted_time_windows: 'Expected a list of items but got type "str".',
    })
  }

  return parsed.map((item) => {
    const keyword = readString(item?.location_keyword).trim()
    if (!keyword) {
      throw DemoApiError.validation({ location_keyword: 'Location keyword is required.' })
    }
    if (keyword.length < 2) {
      throw DemoApiError.validation({
        location_keyword: 'Location keyword must be at least 2 characters.',
      })
    }
    const start = readTime(item?.start_time, 'start_time')
    const end = readTime(item?.end_time, 'end_time')
    if (start === end) {
      throw DemoApiError.validation({ end_time: 'End time must differ from start time.' })
    }
    return {
      id: Number.isInteger(item?.id) ? item.id : null,
      location_keyword: keyword,
      start_time: start,
      end_time: end,
      description: readString(item?.description),
      is_active: item?.is_active === undefined ? true : readBool(item.is_active, 'is_active'),
    }
  })
}

/**
 * `_sync_windows`: a reconcile, not a merge. A draft carrying a known id
 * updates that row, a draft without one creates a row, and every existing row
 * the payload did not mention is deleted. The modal always sends the key, so
 * saving a category whose window list you emptied really does wipe them —
 * which is the behaviour, not a bug to smooth over.
 */
function syncWindows(category, drafts) {
  const existing = windowsForCategory(category.id)
  const known = new Map(existing.map((row) => [row.id, row]))
  const seen = new Set()

  for (const draft of drafts) {
    const { id, ...fields } = draft
    const row = id !== null ? known.get(id) : undefined
    if (row) {
      Object.assign(row, fields, { updated_at: now() })
      seen.add(id)
      continue
    }
    store.restrictedTimeWindows.push({
      id: nextId('restrictedTimeWindows'),
      category_id: category.id,
      ...fields,
      created_at: now(),
      updated_at: now(),
    })
  }

  const dropped = existing.filter((row) => !seen.has(row.id))
  for (const row of dropped) {
    store.restrictedTimeWindows.splice(store.restrictedTimeWindows.indexOf(row), 1)
  }
}

/** Read-only on both models, and loudly so: the serializer raises rather than
 *  ignoring the key, because an admin who tried to move the helper card wants
 *  to be told it did not move. POST stays silent so a client can echo a full
 *  row back without a 400. */
function rejectHelperCardWrite(body) {
  if (hasField(body, 'is_helper_card')) {
    throw DemoApiError.validation({ is_helper_card: 'This field is read-only.' })
  }
}

/** `position = Max('position') + 1` — new rows land at the end of the list,
 *  behind the archived ones too, since the aggregate spans the whole table. */
function nextPosition(rows) {
  return rows.reduce((max, row) => Math.max(max, row.position ?? 0), 0) + 1
}

function readCategoryFields(body) {
  const data = readBody(body)
  const changes = {}

  if (hasField(body, 'name')) changes.name = readI18n(data.name)
  if (hasField(body, 'description')) changes.description = readI18n(data.description)
  if (hasField(body, 'icon')) changes.icon = readString(data.icon)
  if (hasField(body, 'color')) {
    changes.color = readColor(
      data.color, 'color', 'Color must be a valid hex color code (e.g. #fff or #1677ff).',
    )
  }
  if (hasField(body, 'is_active')) changes.is_active = readBool(data.is_active, 'is_active')
  if (hasField(body, 'suggestion_keywords')) {
    changes.suggestion_keywords = readString(data.suggestion_keywords)
  }
  if (hasField(body, 'pricing_mode')) {
    changes.pricing_mode = readChoice(data.pricing_mode, CATEGORY_PRICING_MODES, 'pricing_mode')
  }
  if (hasField(body, 'fixed_price')) {
    changes.fixed_price = readDecimal(data.fixed_price, 'fixed_price', {
      maxDigits: 12, decimalPlaces: 2, min: 0,
    })
  }
  if (hasField(body, 'pricing_type')) changes.pricing_type = readPricingType(data.pricing_type)

  // `null` rather than `[]` for an absent key: omitting the field leaves the
  // windows alone, while sending an empty list wipes them.
  const windows = hasField(body, 'restricted_time_windows')
    ? readWindows(data.restricted_time_windows)
    : null
  return { changes, windows }
}

/** The upload branch, kept apart from the field readers because it also
 *  invalidates the webp companion. Only `TransportCategory` ever had one, and
 *  the demo has no image pipeline to regenerate it — so a freshly uploaded
 *  photo takes `PictureImage`'s plain-`<img>` path, which the seed exercises
 *  on its own rows anyway. */
function readCategoryImage(row, body) {
  const data = readBody(body)
  if (!hasField(body, 'image')) return {}
  const image = readImage(row?.image ?? null, data.image)
  return { image, image_webp: null }
}

register('GET', '/categories/', () => byPosition(
  store.categories.filter((row) => row.is_active),
).map(serializeCategoryPublic), { auth: 'public' })

register('GET', '/categories/admin/', (request) => {
  let rows = applyFilters(store.categories, request.params, {
    is_active: (row) => row.is_active,
  })
  rows = applySearch(rows, request.params, [
    (row) => i18nHaystack(row.name),
    (row) => i18nHaystack(row.description),
  ])
  return byPosition(rows).map(serializeCategoryAdmin)
}, { auth: 'admin' })

register('POST', '/categories/admin/', (request) => {
  const { changes, windows } = readCategoryFields(request.body)
  const image = readCategoryImage(null, request.body)
  const name = 'name' in changes ? changes.name : {}

  const row = {
    id: nextId('categories'),
    name,
    slug: makeSlug(store.categories, name, 'category'),
    description: {},
    icon: 'car',
    image: null,
    image_webp: null,
    color: '#1677ff',
    is_active: true,
    // Silently ignored on create, per the serializer: the singleton is seeded,
    // never minted.
    is_helper_card: false,
    position: nextPosition(store.categories),
    suggestion_keywords: '',
    pricing_mode: 'fixed',
    fixed_price: '0.00',
    pricing_type: '',
    created_at: now(),
    updated_at: now(),
    ...changes,
    ...image,
  }

  store.categories.push(row)
  if (windows) syncWindows(row, windows)
  return serializeCategoryAdmin(row)
}, { auth: 'admin' })

register('POST', '/categories/admin/reorder/', (request) => {
  reorder(store.categories, request.body, { limit: 1000 })
  return byPosition(store.categories).map(serializeCategoryAdmin)
}, { auth: 'admin' })

register('GET', '/categories/admin/:id/', (request) =>
  serializeCategoryAdmin(findRow(store.categories, request.path.id)), { auth: 'admin' })

register('PATCH', '/categories/admin/:id/', (request) => {
  const row = findRow(store.categories, request.path.id)
  rejectHelperCardWrite(request.body)
  const { changes, windows } = readCategoryFields(request.body)
  commit(row, { ...changes, ...readCategoryImage(row, request.body) }, ['image'])
  if (windows) syncWindows(row, windows)
  return serializeCategoryAdmin(row)
}, { auth: 'admin' })

register('DELETE', '/categories/admin/:id/', (request) => {
  const row = findRow(store.categories, request.path.id)
  if (row.is_helper_card) {
    throw new DemoApiError(400, 'This is a system-managed helper card and cannot be deleted.')
  }
  deleteCategory(row)
}, { auth: 'admin' })

register('POST', '/categories/suggest/', (request) => {
  const description = readString(readBody(request.body).description)
  const match = suggest(store.categories.filter((row) => row.is_active), description)
  return match ? serializeCategoryPublic(match) : { detail: 'No suggestion found.' }
})

/**
 * The cascade Django would have run. Nothing in the admin UI deletes a
 * category — it disables one instead — but the route exists, and a mock whose
 * delete leaves a service pointing at a vanished id is a mock that renders
 * `#307` in the tag column forever after.
 */
function deleteCategory(row) {
  store.categories.splice(store.categories.indexOf(row), 1)
  releaseObjectUrl(row.image)

  store.restrictedTimeWindows = store.restrictedTimeWindows.filter(
    (window) => window.category_id !== row.id,
  )
  for (const service of store.services) {
    service.car_category_ids = service.car_category_ids.filter((id) => id !== row.id)
  }
  for (const vehicle of store.vehicles) {
    vehicle.category_ids = vehicle.category_ids.filter((id) => id !== row.id)
  }
  // All six category FKs on Order are `SET_NULL`; the legacy trio still feeds
  // the list serializer's service → category fallback.
  for (const order of store.orders) {
    for (const field of ['suggested_category_id', 'selected_category_id', 'final_category_id']) {
      if (order[field] === row.id) order[field] = null
    }
  }
}

/* ----------------------------------------------------------- reorder + search */

/**
 * `position = index` for the ids in the payload; rows the payload omits keep
 * the position they had. Both admin pages sort optimistically and roll back on
 * any error, and both throw the response body away — so persisting the write
 * is the entire contract, and the errors are what keeps the rollback honest.
 *
 * Only the category view carries the 1000-row cap. The service view was
 * written without it and there is no reason to invent one here.
 */
function reorder(rows, body, { limit = null } = {}) {
  const order = readBody(body).order
  if (!Array.isArray(order) || !order.every((id) => Number.isInteger(id))) {
    throw DemoApiError.validation({ order: 'Must be a list of integer ids.' })
  }
  if (limit !== null && order.length > limit) {
    throw DemoApiError.validation({ order: `Reorder list exceeds maximum length of ${limit}.` })
  }
  if (new Set(order).size !== order.length) {
    throw DemoApiError.validation({ order: 'Duplicate ids in payload.' })
  }
  const unknown = order.find((id) => !rows.some((row) => row.id === id))
  if (unknown !== undefined) {
    throw DemoApiError.validation({ order: `Unknown id ${unknown}` })
  }
  order.forEach((id, index) => {
    rows.find((row) => row.id === id).position = index
  })
}

/** `search_fields = ['name', 'description']` against a JSONField: Postgres
 *  cast the whole document to text, so every language matched. */
function i18nHaystack(value) {
  if (value && typeof value === 'object') return Object.values(value).map(String)
  return [String(value ?? '')]
}

/**
 * The suggestion engine, unchanged in substance from
 * `categories/suggestion.py` and `services/suggestion.py`.
 *
 * Naive on purpose and worth keeping naive: score a row by how many of its
 * comma-split keywords appear as substrings of the lowercased description, and
 * take the best. The comparison is strictly greater, so a tie goes to whichever
 * row `Meta.ordering` puts first — the earlier `position` — and a score of zero
 * suggests nothing at all rather than the first row in the table. That last
 * detail is what stops "hello" from proposing a crane.
 *
 * It reads better than it has any right to because the keyword lists are long:
 * "my car broke down on the highway" hits *broke down*, *car* and *highway* on
 * the tow-truck row and nothing like as many anywhere else.
 */
function suggest(rows, description) {
  const text = String(description ?? '').toLowerCase()
  if (!text) return null

  let best = null
  let bestScore = 0
  for (const row of byPosition(rows)) {
    const keywords = String(row.suggestion_keywords ?? '')
      .split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean)
    const score = keywords.filter((keyword) => text.includes(keyword)).length
    if (score > bestScore) {
      bestScore = score
      best = row
    }
  }
  return best
}

/* ----------------------------------------------------------------- services */

const CARGO_FIELD_KEYS = [
  'length', 'width', 'height', 'volume', 'weight',
  'floor', 'days', 'fragile', 'insured', 'insurance',
]
const CARGO_FIELD_MODES = ['off', 'optional', 'required']
const DEFAULT_CARGO_CONFIG = {
  length: 'optional', width: 'optional', height: 'optional',
  volume: 'optional', weight: 'optional',
  floor: 'off', days: 'off', fragile: 'off', insured: 'off', insurance: 'off',
}

/** `normalize_cargo_field_config`: unknown keys dropped, missing keys and
 *  unrecognised values replaced by the default. Applied on the way in *and*
 *  again in `to_representation`, so the admin form always sees all ten keys
 *  even for a row seeded before a key existed. */
function normalizeCargoConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = { ...DEFAULT_CARGO_CONFIG }
  for (const key of CARGO_FIELD_KEYS) {
    const value = source[key]
    if (typeof value === 'string' && CARGO_FIELD_MODES.includes(value)) out[key] = value
  }
  return out
}

function serializeServiceAdmin(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    image: mediaField(row.image),
    image_url: mediaField(row.image),
    color: row.color,
    // Ids here; the public serializer nests the whole category instead.
    car_categories: byPosition(categoriesOf(row)).map((category) => category.id),
    requires_destination: row.requires_destination,
    is_active: row.is_active,
    is_helper_card: row.is_helper_card,
    position: row.position,
    cargo_field_config: normalizeCargoConfig(row.cargo_field_config),
    floor_max: row.floor_max,
    floor_price: row.floor_price,
    days_max: row.days_max,
    suggestion_keywords: row.suggestion_keywords,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function serializeServicePublic(row) {
  // A nested serializer over a null FK yields null in DRF, not a crash. Orders
  // carry three optional service and three optional category FKs, and an order
  // that has not been triaged yet has most of them unset.
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    // No `image_webp_url`: only TransportCategory got a generated companion,
    // and `ServicePublicSerializer` has no such field at all.
    image_url: mediaField(row.image),
    color: row.color,
    car_categories: byPosition(categoriesOf(row)).map(serializeCategoryPublic),
    requires_destination: row.requires_destination,
    cargo_field_config: normalizeCargoConfig(row.cargo_field_config),
    floor_max: row.floor_max,
    // `floor_price` is deliberately absent — the surcharge is applied server
    // side and the wizard has no business quoting it.
    days_max: row.days_max,
    is_helper_card: row.is_helper_card,
  }
}

function categoriesOf(service) {
  return (service.car_category_ids ?? []).map((id) => categoryById(id)).filter(Boolean)
}

/** A JSON list from a JSON request, a JSON-encoded list from the multipart
 *  modal, and — when that will not parse — a comma-split, which is the
 *  serializer's own fallback. */
function readCarCategories(value) {
  let list = value
  if (typeof value === 'string') {
    const parsed = parseJsonField(value.trim())
    list = Array.isArray(parsed) ? parsed : value.split(',').filter((part) => part.trim())
  }
  if (!Array.isArray(list)) {
    throw DemoApiError.validation({
      car_categories: 'Expected a list of items but got type "str".',
    })
  }
  return list.map((raw) => {
    const id = Number(raw)
    if (!Number.isInteger(id) || !categoryById(id)) {
      throw DemoApiError.validation({
        car_categories: `Invalid pk "${raw}" - object does not exist.`,
      })
    }
    return id
  })
}

function readServiceFields(body) {
  const data = readBody(body)
  const changes = {}

  if (hasField(body, 'name')) changes.name = readI18n(data.name)
  if (hasField(body, 'description')) changes.description = readI18n(data.description)
  if (hasField(body, 'icon')) changes.icon = readString(data.icon)
  if (hasField(body, 'color')) {
    changes.color = readColor(
      data.color, 'color', 'Color must be a valid hex code, e.g. #F97316 or #FFF.',
    )
  }
  if (hasField(body, 'is_active')) changes.is_active = readBool(data.is_active, 'is_active')
  if (hasField(body, 'requires_destination')) {
    changes.requires_destination = readBool(data.requires_destination, 'requires_destination')
  }
  if (hasField(body, 'suggestion_keywords')) {
    changes.suggestion_keywords = readString(data.suggestion_keywords)
  }
  if (hasField(body, 'car_categories')) {
    changes.car_category_ids = readCarCategories(data.car_categories)
  }
  if (hasField(body, 'cargo_field_config')) {
    changes.cargo_field_config = normalizeCargoConfig(parseJsonField(data.cargo_field_config))
  }
  if (hasField(body, 'floor_max')) {
    changes.floor_max = readInteger(data.floor_max, 'floor_max', { min: 0, max: 500 })
  }
  if (hasField(body, 'floor_price')) {
    changes.floor_price = readInteger(data.floor_price, 'floor_price', { min: 0, max: 1000000 })
  }
  if (hasField(body, 'days_max')) {
    changes.days_max = readInteger(data.days_max, 'days_max', { min: 0, max: 365 })
  }
  if (hasField(body, 'image')) changes.image = readImage(null, data.image)

  return changes
}

register('GET', '/services/', () => byPosition(
  store.services.filter((row) => row.is_active),
).map(serializeServicePublic), { auth: 'public' })

register('GET', '/services/admin/', (request) => {
  let rows = applyFilters(store.services, request.params, { is_active: (row) => row.is_active })
  rows = applyMultiFilter(rows, request.paramsAll, 'car_categories', (row) => row.car_category_ids)
  rows = applySearch(rows, request.params, [
    (row) => i18nHaystack(row.name),
    (row) => i18nHaystack(row.description),
  ])
  return byPosition(rows).map(serializeServiceAdmin)
}, { auth: 'admin' })

register('POST', '/services/admin/', (request) => {
  const changes = readServiceFields(request.body)
  const name = 'name' in changes ? changes.name : {}

  const row = {
    id: nextId('services'),
    name,
    slug: makeSlug(store.services, name, 'service'),
    description: {},
    icon: 'tool',
    image: null,
    color: '#1677ff',
    car_category_ids: [],
    requires_destination: false,
    is_active: true,
    is_helper_card: false,
    position: nextPosition(store.services),
    floor_max: 30,
    floor_price: 0,
    days_max: 30,
    cargo_field_config: { ...DEFAULT_CARGO_CONFIG },
    suggestion_keywords: '',
    created_at: now(),
    updated_at: now(),
    ...changes,
  }

  store.services.push(row)
  return serializeServiceAdmin(row)
}, { auth: 'admin' })

register('POST', '/services/admin/reorder/', (request) => {
  reorder(store.services, request.body)
  return byPosition(store.services).map(serializeServiceAdmin)
}, { auth: 'admin' })

register('GET', '/services/admin/:id/', (request) =>
  serializeServiceAdmin(findRow(store.services, request.path.id)), { auth: 'admin' })

register('PATCH', '/services/admin/:id/', (request) => {
  const row = findRow(store.services, request.path.id)
  rejectHelperCardWrite(request.body)
  commit(row, readServiceFields(request.body), ['image'])
  return serializeServiceAdmin(row)
}, { auth: 'admin' })

register('DELETE', '/services/admin/:id/', (request) => {
  const row = findRow(store.services, request.path.id)
  if (row.is_helper_card) {
    throw new DemoApiError(400, 'This is a system-managed helper card and cannot be deleted.')
  }
  store.services.splice(store.services.indexOf(row), 1)
  releaseObjectUrl(row.image)
  for (const order of store.orders) {
    for (const field of ['suggested_service_id', 'selected_service_id', 'final_service_id']) {
      if (order[field] === row.id) order[field] = null
    }
  }
}, { auth: 'admin' })

register('POST', '/services/suggest/', (request) => {
  // The view truncates before scoring rather than rejecting, so a customer who
  // pastes an essay still gets a suggestion off its first 2000 characters.
  const description = readString(readBody(request.body).description).slice(0, 2000)
  const match = suggest(store.services.filter((row) => row.is_active), description)
  return match ? serializeServicePublic(match) : { detail: 'No suggestion found.' }
})

/* ----------------------------------------------------------------- vehicles */

/** The one category payload in the app whose media key is `image` rather than
 *  `image_url`. The vehicles table reads `categories_detail[0]` for the row
 *  tile's colour and icon, so the first entry is the one that shows. */
function vehicleCategoryBrief(category) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    image: mediaField(category.image),
  }
}

function serializeVehicleImage(row) {
  return {
    id: row.id,
    image: mediaField(row.image),
    order: row.order,
    is_primary: row.is_primary,
    created_at: row.created_at,
  }
}

function vehicleCategories(vehicle) {
  return byPosition(categoriesForVehicle(vehicle))
}

function activeOrdersOf(rows) {
  return newestEventFirst(rows.filter((order) => isActiveStatus(order.status))).slice(0, 10)
}

export function serializeVehicleList(row) {
  // `assigned_vehicle_detail` resolves to null on every order that has not
  // been assigned one yet, and DRF renders a null FK as null rather than
  // raising. Same contract as the two public serializers above.
  if (!row) return null

  const categories = vehicleCategories(row)
  const owner = carOwnerById(row.owner_id)
  return {
    id: row.id,
    name: row.name,
    categories: categories.map((category) => category.id),
    categories_detail: categories.map(vehicleCategoryBrief),
    plate_number: row.plate_number,
    year: row.year,
    capacity: row.capacity,
    license_categories: row.license_categories,
    image: mediaField(row.image),
    status: row.status,
    status_display: VEHICLE_STATUS_LABELS[row.status] ?? row.status,
    is_active: row.is_active,
    images: imagesForVehicle(row.id).map(serializeVehicleImage),
    active_orders_count: ordersForVehicle(row.id).filter(
      (order) => isActiveStatus(order.status),
    ).length,
    owner: row.owner_id,
    owner_detail: owner ? ownerBrief(owner) : null,
    // No `description` — the list serializer omits it, which is why the edit
    // modal's textarea opens blank on a vehicle that has one. The subsequent
    // PATCH then leaves `description` out entirely and the stored text
    // survives, so reproducing the omission is what protects the data.
  }
}

function serializeVehicleDetail(row) {
  const categories = vehicleCategories(row)
  const owner = carOwnerById(row.owner_id)
  return {
    id: row.id,
    name: row.name,
    categories: categories.map((category) => category.id),
    categories_detail: categories.map(vehicleCategoryBrief),
    plate_number: row.plate_number,
    year: row.year,
    capacity: row.capacity,
    description: row.description,
    license_categories: row.license_categories,
    image: mediaField(row.image),
    status: row.status,
    status_display: VEHICLE_STATUS_LABELS[row.status] ?? row.status,
    is_active: row.is_active,
    images: imagesForVehicle(row.id).map(serializeVehicleImage),
    drivers: driversForVehicle(row.id).map((driver) => ({
      id: driver.id,
      full_name: fullName(driver),
      phone: driver.phone,
      status: driver.status,
    })),
    active_orders: activeOrdersOf(ordersForVehicle(row.id)).map((order) => ({
      id: order.id,
      status: order.status,
      status_display: orderStatusDisplay(order.status),
      pickup_location: order.pickup_location,
      destination_location: order.destination_location,
      scheduled_from: order.scheduled_from,
      scheduled_to: order.scheduled_to,
      requested_date: order.requested_date,
      assigned_driver_name: order.assigned_driver_id
        ? fullName(driverById(order.assigned_driver_id))
        : '',
    })),
    owner: row.owner_id,
    owner_detail: owner ? ownerBrief(owner) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function ordersForVehicle(vehicleId) {
  return store.orders.filter((order) => order.assigned_vehicle_id === vehicleId)
}

function ownerBrief(owner) {
  return {
    id: owner.id,
    display_name: displayName(owner),
    owner_type: owner.owner_type,
    phone: owner.phone,
  }
}

function readVehicleFields(body, { creating, current = null }) {
  const data = readBody(body)
  const changes = {}

  if (creating || hasField(body, 'name')) changes.name = readRequiredString(data.name, 'name')
  if (creating || hasField(body, 'plate_number')) {
    const plate = readRequiredString(data.plate_number, 'plate_number', {
      minLength: 2, message: 'Plate number must be at least 2 characters.',
    })
    const clash = store.vehicles.find(
      (row) => row.plate_number === plate && row.id !== current?.id,
    )
    if (clash) {
      throw DemoApiError.validation({
        plate_number: 'vehicle with this plate number already exists.',
      })
    }
    changes.plate_number = plate
  }
  if (hasField(body, 'categories')) {
    changes.category_ids = readRelatedIds(data.categories, 'categories', vehicleCategoryExists)
  }
  if (hasField(body, 'year')) {
    changes.year = readInteger(data.year, 'year', { min: 1900, max: 2100, allowNull: true })
  }
  if (hasField(body, 'capacity')) {
    changes.capacity = readDecimal(data.capacity, 'capacity', {
      maxDigits: 6, decimalPlaces: 2, min: 0, allowNull: true,
    })
  }
  if (hasField(body, 'description')) changes.description = readString(data.description)
  if (hasField(body, 'license_categories')) {
    changes.license_categories = readLicenseCategories(data.license_categories, 'license_categories')
  }
  if (hasField(body, 'status')) {
    changes.status = readChoice(data.status, VEHICLE_STATUSES, 'status')
  }
  if (hasField(body, 'is_active')) changes.is_active = readBool(data.is_active, 'is_active')
  if (hasField(body, 'owner')) changes.owner_id = readOwnerId(data.owner)
  if (hasField(body, 'image')) changes.image = readImage(current?.image ?? null, data.image)

  return changes
}

function vehicleCategoryExists(id) {
  return Boolean(categoryById(id))
}

function readRelatedIds(value, field, exists) {
  if (!Array.isArray(value)) {
    throw DemoApiError.validation({ [field]: 'Expected a list of items but got type "str".' })
  }
  return value.map((raw) => {
    const id = Number(raw)
    if (!Number.isInteger(id) || !exists(id)) {
      throw DemoApiError.validation({ [field]: `Invalid pk "${raw}" - object does not exist.` })
    }
    return id
  })
}

function readOwnerId(value) {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id) || !carOwnerById(id)) {
    throw DemoApiError.validation({ owner: `Invalid pk "${value}" - object does not exist.` })
  }
  return id
}

function vehicleQueryset(request) {
  const { params, paramsAll } = request
  let rows = applyMultiFilter(store.vehicles, paramsAll, 'categories', (row) => row.category_ids)
  rows = applyFilters(rows, params, {
    status: (row) => row.status,
    is_active: (row) => row.is_active,
    owner: (row) => row.owner_id,
  })
  rows = applySearch(rows, params, [
    (row) => row.name,
    (row) => row.plate_number,
    (row) => row.description,
  ])

  const plate = (params.plate_number_q ?? '').trim().toLowerCase()
  if (plate) rows = rows.filter((row) => row.plate_number.toLowerCase().includes(plate))

  // `Decimal(capacity_min)` — a value Django could not parse raised and was
  // swallowed, leaving the list unfiltered rather than empty.
  const capacityMin = Number(params.capacity_min)
  if (params.capacity_min && Number.isFinite(capacityMin)) {
    rows = rows.filter((row) => row.capacity !== null && Number(row.capacity) >= capacityMin)
  }

  const licence = (params.license_categories_q ?? '').trim().toLowerCase()
  if (licence) rows = rows.filter((row) => row.license_categories.toLowerCase().includes(licence))

  return byName(rows)
}

register('GET', '/vehicles/admin/', (request) =>
  paginate(vehicleQueryset(request), request.params, '/vehicles/admin/', serializeVehicleList),
{ auth: 'admin' })

// The list view swaps serializer by method: a GET is the lean list row, a POST
// answers with the full detail — which is also why a created vehicle comes back
// carrying `drivers` and `active_orders` that are necessarily empty.
register('POST', '/vehicles/admin/', (request) => {
  const changes = readVehicleFields(request.body, { creating: true })
  const row = {
    id: nextId('vehicles'),
    name: '',
    category_ids: [],
    plate_number: '',
    year: null,
    capacity: null,
    description: '',
    license_categories: '',
    image: null,
    status: 'available',
    is_active: true,
    owner_id: null,
    created_at: now(),
    updated_at: now(),
    ...changes,
  }
  store.vehicles.push(row)
  return serializeVehicleDetail(row)
}, { auth: 'admin' })

register('GET', '/vehicles/admin/:id/', (request) =>
  serializeVehicleDetail(findRow(store.vehicles, request.path.id)), { auth: 'admin' })

register('PATCH', '/vehicles/admin/:id/', (request) => {
  const row = findRow(store.vehicles, request.path.id)
  const changes = readVehicleFields(request.body, { creating: false, current: row })
  commit(row, changes, ['image'])
  return serializeVehicleDetail(row)
}, { auth: 'admin' })

/**
 * The gallery upload. Several files arrive under one repeated `images` field
 * and a bare array of the created rows goes back, because the modal appends it
 * straight onto its state — an envelope here breaks the gallery outright.
 *
 * Two side effects the client depends on: `order` continues from the count
 * already stored, and if the vehicle had no primary photo the first file in the
 * batch becomes one, so a vehicle is never left with a gallery and no lead
 * image for the landing page.
 */
register('POST', '/vehicles/admin/:id/images/', (request) => {
  const id = Number(request.path.id)
  const vehicle = store.vehicles.find((row) => row.id === id)
  if (!vehicle) throw new DemoApiError(404, 'Vehicle not found.')

  const files = readFiles(request.body, 'images')
  if (!files.length) throw new DemoApiError(400, 'No images provided.')

  const existing = imagesForVehicle(id)
  const remaining = MAX_VEHICLE_IMAGES - existing.length
  if (remaining <= 0) {
    throw new DemoApiError(400, `Maximum ${MAX_VEHICLE_IMAGES} images per vehicle.`)
  }
  if (files.length > remaining) {
    throw new DemoApiError(
      400, `Only ${remaining} more image(s) allowed (${MAX_VEHICLE_IMAGES} max).`,
    )
  }
  // Django ran Pillow's `verify()` over each upload. There is no decoder here,
  // so the browser's own sniffed MIME type stands in — weaker, but it still
  // catches the PDF someone dragged in by mistake, which is what the check was
  // there for.
  if (files.some((upload) => !String(upload.type ?? '').startsWith('image/'))) {
    throw new DemoApiError(400, 'One or more files are not valid images.')
  }

  const needsPrimary = !existing.some((image) => image.is_primary)
  const created = files.map((upload, index) => {
    const row = {
      id: nextId('vehicleImages'),
      vehicle_id: id,
      image: storeUpload(upload),
      order: existing.length + index,
      is_primary: needsPrimary && index === 0,
      created_at: now(),
    }
    store.vehicleImages.push(row)
    return serializeVehicleImage(row)
  })
  return created
}, { auth: 'admin' })

register('DELETE', '/vehicles/admin/:id/images/:imageId/', (request) => {
  const row = findVehicleImage(request.path)
  const wasPrimary = row.is_primary
  store.vehicleImages.splice(store.vehicleImages.indexOf(row), 1)
  releaseObjectUrl(row.image)

  // Promote the next photo in `['-is_primary', 'order', 'created_at']` order.
  // The client mirrors this locally and then refetches, so skipping it would
  // leave a gallery that briefly has a lead image and then does not.
  if (wasPrimary) {
    const next = imagesForVehicle(Number(request.path.id))[0]
    if (next) next.is_primary = true
  }
}, { auth: 'admin' })

register('POST', '/vehicles/admin/:id/images/:imageId/primary/', (request) => {
  const row = findVehicleImage(request.path)
  for (const image of imagesForVehicle(row.vehicle_id)) image.is_primary = image.id === row.id
}, { auth: 'admin' })

/** Scoped to the vehicle in the path: an image id that belongs to a different
 *  truck is a 404, not somebody else's photo. */
function findVehicleImage(path) {
  const vehicleId = Number(path.id)
  const imageId = Number(path.imageId)
  const row = store.vehicleImages.find(
    (image) => image.id === imageId && image.vehicle_id === vehicleId,
  )
  if (!row) throw new DemoApiError(404, 'Image not found.')
  return row
}

/* ------------------------------------------------------------------ drivers */

function fullName(driver) {
  return driver ? `${driver.first_name} ${driver.last_name}`.trim() : ''
}

/** The vehicle summary a driver payload carries. `category_names` is the raw
 *  `name` JSON of each category, not a localised string — the drivers table
 *  localises it itself. */
function driverVehicleBrief(vehicle) {
  return {
    id: vehicle.id,
    name: vehicle.name,
    plate_number: vehicle.plate_number,
    category_names: vehicleCategories(vehicle).map((category) => category.name),
    license_categories: vehicle.license_categories,
  }
}

function driverVehicles(driver) {
  return byName(vehiclesForDriver(driver))
}

function ordersForDriver(driverId) {
  return store.orders.filter((order) => order.assigned_driver_id === driverId)
}

function serializeDriverList(row) {
  const active = ordersForDriver(row.id).filter((order) => isActiveStatus(order.status))
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: fullName(row),
    phone: row.phone,
    email: row.email,
    license_number: row.license_number,
    license_categories: row.license_categories,
    license_expiry: row.license_expiry,
    photo: mediaField(row.photo),
    status: row.status,
    status_display: DRIVER_STATUS_LABELS[row.status] ?? row.status,
    is_active: row.is_active,
    // Objects here. The detail serializer sends ids and moves these to
    // `vehicles_detail`; the modal seeds its form from *this* shape.
    vehicles: driverVehicles(row).map(driverVehicleBrief),
    is_busy: active.length > 0,
    active_orders_count: active.length,
    vat_18_percent: row.vat_18_percent,
  }
}

function serializeDriverDetail(row) {
  const vehicles = driverVehicles(row)
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: fullName(row),
    phone: row.phone,
    email: row.email,
    license_number: row.license_number,
    license_categories: row.license_categories,
    license_expiry: row.license_expiry,
    date_of_birth: row.date_of_birth,
    hire_date: row.hire_date,
    photo: mediaField(row.photo),
    notes: row.notes,
    status: row.status,
    status_display: DRIVER_STATUS_LABELS[row.status] ?? row.status,
    is_active: row.is_active,
    vehicles: vehicles.map((vehicle) => vehicle.id),
    vehicles_detail: vehicles.map(driverVehicleBrief),
    is_busy: ordersForDriver(row.id).some((order) => isActiveStatus(order.status)),
    // No `assigned_driver_name` on these, unlike the vehicle version — the
    // driver is the page you are already on.
    active_orders: activeOrdersOf(ordersForDriver(row.id)).map((order) => ({
      id: order.id,
      status: order.status,
      status_display: orderStatusDisplay(order.status),
      pickup_location: order.pickup_location,
      destination_location: order.destination_location,
      scheduled_from: order.scheduled_from,
      scheduled_to: order.scheduled_to,
      requested_date: order.requested_date,
    })),
    vat_18_percent: row.vat_18_percent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function readDriverFields(body, { creating, current = null }) {
  const data = readBody(body)
  const changes = {}

  if (creating || hasField(body, 'first_name')) {
    changes.first_name = readRequiredString(data.first_name, 'first_name', {
      minLength: 2, message: 'First name must be at least 2 characters.',
    })
  }
  if (creating || hasField(body, 'last_name')) {
    changes.last_name = readRequiredString(data.last_name, 'last_name', {
      minLength: 2, message: 'Last name must be at least 2 characters.',
    })
  }
  if (creating || hasField(body, 'phone')) changes.phone = readPhone(data.phone, 'phone')
  if (hasField(body, 'email')) changes.email = readEmail(data.email, 'email')
  if (creating || hasField(body, 'license_number')) {
    const licence = readRequiredString(data.license_number, 'license_number', {
      minLength: 3, message: 'License number must be at least 3 characters.',
    })
    const clash = store.drivers.find(
      (row) => row.license_number === licence && row.id !== current?.id,
    )
    if (clash) {
      throw DemoApiError.validation({
        license_number: 'driver with this license number already exists.',
      })
    }
    changes.license_number = licence
  }
  if (hasField(body, 'license_categories')) {
    changes.license_categories = readLicenseCategories(data.license_categories, 'license_categories')
  }
  if (hasField(body, 'license_expiry')) {
    changes.license_expiry = readDate(data.license_expiry, 'license_expiry', 'License expiry')
  }
  if (hasField(body, 'date_of_birth')) {
    changes.date_of_birth = readDate(data.date_of_birth, 'date_of_birth', 'Date of birth')
  }
  if (hasField(body, 'hire_date')) {
    changes.hire_date = readDate(data.hire_date, 'hire_date', 'Hire date')
  }
  if (hasField(body, 'notes')) changes.notes = readString(data.notes)
  if (hasField(body, 'status')) changes.status = readChoice(data.status, DRIVER_STATUSES, 'status')
  if (hasField(body, 'is_active')) changes.is_active = readBool(data.is_active, 'is_active')
  if (hasField(body, 'vat_18_percent')) {
    changes.vat_18_percent = readBool(data.vat_18_percent, 'vat_18_percent')
  }
  if (hasField(body, 'vehicles')) {
    changes.vehicle_ids = readRelatedIds(data.vehicles, 'vehicles', (id) => Boolean(vehicleById(id)))
  }
  // Saving a driver with a new photo is two requests: the JSON body first, then
  // a multipart PATCH carrying only this field. Clearing one is `{photo: null}`.
  if (hasField(body, 'photo')) changes.photo = readImage(current?.photo ?? null, data.photo)

  // Cross-field last, the way `validate()` runs after every field has passed —
  // and against the *effective* licence, which on a partial update is whatever
  // the row already held.
  if (changes.vehicle_ids) {
    const licence = 'license_categories' in changes
      ? changes.license_categories
      : (current?.license_categories ?? '')
    assertLicenceCovers(changes.vehicle_ids, licence)
  }

  return changes
}

/**
 * The rule enforced twice on purpose: the driver form filters the vehicle
 * dropdown with `driverCoversVehicle()` and prunes selections when the licence
 * changes, and the serializer rejects anything that slipped through. Getting it
 * wrong here would not error — the vehicles would simply stop appearing in the
 * dropdown, which is a far worse way to find out.
 */
function assertLicenceCovers(vehicleIds, licenseCategories) {
  const held = new Set(parseCodes(licenseCategories))
  for (const id of vehicleIds) {
    const vehicle = vehicleById(id)
    const missing = [...new Set(parseCodes(vehicle.license_categories))]
      .filter((code) => !held.has(code))
      .sort()
    if (missing.length) {
      throw DemoApiError.validation({
        vehicles: `Driver license does not cover ${vehicle.name} (${vehicle.plate_number}). `
          + `Missing categories: ${missing.join(', ')}.`,
      })
    }
  }
}

function driverQueryset(request) {
  const { params, paramsAll } = request
  let rows = applyMultiFilter(store.drivers, paramsAll, 'vehicles', (row) => row.vehicle_ids)
  rows = applyFilters(rows, params, {
    status: (row) => row.status,
    is_active: (row) => row.is_active,
  })
  rows = applySearch(rows, params, [
    (row) => row.first_name,
    (row) => row.last_name,
    (row) => row.phone,
    (row) => row.email,
    (row) => row.license_number,
  ])

  const contains = (param, read) => {
    const term = (params[param] ?? '').trim()
    if (!term || term.length > MAX_FILTER_LENGTH) return
    rows = rows.filter((row) => String(read(row)).toLowerCase().includes(term.toLowerCase()))
  }
  contains('phone_q', (row) => row.phone)
  contains('license_number_q', (row) => row.license_number)
  contains('license_categories_q', (row) => row.license_categories)

  // `Meta.ordering = ['last_name', 'first_name']`.
  return [...rows].sort(
    (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
  )
}

register('GET', '/drivers/admin/', (request) =>
  paginate(driverQueryset(request), request.params, '/drivers/admin/', serializeDriverList),
{ auth: 'admin' })

// The create response body is read, unlike most here: the page takes `id` off
// it to fire the follow-up photo upload, so an empty 201 would silently drop
// every photo attached to a new driver.
register('POST', '/drivers/admin/', (request) => {
  const changes = readDriverFields(request.body, { creating: true })
  const row = {
    id: nextId('drivers'),
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    license_number: '',
    license_categories: '',
    license_expiry: null,
    date_of_birth: null,
    hire_date: null,
    photo: null,
    notes: '',
    status: 'active',
    is_active: true,
    vat_18_percent: true,
    vehicle_ids: [],
    created_at: now(),
    updated_at: now(),
    ...changes,
  }
  store.drivers.push(row)
  return serializeDriverDetail(row)
}, { auth: 'admin' })

register('GET', '/drivers/admin/:id/', (request) =>
  serializeDriverDetail(findRow(store.drivers, request.path.id)), { auth: 'admin' })

register('PATCH', '/drivers/admin/:id/', (request) => {
  const row = findRow(store.drivers, request.path.id)
  commit(row, readDriverFields(request.body, { creating: false, current: row }), ['photo'])
  return serializeDriverDetail(row)
}, { auth: 'admin' })

/* --------------------------------------------------------------- car owners */

function displayName(owner) {
  if (owner.owner_type === 'company') return owner.company_name || '(unnamed company)'
  return `${owner.first_name} ${owner.last_name}`.trim() || '(unnamed person)'
}

/**
 * The annotations `_annotated_owners()` builds as correlated subqueries. There
 * is no link from an owner to an order — the join runs owner → vehicles →
 * assigned orders — which is why none of this is ever seeded and all of it is
 * recomputed on every read.
 *
 * `revenue_completed` is the gross customer price on finished jobs. No
 * commission, no owner split: the real product does not model one.
 */
function ownerMetrics(owner) {
  const orders = ordersForOwner(owner.id)
  const completed = orders.filter((order) => order.status === 'completed')
  const timestamps = orders.map((order) => Date.parse(order.last_event_at)).filter(Number.isFinite)

  return {
    vehicles_count: vehiclesForOwner(owner.id).length,
    orders_total: orders.length,
    orders_active: orders.filter((order) => isActiveStatus(order.status)).length,
    orders_completed: completed.length,
    revenue_completed: completed.reduce((sum, order) => sum + (order.price ?? 0), 0),
    last_activity: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
  }
}

function serializeOwnerList(owner) {
  return {
    id: owner.id,
    owner_type: owner.owner_type,
    display_name: displayName(owner),
    first_name: owner.first_name,
    last_name: owner.last_name,
    company_name: owner.company_name,
    phone: owner.phone,
    email: owner.email,
    is_active: owner.is_active,
    ...ownerMetrics(owner),
  }
}

function serializeOwnerDetail(owner) {
  return {
    id: owner.id,
    owner_type: owner.owner_type,
    first_name: owner.first_name,
    last_name: owner.last_name,
    personal_id: owner.personal_id,
    company_name: owner.company_name,
    company_id: owner.company_id,
    phone: owner.phone,
    email: owner.email,
    address: owner.address,
    notes: owner.notes,
    is_active: owner.is_active,
    display_name: displayName(owner),
    // Per-vehicle counts that exist on this endpoint and nowhere else; the
    // cars drill-down modal is their only reader.
    vehicles_detail: byName(vehiclesForOwner(owner.id)).map((vehicle) => {
      const orders = ordersForVehicle(vehicle.id)
      return {
        id: vehicle.id,
        name: vehicle.name,
        plate_number: vehicle.plate_number,
        status: vehicle.status,
        orders_total: orders.length,
        orders_active: orders.filter((order) => isActiveStatus(order.status)).length,
      }
    }),
    created_at: owner.created_at,
    updated_at: owner.updated_at,
  }
}

/** `Meta.ordering = ['company_name', 'last_name', 'first_name']` — which sorts
 *  every person ahead of every company, because a person's `company_name` is
 *  the empty string. Odd-looking, and exactly what the page shows. */
function inOwnerOrder(rows) {
  return [...rows].sort(
    (a, b) => a.company_name.localeCompare(b.company_name)
      || a.last_name.localeCompare(b.last_name)
      || a.first_name.localeCompare(b.first_name),
  )
}

function ownerQueryset(request) {
  const { params } = request
  let rows = applyFilters(store.carOwners, params, {
    owner_type: (row) => row.owner_type,
    is_active: (row) => row.is_active,
  })
  rows = applySearch(rows, params, [
    (row) => row.company_name,
    (row) => row.first_name,
    (row) => row.last_name,
    (row) => row.phone,
    (row) => row.email,
    (row) => row.company_id,
    (row) => row.personal_id,
  ])

  // Anything other than these two is treated as no filter at all — lenient by
  // design, so a client sending a value this build has not heard of gets the
  // whole list rather than an empty table.
  const activity = params.activity
  if (activity === 'active' || activity === 'idle') {
    rows = rows.filter((row) => {
      const live = ordersForOwner(row.id).some((order) => isActiveStatus(order.status))
      return activity === 'active' ? live : !live
    })
  }

  return inOwnerOrder(rows)
}

function readOwnerFields(body, { creating, current = null }) {
  const data = readBody(body)
  const changes = {}

  if (hasField(body, 'owner_type')) {
    changes.owner_type = readChoice(data.owner_type, OWNER_TYPES, 'owner_type')
  }
  for (const field of ['first_name', 'last_name', 'company_name']) {
    if (!hasField(body, field)) continue
    const text = readString(data[field])
    if (text.trim() && text.trim().length < 2 && field !== 'company_name') {
      const label = field === 'first_name' ? 'First name' : 'Last name'
      throw DemoApiError.validation({ [field]: `${label} must be at least 2 characters.` })
    }
    changes[field] = text
  }
  for (const field of ['personal_id', 'company_id', 'address', 'notes']) {
    if (hasField(body, field)) changes[field] = readString(data[field])
  }
  if (creating || hasField(body, 'phone')) changes.phone = readPhone(data.phone, 'phone')
  if (hasField(body, 'email')) changes.email = readEmail(data.email, 'email')
  if (hasField(body, 'is_active')) changes.is_active = readBool(data.is_active, 'is_active')

  // The cross-field rules read the *merged* row, not the patch — a PATCH that
  // only flips `is_active` must not be rejected for omitting a company name.
  const merged = { ...(current ?? {}), ...changes }
  const ownerType = merged.owner_type || 'personal'
  if (ownerType === 'company') {
    if (!String(merged.company_name ?? '').trim()) {
      throw DemoApiError.validation({ company_name: 'Required for companies.' })
    }
    if (!String(merged.company_id ?? '').trim()) {
      throw DemoApiError.validation({ company_id: 'Required for companies.' })
    }
  } else {
    if (!String(merged.first_name ?? '').trim()) {
      throw DemoApiError.validation({ first_name: 'Required for a person.' })
    }
    if (!String(merged.last_name ?? '').trim()) {
      throw DemoApiError.validation({ last_name: 'Required for a person.' })
    }
  }
  assertDigits(merged.company_id, 9, 'company_id')
  assertDigits(merged.personal_id, 11, 'personal_id')

  return changes
}

function assertDigits(value, length, field) {
  const text = String(value ?? '').trim()
  if (text && !new RegExp(`^\\d{${length}}$`).test(text)) {
    throw DemoApiError.validation({ [field]: `Must be exactly ${length} digits.` })
  }
}

register('GET', '/car-owners/admin/', (request) =>
  ownerQueryset(request).map(serializeOwnerList), { auth: 'admin' })

register('POST', '/car-owners/admin/', (request) => {
  const changes = readOwnerFields(request.body, { creating: true })
  const row = {
    id: nextId('carOwners'),
    owner_type: 'personal',
    first_name: '',
    last_name: '',
    // Unlike `User.personal_id`, these are plain blank-able columns with no
    // unique constraint, so the unused one is '' rather than null.
    personal_id: '',
    company_name: '',
    company_id: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    is_active: true,
    created_at: now(),
    updated_at: now(),
    ...changes,
  }
  store.carOwners.push(row)
  return serializeOwnerDetail(row)
}, { auth: 'admin' })

/**
 * The CSV the owners page downloads. Real content rather than a stub, because
 * the export is one of the two places the admin leaves the browser with
 * something in hand — and because the numbers in it have to agree with the
 * table it was exported from, which they only do if both come from
 * `ownerMetrics()`.
 *
 * The leading BOM is what makes Excel read the Georgian and Cyrillic names as
 * UTF-8 instead of mojibake, and `csvCell` neutralises the formula-injection
 * classic where a name beginning `=` becomes a live spreadsheet formula.
 */
register('GET', '/car-owners/admin/export/', () => {
  const header = [
    'Name', 'Type', 'Phone', 'Email', 'Vehicles',
    'Total orders', 'Active orders', 'Completed orders',
    'Revenue (GEL)', 'Last activity',
  ]
  const rows = inOwnerOrder(store.carOwners).map((owner) => {
    const metrics = ownerMetrics(owner)
    return [
      displayName(owner),
      OWNER_TYPE_LABELS[owner.owner_type] ?? owner.owner_type,
      owner.phone,
      owner.email,
      metrics.vehicles_count,
      metrics.orders_total,
      metrics.orders_active,
      metrics.orders_completed,
      metrics.revenue_completed,
      metrics.last_activity ?? '',
    ]
  })

  const body = [header, ...rows]
    .map((line) => line.map(csvCell).join(','))
    .join('\r\n')
  return file(new Blob([`\ufeff${body}\r\n`], { type: 'text/csv;charset=utf-8' }), 'car-owners.csv')
}, { auth: 'admin' })

/** `_csv_safe` plus `csv.writer`'s QUOTE_MINIMAL. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /["\r\n,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

register('GET', '/car-owners/admin/:id/', (request) =>
  serializeOwnerDetail(findRow(store.carOwners, request.path.id)), { auth: 'admin' })

register('PATCH', '/car-owners/admin/:id/', (request) => {
  const row = findRow(store.carOwners, request.path.id)
  commit(row, readOwnerFields(request.body, { creating: false, current: row }))
  return serializeOwnerDetail(row)
}, { auth: 'admin' })

/**
 * `owner_activity_report`. Note `recent_orders` spans every status while the
 * three counters do not — the panel is a work history, so a cancelled job
 * belongs in the list even though it earns nothing and holds no truck.
 *
 * The page swallows a failure here and simply omits the block, which makes a
 * silent wrong answer worse than an error: the numbers come from the same
 * walk the list column uses so the two cannot disagree.
 */
register('GET', '/car-owners/admin/:id/activity/', (request) => {
  const owner = findRow(store.carOwners, request.path.id)
  const orders = ordersForOwner(owner.id)
  const byStatus = {}
  for (const order of orders) byStatus[order.status] = (byStatus[order.status] ?? 0) + 1

  const metrics = ownerMetrics(owner)
  return {
    orders_total: metrics.orders_total,
    orders_active: metrics.orders_active,
    orders_completed: metrics.orders_completed,
    orders_by_status: byStatus,
    revenue_completed: metrics.revenue_completed,
    last_activity: metrics.last_activity,
    recent_orders: newestEventFirst(orders).slice(0, 10).map((order) => {
      const vehicle = vehicleById(order.assigned_vehicle_id)
      return {
        id: order.id,
        public_id: String(order.public_id),
        status: order.status,
        status_display: orderStatusDisplay(order.status),
        price: order.price,
        last_event_at: order.last_event_at,
        vehicle: vehicle
          ? { id: vehicle.id, name: vehicle.name, plate_number: vehicle.plate_number }
          : null,
      }
    }),
  }
}, { auth: 'admin' })
