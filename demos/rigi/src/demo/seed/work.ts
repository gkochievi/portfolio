/**
 * Task catalogue, projects, tasks (+ assignees, history, chat) and the points
 * ledger. History is generated per final state, so every task's last history
 * row equals its state; points are debited with the same `debitOnVerify` the
 * portal uses, in verification order.
 */
import { addDaysIso, endOfDayIso, isoDate } from '@/demo/domain/dates'
import { newId } from '@/demo/domain/ids'
import { adjustPoints, debitOnVerify } from '@/demo/domain/points'
import type { Project, ProjectState, Task, TaskState } from '@/types'

import { minIso, plusHours, spread, type SeedCtx } from './ctx'
import {
  INTERNAL_NOTES,
  L1_IDS,
  PARTNER_MESSAGES,
  PARTNERS,
  SEND_BACK_NOTES,
  STAFF_MESSAGES,
  TEMPLATE_OVERRIDES,
  TEMPLATES,
  VOIP_TECHS,
  WEB_TECHS,
  staffName,
  type TemplateSeed,
} from './static'

type Creator = { kind: 'staff'; id: string } | { kind: 'partner'; adminId: string; name: string }

export interface TaskPlan {
  key: string | null
  partnerId: string | null
  templateCode: string | null
  projectKey: string | null
  title: string
  description: string
  state: TaskState
  points: number | null
  pricingPending: boolean
  createdAt: string
  deadline: string | null
  finishedAt: string | null
  verifiedAt: string | null
  /** Time of the last state change for open / cancelled tasks. */
  endAt: string
  assignees: string[]
  selfAssigned: boolean
  creator: Creator
  source: 'mail' | 'portal' | 'staff'
  hasNewReplies: boolean
  sendBack: boolean
  detour: boolean
  testing: boolean
  cancelledBy: 'partner' | 'staff' | null
  messages: number
}

export interface SeededTask {
  task: Task
  plan: TaskPlan
}

export interface WorkResult {
  tasks: SeededTask[]
  byKey: Map<string, Task>
}

interface ProjectSeed {
  key: string
  partnerId: string
  name: string
  description: string
  state: ProjectState
  price: number | null
  pricingPending?: boolean
  requestedByPartner?: boolean
  priceAdjustNote?: string | null
  created: [period: number, frac: number] | number
  closed?: [period: number, frac: number]
}

const PROJECTS: readonly ProjectSeed[] = [
  {
    key: 'lukma-c2c', partnerId: 'prt_lukma', name: 'Courier app click-to-call integration', state: 'completed', price: 3200, created: [-4, 0.55], closed: [-2, 0.55],
    description: 'Dial button inside the courier app, calls logged to the order history, supervisor report of courier calls.',
    priceAdjustNote: 'Final price includes one extra integration day for the order-history API.',
  },
  {
    key: 'vake-widget', partnerId: 'prt_vake', name: 'Online booking widget on the clinic site', state: 'cancelled', price: 1400, created: [-3, 0.3], closed: [-2, 0.25],
    description: 'Callback-request widget on the clinic website feeding the booking queue.',
  },
  {
    key: 'alvani-ivr', partnerId: 'prt_alvani', name: 'Claims IVR rebuild', state: 'completed', price: 2100, created: [-2, 0.4], closed: [-1, 0.6],
    description: 'New claims menu tree, bilingual prompts and a direct route to the assessors team.',
  },
  {
    key: 'mzeo-failover', partnerId: 'prt_mzeo', name: 'Second-site failover cluster', state: 'open', price: 4800, created: 12,
    description: 'Standby PBX node at the second data centre with replicated IVR and queue configuration; quarterly failover drill.',
  },
  {
    key: 'talgha-queues', partnerId: 'prt_talgha', name: 'Queue redesign for the outage season', state: 'open', price: 2600, created: 9,
    description: 'Separate outage queues per region, an announcement before the menu and callback during mass outages.',
  },
  {
    key: 'zemo-webchat', partnerId: 'prt_zemo', name: 'Omnichannel web chat for client desks', state: 'open', price: null, pricingPending: true, requestedByPartner: true, created: 4,
    description: 'We would like web chat for two of our client desks, routed to the same agents as calls. Please send a quote.',
  },
]

interface LiveSpec {
  key?: string
  partner: string | null
  tpl?: string | null
  project?: string
  state: TaskState
  title: string
  assignees: string[]
  created: number
  finished?: number
  deadline?: number
  source: 'mail' | 'portal' | 'staff'
  pricingPending?: boolean
  replies?: boolean
  messages?: number
  testing?: boolean
  cancelledBy?: 'partner' | 'staff'
}

const LIVE: readonly LiveSpec[] = [
  { key: 'zemo-sip', partner: 'prt_zemo', tpl: 'SIP_TRUNK_ISSUE', state: 'finished', title: 'Calls drop after 30 seconds on trunk 2', assignees: ['usr_giorgi'], created: 6, finished: 1, source: 'mail', messages: 3, testing: true },
  { partner: 'prt_zemo', tpl: 'REPORT_BUILD', state: 'finished', title: 'Weekly abandoned-call report for the client desks', assignees: ['usr_saba'], created: 9, finished: 2, source: 'portal', messages: 2 },
  { partner: 'prt_zemo', tpl: 'OTHER_PROBLEM', state: 'accepted', title: 'Agents hear an echo when transferring to supervisors', assignees: [], created: 1, source: 'portal', pricingPending: true, messages: 1 },
  { partner: 'prt_zemo', tpl: 'IVR_CHANGE', state: 'testing', title: 'Weekend-hours IVR greeting for the client desks', assignees: ['usr_giorgi'], created: 4, deadline: 5, source: 'portal', messages: 2 },
  { key: 'zemo-onboard', partner: 'prt_zemo', tpl: 'AGENT_ONBOARDING', state: 'in_progress', title: 'Add 3 agents for the Saburtalo client desk', assignees: ['usr_sopo'], created: 2, deadline: 3, source: 'mail', replies: true, messages: 1 },
  { partner: 'prt_zemo', tpl: 'NEW_QUEUE', state: 'accepted', title: 'New overflow queue for the evening shift', assignees: [], created: 0.3, source: 'portal' },
  { partner: 'prt_zemo', tpl: 'CRM_INTEGRATION_FIX', state: 'pending', title: 'Screen-pop opens the wrong customer card', assignees: ['usr_saba'], created: 12, deadline: -2, source: 'mail', messages: 3 },
  { partner: 'prt_zemo', tpl: 'NUMBER_PORTING', state: 'cancelled', title: 'Port the old fax number', assignees: [], created: 20, source: 'portal', cancelledBy: 'partner' },
  { key: 'mzeo-503', partner: 'prt_mzeo', tpl: 'SIP_TRUNK_ISSUE', state: 'in_progress', title: 'Inbound calls to the card hotline fail with 503 at peak', assignees: ['usr_giorgi', 'usr_irakli'], created: 1.5, deadline: -0.5, source: 'mail', replies: true, messages: 3 },
  { partner: 'prt_mzeo', tpl: 'REPORT_BUILD', state: 'accepted', title: 'ზარების რიგის SLA ანგარიში ფილიალების მიხედვით', assignees: [], created: 0.8, source: 'mail' },
  { partner: 'prt_mzeo', project: 'mzeo-failover', state: 'in_progress', title: 'Failover cluster: provision the standby PBX node', assignees: ['usr_giorgi'], created: 10, source: 'staff', messages: 1 },
  { partner: 'prt_mzeo', project: 'mzeo-failover', state: 'accepted', title: 'Failover cluster: replicate IVR and queue configuration', assignees: ['usr_irakli'], created: 10, source: 'staff' },
  { partner: 'prt_mzeo', tpl: 'CALL_RECORDING_EXPORT', state: 'finished', title: 'Recordings for complaint case 4471', assignees: ['usr_irakli'], created: 5, finished: 0.5, source: 'portal', messages: 2 },
  { key: 'lukma-skill', partner: 'prt_lukma', tpl: 'SKILL_ROUTING_CHANGE', state: 'in_progress', title: 'Route courier calls by district skill', assignees: ['usr_giorgi'], created: 3, deadline: 2, source: 'mail', messages: 1 },
  { partner: 'prt_lukma', tpl: 'OTHER_PROBLEM', state: 'accepted', title: 'Couriers cannot reach the hotline from one mobile network', assignees: [], created: 0.5, source: 'mail', pricingPending: true },
  { partner: 'prt_lukma', tpl: 'WALLBOARD_SETUP', state: 'pending', title: 'Wallboard for the dispatch room', assignees: ['usr_saba'], created: 8, deadline: -3, source: 'portal', messages: 2 },
  { key: 'talgha-port', partner: 'prt_talgha', tpl: 'NUMBER_PORTING', state: 'in_progress', title: 'Port four regional numbers to the new trunk', assignees: ['usr_giorgi'], created: 5, deadline: 4, source: 'mail', replies: true, messages: 2 },
  { partner: 'prt_talgha', tpl: 'OTHER_PROBLEM', state: 'accepted', title: 'Outage announcement must play before the main menu', assignees: [], created: 1, source: 'mail', pricingPending: true },
  { partner: 'prt_talgha', tpl: 'IVR_CHANGE', state: 'testing', title: 'IVR: add a fibre-outage status option', assignees: ['usr_sopo'], created: 6, source: 'portal', messages: 2 },
  { partner: 'prt_talgha', project: 'talgha-queues', state: 'in_progress', title: 'Queue redesign: map the outage-season call flows', assignees: ['usr_sopo'], created: 8, source: 'staff' },
  { key: 'kolkheti-crm', partner: 'prt_kolkheti', tpl: 'CRM_INTEGRATION_FIX', state: 'in_progress', title: 'Call notes are not saved to the CRM', assignees: ['usr_saba'], created: 4, deadline: -1, source: 'mail', replies: true, messages: 2 },
  { partner: 'prt_kolkheti', tpl: 'AGENT_ONBOARDING', state: 'accepted', title: 'Onboard 5 agents for the Kutaisi office', assignees: [], created: 0.2, source: 'mail' },
  { key: 'batumi-queue', partner: 'prt_batumiwave', tpl: 'NEW_QUEUE', state: 'in_progress', title: 'Seasonal queue for hotel bookings', assignees: ['usr_giorgi'], created: 3, source: 'mail', replies: true, messages: 1 },
  { partner: 'prt_batumiwave', tpl: 'WALLBOARD_SETUP', state: 'finished', title: 'Wallboard on the reception screen', assignees: ['usr_saba'], created: 7, finished: 3, source: 'portal', messages: 1 },
  { key: 'alvani-report', partner: 'prt_alvani', tpl: 'REPORT_BUILD', state: 'in_progress', title: 'Claims line: daily callback report', assignees: ['usr_saba', 'usr_sopo'], created: 6, deadline: 3, source: 'mail', messages: 2 },
  { partner: 'prt_alvani', tpl: 'SIP_TRUNK_ISSUE', state: 'accepted', title: 'Choppy audio on calls to the claims line', assignees: [], created: 0.1, source: 'mail' },
  { partner: 'prt_vake', tpl: 'SKILL_ROUTING_CHANGE', state: 'in_progress', title: 'Route implant consultations to senior staff', assignees: ['usr_giorgi'], created: 2, source: 'portal', messages: 1 },
  { partner: 'prt_vake', tpl: 'IVR_CHANGE', state: 'cancelled', title: 'Change the opening-hours message', assignees: ['usr_irakli'], created: 15, source: 'mail', cancelledBy: 'staff' },
  { partner: null, state: 'in_progress', title: 'Upgrade the PBX cluster to the next minor release', assignees: ['usr_irakli'], created: 5, deadline: 6, source: 'staff', messages: 2 },
  { partner: null, state: 'in_progress', title: 'Renew TLS certificates on the session border controller', assignees: ['usr_giorgi'], created: 3, deadline: 1, source: 'staff', messages: 1 },
  { partner: null, state: 'accepted', title: 'Rotate backup storage credentials', assignees: [], created: 2, source: 'staff' },
  { partner: null, state: 'accepted', title: 'Write a runbook for trunk failover', assignees: ['usr_sopo'], created: 6, deadline: 14, source: 'staff' },
  { partner: null, state: 'finished', title: 'Patch the web servers (monthly)', assignees: ['usr_saba'], created: 6, finished: 3, source: 'staff', messages: 1 },
  { partner: null, state: 'finished', title: 'Clean up stale queues on the shared cluster', assignees: ['usr_irakli'], created: 18, finished: 12, source: 'staff' },
  { partner: null, state: 'in_progress', title: 'Investigate disk growth on the recording store', assignees: ['usr_irakli'], created: 4, source: 'staff', messages: 2 },
  { partner: null, state: 'cancelled', title: 'Prepare a demo tenant for partner training', assignees: ['usr_sopo'], created: 25, source: 'staff', cancelledBy: 'staff' },
]

/** Project member tasks placed in past periods: [project, title, assignee, final state, created, finished]. */
const PAST_PROJECT_TASKS: ReadonlyArray<[project: string, title: string, assignee: string, state: TaskState, created: [number, number], done: [number, number]]> = [
  ['lukma-c2c', 'Click-to-call: dial button in the courier app', 'usr_saba', 'verified', [-4, 0.7], [-2, 0.3]],
  ['lukma-c2c', 'Click-to-call: log calls to the order history', 'usr_saba', 'verified', [-3, 0.2], [-2, 0.45]],
  ['vake-widget', 'Booking widget: embed on the clinic site', 'usr_saba', 'cancelled', [-3, 0.4], [-2, 0.2]],
  ['alvani-ivr', 'Claims IVR rebuild: new menu tree', 'usr_giorgi', 'verified', [-2, 0.5], [-1, 0.4]],
  ['alvani-ivr', 'Claims IVR rebuild: Georgian and English prompts', 'usr_sopo', 'verified', [-2, 0.6], [-1, 0.5]],
]

const MZEO_PREV_MONTH = ['CRM_INTEGRATION_FIX', 'REPORT_BUILD', 'SIP_TRUNK_ISSUE', 'NUMBER_PORTING', 'IVR_CHANGE', 'CRM_INTEGRATION_FIX', 'SKILL_ROUTING_CHANGE']
const ZEMO_PREV_MONTH = ['REPORT_BUILD', 'CRM_INTEGRATION_FIX']

export function seedWork(ctx: SeedCtx): WorkResult {
  const { data, rng } = ctx

  /* ------------------------------------------------------------ catalogue */
  TEMPLATES.forEach((t, i) => {
    data.taskTemplates.push({
      id: newId('tpl_'),
      code: t.code,
      name: t.name,
      description: t.description,
      defaultPoints: t.points,
      isFreeform: t.points === null,
      isActive: true,
      sortOrder: i + 1,
      archivedAt: null,
      createdAt: ctx.at(-1150 + i * 12, 10, 0),
    })
  })
  const tplByCode = (code: string) => data.taskTemplates.find((t) => t.code === code)
  for (const o of TEMPLATE_OVERRIDES) {
    data.templateOverrides.push({
      id: newId('tov_'),
      templateId: tplByCode(o.code)?.id ?? '',
      partnerId: o.partnerId,
      isHidden: o.isHidden ?? false,
      points: o.points ?? null,
      nameOverride: o.name ?? null,
      descriptionOverride: o.description ?? null,
    })
  }
  const effectivePoints = (partnerId: string, code: string): number | null => {
    const tpl = TEMPLATES.find((t) => t.code === code)
    const override = TEMPLATE_OVERRIDES.find((o) => o.partnerId === partnerId && o.code === code)
    return override?.points ?? tpl?.points ?? null
  }
  const visibleFixed = (partnerId: string) =>
    TEMPLATES.filter((t) => t.points !== null && !TEMPLATE_OVERRIDES.some((o) => o.partnerId === partnerId && o.code === t.code && o.isHidden))
  const techFor = (tpl: TemplateSeed | undefined): string =>
    tpl?.kind === 'web' ? rng.pick(WEB_TECHS) : tpl?.kind === 'voip' ? rng.pick(VOIP_TECHS) : rng.pick([...VOIP_TECHS, 'usr_saba'])
  const mainAdmin = (partnerId: string) => data.partnerAdmins.find((a) => a.partnerId === partnerId && a.isActive) ?? data.partnerAdmins.find((a) => a.partnerId === partnerId)
  const describe = (title: string, tpl: TemplateSeed | undefined, partnerId: string | null): string => {
    if (!partnerId) return `${title}.\n\nInternal maintenance. No partner impact expected; announce in the ops channel before starting.`
    if (!tpl) return `${title}.\n\nPart of the project scope agreed with the partner.`
    return `${tpl.request}\n\n${title}.`
  }

  /* ------------------------------------------------------------- projects */
  const projectAt = (c: ProjectSeed['created']) => (typeof c === 'number' ? ctx.ago(c) : ctx.inPeriod(c[0], c[1]))
  const projectSeeds = [...PROJECTS].sort((a, b) => projectAt(a.created).localeCompare(projectAt(b.created)))
  const projectIds = new Map<string, string>()
  projectSeeds.forEach((p, i) => {
    const createdAt = projectAt(p.created)
    const closedAt = p.closed ? ctx.inPeriod(p.closed[0], p.closed[1]) : null
    const project: Project = {
      id: newId('prj_'),
      number: 301 + i,
      partnerId: p.partnerId,
      name: p.name,
      description: p.description,
      state: p.state,
      price: p.price,
      pricingPending: p.pricingPending ?? false,
      priceAdjustNote: p.priceAdjustNote ?? null,
      requestedByPartner: p.requestedByPartner ?? false,
      createdAt,
      completedAt: p.state === 'completed' ? closedAt : null,
      cancelledAt: p.state === 'cancelled' ? closedAt : null,
      billedInvoiceId: null,
    }
    data.projects.push(project)
    projectIds.set(p.key, project.id)
  })

  /* --------------------------------------------------------------- plans */
  const plans: TaskPlan[] = []
  const base = (over: Partial<TaskPlan> & Pick<TaskPlan, 'partnerId' | 'title' | 'state' | 'createdAt' | 'creator' | 'source'>): TaskPlan => ({
    key: null,
    templateCode: null,
    projectKey: null,
    description: '',
    points: null,
    pricingPending: false,
    deadline: null,
    finishedAt: null,
    verifiedAt: null,
    endAt: over.createdAt,
    assignees: [],
    selfAssigned: false,
    hasNewReplies: false,
    sendBack: false,
    detour: false,
    testing: false,
    cancelledBy: null,
    messages: 0,
    ...over,
  })

  // Historical, partner-verified work: P-6 .. P0.
  for (const p of PARTNERS) {
    const admin = mainAdmin(p.id)
    p.verifiedPerMonth.forEach((count, idx) => {
      const n = idx - 6
      for (let j = 0; j < count; j += 1) {
        const verifiedAt = ctx.inPeriod(n, (j + 0.35 + rng.next() * 0.5) / count)
        const forced = p.key === 'mzeo' && n === -1 ? MZEO_PREV_MONTH[j] : p.key === 'zemo' && n === -1 ? ZEMO_PREV_MONTH[j] : undefined
        const tpl = forced ? TEMPLATES.find((t) => t.code === forced) : rng.chance(0.08) ? TEMPLATES.find((t) => t.points === null) : rng.pick(visibleFixed(p.id))
        const code = tpl?.code ?? 'OTHER_PROBLEM'
        const points = tpl?.points === null ? rng.pick([2, 3, 4.5]) : effectivePoints(p.id, code)
        const finishedAt = plusHours(verifiedAt, -(6 + rng.int(0, 60)))
        const createdAt = plusHours(finishedAt, -24 * (2 + rng.int(0, 12)) - rng.int(1, 8))
        const source = rng.chance(0.55) ? 'mail' : 'portal'
        const assignee = n === -6 && tpl?.kind === 'web' && rng.chance(0.5) ? 'usr_davit' : techFor(tpl)
        const title = tpl ? rng.pick(tpl.titles) : 'Other problem'
        plans.push(
          base({
            partnerId: p.id,
            templateCode: code,
            title,
            description: describe(title, tpl, p.id),
            state: 'verified',
            points,
            createdAt,
            finishedAt,
            verifiedAt,
            endAt: verifiedAt,
            deadline: source === 'portal' && rng.chance(0.4) ? endOfDayIso(isoDate(plusHours(createdAt, 24 * (7 + rng.int(0, 7))))) : null,
            assignees: [assignee],
            selfAssigned: source === 'portal' && rng.chance(0.35),
            creator: source === 'mail' ? { kind: 'staff', id: rng.pick(L1_IDS) } : { kind: 'partner', adminId: admin?.id ?? '', name: admin?.fullName ?? p.name },
            source,
            sendBack: rng.chance(0.12),
            detour: rng.chance(0.2),
            testing: rng.chance(0.35),
            messages: rng.int(0, 2),
          }),
        )
      }
    })
  }

  // Past project member tasks.
  for (const [projectKey, title, assignee, state, created, done] of PAST_PROJECT_TASKS) {
    const project = PROJECTS.find((x) => x.key === projectKey)
    if (!project) continue
    const createdAt = ctx.inPeriod(created[0], created[1])
    const doneAt = ctx.inPeriod(done[0], done[1])
    const verified = state === 'verified'
    plans.push(
      base({
        partnerId: project.partnerId,
        projectKey,
        title,
        description: describe(title, undefined, project.partnerId),
        state,
        createdAt,
        finishedAt: verified ? plusHours(doneAt, -20) : null,
        verifiedAt: verified ? doneAt : null,
        endAt: doneAt,
        assignees: [assignee],
        creator: { kind: 'staff', id: 'usr_mariam' },
        source: 'staff',
        cancelledBy: state === 'cancelled' ? 'partner' : null,
        messages: rng.int(0, 1),
      }),
    )
  }

  // Live work: what the queues show today.
  for (const spec of LIVE) {
    const tpl = spec.tpl ? TEMPLATES.find((t) => t.code === spec.tpl) : undefined
    const admin = spec.partner ? mainAdmin(spec.partner) : undefined
    const createdAt = ctx.ago(spec.created)
    const finishedAt = spec.finished !== undefined ? ctx.ago(spec.finished) : null
    const elapsed = ctx.now.getTime() - new Date(createdAt).getTime()
    const endAt = finishedAt ?? ctx.clamp(new Date(createdAt).getTime() + elapsed * (spec.state === 'cancelled' ? 0.3 : spec.state === 'accepted' ? 0 : 0.5))
    const creator: Creator =
      spec.source === 'portal' && admin ? { kind: 'partner', adminId: admin.id, name: admin.fullName } : { kind: 'staff', id: spec.source === 'staff' ? (spec.partner ? 'usr_mariam' : 'usr_nino') : rng.pick(L1_IDS) }
    plans.push(
      base({
        key: spec.key ?? null,
        partnerId: spec.partner,
        templateCode: spec.tpl ?? null,
        projectKey: spec.project ?? null,
        title: spec.title,
        description: describe(spec.title, tpl, spec.partner),
        state: spec.state,
        points: spec.pricingPending || !spec.partner || !spec.tpl ? null : effectivePoints(spec.partner, spec.tpl),
        pricingPending: spec.pricingPending ?? false,
        createdAt,
        deadline: spec.deadline !== undefined ? addDaysIso(ctx.now, spec.deadline) : null,
        finishedAt,
        endAt,
        assignees: spec.assignees,
        selfAssigned: spec.source === 'portal' && spec.assignees.length === 1 && rng.chance(0.5),
        creator,
        source: spec.source,
        hasNewReplies: spec.replies ?? false,
        testing: spec.testing ?? false,
        cancelledBy: spec.cancelledBy ?? null,
        messages: spec.messages ?? 0,
      }),
    )
  }

  /* --------------------------------------------------------- materialize */
  plans.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const seeded: SeededTask[] = []
  const byKey = new Map<string, Task>()

  plans.forEach((plan, index) => {
    const tpl = plan.templateCode ? tplByCode(plan.templateCode) : undefined
    const adminName = plan.partnerId ? (mainAdmin(plan.partnerId)?.fullName ?? 'Partner') : 'Partner'
    const creatorRef = plan.creator.kind === 'staff' ? { id: plan.creator.id as string | null, name: staffName(plan.creator.id) } : { id: null, name: plan.creator.name }
    const workerId = plan.assignees[0] ?? (plan.creator.kind === 'staff' ? plan.creator.id : 'usr_mariam')
    const worker = { id: workerId as string | null, name: staffName(workerId) }
    const partnerActor = { id: null as string | null, name: adminName }

    const task: Task = {
      id: newId('tsk_'),
      number: 1101 + index,
      partnerId: plan.partnerId,
      templateId: tpl?.id ?? null,
      projectId: plan.projectKey ? (projectIds.get(plan.projectKey) ?? null) : null,
      title: plan.title,
      description: plan.description,
      state: plan.state,
      points: plan.points,
      pricingPending: plan.pricingPending,
      deadline: plan.deadline,
      createdById: plan.creator.kind === 'staff' ? plan.creator.id : null,
      createdByPartnerAdminId: plan.creator.kind === 'partner' ? plan.creator.adminId : null,
      finishedAt: plan.finishedAt,
      verifiedAt: plan.verifiedAt,
      hasNewReplies: plan.hasNewReplies,
      createdAt: plan.createdAt,
      updatedAt: plan.createdAt,
    }

    // State path.
    type Step = { to: TaskState; by: { id: string | null; name: string }; note: string | null }
    const steps: Step[] = [{ to: 'accepted', by: creatorRef, note: plan.source === 'mail' ? 'Created from mail' : null }]
    const work = (to: TaskState, note: string | null = null) => steps.push({ to, by: worker, note })
    switch (plan.state) {
      case 'in_progress':
        work('in_progress')
        break
      case 'pending':
        work('in_progress')
        work('pending', 'Waiting for the partner to confirm a test window')
        break
      case 'testing':
        work('in_progress')
        work('testing')
        break
      case 'finished':
        work('in_progress')
        if (plan.testing) work('testing')
        work('finished')
        break
      case 'verified':
        work('in_progress')
        if (plan.detour) {
          work('pending', 'Waiting for the partner to confirm a test window')
          work('in_progress')
        }
        if (plan.testing) work('testing')
        work('finished')
        if (plan.sendBack) {
          steps.push({ to: 'in_progress', by: partnerActor, note: rng.pick(SEND_BACK_NOTES) })
          work('finished')
        }
        steps.push({ to: 'verified', by: partnerActor, note: null })
        break
      case 'cancelled':
        if (plan.cancelledBy === 'staff' && plan.assignees.length > 0) work('in_progress')
        steps.push({
          to: 'cancelled',
          by: plan.cancelledBy === 'partner' ? partnerActor : worker,
          note: plan.cancelledBy === 'partner' ? 'No longer needed' : 'Duplicate of another task; closing',
        })
        break
      default:
        break
    }
    let times: string[]
    if (plan.state === 'verified' && plan.finishedAt && plan.verifiedAt) {
      times = [...spread(plan.createdAt, plan.finishedAt, steps.length - 1), plan.verifiedAt]
    } else if (plan.state === 'finished' && plan.finishedAt) {
      times = spread(plan.createdAt, plan.finishedAt, steps.length)
    } else {
      times = spread(plan.createdAt, plan.endAt, steps.length)
    }
    let previous: TaskState | null = null
    steps.forEach((step, i) => {
      data.taskHistory.push({
        id: newId('hist_'),
        taskId: task.id,
        fromState: previous,
        toState: step.to,
        changedById: step.by.id,
        changedByName: step.by.name,
        changedAt: times[i],
        note: step.note,
      })
      previous = step.to
    })
    task.updatedAt = times[times.length - 1]

    // Assignees.
    for (const userId of plan.assignees) {
      const self = plan.selfAssigned && userId === plan.assignees[0]
      data.taskAssignees.push({
        taskId: task.id,
        userId,
        assignedById: self ? userId : plan.creator.kind === 'staff' ? plan.creator.id : rng.pick(L1_IDS),
        assignedAt: minIso(plusHours(plan.createdAt, 0.5 + rng.next() * 2), times[Math.min(1, times.length - 1)]),
      })
    }

    // Chat.
    if (plan.messages > 0) {
      const lastAt = plan.state === 'accepted' ? ctx.clamp(plusHours(plan.createdAt, 3)) : times[times.length - 1]
      const at = spread(plusHours(plan.createdAt, 0.7), lastAt, plan.messages)
      at.forEach((when, i) => {
        const internal = !plan.partnerId
        const partnerTurn = !internal && i % 2 === (plan.source === 'portal' ? 0 : 1)
        const internalOnly = internal || (!partnerTurn && rng.chance(0.25))
        data.taskMessages.push({
          id: newId('msg_'),
          taskId: task.id,
          authorKind: partnerTurn ? 'partner' : 'internal',
          authorId: partnerTurn ? (mainAdmin(plan.partnerId ?? '')?.id ?? null) : worker.id,
          authorName: partnerTurn ? adminName : worker.name,
          body: partnerTurn ? rng.pick(PARTNER_MESSAGES) : internalOnly ? rng.pick(INTERNAL_NOTES) : rng.pick(STAFF_MESSAGES),
          internalOnly: partnerTurn ? false : internalOnly,
          createdAt: ctx.clamp(when),
        })
      })
    }
    // A send-back comment is also posted to the chat.
    if (plan.sendBack) {
      const row = data.taskHistory.find((h) => h.taskId === task.id && h.fromState === 'finished' && h.toState === 'in_progress')
      if (row) {
        data.taskMessages.push({
          id: newId('msg_'),
          taskId: task.id,
          authorKind: 'partner',
          authorId: mainAdmin(plan.partnerId ?? '')?.id ?? null,
          authorName: adminName,
          body: row.note ?? '',
          internalOnly: false,
          createdAt: row.changedAt,
        })
      }
    }

    data.tasks.push(task)
    seeded.push({ task, plan })
    if (plan.key) byKey.set(plan.key, task)
  })

  /* --------------------------------------------------------------- points */
  const verified = seeded.filter((s) => s.task.state === 'verified' && s.task.verifiedAt).sort((a, b) => (a.task.verifiedAt ?? '').localeCompare(b.task.verifiedAt ?? ''))
  for (const { task } of verified) {
    const adminName = mainAdmin(task.partnerId ?? '')?.fullName ?? null
    debitOnVerify(data, task, task.verifiedAt ?? task.updatedAt, adminName)
  }
  const p2 = ctx.period(-2)
  const p1 = ctx.period(-1)
  adjustPoints(data, {
    partnerId: 'prt_mzeo', year: p2.year, month: p2.month, points: 3, kind: 'adjustment_credit',
    note: 'Goodwill credit for the trunk outage on the 14th', actorName: 'Levan Abashidze', at: ctx.inPeriod(-2, 0.6),
  })
  adjustPoints(data, {
    partnerId: 'prt_lukma', year: p1.year, month: p1.month, points: 2, kind: 'adjustment_debit',
    note: 'Weekend on-call support during the Saturday cutover', actorName: 'Levan Abashidze', at: ctx.inPeriod(-1, 0.7),
  })

  // Keep the data newest-first where lists usually show it that way.
  data.taskMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { tasks: seeded, byKey }
}
