/**
 * Team-chat colleagues (owner: team). When the visitor writes in a DM or the
 * room, a colleague "reads" it, types for 2-4 s and answers with a line that
 * fits the topic, in the language the visitor used. Admins' presence drifts
 * now and then, and the room gets a rare unprompted remark so the unread badge
 * is seen working. Runs only in the leader tab (see ../index.ts).
 */
import { createRandom, every } from '@portfolio/demo-kit'

import type { ContentLang, StaffConversation, StaffMessage } from '@/types'

import { broadcast, bus } from '../bus'
import { currentAccount } from '../context'
import { createStaffMessage, findPerson, presenceOverride } from '../handlers/team'
import { linesFor, pickLine, ROOM_ANSWERERS } from '../content/team'
import { store } from '../store'

const GEORGIAN = /[Ⴀ-ჿ]/

function langOf(text: string): ContentLang {
  return GEORGIAN.test(text) ? 'ka' : 'en'
}

function uiLang(): ContentLang {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ka' ? 'ka' : 'en'
}

const UNPROMPTED = [
  { en: 'Quiet in the queue right now, good time to update the quick replies.', ka: 'რიგი ახლა მშვიდია, კარგი დროა სწრაფი პასუხების გასაახლებლად.', by: 'adm_eka' },
  { en: 'Tbilisi couriers are back on schedule, no more delay vouchers needed.', ka: 'თბილისის კურიერები გრაფიკს დაუბრუნდნენ, დაგვიანების ვაუჩერები აღარ გვჭირდება.', by: 'adm_giorgi' },
  { en: 'Who is taking the evening shift tomorrow? I can swap if needed.', ka: 'ხვალ საღამოს ცვლას ვინ იღებს? საჭიროების შემთხვევაში გავცვლი.', by: 'op_mariam' },
] as const

export function start(): () => void {
  const rnd = createRandom('chiti-team-sim')
  const handled = new Set<string>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let unpromptedSent = 0
  let lastVisitorWriteAt = 0

  const later = (ms: number, fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      try {
        fn()
      } catch (error) {
        console.error('[chiti] team simulator', error)
      }
    }, ms)
    timers.add(timer)
  }

  /** The colleague reads, types for a while, then answers (and may be followed by a second one in the room). */
  function respond(conv: StaffConversation, incoming: StaffMessage, responderId: string, extraDelay = 0): void {
    const responder = conv.members.find((member) => member.memberId === responderId)
    if (!responder) return
    const person = findPerson(conv.tenantId, responder.role, responder.memberId)
    if (!person) return
    const typingAfter = 500 + extraDelay + Math.floor(rnd.next() * 500)
    const typingFor = 2_000 + Math.floor(rnd.next() * 2_000)
    later(typingAfter, () => {
      responder.lastReadAt = new Date().toISOString()
      broadcast('staff:conversation', conv)
      broadcast('staff:typing', { conversationId: conv.id, memberId: person.id, name: { ...person.name }, isTyping: true })
    })
    later(typingAfter + typingFor, () => {
      broadcast('staff:typing', { conversationId: conv.id, memberId: person.id, name: { ...person.name }, isTyping: false })
      const lang = langOf(incoming.content)
      const line = pickLine(rnd.pick(linesFor(incoming.content)), lang)
      const reply = createStaffMessage(conv, { role: person.role, id: person.id, name: person.name }, { content: line })
      handled.add(reply.id)
    })
  }

  const offMessage = bus.on('staff:message', (message) => {
    if (handled.has(message.id)) return
    handled.add(message.id)
    const account = currentAccount()
    if (!account || message.senderId !== account.staffId) return
    const conv = store.data.staffConversations.find((row) => row.id === message.conversationId)
    if (!conv) return
    lastVisitorWriteAt = Date.now()
    if (conv.kind === 'direct') {
      const peer = conv.members.find((member) => member.memberId !== message.senderId)
      if (peer) respond(conv, message, peer.memberId)
      return
    }
    const candidates = ROOM_ANSWERERS.filter((id) => id !== message.senderId && conv.members.some((member) => member.memberId === id))
    if (candidates.length === 0) return
    const first = rnd.pick(candidates)
    respond(conv, message, first)
    if (candidates.length > 1 && rnd.chance(0.35)) {
      const second = rnd.pick(candidates.filter((id) => id !== first))
      respond(conv, message, second, 3_500)
    }
  })

  const stopTick = every(20_000, () => {
    const account = currentAccount()
    if (!account || account.role === 'customer' || account.role === 'superadmin' || account.tenantId !== 'ten_vazi') return
    // Admin presence drifts.
    if (rnd.chance(0.3)) {
      const current = presenceOverride.get('adm_eka') ?? 'online'
      presenceOverride.set('adm_eka', current === 'online' ? 'away' : 'online')
      const room = store.data.staffConversations.find((row) => row.kind === 'room' && row.tenantId === 'ten_vazi')
      if (room) broadcast('staff:conversation', room)
    }
    // A rare unprompted remark in the room, never while the visitor is mid-conversation.
    if (account.role === 'supervisor' || unpromptedSent >= UNPROMPTED.length || Date.now() - lastVisitorWriteAt < 60_000) return
    if (!rnd.chance(0.25)) return
    const room = store.data.staffConversations.find((row) => row.kind === 'room' && row.tenantId === 'ten_vazi')
    const remark = UNPROMPTED[unpromptedSent]
    if (!room || !remark || remark.by === account.staffId) return
    const person = findPerson('ten_vazi', remark.by.startsWith('adm_') ? 'admin' : 'operator', remark.by)
    if (!person) return
    unpromptedSent += 1
    const reply = createStaffMessage(room, { role: person.role, id: person.id, name: person.name }, { content: uiLang() === 'ka' ? remark.ka : remark.en })
    handled.add(reply.id)
  })

  return () => {
    offMessage()
    stopTick()
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}
