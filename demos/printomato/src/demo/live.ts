/**
 * The fleet, still moving.
 *
 * `lib/socket.ts` subscribes here instead of opening a websocket, and this
 * module plays the part of the Channels layer: it emits the same payloads
 * `core/consumers.py` pushed on `/ws/fleet/` and `/ws/notifications/`, and —
 * crucially — it makes the same changes to the store that the real fleet made
 * to Postgres. A print that only lit up a toast would be a lie; this one adds a
 * photo row and takes a sheet of paper, so the queries AppShell invalidates
 * come back with something new in them.
 *
 * The device command handler reboots a kiosk without knowing this module
 * exists; it takes an emitter instead, and `start()` hands it one, so a restart
 * shows up on the fleet socket like any other presence change.
 *
 * Everything is teardown-safe: the scheduler only runs while something is
 * subscribed, pauses while the tab is hidden, and leaves no timer behind.
 */
import { connectFleetSignals } from '@/demo/handlers/fleet'
import { serializeNotification } from '@/demo/serialize'
import {
  campaignById,
  nextId,
  photosForCampaign,
  photosForDevice,
  store,
} from '@/demo/store'
import type { DeviceRow, NotificationRow, PhotoRow } from '@/demo/store'

const FLEET = '/ws/fleet/'
const NOTIFICATIONS = '/ws/notifications/'

const UNREAD = 2

type Handler = (message: unknown) => void

const channels = new Map<string, Set<Handler>>()

/** Subscribe to one channel; the returned function detaches it again. */
export function subscribe(path: string, handler: Handler): () => void {
  let listeners = channels.get(path)
  if (!listeners) {
    listeners = new Set()
    channels.set(path, listeners)
  }
  listeners.add(handler)
  start()

  return () => {
    listeners.delete(handler)
    if (listeners.size === 0) channels.delete(path)
    if (channels.size === 0) stop()
  }
}

function emit(path: string, message: unknown): void {
  const listeners = channels.get(path)
  if (!listeners) return
  // Copy first: a handler is free to unsubscribe while being called.
  for (const handler of [...listeners]) handler(message)
}

// --------------------------------------------------------------------------- //
//  Scheduler
//
//  Paced for a demo rather than a stress test: a print often enough to notice,
//  a presence flip now and then, an alert rarely enough to stay interesting.
// --------------------------------------------------------------------------- //

interface Loop {
  every: readonly [number, number]
  run: () => void
  timer: number | null
}

const loops: Loop[] = [
  { every: [12_000, 25_000], run: printOne, timer: null },
  { every: [45_000, 90_000], run: flipPresence, timer: null },
  { every: [110_000, 190_000], run: raiseAlert, timer: null },
]

let running = false

function start(): void {
  if (running) return
  running = true
  // A reboot the operator triggered is a presence change like any other; the
  // command handler cannot reach this channel on its own.
  connectFleetSignals({ presence: announcePresence })
  document.addEventListener('visibilitychange', onVisibility)
  resume()
}

function stop(): void {
  running = false
  connectFleetSignals(null)
  document.removeEventListener('visibilitychange', onVisibility)
  pause()
}

function onVisibility(): void {
  if (document.hidden) pause()
  else resume()
}

/** A hidden tab burns nothing: the fleet simply freezes where it stands. */
function pause(): void {
  for (const loop of loops) {
    if (loop.timer !== null) window.clearTimeout(loop.timer)
    loop.timer = null
  }
}

function resume(): void {
  if (!running || document.hidden) return
  for (const loop of loops) {
    if (loop.timer === null) schedule(loop)
  }
}

function schedule(loop: Loop): void {
  const [min, max] = loop.every
  loop.timer = window.setTimeout(() => {
    loop.timer = null
    if (!running || document.hidden) return
    loop.run()
    schedule(loop)
  }, between(min, max))
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pick<T>(rows: T[]): T | undefined {
  return rows.length ? rows[Math.floor(Math.random() * rows.length)] : undefined
}

// --------------------------------------------------------------------------- //
//  Events
// --------------------------------------------------------------------------- //

/**
 * A kiosk prints. Mirrors `on_photo_save` in core/models.py: the photo lands,
 * the device loses a sheet and the campaign loses one of its paid-for prints.
 * The image is an existing media file — the demo ships 98 of them and cannot
 * invent a 99th.
 */
function printOne(): void {
  const device = pick(
    store.devices.filter(
      (row) =>
        // `Photo.campaign` is a non-nullable FK, so a kiosk with nothing
        // running on it has nothing to print under and is skipped.
        row.is_online && row.is_active && row.paper_count > 0 && row.campaign_ids.length > 0,
    ),
  )
  if (!device) return

  const campaignId = pick(device.campaign_ids)
  if (campaignId === undefined) return

  const source =
    pick(photosForDevice(device.id)) ?? pick(photosForCampaign(campaignId)) ?? pick(store.photos)
  if (!source) return

  const photo: PhotoRow = {
    id: nextId('photos'),
    file: source.file,
    stem: source.stem,
    photo_code: printCode(source.photo_code),
    timestamp: new Date().toISOString(),
    device_id: device.id,
    campaign_id: campaignId,
  }
  store.photos.push(photo)

  device.paper_count -= 1
  const campaign = campaignById(campaignId)
  if (campaign && campaign.photo_quantity > 0) campaign.photo_quantity -= 1

  emit(FLEET, {
    type: 'device.print',
    device_id: device.device_id,
    paper_count: device.paper_count,
    photo_id: photo.id,
    campaign_id: photo.campaign_id,
  })
}

/** Keeps the campaign's code prefix; the seed never uses the 9xxx block, so a
 *  live print cannot collide with one that was seeded. */
function printCode(source: string | null): string {
  const prefix = source?.split('-')[0] || 'PMT'
  return `${prefix}-9${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
}

/**
 * One kiosk changes presence. Recovery is favoured over dropouts, otherwise a
 * long session drifts into a fleet that is entirely dark.
 */
function flipPresence(): void {
  const fleet = store.devices.filter((row) => row.is_active)
  const down = fleet.filter((row) => !row.is_online)
  const up = fleet.filter((row) => row.is_online)

  const recover = down.length > 0 && (down.length >= fleet.length / 3 || Math.random() < 0.55)
  const device = pick(recover ? down : up)
  if (!device) return

  setPresence(device, recover)
}

function setPresence(device: DeviceRow, online: boolean): void {
  device.is_online = online
  announcePresence(device)
}

/** Broadcast a device's current presence — also the emitter the command handler
 *  is given, which flips the row itself before calling. */
function announcePresence(device: DeviceRow): void {
  emit(FLEET, {
    type: 'device.presence',
    device_id: device.device_id,
    is_online: device.is_online,
  })
}

/**
 * A kiosk raises an alert. The toast AppShell renders reads `message` as text,
 * which is what the device API's serializer put on the wire — the label, not
 * the enum value.
 */
function raiseAlert(): void {
  // A kiosk that is off the fleet has no way to report anything.
  const device = pick(store.devices.filter((row) => row.is_active && row.is_online))
  if (!device) return

  const row: NotificationRow = {
    id: nextId('notifications'),
    device_id: device.id,
    campaign_id: device.campaign_ids[0] ?? null,
    // 1 camera not found, 2 printer not found — the only two a kiosk reports.
    message: Math.random() < 0.5 ? 1 : 2,
    status: UNREAD,
    timestamp: new Date().toISOString(),
  }
  store.notifications.push(row)

  const alert = serializeNotification(row)
  emit(NOTIFICATIONS, { ...alert, message: alert.message_display })
}
