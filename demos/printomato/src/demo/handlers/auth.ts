/**
 * `/auth/*`, `/options/` and `/dashboard/` — a port of the auth views,
 * `OptionsView` and `DashboardView` in `core/admin_api/views.py`.
 *
 * The auth endpoints are the one place where the mock has to imitate DRF's
 * *serializers* rather than its querysets, because the login, profile and
 * password forms all render field errors inline. So the field helpers below
 * carry DRF's own messages, and `passwordProblems()` carries Django's: an
 * operator who types a short password should read exactly what the real
 * console would have told them.
 *
 * `register()` treats everything under `/auth/` as anonymous, which is right
 * for login and the CSRF probe and wrong for the four views that extend
 * `AdminAPIViewMixin`; those opt back in with `AUTHENTICATED`.
 */
import type { ActivityPoint, Analytics, Dashboard, Options } from '@/types'

import { DemoApiError, register, type FieldErrors } from '@/demo/router'
import {
  NOTIFICATION_MESSAGE_CHOICES,
  NOTIFICATION_STATUS_CHOICES,
  PAYMENT_STATUS_CHOICES,
  campaignState,
  serializeCampaign,
  serializeCampaignRef,
  serializeDevice,
  serializeDeviceRef,
  serializeNotification,
  serializeUser,
  sortDevicesNaturally,
} from '@/demo/serialize'
import {
  campaignsForDevice,
  localDateKey,
  openNotifications,
  setSignedIn,
  shiftDayKey,
  store,
  todayKey,
  type UserRow,
} from '@/demo/store'

/** `IsAuthenticated`, which the router would otherwise skip under `/auth/`. */
const AUTHENTICATED = { requiresAuth: true }

// --------------------------------------------------------------------------- //
//  Serializer field helpers
//
//  Enough of `serializers.CharField` to produce the errors the forms render.
//  Absent and rejected both read as `undefined`, so a caller can tell "leave
//  this field alone" from "this field was set" only when `errors` stays empty
//  — which is exactly when a DRF serializer would have reached `save()`.
// --------------------------------------------------------------------------- //

interface CharFieldOptions {
  required?: boolean
  allowBlank?: boolean
  /** CharField trims by default; the password fields set `trim_whitespace=False`. */
  trim?: boolean
  maxLength?: number
}

/** A serializer is handed a dict; anything else supplies no fields at all. */
function fieldsOf(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
}

function charField(
  data: Record<string, unknown>,
  name: string,
  errors: FieldErrors,
  options: CharFieldOptions = {},
): string | undefined {
  const { required = true, allowBlank = false, trim = true, maxLength } = options
  const raw = data[name]

  if (raw === undefined) {
    if (required) errors[name] = ['This field is required.']
    return undefined
  }
  if (raw === null) {
    errors[name] = ['This field may not be null.']
    return undefined
  }

  const value = trim ? String(raw).trim() : String(raw)
  if (!value && !allowBlank) {
    errors[name] = ['This field may not be blank.']
    return undefined
  }
  if (maxLength !== undefined && value.length > maxLength) {
    errors[name] = [`Ensure this field has no more than ${maxLength} characters.`]
    return undefined
  }
  return value
}

function raiseIfInvalid(errors: FieldErrors): void {
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

// --------------------------------------------------------------------------- //
//  Password strength
//
//  A stand-in for `validate_password()` under the project's four configured
//  validators (settings.py: similarity, minimum length, common, numeric). Every
//  failing validator contributes a message in that order, the way Django
//  collects them, and the wording is Django's.
// --------------------------------------------------------------------------- //

const MIN_PASSWORD_LENGTH = 8
const MAX_SIMILARITY = 0.7

/** A slice of Django's 20k list — enough that an obvious choice is caught. */
const COMMON_PASSWORDS = new Set([
  '123456', '12345678', '123456789', 'password', 'password1', 'passw0rd',
  'qwerty', 'qwerty123', 'abc123', '1q2w3e4r', 'letmein', 'welcome',
  'admin', 'admin123', 'iloveyou', 'monkey', 'dragon', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'master', 'trustno1',
])

/** The attributes `UserAttributeSimilarityValidator` reads, with the verbose
 *  names it drops into the message. */
const SIMILARITY_ATTRIBUTES: [keyof Pick<UserRow, 'username' | 'first_name' | 'last_name' | 'email'>, string][] = [
  ['username', 'username'],
  ['first_name', 'first name'],
  ['last_name', 'last name'],
  ['email', 'email address'],
]

/**
 * `difflib.SequenceMatcher.quick_ratio()`: twice the size of the character
 * multiset intersection over the combined length. Django's similarity check
 * compares against this upper bound rather than the true ratio, so porting the
 * cheap version keeps the same passwords passing.
 */
function quickRatio(left: string, right: string): number {
  if (!left.length && !right.length) return 1

  const available = new Map<string, number>()
  for (const character of right) available.set(character, (available.get(character) ?? 0) + 1)

  let matches = 0
  for (const character of left) {
    const remaining = available.get(character) ?? 0
    if (remaining > 0) {
      available.set(character, remaining - 1)
      matches += 1
    }
  }
  return (2 * matches) / (left.length + right.length)
}

function passwordProblems(password: string, user: UserRow): string[] {
  const problems: string[] = []
  const lowered = password.toLowerCase()

  for (const [attribute, label] of SIMILARITY_ATTRIBUTES) {
    const value = user[attribute]
    if (!value) continue
    // Django tests each word-ish part of the value as well as the whole of it,
    // so "gela.kochiev@…" also protects "gela".
    const parts = [...value.split(/\W+/).filter(Boolean), value]
    if (parts.some((part) => quickRatio(lowered, part.toLowerCase()) >= MAX_SIMILARITY)) {
      problems.push(`The password is too similar to the ${label}.`)
      break // The validator raises on the first attribute that matches.
    }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`This password is too short. It must contain at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (COMMON_PASSWORDS.has(lowered.trim())) problems.push('This password is too common.')
  if (/^\d+$/.test(password)) problems.push('This password is entirely numeric.')

  return problems
}

// --------------------------------------------------------------------------- //
//  Authentication
// --------------------------------------------------------------------------- //

// There is no cookie and no server to set one, but LoginPage primes CSRF before
// its first POST and a 404 there would look like a broken demo.
register('GET', '/auth/csrf/', () => ({ detail: 'CSRF cookie set' }))

register('GET', '/auth/session/', () => serializeUser(store.user), AUTHENTICATED)

register('POST', '/auth/login/', (request) => {
  const data = fieldsOf(request.body)
  const errors: FieldErrors = {}
  const username = charField(data, 'username', errors) ?? ''
  const password = charField(data, 'password', errors, { trim: false }) ?? ''
  raiseIfInvalid(errors)

  const user = store.user
  if (username !== user.username || password !== user.password) {
    // A failed `authenticate()` is a detail, not a field error, so the form
    // shows one line above both inputs rather than marking either of them.
    throw new DemoApiError(400, 'Incorrect username or password.')
  }

  // `django.contrib.auth.login()` stamps last_login through `user_logged_in`.
  user.last_login = new Date().toISOString()
  setSignedIn(true)
  return serializeUser(user)
})

register('POST', '/auth/logout/', () => {
  setSignedIn(false)
  return { detail: 'Signed out' }
}, AUTHENTICATED)

// --------------------------------------------------------------------------- //
//  Profile
// --------------------------------------------------------------------------- //

/** `UnicodeUsernameValidator`. */
const USERNAME_PATTERN = /^[\w.@+-]+$/
/** A stand-in for Django's `EmailValidator`: one @, a dotted domain, no spaces. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

register('GET', '/auth/profile/', () => serializeUser(store.user), AUTHENTICATED)

register('PATCH', '/auth/profile/', (request) => {
  const data = fieldsOf(request.body)
  const errors: FieldErrors = {}

  // `partial=True`: an absent field keeps its stored value, a present one is
  // validated as if it had been required.
  const username = charField(data, 'username', errors, { required: false, maxLength: 150 })
  const email = charField(data, 'email', errors, { required: false, allowBlank: true, maxLength: 254 })
  const firstName = charField(data, 'first_name', errors, { required: false, allowBlank: true, maxLength: 150 })
  const lastName = charField(data, 'last_name', errors, { required: false, allowBlank: true, maxLength: 150 })

  if (username !== undefined && !USERNAME_PATTERN.test(username)) {
    errors.username = [
      'Enter a valid username. This value may contain only letters, numbers, and @/./+/-/_ characters.',
    ]
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = ['Enter a valid email address.']
  }
  raiseIfInvalid(errors)

  const user = store.user
  if (username !== undefined) user.username = username
  if (email !== undefined) user.email = email
  if (firstName !== undefined) user.first_name = firstName
  if (lastName !== undefined) user.last_name = lastName

  return serializeUser(user)
}, AUTHENTICATED)

register('POST', '/auth/password/', (request) => {
  const data = fieldsOf(request.body)
  const errors: FieldErrors = {}
  const unTrimmed = { trim: false }
  const oldPassword = charField(data, 'old_password', errors, unTrimmed) ?? ''
  const newPassword1 = charField(data, 'new_password1', errors, unTrimmed) ?? ''
  const newPassword2 = charField(data, 'new_password2', errors, unTrimmed) ?? ''

  const user = store.user
  // `validate_old_password` is a field validator, so DRF reports it alone and
  // never reaches the match or strength checks below.
  if (!errors.old_password && oldPassword !== user.password) {
    errors.old_password = ['Your current password was entered incorrectly.']
  }
  raiseIfInvalid(errors)

  if (newPassword1 !== newPassword2) {
    throw DemoApiError.validation({ new_password2: 'The two password fields did not match.' })
  }
  const problems = passwordProblems(newPassword1, user)
  if (problems.length) throw DemoApiError.validation({ new_password1: problems })

  // The change is real for the rest of the session: a later login checks
  // against this. `update_session_auth_hash()` is why the operator stays in.
  user.password = newPassword1
  return { detail: 'Password updated' }
}, AUTHENTICATED)

// --------------------------------------------------------------------------- //
//  Shared lookups
// --------------------------------------------------------------------------- //

register('GET', '/options/', (): Options => ({
  devices: [...store.devices]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(serializeDeviceRef),
  campaigns: [...store.campaigns].sort((left, right) => right.id - left.id).map(serializeCampaignRef),
  notification_statuses: NOTIFICATION_STATUS_CHOICES,
  notification_messages: NOTIFICATION_MESSAGE_CHOICES,
  payment_statuses: PAYMENT_STATUS_CHOICES,
}))

// --------------------------------------------------------------------------- //
//  Dashboard
//
//  A port of `services.py::dashboard_analytics` and `print_activity_series`.
//  Two of its counters are easy to get subtly wrong: `payments_today` counts
//  only *successful* payments, because the aggregate runs on a queryset that
//  is already filtered to SUCCESS, and `low_paper_devices` counts sheets
//  (`paper_count < 25`), not the percentage the paper meter shows.
// --------------------------------------------------------------------------- //

const DEFAULT_DAYS = 14
const MIN_DAYS = 7
const MAX_DAYS = 90
const LOW_PAPER = 25
const UNREAD = 2
const RECENT_ALERTS = 12

/** `max(7, min(int(days), 90))`, with Python's ValueError path: junk means 14. */
function requestedDays(raw: string | undefined): number {
  if (!/^\s*[+-]?\d+\s*$/.test(raw ?? '')) return DEFAULT_DAYS
  return Math.max(MIN_DAYS, Math.min(Number(raw), MAX_DAYS))
}

function dayKeyBefore(days: number): string {
  return shiftDayKey(todayKey(), -days)
}

function dashboardAnalytics(now: number): Analytics {
  const today = todayKey()
  const yesterday = dayKeyBefore(1)

  let onlineDevices = 0
  let activeDevices = 0
  let paperRemaining = 0
  let paperCapacity = 0
  let lowPaperDevices = 0
  for (const device of store.devices) {
    if (device.is_online) onlineDevices += 1
    if (device.is_active) activeDevices += 1
    paperRemaining += device.paper_count
    paperCapacity += device.paper_capacity
    if (device.paper_count < LOW_PAPER) lowPaperDevices += 1
  }

  let printedToday = 0
  let printedYesterday = 0
  for (const photo of store.photos) {
    const key = localDateKey(photo.timestamp)
    if (key === today) printedToday += 1
    else if (key === yesterday) printedYesterday += 1
  }

  let revenueTotal = 0
  let revenueToday = 0
  let paymentsToday = 0
  for (const payment of store.payments) {
    if (payment.status !== 'success') continue
    // A null amount contributes nothing, the way SUM skips NULL.
    const amount = Number(payment.amount) || 0
    revenueTotal += amount
    if (localDateKey(payment.created_at) === today) {
      revenueToday += amount
      paymentsToday += 1
    }
  }

  let activeCampaigns = 0
  let upcomingCampaigns = 0
  for (const campaign of store.campaigns) {
    const state = campaignState(campaign, now)
    if (state === 'active') activeCampaigns += 1
    else if (state === 'upcoming') upcomingCampaigns += 1
  }

  return {
    online_devices: onlineDevices,
    total_devices: store.devices.length,
    active_devices: activeDevices,
    total_printed: store.photos.length,
    printed_today: printedToday,
    printed_yesterday: printedYesterday,
    paper_remaining: paperRemaining,
    paper_capacity: paperCapacity,
    active_campaigns: activeCampaigns,
    upcoming_campaigns: upcomingCampaigns,
    unread_notifications: store.notifications.filter((alert) => alert.status === UNREAD).length,
    open_notifications: openNotifications().length,
    low_paper_devices: lowPaperDevices,
    // Money crosses the wire as a fixed-point string, like every other decimal.
    revenue_total: revenueTotal.toFixed(2),
    revenue_today: revenueToday.toFixed(2),
    payments_today: paymentsToday,
  }
}

/** Daily print counts over the last `days` days, zero-filled, oldest first. */
function printActivitySeries(days: number): ActivityPoint[] {
  const counts = new Map<string, number>()
  for (const photo of store.photos) {
    const key = localDateKey(photo.timestamp)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Stepping the calendar key rather than adding milliseconds keeps the series
  // honest across a DST boundary, where a day is not 24 hours long.
  const start = shiftDayKey(todayKey(), -(days - 1))

  return Array.from({ length: days }, (_, offset) => {
    const key = shiftDayKey(start, offset)
    return { date: key, count: counts.get(key) ?? 0 }
  })
}

register('GET', '/dashboard/', (request): Dashboard => {
  const now = Date.now()

  // Only devices carrying at least one campaign, resolved through the m2m so a
  // stale id left by a deleted campaign cannot put a device on the board.
  const fleet = store.devices.filter((device) => campaignsForDevice(device).length > 0)
  const running = store.campaigns
    .filter((campaign) => campaignState(campaign, now) === 'active')
    .sort((left, right) => Date.parse(left.end_time) - Date.parse(right.end_time))
  const alerts = [...openNotifications()]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, RECENT_ALERTS)

  return {
    analytics: dashboardAnalytics(now),
    print_activity: printActivitySeries(requestedDays(request.params.days)),
    devices: sortDevicesNaturally(fleet).map(serializeDevice),
    campaigns: running.map(serializeCampaign),
    notifications: alerts.map(serializeNotification),
  }
})
