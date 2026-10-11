/**
 * Optional two-tab mirror: with the demo open in two tabs (say the SMS inbox in
 * one and the console in the other) what a visitor does in one tab shows up in
 * the other, so "answer the survey, watch the console move" works across tabs.
 *
 * It persists NOTHING. A BroadcastChannel only relays live changes between
 * tabs that are open right now; a reload still restores the pristine seed.
 * What is relayed: answered surveys (the response and its link), survey links
 * sent from the console, the SMS that lands in an inbox, demo-clock changes
 * and "Reset demo". Each change is replayed on the other tab's own store and
 * re-emitted on its bus, so every query refetches exactly as it would locally.
 * Replays are idempotent (a response is keyed by its token, a link by its
 * token, an SMS by token + recipient + time) and receivers assign their own
 * `rsp_` / `sms_` ids, because both tabs count from the same seed.
 *
 * A tab that opens later asks its peers for what they already hold.
 *
 * Owner: seed agent. Started from `bootDemo()` in ./index.
 */
import type { SmsMessage, SurveyLink, SurveyResponse } from '@/types'
import { bus, clock, resetDemoData, store } from './core'

const CHANNEL = 'azri-demo'

type Msg =
  | { t: 'hello' }
  | {
      t: 'state'
      to: string
      clockOffsetMs: number
      links: SurveyLink[]
      messages: SmsMessage[]
      responses: SurveyResponse[]
    }
  | { t: 'response'; response: SurveyResponse; link: SurveyLink | null }
  | { t: 'link'; link: SurveyLink }
  | { t: 'sms'; message: SmsMessage }
  | { t: 'clock'; offsetMs: number }
  | { t: 'reset' }

interface Envelope {
  from: string
  msg: Msg
}

/** Start mirroring. Returns a stop function; a no-op where BroadcastChannel is missing. */
export function startSync(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  let channel: BroadcastChannel
  try {
    channel = new BroadcastChannel(CHANNEL)
  } catch {
    return () => undefined
  }

  const me = Math.random().toString(36).slice(2, 10)
  /** True while a change from another tab is being replayed, so it is not echoed back. */
  let applying = false

  // What the seed holds: anything else was created at runtime and is worth relaying.
  let seedLinkIds = new Set(store.data.links.map((link) => link.id))
  let seedMessageIds = new Set(store.data.messages.map((message) => message.id))

  const post = (msg: Msg): void => {
    if (applying) return
    try {
      channel.postMessage({ from: me, msg } satisfies Envelope)
    } catch {
      /* a closed channel or an unclonable value must never break the demo */
    }
  }
  const quietly = (run: () => void): void => {
    const was = applying
    applying = true
    try {
      run()
    } finally {
      applying = was
    }
  }

  /* ------------------------------------------------------------- replay */

  const replayLink = (link: SurveyLink): SurveyLink | undefined => {
    const existing = store.data.links.find((candidate) => candidate.id === link.id)
    if (existing) return existing
    store.data.links.unshift(link)
    quietly(() => bus.emit('link:updated', { surveyId: link.id, status: link.status }))
    return link
  }

  const replayResponse = (incoming: SurveyResponse, link: SurveyLink | null): void => {
    if (store.data.responses.some((response) => response.surveyId === incoming.surveyId)) return
    const local = (link ? replayLink(link) : undefined) ?? store.data.links.find((l) => l.id === incoming.surveyId)
    const response: SurveyResponse = { ...incoming, id: store.nextId('rsp_') }
    store.data.responses.unshift(response)
    if (local) {
      local.status = 'completed'
      local.completedAt = response.submittedAt
      local.responseId = response.id
    }
    quietly(() => {
      bus.emit('response:created', {
        responseId: response.id,
        surveyId: response.surveyId,
        campaignId: response.campaignId,
        source: response.source,
      })
      bus.emit('link:updated', { surveyId: response.surveyId, status: 'completed' })
    })
  }

  const replaySms = (incoming: SmsMessage): void => {
    const known = store.data.messages.some(
      (m) => m.surveyId === incoming.surveyId && m.recipientId === incoming.recipientId && m.receivedAt === incoming.receivedAt,
    )
    if (known) return
    const message: SmsMessage = { ...incoming, id: store.nextId('sms_') }
    store.data.messages.unshift(message)
    quietly(() =>
      bus.emit('sms:received', { messageId: message.id, recipientId: message.recipientId, tenantId: message.tenantId }),
    )
  }

  const snapshotFor = (to: string): Msg => {
    const runtimeResponses = store.data.responses.filter((response) => response.source !== 'seed')
    const wanted = new Set(runtimeResponses.map((response) => response.surveyId))
    return {
      t: 'state',
      to,
      clockOffsetMs: clock.offsetMs(),
      links: store.data.links.filter((link) => !seedLinkIds.has(link.id) || wanted.has(link.id)),
      messages: store.data.messages.filter((message) => !seedMessageIds.has(message.id)),
      responses: runtimeResponses,
    }
  }

  const handle = (from: string, msg: Msg): void => {
    switch (msg.t) {
      case 'hello':
        try {
          channel.postMessage({ from: me, msg: snapshotFor(from) } satisfies Envelope)
        } catch {
          /* ignore */
        }
        break
      case 'state':
        if (msg.to !== me) break
        if (msg.clockOffsetMs !== clock.offsetMs()) quietly(() => clock.setOffset(msg.clockOffsetMs))
        for (const link of msg.links) if (!seedLinkIds.has(link.id)) replayLink(link)
        // Oldest first, so the newest ends up on top as it does at the sender.
        for (const message of [...msg.messages].reverse()) replaySms(message)
        for (const response of [...msg.responses].reverse()) {
          replayResponse(response, msg.links.find((link) => link.id === response.surveyId) ?? null)
        }
        break
      case 'response':
        replayResponse(msg.response, msg.link)
        break
      case 'link':
        replayLink(msg.link)
        break
      case 'sms':
        replaySms(msg.message)
        break
      case 'clock':
        if (msg.offsetMs !== clock.offsetMs()) quietly(() => clock.setOffset(msg.offsetMs))
        break
      case 'reset':
        quietly(() => resetDemoData())
        break
    }
  }

  channel.onmessage = (event: MessageEvent<Envelope | null>) => {
    const data = event.data
    if (!data || typeof data.from !== 'string' || data.from === me || !data.msg) return
    try {
      handle(data.from, data.msg)
    } catch {
      /* a malformed message must never break the demo */
    }
  }

  /* ------------------------------------------------------------- relay */

  const offs = [
    bus.on('response:created', ({ responseId, surveyId }) => {
      const response = store.data.responses.find((r) => r.id === responseId)
      if (response) post({ t: 'response', response, link: store.data.links.find((l) => l.id === surveyId) ?? null })
    }),
    bus.on('link:updated', ({ surveyId, status }) => {
      if (status !== 'pending') return
      const link = store.data.links.find((l) => l.id === surveyId)
      if (link && !seedLinkIds.has(link.id)) post({ t: 'link', link })
    }),
    bus.on('sms:received', ({ messageId }) => {
      const message = store.data.messages.find((m) => m.id === messageId)
      if (message) post({ t: 'sms', message })
    }),
    bus.on('clock:changed', ({ offsetMs }) => post({ t: 'clock', offsetMs })),
    bus.on('store:reset', () => {
      seedLinkIds = new Set(store.data.links.map((link) => link.id))
      seedMessageIds = new Set(store.data.messages.map((message) => message.id))
      post({ t: 'reset' })
    }),
  ]

  post({ t: 'hello' })

  return () => {
    for (const off of offs) off()
    channel.onmessage = null
    channel.close()
  }
}
