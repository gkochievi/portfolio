/**
 * Stitch per-leg records into logical calls.
 *
 * Core Cluster: union-find over (clusterNodeId, callId) plus shared origLegId /
 * destLegId within one hour. Edge PBX: legs grouped by linkedid, ordered by
 * sequence. A merged row reports wall-clock duration and agent talk time and
 * carries its legs in `segments` for the expandable sub-table.
 */
import type { CallStatus, UnifiedCdr } from '@/types'
import { blobFor } from './legs'
import { detectCoreOperatorTransfer, detectCoreTransfer, detectEdgeTransfers, isCoreLeg, isEdgeLeg, sortEdgeLegs, tMs } from './transfers'

const LEG_STITCH_WINDOW_MS = 60 * 60 * 1000

class UnionFind {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!
      x = this.parent[x]!
    }
    return x
  }
  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

const origMs = (r: UnifiedCdr): number => (isCoreLeg(r.rawData) ? Date.parse(r.rawData.originatedAt) : tMs(r))
const discMs = (r: UnifiedCdr): number => (isCoreLeg(r.rawData) ? Date.parse(r.rawData.disconnectedAt) : tMs(r) + r.duration * 1000)

export function mergeCalls(records: UnifiedCdr[]): UnifiedCdr[] {
  const core = records.filter((r) => r.source === 'core')
  const edge = records.filter((r) => r.source === 'edge')
  return [...mergeCore(core), ...mergeEdge(edge)]
}

function mergeCore(core: UnifiedCdr[]): UnifiedCdr[] {
  if (core.length === 0) return []
  const uf = new UnionFind(core.length)
  const byGid = new Map<string, number>()
  const byLeg = new Map<string, number[]>()
  core.forEach((r, i) => {
    const raw = r.rawData
    if (!isCoreLeg(raw)) return
    if (raw.callId) {
      const gid = `${raw.clusterNodeId}:${raw.callId}`
      const seen = byGid.get(gid)
      if (seen === undefined) byGid.set(gid, i)
      else uf.union(seen, i)
    }
    for (const k of new Set([raw.origLegId, raw.destLegId])) {
      if (!k) continue
      const arr = byLeg.get(String(k)) ?? []
      arr.push(i)
      byLeg.set(String(k), arr)
    }
  })
  for (const idxs of byLeg.values()) {
    for (let a = 0; a < idxs.length; a++)
      for (let b = a + 1; b < idxs.length; b++)
        if (Math.abs(origMs(core[idxs[a]!]!) - origMs(core[idxs[b]!]!)) <= LEG_STITCH_WINDOW_MS) uf.union(idxs[a]!, idxs[b]!)
  }
  const groups = new Map<number, UnifiedCdr[]>()
  core.forEach((r, i) => {
    const root = uf.find(i)
    groups.set(root, [...(groups.get(root) ?? []), r])
  })
  return [...groups.values()].map((legs) => (legs.length === 1 ? single(legs[0]!) : combineCore(legs)))
}

function mergeEdge(edge: UnifiedCdr[]): UnifiedCdr[] {
  const groups = new Map<string, UnifiedCdr[]>()
  const singles: UnifiedCdr[] = []
  for (const r of edge) {
    const lid = isEdgeLeg(r.rawData) ? r.rawData.linkedid.trim() : ''
    if (!lid) {
      singles.push(single(r))
      continue
    }
    groups.set(lid, [...(groups.get(lid) ?? []), r])
  }
  return [...[...groups.values()].map((legs) => (legs.length === 1 ? single(legs[0]!) : combineEdge(legs))), ...singles]
}

function single(r: UnifiedCdr): UnifiedCdr {
  return { ...r, segmentCount: 1, searchBlob: r.searchBlob ?? blobFor([r]) }
}

function pickStatus(legs: UnifiedCdr[]): CallStatus {
  if (legs.some((l) => l.status === 'completed')) return 'completed'
  const order: CallStatus[] = ['busy', 'no_answer', 'failed', 'unknown']
  for (const s of order) if (legs.some((l) => l.status === s)) return s
  return 'unknown'
}

function combineCore(legsIn: UnifiedCdr[]): UnifiedCdr {
  const legs = [...legsIn].sort((a, b) => origMs(a) - origMs(b))
  const first = legs[0]!
  const wallClock = Math.max(0, Math.round((Math.max(...legs.map(discMs)) - Math.min(...legs.map(origMs))) / 1000))
  const connected = legs.filter((l) => l.billableSeconds > 0 || (isCoreLeg(l.rawData) && l.rawData.connectedAt != null))
  const answerLeg = connected.length ? connected[connected.length - 1]! : legs[legs.length - 1]!
  const operators = detectCoreOperatorTransfer(legs)
  const agentTalk = operators.talkSeconds || answerLeg.billableSeconds
  const raw = first.rawData
  const id = isCoreLeg(raw) ? `merged:core:${raw.clusterNodeId}-${raw.callId}` : `merged:${first.id}`
  return {
    id,
    timestamp: first.timestamp,
    source: 'core',
    callerNumber: first.callerNumber,
    calledNumber: first.calledNumber,
    finalNumber: answerLeg.finalNumber || answerLeg.calledNumber,
    duration: wallClock,
    billableSeconds: agentTalk,
    agentTalkSeconds: agentTalk,
    status: pickStatus(legs),
    disposition: answerLeg.disposition,
    originatingDevice: first.originatingDevice,
    terminatingDevice: answerLeg.terminatingDevice,
    accountCode: first.accountCode,
    context: answerLeg.context,
    hangupBy: legs[legs.length - 1]!.hangupBy,
    transfer: detectCoreTransfer(legs),
    segmentCount: legs.length,
    segments: legs,
    searchBlob: blobFor(legs),
    rawData: answerLeg.rawData,
    hasRecording: legs.some((l) => l.hasRecording),
  }
}

function combineEdge(legsIn: UnifiedCdr[]): UnifiedCdr {
  const legs = sortEdgeLegs(legsIn)
  const first = legs[0]!
  const last = legs[legs.length - 1]!
  const startMs = Math.min(...legs.map(tMs))
  const endMs = Math.max(...legs.map((l) => tMs(l) + l.duration * 1000))
  const connected = legs.filter((l) => l.status === 'completed' || l.billableSeconds > 0)
  const answerLeg = connected.length ? connected[connected.length - 1]! : last
  const status = pickStatus(legs)
  const transfer = detectEdgeTransfers(legs)
  const lid = isEdgeLeg(first.rawData) ? first.rawData.linkedid : first.id
  return {
    id: `merged:edge:${lid}`,
    timestamp: first.timestamp,
    source: 'edge',
    callerNumber: first.callerNumber,
    calledNumber: first.calledNumber,
    finalNumber: transfer.transferTo || answerLeg.finalNumber || answerLeg.calledNumber,
    duration: Math.max(0, Math.round((endMs - startMs) / 1000)),
    billableSeconds: answerLeg.billableSeconds,
    agentTalkSeconds: answerLeg.billableSeconds,
    status,
    disposition: answerLeg.disposition,
    originatingDevice: first.originatingDevice,
    terminatingDevice: answerLeg.terminatingDevice,
    accountCode: first.accountCode,
    context: first.context,
    hangupBy: answerLeg.hangupBy ?? (status === 'completed' ? undefined : last.hangupBy),
    transfer,
    segmentCount: legs.length,
    segments: legs,
    searchBlob: blobFor(legs),
    rawData: answerLeg.rawData,
    hasRecording: legs.some((l) => l.hasRecording),
  }
}
