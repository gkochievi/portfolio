/**
 * Support mailbox: threads and mails (task-linked and loose), attachments
 * mapped to the bundled samples, and the fake IMAP queue (`pendingMails`).
 */
import { newId } from '@/demo/domain/ids'
import { normalizeSubject, refreshThread } from '@/demo/domain/mail'
import type { Mail, MailStatus, MailThread, PendingMail, Task } from '@/types'

import { maxIso, plusHours, spread, type SeedCtx } from './ctx'
import { L1_IDS, PARTNERS, TEMPLATES, type PartnerProfile } from './static'
import type { WorkResult } from './work'

export const DESK_ADDRESS = 'desk@rigi.example'

type SampleKind = 'csv' | 'png' | 'pdf' | 'txt' | 'docx'
const SAMPLES: Record<SampleKind, { file: string; mime: string; size: [number, number] }> = {
  csv: { file: 'samples/call-log.csv', mime: 'text/csv', size: [3_000, 40_000] },
  png: { file: 'samples/network-diagram.png', mime: 'image/png', size: [80_000, 420_000] },
  pdf: { file: 'samples/service-agreement.pdf', mime: 'application/pdf', size: [120_000, 900_000] },
  txt: { file: 'samples/ivr-flow.txt', mime: 'text/plain', size: [1_000, 9_000] },
  docx: { file: 'samples/handover.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: [14_000, 60_000] },
}

const ATTACH_BY_TEMPLATE: Record<string, [SampleKind, string]> = {
  SIP_TRUNK_ISSUE: ['csv', 'trunk-call-log.csv'],
  IVR_CHANGE: ['txt', 'ivr-menu-changes.txt'],
  NUMBER_PORTING: ['pdf', 'porting-form-signed.pdf'],
  AGENT_ONBOARDING: ['docx', 'new-agents.docx'],
  CALL_RECORDING_EXPORT: ['csv', 'call-ids.csv'],
  SKILL_ROUTING_CHANGE: ['csv', 'skills-export.csv'],
  NEW_QUEUE: ['txt', 'queue-members.txt'],
  REPORT_BUILD: ['docx', 'report-spec.docx'],
  CRM_INTEGRATION_FIX: ['png', 'crm-screen-pop.png'],
  WALLBOARD_SETUP: ['png', 'wallboard-mockup.png'],
}

const FOLLOW_UPS: readonly string[] = [
  'Adding two more examples from this morning: 09:14 and 09:52, both on the main line.',
  'Any news? Our supervisors keep asking.',
  'გმადლობთ, ველოდებით განახლებას.',
  'We can stay online until 20:00 today if you need us for a test.',
  'Attaching what our team collected so far.',
]

const NEW_REPLIES: readonly string[] = [
  'Quick update from our side: it happened again at 11:20, two calls affected.',
  'Thanks for the call earlier. One more thing: the change should also cover the weekend team.',
  'ახლაც იგივე პრობლემაა, გთხოვთ გადახედოთ.',
  'We tested on two workstations; one is fine, the other still shows the old behaviour.',
  'Could you also send the summary of what was changed? Our auditor asked for it.',
]

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('')

interface Sender {
  name: string
  addr: string
  partner: PartnerProfile | null
}

export function seedMail(ctx: SeedCtx, work: WorkResult): void {
  const { data, rng } = ctx

  const senderFor = (partnerId: string, role = 0): Sender => {
    const profile = PARTNERS.find((p) => p.id === partnerId) ?? null
    const partner = data.partners.find((p) => p.id === partnerId)
    const contact = partner?.contacts[role] ?? partner?.contacts[0]
    return { name: contact?.name ?? 'Partner', addr: contact?.email ?? `info@${profile?.domain ?? 'partner.example'}`, partner: profile }
  }
  const signature = (s: Sender) => {
    const partner = s.partner ? data.partners.find((p) => p.id === s.partner?.id) : undefined
    const phone = partner?.contacts.find((c) => c.name === s.name)?.phone
    return `\n\n--\n${s.name}${s.partner ? `\n${s.partner.name}` : ''}${phone ? `\n${phone}` : ''}`
  }
  const domainOf = (addr: string) => addr.split('@')[1] ?? 'mail.example'

  const newThread = (subject: string, partnerId: string | null): MailThread => {
    const thread: MailThread = {
      id: newId('thr_'),
      subject,
      subjectNormalized: normalizeSubject(subject),
      participantAddrs: [],
      firstMessageAt: '',
      lastMessageAt: '',
      messageCount: 0,
      status: 'new',
      partnerId,
    }
    data.threads.push(thread)
    return thread
  }

  const addAttachment = (mailId: string, kind: SampleKind, filename: string) => {
    const sample = SAMPLES[kind]
    const id = newId('att_')
    data.attachments.push({ id, mailId, filename, mimeType: sample.mime, sizeBytes: rng.int(sample.size[0], sample.size[1]), sampleFile: sample.file })
    return id
  }

  const addMail = (thread: MailThread, s: Sender, subject: string, body: string, receivedAt: string, status: MailStatus, cc: string[] = []): Mail => {
    const previous = data.mails.filter((m) => m.threadId === thread.id).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    const last = previous[previous.length - 1]
    const mail: Mail = {
      id: newId('mail_'),
      threadId: thread.id,
      messageId: `<${ctx.hex(12)}.${ctx.hex(6)}@mail.${domainOf(s.addr)}>`,
      subject,
      fromAddr: s.addr,
      fromName: s.name,
      toAddrs: [DESK_ADDRESS],
      ccAddrs: cc,
      bodyText: body + signature(s),
      bodyHtml: rng.chance(0.45) ? toHtml(body + signature(s)) : null,
      receivedAt,
      ingestedAt: ctx.clamp(plusHours(receivedAt, 0.01 + rng.next() * 0.03)),
      status,
      inReplyTo: last?.messageId ?? null,
      references: previous.map((m) => m.messageId),
      attachmentIds: [],
      partnerId: s.partner?.id ?? null,
    }
    data.mails.push(mail)
    return mail
  }

  const link = (task: Task, mail: Mail, by: string) =>
    data.taskMailLinks.push({ taskId: task.id, mailId: mail.id, linkedAt: maxIso(mail.receivedAt, task.createdAt), linkedById: by })

  /* ------------------------------------------------------ task threads */
  let followupsOnVerified = 0
  const recent = ctx.ago(30)
  for (const { task, plan } of work.tasks) {
    if (plan.source !== 'mail' || !task.partnerId) continue
    const s = senderFor(task.partnerId, rng.chance(0.8) ? 0 : 1)
    const tpl = TEMPLATES.find((t) => t.code === plan.templateCode)
    const by = plan.creator.kind === 'staff' ? plan.creator.id : rng.pick(L1_IDS)
    const thread = newThread(task.title, task.partnerId)
    const first = ctx.clamp(plusHours(task.createdAt, -(0.3 + rng.next() * 2.5)))
    const opening = addMail(thread, s, task.title, `Hello,\n\n${tpl?.request ?? 'Please have a look at the problem below.'}\n\n${task.title}.`, first, 'task_created')
    const attach = plan.templateCode ? ATTACH_BY_TEMPLATE[plan.templateCode] : undefined
    if (attach && rng.chance(0.4)) opening.attachmentIds.push(addAttachment(opening.id, attach[0], attach[1]))
    link(task, opening, by)

    const closeAt = task.finishedAt ?? task.updatedAt
    const extra = plan.key ? rng.int(0, 1) : rng.int(0, 2)
    if (extra > 0) {
      const times = spread(plusHours(task.createdAt, 2), closeAt, extra + 1).slice(0, extra)
      for (const at of times) link(task, addMail(thread, s, `Re: ${task.title}`, rng.pick(FOLLOW_UPS), ctx.clamp(at), 'task_created'), by)
    }
    if (plan.hasNewReplies) {
      const from = maxIso(plusHours(task.updatedAt, 0.5), ctx.ago(0.9))
      const at = ctx.clamp(new Date(from).getTime() + rng.next() * (ctx.now.getTime() - new Date(from).getTime()) * 0.8)
      link(task, addMail(thread, s, `Re: ${task.title}`, rng.pick(NEW_REPLIES), at, 'followup'), by)
    } else if (task.state === 'verified' && task.verifiedAt && task.verifiedAt > recent && followupsOnVerified < 2) {
      // The partner wrote again after verifying; staff opened the task since, the mail still waits for triage.
      followupsOnVerified += 1
      const at = ctx.clamp(plusHours(task.verifiedAt, 6 + rng.int(0, 40)))
      link(task, addMail(thread, s, `Re: ${task.title}`, 'Thanks for the fix. Small thing: the old message still plays on the backup line.', at, 'followup'), by)
    }
    data.taskThreadLinks.push({ taskId: task.id, threadId: thread.id, linkedAt: task.createdAt, linkedById: by })
  }

  /* ------------------------------------------------------ loose threads */
  const unknown = (name: string, addr: string): Sender => ({ name, addr, partner: null })
  const loose: Array<{ s: Sender; subject: string; body: string; status: MailStatus; daysAgo: number; replies?: string[]; attach?: [SampleKind, string] }> = [
    { s: senderFor('prt_zemo', 0), subject: 'VPN tunnel flapping since this morning', body: 'Hi team,\n\nThe site-to-site tunnel dropped four times since 08:00. Calls survive, but the wallboard loses data. Can someone look?', status: 'new', daysAgo: 0.15 },
    { s: senderFor('prt_mzeo', 2), subject: 'Question about last month\'s invoice', body: 'Hello,\n\nCould you explain how the Agent Pro line is calculated? Procurement asks why it is not a round number of seats.', status: 'new', daysAgo: 0.4 },
    { s: senderFor('prt_lukma', 0), subject: 'Can we add two supervisors next week?', body: 'გამარჯობა,\n\nNext week two team leads become supervisors. Do we need new seats or can we move them from Agent Basic?', status: 'new', daysAgo: 0.9 },
    { s: senderFor('prt_kolkheti', 3), subject: 'Contract renewal: draft for review', body: 'Dear colleagues,\n\nPlease find our comments on the renewal draft attached. Main point: the notice period.', status: 'new', daysAgo: 1.2, attach: ['pdf', 'renewal-draft-comments.pdf'] },
    { s: unknown('Tbilisi CX Meetup', 'hello@cx-meetup.example'), subject: 'Invitation: contact-centre meetup, Thursday 19:00', body: 'You are invited to our monthly meetup. Topic: measuring first-call resolution.', status: 'new', daysAgo: 1.5 },
    { s: senderFor('prt_talgha', 0), subject: 'Recording storage almost full?', body: 'We got a warning in the admin panel that recording storage is at 91%. Is that on your side or ours?', status: 'new', daysAgo: 1.8 },
    { s: senderFor('prt_alvani', 0), subject: 'Sunday change window confirmation', body: 'Confirming the Sunday window 10:00-14:00 for the claims line changes.', status: 'triaged', daysAgo: 3, replies: ['Small correction: 10:00-13:00, the assessors start at 13:30.'] },
    { s: senderFor('prt_batumiwave', 0), subject: 'Summer season staffing forecast', body: 'Sharing our forecast: +6 agents from June to September. No action yet, just for planning.', status: 'triaged', daysAgo: 6, attach: ['csv', 'staffing-forecast.csv'] },
    { s: senderFor('prt_vake', 0), subject: 'Price list for extra seats', body: 'Hello,\n\nWhat would two more Agent Basic seats cost per month?', status: 'triaged', daysAgo: 4, replies: ['And is there a minimum term for added seats?'] },
    { s: senderFor('prt_mzeo', 0), subject: 'Penetration test window next month', body: 'Our security team plans a penetration test of the contact-centre web interface. Please confirm who should be informed.', status: 'triaged', daysAgo: 9 },
    { s: unknown('Telecom Weekly', 'news@telecomweekly.example'), subject: 'This week in telecom: SIP security roundup', body: 'Top stories: toll fraud trends, new codec support, and five tips for trunk hardening.', status: 'ignored', daysAgo: 2 },
    { s: unknown('Mail Delivery System', 'mailer-daemon@mx.zemo.example'), subject: 'Delivery Status Notification (Failure)', body: 'Delivery to the following recipient failed permanently: old-desk@zemo.example', status: 'ignored', daysAgo: 5 },
    { s: senderFor('prt_talgha', 1), subject: 'Automatic reply: Out of office until Monday', body: 'I am out of the office until Monday with limited access to e-mail. For urgent matters call the NOC.', status: 'ignored', daysAgo: 7 },
    { s: unknown('Cloud Hosting Offers', 'offers@cloudhosting.example'), subject: 'Save 30% on dedicated servers this month', body: 'Upgrade today and save. Offer ends Friday.', status: 'ignored', daysAgo: 10 },
    { s: unknown('Webinar Desk', 'noreply@webinar-desk.example'), subject: 'Your webinar recording is ready', body: 'The recording of "Queue strategies that work" is ready to watch.', status: 'ignored', daysAgo: 13 },
  ]
  for (const item of loose) {
    const thread = newThread(item.subject, item.s.partner?.id ?? null)
    const at = ctx.ago(item.daysAgo + (item.replies ? 0.5 : 0))
    const mail = addMail(thread, item.s, item.subject, item.body, at, item.status)
    if (item.attach) mail.attachmentIds.push(addAttachment(mail.id, item.attach[0], item.attach[1]))
    for (const [i, reply] of (item.replies ?? []).entries()) addMail(thread, item.s, `Re: ${item.subject}`, reply, ctx.ago(item.daysAgo - i * 0.05), item.status)
  }

  for (const thread of data.threads) refreshThread(data, thread.id)

  /* ----------------------------------------------------- IMAP queue */
  const lastIn = (subject: string) => {
    const thread = data.threads.find((t) => t.subject === subject)
    const mails = thread ? data.mails.filter((m) => m.threadId === thread.id).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)) : []
    return { last: mails[mails.length - 1], refs: mails.map((m) => m.messageId) }
  }
  const pending = (s: Sender, subject: string, body: string, deliverAfterSec: number | null, minutesAgo: number, attach?: [SampleKind, string]) => {
    const isReply = subject.startsWith('Re: ')
    const ctxThread = isReply ? lastIn(subject.slice(4)) : { last: undefined, refs: [] as string[] }
    const id = newId('mail_')
    const receivedAt = deliverAfterSec !== null ? new Date(ctx.now.getTime() + deliverAfterSec * 1000).toISOString() : ctx.ago(minutesAgo / 1440)
    const row: PendingMail = {
      id,
      messageId: `<${ctx.hex(12)}.${ctx.hex(6)}@mail.${domainOf(s.addr)}>`,
      subject,
      fromAddr: s.addr,
      fromName: s.name,
      toAddrs: [DESK_ADDRESS],
      ccAddrs: [],
      bodyText: body + signature(s),
      bodyHtml: null,
      receivedAt,
      inReplyTo: ctxThread.last?.messageId ?? null,
      references: ctxThread.refs,
      attachmentIds: [],
      partnerId: s.partner?.id ?? null,
      deliverAfterSec,
    }
    if (attach) row.attachmentIds.push(addAttachment(id, attach[0], attach[1]))
    data.pendingMails.push(row)
  }
  const titleOf = (key: string) => work.byKey.get(key)?.title ?? key
  pending(senderFor('prt_vake', 0), 'Reception phones ring twice before connecting', 'Hello,\n\nSince yesterday the reception phones ring twice before the call connects. Patients hang up. Can you check?', 45, 0)
  pending(senderFor('prt_lukma', 0), `Re: ${titleOf('lukma-skill')}`, 'Saburtalo couriers still land in the general queue. The other districts look right.', 120, 0)
  pending(senderFor('prt_mzeo', 0), 'Recording search is slow for last week', 'Searching recordings for last week takes over a minute. Earlier weeks are fast.', 240, 0)
  pending(senderFor('prt_alvani', 0), `Re: ${titleOf('alvani-report')}`, 'Please also add the assessor name as a column. Thank you!', 420, 0, ['docx', 'callback-report-columns.docx'])
  pending(senderFor('prt_zemo', 2), 'Updated billing contact', 'From next month please send invoices to billing@zemo.example only.', null, 12)
  pending(senderFor('prt_kolkheti', 0), 'Kutaisi office internet outage tonight 23:00-01:00', 'Our ISP announced maintenance tonight. Calls will fail over to mobile forwarding.', null, 25)
  pending(senderFor('prt_batumiwave', 0), 'Two new numbers for the summer hotline', 'We bought two numbers for the summer hotline; porting forms attached.', null, 33, ['pdf', 'porting-forms.pdf'])
  pending(senderFor('prt_talgha', 0), 'Re: Recording storage almost full?', 'Now it shows 94%. Should we delete old recordings ourselves?', null, 41)
  pending(unknown('Telecom Weekly', 'news@telecomweekly.example'), 'This week in telecom: number portability changes', 'Top stories: new porting rules, codec news and a webinar on queue design.', null, 55)
  pending(senderFor('prt_lukma', 2), 'Payment confirmation', 'Payment for last month was sent today; confirmation attached.', null, 63, ['pdf', 'payment-confirmation.pdf'])
  pending(senderFor('prt_alvani', 1), 'Agent headsets: recommended models?', 'Which headsets do you recommend for the claims team? Budget is moderate.', null, 70)
  pending(senderFor('prt_mzeo', 1), 'Board visit: wallboard on the 3rd floor', 'The board visits the contact centre on Thursday. Could the 3rd-floor wallboard show the SLA in large font?', null, 84)
  pending(unknown('Mail Delivery System', 'mailer-daemon@mx.lukma.example'), 'Delivery Status Notification (Delay)', 'Delivery to dispatch@lukma.example is delayed. The server will keep trying.', null, 96)
  pending(senderFor('prt_zemo', 0), 'Re: VPN tunnel flapping since this morning', 'Stable again after the ISP restarted their router. Leaving it with you to confirm.', null, 104)
  pending(senderFor('prt_vake', 1), 'Do you support WhatsApp?', 'Patients ask if they can write to us on WhatsApp. Is that possible with our setup?', null, 118)
}
