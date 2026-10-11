/**
 * The points ledger. Owner: seed.
 *
 * Points debit ONLY when the partner verifies a task (period = verification
 * month). Internal tasks, project member tasks and tasks without points never
 * bill. A debit is free until the period's allowance is used up; the rest is
 * chargeable at the rate effective on day 1 of the period (one debit may split).
 */
import type { DemoData, ISODateTime, PointTransaction, Task } from '@/types'

import { addMonths, firstDayOfPeriod, periodOf } from './dates'
import { newId } from './ids'
import { round2, sum } from './money'

export interface PeriodRate {
  ratePerPoint: number
  freeAllowance: number
}

/** The rate-history row effective on day 1 of the period (latest effectiveFrom <= day 1). */
export function rateForPeriod(data: DemoData, partnerId: string, year: number, month: number): PeriodRate {
  const day1 = firstDayOfPeriod(year, month)
  const rows = data.partnerRates.filter((r) => r.partnerId === partnerId).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  let match = rows.filter((r) => r.effectiveFrom <= day1).pop()
  if (!match) match = rows[0]
  if (match) return { ratePerPoint: match.ratePerPoint, freeAllowance: match.freeAllowance }
  const partner = data.partners.find((p) => p.id === partnerId)
  return { ratePerPoint: partner?.ratePerPoint ?? 20, freeAllowance: partner?.freeMonthlyAllowance ?? 10 }
}

export interface PeriodUsage extends PeriodRate {
  allowance: number
  freeUsed: number
  /** freeUsed / allowance, 0-100. */
  freeUsedPct: number
  chargeablePoints: number
  chargeableAmount: number
  remaining: number
  /** Net money of manual adjustments: debits minus credits. */
  adjustments: number
  adjustmentCreditPoints: number
  adjustmentDebitPoints: number
  /** All points used in the period (free + chargeable). */
  usedPoints: number
}

export function periodTransactions(data: DemoData, partnerId: string, year: number, month: number): PointTransaction[] {
  return data.pointTransactions.filter((t) => t.partnerId === partnerId && t.periodYear === year && t.periodMonth === month)
}

export function periodUsage(data: DemoData, partnerId: string, year: number, month: number): PeriodUsage {
  const rate = rateForPeriod(data, partnerId, year, month)
  const rows = periodTransactions(data, partnerId, year, month)
  const of = (kind: PointTransaction['kind']) => rows.filter((r) => r.kind === kind)
  const freeUsed = sum(of('debit_free').map((r) => r.points))
  const chargeable = of('debit_chargeable')
  const chargeablePoints = sum(chargeable.map((r) => r.points))
  const credits = of('adjustment_credit')
  const debits = of('adjustment_debit')
  const allowance = rate.freeAllowance
  return {
    ...rate,
    allowance,
    freeUsed,
    freeUsedPct: allowance > 0 ? Math.min(100, Math.round((freeUsed / allowance) * 100)) : 0,
    chargeablePoints,
    chargeableAmount: sum(chargeable.map((r) => r.amount)),
    remaining: round2(Math.max(0, allowance - freeUsed)),
    adjustments: round2(sum(debits.map((r) => r.amount)) - sum(credits.map((r) => r.amount))),
    adjustmentCreditPoints: sum(credits.map((r) => r.points)),
    adjustmentDebitPoints: sum(debits.map((r) => r.points)),
    usedPoints: round2(freeUsed + chargeablePoints),
  }
}

/** Unused-allowance report row: unused = allowance - used free points; equivalent = unused x rate. */
export function unusedAllowance(data: DemoData, partnerId: string, year: number, month: number) {
  const usage = periodUsage(data, partnerId, year, month)
  const unused = round2(Math.max(0, usage.allowance - usage.freeUsed))
  return { allowance: usage.allowance, used: usage.usedPoints, unused, ratePerPoint: usage.ratePerPoint, equivalent: round2(unused * usage.ratePerPoint) }
}

/** The last `months` periods (oldest first) ending with the one containing `now`. */
export function usageHistory(data: DemoData, partnerId: string, now: Date | string = new Date(), months = 12) {
  const current = periodOf(now)
  const out: Array<{ year: number; month: number } & PeriodUsage> = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const p = addMonths(current.year, current.month, -i)
    out.push({ ...p, ...periodUsage(data, partnerId, p.year, p.month) })
  }
  return out
}

/** True when verifying this task would debit points. */
export function isBillableTask(task: Pick<Task, 'partnerId' | 'projectId' | 'points'>): boolean {
  return task.partnerId !== null && task.projectId === null && task.points !== null && task.points > 0
}

/**
 * Debit a verified task. Pushes the rows into `data.pointTransactions` and
 * returns them ([] when the task never bills).
 */
export function debitOnVerify(data: DemoData, task: Task, at: ISODateTime, actorName: string | null): PointTransaction[] {
  if (!isBillableTask(task) || task.partnerId === null || task.points === null) return []
  const { year, month } = periodOf(at)
  const usage = periodUsage(data, task.partnerId, year, month)
  const points = round2(task.points)
  const free = round2(Math.min(points, Math.max(0, usage.allowance - usage.freeUsed)))
  const chargeable = round2(points - free)
  const base = {
    partnerId: task.partnerId,
    taskId: task.id,
    periodYear: year,
    periodMonth: month,
    ratePerPoint: usage.ratePerPoint,
    invoiceLineItemId: null,
    createdByName: actorName,
    note: null,
    createdAt: at,
  }
  const rows: PointTransaction[] = []
  if (free > 0) rows.push({ ...base, id: newId('ptx_'), points: free, kind: 'debit_free', amount: 0 })
  if (chargeable > 0) {
    rows.push({ ...base, id: newId('ptx_'), points: chargeable, kind: 'debit_chargeable', amount: round2(chargeable * usage.ratePerPoint) })
  }
  data.pointTransactions.push(...rows)
  return rows
}

/** Manual credit/debit adjustment (money = points x period rate). */
export function adjustPoints(
  data: DemoData,
  input: { partnerId: string; year: number; month: number; points: number; kind: 'adjustment_credit' | 'adjustment_debit'; note: string; actorName: string | null; at: ISODateTime },
): PointTransaction {
  const rate = rateForPeriod(data, input.partnerId, input.year, input.month)
  const row: PointTransaction = {
    id: newId('ptx_'),
    partnerId: input.partnerId,
    taskId: null,
    periodYear: input.year,
    periodMonth: input.month,
    points: round2(input.points),
    kind: input.kind,
    ratePerPoint: rate.ratePerPoint,
    amount: round2(input.points * rate.ratePerPoint),
    invoiceLineItemId: null,
    createdByName: input.actorName,
    note: input.note,
    createdAt: input.at,
  }
  data.pointTransactions.push(row)
  return row
}
