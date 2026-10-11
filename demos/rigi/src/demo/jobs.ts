/**
 * Scheduler job registry. Owner: seed (architect wrote it).
 *
 * The groups that own a cron job register its runner from their handler
 * module's `register()`; the ops Scheduler panel runs them through
 * `POST /api/scheduler/jobs/:name/run`, which also writes the system-log row.
 */
import type { SchedulerJobName } from '@/types'

export interface JobResult {
  ok: boolean
  /** Human summary, English, e.g. "4 mails ingested, 1 skipped, 10 remaining". */
  summary: string
}

export type JobRunner = () => JobResult | Promise<JobResult>

export const JOB_SCHEDULES: Record<SchedulerJobName, string> = {
  'mail.imap.poll': '* * * * *',
  'points.month.close': '0 1 1 * *',
  'invoices.generate.month': '0 2 1 * *',
  'invoices.autodraft.daily': '30 2 * * *',
  'usercount.snapshot.daily': '5 0 * * *',
}

const runners = new Map<SchedulerJobName, JobRunner>()

export function registerJob(name: SchedulerJobName, run: JobRunner): void {
  runners.set(name, run)
}

export function hasJob(name: SchedulerJobName): boolean {
  return runners.has(name)
}

export async function runJob(name: SchedulerJobName): Promise<JobResult> {
  const run = runners.get(name)
  if (!run) return { ok: false, summary: `No runner registered for ${name}` }
  return run()
}
