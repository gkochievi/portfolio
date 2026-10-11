/**
 * Raw call legs from both platforms. The calls group merges legs into logical
 * calls and reconstructs transfers at read time; this module only writes legs
 * the way each platform would.
 *
 * Core Cluster legs of one call share `callId` or a leg id (origLegId /
 * destLegId) within the hour. Edge PBX legs share `linkedid`, ordered by
 * `sequence`. Queue calls carry the hunt pilot in `originalCalledNumber` and
 * `huntPilot`: hunt distribution alone is not a transfer.
 */
import type { CoreLeg, EdgeLeg } from '@/types'
import { queueAgents, roster, supervisors, type RosterAgent } from './contactCentre'
import { extensions } from './extensions'
import { ANCHOR_MS, MINUTE, fakeNumber, fileStamp, iso, isWeekend, rngFor, tenantMs } from './util'

const rng = rngFor(1)

/* ----------------------------------------------------------- time slots */

/** Call start times: `count` calls spread over business days, plus a busy "today". */
function slots(totalPast: number, today: number, eveningShare: number): number[] {
  const out: number[] = []
  // Today: 09:30 up to two minutes before the anchor (15:30 Tbilisi).
  const todayStart = tenantMs(0, 9, 30)
  const todayEnd = ANCHOR_MS - 2 * MINUTE
  for (let i = 0; i < today; i++) out.push(todayStart + Math.floor(rng.next() * (todayEnd - todayStart)))
  // Days 1-29, weekends quieter.
  const weights: [number, number][] = []
  for (let d = 1; d <= 29; d++) weights.push([d, isWeekend(d) ? 0.3 : 1])
  for (let i = 0; i < totalPast; i++) {
    const d = rng.weighted(weights)
    const evening = rng.chance(eveningShare)
    const h = evening ? rng.int(19, 21) : rng.weighted<number>([[9, 6], [10, 10], [11, 11], [12, 9], [13, 8], [14, 10], [15, 10], [16, 9], [17, 7], [18, 4]])
    out.push(tenantMs(d, h, rng.int(0, 59), rng.int(0, 59)))
  }
  return out.sort((a, b) => a - b)
}

/* ------------------------------------------------------------ Core Cluster */

interface Queue {
  pilot: string
  name: string
  account: string
  weight: number
}

const QUEUES: Queue[] = [
  { pilot: '2000', name: 'Claims Line', account: 'CLAIMS', weight: 34 },
  { pilot: '2010', name: 'Renewals Desk', account: 'RENEWALS', weight: 20 },
  { pilot: '2020', name: 'Outage Hotline', account: 'OUTAGE', weight: 16 },
  { pilot: '2030', name: 'Courier Callbacks', account: 'COURIER', weight: 12 },
  { pilot: '2040', name: 'Clinic Reminders', account: 'CLINIC', weight: 8 },
]
const queueWeights = QUEUES.map((q) => [q, q.weight] as const)
const GATEWAYS = ['GW-VAKE-01', 'GW-VAKE-01', 'GW-VAKE-02', 'GW-RUSTAVI-01'] as const
const EDGE_TRUNK = 'TRUNK-EDGE-KUTAISI'
const deskPhones = roster.filter((a) => a.device.startsWith('DESK'))

let coreSeq = 1001
let callIdSeq = 1452100
let legIdSeq = 31204000
const nextLegId = () => ++legIdSeq

type LegInput = Partial<CoreLeg> & Pick<CoreLeg, 'callingNumber' | 'originalCalledNumber' | 'finalCalledNumber' | 'origDevice' | 'destDevice'>

function coreLeg(start: number, ringSec: number, talkSec: number | null, input: LegInput): CoreLeg {
  const answered = talkSec !== null
  const connected = answered ? start + ringSec * 1000 : null
  const disconnected = connected !== null ? connected + (talkSec ?? 0) * 1000 : start + ringSec * 1000
  const internal = (n: string) => /^\d{4}$/.test(n)
  return {
    id: `core-${coreSeq++}`,
    clusterNodeId: rng.chance(0.7) ? 1 : 2,
    callId: callIdSeq,
    origLegId: nextLegId(),
    destLegId: nextLegId(),
    originatedAt: iso(start),
    connectedAt: connected === null ? null : iso(connected),
    disconnectedAt: iso(disconnected),
    callingPartition: internal(input.callingNumber) ? 'Internal_PT' : 'Inbound_PT',
    originalCalledPartition: internal(input.originalCalledNumber)
      ? QUEUES.some((q) => q.pilot === input.originalCalledNumber) || input.originalCalledNumber === '2001'
        ? 'Hunt_PT'
        : 'Internal_PT'
      : 'Outbound_PT',
    finalCalledPartition: internal(input.finalCalledNumber) ? (input.finalCalledNumber.startsWith('5') ? 'Branch_PT' : 'Internal_PT') : 'Outbound_PT',
    lastRedirectNumber: '',
    lastRedirectReason: 0,
    lastRedirectOnBehalfOf: 0,
    origCause: answered ? (rng.chance(0.5) ? 16 : 0) : 0,
    destCause: answered ? 16 : 19,
    huntPilot: '',
    durationSec: talkSec ?? 0,
    accountCode: '',
    hasRecording: false,
    ...input,
  }
}

const talk = (min = 35, max = 540) => rng.int(min, max)
const ring = () => rng.int(3, 22)
const pickAgent = (): RosterAgent => rng.pick(queueAgents)
const pickSupervisor = (): RosterAgent => rng.pick(supervisors)

function inboundQueue(t: number): CoreLeg[] {
  const q = rng.weighted(queueWeights)
  const caller = fakeNumber(rng)
  const outcome = rng.weighted<string>([['answered', 84], ['abandoned', 12], ['busy', 2], ['failed', 2]])
  const base = { callingNumber: caller, originalCalledNumber: q.pilot, huntPilot: q.pilot, accountCode: q.account, origDevice: rng.pick(GATEWAYS) }
  if (outcome !== 'answered') {
    return [
      coreLeg(t, outcome === 'abandoned' ? rng.int(15, 140) : 1, null, {
        ...base,
        finalCalledNumber: q.pilot,
        destDevice: '',
        destCause: outcome === 'busy' ? 17 : outcome === 'failed' ? 41 : 19,
        origCause: outcome === 'abandoned' ? 16 : 0,
      }),
    ]
  }
  const agent = pickAgent()
  return [coreLeg(t, ring(), talk(), { ...base, finalCalledNumber: agent.extension, lastRedirectNumber: q.pilot, destDevice: agent.device })]
}

function outbound(t: number): CoreLeg[] {
  const agent = pickAgent()
  const outcome = rng.weighted<string>([['answered', 72], ['no_answer', 18], ['busy', 6], ['failed', 4]])
  const number = fakeNumber(rng)
  const base = { callingNumber: agent.extension, originalCalledNumber: number, finalCalledNumber: number, origDevice: agent.device, destDevice: rng.pick(GATEWAYS) }
  if (outcome === 'answered') return [coreLeg(t, ring(), talk(20, 420), { ...base, accountCode: rng.chance(0.5) ? 'RENEWALS' : 'CLAIMS' })]
  return [coreLeg(t, outcome === 'no_answer' ? 30 : 2, null, { ...base, destCause: outcome === 'busy' ? 17 : outcome === 'failed' ? 1 : 19 })]
}

function internalCall(t: number): CoreLeg[] {
  const a = rng.pick(deskPhones.length ? deskPhones : roster)
  let b = rng.pick(roster)
  if (b.extension === a.extension) b = supervisors[0] ?? b
  const answered = rng.chance(0.85)
  return [
    coreLeg(t, ring(), answered ? talk(15, 300) : null, {
      callingNumber: a.extension,
      originalCalledNumber: b.extension,
      finalCalledNumber: b.extension,
      origDevice: a.device,
      destDevice: b.extension.startsWith('5') ? EDGE_TRUNK : b.device,
    }),
  ]
}

/** Caller → hunt → agent, then the agent blind-transfers to a supervisor. */
function blindTransfer(t: number): CoreLeg[] {
  const q = rng.weighted(queueWeights)
  const agent = pickAgent()
  const sup = pickSupervisor()
  const caller = fakeNumber(rng)
  const talk1 = talk(40, 200)
  const r1 = ring()
  const leg1 = coreLeg(t, r1, talk1, {
    callingNumber: caller, originalCalledNumber: q.pilot, finalCalledNumber: agent.extension, lastRedirectNumber: q.pilot,
    huntPilot: q.pilot, accountCode: q.account, origDevice: rng.pick(GATEWAYS), destDevice: agent.device, destCause: 393216,
  })
  const t2 = t + (r1 + talk1) * 1000
  const leg2 = coreLeg(t2, ring(), talk(30, 360), {
    callingNumber: caller, originalCalledNumber: sup.extension, finalCalledNumber: sup.extension, lastRedirectNumber: agent.extension,
    lastRedirectReason: 4, lastRedirectOnBehalfOf: 4, accountCode: q.account, origDevice: leg1.origDevice, destDevice: sup.device,
    origLegId: leg1.origLegId,
  })
  return [leg1, leg2]
}

/** Agent consults a supervisor, then completes the transfer (three legs). */
function attendedTransfer(t: number): CoreLeg[] {
  const q = rng.weighted(queueWeights)
  const agent = pickAgent()
  const sup = pickSupervisor()
  const caller = fakeNumber(rng)
  const r1 = ring()
  const talk1 = talk(60, 240)
  const leg1 = coreLeg(t, r1, talk1, {
    callingNumber: caller, originalCalledNumber: q.pilot, finalCalledNumber: agent.extension, lastRedirectNumber: q.pilot,
    huntPilot: q.pilot, accountCode: q.account, origDevice: rng.pick(GATEWAYS), destDevice: agent.device, destCause: 393216,
  })
  const consultAt = t + (r1 + talk1 - 45) * 1000
  callIdSeq++
  const leg2 = coreLeg(consultAt, 4, 38, {
    callingNumber: agent.extension, originalCalledNumber: sup.extension, finalCalledNumber: sup.extension,
    origDevice: agent.device, destDevice: sup.device, destCause: 393216, origCause: 393216,
  })
  const leg3 = coreLeg(consultAt + 43_000, 0, talk(45, 420), {
    callingNumber: caller, originalCalledNumber: sup.extension, finalCalledNumber: sup.extension, lastRedirectNumber: agent.extension,
    lastRedirectReason: 4, lastRedirectOnBehalfOf: 4, accountCode: q.account, origDevice: leg1.origDevice, destDevice: sup.device,
    origLegId: leg1.origLegId, destLegId: leg2.destLegId,
  })
  return [leg1, leg2, leg3]
}

/** The agent's phone rang out and forwarded (no answer) to a supervisor. */
function forwardNoAnswer(t: number): CoreLeg[] {
  const q = rng.weighted(queueWeights)
  const agent = pickAgent()
  const sup = pickSupervisor()
  return [
    coreLeg(t, rng.int(24, 32), talk(30, 300), {
      callingNumber: fakeNumber(rng), originalCalledNumber: q.pilot, finalCalledNumber: sup.extension, lastRedirectNumber: agent.extension,
      lastRedirectReason: 15, huntPilot: q.pilot, accountCode: q.account, origDevice: rng.pick(GATEWAYS), destDevice: sup.device,
    }),
  ]
}

/** Agent adds a supervisor into a three-way conference. */
function conference(t: number): CoreLeg[] {
  const q = rng.weighted(queueWeights)
  const agent = pickAgent()
  const sup = pickSupervisor()
  const caller = fakeNumber(rng)
  const r1 = ring()
  const talk1 = talk(240, 600)
  const leg1 = coreLeg(t, r1, talk1, {
    callingNumber: caller, originalCalledNumber: q.pilot, finalCalledNumber: agent.extension, lastRedirectNumber: q.pilot,
    huntPilot: q.pilot, accountCode: q.account, origDevice: rng.pick(GATEWAYS), destDevice: agent.device,
  })
  const joinAt = t + (r1 + 90) * 1000
  const leg2 = coreLeg(joinAt, ring(), talk1 - 100, {
    callingNumber: caller, originalCalledNumber: sup.extension, finalCalledNumber: sup.extension, lastRedirectNumber: agent.extension,
    lastRedirectReason: 98, lastRedirectOnBehalfOf: 5, accountCode: q.account, origDevice: leg1.origDevice, destDevice: sup.device,
    origLegId: leg1.origLegId,
  })
  return [leg1, leg2]
}

/** Claims Line overflowed to its overflow pilot 2001 and was answered there. */
function huntRedirect(t: number): CoreLeg[] {
  const agent = pickAgent()
  return [
    coreLeg(t, rng.int(40, 90), talk(), {
      callingNumber: fakeNumber(rng), originalCalledNumber: '2000', finalCalledNumber: agent.extension, lastRedirectNumber: '2001',
      lastRedirectOnBehalfOf: 10, huntPilot: '2001', accountCode: 'CLAIMS', origDevice: rng.pick(GATEWAYS), destDevice: agent.device,
    }),
  ]
}

/** The showcase: customer → hunt 2000 → agent 2104 → supervisor 2190 → specialist 5012, today. */
function threeHopChain(t: number): CoreLeg[] {
  const caller = '0322004417'
  const agent = roster.find((a) => a.extension === '2104') ?? pickAgent()
  const sup = roster.find((a) => a.extension === '2190') ?? pickSupervisor()
  const leg1 = coreLeg(t, 6, 142, {
    callingNumber: caller, originalCalledNumber: '2000', finalCalledNumber: '2104', lastRedirectNumber: '2000',
    huntPilot: '2000', accountCode: 'CLAIMS', origDevice: 'GW-VAKE-01', destDevice: agent.device, destCause: 393216,
  })
  const leg2 = coreLeg(t + 148_000, 5, 96, {
    callingNumber: caller, originalCalledNumber: '2190', finalCalledNumber: '2190', lastRedirectNumber: '2104',
    lastRedirectReason: 4, lastRedirectOnBehalfOf: 4, accountCode: 'CLAIMS', origDevice: 'GW-VAKE-01', destDevice: sup.device,
    destCause: 393216, origLegId: leg1.origLegId,
  })
  const leg3 = coreLeg(t + 249_000, 9, 311, {
    callingNumber: caller, originalCalledNumber: '5012', finalCalledNumber: '5012', lastRedirectNumber: '2190',
    lastRedirectReason: 4, lastRedirectOnBehalfOf: 4, accountCode: 'CLAIMS', origDevice: 'GW-VAKE-01', destDevice: EDGE_TRUNK,
    origLegId: leg1.origLegId,
  })
  for (const leg of [leg1, leg2, leg3]) leg.hasRecording = true
  return [leg1, leg2, leg3]
}

function buildCoreLegs(): CoreLeg[] {
  const scenarios: [(t: number) => CoreLeg[], number][] = [
    [inboundQueue, 56],
    [outbound, 13],
    [internalCall, 10],
    [blindTransfer, 7],
    [attendedTransfer, 4],
    [forwardNoAnswer, 3],
    [conference, 4],
    [huntRedirect, 3],
  ]
  const legs: CoreLeg[] = []
  for (const t of slots(173, 36, 0.04)) {
    callIdSeq += rng.int(3, 40)
    legs.push(...rng.weighted(scenarios)(t))
  }
  callIdSeq += 7
  legs.push(...threeHopChain(tenantMs(0, 13, 12, 40)))
  // Recordings: about 60 % of answered contact-centre legs, fewer internal ones.
  for (const leg of legs) {
    if (leg.connectedAt === null || leg.hasRecording) continue
    const contactCentre = leg.huntPilot !== '' || leg.destDevice.startsWith('Agent') || leg.origDevice.startsWith('Agent')
    leg.hasRecording = rng.chance(contactCentre ? 0.68 : 0.2)
  }
  // The console opens on "today", and a few minutes past midnight that is only the last few
  // minutes before the anchor: keep a steady trickle of finished calls right up to it.
  const tailScenarios = [inboundQueue, inboundQueue, outbound, inboundQueue]
  CORE_TAIL_STARTS.forEach((minutes, i) => {
    const scenario = tailScenarios[i % tailScenarios.length] ?? inboundQueue
    const call = fitTail(
      () => {
        callIdSeq += rng.int(3, 40)
        return scenario(ANCHOR_MS - minutes * MINUTE)
      },
      (leg) => Date.parse(leg.disconnectedAt),
      () => {
        const saved = [coreSeq, callIdSeq, legIdSeq] as const
        return () => {
          ;[coreSeq, callIdSeq, legIdSeq] = saved
        }
      },
    )
    for (const leg of call) leg.hasRecording = leg.connectedAt !== null && rng.chance(0.68)
    legs.push(...call)
  })
  return legs.sort((a, b) => a.originatedAt.localeCompare(b.originatedAt))
}

/** Minutes before the anchor at which the tail calls start. Each one has ended by the anchor (no record ends "in the future"). */
const CORE_TAIL_STARTS = [1.4, 3.4, 5.2, 8.6]
const EDGE_TAIL_STARTS = [1.1, 2.6, 4.4, 6.8, 9.5, 14, 19, 26, 34]
const TAIL_GUARD_MS = 15_000

/**
 * Build a call with `make` until every leg has ended before the anchor.
 * `save()` snapshots the id counters and returns the function that rewinds them,
 * so rejected attempts leave no gaps in the id sequences.
 */
function fitTail<T>(make: () => T[], endOf: (leg: T) => number, save: () => () => void): T[] {
  let call: T[] = []
  for (let attempt = 0; attempt < 80; attempt++) {
    const rewind = save()
    call = make()
    if (call.every((leg) => endOf(leg) <= ANCHOR_MS - TAIL_GUARD_MS)) return call
    rewind()
  }
  return call
}

export const coreLegs: CoreLeg[] = buildCoreLegs()

/* --------------------------------------------------------------- Edge PBX */

interface Site {
  trunk: string
  did: string
  queue: string
  queueName: string
  prefix: string
}

const SITES: Site[] = [
  { trunk: 'trunk-kutaisi', did: '0322000500', queue: '5901', queueName: 'kutaisi-front', prefix: '50' },
  { trunk: 'trunk-batumi', did: '0322000510', queue: '5911', queueName: 'batumi-front', prefix: '51' },
  { trunk: 'trunk-rustavi', did: '0322000520', queue: '5921', queueName: 'rustavi-office', prefix: '52' },
]

let edgeSeq = 1001
let chanSeq = 0xa100
let uniqueSeq = 4800
const chan = (endpoint: string) => `SIP/${endpoint}-0000${(chanSeq++).toString(16)}`

function siteExtensions(site: Site): string[] {
  const list = extensions.filter((e) => e.number.startsWith(site.prefix)).map((e) => e.number)
  return list.length ? list : ['5104']
}

interface EdgeInput {
  src: string
  dst: string
  dcontext: string
  channel: string
  dstchannel: string
  lastapp: string
  lastdata: string
  disposition: EdgeLeg['disposition']
  did?: string
  ringSec: number
  talkSec: number
  clid?: string
}

function edgeLeg(start: number, linkedid: string, sequence: number, input: EdgeInput): EdgeLeg {
  const unique = `${Math.floor(start / 1000)}.${uniqueSeq++}`
  const answered = input.disposition === 'ANSWERED'
  const billsec = answered ? input.talkSec : 0
  const name = extensions.find((e) => e.number === input.src)?.name
  return {
    id: `edge-${edgeSeq++}`,
    calldate: iso(start),
    clid: input.clid ?? (name ? `"${name}" <${input.src}>` : `"${input.src}" <${input.src}>`),
    src: input.src,
    dst: input.dst,
    dcontext: input.dcontext,
    channel: input.channel,
    dstchannel: input.dstchannel,
    lastapp: input.lastapp,
    lastdata: input.lastdata,
    duration: input.ringSec + billsec,
    billsec,
    disposition: input.disposition,
    accountcode: '',
    uniqueid: unique,
    userfield: '',
    did: input.did ?? '',
    recordingfile: '',
    cnum: input.src,
    linkedid: linkedid || unique,
    sequence,
    hangupsource: answered ? (rng.chance(0.55) ? input.channel : input.dstchannel) : input.disposition === 'NO ANSWER' ? 'dialplan/timeout' : input.channel,
    hasRecording: false,
  }
}

function edgeCall(t: number): EdgeLeg[] {
  const site = rng.pick(SITES)
  const exts = siteExtensions(site)
  const ext = rng.pick(exts)
  const kind = rng.weighted<string>([['inbound', 34], ['queue', 18], ['outbound', 22], ['internal', 12], ['blind', 7], ['attended', 4], ['conf', 3]])
  const disposition = (): EdgeLeg['disposition'] =>
    rng.weighted<EdgeLeg['disposition']>([['ANSWERED', 80], ['NO ANSWER', 14], ['BUSY', 4], ['FAILED', 2]])
  const caller = fakeNumber(rng)
  const trunkChan = () => chan(site.trunk)

  if (kind === 'outbound') {
    const number = fakeNumber(rng)
    const d = disposition()
    return [edgeLeg(t, '', 1, {
      src: ext, dst: number, dcontext: 'outbound', channel: chan(ext), dstchannel: trunkChan(), lastapp: 'Dial',
      lastdata: `SIP/${site.trunk}/${number},300`, disposition: d, ringSec: rng.int(4, 25), talkSec: talk(15, 400),
    })]
  }
  if (kind === 'internal') {
    const other = rng.pick(exts.filter((e) => e !== ext)) ?? '5104'
    return [edgeLeg(t, '', 1, {
      src: ext, dst: other, dcontext: 'internal', channel: chan(ext), dstchannel: chan(other), lastapp: 'Dial',
      lastdata: `SIP/${other},30,tT`, disposition: disposition(), ringSec: rng.int(2, 18), talkSec: talk(10, 260),
    })]
  }
  if (kind === 'inbound' || kind === 'queue') {
    const queue = kind === 'queue'
    return [edgeLeg(t, '', 1, {
      src: caller, dst: queue ? site.queue : ext, dcontext: queue ? 'queues' : 'inbound', did: site.did, channel: trunkChan(),
      dstchannel: chan(ext), lastapp: queue ? 'Queue' : 'Dial', lastdata: queue ? `${site.queueName},t,,,300` : `SIP/${ext},30,tT`,
      disposition: disposition(), ringSec: rng.int(3, queue ? 90 : 25), talkSec: talk(),
    })]
  }
  // Transfers: the first leg's uniqueid is the call's linkedid.
  const other = rng.pick(exts.filter((e) => e !== ext)) ?? '5110'
  const inChan = trunkChan()
  const r1 = rng.int(3, 15)
  const talk1 = talk(40, 180)
  const leg1 = edgeLeg(t, '', 1, {
    src: caller, dst: ext, dcontext: 'inbound', did: site.did, channel: inChan, dstchannel: chan(ext),
    lastapp: kind === 'blind' ? 'BlindTransfer' : 'Dial', lastdata: `SIP/${ext},30,tT`, disposition: 'ANSWERED', ringSec: r1, talkSec: talk1,
  })
  const linked = leg1.linkedid
  const t2 = t + (r1 + talk1) * 1000
  if (kind === 'blind') {
    return [leg1, edgeLeg(t2, linked, 2, {
      src: caller, dst: other, dcontext: 'internal', channel: inChan, dstchannel: chan(other), lastapp: 'Dial',
      lastdata: `SIP/${other},30,tT`, disposition: 'ANSWERED', ringSec: rng.int(3, 15), talkSec: talk(30, 300),
    })]
  }
  if (kind === 'attended') {
    const consultChan = chan(ext)
    const leg2 = edgeLeg(t2 - 40_000, linked, 2, {
      src: ext, dst: other, dcontext: 'internal', channel: consultChan, dstchannel: chan(other), lastapp: 'Dial',
      lastdata: `SIP/${other},30,tT`, disposition: 'ANSWERED', ringSec: 4, talkSec: 32,
    })
    const leg3 = edgeLeg(t2, linked, 3, {
      src: caller, dst: other, dcontext: 'internal', channel: inChan, dstchannel: chan(other), lastapp: 'AttendedTransfer',
      lastdata: `SIP/${other}`, disposition: 'ANSWERED', ringSec: 0, talkSec: talk(30, 360),
    })
    return [leg1, leg2, leg3]
  }
  return [leg1, edgeLeg(t + (r1 + 60) * 1000, linked, 2, {
    src: ext, dst: '5950', dcontext: 'conferences', channel: chan(ext), dstchannel: chan('confbridge'), lastapp: 'ConfBridge',
    lastdata: '5950', disposition: 'ANSWERED', ringSec: 0, talkSec: talk1,
  })]
}

/** '<dir>-<a>-<b>-YYYYMMDD-HHMMSS.wav', the Edge PBX recording naming scheme. */
export function edgeRecordingName(leg: Pick<EdgeLeg, 'calldate' | 'src' | 'dst' | 'dcontext'>): string {
  const dir = leg.dcontext === 'outbound' ? 'out' : leg.dcontext === 'internal' ? 'internal' : leg.dcontext === 'queues' ? 'q' : 'in'
  return `${dir}-${leg.dst}-${leg.src}-${fileStamp(Date.parse(leg.calldate))}.wav`
}

function buildEdgeLegs(): EdgeLeg[] {
  const legs: EdgeLeg[] = []
  for (const t of slots(127, 13, 0.08)) legs.push(...edgeCall(t))
  for (const leg of legs) {
    if (leg.disposition !== 'ANSWERED' || leg.lastapp === 'ConfBridge') continue
    if (rng.chance(0.6)) {
      leg.hasRecording = true
      leg.recordingfile = edgeRecordingName(leg)
    }
  }
  // About 15 older rows still miss "Hangup by": the backfill's work queue.
  const older = legs.filter((l) => Date.parse(l.calldate) < ANCHOR_MS - 36 * 3_600_000)
  for (const leg of rng.shuffle(older).slice(0, 15)) leg.hangupsource = ''
  // Same trickle as the Core Cluster tail: finished calls right up to the anchor.
  for (const minutes of EDGE_TAIL_STARTS) {
    const call = fitTail(
      () => edgeCall(ANCHOR_MS - minutes * MINUTE),
      (leg) => Date.parse(leg.calldate) + leg.duration * 1000,
      () => {
        const saved = [edgeSeq, uniqueSeq, chanSeq] as const
        return () => {
          ;[edgeSeq, uniqueSeq, chanSeq] = saved
        }
      },
    )
    for (const leg of call) {
      if (leg.disposition === 'ANSWERED' && leg.lastapp !== 'ConfBridge' && rng.chance(0.6)) {
        leg.hasRecording = true
        leg.recordingfile = edgeRecordingName(leg)
      }
    }
    legs.push(...call)
  }
  return legs.sort((a, b) => a.calldate.localeCompare(b.calldate) || a.sequence - b.sequence)
}

export const edgeLegs: EdgeLeg[] = buildEdgeLegs()
