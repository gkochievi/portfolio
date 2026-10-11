/**
 * Transfer / redirect detection for Core Cluster and Edge PBX calls.
 *
 * A transferred call touches several parties (A calls B, B transfers to C, ...).
 * These helpers rebuild that party chain from the underlying legs and normalise
 * it into a `TransferInfo`: a flag, the first/last targets and the ordered hops.
 *
 * Two granularities:
 *  - one leg: baseline detection used by the per-leg mappers, so transfer info
 *    exists even when "Combine related calls" is off;
 *  - a leg group (merged call): the full multi-hop chain.
 *
 * Transfers, forwards, conferences and hunt redirects all set wasTransferred,
 * each with a `reason` so the UI can tell a real transfer from a forward.
 * Hunt distribution alone (pilot -> one agent) is not a transfer.
 */
import type { CoreLeg, EdgeLeg, TransferHop, TransferInfo, TransferReason, UnifiedCdr } from '@/types'

const str = (v: unknown): string => (v == null ? '' : String(v)).trim()

export const tMs = (r: UnifiedCdr): number => {
  const ms = Date.parse(r.timestamp)
  return Number.isFinite(ms) ? ms : 0
}

export const isCoreLeg = (raw: CoreLeg | EdgeLeg): raw is CoreLeg => 'callId' in raw
export const isEdgeLeg = (raw: CoreLeg | EdgeLeg): raw is EdgeLeg => 'linkedid' in raw

/** Feature codes (*98 ...) and empty values are never transfer endpoints. */
export function isFeatureNumber(dn: string): boolean {
  return !dn || /^\*\d+/.test(dn)
}

/* ------------------------------------------------------------ Core Cluster */

/** Operator endpoints: agent device profiles are named Agent01..Agent40. */
export const OPERATOR_DEVICE_RE = /^Agent\d+$/
export const TRANSFER_CAUSE = 393216

function coreReason(leg: CoreLeg): TransferReason {
  if (leg.origCause === TRANSFER_CAUSE || leg.destCause === TRANSFER_CAUSE) return 'transfer'
  const rr = leg.lastRedirectReason
  if (rr === 4) return 'transfer'
  if (rr === 5 || rr === 98) return 'conference'
  if ([1, 2, 7, 15, 50, 63].includes(rr)) return 'forward'
  const ob = leg.lastRedirectOnBehalfOf
  if (ob === 4) return 'transfer'
  if (ob === 5) return 'conference'
  return 'redirect'
}

/** True when a Core Cluster leg shows a real party change (not hunt pass-through). */
function coreHasRedirect(leg: CoreLeg): boolean {
  if (leg.origCause === TRANSFER_CAUSE || leg.destCause === TRANSFER_CAUSE) return true
  const orig = str(leg.originalCalledNumber)
  const final = str(leg.finalCalledNumber)
  const redirect = str(leg.lastRedirectNumber)
  return orig !== '' && final !== '' && orig !== final && redirect !== '' && redirect !== orig && !isFeatureNumber(redirect) && !isFeatureNumber(orig)
}

const coreOrigMs = (r: UnifiedCdr): number => {
  const raw = r.rawData
  return isCoreLeg(raw) ? Date.parse(raw.originatedAt) : tMs(r)
}

/** Rebuild the transfer chain for 1..N Core Cluster legs. */
export function detectCoreTransfer(legs: UnifiedCdr[]): TransferInfo {
  const sorted = [...legs].sort((a, b) => coreOrigMs(a) - coreOrigMs(b))
  const path: string[] = []
  const partitionOf = new Map<string, string>()
  const pilots = new Set<string>()
  const remember = (dn: string, part: string) => {
    if (dn && part && !partitionOf.has(dn)) partitionOf.set(dn, part)
  }
  const pushDistinct = (dn: string) => {
    if (!dn || isFeatureNumber(dn)) return
    if (path.length && path[path.length - 1] === dn) return
    path.push(dn)
  }
  let anyRedirect = false
  const reasons: TransferReason[] = []
  for (const leg of sorted) {
    const raw = leg.rawData
    if (!isCoreLeg(raw)) continue
    const calling = str(raw.callingNumber) || leg.callerNumber
    const orig = str(raw.originalCalledNumber) || leg.calledNumber
    const final = str(raw.finalCalledNumber) || str(leg.finalNumber) || leg.calledNumber
    if (raw.huntPilot) pilots.add(raw.huntPilot)
    remember(calling, raw.callingPartition)
    remember(orig, raw.originalCalledPartition)
    remember(final, raw.finalCalledPartition)
    // Path = each leg's original-called -> final target, in time order.
    if (path.length === 0 && calling) pushDistinct(calling)
    pushDistinct(orig)
    pushDistinct(final)
    if (coreHasRedirect(raw)) {
      anyRedirect = true
      reasons.push(coreReason(raw))
    }
  }
  return buildTransferInfo(path, pilots, partitionOf, pickReason(reasons), anyRedirect)
}

/** The directory number that answered on a real operator device ('' for gateways, pilots). */
export function coreAgentDn(leg: CoreLeg): string {
  if (OPERATOR_DEVICE_RE.test(leg.destDevice)) return leg.finalCalledNumber || leg.originalCalledNumber
  if (OPERATOR_DEVICE_RE.test(leg.origDevice)) return leg.callingNumber
  return ''
}

/** Operator-to-operator transfer: 2+ distinct agent DNs answered the call. */
export function detectCoreOperatorTransfer(legs: UnifiedCdr[]): { wasTransferred: boolean; operators: string[]; talkSeconds: number } {
  const sorted = [...legs].sort((a, b) => coreOrigMs(a) - coreOrigMs(b))
  const ops: string[] = []
  let talkSeconds = 0
  for (const leg of sorted) {
    const raw = leg.rawData
    if (!isCoreLeg(raw)) continue
    const answered = raw.durationSec > 0 || raw.connectedAt != null
    if (!answered) continue
    const dn = coreAgentDn(raw)
    if (!dn || isFeatureNumber(dn)) continue
    talkSeconds += raw.durationSec
    if (ops[ops.length - 1] !== dn) ops.push(dn)
  }
  return { wasTransferred: new Set(ops).size >= 2, operators: ops, talkSeconds }
}

/* ---------------------------------------------------------------- Edge PBX */

const seq = (r: UnifiedCdr): number => (isEdgeLeg(r.rawData) ? r.rawData.sequence : 0)
export const sortEdgeLegs = (legs: UnifiedCdr[]): UnifiedCdr[] => [...legs].sort((a, b) => seq(a) - seq(b) || tMs(a) - tMs(b))

/** Rebuild the transfer chain for 1..N Edge PBX legs sharing a linkedid. */
export function detectEdgeTransfers(legs: UnifiedCdr[]): TransferInfo {
  const sorted = sortEdgeLegs(legs)
  const path: string[] = []
  const contextOf = new Map<string, string>()
  const push = (dn: string, ctx: string) => {
    if (!dn) return
    // A party that is already on the chain (the customer on the bridged leg of an attended transfer) is not a new hop.
    if (path.includes(dn)) return
    path.push(dn)
    if (ctx && !contextOf.has(dn)) contextOf.set(dn, ctx)
  }
  const apps: string[] = []
  for (const leg of sorted) {
    const raw = leg.rawData
    if (!isEdgeLeg(raw)) continue
    push(str(raw.src) || leg.callerNumber, raw.dcontext)
    push(str(raw.dst) || leg.calledNumber, raw.dcontext)
    apps.push(raw.lastapp.toLowerCase())
  }
  let reason: TransferReason | undefined
  if (apps.includes('attendedtransfer')) reason = 'attendedTransfer'
  else if (apps.includes('blindtransfer')) reason = 'blindTransfer'
  else if (apps.includes('transfer')) reason = 'transfer'
  else if (apps.includes('confbridge')) reason = 'conference'
  return buildTransferInfo(path, new Set(), contextOf, reason ?? 'transfer', reason !== undefined)
}

/** Device extension from a channel: 'SIP/5104-0000a1b2' -> '5104'; '' for trunks. */
export function deviceExt(channel: string): string {
  const m = String(channel || '').match(/^(?:SIP|Local)\/(\d{2,7})[-@]/)
  return m ? m[1]! : ''
}

/* ------------------------------------------------------------------ shared */

function pickReason(reasons: TransferReason[]): TransferReason {
  const order: TransferReason[] = ['transfer', 'attendedTransfer', 'blindTransfer', 'conference', 'forward']
  for (const r of order) if (reasons.includes(r)) return r
  return 'redirect'
}

function buildTransferInfo(
  path: string[],
  pilots: Set<string>,
  partitionOf: Map<string, string>,
  reason: TransferReason,
  hadRedirectSignal: boolean,
): TransferInfo {
  const targets = path.slice(1) // everything after the caller
  const realTargets = targets.filter((dn) => !pilots.has(dn))
  const wasTransferred = realTargets.length >= 2 || hadRedirectSignal
  if (!wasTransferred) return { wasTransferred: false, transferCount: 0, chain: path, hops: [] }
  const hops: TransferHop[] = []
  for (let i = 1; i < targets.length; i++) {
    const from = targets[i - 1]!
    const to = targets[i]!
    hops.push({
      from,
      to,
      fromPartition: partitionOf.get(from) || undefined,
      toPartition: partitionOf.get(to) || undefined,
      // A hop out of a hunt pilot is queue distribution, labelled as a redirect.
      reason: pilots.has(from) ? 'redirect' : reason,
    })
  }
  return {
    wasTransferred: true,
    transferCount: Math.max(1, hops.length),
    transferFrom: targets[0] || undefined,
    transferTo: targets[targets.length - 1] || undefined,
    reason,
    chain: path,
    hops,
  }
}
