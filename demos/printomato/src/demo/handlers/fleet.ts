/**
 * Devices and campaigns — a port of `DeviceViewSet` and `CampaignViewSet`.
 *
 * The two write paths differ in shape, not in spirit. The device form posts
 * JSON; the campaign form posts multipart because it carries artwork. Both are
 * normalised to "submitted, or absent" before the same validators run, and
 * absent is always `undefined` — that single convention is what lets a PATCH
 * touch one field without disturbing any other.
 *
 * Error strings are DRF's, not invented ones, because the console renders them
 * verbatim under the offending input.
 */
import type { Campaign, Device, Page } from '@/types'

import { applyRelationFilter, applySearch, paginate } from '@/demo/query'
import {
  DemoApiError,
  notFound,
  register,
  type DemoParams,
  type DemoRequest,
} from '@/demo/router'
import {
  campaignState,
  serializeCampaign,
  serializeDevice,
  sortDevicesNaturally,
} from '@/demo/serialize'
import {
  campaignById,
  deviceById,
  devicesForCampaign,
  nextId,
  onStoreReset,
  releaseObjectUrl,
  store,
  trackObjectUrl,
  type CampaignRow,
  type DeviceRow,
} from '@/demo/store'

// --------------------------------------------------------------------------- //
//  Validation primitives
//
//  A DRF serializer checks every field, then runs `validate()` on the result;
//  only the first failure per field is reported. `Bag` is that bookkeeping.
// --------------------------------------------------------------------------- //

const REQUIRED = 'This field is required.'
const BLANK = 'This field may not be blank.'
const NOT_NULL = 'This field may not be null.'
const DATETIME_FORMAT =
  'Datetime has wrong format. Use one of these formats instead: ' +
  'YYYY-MM-DDThh:mm[:ss[.uuuuuu]][+HH:MM|-HH:MM|Z].'

// DRF builds these off the model's own `unique` message and, unlike Django's
// model validation, never capitalises the substitutions.
const DEVICE_NAME_TAKEN = 'device with this name already exists.'
const DEVICE_ID_TAKEN = 'device with this device id already exists.'
const CAMPAIGN_NAME_TAKEN = 'campaign with this name already exists.'

const TRUE_TOKENS = new Set(['true', '1', 't', 'y', 'yes', 'on'])
const FALSE_TOKENS = new Set(['false', '0', 'f', 'n', 'no', 'off', ''])

/** PositiveSmallIntegerField, both ends. */
const SMALL_INT_MAX = 32_767

class Bag {
  readonly errors: Record<string, string> = {}

  fail(field: string, message: string): undefined {
    if (!(field in this.errors)) this.errors[field] = message
    return undefined
  }

  /** Field errors abort the write before the cross-field checks ever run. */
  flush(): void {
    if (Object.keys(this.errors).length > 0) throw DemoApiError.validation(this.errors)
  }
}

interface TextRules {
  max: number
  required?: boolean
  /** CharField(blank=True): an empty submission is accepted rather than rejected. */
  blank?: boolean
  /** …and, when the column is nullable, stored as null so "cleared" reads as absent. */
  emptyIsNull?: boolean
  slug?: boolean
  url?: boolean
}

function readText(bag: Bag, field: string, raw: unknown, rules: TextRules): string | null | undefined {
  if (raw === undefined) {
    if (rules.required) bag.fail(field, REQUIRED)
    return undefined
  }
  if (raw === null) return rules.emptyIsNull ? null : bag.fail(field, NOT_NULL)
  if (typeof raw !== 'string') return bag.fail(field, 'Not a valid string.')

  // CharField trims by default, so the stored value never keeps stray padding.
  const value = raw.trim()
  if (!value) {
    if (!rules.blank) return bag.fail(field, BLANK)
    return rules.emptyIsNull ? null : ''
  }
  if (value.length > rules.max) {
    return bag.fail(field, `Ensure this field has no more than ${rules.max} characters.`)
  }
  if (rules.slug && !/^[-a-zA-Z0-9_]+$/.test(value)) {
    return bag.fail(field, 'Enter a valid "slug" consisting of letters, numbers, underscores or hyphens.')
  }
  if (rules.url && !/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value)) {
    return bag.fail(field, 'Enter a valid URL.')
  }
  return value
}

function readBoolean(bag: Bag, field: string, raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined
  if (typeof raw === 'boolean') return raw
  if (raw === null) return bag.fail(field, NOT_NULL)

  // Multipart carries every boolean as text.
  const token = String(raw).trim().toLowerCase()
  if (TRUE_TOKENS.has(token)) return true
  if (FALSE_TOKENS.has(token)) return false
  return bag.fail(field, 'Must be a valid boolean.')
}

interface IntegerRules {
  required?: boolean
  min?: number
  max?: number
}

function readInteger(bag: Bag, field: string, raw: unknown, rules: IntegerRules): number | undefined {
  if (raw === undefined) {
    if (rules.required) bag.fail(field, REQUIRED)
    return undefined
  }
  if (raw === null) return bag.fail(field, NOT_NULL)

  const text = typeof raw === 'number' ? String(raw) : String(raw).trim()
  const value = Number(text)
  if (!text || !Number.isInteger(value)) return bag.fail(field, 'A valid integer is required.')
  if (rules.min !== undefined && value < rules.min) {
    return bag.fail(field, `Ensure this value is greater than or equal to ${rules.min}.`)
  }
  if (rules.max !== undefined && value > rules.max) {
    return bag.fail(field, `Ensure this value is less than or equal to ${rules.max}.`)
  }
  return value
}

/** DecimalField: kept as a string, the way it travels on the wire. */
function readDecimal(
  bag: Bag,
  field: string,
  raw: unknown,
  rules: { digits: number; places: number },
): string | null | undefined {
  if (raw === undefined) return undefined
  // The console clears a price by sending null, and `validate()` upstream
  // treats '' the same way.
  if (raw === null || raw === '') return null

  const text = typeof raw === 'number' ? String(raw) : String(raw).trim()
  const value = Number(text)
  if (!Number.isFinite(value)) return bag.fail(field, 'A valid number is required.')

  const [whole = '', fraction = ''] = text.replace(/^[-+]/, '').split('.')
  if (fraction.length > rules.places) {
    return bag.fail(field, `Ensure that there are no more than ${rules.places} decimal places.`)
  }
  if (whole.replace(/^0+(?=\d)/, '').length > rules.digits - rules.places) {
    return bag.fail(
      field,
      `Ensure that there are no more than ${rules.digits - rules.places} digits before the decimal point.`,
    )
  }
  return text
}

/** PrimaryKeyRelatedField(many=True): duplicates collapse, unknown pks are 400s. */
function readIds(
  bag: Bag,
  field: string,
  raw: unknown,
  exists: (id: number) => boolean,
): number[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) return bag.fail(field, `Expected a list of items but got type "${typeof raw}".`)

  const ids: number[] = []
  for (const entry of raw) {
    const id = typeof entry === 'number' ? entry : Number(String(entry).trim())
    if (!Number.isInteger(id) || id <= 0) {
      return bag.fail(field, `Incorrect type. Expected pk value, received ${typeof entry}.`)
    }
    if (!exists(id)) return bag.fail(field, `Invalid pk "${id}" - object does not exist.`)
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

function taken<T extends { id: number }>(
  rows: T[],
  field: keyof T,
  value: unknown,
  current: { id: number } | null,
): boolean {
  return rows.some((row) => row[field] === value && row.id !== current?.id)
}

type JsonBody = Record<string, unknown>

function asObject(body: unknown): JsonBody {
  if (body === null || body === undefined) return {}
  if (typeof body !== 'object' || Array.isArray(body) || body instanceof FormData) {
    throw DemoApiError.validation({
      non_field_errors: `Invalid data. Expected a dictionary, but got ${typeof body}.`,
    })
  }
  return body as JsonBody
}

// --------------------------------------------------------------------------- //
//  Live wiring
// --------------------------------------------------------------------------- //

/**
 * `demo/live.ts` owns the `/ws/fleet/` channel. A restart has to reach that
 * socket for the fleet grid to react to it, but importing the bus from here
 * would make the two modules circular — the bus writes to this same store. So
 * the bus hands its emitter in instead, and until it does the reboot is a
 * silent store mutation the next refetch picks up.
 */
export interface FleetSignals {
  presence(device: DeviceRow): void
}

let signals: FleetSignals | null = null

export function connectFleetSignals(next: FleetSignals | null): void {
  signals = next
}

const REBOOT_MS = 4_200
const rebooting = new Map<number, number>()

function cancelReboot(deviceId: number): void {
  const timer = rebooting.get(deviceId)
  if (timer !== undefined) window.clearTimeout(timer)
  rebooting.delete(deviceId)
}

// A reboot in flight when the visitor resets the demo would otherwise fire
// against the fresh store and flip a pristine device online.
onStoreReset(() => {
  for (const timer of rebooting.values()) window.clearTimeout(timer)
  rebooting.clear()
})

/** A restart the operator can watch happen: the kiosk drops off the fleet and
 *  reappears a few seconds later, which is what a real reboot looks like. */
function reboot(device: DeviceRow): void {
  cancelReboot(device.id)
  device.is_online = false
  signals?.presence(device)

  rebooting.set(
    device.id,
    window.setTimeout(() => {
      rebooting.delete(device.id)
      // It may have been deleted while it was down.
      const row = deviceById(device.id)
      if (!row) return
      row.is_online = true
      signals?.presence(row)
    }, REBOOT_MS),
  )
}

// --------------------------------------------------------------------------- //
//  Devices
// --------------------------------------------------------------------------- //

type DeviceInput = Partial<Omit<DeviceRow, 'id' | 'is_online'>>

const DEVICE_DEFAULTS: Omit<DeviceRow, 'id' | 'name' | 'device_id' | 'campaign_ids'> = {
  location: null,
  is_online: false,
  is_active: true,
  paper_count: 0,
  paper_capacity: 200,
  requires_payment: false,
  photo_price: null,
  payment_token: null,
  keepz_receiver_id: null,
}

/**
 * `AdminDeviceSerializer._merged()`: every rule is checked against the value the
 * row will *have*, taken from the submission, else the row, else the model
 * default. Reading a bare 0/None instead made `{name, device_id, paper_count}`
 * fail on create even though paper_capacity defaults to 200.
 */
function validateDevice(input: DeviceInput, current: DeviceRow | null): void {
  const merged = <T>(submitted: T | undefined, stored: T | undefined, fallback: T): T =>
    submitted !== undefined ? submitted : stored !== undefined ? stored : fallback

  const paperCount = merged(input.paper_count, current?.paper_count, DEVICE_DEFAULTS.paper_count)
  const paperCapacity = merged(input.paper_capacity, current?.paper_capacity, DEVICE_DEFAULTS.paper_capacity)
  const requiresPayment = merged(input.requires_payment, current?.requires_payment, DEVICE_DEFAULTS.requires_payment)
  const price = merged(input.photo_price, current?.photo_price, DEVICE_DEFAULTS.photo_price)

  const errors: Record<string, string> = {}
  if (paperCount > paperCapacity) errors.paper_count = 'Paper count cannot exceed paper capacity'
  if (price !== null && Number(price) < 0) errors.photo_price = 'Photo price cannot be negative'
  // Merged, so a PATCH cannot strip the price off a device that stays paid.
  if (requiresPayment && price === null) {
    errors.photo_price = 'A price is required when the device runs in paid mode'
  }
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
}

function readDeviceInput(body: unknown, current: DeviceRow | null, partial: boolean): DeviceInput {
  const data = asObject(body)
  const bag = new Bag()
  const input: DeviceInput = {}

  const name = readText(bag, 'name', data.name, { max: 255, required: !partial })
  if (typeof name === 'string') {
    if (taken(store.devices, 'name', name, current)) bag.fail('name', DEVICE_NAME_TAKEN)
    else input.name = name
  }

  const deviceId = readText(bag, 'device_id', data.device_id, { max: 255, required: !partial, slug: true })
  if (typeof deviceId === 'string') {
    if (taken(store.devices, 'device_id', deviceId, current)) bag.fail('device_id', DEVICE_ID_TAKEN)
    else input.device_id = deviceId
  }

  const location = readText(bag, 'location', data.location, { max: 255, blank: true, emptyIsNull: true })
  if (location !== undefined) input.location = location

  const isActive = readBoolean(bag, 'is_active', data.is_active)
  if (isActive !== undefined) input.is_active = isActive

  const paperCount = readInteger(bag, 'paper_count', data.paper_count, { min: 0, max: SMALL_INT_MAX })
  if (paperCount !== undefined) input.paper_count = paperCount

  const paperCapacity = readInteger(bag, 'paper_capacity', data.paper_capacity, { min: 0, max: SMALL_INT_MAX })
  if (paperCapacity !== undefined) input.paper_capacity = paperCapacity

  const requiresPayment = readBoolean(bag, 'requires_payment', data.requires_payment)
  if (requiresPayment !== undefined) input.requires_payment = requiresPayment

  const price = readDecimal(bag, 'photo_price', data.photo_price, { digits: 8, places: 2 })
  if (price !== undefined) input.photo_price = price

  const token = readText(bag, 'payment_token', data.payment_token, { max: 128, blank: true, emptyIsNull: true })
  if (token !== undefined) input.payment_token = token

  const receiver = readText(bag, 'keepz_receiver_id', data.keepz_receiver_id, {
    max: 128,
    blank: true,
    emptyIsNull: true,
  })
  if (receiver !== undefined) input.keepz_receiver_id = receiver

  const campaignIds = readIds(bag, 'campaign_ids', data.campaign_ids, (id) => campaignById(id) !== undefined)
  if (campaignIds !== undefined) input.campaign_ids = campaignIds

  bag.flush()
  validateDevice(input, current)
  return input
}

function mustFindDevice(request: DemoRequest): DeviceRow {
  const row = deviceById(Number(request.path.id))
  if (!row) throw notFound()
  return row
}

function listDevices(params: DemoParams): Device[] {
  let rows = applySearch(store.devices, params, [
    (row) => row.name,
    (row) => row.device_id,
    (row) => row.location,
  ])
  rows = applyRelationFilter(rows, params, 'campaign', { pk: (row) => row.campaign_ids })

  const presence = params.presence
  if (presence === 'online' || presence === 'offline') {
    rows = rows.filter((row) => row.is_online === (presence === 'online'))
  }

  const mode = params.mode
  if (mode === 'paid' || mode === 'free') {
    rows = rows.filter((row) => row.requires_payment === (mode === 'paid'))
  }

  const state = params.state
  if (state === 'active' || state === 'inactive') {
    rows = rows.filter((row) => row.is_active === (state === 'active'))
  }

  // The fleet grid always renders the whole fleet, so this route is unpaginated.
  return sortDevicesNaturally(rows).map(serializeDevice)
}

register('GET', '/devices/', (request) => listDevices(request.params))

register('GET', '/devices/:id/', (request) => serializeDevice(mustFindDevice(request)))

register('POST', '/devices/', (request) => {
  const input = readDeviceInput(request.body, null, false)
  const row: DeviceRow = {
    id: nextId('devices'),
    name: '',
    device_id: '',
    campaign_ids: [],
    ...DEVICE_DEFAULTS,
  }
  // Every required field was validated as present, so this cannot leave a blank.
  Object.assign(row, input)
  store.devices.push(row)
  return serializeDevice(row)
})

for (const method of ['PATCH', 'PUT'] as const) {
  register(method, '/devices/:id/', (request) => {
    const row = mustFindDevice(request)
    // PUT is a full write, so an absent field is missing rather than untouched.
    Object.assign(row, readDeviceInput(request.body, row, method === 'PATCH'))
    return serializeDevice(row)
  })
}

register('DELETE', '/devices/:id/', (request) => {
  const row = mustFindDevice(request)
  cancelReboot(row.id)
  store.devices = store.devices.filter((device) => device.id !== row.id)
  // Notification.device and PaymentSession.device are CASCADE; Photo.device is
  // SET_NULL, which is the promise the delete dialog makes to the operator:
  // "its photos stay in the archive".
  store.notifications = store.notifications.filter((alert) => alert.device_id !== row.id)
  store.payments = store.payments.filter((payment) => payment.device_id !== row.id)
  for (const photo of store.photos) {
    if (photo.device_id === row.id) photo.device_id = null
  }
})

register('POST', '/devices/:id/command/', (request) => {
  const device = mustFindDevice(request)
  const data = asObject(request.body)
  const bag = new Bag()

  const command = readText(bag, 'command', data.command, { max: 255 }) ?? 'restart'
  if (data.payload !== undefined && data.payload !== null && typeof data.payload !== 'object') {
    // The demo has no channel layer to forward it to, but a malformed payload
    // is still a 400 rather than a silent no-op.
    bag.fail('payload', `Expected a dictionary of items but got type "${typeof data.payload}".`)
  }
  bag.flush()

  // The channel layer accepts the message either way; only a connected kiosk
  // consumes it. Read presence before the reboot so the reply describes the
  // fleet as it was when the command was accepted.
  const delivered = device.is_online
  if (command === 'restart' && delivered) reboot(device)

  return { device_id: device.device_id, command, is_online: delivered, delivered }
})

// --------------------------------------------------------------------------- //
//  Campaigns
// --------------------------------------------------------------------------- //

type ImageField = 'banner' | 'main_logo' | 'secondary_logo' | 'icon'

/** Only `banner` is an ImageField upstream; the other three take any file. */
const ARTWORK: { field: ImageField; picture: boolean }[] = [
  { field: 'banner', picture: true },
  { field: 'main_logo', picture: false },
  { field: 'secondary_logo', picture: false },
  { field: 'icon', picture: false },
]

type CampaignScalars = Partial<Omit<CampaignRow, 'id' | ImageField>>

interface CampaignWrite {
  fields: CampaignScalars
  /** A `File` becomes an object URL at write time; a string is a seed path. */
  images: Partial<Record<ImageField, string | File>>
  deviceIds?: number[]
}

const CAMPAIGN_DEFAULTS: Omit<CampaignRow, 'id' | 'name' | 'sponsor' | 'start_time' | 'end_time'> = {
  is_default: false,
  location: '',
  line_1: '',
  line_2: '',
  main_logo: null,
  secondary_logo: null,
  icon: null,
  // Stands in for the required upload Django would have demanded; overwritten
  // the moment the form actually carries a file.
  banner: 'campaigns/gudauri-season.jpg',
  qr_link: null,
  photo_quantity: 10,
}

interface Submission {
  has(field: string): boolean
  get(field: string): string | File | undefined
  all(field: string): (string | File)[]
}

/** The campaign form posts multipart because of the artwork; a JSON body is
 *  read the same way so the encoding never decides whether a write works. */
function submission(body: unknown): Submission {
  const entries = new Map<string, (string | File)[]>()
  const push = (field: string, value: string | File) => {
    const bucket = entries.get(field)
    if (bucket) bucket.push(value)
    else entries.set(field, [value])
  }

  if (body instanceof FormData) {
    for (const [field, value] of body.entries()) push(field, value)
  } else if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [field, value] of Object.entries(body)) {
      if (Array.isArray(value)) for (const item of value) push(field, String(item))
      else if (value instanceof File) push(field, value)
      else if (value !== undefined) push(field, value === null ? '' : String(value))
    }
  }

  return {
    has: (field) => entries.has(field),
    get: (field) => entries.get(field)?.[0],
    all: (field) => entries.get(field) ?? [],
  }
}

function readDateTime(bag: Bag, field: string, raw: unknown, required: boolean): string | undefined {
  if (raw === undefined) {
    if (required) bag.fail(field, REQUIRED)
    return undefined
  }
  if (raw === null || raw === '') return bag.fail(field, NOT_NULL)

  const parsed = Date.parse(String(raw).trim())
  if (!Number.isFinite(parsed)) return bag.fail(field, DATETIME_FORMAT)
  return new Date(parsed).toISOString()
}

function readImage(
  bag: Bag,
  field: ImageField,
  raw: string | File | undefined,
  picture: boolean,
): string | File | undefined {
  if (raw === undefined || raw === '') return undefined
  if (!(raw instanceof File)) return raw
  if (raw.size === 0) return bag.fail(field, 'The submitted file is empty.')
  if (picture && !raw.type.startsWith('image/')) {
    return bag.fail(
      field,
      'Upload a valid image. The file you uploaded was either not an image or a corrupted image.',
    )
  }
  return raw
}

function readCampaignWrite(
  body: unknown,
  current: CampaignRow | null,
  partial: boolean,
): CampaignWrite {
  const form = submission(body)
  const bag = new Bag()
  const fields: CampaignScalars = {}

  const name = readText(bag, 'name', form.get('name'), { max: 255, required: !partial })
  if (typeof name === 'string') {
    if (taken(store.campaigns, 'name', name, current)) bag.fail('name', CAMPAIGN_NAME_TAKEN)
    else fields.name = name
  }

  const sponsor = readText(bag, 'sponsor', form.get('sponsor'), { max: 255, required: !partial })
  if (typeof sponsor === 'string') fields.sponsor = sponsor

  const start = readDateTime(bag, 'start_time', form.get('start_time'), !partial)
  if (start !== undefined) fields.start_time = start

  const end = readDateTime(bag, 'end_time', form.get('end_time'), !partial)
  if (end !== undefined) fields.end_time = end

  for (const field of ['location', 'line_1', 'line_2'] as const) {
    const value = readText(bag, field, form.get(field), { max: 255, blank: true })
    if (typeof value === 'string') fields[field] = value
  }

  const qrLink = readText(bag, 'qr_link', form.get('qr_link'), {
    max: 200,
    blank: true,
    emptyIsNull: true,
    url: true,
  })
  if (qrLink !== undefined) fields.qr_link = qrLink

  const quantity = readInteger(bag, 'photo_quantity', form.get('photo_quantity'), {
    min: 0,
    max: SMALL_INT_MAX,
  })
  if (quantity !== undefined) fields.photo_quantity = quantity

  const isDefault = readBoolean(bag, 'is_default', form.get('is_default'))
  if (isDefault !== undefined) fields.is_default = isDefault

  const images: CampaignWrite['images'] = {}
  for (const { field, picture } of ARTWORK) {
    // Django makes `banner` a required ImageField. The demo cannot: it has no
    // file storage and no visitor should have to go find a JPEG on their own
    // machine to finish "New campaign", so a create with no banner picked
    // falls back to a bundled sample (see CAMPAIGN_DEFAULTS) instead of 400ing.
    const value = readImage(bag, field, form.get(field), picture)
    if (value !== undefined) images[field] = value
  }

  // Multipart cannot express an empty list, so the console sends a single blank
  // value to mean "detach every device" — otherwise indistinguishable from a
  // field that was never submitted.
  const submitted = form.has('device_ids') ? form.all('device_ids') : undefined
  const cleared = submitted?.length === 1 && submitted[0] === ''
  const deviceIds = cleared
    ? []
    : readIds(bag, 'device_ids', submitted, (id) => deviceById(id) !== undefined)

  bag.flush()

  // The serializer's own validate(), on the merged window: both ends are
  // reported so the form marks both inputs.
  const startTime = fields.start_time ?? current?.start_time
  const endTime = fields.end_time ?? current?.end_time
  if (startTime && endTime && Date.parse(startTime) > Date.parse(endTime)) {
    throw DemoApiError.validation({
      start_time: 'Start time cannot be after end time',
      end_time: 'End time cannot be before start time',
    })
  }

  return { fields, images, deviceIds }
}

/** Django owns the m2m on Device, so attaching is a write on the other side. */
function attachDevices(campaignId: number, deviceIds: number[]): void {
  for (const device of store.devices) {
    const wanted = deviceIds.includes(device.id)
    const held = device.campaign_ids.includes(campaignId)
    if (wanted && !held) device.campaign_ids.push(campaignId)
    else if (!wanted && held) {
      device.campaign_ids = device.campaign_ids.filter((id) => id !== campaignId)
    }
  }
}

function applyCampaign(row: CampaignRow, write: CampaignWrite): void {
  Object.assign(row, write.fields)

  for (const { field } of ARTWORK) {
    const value = write.images[field]
    if (value === undefined) continue
    // Whatever the field was rendering from stops being reachable here.
    releaseObjectUrl(row[field])
    row[field] = value instanceof File ? trackObjectUrl(URL.createObjectURL(value)) : value
  }

  if (write.deviceIds !== undefined) attachDevices(row.id, write.deviceIds)
}

function mustFindCampaign(request: DemoRequest): CampaignRow {
  const row = campaignById(Number(request.path.id))
  if (!row) throw notFound()
  return row
}

const STATE_RANK: Record<string, number> = { active: 0, upcoming: 1, expired: 2 }

function listCampaigns(params: DemoParams): Page<Campaign> {
  const now = Date.now()

  let rows = applySearch(store.campaigns, params, [
    (row) => row.name,
    (row) => row.sponsor,
    (row) => row.location,
  ])

  const state = params.state
  if (state in STATE_RANK) rows = rows.filter((row) => campaignState(row, now) === state)

  rows = applyRelationFilter(rows, params, 'device', {
    pk: (row) => devicesForCampaign(row.id).map((device) => device.id),
    slug: (row) => devicesForCampaign(row.id).map((device) => device.device_id),
  })

  // `-is_active, -is_upcoming, -has_expired, -id`: running campaigns first,
  // then what is about to run, then the archive, newest of each first.
  const ordered = [...rows].sort(
    (left, right) =>
      STATE_RANK[campaignState(left, now)] - STATE_RANK[campaignState(right, now)] ||
      right.id - left.id,
  )

  return paginate(ordered, params, 24, serializeCampaign)
}

register('GET', '/campaigns/', (request) => listCampaigns(request.params))

register('GET', '/campaigns/:id/', (request) => serializeCampaign(mustFindCampaign(request)))

register('POST', '/campaigns/', (request) => {
  const write = readCampaignWrite(request.body, null, false)
  const now = new Date().toISOString()
  const row: CampaignRow = {
    id: nextId('campaigns'),
    name: '',
    sponsor: '',
    start_time: now,
    end_time: now,
    ...CAMPAIGN_DEFAULTS,
  }
  store.campaigns.push(row)
  applyCampaign(row, write)
  return serializeCampaign(row)
})

for (const method of ['PATCH', 'PUT'] as const) {
  register(method, '/campaigns/:id/', (request) => {
    const row = mustFindCampaign(request)
    applyCampaign(row, readCampaignWrite(request.body, row, method === 'PATCH'))
    return serializeCampaign(row)
  })
}

register('DELETE', '/campaigns/:id/', (request) => {
  const row = mustFindCampaign(request)
  store.campaigns = store.campaigns.filter((campaign) => campaign.id !== row.id)
  attachDevices(row.id, [])
  // Campaign is the CASCADE parent of both, which is what the delete dialog
  // warns about: "every photo taken under this campaign is deleted with it".
  store.photos = store.photos.filter((photo) => photo.campaign_id !== row.id)
  store.notifications = store.notifications.filter((alert) => alert.campaign_id !== row.id)
  for (const { field } of ARTWORK) releaseObjectUrl(row[field])
})
