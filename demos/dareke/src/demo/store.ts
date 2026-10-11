/**
 * The in-memory store and the session. No imports from
 * handlers or simulators, so everything can import this without cycles.
 */
import { createSession, createStore } from '@portfolio/demo-kit'

import type { DarekeAccount, DemoData, User } from '@/types'
import { accounts } from './accounts'
import { buildSeed } from './seed'

/**
 * Every reset rebuilds the seed relative to "now", so charts never look stale
 * (the first copy is the boot seed itself, built a moment ago).
 */
let booting = true
export const store = createStore<DemoData>(buildSeed(), {
  prepare: (copy) => {
    if (booting) {
      booting = false
      return copy
    }
    return buildSeed(Date.now())
  },
})

/** Starts signed in as the operator. */
export const session = createSession<DarekeAccount>(accounts, { initial: 'u_mariam' })

/** The signed-in User row, or null. */
export function currentUser(): User | null {
  const account = session.current()
  if (!account) return null
  return store.data.users.find((user) => user.id === account.userId) ?? null
}
