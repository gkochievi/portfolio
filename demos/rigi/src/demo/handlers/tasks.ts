/**
 * Mock API handlers for the task queue, workspace and technician area.
 * Owner: tasks. Patterns are registered WITHOUT the /api prefix.
 *
 * Also hosts the chat simulator: a partner message gets a friendly canned
 * staff reply about six seconds later (see `startChatSimulator`).
 */
import { conflict, createRandom, DemoApiError, forbidden, notFound, type MockApi } from '@portfolio/demo-kit'

import type {
  AssigneeDto,
  TaskDetail,
  TaskDashboard,
  TaskHistoryDto,
  TaskMessageDto,
  TaskRow,
  TechnicianDto,
  TemplateOption,
} from '@/features/tasks/api'
import type { DemoData, ISODateTime, Mail, StaffUser, Task, TaskMessage, TaskState } from '@/types'

import { ACCOUNT_IDS } from '../accounts'
import { currentStaffUser, emitChanged, notify, nowIso, recordAudit, requireStaff } from '../ctx'
import { applyTransition, allowedTransitions, CLOSED_STATES, isOverdue, OPEN_STATES, TASK_TRANSITIONS } from '../domain/tasks'
import { refreshThread } from '../domain/mail'
import { syntheticTrend } from '../domain/trend'
import { bus, store } from '../runtime'

const d = (): DemoData => store.data

/* ------------------------------------------------------------------ utils */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const REQUIRED = 'This field is required.'
const TASK_STATES: TaskState[] = ['accepted', 'in_progress', 'pending', 'testing', 'finished', 'verified', 'cancelled']
const round2 = (n: number): number => Math.round(n * 100) / 100

function findTask(id: string): Task {
  const task = d().tasks.find((t) => t.id === id)
  if (!task) throw notFound('Task not found.')
  return task
}

function staffById(id: string | null | undefined): StaffUser | undefined {
  return id ? d().staffUsers.find((u) => u.id === id) : undefined
}

function partnerNameOf(id: string | null): string | null {
  return id ? (d().partners.find((p) => p.id === id)?.name ?? null) : null
}

function assigneeDtos(taskId: string): AssigneeDto[] {
  return d()
    .taskAssignees.filter((a) => a.taskId === taskId)
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))
    .map((a) => {
      const u = staffById(a.userId)
      return {
        id: a.userId,
        fullName: u?.fullName ?? 'Unknown',
        fullNameKa: u?.fullNameKa ?? u?.fullName ?? 'Unknown',
        technicianType: u?.technicianType ?? null,
        assignedAt: a.assignedAt,
      }
    })
}

function taskRow(task: Task, assignees = assigneeDtos(task.id)): TaskRow {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    state: task.state,
    partnerId: task.partnerId,
    partnerName: partnerNameOf(task.partnerId),
    templateId: task.templateId,
    projectId: task.projectId,
    points: task.points,
    pricingPending: task.pricingPending,
    deadline: task.deadline,
    isOverdue: isOverdue(task),
    hasNewReplies: task.hasNewReplies,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    finishedAt: task.finishedAt,
    assignees,
    mailCount: d().taskMailLinks.filter((l) => l.taskId === task.id).length,
    threadCount: d().taskThreadLinks.filter((l) => l.taskId === task.id).length,
  }
}

function actorOf(): { id: string; name: string; role: ReturnType<typeof requireStaff>['role'] } {
  const me = requireStaff()
  return { id: me.id, name: me.name, role: me.role }
}

function historyDtos(taskId: string): TaskHistoryDto[] {
  return d()
    .taskHistory.filter((h) => h.taskId === taskId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    .map((h) => {
      const u = staffById(h.changedById)
      return { ...h, changedByNameKa: u?.fullNameKa ?? null }
    })
}

function detailOf(task: Task, role: ReturnType<typeof requireStaff>['role']): TaskDetail {
  const base = taskRow(task)
  const mails = d()
    .taskMailLinks.filter((l) => l.taskId === task.id)
    .map((l) => ({ link: l, mail: d().mails.find((m) => m.id === l.mailId) }))
    .filter((x): x is { link: typeof x.link; mail: Mail } => Boolean(x.mail))
    .sort((a, b) => b.mail.receivedAt.localeCompare(a.mail.receivedAt))
    .map(({ link, mail }) => ({
      id: mail.id,
      threadId: mail.threadId,
      subject: mail.subject,
      fromName: mail.fromName,
      fromAddr: mail.fromAddr,
      receivedAt: mail.receivedAt,
      status: mail.status,
      linkedAt: link.linkedAt,
    }))
  const threads = d()
    .taskThreadLinks.filter((l) => l.taskId === task.id)
    .map((l) => ({ link: l, thread: d().threads.find((t) => t.id === l.threadId) }))
    .flatMap(({ link, thread }) =>
      thread
        ? [{ id: thread.id, subject: thread.subject, messageCount: thread.messageCount, lastMessageAt: thread.lastMessageAt, status: thread.status, linkedAt: link.linkedAt }]
        : [],
    )
  const template = task.templateId ? d().taskTemplates.find((t) => t.id === task.templateId) : undefined
  const project = task.projectId ? d().projects.find((p) => p.id === task.projectId) : undefined
  const creator = staffById(task.createdById)
  const partnerAdmin = task.createdByPartnerAdminId ? d().partnerAdmins.find((a) => a.id === task.createdByPartnerAdminId) : undefined
  const finishBlocked = task.pricingPending && TASK_TRANSITIONS[task.state].includes('finished')
  return {
    ...base,
    description: task.description,
    verifiedAt: task.verifiedAt,
    createdBy: creator
      ? { kind: 'staff', name: creator.fullName, nameKa: creator.fullNameKa }
      : partnerAdmin
        ? { kind: 'partner', name: partnerAdmin.fullName, nameKa: null }
        : null,
    template: template ? { id: template.id, name: template.name, isFreeform: template.isFreeform } : null,
    project: project ? { id: project.id, number: project.number, name: project.name } : null,
    allowedTransitions: allowedTransitions(task, role),
    finishBlocked,
    mails,
    threads,
    history: historyDtos(task.id),
  }
}

function openTask(task: Task): void {
  if (!task.hasNewReplies) return
  task.hasNewReplies = false
  // Deferred so the query that is reading this task is not cancelled mid-flight.
  setTimeout(() => emitChanged('tasks', 'dashboards'), 0)
}

/* ------------------------------------------------------------- validation */

function parsePoints(value: unknown, errors: Record<string, string>): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) {
    errors.points = 'Enter a number that is 0 or more.'
    return undefined
  }
  return round2(n)
}

function parseDeadline(value: unknown, errors: Record<string, string>): ISODateTime | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const text = str(value)
  const time = new Date(text).getTime()
  if (!text || Number.isNaN(time)) {
    errors.deadline = 'Enter a valid date.'
    return undefined
  }
  return new Date(time).toISOString()
}

function parseTitle(value: unknown, errors: Record<string, string>, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined
  const title = str(value)
  if (!title) errors.title = REQUIRED
  else if (title.length > 500) errors.title = 'Ensure this field has no more than 500 characters.'
  return title
}

function parseDescription(value: unknown, errors: Record<string, string>): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > 20000) errors.description = 'Ensure this field has no more than 20000 characters.'
  return text
}

function parsePartner(value: unknown, errors: Record<string, string>): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '' || value === 'internal') return null
  const id = str(value)
  if (!d().partners.some((p) => p.id === id && !p.deletedAt)) {
    errors.partnerId = 'Partner not found.'
    return undefined
  }
  return id
}

function fail(errors: Record<string, string>): void {
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
}

/* ----------------------------------------------------------- mail linking */

function markMailsLinked(mailIds: string[]): void {
  const touched = new Set<string>()
  for (const id of mailIds) {
    const mail = d().mails.find((m) => m.id === id)
    if (!mail) continue
    if (mail.status === 'new' || mail.status === 'triaged' || mail.status === 'followup') mail.status = 'task_created'
    touched.add(mail.threadId)
  }
  for (const threadId of touched) refreshThread(d(), threadId)
}

function releaseMail(mailId: string): void {
  const mail = d().mails.find((m) => m.id === mailId)
  if (!mail) return
  const stillLinked = d().taskMailLinks.some((l) => l.mailId === mailId)
  if (!stillLinked && mail.status === 'task_created') mail.status = 'triaged'
  refreshThread(d(), mail.threadId)
}

/* ------------------------------------------------------- chat simulator */

const STAFF_REPLIES_EN = [
  'Thanks for the update. I have your message and I am looking into it now. I will come back to you shortly.',
  'Got it, thank you. I am checking this on our side and will confirm here as soon as I have an answer.',
  'Understood. I have noted it on the task and will pick it up next. Please let me know if anything changes.',
  'Thank you for the details, they help a lot. I will update the task once the change is in place.',
]

const STAFF_REPLIES_KA = [
  'მადლობა ინფორმაციისთვის. შეტყობინება მივიღე და ახლა ვამოწმებ. მალე დაგიბრუნდებით პასუხით.',
  'გასაგებია, გმადლობთ. ვამოწმებ ჩვენს მხარეს და პასუხს აქვე დაგიდასტურებთ.',
  'გასაგებია. ამოცანაზე აღვნიშნე და მომდევნო ეტაპად ავიღებ. თუ რამე შეიცვლება, გთხოვთ შემატყობინოთ.',
  'გმადლობთ დეტალებისთვის, ძალიან გამოდგება. ცვლილების შეტანისთანავე განვაახლებ ამოცანას.',
]

const HAS_GEORGIAN = /[Ⴀ-ჿ]/
const REPLY_DELAY_MS = 6000
let simulatorStarted = false

function startChatSimulator(): void {
  if (simulatorStarted) return
  simulatorStarted = true
  const random = createRandom('rigi-staff-replies')
  bus.on('task.message', ({ taskId, authorKind, messageId }) => {
    if (authorKind !== 'partner') return
    const source = d().taskMessages.find((m) => m.id === messageId)
    const sourceTime = source?.createdAt
    const ka = source ? HAS_GEORGIAN.test(source.body) : false
    window.setTimeout(() => {
      const data = d()
      const task = data.tasks.find((t) => t.id === taskId)
      if (!task) return
      // A reset in between swaps the dataset; only answer when the partner message still exists.
      if (sourceTime && !data.taskMessages.some((m) => m.id === messageId)) return
      const first = data.taskAssignees
        .filter((a) => a.taskId === taskId)
        .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))
        .map((a) => data.staffUsers.find((u) => u.id === a.userId))
        .find((u) => u && u.isActive && !u.deletedAt)
      const author = first ?? data.staffUsers.find((u) => u.id === ACCOUNT_IDS.mariam)
      if (!author) return
      const pool = ka ? STAFF_REPLIES_KA : STAFF_REPLIES_EN
      const reply: TaskMessage = {
        id: store.nextId('msg_'),
        taskId,
        authorKind: 'internal',
        authorId: author.id,
        authorName: author.fullName,
        body: random.pick(pool),
        internalOnly: false,
        createdAt: nowIso(),
      }
      data.taskMessages.push(reply)
      emitChanged('task-messages', 'tasks')
      notify({
        tone: 'info',
        title: 'tasks:notify.staffReplied',
        values: { number: task.number, name: author.fullName },
        href: `/partner/tasks/${task.id}`,
      })
    }, REPLY_DELAY_MS)
  })
}

function messageDto(m: TaskMessage): TaskMessageDto {
  const author = staffById(m.authorId)
  return { ...m, authorNameKa: author?.fullNameKa ?? null }
}

/* ---------------------------------------------------------------- handlers */

export function register(api: MockApi): void {
  startChatSimulator()

  /* ------------------------------------------------------------ lookups */

  api.register('GET', '/technicians', () => {
    requireStaff()
    const rows: TechnicianDto[] = d()
      .staffUsers.filter((u) => u.role === 'technician' && u.isActive && !u.deletedAt)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((u) => ({ id: u.id, fullName: u.fullName, fullNameKa: u.fullNameKa, technicianType: u.technicianType }))
    return rows
  })

  api.register('GET', '/tasks/templates', () => {
    requireStaff('l1_employee')
    const rows: TemplateOption[] = d()
      .taskTemplates.filter((t) => t.isActive && !t.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        defaultPoints: t.defaultPoints,
        isFreeform: t.isFreeform,
      }))
    return rows
  })

  /* ---------------------------------------------------------- dashboard */

  api.register('GET', '/technician/dashboard', () => {
    const me = requireStaff('technician')
    const user = staffById(me.id)
    const data = d()
    const assignedTo = (taskId: string, userId: string) => data.taskAssignees.some((a) => a.taskId === taskId && a.userId === userId)
    const hasAssignee = (taskId: string) => data.taskAssignees.some((a) => a.taskId === taskId)
    const open = data.tasks.filter((t) => OPEN_STATES.includes(t.state))
    const mine = open.filter((t) => assignedTo(t.id, me.id))
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const finishedThisMonth = data.tasks.filter(
      (t) => assignedTo(t.id, me.id) && t.finishedAt && new Date(t.finishedAt).getTime() >= monthStart.getTime(),
    )
    const unassigned = open.filter((t) => !hasAssignee(t.id))
    const plate = [...mine]
      .sort((a, b) => {
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
        if (a.deadline) return -1
        if (b.deadline) return 1
        return a.number - b.number
      })
      .map((t) => taskRow(t))
    const result: TaskDashboard = {
      technicianType: user?.technicianType ?? me.technicianType ?? null,
      myOpen: mine.length,
      finishedThisMonth: finishedThisMonth.length,
      unassigned: unassigned.length,
      allOpen: open.length,
      trends: {
        myOpen: syntheticTrend(mine.length, 2),
        finishedThisMonth: syntheticTrend(finishedThisMonth.length, 2),
        unassigned: syntheticTrend(unassigned.length, 2, true),
        allOpen: syntheticTrend(open.length, 4),
      },
      plate,
    }
    return result
  })

  /* --------------------------------------------------------------- list */

  api.register('GET', '/tasks', ({ params }) => {
    const me = requireStaff('l1_employee', 'technician')
    const data = d()
    const q = str(params.q).toLowerCase().replace(/^tck-?/, '')
    const stateParam = str(params.state)
    const partnerParam = str(params.partnerId)
    const tab = str(params.tab)
    const onlyMine = params.mine === 'true' || params.mine === '1' || tab === 'mine'
    const assigned = (taskId: string) => data.taskAssignees.filter((a) => a.taskId === taskId)

    let tasks = data.tasks
    if (stateParam === 'open') tasks = tasks.filter((t) => OPEN_STATES.includes(t.state))
    else if (TASK_STATES.includes(stateParam as TaskState)) tasks = tasks.filter((t) => t.state === stateParam)
    if (partnerParam === 'internal') tasks = tasks.filter((t) => t.partnerId === null)
    else if (partnerParam) tasks = tasks.filter((t) => t.partnerId === partnerParam)
    if (onlyMine) tasks = tasks.filter((t) => assigned(t.id).some((a) => a.userId === me.id))
    if (tab === 'unassigned') tasks = tasks.filter((t) => OPEN_STATES.includes(t.state) && assigned(t.id).length === 0)
    if (q) {
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          String(t.number).includes(q) ||
          (partnerNameOf(t.partnerId) ?? '').toLowerCase().includes(q),
      )
    }
    const rows = tasks.map((t) => taskRow(t)).sort((a, b) => b.number - a.number)
    return { rows, total: rows.length }
  })

  /* ------------------------------------------------------------- create */

  api.register('POST', '/tasks', ({ body }) => {
    const me = requireStaff('l1_employee')
    const input = obj(body)
    const data = d()
    const errors: Record<string, string> = {}
    const title = parseTitle(input.title, errors, true) ?? ''
    const description = parseDescription(input.description, errors) ?? ''
    const partnerId = parsePartner(input.partnerId, errors) ?? null
    let points = parsePoints(input.points, errors)
    const deadline = parseDeadline(input.deadline, errors) ?? null
    const templateId = str(input.templateId) || null
    const template = templateId ? data.taskTemplates.find((t) => t.id === templateId) : undefined
    if (templateId && !template) errors.templateId = 'Template not found.'
    const assigneeIds = Array.isArray(input.assigneeIds) ? [...new Set(input.assigneeIds.map(str).filter(Boolean))] : []
    for (const id of assigneeIds) {
      const u = staffById(id)
      if (!u || !u.isActive || u.deletedAt) errors.assigneeIds = 'Choose active technicians only.'
    }
    const mailIds = Array.isArray(input.mailIds) ? [...new Set(input.mailIds.map(str).filter(Boolean))] : []
    if (mailIds.some((id) => !data.mails.some((m) => m.id === id))) errors.mailIds = 'Mail not found.'
    const threadId = str(input.threadId) || null
    if (threadId && !data.threads.some((t) => t.id === threadId)) errors.threadId = 'Conversation not found.'
    fail(errors)

    if (points === undefined && template) {
      const override = partnerId ? data.templateOverrides.find((o) => o.templateId === template.id && o.partnerId === partnerId) : undefined
      points = override?.points ?? template.defaultPoints
    }
    const finalPoints = points ?? null
    const at = nowIso()
    const task: Task = {
      id: store.nextId('tsk_'),
      number: data.tasks.reduce((max, t) => Math.max(max, t.number), 1100) + 1,
      partnerId,
      templateId: template?.id ?? null,
      projectId: null,
      title,
      description,
      state: 'accepted',
      points: finalPoints,
      pricingPending: partnerId !== null && finalPoints === null && (!template || template.isFreeform),
      deadline,
      createdById: me.id,
      createdByPartnerAdminId: null,
      finishedAt: null,
      verifiedAt: null,
      hasNewReplies: false,
      createdAt: at,
      updatedAt: at,
    }
    data.tasks.push(task)
    data.taskHistory.push({
      id: store.nextId('hist_'),
      taskId: task.id,
      fromState: null,
      toState: 'accepted',
      changedById: me.id,
      changedByName: me.name,
      changedAt: at,
      note: null,
    })
    for (const userId of assigneeIds) data.taskAssignees.push({ taskId: task.id, userId, assignedById: me.id, assignedAt: at })
    for (const mailId of mailIds) data.taskMailLinks.push({ taskId: task.id, mailId, linkedAt: at, linkedById: me.id })
    if (threadId) data.taskThreadLinks.push({ taskId: task.id, threadId, linkedAt: at, linkedById: me.id })
    markMailsLinked(mailIds)
    recordAudit({
      action: 'task.create',
      entityType: 'task',
      entityId: task.id,
      partnerId,
      after: { number: task.number, title, partnerId, points: finalPoints, assigneeIds, mailIds, threadId },
    })
    emitChanged('tasks', 'mails', 'threads', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  /* ------------------------------------------------------------- detail */

  api.register('GET', '/tasks/:id', ({ path }) => {
    const me = requireStaff('l1_employee', 'technician')
    const task = findTask(path.id)
    const dto = detailOf(task, me.role)
    openTask(task)
    return { ...dto, hasNewReplies: false }
  })

  api.register('PATCH', '/tasks/:id', ({ path, body }) => {
    const me = requireStaff('l1_employee', 'technician')
    const task = findTask(path.id)
    const input = obj(body)
    if (task.state === 'verified' || task.state === 'cancelled') throw conflict('This task is closed and can no longer be edited.')
    const errors: Record<string, string> = {}
    const title = parseTitle(input.title, errors, false)
    const description = parseDescription(input.description, errors)
    const partnerId = parsePartner(input.partnerId, errors)
    const points = parsePoints(input.points, errors)
    const deadline = parseDeadline(input.deadline, errors)
    fail(errors)
    if (partnerId !== undefined && partnerId !== task.partnerId && me.role === 'technician') throw forbidden()

    const before = { title: task.title, partnerId: task.partnerId, description: task.description, deadline: task.deadline, points: task.points }
    if (title !== undefined) task.title = title
    if (description !== undefined) task.description = description
    if (deadline !== undefined) task.deadline = deadline
    if (partnerId !== undefined) {
      task.partnerId = partnerId
      if (partnerId === null) task.pricingPending = false
    }
    if (points !== undefined) {
      task.points = points
      if (points !== null && task.pricingPending) task.pricingPending = false
    }
    task.updatedAt = nowIso()
    recordAudit({
      action: 'task.update',
      entityType: 'task',
      entityId: task.id,
      partnerId: task.partnerId,
      before,
      after: { title: task.title, partnerId: task.partnerId, description: task.description, deadline: task.deadline, points: task.points },
    })
    emitChanged('tasks', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  /* --------------------------------------------------------- transition */

  api.register('POST', '/tasks/:id/transition', ({ path, body }) => {
    const me = requireStaff('l1_employee', 'technician')
    const task = findTask(path.id)
    const input = obj(body)
    const to = str(input.to) as TaskState
    if (!TASK_STATES.includes(to)) throw DemoApiError.validation({ to: 'Choose a valid state.' })
    const note = str(input.note)
    if (note.length > 2000) throw DemoApiError.validation({ note: 'Ensure this field has no more than 2000 characters.' })
    const from = task.state
    applyTransition(d(), task, to, { actorId: me.id, actorName: me.name, note: note || null, role: me.role })
    recordAudit({
      action: 'task.transition',
      entityType: 'task',
      entityId: task.id,
      partnerId: task.partnerId,
      before: { state: from },
      after: { state: to, note: note || null },
    })
    emitChanged('tasks', 'dashboards', 'points', 'audit')
    return detailOf(task, me.role)
  })

  /* ---------------------------------------------------------- assignees */

  api.register('POST', '/tasks/:id/assignees', ({ path, body }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const userId = str(obj(body).userId)
    if (!userId) throw DemoApiError.validation({ userId: REQUIRED })
    const user = staffById(userId)
    if (!user || !user.isActive || user.deletedAt) throw DemoApiError.validation({ userId: 'Choose an active technician.' })
    if (d().taskAssignees.some((a) => a.taskId === task.id && a.userId === userId)) throw conflict('Already assigned to this task.')
    d().taskAssignees.push({ taskId: task.id, userId, assignedById: me.id, assignedAt: nowIso() })
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.add_assignee', entityType: 'task', entityId: task.id, partnerId: task.partnerId, after: { userId, name: user.fullName } })
    emitChanged('tasks', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  api.register('DELETE', '/tasks/:id/assignees/:userId', ({ path }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const index = d().taskAssignees.findIndex((a) => a.taskId === task.id && a.userId === path.userId)
    if (index < 0) throw notFound('Assignee not found.')
    d().taskAssignees.splice(index, 1)
    task.updatedAt = nowIso()
    recordAudit({
      action: 'task.remove_assignee',
      entityType: 'task',
      entityId: task.id,
      partnerId: task.partnerId,
      before: { userId: path.userId, name: staffById(path.userId)?.fullName ?? null },
    })
    emitChanged('tasks', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  api.register('POST', '/tasks/:id/self-assign', ({ path }) => {
    const me = requireStaff('technician')
    const task = findTask(path.id)
    const user = currentStaffUser()
    if (CLOSED_STATES.includes(task.state)) throw conflict('This task is closed.')
    if (d().taskAssignees.some((a) => a.taskId === task.id)) throw conflict('This task already has an assignee.')
    d().taskAssignees.push({ taskId: task.id, userId: user.id, assignedById: user.id, assignedAt: nowIso() })
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.self_assign', entityType: 'task', entityId: task.id, partnerId: task.partnerId, after: { userId: user.id, name: user.fullName } })
    emitChanged('tasks', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  /* ----------------------------------------------------- mails & threads */

  api.register('POST', '/tasks/:id/mails', ({ path, body }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const mailId = str(obj(body).mailId)
    if (!mailId) throw DemoApiError.validation({ mailId: REQUIRED })
    if (!d().mails.some((m) => m.id === mailId)) throw DemoApiError.validation({ mailId: 'Mail not found.' })
    if (d().taskMailLinks.some((l) => l.taskId === task.id && l.mailId === mailId)) throw conflict('Mail is already linked to this task.')
    d().taskMailLinks.push({ taskId: task.id, mailId, linkedAt: nowIso(), linkedById: me.id })
    markMailsLinked([mailId])
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.attach_mail', entityType: 'task', entityId: task.id, partnerId: task.partnerId, after: { mailId } })
    emitChanged('tasks', 'mails', 'threads', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  api.register('DELETE', '/tasks/:id/mails/:mailId', ({ path }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const index = d().taskMailLinks.findIndex((l) => l.taskId === task.id && l.mailId === path.mailId)
    if (index < 0) throw notFound('Linked mail not found.')
    d().taskMailLinks.splice(index, 1)
    releaseMail(path.mailId)
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.detach_mail', entityType: 'task', entityId: task.id, partnerId: task.partnerId, before: { mailId: path.mailId } })
    emitChanged('tasks', 'mails', 'threads', 'dashboards', 'audit')
    return detailOf(task, me.role)
  })

  api.register('POST', '/tasks/:id/threads', ({ path, body }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const threadId = str(obj(body).threadId)
    if (!threadId) throw DemoApiError.validation({ threadId: REQUIRED })
    if (!d().threads.some((t) => t.id === threadId)) throw DemoApiError.validation({ threadId: 'Conversation not found.' })
    if (d().taskThreadLinks.some((l) => l.taskId === task.id && l.threadId === threadId)) throw conflict('Conversation is already linked to this task.')
    d().taskThreadLinks.push({ taskId: task.id, threadId, linkedAt: nowIso(), linkedById: me.id })
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.attach_thread', entityType: 'task', entityId: task.id, partnerId: task.partnerId, after: { threadId } })
    emitChanged('tasks', 'threads', 'mails', 'audit')
    return detailOf(task, me.role)
  })

  api.register('DELETE', '/tasks/:id/threads/:threadId', ({ path }) => {
    const me = requireStaff('l1_employee')
    const task = findTask(path.id)
    const index = d().taskThreadLinks.findIndex((l) => l.taskId === task.id && l.threadId === path.threadId)
    if (index < 0) throw notFound('Linked conversation not found.')
    d().taskThreadLinks.splice(index, 1)
    task.updatedAt = nowIso()
    recordAudit({ action: 'task.detach_thread', entityType: 'task', entityId: task.id, partnerId: task.partnerId, before: { threadId: path.threadId } })
    emitChanged('tasks', 'threads', 'mails', 'audit')
    return detailOf(task, me.role)
  })

  /* --------------------------------------------------------------- chat */

  api.register('GET', '/tasks/:id/messages', ({ path }) => {
    requireStaff('l1_employee', 'technician')
    const task = findTask(path.id)
    return d()
      .taskMessages.filter((m) => m.taskId === task.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(messageDto)
  })

  api.register('POST', '/tasks/:id/messages', ({ path, body }) => {
    const me = actorOf()
    requireStaff('l1_employee', 'technician')
    const task = findTask(path.id)
    const input = obj(body)
    const text = typeof input.body === 'string' ? input.body.trim() : ''
    if (!text) throw DemoApiError.validation({ body: REQUIRED })
    if (text.length > 10000) throw DemoApiError.validation({ body: 'Ensure this field has no more than 10000 characters.' })
    const message: TaskMessage = {
      id: store.nextId('msg_'),
      taskId: task.id,
      authorKind: 'internal',
      authorId: me.id,
      authorName: me.name,
      body: text,
      internalOnly: input.internalOnly === true,
      createdAt: nowIso(),
    }
    d().taskMessages.push(message)
    emitChanged('task-messages', 'tasks')
    bus.emit('task.message', { taskId: task.id, authorKind: 'internal', messageId: message.id })
    return messageDto(message)
  })
}
