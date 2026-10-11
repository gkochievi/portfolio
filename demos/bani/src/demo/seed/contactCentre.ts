/** Contact centre: teams, skills (queues), agents, outbound campaigns, activity, nodes. */
import type { Agent, Campaign, CampaignType, CcActivity, CcActivityAction, CcNode, Skill, Team } from '@/types'
import { ANCHOR_MS, DAY, HOUR, MINUTE, agoIso, iso, peopleStream, rngFor, tenantIso } from './util'

const rng = rngFor(3)

/* ------------------------------------------------------------------ teams */

export const teams: Team[] = [
  'Claims Line',
  'Renewals Desk',
  'Courier Callbacks',
  'Outage Hotline',
  'Clinic Reminders',
  'Back Office',
  'Quality & Training',
  'Night Shift',
].map((name, i) => ({ id: `team-${i + 1}`, name }))

/* ----------------------------------------------------------------- skills */

const SKILL_NAMES = [
  'Claims Line', // skill-1
  'Claims Escalations', // skill-2
  'Renewals Desk', // skill-3
  'Motor Policies', // skill-4
  'Property Policies', // skill-5
  'Travel Cover', // skill-6
  'Courier Callbacks', // skill-7
  'Outage Hotline', // skill-8
  'Clinic Reminders', // skill-9
  'Payments & Billing', // skill-10
  'Complaints', // skill-11
  'Broker Line', // skill-12
  'VIP', // skill-13
  'Georgian', // skill-14
  'English', // skill-15
  'Russian', // skill-16
  'Outbound Renewals', // skill-17
  'Night Overflow', // skill-18: deliberately unstaffed
] as const

export const skills: Skill[] = SKILL_NAMES.map((name, i) => ({ id: `skill-${i + 1}`, name }))

/** Queue skills each team mostly works, by team index. */
const TEAM_SKILLS: number[][] = [
  [1, 2, 4, 5], // Claims Line
  [3, 4, 5, 6, 17], // Renewals Desk
  [7, 10], // Courier Callbacks
  [8, 11], // Outage Hotline
  [9, 10], // Clinic Reminders
  [10, 11, 12], // Back Office
  [2, 11, 13], // Quality & Training
  [1, 8, 7], // Night Shift
]

/* ----------------------------------------------------------------- agents */

export interface RosterAgent extends Agent {
  /** Core Cluster device the agent logs in on: 'Agent07', or a desk phone. */
  device: string
}

/** Persona names never reappear as generated people. */
export const PERSONA_NAMES = [
  'Ana Lomidze',
  'Giorgi Beridze',
  'Nino Chikovani',
  'Levan Gelashvili',
  'Mariam Kapanadze',
  'Davit Kiknadze',
  'Salome Shengelia',
  'Luka Japaridze',
  'Tamar Dolidze',
]

const nextPerson = peopleStream(rng, PERSONA_NAMES)

function skillLevelsFor(teamIndex: number, supervisor: boolean): Record<string, number> {
  const levels: Record<string, number> = {}
  const own = TEAM_SKILLS[teamIndex] ?? [1]
  const take = supervisor ? own.length : rng.int(1, Math.min(4, own.length))
  // The team's home queue is always staffed; the rest is a random subset.
  const [home = 1, ...rest] = own
  for (const s of [home, ...rng.shuffle(rest).slice(0, take - 1)]) levels[`skill-${s}`] = supervisor ? rng.int(7, 10) : rng.int(3, 9)
  // Language skills: almost everyone speaks Georgian; many English; some Russian.
  if (rng.chance(0.9)) levels['skill-14'] = rng.int(7, 10)
  if (rng.chance(0.45)) levels['skill-15'] = rng.int(4, 9)
  if (rng.chance(0.3)) levels['skill-16'] = rng.int(3, 8)
  if (supervisor || rng.chance(0.08)) levels['skill-13'] = rng.int(6, 10)
  // Keep 1-6 skills.
  const keys = Object.keys(levels)
  for (const k of keys.slice(6)) delete levels[k]
  return levels
}

function buildAgents(): RosterAgent[] {
  const out: RosterAgent[] = []
  // 58 HQ agents on 2101-2158; the first 40 sit on contact-centre devices Agent01..Agent40.
  for (let i = 0; i < 58; i++) {
    const person =
      i === 6 ? { first: 'Mariam', last: 'Kapanadze', login: 'mkapanadze' } : nextPerson()
    const teamIndex = i < 52 ? i % 7 : 7 // the last six work nights
    out.push({
      userId: person.login,
      firstName: person.first,
      lastName: person.last,
      extension: String(2101 + i),
      isSupervisor: false,
      teamId: `team-${teamIndex + 1}`,
      skillLevels: skillLevelsFor(teamIndex, false),
      device: i < 40 ? `Agent${String(i + 1).padStart(2, '0')}` : `DESK${2101 + i}`,
    })
  }
  // Five supervisors on 2190-2194 (the contact-centre admin persona leads Claims Line).
  const supervisorTeams = [0, 1, 3, 5, 6]
  supervisorTeams.forEach((teamIndex, i) => {
    const person = i === 0 ? { first: 'Nino', last: 'Chikovani', login: 'nchikovani' } : nextPerson()
    out.push({
      userId: person.login,
      firstName: person.first,
      lastName: person.last,
      extension: String(2190 + i),
      isSupervisor: true,
      teamId: `team-${teamIndex + 1}`,
      skillLevels: skillLevelsFor(teamIndex, true),
      device: `DESK${2190 + i}`,
    })
  })
  // Seven branch specialists on Edge PBX numbers, reached through the inter-site trunk.
  const branchExtensions = ['5012', '5014', '5021', '5108', '5117', '5203', '5211']
  branchExtensions.forEach((ext, i) => {
    const person = nextPerson()
    const teamIndex = i < 3 ? 0 : i < 5 ? 1 : 5
    out.push({
      userId: person.login,
      firstName: person.first,
      lastName: person.last,
      extension: ext,
      isSupervisor: false,
      teamId: `team-${teamIndex + 1}`,
      skillLevels: skillLevelsFor(teamIndex, false),
      device: `BRANCH${ext}`,
    })
  })
  return out
}

export const roster: RosterAgent[] = buildAgents()

export const agents: Agent[] = roster.map(({ device: _device, ...agent }) => agent)

/** HQ agents on contact-centre devices: the ones queue calls land on. */
export const queueAgents = roster.filter((a) => a.device.startsWith('Agent'))
export const supervisors = roster.filter((a) => a.isSupervisor)

/* -------------------------------------------------------------- campaigns */

interface CampaignBlueprint {
  name: string
  type: CampaignType
  enabled: boolean
  ports: number
  lines: number
  attempts: 1 | 2 | 3
}

const CAMPAIGNS: CampaignBlueprint[] = [
  { name: 'Isari Couriers - missed delivery callback', type: 'agentProgressive', enabled: true, ports: 8, lines: 1.5, attempts: 3 },
  { name: 'Kvirike Clinics - appointment reminders', type: 'ivrProgressive', enabled: true, ports: 14, lines: 2.0, attempts: 2 },
  { name: 'Mtsvane Kari - outage callback', type: 'ivrPredictive', enabled: true, ports: 10, lines: 2.4, attempts: 2 },
  { name: 'Saguramo - policy renewals Q4', type: 'agentPredictive', enabled: true, ports: 6, lines: 1.8, attempts: 3 },
  { name: 'Saguramo - claims follow-up', type: 'preview', enabled: true, ports: 0, lines: 1.0, attempts: 2 },
  { name: 'Saguramo - premium payment reminder', type: 'ivrProgressive', enabled: false, ports: 4, lines: 1.2, attempts: 1 },
  { name: 'Kvirike Clinics - lab results ready', type: 'ivrProgressive', enabled: true, ports: 5, lines: 1.0, attempts: 2 },
  { name: 'Isari Couriers - delivery feedback', type: 'ivrPredictive', enabled: false, ports: 3, lines: 2.0, attempts: 1 },
  { name: 'Saguramo - travel cover upsell', type: 'agentProgressive', enabled: false, ports: 6, lines: 1.4, attempts: 2 },
  { name: 'Mtsvane Kari - planned works notice', type: 'ivrPredictive', enabled: true, ports: 8, lines: 3.0, attempts: 1 },
  { name: 'Saguramo - lapsed policy win-back', type: 'agentPredictive', enabled: false, ports: 7, lines: 1.6, attempts: 3 },
  { name: 'Saguramo - motor claim satisfaction check', type: 'preview', enabled: true, ports: 0, lines: 1.0, attempts: 1 },
]

export const campaigns: Campaign[] = CAMPAIGNS.map((c, i) => ({
  id: `cmp-${101 + i}`,
  name: c.name,
  enabled: c.enabled,
  type: c.type,
  numDedicatedPorts: c.ports,
  linesPerPort: c.lines,
  maxDialAttempts: c.attempts,
  timeZone: 'Asia/Tbilisi',
  updatedAt: iso(ANCHOR_MS - rng.int(2 * HOUR, 40 * DAY)),
}))

/** The five campaigns the contact-centre admin persona is scoped to. */
export const CC_ADMIN_CAMPAIGNS = ['cmp-101', 'cmp-102', 'cmp-103', 'cmp-107', 'cmp-110']

export const campaignSettings = { maxDedicatedPortsNonSuperAdmin: 10 }

/* ------------------------------------------------------- activity log */

const CC_ACTORS: [string, number][] = [
  ['nino.chikovani', 9],
  ['giorgi.beridze', 4],
  ['tamar.dolidze', 4],
  ['ana.lomidze', 2],
]

function activityDetails(action: CcActivityAction): string {
  const campaign = rng.pick(campaigns)
  const agent = rng.pick(roster)
  const skill = rng.pick(skills.slice(0, 17))
  switch (action) {
    case 'campaign_view':
      return `Opened campaign "${campaign.name}" (${campaign.id})`
    case 'campaign_change': {
      const kind = rng.int(0, 3)
      if (kind === 0) return `"${campaign.name}": enabled ${campaign.enabled ? 'false → true' : 'true → false'}`
      if (kind === 1) {
        const before = rng.int(2, 10)
        return `"${campaign.name}": dedicated ports ${before} → ${Math.max(1, before + rng.pick([-2, -1, 1, 2]))}`
      }
      if (kind === 2) return `"${campaign.name}": lines per port ${(1 + rng.int(0, 10) / 10).toFixed(1)} → ${(1 + rng.int(0, 20) / 10).toFixed(1)}`
      return `"${campaign.name}": max dial attempts ${rng.int(1, 2)} → 3`
    }
    case 'campaign_error':
      return `"${campaign.name}": save rejected by the contact centre (HTTP 409, campaign is being edited elsewhere)`
    case 'skills_update': {
      const level = rng.int(3, 10)
      return `${agent.firstName} ${agent.lastName} (${agent.userId}): ${skill.name} → ${level}`
    }
    case 'skills_bulk_update': {
      const added = rng.int(0, 6)
      const removed = rng.int(0, 3)
      return `Roster "${skill.name}": ${added} assigned, ${removed} unassigned, ${rng.int(0, 5)} level changes`
    }
    case 'skills_error':
      return `${agent.firstName} ${agent.lastName} (${agent.userId}): update failed, agent record locked by another session`
    case 'dedicated_ports_above_limit':
      return `"${campaign.name}": requested ${rng.int(11, 18)} dedicated ports, limit is 10 for this role`
  }
}

function buildActivity(): CcActivity[] {
  const rows: CcActivity[] = []
  const actions: [CcActivityAction, number][] = [
    ['campaign_view', 35],
    ['campaign_change', 25],
    ['skills_update', 20],
    ['skills_bulk_update', 8],
    ['campaign_error', 4],
    ['skills_error', 4],
    ['dedicated_ports_above_limit', 4],
  ]
  for (let i = 0; i < 200; i++) {
    // Mostly working hours over the last 30 days.
    const daysAgo = Math.floor(Math.pow(rng.next(), 1.3) * 30)
    const at = Date.parse(tenantIso(daysAgo, rng.int(9, 18), rng.int(0, 59), rng.int(0, 59)))
    const action = rng.weighted(actions)
    rows.push({
      id: '',
      username: rng.weighted(CC_ACTORS),
      action,
      details: activityDetails(action),
      createdAt: iso(Math.min(at, ANCHOR_MS - rng.int(5, 90) * MINUTE)),
    })
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map((row, i) => ({ ...row, id: `cca-${1200 - i}` }))
}

export const ccActivity: CcActivity[] = buildActivity()

/* ------------------------------------------------------------------ nodes */

export const nodes: CcNode[] = [
  {
    id: 'node-a',
    label: 'Node A · Vake HQ',
    host: 'cc-node-a.vake.bani.example',
    sysName: 'cc-node-a',
    status: 'up',
    error: null,
    cpuPct: 23,
    memory: { totalMB: 16384, availableMB: 7210, usedPct: 56 },
    uptimeSeconds: 41 * 86400 + 6 * 3600 + 12 * 60,
    updatedAt: agoIso(20_000),
  },
  {
    id: 'node-b',
    label: 'Node B · Rustavi Contact Centre',
    host: 'cc-node-b.rustavi.bani.example',
    sysName: 'cc-node-b',
    status: 'up',
    error: null,
    cpuPct: 31,
    memory: { totalMB: 16384, availableMB: 6390, usedPct: 61 },
    uptimeSeconds: 18 * 86400 + 2 * 3600 + 47 * 60,
    updatedAt: agoIso(20_000),
  },
  {
    id: 'node-reporting',
    label: 'Reporting · Vake HQ',
    host: 'cc-reporting.vake.bani.example',
    sysName: 'cc-reporting',
    status: 'up',
    error: null,
    cpuPct: 47,
    memory: { totalMB: 32768, availableMB: 3080, usedPct: 91 },
    uptimeSeconds: 96 * 86400 + 21 * 3600 + 5 * 60,
    updatedAt: agoIso(20_000),
  },
  {
    id: 'node-c',
    label: 'Node C · Kutaisi Branch',
    host: 'cc-node-c.kutaisi.bani.example',
    sysName: 'cc-node-c',
    status: 'down',
    error: 'SNMP timeout after 5 s',
    cpuPct: null,
    memory: null,
    uptimeSeconds: null,
    updatedAt: agoIso(20_000),
  },
]
