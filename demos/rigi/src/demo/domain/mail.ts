/** Mail threading helpers. Owner: seed. */
import type { DemoData, Mail, MailStatus, MailThread } from '@/types'

const REPLY_PREFIX = /^\s*(?:(?:re|fwd?|fw|aw|sv|tr)\s*(?:\[\d+\]|\(\d+\))?\s*:\s*|\[[^\]]*\]\s*)+/i

/** Strip Re:/Fwd:/RE:/FW:/[tags], collapse spaces, lowercase. */
export function normalizeSubject(subject: string): string {
  return subject.replace(REPLY_PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Higher wins when rolling a thread up: followup > new > triaged > task_created > ignored. */
export const MAIL_STATUS_RANK: Record<MailStatus, number> = {
  followup: 5,
  new: 4,
  triaged: 3,
  task_created: 2,
  ignored: 1,
}

export function rollupThreadStatus(mails: ReadonlyArray<Pick<Mail, 'status'>>): MailStatus {
  let best: MailStatus = 'new'
  let rank = 0
  for (const mail of mails) {
    const r = MAIL_STATUS_RANK[mail.status]
    if (r > rank) {
      rank = r
      best = mail.status
    }
  }
  return best
}

/** The thread a (new) mail belongs to: In-Reply-To/References first, then the normalized subject. */
export function findThreadFor(data: DemoData, mail: Pick<Mail, 'inReplyTo' | 'references' | 'subject'>): MailThread | null {
  const refs = [mail.inReplyTo, ...mail.references].filter((r): r is string => Boolean(r))
  if (refs.length > 0) {
    const parent = data.mails.find((m) => refs.includes(m.messageId))
    if (parent) {
      const thread = data.threads.find((t) => t.id === parent.threadId)
      if (thread) return thread
    }
  }
  const normalized = normalizeSubject(mail.subject)
  if (!normalized) return null
  let match: MailThread | null = null
  for (const thread of data.threads) {
    if (thread.subjectNormalized !== normalized) continue
    if (!match || thread.lastMessageAt > match.lastMessageAt) match = thread
  }
  return match
}

/** Recompute a thread's counters, participants and rolled-up status from its mails. */
export function refreshThread(data: DemoData, threadId: string): MailThread | null {
  const thread = data.threads.find((t) => t.id === threadId)
  if (!thread) return null
  const mails = data.mails.filter((m) => m.threadId === threadId).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  if (mails.length === 0) return thread
  thread.messageCount = mails.length
  thread.firstMessageAt = mails[0].receivedAt
  thread.lastMessageAt = mails[mails.length - 1].receivedAt
  thread.participantAddrs = [...new Set(mails.flatMap((m) => [m.fromAddr, ...m.toAddrs, ...m.ccAddrs]))]
  thread.status = rollupThreadStatus(mails)
  if (!thread.partnerId) thread.partnerId = mails.find((m) => m.partnerId)?.partnerId ?? null
  return thread
}
