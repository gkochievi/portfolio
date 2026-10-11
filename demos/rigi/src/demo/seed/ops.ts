/**
 * Ops history: the audit trail (derived from the seeded work, money and mail
 * so every row points at a real record), system log, incidents, the last mail
 * backfill and recent scheduler runs, plus the settings object.
 */
import { addMonths, firstDayOfPeriod, isoDate, parseIsoDate } from '@/demo/domain/dates'
import { shallowDiff } from '@/demo/domain/diff'
import { newId } from '@/demo/domain/ids'
import type { ActivityLog, AuditEntityType, LogLevel, SchedulerJobName, SystemLog, SystemSettings } from '@/types'

import { maxIso, plusHours, type SeedCtx } from './ctx'

export const SEED_SETTINGS: SystemSettings = {
  imap: { host: 'imap.rigi.example', port: 993, user: 'desk@rigi.example', password: 'demo-mailbox', tls: true },
  smtp: { host: 'smtp.rigi.example', port: 587, user: 'billing@rigi.example', password: 'demo-mailbox', from: 'Rigi Billing <billing@rigi.example>', tls: true },
  appBaseUrl: 'https://ops.rigi.example',
  billing: {
    bankName: 'Demo Bank',
    accountHolder: 'Rigi LLC',
    iban: 'GE00DEMO0000000000000000',
    swift: 'DEMOGE22',
    address: '12 Demo St, Tbilisi 0100',
    notes: 'Please quote the invoice number on the payment order.',
  },
  retention: { healthDays: 30, systemLogDays: 90 },
}

const STAFF_IPS: Record<string, string> = {
  usr_levan: '10.20.4.21',
  usr_mariam: '10.20.4.33',
  usr_ana: '10.20.4.34',
  usr_giorgi: '10.20.6.12',
  usr_saba: '10.20.6.15',
  usr_sopo: '10.20.6.18',
  usr_irakli: '10.20.6.19',
  usr_davit: '10.20.6.22',
}

export function seedOps(ctx: SeedCtx): void {
  const { data, rng } = ctx
  ctx.data.settings = structuredClone(SEED_SETTINGS)

  /* ----------------------------------------------------------- audit */
  const since = ctx.ago(30)
  const rows: Array<Omit<ActivityLog, 'id'>> = []
  const audit = (actorId: string | null, at: string, action: string, entityType: AuditEntityType, entityId: string, partnerId: string | null, before: unknown, after: unknown) => {
    if (!actorId || !(actorId in STAFF_IPS) || at < since) return
    const staff = data.staffUsers.find((s) => s.id === actorId)
    if (!staff || staff.role === 'superadmin') return
    rows.push({
      createdAt: ctx.clamp(at),
      actorUserId: staff.id,
      actorName: staff.fullName,
      actorEmail: staff.email,
      actorRole: staff.role,
      actorIp: STAFF_IPS[actorId],
      action,
      entityType,
      entityId,
      partnerId,
      before,
      after,
      diff: shallowDiff(before, after),
      requestId: `req_${ctx.hex(12)}`,
    })
  }
  const taskById = new Map(data.tasks.map((t) => [t.id, t]))
  for (const h of data.taskHistory) {
    const task = taskById.get(h.taskId)
    if (!task) continue
    if (h.fromState === null) audit(h.changedById, h.changedAt, 'task.create', 'task', task.id, task.partnerId, null, { title: task.title, partnerId: task.partnerId, points: task.points, state: 'accepted' })
    else audit(h.changedById, h.changedAt, 'task.transition', 'task', task.id, task.partnerId, { state: h.fromState }, { state: h.toState, ...(h.note ? { note: h.note } : {}) })
  }
  for (const a of data.taskAssignees) {
    const task = taskById.get(a.taskId)
    if (!task) continue
    if (a.assignedById === a.userId) audit(a.userId, a.assignedAt, 'task.self_assign', 'task', task.id, task.partnerId, null, { assigneeId: a.userId })
    else audit(a.assignedById, a.assignedAt, 'task.add_assignee', 'task', task.id, task.partnerId, null, { assigneeId: a.userId })
  }
  for (const l of data.taskMailLinks) {
    const task = taskById.get(l.taskId)
    if (task) audit(l.linkedById, plusHours(l.linkedAt, 0.05), 'task.attach_mail', 'task', task.id, task.partnerId, null, { mailId: l.mailId })
  }
  for (const m of data.mails) {
    if (m.status === 'ignored') audit(rng.pick(['usr_mariam', 'usr_ana']), plusHours(m.ingestedAt, 1 + rng.int(0, 4)), 'mail.ignore', 'mail', m.id, m.partnerId, { status: 'new' }, { status: 'ignored' })
  }
  for (const inv of data.invoices) {
    if (inv.kind === 'adhoc') audit('usr_levan', inv.createdAt, 'invoice.create_adhoc', 'invoice', inv.id, inv.partnerId, null, { title: inv.title, total: inv.total, currency: inv.currency })
    if (inv.issuedAt) {
      const actedAt = maxIso(inv.issuedAt, plusHours(inv.createdAt, 20))
      audit('usr_levan', actedAt, 'invoice.issue', 'invoice', inv.id, inv.partnerId, { status: 'draft' }, { status: 'issued', issuedAt: inv.issuedAt, dueAt: inv.dueAt })
    }
    if (inv.paidAt) audit('usr_levan', inv.paidAt, 'invoice.mark_paid', 'invoice', inv.id, inv.partnerId, { status: 'issued' }, { status: 'paid', paidAt: inv.paidAt })
  }
  for (const o of data.outbox) {
    const inv = data.invoices.find((i) => i.id === o.invoiceId)
    audit('usr_levan', o.sentAt, 'invoice.email', 'invoice', o.invoiceId, inv?.partnerId ?? null, null, { to: o.to, cc: o.cc, subject: o.subject })
  }
  for (const s of data.seatAllocations) {
    if (s.createdByName !== 'Levan Abashidze') continue
    const license = data.licenses.find((l) => l.id === s.licenseId)
    audit('usr_levan', s.createdAt, 'partner.set_seats', 'partner', s.partnerId, s.partnerId, null, { license: license?.code, quantity: s.quantity, effectiveFrom: s.effectiveFrom, reason: s.reason })
  }
  for (const u of data.partnerUsers) {
    if (!u.isActive || !u.licenseId || u.createdAt < since || !rng.chance(0.6)) continue
    const license = data.licenses.find((l) => l.id === u.licenseId)
    audit('usr_levan', plusHours(u.createdAt, 20 + rng.int(0, 20)), 'partner.map_user_license', 'partner', u.partnerId, u.partnerId, { userId: u.id, license: null }, { userId: u.id, license: license?.code ?? null })
  }
  audit('usr_levan', ctx.ago(19.6), 'settings.update_billing', 'settings', 'billing', null, { notes: '' }, { notes: SEED_SETTINGS.billing.notes })
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const activity = rows.map((r) => ({ id: newId('act_'), ...r }))
  data.activityLog = activity.reverse()

  /* ------------------------------------------------------ system log */
  const logs: Array<Omit<SystemLog, 'id'>> = []
  const log = (createdAt: string, level: LogLevel, source: string, message: string, partnerId: string | null, context: Record<string, unknown> | null = null, payload: unknown = null) =>
    logs.push({ createdAt: ctx.clamp(createdAt), level, source, message, partnerId, requestId: `req_${ctx.hex(12)}`, context, payload })
  const windowStart = new Date(ctx.ago(14)).getTime()
  const end = ctx.now.getTime() - 10 * 60_000
  for (const key of data.apiKeys) {
    const partner = data.partners.find((p) => p.id === key.partnerId)
    if (!partner || !partner.isActive || key.revokedAt) continue
    const cadence = partner.architecture === 'onprem' ? 24 : 12
    let cycle = 0
    for (let t = windowStart + rng.int(0, 3) * 3_600_000; t < end; t += cadence * 3_600_000 + rng.int(-20, 20) * 60_000) {
      cycle += 1
      const at = new Date(t).toISOString()
      const day = isoDate(at)
      const count = data.userCountDaily.find((c) => c.partnerId === partner.id && c.day === day)?.userCount ?? 0
      const created = rng.chance(0.15) ? rng.int(1, 2) : 0
      const deactivated = rng.chance(0.1) ? 1 : 0
      if (cycle % 2 === 1) log(at, 'debug', 'partner.auth.token', `Issued access token for key ${key.keyId}`, partner.id, { keyId: key.keyId, ttlSec: 3600 })
      log(plusHours(at, 0.01), 'info', 'partner.user_sync.sync', `Synced ${count} users (${created} created, ${deactivated} deactivated)`, partner.id, { keyId: key.keyId, userCount: count, created, deactivated })
      if (cycle % 3 === 0 || created + deactivated > 0) {
        const events = Math.max(1, created + deactivated)
        log(plusHours(at, 0.012), 'info', 'partner.user_sync.events', `Received ${events} membership event${events === 1 ? '' : 's'}`, partner.id, { keyId: key.keyId, events }, {
          events: Array.from({ length: events }, (_, i) => ({ type: i < created ? 'user.created' : 'user.deactivated', externalId: String(1000 + rng.int(0, 900)) })),
        })
      }
      if (cycle % 4 === 0) log(plusHours(at, 0.015), 'debug', 'partner.user_sync.current_count', `Current billable user count ${count}`, partner.id, { userCount: count })
    }
  }
  const revoked = data.apiKeys.filter((k) => k.revokedAt)
  for (const [i, key] of revoked.entries()) {
    for (let k = 0; k < 2; k += 1) log(ctx.ago(2 + i * 4 + k * 1.3), 'warn', 'partner.auth.jwt', `Rejected token for revoked key ${key.keyId}`, key.partnerId, { keyId: key.keyId, reason: 'key_revoked' })
  }
  const errors: Array<[days: number, partnerId: string | null, message: string, status: number]> = [
    [0.6, 'prt_kolkheti', 'POST /machine/v1/user-sync/events failed: payload too large (2.4 MB)', 413],
    [1.9, 'prt_talgha', 'POST /machine/v1/user-sync/current-count failed: connection reset by peer', 502],
    [3.4, null, 'GET /api/invoices/:id/document failed: template render timeout', 500],
    [5.2, 'prt_mzeo', 'POST /machine/v1/user-sync/events failed: duplicate event id', 409],
    [8.8, null, 'POST /api/mail/poll failed: IMAP login timeout', 504],
    [11.5, 'prt_lukma', 'POST /machine/v1/auth/token failed: clock skew too large', 400],
  ]
  for (const [days, partnerId, message, status] of errors) log(ctx.ago(days), 'error', 'http.exception', message, partnerId, { status, method: message.split(' ')[0] }, { stack: 'Error: ' + message + '\n    at handler (machine-api)' })
  for (let d = 13; d >= 0; d -= 1) {
    log(ctx.at(-d, 0, 5), 'info', 'jobs.run', 'usercount.snapshot.daily finished: 8 partners snapshotted', null, { job: 'usercount.snapshot.daily', durationMs: 400 + rng.int(0, 900) })
    log(ctx.at(-d, 2, 30), 'info', 'jobs.run', 'invoices.autodraft.daily finished: no drafts created', null, { job: 'invoices.autodraft.daily', durationMs: 120 + rng.int(0, 300) })
  }
  logs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  data.systemLogs = logs.map((l) => ({ id: newId('log_'), ...l })).reverse()

  /* ------------------------------------------------------- incidents */
  const incident = (dependency: 'imap' | 'smtp' | 'jobqueue' | 'postgres', daysAgo: number, minutes: number, reason: string) => {
    const startedAt = ctx.ago(daysAgo)
    data.incidents.push({ id: newId('inc_'), dependency, startedAt, endedAt: ctx.clamp(plusHours(startedAt, minutes / 60)), reason })
  }
  incident('postgres', 24, 12, 'Slow checkpoints: p99 query latency above 800 ms')
  incident('jobqueue', 11, 19, 'Queue latency above 5 s')
  incident('smtp', 6, 8, 'Connection refused by the relay')
  incident('imap', 2, 25, 'IMAP login timeout')
  data.incidents.reverse()

  /* -------------------------------------------------------- backfill */
  const bfStart = ctx.ago(12)
  data.backfillRuns.push({
    id: newId('bf_'),
    state: 'completed',
    cancelRequested: false,
    totalCount: 240,
    processedCount: 240,
    ingestedCount: 204,
    skippedCount: 31,
    errorCount: 5,
    lastError: 'Message too large (attachment over 25 MB)',
    startedAt: bfStart,
    finishedAt: plusHours(bfStart, 0.14),
    startedByName: 'Nino Kapanadze',
    limit: null,
  })

  /* ------------------------------------------------------- scheduler */
  const run = (job: SchedulerJobName, startedAt: string, seconds: number, summary: string) =>
    data.schedulerRuns.push({ id: newId('run_'), job, startedAt: ctx.clamp(startedAt), finishedAt: ctx.clamp(plusHours(startedAt, seconds / 3600)), ok: true, summary, triggeredByName: 'scheduler' })
  const p0 = ctx.period(0)
  const pPrev = addMonths(p0.year, p0.month, -1)
  const firstOf = (y: number, m: number, h: number, min: number) => {
    const d = parseIsoDate(firstDayOfPeriod(y, m))
    d.setHours(h, min)
    return d.toISOString()
  }
  run('points.month.close', firstOf(pPrev.year, pPrev.month, 1, 0), 2, 'Closed the points period for 8 partners')
  run('invoices.generate.month', firstOf(pPrev.year, pPrev.month, 2, 0), 6, '8 drafts created, 0 skipped')
  run('points.month.close', firstOf(p0.year, p0.month, 1, 0), 2, 'Closed the points period for 8 partners')
  run('invoices.generate.month', firstOf(p0.year, p0.month, 2, 0), 5, '5 drafts created, 3 skipped (user-count sync incomplete)')
  run('invoices.autodraft.daily', ctx.at(-1, 2, 30), 1, 'No drafts created')
  run('usercount.snapshot.daily', ctx.at(-1, 0, 5), 1, '8 partners snapshotted')
  run('usercount.snapshot.daily', ctx.at(0, 0, 5), 1, '8 partners snapshotted')
  run('mail.imap.poll', ctx.ago(150 / 1440), 2, '2 mails ingested, 0 skipped, 0 remaining')
  run('mail.imap.poll', ctx.ago(130 / 1440), 1, '1 mail ingested, 0 skipped, 0 remaining')
  data.schedulerRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
