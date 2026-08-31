/**
 * The three record lists: photos, notifications and payment sessions.
 *
 * A port of `PhotoViewSet`, `NotificationViewSet` and `PaymentSessionViewSet`.
 * Each one is a filtered queryset plus a couple of actions, so the shape here
 * is the same three times: build the rows the way `get_queryset()` does, then
 * page, serialize or aggregate them.
 *
 * The two download routes resolve to a `PhotoArchive` — `{blob, filename,
 * count}` — rather than a `Response`: it carries exactly what the Django
 * download carried in its body, its `Content-Disposition` and its
 * `X-Photo-Count`, which is what `lib/api.ts::download()` reads back.
 *
 * The write routes Django refuses — creating a photo or an alert from the
 * console — are simply not registered; the router answers an unmatched method
 * on a matched path with a 405 on its own.
 */
import type { AppNotification, NotificationStatus, Page, PaymentSession, PaymentSummary, Photo } from '@/types'

import { applyDateRange, applyOrdering, applyRelationFilter, applySearch, paginate, type OrderKey } from '@/demo/query'
import { DemoApiError, notFound, register, type DemoParams } from '@/demo/router'
import {
  roundHalfEven,
  serializeNotification,
  serializePaymentSession,
  serializePhoto,
} from '@/demo/serialize'
import {
  campaignById,
  deviceById,
  store,
  type NotificationRow,
  type PaymentRow,
  type PhotoRow,
} from '@/demo/store'
import { buildPhotosZip, type PhotoSource } from '@/demo/zip'

const GALLERY_PAGE_SIZE = 60
const COMPACT_PAGE_SIZE = 50
const NOTIFICATION_STATUSES: NotificationStatus[] = [1, 2, 3]
const UNREAD: NotificationStatus = 2
const READ: NotificationStatus = 1

/** `-timestamp` and friends: newest first, ties left in seed order. */
function newestFirst<T>(rows: T[], at: (row: T) => string): T[] {
  return [...rows].sort((left, right) => Date.parse(at(right)) - Date.parse(at(left)))
}

/** DRF's `get_object_or_404`, whose 404 the exception handler flattens to the
 *  generic detail rather than naming the model. */
function byId<T extends { id: number }>(rows: T[], raw: string): T {
  const id = Number(raw)
  const row = Number.isInteger(id) ? rows.find((entry) => entry.id === id) : undefined
  if (!row) throw notFound()
  return row
}

/** `PhotoIdsSerializer`: a non-empty list of integers. */
function readIds(body: unknown): number[] {
  const raw = (body as { ids?: unknown } | null | undefined)?.ids
  if (raw === undefined || raw === null) {
    throw DemoApiError.validation({ ids: 'This field is required.' })
  }
  if (!Array.isArray(raw)) {
    throw DemoApiError.validation({ ids: `Expected a list of items but got type "${typeof raw}".` })
  }
  if (raw.length === 0) {
    throw DemoApiError.validation({ ids: 'This list may not be empty.' })
  }

  const ids = raw.map((value) => Number(value))
  if (ids.some((id) => !Number.isInteger(id))) {
    throw DemoApiError.validation({ ids: 'A valid integer is required.' })
  }
  return ids
}

// --------------------------------------------------------------------------- //
//  Photos
// --------------------------------------------------------------------------- //

function photoQueryset(params: DemoParams): PhotoRow[] {
  let rows: PhotoRow[] = store.photos
  rows = applyRelationFilter(rows, params, 'device', {
    pk: (row) => row.device_id,
    slug: (row) => deviceById(row.device_id)?.device_id,
  })
  rows = applyRelationFilter(rows, params, 'campaign', { pk: (row) => row.campaign_id })
  rows = applyDateRange(rows, params, (row) => row.timestamp)
  rows = applySearch(rows, params, [
    (row) => row.photo_code,
    (row) => deviceById(row.device_id)?.name,
    (row) => campaignById(row.campaign_id)?.name,
  ])
  return newestFirst(rows, (row) => row.timestamp)
}

/** The media URL is `serialize.ts`'s business; ask it rather than rebuilding
 *  the path a second time here. */
function archiveSources(rows: PhotoRow[]): PhotoSource[] {
  return rows.map((row) => ({
    url: serializePhoto(row).photo_url,
    file: row.file,
    timestamp: row.timestamp,
  }))
}

register('GET', '/photos/', (request): Page<Photo> =>
  paginate(photoQueryset(request.params), request.params, GALLERY_PAGE_SIZE, serializePhoto))

register('DELETE', '/photos/:id/', (request) => {
  const photo = byId(store.photos, request.path.id)
  store.photos.splice(store.photos.indexOf(photo), 1)
  // Nothing to return: the router reads `undefined` as a 204.
})

register('POST', '/photos/bulk-delete/', (request) => {
  const ids = new Set(readIds(request.body))
  const kept = store.photos.filter((photo) => !ids.has(photo.id))
  const deleted = store.photos.length - kept.length
  store.photos.splice(0, store.photos.length, ...kept)
  return { deleted }
})

register('POST', '/photos/download/', (request) => {
  const ids = new Set(readIds(request.body))
  const rows = newestFirst(
    store.photos.filter((photo) => ids.has(photo.id)),
    (photo) => photo.timestamp,
  )
  return buildPhotosZip(archiveSources(rows), 'selected')
})

register('GET', '/photos/download-all/', (request) =>
  buildPhotosZip(archiveSources(photoQueryset(request.params)), 'photos'))

// --------------------------------------------------------------------------- //
//  Notifications
// --------------------------------------------------------------------------- //

function notificationQueryset(params: DemoParams): NotificationRow[] {
  let rows: NotificationRow[] = store.notifications
  rows = applyRelationFilter(rows, params, 'device', {
    pk: (row) => row.device_id,
    slug: (row) => deviceById(row.device_id)?.device_id,
  })
  rows = applyRelationFilter(rows, params, 'campaign', { pk: (row) => row.campaign_id })
  rows = applyDateRange(rows, params, (row) => row.timestamp)

  // Django only filters on a status that is all digits; anything else is a
  // malformed query string, not an empty result.
  const status = (params.status ?? '').trim()
  if (/^\d+$/.test(status)) rows = rows.filter((row) => row.status === Number(status))

  return newestFirst(rows, (row) => row.timestamp)
}

register('GET', '/notifications/', (request): Page<AppNotification> =>
  paginate(notificationQueryset(request.params), request.params, COMPACT_PAGE_SIZE, serializeNotification))

register('PATCH', '/notifications/:id/', (request): AppNotification => {
  const alert = byId(store.notifications, request.path.id)
  const submitted = (request.body as { status?: unknown } | null | undefined)?.status

  // `status` is the only writable field; the rest of the row is read-only, so
  // a PATCH without it is a no-op that still echoes the object back.
  if (submitted !== undefined) {
    const status = Number(submitted) as NotificationStatus
    if (!NOTIFICATION_STATUSES.includes(status)) {
      throw DemoApiError.validation({ status: `"${String(submitted)}" is not a valid choice.` })
    }
    alert.status = status
  }
  return serializeNotification(alert)
})

register('GET', '/notifications/unread-count/', () => ({
  unread: store.notifications.filter((alert) => alert.status === UNREAD).length,
}))

register('POST', '/notifications/mark-all-read/', () => {
  let updated = 0
  for (const alert of store.notifications) {
    if (alert.status !== UNREAD) continue
    alert.status = READ
    updated += 1
  }
  return { updated }
})

// --------------------------------------------------------------------------- //
//  Payment sessions
// --------------------------------------------------------------------------- //

/** `amount` is a decimal string, so it has to sort numerically to match the
 *  database; a null amount sorts first, the way the ORM leaves it. */
const PAYMENT_ORDERING: Record<string, OrderKey<PaymentRow>> = {
  created_at: (row) => Date.parse(row.created_at),
  updated_at: (row) => Date.parse(row.updated_at),
  amount: (row) => (row.amount == null ? null : Number(row.amount)),
  status: (row) => row.status,
}

function paymentQueryset(params: DemoParams): PaymentRow[] {
  let rows: PaymentRow[] = store.payments
  rows = applyRelationFilter(rows, params, 'device', {
    pk: (row) => row.device_id,
    slug: (row) => deviceById(row.device_id)?.device_id,
  })
  rows = applyDateRange(rows, params, (row) => row.created_at)
  rows = applySearch(rows, params, [
    (row) => row.payment_id,
    (row) => deviceById(row.device_id)?.name,
    (row) => deviceById(row.device_id)?.device_id,
  ])

  const status = (params.status ?? '').trim()
  if (status) rows = rows.filter((row) => row.status === status)

  return applyOrdering(rows, params, PAYMENT_ORDERING, '-created_at')
}

register('GET', '/payment-sessions/', (request): Page<PaymentSession> =>
  paginate(paymentQueryset(request.params), request.params, COMPACT_PAGE_SIZE, serializePaymentSession))

register('GET', '/payment-sessions/summary/', (request): PaymentSummary => {
  const rows = paymentQueryset(request.params)
  const count = (status: string) => rows.filter((row) => row.status === status).length

  const succeeded = count('success')
  const revenue = rows.reduce(
    (total, row) => (row.status === 'success' ? total + Number(row.amount ?? 0) : total),
    0,
  )

  return {
    total: rows.length,
    succeeded,
    rejected: count('rejected'),
    started: count('started'),
    // `Sum(...)` over no rows is NULL, which the view reports as a flat 0.
    revenue: Math.round(revenue * 100) / 100,
    success_rate: rows.length ? roundHalfEven((succeeded / rows.length) * 100, 1) : 0,
  }
})
