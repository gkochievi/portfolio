/**
 * Mock API + simulators for the "extensions" feature group (see PLAN section 6).
 * Import store/api/bus helpers from '../core' only.
 *
 * Edge PBX extension provisioning: reserve the next free number behind a 10-minute lock,
 * create it with a secret, and audit every step. Lock state lives in the store only, so a
 * reload restores the pristine seed (no locks).
 *
 * Validation messages are short codes (`required`, `invalid_email`, `duplicate_email:5104`)
 * that the UI translates; anything it does not recognise is shown as is.
 */
import { DemoApiError, every, forbidden } from '@portfolio/demo-kit'

import { canSeeExtensionActivity } from '@/lib/rbac'
import type {
  CreateExtensionRequest,
  Extension,
  ExtensionAction,
  ExtensionActivity,
  ExtensionLock,
  NextExtensionResponse,
} from '@/types'
import { api, bus, nowIso, requireFeature, store } from '../core'

const RANGE_FROM = 5000
const RANGE_TO = 5999
const LOCK_TTL_MS = 10 * 60 * 1000
const PURGE_AFTER_MS = 90 * 24 * 60 * 60 * 1000
const BEACON_DEDUPE_MS = 8_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let activitySeq = 0
let sweeperStarted = false
const lastBeacon = new Map<string, number>()

/* ------------------------------------------------------------------ helpers */

function log(username: string, action: ExtensionAction, details: string): ExtensionActivity {
  activitySeq += 1
  const row: ExtensionActivity = {
    id: `xa-live-${Date.now().toString(36)}-${activitySeq}`,
    username,
    action,
    details,
    createdAt: nowIso(),
  }
  store.data.extensionActivity.unshift(row)
  bus.emit('extensions:activity', row)
  return row
}

/** Drop expired locks and log each as an abort. Returns true when something was released. */
function sweepLocks(): boolean {
  const now = Date.now()
  const locks = store.data.extensionLocks
  const expired = locks.filter((l) => Date.parse(l.expiresAt) <= now)
  if (expired.length === 0) return false
  store.data.extensionLocks = locks.filter((l) => Date.parse(l.expiresAt) > now)
  for (const lock of expired) {
    log(lock.username, 'create_abort', `Lock on ${lock.extension} expired after 10 min, released`)
    lastBeacon.delete(lock.id)
  }
  return true
}

function sweepAndNotify(): void {
  if (sweepLocks()) bus.emit('extensions:changed')
}

function takenNumbers(): Set<number> {
  const taken = new Set<number>()
  for (const e of store.data.extensions) taken.add(Number(e.number))
  for (const r of store.data.reservedExtensions) taken.add(Number(r))
  for (const l of store.data.extensionLocks) taken.add(Number(l.extension))
  return taken
}

/** Lowest free number above the current maximum (skipping reserved and locked ones); wraps to the lowest gap. */
function nextFree(): string | null {
  const taken = takenNumbers()
  const max = Math.max(RANGE_FROM - 1, ...store.data.extensions.map((e) => Number(e.number)))
  for (let n = max + 1; n <= RANGE_TO; n++) if (!taken.has(n)) return String(n)
  for (let n = RANGE_FROM; n <= RANGE_TO; n++) if (!taken.has(n)) return String(n)
  return null
}

function lockOf(username: string): ExtensionLock | undefined {
  return store.data.extensionLocks.find((l) => l.username === username)
}

function emailToName(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  const base = at >= 0 ? trimmed.slice(0, at) : trimmed
  return base.replace(/[^a-zA-Z0-9._-]+/g, '') || base || 'user'
}

function requireActivityAccess() {
  const persona = requireFeature('extensions')
  if (!canSeeExtensionActivity(persona.role)) throw forbidden()
  return persona
}

/* ----------------------------------------------------------------- register */

export function register(): void {
  api.register('GET', '/extensions', () => {
    requireFeature('extensions')
    sweepAndNotify()
    return [...store.data.extensions].sort((a, b) => Number(a.number) - Number(b.number))
  })

  api.register('GET', '/extensions/next', (): NextExtensionResponse => {
    requireFeature('extensions')
    sweepAndNotify()
    const next = nextFree()
    if (!next) throw new DemoApiError(409, 'No free extension numbers left in the range.')
    return {
      next,
      reserved: [...store.data.reservedExtensions],
      range: { from: String(RANGE_FROM), to: String(RANGE_TO) },
    }
  })

  api.register('GET', '/extensions/lock', (): ExtensionLock | null => {
    const persona = requireFeature('extensions')
    sweepAndNotify()
    return lockOf(persona.username) ?? null
  })

  api.register('POST', '/extensions/lock', (): ExtensionLock => {
    const persona = requireFeature('extensions')
    sweepAndNotify()
    const existing = lockOf(persona.username)
    if (existing) return existing
    const number = nextFree()
    if (!number) throw new DemoApiError(409, 'No free extension numbers left in the range.')
    const now = Date.now()
    const lock: ExtensionLock = {
      id: store.nextId('xl-'),
      extension: number,
      username: persona.username,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + LOCK_TTL_MS).toISOString(),
    }
    store.data.extensionLocks.push(lock)
    log(persona.username, 'create_start', `Reserved ${number} (lock 10 min)`)
    bus.emit('extensions:changed')
    return lock
  })

  api.register('DELETE', '/extensions/lock', () => {
    const persona = requireFeature('extensions')
    sweepAndNotify()
    const lock = lockOf(persona.username)
    if (!lock) return undefined
    store.data.extensionLocks = store.data.extensionLocks.filter((l) => l.id !== lock.id)
    lastBeacon.delete(lock.id)
    log(persona.username, 'create_abort', `Released ${lock.extension} without creating`)
    bus.emit('extensions:changed')
    return undefined
  })

  api.register('POST', '/extensions', (req): Extension => {
    const persona = requireFeature('extensions')
    sweepAndNotify()
    const input = (req.body ?? {}) as Partial<CreateExtensionRequest>
    const lock = lockOf(persona.username)
    if (!lock) throw new DemoApiError(409, 'no_reservation')

    const email = (input.email ?? '').trim()
    const secret = (input.secret ?? '').trim()
    const errors: Record<string, string> = {}
    if (!email) errors.email = 'required'
    else if (!EMAIL_RE.test(email)) errors.email = 'invalid_email'
    else {
      const clash = store.data.extensions.find((e) => e.email.toLowerCase() === email.toLowerCase())
      if (clash) errors.email = `duplicate_email:${clash.number}`
    }
    if (!secret) errors.secret = 'required'

    if (Object.keys(errors).length > 0) {
      const reason = errors.secret && !errors.email ? 'secret is empty' : errors.email?.startsWith('duplicate_email')
        ? `${email} already has extension ${errors.email.split(':')[1]}`
        : errors.email === 'required'
          ? 'email is empty'
          : 'email is not valid'
      log(persona.username, 'create_error', `Create failed for ${lock.extension}: ${reason}`)
      throw DemoApiError.validation(errors)
    }

    const created: Extension = {
      id: lock.extension,
      number: lock.extension,
      name: (input.name ?? '').trim() || emailToName(email),
      email,
      secret,
      createdBy: persona.username,
      createdAt: nowIso(),
    }
    store.data.extensions.push(created)
    store.data.extensionLocks = store.data.extensionLocks.filter((l) => l.id !== lock.id)
    lastBeacon.delete(lock.id)
    log(persona.username, 'create_finish', `Created ${created.number} for ${email}`)
    bus.emit('extensions:changed')
    return created
  })

  api.register('POST', '/extensions/beacon', () => {
    const persona = requireFeature('extensions')
    sweepAndNotify()
    const lock = lockOf(persona.username)
    if (!lock) return undefined
    const now = Date.now()
    if (now - (lastBeacon.get(lock.id) ?? 0) < BEACON_DEDUPE_MS) return undefined
    lastBeacon.set(lock.id, now)
    log(persona.username, 'disconnect', `Tab hidden while holding ${lock.extension} (lock kept until expiry)`)
    return undefined
  })

  api.register('GET', '/extensions/activity', (): ExtensionActivity[] => {
    requireActivityAccess()
    sweepAndNotify()
    return [...store.data.extensionActivity].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  api.register('POST', '/extensions/activity/purge', (): { deleted: number } => {
    const persona = requireActivityAccess()
    const cutoff = Date.now() - PURGE_AFTER_MS
    const before = store.data.extensionActivity.length
    store.data.extensionActivity = store.data.extensionActivity.filter((r) => Date.parse(r.createdAt) >= cutoff)
    const deleted = before - store.data.extensionActivity.length
    log(persona.username, 'purge_logs', `Purged ${deleted} entries older than 90 days`)
    return { deleted }
  })

  // Simulator: expired locks are released (and logged) even if nobody is looking at the page.
  if (!sweeperStarted) {
    sweeperStarted = true
    every(15_000, sweepAndNotify)
  }
  bus.on('demo:reset', () => {
    lastBeacon.clear()
  })
}
