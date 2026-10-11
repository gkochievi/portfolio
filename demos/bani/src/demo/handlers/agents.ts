/**
 * Mock API for the "agents" feature group (PLAN section 6): contact-centre
 * agents, their team and skill competencies, and the per-skill roster
 * (bulk staffing). Every route requires the `cc_agents` feature.
 * Import store/api/bus helpers from '../core' only.
 */
import { DemoApiError, notFound } from '@portfolio/demo-kit'

import type {
  Agent,
  AgentUpdate,
  CcActivity,
  CcActivityAction,
  RosterApplyResult,
  RosterChange,
  SkillWithCount,
} from '@/types'
import { api, bus, jitter, nowIso, requireFeature, sleep, store } from '../core'

const FEATURE = 'cc_agents' as const
const LOCK_REASON = 'Locked by another session'

/** The public shape (seed rows may carry extra internal fields such as the device). */
function toAgent(a: Agent): Agent {
  return {
    userId: a.userId,
    firstName: a.firstName,
    lastName: a.lastName,
    extension: a.extension,
    isSupervisor: a.isSupervisor,
    teamId: a.teamId,
    skillLevels: { ...a.skillLevels },
  }
}

const fullName = (a: Agent): string => `${a.firstName} ${a.lastName}`.trim()

function findAgent(userId: string): Agent {
  const agent = store.data.agents.find((a) => a.userId === userId)
  if (!agent) throw notFound(`Agent ${userId} was not found.`)
  return agent
}

function skillName(id: string): string {
  return store.data.skills.find((s) => s.id === id)?.name ?? id
}

function logActivity(username: string, action: CcActivityAction, details: string): void {
  const row: CcActivity = { id: store.nextId('cca-'), username, action, details, createdAt: nowIso() }
  store.data.ccActivity.unshift(row)
  bus.emit('cc:activity', row)
}

const isLevel = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10

/** Write latency of the original (one call per agent upstream): 300-800 ms in total. */
const writeDelay = () => sleep(jitter(100, 300))

export function register(): void {
  api.register('GET', '/cc/agents', () => {
    requireFeature(FEATURE)
    return store.data.agents
      .map(toAgent)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  })

  api.register('GET', '/cc/agents/:userId', ({ path }) => {
    requireFeature(FEATURE)
    return toAgent(findAgent(path.userId ?? ''))
  })

  api.register('PUT', '/cc/agents/:userId', async ({ path, body }) => {
    const me = requireFeature(FEATURE)
    const agent = findAgent(path.userId ?? '')
    const input = (body ?? {}) as Partial<AgentUpdate>
    const errors: Record<string, string> = {}
    if (!input.teamId || !store.data.teams.some((t) => t.id === input.teamId)) errors.teamId = 'Choose a team.'
    const levels = input.skillLevels ?? {}
    if (typeof levels !== 'object' || Array.isArray(levels)) errors.skillLevels = 'Invalid skill list.'
    else {
      for (const [id, level] of Object.entries(levels)) {
        if (!store.data.skills.some((s) => s.id === id)) errors.skillLevels = `Unknown skill ${id}.`
        else if (!isLevel(level)) errors.skillLevels = `Competency for ${skillName(id)} must be 1-10.`
      }
    }
    if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
    await writeDelay()

    agent.teamId = input.teamId as string
    agent.skillLevels = { ...levels }
    const team = store.data.teams.find((t) => t.id === agent.teamId)?.name ?? agent.teamId
    const list = Object.entries(agent.skillLevels)
      .map(([id, lvl]) => `${skillName(id)}=${lvl}`)
      .join(', ')
    logActivity(
      me.username,
      'skills_update',
      `${fullName(agent)} (${agent.userId}): team ${team}; skills ${list || 'none'}`,
    )
    return toAgent(agent)
  })

  api.register('GET', '/cc/skills', () => {
    requireFeature(FEATURE)
    const counts = new Map<string, number>()
    for (const a of store.data.agents) for (const id of Object.keys(a.skillLevels)) counts.set(id, (counts.get(id) ?? 0) + 1)
    return store.data.skills
      .map<SkillWithCount>((s) => ({ id: s.id, name: s.name, assignedCount: counts.get(s.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  api.register('GET', '/cc/teams', () => {
    requireFeature(FEATURE)
    return [...store.data.teams].sort((a, b) => a.name.localeCompare(b.name))
  })

  api.register('POST', '/cc/skills/:skillId/roster', async ({ path, body }) => {
    const me = requireFeature(FEATURE)
    const skill = store.data.skills.find((s) => s.id === path.skillId)
    if (!skill) throw notFound(`Skill ${path.skillId ?? ''} was not found.`)
    const changes = ((body ?? {}) as { changes?: RosterChange[] }).changes
    if (!Array.isArray(changes) || changes.length === 0) throw DemoApiError.validation({ changes: 'Nothing to apply.' })
    for (const c of changes) {
      if (!c || typeof c.userId !== 'string') throw DemoApiError.validation({ changes: 'Invalid change.' })
      if (c.level !== null && !isLevel(c.level)) throw DemoApiError.validation({ changes: `Competency for ${c.userId} must be 1-10.` })
    }
    await sleep(jitter(200, 500))

    // Upstream writes one agent at a time; occasionally one of them is held by another admin.
    const lockedIndex = changes.length >= 2 && Math.random() < 0.35 ? Math.floor(Math.random() * changes.length) : -1
    const result: RosterApplyResult = { assigned: 0, unassigned: 0, levelChanged: 0, unchanged: 0, failed: [] }
    changes.forEach((c, i) => {
      const agent = store.data.agents.find((a) => a.userId === c.userId)
      if (!agent) {
        result.failed.push({ userId: c.userId, name: c.userId, reason: 'Agent not found' })
        return
      }
      const had = agent.skillLevels[skill.id]
      const effective = c.level === null ? had !== undefined : had !== c.level
      if (i === lockedIndex && effective) {
        result.failed.push({ userId: agent.userId, name: fullName(agent), reason: LOCK_REASON })
        return
      }
      if (c.level === null) {
        if (had === undefined) result.unchanged++
        else {
          const next = { ...agent.skillLevels }
          delete next[skill.id]
          agent.skillLevels = next
          result.unassigned++
        }
      } else if (had === undefined) {
        agent.skillLevels = { ...agent.skillLevels, [skill.id]: c.level }
        result.assigned++
      } else if (had !== c.level) {
        agent.skillLevels = { ...agent.skillLevels, [skill.id]: c.level }
        result.levelChanged++
      } else result.unchanged++
    })

    const parts = [
      `+${result.assigned} assigned`,
      `-${result.unassigned} unassigned`,
      `~${result.levelChanged} level changes`,
      `${result.unchanged} unchanged`,
    ]
    if (result.failed.length > 0) parts.push(`${result.failed.length} failed`)
    logActivity(me.username, 'skills_bulk_update', `Roster ${skill.name}: ${parts.join(', ')}`)
    for (const f of result.failed) {
      logActivity(me.username, 'skills_error', `Roster ${skill.name}: ${f.name} (${f.userId}): ${f.reason}`)
    }
    return result
  })
}
