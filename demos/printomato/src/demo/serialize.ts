/**
 * Row → payload, a port of `core/admin_api/serializers.py`.
 *
 * Everything Django computed in an annotation, a model property or a
 * `SerializerMethodField` is computed here instead, which is why the seed
 * carries raw rows and nothing else. Media URLs are built here too, off
 * `import.meta.env.BASE_URL`, so the same seed works at any deploy base.
 */
import type {
  AppNotification,
  Campaign,
  CampaignRef,
  CampaignState,
  Choice,
  Device,
  DeviceRef,
  PaperState,
  PaymentSession,
  PaymentStatus,
  Photo,
  SessionUser,
} from '@/types'

import {
  campaignById,
  deviceById,
  devicesForCampaign,
  localDateKey,
  store,
  todayKey,
  type CampaignRow,
  type DeviceRow,
  type NotificationRow,
  type PaymentRow,
  type PhotoRow,
  type UserRow,
} from '@/demo/store'

const MEDIA_BASE = `${import.meta.env.BASE_URL}media/`
const DAY = 86_400_000

/**
 * Python's `round()` — half to even, not half away from zero.
 *
 * `Math.round` would disagree with Django on every exact `.5`, and the fleet
 * hits them: a 121/200 device is 60.5% (Django 60 = warning, `Math.round` 61),
 * and a 200-sheet device at 49 sheets is 24.5% — the exact `critical`/`warning`
 * boundary, which the live print loop walks straight through one sheet at a
 * time.
 */
export function roundHalfEven(value: number, digits = 0): number {
  const factor = 10 ** digits
  const scaled = value * factor
  const floor = Math.floor(scaled)
  const remainder = scaled - floor
  const rounded =
    remainder > 0.5 ? floor + 1
    : remainder < 0.5 ? floor
    : floor % 2 === 0 ? floor
    : floor + 1
  return rounded / factor
}

/** Uploaded images are already object URLs; only seed-relative paths need the
 *  media prefix, which is what keeps the JSON path-agnostic. */
function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^(blob:|data:|https?:|\/)/.test(value)) return value
  return `${MEDIA_BASE}${value.replace(/^\/+/, '')}`
}

/** DecimalField goes over the wire as a fixed-point string. */
function decimal(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : null
}

// --------------------------------------------------------------------------- //
//  Enum labels
// --------------------------------------------------------------------------- //

const NOTIFICATION_MESSAGE_LABELS: Record<number, string> = {
  1: 'Camera not found',
  2: 'Printer not found',
}

const NOTIFICATION_STATUS_LABELS: Record<number, string> = {
  1: 'Read',
  2: 'Unread',
  3: 'Closed',
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  started: 'Started',
  success: 'Success',
  rejected: 'Rejected',
}

const asChoices = (labels: Record<string, string>): Choice[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

export const NOTIFICATION_MESSAGE_CHOICES: Choice[] = asChoices(NOTIFICATION_MESSAGE_LABELS)
export const NOTIFICATION_STATUS_CHOICES: Choice[] = asChoices(NOTIFICATION_STATUS_LABELS)
export const PAYMENT_STATUS_CHOICES: Choice[] = asChoices(PAYMENT_STATUS_LABELS)

// --------------------------------------------------------------------------- //
//  Auth
// --------------------------------------------------------------------------- //

export function serializeUser(row: UserRow): SessionUser {
  const fullName = `${row.first_name} ${row.last_name}`.trim() || row.username
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: fullName,
    initials: initialsOf(fullName),
    is_staff: row.is_staff,
    is_superuser: row.is_superuser,
    last_login: row.last_login ?? null,
  }
}

function initialsOf(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// --------------------------------------------------------------------------- //
//  Slim nested representations
// --------------------------------------------------------------------------- //

export function serializeDeviceRef(row: DeviceRow): DeviceRef {
  return {
    id: row.id,
    name: row.name,
    device_id: row.device_id,
    location: row.location ?? null,
    is_online: row.is_online,
  }
}

export function serializeCampaignRef(row: CampaignRow): CampaignRef {
  return {
    id: row.id,
    name: row.name,
    sponsor: row.sponsor,
    location: row.location,
  }
}

// --------------------------------------------------------------------------- //
//  Devices
// --------------------------------------------------------------------------- //

export function paperPercentage(row: Pick<DeviceRow, 'paper_count' | 'paper_capacity'>): number {
  if (!row.paper_capacity) return 0
  return roundHalfEven(Math.min(row.paper_count / row.paper_capacity, 1) * 100)
}

export function paperState(percentage: number): PaperState {
  if (percentage >= 60) return 'healthy'
  if (percentage >= 25) return 'warning'
  return 'critical'
}

export function serializeDevice(row: DeviceRow): Device {
  const percentage = paperPercentage(row)
  const today = todayKey()

  let totalPrinted = 0
  let printedToday = 0
  for (const photo of store.photos) {
    if (photo.device_id !== row.id) continue
    totalPrinted += 1
    if (localDateKey(photo.timestamp) === today) printedToday += 1
  }

  const campaigns: CampaignRef[] = []
  for (const id of row.campaign_ids) {
    const campaign = campaignById(id)
    if (campaign) campaigns.push(serializeCampaignRef(campaign))
  }

  return {
    id: row.id,
    name: row.name,
    device_id: row.device_id,
    location: row.location ?? null,
    is_online: row.is_online,
    is_active: row.is_active,
    paper_count: row.paper_count,
    paper_capacity: row.paper_capacity,
    paper_percentage: percentage,
    paper_state: paperState(percentage),
    requires_payment: row.requires_payment,
    photo_price: decimal(row.photo_price),
    payment_token: row.payment_token ?? null,
    keepz_receiver_id: row.keepz_receiver_id ?? null,
    campaigns,
    // An alert only stops mattering once it is closed.
    has_notifications: store.notifications.some(
      (alert) => alert.device_id === row.id && alert.status !== 3,
    ),
    total_printed: totalPrinted,
    printed_today: printedToday,
  }
}

/**
 * `core/views.py::natural_sort_key` — online first, then the text before the
 * first number, then the number itself, so PM-2 precedes PM-10.
 */
export function naturalSortKey(device: Pick<DeviceRow, 'name' | 'is_online'>): [number, string, number] {
  const offline = device.is_online ? 0 : 1
  const match = /\d+/.exec(device.name)
  if (!match) return [offline, device.name, Number.POSITIVE_INFINITY]
  return [offline, device.name.slice(0, match.index), Number(match[0])]
}

export function sortDevicesNaturally<T extends Pick<DeviceRow, 'name' | 'is_online'>>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const [leftOffline, leftPrefix, leftNumber] = naturalSortKey(left)
    const [rightOffline, rightPrefix, rightNumber] = naturalSortKey(right)
    if (leftOffline !== rightOffline) return leftOffline - rightOffline
    if (leftPrefix !== rightPrefix) return leftPrefix < rightPrefix ? -1 : 1
    if (leftNumber === rightNumber) return 0
    return leftNumber < rightNumber ? -1 : 1
  })
}

// --------------------------------------------------------------------------- //
//  Campaigns
// --------------------------------------------------------------------------- //

export function campaignState(
  row: Pick<CampaignRow, 'start_time' | 'end_time'>,
  now: number = Date.now(),
): CampaignState {
  if (Date.parse(row.start_time) > now) return 'upcoming'
  if (Date.parse(row.end_time) < now) return 'expired'
  return 'active'
}

/** `timedelta.days` truncates towards negative infinity, so an unstarted
 *  campaign really does report a negative day count. */
function wholeDays(milliseconds: number): number {
  return Math.floor(milliseconds / DAY)
}

export function serializeCampaign(row: CampaignRow): Campaign {
  const now = Date.now()
  const devices = devicesForCampaign(row.id)
  const elapsed = wholeDays(now - Date.parse(row.start_time))
  const total = wholeDays(Date.parse(row.end_time) - Date.parse(row.start_time))
  const percentage = total === 0 ? 100 : (elapsed / total) * 100

  return {
    id: row.id,
    name: row.name,
    sponsor: row.sponsor,
    is_default: row.is_default,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    line_1: row.line_1,
    line_2: row.line_2,
    main_logo: mediaUrl(row.main_logo),
    secondary_logo: mediaUrl(row.secondary_logo),
    icon: mediaUrl(row.icon),
    banner: mediaUrl(row.banner),
    qr_link: row.qr_link ?? null,
    photo_quantity: row.photo_quantity,
    devices: devices.map(serializeDeviceRef),
    online_devices: devices.filter((device) => device.is_online).length,
    total_devices: devices.length,
    total_printed: store.photos.filter((photo) => photo.campaign_id === row.id).length,
    state: campaignState(row, now),
    // A same-day campaign has no days to divide by; Django calls it day 1 of 1.
    days_gone: total === 0 ? '1/1' : `${elapsed}/${total}`,
    days_gone_percentage: roundHalfEven(Math.max(0, Math.min(percentage, 100)), 1),
  }
}

// --------------------------------------------------------------------------- //
//  Photos
// --------------------------------------------------------------------------- //

export function serializePhoto(row: PhotoRow): Photo {
  const device = deviceById(row.device_id)
  const campaign = campaignById(row.campaign_id)
  const photoUrl = row.file ? `${MEDIA_BASE}photos/${row.file}` : null

  return {
    id: row.id,
    photo_url: photoUrl,
    // Django falls back to the full-size image when no thumbnail was generated.
    thumbnail_url: row.stem ? `${MEDIA_BASE}thumbnails/${row.stem}_thumb.jpg` : photoUrl,
    photo_code: row.photo_code ?? null,
    timestamp: row.timestamp,
    device: device ? serializeDeviceRef(device) : null,
    campaign: campaign ? serializeCampaignRef(campaign) : null,
  }
}

// --------------------------------------------------------------------------- //
//  Notifications
// --------------------------------------------------------------------------- //

export function serializeNotification(row: NotificationRow): AppNotification {
  const device = deviceById(row.device_id)
  const campaign = campaignById(row.campaign_id)

  return {
    id: row.id,
    device: device ? serializeDeviceRef(device) : null,
    campaign: campaign ? serializeCampaignRef(campaign) : null,
    message: row.message,
    message_display: NOTIFICATION_MESSAGE_LABELS[row.message] ?? String(row.message),
    status: row.status,
    status_display: NOTIFICATION_STATUS_LABELS[row.status] ?? String(row.status),
    timestamp: row.timestamp,
  }
}

// --------------------------------------------------------------------------- //
//  Payments
// --------------------------------------------------------------------------- //

export function serializePaymentSession(row: PaymentRow): PaymentSession {
  const device = deviceById(row.device_id)
  return {
    id: row.id,
    device: device ? serializeDeviceRef(device) : null,
    payment_id: row.payment_id,
    status: row.status,
    amount: decimal(row.amount),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
