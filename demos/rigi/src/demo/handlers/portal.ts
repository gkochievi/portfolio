/**
 * Partner portal handlers: tasks, catalogue, projects, documents, task chat.
 * Owner: portal. Every handler scopes to `requirePartnerAdmin().partner` and
 * never returns internal-only messages or another partner's records.
 */
import { DemoApiError, notFound, type MockApi } from '@portfolio/demo-kit'

import type {
  Currency,
  DemoData,
  ISODate,
  ISODateTime,
  Partner,
  PartnerDocument,
  Project,
  Task,
  TaskMessage,
  TaskState,
  TaskTemplate,
} from '@/types'

import { emitChanged, notify, nowIso, requirePartnerAdmin } from '../ctx'
import { endOfDayIso, periodOf } from '../domain/dates'
import { applyTransition, isOverdue } from '../domain/tasks'
import { isBillableTask, debitOnVerify, periodUsage } from '../domain/points'
import { round2 } from '../domain/money'
import { bus, session, store } from '../runtime'

/* ------------------------------------------------------------------- DTOs */

export interface PortalTaskRow {
  id: string
  number: number
  title: string
  templateId: string | null
  templateName: string | null
  projectId: string | null
  state: TaskState
  points: number | null
  pricingPending: boolean
  deadline: ISODateTime | null
  isOverdue: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface PortalCatalogueItem {
  id: string
  name: string
  description: string
  points: number | null
  isFreeform: boolean
}

export interface PortalLinkedEmail {
  id: string
  subject: string
  fromName: string
  fromAddr: string
  toAddrs: string[]
  receivedAt: ISODateTime
  bodyText: string
}

export interface PortalHistoryRow {
  id: string
  fromState: TaskState | null
  toState: TaskState
  changedAt: ISODateTime
  /** The partner's own moves read as "You" in the UI. */
  byYou: boolean
  changedByName: string
  note: string | null
}

/** What approving would bill, for the confirm dialog. */
export interface PortalVerifyPreview {
  billable: boolean
  points: number
  freeRemaining: number
  freeCovered: number
  chargeable: number
  ratePerPoint: number
  chargeAmount: number
  currency: Currency
}

export interface PortalTaskDetail extends PortalTaskRow {
  description: string
  finishedAt: ISODateTime | null
  verifiedAt: ISODateTime | null
  canEdit: boolean
  canCancel: boolean
  canVerify: boolean
  emails: PortalLinkedEmail[]
  history: PortalHistoryRow[]
  verifyPreview: PortalVerifyPreview
  project: { id: string; number: number; name: string } | null
}

export interface PortalProjectRow {
  id: string
  number: number
  name: string
  description: string
  state: Project['state']
  price: number | null
  pricingPending: boolean
  currency: Currency
  taskCount: number
  createdAt: ISODateTime
}

export interface PortalProjectDetail extends PortalProjectRow {
  tasks: PortalTaskRow[]
}

/* ---------------------------------------------------------------- helpers */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

type Body = Record<string, unknown>

function asBody(body: unknown): Body {
  return body && typeof body === 'object' ? (body as Body) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function templateFor(data: DemoData, partner: Partner, templateId: string | null) {
  if (!templateId) return null
  const base = data.taskTemplates.find((t) => t.id === templateId)
  if (!base) return null
  const override = data.templateOverrides.find((o) => o.templateId === templateId && o.partnerId === partner.id)
  return {
    id: base.id,
    name: override?.nameOverride?.trim() || base.name,
    description: override?.descriptionOverride?.trim() || base.description,
    points: override?.points ?? base.defaultPoints,
    isFreeform: base.isFreeform,
    hidden: Boolean(override?.isHidden),
    base,
  }
}

function catalogue(data: DemoData, partner: Partner): PortalCatalogueItem[] {
  return [...data.taskTemplates]
    .filter((t: TaskTemplate) => t.isActive && !t.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => templateFor(data, partner, t.id))
    .filter((t): t is NonNullable<typeof t> => t !== null && !t.hidden)
    .map((t) => ({ id: t.id, name: t.name, description: t.description, points: t.isFreeform ? null : t.points, isFreeform: t.isFreeform }))
}

function taskRow(data: DemoData, partner: Partner, task: Task): PortalTaskRow {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    templateId: task.templateId,
    templateName: templateFor(data, partner, task.templateId)?.name ?? null,
    projectId: task.projectId,
    state: task.state,
    points: task.points,
    pricingPending: task.pricingPending,
    deadline: task.deadline,
    isOverdue: isOverdue(task),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function ownTask(partner: Partner, id: string): Task {
  const task = store.data.tasks.find((t) => t.id === id && t.partnerId === partner.id)
  if (!task) throw notFound()
  return task
}

const NOT_EDITABLE: readonly TaskState[] = ['finished', 'verified', 'cancelled']

function verifyPreview(partner: Partner, task: Task): PortalVerifyPreview {
  const billable = isBillableTask(task)
  const { year, month } = periodOf(new Date())
  const usage = periodUsage(store.data, partner.id, year, month)
  const points = billable ? round2(task.points ?? 0) : 0
  const freeRemaining = round2(Math.max(0, usage.allowance - usage.freeUsed))
  const freeCovered = round2(Math.min(points, freeRemaining))
  const chargeable = round2(points - freeCovered)
  return {
    billable,
    points,
    freeRemaining,
    freeCovered,
    chargeable,
    ratePerPoint: usage.ratePerPoint,
    chargeAmount: round2(chargeable * usage.ratePerPoint),
    currency: partner.currency,
  }
}

function taskDetail(partner: Partner, adminName: string, task: Task): PortalTaskDetail {
  const data = store.data
  const mailIds = data.taskMailLinks.filter((l) => l.taskId === task.id).map((l) => l.mailId)
  const emails = data.mails
    .filter((m) => mailIds.includes(m.id) && (m.partnerId === null || m.partnerId === partner.id))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map<PortalLinkedEmail>((m) => ({
      id: m.id,
      subject: m.subject,
      fromName: m.fromName,
      fromAddr: m.fromAddr,
      toAddrs: m.toAddrs,
      receivedAt: m.receivedAt,
      bodyText: m.bodyText,
    }))
  const history = data.taskHistory
    .filter((h) => h.taskId === task.id)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    .map<PortalHistoryRow>((h) => ({
      id: h.id,
      fromState: h.fromState,
      toState: h.toState,
      changedAt: h.changedAt,
      byYou: h.changedById === null,
      changedByName: h.changedById === null ? adminName : h.changedByName,
      note: h.note,
    }))
  const project = task.projectId ? data.projects.find((p) => p.id === task.projectId) : undefined
  const open = !NOT_EDITABLE.includes(task.state)
  return {
    ...taskRow(data, partner, task),
    description: task.description,
    finishedAt: task.finishedAt,
    verifiedAt: task.verifiedAt,
    canEdit: open,
    canCancel: open,
    canVerify: task.state === 'finished',
    emails,
    history,
    verifyPreview: verifyPreview(partner, task),
    project: project ? { id: project.id, number: project.number, name: project.name } : null,
  }
}

function checkTitle(errors: Record<string, string>, title: string) {
  if (!title.trim()) errors.title = 'Enter a title.'
  else if (title.length > 500) errors.title = 'Title must be 500 characters or fewer.'
}

function checkDescription(errors: Record<string, string>, description: string) {
  if (description.length > 20000) errors.description = 'Description must be 20,000 characters or fewer.'
}

/** `YYYY-MM-DD` -> 23:59:59 that day; empty -> null. */
function parseDeadline(errors: Record<string, string>, value: unknown): ISODateTime | null {
  if (value === null || value === undefined || value === '') return null
  const text = str(value)
  if (DAY_RE.test(text)) {
    const iso = endOfDayIso(text as ISODate)
    if (Number.isNaN(new Date(iso).getTime())) errors.deadline = 'Enter a valid date.'
    return iso
  }
  if (Number.isNaN(new Date(text).getTime())) {
    errors.deadline = 'Enter a valid date.'
    return null
  }
  return new Date(text).toISOString()
}

function throwIfErrors(errors: Record<string, string>) {
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
}

function projectRow(partner: Partner, project: Project): PortalProjectRow {
  return {
    id: project.id,
    number: project.number,
    name: project.name,
    description: project.description,
    state: project.state,
    price: project.price,
    pricingPending: project.pricingPending || project.price === null,
    currency: partner.currency,
    taskCount: store.data.tasks.filter((t) => t.projectId === project.id && t.partnerId === partner.id).length,
    createdAt: project.createdAt,
  }
}

function postPartnerMessage(task: Task, accountId: string, accountName: string, body: string): TaskMessage {
  const message: TaskMessage = {
    id: store.nextId('msg_'),
    taskId: task.id,
    authorKind: 'partner',
    authorId: accountId,
    authorName: accountName,
    body,
    internalOnly: false,
    createdAt: nowIso(),
  }
  store.data.taskMessages.push(message)
  return message
}

/* ------------------------------------------------------------- simulation */

/** Only toast when the signed-in persona is the partner admin who triggered it. */
function notifyIfStillSignedIn(accountId: string, notice: Parameters<typeof notify>[0]) {
  if (session.current()?.id === accountId) notify(notice)
}

/** Staff review a freeform task a little after it arrives and set its points. */
function simulateTaskPricing(taskId: string, accountId: string) {
  window.setTimeout(() => {
    const task = store.data.tasks.find((t) => t.id === taskId)
    if (!task || !task.pricingPending || task.state === 'cancelled') return
    task.points = [1.5, 2, 3][task.number % 3] ?? 2
    task.pricingPending = false
    task.updatedAt = nowIso()
    emitChanged('tasks', 'dashboards')
    notifyIfStillSignedIn(accountId, {
      tone: 'info',
      title: 'portal:notices.taskPriced',
      values: { number: task.number, points: task.points },
      href: `/partner/tasks/${task.id}`,
    })
  }, 22_000)
}

/** Staff price a project request shortly after it is submitted. */
function simulateProjectPricing(projectId: string, accountId: string) {
  window.setTimeout(() => {
    const project = store.data.projects.find((p) => p.id === projectId)
    if (!project || !project.pricingPending || project.state !== 'open') return
    project.price = [1800, 2400, 3200][project.number % 3] ?? 2400
    project.pricingPending = false
    emitChanged('projects', 'dashboards')
    notifyIfStillSignedIn(accountId, {
      tone: 'info',
      title: 'portal:notices.projectPriced',
      values: { number: project.number },
      href: `/partner/projects/${project.id}`,
    })
  }, 18_000)
}

/* --------------------------------------------------------------- register */

export function register(api: MockApi): void {
  /* ----- tasks */

  api.register('GET', '/portal/tasks', () => {
    const { partner } = requirePartnerAdmin()
    return store.data.tasks
      .filter((t) => t.partnerId === partner.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => taskRow(store.data, partner, t))
  })

  api.register('GET', '/portal/task-templates', () => {
    const { partner } = requirePartnerAdmin()
    return catalogue(store.data, partner)
  })

  api.register('POST', '/portal/tasks', ({ body }) => {
    const { account, partner } = requirePartnerAdmin()
    const input = asBody(body)
    const errors: Record<string, string> = {}
    const title = str(input.title).trim()
    const description = str(input.description)
    const template = catalogue(store.data, partner).find((t) => t.id === input.templateId)
    if (!template) errors.templateId = 'Pick a template.'
    checkTitle(errors, title)
    checkDescription(errors, description)
    const deadline = parseDeadline(errors, input.deadline)
    throwIfErrors(errors)
    if (!template) throw notFound()

    const at = nowIso()
    const task: Task = {
      id: store.nextId('tsk_'),
      number: store.data.tasks.reduce((max, t) => Math.max(max, t.number), 1100) + 1,
      partnerId: partner.id,
      templateId: template.id,
      projectId: null,
      title,
      description,
      state: 'accepted',
      points: template.isFreeform ? null : template.points,
      pricingPending: template.isFreeform,
      deadline,
      createdById: null,
      createdByPartnerAdminId: account.id,
      finishedAt: null,
      verifiedAt: null,
      hasNewReplies: false,
      createdAt: at,
      updatedAt: at,
    }
    store.data.tasks.unshift(task)
    store.data.taskHistory.push({
      id: store.nextId('hist_'),
      taskId: task.id,
      fromState: null,
      toState: 'accepted',
      changedById: null,
      changedByName: account.name,
      changedAt: at,
      note: null,
    })
    emitChanged('tasks', 'dashboards')
    if (task.pricingPending) simulateTaskPricing(task.id, account.id)
    return taskDetail(partner, account.name, task)
  })

  api.register('GET', '/portal/tasks/:id', ({ path }) => {
    const { account, partner } = requirePartnerAdmin()
    return taskDetail(partner, account.name, ownTask(partner, String(path.id)))
  })

  api.register('PATCH', '/portal/tasks/:id', ({ path, body }) => {
    const { account, partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    if (NOT_EDITABLE.includes(task.state)) throw new DemoApiError(409, 'This task can no longer be edited')
    const input = asBody(body)
    const errors: Record<string, string> = {}
    const patch: Partial<Pick<Task, 'title' | 'description' | 'deadline'>> = {}
    if ('title' in input) {
      const title = str(input.title).trim()
      checkTitle(errors, title)
      patch.title = title
    }
    if ('description' in input) {
      const description = str(input.description)
      checkDescription(errors, description)
      patch.description = description
    }
    if ('deadline' in input) patch.deadline = parseDeadline(errors, input.deadline)
    throwIfErrors(errors)
    const changed = (Object.keys(patch) as Array<keyof typeof patch>).some((k) => patch[k] !== task[k])
    if (changed) {
      Object.assign(task, patch)
      task.updatedAt = nowIso()
      emitChanged('tasks', 'dashboards')
    }
    return taskDetail(partner, account.name, task)
  })

  api.register('POST', '/portal/tasks/:id/cancel', ({ path, body }) => {
    const { account, partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    const note = str(asBody(body).note).trim().slice(0, 2000)
    applyTransition(store.data, task, 'cancelled', { actorId: null, actorName: account.name, note: note || null, role: 'partner' })
    emitChanged('tasks', 'dashboards')
    return taskDetail(partner, account.name, task)
  })

  api.register('POST', '/portal/tasks/:id/verify', ({ path }) => {
    const { account, partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    const at = nowIso()
    applyTransition(store.data, task, 'verified', { actorId: null, actorName: account.name, at, role: 'partner' })
    debitOnVerify(store.data, task, at, account.name)
    emitChanged('tasks', 'points', 'dashboards', 'reports')
    return taskDetail(partner, account.name, task)
  })

  api.register('POST', '/portal/tasks/:id/send-back', ({ path, body }) => {
    const { account, partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    const comment = str(asBody(body).comment).trim()
    if (!comment) throw DemoApiError.validation({ comment: 'Tell us what still needs work.' })
    if (comment.length > 10000) throw DemoApiError.validation({ comment: 'Comment must be 10,000 characters or fewer.' })
    applyTransition(store.data, task, 'in_progress', { actorId: null, actorName: account.name, note: comment, role: 'partner' })
    const message = postPartnerMessage(task, account.id, account.name, comment)
    emitChanged('tasks', 'task-messages', 'dashboards')
    bus.emit('task.message', { taskId: task.id, authorKind: 'partner', messageId: message.id })
    return taskDetail(partner, account.name, task)
  })

  /* ----- chat */

  api.register('GET', '/portal/tasks/:id/messages', ({ path }) => {
    const { partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    return store.data.taskMessages
      .filter((m) => m.taskId === task.id && !m.internalOnly)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m): TaskMessage => ({ ...m, internalOnly: false }))
  })

  api.register('POST', '/portal/tasks/:id/messages', ({ path, body }) => {
    const { account, partner } = requirePartnerAdmin()
    const task = ownTask(partner, String(path.id))
    const text = str(asBody(body).body).trim()
    if (!text) throw DemoApiError.validation({ body: 'Write a message first.' })
    if (text.length > 10000) throw DemoApiError.validation({ body: 'Message must be 10,000 characters or fewer.' })
    const message = postPartnerMessage(task, account.id, account.name, text)
    task.updatedAt = message.createdAt
    emitChanged('task-messages', 'tasks')
    bus.emit('task.message', { taskId: task.id, authorKind: 'partner', messageId: message.id })
    return message
  })

  /* ----- projects */

  api.register('GET', '/portal/projects', () => {
    const { partner } = requirePartnerAdmin()
    return store.data.projects
      .filter((p) => p.partnerId === partner.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => projectRow(partner, p))
  })

  api.register('POST', '/portal/projects', ({ body }) => {
    const { account, partner } = requirePartnerAdmin()
    const input = asBody(body)
    const errors: Record<string, string> = {}
    const name = str(input.name).trim()
    const description = str(input.description)
    if (!name) errors.name = 'Enter a project name.'
    else if (name.length > 300) errors.name = 'Name must be 300 characters or fewer.'
    if (description.length > 20000) errors.description = 'Description must be 20,000 characters or fewer.'
    throwIfErrors(errors)
    const project: Project = {
      id: store.nextId('prj_'),
      number: store.data.projects.reduce((max, p) => Math.max(max, p.number), 0) + 1,
      partnerId: partner.id,
      name,
      description,
      state: 'open',
      price: null,
      pricingPending: true,
      priceAdjustNote: null,
      requestedByPartner: true,
      createdAt: nowIso(),
      completedAt: null,
      cancelledAt: null,
      billedInvoiceId: null,
    }
    store.data.projects.unshift(project)
    emitChanged('projects', 'dashboards')
    simulateProjectPricing(project.id, account.id)
    return projectRow(partner, project)
  })

  api.register('GET', '/portal/projects/:id', ({ path }) => {
    const { partner } = requirePartnerAdmin()
    const project = store.data.projects.find((p) => p.id === path.id && p.partnerId === partner.id)
    if (!project) throw notFound()
    const detail: PortalProjectDetail = {
      ...projectRow(partner, project),
      tasks: store.data.tasks
        .filter((t) => t.projectId === project.id && t.partnerId === partner.id)
        .sort((a, b) => a.number - b.number)
        .map((t) => taskRow(store.data, partner, t)),
    }
    return detail
  })

  /* ----- documents */

  api.register('GET', '/portal/documents', () => {
    const { partner } = requirePartnerAdmin()
    return store.data.partnerDocuments
      .filter((d) => d.partnerId === partner.id)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title))
      .map((d): PartnerDocument => ({ ...d, versions: [...d.versions].sort((a, b) => a.versionNo - b.versionNo) }))
  })
}
