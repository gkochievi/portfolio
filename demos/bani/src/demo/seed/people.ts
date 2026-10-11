/** Console users (personas first), the directory they are picked from, and group → role mapping. */
import type { ConsoleUser, DirectoryEntry, LdapRoleMappingConfig, UserRole, UserType } from '@/types'
import { personas } from './personas'
import { CC_ADMIN_CAMPAIGNS, PERSONA_NAMES, roster } from './contactCentre'
import { ANCHOR_MS, DAY, HOUR, MINUTE, iso, peopleStream, rngFor } from './util'

const rng = rngFor(4)

interface UserSpec {
  id?: string
  username: string
  displayName: string | null
  email?: string | null
  role: UserRole
  userType: UserType
  isActive?: boolean
  accessMode?: ConsoleUser['accessMode']
  description?: string
  downloadFormat?: ConsoleUser['downloadFormat']
  allowedCampaigns?: string[]
  lastLogin?: 'recent' | 'old' | 'never'
}

const PERSONA_SETUP: Record<string, Pick<UserSpec, 'userType' | 'accessMode' | 'description' | 'allowedCampaigns'>> = {
  'ana.lomidze': { userType: 'ldap', accessMode: 'direct', description: 'Head of voice platforms' },
  'giorgi.beridze': { userType: 'ldap', accessMode: 'group', description: 'Voice platform engineer' },
  'nino.chikovani': { userType: 'ldap', accessMode: 'group', description: 'Claims Line supervisor', allowedCampaigns: CC_ADMIN_CAMPAIGNS },
  'levan.gelashvili': { userType: 'ldap', accessMode: 'direct', description: 'Branch telephony lead' },
  'mariam.kapanadze': { userType: 'ldap', accessMode: 'group', description: '' },
  'davit.kiknadze': { userType: 'ldap', accessMode: 'group', description: 'Kutaisi Branch' },
  'salome.shengelia': { userType: 'ldap', accessMode: 'direct', description: 'Service desk, extension provisioning' },
  'luka.japaridze': { userType: 'internal', accessMode: 'direct', description: 'Internal audit, read-only access' },
}

function buildSpecs(): UserSpec[] {
  const specs: UserSpec[] = personas.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.name,
    email: p.email,
    role: p.role,
    lastLogin: 'recent',
    ...PERSONA_SETUP[p.username],
    userType: PERSONA_SETUP[p.username]?.userType ?? 'ldap',
  }))

  specs.push(
    { username: 'breakglass', displayName: 'Break-glass local admin', email: null, role: 'admin', userType: 'internal', description: 'Local account for directory outages. Sealed credentials, Vake HQ server room.', lastLogin: 'old' },
    { username: 'svc-reporting', displayName: 'Reporting export', email: null, role: 'api_service', userType: 'api_service', description: 'Nightly call-record export to the reporting warehouse', downloadFormat: 'original', lastLogin: 'recent' },
    { username: 'svc-quality-export', displayName: 'Quality review export', email: null, role: 'api_service', userType: 'api_service', description: 'Pulls scored calls and recordings for the quality team', downloadFormat: 'mp3', lastLogin: 'recent' },
    { username: 'tamar.dolidze', displayName: 'Tamar Dolidze', role: 'cc-admin', userType: 'ldap', accessMode: 'group', description: 'Renewals Desk supervisor', lastLogin: 'recent' },
    { username: 'irakli.tabatadze', displayName: 'Irakli Tabatadze', role: 'it-support', userType: 'ldap', accessMode: 'group', description: 'Service desk', lastLogin: 'recent' },
    { username: 'mariam.tsereteli-abashidze', displayName: 'Mariam Tsereteli-Abashidze-Dadiani', email: 'mariam.tsereteli-abashidze-dadiani@bani.example', role: 'user', userType: 'ldap', accessMode: 'direct', description: 'Legal, claims disputes', lastLogin: 'recent' },
    { username: 'qa.kiosk', displayName: null, email: null, role: 'user', userType: 'internal', description: 'Shared playback kiosk in the training room', lastLogin: 'never' },
  )

  // Contact-centre operators are real agents from the roster.
  const operators = roster.filter((a) => !a.isSupervisor && a.extension.startsWith('2') && !PERSONA_NAMES.includes(`${a.firstName} ${a.lastName}`))
  for (const agent of rng.shuffle(operators).slice(0, 10)) {
    specs.push({ username: `${agent.firstName}.${agent.lastName}`.toLowerCase(), displayName: `${agent.firstName} ${agent.lastName}`, role: 'cc-operator', userType: 'ldap', accessMode: 'group' })
  }
  // The leaver: still listed, disabled.
  const leaver = specs[specs.length - 1]
  if (leaver) Object.assign(leaver, { isActive: false, description: 'Leaver: disabled by the HR offboarding process', lastLogin: 'old' as const })

  const nextPerson = peopleStream(rng, [...PERSONA_NAMES, 'Irakli Tabatadze', ...specs.map((s) => s.displayName ?? '')])
  const roles: [UserRole, number][] = [
    ['tel-operator', 6],
    ['user', 5],
    ['tel-admin', 2],
    ['admin', 2],
    ['it-support', 1],
    ['cc-admin', 1],
  ]
  while (specs.length < 45) {
    const p = nextPerson()
    const userType: UserType = rng.chance(0.85) ? 'ldap' : 'internal'
    const role = rng.weighted(roles)
    specs.push({
      username: p.username,
      displayName: p.displayName,
      role,
      userType,
      accessMode: userType === 'ldap' && rng.chance(0.6) ? 'group' : 'direct',
      lastLogin: rng.chance(0.85) ? 'recent' : rng.chance(0.5) ? 'old' : 'never',
    })
  }
  return specs
}

function buildUsers(): ConsoleUser[] {
  return buildSpecs().map((s, i) => {
    const created = ANCHOR_MS - (i < 8 ? rng.int(500, 730) : rng.int(10, 700)) * DAY - rng.int(0, 600) * MINUTE
    const updated = Math.min(ANCHOR_MS - HOUR, created + rng.int(0, 200) * DAY)
    const lastLogin =
      s.lastLogin === 'never'
        ? null
        : s.lastLogin === 'old'
          ? ANCHOR_MS - rng.int(40, 160) * DAY - rng.int(0, 600) * MINUTE
          : ANCHOR_MS - rng.int(5, 14 * 24 * 60) * MINUTE
    return {
      id: s.id ?? `usr-${1000 + i + 1}`,
      username: s.username,
      email: s.email === undefined ? `${s.username}@bani.example` : s.email,
      displayName: s.displayName,
      role: s.role,
      userType: s.userType,
      isActive: s.isActive ?? true,
      accessMode: s.userType === 'ldap' ? (s.accessMode ?? 'direct') : 'direct',
      description: s.description ?? '',
      downloadFormat: s.downloadFormat ?? 'mp3',
      allowedCampaigns: s.allowedCampaigns ? [...s.allowedCampaigns] : [],
      lastLoginAt: lastLogin === null ? null : iso(Math.max(lastLogin, created + DAY)),
      createdAt: iso(created),
      updatedAt: iso(updated),
    }
  })
}

export const users: ConsoleUser[] = buildUsers()

/* -------------------------------------------------------------- directory */

function buildDirectory(): Omit<DirectoryEntry, 'alreadyRegistered'>[] {
  const entries: Omit<DirectoryEntry, 'alreadyRegistered'>[] = users
    .filter((u) => u.userType === 'ldap')
    .map((u) => ({ username: u.username, displayName: u.displayName ?? u.username, email: u.email ?? `${u.username}@bani.example` }))
  const taken = new Set(entries.map((e) => e.username))
  // Colleagues with a directory account but no console access yet: mostly agents.
  for (const agent of rng.shuffle(roster)) {
    if (entries.length >= 52) break
    const username = `${agent.firstName}.${agent.lastName}`.toLowerCase()
    if (taken.has(username) || PERSONA_NAMES.includes(`${agent.firstName} ${agent.lastName}`)) continue
    taken.add(username)
    entries.push({ username, displayName: `${agent.firstName} ${agent.lastName}`, email: `${username}@bani.example` })
  }
  const nextPerson = peopleStream(rng, [...PERSONA_NAMES, ...entries.map((e) => e.displayName)])
  while (entries.length < 62) {
    const p = nextPerson()
    if (taken.has(p.username)) continue
    taken.add(p.username)
    entries.push({ username: p.username, displayName: p.displayName, email: `${p.username}@bani.example` })
  }
  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export const directory: Omit<DirectoryEntry, 'alreadyRegistered'>[] = buildDirectory()

export const ldapRoleMappings: LdapRoleMappingConfig = {
  mappings: [
    { groupDn: 'CN=bani-voice-admins,OU=Groups,DC=bani,DC=example', role: 'admin' },
    { groupDn: 'CN=cc-supervisors,OU=Groups,DC=bani,DC=example', role: 'cc-admin' },
    { groupDn: 'CN=cc-agents,OU=Groups,DC=bani,DC=example', role: 'cc-operator' },
    { groupDn: 'CN=branch-telephony,OU=Groups,DC=bani,DC=example', role: 'tel-operator' },
  ],
  nestedGroups: true,
}
