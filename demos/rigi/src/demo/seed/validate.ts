/**
 * Dev-only seed consistency check (called from buildSeed under
 * import.meta.env.DEV). Returns human-readable problems; [] means clean.
 */
import { computeTotals, linesOf } from '@/demo/domain/billing'
import { round2 } from '@/demo/domain/money'
import { isBillableTask } from '@/demo/domain/points'
import { seatPool } from '@/demo/domain/seats'
import type { DemoData } from '@/types'

export function validateSeed(data: DemoData, now: Date = new Date()): string[] {
  const problems: string[] = []
  const nowIso = now.toISOString()

  // Unique ids per collection.
  for (const [name, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue
    const ids = rows.map((r) => (r as { id?: string }).id).filter((id): id is string => typeof id === 'string')
    if (new Set(ids).size !== ids.length) problems.push(`${name}: duplicate ids`)
  }

  // Task history ends at the current state and chains correctly.
  for (const task of data.tasks) {
    const rows = data.taskHistory.filter((h) => h.taskId === task.id).sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    if (rows.length === 0) {
      problems.push(`${task.id}: no history`)
      continue
    }
    if (rows[0].fromState !== null) problems.push(`${task.id}: first history row is not the creation row`)
    for (let i = 1; i < rows.length; i += 1) if (rows[i].fromState !== rows[i - 1].toState) problems.push(`${task.id}: history chain broken at ${rows[i].id}`)
    if (rows[rows.length - 1].toState !== task.state) problems.push(`${task.id}: history ends at ${rows[rows.length - 1].toState}, state is ${task.state}`)
    if (task.createdAt > nowIso) problems.push(`${task.id}: created in the future`)
    if (task.state === 'verified' && !task.verifiedAt) problems.push(`${task.id}: verified without verifiedAt`)
    if (task.pricingPending && task.points !== null) problems.push(`${task.id}: pricingPending with points`)
  }

  // Seat pools hold every mapped user.
  for (const partner of data.partners) {
    for (const license of data.licenses) {
      if (license.kind !== 'per_user') continue
      const mapped = data.partnerUsers.filter((u) => u.partnerId === partner.id && u.isActive && u.licenseId === license.id).length
      const pool = seatPool(data, partner.id, license.id)
      if (mapped > pool) problems.push(`${partner.id}/${license.code}: ${mapped} mapped users > ${pool} seats`)
    }
  }

  // Invoice totals equal their lines.
  for (const invoice of data.invoices) {
    const totals = computeTotals(linesOf(data, invoice.id), invoice.vatInclusive, invoice.vatRate)
    if (round2(totals.total) !== round2(invoice.total) || round2(totals.tax) !== round2(invoice.tax)) problems.push(`${invoice.invoiceNumber}: totals do not match lines`)
  }
  const numbers = data.invoices.map((i) => i.invoiceNumber)
  if (new Set(numbers).size !== numbers.length) problems.push('invoices: duplicate invoice numbers')

  // The ledger matches verified, billable tasks.
  for (const task of data.tasks) {
    const debits = data.pointTransactions.filter((t) => t.taskId === task.id)
    const total = round2(debits.reduce((acc, t) => acc + t.points, 0))
    const shouldBill = task.state === 'verified' && isBillableTask(task)
    if (shouldBill && total !== round2(task.points ?? 0)) problems.push(`${task.id}: ledger ${total} pts, task ${task.points} pts`)
    if (!shouldBill && debits.length > 0) problems.push(`${task.id}: debited but not billable`)
  }

  // References resolve.
  const mailIds = new Set(data.mails.map((m) => m.id))
  const threadIds = new Set(data.threads.map((t) => t.id))
  const taskIds = new Set(data.tasks.map((t) => t.id))
  for (const m of data.mails) if (!threadIds.has(m.threadId)) problems.push(`${m.id}: unknown thread`)
  for (const l of data.taskMailLinks) if (!mailIds.has(l.mailId) || !taskIds.has(l.taskId)) problems.push(`mail link ${l.taskId}/${l.mailId} dangling`)
  for (const l of data.taskThreadLinks) if (!threadIds.has(l.threadId) || !taskIds.has(l.taskId)) problems.push(`thread link ${l.taskId}/${l.threadId} dangling`)
  for (const a of data.taskAssignees) if (!data.staffUsers.some((s) => s.id === a.userId)) problems.push(`assignee ${a.userId} unknown`)
  return problems
}
