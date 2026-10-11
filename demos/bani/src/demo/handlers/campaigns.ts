/**
 * Mock API + simulators for the "campaigns" feature group (see PLAN section 6):
 * outbound dialer campaigns, the contact-centre activity feed and the node monitor.
 * Import store/api/bus helpers from '../core' only.
 */
import { DemoApiError, every, forbidden, notFound } from '@portfolio/demo-kit'

import { roleCan } from '@/lib/rbac'
import type {
  Campaign,
  CampaignSettings,
  CampaignType,
  CampaignUpdate,
  CcActivity,
  CcActivityAction,
  Persona,
} from '@/types'
import { api, bus, currentPersona, nowIso, paginate, requireFeature, store } from '../core'

/* ------------------------------------------------------------------ helpers */

const PORT_TYPES: readonly CampaignType[] = ['ivrProgressive', 'agentProgressive', 'ivrPredictive', 'agentPredictive']
const supportsPorts = (type: CampaignType): boolean => PORT_TYPES.includes(type)

/** Campaign ids this persona may touch; null = every campaign. */
function scopeFor(persona: Persona): string[] | null {
  if (persona.role !== 'cc-admin') return null
  const user = store.data.users.find((u) => u.username === persona.username)
  return user && user.allowedCampaigns.length > 0 ? user.allowedCampaigns : null
}

function visibleCampaigns(persona: Persona): Campaign[] {
  const scope = scopeFor(persona)
  return scope ? store.data.campaigns.filter((c) => scope.includes(c.id)) : store.data.campaigns
}

/** The campaign if it exists AND the persona may see it; 404 / 403 otherwise. */
function findCampaign(persona: Persona, id: string): Campaign {
  const campaign = store.data.campaigns.find((c) => c.id === id)
  if (!campaign) throw notFound('Campaign not found.')
  const scope = scopeFor(persona)
  if (scope && !scope.includes(id)) throw forbidden('This campaign is not assigned to you.')
  return campaign
}

function logActivity(username: string, action: CcActivityAction, details: string): CcActivity {
  const row: CcActivity = { id: store.nextId('cca-'), username, action, details, createdAt: nowIso() }
  store.data.ccActivity.unshift(row)
  if (store.data.ccActivity.length > 400) store.data.ccActivity.length = 400
  bus.emit('cc:activity', row)
  return row
}

const settingsFor = (persona: Persona): CampaignSettings => ({
  isSuperAdmin: persona.role === 'superadmin',
  maxDedicatedPortsNonSuperAdmin: store.data.campaignSettings.maxDedicatedPortsNonSuperAdmin,
})

/* ---------------------------------------------------------------- campaigns */

/** campaign_view is logged on GET :id, but a refetch loop must not flood the feed. */
const lastViewLogged = new Map<string, number>()
const VIEW_LOG_DEBOUNCE_MS = 30_000

function validateUpdate(persona: Persona, campaign: Campaign, input: CampaignUpdate): void {
  const fields: Record<string, string> = {}
  const cap = store.data.campaignSettings.maxDedicatedPortsNonSuperAdmin

  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') fields.enabled = 'Must be true or false.'

  if (input.numDedicatedPorts !== undefined) {
    const n = input.numDedicatedPorts
    if (!supportsPorts(campaign.type)) fields.numDedicatedPorts = 'Dedicated ports do not apply to this campaign type.'
    else if (!Number.isInteger(n) || n < 0) fields.numDedicatedPorts = 'Enter a whole number, zero or more.'
    else if (n > 999) fields.numDedicatedPorts = 'Enter a value of 999 or less.'
    else if (persona.role !== 'superadmin' && n > cap) {
      fields.numDedicatedPorts = `Your role may allocate at most ${cap} dedicated ports.`
    }
  }

  if (input.linesPerPort !== undefined) {
    const n = input.linesPerPort
    if (!supportsPorts(campaign.type)) fields.linesPerPort = 'Lines per port do not apply to this campaign type.'
    else if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 3) {
      fields.linesPerPort = 'Lines per port must be between 1.0 and 3.0.'
    }
  }

  if (input.maxDialAttempts !== undefined && ![1, 2, 3].includes(input.maxDialAttempts)) {
    fields.maxDialAttempts = 'Max dial attempts must be 1, 2 or 3.'
  }

  if (Object.keys(fields).length === 0) return

  if (fields.numDedicatedPorts?.startsWith('Your role')) {
    logActivity(
      persona.username,
      'dedicated_ports_above_limit',
      `"${campaign.name}": requested ${input.numDedicatedPorts} dedicated ports, limit is ${cap} for this role`,
    )
  } else {
    logActivity(persona.username, 'campaign_error', `"${campaign.name}": save rejected (${Object.values(fields)[0]})`)
  }
  throw DemoApiError.validation(fields)
}

function describeChanges(campaign: Campaign, input: CampaignUpdate): string[] {
  const changes: string[] = []
  if (input.enabled !== undefined && input.enabled !== campaign.enabled) {
    changes.push(`enabled ${campaign.enabled} → ${input.enabled}`)
  }
  if (input.numDedicatedPorts !== undefined && input.numDedicatedPorts !== campaign.numDedicatedPorts) {
    changes.push(`dedicated ports ${campaign.numDedicatedPorts} → ${input.numDedicatedPorts}`)
  }
  if (input.linesPerPort !== undefined && round1(input.linesPerPort) !== campaign.linesPerPort) {
    changes.push(`lines per port ${campaign.linesPerPort.toFixed(1)} → ${round1(input.linesPerPort).toFixed(1)}`)
  }
  if (input.maxDialAttempts !== undefined && input.maxDialAttempts !== campaign.maxDialAttempts) {
    changes.push(`max dial attempts ${campaign.maxDialAttempts} → ${input.maxDialAttempts}`)
  }
  return changes
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/* -------------------------------------------------------------------- nodes */

interface Baseline {
  cpu: number
  mem: number
}
const BASELINES: Record<string, Baseline> = {
  'node-a': { cpu: 24, mem: 56 },
  'node-b': { cpu: 31, mem: 61 },
  'node-reporting': { cpu: 46, mem: 90 },
}

let lastTickMs = Date.now()

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const wobble = (amp: number): number => (Math.random() * 2 - 1) * amp

/** One step of the walk: pull toward the baseline, add noise, grow uptime by real elapsed time. */
function stepNodes(): void {
  const now = Date.now()
  const elapsedSec = Math.max(0, (now - lastTickMs) / 1000)
  lastTickMs = now
  const stamp = new Date(now).toISOString()
  for (const node of store.data.nodes) {
    node.updatedAt = stamp
    if (node.status === 'down') continue // node C stays down
    const base = BASELINES[node.id] ?? { cpu: node.cpuPct ?? 30, mem: node.memory?.usedPct ?? 50 }
    if (node.cpuPct != null) {
      const spike = Math.random() < 0.06 ? 14 : 0
      node.cpuPct = Math.round(clamp(node.cpuPct + (base.cpu - node.cpuPct) * 0.25 + wobble(4) + spike, 4, 97))
    }
    if (node.memory) {
      const used = clamp(node.memory.usedPct + (base.mem - node.memory.usedPct) * 0.2 + wobble(0.9), 20, 97)
      node.memory = {
        totalMB: node.memory.totalMB,
        usedPct: Math.round(used),
        availableMB: Math.round(node.memory.totalMB * (1 - used / 100)),
      }
    }
    if (node.uptimeSeconds != null) node.uptimeSeconds = Math.round(node.uptimeSeconds + elapsedSec)
  }
  bus.emit('cc:nodes', store.data.nodes)
}

/* ----------------------------------------------------------------- register */

export function register(): void {
  api.register('GET', '/cc/campaigns', () => {
    const persona = requireFeature('cc_campaigns')
    return visibleCampaigns(persona)
  })

  api.register('GET', '/cc/campaign-settings', () => {
    const persona = requireFeature('cc_campaigns')
    return settingsFor(persona)
  })

  api.register('GET', '/cc/campaigns/:id', ({ path }) => {
    const persona = requireFeature('cc_campaigns')
    const campaign = findCampaign(persona, path.id as string)
    const key = `${persona.username}:${campaign.id}`
    const last = lastViewLogged.get(key) ?? 0
    if (Date.now() - last > VIEW_LOG_DEBOUNCE_MS) {
      lastViewLogged.set(key, Date.now())
      logActivity(persona.username, 'campaign_view', `Opened campaign "${campaign.name}" (${campaign.id})`)
    }
    return campaign
  })

  api.register('PUT', '/cc/campaigns/:id', ({ path, body }) => {
    const persona = requireFeature('cc_campaigns')
    const campaign = findCampaign(persona, path.id as string)
    const input = (body ?? {}) as CampaignUpdate
    validateUpdate(persona, campaign, input)

    const changes = describeChanges(campaign, input)
    if (input.enabled !== undefined) campaign.enabled = input.enabled
    if (input.numDedicatedPorts !== undefined) campaign.numDedicatedPorts = input.numDedicatedPorts
    if (input.linesPerPort !== undefined) campaign.linesPerPort = round1(input.linesPerPort)
    if (input.maxDialAttempts !== undefined) campaign.maxDialAttempts = input.maxDialAttempts
    if (changes.length > 0) {
      campaign.updatedAt = nowIso()
      logActivity(persona.username, 'campaign_change', `"${campaign.name}": ${changes.join('; ')}`)
    }
    store.notify()
    return campaign
  })

  api.register('GET', '/cc/activity', ({ params }) => {
    const persona = currentPersona()
    const overrides = store.data.rbacOverrides
    if (!roleCan(persona.role, 'logs', overrides) && !roleCan(persona.role, 'cc_campaigns', overrides)) throw forbidden()
    const rows = [...store.data.ccActivity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
    return paginate(rows, params, 50)
  })

  api.register('GET', '/cc/nodes', () => {
    requireFeature('cc_nodes')
    if (Date.now() - lastTickMs > 1500) stepNodes()
    return store.data.nodes
  })

  // The node monitor keeps moving while a page is open; `every` pauses in a hidden tab.
  every(5000, stepNodes)
  bus.on('demo:reset', () => {
    lastTickMs = Date.now()
    lastViewLogged.clear()
  })
}
