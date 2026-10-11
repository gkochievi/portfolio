/**
 * Owner: group standings (see PLAN.md). Endpoints:
 *   GET /leaderboard (public), GET /admin/leaderboard/users/:userId
 *
 * Import store/bus from '../store', guards from '../guards', selectors from
 * '../selectors'. Never import from '@/demo' (circular).
 */
import { DemoApiError, type MockApi } from '@portfolio/demo-kit'

import { isStaffRole } from '@/lib/roles'
import type { CatchTally, GameEvent, LeaderboardResponse, PlayerDetail } from '@/types'
import { currentUser, requireStaff } from '../guards'
import { bestScore, bonusPoints, currentEvent, leaderboard } from '../selectors'
import { nowIso, store } from '../store'

/** A breakdown row as the drill-down receives it: the item's art rides along when the item still exists. */
export type DetailCatch = CatchTally & { total: number; imageUrl: string | null }

function findEvent(eventId: string | undefined, staff: boolean): GameEvent | null {
  if (!eventId) return currentEvent(store.data)
  const event = store.data.events.find((candidate) => candidate.id === eventId)
  // The public never learns about unpublished events.
  if (!event || (!staff && !event.published)) throw new DemoApiError(404, 'standings:errors.eventNotFound')
  return event
}

export function registerStandings(api: MockApi): void {
  api.register(
    'GET',
    '/leaderboard',
    ({ params }): LeaderboardResponse => {
      const viewer = currentUser()
      const staff = Boolean(viewer && !viewer.disabled && isStaffRole(viewer.role))
      const event = findEvent(params.eventId, staff)
      if (!event) return { event: null, hidden: false, rows: [], updatedAt: nowIso() }
      if (!staff && !event.leaderboardVisible) return { event, hidden: true, rows: [], updatedAt: nowIso() }
      const rows = leaderboard(store.data, event, viewer?.id ?? null).map((row) => (staff ? row : { ...row, userId: null }))
      return { event, hidden: false, rows, updatedAt: nowIso() }
    },
    { requiresAuth: false },
  )

  api.register('GET', '/admin/leaderboard/users/:userId', ({ path, params }): PlayerDetail => {
    requireStaff()
    const event = findEvent(params.eventId, true)
    if (!event) throw new DemoApiError(404, 'standings:errors.eventNotFound')
    const user = store.data.users.find((candidate) => candidate.id === path.userId)
    if (!user) throw new DemoApiError(404, 'standings:errors.playerNotFound')

    const plays = store.data.plays
      .filter((play) => play.userId === user.id && play.eventId === event.id)
      .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
      .slice(0, 200)

    // Item art by name+type, so the drill-down can show the same coin the player caught.
    const art = new Map<string, string | null>()
    for (const item of store.data.items) {
      const key = `${item.name}|${item.type}`
      if (item.eventId === event.id || !art.has(key)) art.set(key, item.imageUrl)
    }

    const merged = new Map<string, DetailCatch>()
    for (const play of plays) {
      for (const row of play.breakdown ?? []) {
        if (!row || typeof row !== 'object') continue
        const key = `${row.name}|${row.type}`
        let tally = merged.get(key)
        if (!tally) {
          tally = { name: row.name, type: row.type, l1: 0, l2: 0, l3: 0, total: 0, imageUrl: art.get(key) ?? null }
          merged.set(key, tally)
        }
        tally.l1 += Number(row.l1) || 0
        tally.l2 += Number(row.l2) || 0
        tally.l3 += Number(row.l3) || 0
      }
    }
    const breakdown: DetailCatch[] = [...merged.values()]
      .map((tally) => ({ ...tally, total: tally.l1 + tally.l2 + tally.l3 }))
      .filter((tally) => tally.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

    return {
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        position: user.position,
        role: user.role,
      },
      bestScore: bestScore(store.data, user.id, event.id),
      bonusPoints: bonusPoints(store.data, user.id, event.id),
      totalPlays: plays.length,
      breakdown,
      plays: plays.slice(0, 20).map((play) => ({ score: play.score, playedAt: play.playedAt })),
    }
  })
}
