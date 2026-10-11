/**
 * The pristine seed, assembled from the authored parts. Author every timestamp
 * as of SEED_DATE; `createStore`'s `prepare` runs `rebaseDates` so the data
 * always looks current. Deterministic: no Math.random, no Date.now.
 */
import type { CannedCall, DemoDb, Id, KbChunk, KbDocument, ReembedJob } from '@/types'
import { ago, after, buildCall, buildKb, buildSegments, SEED_DATE, type CallSpec } from './build'
import { buildChat } from './chat'
import { ccMtb01, ccMtb02, ccMtb03, ccMtb04 } from './calls-mtiebi-a'
import { ccMtb05, ccMtb06, ccMtb07, ccMtb08 } from './calls-mtiebi-b'
import { otherCalls } from './calls-others'
import { buildCuration, buildKbEvents } from './kb-activity'
import { mtiebiDocs } from './kb-mtiebi'
import { darbaziDocs, iasamaniDocs, mzetamzeDocs, nobatiDocs, pariDocs } from './kb-others'
import { resolveCallMedia } from './media'
import {
  aiAssignments,
  aiByo,
  aiConnections,
  aiLegacy,
  aiProviders,
  appUsers,
  botConfigs,
  integrations,
  killState,
  limits,
  settings,
  tenants as baseTenants,
  tenantUsers,
} from './platform'
import { buildRecordings, plannedRanAt } from './recordings'
import { rubricFor, scoreBands, scoringConfigs, sentimentConfigs, transcriptionConfigs } from './rubrics'
import { summaries } from './summaries'
import {
  cannedTranscripts,
  conversionBatches,
  convertFormats,
  convertLimits,
  ttsClips,
  ttsLanguages,
  ttsModels,
  voices,
} from './voice'

export { SEED_DATE }

/* ----------------------------------------------------- knowledge bases */

const bundles = [
  buildKb('mtb', 'tn_mtiebi', mtiebiDocs, 'Tamar Gelashvili'),
  buildKb('pari', 'tn_pari', pariDocs, 'Mariam Abashidze'),
  buildKb('ias', 'tn_iasamani', iasamaniDocs, 'Ketevan Tsereteli'),
  buildKb('drb', 'tn_darbazi', darbaziDocs, 'Irakli Tsiklauri'),
  buildKb('nob', 'tn_nobati', nobatiDocs, 'Sopo Chikovani'),
  buildKb('mze', 'tn_mzetamze', mzetamzeDocs, 'Natia Dolidze'),
]
const kbDocuments: KbDocument[] = bundles.flatMap((b) => b.documents)
const kbChunks: KbChunk[] = bundles.flatMap((b) => b.chunks)

const chunkById = new Map(kbChunks.map((c) => [c.id, c]))
const docById = new Map(kbDocuments.map((d) => [d.id, d]))
const lookup = (id: Id) => {
  const chunk = chunkById.get(id)
  const doc = chunk ? docById.get(chunk.document_id) : undefined
  return chunk && doc ? { chunk, doc } : undefined
}

/* ------------------------------------------------------- calls, reviews */

const callSpecs: CallSpec[] = [ccMtb01, ccMtb02, ccMtb03, ccMtb04, ccMtb05, ccMtb06, ccMtb07, ccMtb08, ...otherCalls]

const cannedCalls: CannedCall[] = callSpecs.map((spec) => {
  const { segments, media } = resolveCallMedia(spec.id, buildSegments(spec.lines, spec.timed, spec.id), spec.timed)
  return buildCall(spec, segments, media, rubricFor(spec.client_id), lookup, plannedRanAt(spec.id))
})

const recordings = buildRecordings(cannedCalls)

/* -------------------------------------------------------- conversations */

const chat = buildChat(lookup)

/* ----------------------------------------------------------- tenants */

const tenants = baseTenants.map((t) => ({
  ...t,
  users: tenantUsers.filter((u) => u.client_id === t.id).length,
  documents: kbDocuments.filter((d) => d.client_id === t.id).length,
}))

const lastReembed: ReembedJob = {
  id: 'rej_mtb_01',
  client_id: 'tn_mtiebi',
  state: 'done',
  total_documents: 14,
  done_documents: 13,
  failed_documents: 1,
  created_at: ago(44),
  finished_at: after(ago(44), 41_200),
  error: null,
}

/** Break every shared reference (rebasing a node reachable twice would shift it twice). */
const unshare = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const seed: DemoDb = unshare({
  tenants,
  tenantUsers,
  appUsers,

  cannedCalls,
  recordings,
  summaries,

  scoringConfigs,
  scoreBands,
  rubricImportJobs: [],

  kbDocuments,
  kbChunks,
  kbEvents: buildKbEvents(kbDocuments),
  reembedJobs: [lastReembed],
  curationProposals: buildCuration(lookup),

  sentimentConfigs,
  transcriptionConfigs,

  aiProviders,
  aiConnections,
  aiAssignments,
  aiByo,
  aiLegacy,
  integrations,

  botConfigs,
  killState,
  conversations: chat.conversations,
  turns: chat.turns,
  copilotFeedback: chat.feedback,

  /** Filled by `generateUsage` in the store's `prepare` (usage group). */
  llmUsage: [],

  limits,
  /** Today's spend per principal; in memory only. */
  quotaUsed: {},
  ttsLanguages,
  voices,
  ttsModels,
  ttsClips,
  cannedTranscripts,
  convertFormats,
  convertLimits,
  conversionBatches,

  settings,
})
