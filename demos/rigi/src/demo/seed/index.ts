/**
 * The Rigi seed. Owner: seed.
 *
 * `buildSeed(now)` returns the complete, internally consistent DemoData,
 * generated deterministically (createRandom('rigi')) relative to `now`:
 * P0 is the current month, history reaches back to P-6. The store calls it at
 * load and on every reset, so dates never look stale and no `rebaseDates`
 * pass is needed. Pure in-memory data: nothing is fetched or persisted.
 */
import { createCounterIds, withIdProvider } from '@/demo/domain/ids'
import type { DemoData } from '@/types'

import { createSeedCtx } from './ctx'
import { seedLicensing } from './licensing'
import { seedMail } from './mail'
import { seedMoney } from './money'
import { SEED_SETTINGS, seedOps } from './ops'
import { seedPartners, seedStaff } from './people'
import { validateSeed } from './validate'
import { seedWork } from './work'

export function emptyData(): DemoData {
  return {
    staffUsers: [],
    partners: [],
    partnerRates: [],
    partnerDocuments: [],
    apiKeys: [],
    partnerAdmins: [],
    licenses: [],
    licenseOverrides: [],
    seatAllocations: [],
    partnerUsers: [],
    membershipPeriods: [],
    userCountDaily: [],
    taskTemplates: [],
    templateOverrides: [],
    tasks: [],
    taskAssignees: [],
    taskHistory: [],
    taskMessages: [],
    taskMailLinks: [],
    taskThreadLinks: [],
    projects: [],
    pointTransactions: [],
    invoices: [],
    invoiceLines: [],
    invoiceTemplates: [],
    outbox: [],
    mails: [],
    threads: [],
    pendingMails: [],
    attachments: [],
    activityLog: [],
    systemLogs: [],
    incidents: [],
    settings: structuredClone(SEED_SETTINGS),
    backfillRuns: [],
    schedulerRuns: [],
  }
}

export function buildSeed(now: Date): DemoData {
  const data = emptyData()
  withIdProvider(createCounterIds(), () => {
    const ctx = createSeedCtx(now, data)
    seedStaff(ctx)
    seedPartners(ctx)
    seedLicensing(ctx)
    const work = seedWork(ctx)
    seedMail(ctx, work)
    seedMoney(ctx)
    seedOps(ctx)
  })
  // Newest first where the product lists them that way by default.
  data.mails.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  data.threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  data.pendingMails.sort((a, b) => (a.deliverAfterSec ?? 1e9) - (b.deliverAfterSec ?? 1e9))
  if (import.meta.env.DEV) {
    const problems = validateSeed(data, now)
    if (problems.length > 0) console.warn(`[rigi seed] ${problems.length} consistency problem(s)`, problems)
  }
  return data
}
