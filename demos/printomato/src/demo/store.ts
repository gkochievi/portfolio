/**
 * The demo's database.
 *
 * A deep copy of the JSON seed, rebased so it always reads as if the fleet had
 * been printing right up to this morning, held in memory for the life of the
 * tab. Nothing here touches localStorage, sessionStorage or IndexedDB — every
 * visitor gets the same pristine fleet, and a reload (or the Reset button) puts
 * it back.
 *
 * The rows below restate the seed's shapes with the foreign keys widened to
 * nullable: the seed never holds a null, but `Photo.device` is `SET_NULL` and
 * an uploaded campaign image replaces a media path with an object URL, so the
 * mutable copy has to be able to say so. Note that a Device's own `device_id`
 * is its slug while `PhotoRow.device_id` is a numeric foreign key — same name,
 * two meanings, exactly as in Django.
 */
import type { CampaignState, NotificationStatus, PaymentStatus } from '@/types'

import { bootstrap } from '@/lib/bootstrap'

import { seed } from '@/demo/seed'

export interface DeviceRow {
  id: number
  name: string
  device_id: string
  location: string | null
  is_online: boolean
  is_active: boolean
  paper_count: number
  paper_capacity: number
  requires_payment: boolean
  photo_price: string | null
  payment_token: string | null
  keepz_receiver_id: string | null
  /** Django owns this M2M on Device (`Campaign.device_set` is the reverse). */
  campaign_ids: number[]
}

export interface CampaignRow {
  id: number
  name: string
  sponsor: string
  is_default: boolean
  start_time: string
  end_time: string
  location: string
  line_1: string
  line_2: string
  /** Path under public/media/, or an object URL once someone uploads a file. */
  main_logo: string | null
  secondary_logo: string | null
  icon: string | null
  banner: string | null
  qr_link: string | null
  photo_quantity: number
}

export interface PhotoRow {
  id: number
  file: string
  stem: string
  photo_code: string | null
  timestamp: string
  device_id: number | null
  campaign_id: number | null
}

export interface NotificationRow {
  id: number
  device_id: number | null
  campaign_id: number | null
  message: number
  status: NotificationStatus
  timestamp: string
}

export interface PaymentRow {
  id: number
  device_id: number | null
  payment_id: string
  status: PaymentStatus
  amount: string | null
  created_at: string
  updated_at: string
}

export interface UserRow {
  id: number
  username: string
  /** Only ever compared against the login form. */
  password: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_superuser: boolean
  last_login: string | null
}

export interface DemoStore {
  devices: DeviceRow[]
  campaigns: CampaignRow[]
  photos: PhotoRow[]
  notifications: NotificationRow[]
  payments: PaymentRow[]
  user: UserRow
  /** Starts true so a first-time visitor lands on the dashboard, not the login form. */
  signedIn: boolean
}

export type Collection = 'devices' | 'campaigns' | 'photos' | 'notifications' | 'payments'

const DAY = 86_400_000
const CLOSED: NotificationStatus = 3

// --------------------------------------------------------------------------- //
//  Clock helpers
//
//  Every day boundary in the demo is drawn in `bootstrap.timeZone`, not in the
//  visitor's own zone — the same zone `lib/format.ts` renders every timestamp
//  in, which is what Django did with `USE_TZ` and `TIME_ZONE = 'Asia/Tbilisi'`:
//  the server bucketed by `__date` in that zone and the page printed it in that
//  zone. Bucketing locally instead would make a console opened in Auckland
//  report "printed today: 4" over an archive whose newest nine rows all read
//  today's date.
// --------------------------------------------------------------------------- //

const DAY_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: bootstrap.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` in the demo's zone — the key every date filter and bucket
 *  compares on. */
export function localDateKey(value: Date | string | number): string {
  const parts = DAY_PARTS.formatToParts(value instanceof Date ? value : new Date(value))
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function todayKey(): string {
  return localDateKey(new Date())
}

/**
 * Day arithmetic on the key itself, through UTC, so stepping a series never
 * has to care what either zone is doing about daylight saving.
 */
export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1, day))
  at.setUTCDate(at.getUTCDate() + days)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`
}

/** Whole days between two keys, as milliseconds. */
function dayKeyDistance(from: string, to: string): number {
  const utc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return utc(to) - utc(from)
}

const ZONE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: bootstrap.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Milliseconds to add to UTC to reach wall-clock time in the demo's zone at `at`. */
function zoneOffset(at: number): number {
  const parts = ZONE_PARTS.formatToParts(at)
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)
  // `hour12: false` renders midnight as 24 on some engines; fold it back to 0.
  const wall = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second'),
  )
  return wall - at
}

/** The instant local midnight opens on `key`, in the demo's zone. */
function dayStartMs(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day)
  // Guess with the offset read at the wall time, then re-read it at the guess
  // so a zone that shifts overnight still lands on the right instant.
  return wall - zoneOffset(wall - zoneOffset(wall))
}

// --------------------------------------------------------------------------- //
//  Construction
// --------------------------------------------------------------------------- //

/** Deep copy so the seed modules stay pristine and a reset can start over. */
function hydrate(): DemoStore {
  const data: DemoStore = { ...structuredClone(seed), signedIn: true }
  rebase(data)
  return data
}

/**
 * Shift every timestamp so the newest photo lands on today.
 *
 * The seed carries absolute dates, so without this the print chart, the
 * "printed today" counters and the campaign windows all go stale the moment
 * the demo is opened on a later day than it was authored.
 */
function rebase(data: DemoStore): void {
  let newest = Number.NEGATIVE_INFINITY
  for (const photo of data.photos) {
    const parsed = Date.parse(photo.timestamp)
    if (Number.isFinite(parsed) && parsed > newest) newest = parsed
  }

  if (Number.isFinite(newest)) {
    // A whole number of days, so every timestamp keeps its time of day in the
    // demo's zone — the seed's mornings stay mornings.
    const offset = dayKeyDistance(localDateKey(newest), todayKey())
    if (offset !== 0) {
      const shift = (iso: string): string => {
        const parsed = Date.parse(iso)
        return Number.isFinite(parsed) ? new Date(parsed + offset).toISOString() : iso
      }
      for (const photo of data.photos) photo.timestamp = shift(photo.timestamp)
      for (const alert of data.notifications) alert.timestamp = shift(alert.timestamp)
      for (const payment of data.payments) {
        payment.created_at = shift(payment.created_at)
        payment.updated_at = shift(payment.updated_at)
      }
      for (const campaign of data.campaigns) {
        campaign.start_time = shift(campaign.start_time)
        campaign.end_time = shift(campaign.end_time)
      }
      if (data.user.last_login) data.user.last_login = shift(data.user.last_login)
    }
  }

  compressToday(data)
  realignCampaigns(data.campaigns, Date.now())
}

/**
 * Pull today's rows back into the part of the day that has actually happened.
 *
 * The shift above moves a whole number of days, so every row keeps its time of
 * day — which means the anchor day's evening rows (the seed's newest photo is
 * 19:46 Tbilisi) land in the *future* for anyone opening the demo before then,
 * i.e. all of European and US business hours. Django cannot produce that:
 * `Photo.timestamp` and `Notification.timestamp` default to `timezone.now()`
 * and `PaymentSession.created_at` is `auto_now_add`. Squeezing the anchor day
 * into the elapsed fraction of today keeps the ordering, the spread and the
 * "printed today" counts while putting nothing after now.
 */
function compressToday(data: DemoStore): void {
  const today = todayKey()
  const dayStart = dayStartMs(today)
  const now = Date.now()
  const scale = Math.min(Math.max(now - dayStart, 0) / DAY, 1)

  const squeeze = (iso: string): string => {
    const parsed = Date.parse(iso)
    if (!Number.isFinite(parsed)) return iso
    const at = localDateKey(parsed) === today ? dayStart + (parsed - dayStart) * scale : parsed
    // Belt and braces: nothing in the archive may be newer than the moment it
    // is read, whichever day it started on.
    return new Date(Math.min(at, now)).toISOString()
  }

  for (const photo of data.photos) photo.timestamp = squeeze(photo.timestamp)
  for (const alert of data.notifications) alert.timestamp = squeeze(alert.timestamp)
  for (const payment of data.payments) {
    payment.created_at = squeeze(payment.created_at)
    payment.updated_at = squeeze(payment.updated_at)
    // A session can only settle after it started, whatever the two ends
    // rounded to.
    if (Date.parse(payment.updated_at) < Date.parse(payment.created_at)) {
      payment.updated_at = payment.created_at
    }
  }
  if (data.user.last_login) data.user.last_login = squeeze(data.user.last_login)
}

function windowOf(campaign: CampaignRow, now: number): CampaignState {
  const start = Date.parse(campaign.start_time)
  const end = Date.parse(campaign.end_time)
  if (start > now) return 'upcoming'
  if (end < now) return 'expired'
  return 'active'
}

/**
 * A uniform shift preserves the spread between campaigns but not necessarily
 * the mix of states — a seed authored mid-campaign can rebase into "everything
 * expired". Nudge one window per missing state, taking a campaign whose own
 * state has a spare so nothing is traded away.
 */
function realignCampaigns(campaigns: CampaignRow[], now: number): void {
  for (const wanted of ['active', 'upcoming', 'expired'] as const) {
    if (campaigns.some((campaign) => windowOf(campaign, now) === wanted)) continue

    const tally = new Map<CampaignState, number>()
    for (const campaign of campaigns) {
      const state = windowOf(campaign, now)
      tally.set(state, (tally.get(state) ?? 0) + 1)
    }
    // Only ever borrow from a state that has one to spare, so a small seed
    // settles on the states it can cover instead of shuffling them forever.
    const spare = campaigns.filter((campaign) => (tally.get(windowOf(campaign, now)) ?? 0) > 1)
    if (!spare.length) continue

    // The window already closest to now is the least jarring one to move.
    const donor = spare.reduce((best, candidate) =>
      distanceFromNow(candidate, now) < distanceFromNow(best, now) ? candidate : best)
    moveWindow(donor, wanted, now)
  }
}

function distanceFromNow(campaign: CampaignRow, now: number): number {
  const start = Date.parse(campaign.start_time)
  const end = Date.parse(campaign.end_time)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY
  return Math.abs((start + end) / 2 - now)
}

function moveWindow(campaign: CampaignRow, wanted: CampaignState, now: number): void {
  const start = Date.parse(campaign.start_time)
  const end = Date.parse(campaign.end_time)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return

  const span = Math.max(end - start, DAY)
  const nextStart =
    wanted === 'active' ? now - Math.round(span * 0.4)
    : wanted === 'upcoming' ? now + 3 * DAY
    : now - span - 2 * DAY

  campaign.start_time = new Date(nextStart).toISOString()
  campaign.end_time = new Date(nextStart + span).toISOString()
}

// --------------------------------------------------------------------------- //
//  The store
// --------------------------------------------------------------------------- //

/** Live binding: `resetStore()` refills this object rather than replacing it,
 *  so every module that imported it keeps looking at the right data. */
export const store: DemoStore = hydrate()

let counters = highestIds(store)

function highestIds(data: DemoStore): Record<Collection, number> {
  const after = (rows: { id: number }[]) => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1
  return {
    devices: after(data.devices),
    campaigns: after(data.campaigns),
    photos: after(data.photos),
    notifications: after(data.notifications),
    payments: after(data.payments),
  }
}

/** Ids continue from the seed's highest and are never reused, like a real sequence. */
export function nextId(collection: Collection): number {
  const id = counters[collection]
  counters[collection] = id + 1
  return id
}

/** Object URLs minted for uploaded campaign images, so a reset can free them. */
const objectUrls = new Set<string>()

export function trackObjectUrl(url: string): string {
  objectUrls.add(url)
  return url
}

/** Revokes a tracked URL; safe to call with a seed path or null. */
export function releaseObjectUrl(url: string | null | undefined): void {
  if (url && objectUrls.delete(url)) URL.revokeObjectURL(url)
}

/** Handlers with state of their own (pending timers, caches) register here so
 *  a reset really resets everything, not just the rows. */
const resetHooks = new Set<() => void>()

export function onStoreReset(hook: () => void): void {
  resetHooks.add(hook)
}

export function resetStore(): void {
  for (const hook of resetHooks) hook()
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.clear()
  Object.assign(store, hydrate())
  counters = highestIds(store)
}

export function isSignedIn(): boolean {
  return store.signedIn
}

export function setSignedIn(value: boolean): void {
  store.signedIn = value
}

// --------------------------------------------------------------------------- //
//  Lookups
//
//  Linear scans over a fleet of ten devices and a hundred photos: cheaper than
//  the indexes that would have to be kept honest across every mutation.
// --------------------------------------------------------------------------- //

export function deviceById(id: number | null | undefined): DeviceRow | undefined {
  return id == null ? undefined : store.devices.find((device) => device.id === id)
}

export function deviceBySlug(slug: string): DeviceRow | undefined {
  return store.devices.find((device) => device.device_id === slug)
}

export function campaignById(id: number | null | undefined): CampaignRow | undefined {
  return id == null ? undefined : store.campaigns.find((campaign) => campaign.id === id)
}

export function campaignsForDevice(device: DeviceRow): CampaignRow[] {
  const attached: CampaignRow[] = []
  for (const id of device.campaign_ids) {
    const campaign = campaignById(id)
    if (campaign) attached.push(campaign)
  }
  return attached
}

export function devicesForCampaign(campaignId: number): DeviceRow[] {
  return store.devices.filter((device) => device.campaign_ids.includes(campaignId))
}

export function photosForDevice(deviceId: number): PhotoRow[] {
  return store.photos.filter((photo) => photo.device_id === deviceId)
}

export function photosForCampaign(campaignId: number): PhotoRow[] {
  return store.photos.filter((photo) => photo.campaign_id === campaignId)
}

export function notificationsForDevice(deviceId: number): NotificationRow[] {
  return store.notifications.filter((alert) => alert.device_id === deviceId)
}

export function paymentsForDevice(deviceId: number): PaymentRow[] {
  return store.payments.filter((payment) => payment.device_id === deviceId)
}

/** Mirrors `Notification.objects.actives()`: anything not closed. */
export function openNotifications(): NotificationRow[] {
  return store.notifications.filter((alert) => alert.status !== CLOSED)
}
