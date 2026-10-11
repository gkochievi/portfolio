/** Edge PBX extensions (5000-5999), reserved numbers, locks and the provisioning audit log. */
import type { Extension, ExtensionAction, ExtensionActivity } from '@/types'
import { roster, PERSONA_NAMES } from './contactCentre'
import { ANCHOR_MS, DAY, MINUTE, iso, peopleStream, rngFor } from './util'

const rng = rngFor(5)

export const reservedExtensions = ['5000', '5100', '5111', '5200', '5555', '5999']

const SECRET_WORDS = [
  'linden', 'walnut', 'quince', 'cedar', 'hazel', 'juniper', 'alder', 'willow', 'plum', 'fig',
  'chestnut', 'poplar', 'aspen', 'laurel', 'maple', 'birch', 'acorn', 'thyme', 'tarragon', 'saffron',
]

export const fakeSecret = (): string => `${rng.pick(SECRET_WORDS)}-${rng.int(1000, 9999)}`

/** Shared desk phones and rooms: functional names rather than people. */
const FUNCTIONAL: Record<string, [string, string]> = {
  '5001': ['Kutaisi Front Desk', 'kutaisi.frontdesk'],
  '5002': ['Kutaisi Claims Counter', 'kutaisi.claims'],
  '5101': ['Batumi Front Desk', 'batumi.frontdesk'],
  '5102': ['Batumi Claims Counter', 'batumi.claims'],
  '5150': ['Batumi Meeting Room', 'batumi.meeting'],
  '5201': ['Rustavi Back Office Desk', 'rustavi.backoffice'],
  '5060': ['Kutaisi Meeting Room', 'kutaisi.meeting'],
}

const branchAgents = roster.filter((a) => a.extension.startsWith('5'))

function pickNumbers(): string[] {
  // The newest numbers set "next free" (5240); keep the top of the range dense so it reads naturally.
  const required = new Set<string>([
    ...branchAgents.map((a) => a.extension),
    ...Object.keys(FUNCTIONAL),
    '5104',
    '5110',
    '5237',
    '5238',
    '5239',
  ])
  const candidates: string[] = []
  for (let n = 5001; n <= 5240; n++) {
    const s = String(n)
    if (!reservedExtensions.includes(s) && !required.has(s)) candidates.push(s)
  }
  const picked = new Set(required)
  for (const s of rng.shuffle(candidates)) {
    if (picked.size >= 120) break
    picked.add(s)
  }
  return [...picked].sort()
}

const CREATORS: [string, number][] = [
  ['salome.shengelia', 10],
  ['irakli.tabatadze', 5],
  ['giorgi.beridze', 2],
  ['ana.lomidze', 1],
]

/** Skewed towards the present: most provisioning is recent. */
const recentDaysAgo = (span: number): number => Math.pow(rng.next(), 2) * span

function buildExtensions(): Extension[] {
  const numbers = pickNumbers()
  const nextPerson = peopleStream(rng, PERSONA_NAMES)
  const byExt = new Map(branchAgents.map((a) => [a.extension, a]))
  // 85 provisioned 5 months to 2 years ago, 35 in the last 150 days (oldest first).
  const older = Array.from({ length: 85 }, () => ANCHOR_MS - (150 + rng.next() * 580) * DAY).sort((a, b) => a - b)
  const recent = Array.from({ length: 35 }, () => ANCHOR_MS - recentDaysAgo(150) * DAY - rng.int(10, 600) * MINUTE).sort((a, b) => a - b)
  const times = [...older, ...recent]
  return numbers.map((number, i) => {
    const functional = FUNCTIONAL[number]
    const agent = byExt.get(number)
    let name: string
    let local: string
    if (functional) [name, local] = functional
    else if (agent) {
      name = `${agent.firstName} ${agent.lastName}`
      local = `${agent.firstName}.${agent.lastName}`.toLowerCase()
    } else {
      const p = nextPerson()
      name = `${p.first} ${p.last}`
      local = p.username
    }
    return {
      id: number,
      number,
      name,
      email: `${local}@bani.example`,
      secret: fakeSecret(),
      createdBy: rng.weighted(CREATORS),
      createdAt: iso(times[i] ?? ANCHOR_MS - DAY),
    }
  })
}

export const extensions: Extension[] = buildExtensions()

/* ------------------------------------------------------------- activity */

function buildActivity(): ExtensionActivity[] {
  const rows: Omit<ExtensionActivity, 'id'>[] = []
  const push = (username: string, action: ExtensionAction, details: string, at: number) =>
    rows.push({ username, action, details, createdAt: iso(Math.min(at, ANCHOR_MS - MINUTE)) })

  const windowStart = ANCHOR_MS - 150 * DAY
  // Every extension created inside the 150-day window: start, then finish.
  for (const ext of extensions) {
    const at = Date.parse(ext.createdAt)
    if (at < windowStart) continue
    const started = at - rng.int(90, 420) * 1000
    push(ext.createdBy, 'create_start', `Reserved ${ext.number} (lock 10 min)`, started)
    push(ext.createdBy, 'create_finish', `Created ${ext.number} for ${ext.email}`, at)
  }
  const someone = () => rng.weighted(CREATORS)
  const someNumber = () => String(rng.int(5005, 5236))
  // Reservations released without creating anything.
  for (let i = 0; i < 25; i++) {
    const at = ANCHOR_MS - recentDaysAgo(150) * DAY - rng.int(30, 600) * MINUTE
    const user = someone()
    const n = someNumber()
    push(user, 'create_start', `Reserved ${n} (lock 10 min)`, at)
    const expired = rng.chance(0.35)
    push(
      user,
      'create_abort',
      expired ? `Lock on ${n} expired after 10 min, released` : `Released ${n} without creating`,
      at + (expired ? 10 * MINUTE : rng.int(40, 300) * 1000),
    )
  }
  // Failed creates: duplicate email or an empty secret.
  for (let i = 0; i < 10; i++) {
    const at = ANCHOR_MS - recentDaysAgo(150) * DAY - rng.int(30, 600) * MINUTE
    const user = someone()
    const n = someNumber()
    const existing = rng.pick(extensions)
    push(user, 'create_start', `Reserved ${n} (lock 10 min)`, at)
    push(
      user,
      'create_error',
      rng.chance(0.7)
        ? `Create failed for ${n}: ${existing.email} already has extension ${existing.number}`
        : `Create failed for ${n}: secret is empty`,
      at + rng.int(60, 240) * 1000,
    )
  }
  // The tab went to the background while a lock was held.
  for (let i = 0; i < 8; i++) {
    const at = ANCHOR_MS - recentDaysAgo(120) * DAY - rng.int(30, 600) * MINUTE
    push(someone(), 'disconnect', `Tab hidden while holding ${someNumber()} (lock kept until expiry)`, at)
  }
  push('giorgi.beridze', 'purge_logs', 'Purged 214 entries older than 90 days', ANCHOR_MS - 118 * DAY - 3 * 3_600_000)

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map((row, i) => ({ id: `xa-${1000 + rows.length - i}`, ...row }))
}

export const extensionActivity: ExtensionActivity[] = buildActivity()

/** Lookup for call legs: extension number → display name. */
export const extensionName = new Map(extensions.map((e) => [e.number, e.name]))
