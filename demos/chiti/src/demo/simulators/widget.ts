/**
 * Widget simulator (owner: widget group). Runs in the leader tab only.
 *
 * 1. Bot-first: the visitor's chat is answered by Chiti Assistant from a small
 *    knowledge base (1-1.5 s "typing"), and handed off on "operator", an
 *    attachment, two misses, an AI outage or when the bot is switched off.
 * 2. When nobody drives the operator inbox (demo.operatorDriving is false),
 *    Mariam claims the visitor's waiting chat after 6-10 s and answers with
 *    keyword-matched canned lines.
 */
import type { ChatSession, ContentLang, Message } from '@/types'

import { bus } from '../bus'
import {
  BOT_DISPLAY_NAME,
  BOT_LINES,
  buildBriefing,
  detectLang,
  isGreeting,
  isThanks,
  matchKnowledge,
  operatorReply,
  topicOf,
  wantsHuman,
} from '../content/widget'
import {
  aiOutageActive,
  claimSession,
  getOperator,
  handoff,
  markSeen,
  postMessage,
  setTyping,
} from '../engine'
import { store } from '../store'

const MARIAM_ID = 'op_mariam'
const MAX_AGE_MS = 60_000

const handled = new Set<string>()
const misses = new Map<string, number>()
const botAnswered = new Set<string>()
const claimTimers = new Map<string, ReturnType<typeof setTimeout>>()
const timers = new Set<ReturnType<typeof setTimeout>>()

function later(ms: number, fn: () => void): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    try {
      fn()
    } catch (error) {
      console.error('[chiti] widget simulator', error)
    }
  }, ms)
  timers.add(timer)
}

const between = (min: number, max: number) => min + Math.random() * (max - min)

function sessionOf(sessionId: string): ChatSession | undefined {
  return store.data.sessions.find((row) => row.id === sessionId)
}

/**
 * Two open tabs can both believe they lead (a hidden tab's heartbeat is
 * throttled), and each would answer. The store is mirrored, so whoever fires
 * second finds the first answer to the same customer message and stays quiet.
 */
const lastTrigger = new Map<string, string>()

function alreadySaid(sessionId: string, sender: Message['sender'], content: string): boolean {
  const since = Date.parse(lastTrigger.get(sessionId) ?? '') || Date.now() - 10_000
  return store.data.messages.some((row) => row.sessionId === sessionId && row.sender === sender && row.content === content && Date.parse(row.timestamp) >= since)
}

function isVisitorWeb(session: ChatSession | undefined): session is ChatSession {
  return !!session && session.origin === 'visitor' && session.channel === 'web_widget' && session.status !== 'ended'
}

/* ------------------------------------------------------------------ bot */

function botTyping(sessionId: string, typing: boolean): void {
  setTyping({ sessionId, who: 'bot', isTyping: typing, draft: null, name: BOT_DISPLAY_NAME })
}

function botSay(sessionId: string, content: string, citations: string[] = [], after = between(1000, 1500), done?: () => void): void {
  botTyping(sessionId, true)
  later(after, () => {
    botTyping(sessionId, false)
    const session = sessionOf(sessionId)
    if (!session || session.status === 'ended' || session.aiState !== 'bot') return
    if (alreadySaid(sessionId, 'bot', content)) return
    postMessage(sessionId, { sender: 'bot', senderName: BOT_DISPLAY_NAME, content, citations })
    done?.()
  })
}

type HandoffKind = 'customer_request' | 'unsupported_content' | 'no_answer' | 'circuit_open' | 'bot_paused'

const BRIEF_REASON: Record<HandoffKind, 'request' | 'attachment' | 'noanswer' | 'outage' | 'paused'> = {
  customer_request: 'request',
  unsupported_content: 'attachment',
  no_answer: 'noanswer',
  circuit_open: 'outage',
  bot_paused: 'paused',
}

function handOff(session: ChatSession, kind: HandoffKind, lang: ContentLang, lastMessage: string | null): void {
  const topic = session.topic !== 'other' ? session.topic : (topicOf(lastMessage ?? '') ?? 'other')
  const brief = buildBriefing({ name: session.customerName, topic, lastMessage, lang, reason: BRIEF_REASON[kind] })
  botTyping(session.id, true)
  later(between(700, 1000), () => {
    botTyping(session.id, false)
    const current = sessionOf(session.id)
    if (!current || current.status === 'ended' || current.aiState !== 'bot') return
    postMessage(session.id, { sender: 'bot', senderName: BOT_DISPLAY_NAME, content: BOT_LINES.handoff[kind](lang) })
    handoff(session.id, kind, brief.summary, brief.goal)
  })
}

function onCustomerMessage(session: ChatSession, message: Message): void {
  const settings = store.data.settings.find((row) => row.tenantId === session.tenantId)
  const language = session.clientLanguage
  const text = message.content.trim()
  const lang = detectLang(text, language)
  const attachment = message.type !== 'text'

  if (aiOutageActive()) return handOff(session, 'circuit_open', language, text || null)
  if (!settings?.aiBotEnabled) return handOff(session, 'bot_paused', language, text || null)
  if (attachment) return handOff(session, 'unsupported_content', language, text || null)
  if (wantsHuman(text)) return handOff(session, 'customer_request', language, text)

  if (isGreeting(text) && text.length < 24) return botSay(session.id, BOT_LINES.greetingReply(lang))
  const entry = matchKnowledge(text)
  if (!entry) {
    if (isThanks(text)) return botSay(session.id, BOT_LINES.thanksReply(lang))
    const count = (misses.get(session.id) ?? 0) + 1
    misses.set(session.id, count)
    if (count >= 2) return handOff(session, 'no_answer', language, text)
    return botSay(session.id, BOT_LINES.clarify(lang))
  }
  misses.set(session.id, 0)
  const first = !botAnswered.has(session.id)
  botAnswered.add(session.id)
  const answer = first ? `${entry.answer[lang]}\n\n${BOT_LINES.disclosure(lang)}` : entry.answer[lang]
  if (session.topic === 'other' && entry.topic !== 'other') session.topic = entry.topic
  botSay(session.id, answer, [entry.title[lang]])
}

/* -------------------------------------------------------------- Mariam */

function mariamOnline(): boolean {
  const mariam = getOperator(MARIAM_ID)
  return !!mariam && mariam.status === 'online'
}

function scheduleClaim(session: ChatSession): void {
  if (claimTimers.has(session.id)) return
  const timer = setTimeout(() => {
    claimTimers.delete(session.id)
    const current = sessionOf(session.id)
    if (!isVisitorWeb(current) || current.status !== 'waiting' || current.operatorId || current.aiState === 'bot') return
    if (store.data.demo.operatorDriving || !mariamOnline()) return
    try {
      // 'auto_assign' skips the chat limit: Mariam's seeded chats already fill it.
      claimSession(current.id, MARIAM_ID, 'auto_assign')
      later(1_200, () => markSeen(current.id, 'staff'))
    } catch (error) {
      console.error('[chiti] mariam could not claim', error)
    }
  }, between(6_000, 10_000))
  claimTimers.set(session.id, timer)
}

function mariamReply(session: ChatSession, message: Message): void {
  const mariam = getOperator(MARIAM_ID)
  if (!mariam) return
  const reply = operatorReply(message.type === 'text' ? message.content : '', message.type !== 'text', session.clientLanguage === 'ka' ? 'ka' : 'en')
  later(1_000, () => markSeen(session.id, 'staff'))
  later(1_400, () => setTyping({ sessionId: session.id, who: 'operator', isTyping: true, draft: null, name: mariam.nickname }))
  later(2_300, () => {
    setTyping({ sessionId: session.id, who: 'operator', isTyping: false, draft: null, name: mariam.nickname })
    const current = sessionOf(session.id)
    if (!isVisitorWeb(current) || current.operatorId !== MARIAM_ID || current.adminInterventionActive) return
    if (alreadySaid(session.id, 'operator', reply)) return
    postMessage(session.id, { sender: 'operator', senderId: mariam.id, senderName: mariam.nickname, content: reply })
  })
}

/* ---------------------------------------------------------------- wiring */

export function start(): () => void {
  const offMessage = bus.on('message:upsert', (message) => {
    if (message.sender !== 'user' || message.isPreChat || message.isAutoGreeting) return
    if (handled.has(message.id)) return
    handled.add(message.id)
    if (Date.now() - Date.parse(message.timestamp) > MAX_AGE_MS) return
    const session = sessionOf(message.sessionId)
    if (!isVisitorWeb(session)) return
    lastTrigger.set(session.id, message.timestamp)

    if (session.aiState === 'bot') return onCustomerMessage(session, message)
    if (session.operatorId === MARIAM_ID && !store.data.demo.operatorDriving) mariamReply(session, message)
  })

  const offSession = bus.on('session:upsert', (session) => {
    if (!isVisitorWeb(session)) return
    if (session.status === 'waiting' && !session.operatorId && session.aiState !== 'bot') scheduleClaim(session)
  })

  // The live desk was closed: nobody plays the operator any more, so Mariam picks up what is waiting.
  const offControls = bus.on('demo:controls', (controls) => {
    if (controls.operatorDriving) return
    for (const session of store.data.sessions) {
      if (isVisitorWeb(session) && session.status === 'waiting' && !session.operatorId && session.aiState !== 'bot') scheduleClaim(session)
    }
  })

  const offReset = bus.on('demo:reset', () => {
    handled.clear()
    lastTrigger.clear()
    misses.clear()
    botAnswered.clear()
  })

  return () => {
    offMessage()
    offSession()
    offControls()
    offReset()
    for (const timer of timers) clearTimeout(timer)
    for (const timer of claimTimers.values()) clearTimeout(timer)
    timers.clear()
    claimTimers.clear()
  }
}
