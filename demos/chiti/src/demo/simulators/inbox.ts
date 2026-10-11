/**
 * Inbox simulator (owner: inbox). Runs in the leader tab only.
 *
 * - Scripted customers: after a staff message in a seeded chat the customer
 *   waits 1.5-3 s, "types" with progressive draft substrings (typing
 *   transparency), then sends the next scripted line.
 * - Two-sided slow scripts in Mariam's chats so admin spectating is alive.
 * - Spawner: a new waiting chat every 25-40 s (cap 8 waiting), then auto-assign.
 * - Delivery ticks for staff messages: sent -> delivered (+1 s) -> read (+3 s).
 */
import type { Channel, ChitiDb, ExternalContact, FaqStep, Message } from '@/types'

import { broadcast, bus } from '../bus'
import { currentAccount } from '../context'
import { SCRIPTS, POOL, type AutoTurn, type PoolCustomer, type PoolTopic } from '../content/inbox'
import {
  autoAssign,
  createWidgetSession,
  getMessage,
  getOperator,
  handoff,
  pickContent,
  postMessage,
  setMessageStatus,
  setTyping,
} from '../engine'
import { BOT_HANDOVER_LINE } from '../seed/scripts'
import { newId, store } from '../store'

const TENANT_ID = 'ten_vazi'
const MAX_WAITING = 8

const FAQ_OPTION: Record<PoolTopic, string> = {
  delivery: 'faq_o_delivery',
  order: 'faq_o_order',
  returns: 'faq_o_returns',
  payment: 'faq_o_payment',
  other: 'faq_o_gift',
}

const timers = new Set<ReturnType<typeof setTimeout>>()
let stopped = true

function later(fn: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    if (stopped) return
    try {
      fn()
    } catch (error) {
      console.error('[chiti] inbox simulator', error)
    }
  }, ms)
  timers.add(timer)
}

const between = (min: number, max: number) => min + Math.random() * (max - min)
const hidden = () => typeof document !== 'undefined' && document.hidden
const db = (): ChitiDb => store.data

function liveSession(sessionId: string) {
  const found = db().sessions.find((row) => row.id === sessionId)
  return found && found.status !== 'ended' ? found : null
}

/* -------------------------------------------------------- customer typing */

/** The customer types `text` (live draft preview), then sends it. */
function customerSays(sessionId: string, text: string, done?: () => void): void {
  const first = liveSession(sessionId)
  if (!first) return done?.()
  const chars = Array.from(text)
  const total = Math.min(4200, Math.max(1400, chars.length * 42))
  const steps = Math.max(4, Math.round(total / 320))
  const name = first.customerName
  for (let step = 1; step <= steps; step += 1) {
    later(() => {
      if (!liveSession(sessionId)) return
      const upto = Math.ceil((chars.length * step) / steps)
      setTyping({ sessionId, who: 'customer', isTyping: true, draft: chars.slice(0, upto).join(''), name })
    }, (total / steps) * step)
  }
  later(() => {
    setTyping({ sessionId, who: 'customer', isTyping: false, draft: null, name })
    const session = liveSession(sessionId)
    if (session) {
      try {
        postMessage(sessionId, { sender: 'user', senderId: session.customerId, senderName: session.customerName, content: text })
      } catch {
        /* the chat ended in the meantime */
      }
    }
    done?.()
  }, total + 250)
}

/* ------------------------------------------------------- reactive scripts */

const reactive = new Map<string, string[]>()
const busy = new Set<string>()
const handled = new Set<string>()
const autoPosted = new Set<string>()

function onStaffMessage(message: Message): void {
  if (message.sender !== 'operator' && message.sender !== 'admin') return
  const session = liveSession(message.sessionId)
  if (!session) return
  if (message.deliveryStatus !== 'sent' || handled.has(message.id)) return
  handled.add(message.id)

  // Delivery ticks: sent -> delivered (+1 s) -> read (+3 s).
  const id = message.id
  later(() => {
    if (getMessage(id).deliveryStatus === 'sent') setMessageStatus(id, 'delivered')
  }, 1_000)
  // The visitor's own widget reports "read" itself.
  if (session.origin !== 'visitor') {
    later(() => {
      const current = getMessage(id)
      if (current.deliveryStatus === 'delivered' || current.deliveryStatus === 'sent') setMessageStatus(id, 'read')
    }, 3_000)
  }

  if (session.origin === 'visitor' || message.isAutoGreeting || autoPosted.has(id)) return
  const lines = reactive.get(session.id)
  if (!lines || lines.length === 0 || busy.has(session.id)) return
  busy.add(session.id)
  later(() => {
    const next = reactive.get(session.id)?.shift()
    if (!next) {
      busy.delete(session.id)
      return
    }
    customerSays(session.id, next, () => busy.delete(session.id))
  }, between(1_500, 3_000))
}

/* ---------------------------------------------------- two-sided slow script */

function runAutonomous(sessionId: string, turns: AutoTurn[], startMs: number): void {
  let index = 0
  const step = () => {
    const session = liveSession(sessionId)
    if (!session || index >= turns.length) return
    if (hidden() || busy.has(sessionId)) return later(step, 5_000)
    const turn = turns[index] as AutoTurn
    const operator = getOperator(session.operatorId)
    if (turn.who === 'o') {
      // A person is driving this operator: stop playing their side.
      if (!operator || currentAccount()?.staffId === operator.id) return
      if (session.adminInterventionActive) return later(step, 8_000)
      try {
        const posted = postMessage(sessionId, { sender: 'operator', senderId: operator.id, senderName: operator.nickname, content: turn.text })
        autoPosted.add(posted.id)
      } catch {
        return
      }
      index += 1
      later(step, between(20_000, 40_000))
      return
    }
    busy.add(sessionId)
    customerSays(sessionId, turn.text, () => {
      busy.delete(sessionId)
      index += 1
      later(step, between(20_000, 40_000))
    })
  }
  later(step, startMs)
}

/* ---------------------------------------------------------------- spawner */

let spawnCounter = 0
let poolCursor = 0

function nextPoolCustomer(): PoolCustomer | null {
  const inUse = new Set(db().sessions.filter((row) => row.status !== 'ended').map((row) => row.customerName))
  for (let i = 0; i < POOL.length; i += 1) {
    poolCursor = (poolCursor + 1) % POOL.length
    const candidate = POOL[poolCursor] as PoolCustomer
    if (!inUse.has(candidate.name)) return candidate
  }
  return null
}

function fakePhone(): string {
  spawnCounter += 1
  const a = 10 + ((spawnCounter * 17 + 5) % 80)
  const b = 10 + ((spawnCounter * 29 + 11) % 80)
  return `+995 555 00 ${a} ${b}`
}

function faqFor(person: PoolCustomer): FaqStep[] {
  const settings = db().settings.find((row) => row.tenantId === TENANT_ID)
  const tree = settings?.faqTree
  const rootId = tree?.rootIds[0]
  const root = rootId ? tree?.nodes[rootId] : undefined
  const option = root?.options.find((row) => row.id === FAQ_OPTION[person.topic])
  if (!root || !option) return []
  return [{ nodeId: root.id, question: pickContent(root.text, person.lang), answer: pickContent(option.label, person.lang) }]
}

const AVATARS = ['nest-02', 'nest-05', 'nest-07', 'nest-09', 'nest-11', 'nest-12', 'nest-14', null, null]

function spawn(): void {
  if (!db().demo.spawnerEnabled) return
  const tenant = db().tenants.find((row) => row.id === TENANT_ID)
  if (!tenant || tenant.disabled || tenant.deletedAt) return
  const waiting = db().sessions.filter((row) => row.tenantId === TENANT_ID && row.status === 'waiting').length
  if (waiting >= MAX_WAITING) return
  const person = nextPoolCustomer()
  if (!person) return

  const enabled: Channel[] = ['web_widget']
  for (const [channel, on] of Object.entries(tenant.features)) if (on) enabled.push(channel as Channel)
  const channel = enabled[Math.floor(Math.random() * enabled.length)] as Channel

  const fields: Record<string, string> = { cf_name: person.name, cf_phone: fakePhone(), cf_topic: person.topic }
  if (person.order) fields.cf_order = person.order
  const { customer, session } = createWidgetSession({
    tenantId: TENANT_ID,
    fields,
    faqPath: channel === 'web_widget' ? faqFor(person) : [],
    language: person.lang,
    clientIp: `198.51.100.${Math.floor(between(2, 250))}`,
    origin: 'spawner',
    channel,
    customerName: person.name,
  })
  if (channel !== 'web_widget') {
    const contact: ExternalContact = {
      id: newId('ext_'),
      channel,
      externalUserId: customer.number,
      displayName: person.name,
      username: channel === 'whatsapp' || channel === 'facebook_messenger' ? null : person.handle,
      avatarId: AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? null,
      locale: person.lang === 'ka' ? 'ka_GE' : 'en_GB',
    }
    customer.externalContact = contact
    broadcast('customer:upsert', customer)
  }
  reactive.set(session.id, [...person.replies])

  const say = (text: string) => postMessage(session.id, { sender: 'user', senderId: customer.id, senderName: person.name, content: text })
  say(person.opening)
  if (person.extra) later(() => liveSession(session.id) && say(person.extra as string), 1_200)
  later(() => {
    const current = liveSession(session.id)
    if (!current) return
    if (current.aiState === 'bot') {
      postMessage(session.id, { sender: 'bot', senderName: 'Chiti Assistant', content: BOT_HANDOVER_LINE[person.lang] })
      handoff(session.id, 'customer_request')
    }
    autoAssign(TENANT_ID)
  }, person.extra ? 2_600 : 1_600)
}

function scheduleSpawn(): void {
  later(() => {
    if (!hidden()) spawn()
    scheduleSpawn()
  }, between(25_000, 40_000))
}

/* ------------------------------------------------------------------ start */

export function start(): () => void {
  stopped = false
  reactive.clear()
  busy.clear()
  handled.clear()
  autoPosted.clear()
  spawnCounter = 0
  poolCursor = Math.floor(Math.random() * POOL.length)

  for (const [sessionId, script] of Object.entries(SCRIPTS)) {
    if (!db().sessions.some((row) => row.id === sessionId)) continue
    reactive.set(sessionId, [...script.reactive])
    if (script.autonomous) runAutonomous(sessionId, script.autonomous, script.autoStartMs ?? 25_000)
  }
  const off = bus.on('message:upsert', onStaffMessage)
  scheduleSpawn()

  return () => {
    stopped = true
    off()
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}
