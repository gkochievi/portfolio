/** Task state machine. Owner: seed. The server map is the source of truth. */
import { DemoApiError } from '@portfolio/demo-kit'

import type { DemoData, ISODateTime, StaffRole, Task, TaskState, TaskStateChange } from '@/types'

import { newId } from './ids'

export const TASK_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['pending', 'testing', 'finished', 'cancelled'],
  pending: ['in_progress', 'finished', 'cancelled'],
  testing: ['in_progress', 'finished', 'cancelled'],
  finished: [],
  verified: [],
  cancelled: [],
}

export const OPEN_STATES: readonly TaskState[] = ['accepted', 'in_progress', 'pending', 'testing']
export const CLOSED_STATES: readonly TaskState[] = ['finished', 'verified', 'cancelled']

/** Who is moving the task: a staff role, or the partner (portal). */
export type TransitionActor = StaffRole | 'partner'

export function isOpenState(state: TaskState): boolean {
  return OPEN_STATES.includes(state)
}

/**
 * Buttons to show. Staff: the server map, plus finished -> in_progress for a
 * superadmin; -> finished is removed while pricingPending. Partner: verify or
 * send back a finished task, cancel an open one.
 */
export function allowedTransitions(task: Pick<Task, 'state' | 'pricingPending'>, role: TransitionActor): TaskState[] {
  if (role === 'partner') {
    if (task.state === 'finished') return ['verified', 'in_progress']
    return isOpenState(task.state) ? ['cancelled'] : []
  }
  let next: TaskState[] = [...TASK_TRANSITIONS[task.state]]
  if (task.state === 'finished' && role === 'superadmin') next.push('in_progress')
  if (task.pricingPending) next = next.filter((s) => s !== 'finished')
  return next
}

export interface TransitionOptions {
  /** Null = the partner (portal). */
  actorId: string | null
  actorName: string
  note?: string | null
  at?: ISODateTime
  /** Defaults to the plain server map (no superadmin reopen). */
  role?: TransitionActor
}

/**
 * Validate and apply a move; appends a history row and returns it.
 * Throws 409 `Cannot transition from X to Y`, or 409
 * `Cannot finish a task while its price is pending`.
 */
export function applyTransition(data: DemoData, task: Task, to: TaskState, options: TransitionOptions): TaskStateChange {
  const from = task.state
  const role = options.role
  const allowed = role ? allowedTransitions(task, role) : TASK_TRANSITIONS[from].filter((s) => !(s === 'finished' && task.pricingPending))
  if (!allowed.includes(to)) {
    if (to === 'finished' && task.pricingPending && TASK_TRANSITIONS[from].includes('finished')) {
      throw new DemoApiError(409, 'Cannot finish a task while its price is pending')
    }
    throw new DemoApiError(409, `Cannot transition from ${from} to ${to}`)
  }
  const at = options.at ?? new Date().toISOString()
  task.state = to
  task.updatedAt = at
  if (to === 'finished') task.finishedAt = at
  if (to === 'verified') task.verifiedAt = at
  if (from === 'finished' && to === 'in_progress') task.finishedAt = null
  const row: TaskStateChange = {
    id: newId('hist_'),
    taskId: task.id,
    fromState: from,
    toState: to,
    changedById: options.actorId,
    changedByName: options.actorName,
    changedAt: at,
    note: options.note ?? null,
  }
  data.taskHistory.push(row)
  return row
}

/** Deadline passed and the task is still open. */
export function isOverdue(task: Pick<Task, 'deadline' | 'state'>, now: Date | string = new Date()): boolean {
  if (!task.deadline) return false
  if (CLOSED_STATES.includes(task.state)) return false
  const t = typeof now === 'string' ? new Date(now).getTime() : now.getTime()
  return new Date(task.deadline).getTime() < t
}
