/**
 * Mock API for the calls feature group (PLAN section 6):
 *   POST /api/calls/search        per-leg UnifiedCdr rows, source clamped by role
 *   POST /api/recordings/lookup   0..2 recordings for one leg, exact or fuzzy
 *   POST /api/recordings/bundle   which selected calls have audio (client zips the bytes)
 *
 * Warnings, source errors and "not found" reasons are returned as stable codes
 * (the UI translates them) so the page reads naturally in both languages.
 */
import { DemoApiError, forbidden } from '@portfolio/demo-kit'

import { effectiveCdrSource, allowedCdrSources } from '@/lib/rbac'
import { tenantDate } from '@/lib/format'
import { mapCoreLeg, mapEdgeLeg } from '@/features/calls/lib/legs'
import { assetForLeg, hasBackupCopy, isFuzzyMatch } from '@/features/calls/lib/recordings'
import type {
  CdrSearchRequest,
  CdrSearchResponse,
  CdrSource,
  CoreLeg,
  EdgeLeg,
  RecordingBundleRequest,
  RecordingBundleResponse,
  RecordingLookupRequest,
  RecordingLookupResponse,
  RecordingResult,
  UnifiedCdr,
} from '@/types'
import { api, currentPersona, jitter, requireFeature, sleep, store } from '../core'

const DAY = 86_400_000
/** Edge PBX answers at most this much of a range (deterministic "partial results" case). */
const EDGE_MAX_RANGE_DAYS = 14
/** Core Cluster keeps this many days online; older ranges are archived offline. */
const CORE_ONLINE_DAYS = 90
const MAX_ROWS = 5000

const digits = (v: string): string => v.replace(/[^\d*+#a-z]/gi, '').toLowerCase()

function validRange(from: string, to: string): [number, number] {
  const f = Date.parse(from)
  const t = Date.parse(to)
  const errors: Record<string, string> = {}
  if (!Number.isFinite(f)) errors.dateFrom = 'Enter a valid start date and time.'
  if (!Number.isFinite(t)) errors.dateTo = 'Enter a valid end date and time.'
  if (Object.keys(errors).length === 0 && f > t) errors.dateTo = 'The end must be after the start.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  return [f, t]
}

function allowedSources(): CdrSource[] {
  const persona = currentPersona()
  const allowed = allowedCdrSources(persona.role)
  return allowed.length ? allowed : ['core', 'edge']
}

function findLeg(id: string): { source: CdrSource; leg: CoreLeg | EdgeLeg } | null {
  const core = store.data.coreLegs.find((l) => l.id === id)
  if (core) return { source: 'core', leg: core }
  const edge = store.data.edgeLegs.find((l) => l.id === id)
  if (edge) return { source: 'edge', leg: edge }
  return null
}

const legTime = (leg: CoreLeg | EdgeLeg): string => ('callId' in leg ? leg.originatedAt : leg.calldate)
const legAnswered = (leg: CoreLeg | EdgeLeg): boolean => ('callId' in leg ? leg.connectedAt !== null : leg.billsec > 0)

function stamp(iso: string): string {
  const d = tenantDate(iso)
  const t = new Date(Date.parse(iso) + 4 * 3_600_000).toISOString().slice(11, 19).replace(/:/g, '')
  return `${d.replace(/-/g, '')}-${t}`
}

function recordingPath(leg: CoreLeg | EdgeLeg, backup: boolean, fuzzy: boolean): string {
  const day = tenantDate(legTime(leg)).replace(/-/g, '/')
  if ('callId' in leg) {
    const root = backup ? '/archive/voice-backup' : '/archive/voice'
    return `${root}/${day}/${leg.clusterNodeId}-${leg.callId}_${leg.callingNumber}_${leg.finalCalledNumber || leg.originalCalledNumber}.wav`
  }
  const root = backup ? '/srv/edge-recordings-backup' : '/srv/edge-recordings'
  const name = leg.recordingfile || `call-${leg.src}-${leg.dst}-${stamp(leg.calldate)}.wav`
  return `${root}/${day}/${fuzzy ? name.replace(/(\d)(\.\w+)$/, (_m, d: string, ext: string) => `${(Number(d) + 1) % 10}${ext}`) : name}`
}

function buildRecordings(source: CdrSource, leg: CoreLeg | EdgeLeg): RecordingResult[] {
  const fuzzy = isFuzzyMatch(leg.id)
  const make = (backup: boolean, shift: number): RecordingResult => {
    const asset = assetForLeg(leg.id, shift)
    const path = recordingPath(leg, backup, fuzzy && !backup)
    return {
      id: `${leg.id}:${backup ? 'backup' : 'primary'}`,
      assetId: asset.id,
      source: source === 'core' ? (backup ? 'voice_archive_backup' : 'voice_archive') : backup ? 'edge_backup' : 'edge_primary',
      sourceLabel:
        source === 'core' ? (backup ? 'Voice Archive (backup)' : 'Voice Archive') : backup ? 'Edge PBX (backup share)' : 'Edge PBX (primary share)',
      path,
      format: 'wav',
      confidence: fuzzy && !backup ? 'fuzzy' : 'exact',
      streamUrl: asset.path,
      fileSizeBytes: asset.sizeBytes,
      durationSec: asset.durationSec,
      peaks: asset.peaks,
    }
  }
  const list = [make(false, 0)]
  if (hasBackupCopy(leg.id)) list.push(make(true, 1))
  return list
}

function fileNameFor(leg: CoreLeg | EdgeLeg, format: 'original' | 'mp3'): string {
  const base =
    'callId' in leg
      ? `${leg.callingNumber}_${leg.finalCalledNumber || leg.originalCalledNumber}_${stamp(leg.originatedAt)}`
      : (leg.recordingfile || `call-${leg.src}-${leg.dst}-${stamp(leg.calldate)}.wav`).replace(/\.\w+$/, '')
  return `${base}.${format === 'mp3' ? 'mp3' : 'wav'}`
}

export function register(): void {
  api.register('POST', '/calls/search', async ({ body, signal }) => {
    requireFeature('cdr')
    const started = performance.now()
    const input = (body ?? {}) as Partial<CdrSearchRequest>
    const persona = currentPersona()
    const requested = input.source === 'core' || input.source === 'edge' ? input.source : 'both'
    const effective = effectiveCdrSource(persona.role, requested, store.data.rbacOverrides)
    if (effective === null) throw forbidden()

    const recordingFile = (input.recordingFile ?? '').trim().toLowerCase()
    const number = digits(input.number ?? '')
    const [fromMs, toMs] = recordingFile
      ? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      : validRange(input.dateFrom ?? '', input.dateTo ?? '')

    const warnings: string[] = []
    const sources: CdrSearchResponse['sources'] = {
      core: { count: 0, available: true },
      edge: { count: 0, available: true },
    }
    const allowed = new Set<CdrSource>(allowedSources())
    const want = (s: CdrSource): boolean => allowed.has(s) && (effective === 'both' || effective === s)

    let coreRows: UnifiedCdr[] = []
    let edgeRows: UnifiedCdr[] = []

    if (want('core')) {
      if (Number.isFinite(fromMs) && fromMs < Date.now() - CORE_ONLINE_DAYS * DAY) {
        sources.core = { count: 0, available: false, error: 'core_archived_offline' }
      } else if (!recordingFile) {
        // Core Cluster legs carry no recording file name, so a file search never matches them.
        coreRows = store.data.coreLegs
          .filter((l) => {
            const t = Date.parse(l.originatedAt)
            return t >= fromMs && t <= toMs
          })
          .map(mapCoreLeg)
      } else {
        coreRows = []
      }
    }

    if (want('edge')) {
      let lo = fromMs
      if (Number.isFinite(fromMs) && toMs - fromMs > EDGE_MAX_RANGE_DAYS * DAY) {
        lo = toMs - EDGE_MAX_RANGE_DAYS * DAY
        warnings.push(`edge_partial_range:${EDGE_MAX_RANGE_DAYS}`)
      }
      edgeRows = store.data.edgeLegs
        .filter((l) => {
          if (recordingFile) return l.recordingfile.toLowerCase().includes(recordingFile)
          const t = Date.parse(l.calldate)
          return t >= lo && t <= toMs
        })
        .map(mapEdgeLeg)
    }

    const matches = (r: UnifiedCdr): boolean =>
      !number ||
      digits(r.callerNumber).includes(number) ||
      digits(r.calledNumber).includes(number) ||
      digits(r.finalNumber ?? '').includes(number)
    if (!recordingFile && number) {
      coreRows = coreRows.filter(matches)
      edgeRows = edgeRows.filter(matches)
    }

    sources.core.count = coreRows.length
    sources.edge.count = edgeRows.length

    const results = [...coreRows, ...edgeRows]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, MAX_ROWS)

    // Realistic search time: 300-1500 ms in total (the API layer adds its own base latency).
    const target = jitter(300, 1500)
    await sleep(Math.max(0, target - 280 - (performance.now() - started)))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const response: CdrSearchResponse = {
      results,
      total: results.length,
      warnings,
      sources,
      searchedSource: effective,
      elapsedMs: Math.round(performance.now() - started),
    }
    return response
  })

  api.register('POST', '/recordings/lookup', async ({ body }) => {
    requireFeature('cdr')
    const started = performance.now()
    const input = (body ?? {}) as Partial<RecordingLookupRequest>
    if (!input.callId) throw DemoApiError.validation({ callId: 'A call id is required.' })
    await sleep(jitter(160, 380))
    const hit = findLeg(input.callId)
    const done = (r: Omit<RecordingLookupResponse, 'searchTimeMs'>): RecordingLookupResponse => ({
      ...r,
      searchTimeMs: Math.max(1, Math.round(performance.now() - started)),
    })
    if (!hit) return done({ found: false, recordings: [], reason: 'call_not_found' })
    if (!allowedSources().includes(hit.source)) throw forbidden()
    if (!legAnswered(hit.leg)) return done({ found: false, recordings: [], reason: 'never_answered' })
    if (!hit.leg.hasRecording) return done({ found: false, recordings: [], reason: 'no_recording' })
    return done({ found: true, recordings: buildRecordings(hit.source, hit.leg) })
  })

  api.register('POST', '/recordings/bundle', async ({ body }) => {
    requireFeature('cdr')
    const input = (body ?? {}) as Partial<RecordingBundleRequest>
    const ids = Array.isArray(input.callIds) ? [...new Set(input.callIds.map(String))] : []
    if (ids.length === 0) throw DemoApiError.validation({ callIds: 'Select at least one call.' })
    if (ids.length > 200) throw DemoApiError.validation({ callIds: 'Select at most 200 calls per download.' })
    const format = input.format === 'mp3' ? 'mp3' : 'original'
    await sleep(jitter(350, 900))
    const allowed = new Set(allowedSources())
    const out: RecordingBundleResponse = { included: [], skipped: [] }
    const used = new Map<string, number>()
    for (const id of ids) {
      const hit = findLeg(id)
      if (!hit) out.skipped.push({ callId: id, reason: 'call_not_found' })
      else if (!allowed.has(hit.source)) out.skipped.push({ callId: id, reason: 'not_permitted' })
      else if (!legAnswered(hit.leg)) out.skipped.push({ callId: id, reason: 'never_answered' })
      else if (!hit.leg.hasRecording) out.skipped.push({ callId: id, reason: 'no_recording' })
      else {
        const asset = assetForLeg(hit.leg.id)
        let fileName = fileNameFor(hit.leg, format)
        const n = (used.get(fileName) ?? 0) + 1
        used.set(fileName, n)
        if (n > 1) fileName = fileName.replace(/(\.\w+)$/, `-${n}$1`)
        out.included.push({ callId: id, recordingId: `${hit.leg.id}:primary`, assetId: asset.id, fileName })
      }
    }
    return out
  })
}
