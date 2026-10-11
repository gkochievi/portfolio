/**
 * Recordings: the review queue of every workspace, built from the precomputed
 * canned calls. Uploads in the live demo clone the closest canned call; these
 * are the ones already sitting in the lists.
 */
import type { CannedCall, Id, Recording, ScoreRevision } from '@/types'
import { after, ago, applyScoreEdit, transcriptOf } from './build'

interface Plan {
  id: Id
  /** Canned call whose results this recording carries. */
  canned: Id
  filename: string
  created_by: string
  /** Uploaded this many days (+ hours) before SEED_DATE. */
  days: number
  hours?: number
  /** Transcribed but nothing analysed yet (for the "All at once" flow). */
  transcribedOnly?: boolean
  override?: Recording['transcription_override']
  /** A reviewer's manual score edit (revision 2). */
  edit?: { scores: Record<string, number>; by: string; note: string; afterMinutes: number }
}

export const RECORDING_PLAN: Plan[] = [
  {
    id: 'rec_mtb_01',
    canned: 'cc_mtb_01',
    filename: '2026-09-29_loan_early-repayment.mp3',
    created_by: 'Nino Kurtanidze',
    days: 2,
    hours: 5,
    edit: {
      scores: { resolution: 45 },
      by: 'Tamar Gelashvili',
      afterMinutes: 190,
      note: 'Resolution lowered: the customer ended the call believing early repayment is free. The 1% fee in the first 12 months was never mentioned, and he has now called twice. Coaching item for Lasha; the loans document wording is queued in KB health.',
    },
  },
  { id: 'rec_mtb_02', canned: 'cc_mtb_02', filename: '2026-09-28_lost-card.mp3', created_by: 'Nino Kurtanidze', days: 3, hours: 2 },
  { id: 'rec_mtb_03', canned: 'cc_mtb_03', filename: '2026-09-25_deposit-rates.wav', created_by: 'Nino Kurtanidze', days: 6 },
  { id: 'rec_mtb_04', canned: 'cc_mtb_04', filename: '2026-09-22_swift-fee-complaint.mp3', created_by: 'Tamar Gelashvili', days: 9, hours: 3 },
  {
    id: 'rec_mtb_05',
    canned: 'cc_mtb_05',
    filename: '2026-09-18_mortgage-prequalification.m4a',
    created_by: 'Nino Kurtanidze',
    days: 13,
    hours: 1,
    override: { language_code: 'en' },
  },
  {
    id: 'rec_mtb_06',
    canned: 'cc_mtb_06',
    filename: '2026-09-15_gold-card-fee.mp3',
    created_by: 'Nino Kurtanidze',
    days: 16,
    hours: 4,
    edit: {
      scores: { resolution: 75 },
      by: 'Tamar Gelashvili',
      afterMinutes: 1500,
      note: 'Resolution raised: the customer switched to a Classic card in the same call and the 60 GEL charge was escalated for review. The wrong "first year is free" statement is already counted under information accuracy.',
    },
  },
  { id: 'rec_mtb_07', canned: 'cc_mtb_07', filename: 'webchat_2026-09-12_app-login.txt', created_by: 'Nino Kurtanidze', days: 19, hours: 2 },
  { id: 'rec_mtb_08', canned: 'cc_mtb_08', filename: '2026-10-01_card-limit-increase.mp3', created_by: 'Nino Kurtanidze', days: 0, hours: 3, transcribedOnly: true },
  { id: 'rec_pari_01', canned: 'cc_pari_01', filename: 'webchat_kasko-claim.txt', created_by: 'Mariam Abashidze', days: 4, hours: 3 },
  { id: 'rec_pari_02', canned: 'cc_pari_02', filename: 'webchat_schengen-policy.txt', created_by: 'Zviad Kobakhidze', days: 8, hours: 5 },
  { id: 'rec_pari_03', canned: 'cc_pari_03', filename: 'webchat_family-health-plan.txt', created_by: 'Mariam Abashidze', days: 11 },
  { id: 'rec_ias_01', canned: 'cc_ias_01', filename: 'cardiology-booking.txt', created_by: 'Ketevan Tsereteli', days: 5, hours: 6 },
  { id: 'rec_ias_02', canned: 'cc_ias_02', filename: 'lab-results-timing.txt', created_by: 'Lela Gogua', days: 12, hours: 2 },
  { id: 'rec_drb_01', canned: 'cc_drb_01', filename: 'home-internet-outage.txt', created_by: 'Irakli Tsiklauri', days: 3, hours: 7 },
  { id: 'rec_drb_02', canned: 'cc_drb_02', filename: 'roaming-pack-europe.txt', created_by: 'Tea Mikadze', days: 7, hours: 1 },
  { id: 'rec_nob_01', canned: 'cc_nob_01', filename: 'chat_missing-item-refund.txt', created_by: 'Sopo Chikovani', days: 6, hours: 4 },
]

const STT_MODEL = 'scribe_v1'
const LLM_MODEL = 'claude-sonnet-4-5'

/** When a recording's analysers finished (just after upload). */
export function plannedRanAt(cannedId: Id): string {
  const plan = RECORDING_PLAN.find((p) => p.canned === cannedId)
  return after(ago(plan?.days ?? 1, plan?.hours ?? 0), 75_000)
}

const clone = <T>(value: T): T => structuredClone(value)

function scoreMap(card: NonNullable<Recording['scoring']>): Record<string, number | null> {
  return Object.fromEntries(card.dimensions.map((d) => [d.key, d.score]))
}

/** Recordings for every plan entry, plus the one that failed to decode. */
export function buildRecordings(cannedCalls: readonly CannedCall[]): Recording[] {
  const byId = new Map(cannedCalls.map((c) => [c.id, c]))
  const out: Recording[] = []

  for (const plan of RECORDING_PLAN) {
    const canned = byId.get(plan.canned)
    if (!canned) throw new Error(`seed: ${plan.id} points at missing canned call ${plan.canned}`)
    const audio = canned.segments.some((s) => s.start !== null)
    const created_at = ago(plan.days, plan.hours ?? 0)
    const ranAt = after(created_at, 75_000)
    const segments = clone(canned.segments)
    const transcript = transcriptOf(segments, canned.language)
    const lines = segments.length

    const base = {
      id: plan.id,
      client_id: canned.client_id,
      user_id: null,
      created_by: plan.created_by,
      filename: plan.filename,
      source: audio ? ('audio' as const) : ('text' as const),
      error: null,
      language: canned.language,
      duration_s: canned.duration_s,
      audio_url: canned.audio_url,
      peaks: clone(canned.peaks),
      segments,
      transcript,
      running: [] as Recording['running'],
      transcription_override: plan.override ?? null,
      stt_model: audio ? STT_MODEL : null,
      canned_id: canned.id,
      created_at,
    }

    if (plan.transcribedOnly) {
      out.push({
        ...base,
        status: 'ready',
        analysis: null,
        kb_used: [],
        kb_check: null,
        semantic: null,
        sentiment: null,
        scoring: null,
        revisions: [],
        ran: { factcheck: false, score: false, semantic: false, summary: false },
        llm_model: null,
        processing_ms: 11_800,
      })
      continue
    }

    let scoring = clone(canned.scoring)
    let analysis = clone(canned.analysis)
    const revisions: ScoreRevision[] = [
      {
        revision: 1,
        scores: scoreMap(scoring),
        note: '',
        edited_by: 'Sinji model',
        created_at: ranAt,
        weighted_total: scoring.weighted_total,
      },
    ]
    if (plan.edit) {
      const editedAt = after(ranAt, plan.edit.afterMinutes * 60_000)
      scoring = applyScoreEdit(scoring, plan.edit.scores, plan.edit.by, editedAt)
      analysis = { ...analysis, quality_score: scoring.weighted_total }
      revisions.push({
        revision: 2,
        scores: scoreMap(scoring),
        note: plan.edit.note,
        edited_by: plan.edit.by,
        created_at: editedAt,
        weighted_total: scoring.weighted_total,
      })
    }

    const kb_used = [
      ...new Set(canned.kb_check.claims.map((c) => c.evidence?.document_id).filter((id): id is Id => Boolean(id))),
    ]

    out.push({
      ...base,
      status: 'done',
      analysis,
      kb_used,
      kb_check: clone(canned.kb_check),
      semantic: clone(canned.semantic),
      sentiment: clone(canned.sentiment),
      scoring,
      revisions,
      ran: { factcheck: true, score: true, semantic: true, summary: true },
      llm_model: LLM_MODEL,
      processing_ms: audio ? 14_000 + Math.round((canned.duration_s ?? 0) * 420) : 5200 + lines * 160,
    })
  }

  out.push({
    id: 'rec_mtb_09',
    client_id: 'tn_mtiebi',
    user_id: null,
    created_by: 'Nino Kurtanidze',
    filename: 'call_2026-09-29_broken.amr',
    source: 'audio',
    status: 'error',
    error: 'The audio could not be decoded (unsupported AMR variant). Export the call as MP3 or WAV and upload it again.',
    language: null,
    duration_s: null,
    audio_url: null,
    peaks: null,
    segments: [],
    transcript: '',
    analysis: null,
    kb_used: [],
    kb_check: null,
    semantic: null,
    sentiment: null,
    scoring: null,
    revisions: [],
    ran: { factcheck: false, score: false, semantic: false, summary: false },
    running: [],
    transcription_override: null,
    stt_model: STT_MODEL,
    llm_model: null,
    processing_ms: 2300,
    canned_id: null,
    created_at: ago(2, 14),
  })

  return out
}
