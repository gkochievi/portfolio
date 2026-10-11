/**
 * Owner: data agent. The pristine seed, authored as of SEED_ANCHOR; the store
 * rebases every `...At` timestamp onto "now" on load and on reset.
 *
 * Fixed ids other agents rely on:
 *   users   usr_saba (demo player), usr_mariam (SUPERVISOR), usr_davit (ADMIN),
 *           usr_tamar (SUPERADMIN), usr_nodar (ADMIN), ghosts usr_g1..usr_g3
 *   events  evt_narinji (live), evt_pilpili (closed, notified), evt_velo,
 *           evt_batumi, evt_kutaisi (closed), evt_rtveli, evt_newyear
 *           (upcoming), evt_popup (hold), evt_draft (hold, empty)
 *
 * Volumes: 29 users (4 staff, 25 players), 9 events, 35 items, ~125 plays,
 * 8 trivia questions, ~70 answers, 8 prizes.
 */
import type { DemoDb } from '@/types'
import { EVENTS, ITEMS, LIVE_EVENT_ID, PRIZES, QUESTIONS } from './content'
import { ANSWERS, PLAYERS, PLAYS } from './generate'
import { STAFF } from './people'

export { SEED_ANCHOR } from './time'
export { LIVE_EVENT_ID }
export { DEMO_ACCOUNTS, DEMO_OTP, DEMO_PASSWORD } from './accounts'

/** Ghost players the standings simulator moves around the live board. */
export const GHOST_IDS = ['usr_g1', 'usr_g2', 'usr_g3'] as const

export const seed: DemoDb = {
  users: [...STAFF, ...PLAYERS],
  events: EVENTS,
  items: ITEMS,
  plays: PLAYS,
  questions: QUESTIONS,
  answers: ANSWERS,
  prizes: PRIZES,
}
