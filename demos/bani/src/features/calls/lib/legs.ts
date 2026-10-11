/**
 * Raw platform leg -> per-leg UnifiedCdr (what the search endpoint returns).
 * Pure; shared by the mock handler and the client-side merge.
 */
import type { CallStatus, CoreLeg, EdgeLeg, UnifiedCdr } from '@/types'
import { deviceExt, detectCoreTransfer, detectEdgeTransfers, TRANSFER_CAUSE } from './transfers'

const CORE_CAUSES: Record<number, string> = {
  0: 'No error',
  16: 'Normal call clearing',
  17: 'User busy',
  19: 'No answer from user',
  21: 'Call rejected',
  31: 'Normal, unspecified',
  34: 'No circuit available',
  41: 'Temporary failure',
  [TRANSFER_CAUSE]: 'Call split (transfer)',
}

function coreStatus(leg: CoreLeg): CallStatus {
  if (leg.destCause === 17 || leg.origCause === 17) return 'busy'
  if (leg.connectedAt && leg.durationSec > 0) return 'completed'
  if (leg.destCause === 19 || (!leg.connectedAt && (leg.destCause === 16 || leg.destCause === 0 || leg.destCause === TRANSFER_CAUSE))) return 'no_answer'
  if ([21, 34, 38, 41, 47].includes(leg.destCause) || [21, 34, 38, 41, 47].includes(leg.origCause)) return 'failed'
  return 'unknown'
}

function coreHangupBy(leg: CoreLeg): string | undefined {
  if (leg.destCause === TRANSFER_CAUSE) return leg.finalCalledNumber || undefined
  if (leg.origCause === 16) return leg.callingNumber
  if (leg.destCause === 16) return leg.finalCalledNumber || leg.originalCalledNumber
  return undefined
}

export function blobFor(legs: UnifiedCdr[]): string {
  const parts = new Set<string>()
  for (const l of legs) {
    const raw = l.rawData
    const extra = 'callId' in raw ? [raw.lastRedirectNumber, raw.originalCalledNumber, raw.finalCalledNumber, raw.huntPilot] : [raw.cnum, raw.did, raw.recordingfile]
    for (const v of [l.callerNumber, l.calledNumber, l.finalNumber, l.originatingDevice, l.terminatingDevice, ...extra]) {
      const s = (v ?? '').trim()
      if (s) parts.add(s)
    }
  }
  return [...parts].join(' ')
}

export function mapCoreLeg(leg: CoreLeg): UnifiedCdr {
  const row: UnifiedCdr = {
    id: leg.id,
    timestamp: leg.originatedAt,
    source: 'core',
    callerNumber: leg.callingNumber,
    calledNumber: leg.originalCalledNumber,
    finalNumber: leg.finalCalledNumber || undefined,
    duration: leg.durationSec,
    billableSeconds: leg.connectedAt ? leg.durationSec : 0,
    status: coreStatus(leg),
    disposition: CORE_CAUSES[leg.destCause] ?? `Cause ${leg.destCause}`,
    originatingDevice: leg.origDevice || undefined,
    terminatingDevice: leg.destDevice || undefined,
    accountCode: leg.accountCode || undefined,
    context: leg.finalCalledPartition || leg.callingPartition || undefined,
    hangupBy: coreHangupBy(leg),
    rawData: leg,
    hasRecording: leg.hasRecording,
  }
  row.transfer = detectCoreTransfer([row])
  row.searchBlob = blobFor([row])
  return row
}

const EDGE_STATUS: Record<EdgeLeg['disposition'], CallStatus> = {
  ANSWERED: 'completed',
  'NO ANSWER': 'no_answer',
  BUSY: 'busy',
  FAILED: 'failed',
}

export function mapEdgeLeg(leg: EdgeLeg): UnifiedCdr {
  const hang = leg.hangupsource ? deviceExt(leg.hangupsource) || leg.hangupsource : undefined
  const status = leg.disposition === 'ANSWERED' && leg.billsec === 0 ? 'unknown' : EDGE_STATUS[leg.disposition] ?? 'unknown'
  const row: UnifiedCdr = {
    id: leg.id,
    timestamp: leg.calldate,
    source: 'edge',
    callerNumber: leg.src,
    calledNumber: leg.dst,
    finalNumber: deviceExt(leg.dstchannel) || leg.dst || undefined,
    duration: leg.duration,
    billableSeconds: leg.billsec,
    status,
    disposition: leg.disposition,
    originatingDevice: leg.channel || undefined,
    terminatingDevice: leg.dstchannel || undefined,
    accountCode: leg.accountcode || undefined,
    context: leg.dcontext || undefined,
    hangupBy: hang,
    rawData: leg,
    hasRecording: leg.hasRecording,
  }
  row.transfer = detectEdgeTransfers([row])
  row.searchBlob = blobFor([row])
  return row
}

/** The leg whose recording represents a (possibly merged) call. */
export function recordingLegId(row: UnifiedCdr): string | null {
  const legs = row.segments && row.segments.length ? row.segments : [row]
  const withAudio = legs.filter((l) => l.hasRecording)
  if (withAudio.length === 0) return null
  return (withAudio.find((l) => l.rawData.id === row.rawData.id) ?? withAudio[withAudio.length - 1]!).rawData.id
}
