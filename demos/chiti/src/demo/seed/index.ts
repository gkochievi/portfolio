/**
 * The pristine seed (owner: data-core). Built once per page load from
 * deterministic generators (createRandom(20261005) and friends) and compiled
 * into the bundle; the store deep-copies and rebases it on every reset.
 */
import type { ChitiAccount, ChitiDb } from '@/types'

import {
  buildAccounts,
  buildAdmins,
  buildAiLinks,
  buildBans,
  buildCustomFields,
  buildIntegrations,
  buildOperators,
  buildPlatform,
  buildQuickReplies,
  buildSettings,
  buildSuperAdmins,
  buildSupervisors,
  buildTemplates,
  buildTenants,
  buildWorkingHours,
} from './config'
import { buildConversations } from './conversations'
import { buildActivity, buildComments, buildHealthSamples, buildOperatorAudit, buildStaffChat } from './social'

export function buildSeed(): ChitiDb {
  const tenants = buildTenants()
  const settings = buildSettings(tenants)
  const operators = buildOperators()
  const admins = buildAdmins()
  const supervisors = buildSupervisors()
  const superAdmins = buildSuperAdmins()
  const vaziSettings = settings.find((row) => row.tenantId === 'ten_vazi') as ChitiDb['settings'][number]
  const conversations = buildConversations({ operators, settings: vaziSettings, tree: vaziSettings.faqTree })

  for (const operator of operators) {
    operator.activeChatCount = conversations.sessions.filter(
      (session) => session.operatorId === operator.id && (session.status === 'active' || session.status === 'inactive'),
    ).length
  }
  const vazi = tenants.find((tenant) => tenant.id === 'ten_vazi')
  if (vazi) {
    vazi.counts = {
      operators: operators.filter((row) => row.tenantId === vazi.id).length,
      admins: admins.filter((row) => row.tenantId === vazi.id).length,
      supervisors: supervisors.filter((row) => row.tenantId === vazi.id).length,
      customers: conversations.customers.length,
      sessions: conversations.sessions.length,
    }
  }
  const staffChat = buildStaffChat(operators, admins, supervisors)

  return {
    tenants,
    settings,
    workingHours: buildWorkingHours(tenants),
    operators,
    admins,
    supervisors,
    superAdmins,
    customers: conversations.customers,
    sessions: conversations.sessions,
    messages: conversations.messages,
    assignments: conversations.assignments,
    notes: conversations.notes,
    feedback: conversations.feedback,
    customFields: buildCustomFields(),
    quickReplies: buildQuickReplies(),
    bans: buildBans(),
    waTemplates: buildTemplates(),
    integrations: buildIntegrations(tenants),
    comments: buildComments(),
    staffConversations: staffChat.conversations,
    staffMessages: staffChat.messages,
    activity: buildActivity(
      operators,
      conversations.sessions.filter((session) => session.status === 'ended'),
      conversations.messages.filter((message) => message.type === 'template'),
    ),
    operatorAudit: buildOperatorAudit(operators),
    copilotDrafts: conversations.copilotDrafts,
    copilotFeedback: [],
    aiLinks: buildAiLinks(tenants),
    platform: buildPlatform(),
    healthSamples: buildHealthSamples(),
    demo: {
      fastInactivity: false,
      simulatedIp: '198.51.100.24',
      aiOutageUntil: null,
      operatorDriving: false,
      spawnerEnabled: true,
      tiktokConnectResult: 'connected',
    },
  }
}

/** The pristine seed, authored as of SEED_ANCHOR (never mutated). */
export const seed: ChitiDb = buildSeed()
/** Every sign-in-able account: one per staff record + superadmin + the customer persona. */
export const seedAccounts: ChitiAccount[] = buildAccounts(seed)

export { ROLE_HOME, staffAccount, VAZI_PERSONA, buildVaziFaq } from './config'
export { sectionOf } from './social'
export { BOT_HANDOVER_LINE, BOT_NAME, buildTranscript, endSummaryFor, handoffBrief, orderNumberFor } from './scripts'
export { DEMO_PASSWORD, MEDIA, mediaFile, chatMedia, fakePhone } from './util'
