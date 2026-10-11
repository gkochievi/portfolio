/**
 * Mock API handlers. Owner: support-desk.
 * L1 desk: dashboard, mail inbox (threads + flat), mail and thread detail,
 * attachments, Poll now + the timed mail injector, projects.
 * Patterns are registered WITHOUT the /api prefix.
 */
import { conflict, DemoApiError, every, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'

import type { Attachment, DemoData, Mail, MailStatus, MailThread, PendingMail, Project, Task } from '@/types'

import { currentAccount, emitChanged, notify, nowIso, recordAudit, requirePartnerAdmin, requireStaff, writeSystemLog } from '../ctx'
import { findThreadFor, normalizeSubject, refreshThread } from '../domain/mail'
import { OPEN_STATES } from '../domain/tasks'
import { syntheticTrend } from '../domain/trend'
import { registerJob } from '../jobs'
import { bus, store } from '../runtime'

/* ----------------------------------------------------------------- helpers */

const PAGE_SIZE = 50
const MAIL_STATUSES: MailStatus[] = ['new', 'triaged', 'task_created', 'followup', 'ignored']
const IGNORABLE: MailStatus[] = ['new', 'triaged', 'followup']

const d = (): DemoData => store.data
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

function preview(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function partnerLite(id: string | null) {
  if (!id) return null
  const p = d().partners.find((x) => x.id === id)
  return p ? { id: p.id, name: p.name, currency: p.currency } : null
}

function taskLite(task: Task, linkedAt?: string | null) {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    state: task.state,
    points: task.points,
    partnerId: task.partnerId,
    partnerName: partnerLite(task.partnerId)?.name ?? null,
    projectId: task.projectId,
    hasNewReplies: task.hasNewReplies,
    deadline: task.deadline,
    linkedAt: linkedAt ?? null,
  }
}

function threadMails(threadId: string): Mail[] {
  return d()
    .mails.filter((m) => m.threadId === threadId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
}

function threadRow(thread: MailThread) {
  const mails = threadMails(thread.id)
  const latest = mails[mails.length - 1]
  return {
    id: thread.id,
    subject: thread.subject,
    preview: latest ? preview(latest.bodyText) : '',
    latestMailId: latest?.id ?? null,
    latestFromName: latest?.fromName ?? '',
    latestFromAddr: latest?.fromAddr ?? '',
    participantCount: thread.participantAddrs.length,
    messageCount: thread.messageCount,
    hasAttachments: mails.some((m) => m.attachmentIds.length > 0),
    firstMessageAt: thread.firstMessageAt,
    lastMessageAt: thread.lastMessageAt,
    status: thread.status,
    partnerId: thread.partnerId,
    partnerName: partnerLite(thread.partnerId)?.name ?? null,
    linkedTaskCount: d().taskThreadLinks.filter((l) => l.threadId === thread.id).length,
  }
}

function mailRow(mail: Mail) {
  return {
    id: mail.id,
    threadId: mail.threadId,
    subject: mail.subject,
    preview: preview(mail.bodyText),
    fromName: mail.fromName,
    fromAddr: mail.fromAddr,
    receivedAt: mail.receivedAt,
    status: mail.status,
    hasAttachments: mail.attachmentIds.length > 0,
    partnerId: mail.partnerId,
    partnerName: partnerLite(mail.partnerId)?.name ?? null,
  }
}

function paginate<T>(rows: T[], params: Record<string, string>) {
  const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || PAGE_SIZE))
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1))
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function sortRows<T>(rows: T[], params: Record<string, string>, keys: Record<string, (row: T) => string | number>, fallback: string): T[] {
  const key = keys[params.sort] ? params.sort : fallback
  const dir = params.dir === 'asc' ? 1 : params.dir === 'desc' ? -1 : key === fallback ? -1 : 1
  const pick = keys[key]
  return [...rows].sort((a, b) => compare(pick(a), pick(b)) * dir)
}

function parseStatus(v: string | undefined): MailStatus | null {
  return v && (MAIL_STATUSES as string[]).includes(v) ? (v as MailStatus) : null
}

function mailMatches(mail: Mail, q: string): boolean {
  return (
    mail.subject.toLowerCase().includes(q) ||
    mail.bodyText.toLowerCase().includes(q) ||
    mail.fromAddr.toLowerCase().includes(q) ||
    mail.fromName.toLowerCase().includes(q)
  )
}

function attachmentsOf(mail: Mail): Attachment[] {
  return mail.attachmentIds.map((id) => d().attachments.find((a) => a.id === id)).filter((a): a is Attachment => Boolean(a))
}

function linkedTasksForMail(mailId: string) {
  return d()
    .taskMailLinks.filter((l) => l.mailId === mailId)
    .map((l) => {
      const task = d().tasks.find((t) => t.id === l.taskId)
      return task ? taskLite(task, l.linkedAt) : null
    })
    .filter(Boolean)
}

function linkedTasksForThread(threadId: string) {
  return d()
    .taskThreadLinks.filter((l) => l.threadId === threadId)
    .map((l) => {
      const task = d().tasks.find((t) => t.id === l.taskId)
      return task ? taskLite(task, l.linkedAt) : null
    })
    .filter(Boolean)
}

/** A static RFC 5322 rendering of the mail, for the Raw tab and the .eml download. */
function rawMessage(mail: Mail, attachments: Attachment[]): string {
  const boundary = `----=_Part_${mail.id}`
  const lines = [
    `Return-Path: <${mail.fromAddr}>`,
    `Received: from mx.rigi.example by imap.rigi.example; ${new Date(mail.receivedAt).toUTCString()}`,
    `Message-ID: ${mail.messageId}`,
    ...(mail.inReplyTo ? [`In-Reply-To: ${mail.inReplyTo}`] : []),
    ...(mail.references.length ? [`References: ${mail.references.join(' ')}`] : []),
    `Date: ${new Date(mail.receivedAt).toUTCString()}`,
    `From: "${mail.fromName}" <${mail.fromAddr}>`,
    `To: ${mail.toAddrs.join(', ')}`,
    ...(mail.ccAddrs.length ? [`Cc: ${mail.ccAddrs.join(', ')}`] : []),
    `Subject: ${mail.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.bodyText,
    '',
  ]
  if (mail.bodyHtml) {
    lines.push(`--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', mail.bodyHtml, '')
  }
  for (const a of attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${a.mimeType}; name="${a.filename}"`,
      `Content-Disposition: attachment; filename="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      `[${a.sizeBytes} bytes omitted]`,
      '',
    )
  }
  lines.push(`--${boundary}--`, '')
  return lines.join('\r\n')
}

/* ------------------------------------------------------------- ingestion */

interface IngestResult {
  ingested: number
  skipped: number
  remaining: number
  mailIds: string[]
  threadIds: string[]
  taskIds: string[]
  mails: Mail[]
}

/** Move pending mails into the store as `new`, thread them, route replies to linked tasks. */
function ingest(batch: PendingMail[]): IngestResult {
  const data = d()
  const at = nowIso()
  const result: IngestResult = { ingested: 0, skipped: 0, remaining: 0, mailIds: [], threadIds: [], taskIds: [], mails: [] }
  for (const pending of batch) {
    data.pendingMails = data.pendingMails.filter((p) => p.id !== pending.id)
    if (data.mails.some((m) => m.messageId === pending.messageId || m.id === pending.id)) {
      result.skipped += 1
      continue
    }
    const { deliverAfterSec: _delay, ...fields } = pending
    let thread = findThreadFor(data, pending)
    if (!thread) {
      thread = {
        id: store.nextId('thr_'),
        subject: pending.subject,
        subjectNormalized: normalizeSubject(pending.subject),
        participantAddrs: [],
        firstMessageAt: at,
        lastMessageAt: at,
        messageCount: 0,
        status: 'new',
        partnerId: pending.partnerId,
      }
      data.threads.push(thread)
    }
    const mail: Mail = { ...fields, threadId: thread.id, receivedAt: at, ingestedAt: at, status: 'new' }
    data.mails.push(mail)
    refreshThread(data, thread.id)
    result.ingested += 1
    result.mailIds.push(mail.id)
    result.mails.push(mail)
    if (!result.threadIds.includes(thread.id)) result.threadIds.push(thread.id)
    for (const link of data.taskThreadLinks.filter((l) => l.threadId === thread.id)) {
      const task = data.tasks.find((t) => t.id === link.taskId)
      if (!task) continue
      if (!data.taskMailLinks.some((l) => l.taskId === task.id && l.mailId === mail.id)) {
        data.taskMailLinks.push({ taskId: task.id, mailId: mail.id, linkedAt: at, linkedById: null })
      }
      task.hasNewReplies = true
      task.updatedAt = at
      if (!result.taskIds.includes(task.id)) result.taskIds.push(task.id)
    }
  }
  result.remaining = data.pendingMails.length
  return result
}

function announce(result: IngestResult): void {
  if (result.ingested === 0) return
  bus.emit('mail.received', { mailIds: result.mailIds, threadIds: result.threadIds, taskIds: result.taskIds })
  for (const mail of result.mails) {
    notify({
      tone: 'info',
      title: 'support-desk:toast.newMail',
      values: { from: mail.fromName || mail.fromAddr },
      description: mail.subject,
      href: `/l1/mails/${mail.id}`,
    })
  }
  emitChanged('mails', 'threads', 'tasks', 'dashboards')
}

function pollNow(limit = 5): IngestResult {
  const batch = d().pendingMails.slice(0, limit)
  const result = ingest(batch)
  writeSystemLog({
    level: 'info',
    source: 'mail.imap.poll',
    message: `IMAP poll: ${result.ingested} ingested, ${result.skipped} skipped, ${result.remaining} remaining`,
    context: { ingested: result.ingested, skipped: result.skipped, remaining: result.remaining },
  })
  announce(result)
  emitChanged('system-logs')
  return result
}

let loadedAt = Date.now()
let seenData: DemoData | null = null

function deliverDue(): void {
  const data = d()
  // A DemoBar reset rebuilds the seed: restart the delivery clock with it.
  if (seenData !== data) {
    if (seenData !== null) loadedAt = Date.now()
    seenData = data
  }
  const elapsed = (Date.now() - loadedAt) / 1000
  const due = data.pendingMails.filter((p) => p.deliverAfterSec !== null && p.deliverAfterSec <= elapsed)
  if (due.length === 0) return
  announce(ingest(due))
}

/* -------------------------------------------------------------- projects */

function projectOr404(id: string): Project {
  const project = d().projects.find((p) => p.id === id)
  if (!project) throw notFound()
  return project
}

function requireOpen(project: Project): void {
  if (project.state !== 'open') throw conflict(`Project is ${project.state}`)
}

function parsePrice(value: unknown, field: string, required: boolean): number | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw DemoApiError.validation({ [field]: 'This field is required.' })
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) throw DemoApiError.validation({ [field]: 'Enter a number of 0 or more.' })
  if (n > 10_000_000) throw DemoApiError.validation({ [field]: 'Ensure this value is at most 10000000.' })
  return Math.round(n * 100) / 100
}

function projectRow(p: Project) {
  const partner = partnerLite(p.partnerId)
  return {
    ...p,
    partnerName: partner?.name ?? '-',
    currency: partner?.currency ?? 'GEL',
    taskCount: d().tasks.filter((t) => t.projectId === p.id).length,
  }
}

function projectDetail(p: Project) {
  const tasks = d().tasks.filter((t) => t.projectId === p.id)
  const candidates = d().tasks.filter((t) => t.partnerId === p.partnerId && !t.projectId && t.state !== 'cancelled' && t.state !== 'verified')
  const invoice = p.billedInvoiceId ? d().invoices.find((i) => i.id === p.billedInvoiceId) : null
  return {
    project: projectRow(p),
    partner: partnerLite(p.partnerId),
    tasks: tasks.sort((a, b) => b.number - a.number).map((t) => taskLite(t)),
    candidates: candidates.sort((a, b) => b.number - a.number).map((t) => taskLite(t)),
    billedInvoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
  }
}

/* -------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* dashboard */
  api.register('GET', '/l1/dashboard', () => {
    const me = requireStaff('l1_employee')
    const data = d()
    const newMails = data.mails.filter((m) => m.status === 'new').length
    const triagedMails = data.mails.filter((m) => m.status === 'triaged').length
    const followups = data.mails.filter((m) => m.status === 'followup').length
    const open = data.tasks.filter((t) => (OPEN_STATES as readonly string[]).includes(t.state))
    const mine = open.filter((t) => data.taskAssignees.some((a) => a.taskId === t.id && a.userId === me.id))
    const nextUp = data.threads
      .filter((t) => t.status === 'new')
      .sort((a, b) => a.firstMessageAt.localeCompare(b.firstMessageAt))
      .slice(0, 6)
      .map(threadRow)
    return {
      newMails,
      triagedMails,
      followups,
      openTasks: open.length,
      myAssigned: mine.length,
      newReplies: data.tasks.filter((t) => t.hasNewReplies).length,
      openProjects: data.projects.filter((p) => p.state === 'open').length,
      pendingInbox: data.pendingMails.length,
      trends: {
        newMails: syntheticTrend(newMails, 6, true),
        triagedMails: syntheticTrend(triagedMails, 4),
        openTasks: syntheticTrend(open.length, 8),
        myAssigned: syntheticTrend(mine.length, 5),
      },
      nextUp,
    }
  })

  /* inbox: threads */
  api.register('GET', '/threads', ({ params }) => {
    requireStaff('l1_employee')
    const status = parseStatus(params.status)
    const q = str(params.q).toLowerCase()
    const from = str(params.from).toLowerCase()
    const since = str(params.since)
    let threads = d().threads
    if (status) threads = threads.filter((t) => t.status === status)
    if (since) threads = threads.filter((t) => t.lastMessageAt >= since)
    if (q || from) {
      threads = threads.filter((t) => {
        const mails = threadMails(t.id)
        if (q && !(t.subject.toLowerCase().includes(q) || mails.some((m) => mailMatches(m, q)))) return false
        if (from && !mails.some((m) => m.fromAddr.toLowerCase().includes(from) || m.fromName.toLowerCase().includes(from))) return false
        return true
      })
    }
    const rows = threads.map(threadRow)
    const sorted = sortRows(
      rows,
      params,
      {
        lastMessageAt: (r) => r.lastMessageAt,
        subject: (r) => r.subject.toLowerCase(),
        from: (r) => r.latestFromName.toLowerCase(),
        messageCount: (r) => r.messageCount,
        status: (r) => r.status,
      },
      'lastMessageAt',
    )
    return paginate(sorted, params)
  })

  /* inbox: flat */
  api.register('GET', '/mails', ({ params }) => {
    requireStaff('l1_employee')
    const status = parseStatus(params.status)
    const q = str(params.q).toLowerCase()
    const from = str(params.from).toLowerCase()
    const since = str(params.since)
    let mails = d().mails
    if (status) mails = mails.filter((m) => m.status === status)
    if (since) mails = mails.filter((m) => m.receivedAt >= since)
    if (q) mails = mails.filter((m) => mailMatches(m, q))
    if (from) mails = mails.filter((m) => m.fromAddr.toLowerCase().includes(from) || m.fromName.toLowerCase().includes(from))
    const sorted = sortRows(
      mails.map(mailRow),
      params,
      {
        receivedAt: (r) => r.receivedAt,
        subject: (r) => r.subject.toLowerCase(),
        from: (r) => r.fromName.toLowerCase(),
        status: (r) => r.status,
      },
      'receivedAt',
    )
    return paginate(sorted, params)
  })

  api.register('GET', '/mails/:id', ({ path }) => {
    requireStaff('l1_employee')
    const mail = d().mails.find((m) => m.id === path.id)
    if (!mail) throw notFound()
    const thread = d().threads.find((t) => t.id === mail.threadId)
    const attachments = attachmentsOf(mail)
    return {
      mail,
      attachments,
      linkedTasks: linkedTasksForMail(mail.id),
      thread: thread ? { id: thread.id, subject: thread.subject, messageCount: thread.messageCount, status: thread.status } : null,
      partner: partnerLite(mail.partnerId),
      raw: rawMessage(mail, attachments),
    }
  })

  api.register('POST', '/mails/:id/ignore', ({ path }) => {
    requireStaff('l1_employee')
    const mail = d().mails.find((m) => m.id === path.id)
    if (!mail) throw notFound()
    if (!IGNORABLE.includes(mail.status)) throw conflict(`Cannot ignore a mail in status ${mail.status}`)
    const before = { status: mail.status }
    mail.status = 'ignored'
    refreshThread(d(), mail.threadId)
    recordAudit({ action: 'mail.ignore', entityType: 'mail', entityId: mail.id, partnerId: mail.partnerId, before, after: { status: mail.status } })
    emitChanged('mails', 'threads', 'dashboards', 'audit')
    return mailRow(mail)
  })

  api.register('POST', '/mails/:id/triage', ({ path }) => {
    requireStaff('l1_employee')
    const mail = d().mails.find((m) => m.id === path.id)
    if (!mail) throw notFound()
    if (mail.status !== 'new') return mailRow(mail)
    mail.status = 'triaged'
    refreshThread(d(), mail.threadId)
    recordAudit({ action: 'mail.triage', entityType: 'mail', entityId: mail.id, partnerId: mail.partnerId, before: { status: 'new' }, after: { status: 'triaged' } })
    emitChanged('mails', 'threads', 'dashboards', 'audit')
    return mailRow(mail)
  })

  /* threads */
  api.register('GET', '/threads/:id', ({ path }) => {
    requireStaff('l1_employee')
    const thread = d().threads.find((t) => t.id === path.id)
    if (!thread) throw notFound()
    return {
      thread: threadRow(thread),
      participants: thread.participantAddrs,
      mails: threadMails(thread.id).map((m) => ({ ...m, attachments: attachmentsOf(m) })),
      linkedTasks: linkedTasksForThread(thread.id),
      partner: partnerLite(thread.partnerId),
    }
  })

  api.register('POST', '/threads/:id/tasks', ({ path, body }) => {
    const me = requireStaff('l1_employee')
    const thread = d().threads.find((t) => t.id === path.id)
    if (!thread) throw notFound()
    const taskId = str(obj(body).taskId)
    if (!taskId) throw DemoApiError.validation({ taskId: 'This field is required.' })
    const task = d().tasks.find((t) => t.id === taskId)
    if (!task) throw DemoApiError.validation({ taskId: 'Task not found.' })
    if (d().taskThreadLinks.some((l) => l.threadId === thread.id && l.taskId === task.id)) throw conflict('Thread is already linked to this task')
    d().taskThreadLinks.push({ taskId: task.id, threadId: thread.id, linkedAt: nowIso(), linkedById: me.id })
    recordAudit({ action: 'task.attach_thread', entityType: 'task', entityId: task.id, partnerId: task.partnerId, after: { threadId: thread.id } })
    emitChanged('threads', 'tasks', 'mails', 'audit')
    return { ok: true }
  })

  api.register('DELETE', '/threads/:id/tasks/:taskId', ({ path }) => {
    requireStaff('l1_employee')
    const data = d()
    const idx = data.taskThreadLinks.findIndex((l) => l.threadId === path.id && l.taskId === path.taskId)
    if (idx < 0) throw notFound()
    data.taskThreadLinks.splice(idx, 1)
    const task = data.tasks.find((t) => t.id === path.taskId)
    recordAudit({ action: 'task.detach_thread', entityType: 'task', entityId: path.taskId, partnerId: task?.partnerId ?? null, before: { threadId: path.id } })
    emitChanged('threads', 'tasks', 'mails', 'audit')
    return undefined
  })

  /* attachments (staff, or a partner admin for their own partner's mail) */
  api.register('GET', '/attachments/:id', ({ path }) => {
    const me = currentAccount()
    const attachment = d().attachments.find((a) => a.id === path.id)
    if (me?.realm === 'partner') {
      const { partner } = requirePartnerAdmin()
      if (!attachment) throw notFound()
      const mail = d().mails.find((m) => m.id === attachment.mailId)
      if (!mail || mail.partnerId !== partner.id) throw forbidden()
      return attachment
    }
    requireStaff('l1_employee')
    if (!attachment) throw notFound()
    return attachment
  })

  /* Poll now (superadmin) */
  api.register('POST', '/mail/poll', () => {
    requireStaff('superadmin')
    const r = pollNow(5)
    return { ingested: r.ingested, skipped: r.skipped, remaining: r.remaining, mailIds: r.mailIds }
  })

  /* projects */
  api.register('GET', '/projects', ({ params }) => {
    requireStaff('l1_employee')
    const q = str(params.q).toLowerCase()
    let rows = d().projects.map(projectRow)
    if (params.state) rows = rows.filter((p) => p.state === params.state)
    if (params.partnerId) rows = rows.filter((p) => p.partnerId === params.partnerId)
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.partnerName.toLowerCase().includes(q) || `prj-${p.number}`.includes(q))
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const partners = d()
      .partners.filter((p) => p.isActive && !p.deletedAt)
      .map((p) => ({ id: p.id, name: p.name, currency: p.currency }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { rows, partners }
  })

  api.register('POST', '/projects', ({ body }) => {
    requireStaff('l1_employee')
    const input = obj(body)
    const partnerId = str(input.partnerId)
    const name = str(input.name)
    const description = str(input.description)
    const errors: Record<string, string> = {}
    const partner = d().partners.find((p) => p.id === partnerId)
    if (!partnerId) errors.partnerId = 'This field is required.'
    else if (!partner || !partner.isActive) errors.partnerId = 'Select an active partner.'
    if (!name) errors.name = 'This field is required.'
    else if (name.length > 300) errors.name = 'Ensure this field has no more than 300 characters.'
    if (description.length > 20000) errors.description = 'Ensure this field has no more than 20000 characters.'
    if (Object.keys(errors).length) throw DemoApiError.validation(errors)
    const price = parsePrice(input.price, 'price', false)
    const number = d().projects.reduce((max, p) => Math.max(max, p.number), 100) + 1
    const project: Project = {
      id: store.nextId('prj_'),
      number,
      partnerId,
      name,
      description,
      state: 'open',
      price,
      pricingPending: price === null,
      priceAdjustNote: null,
      requestedByPartner: false,
      createdAt: nowIso(),
      completedAt: null,
      cancelledAt: null,
      billedInvoiceId: null,
    }
    d().projects.push(project)
    recordAudit({ action: 'project.create', entityType: 'project', entityId: project.id, partnerId, after: { name, price } })
    emitChanged('projects', 'dashboards', 'audit')
    return projectRow(project)
  })

  api.register('GET', '/projects/:id', ({ path }) => {
    requireStaff('l1_employee')
    return projectDetail(projectOr404(path.id))
  })

  api.register('PATCH', '/projects/:id', ({ path, body }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    if (project.state === 'cancelled') throw conflict('Project is cancelled')
    const input = obj(body)
    const before = { name: project.name, description: project.description }
    if ('name' in input) {
      const name = str(input.name)
      if (!name) throw DemoApiError.validation({ name: 'This field is required.' })
      if (name.length > 300) throw DemoApiError.validation({ name: 'Ensure this field has no more than 300 characters.' })
      project.name = name
    }
    if ('description' in input) {
      const description = str(input.description)
      if (description.length > 20000) throw DemoApiError.validation({ description: 'Ensure this field has no more than 20000 characters.' })
      project.description = description
    }
    recordAudit({ action: 'project.update', entityType: 'project', entityId: project.id, partnerId: project.partnerId, before, after: { name: project.name, description: project.description } })
    emitChanged('projects', 'audit')
    return projectDetail(project)
  })

  api.register('POST', '/projects/:id/tasks', ({ path, body }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    requireOpen(project)
    const taskId = str(obj(body).taskId)
    if (!taskId) throw DemoApiError.validation({ taskId: 'This field is required.' })
    const task = d().tasks.find((t) => t.id === taskId)
    if (!task) throw DemoApiError.validation({ taskId: 'Task not found.' })
    if (task.partnerId !== project.partnerId) throw DemoApiError.validation({ taskId: 'The task belongs to another partner.' })
    if (task.projectId) throw conflict('The task is already in a project')
    task.projectId = project.id
    task.updatedAt = nowIso()
    recordAudit({ action: 'project.add_task', entityType: 'project', entityId: project.id, partnerId: project.partnerId, after: { taskId: task.id } })
    emitChanged('projects', 'tasks', 'audit')
    return projectDetail(project)
  })

  api.register('DELETE', '/projects/:id/tasks/:taskId', ({ path }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    requireOpen(project)
    const task = d().tasks.find((t) => t.id === path.taskId && t.projectId === project.id)
    if (!task) throw notFound()
    task.projectId = null
    task.updatedAt = nowIso()
    recordAudit({ action: 'project.remove_task', entityType: 'project', entityId: project.id, partnerId: project.partnerId, before: { taskId: task.id } })
    emitChanged('projects', 'tasks', 'audit')
    return undefined
  })

  api.register('POST', '/projects/:id/price', ({ path, body }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    requireOpen(project)
    const price = parsePrice(obj(body).price, 'price', true)
    const before = { price: project.price, pricingPending: project.pricingPending }
    project.price = price
    project.pricingPending = false
    recordAudit({ action: 'project.set_price', entityType: 'project', entityId: project.id, partnerId: project.partnerId, before, after: { price, pricingPending: false } })
    emitChanged('projects', 'audit')
    return projectDetail(project)
  })

  api.register('POST', '/projects/:id/complete', ({ path, body }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    requireOpen(project)
    const input = obj(body)
    const finalPrice = parsePrice(input.finalPrice, 'finalPrice', true)
    const adjustNote = str(input.adjustNote)
    if (adjustNote.length > 2000) throw DemoApiError.validation({ adjustNote: 'Ensure this field has no more than 2000 characters.' })
    const before = { state: project.state, price: project.price }
    project.state = 'completed'
    project.completedAt = nowIso()
    project.price = finalPrice
    project.pricingPending = false
    project.priceAdjustNote = adjustNote || null
    recordAudit({ action: 'project.complete', entityType: 'project', entityId: project.id, partnerId: project.partnerId, before, after: { state: 'completed', price: finalPrice, adjustNote: project.priceAdjustNote } })
    emitChanged('projects', 'dashboards', 'reports', 'audit')
    return projectDetail(project)
  })

  api.register('POST', '/projects/:id/cancel', ({ path }) => {
    requireStaff('l1_employee')
    const project = projectOr404(path.id)
    requireOpen(project)
    project.state = 'cancelled'
    project.cancelledAt = nowIso()
    recordAudit({ action: 'project.cancel', entityType: 'project', entityId: project.id, partnerId: project.partnerId, before: { state: 'open' }, after: { state: 'cancelled' } })
    emitChanged('projects', 'dashboards', 'audit')
    return projectDetail(project)
  })

  /* jobs + simulators */
  registerJob('mail.imap.poll', () => {
    const r = pollNow(5)
    return { ok: true, summary: `${r.ingested} mails ingested, ${r.skipped} skipped, ${r.remaining} remaining` }
  })

  loadedAt = Date.now()
  seenData = d()
  every(15_000, deliverDue)
}
