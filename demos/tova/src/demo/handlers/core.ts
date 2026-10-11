/** Owner: data agent. Shared public reads. */
import type { MockApi } from '@portfolio/demo-kit'

import type { CurrentEvents } from '@/types'
import { activeEvent, currentEvent, upcomingEvent } from '../selectors'
import { nowIso, store } from '../store'

export function registerCore(api: MockApi): void {
  api.register(
    'GET',
    '/events/current',
    (): CurrentEvents => {
      const now = Date.now()
      const db = store.data
      return { active: activeEvent(db, now), current: currentEvent(db, now), upcoming: upcomingEvent(db, now), now: nowIso() }
    },
    { requiresAuth: false },
  )
}
