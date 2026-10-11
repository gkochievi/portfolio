/**
 * The pristine seed, assembled from the domain builders (PLAN section 8).
 *
 * Everything is generated once at module load from fixed seeds, authored as
 * of SEED_ANCHOR (15:30 Tbilisi). `core.ts` rebases it onto "now" with
 * `rebaseDates` and then calls `refreshDerived` so strings that embed a date
 * (recording file names, archive day folders) agree with the shifted
 * timestamps.
 */
import type { DemoDb } from '@/types'
import { archiveInventory, backupEvents, backupRuns, coreImport, edgeMirror, flowSummaries, hangupBackfill, mirrorRuns, syncRuns, verifyRuns } from './archive'
import { coreLegs, edgeLegs, edgeRecordingName } from './calls'
import { agents, campaigns, campaignSettings, ccActivity, nodes, skills, teams } from './contactCentre'
import { extensionActivity, extensions, reservedExtensions } from './extensions'
import { directory, ldapRoleMappings, users } from './people'
import { connections, hostMetrics, pings, testRuns } from './platform'
import { DAY, SEED_ANCHOR } from './util'

export { SEED_ANCHOR }

export const seed: DemoDb = {
  // people and access
  users,
  directory,
  ldapRoleMappings,
  rbacOverrides: {},
  // calls (recordingAssets are owned by the calls group: src/features/calls/media/assets.ts)
  coreLegs,
  edgeLegs,
  recordingAssets: [],
  // archive
  coreImport,
  syncRuns,
  edgeMirror,
  mirrorRuns,
  hangupBackfill,
  backupRuns,
  flowSummaries,
  backupEvents,
  archiveInventory,
  verifyRuns,
  // contact centre
  teams,
  skills,
  agents,
  campaigns,
  campaignSettings,
  ccActivity,
  nodes,
  // extensions
  extensions,
  reservedExtensions,
  extensionLocks: [],
  extensionActivity,
  // platform
  testRuns,
  hostMetrics,
  pings,
  connections,
}

/* --------------------------------------------------- post-rebase refresh */

const pad = (n: number) => String(n).padStart(2, '0')

function shiftDay(y: number, m: number, d: number, days: number): [number, number, number] {
  const at = new Date(Date.UTC(y, m - 1, d + days))
  return [at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()]
}

/** Move every 'YYYY/MM/DD' (or 'YYYY\\MM\\DD') and 'YYYYMMDD-HHMMSS' token in `text` by whole days. */
export function shiftDateTokens(text: string, days: number): string {
  if (!days || !text) return text
  return text
    .replace(/(\d{4})([/\\])(\d{2})\2(\d{2})/g, (_, y: string, sep: string, m: string, d: string) => {
      const [yy, mm, dd] = shiftDay(Number(y), Number(m), Number(d), days)
      return `${yy}${sep}${pad(mm)}${sep}${pad(dd)}`
    })
    .replace(/(?<!\d)(\d{4})(\d{2})(\d{2})-(\d{6})(?!\d)/g, (_, y: string, m: string, d: string, time: string) => {
      const [yy, mm, dd] = shiftDay(Number(y), Number(m), Number(d), days)
      return `${yy}${pad(mm)}${pad(dd)}-${time}`
    })
}

/**
 * Re-derive date-bearing strings after `rebaseDates` moved the timestamps by
 * `deltaMs`. Recording file names follow their leg's (exactly shifted)
 * `calldate`; archive folders and file names move by the same whole days as
 * the date-only fields (`rebaseDates` rounds those to whole days).
 */
export function refreshDerived(db: DemoDb, deltaMs: number): DemoDb {
  for (const leg of db.edgeLegs) if (leg.recordingfile) leg.recordingfile = edgeRecordingName(leg)
  const days = Math.round(deltaMs / DAY)
  if (!days) return db
  for (const event of db.backupEvents) {
    event.dateDir = shiftDateTokens(event.dateDir, days)
    event.relativePath = shiftDateTokens(event.relativePath, days)
    event.message = shiftDateTokens(event.message, days)
  }
  const shiftFiles = (files: { name: string; rawRelativePath: string }[]) => {
    for (const f of files) {
      f.name = shiftDateTokens(f.name, days)
      f.rawRelativePath = shiftDateTokens(f.rawRelativePath, days)
    }
  }
  for (const row of db.archiveInventory) {
    shiftFiles(row.missingFromDest)
    shiftFiles(row.missingFromSource)
  }
  for (const run of db.verifyRuns) {
    for (const day of run.days) {
      day.sourcePath = shiftDateTokens(day.sourcePath, days)
      day.destPath = shiftDateTokens(day.destPath, days)
      shiftFiles(day.missingFromDest)
      shiftFiles(day.missingFromSource)
    }
  }
  return db
}
